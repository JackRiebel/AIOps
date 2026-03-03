"""
Atomic session management with database-level locking.

This module provides thread-safe session management operations
using SELECT FOR UPDATE for database-level locking to prevent
race conditions in concurrent session operations.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

from sqlalchemy import select, and_

from src.config.database import get_db
from src.models.ai_session import AISession, AISessionEvent

logger = logging.getLogger(__name__)


@dataclass
class SessionEvent:
    """Structured session event for logging."""
    event_type: str
    event_data: Dict[str, Any] = field(default_factory=dict)
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    model: Optional[str] = None
    timestamp: Optional[datetime] = None

    # API call fields
    api_endpoint: Optional[str] = None
    api_method: Optional[str] = None
    api_status: Optional[int] = None
    api_duration_ms: Optional[int] = None

    # Navigation fields
    page_path: Optional[str] = None
    element_id: Optional[str] = None
    element_type: Optional[str] = None

    # ROI tracking
    duration_ms: Optional[int] = None
    action_type: Optional[str] = None
    baseline_minutes: Optional[float] = None
    time_saved_minutes: Optional[float] = None


class AtomicSessionManager:
    """Thread-safe session management with atomic operations.

    Uses database-level locking (SELECT FOR UPDATE) to ensure
    atomic operations on sessions and prevent race conditions.
    """

    def __init__(self):
        """Initialize the session manager."""
        self.db = get_db()

    async def start_session_atomic(
        self,
        user_id: int,
        name: Optional[str] = None,
        session_type: Optional[str] = None,
    ) -> AISession:
        """Start a new session atomically, ending any existing active sessions.

        Uses SELECT FOR UPDATE to lock existing active sessions before
        creating a new one, preventing race conditions.

        Args:
            user_id: User ID to create session for
            name: Optional session name
            session_type: Optional session type classification

        Returns:
            Newly created AISession
        """
        async with self.db.session() as session:
            # Use SELECT FOR UPDATE to lock existing active sessions
            stmt = select(AISession).where(
                and_(
                    AISession.user_id == user_id,
                    AISession.status == "active"
                )
            ).with_for_update(skip_locked=True)

            result = await session.execute(stmt)
            existing_sessions = result.scalars().all()

            # End any existing active sessions
            for existing in existing_sessions:
                existing.status = "abandoned"
                existing.ended_at = datetime.now(timezone.utc)
                logger.info(f"Abandoned existing session {existing.id} for user {user_id}")

            # Create new session
            session_name = name or f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            new_session = AISession(
                user_id=user_id,
                name=session_name,
                status="active",
                session_type=session_type,
            )
            session.add(new_session)
            await session.commit()
            await session.refresh(new_session)

            logger.info(f"Created new session {new_session.id} for user {user_id}")
            return new_session

    async def get_active_session(self, user_id: int) -> Optional[AISession]:
        """Get the current active session for a user.

        Args:
            user_id: User ID to get session for

        Returns:
            Active AISession or None if no active session
        """
        async with self.db.session() as session:
            stmt = select(AISession).where(
                and_(
                    AISession.user_id == user_id,
                    AISession.status == "active"
                )
            ).order_by(AISession.started_at.desc())

            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    async def get_or_create_session(
        self,
        user_id: int,
        name: Optional[str] = None,
    ) -> AISession:
        """Get existing active session or create new one.

        Args:
            user_id: User ID
            name: Optional session name for new session

        Returns:
            Active AISession (existing or new)
        """
        existing = await self.get_active_session(user_id)
        if existing:
            return existing
        return await self.start_session_atomic(user_id, name)

    async def end_session_atomic(
        self,
        session_id: int,
        status: str = "completed",
    ) -> Optional[AISession]:
        """End a session atomically.

        Args:
            session_id: Session ID to end
            status: Final status (completed, abandoned)

        Returns:
            Updated AISession or None if not found
        """
        async with self.db.session() as session:
            # Lock the session for update
            stmt = select(AISession).where(
                AISession.id == session_id
            ).with_for_update()

            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session:
                return None

            ai_session.status = status
            ai_session.ended_at = datetime.now(timezone.utc)

            # Calculate total duration
            if ai_session.started_at:
                duration = datetime.now(timezone.utc) - ai_session.started_at.replace(tzinfo=timezone.utc)
                ai_session.total_duration_ms = int(duration.total_seconds() * 1000)

            await session.commit()
            await session.refresh(ai_session)

            logger.info(f"Ended session {session_id} with status {status}")
            return ai_session

    async def log_event_atomic(
        self,
        session_id: int,
        event: SessionEvent,
    ) -> Optional[AISessionEvent]:
        """Log a single event atomically.

        Args:
            session_id: Session ID to log event for
            event: Event to log

        Returns:
            Created AISessionEvent or None if session not found/inactive
        """
        async with self.db.session() as session:
            # Lock session for update
            stmt = select(AISession).where(
                AISession.id == session_id
            ).with_for_update()

            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session or ai_session.status != "active":
                logger.warning(f"Cannot log event to session {session_id}: session not active")
                return None

            # Create event
            db_event = AISessionEvent(
                session_id=session_id,
                event_type=event.event_type,
                event_data=event.event_data,
                input_tokens=event.input_tokens,
                output_tokens=event.output_tokens,
                cost_usd=Decimal(str(event.cost_usd)) if event.cost_usd else None,
                model=event.model,
                timestamp=event.timestamp or datetime.now(timezone.utc),
                api_endpoint=event.api_endpoint,
                api_method=event.api_method,
                api_status=event.api_status,
                api_duration_ms=event.api_duration_ms,
                page_path=event.page_path,
                element_id=event.element_id,
                element_type=event.element_type,
                duration_ms=event.duration_ms,
                action_type=event.action_type,
                baseline_minutes=Decimal(str(event.baseline_minutes)) if event.baseline_minutes else None,
                time_saved_minutes=Decimal(str(event.time_saved_minutes)) if event.time_saved_minutes else None,
            )
            session.add(db_event)

            # Update session counters
            self._update_session_counters(ai_session, event)
            ai_session.last_activity_at = datetime.now(timezone.utc)

            await session.commit()
            await session.refresh(db_event)

            return db_event

    async def log_events_atomic(
        self,
        session_id: int,
        events: List[SessionEvent],
    ) -> int:
        """Log multiple events atomically.

        All events are logged in a single transaction with the
        session locked to prevent race conditions.

        Args:
            session_id: Session ID to log events for
            events: List of events to log

        Returns:
            Number of events successfully logged
        """
        if not events:
            return 0

        async with self.db.session() as session:
            # Lock session for update
            stmt = select(AISession).where(
                AISession.id == session_id
            ).with_for_update()

            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session or ai_session.status != "active":
                logger.warning(f"Cannot log events to session {session_id}: session not active")
                return 0

            logged_count = 0
            for event in events:
                db_event = AISessionEvent(
                    session_id=session_id,
                    event_type=event.event_type,
                    event_data=event.event_data,
                    input_tokens=event.input_tokens,
                    output_tokens=event.output_tokens,
                    cost_usd=Decimal(str(event.cost_usd)) if event.cost_usd else None,
                    model=event.model,
                    timestamp=event.timestamp or datetime.now(timezone.utc),
                    api_endpoint=event.api_endpoint,
                    api_method=event.api_method,
                    api_status=event.api_status,
                    api_duration_ms=event.api_duration_ms,
                    page_path=event.page_path,
                    element_id=event.element_id,
                    element_type=event.element_type,
                    duration_ms=event.duration_ms,
                    action_type=event.action_type,
                    baseline_minutes=Decimal(str(event.baseline_minutes)) if event.baseline_minutes else None,
                    time_saved_minutes=Decimal(str(event.time_saved_minutes)) if event.time_saved_minutes else None,
                )
                session.add(db_event)
                logged_count += 1

                # Update session counters
                self._update_session_counters(ai_session, event)

            ai_session.last_activity_at = datetime.now(timezone.utc)
            await session.commit()

            logger.debug(f"Logged {logged_count} events to session {session_id}")
            return logged_count

    def _update_session_counters(
        self,
        session: AISession,
        event: SessionEvent,
    ) -> None:
        """Update session counters based on event type.

        Args:
            session: AISession to update
            event: Event that was logged
        """
        session.total_events += 1

        # Map event types to counter fields
        counter_map = {
            "ai_query": "ai_query_count",
            "ai_response": "ai_query_count",  # Count responses as queries too
            "api_call": "api_call_count",
            "navigation": "navigation_count",
            "click": "click_count",
            "edit_action": "edit_action_count",
            "error": "error_count",
            "warning": "error_count",  # Count warnings as errors
        }

        counter_name = counter_map.get(event.event_type)
        if counter_name:
            current = getattr(session, counter_name, 0) or 0
            setattr(session, counter_name, current + 1)

        # Update token totals
        if event.input_tokens:
            session.total_input_tokens = (session.total_input_tokens or 0) + event.input_tokens
        if event.output_tokens:
            session.total_output_tokens = (session.total_output_tokens or 0) + event.output_tokens
        if event.input_tokens or event.output_tokens:
            input_t = event.input_tokens or 0
            output_t = event.output_tokens or 0
            session.total_tokens = (session.total_tokens or 0) + input_t + output_t

        # Update cost total
        if event.cost_usd:
            current_cost = session.total_cost_usd or Decimal("0")
            session.total_cost_usd = current_cost + Decimal(str(event.cost_usd))

        # Update time saved
        if event.time_saved_minutes:
            current_saved = session.time_saved_minutes or Decimal("0")
            session.time_saved_minutes = current_saved + Decimal(str(event.time_saved_minutes))

    async def update_session_summary(
        self,
        session_id: int,
        summary: Dict[str, Any],
    ) -> Optional[AISession]:
        """Update session AI summary.

        Args:
            session_id: Session ID
            summary: AI-generated summary data

        Returns:
            Updated AISession or None if not found
        """
        async with self.db.session() as session:
            stmt = select(AISession).where(
                AISession.id == session_id
            ).with_for_update()

            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session:
                return None

            ai_session.ai_summary = summary
            await session.commit()
            await session.refresh(ai_session)

            return ai_session

    async def update_session_metrics(
        self,
        session_id: int,
        avg_response_time_ms: Optional[int] = None,
        slowest_query_ms: Optional[int] = None,
        efficiency_score: Optional[int] = None,
        complexity_score: Optional[int] = None,
        roi_percentage: Optional[float] = None,
        manual_cost_estimate_usd: Optional[float] = None,
    ) -> Optional[AISession]:
        """Update session performance and ROI metrics.

        Args:
            session_id: Session ID
            avg_response_time_ms: Average AI response time
            slowest_query_ms: Slowest query time
            efficiency_score: 0-100 efficiency score
            complexity_score: 1-5 complexity score
            roi_percentage: ROI percentage
            manual_cost_estimate_usd: Manual cost estimate

        Returns:
            Updated AISession or None if not found
        """
        async with self.db.session() as session:
            stmt = select(AISession).where(
                AISession.id == session_id
            ).with_for_update()

            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session:
                return None

            if avg_response_time_ms is not None:
                ai_session.avg_response_time_ms = avg_response_time_ms
            if slowest_query_ms is not None:
                ai_session.slowest_query_ms = slowest_query_ms
            if efficiency_score is not None:
                ai_session.efficiency_score = efficiency_score
            if complexity_score is not None:
                ai_session.complexity_score = complexity_score
            if roi_percentage is not None:
                ai_session.roi_percentage = Decimal(str(roi_percentage))
            if manual_cost_estimate_usd is not None:
                ai_session.manual_cost_estimate_usd = Decimal(str(manual_cost_estimate_usd))

            await session.commit()
            await session.refresh(ai_session)

            return ai_session

    async def link_incident(
        self,
        session_id: int,
        incident_id: int,
        resolved: bool = False,
        resolution_time_minutes: Optional[float] = None,
    ) -> Optional[AISession]:
        """Link session to an incident.

        Args:
            session_id: Session ID
            incident_id: Incident ID to link
            resolved: Whether incident was resolved
            resolution_time_minutes: Time to resolve

        Returns:
            Updated AISession or None if not found
        """
        async with self.db.session() as session:
            stmt = select(AISession).where(
                AISession.id == session_id
            ).with_for_update()

            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session:
                return None

            ai_session.incident_id = incident_id
            ai_session.incident_resolved = resolved
            if resolution_time_minutes is not None:
                ai_session.resolution_time_minutes = Decimal(str(resolution_time_minutes))

            await session.commit()
            await session.refresh(ai_session)

            return ai_session


# Singleton instance
_session_manager: Optional[AtomicSessionManager] = None


def get_session_manager() -> AtomicSessionManager:
    """Get the singleton AtomicSessionManager instance."""
    global _session_manager
    if _session_manager is None:
        _session_manager = AtomicSessionManager()
    return _session_manager
