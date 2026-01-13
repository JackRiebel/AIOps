"""A2A Protocol HTTP Routes.

Implements the Agent-to-Agent (A2A) Protocol v0.3 endpoints:
- Agent discovery via /.well-known/agent.json
- Task lifecycle management
- Message sending (sync and streaming)

Based on: https://a2a-protocol.org/latest/specification/
"""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from src.api.dependencies import require_viewer, get_optional_user
from src.models.user import User
from src.a2a.types import (
    TaskState,
    AgentCard,
    AgentProvider,
    AgentCapabilities,
    AgentSkill,
    AgentInterface,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class MessagePart(BaseModel):
    """A part of an A2A message."""
    type: str = Field(..., description="Part type: text, file, or data")
    text: Optional[str] = None
    file: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None


class SendMessageRequest(BaseModel):
    """Request to send a message to agents."""
    message: Dict[str, Any] = Field(..., description="Message with role and parts")
    taskId: Optional[str] = Field(None, description="Existing task ID to continue")
    contextId: Optional[str] = Field(None, description="Context/session ID")
    agentId: Optional[str] = Field(None, description="Target specific agent")


class TaskResponse(BaseModel):
    """Response containing task information."""
    id: str
    contextId: Optional[str] = None
    status: Dict[str, Any]
    history: List[Dict[str, Any]] = []
    artifacts: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}
    handledBy: List[str] = []


class TaskListResponse(BaseModel):
    """Response for listing tasks."""
    tasks: List[TaskResponse]
    total: int
    page: int
    pageSize: int


# =============================================================================
# Agent Discovery Endpoints
# =============================================================================

def _build_aggregate_agent_card(include_extended: bool = False) -> Dict[str, Any]:
    """Build the aggregate agent card for this A2A server.

    Combines capabilities from all registered specialist agents.
    """
    try:
        from src.a2a.registry import get_agent_registry
        registry = get_agent_registry()
        agents = registry.get_all_agents()
    except Exception as e:
        logger.warning(f"Could not load agent registry: {e}")
        agents = []

    # Aggregate all skills from all agents
    all_skills = []
    for agent in agents:
        for skill in agent.skills:
            all_skills.append({
                "id": f"{agent.id}.{skill.id}",
                "name": skill.name,
                "description": skill.description,
                "tags": skill.tags,
                "examples": skill.examples[:3] if skill.examples else [],
                "agentId": agent.id,
            })

    # Build the aggregate card
    card = {
        "id": "lumen-a2a",
        "name": "Lumen A2A Server",
        "description": "Enterprise network management AI agents with Meraki, Catalyst, ThousandEyes, and Splunk integrations",
        "protocolVersion": "0.3",
        "provider": {
            "organization": "Lumen",
            "url": "https://github.com/lumen",
        },
        "capabilities": {
            "streaming": True,
            "pushNotifications": True,
            "stateTransitionHistory": True,
        },
        "skills": all_skills[:100],  # Limit for public card
        "skillCount": len(all_skills),
        "interfaces": [
            {
                "protocol": "jsonrpc/2.0",
                "url": "/api/a2a/message",
            },
            {
                "protocol": "sse",
                "url": "/api/a2a/message/stream",
            },
        ],
        "supportedMethods": [
            "message/send",
            "message/stream",
            "tasks/get",
            "tasks/list",
            "tasks/cancel",
        ],
    }

    # Extended card includes additional info for authenticated clients
    if include_extended:
        card["agents"] = [
            {
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "role": agent.role,
                "priority": agent.priority,
                "skillCount": len(agent.skills),
            }
            for agent in agents
        ]
        card["skills"] = all_skills  # Full skill list for authenticated clients

    return card


@router.get("/.well-known/agent.json")
async def get_agent_card(
    auth: bool = Query(False, description="Include extended agent card (requires auth)"),
    user: Optional[User] = Depends(get_optional_user),
):
    """Get the A2A Agent Card for discovery.

    Standard A2A discovery endpoint. Returns the aggregate agent card
    describing all capabilities of this A2A server.

    - Without auth param: Returns public agent card with limited skills
    - With auth=true: Returns extended card with all skills (requires authentication)
    """
    include_extended = auth and user is not None

    if auth and user is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required for extended agent card",
        )

    card = _build_aggregate_agent_card(include_extended=include_extended)

    return JSONResponse(
        content=card,
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
        },
    )


