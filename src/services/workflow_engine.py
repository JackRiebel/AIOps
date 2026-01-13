"""Workflow Engine - Evaluates workflow conditions and triggers AI analysis.

This engine:
- Executes Splunk queries for splunk_query triggers
- Evaluates conditions against query results
- Calls the AI service for analysis when conditions are met
- Creates execution records for user approval
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import asyncio
import re
import operator

from src.config.database import get_db
from src.config.settings import get_settings
from src.models.workflow import (
    Workflow, WorkflowExecution,
    WorkflowStatus, TriggerType, ExecutionStatus, RiskLevel
)
from src.services.workflow_service import get_workflow_service
from src.services.config_service import get_config_or_env

logger = logging.getLogger(__name__)


# ============================================================================
# Condition Operators
# ============================================================================

OPERATORS = {
    "equals": operator.eq,
    "==": operator.eq,
    "not_equals": operator.ne,
    "!=": operator.ne,
    ">": operator.gt,
    "greater_than": operator.gt,
    ">=": operator.ge,
    "greater_than_or_equals": operator.ge,
    "<": operator.lt,
    "less_than": operator.lt,
    "<=": operator.le,
    "less_than_or_equals": operator.le,
    "contains": lambda a, b: b in str(a) if a else False,
    "not_contains": lambda a, b: b not in str(a) if a else True,
    "starts_with": lambda a, b: str(a).startswith(str(b)) if a else False,
    "ends_with": lambda a, b: str(a).endswith(str(b)) if a else False,
    "matches": lambda a, b: bool(re.match(b, str(a))) if a else False,
    "in": lambda a, b: a in b if isinstance(b, (list, tuple)) else False,
    "not_in": lambda a, b: a not in b if isinstance(b, (list, tuple)) else True,
}


class WorkflowEngine:
    """Evaluates workflow conditions and triggers AI analysis.

    Supports dependency injection for better testability. Dependencies can be:
    - Injected via constructor (preferred for testing)
    - Lazy-loaded on first access (default behavior for production)

    Example:
        # Production: lazy loading
        engine = WorkflowEngine()

        # Testing: inject mocks
        engine = WorkflowEngine(
            ai_service=mock_ai_service,
            executor=mock_executor,
            splunk_client=mock_splunk
        )
    """

    def __init__(
        self,
        ai_service: Optional[Any] = None,
        executor: Optional[Any] = None,
        splunk_client: Optional[Any] = None,
    ):
        """Initialize WorkflowEngine with optional dependency injection.

        Args:
            ai_service: WorkflowAIService instance (lazy-loaded if None)
            executor: WorkflowExecutor instance (lazy-loaded if None)
            splunk_client: SplunkClient instance (lazy-loaded if None)
        """
        self._ai_service = ai_service
        self._executor = executor
        self._splunk_client = splunk_client
        self._lock = asyncio.Lock()

    @property
    def ai_service(self):
        """Get AI service (lazy import if not injected)."""
        if self._ai_service is None:
            from src.services.workflow_ai_service import get_workflow_ai_service
            self._ai_service = get_workflow_ai_service()
        return self._ai_service

    @property
    def executor(self):
        """Get workflow executor (lazy import if not injected)."""
        if self._executor is None:
            from src.services.workflow_executor import get_workflow_executor
            self._executor = get_workflow_executor()
        return self._executor

    async def get_splunk_client(self):
        """Get Splunk client for queries (lazy init if not injected)."""
        if self._splunk_client is None:
            try:
                from src.services.tools.splunk import SplunkClient
                from src.config.settings import get_settings
                settings = get_settings()

                # Load Splunk credentials from database first, then settings
                splunk_host = (
                    get_config_or_env("splunk_host", "SPLUNK_HOST") or
                    settings.splunk_host
                )
                splunk_username = (
                    get_config_or_env("splunk_username", "SPLUNK_USERNAME") or
                    settings.splunk_username
                )
                splunk_password = (
                    get_config_or_env("splunk_password", "SPLUNK_PASSWORD") or
                    settings.splunk_password
                )
                splunk_token = (
                    get_config_or_env("splunk_bearer_token", "SPLUNK_BEARER_TOKEN") or
                    settings.splunk_token
                )

                if splunk_host:
                    self._splunk_client = SplunkClient(
                        base_url=f"https://{splunk_host}:{settings.splunk_port}",
                        username=splunk_username,
                        password=splunk_password,
                        token=splunk_token,
                        verify_ssl=settings.splunk_verify_ssl,
                    )
            except Exception as e:
                logger.warning(f"Failed to initialize Splunk client: {e}")
        return self._splunk_client

    async def evaluate_workflow(self, workflow_id: int) -> Optional[WorkflowExecution]:
        """Main evaluation loop for a workflow.

        Args:
            workflow_id: ID of the workflow to evaluate

        Returns:
            WorkflowExecution if triggered, None otherwise
        """
        db = get_db()
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)

            if not workflow:
                logger.error(f"Workflow {workflow_id} not found")
                return None

            if workflow.status != WorkflowStatus.ACTIVE:
                logger.debug(f"Workflow {workflow_id} is not active, skipping")
                return None

            try:
                # 1. Get trigger data (Splunk query results or scheduled check)
                trigger_data, event_count = await self._get_trigger_data(workflow)

                if event_count == 0:
                    logger.debug(f"Workflow {workflow_id}: No events, nothing to do")
                    return None

                # 2. Evaluate conditions
                matching_events = self._evaluate_conditions(
                    trigger_data,
                    workflow.conditions or []
                )

                if not matching_events and workflow.conditions:
                    logger.debug(f"Workflow {workflow_id}: Conditions not met")
                    return None

                # 3. AI Analysis (if enabled)
                ai_analysis = None
                ai_confidence = None
                ai_risk_level = None
                recommended_actions = workflow.actions
                ai_cost = 0.0
                ai_input_tokens = 0
                ai_output_tokens = 0

                if workflow.ai_enabled:
                    # Check daily cost limit before AI analysis
                    settings = get_settings()
                    daily_cost = await self._get_daily_ai_cost()

                    if daily_cost >= settings.daily_ai_cost_cap_usd:
                        logger.warning(
                            f"Workflow {workflow_id}: Daily AI cost cap exceeded "
                            f"(${daily_cost:.2f} >= ${settings.daily_ai_cost_cap_usd:.2f}). "
                            f"Skipping AI analysis."
                        )
                        # Continue without AI analysis - use default actions
                    else:
                        analysis_result = await self.ai_service.analyze_trigger(
                            workflow=workflow,
                            trigger_events=matching_events or trigger_data,
                        )

                        # Check if this analysis exceeded cost cap
                        if analysis_result:
                            analysis_cost = analysis_result.get("cost_usd", 0.0)
                            if analysis_cost > settings.workflow_ai_cost_cap_usd:
                                logger.warning(
                                    f"Workflow {workflow_id}: AI analysis cost "
                                    f"${analysis_cost:.4f} exceeds cap ${settings.workflow_ai_cost_cap_usd:.2f}"
                                )

                    if analysis_result:
                        ai_analysis = analysis_result.get("reasoning")
                        ai_confidence = analysis_result.get("confidence", 0.5)
                        ai_risk_level = analysis_result.get("risk_level", "medium")
                        ai_cost = analysis_result.get("cost_usd", 0.0)
                        ai_input_tokens = analysis_result.get("input_tokens", 0)
                        ai_output_tokens = analysis_result.get("output_tokens", 0)

                        # Check if AI recommends action
                        if not analysis_result.get("should_act", True):
                            logger.info(f"Workflow {workflow_id}: AI recommends no action (confidence={ai_confidence})")
                            return None

                        # Check confidence threshold
                        if ai_confidence < workflow.ai_confidence_threshold:
                            logger.info(f"Workflow {workflow_id}: AI confidence {ai_confidence} below threshold {workflow.ai_confidence_threshold}")
                            return None

                        # Use AI-recommended actions if provided
                        if analysis_result.get("recommended_actions"):
                            recommended_actions = analysis_result["recommended_actions"]

                # 4. Determine if approval is required
                requires_approval = self._check_requires_approval(recommended_actions or [])

                # 5. Create execution record
                execution = await service.create_execution(
                    workflow_id=workflow_id,
                    trigger_data=matching_events or trigger_data,
                    trigger_event_count=event_count,
                    ai_analysis=ai_analysis,
                    ai_confidence=ai_confidence,
                    ai_risk_level=ai_risk_level,
                    recommended_actions=recommended_actions,
                    requires_approval=requires_approval,
                    ai_cost_usd=ai_cost,
                    ai_input_tokens=ai_input_tokens,
                    ai_output_tokens=ai_output_tokens,
                )

                logger.info(
                    f"Workflow {workflow_id} triggered: execution={execution.id}, "
                    f"events={event_count}, ai_confidence={ai_confidence}, "
                    f"requires_approval={requires_approval}"
                )

                # 6. Determine if we should auto-execute
                # Auto-execute if:
                # - No actions require approval, OR
                # - Auto-execute is enabled and confidence/risk thresholds are met
                should_auto = (
                    not requires_approval or
                    self._should_auto_execute(workflow, ai_confidence, ai_risk_level)
                )

                if should_auto:
                    # Update execution to mark as auto-approved
                    execution.status = ExecutionStatus.APPROVED
                    execution.requires_approval = False
                    await session.commit()

                    asyncio.create_task(
                        self.executor.execute(execution.id)
                    )

                # 7. Send notification
                await self._send_notification(workflow, execution)

                return execution

            except Exception as e:
                logger.error(f"Error evaluating workflow {workflow_id}: {e}", exc_info=True)
                return None

    async def _get_trigger_data(
        self,
        workflow: Workflow
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get trigger data based on workflow type.

        Args:
            workflow: The workflow

        Returns:
            Tuple of (events list, event count)
        """
        if workflow.trigger_type == TriggerType.SPLUNK_QUERY:
            return await self._run_splunk_query(workflow)
        elif workflow.trigger_type == TriggerType.SCHEDULE:
            # For scheduled workflows, return a synthetic trigger
            return [{"type": "scheduled_check", "timestamp": datetime.utcnow().isoformat()}], 1
        else:
            # Manual trigger - should not be called by scheduler
            return [], 0

    async def _run_splunk_query(
        self,
        workflow: Workflow
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Execute the Splunk query for a workflow.

        Args:
            workflow: The workflow with Splunk query

        Returns:
            Tuple of (events list, event count)
        """
        if not workflow.splunk_query:
            return [], 0

        client = await self.get_splunk_client()
        if not client:
            logger.warning(f"Splunk client not available for workflow {workflow.id}")
            # Return mock data for testing when Splunk is not configured
            return self._get_mock_splunk_data(workflow), 1

        try:
            # Calculate time range based on poll interval
            earliest = f"-{workflow.poll_interval_seconds}s"
            latest = "now"

            results = await client.run_search(
                query=workflow.splunk_query,
                earliest_time=earliest,
                latest_time=latest,
                max_results=100,
            )

            events = results if isinstance(results, list) else results.get("results", [])
            return events, len(events)

        except Exception as e:
            logger.error(f"Splunk query failed for workflow {workflow.id}: {e}")
            return [], 0

    def _get_mock_splunk_data(self, workflow: Workflow) -> List[Dict]:
        """Return mock data for testing when Splunk is not available."""
        # Only return mock data in development
        return []

    def _evaluate_conditions(
        self,
        events: List[Dict[str, Any]],
        conditions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Evaluate conditions against events.

        Args:
            events: List of events to evaluate
            conditions: List of condition definitions

        Returns:
            List of events that match all conditions
        """
        if not conditions:
            return events

        matching = []

        for event in events:
            matches_all = True

            for condition in conditions:
                field = condition.get("field")
                op_name = condition.get("operator", "equals")
                value = condition.get("value")

                # Handle special field: event_count
                if field == "event_count":
                    event_value = len(events)
                else:
                    event_value = event.get(field)

                # Get operator function
                op_func = OPERATORS.get(op_name)
                if not op_func:
                    logger.warning(f"Unknown operator: {op_name}")
                    continue

                # Try to match types
                try:
                    if isinstance(value, (int, float)) and event_value is not None:
                        event_value = float(event_value)
                except (ValueError, TypeError):
                    pass

                # Evaluate
                try:
                    if not op_func(event_value, value):
                        matches_all = False
                        break
                except Exception as e:
                    logger.debug(f"Condition evaluation failed: {e}")
                    matches_all = False
                    break

            if matches_all:
                matching.append(event)

        return matching

    def _check_requires_approval(self, actions: List[Dict[str, Any]]) -> bool:
        """Check if any action requires approval.

        Args:
            actions: List of action definitions

        Returns:
            True if any action requires approval
        """
        for action in actions:
            if action.get("requires_approval", True):
                return True
        return False

    async def _get_daily_ai_cost(self) -> float:
        """Get total AI cost for today across all workflow executions.

        Returns:
            Total AI cost in USD for today.
        """
        try:
            from sqlalchemy import select, func
            from datetime import date

            db = get_db()
            async with db.session() as session:
                today_start = datetime.combine(date.today(), datetime.min.time())

                result = await session.execute(
                    select(func.coalesce(func.sum(WorkflowExecution.ai_cost_usd), 0.0))
                    .where(WorkflowExecution.started_at >= today_start)
                )
                total = result.scalar() or 0.0
                return float(total)
        except Exception as e:
            logger.warning(f"Failed to get daily AI cost: {e}")
            return 0.0  # Return 0 to allow execution if check fails

    def _should_auto_execute(
        self,
        workflow: Workflow,
        ai_confidence: Optional[float],
        ai_risk_level: Optional[str]
    ) -> bool:
        """Determine if execution should proceed automatically.

        Auto-execution requires:
        - auto_execute_enabled is True
        - AI confidence >= auto_execute_min_confidence
        - Risk level <= auto_execute_max_risk

        Args:
            workflow: The workflow with auto-execute settings
            ai_confidence: AI confidence score (0.0 - 1.0)
            ai_risk_level: AI assessed risk level ('low', 'medium', 'high')

        Returns:
            True if execution should proceed automatically
        """
        # Check if auto-execute is enabled
        if not workflow.auto_execute_enabled:
            return False

        # Must have AI confidence
        if ai_confidence is None:
            return False

        # Check confidence threshold
        if ai_confidence < workflow.auto_execute_min_confidence:
            logger.debug(
                f"Workflow {workflow.id}: Auto-execute blocked - confidence {ai_confidence} "
                f"< threshold {workflow.auto_execute_min_confidence}"
            )
            return False

        # Check risk level
        risk_order = {"low": 0, "medium": 1, "high": 2}
        current_risk = risk_order.get(ai_risk_level, 2)  # Default to high if unknown
        max_allowed_risk = risk_order.get(
            workflow.auto_execute_max_risk.value if hasattr(workflow.auto_execute_max_risk, 'value')
            else workflow.auto_execute_max_risk,
            0
        )

        if current_risk > max_allowed_risk:
            logger.debug(
                f"Workflow {workflow.id}: Auto-execute blocked - risk '{ai_risk_level}' "
                f"> max allowed '{workflow.auto_execute_max_risk}'"
            )
            return False

        logger.info(
            f"Workflow {workflow.id}: Auto-execute approved - confidence={ai_confidence}, "
            f"risk={ai_risk_level}"
        )
        return True

    async def _send_notification(
        self,
        workflow: Workflow,
        execution: WorkflowExecution
    ):
        """Send notification about triggered workflow.

        Args:
            workflow: The workflow
            execution: The execution record
        """
        try:
            # Import WebSocket hub for real-time notifications
            from src.services.websocket_hub import get_websocket_hub

            hub = get_websocket_hub()

            notification = {
                "type": "workflow_triggered",
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                "execution_id": execution.id,
                "status": execution.status.value,
                "ai_confidence": execution.ai_confidence,
                "requires_approval": execution.requires_approval,
                "trigger_event_count": execution.trigger_event_count,
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Broadcast to workflow topic
            await hub.broadcast(
                topic=f"workflows:{workflow.organization or 'global'}",
                message=notification
            )

            logger.debug(f"Sent notification for workflow {workflow.id} execution {execution.id}")

        except Exception as e:
            logger.warning(f"Failed to send workflow notification: {e}")

    async def test_workflow(self, workflow_id: int, model: Optional[str] = None) -> Dict[str, Any]:
        """Test run a workflow without executing actions.

        Args:
            workflow_id: ID of the workflow to test
            model: Optional AI model to use (user's preferred model)

        Returns:
            Test results including what would be triggered
        """
        db = get_db()
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)

            if not workflow:
                return {"success": False, "error": "Workflow not found"}

            try:
                # Get trigger data
                trigger_data, event_count = await self._get_trigger_data(workflow)

                # Evaluate conditions
                matching_events = self._evaluate_conditions(
                    trigger_data,
                    workflow.conditions or []
                )

                # AI analysis (if enabled)
                ai_result = None
                if workflow.ai_enabled and (matching_events or not workflow.conditions):
                    ai_result = await self.ai_service.analyze_trigger(
                        workflow=workflow,
                        trigger_events=matching_events or trigger_data,
                        model=model,
                    )

                return {
                    "success": True,
                    "would_trigger": len(matching_events) > 0 or not workflow.conditions,
                    "event_count": event_count,
                    "matching_events": len(matching_events),
                    "sample_events": (matching_events or trigger_data)[:5],
                    "ai_analysis": ai_result,
                    "actions_to_execute": workflow.actions,
                }

            except Exception as e:
                logger.error(f"Test failed for workflow {workflow_id}: {e}")
                return {"success": False, "error": str(e)}


# ============================================================================
# Global Engine Instance
# ============================================================================

_engine: Optional[WorkflowEngine] = None


def get_workflow_engine(
    ai_service: Optional[Any] = None,
    executor: Optional[Any] = None,
    splunk_client: Optional[Any] = None,
    reset: bool = False,
) -> WorkflowEngine:
    """Get the global workflow engine instance.

    Supports dependency injection for testing. When dependencies are provided,
    a new engine is created with those dependencies instead of using the singleton.

    Args:
        ai_service: Optional WorkflowAIService to inject
        executor: Optional WorkflowExecutor to inject
        splunk_client: Optional SplunkClient to inject
        reset: If True, reset the singleton and create a new instance

    Returns:
        WorkflowEngine instance

    Example:
        # Production: get singleton
        engine = get_workflow_engine()

        # Testing: create new instance with mocks
        engine = get_workflow_engine(
            ai_service=mock_ai,
            executor=mock_executor,
            reset=True
        )
    """
    global _engine

    # If dependencies are provided, create a new instance with DI
    has_injected_deps = any([ai_service, executor, splunk_client])

    if has_injected_deps:
        # Return a new instance with injected dependencies (for testing)
        return WorkflowEngine(
            ai_service=ai_service,
            executor=executor,
            splunk_client=splunk_client,
        )

    # Reset singleton if requested
    if reset:
        _engine = None

    # Standard singleton pattern
    if _engine is None:
        _engine = WorkflowEngine()
    return _engine


def reset_workflow_engine() -> None:
    """Reset the global workflow engine instance.

    Useful for testing to ensure a fresh engine state.
    """
    global _engine
    _engine = None
