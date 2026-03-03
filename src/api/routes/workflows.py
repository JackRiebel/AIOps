"""API routes for AI-enabled automation workflows."""

import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Depends, Body
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import require_permission, get_current_active_user
from src.models.user import User
from src.models.workflow import ExecutionStatus
from src.config.database import get_db
from src.services.workflow_service import get_workflow_service, WORKFLOW_TEMPLATES
from src.services.workflow_ai_service import get_workflow_ai_service

logger = logging.getLogger(__name__)

router = APIRouter()
db = get_db()


# ============================================================================
# Pydantic Models for Request/Response
# ============================================================================

class ConditionSchema(BaseModel):
    """Condition for workflow trigger evaluation."""
    field: str
    operator: str  # equals, not_equals, >, <, >=, <=, contains, not_contains
    value: Any


class ActionSchema(BaseModel):
    """Action to execute when workflow triggers."""
    tool: str
    params: Dict[str, Any] = Field(default_factory=dict)
    requires_approval: bool = True


class WorkflowCreateRequest(BaseModel):
    """Request body for creating a workflow."""
    name: str
    description: Optional[str] = None
    trigger_type: str  # splunk_query, schedule, manual
    splunk_query: Optional[str] = None
    schedule_cron: Optional[str] = None
    poll_interval_seconds: int = 300
    conditions: Optional[List[ConditionSchema]] = None
    actions: Optional[List[ActionSchema]] = None
    ai_enabled: bool = True
    ai_prompt: Optional[str] = None
    ai_confidence_threshold: float = 0.7
    flow_data: Optional[Dict[str, Any]] = None
    organization: Optional[str] = None
    # Auto-execute settings (for workflows that can run without approval)
    auto_execute_enabled: bool = False
    auto_execute_min_confidence: float = 0.9
    auto_execute_max_risk: str = "low"
    tags: Optional[List[str]] = None
    # Workflow mode (cards, cli, python)
    mode: str = "cards"
    cli_code: Optional[str] = None
    python_code: Optional[str] = None


class WorkflowUpdateRequest(BaseModel):
    """Request body for updating a workflow."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    trigger_type: Optional[str] = None
    splunk_query: Optional[str] = None
    schedule_cron: Optional[str] = None
    poll_interval_seconds: Optional[int] = None
    conditions: Optional[List[ConditionSchema]] = None
    actions: Optional[List[ActionSchema]] = None
    ai_enabled: Optional[bool] = None
    ai_prompt: Optional[str] = None
    ai_confidence_threshold: Optional[float] = None
    flow_data: Optional[Dict[str, Any]] = None
    # Workflow mode (cards, cli, python)
    mode: Optional[str] = None
    cli_code: Optional[str] = None
    python_code: Optional[str] = None


class WorkflowFromTemplateRequest(BaseModel):
    """Request body for creating workflow from template."""
    template_id: str
    name_override: Optional[str] = None
    organization: Optional[str] = None


class ApproveExecutionRequest(BaseModel):
    """Request body for approving an execution."""
    modified_actions: Optional[List[ActionSchema]] = None


class RejectExecutionRequest(BaseModel):
    """Request body for rejecting an execution."""
    reason: Optional[str] = None


class WorkflowResponse(BaseModel):
    """Response model for a workflow."""
    id: int
    name: str
    description: Optional[str]
    status: str
    trigger_type: str
    splunk_query: Optional[str]
    schedule_cron: Optional[str]
    poll_interval_seconds: int
    conditions: Optional[List[Dict]]
    actions: Optional[List[Dict]]
    ai_enabled: bool
    ai_prompt: Optional[str]
    ai_confidence_threshold: float
    auto_execute_enabled: bool = False
    auto_execute_min_confidence: float = 0.9
    auto_execute_max_risk: str = "low"
    flow_data: Optional[Dict]
    created_by: Optional[int]
    organization: Optional[str]
    template_id: Optional[str]
    tags: Optional[List[str]] = None
    created_at: Optional[str]
    updated_at: Optional[str]
    last_triggered_at: Optional[str]
    trigger_count: int
    success_count: int
    failure_count: int
    # Workflow mode
    mode: str = "cards"
    cli_code: Optional[str] = None
    python_code: Optional[str] = None


class ExecutionResponse(BaseModel):
    """Response model for a workflow execution."""
    id: int
    workflow_id: int
    status: str
    trigger_data: Optional[Dict]
    trigger_event_count: int
    ai_analysis: Optional[str]
    ai_confidence: Optional[float]
    ai_risk_level: Optional[str]
    recommended_actions: Optional[List[Dict]]
    requires_approval: bool
    approved_by: Optional[int]
    approved_at: Optional[str]
    rejection_reason: Optional[str]
    executed_at: Optional[str]
    completed_at: Optional[str]
    result: Optional[Dict]
    error: Optional[str]
    executed_actions: Optional[List[Dict]]
    ai_cost_usd: float
    ai_input_tokens: int
    ai_output_tokens: int
    created_at: Optional[str]
    workflow_name: Optional[str] = None  # Added for convenience


class TemplateResponse(BaseModel):
    """Response model for a workflow template."""
    id: str
    name: str
    description: str
    trigger_type: str
    ai_enabled: bool
    action_count: int


class WorkflowStatsResponse(BaseModel):
    """Response model for workflow statistics."""
    workflows: Dict[str, int]
    pending_approvals: int
    triggered_today: int
    total_triggers: int
    total_successes: int
    total_failures: int
    success_rate: float


class WorkflowGenerateRequest(BaseModel):
    """Request body for AI workflow generation."""
    description: str = Field(..., min_length=10, description="Natural language description of the workflow")
    organization: Optional[str] = None


class WorkflowGenerateResponse(BaseModel):
    """Response model for AI-generated workflow."""
    workflow: Dict[str, Any]
    confidence: float
    explanation: str


# ============================================================================
# Workflow CRUD Routes
# ============================================================================

@router.get("/api/workflows", response_model=List[WorkflowResponse])
async def list_workflows(
    organization: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    trigger_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: None = Depends(require_permission("workflows.view")),
):
    """List all workflows with optional filters.

    Args:
        organization: Filter by organization
        status: Filter by status (active, paused, draft)
        trigger_type: Filter by trigger type (splunk_query, schedule, manual)
        limit: Maximum number of results
        offset: Pagination offset

    Returns:
        List of workflows
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflows = await service.list_workflows(
                organization=organization,
                status=status,
                trigger_type=trigger_type,
                limit=limit,
                offset=offset,
            )
            return [w.to_dict() for w in workflows]
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Error listing workflows: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/stats", response_model=WorkflowStatsResponse)
async def get_workflow_stats(
    organization: Optional[str] = Query(default=None),
    _: None = Depends(require_permission("workflows.view")),
):
    """Get aggregated workflow statistics.

    Args:
        organization: Filter by organization

    Returns:
        Workflow statistics
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            stats = await service.get_workflow_stats(organization=organization)
            return stats
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Error getting workflow stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/templates", response_model=List[TemplateResponse])
async def list_templates(
    _: None = Depends(require_permission("workflows.view")),
):
    """Get available workflow templates.

    Returns:
        List of workflow templates
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            templates = await service.get_templates()
            return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: int,
    _: None = Depends(require_permission("workflows.view")),
):
    """Get a workflow by ID.

    Args:
        workflow_id: Workflow ID

    Returns:
        Workflow details
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")
            return workflow.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows", response_model=WorkflowResponse)
async def create_workflow(
    request: WorkflowCreateRequest,
    _: None = Depends(require_permission("workflows.create")),
):
    """Create a new workflow.

    Args:
        request: Workflow creation request

    Returns:
        Created workflow
    """
    logger.info(f"[Workflow Create] Received request: name={request.name}, trigger={request.trigger_type}, actions={len(request.actions or [])}")
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.create_workflow(
                name=request.name,
                description=request.description,
                trigger_type=request.trigger_type,
                splunk_query=request.splunk_query,
                schedule_cron=request.schedule_cron,
                poll_interval_seconds=request.poll_interval_seconds,
                conditions=[c.model_dump() for c in request.conditions] if request.conditions else None,
                actions=[a.model_dump() for a in request.actions] if request.actions else None,
                ai_enabled=request.ai_enabled,
                ai_prompt=request.ai_prompt,
                ai_confidence_threshold=request.ai_confidence_threshold,
                flow_data=request.flow_data,
                organization=request.organization,
                auto_execute_enabled=request.auto_execute_enabled,
                auto_execute_min_confidence=request.auto_execute_min_confidence,
                auto_execute_max_risk=request.auto_execute_max_risk,
                tags=request.tags,
                mode=request.mode,
                cli_code=request.cli_code,
                python_code=request.python_code,
            )
            return workflow.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/from-template", response_model=WorkflowResponse)
async def create_from_template(
    request: WorkflowFromTemplateRequest,
    _: None = Depends(require_permission("workflows.create")),
):
    """Create a workflow from a template.

    Args:
        request: Template creation request

    Returns:
        Created workflow
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.create_from_template(
                template_id=request.template_id,
                name_override=request.name_override,
                organization=request.organization,
            )
            return workflow.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/generate", response_model=WorkflowGenerateResponse)
