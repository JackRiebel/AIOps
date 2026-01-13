"""Event emitter for real-time Agentic RAG pipeline updates.

Enables WebSocket clients to receive live updates as the pipeline
processes through its various agents.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Callable, Awaitable

logger = logging.getLogger(__name__)


class RAGPipelineEventEmitter:
    """Emits events for RAG pipeline progress tracking.

    Events are sent to a WebSocket hub for real-time frontend updates.
    If no hub is available, events are logged but not sent.
    """

    def __init__(self, session_id: str, websocket_hub: Optional[Any] = None):
        """Initialize the event emitter.

        Args:
            session_id: Unique session/query ID for this pipeline run
            websocket_hub: WebSocket hub for broadcasting events
        """
        self.session_id = session_id
        self.hub = websocket_hub
        self.topic = f"rag:pipeline:{session_id}"
        self._start_time: Optional[datetime] = None

    async def emit(self, event_type: str, data: Optional[Dict[str, Any]] = None):
        """Emit an event to connected clients.

        Args:
            event_type: Type of event (e.g., "agent_start", "pipeline_complete")
            data: Optional event data
        """
        event = {
            "type": event_type,
            "session_id": self.session_id,
            "timestamp": datetime.utcnow().isoformat(),
            **(data or {}),
        }

        logger.debug(f"RAG pipeline event: {event_type} - {data}")

        if self.hub:
            try:
                await self.hub.broadcast(self.topic, event)
            except Exception as e:
                logger.warning(f"Failed to broadcast RAG event: {e}")

    async def pipeline_start(self, query: str):
        """Emit pipeline start event."""
        self._start_time = datetime.utcnow()
        await self.emit("pipeline_start", {
            "query": query[:200],  # Truncate for safety
        })

    async def agent_start(self, agent_name: str):
        """Emit agent start event (in frontend-compatible format)."""
        # Map RAG agent names to frontend-friendly names
        agent_labels = {
            "QueryAnalysisAgent": "Query Analysis",
            "RetrievalRouterAgent": "Retrieval Router",
            "DocumentGraderAgent": "Document Grader",
            "CorrectiveRAGAgent": "Corrective RAG",
            "SynthesisAgent": "Synthesis",
            "ReflectionAgent": "Reflection",
        }
        label = agent_labels.get(agent_name, agent_name)

        # Emit in format frontend expects
        await self.emit("agent_activity_start", {
            "agent": "knowledge",  # RAG agents are knowledge-type
            "agentId": f"rag-{agent_name.lower()}",
            "agentName": label,
            "query": None,
        })

    async def agent_complete(
        self,
        agent_name: str,
        duration_ms: float,
        result: Optional[Dict[str, Any]] = None,
    ):
        """Emit agent completion event (in frontend-compatible format)."""
        # Emit in format frontend expects
        await self.emit("agent_activity_complete", {
            "agent": "knowledge",
            "agentId": f"rag-{agent_name.lower()}",
            "success": True,
            "confidence": result.get("confidence", 0.8) if result else 0.8,
            "sources_count": result.get("sources_count", 0) if result else 0,
            "response_summary": result.get("summary") if result else None,
            "duration_ms": round(duration_ms),
        })

    async def iteration_start(self, iteration: int):
        """Emit iteration start event."""
        await self.emit("iteration_start", {
            "iteration": iteration,
        })

    async def retrieval_complete(self, chunks_count: int, strategy: str):
        """Emit retrieval completion event."""
        await self.emit("retrieval_complete", {
            "chunks_count": chunks_count,
            "strategy": strategy,
        })

    async def grading_complete(self, relevant_count: int, avg_relevance: float):
        """Emit grading completion event."""
        await self.emit("grading_complete", {
            "relevant_count": relevant_count,
            "avg_relevance": round(avg_relevance, 3),
        })

    async def web_search_triggered(self, reason: str, results_count: int):
        """Emit web search triggered event."""
        await self.emit("web_search_triggered", {
            "reason": reason,
            "results_count": results_count,
        })

    async def synthesis_complete(self, answer_length: int, citations_count: int):
        """Emit synthesis completion event."""
        await self.emit("synthesis_complete", {
            "answer_length": answer_length,
            "citations_count": citations_count,
        })

    async def reflection_complete(self, quality: str, needs_iteration: bool):
        """Emit reflection completion event."""
        await self.emit("reflection_complete", {
            "quality": quality,
            "needs_iteration": needs_iteration,
        })

    async def pipeline_complete(
        self,
        quality: str,
        iterations: int,
        citations_count: int,
    ):
        """Emit pipeline completion event."""
        total_duration_ms = 0
        if self._start_time:
            total_duration_ms = (datetime.utcnow() - self._start_time).total_seconds() * 1000

        await self.emit("pipeline_complete", {
            "total_duration_ms": round(total_duration_ms),
            "quality": quality,
            "iterations": iterations,
            "citations_count": citations_count,
        })

    async def pipeline_error(self, error: str):
        """Emit pipeline error event."""
        await self.emit("pipeline_error", {
            "error": str(error)[:500],  # Truncate for safety
        })


def get_event_emitter(session_id: str) -> RAGPipelineEventEmitter:
    """Get an event emitter for a pipeline session.

    Args:
        session_id: Unique session ID

    Returns:
        RAGPipelineEventEmitter instance
    """
    # Try to get the WebSocket hub
    hub = None
    try:
        from src.services.websocket_hub import get_websocket_hub
        hub = get_websocket_hub()
    except Exception:
        pass

    return RAGPipelineEventEmitter(session_id=session_id, websocket_hub=hub)
