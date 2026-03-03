"""Workflow Executor - Executes approved workflow actions.

This executor:
- Takes approved execution records
- Routes execution by workflow mode (cards, cli, python)
- Executes actions sequentially using the tool registry
- Tracks results and errors
- Updates execution status
"""

import logging
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
import asyncio

from simpleeval import SimpleEval, DEFAULT_OPERATORS, DEFAULT_FUNCTIONS

from src.config.database import get_db


def _camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


def _normalize_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize parameter names from camelCase to snake_case.

    This allows workflow actions to use either camelCase or snake_case
    parameter names, as AI may generate either format.
    """
    normalized = {}
    for key, value in params.items():
        snake_key = _camel_to_snake(key)
        # Prefer snake_case version if both exist
        if snake_key not in normalized:
            normalized[snake_key] = value
        # Also keep original key for tools that expect camelCase
        if key != snake_key:
            normalized[key] = value
    return normalized


from src.models.workflow import (
    Workflow, WorkflowExecution, ExecutionStatus, WorkflowMode
)
from src.services.workflow_service import get_workflow_service
from src.services.tool_registry import get_tool_registry

logger = logging.getLogger(__name__)


class _DotDict(dict):
    """Dict subclass that supports attribute-style access (e.g. data.count).

    Used to let simpleeval resolve dotted names like ``data.status``
    without resorting to ``eval()``.  Dict keys take priority over
    inherited dict methods so that e.g. ``d.items`` returns ``d["items"]``
    when that key exists, rather than the ``dict.items`` method.
    """

    def __getattribute__(self, name: str):
        # Dunder attributes and dict internals go through normal resolution
        if name.startswith("_"):
            return super().__getattribute__(name)
        # Dict keys take priority
        if name in self:
            value = self[name]
            if isinstance(value, dict) and not isinstance(value, _DotDict):
                return _DotDict(value)
            return value
        return None  # mimic JS undefined → None


class WorkflowExecutor:
    """Executes approved workflow actions."""

    def __init__(self):
        self._credential_pool = None
        self._lock = asyncio.Lock()

    async def get_credential_pool(self):
        """Get credential pool for tool execution."""
        if self._credential_pool is None:
            try:
                from src.services.credential_pool import get_initialized_pool
                self._credential_pool = await get_initialized_pool()
            except Exception as e:
                logger.warning(f"Failed to initialize credential pool: {e}")
        return self._credential_pool

    async def execute(self, execution_id: int) -> bool:
        """Execute an approved workflow execution.

        Routes execution based on workflow mode:
        - cards: Execute actions from flow_data using tool registry
        - cli: Parse and execute CLI code
        - python: Execute Python code in sandbox

        Args:
            execution_id: ID of the execution to run

        Returns:
            True if execution succeeded
        """
        db = get_db()
        async with db.session() as session:
            service = get_workflow_service(session)
            execution = await service.get_execution(execution_id)

            if not execution:
                logger.error(f"Execution {execution_id} not found")
                return False

            if execution.status not in (ExecutionStatus.APPROVED, ExecutionStatus.EXECUTING):
                logger.warning(f"Execution {execution_id} is not approved (status={execution.status})")
                return False

            # Get the workflow to determine mode
            workflow = await service.get_workflow(execution.workflow_id)
            if not workflow:
                logger.error(f"Workflow {execution.workflow_id} not found for execution {execution_id}")
                return False

            try:
                # Mark as executing
                execution = await service.mark_execution_executing(execution_id)

                # Route based on workflow mode
                # Note: The column is named 'workflow_mode' to avoid PostgreSQL reserved word conflict
                mode = workflow.workflow_mode if isinstance(workflow.workflow_mode, WorkflowMode) else WorkflowMode(workflow.workflow_mode or 'cards')

                if mode == WorkflowMode.CLI:
                    return await self._execute_cli_workflow(workflow, execution, service)
                elif mode == WorkflowMode.PYTHON:
                    return await self._execute_python_workflow(workflow, execution, service)
                else:
                    # Default: Cards mode - use action registry
                    return await self._execute_cards_workflow(workflow, execution, service)

            except Exception as e:
                logger.error(f"Execution {execution_id} failed: {e}", exc_info=True)
                await service.complete_execution(
                    execution_id=execution_id,
                    error=str(e)
                )
                return False

    async def _execute_cards_workflow(
        self,
        workflow: Workflow,
        execution: WorkflowExecution,
        service
    ) -> bool:
        """Execute a cards-mode workflow using flow graph traversal.

        This method properly traverses the canvas flow graph, following edges
        and handling condition node branching (yes/no paths).
        """
        # Check if we have flow_data with nodes/edges (canvas graph)
        flow_data = workflow.flow_data
        if flow_data and flow_data.get("nodes") and flow_data.get("edges"):
            # Use flow graph execution with proper condition handling
            results = await self._execute_flow_graph(flow_data, execution, workflow_name=workflow.name)
        else:
            # Fallback: Get actions to execute from execution record
            actions = execution.executed_actions or execution.recommended_actions or []

            if not actions:
                logger.warning(f"Execution {execution.id} has no actions")
                await service.complete_execution(
                    execution_id=execution.id,
                    result={"message": "No actions to execute", "mode": "cards"}
                )
                return True

            # Execute actions sequentially
            results = await self._execute_actions(actions, execution)

        # Check for failures
        failures = [r for r in results if not r.get("success", False)]

        if failures:
            # Build detailed error message including actual errors
            error_details = []
            for f in failures:
                action = f.get("action") or "unknown"
                err = f.get("error") or "Unknown error"
                error_details.append(f"{action}: {err}")
            error_msg = f"{len(failures)} of {len(results)} actions failed: " + "; ".join(error_details[:3])
            if len(error_details) > 3:
                error_msg += f" (and {len(error_details) - 3} more)"

            await service.complete_execution(
                execution_id=execution.id,
                result={"actions": results, "mode": "cards"},
                error=error_msg
            )
            return False
        else:
            await service.complete_execution(
                execution_id=execution.id,
                result={"actions": results, "mode": "cards"}
            )
            return True

    async def _execute_flow_graph(
        self,
        flow_data: Dict[str, Any],
        execution: WorkflowExecution,
        workflow_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Execute a canvas flow graph with proper traversal and condition handling.

        This method:
        - Builds a graph from nodes and edges
        - Starts at trigger node(s)
        - Traverses following edges
        - Evaluates condition nodes and follows yes/no paths
        - Executes action nodes
        - Handles loops, delays, and other node types

        Args:
            flow_data: Canvas flow data with nodes and edges
            execution: The execution record for context
            workflow_name: Optional workflow name for context

        Returns:
            List of action results
        """
        nodes = {n["id"]: n for n in flow_data.get("nodes", [])}
        edges = flow_data.get("edges", [])

        # Build adjacency list: node_id -> [(target_id, source_handle), ...]
        adjacency: Dict[str, List[tuple]] = {}
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            source_handle = edge.get("sourceHandle")  # 'true', 'false', 'loop', 'done', etc.

            if source not in adjacency:
                adjacency[source] = []
            adjacency[source].append((target, source_handle))

        # Find trigger node(s) - entry points
        trigger_nodes = [n for n in nodes.values() if n.get("type") == "trigger"]
        if not trigger_nodes:
            logger.warning("No trigger nodes found in flow_data")
            return []

        results = []
        visited = set()
        execution_context = {
            "trigger_data": execution.trigger_data or {},
            "variables": {},
            "step_results": {},
            "workflow_name": workflow_name,
            "execution_id": execution.id,
        }

        # Execute from each trigger (usually just one)
        for trigger in trigger_nodes:
            await self._traverse_node(
                node_id=trigger["id"],
                nodes=nodes,
                adjacency=adjacency,
                execution=execution,
                context=execution_context,
                results=results,
                visited=visited,
            )

        return results

    async def _traverse_node(
        self,
        node_id: str,
        nodes: Dict[str, Dict],
        adjacency: Dict[str, List[tuple]],
        execution: WorkflowExecution,
        context: Dict[str, Any],
        results: List[Dict[str, Any]],
        visited: set,
        max_iterations: int = 100,
    ) -> None:
        """Recursively traverse and execute nodes in the flow graph.

        Args:
            node_id: Current node ID
            nodes: All nodes by ID
            adjacency: Edge adjacency list
            execution: Execution record
            context: Execution context with variables
            results: Results list to append to
            visited: Set of visited nodes (cycle detection)
            max_iterations: Safety limit for loops
        """
        if node_id in visited and nodes.get(node_id, {}).get("type") != "loop":
            logger.debug(f"Skipping already visited node: {node_id}")
            return

        if len(visited) > max_iterations:
            logger.warning(f"Max iterations reached, stopping traversal")
            return

        visited.add(node_id)

        node = nodes.get(node_id)
        if not node:
            logger.warning(f"Node {node_id} not found")
            return

        node_type = node.get("type")
        node_data = node.get("data", {})

        logger.debug(f"Executing node {node_id} (type={node_type})")

        # Handle different node types
        if node_type == "trigger":
            # Trigger node - just proceed to next nodes
            next_handle = None

        elif node_type == "condition":
            # Condition node - evaluate and choose branch
            condition_result = await self._evaluate_condition_node(node_data, context)
            next_handle = "true" if condition_result else "false"
            logger.info(f"Condition node {node_id}: result={condition_result}, following '{next_handle}' path")

        elif node_type == "action":
            # Action node - execute the action
            action_result = await self._execute_action_node(node_data, execution, context)
            results.append(action_result)
            context["step_results"][node_id] = action_result
            next_handle = None

        elif node_type == "ai":
            # AI node - run AI analysis
            ai_result = await self._execute_ai_node(node_data, context)
            context["step_results"][node_id] = ai_result
            # AI can branch on decision from:
            # 1. outputFormat == "decision" - yes/no responses
            # 2. confidenceThreshold > 0 - confidence-based decisions (e.g., 70% threshold)
            if node_data.get("outputFormat") == "decision" or node_data.get("confidenceThreshold", 0) > 0:
                decision = ai_result.get("decision", False)
                next_handle = "true" if decision else "false"
                logger.info(f"AI node {node_id}: decision={decision}, confidence_threshold={node_data.get('confidenceThreshold', 0)}, following '{next_handle}' path")
            else:
                next_handle = None

        elif node_type == "notify":
            # Notification node - send notification
            notify_result = await self._execute_notify_node(node_data, context)
            results.append(notify_result)
            context["step_results"][node_id] = notify_result
            next_handle = None

        elif node_type == "delay":
            # Delay node - wait for specified duration
            await self._execute_delay_node(node_data)
            next_handle = None

        elif node_type == "loop":
            # Loop node - iterate over items
            await self._execute_loop_node(
                node_id, node_data, nodes, adjacency, execution, context, results, visited
            )
            next_handle = "done"  # After loop completes, follow 'done' path

        elif node_type == "approval":
            # Approval node - check approval status
            # For now, if we're executing, approval was granted
            next_handle = "approved"

        elif node_type == "subworkflow":
            # Sub-workflow node - execute another workflow
            subworkflow_result = await self._execute_subworkflow_node(node_data, context)
            context["step_results"][node_id] = subworkflow_result
            next_handle = None

        elif node_type == "comment":
            # Comment node - skip (documentation only)
            next_handle = None

        else:
            logger.warning(f"Unknown node type: {node_type}")
            next_handle = None

        # Traverse to next nodes
        next_nodes = adjacency.get(node_id, [])
        for target_id, source_handle in next_nodes:
            # If we have a specific handle to follow, only follow matching edges
            if next_handle is not None:
                if source_handle == next_handle:
                    await self._traverse_node(
                        target_id, nodes, adjacency, execution, context, results, visited
                    )
            else:
                # No specific handle, follow all edges (default path)
                if source_handle is None or source_handle == "":
                    await self._traverse_node(
                        target_id, nodes, adjacency, execution, context, results, visited
                    )

    async def _evaluate_condition_node(
        self,
        node_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> bool:
        """Evaluate a condition node and return True (yes) or False (no).

        Supports two modes:
        - 'simple': GUI-built conditions with field/operator/value
        - 'expression': JavaScript-like expression evaluation

        Args:
            node_data: Condition node configuration
            context: Execution context with variables

        Returns:
            True if condition is met (follow 'yes' path), False otherwise
        """
        condition_type = node_data.get("conditionType", "simple")

        if condition_type == "expression":
            # Advanced mode: evaluate expression
            expression = node_data.get("expression", "")
            return self._evaluate_expression(expression, context)

        # Simple mode: evaluate field/operator/value conditions
        conditions = node_data.get("conditions", [])
        match_type = node_data.get("matchType", "all")  # 'all' (AND) or 'any' (OR)

        if not conditions:
            return True  # No conditions = always true

        results = []
        for condition in conditions:
            field = condition.get("field", "")
            op = condition.get("operator", "equals")
            value = condition.get("value", "")

            # Resolve field value from context
            actual_value = self._resolve_field(field, context)

            # Compare using operator
            result = self._compare_values(actual_value, op, value)
            results.append(result)

        if match_type == "any":
            return any(results)
        else:  # 'all'
            return all(results)

    def _resolve_field(self, field: str, context: Dict[str, Any]) -> Any:
        """Resolve a field path like 'data.value' or 'trigger.count' from context."""
        if not field:
            return None

        # Handle common prefixes
        parts = field.split(".")

        if parts[0] == "trigger" or parts[0] == "trigger_data":
            data = context.get("trigger_data", {})
            parts = parts[1:]
        elif parts[0] == "variables":
            data = context.get("variables", {})
            parts = parts[1:]
        elif parts[0] == "step":
            # Reference previous step: step.node_id.result
            data = context.get("step_results", {})
            parts = parts[1:]
        else:
            # Default: look in trigger_data first, then variables
            data = {**context.get("trigger_data", {}), **context.get("variables", {})}

        # Traverse the path
        for part in parts:
            if isinstance(data, dict):
                data = data.get(part)
            elif isinstance(data, list) and part.isdigit():
                idx = int(part)
                data = data[idx] if idx < len(data) else None
            else:
                return None

        return data

    def _compare_values(self, actual: Any, operator: str, expected: Any) -> bool:
        """Compare values using the specified operator."""
        # Type coercion for numeric comparisons
        try:
            if operator in (">", "<", ">=", "<=", "greater", "less", "greater_than", "less_than"):
                actual = float(actual) if actual is not None else 0
                expected = float(expected) if expected else 0
        except (ValueError, TypeError):
            pass

        op_map = {
            "equals": lambda a, e: str(a).lower() == str(e).lower() if a is not None else e == "",
            "not_equals": lambda a, e: str(a).lower() != str(e).lower() if a is not None else e != "",
            ">": lambda a, e: a > e,
            "greater": lambda a, e: a > e,
            "greater_than": lambda a, e: a > e,
            "<": lambda a, e: a < e,
            "less": lambda a, e: a < e,
            "less_than": lambda a, e: a < e,
            ">=": lambda a, e: a >= e,
            "<=": lambda a, e: a <= e,
            "contains": lambda a, e: str(e).lower() in str(a).lower() if a else False,
            "not_contains": lambda a, e: str(e).lower() not in str(a).lower() if a else True,
            "starts_with": lambda a, e: str(a).lower().startswith(str(e).lower()) if a else False,
            "ends_with": lambda a, e: str(a).lower().endswith(str(e).lower()) if a else False,
            "is_empty": lambda a, e: not a or a == "" or a == [],
            "is_not_empty": lambda a, e: bool(a) and a != "" and a != [],
        }

        compare_func = op_map.get(operator, op_map["equals"])
        try:
            return compare_func(actual, expected)
        except Exception as e:
            logger.warning(f"Comparison failed: {e}")
            return False

    def _evaluate_expression(self, expression: str, context: Dict[str, Any]) -> bool:
        """Evaluate a JavaScript-like expression for advanced conditions.

        Uses simpleeval (AST-based) for safe expression evaluation — no access
        to builtins, imports, or arbitrary Python execution.

        Supports basic expressions like:
        - data.count > 100 && data.status === 'active'
        - trigger.severity === 'critical' || trigger.priority > 8

        Args:
            expression: The expression string
            context: Execution context

        Returns:
            Boolean result of expression evaluation
        """
        if not expression.strip():
            return True

        # Build a safe evaluation context using _DotDict for attribute-style access
        eval_context = {
            "data": _DotDict({**context.get("trigger_data", {}), **context.get("variables", {})}),
            "trigger": _DotDict(context.get("trigger_data", {})),
            "variables": _DotDict(context.get("variables", {})),
            "step": _DotDict(context.get("step_results", {})),
        }

        # Convert JavaScript operators to Python
        py_expr = expression
        py_expr = py_expr.replace("===", "==")
        py_expr = py_expr.replace("!==", "!=")
        py_expr = py_expr.replace("&&", " and ")
        py_expr = py_expr.replace("||", " or ")
        # Replace logical NOT (!) but not != operator
        py_expr = re.sub(r'!(?!=)', ' not ', py_expr)
        # Convert .length to len() for JS compat
        py_expr = re.sub(r'(\w+(?:\.\w+)*)\.length', r'len(\1)', py_expr)

        try:
            evaluator = SimpleEval()
            evaluator.operators = DEFAULT_OPERATORS
            evaluator.functions = {"len": len, "str": str, "int": int, "float": float, "bool": bool}
            evaluator.names = eval_context
            result = evaluator.eval(py_expr)
            return bool(result)
        except Exception as e:
            logger.warning(f"Expression evaluation failed: {e}, expression: {expression}")
            return False

    async def _execute_action_node(
        self,
        node_data: Dict[str, Any],
        execution: WorkflowExecution,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute an action node."""
        action_id = node_data.get("actionId") or node_data.get("tool")
        # Check both 'params' (PropertiesPanel) and 'parameters' (templates) for compatibility
        params = node_data.get("params") or node_data.get("parameters") or {}

        logger.info(f"Executing action node: {action_id}")
        logger.debug(f"  node_data keys: {list(node_data.keys())}")
        logger.debug(f"  raw params: {params}")

        # Substitute variables in params
        params = self._substitute_variables(params, context)
        logger.debug(f"  params after substitution: {params}")

        return await self._execute_single_action(
            {"tool": action_id, "params": params},
            execution,
            flow_context=context  # Pass the flow context for AI analysis, trigger data, etc.
        )

    async def _execute_single_action(
        self,
        action: Dict[str, Any],
        execution: WorkflowExecution,
        flow_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute a single action using the tool registry.

        Args:
            action: Action definition with tool and params
            execution: WorkflowExecution record
            flow_context: Optional flow context with trigger_data, step_results, variables
        """
        action_name = action.get("tool") or action.get("action")
        params = _normalize_params(action.get("params", {}))

        registry = get_tool_registry()
        credential_pool = await self.get_credential_pool()

        tool = registry.get(action_name)
        if not tool:
            return {
                "action": action_name,
                "success": False,
                "error": f"Tool not found: {action_name}"
            }

        try:
            context = await self._build_execution_context(
                tool=tool,
                params=params,
                credential_pool=credential_pool,
                execution=execution
            )

            # Enrich context with flow data (AI analysis, trigger data, step results)
            # This allows action handlers to access upstream data
            if flow_context:
                if isinstance(context, dict):
                    context["flow_context"] = flow_context
                else:
                    # Platform context (e.g., SplunkExecutionContext) - add flow_context as attribute
                    context.flow_context = flow_context

                # Extract AI analysis from step_results for convenience
                step_results = flow_context.get("step_results", {})
                ai_analysis = None
                for step_id, result in step_results.items():
                    if isinstance(result, dict) and "response" in result:
                        ai_analysis = result.get("response")
                        break

                if ai_analysis:
                    if isinstance(context, dict):
                        context["ai_analysis"] = ai_analysis
                    else:
                        context.ai_analysis = ai_analysis

            start_time = datetime.utcnow()
            result = await tool.handler(params, context)
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            # Build action result, preserving important fields from handler
            action_result = {
                "action": action_name,
                "success": result.get("success", True),
                "data": result.get("data"),
                "error": result.get("error"),
                "duration_ms": duration_ms,
            }
            # Preserve incident_id if returned by handler (e.g., from monitor_device_status)
            if result.get("incident_id"):
                action_result["incident_id"] = result["incident_id"]
            if result.get("incident_created"):
                action_result["incident_created"] = result["incident_created"]

            return action_result

        except Exception as e:
            logger.error(f"Action {action_name} failed: {e}")
            return {
                "action": action_name,
                "success": False,
                "error": str(e)
            }

    async def _execute_ai_node(
        self,
        node_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute an AI decision node.

        The AI node can analyze data and make decisions. When a confidenceThreshold
        is set, the node will extract confidence scores from the AI response and
        make a decision based on whether the issue confidence exceeds the threshold.
        """
        from src.services.multi_provider_ai import generate_text
        import json as json_module
        import re

        prompt = node_data.get("prompt", "")
        output_format = node_data.get("outputFormat", "text")
        include_context = node_data.get("includeContext", True)
        confidence_threshold = node_data.get("confidenceThreshold", 0)  # e.g., 70 for 70%

        # Build full prompt with context - include step results (e.g., Splunk query output)
        if include_context:
            # Collect all upstream data
            context_parts = []

            # Include trigger data
            trigger_data = context.get('trigger_data')
            if trigger_data:
                context_parts.append(f"Trigger Data: {trigger_data}")

            # Include variables
            variables = context.get('variables')
            if variables:
                context_parts.append(f"Variables: {variables}")

            # CRITICAL: Include step_results - this contains ACTION outputs like Splunk query results
            step_results = context.get('step_results', {})
            if step_results:
                for step_id, step_result in step_results.items():
                    if isinstance(step_result, dict):
                        # Check for action data (e.g., Splunk query results)
                        if step_result.get("data"):
                            data = step_result.get("data")
                            # Limit data size to avoid token overflow
                            if isinstance(data, list) and len(data) > 50:
                                data = data[:50]
                                context_parts.append(f"Previous Step [{step_id}] Data (first 50 of {len(step_result.get('data'))} results): {json_module.dumps(data, default=str)}")
                            else:
                                context_parts.append(f"Previous Step [{step_id}] Data: {json_module.dumps(data, default=str)}")
                        elif step_result.get("success") is not None:
                            context_parts.append(f"Previous Step [{step_id}] Result: {step_result}")

            context_str = "\n\nContext:\n" + "\n\n".join(context_parts) if context_parts else ""
            full_prompt = prompt + context_str
        else:
            full_prompt = prompt

        # Add format instructions
        if output_format == "decision":
            full_prompt += "\n\nRespond with only 'yes' or 'no'."
        elif output_format == "json":
            full_prompt += "\n\nRespond with valid JSON only."

        logger.info(f"[AI Node] Executing with prompt length: {len(full_prompt)}, confidence_threshold: {confidence_threshold}")
        logger.debug(f"[AI Node] Full prompt: {full_prompt[:500]}...")

        try:
            result = await generate_text(full_prompt, max_tokens=2000)
            if result and result.get("text"):
                response_text = result["text"].strip()
                response_lower = response_text.lower()

                if output_format == "decision":
                    decision = response_lower in ("yes", "true", "1", "affirmative")
                    return {"success": True, "decision": decision, "response": response_text}
                elif output_format == "json":
                    try:
                        parsed = json_module.loads(response_text)
                        return {"success": True, "data": parsed, "response": response_text}
                    except json_module.JSONDecodeError:
                        return {"success": True, "response": response_text}
                else:
                    # Text format - try to extract confidence scores for decision making
                    # This enables the condition node to properly evaluate AI analysis results

                    # Extract REAL_ISSUE confidence (e.g., "REAL_ISSUE: 85%" or "REAL_ISSUE (0-100%): Is this a genuine problem")
                    real_issue_confidence = 0
                    real_issue_match = re.search(r'REAL_ISSUE[:\s]*(\d+)%', response_text, re.IGNORECASE)
                    if real_issue_match:
                        real_issue_confidence = int(real_issue_match.group(1))

                    # Extract ACTIONABLE confidence
                    actionable_confidence = 0
                    actionable_match = re.search(r'ACTIONABLE[:\s]*(\d+)%', response_text, re.IGNORECASE)
                    if actionable_match:
                        actionable_confidence = int(actionable_match.group(1))

                    # Extract SEVERITY
                    severity = "low"
                    severity_match = re.search(r'SEVERITY[:\s]*(critical|high|medium|low)', response_text, re.IGNORECASE)
                    if severity_match:
                        severity = severity_match.group(1).lower()

                    # Make decision based on confidence threshold
                    # Issue is worth acting on if REAL_ISSUE confidence >= threshold
                    # Default threshold is 50% if not specified (more conservative than always True)
                    effective_threshold = confidence_threshold if confidence_threshold > 0 else 50
                    decision = real_issue_confidence >= effective_threshold

                    logger.info(f"[AI Node] Extracted: real_issue={real_issue_confidence}%, actionable={actionable_confidence}%, "
                               f"severity={severity}, threshold={effective_threshold}% (configured: {confidence_threshold}%), decision={decision}")

                    return {
                        "success": True,
                        "response": response_text,
                        "decision": decision,
                        "real_issue_confidence": real_issue_confidence,
                        "actionable_confidence": actionable_confidence,
                        "severity": severity,
                        "threshold": effective_threshold,
                        "configured_threshold": confidence_threshold,
                        "meets_threshold": decision,
                    }
            return {"success": False, "error": "No response from AI"}
        except Exception as e:
            logger.error(f"[AI Node] Failed: {e}")
            return {"success": False, "error": str(e)}

    async def _execute_notify_node(
        self,
        node_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a notification node."""
        channel = node_data.get("channel", "slack")
        recipients = node_data.get("recipients")
        message = node_data.get("message", "")

        # Substitute variables in message
        message = self._substitute_template(message, context)

        # Get the appropriate notification tool
        tool_map = {
            "slack": "slack_notify",
            "email": "email_notify",
            "teams": "teams_notify",
            "webex": "webex_notify",
            "pagerduty": "pagerduty_trigger",
            "webhook": "http_webhook",
            "incident_timeline": "add_incident_timeline",
        }

        # Smart channel detection: if channel looks like a Slack channel name (#channel),
        # treat it as Slack notification with that as the recipient
        if channel and channel.startswith("#"):
            recipients = channel  # Use channel name as recipient
            channel = "slack"
        # If channel contains @ (email), treat as email notification
        elif channel and "@" in channel and "." in channel:
            recipients = channel
            channel = "email"

        tool_name = tool_map.get(channel, "http_webhook")
        registry = get_tool_registry()
        tool = registry.get(tool_name)

        if not tool:
            return {"action": f"notify_{channel}", "success": False, "error": f"Notification tool not found: {tool_name}"}

        # Build params with proper snake_case conversion from frontend camelCase
        params = {
            "message": message,
            "channel": recipients,  # For Slack, this is the channel to post to
            "webhook_url": node_data.get("webhookUrl") or node_data.get("webhook_url"),
            "subject": node_data.get("subject"),
            "severity": node_data.get("severity"),
            # Additional params with camelCase to snake_case conversion
            "dedup_key": node_data.get("dedupKey") or node_data.get("dedup_key"),
            "room_id": node_data.get("roomId") or node_data.get("room_id"),
            "incident_id": node_data.get("incidentId") or node_data.get("incident_id"),
            "event_type": node_data.get("eventType") or node_data.get("event_type"),
            "affected_resource": node_data.get("affectedResource") or node_data.get("affected_resource"),
            "priority": node_data.get("priority"),
            "method": node_data.get("method"),
        }

        # Special handling for incident_timeline - map message to title, and try to get incident_id from context
        if channel == "incident_timeline":
            params["title"] = node_data.get("subject") or message[:100] if message else "Workflow notification"
            params["description"] = message

            # Check step_results for an incident_id from previous actions
            # This takes precedence over any hardcoded incident_id in the node config
            step_results = context.get("step_results", {})
            found_incident_id = None

            for step_id, result in step_results.items():
                if isinstance(result, dict):
                    # Check if this action created/updated an incident
                    if result.get("incident_id"):
                        found_incident_id = result["incident_id"]
                        logger.info(f"[notify_incident_timeline] Found incident_id={found_incident_id} from step {step_id}")
                        break
                    # Also check in data (some tools return it there)
                    elif isinstance(result.get("data"), dict) and result["data"].get("incident_id"):
                        found_incident_id = result["data"]["incident_id"]
                        logger.info(f"[notify_incident_timeline] Found incident_id={found_incident_id} in data from step {step_id}")
                        break

            # Use found incident_id from previous action (overrides any hardcoded value)
            if found_incident_id:
                params["incident_id"] = found_incident_id
                logger.info(f"[notify_incident_timeline] Using incident_id={found_incident_id} from workflow context")
            elif params.get("incident_id"):
                # Using hardcoded incident_id from node config - log warning
                logger.warning(f"[notify_incident_timeline] No incident from workflow, using configured incident_id={params.get('incident_id')}")
            else:
                # No incident found anywhere - skip this notification gracefully
                logger.info("[notify_incident_timeline] No incident_id found. Skipping timeline entry (no incident was created).")
                return {
                    "action": "notify_incident_timeline",
                    "success": True,
                    "skipped": True,
                    "message": "No incident was created by previous actions, skipping timeline entry"
                }

            # Remove message/channel since incident_timeline doesn't use them
            params.pop("message", None)
            params.pop("channel", None)

        # Remove None values to avoid passing empty params
        params = {k: v for k, v in params.items() if v is not None}

        try:
            result = await tool.handler(params, {})
            # Include action key for proper error reporting, and forward any error from the tool
            return {
                "action": f"notify_{channel}",
                "success": result.get("success", True),
                "channel": channel,
                "error": result.get("error"),  # Forward error from notification tool
            }
        except Exception as e:
            return {"action": f"notify_{channel}", "success": False, "error": str(e), "channel": channel}

    async def _execute_delay_node(self, node_data: Dict[str, Any]) -> None:
        """Execute a delay node - wait for specified duration."""
        delay_type = node_data.get("delayType", "fixed")

        if delay_type == "fixed":
            duration = node_data.get("duration", 0)
            unit = node_data.get("durationUnit", "seconds")

            # Convert to seconds
            multipliers = {"seconds": 1, "minutes": 60, "hours": 3600, "days": 86400}
            seconds = duration * multipliers.get(unit, 1)

            # Cap at 5 minutes for safety
            seconds = min(seconds, 300)

            if seconds > 0:
                logger.info(f"Delay node: waiting {seconds} seconds")
                await asyncio.sleep(seconds)

    async def _execute_loop_node(
        self,
        node_id: str,
        node_data: Dict[str, Any],
        nodes: Dict[str, Dict],
        adjacency: Dict[str, List[tuple]],
        execution: WorkflowExecution,
        context: Dict[str, Any],
        results: List[Dict[str, Any]],
        visited: set,
    ) -> None:
        """Execute a loop node - iterate over items and execute body."""
        loop_type = node_data.get("loopType", "foreach")
        max_iterations = node_data.get("maxIterations", 100)

        # Get items to iterate
        if loop_type == "foreach":
            source_data = node_data.get("sourceData", "")
            items = self._resolve_field(source_data, context)
            if not isinstance(items, (list, tuple)):
                items = [items] if items else []
        elif loop_type == "count":
            count = node_data.get("iterationCount", 0)
            items = range(min(count, max_iterations))
        else:  # 'while'
            items = range(max_iterations)

        # Find 'loop' body nodes (edges with sourceHandle='loop')
        loop_targets = [
            target for target, handle in adjacency.get(node_id, [])
            if handle == "loop"
        ]

        iteration_count = 0
        for item in items:
            if iteration_count >= max_iterations:
                logger.warning(f"Loop {node_id}: max iterations reached")
                break

            # For 'while' loops, check condition
            if loop_type == "while":
                condition = node_data.get("whileCondition", "")
                context["variables"]["item"] = item
                context["variables"]["index"] = iteration_count
                if not self._evaluate_expression(condition, context):
                    break

            # Set loop variables
            context["variables"]["item"] = item
            context["variables"]["index"] = iteration_count

            # Execute loop body
            loop_visited = set()  # Fresh visited set for each iteration
            for target_id in loop_targets:
                await self._traverse_node(
                    target_id, nodes, adjacency, execution, context, results, loop_visited
                )

            iteration_count += 1

    async def _execute_subworkflow_node(
        self,
        node_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a sub-workflow node."""
        workflow_id = node_data.get("workflowId")
        wait_for_completion = node_data.get("waitForCompletion", True)
        pass_context = node_data.get("passContext", True)

        if not workflow_id:
            return {"success": False, "error": "No workflow ID specified"}

        try:
            # Trigger the sub-workflow
            # This would create a new execution for the sub-workflow
            logger.info(f"Triggering sub-workflow {workflow_id}")
            return {"success": True, "workflow_id": workflow_id, "status": "triggered"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _substitute_variables(
        self,
        params: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Substitute {{variable}} placeholders in params."""
        result = {}
        for key, value in params.items():
            if isinstance(value, str):
                result[key] = self._substitute_template(value, context)
            elif isinstance(value, dict):
                result[key] = self._substitute_variables(value, context)
            else:
                result[key] = value
        return result

    def _substitute_template(self, template: str, context: Dict[str, Any]) -> str:
        """Substitute {{variable}} placeholders in a template string."""
        import re

        def replace_match(match):
            path = match.group(1).strip()
            value = self._resolve_field(path, context)
            return str(value) if value is not None else ""

        return re.sub(r"\{\{([^}]+)\}\}", replace_match, template)

    async def _execute_cli_workflow(
        self,
        workflow: Workflow,
        execution: WorkflowExecution,
        service
    ) -> bool:
        """Execute a CLI-mode workflow."""
        from src.services.cli_workflow_executor import get_cli_workflow_executor

        cli_code = workflow.cli_code
        if not cli_code:
            await service.complete_execution(
                execution_id=execution.id,
                result={"message": "No CLI code to execute", "mode": "cli"}
            )
            return True

        logger.info(f"Executing CLI workflow {workflow.id}")

        executor = get_cli_workflow_executor()
        result = await executor.execute(
            cli_code=cli_code,
            context={
                'variables': {},
                'trigger_data': execution.trigger_data or {},
                'workflow_id': str(workflow.id),
            }
        )

        if result.get('success'):
            await service.complete_execution(
                execution_id=execution.id,
                result={
                    "mode": "cli",
                    "results": result.get('results', []),
                    "variables": result.get('variables', {}),
                    "duration_ms": result.get('duration_ms', 0),
                }
            )
            return True
        else:
            await service.complete_execution(
                execution_id=execution.id,
                result={
                    "mode": "cli",
                    "results": result.get('results', []),
                    "duration_ms": result.get('duration_ms', 0),
                },
                error=result.get('error', 'CLI execution failed')
            )
            return False

    async def _execute_python_workflow(
        self,
        workflow: Workflow,
        execution: WorkflowExecution,
        service
    ) -> bool:
        """Execute a Python-mode workflow."""
        from src.services.python_workflow_executor import get_python_workflow_executor

        python_code = workflow.python_code
        if not python_code:
            await service.complete_execution(
                execution_id=execution.id,
                result={"message": "No Python code to execute", "mode": "python"}
            )
            return True

        logger.info(f"Executing Python workflow {workflow.id}")

        executor = get_python_workflow_executor()
        result = await executor.execute(
            python_code=python_code,
            context={
                'variables': {},
                'trigger_data': execution.trigger_data or {},
                'workflow_id': str(workflow.id),
            },
            timeout=60  # 60 second timeout for Python workflows
        )

        if result.success:
            await service.complete_execution(
                execution_id=execution.id,
                result={
                    "mode": "python",
                    "return_value": result.return_value,
                    "logs": result.logs,
                    "tool_calls": result.tool_calls,
                    "duration_ms": result.duration_ms,
                }
            )
            return True
        else:
            await service.complete_execution(
                execution_id=execution.id,
                result={
                    "mode": "python",
                    "logs": result.logs,
                    "tool_calls": result.tool_calls,
                    "duration_ms": result.duration_ms,
                },
                error=result.error or 'Python execution failed'
            )
            return False

    async def _execute_actions(
        self,
        actions: List[Dict[str, Any]],
        execution: WorkflowExecution
    ) -> List[Dict[str, Any]]:
        """Execute a list of actions sequentially.

        Args:
            actions: List of action definitions
            execution: The execution record for context

        Returns:
            List of action results
        """
        results = []
        registry = get_tool_registry()
        credential_pool = await self.get_credential_pool()

        for i, action in enumerate(actions):
            action_name = action.get("tool") or action.get("action")
            params = action.get("params", {})
            # Normalize parameter names (camelCase to snake_case)
            params = _normalize_params(params)

            logger.info(f"Executing action {i+1}/{len(actions)}: {action_name} with params: {params}")

            try:
                # Get the tool
                tool = registry.get(action_name)
                logger.info(f"Tool lookup for '{action_name}': {'found' if tool else 'NOT FOUND'}, tool={tool.name if tool else None}, platform={tool.platform if tool else None}")
                if not tool:
                    results.append({
                        "action": action_name,
                        "success": False,
                        "error": f"Tool not found: {action_name}"
                    })
                    continue

                # Build execution context
                context = await self._build_execution_context(
                    tool=tool,
                    params=params,
                    credential_pool=credential_pool,
                    execution=execution
                )
                logger.info(f"Built context for {action_name}: type={type(context).__name__}, has_client={hasattr(context, 'client')}")

                # Execute the tool
                logger.info(f"Executing tool handler: {tool.name}")
                start_time = datetime.utcnow()
                result = await tool.handler(params, context)
                duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
                logger.info(f"Tool result: success={result.get('success')}, error={result.get('error')}")

                results.append({
                    "action": action_name,
                    "success": result.get("success", True),
                    "data": result.get("data"),
                    "error": result.get("error"),
                    "duration_ms": duration_ms,
                })

                if not result.get("success", True):
                    logger.warning(f"Action {action_name} failed: {result.get('error')}")

            except Exception as e:
                logger.error(f"Action {action_name} raised exception: {e}", exc_info=True)
                results.append({
                    "action": action_name,
                    "success": False,
                    "error": str(e)
                })

        return results

    async def _build_execution_context(
        self,
        tool,
        params: Dict[str, Any],
        credential_pool,
        execution: WorkflowExecution
    ):
        """Build execution context for a tool.

        Args:
            tool: The tool to execute
            params: Tool parameters
            credential_pool: Credential pool for auth
            execution: The execution record

        Returns:
            Execution context appropriate for the tool's platform
        """
        platform = tool.platform

        # Get credentials for the platform
        if credential_pool:
            try:
                # Extract context from params and workflow
                organization_id = params.get("organization_id") or params.get("org_id")
                network_id = params.get("network_id") or params.get("networkId")
                base_url = params.get("base_url")

                cred = credential_pool.get_for_platform(
                    platform=platform,
                    organization_id=organization_id,  # Use correct parameter name
                    network_id=network_id,
                    base_url=base_url,
                )

                if cred:
                    return await self._create_platform_context(platform, cred, params)
                else:
                    logger.warning(f"No credentials found for platform '{platform}'")

            except Exception as e:
                logger.warning(f"Failed to get credentials for {platform}: {e}")

        # Return minimal context if no credentials
        return {"platform": platform, "params": params}

    async def _create_platform_context(
        self,
        platform: str,
        credential,
        params: Dict[str, Any]
    ):
        """Create platform-specific execution context.

        Args:
            platform: Platform name
            credential: PlatformCredential instance with credentials dict
            params: Tool parameters

        Returns:
            Platform execution context
        """
        # PlatformCredential stores API keys/passwords in credentials dict
        creds = credential.credentials if hasattr(credential, 'credentials') else {}

        if platform == "meraki":
            from src.services.tools.meraki import MerakiExecutionContext
            # Get org_id from params, or fallback to first org from credential discovery
            org_id = params.get("organization_id") or params.get("org_id")
            if not org_id and hasattr(credential, 'org_ids') and credential.org_ids:
                org_id = credential.org_ids[0]
                logger.info(f"Using discovered org_id {org_id} from credential {credential.cluster_name}")
            return MerakiExecutionContext(
                api_key=creds.get("api_key"),
                org_id=org_id,
                network_id=params.get("network_id"),
            )

        elif platform == "catalyst":
            from src.services.tools.catalyst import CatalystExecutionContext
            return CatalystExecutionContext(
                username=creds.get("username"),
                password=creds.get("password"),
                base_url=credential.base_url,
                api_token=creds.get("api_token"),
            )

        elif platform == "thousandeyes":
            from src.services.tools.thousandeyes import ThousandEyesExecutionContext
            return ThousandEyesExecutionContext(
                oauth_token=creds.get("oauth_token"),
            )

        elif platform == "splunk":
            from src.services.tools.splunk import SplunkExecutionContext
            from src.config.settings import get_settings
            settings = get_settings()
            # Prefer per-credential verify_ssl (from UI), fall back to global settings
            verify_ssl = creds.get("verify_ssl", settings.splunk_verify_ssl)
            return SplunkExecutionContext(
                base_url=credential.base_url,
                username=creds.get("username"),
                password=creds.get("password"),
                token=creds.get("token"),
                verify_ssl=verify_ssl,
            )

        else:
            # Generic context
            return {"platform": platform, "credential": credential, "params": params}

    async def execute_single_action(
        self,
        action: Dict[str, Any],
        context: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Execute a single action (for testing or manual execution).

        Args:
            action: Action definition
            context: Optional execution context

        Returns:
            Action result
        """
        action_name = action.get("tool") or action.get("action")
        params = action.get("params", {})

        registry = get_tool_registry()
        tool = registry.get(action_name)

        if not tool:
            return {
                "action": action_name,
                "success": False,
                "error": f"Tool not found: {action_name}"
            }

        try:
            # Use provided context or build one
            if not context:
                credential_pool = await self.get_credential_pool()
                context = await self._build_execution_context(
                    tool=tool,
                    params=params,
                    credential_pool=credential_pool,
                    execution=None
                )

            start_time = datetime.utcnow()
            result = await tool.handler(params, context)
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            return {
                "action": action_name,
                "success": result.get("success", True),
                "data": result.get("data"),
                "error": result.get("error"),
                "duration_ms": duration_ms,
            }

        except Exception as e:
            logger.error(f"Single action execution failed: {e}")
            return {
                "action": action_name,
                "success": False,
                "error": str(e)
            }


# ============================================================================
# Global Executor Instance
# ============================================================================

_executor: Optional[WorkflowExecutor] = None


def get_workflow_executor() -> WorkflowExecutor:
    """Get the global workflow executor instance."""
    global _executor
    if _executor is None:
        _executor = WorkflowExecutor()
    return _executor
