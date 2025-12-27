"""AI Session tracking service for comprehensive activity logging and summarization."""

import logging
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select, update, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.ai_session import AISession, AISessionEvent
from src.models.incident import Incident, IncidentStatus
from src.config.database import get_db
from src.config.settings import get_settings
from src.config.model_pricing import calculate_cost  # Centralized pricing

logger = logging.getLogger(__name__)

# Inactivity timeout for auto-stop (15 minutes)
INACTIVITY_TIMEOUT_MINUTES = 15


class AISessionService:
    """Service for managing AI sessions and activity tracking."""

    def __init__(self):
        self.db = get_db()

    async def start_session(self, user_id: int, name: Optional[str] = None) -> AISession:
        """Start a new AI session for a user."""
        async with self.db.session() as session:
            # Check for existing active session and end it
            existing = await self._get_active_session(session, user_id)
            if existing:
                await self._end_session_internal(session, existing.id, "abandoned")

            # Create new session
            ai_session = AISession(
                user_id=user_id,
                name=name or f"Session {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}",
                status="active",
            )
            session.add(ai_session)
            await session.flush()  # Get the ID

            logger.info(f"Started AI session {ai_session.id} for user {user_id}")
            return ai_session

    async def stop_session(self, session_id: int, user_id: int) -> Optional[AISession]:
        """Stop an AI session and generate summary."""
        async with self.db.session() as session:
            ai_session = await self._get_session_by_id(session, session_id)
            if not ai_session or ai_session.user_id != user_id:
                return None

            if ai_session.status != "active":
                return ai_session  # Already stopped

            return await self._end_session_internal(session, session_id, "completed")

    async def _end_session_internal(
        self, session: AsyncSession, session_id: int, status: str
    ) -> AISession:
        """Internal method to end a session."""
        ai_session = await self._get_session_by_id(session, session_id)
        if not ai_session:
            raise ValueError(f"Session {session_id} not found")

        ai_session.status = status
        ai_session.ended_at = datetime.now(timezone.utc)

        # Get events for ROI calculation
        stmt = select(AISessionEvent).where(
            AISessionEvent.session_id == session_id
        ).order_by(AISessionEvent.timestamp)
        result = await session.execute(stmt)
        events = list(result.scalars().all())

        # Calculate ROI metrics
        await self._calculate_and_store_roi(session, ai_session, events)

        # Detect and link incidents
        await self._detect_and_link_incident(session, ai_session, events)

        # Generate AI summary
        summary = await self._generate_summary(session, ai_session)
        ai_session.ai_summary = summary

        # Update session name if AI generated one
        if summary.get("session_name"):
            ai_session.name = summary["session_name"]
            logger.info(f"AI generated session name: {summary['session_name']}")

        logger.info(f"Ended AI session {session_id} with status {status}")
        return ai_session

    async def _calculate_and_store_roi(
        self,
        session: AsyncSession,
        ai_session: AISession,
        events: List[AISessionEvent]
    ) -> None:
        """Calculate and store ROI metrics for the session."""
        try:
            from src.services.roi_calculator import get_roi_calculator

            calculator = get_roi_calculator()
            metrics = calculator.calculate_session_roi(ai_session, events)

            # Store calculated ROI fields
            ai_session.time_saved_minutes = Decimal(str(metrics.time_saved_minutes))
            ai_session.roi_percentage = Decimal(str(metrics.roi_percentage))
            ai_session.manual_cost_estimate_usd = Decimal(str(metrics.manual_cost_usd))
            ai_session.session_type = metrics.session_type
            ai_session.complexity_score = metrics.complexity_score
            ai_session.efficiency_score = metrics.efficiency_score
            ai_session.avg_response_time_ms = metrics.avg_response_time_ms
            ai_session.slowest_query_ms = metrics.slowest_query_ms
            ai_session.total_duration_ms = metrics.total_duration_ms
            ai_session.cost_breakdown = metrics.cost_breakdown

            logger.info(
                f"Session {ai_session.id} ROI: {metrics.roi_percentage:.1f}%, "
                f"time saved: {metrics.time_saved_minutes:.1f}min, "
                f"efficiency: {metrics.efficiency_score}/100"
            )

        except Exception as e:
            logger.error(f"Error calculating ROI for session {ai_session.id}: {e}")

    async def _detect_and_link_incident(
        self,
        session: AsyncSession,
        ai_session: AISession,
        events: List[AISessionEvent]
    ) -> Optional[int]:
        """Detect if session is related to an incident and link them."""
        try:
            # Patterns to detect incident references
            incident_patterns = [
                (r"incident[:\s#]+(\d+)", "incident_id"),
                (r"alert[:\s#]+([A-Z0-9-]+)", "alert_id"),
                (r"ticket[:\s#]+([A-Z0-9-]+)", "ticket_id"),
                (r"#(\d{4,})", "ticket_number"),
                (r"INC(\d+)", "incident_number"),
            ]

            detected_ids = []

            for event in events:
                if event.event_type != "ai_query":
                    continue

                query = str((event.event_data or {}).get("query", ""))
                response = str((event.event_data or {}).get("response", ""))
                combined_text = f"{query} {response}"

                for pattern, pattern_type in incident_patterns:
                    matches = re.findall(pattern, combined_text, re.IGNORECASE)
                    for match in matches:
                        detected_ids.append((match, pattern_type))

            if not detected_ids:
                # Check for incident-related keywords without explicit ID
                incident_keywords = ["incident", "outage", "down", "critical alert", "emergency"]
                for event in events:
                    query = str((event.event_data or {}).get("query", "")).lower()
                    if any(kw in query for kw in incident_keywords):
                        # Mark as incident response even without explicit ID
                        ai_session.session_type = "incident_response"
                        break
                return None

            # Try to find matching incident in database
            for detected_id, pattern_type in detected_ids:
                if pattern_type in ("incident_id", "incident_number"):
                    try:
                        incident_id = int(detected_id.replace("INC", ""))
                        stmt = select(Incident).where(Incident.id == incident_id)
                        result = await session.execute(stmt)
                        incident = result.scalar_one_or_none()

                        if incident:
                            await self._link_session_to_incident(
                                session, ai_session, incident
                            )
                            return incident.id
                    except ValueError:
                        continue

            # If no exact match, log the detection for manual linking
            logger.info(
                f"Session {ai_session.id} referenced incident-like IDs: {detected_ids}, "
                "but no matching incident found in database"
            )

            return None

        except Exception as e:
            logger.error(f"Error detecting incident for session {ai_session.id}: {e}")
            return None

    async def _link_session_to_incident(
        self,
        session: AsyncSession,
        ai_session: AISession,
        incident: Incident
    ) -> None:
        """Link an AI session to an incident and calculate MTTR impact."""
        ai_session.incident_id = incident.id
        ai_session.session_type = "incident_response"

        # Check if incident was resolved during this session
        if incident.status in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED):
            ai_session.incident_resolved = True

            # Calculate resolution time if incident has timing data
            if incident.start_time and incident.end_time:
                resolution_delta = incident.end_time - incident.start_time
                ai_session.resolution_time_minutes = Decimal(
                    str(resolution_delta.total_seconds() / 60)
                )
            elif incident.start_time and ai_session.ended_at:
                # Use session end time as resolution time
                resolution_delta = ai_session.ended_at - incident.start_time
                ai_session.resolution_time_minutes = Decimal(
                    str(resolution_delta.total_seconds() / 60)
                )

        logger.info(
            f"Linked session {ai_session.id} to incident {incident.id}, "
            f"resolved: {ai_session.incident_resolved}"
        )

    async def link_session_to_incident_manual(
        self,
        session_id: int,
        incident_id: int,
        user_id: int,
        resolved: bool = False
    ) -> Optional[AISession]:
        """Manually link a session to an incident (for UI action)."""
        async with self.db.session() as session:
            # Get session
            ai_session = await self._get_session_by_id(session, session_id)
            if not ai_session or ai_session.user_id != user_id:
                return None

            # Get incident
            stmt = select(Incident).where(Incident.id == incident_id)
            result = await session.execute(stmt)
            incident = result.scalar_one_or_none()

            if not incident:
                return None

            ai_session.incident_id = incident_id
            ai_session.incident_resolved = resolved

            if resolved and incident.start_time:
                end_time = ai_session.ended_at or datetime.now(timezone.utc)
                resolution_delta = end_time - incident.start_time
                ai_session.resolution_time_minutes = Decimal(
                    str(resolution_delta.total_seconds() / 60)
                )

            return ai_session

    async def get_active_session(self, user_id: int) -> Optional[AISession]:
        """Get the current active session for a user."""
        async with self.db.session() as session:
            return await self._get_active_session(session, user_id)

    async def _get_active_session(
        self, session: AsyncSession, user_id: int
    ) -> Optional[AISession]:
        """Internal method to get active session."""
        stmt = select(AISession).where(
            and_(AISession.user_id == user_id, AISession.status == "active")
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_session_by_id(
        self, session: AsyncSession, session_id: int
    ) -> Optional[AISession]:
        """Get session by ID."""
        stmt = select(AISession).where(AISession.id == session_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def log_event(
        self,
        user_id: int,
        event_type: str,
        event_data: Dict[str, Any],
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        model: Optional[str] = None,
        api_endpoint: Optional[str] = None,
        api_method: Optional[str] = None,
        api_status: Optional[int] = None,
        api_duration_ms: Optional[int] = None,
        page_path: Optional[str] = None,
        element_id: Optional[str] = None,
        element_type: Optional[str] = None,
        # ROI tracking fields
        duration_ms: Optional[int] = None,
        action_type: Optional[str] = None,
        cost_usd: Optional[float] = None,
    ) -> Optional[AISessionEvent]:
        """Log an event to the active session."""
        async with self.db.session() as session:
            ai_session = await self._get_active_session(session, user_id)
            if not ai_session:
                return None  # No active session

            # Calculate cost for AI operations if not provided
            calculated_cost = None
            if cost_usd is not None:
                calculated_cost = Decimal(str(cost_usd))
            elif input_tokens is not None and output_tokens is not None and model:
                calculated_cost = calculate_cost(model, input_tokens, output_tokens)

            # Calculate time saved if action_type provided
            time_saved = None
            baseline = None
            if action_type and duration_ms is not None:
                from src.config.roi_baselines import get_baseline
                baseline_data = get_baseline(action_type)
                baseline = Decimal(str(baseline_data.manual_minutes))
                ai_minutes = Decimal(str(duration_ms)) / Decimal(60000)
                time_saved = max(Decimal(0), baseline - ai_minutes)

            # Create event
            event = AISessionEvent(
                session_id=ai_session.id,
                event_type=event_type,
                event_data=event_data,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=calculated_cost,
                model=model,
                api_endpoint=api_endpoint,
                api_method=api_method,
                api_status=api_status,
                api_duration_ms=api_duration_ms,
                page_path=page_path,
                element_id=element_id,
                element_type=element_type,
                # ROI fields
                duration_ms=duration_ms,
                action_type=action_type,
                baseline_minutes=baseline,
                time_saved_minutes=time_saved,
            )
            session.add(event)

            # Update session counters
            ai_session.total_events += 1
            ai_session.last_activity_at = datetime.now(timezone.utc)

            # Update specific counters
            if event_type in ("ai_query", "ai_response"):
                ai_session.ai_query_count += 1
            elif event_type == "api_call":
                ai_session.api_call_count += 1
            elif event_type == "navigation":
                ai_session.navigation_count += 1
            elif event_type == "click":
                ai_session.click_count += 1
            elif event_type == "edit_action":
                ai_session.edit_action_count += 1
            elif event_type == "error":
                ai_session.error_count += 1

            # Update token/cost totals for AI operations
            if input_tokens:
                ai_session.total_input_tokens += input_tokens
            if output_tokens:
                ai_session.total_output_tokens += output_tokens
            if input_tokens and output_tokens:
                ai_session.total_tokens += (input_tokens + output_tokens)
            if calculated_cost:
                ai_session.total_cost_usd = Decimal(str(ai_session.total_cost_usd)) + calculated_cost

            return event

    async def get_session_details(
        self, session_id: int, user_id: int, is_admin: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Get full session details with events."""
        async with self.db.session() as session:
            stmt = select(AISession).options(
                selectinload(AISession.events)
            ).where(AISession.id == session_id)

            # RBAC: non-admins can only see their own sessions
            if not is_admin:
                stmt = stmt.where(AISession.user_id == user_id)

            result = await session.execute(stmt)
            ai_session = result.scalar_one_or_none()

            if not ai_session:
                return None

            return self._session_to_dict(ai_session, include_events=True)

    async def list_sessions(
        self,
        user_id: int,
        is_admin: bool = False,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List sessions for a user (or all for admin)."""
        async with self.db.session() as session:
            stmt = select(AISession).order_by(desc(AISession.started_at))

            # RBAC
            if not is_admin:
                stmt = stmt.where(AISession.user_id == user_id)

            if status:
                stmt = stmt.where(AISession.status == status)

            stmt = stmt.limit(limit).offset(offset)

            result = await session.execute(stmt)
            sessions = result.scalars().all()

            return [self._session_to_dict(s) for s in sessions]

    async def update_session_name(
        self, session_id: int, user_id: int, name: str
    ) -> Optional[AISession]:
        """Update the name/tag of a session."""
        async with self.db.session() as session:
            ai_session = await self._get_session_by_id(session, session_id)
            if not ai_session or ai_session.user_id != user_id:
                return None

            ai_session.name = name
            return ai_session

    async def check_inactive_sessions(self) -> List[int]:
        """Check for and auto-stop inactive sessions. Returns list of stopped session IDs."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=INACTIVITY_TIMEOUT_MINUTES)
        stopped = []

        async with self.db.session() as session:
            stmt = select(AISession).where(
                and_(
                    AISession.status == "active",
                    AISession.last_activity_at < cutoff
                )
            )
            result = await session.execute(stmt)
            inactive_sessions = result.scalars().all()

            for ai_session in inactive_sessions:
                await self._end_session_internal(session, ai_session.id, "completed")
                stopped.append(ai_session.id)
                logger.info(f"Auto-stopped inactive session {ai_session.id}")

        return stopped

    async def _generate_summary(
        self, session: AsyncSession, ai_session: AISession
    ) -> Dict[str, Any]:
        """Generate AI summary for a session."""
        import json as json_module
        try:
            import anthropic
            settings = get_settings()

            # Get all events for the session
            stmt = select(AISessionEvent).where(
                AISessionEvent.session_id == ai_session.id
            ).order_by(AISessionEvent.timestamp)
            result = await session.execute(stmt)
            events = result.scalars().all()

            logger.info(f"Generating summary for session {ai_session.id} with {len(events)} events")

            # Build event log for AI - include rich context
            event_log = []
            pages_visited = set()
            api_endpoints_called = set()
            ai_conversations = []  # Store full Q&A pairs

            for e in events:
                event_entry = {
                    "time": e.timestamp.strftime("%H:%M:%S"),
                    "type": e.event_type,
                }

                # Include event data for context
                if e.event_data:
                    # For AI queries, capture both query and response
                    if e.event_type == "ai_query" and isinstance(e.event_data, dict):
                        query = e.event_data.get("query", "")
                        response = e.event_data.get("response", e.event_data.get("response_preview", ""))
                        model = e.event_data.get("model", "")
                        if query:
                            event_entry["query"] = query[:300]  # Include in event log
                            if response:
                                event_entry["response"] = response[:500]  # Include response in event log
                            # Store full conversation for summary
                            ai_conversations.append({
                                "user": query[:500],
                                "assistant": response[:800] if response else "",
                                "model": model
                            })
                    # For clicks, capture what was clicked
                    elif e.event_type == "click" and isinstance(e.event_data, dict):
                        element = e.event_data.get("element_id", e.event_data.get("element_type", ""))
                        if element:
                            event_entry["clicked"] = str(element)[:50]
                    # For navigation, capture the path
                    elif e.event_type == "navigation" and isinstance(e.event_data, dict):
                        path = e.event_data.get("path", "")
                        if path:
                            event_entry["path"] = path
                            pages_visited.add(path)

                if e.input_tokens and e.output_tokens:
                    event_entry["tokens"] = e.input_tokens + e.output_tokens

                if e.api_endpoint:
                    endpoint = e.api_endpoint.split("?")[0]  # Remove query params
                    event_entry["api"] = f"{e.api_method} {endpoint}"
                    api_endpoints_called.add(endpoint)

                if e.page_path and e.event_type != "navigation":
                    event_entry["page"] = e.page_path

                event_log.append(event_entry)

            # Calculate duration
            duration_minutes = 0
            if ai_session.ended_at and ai_session.started_at:
                duration_minutes = (ai_session.ended_at - ai_session.started_at).total_seconds() / 60

            # Format event log as proper JSON string (limit to 50 most recent events to fit context)
            event_log_json = json_module.dumps(event_log[-50:], indent=2, default=str)

            # Build a context summary for pages and APIs
            pages_summary = ", ".join(list(pages_visited)[:10]) if pages_visited else "None"
            apis_summary = ", ".join(list(api_endpoints_called)[:10]) if api_endpoints_called else "None"

            # Build AI conversation transcript
            conversation_transcript = ""
            if ai_conversations:
                for i, conv in enumerate(ai_conversations[:10], 1):  # Limit to 10 conversations
                    conversation_transcript += f"\n--- Conversation {i} ---\n"
                    conversation_transcript += f"User: {conv['user']}\n"
                    if conv['assistant']:
                        conversation_transcript += f"AI: {conv['assistant']}\n"
            else:
                conversation_transcript = "No AI conversations recorded"

            # Build summary prompt with rich context
            prompt = f"""You are analyzing an AI-assisted network operations session in Lumen (a Cisco Meraki/ThousandEyes/Splunk monitoring platform).

SESSION METRICS:
- Duration: {duration_minutes:.1f} minutes
- Total Events: {ai_session.total_events}
- AI Queries: {ai_session.ai_query_count}
- API Calls: {ai_session.api_call_count}
- Navigation Events: {ai_session.navigation_count}
- Click Events: {ai_session.click_count}
- Edit Actions: {ai_session.edit_action_count}
- Errors: {ai_session.error_count}
- Total Tokens Used: {ai_session.total_tokens:,}
- Total AI Cost: ${float(ai_session.total_cost_usd):.4f}

PAGES VISITED: {pages_summary}

API ENDPOINTS CALLED: {apis_summary}

AI CONVERSATION TRANSCRIPT (User questions and AI responses):
{conversation_transcript}

DETAILED EVENT LOG (most recent {len(event_log[-50:])} events, chronological):
{event_log_json}

Based on this session data, generate:
1. A SHORT, DESCRIPTIVE session name (3-6 words) that captures what the user was doing
2. A complete session summary

Return a JSON object with EXACTLY this format:
{{
    "session_name": "Short descriptive name for this session (3-6 words)",
    "outcome": "One-line summary of what was accomplished (max 100 chars)",
    "narrative": "2-3 sentence workflow narrative describing what the user did and accomplished",
    "milestones": ["Key milestone 1", "Key milestone 2", ...],
    "metrics": {{
        "duration_minutes": {duration_minutes:.1f},
        "total_cost_usd": {float(ai_session.total_cost_usd):.6f},
        "total_tokens": {ai_session.total_tokens},
        "ai_queries": {ai_session.ai_query_count},
        "api_calls": {ai_session.api_call_count},
        "estimated_manual_time_minutes": <estimate how long this would take manually without AI assistance>
    }},
    "insights": ["Actionable insight about the session", ...],
    "recommendations": ["Recommendation for future sessions", ...]
}}

Return ONLY valid JSON, no other text or markdown formatting."""

            # Call Claude for summary
            api_key = settings.anthropic_api_key
            if not api_key:
                logger.warning("No Claude API key configured, skipping AI summary")
                return self._fallback_summary(ai_session, duration_minutes)

            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-3-5-haiku-20241022",  # Use fast model for summaries
                max_tokens=1000,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}]
            )

            # Track summarization cost
            summary_input = response.usage.input_tokens
            summary_output = response.usage.output_tokens
            summary_cost = calculate_cost("claude-3-5-haiku-20241022", summary_input, summary_output)

            ai_session.summary_input_tokens = summary_input
            ai_session.summary_output_tokens = summary_output
            ai_session.summary_cost_usd = summary_cost

            # Update total cost to include summary
            ai_session.total_cost_usd = Decimal(str(ai_session.total_cost_usd)) + summary_cost

            # Parse response
            import json
            try:
                summary_text = response.content[0].text
                # Try to extract JSON from the response
                if "```json" in summary_text:
                    summary_text = summary_text.split("```json")[1].split("```")[0]
                elif "```" in summary_text:
                    summary_text = summary_text.split("```")[1].split("```")[0]
                summary = json.loads(summary_text.strip())
                return summary
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse AI summary JSON: {summary_text}")
                return self._fallback_summary(ai_session, duration_minutes)

        except Exception as e:
            logger.error(f"Error generating AI summary: {e}")
            return self._fallback_summary(ai_session, duration_minutes)

    def _fallback_summary(self, ai_session: AISession, duration_minutes: float) -> Dict[str, Any]:
        """Generate a basic summary without AI."""
        return {
            "outcome": f"Session with {ai_session.ai_query_count} AI queries and {ai_session.api_call_count} API calls",
            "narrative": f"User worked for {duration_minutes:.0f} minutes using AI assistance for network operations.",
            "milestones": [],
            "metrics": {
                "duration_minutes": duration_minutes,
                "total_cost_usd": float(ai_session.total_cost_usd),
                "total_tokens": ai_session.total_tokens,
                "ai_queries": ai_session.ai_query_count,
                "api_calls": ai_session.api_call_count,
                "estimated_manual_time_minutes": duration_minutes * 2  # Conservative estimate
            },
            "insights": [],
            "recommendations": []
        }

    def _session_to_dict(
        self, ai_session: AISession, include_events: bool = False
    ) -> Dict[str, Any]:
        """Convert session to dictionary."""
        result = {
            "id": ai_session.id,
            "user_id": ai_session.user_id,
            "name": ai_session.name,
            "status": ai_session.status,
            "started_at": ai_session.started_at.isoformat() if ai_session.started_at else None,
            "ended_at": ai_session.ended_at.isoformat() if ai_session.ended_at else None,
            "last_activity_at": ai_session.last_activity_at.isoformat() if ai_session.last_activity_at else None,
            "total_input_tokens": ai_session.total_input_tokens,
            "total_output_tokens": ai_session.total_output_tokens,
            "total_tokens": ai_session.total_tokens,
            "total_cost_usd": float(ai_session.total_cost_usd),
            "summary_cost_usd": float(ai_session.summary_cost_usd),
            "total_events": ai_session.total_events,
            "ai_query_count": ai_session.ai_query_count,
            "api_call_count": ai_session.api_call_count,
            "navigation_count": ai_session.navigation_count,
            "click_count": ai_session.click_count,
            "edit_action_count": ai_session.edit_action_count,
            "error_count": ai_session.error_count,
            "ai_summary": ai_session.ai_summary,
            # ROI fields
            "time_saved_minutes": float(ai_session.time_saved_minutes) if ai_session.time_saved_minutes else None,
            "roi_percentage": float(ai_session.roi_percentage) if ai_session.roi_percentage else None,
            "manual_cost_estimate_usd": float(ai_session.manual_cost_estimate_usd) if ai_session.manual_cost_estimate_usd else None,
            "session_type": ai_session.session_type,
            "complexity_score": ai_session.complexity_score,
            "efficiency_score": ai_session.efficiency_score,
            "avg_response_time_ms": ai_session.avg_response_time_ms,
            "slowest_query_ms": ai_session.slowest_query_ms,
            "total_duration_ms": ai_session.total_duration_ms,
            "cost_breakdown": ai_session.cost_breakdown,
            # MTTR fields
            "incident_id": ai_session.incident_id,
            "incident_resolved": ai_session.incident_resolved,
            "resolution_time_minutes": float(ai_session.resolution_time_minutes) if ai_session.resolution_time_minutes else None,
        }

        if include_events and ai_session.events:
            result["events"] = [
                {
                    "id": e.id,
                    "event_type": e.event_type,
                    "timestamp": e.timestamp.isoformat(),
                    "event_data": e.event_data,
                    "input_tokens": e.input_tokens,
                    "output_tokens": e.output_tokens,
                    "cost_usd": float(e.cost_usd) if e.cost_usd else None,
                    "model": e.model,
                    "api_endpoint": e.api_endpoint,
                    "api_method": e.api_method,
                    "api_status": e.api_status,
                    "api_duration_ms": e.api_duration_ms,
                    "page_path": e.page_path,
                    "duration_ms": e.duration_ms,
                    "action_type": e.action_type,
                    "time_saved_minutes": float(e.time_saved_minutes) if e.time_saved_minutes else None,
                }
                for e in sorted(ai_session.events, key=lambda x: x.timestamp)
            ]

        return result


# Global singleton
_session_service: Optional[AISessionService] = None


def get_ai_session_service() -> AISessionService:
    """Get the AI session service singleton."""
    global _session_service
    if _session_service is None:
        _session_service = AISessionService()
    return _session_service