# =============================================================================
# Message Endpoints
# =============================================================================

@router.post("/api/a2a/message", response_model=TaskResponse)
async def send_message(
    request: SendMessageRequest,
    user: User = Depends(require_viewer),
):
    """Send a message to the A2A agent system.

    This is the primary endpoint for interacting with agents. Messages are
    routed to appropriate specialist agents based on content analysis.

    Returns a task object with the agent's response.
    """
    try:
        from src.a2a.orchestrator import get_orchestrator, OrchestratorRequest
        from src.a2a.types import A2AMessage, TextPart

        orchestrator = get_orchestrator()

        # Extract text from message parts
        text_content = ""
        for part in request.message.get("parts", []):
            if part.get("type") == "text":
                text_content += part.get("text", "") + " "

        text_content = text_content.strip()
        if not text_content:
            raise HTTPException(status_code=400, detail="Message must contain text content")

        # Build orchestrator request
        orch_request = OrchestratorRequest(
            query=text_content,
            context_id=request.contextId,
            target_agent_id=request.agentId,
        )

        # Process through orchestrator
        result = await orchestrator.process(orch_request)

        # Convert to task response
        task_response = TaskResponse(
            id=result.task_id,
            contextId=request.contextId,
            status={
                "state": result.state.value,
                "timestamp": datetime.utcnow().isoformat(),
                "message": None,
            },
            history=[
                {"role": "user", "parts": request.message.get("parts", [])},
                {"role": "agent", "parts": [{"type": "text", "text": result.response}]},
            ],
            artifacts=result.artifacts if hasattr(result, "artifacts") else [],
            metadata={
                "tokens": result.tokens if hasattr(result, "tokens") else None,
                "cost": result.cost if hasattr(result, "cost") else None,
                "model": result.model if hasattr(result, "model") else None,
            },
            handledBy=result.agents_used if hasattr(result, "agents_used") else [],
        )

        logger.info(f"[A2A] Message processed: task={result.task_id}, agents={task_response.handledBy}")
        return task_response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error processing message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/a2a/message/stream")
