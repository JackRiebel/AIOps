"""API routes for chat."""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_viewer, get_edit_mode_enabled
from src.api.models import *
from src.api.utils.audit import log_audit
from src.models import ChatConversation, ChatMessage
from src.models.user import User, UserRole
from src.services.ai_service import get_ai_assistant, get_provider_from_model
from src.services.unified_chat_service import create_chat_service, UnifiedChatService
from typing import List, Optional, Dict, Any

router = APIRouter()

# Database instance
from src.config.database import get_db
db = get_db()

@router.get("/api/chats", response_model=List[ConversationResponse], dependencies=[Depends(require_viewer)])
async def get_conversations(hours: int = 24):
    """Get all conversations from the last N hours (default 24)."""
    try:
        from sqlalchemy.orm import selectinload

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        async with db.session() as session:
            result = await session.execute(
                select(ChatConversation)
                .options(selectinload(ChatConversation.messages))
                .where(ChatConversation.last_activity >= cutoff_time)
                .order_by(ChatConversation.last_activity.desc())
            )
            conversations = result.scalars().all()

            # Construct response inside session to avoid lazy loading issues
            response = []
            for conv in conversations:
                response.append({
                    "id": conv.id,
                    "title": conv.title,
                    "organization": conv.organization,
                    "created_at": conv.created_at.isoformat() if conv.created_at else None,
                    "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
                    "last_activity": conv.last_activity.isoformat() if conv.last_activity else None,
                    "message_count": len(conv.messages),
                })
            return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/chats/{conversation_id}", response_model=dict, dependencies=[Depends(require_viewer)])
