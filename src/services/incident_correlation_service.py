"""Service for correlating events into incidents and generating AI insights.

Supports multiple AI providers: Anthropic, OpenAI, Google, and Cisco Circuit.
Uses whatever provider is configured in the system settings.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from src.models.incident import Event, Incident, EventSeverity, IncidentStatus, EventSource
from src.config.database import Database, get_settings
from src.services.cost_logger import get_cost_logger
from src.services.prompt_service import get_prompt, get_prompt_metadata

logger = logging.getLogger(__name__)


class IncidentCorrelationService:
    """Service for correlating events into incidents using AI.

    Supports multiple AI providers based on system configuration.
    """

    def __init__(self):
        """Initialize service. AI provider is determined at runtime from config."""
        settings = get_settings()
        self.db = Database(settings.database_url)

    async def correlate_and_create_incidents(self, events: List[Dict[str, Any]]) -> List[int]:
        """Correlate events and create/update incidents.

        Args:
            events: List of normalized event dictionaries

        Returns:
            List of incident IDs created or updated
        """
        if not events:
            return []

        # First, save all events to database
        event_ids = await self._save_events(events)

        # Get uncorrelated events from the last 24 hours
        uncorrelated_events = await self._get_uncorrelated_events(hours=24)

        if not uncorrelated_events:
            return []

        # Group events using AI
        incident_groups = await self._group_events_with_ai(uncorrelated_events)

        # Create incidents for each group
        incident_ids = []
        for group in incident_groups:
            incident_id = await self._create_or_update_incident(group)
            if incident_id:
                incident_ids.append(incident_id)

        return incident_ids

    async def _save_events(self, events: List[Dict[str, Any]]) -> List[int]:
        """Save events to database.

        Args:
            events: List of event dictionaries

        Returns:
            List of created event IDs
        """
        event_ids = []

        async with self.db.session() as session:
            for event_data in events:
                # Check if event already exists (by source_event_id)
                from sqlalchemy import select

                if event_data.get("source_event_id"):
                    result = await session.execute(
                        select(Event).where(
                            Event.source_event_id == event_data["source_event_id"],
                            Event.source == event_data["source"],
                        )
                    )
                    existing_event = result.scalar_one_or_none()
                    if existing_event:
                        continue  # Skip duplicate

                # Create new event
                event = Event(
                    source=event_data["source"],
                    source_event_id=event_data.get("source_event_id"),
                    organization=event_data["organization"],
                    event_type=event_data["event_type"],
                    severity=event_data["severity"],
                    title=event_data["title"],
                    description=event_data.get("description"),
                    timestamp=event_data["timestamp"],
                    affected_resource=event_data.get("affected_resource"),
                    raw_data=event_data.get("raw_data"),
                )
                session.add(event)
                await session.flush()  # Flush to get ID before context manager commits
                await session.refresh(event)
                event_ids.append(event.id)

        return event_ids

    async def _get_uncorrelated_events(self, hours: int = 24) -> List[Event]:
        """Get events that are not yet assigned to an incident.

        Args:
            hours: Look back hours

        Returns:
            List of Event objects
        """
        from sqlalchemy import select

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        async with self.db.session() as session:
            result = await session.execute(
                select(Event)
                .where(Event.incident_id.is_(None))
                .where(Event.timestamp >= cutoff_time)
                .order_by(Event.timestamp.desc())
            )
            events = result.scalars().all()

            # Detach from session and return list
            return [
                Event(
                    id=e.id,
                    source=e.source,
                    source_event_id=e.source_event_id,
                    organization=e.organization,
                    event_type=e.event_type,
                    severity=e.severity,
                    title=e.title,
                    description=e.description,
                    timestamp=e.timestamp,
                    created_at=e.created_at,
                    affected_resource=e.affected_resource,
                    raw_data=e.raw_data,
                    incident_id=e.incident_id,
                )
                for e in events
            ]

    async def _group_events_with_ai(self, events: List[Event]) -> List[Dict[str, Any]]:
        """Use AI to group related events into potential incidents.

        Args:
            events: List of uncorrelated events

        Returns:
            List of incident group dictionaries
        """
        if not events:
            return []

        # Prepare events summary for Claude
        events_summary = []
        for i, event in enumerate(events):
            events_summary.append(
                f"Event {i+1}:\n"
                f"  Source: {event.source.value}\n"
                f"  Organization: {event.organization}\n"
                f"  Type: {event.event_type}\n"
                f"  Severity: {event.severity.value}\n"
                f"  Time: {event.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
                f"  Title: {event.title}\n"
                f"  Description: {event.description or 'N/A'}\n"
                f"  Affected Resource: {event.affected_resource or 'N/A'}\n"
            )

        # Use centralized prompt from registry
        prompt = get_prompt(
            "incident_correlation",
            event_count=len(events),
            events_summary=chr(10).join(events_summary)
        )

        try:
            from src.services.multi_provider_ai import generate_text

            # Use multi-provider AI
            result = await generate_text(
                prompt=prompt,
                max_tokens=4096,
            )

            if not result:
                logger.warning("No AI provider configured for incident correlation")
                # Fallback: create individual incidents for high/critical events
                return self._create_fallback_groups(events)

            response_text = result["text"]
            input_tokens = result["input_tokens"]
            output_tokens = result["output_tokens"]
            total_tokens = input_tokens + output_tokens
            ai_cost = result["cost_usd"]
            model = result["model"]

            logger.info(f"AI API usage ({model}) - Input: {input_tokens} tokens, Output: {output_tokens} tokens, Cost: ${ai_cost:.4f}")

            # Log cost to database for telemetry
            try:
                cost_logger = get_cost_logger()
                import asyncio
                asyncio.create_task(
                    cost_logger.log_incident_correlation(
                        model=model,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        alert_count=len(events),
                    )
                )
            except Exception as cost_error:
                logger.warning(f"Failed to log incident correlation cost: {cost_error}")

            # Extract JSON from response (handle markdown code blocks)
            import json
            import re

            json_match = re.search(r"```json\n(.*?)\n```", response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(1)

            result = json.loads(response_text)
            incidents_data = result.get("incidents", [])

            # Map event indices to actual event objects
            incident_groups = []
            for incident_data in incidents_data:
                event_indices = incident_data.get("event_indices", [])
                grouped_events = [events[i - 1] for i in event_indices if 0 < i <= len(events)]

                if not grouped_events:
                    continue

                # Calculate per-event cost/tokens for this incident group
                num_events = len(grouped_events)
                cost_per_event = ai_cost / len(incidents_data) / num_events if num_events > 0 else 0
                tokens_per_event = total_tokens // len(incidents_data) // num_events if num_events > 0 else 0

                incident_groups.append({
                    "events": grouped_events,
                    "title": incident_data.get("title", "Untitled Incident"),
                    "root_cause_hypothesis": incident_data.get("root_cause_hypothesis"),
                    "confidence_score": incident_data.get("confidence_score", 50.0),
                    "severity": incident_data.get("severity", "medium"),
                    "affected_services": incident_data.get("affected_services", []),
                    "ai_cost_per_event": cost_per_event,
                    "tokens_per_event": tokens_per_event,
                })

            return incident_groups

        except Exception as e:
            logger.error(f"Error calling AI API for event correlation: {e}")
            # Fallback: create individual incidents for high/critical events
            return self._create_fallback_groups(events)

    def _create_fallback_groups(self, events: List[Event]) -> List[Dict[str, Any]]:
        """Create fallback incident groups when AI correlation fails.

        Args:
            events: List of events to create fallback groups for

        Returns:
            List of incident group dictionaries
        """
        fallback_groups = []
        for event in events:
            if event.severity in [EventSeverity.CRITICAL, EventSeverity.HIGH]:
                fallback_groups.append({
                    "events": [event],
                    "title": event.title,
                    "root_cause_hypothesis": "Automated incident created from high-severity event",
                    "confidence_score": 50.0,
                    "severity": event.severity.value,
                    "affected_services": [event.affected_resource] if event.affected_resource else [],
                })
        return fallback_groups

    async def _create_or_update_incident(self, group: Dict[str, Any]) -> Optional[int]:
        """Create or update an incident from a group of events.

        Args:
            group: Incident group dictionary with events and metadata

        Returns:
            Incident ID if created/updated, None otherwise
        """
        from sqlalchemy import select

        events = group["events"]
        if not events:
            return None

        # Determine incident timing
        start_time = min(e.timestamp for e in events)
        end_time = max(e.timestamp for e in events)

        # Collect organizations
        organizations = list(set(e.organization for e in events))

        # Map severity
        severity_map = {
            "critical": EventSeverity.CRITICAL,
            "high": EventSeverity.HIGH,
            "medium": EventSeverity.MEDIUM,
            "low": EventSeverity.LOW,
            "info": EventSeverity.INFO,
        }
        severity = severity_map.get(group["severity"], EventSeverity.MEDIUM)

        async with self.db.session() as session:
            # Create new incident
            incident = Incident(
                title=group["title"],
                status=IncidentStatus.OPEN,
                severity=severity,
                start_time=start_time,
                end_time=end_time if end_time != start_time else None,
                root_cause_hypothesis=group["root_cause_hypothesis"],
                confidence_score=group["confidence_score"],
                affected_services=group["affected_services"],
                organizations=organizations,
                event_count=len(events),
            )
            session.add(incident)
            await session.flush()  # Flush to get ID before context manager commits
            await session.refresh(incident)

            # Assign events to incident and update with AI cost tracking
            cost_per_event = group.get("ai_cost_per_event", 0)
            tokens_per_event = group.get("tokens_per_event", 0)

            for event in events:
                result = await session.execute(select(Event).where(Event.id == event.id))
                db_event = result.scalar_one_or_none()
                if db_event:
                    db_event.incident_id = incident.id
                    db_event.ai_cost = cost_per_event
                    db_event.token_count = tokens_per_event

            # Context manager will auto-commit

            return incident.id