async def send_message_streaming(
    request: SendMessageRequest,
    user: User = Depends(require_viewer),
):
    """Send a message with streaming response via SSE.

    Returns a Server-Sent Events stream with incremental updates
    as the agents process the request.
    """
    try:
        from src.a2a.enhanced_orchestrator import get_enhanced_orchestrator

        orchestrator = get_enhanced_orchestrator()

        # Extract text content
        text_content = ""
        for part in request.message.get("parts", []):
            if part.get("type") == "text":
                text_content += part.get("text", "") + " "

        text_content = text_content.strip()
        if not text_content:
            raise HTTPException(status_code=400, detail="Message must contain text content")

        async def generate_sse():
            """Generate SSE events from orchestrator stream."""
            try:
                async for event in orchestrator.process_streaming(
                    query=text_content,
                    context_id=request.contextId,
                    target_agent_id=request.agentId,
                ):
                    import json
                    yield f"data: {json.dumps(event)}\n\n"

                yield "data: [DONE]\n\n"

            except Exception as e:
                import json
                error_event = {
                    "type": "error",
                    "error": str(e),
                }
                yield f"data: {json.dumps(error_event)}\n\n"

        return StreamingResponse(
            generate_sse(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error in streaming message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Task Management Endpoints
# =============================================================================

@router.get("/api/a2a/task/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    user: User = Depends(require_viewer),
):
    """Get the status and details of a specific task.

    Returns the full task object including history and artifacts.
    """
    try:
        from src.a2a.task_manager import get_task_manager

        task_manager = get_task_manager()
        task = await task_manager.get_task(task_id)

        if task is None:
            raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")

        return TaskResponse(
            id=task.id,
            contextId=task.contextId,
            status=task.status.to_dict(),
            history=[msg.to_dict() for msg in task.history],
            artifacts=task.artifacts,
            metadata=task.metadata,
            handledBy=task.handledBy,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error getting task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/a2a/tasks", response_model=TaskListResponse)
async def list_tasks(
    page: int = Query(1, ge=1, description="Page number"),
    pageSize: int = Query(20, ge=1, le=100, description="Items per page"),
    state: Optional[str] = Query(None, description="Filter by task state"),
    contextId: Optional[str] = Query(None, description="Filter by context ID"),
    user: User = Depends(require_viewer),
):
    """List tasks with optional filtering and pagination.

    Supports filtering by state and context ID.
    """
    try:
        from src.a2a.task_manager import get_task_manager

        task_manager = get_task_manager()

        # Parse state filter
        state_filter = None
        if state:
            try:
                state_filter = TaskState(state)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid state: {state}")

        tasks, total = await task_manager.list_tasks(
            page=page,
            page_size=pageSize,
            state=state_filter,
            context_id=contextId,
        )

        return TaskListResponse(
            tasks=[
                TaskResponse(
                    id=task.id,
                    contextId=task.contextId,
                    status=task.status.to_dict(),
                    history=[msg.to_dict() for msg in task.history],
                    artifacts=task.artifacts,
                    metadata=task.metadata,
                    handledBy=task.handledBy,
                )
                for task in tasks
            ],
            total=total,
            page=page,
            pageSize=pageSize,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error listing tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/a2a/task/{task_id}")
async def cancel_task(
    task_id: str,
    user: User = Depends(require_viewer),
):
    """Cancel a running task.

    Only active tasks can be canceled. Terminal tasks cannot be canceled.
    """
    try:
        from src.a2a.task_manager import get_task_manager

        task_manager = get_task_manager()
        success = await task_manager.cancel_task(task_id)

        if not success:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel task {task_id}: not found or already terminal",
            )

        return {"success": True, "taskId": task_id, "state": TaskState.CANCELED.value}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error canceling task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Subscribe Endpoint (SSE for task updates)
# =============================================================================

@router.get("/api/a2a/task/{task_id}/subscribe")
async def subscribe_to_task(
    task_id: str,
    user: User = Depends(require_viewer),
):
    """Subscribe to task updates via Server-Sent Events.

    Receives real-time updates as the task state changes.
    Connection closes when task reaches a terminal state.
    """
    try:
        from src.a2a.task_manager import get_task_manager

        task_manager = get_task_manager()

        async def generate_updates():
            """Generate SSE events for task updates."""
            import json
            import asyncio

            # Check if task exists
            task = await task_manager.get_task(task_id)
            if task is None:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Task not found'})}\n\n"
                return

            # Send initial state
            yield f"data: {json.dumps({'type': 'status', 'status': task.status.to_dict()})}\n\n"

            # Poll for updates until terminal state
            last_state = task.status.state
            while not last_state.is_terminal():
                await asyncio.sleep(0.5)  # Poll interval

                task = await task_manager.get_task(task_id)
                if task is None:
                    break

                if task.status.state != last_state:
                    last_state = task.status.state
                    yield f"data: {json.dumps({'type': 'status', 'status': task.status.to_dict()})}\n\n"

                    # Send artifacts if available
                    if task.artifacts:
                        yield f"data: {json.dumps({'type': 'artifacts', 'artifacts': task.artifacts})}\n\n"

            # Final state
            if task:
                yield f"data: {json.dumps({'type': 'complete', 'task': task.to_dict()})}\n\n"

            yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_updates(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        logger.error(f"[A2A] Error subscribing to task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Federation Endpoints
# =============================================================================

class FederationRegisterRequest(BaseModel):
    """Request to register an external agent."""
    url: str = Field(..., description="URL of the external agent")
    trust_level: Optional[str] = Field(None, description="Trust level: untrusted, verified, trusted")
    priority: int = Field(0, description="Routing priority (higher = preferred)")
    tags: Optional[List[str]] = Field(None, description="Optional tags")


class FederationAgentResponse(BaseModel):
    """Response with federated agent info."""
    url: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    trust_level: str
    enabled: bool
    is_healthy: bool
    skill_count: int = 0


class FederationStatusResponse(BaseModel):
    """Response with federation status."""
    total_agents: int
    healthy_agents: int
    enabled_agents: int
    agents: List[FederationAgentResponse]


@router.get("/api/a2a/federation/status", response_model=FederationStatusResponse)
async def get_federation_status(
    user: User = Depends(require_viewer),
):
    """Get status of the A2A federation.

    Returns information about all federated external agents.
    """
    try:
        from src.a2a.federation import get_federation_registry

        registry = get_federation_registry()
        stats = registry.get_statistics()
        agents = registry.get_all_agents()

        return FederationStatusResponse(
            total_agents=stats["total_agents"],
            healthy_agents=stats["healthy_agents"],
            enabled_agents=stats["enabled_agents"],
            agents=[
                FederationAgentResponse(
                    url=agent.url,
                    agent_id=agent.agent_card.id if agent.agent_card else None,
                    agent_name=agent.agent_card.name if agent.agent_card else None,
                    trust_level=agent.trust_level.value,
                    enabled=agent.enabled,
                    is_healthy=agent.is_healthy,
                    skill_count=len(agent.agent_card.skills) if agent.agent_card else 0,
                )
                for agent in agents
            ],
        )

    except Exception as e:
        logger.error(f"[A2A] Error getting federation status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/a2a/federation/register", response_model=FederationAgentResponse)
async def register_federated_agent(
    request: FederationRegisterRequest,
    user: User = Depends(require_viewer),
):
    """Register an external agent with the federation.

    Discovers the agent and adds it to the federation registry.
    """
    try:
        from src.a2a.federation import get_federation_registry, TrustLevel

        registry = get_federation_registry()

        # Parse trust level
        trust_level = None
        if request.trust_level:
            try:
                trust_level = TrustLevel(request.trust_level)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid trust level: {request.trust_level}. "
                          f"Valid values: untrusted, verified, trusted",
                )

        # Register agent
        agent = await registry.register(
            url=request.url,
            trust_level=trust_level,
            priority=request.priority,
            tags=request.tags,
        )

        if agent is None:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to register agent at {request.url}. "
                      "Check that the URL is accessible and serves an A2A agent card.",
            )

        return FederationAgentResponse(
            url=agent.url,
            agent_id=agent.agent_card.id if agent.agent_card else None,
            agent_name=agent.agent_card.name if agent.agent_card else None,
            trust_level=agent.trust_level.value,
            enabled=agent.enabled,
            is_healthy=agent.is_healthy,
            skill_count=len(agent.agent_card.skills) if agent.agent_card else 0,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error registering federated agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/a2a/federation/agent")
async def unregister_federated_agent(
    url: str = Query(..., description="URL of the agent to unregister"),
    user: User = Depends(require_viewer),
):
    """Unregister an external agent from the federation."""
    try:
        from src.a2a.federation import get_federation_registry

        registry = get_federation_registry()
        success = await registry.unregister(url)

        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Agent not found: {url}",
            )

        return {"success": True, "url": url}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error unregistering agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/a2a/federation/discover")
async def discover_external_agent(
    url: str = Query(..., description="URL of the agent to discover"),
    user: User = Depends(require_viewer),
):
    """Discover an external agent without registering it.

    Fetches the agent card and returns agent information.
    """
    try:
        from src.a2a.external_client import get_external_client

        client = get_external_client()
        agent_card = await client.discover(url)

        if agent_card is None:
            raise HTTPException(
                status_code=400,
                detail=f"Could not discover agent at {url}",
            )

        return {
            "success": True,
            "agent": agent_card.to_dict(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error discovering agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/a2a/federation/route")
async def route_to_federated_agent(
    query: str = Query(..., description="Query to route"),
    agent_url: Optional[str] = Query(None, description="Specific agent URL to route to"),
    context_id: Optional[str] = Query(None, description="Context/session ID"),
    user: User = Depends(require_viewer),
):
    """Route a query to federated external agents.

    Uses the gateway agent to find and query the best matching external agent.
    """
    try:
        from src.a2a.specialists.gateway_agent import get_gateway_agent

        gateway = get_gateway_agent()
        result = await gateway.route(
            query=query,
            context_id=context_id,
            prefer_agent_url=agent_url,
        )

        return result.to_dict()

    except Exception as e:
        logger.error(f"[A2A] Error routing to federation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Push Notification Endpoints
# =============================================================================

class PushNotificationConfigRequest(BaseModel):
    """Request to create a push notification configuration."""
    url: str = Field(..., description="Webhook URL to receive notifications")
    events: List[str] = Field(
        default=["*"],
        description="Event types to subscribe to (e.g., task.completed, task.failed)",
    )
    taskId: Optional[str] = Field(None, description="Specific task ID to subscribe to")
    headers: Optional[Dict[str, str]] = Field(None, description="Custom headers for webhook requests")
    secret: Optional[str] = Field(None, description="HMAC secret for signature verification")
    expiresInHours: Optional[int] = Field(None, description="Hours until subscription expires")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class PushNotificationConfigResponse(BaseModel):
    """Response with push notification configuration."""
    id: str
    taskId: Optional[str]
    url: str
    events: List[str]
    hasSecret: bool
    enabled: bool
    createdAt: str
    expiresAt: Optional[str]
    metadata: Dict[str, Any] = {}


class PushNotificationConfigListResponse(BaseModel):
    """Response listing push notification configurations."""
    configs: List[PushNotificationConfigResponse]
    total: int


class PushNotificationStatsResponse(BaseModel):
    """Response with push notification service statistics."""
    running: bool
    workerCount: int
    configCount: int
    queuePending: int
    queueDeadLetter: int
    notificationsSent: int
    notificationsDelivered: int
    notificationsFailed: int
    notificationsRetried: int


@router.post("/api/a2a/push-notifications/config", response_model=PushNotificationConfigResponse)
async def create_push_notification_config(
    request: PushNotificationConfigRequest,
    user: User = Depends(require_viewer),
):
    """Create a push notification subscription.

    Sets up a webhook to receive notifications about A2A events.
    Supports filtering by event type and task ID.

    Event types:
    - task.created: When a new task is created
    - task.status_change: When task status changes
    - task.completed: When a task completes successfully
    - task.failed: When a task fails
    - task.canceled: When a task is canceled
    - artifact.ready: When an artifact is available
    - message.received: When a message is received
    - agent.response: When an agent responds
    - error: When an error occurs
    - * : All events
    """
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        config = await service.create_config(
            url=request.url,
            events=request.events,
            task_id=request.taskId,
            headers=request.headers,
            secret=request.secret,
            expires_in_hours=request.expiresInHours,
            metadata=request.metadata,
        )

        return PushNotificationConfigResponse(
            id=config.id,
            taskId=config.task_id,
            url=config.url,
            events=config.events,
            hasSecret=config.secret is not None,
            enabled=config.enabled,
            createdAt=config.created_at.isoformat(),
            expiresAt=config.expires_at.isoformat() if config.expires_at else None,
            metadata=config.metadata,
        )

    except Exception as e:
        logger.error(f"[A2A] Error creating push notification config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/a2a/push-notifications/config/{config_id}", response_model=PushNotificationConfigResponse)
async def get_push_notification_config(
    config_id: str,
    user: User = Depends(require_viewer),
):
    """Get a specific push notification configuration."""
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        config = await service.get_config(config_id)

        if config is None:
            raise HTTPException(status_code=404, detail=f"Config not found: {config_id}")

        return PushNotificationConfigResponse(
            id=config.id,
            taskId=config.task_id,
            url=config.url,
            events=config.events,
            hasSecret=config.secret is not None,
            enabled=config.enabled,
            createdAt=config.created_at.isoformat(),
            expiresAt=config.expires_at.isoformat() if config.expires_at else None,
            metadata=config.metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error getting push notification config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/a2a/push-notifications/configs", response_model=PushNotificationConfigListResponse)
async def list_push_notification_configs(
    taskId: Optional[str] = Query(None, description="Filter by task ID"),
    includeExpired: bool = Query(False, description="Include expired configs"),
    user: User = Depends(require_viewer),
):
    """List push notification configurations."""
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        configs = await service.list_configs(
            task_id=taskId,
            include_expired=includeExpired,
        )

        return PushNotificationConfigListResponse(
            configs=[
                PushNotificationConfigResponse(
                    id=config.id,
                    taskId=config.task_id,
                    url=config.url,
                    events=config.events,
                    hasSecret=config.secret is not None,
                    enabled=config.enabled,
                    createdAt=config.created_at.isoformat(),
                    expiresAt=config.expires_at.isoformat() if config.expires_at else None,
                    metadata=config.metadata,
                )
                for config in configs
            ],
            total=len(configs),
        )

    except Exception as e:
        logger.error(f"[A2A] Error listing push notification configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class PushNotificationConfigUpdateRequest(BaseModel):
    """Request to update a push notification configuration."""
    enabled: Optional[bool] = Field(None, description="Enable or disable the subscription")
    events: Optional[List[str]] = Field(None, description="Update event filter")
    headers: Optional[Dict[str, str]] = Field(None, description="Update custom headers")


@router.patch("/api/a2a/push-notifications/config/{config_id}", response_model=PushNotificationConfigResponse)
async def update_push_notification_config(
    config_id: str,
    request: PushNotificationConfigUpdateRequest,
    user: User = Depends(require_viewer),
):
    """Update a push notification configuration."""
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        config = await service.update_config(
            config_id=config_id,
            enabled=request.enabled,
            events=request.events,
            headers=request.headers,
        )

        if config is None:
            raise HTTPException(status_code=404, detail=f"Config not found: {config_id}")

        return PushNotificationConfigResponse(
            id=config.id,
            taskId=config.task_id,
            url=config.url,
            events=config.events,
            hasSecret=config.secret is not None,
            enabled=config.enabled,
            createdAt=config.created_at.isoformat(),
            expiresAt=config.expires_at.isoformat() if config.expires_at else None,
            metadata=config.metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error updating push notification config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/a2a/push-notifications/config/{config_id}")
async def delete_push_notification_config(
    config_id: str,
    user: User = Depends(require_viewer),
):
    """Delete a push notification configuration."""
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        success = await service.delete_config(config_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"Config not found: {config_id}")

        return {"success": True, "configId": config_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error deleting push notification config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/a2a/push-notifications/stats", response_model=PushNotificationStatsResponse)
async def get_push_notification_stats(
    user: User = Depends(require_viewer),
):
    """Get push notification service statistics."""
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        stats = service.get_stats()

        return PushNotificationStatsResponse(
            running=stats["running"],
            workerCount=stats["worker_count"],
            configCount=stats["config_count"],
            queuePending=stats["queue"]["pending_count"],
            queueDeadLetter=stats["queue"]["dead_letter_count"],
            notificationsSent=stats["metrics"]["notifications_sent"],
            notificationsDelivered=stats["metrics"]["notifications_delivered"],
            notificationsFailed=stats["metrics"]["notifications_failed"],
            notificationsRetried=stats["metrics"]["notifications_retried"],
        )

    except Exception as e:
        logger.error(f"[A2A] Error getting push notification stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/a2a/push-notifications/dead-letter")
async def get_push_notification_dead_letters(
    limit: int = Query(100, ge=1, le=1000, description="Max items to return"),
    user: User = Depends(require_viewer),
):
    """Get failed notifications from the dead letter queue.

    Dead letter entries are notifications that failed after all retry attempts.
    """
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        dead_letters = service.get_dead_letters(limit)

        return {
            "deadLetters": dead_letters,
            "count": len(dead_letters),
        }

    except Exception as e:
        logger.error(f"[A2A] Error getting dead letters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/a2a/push-notifications/dead-letter/{delivery_id}/retry")
async def retry_dead_letter(
    delivery_id: str,
    user: User = Depends(require_viewer),
):
    """Retry a failed notification from the dead letter queue."""
    try:
        from src.a2a.push_notifications import get_push_notification_service

        service = get_push_notification_service()
        success = await service.retry_dead_letter(delivery_id)

        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Dead letter not found: {delivery_id}",
            )

        return {"success": True, "deliveryId": delivery_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[A2A] Error retrying dead letter: {e}")
        raise HTTPException(status_code=500, detail=str(e))