async def get_conversation(conversation_id: int):
    """Get a specific conversation with all its messages."""
    try:
        async with db.session() as session:
            # Get conversation
            result = await session.execute(
                select(ChatConversation).where(ChatConversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()

            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            # Get messages
            messages_result = await session.execute(
                select(ChatMessage)
                .where(ChatMessage.conversation_id == conversation_id)
                .order_by(ChatMessage.created_at.asc())
            )
            messages = messages_result.scalars().all()

            # Construct response inside session
            return {
                "id": conversation.id,
                "title": conversation.title,
                "organization": conversation.organization,
                "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
                "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
                "last_activity": conversation.last_activity.isoformat() if conversation.last_activity else None,
                "messages": [{
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "metadata": m.message_metadata,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                } for m in messages]
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/chat/suggestions", dependencies=[Depends(require_viewer)])
async def get_chat_suggestions():
    """Get proactive AI suggestions based on current system state.

    Returns suggestions for:
    - Critical/open incidents that need attention
    - Daily health check if no critical issues
    - Custom suggestions based on recent activity

    Returns:
        List of suggestion objects with type, label, prompt, and metadata
    """
    from src.models import Incident

    suggestions = []

    try:
        async with db.session() as session:
            # Check for open critical/high incidents
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            result = await session.execute(
                select(Incident)
                .where(
                    Incident.status.in_(["open", "investigating"]),
                    Incident.severity.in_(["critical", "high"]),
                    Incident.start_time >= cutoff_time,
                )
                .order_by(Incident.severity.asc())  # Critical first
                .limit(3)
            )
            critical_incidents = result.scalars().all()

            # Add incident suggestions
            for incident in critical_incidents:
                severity_val = incident.severity.value if hasattr(incident.severity, "value") else str(incident.severity)
                suggestions.append({
                    "type": "incident",
                    "label": f"Analyze {incident.title}",
                    "prompt": f"Perform a deep analysis on Incident #{incident.id}: {incident.title}. "
                             f"Check related events, identify root cause, and suggest remediation steps.",
                    "severity": severity_val,
                    "incident_id": incident.id,
                    "description": incident.root_cause_hypothesis or f"Incident started {incident.start_time.strftime('%I:%M %p') if incident.start_time else 'recently'}",
                })

            # Check for recent high-severity events without incidents
            if len(suggestions) < 2:
                from src.models import Event

                event_result = await session.execute(
                    select(Event)
                    .where(
                        Event.incident_id.is_(None),
                        Event.severity.in_(["critical", "high"]),
                        Event.timestamp >= cutoff_time,
                    )
                    .order_by(Event.timestamp.desc())
                    .limit(1)
                )
                unlinked_event = event_result.scalar_one_or_none()

                if unlinked_event:
                    suggestions.append({
                        "type": "incident",
                        "label": f"Investigate: {unlinked_event.title}",
                        "prompt": f"Investigate this high-priority event: {unlinked_event.title}. "
                                 f"Check if it's related to any existing incidents or if a new incident should be created.",
                        "severity": unlinked_event.severity.value if hasattr(unlinked_event.severity, "value") else "high",
                        "description": f"Unlinked {unlinked_event.event_type} event from {unlinked_event.source.value if hasattr(unlinked_event.source, 'value') else unlinked_event.source}",
                    })

    except Exception:
        # If incident check fails, continue with default suggestions
        pass

    # Always add a health check suggestion if we have room
    if len(suggestions) < 3:
        suggestions.append({
            "type": "health_check",
            "label": "Daily Health Check",
            "prompt": "Perform a comprehensive health check of my network infrastructure. "
                     "Review device status across all organizations, check for any recent alerts or warnings, "
                     "identify performance issues, and summarize the overall network health.",
            "description": "Review overall network status and recent events",
        })

    # Add a quick status suggestion
    if len(suggestions) < 3:
        suggestions.append({
            "type": "custom",
            "label": "Quick Network Summary",
            "prompt": "Give me a quick summary of the current network status. "
                     "How many devices are online, any alerts in the last hour, and any recommended actions?",
            "description": "Get a brief overview of current status",
        })

    return {
        "suggestions": suggestions[:3],  # Limit to 3 suggestions
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/api/chats", response_model=ConversationResponse, status_code=201, dependencies=[Depends(require_viewer)])
async def create_conversation(conversation_data: ConversationCreate):
    """Create a new conversation."""
    try:
        async with db.session() as session:
            # Create new conversation
            new_conversation = ChatConversation(
                title=conversation_data.title or "New Conversation",
                organization=conversation_data.organization,
                user_id="web-user",
                last_activity=datetime.utcnow()
            )
            session.add(new_conversation)
            await session.flush()  # Flush to get ID before context manager commits
            await session.refresh(new_conversation)

            # Construct response inside session
            return {
                "id": new_conversation.id,
                "title": new_conversation.title,
                "organization": new_conversation.organization,
                "created_at": new_conversation.created_at.isoformat() if new_conversation.created_at else None,
                "updated_at": new_conversation.updated_at.isoformat() if new_conversation.updated_at else None,
                "last_activity": new_conversation.last_activity.isoformat() if new_conversation.last_activity else None,
                "message_count": 0,
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/chats/{conversation_id}/messages")
async def create_message(
    conversation_id: int,
    request: Dict[str, Any],
    req: Request = None,
    user: User = Depends(require_viewer)
):
    """Handle user message and return AI response with cost + disclaimer."""
    try:
        async with db.session() as session:
            # Verify conversation exists
            conv_result = await session.execute(
                select(ChatConversation).where(ChatConversation.id == conversation_id)
            )
            conversation = conv_result.scalar_one_or_none()
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            user_content = request.get("content", "").strip()
            if not user_content:
                raise HTTPException(status_code=400, detail="Message content required")

            # Save user message
            user_msg = ChatMessage(
                conversation_id=conversation_id,
                role="user",
                content=user_content,
                message_metadata=request.get("metadata", {})
            )
            session.add(user_msg)

            # Get AI response using user's preferred model and settings
            preferred_model = user.preferred_model if user else None
            temperature = user.ai_temperature if user else None
            max_tokens = user.ai_max_tokens if user else None

            # If no preferred model, get the first available model from configured providers
            if not preferred_model:
                from src.services.config_service import get_config_or_env
                from src.config.settings import get_settings
                import logging
                _logger = logging.getLogger(__name__)

                settings = get_settings()
                all_models = settings.available_models

                # Check for configured providers (database first, then env)
                db_anthropic = get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY")
                db_cisco_id = get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID")
                db_cisco_secret = get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET")
                db_openai = get_config_or_env("openai_api_key", "OPENAI_API_KEY")
                db_google = get_config_or_env("google_api_key", "GOOGLE_API_KEY")

                _logger.info(f"[MODEL SELECT] db_anthropic={bool(db_anthropic)}, db_cisco_id={bool(db_cisco_id)}, db_cisco_secret={bool(db_cisco_secret)}, db_openai={bool(db_openai)}, db_google={bool(db_google)}")
                _logger.info(f"[MODEL SELECT] settings.anthropic={bool(settings.anthropic_api_key)}, settings.cisco_id={bool(settings.cisco_circuit_client_id)}")

                if db_cisco_id and db_cisco_secret:
                    preferred_model = all_models["cisco"][0]["id"]
                    _logger.info(f"[MODEL SELECT] Selected cisco: {preferred_model}")
                elif db_anthropic or settings.anthropic_api_key:
                    preferred_model = all_models["anthropic"][0]["id"]
                    _logger.info(f"[MODEL SELECT] Selected anthropic: {preferred_model}")
                elif db_openai or settings.openai_api_key:
                    preferred_model = all_models["openai"][0]["id"]
                    _logger.info(f"[MODEL SELECT] Selected openai: {preferred_model}")
                elif db_google or settings.google_api_key:
                    preferred_model = all_models["google"][0]["id"]
                    _logger.info(f"[MODEL SELECT] Selected google: {preferred_model}")
                else:
                    _logger.warning("[MODEL SELECT] No AI provider configured!")

            # Build user API keys dict for all providers
            user_api_keys = {}
            if user:
                from src.api.routes.settings import get_user_api_key
                for provider in ["anthropic", "openai", "google"]:
                    key = get_user_api_key(user, provider)
                    if key:
                        user_api_keys[provider] = key
                # Also add Cisco credentials if set
                cisco_client_id = get_user_api_key(user, "cisco_client_id")
                cisco_client_secret = get_user_api_key(user, "cisco_client_secret")
                if cisco_client_id:
                    user_api_keys["cisco_client_id"] = cisco_client_id
                if cisco_client_secret:
                    user_api_keys["cisco_client_secret"] = cisco_client_secret

            # Detect provider from model and get appropriate assistant
            provider = get_provider_from_model(preferred_model)
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[AI ROUTING] User: {user.username if user else 'None'}, preferred_model: {preferred_model}, detected provider: {provider}")

            assistant = get_ai_assistant(
                model=preferred_model,
                temperature=temperature,
                max_tokens=max_tokens,
                user_api_keys=user_api_keys
            )
            logger.info(f"[AI ROUTING] Got assistant: {type(assistant).__name__ if assistant else 'None'}")
            if not assistant:
                provider_name = {"anthropic": "Anthropic", "openai": "OpenAI", "google": "Google"}.get(provider, provider)
                raise HTTPException(status_code=503, detail=f"AI service not available — no {provider_name} API key configured")

            # Fetch credentials and cluster info for the organization
            credentials = await credential_manager.get_credentials(conversation.organization)
            if not credentials:
                raise HTTPException(status_code=400, detail=f"No credentials found for organization: {conversation.organization}")

            cluster = await credential_manager.get_cluster(conversation.organization)
            org_id = str(cluster.id) if cluster else ""

            # Fetch conversation history - limit to last 10 messages to prevent context overflow
            history_result = await session.execute(
                select(ChatMessage)
                .where(ChatMessage.conversation_id == conversation_id)
                .order_by(ChatMessage.created_at.desc())
                .limit(10)  # Last 10 messages only
            )
            history_messages = list(reversed(history_result.scalars().all()))

            # Build conversation history with content truncation for very long messages
            conversation_history = []
            for msg in history_messages:
                content = msg.content
                # Truncate very long messages to prevent context overflow (keep first 2000 chars)
                if len(content) > 2000:
                    content = content[:2000] + "\n...[truncated for length]"
                conversation_history.append({
                    "role": msg.role,
                    "content": content
                })

            # Check if we should use the unified chat service (new architecture)
            # The unified service provides better context handling and tool support
            use_unified_service = True  # Feature flag - can be made configurable

            if use_unified_service:
                try:
                    # Create unified chat service with user's model preference
                    unified_service = create_chat_service(
                        model=preferred_model,
                        user_api_keys=user_api_keys,
                    )

                    # Determine edit_mode based on user permissions and global setting
                    global_edit_enabled = await get_edit_mode_enabled(session)
                    user_can_edit = user.has_permission(UserRole.EDITOR) if user else False
                    edit_mode = global_edit_enabled and user_can_edit

                    # Call the unified chat service
                    chat_result = await unified_service.chat(
                        message=user_content,
                        conversation_history=conversation_history,
                        credentials=credentials,
                        session_id=str(conversation_id),
                        org_id=org_id,
                        org_name=conversation.organization,
                        edit_mode=edit_mode,
                    )

                    ai_result = {
                        "success": True,
                        "response": chat_result.response,
                        "tools_used": [tc.get("tool") for tc in chat_result.tool_calls],
                        "input_tokens": chat_result.token_usage.get("input_tokens", 0),
                        "output_tokens": chat_result.token_usage.get("output_tokens", 0),
                        "cost_usd": chat_result.cost,
                    }
                except Exception as unified_error:
                    logger.warning(f"Unified service failed, falling back: {unified_error}")
                    # Fall back to legacy service
                    use_unified_service = False

            if not use_unified_service:
                # Legacy path - use old assistant
                ai_result = await assistant.chat(
                    message=user_content,
                    credentials=credentials,
                    org_id=org_id,
                    org_name=conversation.organization,
                    organization_name=conversation.organization,
                    conversation_history=conversation_history,
                    session_id=str(conversation_id)
                )

            if not ai_result.get("success"):
                raise HTTPException(status_code=500, detail="AI failed to respond")

            # Save AI message with agent activity metadata
            ai_msg = ChatMessage(
                conversation_id=conversation_id,
                role="assistant",
                content=ai_result["response"],
                message_metadata={
                    "tools_used": ai_result.get("tools_used", []),
                    "input_tokens": ai_result.get("input_tokens", 0),
                    "output_tokens": ai_result.get("output_tokens", 0),
                    "cost_usd": ai_result.get("cost_usd", 0.0),
                    # Agent-to-agent communication tracking
                    "agent_activity": ai_result.get("agent_activity"),
                    "requires_confirmation": ai_result.get("requires_confirmation", False),
                    "pending_implementation": ai_result.get("pending_implementation"),
                }
            )
            session.add(ai_msg)

            # Update conversation
            conversation.last_activity = datetime.utcnow()
            conversation.title = conversation.title or user_content[:50]

            await session.flush()  # Flush to get IDs before context manager commits

            # Log audit entry for MCP/AI operation
            if req and ai_result.get("tools_used"):
                try:
                    await log_audit(
                        db=session,
                        request=req,
                        cluster_id=cluster.id if cluster else None,
                        operation_id="|".join(ai_result["tools_used"][:3]),  # Log first 3 tools used
                        response_status=200,
                        request_body={"message": user_content[:100]}  # Log first 100 chars of message
                    )
                except Exception as audit_error:
                    # Don't fail the request if audit logging fails
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to log audit: {audit_error}")

            # THIS IS THE EXACT RESPONSE YOUR FRONTEND EXPECTS
            # Include agent activity at top level for easy frontend access
            return {
                "id": ai_msg.id,
                "conversation_id": ai_msg.conversation_id,
                "role": "assistant",
                "content": ai_result["response"],
                "metadata": ai_msg.message_metadata,
                "created_at": ai_msg.created_at.isoformat(),
                "disclaimer": "AI-generated suggestion — human review required before action",
                # Agent-to-agent communication for UI (Knowledge Agent consultations)
                "agent_activity": ai_result.get("agent_activity"),
                "requires_confirmation": ai_result.get("requires_confirmation", False),
                "pending_implementation": ai_result.get("pending_implementation"),
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")



@router.put("/api/chats/{conversation_id}/activity", dependencies=[Depends(require_viewer)])
async def update_activity(conversation_id: int):
    """Update the last activity timestamp for a conversation."""
    try:
        async with db.session() as session:
            result = await session.execute(
                select(ChatConversation).where(ChatConversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()

            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            conversation.last_activity = datetime.utcnow()
            # Context manager will auto-commit

            return {"status": "success", "last_activity": conversation.last_activity.isoformat()}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/api/chats/{conversation_id}", dependencies=[Depends(require_viewer)])
async def delete_conversation(conversation_id: int):
    """Delete a conversation and all its messages."""
    try:
        async with db.session() as session:
            result = await session.execute(
                select(ChatConversation).where(ChatConversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()

            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            await session.delete(conversation)
            # Context manager will auto-commit

            return {"status": "success", "message": "Conversation deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/chats/{conversation_id}/report", dependencies=[Depends(require_viewer)])
async def generate_report(
    conversation_id: int,
    user: User = Depends(require_viewer)
):
    """Generate an AI-powered summary report from a conversation."""
    try:
        async with db.session() as session:
            # Get conversation
            result = await session.execute(
                select(ChatConversation).where(ChatConversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()

            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            # Get all messages
            messages_result = await session.execute(
                select(ChatMessage)
                .where(ChatMessage.conversation_id == conversation_id)
                .order_by(ChatMessage.created_at.asc())
            )
            messages = messages_result.scalars().all()

            if len(messages) < 2:
                raise HTTPException(status_code=400, detail="Conversation too short for report")

            # Build conversation transcript
            transcript = "\n\n".join([
                f"**{m.role.upper()}**: {m.content}" for m in messages
            ])

            # Generate report using Claude
            prompt = f"""Analyze this network operations conversation and generate a professional report.

CONVERSATION:
{transcript}

Generate a markdown report with these sections:
## Summary
Brief overview of what was discussed/accomplished (2-3 sentences)

## Key Issues Discussed
Bullet list of main topics, questions, or problems addressed

## Actions Taken
What operations were performed (device lookups, configuration changes, troubleshooting steps)

## Findings
Key data or information discovered during the conversation

## Recommendations
Suggested next steps or follow-up actions (if applicable)

Keep the report concise but informative. Use professional tone."""

            # Get user's preferred model and settings
            preferred_model = user.preferred_model if user else None

            # If no preferred model, get the first available model from configured providers
            if not preferred_model:
                from src.services.config_service import get_config_or_env
                from src.config.settings import get_settings
                settings = get_settings()
                all_models = settings.available_models

                db_anthropic = get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY")
                db_cisco_id = get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID")
                db_cisco_secret = get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET")
                db_openai = get_config_or_env("openai_api_key", "OPENAI_API_KEY")
                db_google = get_config_or_env("google_api_key", "GOOGLE_API_KEY")

                if db_anthropic or settings.anthropic_api_key:
                    preferred_model = all_models["anthropic"][0]["id"]
                elif db_cisco_id and db_cisco_secret:
                    preferred_model = all_models["cisco"][0]["id"]
                elif db_openai or settings.openai_api_key:
                    preferred_model = all_models["openai"][0]["id"]
                elif db_google or settings.google_api_key:
                    preferred_model = all_models["google"][0]["id"]

            # Build user API keys dict for all providers
            user_api_keys = {}
            if user:
                from src.api.routes.settings import get_user_api_key
                for provider in ["anthropic", "openai", "google"]:
                    key = get_user_api_key(user, provider)
                    if key:
                        user_api_keys[provider] = key

            # Detect provider from model and get appropriate assistant
            provider = get_provider_from_model(preferred_model)
            assistant = get_ai_assistant(
                model=preferred_model,
                temperature=0.3,  # Lower temperature for consistent reports
                max_tokens=2000,
                user_api_keys=user_api_keys
            )

            if not assistant:
                provider_name = {"anthropic": "Anthropic", "openai": "OpenAI", "google": "Google"}.get(provider, provider)
                raise HTTPException(status_code=503, detail=f"AI service not available — no {provider_name} API key configured")

            # Use the provider-agnostic simple response method
            report_content = assistant.generate_simple_response(prompt, max_tokens=2000)

            return {
                "success": True,
                "conversation_id": conversation_id,
                "conversation_title": conversation.title,
                "generated_at": datetime.utcnow().isoformat(),
                "report": report_content
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


# =============================================================================
# Device Chat - Context-aware chat for specific devices
# =============================================================================

class DeviceChatRequest(BaseModel):
    """Request for device chat."""
    message: str = Field(..., min_length=1, max_length=2000, description="User's message")


class DeviceChatResponse(BaseModel):
    """Response from device chat."""
    response: str
    device_serial: str
    model_used: str
    usage: Optional[Dict[str, Any]] = None


@router.post("/api/chat/device/{serial}/message", response_model=DeviceChatResponse, dependencies=[Depends(require_viewer)])
async def device_chat_message(
    serial: str,
    request: DeviceChatRequest,
    user: User = Depends(require_viewer),
):
    """Chat with AI about a specific device.

    Provides context-aware responses based on device configuration, status, and recent events.
    The AI has access to device context including IPs, status, firmware, and recent alerts.

    Args:
        serial: Device serial number
        request: Chat message
        user: Authenticated user

    Returns:
        AI response with device context
    """
    from src.services.network_cache_service import NetworkCacheService
    from src.services.prompt_service import get_prompt

    try:
        cache_service = NetworkCacheService()

        # Get device info from cache
        device_info = None
        network_info = None
        organization_name = None

        # Search all orgs for this device
        orgs = await credential_manager.list_organizations()
        for org in orgs:
            org_name = org.get("name")
            devices = await cache_service.get_cached_devices(org_name)

            for dev in devices:
                if dev.get("serial") == serial:
                    device_info = dev
                    organization_name = org_name

                    # Get network info
                    networks = await cache_service.get_cached_networks(org_name)
                    for net in networks:
                        if net.get("id") == dev.get("networkId"):
                            network_info = net
                            break
                    break
            if device_info:
                break

        if not device_info:
            raise HTTPException(status_code=404, detail=f"Device {serial} not found in cache")

        # Build device context for prompt
        recent_events_text = ""
        recent_alerts_text = ""

        # Try to get recent events from Splunk if available
        # (For now, we'll leave this empty - can be enhanced later)

        # Build the prompt using template
        prompt = get_prompt(
            "device_chat",
            device_serial=device_info.get("serial", "Unknown"),
            device_name=device_info.get("name", "Unknown"),
            device_model=device_info.get("model", "Unknown"),
            device_status=device_info.get("status", "Unknown"),
            network_name=network_info.get("name", "Unknown") if network_info else "Unknown",
            network_id=device_info.get("networkId", "Unknown"),
            organization_name=organization_name or "Unknown",
            lan_ip=device_info.get("lanIp", "Not configured"),
            public_ip=device_info.get("publicIp", "Not available"),
            mac_address=device_info.get("mac", "Unknown"),
            firmware=device_info.get("firmware", "Unknown"),
            last_seen=device_info.get("_cached_at", "Unknown"),
            tags=", ".join(device_info.get("tags", [])) or "None",
            recent_events=recent_events_text or "No recent events available.",
            recent_alerts=recent_alerts_text or "No recent alerts.",
            user_message=request.message,
        )

        # Use multi-provider AI
        from src.services.multi_provider_ai import generate_text

        result = await generate_text(
            prompt=prompt,
            max_tokens=1024,
        )

        if not result:
            raise HTTPException(
                status_code=503,
                detail="No AI provider configured - please configure an AI provider in Admin > System Config"
            )

        return DeviceChatResponse(
            response=result["text"],
            device_serial=serial,
            model_used=result["model"],
            usage={
                "input_tokens": result["input_tokens"],
                "output_tokens": result["output_tokens"],
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Device chat failed: {str(e)}")