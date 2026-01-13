"""WebSocket endpoint for live card updates.

Provides real-time data push to frontend cards via WebSocket connections.
Supports topic-based subscriptions for selective updates.
"""

import logging
import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState

from src.services.websocket_hub import get_websocket_hub
from src.services.auth_service import AuthService
from src.config.database import get_async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSocket"])


async def validate_ws_token(token: Optional[str]) -> Optional[int]:
    """Validate WebSocket authentication token.

    Args:
        token: Session token from query parameter

    Returns:
        User ID if token is valid, None otherwise
    """
    if not token:
        return None

    try:
        async with get_async_session() as session:
            user = await AuthService.get_user_from_session(session, token)
            if user:
                return user.id
    except Exception as e:
        logger.debug(f"WebSocket token validation failed: {e}")

    return None


@router.websocket("/cards")
async def card_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """WebSocket endpoint for live card updates.

    Query Parameters:
        token: Optional authentication token (for future use)

    Message Protocol:
        Client -> Server:
            {"type": "subscribe", "topic": "meraki:devices:248496"}
            {"type": "unsubscribe", "topic": "meraki:devices:248496"}
            {"type": "ping"}

        Server -> Client:
            {"type": "connected", "client_id": "...", "timestamp": "..."}
            {"type": "subscribed", "topic": "...", "timestamp": "..."}
            {"type": "unsubscribed", "topic": "...", "timestamp": "..."}
            {"type": "update", "topic": "...", "data": {...}, "timestamp": "..."}
            {"type": "pong", "timestamp": "..."}
            {"type": "heartbeat", "timestamp": "..."}
            {"type": "error", "message": "..."}

    Topic Format:
        Topics follow: source:type:identifier
        - meraki:devices:{org_id} - Device status updates
        - meraki:alerts:{org_id} - Meraki alerts
        - thousandeyes:alerts - ThousandEyes alerts
        - splunk:events - Splunk events
        - health:{org_id} - Health metrics aggregate
    """
    hub = get_websocket_hub()

    # Validate token before accepting connection
    user_id = await validate_ws_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    client_id = await hub.connect(websocket, user_id)

    try:
        # Main message loop
        while True:
            try:
                # Receive message as text
                text = await websocket.receive_text()

                # Parse JSON
                try:
                    message = json.loads(text)
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid JSON"
                    })
                    continue

                # Handle the message
                await hub.handle_client_message(client_id, message)

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                if websocket.client_state == WebSocketState.CONNECTED:
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "message": str(e)
                        })
                    except Exception:
                        break

    finally:
        await hub.disconnect(client_id)


@router.websocket("/rag-pipeline")
async def rag_pipeline_websocket(
    websocket: WebSocket,
    session_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
):
    """WebSocket endpoint for Agentic RAG pipeline progress updates.

    Query Parameters:
        session_id: Optional session ID to filter updates
        token: Authentication token for connection validation

    Message Protocol:
        Server -> Client:
            {"type": "pipeline_start", "query": "...", "session_id": "..."}
            {"type": "agent_start", "agent": "QueryAnalysisAgent", "timestamp": "..."}
            {"type": "agent_complete", "agent": "QueryAnalysisAgent", "duration_ms": 123, "result": {...}}
            {"type": "iteration_start", "iteration": 1, "timestamp": "..."}
            {"type": "retrieval_complete", "chunks_count": 5, "timestamp": "..."}
            {"type": "grading_complete", "relevant_count": 3, "avg_relevance": 0.85}
            {"type": "web_search_triggered", "reason": "...", "results_count": 3}
            {"type": "synthesis_complete", "answer_length": 500, "citations_count": 3}
            {"type": "reflection_complete", "quality": "GOOD", "needs_iteration": false}
            {"type": "pipeline_complete", "total_duration_ms": 5000, "quality": "GOOD"}
            {"type": "pipeline_error", "error": "..."}

    This allows the frontend to show real-time progress as the agentic
    RAG pipeline processes a query through its various agents.
    """
    hub = get_websocket_hub()

    # Validate token before accepting connection
    user_id = await validate_ws_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    client_id = await hub.connect(websocket, user_id)

    # Subscribe to RAG pipeline topic
    if session_id:
        topic = f"rag:pipeline:{session_id}"
    else:
        topic = "rag:pipeline:*"

    await hub.subscribe(client_id, topic)

    try:
        while True:
            try:
                # Receive keepalive/ping messages
                text = await websocket.receive_text()

                try:
                    message = json.loads(text)
                except json.JSONDecodeError:
                    continue

                # Handle ping/pong for keepalive
                if message.get("type") == "ping":
                    from datetime import datetime
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in RAG pipeline WebSocket: {e}")
                break

    finally:
        await hub.disconnect(client_id)


@router.get("/stats")
async def websocket_stats():
    """Get WebSocket hub statistics.

    Returns connection count and subscription statistics for monitoring.
    """
    hub = get_websocket_hub()
    return {
        "connected_clients": hub.client_count,
        "subscriptions": hub.subscription_stats
    }
