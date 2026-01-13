"""
Unified cost logging service for all AI operations.

This service provides a single entry point for logging AI costs across all endpoints
and services, ensuring complete telemetry coverage for the AI Cost & ROI dashboard.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.config.model_pricing import calculate_cost, get_model_pricing
from src.models.ai_cost_log import AICostLog

logger = logging.getLogger(__name__)


class CostLogger:
    """
    Centralized cost logging for all AI operations.

    This service logs to the ai_cost_logs table and optionally to session events,
    ensuring all AI costs are tracked in the unified cost dashboard.
    """

    def __init__(self):
        self.db = get_db()

    async def log_ai_operation(
        self,
        operation_type: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None,
        conversation_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[AICostLog]:
        """
        Log any AI operation to the unified cost system.

        Args:
            operation_type: Type of operation (chat, streaming, analysis, background, rag, etc.)
            model: The AI model used
            input_tokens: Number of input tokens consumed
            output_tokens: Number of output tokens generated
            user_id: Optional user ID (None for system/background operations)
            session_id: Optional AI session ID for session tracking
            conversation_id: Optional chat conversation ID
            metadata: Optional additional metadata (endpoint, service name, etc.)

        Returns:
            The created AICostLog record, or None if logging failed
        """
        cost_usd = calculate_cost(model, input_tokens, output_tokens)
        total_tokens = input_tokens + output_tokens

        try:
            async with self.db.session() as session:
                # Create cost log record
                cost_log = AICostLog(
                    user_id=str(user_id) if user_id else "system",
                    conversation_id=conversation_id,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    cost_usd=cost_usd,
                    model=model,
                )
                session.add(cost_log)
                await session.flush()

                # If session_id provided, also log to session events
                if session_id:
                    await self._log_to_session(
                        session,
                        session_id,
                        operation_type,
                        model,
                        input_tokens,
                        output_tokens,
                        cost_usd,
                        metadata,
                    )

                logger.debug(
                    f"Logged AI cost: {operation_type}, model={model}, "
                    f"tokens={total_tokens}, cost=${float(cost_usd):.6f}"
                )

                return cost_log

        except Exception as e:
            logger.error(f"Failed to log AI cost: {e}")
            return None

    async def _log_to_session(
        self,
        db_session: AsyncSession,
        session_id: int,
        operation_type: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Decimal,
        metadata: Optional[Dict[str, Any]],
    ) -> None:
        """
        Log cost to an active AI session.

        Args:
            db_session: SQLAlchemy async session
            session_id: AI session ID
            operation_type: Type of operation
            model: Model name
            input_tokens: Input token count
            output_tokens: Output token count
            cost_usd: Calculated cost
            metadata: Additional metadata
        """
        try:
            from src.models.ai_session import AISession, AISessionEvent

            # Get the session
            stmt = select(AISession).where(AISession.id == session_id)
            result = await db_session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session:
                logger.warning(f"Session {session_id} not found for cost logging")
                return

            # Create session event
            event = AISessionEvent(
                session_id=session_id,
                event_type="ai_query",
                event_data={
                    "operation_type": operation_type,
                    "model": model,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost_usd": float(cost_usd),
                    **(metadata or {}),
                },
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost_usd,
                model=model,
                action_type=operation_type,
            )
            db_session.add(event)

            # Update session totals
            ai_session.total_input_tokens += input_tokens
            ai_session.total_output_tokens += output_tokens
            ai_session.total_tokens += (input_tokens + output_tokens)
            ai_session.total_cost_usd = Decimal(str(ai_session.total_cost_usd)) + cost_usd
            ai_session.total_events += 1
            ai_session.ai_query_count += 1
            ai_session.last_activity_at = datetime.now(timezone.utc)

        except Exception as e:
            logger.error(f"Failed to log to session {session_id}: {e}")

    async def log_streaming_complete(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None,
        conversation_id: Optional[int] = None,
        provider: Optional[str] = None,
        duration_ms: Optional[int] = None,
    ) -> Optional[AICostLog]:
        """
        Log cost when a streaming response completes.

        Args:
            model: The AI model used
            input_tokens: Total input tokens for the stream
            output_tokens: Total output tokens generated
            user_id: Optional user ID
            session_id: Optional AI session ID
            conversation_id: Optional chat conversation ID
            provider: AI provider name (anthropic, openai, google, etc.)
            duration_ms: Total streaming duration in milliseconds

        Returns:
            The created AICostLog record
        """
        return await self.log_ai_operation(
            operation_type="streaming_chat",
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            user_id=user_id,
            session_id=session_id,
            conversation_id=conversation_id,
            metadata={
                "provider": provider,
                "duration_ms": duration_ms,
            },
        )

    async def log_analysis(
        self,
        analysis_type: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: Optional[int] = None,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
    ) -> Optional[AICostLog]:
        """
        Log cost for AI analysis operations.

        Args:
            analysis_type: Type of analysis (device, performance, cost, etc.)
            model: The AI model used
            input_tokens: Input tokens
            output_tokens: Output tokens
            user_id: User ID performing the analysis
            target_id: ID of the target being analyzed
            target_type: Type of target (device, network, etc.)

        Returns:
            The created AICostLog record
        """
        return await self.log_ai_operation(
            operation_type=f"{analysis_type}_analysis",
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            user_id=user_id,
            metadata={
                "target_id": target_id,
                "target_type": target_type,
            },
        )

    async def log_background_job(
        self,
        job_name: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        job_metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[AICostLog]:
        """
        Log cost for background/scheduled AI jobs.

        Args:
            job_name: Name of the background job
            model: The AI model used
            input_tokens: Input tokens
            output_tokens: Output tokens
            job_metadata: Additional job metadata

        Returns:
            The created AICostLog record
        """
        return await self.log_ai_operation(
            operation_type="background_job",
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            user_id=None,  # System operation
            metadata={
                "job_name": job_name,
                **(job_metadata or {}),
            },
        )

    async def log_rag_query(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None,
        query_type: Optional[str] = None,
        sources_used: Optional[int] = None,
    ) -> Optional[AICostLog]:
        """
        Log cost for RAG/knowledge queries.

        Args:
            model: The AI model used
            input_tokens: Input tokens
            output_tokens: Output tokens
            user_id: User ID
            session_id: AI session ID
            query_type: Type of RAG query
            sources_used: Number of knowledge sources retrieved

        Returns:
            The created AICostLog record
        """
        return await self.log_ai_operation(
            operation_type="rag_query",
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            user_id=user_id,
            session_id=session_id,
            metadata={
                "query_type": query_type,
                "sources_used": sources_used,
            },
        )

    async def log_embedding(
        self,
        model: str,
        token_count: int,
        user_id: Optional[int] = None,
        text_count: Optional[int] = None,
    ) -> Optional[AICostLog]:
        """
        Log cost for embedding generation.

        Args:
            model: The embedding model used
            token_count: Total tokens embedded
            user_id: User ID
            text_count: Number of texts embedded

        Returns:
            The created AICostLog record
        """
        return await self.log_ai_operation(
            operation_type="embedding",
            model=model,
            input_tokens=token_count,
            output_tokens=0,  # Embeddings don't have output tokens
            user_id=user_id,
            metadata={
                "text_count": text_count,
            },
        )

    async def log_incident_correlation(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        incident_id: Optional[int] = None,
        alert_count: Optional[int] = None,
    ) -> Optional[AICostLog]:
        """
        Log cost for incident correlation analysis.

        Args:
            model: The AI model used
            input_tokens: Input tokens
            output_tokens: Output tokens
            incident_id: Related incident ID
            alert_count: Number of alerts correlated

        Returns:
            The created AICostLog record
        """
        return await self.log_ai_operation(
            operation_type="incident_correlation",
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            user_id=None,  # System operation
            metadata={
                "incident_id": incident_id,
                "alert_count": alert_count,
            },
        )


# Global singleton
_cost_logger: Optional[CostLogger] = None


def get_cost_logger() -> CostLogger:
    """Get the cost logger singleton."""
    global _cost_logger
    if _cost_logger is None:
        _cost_logger = CostLogger()
    return _cost_logger
