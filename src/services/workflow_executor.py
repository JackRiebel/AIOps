"""Workflow Executor - Executes approved workflow actions.

This executor:
- Takes approved execution records
- Routes execution by workflow mode (cards, cli, python)
- Executes actions sequentially using the tool registry
- Tracks results and errors
- Updates execution status
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import asyncio

from src.config.database import get_db
from src.models.workflow import (
    Workflow, WorkflowExecution, ExecutionStatus, WorkflowMode
)
from src.services.workflow_service import get_workflow_service
from src.services.tool_registry import get_tool_registry

logger = logging.getLogger(__name__)


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
                mode = workflow.mode if isinstance(workflow.mode, WorkflowMode) else WorkflowMode(workflow.mode or 'cards')

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
        """Execute a cards-mode workflow using action registry."""
        # Get actions to execute
        actions = execution.executed_actions or execution.recommended_actions or []

        if not actions:
            logger.warning(f"Execution {execution.id} has no actions")
            await service.complete_execution(
                execution_id=execution.id,
                result={"message": "No actions to execute", "mode": "cards"}
            )
            return True

        # Execute actions
        results = await self._execute_actions(actions, execution)

        # Check for failures
        failures = [r for r in results if not r.get("success", False)]

        if failures:
            await service.complete_execution(
                execution_id=execution.id,
                result={"actions": results, "mode": "cards"},
                error=f"{len(failures)} of {len(results)} actions failed"
            )
            return False
        else:
            await service.complete_execution(
                execution_id=execution.id,
                result={"actions": results, "mode": "cards"}
            )
            return True

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

            logger.info(f"Executing action {i+1}/{len(actions)}: {action_name}")

            try:
                # Get the tool
                tool = registry.get(action_name)
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

                # Execute the tool
                start_time = datetime.utcnow()
                result = await tool.handler(params, context)
                duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

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
                logger.error(f"Action {action_name} raised exception: {e}")
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
                org_id = params.get("organization_id") or params.get("org_id")
                network_id = params.get("network_id")
                base_url = params.get("base_url")

                cred = credential_pool.get_for_platform(
                    platform=platform,
                    org_id=org_id,
                    network_id=network_id,
                    base_url=base_url,
                )

                if cred:
                    return await self._create_platform_context(platform, cred, params)

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
            credential: Platform credential
            params: Tool parameters

        Returns:
            Platform execution context
        """
        if platform == "meraki":
            from src.services.tools.meraki import MerakiExecutionContext
            return MerakiExecutionContext(
                api_key=credential.api_key,
                org_id=params.get("organization_id"),
                network_id=params.get("network_id"),
            )

        elif platform == "catalyst":
            from src.services.tools.catalyst import CatalystExecutionContext
            return CatalystExecutionContext(
                username=credential.username,
                password=credential.password,
                base_url=credential.base_url,
                api_token=credential.api_token,
            )

        elif platform == "thousandeyes":
            from src.services.tools.thousandeyes import ThousandEyesExecutionContext
            return ThousandEyesExecutionContext(
                oauth_token=credential.oauth_token,
            )

        elif platform == "splunk":
            from src.services.tools.splunk import SplunkExecutionContext
            return SplunkExecutionContext(
                base_url=credential.base_url,
                username=credential.username,
                password=credential.password,
                token=credential.token,
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
