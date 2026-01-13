"""Unified Streaming Chat API Endpoints.

This module provides the streaming chat endpoint using the unified
multi-provider architecture. It replaces the deprecated A2A multi-agent
system with a simpler single-model approach.

The streaming endpoint supports:
- All AI providers (Claude, OpenAI, Google, Cisco Circuit)
- All 1000+ tools across platforms
- Dynamic credential resolution per platform
- Natural conversation context
- Real-time token streaming
"""

import logging
import json
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.api.dependencies import require_viewer, credential_manager
from src.models.user import User
from src.services.unified_chat_service import create_chat_service
from src.services.credential_pool import get_initialized_pool
from src.services.cost_logger import get_cost_logger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["Streaming Chat"])


class StreamingChatRequest(BaseModel):
    """Request model for streaming chat."""
    message: str
    organization: Optional[str] = None
    network_id: Optional[str] = None  # User's currently selected network (for card context)
    session_id: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    conversation_id: Optional[int] = None
    edit_mode: bool = False  # When True, write/update/delete tools are available
    verbosity: str = "standard"  # "brief", "standard", "detailed"
    card_context: Optional[Dict[str, str]] = None  # Context from "Ask about this" card feature


async def _create_unified_stream(
    message: str,
    organization: str,
    network_id: Optional[str],
    session_id: str,
    history: List[Dict[str, Any]],
    user: User,
    edit_mode: bool = False,
    verbosity: str = "standard",
    conversation_id: Optional[int] = None,
    card_context: Optional[Dict[str, str]] = None,
):
    """Create a streaming response using the unified chat service.

    Uses CredentialPool for dynamic platform-aware credential resolution:
    - Meraki: Resolves by org_id from tool input (one API key can access multiple orgs)
    - Catalyst: Resolves by base_url (one credential per Catalyst Center instance)
    - ThousandEyes: Uses available OAuth token
    - Splunk: Resolves by base_url (one credential per Splunk instance)

    Args:
        message: User message
        organization: Organization hint (can be empty for auto-resolve)
        session_id: Session ID for context persistence
        history: Conversation history
        user: Authenticated user
        edit_mode: If True, write/update/delete tools are available
        card_context: Context from "Ask about this" card feature (networkId, deviceSerial, orgId)
    """
    try:
        # Initialize credential pool with all platforms
        # This replaces the old single-org credential lookup
        try:
            credential_pool = await get_initialized_pool()
            pool_stats = credential_pool.get_stats()
            logger.info(f"[Stream] CredentialPool initialized: {pool_stats}")
        except Exception as e:
            logger.error(f"[Stream] Failed to initialize credential pool: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': f'Failed to initialize credentials: {e}'})}\n\n"
            return

        # Check if we have any platforms available
        available_platforms = credential_pool.get_available_platforms()
        if not available_platforms:
            yield f"data: {json.dumps({'type': 'error', 'error': 'No platform credentials configured. Please add credentials in Settings.'})}\n\n"
            return

        # For backward compatibility, try to get org_id from organization param if it's a single value
        # The new approach uses the pool's dynamic resolution, but we still pass org hints
        org_id = ""
        org_name = organization or "All Organizations"

        # If organization is a single value (not comma-separated), try to get specific org_id
        if organization and "," not in organization:
            cluster = await credential_manager.get_cluster(organization)
            if cluster:
                org_id = str(cluster.id)
        else:
            # Comma-separated or empty = auto-resolve mode
            logger.info(f"[Stream] Auto-resolve mode: organization='{organization}'")

        # Get user's preferred model and API keys
        preferred_model = user.preferred_model if user else None
        logger.info(f"[MODEL SELECT] User '{user.username if user else 'anon'}' preferred_model from DB: {preferred_model}")

        # Build user API keys FIRST (needed for provider availability check)
        from src.api.routes.settings import get_user_api_key
        user_api_keys = {}
        user_has_anthropic = False
        user_has_openai = False
        user_has_google = False
        user_has_cisco = False
        if user:
            for provider in ["anthropic", "openai", "google"]:
                key = get_user_api_key(user, provider)
                if key:
                    user_api_keys[provider] = key
                    if provider == "anthropic":
                        user_has_anthropic = True
                    elif provider == "openai":
                        user_has_openai = True
                    elif provider == "google":
                        user_has_google = True
            # Check for user's Cisco credentials
            if user.user_cisco_client_id and user.user_cisco_client_secret:
                user_has_cisco = True

        # Check which providers are actually configured (admin + user keys)
        from src.services.config_service import get_config_or_env
        from src.config.settings import get_settings
        from src.services.ai_service import get_provider_from_model
        settings = get_settings()
        all_models = settings.available_models

        db_anthropic = get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY")
        db_cisco_id = get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID")
        db_cisco_secret = get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET")
        db_openai = get_config_or_env("openai_api_key", "OPENAI_API_KEY")
        db_google = get_config_or_env("google_api_key", "GOOGLE_API_KEY")

        # Include BOTH admin keys AND user-provided keys in availability check
        has_anthropic = bool(db_anthropic or settings.anthropic_api_key or user_has_anthropic)
        has_cisco = bool((db_cisco_id and db_cisco_secret) or user_has_cisco)
        has_openai = bool(db_openai or settings.openai_api_key or user_has_openai)
        has_google = bool(db_google or settings.google_api_key or user_has_google)

        # Debug: show which keys were found
        logger.info(f"[MODEL SELECT] Key sources: db_anthropic={bool(db_anthropic)}, settings.anthropic={bool(settings.anthropic_api_key)}, user_anthropic={user_has_anthropic}")
        logger.info(f"[MODEL SELECT] Configured providers: cisco={has_cisco}, anthropic={has_anthropic}, openai={has_openai}, google={has_google}")

        # Check if user's preferred model provider is actually configured
        if preferred_model:
            provider = get_provider_from_model(preferred_model)
            provider_available = (
                (provider == "cisco" and has_cisco) or
                (provider == "anthropic" and has_anthropic) or
                (provider == "openai" and has_openai) or
                (provider == "google" and has_google)
            )
            if not provider_available:
                logger.info(f"[MODEL SELECT] User's preferred model '{preferred_model}' (provider={provider}) not available, finding alternative")
                preferred_model = None  # Reset to find an available model

        # If no valid preferred model, select first available (Cisco priority)
        if not preferred_model:
            if has_cisco:
                preferred_model = all_models["cisco"][0]["id"]
            elif has_anthropic:
                preferred_model = all_models["anthropic"][0]["id"]
            elif has_openai:
                preferred_model = all_models["openai"][0]["id"]
            elif has_google:
                preferred_model = all_models["google"][0]["id"]
            else:
                # No AI provider configured at all
                yield f"data: {json.dumps({'type': 'error', 'error': 'No AI provider configured. Please configure an AI provider in Settings.'})}\n\n"
                return

        logger.info(f"[MODEL SELECT] Final selected model: {preferred_model}")

        # Create unified service
        try:
            service = create_chat_service(
                model=preferred_model,
                user_api_keys=user_api_keys,
            )
        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            return

        # Emit thinking event to indicate processing has started
        yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

        # Stream the response with credential pool for dynamic resolution
        event_count = 0
        async for event in service.stream_chat(
            message=message,
            conversation_history=history or [],
            credentials=None,  # Deprecated - use credential_pool instead
            credential_pool=credential_pool,  # New: dynamic per-tool resolution
            session_id=session_id or "stream",
            org_id=org_id,
            org_name=org_name,
            network_id=network_id,  # User's currently selected network for card context
            edit_mode=edit_mode,  # Pass through from request
            verbosity=verbosity,  # Response detail level
            card_context=card_context,  # Context from "Ask about this" card feature
        ):
            event_count += 1
            event_type = event.get("type")
            logger.info(f"[SSE] Event {event_count}: {event_type}")

            if event_type == "text_delta":
                sse_data = f"data: {json.dumps({'type': 'text_delta', 'text': event.get('text', '')})}\n\n"
                logger.debug(f"[SSE] Yielding: {sse_data[:80]}...")
                yield sse_data

            elif event_type == "tool_use_start":
                yield f"data: {json.dumps({'type': 'tool_use_start', 'tool': event.get('tool'), 'id': event.get('id')})}\n\n"

            elif event_type == "tool_result":
                yield f"data: {json.dumps({'type': 'tool_result', 'tool': event.get('tool'), 'result': event.get('result')})}\n\n"

            elif event_type == "done":
                tool_data = event.get('tool_data')
                usage = event.get('usage', {})

                # INTENSIVE LOGGING: Log tool_data being sent to frontend
                if tool_data:
                    logger.info(f"[SSE][DEBUG] DONE event with {len(tool_data)} tool_data items")
                    for i, td in enumerate(tool_data):
                        logger.info(f"[SSE][DEBUG] tool_data[{i}]: tool={td.get('tool')}, network_id={td.get('network_id')}, org_id={td.get('org_id')}, data_type={td.get('data_type')}")
                else:
                    logger.info(f"[SSE][DEBUG] DONE event with NO tool_data")

                # Log cost to database for telemetry
                input_tokens = usage.get('input_tokens', 0)
                output_tokens = usage.get('output_tokens', 0)
                total_tokens = usage.get('total_tokens', 0)

                # Fallback: if we only have total_tokens, estimate input/output split (70/30 typical ratio)
                if input_tokens == 0 and output_tokens == 0 and total_tokens > 0:
                    input_tokens = int(total_tokens * 0.7)
                    output_tokens = total_tokens - input_tokens
                    logger.info(f"[SSE] Using estimated token split from total_tokens={total_tokens}")

                if input_tokens > 0 or output_tokens > 0:
                    try:
                        cost_logger = get_cost_logger()
                        await cost_logger.log_streaming_complete(
                            model=preferred_model,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            user_id=user.id if user else None,
                            conversation_id=conversation_id,
                            provider="unified_chat",
                        )
                        logger.info(f"[SSE] Logged streaming cost: {input_tokens} input, {output_tokens} output tokens")
                    except Exception as e:
                        logger.error(f"[SSE] Failed to log streaming cost: {e}")

                done_data = {
                    'type': 'done',
                    'usage': usage,
                    'tool_data': tool_data,
                    'tools_used': event.get('tools_used', []),
                    'platforms': event.get('platforms', []),
                }
                logger.info(f"[SSE][DEBUG] Sending done_data to frontend: tools_used={len(done_data['tools_used'])}, platforms={done_data['platforms']}")
                yield f"data: {json.dumps(done_data)}\n\n"

            elif event_type == "card_suggestion":
                # Forward knowledge source card suggestions to frontend
                card_data = event.get('card')
                if card_data:
                    logger.info(f"[SSE] Forwarding card_suggestion: type={card_data.get('type')}, title={card_data.get('title')}")
                    yield f"data: {json.dumps({'type': 'card_suggestion', 'card': card_data})}\n\n"

            elif event_type == "agent_activity_start":
                # Forward RAG agent activity to frontend for agent flow visualization
                logger.info(f"[SSE] Agent activity start: {event.get('agentName')}")
                yield f"data: {json.dumps(event)}\n\n"

            elif event_type == "agent_activity_complete":
                # Forward RAG agent activity completion to frontend
                logger.info(f"[SSE] Agent activity complete: {event.get('agentId')}, success={event.get('success')}")
                yield f"data: {json.dumps(event)}\n\n"

            elif event_type == "error":
                yield f"data: {json.dumps({'type': 'error', 'error': event.get('error')})}\n\n"

    except Exception as e:
        logger.error(f"Streaming error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


@router.post("/chat/stream")
async def agent_chat_stream(
    body: StreamingChatRequest,
    user: User = Depends(require_viewer),
) -> StreamingResponse:
    """Stream a chat response with tool support.

    This endpoint provides real-time streaming of AI responses with
    tool execution. It uses the unified chat service which supports
    all AI providers and maintains natural conversation context.

    Credential Resolution:
    - If organization is empty or comma-separated: auto-resolve credentials per-tool
    - Each platform (Meraki, Catalyst, ThousandEyes, Splunk) resolves its own credentials
    - Meraki: Can resolve by org_id from tool parameters
    - Others: Use first available credentials for that platform

    Events streamed:
    - thinking: AI is processing the request
    - text_delta: Partial text response
    - tool_use_start: Tool execution starting
    - tool_result: Tool execution result
    - card_suggestion: Knowledge source card suggestion
    - done: Stream complete with usage stats and tool_data
    - error: Error occurred

    Args:
        body: Chat request with message and context
        user: Authenticated user

    Returns:
        StreamingResponse with SSE events
    """
    # Organization is now optional - empty or comma-separated triggers auto-resolve
    org_display = body.organization or "(auto-resolve)"
    # Session ID resolution: prefer session_id, then conversation_id, finally default
    effective_session_id = body.session_id if body.session_id else (
        str(body.conversation_id) if body.conversation_id else "default-stream"
    )
    logger.info(
        f"[Stream] User: {user.username}, org: {org_display}, "
        f"message: {body.message[:50]}..., session_id: {effective_session_id} (from body.session_id: {body.session_id})"
    )

    return StreamingResponse(
        _create_unified_stream(
            message=body.message,
            organization=body.organization,
            network_id=body.network_id,
            session_id=effective_session_id,
            history=body.history or [],
            user=user,
            edit_mode=body.edit_mode,
            verbosity=body.verbosity,
            conversation_id=body.conversation_id,
            card_context=body.card_context,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/tools")
async def list_tools(
    platform: Optional[str] = None,
    user: User = Depends(require_viewer),
) -> Dict[str, Any]:
    """List available tools.

    Args:
        platform: Optional platform filter (meraki, catalyst, thousandeyes, splunk)

    Returns:
        Dictionary with tools info
    """
    from src.services.tool_registry import get_tool_registry

    registry = get_tool_registry()
    stats = registry.get_stats()

    tools = []
    if platform:
        for tool in registry.get_tools_by_platform(platform):
            tools.append({
                "name": tool.name,
                "description": tool.description,
                "platform": tool.platform,
                "category": tool.category,
                "requires_write": tool.requires_write,
            })
    else:
        for tool in registry.get_all():
            tools.append({
                "name": tool.name,
                "description": tool.description,
                "platform": tool.platform,
                "category": tool.category,
                "requires_write": tool.requires_write,
            })

    return {
        "tools": tools,
        "total": len(tools),
        "stats": stats,
    }


@router.get("/tools/{tool_name}")
async def get_tool(
    tool_name: str,
    user: User = Depends(require_viewer),
) -> Dict[str, Any]:
    """Get tool details by name.

    Args:
        tool_name: Tool name

    Returns:
        Tool details including schema
    """
    from src.services.tool_registry import get_tool_registry

    registry = get_tool_registry()
    tool = registry.get(tool_name)

    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    return {
        "name": tool.name,
        "description": tool.description,
        "platform": tool.platform,
        "category": tool.category,
        "requires_write": tool.requires_write,
        "input_schema": tool.input_schema,
        "tags": tool.tags,
    }