async def generate_workflow(
    request: WorkflowGenerateRequest,
    _: None = Depends(require_permission("workflows.create")),
):
    """Generate a workflow from a natural language description using AI.

    This endpoint uses Claude to parse the user's description and generate
    a structured workflow configuration.

    Args:
        request: Generation request with description and optional organization

    Returns:
        Generated workflow configuration with confidence score and explanation
    """
    try:
        ai_service = get_workflow_ai_service()
        result = await ai_service.generate_workflow_from_description(
            description=request.description,
            organization=request.organization,
        )
        return WorkflowGenerateResponse(
            workflow=result["workflow"],
            confidence=result["confidence"],
            explanation=result["explanation"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: int,
    request: WorkflowUpdateRequest,
    _: None = Depends(require_permission("workflows.edit")),
):
    """Update a workflow.

    Args:
        workflow_id: Workflow ID
        request: Update request

    Returns:
        Updated workflow
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)

            # Build updates dict, excluding None values
            updates = {}
            for field, value in request.model_dump().items():
                if value is not None:
                    if field == "conditions" and value:
                        updates[field] = [c if isinstance(c, dict) else c.model_dump() for c in value]
                    elif field == "actions" and value:
                        updates[field] = [a if isinstance(a, dict) else a.model_dump() for a in value]
                    else:
                        updates[field] = value

            workflow = await service.update_workflow(workflow_id, **updates)
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")
            return workflow.to_dict()
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: int,
    _: None = Depends(require_permission("workflows.delete")),
):
    """Delete a workflow.

    Args:
        workflow_id: Workflow ID

    Returns:
        Success status
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            success = await service.delete_workflow(workflow_id)
            if not success:
                raise HTTPException(status_code=404, detail="Workflow not found")
            return {"success": True, "message": "Workflow deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/{workflow_id}/toggle", response_model=WorkflowResponse)
async def toggle_workflow(
    workflow_id: int,
    _: None = Depends(require_permission("workflows.edit")),
):
    """Toggle a workflow between active and paused.

    Args:
        workflow_id: Workflow ID

    Returns:
        Updated workflow
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.toggle_workflow(workflow_id)
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")
            return workflow.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Execution Routes
# ============================================================================

@router.get("/api/workflows/executions", response_model=List[ExecutionResponse])
async def list_executions(
    workflow_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    organization: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: None = Depends(require_permission("workflows.view")),
):
    """List workflow executions with optional filters.

    Args:
        workflow_id: Filter by workflow ID
        status: Filter by status
        organization: Filter by organization
        limit: Maximum results
        offset: Pagination offset

    Returns:
        List of executions
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            executions = await service.list_executions(
                workflow_id=workflow_id,
                status=status,
                organization=organization,
                limit=limit,
                offset=offset,
            )
            results = []
            for ex in executions:
                ex_dict = ex.to_dict()
                ex_dict["workflow_name"] = ex.workflow.name if ex.workflow else None
                results.append(ex_dict)
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/executions/pending", response_model=List[ExecutionResponse])
async def get_pending_approvals(
    organization: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    _: None = Depends(require_permission("workflows.view")),
):
    """Get executions pending approval.

    Args:
        organization: Filter by organization
        limit: Maximum results

    Returns:
        List of pending executions
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            executions = await service.get_pending_approvals(
                organization=organization,
                limit=limit,
            )
            results = []
            for ex in executions:
                ex_dict = ex.to_dict()
                ex_dict["workflow_name"] = ex.workflow.name if ex.workflow else None
                results.append(ex_dict)
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/executions/completed", response_model=List[ExecutionResponse])
async def get_completed_executions(
    organization: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    _: None = Depends(require_permission("workflows.view")),
):
    """Get completed executions (for outcome recording).

    Args:
        organization: Filter by organization
        limit: Maximum results

    Returns:
        List of completed executions
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            executions = await service.list_executions(
                status="completed",
                limit=limit,
            )
            results = []
            for ex in executions:
                ex_dict = ex.to_dict()
                ex_dict["workflow_name"] = ex.workflow.name if ex.workflow else None
                results.append(ex_dict)
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/{workflow_id}/executions", response_model=List[ExecutionResponse])
async def get_workflow_executions(
    workflow_id: int,
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: None = Depends(require_permission("workflows.view")),
):
    """Get executions for a specific workflow.

    Args:
        workflow_id: Workflow ID
        status: Filter by status
        limit: Maximum results
        offset: Pagination offset

    Returns:
        List of executions
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            executions = await service.list_executions(
                workflow_id=workflow_id,
                status=status,
                limit=limit,
                offset=offset,
            )
            results = []
            for ex in executions:
                ex_dict = ex.to_dict()
                ex_dict["workflow_name"] = ex.workflow.name if ex.workflow else None
                results.append(ex_dict)
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/executions/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: int,
    _: None = Depends(require_permission("workflows.view")),
):
    """Get a specific execution.

    Args:
        execution_id: Execution ID

    Returns:
        Execution details
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            execution = await service.get_execution(execution_id)
            if not execution:
                raise HTTPException(status_code=404, detail="Execution not found")
            ex_dict = execution.to_dict()
            # Include workflow details for the ExecutionMonitor to show full flow
            if execution.workflow:
                ex_dict["workflow_name"] = execution.workflow.name
                ex_dict["workflow_flow_data"] = execution.workflow.flow_data
                ex_dict["workflow_actions"] = execution.workflow.actions
            return ex_dict
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/executions/{execution_id}/approve", response_model=ExecutionResponse)
async def approve_execution(
    execution_id: int,
    request: ApproveExecutionRequest = Body(default=ApproveExecutionRequest()),
    user: User = Depends(require_permission("workflows.approve")),
):
    """Approve a pending execution.

    Args:
        execution_id: Execution ID
        request: Approval request with optional modified actions

    Returns:
        Updated execution
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)

            modified_actions = None
            if request.modified_actions:
                modified_actions = [a.model_dump() for a in request.modified_actions]

            execution = await service.approve_execution(
                execution_id=execution_id,
                approved_by=user.id,  # Use actual user ID from auth context
                modified_actions=modified_actions,
            )
            if not execution:
                raise HTTPException(status_code=404, detail="Execution not found")

            ex_dict = execution.to_dict()
            ex_dict["workflow_name"] = execution.workflow.name if execution.workflow else None
            return ex_dict
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/executions/{execution_id}/reject", response_model=ExecutionResponse)
async def reject_execution(
    execution_id: int,
    request: RejectExecutionRequest = Body(default=RejectExecutionRequest()),
    user: User = Depends(require_permission("workflows.approve")),
):
    """Reject a pending execution.

    Args:
        execution_id: Execution ID
        request: Rejection request with optional reason

    Returns:
        Updated execution
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)

            execution = await service.reject_execution(
                execution_id=execution_id,
                rejected_by=user.id,  # Use actual user ID from auth context
                reason=request.reason,
            )
            if not execution:
                raise HTTPException(status_code=404, detail="Execution not found")

            ex_dict = execution.to_dict()
            ex_dict["workflow_name"] = execution.workflow.name if execution.workflow else None
            return ex_dict
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/{workflow_id}/test")
async def test_workflow(
    workflow_id: int,
    simulation_start_time: Optional[str] = Query(default=None, description="ISO timestamp for simulation start"),
    simulation_end_time: Optional[str] = Query(default=None, description="ISO timestamp for simulation end"),
    _: None = Depends(require_permission("workflows.execute")),
    current_user: User = Depends(get_current_active_user),
):
    """Test run a workflow without executing actions.

    This will:
    1. Run the Splunk query (if splunk_query trigger) - respects time window if provided
    2. Evaluate conditions
    3. Run AI analysis (using user's preferred model)
    4. Return what would happen without actually executing

    Args:
        workflow_id: Workflow ID
        simulation_start_time: Optional ISO timestamp for time-windowed queries
        simulation_end_time: Optional ISO timestamp for time-windowed queries

    Returns:
        Test run results including simulation_time_range if time params provided
    """
    try:
        from src.services.workflow_engine import get_workflow_engine

        # Get user's preferred model
        preferred_model = current_user.preferred_model if current_user else None

        # Parse time range if provided
        time_range = None
        if simulation_start_time and simulation_end_time:
            try:
                start = datetime.fromisoformat(simulation_start_time.replace('Z', '+00:00'))
                end = datetime.fromisoformat(simulation_end_time.replace('Z', '+00:00'))
                time_range = {"start": start, "end": end}
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid time format. Use ISO 8601 format.")

        engine = get_workflow_engine()
        result = await engine.test_workflow(
            workflow_id,
            model=preferred_model,
            simulation_time_range=time_range,
        )

        if not result.get("success"):
            error = result.get("error", "Test failed")
            if error == "Workflow not found":
                raise HTTPException(status_code=404, detail=error)
            raise HTTPException(status_code=500, detail=error)

        # Add workflow info to result
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)
            if workflow:
                result["workflow_id"] = workflow_id
                result["workflow_name"] = workflow.name

        # Add simulation time range info if provided
        if time_range:
            result["simulation_time_range"] = {
                "start": time_range["start"].isoformat(),
                "end": time_range["end"].isoformat(),
            }

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/{workflow_id}/duplicate", response_model=WorkflowResponse)
async def duplicate_workflow(
    workflow_id: int,
    _: None = Depends(require_permission("workflows.create")),
):
    """Duplicate an existing workflow.

    Creates a copy of the workflow with "(Copy)" appended to the name.

    Args:
        workflow_id: ID of the workflow to duplicate

    Returns:
        The newly created duplicate workflow
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")

            # Create a copy with modified name
            new_workflow = await service.create_workflow(
                name=f"{workflow.name} (Copy)",
                description=workflow.description,
                trigger_type=workflow.trigger_type.value if workflow.trigger_type else "manual",
                splunk_query=workflow.splunk_query,
                schedule_cron=workflow.schedule_cron,
                poll_interval_seconds=workflow.poll_interval_seconds,
                conditions=workflow.conditions,
                actions=workflow.actions,
                ai_enabled=workflow.ai_enabled,
                ai_prompt=workflow.ai_prompt,
                ai_confidence_threshold=workflow.ai_confidence_threshold,
                flow_data=workflow.flow_data,
                organization=workflow.organization,
                auto_execute_enabled=workflow.auto_execute_enabled,
                auto_execute_min_confidence=workflow.auto_execute_min_confidence,
                auto_execute_max_risk=workflow.auto_execute_max_risk.value if workflow.auto_execute_max_risk else "low",
                tags=workflow.tags,
                mode=workflow.workflow_mode.value if workflow.workflow_mode else "cards",
                cli_code=workflow.cli_code,
                python_code=workflow.python_code,
            )
            return new_workflow.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/workflows/{workflow_id}/export")
async def export_workflow(
    workflow_id: int,
    _: None = Depends(require_permission("workflows.view")),
):
    """Export a workflow as JSON.

    Returns the workflow configuration in a format suitable for import.

    Args:
        workflow_id: ID of the workflow to export

    Returns:
        Workflow configuration as JSON
    """
    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")

            # Return exportable format (exclude internal fields)
            return {
                "name": workflow.name,
                "description": workflow.description,
                "trigger_type": workflow.trigger_type.value if workflow.trigger_type else "manual",
                "splunk_query": workflow.splunk_query,
                "schedule_cron": workflow.schedule_cron,
                "poll_interval_seconds": workflow.poll_interval_seconds,
                "conditions": workflow.conditions,
                "actions": workflow.actions,
                "ai_enabled": workflow.ai_enabled,
                "ai_prompt": workflow.ai_prompt,
                "ai_confidence_threshold": workflow.ai_confidence_threshold,
                "flow_data": workflow.flow_data,
                "organization": workflow.organization,
                "auto_execute_enabled": workflow.auto_execute_enabled,
                "auto_execute_min_confidence": workflow.auto_execute_min_confidence,
                "auto_execute_max_risk": workflow.auto_execute_max_risk.value if workflow.auto_execute_max_risk else "low",
                "tags": workflow.tags or [],
                "mode": workflow.workflow_mode.value if workflow.workflow_mode else "cards",
                "cli_code": workflow.cli_code,
                "python_code": workflow.python_code,
                "exported_at": datetime.utcnow().isoformat(),
                "export_version": "1.1",
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/{workflow_id}/run")
async def run_workflow(
    workflow_id: int,
    _: None = Depends(require_permission("workflows.execute")),
):
    """Manually trigger a workflow execution.

    Args:
        workflow_id: ID of the workflow to run

    Returns:
        Execution status with execution_id
    """
    import asyncio
    from src.services.workflow_executor import get_workflow_executor

    try:
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")

            if workflow.status != "active":
                raise HTTPException(
                    status_code=400,
                    detail="Cannot run a paused workflow. Activate it first."
                )

            # Check if any action requires approval
            actions = workflow.actions or []
            requires_approval = any(
                action.get("requires_approval", True) for action in actions
            )

            # Create an execution record for this manual trigger
            execution = await service.create_execution(
                workflow_id=workflow_id,
                trigger_data={"source": "manual", "triggered_at": datetime.utcnow().isoformat()},
                trigger_event_count=1,
                ai_analysis=None,
                ai_confidence=None,
                ai_risk_level=None,
                recommended_actions=actions,
                requires_approval=requires_approval,
            )

            # If no approval required, auto-execute immediately
            if not requires_approval:
                # Mark as approved and execute in background
                execution.status = ExecutionStatus.APPROVED
                await session.commit()

                executor = get_workflow_executor()
                asyncio.create_task(executor.execute(execution.id))

                return {
                    "success": True,
                    "workflow_id": workflow_id,
                    "execution_id": execution.id,
                    "status": "executing",
                    "message": "Workflow started execution immediately (no approval required)",
                }

            # Approval required - return pending status
            return {
                "success": True,
                "workflow_id": workflow_id,
                "execution_id": execution.id,
                "status": "pending_approval",
                "message": "Workflow triggered - awaiting approval before execution",
                "requires_approval": True,
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Workflow Outcome Endpoints - Track execution outcomes for learning
# ============================================================================

class OutcomeRecordRequest(BaseModel):
    """Request body for recording an execution outcome."""
    outcome: str  # resolved, partial, failed, unknown
    resolution_time_minutes: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    affected_devices_count: Optional[int] = None
    affected_users_count: Optional[int] = None
    root_cause: Optional[str] = None
    prevention_notes: Optional[str] = None


class OutcomeResponse(BaseModel):
    """Response model for a workflow outcome."""
    id: int
    execution_id: int
    outcome: str
    resolution_time_minutes: Optional[int]
    notes: Optional[str]
    tags: Optional[List[str]]
    affected_devices_count: Optional[int]
    affected_users_count: Optional[int]
    root_cause: Optional[str]
    prevention_notes: Optional[str]
    recorded_by: Optional[int]
    created_at: Optional[str]
    updated_at: Optional[str]


@router.post("/api/executions/{execution_id}/outcome", response_model=OutcomeResponse)
async def record_execution_outcome(
    execution_id: int,
    request: OutcomeRecordRequest,
    _: None = Depends(require_permission("workflows.record_outcome")),
):
    """Record the outcome of a workflow execution.

    This tracks whether the execution resolved the issue, for learning purposes.

    Args:
        execution_id: ID of the execution
        request: Outcome data

    Returns:
        The recorded outcome
    """
    from src.models.workflow import WorkflowExecution, WorkflowOutcome

    try:
        async with db.session() as session:
            # Verify execution exists
            result = await session.execute(
                "SELECT id FROM workflow_executions WHERE id = :id",
                {"id": execution_id}
            )
            execution = result.fetchone()
            if not execution:
                raise HTTPException(status_code=404, detail="Execution not found")

            # Check if outcome already exists
            result = await session.execute(
                "SELECT id FROM workflow_outcomes WHERE execution_id = :id",
                {"id": execution_id}
            )
            existing = result.fetchone()
            if existing:
                # Update existing outcome
                from datetime import datetime
                await session.execute(
                    text("""UPDATE workflow_outcomes SET
                        outcome = :outcome,
                        resolution_time_minutes = :resolution_time_minutes,
                        notes = :notes,
                        tags = :tags,
                        affected_devices_count = :affected_devices_count,
                        affected_users_count = :affected_users_count,
                        root_cause = :root_cause,
                        prevention_notes = :prevention_notes,
                        updated_at = :updated_at
                    WHERE execution_id = :execution_id"""),
                    {
                        "execution_id": execution_id,
                        "outcome": request.outcome,
                        "resolution_time_minutes": request.resolution_time_minutes,
                        "notes": request.notes,
                        "tags": request.tags,
                        "affected_devices_count": request.affected_devices_count,
                        "affected_users_count": request.affected_users_count,
                        "root_cause": request.root_cause,
                        "prevention_notes": request.prevention_notes,
                        "updated_at": datetime.utcnow(),
                    }
                )
                await session.commit()

                # Fetch updated outcome
                result = await session.execute(
                    "SELECT * FROM workflow_outcomes WHERE execution_id = :id",
                    {"id": execution_id}
                )
                outcome_row = result.fetchone()
            else:
                # Create new outcome
                result = await session.execute(
                    """INSERT INTO workflow_outcomes
                        (execution_id, outcome, resolution_time_minutes, notes, tags,
                         affected_devices_count, affected_users_count, root_cause, prevention_notes)
                    VALUES (:execution_id, :outcome, :resolution_time_minutes, :notes, :tags,
                            :affected_devices_count, :affected_users_count, :root_cause, :prevention_notes)
                    RETURNING *""",
                    {
                        "execution_id": execution_id,
                        "outcome": request.outcome,
                        "resolution_time_minutes": request.resolution_time_minutes,
                        "notes": request.notes,
                        "tags": request.tags,
                        "affected_devices_count": request.affected_devices_count,
                        "affected_users_count": request.affected_users_count,
                        "root_cause": request.root_cause,
                        "prevention_notes": request.prevention_notes,
                    }
                )
                outcome_row = result.fetchone()
                await session.commit()

            return {
                "id": outcome_row.id,
                "execution_id": outcome_row.execution_id,
                "outcome": outcome_row.outcome,
                "resolution_time_minutes": outcome_row.resolution_time_minutes,
                "notes": outcome_row.notes,
                "tags": outcome_row.tags,
                "affected_devices_count": outcome_row.affected_devices_count,
                "affected_users_count": outcome_row.affected_users_count,
                "root_cause": outcome_row.root_cause,
                "prevention_notes": outcome_row.prevention_notes,
                "recorded_by": outcome_row.recorded_by,
                "created_at": outcome_row.created_at.isoformat() if outcome_row.created_at else None,
                "updated_at": outcome_row.updated_at.isoformat() if outcome_row.updated_at else None,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/executions/{execution_id}/outcome", response_model=Optional[OutcomeResponse])
async def get_execution_outcome(
    execution_id: int,
    _: None = Depends(require_permission("workflows.view")),
):
    """Get the outcome for a workflow execution.

    Args:
        execution_id: ID of the execution

    Returns:
        The outcome if recorded, null otherwise
    """
    try:
        async with db.session() as session:
            result = await session.execute(
                "SELECT * FROM workflow_outcomes WHERE execution_id = :id",
                {"id": execution_id}
            )
            outcome_row = result.fetchone()

            if not outcome_row:
                return None

            return {
                "id": outcome_row.id,
                "execution_id": outcome_row.execution_id,
                "outcome": outcome_row.outcome,
                "resolution_time_minutes": outcome_row.resolution_time_minutes,
                "notes": outcome_row.notes,
                "tags": outcome_row.tags,
                "affected_devices_count": outcome_row.affected_devices_count,
                "affected_users_count": outcome_row.affected_users_count,
                "root_cause": outcome_row.root_cause,
                "prevention_notes": outcome_row.prevention_notes,
                "recorded_by": outcome_row.recorded_by,
                "created_at": outcome_row.created_at.isoformat() if outcome_row.created_at else None,
                "updated_at": outcome_row.updated_at.isoformat() if outcome_row.updated_at else None,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Action Registry Endpoints - Available actions for workflows
# ============================================================================

# Define the action registry with all available actions
ACTION_REGISTRY = [
    # ===== MERAKI ACTIONS =====
    {
        "id": "meraki.reboot_device",
        "name": "Reboot Meraki Device",
        "description": "Restart a Meraki device (AP, switch, or appliance)",
        "category": "network",
        "platform": "meraki",
        "icon": "🔄",
        "endpoint": "/api/actions/meraki/devices/{serial}/reboot",
        "method": "POST",
        "parameters": [
            {"id": "serial", "name": "Device Serial", "type": "string", "required": True, "source": "meraki_devices"},
        ],
        "verified": True,
        "riskLevel": "medium",
        "example": {
            "scenario": "Reboot an access point that is unresponsive",
            "config": {"serial": "Q2HP-XXXX-XXXX"}
        }
    },
    {
        "id": "meraki.enable_ssid",
        "name": "Enable/Disable SSID",
        "description": "Turn a wireless network on or off",
        "category": "network",
        "platform": "meraki",
        "icon": "📶",
        "endpoint": "/api/actions/meraki/networks/{networkId}/wireless/ssids/{number}",
        "method": "PUT",
        "parameters": [
            {"id": "networkId", "name": "Network", "type": "string", "required": True, "source": "meraki_networks"},
            {"id": "number", "name": "SSID Number", "type": "number", "required": True, "min": 0, "max": 14},
            {"id": "enabled", "name": "Enable SSID", "type": "boolean", "required": True},
        ],
        "verified": True,
        "riskLevel": "high",
    },
    {
        "id": "meraki.quarantine_client",
        "name": "Quarantine Client",
        "description": "Block a client from network access",
        "category": "security",
        "platform": "meraki",
        "icon": "🚫",
        "endpoint": "/api/actions/meraki/networks/{networkId}/clients/{clientId}/policy",
        "method": "PUT",
        "parameters": [
            {"id": "networkId", "name": "Network", "type": "string", "required": True},
            {"id": "clientId", "name": "Client MAC", "type": "string", "required": True},
            {"id": "devicePolicy", "name": "Policy", "type": "select", "options": ["Blocked", "Normal", "Whitelisted"]},
        ],
        "verified": True,
        "riskLevel": "high",
    },
    # ===== SPLUNK ACTIONS =====
    {
        "id": "splunk.run_query",
        "name": "Run Splunk Query",
        "description": "Execute a Splunk search and return results",
        "category": "data",
        "platform": "splunk",
        "icon": "🔍",
        "endpoint": "/api/actions/splunk/search",
        "method": "POST",
        "parameters": [
            {"id": "query", "name": "SPL Query", "type": "text", "required": True},
            {"id": "earliest", "name": "Time Range Start", "type": "string", "default": "-24h"},
            {"id": "latest", "name": "Time Range End", "type": "string", "default": "now"},
        ],
        "verified": True,
        "riskLevel": "low",
    },
    # ===== NOTIFICATION ACTIONS =====
    {
        "id": "notify.slack",
        "name": "Send Slack Message",
        "description": "Post a message to a Slack channel",
        "category": "notification",
        "icon": "💬",
        "endpoint": "/api/actions/notify/slack",
        "method": "POST",
        "parameters": [
            {"id": "channel", "name": "Channel", "type": "string", "required": True},
            {"id": "message", "name": "Message", "type": "text", "required": True},
            {"id": "mention", "name": "Mention (@user)", "type": "string"},
        ],
        "verified": False,
        "comingSoon": True,
        "comingSoonMessage": "Slack integration coming soon",
        "riskLevel": "low",
    },
    {
        "id": "notify.email",
        "name": "Send Email",
        "description": "Send an email notification",
        "category": "notification",
        "icon": "📧",
        "endpoint": "/api/actions/notify/email",
        "method": "POST",
        "parameters": [
            {"id": "to", "name": "Recipients", "type": "string", "required": True},
            {"id": "subject", "name": "Subject", "type": "string", "required": True},
            {"id": "body", "name": "Body", "type": "text", "required": True},
        ],
        "verified": False,
        "comingSoon": True,
        "comingSoonMessage": "Email notifications coming soon",
        "riskLevel": "low",
    },
    {
        "id": "notify.webex",
        "name": "Send Webex Message",
        "description": "Post a message to Webex Teams",
        "category": "notification",
        "icon": "🌐",
        "endpoint": "/api/actions/notify/webex",
        "method": "POST",
        "parameters": [
            {"id": "roomId", "name": "Room/Space ID", "type": "string", "required": True},
            {"id": "message", "name": "Message", "type": "text", "required": True},
        ],
        "verified": False,
        "comingSoon": True,
        "comingSoonMessage": "Webex integration coming soon",
        "riskLevel": "low",
    },
    # ===== AI/CUSTOM ACTIONS =====
    {
        "id": "ai.analyze",
        "name": "AI Analysis",
        "description": "Use AI to analyze data and recommend actions",
        "category": "custom",
        "icon": "🤖",
        "endpoint": "/api/actions/ai/analyze",
        "method": "POST",
        "parameters": [
            {"id": "prompt", "name": "Analysis Prompt", "type": "text", "required": True},
            {"id": "context", "name": "Include Context", "type": "boolean", "default": True},
        ],
        "verified": True,
        "riskLevel": "low",
    },
    {
        "id": "custom.webhook",
        "name": "Call Custom Webhook",
        "description": "Send data to any HTTP endpoint",
        "category": "custom",
        "icon": "🔗",
        "endpoint": "/api/actions/webhook",
        "method": "POST",
        "parameters": [
            {"id": "url", "name": "Webhook URL", "type": "string", "required": True},
            {"id": "method", "name": "HTTP Method", "type": "select", "options": ["GET", "POST", "PUT"]},
            {"id": "headers", "name": "Headers (JSON)", "type": "text"},
            {"id": "body", "name": "Body (JSON)", "type": "text"},
        ],
        "verified": True,
        "riskLevel": "medium",
    },
]


@router.get("/api/actions/available")
async def get_available_actions(
    category: Optional[str] = Query(None, description="Filter by category"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    verified_only: bool = Query(False, description="Only show verified actions"),
):
    """Get list of all available actions for workflows.

    Returns:
        List of action definitions with parameters
    """
    actions = ACTION_REGISTRY.copy()

    # Apply filters
    if category:
        actions = [a for a in actions if a.get("category") == category]
    if platform:
        actions = [a for a in actions if a.get("platform") == platform]
    if verified_only:
        actions = [a for a in actions if a.get("verified", False)]

    return {
        "actions": actions,
        "total": len(actions),
        "categories": list(set(a.get("category") for a in ACTION_REGISTRY)),
        "platforms": list(set(a.get("platform") for a in ACTION_REGISTRY if a.get("platform"))),
    }


@router.post("/api/workflows/validate")
async def validate_workflow(
    request: WorkflowCreateRequest,
    _: None = Depends(require_permission("workflows.create")),
):
    """Validate a workflow configuration without saving.

    Args:
        request: The workflow configuration to validate

    Returns:
        Validation result with errors if any
    """
    errors = []
    warnings = []

    # 0. Validate workflow mode
    valid_modes = ["cards", "cli", "python"]
    if request.mode not in valid_modes:
        errors.append(f"Invalid mode: {request.mode}. Must be one of: {valid_modes}")

    # 1. Validate trigger type
    valid_triggers = ["splunk_query", "schedule", "manual"]
    if request.trigger_type not in valid_triggers:
        errors.append(f"Invalid trigger_type: {request.trigger_type}. Must be one of: {valid_triggers}")

    # 2. Validate splunk query if trigger is splunk_query
    if request.trigger_type == "splunk_query":
        if not request.splunk_query:
            errors.append("splunk_query is required when trigger_type is 'splunk_query'")
        elif len(request.splunk_query) < 5:
            errors.append("splunk_query appears to be too short")

    # 3. Validate schedule if trigger is schedule
    if request.trigger_type == "schedule":
        if not request.schedule_cron:
            errors.append("schedule_cron is required when trigger_type is 'schedule'")

    # 4. Validate actions
    if request.actions:
        action_ids = [a.get("id") for a in ACTION_REGISTRY]
        for i, action in enumerate(request.actions):
            tool = action.tool
            # Check if action exists in registry
            matching_action = next((a for a in ACTION_REGISTRY if a["id"] == tool), None)
            if not matching_action:
                warnings.append(f"Action '{tool}' not found in action registry - may be a custom action")
            elif not matching_action.get("verified", False):
                warnings.append(f"Action '{tool}' is not verified - backend may not be fully implemented")

    # 5. Validate AI settings
    if request.ai_enabled:
        if not request.ai_prompt:
            warnings.append("ai_prompt is recommended when ai_enabled is True")
        if request.ai_confidence_threshold < 0 or request.ai_confidence_threshold > 1:
            errors.append("ai_confidence_threshold must be between 0 and 1")

    # 6. Validate conditions
    if request.conditions:
        valid_operators = ["equals", "==", "not_equals", "!=", ">", "<", ">=", "<=",
                          "contains", "not_contains", "starts_with", "ends_with", "matches", "in", "not_in"]
        for i, condition in enumerate(request.conditions):
            if condition.operator not in valid_operators:
                errors.append(f"Condition {i+1}: Invalid operator '{condition.operator}'")

    # 7. Mode-specific validation
    if request.mode == "cli":
        if not request.cli_code:
            errors.append("cli_code is required when mode is 'cli'")
        else:
            # Validate CLI syntax
            try:
                from src.services.cli_workflow_executor import CLIParser
                parser = CLIParser()
                parser.parse(request.cli_code)
            except Exception as e:
                errors.append(f"CLI syntax error: {str(e)}")

    elif request.mode == "python":
        if not request.python_code:
            errors.append("python_code is required when mode is 'python'")
        else:
            # Validate Python code
            try:
                from src.services.python_workflow_executor import PythonCodeValidator
                validator = PythonCodeValidator()
                is_python_valid, python_errors = validator.validate(request.python_code)
                if not is_python_valid:
                    for err in python_errors:
                        errors.append(f"Python validation: {err}")
            except Exception as e:
                errors.append(f"Python validation error: {str(e)}")

    elif request.mode == "cards":
        # Cards mode should have either flow_data or actions
        if not request.flow_data and not request.actions:
            warnings.append("Cards mode workflow has no flow_data or actions defined")

    is_valid = len(errors) == 0

    return {
        "valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "summary": f"Validation {'passed' if is_valid else 'failed'} with {len(errors)} errors and {len(warnings)} warnings",
    }


class WorkflowImportRequest(BaseModel):
    """Request body for importing a workflow."""
    workflow_data: Dict[str, Any]
    overwrite_existing: bool = False


@router.post("/api/workflows/import")
async def import_workflow(
    request: WorkflowImportRequest,
    _: None = Depends(require_permission("workflows.create")),
):
    """Import a workflow from JSON export.

    Args:
        request: The workflow data to import

    Returns:
        Created workflow
    """
    try:
        workflow_data = request.workflow_data

        # Validate required fields
        required_fields = ["name", "trigger_type"]
        missing = [f for f in required_fields if f not in workflow_data]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required fields: {missing}"
            )

        # Create workflow request from imported data
        import_request = WorkflowCreateRequest(
            name=workflow_data.get("name"),
            description=workflow_data.get("description"),
            trigger_type=workflow_data.get("trigger_type"),
            splunk_query=workflow_data.get("splunk_query"),
            schedule_cron=workflow_data.get("schedule_cron"),
            poll_interval_seconds=workflow_data.get("poll_interval_seconds", 300),
            conditions=[ConditionSchema(**c) for c in workflow_data.get("conditions", [])],
            actions=[ActionSchema(**a) for a in workflow_data.get("actions", [])],
            ai_enabled=workflow_data.get("ai_enabled", True),
            ai_prompt=workflow_data.get("ai_prompt"),
            ai_confidence_threshold=workflow_data.get("ai_confidence_threshold", 0.7),
            auto_execute_enabled=workflow_data.get("auto_execute_enabled", False),
            auto_execute_min_confidence=workflow_data.get("auto_execute_min_confidence", 0.9),
            auto_execute_max_risk=workflow_data.get("auto_execute_max_risk", "low"),
            organization=workflow_data.get("organization"),
            tags=workflow_data.get("tags", []),
            mode=workflow_data.get("mode", "cards"),
            cli_code=workflow_data.get("cli_code"),
            python_code=workflow_data.get("python_code"),
        )

        # Create the workflow using existing endpoint logic
        async with db.session() as session:
            service = get_workflow_service(session)

            # Check for duplicate name if not overwriting
            if not request.overwrite_existing:
                existing = await service.get_workflows()
                if any(w.name == import_request.name for w in existing):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Workflow with name '{import_request.name}' already exists. Use overwrite_existing=true to replace."
                    )

            # Create the workflow
            workflow = await service.create_workflow(
                name=import_request.name,
                description=import_request.description,
                trigger_type=import_request.trigger_type,
                splunk_query=import_request.splunk_query,
                schedule_cron=import_request.schedule_cron,
                poll_interval_seconds=import_request.poll_interval_seconds,
                conditions=[c.model_dump() for c in (import_request.conditions or [])],
                actions=[a.model_dump() for a in (import_request.actions or [])],
                ai_enabled=import_request.ai_enabled,
                ai_prompt=import_request.ai_prompt,
                ai_confidence_threshold=import_request.ai_confidence_threshold,
                auto_execute_enabled=import_request.auto_execute_enabled,
                auto_execute_min_confidence=import_request.auto_execute_min_confidence,
                auto_execute_max_risk=import_request.auto_execute_max_risk,
                organization=import_request.organization,
                tags=import_request.tags,
                mode=import_request.mode,
                cli_code=import_request.cli_code,
                python_code=import_request.python_code,
            )

            return {
                "success": True,
                "message": "Workflow imported successfully",
                "workflow": {
                    "id": workflow.id,
                    "name": workflow.name,
                    "status": workflow.status.value if hasattr(workflow.status, 'value') else workflow.status,
                },
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.get("/api/workflows/outcomes/analytics")
async def get_outcome_analytics(
    days: int = Query(30, description="Number of days to analyze"),
    workflow_id: Optional[int] = Query(None, description="Filter by workflow ID"),
    _: None = Depends(require_permission("workflows.view")),
):
    """Get analytics on workflow execution outcomes.

    Provides metrics for learning and improvement:
    - Outcome distribution (resolved, partial, failed)
    - Average resolution time
    - Common root causes
    - Trend over time

    Args:
        days: Number of days to analyze (default 30)
        workflow_id: Optional workflow ID to filter

    Returns:
        Outcome analytics data
    """
    try:
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)

        async with db.session() as session:
            # Build the base query with optional workflow filter
            workflow_filter = ""
            params = {"cutoff": cutoff}
            if workflow_id:
                workflow_filter = "AND we.workflow_id = :workflow_id"
                params["workflow_id"] = workflow_id

            # Outcome distribution
            result = await session.execute(
                text(f"""SELECT
                    wo.outcome,
                    COUNT(*) as count,
                    AVG(wo.resolution_time_minutes) as avg_resolution_time
                FROM workflow_outcomes wo
                JOIN workflow_executions we ON wo.execution_id = we.id
                WHERE wo.created_at > :cutoff
                {workflow_filter}
                GROUP BY wo.outcome"""),
                params
            )
            outcome_rows = result.fetchall()

            outcome_distribution = {
                row.outcome: {
                    "count": row.count,
                    "avg_resolution_time_minutes": float(row.avg_resolution_time) if row.avg_resolution_time else None
                }
                for row in outcome_rows
            }

            # Total outcomes
            total_outcomes = sum(d["count"] for d in outcome_distribution.values())

            # Calculate percentages
            for outcome, data in outcome_distribution.items():
                data["percentage"] = (data["count"] / total_outcomes * 100) if total_outcomes > 0 else 0

            # Resolution rate (resolved / total)
            resolved_count = outcome_distribution.get("resolved", {}).get("count", 0)
            partial_count = outcome_distribution.get("partial", {}).get("count", 0)
            resolution_rate = ((resolved_count + partial_count * 0.5) / total_outcomes * 100) if total_outcomes > 0 else 0

            # Common root causes
            result = await session.execute(
                text(f"""SELECT
                    wo.root_cause,
                    COUNT(*) as count
                FROM workflow_outcomes wo
                JOIN workflow_executions we ON wo.execution_id = we.id
                WHERE wo.created_at > :cutoff
                AND wo.root_cause IS NOT NULL AND wo.root_cause != ''
                {workflow_filter}
                GROUP BY wo.root_cause
                ORDER BY count DESC
                LIMIT 10"""),
                params
            )
            root_cause_rows = result.fetchall()
            common_root_causes = [
                {"cause": row.root_cause, "count": row.count}
                for row in root_cause_rows
            ]

            # Trend over time (by day)
            result = await session.execute(
                text(f"""SELECT
                    DATE(wo.created_at) as date,
                    wo.outcome,
                    COUNT(*) as count
                FROM workflow_outcomes wo
                JOIN workflow_executions we ON wo.execution_id = we.id
                WHERE wo.created_at > :cutoff
                {workflow_filter}
                GROUP BY DATE(wo.created_at), wo.outcome
                ORDER BY date"""),
                params
            )
            trend_rows = result.fetchall()

            # Group by date
            trend_by_date = {}
            for row in trend_rows:
                date_str = str(row.date) if row.date else "unknown"
                if date_str not in trend_by_date:
                    trend_by_date[date_str] = {"resolved": 0, "partial": 0, "failed": 0, "unknown": 0}
                trend_by_date[date_str][row.outcome] = row.count

            # Convert to list
            trend = [
                {"date": date, **outcomes}
                for date, outcomes in sorted(trend_by_date.items())
            ]

            # Most affected workflows (if not filtering by specific workflow)
            most_affected = []
            if not workflow_id:
                result = await session.execute(
                    text(f"""SELECT
                        w.id,
                        w.name,
                        COUNT(*) as execution_count,
                        SUM(CASE WHEN wo.outcome = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
                        SUM(CASE WHEN wo.outcome = 'failed' THEN 1 ELSE 0 END) as failed_count
                    FROM workflow_outcomes wo
                    JOIN workflow_executions we ON wo.execution_id = we.id
                    JOIN workflows w ON we.workflow_id = w.id
                    WHERE wo.created_at > :cutoff
                    GROUP BY w.id, w.name
                    ORDER BY execution_count DESC
                    LIMIT 10"""),
                    params
                )
                affected_rows = result.fetchall()
                most_affected = [
                    {
                        "workflow_id": row.id,
                        "workflow_name": row.name,
                        "execution_count": row.execution_count,
                        "resolved_count": row.resolved_count,
                        "failed_count": row.failed_count,
                        "success_rate": (row.resolved_count / row.execution_count * 100) if row.execution_count > 0 else 0
                    }
                    for row in affected_rows
                ]

            return {
                "period_days": days,
                "total_outcomes": total_outcomes,
                "resolution_rate_percent": round(resolution_rate, 1),
                "outcome_distribution": outcome_distribution,
                "common_root_causes": common_root_causes,
                "trend": trend,
                "most_affected_workflows": most_affected,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CLI and Python Validation Endpoints
# ============================================================================

class CLIValidationRequest(BaseModel):
    """Request body for validating CLI code."""
    cli_code: str = Field(..., min_length=1, description="CLI code to validate")


class PythonValidationRequest(BaseModel):
    """Request body for validating Python code."""
    python_code: str = Field(..., min_length=1, description="Python code to validate")


class ValidationResponse(BaseModel):
    """Response model for code validation."""
    valid: bool
    errors: List[Dict[str, Any]] = []
    warnings: List[str] = []
    parsed_commands: Optional[int] = None  # For CLI
    has_main_function: Optional[bool] = None  # For Python


@router.post("/api/workflows/validate/cli", response_model=ValidationResponse)
async def validate_cli_code(
    request: CLIValidationRequest,
    _: None = Depends(require_permission("workflows.create")),
):
    """Validate CLI workflow code.

    Parses the CLI code and checks for:
    - Syntax errors
    - Unknown commands
    - Invalid parameters
    - Control flow issues

    Args:
        request: CLI code to validate

    Returns:
        Validation result with errors if any
    """
    try:
        from src.services.cli_workflow_executor import CLIParser

        parser = CLIParser()
        errors = []
        warnings = []

        try:
            parsed = parser.parse(request.cli_code)
            command_count = len(parsed)

            # Check for empty workflow
            if command_count == 0:
                warnings.append("Workflow has no commands to execute")

            return {
                "valid": True,
                "errors": [],
                "warnings": warnings,
                "parsed_commands": command_count,
            }

        except Exception as parse_error:
            # Extract line number from error if available
            error_str = str(parse_error)
            error_detail = {
                "message": error_str,
                "line": None,
                "column": None,
            }

            # Try to extract line number from error message
            import re
            line_match = re.search(r'line (\d+)', error_str, re.IGNORECASE)
            if line_match:
                error_detail["line"] = int(line_match.group(1))

            errors.append(error_detail)

            return {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
                "parsed_commands": 0,
            }

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="CLI parser not available"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/workflows/validate/python", response_model=ValidationResponse)
async def validate_python_code(
    request: PythonValidationRequest,
    _: None = Depends(require_permission("workflows.create")),
):
    """Validate Python workflow code.

    Checks for:
    - Syntax errors
    - Forbidden imports (security)
    - Forbidden builtins (security)
    - Required async function pattern

    Args:
        request: Python code to validate

    Returns:
        Validation result with errors if any
    """
    try:
        from src.services.python_workflow_executor import PythonCodeValidator

        validator = PythonCodeValidator()
        errors = []
        warnings = []

        # Run validation
        is_valid, validation_errors = validator.validate(request.python_code)

        if not is_valid:
            for error in validation_errors:
                error_detail = {
                    "message": error,
                    "line": None,
                    "column": None,
                }

                # Try to extract line number from error message
                import re
                line_match = re.search(r'line (\d+)', error, re.IGNORECASE)
                if line_match:
                    error_detail["line"] = int(line_match.group(1))

                errors.append(error_detail)

        # Check for async def workflow pattern
        has_main_function = "async def workflow" in request.python_code or "def workflow" in request.python_code

        if not has_main_function:
            warnings.append("Code should define an 'async def workflow(context):' function as entry point")

        # Check for await usage with SDK calls
        if "await " not in request.python_code and any(
            sdk in request.python_code for sdk in ["meraki.", "splunk.", "thousandeyes.", "notify."]
        ):
            warnings.append("SDK calls should use 'await' for async operations")

        return {
            "valid": is_valid,
            "errors": errors,
            "warnings": warnings,
            "has_main_function": has_main_function,
        }

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Python validator not available"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
