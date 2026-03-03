"""
Unified cost logger for all AI operations.

This module provides a single entry point for logging all AI costs,
ensuring consistent tracking across providers and operations.
"""

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from datetime import datetime, timezone

from src.config.model_pricing import calculate_cost

logger = logging.getLogger(__name__)


@dataclass
class CostEntry:
    """Structured cost entry for logging."""
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal

    # Attribution
    user_id: Optional[int] = None
    session_id: Optional[int] = None
    conversation_id: Optional[int] = None

    # Source tracking
    operation_type: str = "chat"  # "chat", "streaming", "analysis", "background"
    source_endpoint: Optional[str] = None

    @property
    def is_valid(self) -> bool:
        """Validate the cost entry."""
        return (
            self.input_tokens >= 0 and
            self.output_tokens >= 0 and
            self.cost_usd >= 0 and
            self.model is not None
        )

    @classmethod
    def from_usage(
        cls,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None,
        conversation_id: Optional[int] = None,
        operation_type: str = "chat",
        source_endpoint: Optional[str] = None,
    ) -> "CostEntry":
        """Create a cost entry from token usage, calculating cost automatically."""
        cost = calculate_cost(model, input_tokens, output_tokens)
        return cls(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            user_id=user_id,
            session_id=session_id,
            conversation_id=conversation_id,
            operation_type=operation_type,
            source_endpoint=source_endpoint,
        )


class UnifiedCostLogger:
    """Single entry point for all cost logging."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        from src.config.database import get_db
        self.db = get_db()
        self._initialized = True

    async def log(self, entry: CostEntry) -> Optional[int]:
        """Log a cost entry to database.

        Args:
            entry: CostEntry with all cost information

        Returns:
            ID of the created cost log, or None if failed
        """
        if not entry.is_valid:
            logger.warning(f"Invalid cost entry: {entry}")
            return None

        try:
            from src.models.ai_cost_log import AICostLog

            async with self.db.session() as session:
                cost_log = AICostLog(
                    user_id=str(entry.user_id) if entry.user_id else "system",
                    conversation_id=entry.conversation_id,
                    input_tokens=entry.input_tokens,
                    output_tokens=entry.output_tokens,
                    total_tokens=entry.input_tokens + entry.output_tokens,
                    cost_usd=float(entry.cost_usd),
                    model=entry.model,
                )
                session.add(cost_log)

                # Also update session if provided
                if entry.session_id:
                    await self._update_session_cost(session, entry)

                await session.commit()
                await session.refresh(cost_log)
                return cost_log.id

        except Exception as e:
            logger.error(f"Failed to log cost: {e}")
            return None

    async def _update_session_cost(self, session, entry: CostEntry):
        """Update session cost totals."""
        try:
            from sqlalchemy import select
            from src.models.ai_session import AISession

            stmt = select(AISession).where(AISession.id == entry.session_id)
            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if ai_session:
                ai_session.total_input_tokens = (
                    (ai_session.total_input_tokens or 0) + entry.input_tokens
                )
                ai_session.total_output_tokens = (
                    (ai_session.total_output_tokens or 0) + entry.output_tokens
                )
                ai_session.total_tokens = (
                    (ai_session.total_tokens or 0) +
                    entry.input_tokens + entry.output_tokens
                )
                ai_session.total_cost_usd = (
                    Decimal(str(ai_session.total_cost_usd or 0)) + entry.cost_usd
                )
                ai_session.last_activity_at = datetime.now(timezone.utc)

        except Exception as e:
            logger.warning(f"Failed to update session cost: {e}")

    async def log_chat(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None,
        conversation_id: Optional[int] = None,
    ) -> Optional[int]:
        """Convenience method for logging chat costs."""
        entry = CostEntry.from_usage(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            user_id=user_id,
            session_id=session_id,
            conversation_id=conversation_id,
            operation_type="chat",
        )
        return await self.log(entry)

    async def log_streaming(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None,
    ) -> Optional[int]:
        """Convenience method for logging streaming costs."""
        entry = CostEntry.from_usage(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            user_id=user_id,
            session_id=session_id,
            operation_type="streaming",
        )
        return await self.log(entry)

    async def log_background(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        operation_name: str,
    ) -> Optional[int]:
        """Convenience method for logging background operation costs."""
        entry = CostEntry.from_usage(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            operation_type="background",
            source_endpoint=operation_name,
        )
        return await self.log(entry)


# Singleton access
_cost_logger: Optional[UnifiedCostLogger] = None


def get_cost_logger() -> UnifiedCostLogger:
    """Get the singleton UnifiedCostLogger instance."""
    global _cost_logger
    if _cost_logger is None:
        _cost_logger = UnifiedCostLogger()
    return _cost_logger
