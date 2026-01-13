"""Splunk-driven incident correlation service.

This service uses Splunk as the primary source for identifying issues, then
enriches those issues with context from Meraki and ThousandEyes.

Supports multiple AI providers: Anthropic, OpenAI, Google, and Cisco Circuit.
Uses whatever provider is configured in the system settings.
"""

import json
import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set, Union
import httpx

from src.models.incident import Event, Incident, EventSeverity, IncidentStatus, EventSource
from src.config.database import Database, get_settings
from src.services.credential_manager import CredentialManager
from src.services.device_config_fetcher import DeviceConfigFetcher
from src.services.cost_logger import get_cost_logger

logger = logging.getLogger(__name__)


class SplunkDrivenCorrelationService:
    """Correlate incidents starting from Splunk, enriched with Meraki and ThousandEyes.

    Supports multiple AI providers based on system configuration.
    """

    # Event types/keywords that indicate routine, normal operations (not incidents)
    ROUTINE_EVENT_PATTERNS = [
        # DHCP - routine address management
        r"dhcp.*(?:ack|request|discover|offer|release|renew)",
        r"dhcp_(?:ack|request|discover|offer|release|renew)",
        r"(?:ip|address).*(?:assigned|renewed|released)",
        # Heartbeats and keepalives
        r"heartbeat",
        r"keepalive",
        r"health.*check.*(?:pass|success|ok)",
        r"ping.*(?:success|ok|reply)",
        # Normal authentication (successes)
        r"(?:auth|login).*(?:success|succeeded|successful)",
        r"user.*logged.*in",
        r"session.*(?:started|established)",
        # Routine status messages
        r"status.*(?:normal|ok|healthy|up|online)",
        r"interface.*(?:up|online)",
        r"link.*(?:up|established)",
        # Normal traffic/connections
        r"connection.*(?:established|opened)",
        r"client.*(?:connected|associated)",
        r"(?:association|disassociation).*(?:success|complete)",
        # Scheduled tasks and maintenance
        r"scheduled.*(?:task|job|backup)",
        r"cron",
        r"maintenance.*(?:window|complete)",
        # Info-level system messages
        r"system.*(?:startup|boot|ready)",
        r"service.*(?:started|running)",
        r"configuration.*(?:applied|saved|loaded)",
    ]

    def __init__(self):
        """Initialize service. AI provider is determined at runtime from config."""
        settings = get_settings()
        self.db = Database(settings.database_url)
        self.credential_manager = CredentialManager()
        self.device_config_fetcher = DeviceConfigFetcher()
        # Compile regex patterns for efficiency
        self._routine_patterns = [re.compile(p, re.IGNORECASE) for p in self.ROUTINE_EVENT_PATTERNS]

    def _is_routine_event(self, event: Dict[str, Any]) -> bool:
        """Check if an event represents routine/normal operations that shouldn't create incidents.

        Args:
            event: Splunk event dictionary

        Returns:
            True if this is a routine event that should be filtered out
        """
        # Get text to check from various fields
        raw_event = event.get("raw_event", {})
        text_to_check = " ".join([
            event.get("title", ""),
            event.get("description", ""),
            raw_event.get("_raw", ""),
            raw_event.get("message", ""),
            raw_event.get("event_type", ""),
            raw_event.get("type", ""),
        ]).lower()

        # Check against routine patterns
        for pattern in self._routine_patterns:
            if pattern.search(text_to_check):
                return True

        return False

    async def _fetch_existing_incidents(self, hours: int = 72) -> List[Dict[str, Any]]:
        """Fetch existing open/investigating incidents to check for merging.

        Args:
            hours: Hours to look back for existing incidents

        Returns:
            List of existing incident dictionaries with their events
        """
        existing = []
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        async with self.db.session() as session:
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            # Query open and investigating incidents from the last N hours
            query = (
                select(Incident)
                .options(selectinload(Incident.events))
                .where(Incident.status.in_([IncidentStatus.OPEN, IncidentStatus.INVESTIGATING]))
                .where(Incident.start_time >= cutoff)
                .order_by(Incident.start_time.desc())
            )

            result = await session.execute(query)
            incidents = result.scalars().all()

            for incident in incidents:
                # Build a summary of the incident for AI matching
                event_summaries = []
                # Collect device serials and event types for deterministic matching
                device_serials = set()
                network_ids = set()
                event_types = set()

                for event in incident.events[:10]:  # Check first 10 events
                    event_summaries.append({
                        "source": event.source.value if event.source else "unknown",
                        "title": event.title,
                        "severity": event.severity.value if event.severity else "medium",
                        "affected_resource": event.affected_resource,
                    })
                    # Extract device serial and network ID from raw_data
                    if event.raw_data:
                        raw = event.raw_data
                        if isinstance(raw, dict):
                            if raw.get("deviceSerial"):
                                device_serials.add(raw["deviceSerial"].upper())
                            if raw.get("networkId"):
                                network_ids.add(raw["networkId"])
                            # Try to extract from _raw JSON string
                            raw_str = raw.get("_raw", "")
                            if raw_str:
                                try:
                                    import json
                                    parsed = json.loads(raw_str)
                                    if parsed.get("deviceSerial"):
                                        device_serials.add(parsed["deviceSerial"].upper())
                                    if parsed.get("networkId"):
                                        network_ids.add(parsed["networkId"])
                                    if parsed.get("type"):
                                        event_types.add(parsed["type"].lower())
                                except (json.JSONDecodeError, ValueError, TypeError, KeyError):
                                    pass  # Skip malformed JSON in raw event data

                existing.append({
                    "id": incident.id,
                    "title": incident.title,
                    "status": incident.status.value,
                    "severity": incident.severity.value if incident.severity else "medium",
                    "start_time": incident.start_time.isoformat() if incident.start_time else None,
                    "root_cause_hypothesis": incident.root_cause_hypothesis,
                    "confidence_score": incident.confidence_score,
                    "affected_services": incident.affected_services or [],
                    "event_count": incident.event_count or len(incident.events),
                    "events_summary": event_summaries,
                    # For deterministic matching
                    "device_serials": list(device_serials),
                    "network_ids": list(network_ids),
                    "event_types": list(event_types),
                })

        logger.info(f"  Found {len(existing)} existing open/investigating incidents")
        return existing

    def _extract_network_info(self, raw_event: Dict[str, Any]) -> tuple:
        """Extract network_id and network_name from raw event data.

        Args:
            raw_event: Raw event dictionary

        Returns:
            Tuple of (network_id, network_name)
        """
        network_id = None
        network_name = None

        # Try direct fields
        network_id = raw_event.get("networkId") or raw_event.get("network_id")
        network_name = raw_event.get("networkName")

        # Try nested network object (common in Meraki health data)
        if not network_id:
            network_obj = raw_event.get("network", {})
            if isinstance(network_obj, dict):
                network_id = network_obj.get("id")
                network_name = network_name or network_obj.get("name")

        # Try parsing _raw JSON
        raw_str = raw_event.get("_raw", "")
        if raw_str and not network_id:
            try:
                parsed = json.loads(raw_str)
                network_id = parsed.get("networkId")
                network_name = network_name or parsed.get("networkName")
                if not network_name:
                    net_obj = parsed.get("network", {})
                    if isinstance(net_obj, dict):
                        network_name = net_obj.get("name")
                        if not network_id:
                            network_id = net_obj.get("id")
            except (json.JSONDecodeError, TypeError):
                pass

        return network_id, network_name

    async def _lookup_network_name(self, network_id: str) -> Optional[str]:
        """Look up network name from cache by network_id.

        Args:
            network_id: The Meraki network ID

        Returns:
            Network name if found, None otherwise
        """
        if not network_id:
            return None

        try:
            from src.models.network_cache import CachedNetwork
            from sqlalchemy import select

            async with self.db.session() as session:
                result = await session.execute(
                    select(CachedNetwork.network_name)
                    .where(CachedNetwork.network_id == network_id)
                    .limit(1)
                )
                row = result.scalar_one_or_none()
                return row if row else None
        except Exception as e:
            logger.debug(f"Could not lookup network name for {network_id}: {e}")
            return None

    def _format_incident_title(
        self,
        ai_title: str,
        network_name: Optional[str],
    ) -> str:
        """Ensure incident title includes network name.

        Args:
            ai_title: Title generated by AI
            network_name: Network name to include

        Returns:
            Formatted title with network name
        """
        if not network_name:
            return ai_title

        # Check if AI already included network name
        if network_name.lower() in ai_title.lower():
            return ai_title

        # Append network name if missing
        return f"{ai_title} - {network_name}"

    def _find_matching_incident(
        self,
        splunk_event: Dict[str, Any],
        existing_incidents: List[Dict[str, Any]]
    ) -> Optional[int]:
        """Deterministically find an existing incident that matches this event.

        CRITICAL: Only matches incidents from the SAME network. Events from different
        networks will never be merged together.

        Args:
            splunk_event: The new Splunk event to match
            existing_incidents: List of existing incidents with their metadata

        Returns:
            Incident ID to merge with, or None if no match
        """
        # Extract identifying info from the new event
        raw_event = splunk_event.get("raw_event", {})

        # Extract network info using helper
        new_network_id, _ = self._extract_network_info(raw_event)

        # CRITICAL: Cannot match without network_id - prevents cross-network merging
        if not new_network_id:
            logger.debug("    → No network_id found, cannot match to existing incidents")
            return None

        raw_str = raw_event.get("_raw", "")
        new_device_serial = None
        new_event_type = None

        # Try to parse Meraki JSON from _raw
        if raw_str:
            try:
                parsed = json.loads(raw_str)
                new_device_serial = parsed.get("deviceSerial", "").upper() if parsed.get("deviceSerial") else None
                new_event_type = parsed.get("type", "").lower() if parsed.get("type") else None
            except (json.JSONDecodeError, TypeError):
                pass

        # Also check direct fields
        if not new_device_serial:
            new_device_serial = raw_event.get("deviceSerial", "").upper() if raw_event.get("deviceSerial") else None

        # Look for matching incident - MUST be same network
        for existing in existing_incidents:
            # CRITICAL: Only consider incidents from the SAME network
            if new_network_id not in existing.get("network_ids", []):
                continue  # Skip incidents from different networks

            # Match by device serial + event type (strongest match within same network)
            if new_device_serial and new_event_type:
                if new_device_serial in [s.upper() for s in existing.get("device_serials", [])]:
                    if new_event_type in existing.get("event_types", []):
                        logger.info(f"    → Deterministic match: network {new_network_id} + device {new_device_serial} + event type {new_event_type} → incident #{existing['id']}")
                        return existing["id"]

            # Match by network + event type (good match)
            if new_event_type:
                if new_event_type in existing.get("event_types", []):
                    logger.info(f"    → Deterministic match: network {new_network_id} + event type {new_event_type} → incident #{existing['id']}")
                    return existing["id"]

            # Match by device serial alone within same network if titles are similar
            if new_device_serial:
                if new_device_serial in [s.upper() for s in existing.get("device_serials", [])]:
                    existing_title = existing.get("title", "").lower()
                    new_title = splunk_event.get("title", "").lower()
                    issue_keywords = ["martian", "vlan", "mismatch", "offline", "down", "failure", "error", "critical", "packet", "loss"]
                    for keyword in issue_keywords:
                        if keyword in existing_title and keyword in new_title:
                            logger.info(f"    → Deterministic match: network {new_network_id} + device {new_device_serial} + keyword '{keyword}' → incident #{existing['id']}")
                            return existing["id"]

        return None

    async def _merge_events_directly(
        self,
        events_to_merge: List[tuple]
    ) -> List[int]:
        """Merge events directly into existing incidents without AI analysis.

        Args:
            events_to_merge: List of (enriched_event, incident_id) tuples

        Returns:
            List of incident IDs that were updated
        """
        if not events_to_merge:
            return []

        updated_ids = set()

        async with self.db.session() as session:
            from sqlalchemy import select

            for enriched, incident_id in events_to_merge:
                splunk_event = enriched["splunk_event"]

                # Fetch the incident
                query = select(Incident).where(Incident.id == incident_id)
                result = await session.execute(query)
                incident = result.scalar_one_or_none()

                if not incident:
                    logger.warning(f"  Could not find incident #{incident_id} for merging")
                    continue

                # Map severity
                severity_map = {
                    "critical": EventSeverity.CRITICAL,
                    "high": EventSeverity.HIGH,
                    "medium": EventSeverity.MEDIUM,
                    "low": EventSeverity.LOW,
                    "info": EventSeverity.INFO,
                }

                # Convert timestamp
                event_timestamp = splunk_event["timestamp"]
                if event_timestamp.tzinfo is not None:
                    event_timestamp = event_timestamp.replace(tzinfo=None)

                event_severity = severity_map.get(
                    splunk_event.get("severity", "medium").lower(),
                    EventSeverity.MEDIUM
                )

                # Update incident metadata
                incident.updated_at = datetime.utcnow()

                # Escalate severity if new events are more severe
                severity_order = [EventSeverity.INFO, EventSeverity.LOW, EventSeverity.MEDIUM, EventSeverity.HIGH, EventSeverity.CRITICAL]
                if severity_order.index(event_severity) > severity_order.index(incident.severity):
                    incident.severity = event_severity
                    logger.info(f"    Escalated incident #{incident_id} severity to {event_severity.value}")

                # Create event for the Splunk notable
                occurrence_count = splunk_event.get("_grouped_count", 1)

                event = Event(
                    source=EventSource.SPLUNK,
                    source_event_id=splunk_event["raw_event"].get("event_id") or splunk_event["raw_event"].get("_cd"),
                    organization=splunk_event["organization"],
                    event_type="notable",
                    severity=event_severity,
                    title=splunk_event["title"],
                    description=splunk_event["description"][:1000] if splunk_event.get("description") else None,
                    timestamp=event_timestamp,
                    affected_resource=splunk_event["raw_event"].get("dest") or splunk_event["raw_event"].get("src"),
                    raw_data=splunk_event["raw_event"],
                    incident_id=incident.id,
                    ai_cost=0,  # No AI cost for direct merge
                    token_count=0,
                )
                session.add(event)

                # Create events for Meraki context data
                for meraki_item in enriched.get("meraki_context", []):
                    meraki_event = Event(
                        source=EventSource.MERAKI,
                        source_event_id=f"meraki-{meraki_item.get('data', {}).get('serial', meraki_item.get('id', ''))}",
                        organization=meraki_item.get("organization", splunk_event["organization"]),
                        event_type=meraki_item.get("type", "context"),
                        severity=EventSeverity.INFO,
                        title=f"Meraki Context: {meraki_item.get('data', {}).get('name', 'Device')}",
                        description=str(meraki_item)[:1000],
                        timestamp=event_timestamp,
                        affected_resource=meraki_item.get("data", {}).get("name") or meraki_item.get("data", {}).get("serial"),
                        raw_data=meraki_item,
                        incident_id=incident.id,
                        ai_cost=0,
                        token_count=0,
                    )
                    session.add(meraki_event)

                # Create events for ThousandEyes context data
                for te_item in enriched.get("thousandeyes_context", []):
                    te_event = Event(
                        source=EventSource.THOUSANDEYES,
                        source_event_id=f"te-{te_item.get('test', {}).get('testId', te_item.get('id', ''))}",
                        organization=te_item.get("organization", splunk_event["organization"]),
                        event_type=te_item.get("type", "context"),
                        severity=EventSeverity.INFO,
                        title=f"ThousandEyes Context: {te_item.get('test', {}).get('testName', 'Test')}",
                        description=str(te_item)[:1000],
                        timestamp=event_timestamp,
                        affected_resource=te_item.get("test", {}).get("testName"),
                        raw_data=te_item,
                        incident_id=incident.id,
                        ai_cost=0,
                        token_count=0,
                    )
                    session.add(te_event)

                # Update event count
                context_count = len(enriched.get("meraki_context", [])) + len(enriched.get("thousandeyes_context", []))
                incident.event_count = (incident.event_count or 0) + occurrence_count + context_count

                updated_ids.add(incident.id)
                logger.info(f"    Added {occurrence_count + context_count} events to incident #{incident.id}")

        return list(updated_ids)

    def _generate_event_fingerprint(self, event: Dict[str, Any]) -> str:
        """Generate a fingerprint to identify similar/duplicate events.

        Events with the same fingerprint are considered duplicates that should
        be grouped into a single incident.

        CRITICAL: Network ID is MANDATORY for grouping. Events without a network_id
        get a unique fingerprint and will not be grouped with others. This ensures
        incidents are always network-specific.

        Args:
            event: Splunk event dictionary

        Returns:
            Fingerprint string
        """
        raw_event = event.get("raw_event", {})

        # Extract key identifying fields
        components = []

        # 1. MANDATORY: Network ID - prevents cross-network grouping
        network_id, _ = self._extract_network_info(raw_event)
        if network_id:
            components.append(f"network:{network_id}")
        else:
            # No network ID = unique fingerprint (won't group with others)
            import uuid
            unique_id = uuid.uuid4().hex[:8]
            components.append(f"network:unknown-{unique_id}")
            logger.debug(f"Event has no network_id, assigned unique fingerprint suffix: {unique_id}")

        # 2. Event type/category (for grouping similar issues within same network)
        event_type = (
            raw_event.get("type") or
            raw_event.get("event_type") or
            raw_event.get("eventType") or
            "unknown"
        ).lower()
        components.append(f"type:{event_type}")

        # 3. Affected device/resource (to group by same device within network)
        device_id = None

        # Meraki-style fields
        if raw_event.get("deviceSerial"):
            device_id = raw_event.get("deviceSerial")
        elif raw_event.get("deviceName"):
            device_id = raw_event.get("deviceName")
        elif raw_event.get("clientMac"):
            device_id = raw_event.get("clientMac")
        # Standard Splunk fields
        elif raw_event.get("host"):
            device_id = raw_event.get("host")
        elif raw_event.get("dest"):
            device_id = raw_event.get("dest")
        elif raw_event.get("src"):
            device_id = raw_event.get("src")

        if device_id:
            components.append(f"device:{device_id.lower()}")

        # 4. Severity bucket (group similar severities)
        severity = event.get("severity", "medium").lower()
        components.append(f"sev:{severity}")

        # 5. Organization
        org = event.get("organization", "unknown")
        components.append(f"org:{org}")

        return "|".join(components)

    def _group_similar_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Group similar events together to prevent duplicate incidents.

        Args:
            events: List of Splunk events

        Returns:
            List of grouped event dictionaries, where each group represents
            a unique issue that should become a single incident
        """
        groups: Dict[str, List[Dict[str, Any]]] = {}

        for event in events:
            fingerprint = self._generate_event_fingerprint(event)

            if fingerprint not in groups:
                groups[fingerprint] = []
            groups[fingerprint].append(event)

        # Convert groups to list format with summary info
        grouped_events = []
        for fingerprint, group_events in groups.items():
            # Use the first event as the primary, but include count and examples
            primary_event = group_events[0].copy()
            primary_event["_grouped_count"] = len(group_events)
            primary_event["_grouped_fingerprint"] = fingerprint

            # Collect unique descriptions/messages from the group
            unique_descriptions = set()
            for evt in group_events[:10]:  # Limit to first 10 examples
                desc = evt.get("description", "")[:200]
                if desc:
                    unique_descriptions.add(desc)

            primary_event["_grouped_examples"] = list(unique_descriptions)[:5]

            grouped_events.append(primary_event)

        return grouped_events

    async def analyze_and_create_incidents(self, hours: int = 24) -> List[int]:
        """Main entry point: analyze Splunk events and create enriched incidents.

        Args:
            hours: Hours to look back for Splunk events

        Returns:
            List of incident IDs created
        """
        logger.info("=" * 60)
        logger.info("SPLUNK-DRIVEN INCIDENT CORRELATION")
        logger.info("=" * 60)

        # Step 1: Fetch Splunk notable events
        logger.info("Step 1: Fetching Splunk notable events...")
        splunk_events = await self._fetch_splunk_events(hours)
        logger.info(f"  → Found {len(splunk_events)} raw Splunk events")

        if not splunk_events:
            logger.info("No Splunk events found - no incidents to create")
            return []

        # Step 1b: Filter out routine/normal events
        logger.info("Step 1b: Filtering out routine events...")
        filtered_events = [e for e in splunk_events if not self._is_routine_event(e)]
        filtered_count = len(splunk_events) - len(filtered_events)
        logger.info(f"  → Filtered out {filtered_count} routine events, {len(filtered_events)} remaining")

        if not filtered_events:
            logger.info("All events were routine - no incidents to create")
            return []

        # Step 1c: Group similar events to prevent duplicates
        logger.info("Step 1c: Grouping similar events to prevent duplicates...")
        grouped_events = self._group_similar_events(filtered_events)
        logger.info(f"  → Grouped into {len(grouped_events)} unique event types")

        for i, event in enumerate(grouped_events, 1):
            count = event.get("_grouped_count", 1)
            fingerprint = event.get("_grouped_fingerprint", "unknown")
            logger.info(f"    Group {i}: {count} events - {fingerprint[:80]}")

        # Step 2: For each grouped event, extract affected resources and enrich
        logger.info("Step 2: Enriching grouped events with Meraki and ThousandEyes data...")
        enriched_incidents = []

        for i, splunk_event in enumerate(grouped_events, 1):
            grouped_count = splunk_event.get("_grouped_count", 1)
            logger.info(f"  Processing event group {i}/{len(grouped_events)}: {splunk_event.get('title', 'Unknown')} ({grouped_count} occurrences)")

            # Extract affected resources (IPs, hostnames, devices)
            resources = self._extract_resources_from_splunk_event(splunk_event)
            logger.info(f"    → Extracted resources: {resources}")

            # Enrich with Meraki data
            meraki_context = await self._fetch_meraki_context(resources)
            logger.info(f"    → Found {len(meraki_context)} Meraki devices/networks")

            # Enrich with ThousandEyes data
            te_context = await self._fetch_thousandeyes_context(resources)
            logger.info(f"    → Found {len(te_context)} ThousandEyes tests")

            # Combine into enriched incident
            enriched_incidents.append({
                "splunk_event": splunk_event,
                "resources": resources,
                "meraki_context": meraki_context,
                "thousandeyes_context": te_context,
            })

        # Step 3: Fetch existing open incidents to check for merging
        logger.info("Step 3: Fetching existing incidents for potential merging...")
        existing_incidents = await self._fetch_existing_incidents(hours=72)

        # Step 3b: Pre-filter - separate events that should merge with existing incidents
        events_to_merge = []  # (event_group, existing_incident_id)
        events_for_ai = []    # New events that need AI analysis

        for enriched in enriched_incidents:
            splunk_event = enriched["splunk_event"]
            match_id = self._find_matching_incident(splunk_event, existing_incidents)

            if match_id:
                events_to_merge.append((enriched, match_id))
                logger.info(f"    Pre-match: '{splunk_event.get('title', 'Unknown')[:50]}' → incident #{match_id}")
            else:
                events_for_ai.append(enriched)

        logger.info(f"  → {len(events_to_merge)} events will merge with existing incidents")
        logger.info(f"  → {len(events_for_ai)} events need AI analysis")

        # Step 3c: Merge pre-matched events directly (no AI needed)
        merged_ids = []
        if events_to_merge:
            merged_ids = await self._merge_events_directly(events_to_merge)
            logger.info(f"  → Merged events into {len(merged_ids)} existing incidents")

        # Step 4: Use AI to create incident reports for truly new events
        new_incident_ids = []
        if events_for_ai:
            logger.info("Step 4: Using AI to generate incident reports for new events...")
            new_incident_ids = await self._create_incidents_with_ai(events_for_ai, existing_incidents)
            logger.info(f"  → Created {len(new_incident_ids)} new incidents")
        else:
            logger.info("Step 4: No new events need AI analysis")

        # Combine all incident IDs
        incident_ids = list(set(merged_ids + new_incident_ids))
        logger.info(f"  → Total incidents affected: {len(incident_ids)}")

        logger.info("=" * 60)
        return incident_ids

    async def _fetch_splunk_events(self, hours: int) -> List[Dict[str, Any]]:
        """Fetch notable events from Splunk.

        Args:
            hours: Hours to look back

        Returns:
            List of Splunk event dictionaries
        """
        events = []

        # Try to get Splunk credentials from system_config first
        from src.services.config_service import ConfigService
        config_service = ConfigService()

        splunk_api_url = await config_service.get_config("splunk_api_url")
        splunk_bearer_token = await config_service.get_config("splunk_bearer_token")
        splunk_username = await config_service.get_config("splunk_username")
        splunk_password = await config_service.get_config("splunk_password")

        credentials_list = []

        # Add system_config Splunk if configured
        if splunk_api_url and (splunk_bearer_token or (splunk_username and splunk_password)):
            credentials_list.append({
                "name": "system_config",
                "base_url": splunk_api_url,
                "api_key": splunk_bearer_token,
                "username": splunk_username,
                "password": splunk_password,
                "verify_ssl": False,
            })

        # Also check clusters table for backward compatibility
        try:
            clusters = await self.credential_manager.list_clusters(active_only=True)
            for cluster in clusters:
                try:
                    creds = await self.credential_manager.get_credentials(cluster.name)
                    if creds:
                        base_url = creds.get("base_url", "").lower()
                        if ":8089" in base_url or "splunk" in base_url:
                            credentials_list.append({
                                "name": cluster.name,
                                **creds
                            })
                except Exception as e:
                    logger.warning(f"      Skipping cluster {cluster.name}: {e}")
        except Exception as e:
            logger.debug(f"      Could not check clusters table: {e}")

        if not credentials_list:
            logger.warning("No Splunk credentials found in system_config or clusters")
            return events

        for credentials in credentials_list:
            logger.info(f"    Querying Splunk: {credentials['name']}")

            try:
                token = credentials.get("api_key")
                username = credentials.get("username")
                password = credentials.get("password")

                if not token and not (username and password):
                    logger.warning(f"      No credentials for {credentials['name']}")
                    continue

                # Build auth headers - prefer token, fall back to basic auth
                headers = {
                    "Content-Type": "application/x-www-form-urlencoded",
                }

                auth = None
                if token:
                    # Splunk uses "Splunk {token}" format for token auth
                    headers["Authorization"] = f"Splunk {token}"
                elif username and password:
                    # Use basic auth
                    import base64
                    auth_string = base64.b64encode(f"{username}:{password}".encode()).decode()
                    headers["Authorization"] = f"Basic {auth_string}"

                earliest_time = f"-{hours}h"

                async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=60.0) as client:
                    # Create search job - use broad search, AI will filter
                    search_query = f'search earliest={earliest_time} index=* | head 100'

                    logger.info(f"      Creating search job with query: {search_query}")
                    create_job_response = await client.post(
                        f"{credentials['base_url']}/services/search/jobs",
                        headers=headers,
                        data={"search": search_query, "output_mode": "json"},
                    )

                    logger.info(f"      Job creation response: HTTP {create_job_response.status_code}")
                    if create_job_response.status_code not in [200, 201]:
                        try:
                            error_body = create_job_response.json()
                            logger.error(f"      Failed to create Splunk search job: HTTP {create_job_response.status_code}, body: {error_body}")
                        except (ValueError, json.JSONDecodeError):
                            logger.error(f"      Failed to create Splunk search job: HTTP {create_job_response.status_code}, body: {create_job_response.text}")
                        continue

                    job_data = create_job_response.json()
                    job_id = job_data.get("sid")
                    logger.info(f"      Created job ID: {job_id}")

                    if not job_id:
                        logger.error(f"      No search job ID returned")
                        continue

                    # Poll for job completion
                    import asyncio
                    max_attempts = 30
                    for attempt in range(max_attempts):
                        job_status_response = await client.get(
                            f"{credentials['base_url']}/services/search/jobs/{job_id}",
                            headers=headers,
                            params={"output_mode": "json"},
                        )

                        if job_status_response.status_code == 200:
                            status_data = job_status_response.json()
                            entry = status_data.get("entry", [{}])[0]
                            content = entry.get("content", {})

                            if content.get("isDone"):
                                break

                        await asyncio.sleep(1)

                    # Fetch results
                    logger.info(f"      Fetching results for job {job_id}...")
                    results_response = await client.get(
                        f"{credentials['base_url']}/services/search/jobs/{job_id}/results",
                        headers=headers,
                        params={"output_mode": "json", "count": 100},
                    )

                    logger.info(f"      Results response: HTTP {results_response.status_code}")
                    if results_response.status_code != 200:
                        try:
                            error_body = results_response.json()
                            logger.error(f"      Failed to fetch results: HTTP {results_response.status_code}, body: {error_body}")
                        except (ValueError, json.JSONDecodeError):
                            logger.error(f"      Failed to fetch results: HTTP {results_response.status_code}, body: {results_response.text}")
                        continue

                    results_data = results_response.json()
                    splunk_events = results_data.get("results", [])
                    logger.info(f"      Raw results data keys: {list(results_data.keys())}")
                    logger.info(f"      Number of events in 'results' key: {len(splunk_events)}")

                    # Log first event for debugging format
                    if splunk_events:
                        logger.info(f"      Sample event keys: {list(splunk_events[0].keys())}")
                        sample_raw = splunk_events[0].get("_raw", "")[:200]
                        logger.info(f"      Sample _raw: {sample_raw}")

                    for event in splunk_events:
                        # Parse timestamp - Splunk can return either Unix timestamp or ISO format
                        event_time = datetime.utcnow()
                        if event.get("_time"):
                            try:
                                # Try parsing as Unix timestamp first
                                event_time = datetime.fromtimestamp(float(event["_time"]))
                            except (ValueError, TypeError):
                                # If that fails, try parsing as ISO format string
                                try:
                                    event_time = datetime.fromisoformat(event["_time"].replace("Z", "+00:00"))
                                except (ValueError, TypeError, AttributeError):
                                    pass  # Fall back to current time

                        # Parse _raw for structured data - it may be JSON or key=value format
                        raw_content = event.get("_raw", "")
                        parsed_fields = {}

                        # Try to parse _raw as JSON first (Meraki events are JSON)
                        try:
                            if raw_content.strip().startswith("{"):
                                json_data = json.loads(raw_content)
                                # Merge JSON fields into parsed_fields (type, networkId, deviceSerial, etc.)
                                parsed_fields.update(json_data)

                                # Detect event type from data structure if no explicit 'type' field
                                if not json_data.get("type"):
                                    # Packet loss detection
                                    downstream = json_data.get("downstream", {})
                                    upstream = json_data.get("upstream", {})
                                    downstream_loss = downstream.get("lossPercentage", 0) if isinstance(downstream, dict) else 0
                                    upstream_loss = upstream.get("lossPercentage", 0) if isinstance(upstream, dict) else 0

                                    if downstream_loss > 10 or upstream_loss > 10:
                                        parsed_fields["type"] = "high_packet_loss"
                                        parsed_fields["severity"] = "high"
                                        device_name = json_data.get("device", {}).get("name", "Unknown")
                                        network_name = json_data.get("network", {}).get("name", "")
                                        parsed_fields["networkName"] = network_name
                                        parsed_fields["description"] = f"High packet loss on {device_name} ({network_name}): {max(downstream_loss, upstream_loss):.1f}%"
                                    elif downstream_loss > 5 or upstream_loss > 5:
                                        parsed_fields["type"] = "moderate_packet_loss"
                                        parsed_fields["severity"] = "medium"
                                        network_name = json_data.get("network", {}).get("name", "")
                                        parsed_fields["networkName"] = network_name

                                    # VLAN violation detection
                                    if "unexpected packets" in raw_content.lower():
                                        parsed_fields["type"] = "vlan_violation"
                                        parsed_fields["severity"] = "medium"

                                    # Device utilization detection
                                    utilization = json_data.get("utilization", {})
                                    if isinstance(utilization, dict):
                                        avg_util = utilization.get("average", {})
                                        if isinstance(avg_util, dict) and avg_util.get("percentage", 0) > 80:
                                            parsed_fields["type"] = "high_utilization"
                                            parsed_fields["severity"] = "medium"

                        except (json.JSONDecodeError, Exception):
                            pass  # Not JSON, continue with key=value parsing

                        # Also check for log_level in non-JSON events
                        if "log_level=ERROR" in raw_content or "log_level=CRITICAL" in raw_content:
                            parsed_fields["severity"] = "high"
                        elif "log_level=WARNING" in raw_content:
                            parsed_fields["severity"] = "medium"
                        elif "401 Unauthorized" in raw_content or "Invalid API key" in raw_content:
                            parsed_fields["severity"] = "high"
                            parsed_fields["type"] = "authentication_failure"

                        # Check for VLAN violations in raw content
                        if "unexpected packets" in raw_content.lower() and not parsed_fields.get("type"):
                            parsed_fields["type"] = "vlan_violation"
                            parsed_fields["severity"] = "medium"

                        # Determine event title from parsed data
                        event_title = (
                            parsed_fields.get("type") or  # Meraki event type
                            event.get("title") or
                            event.get("search_name") or
                            "Splunk Event"
                        )

                        # Determine description
                        event_desc = (
                            parsed_fields.get("description") or
                            event.get("description") or
                            event.get("message") or
                            raw_content
                        )

                        events.append({
                            "organization": cluster.name,
                            "raw_event": {**event, **parsed_fields},  # Merge parsed JSON fields
                            "title": event_title,
                            "description": event_desc,
                            "severity": parsed_fields.get("severity", event.get("severity", "medium")),
                            "urgency": event.get("urgency", "medium"),
                            "timestamp": event_time,
                        })

                    # Clean up search job
                    await client.delete(
                        f"{credentials['base_url']}/services/search/jobs/{job_id}",
                        headers=headers,
                    )

                    logger.info(f"      → Found {len(splunk_events)} events")

            except Exception as e:
                logger.error(f"      Error fetching from {cluster.name}: {e}")

        return events

    def _extract_resources_from_splunk_event(self, event: Dict[str, Any]) -> Dict[str, Set[str]]:
        """Extract affected resources (IPs, hostnames, devices) from a Splunk event.

        Args:
            event: Splunk event dictionary

        Returns:
            Dictionary with sets of IPs, hostnames, devices, serials, network IDs, and MACs
        """
        resources = {
            "ips": set(),
            "hostnames": set(),
            "devices": set(),
            "device_serials": set(),
            "network_ids": set(),
            "mac_addresses": set(),
        }

        # Get the raw event data
        raw_event = event.get("raw_event", {})
        description = event.get("description", "")
        title = event.get("title", "")

        # Try to parse Meraki JSON from _raw field
        raw_text = raw_event.get("_raw", "")
        if raw_text:
            try:
                import json
                meraki_data = json.loads(raw_text)

                # Extract Meraki-specific fields
                if "deviceSerial" in meraki_data:
                    resources["device_serials"].add(meraki_data["deviceSerial"])
                if "deviceName" in meraki_data:
                    resources["devices"].add(meraki_data["deviceName"])
                if "networkId" in meraki_data:
                    resources["network_ids"].add(meraki_data["networkId"])
                if "clientMac" in meraki_data:
                    resources["mac_addresses"].add(meraki_data["clientMac"])

                # Extract IPs from eventData
                if "eventData" in meraki_data and isinstance(meraki_data["eventData"], dict):
                    event_data = meraki_data["eventData"]
                    for key in ["ip", "router", "server_ip"]:
                        if key in event_data and self._is_ip_address(event_data[key]):
                            resources["ips"].add(event_data[key])
                    if "mx_mac" in event_data:
                        resources["mac_addresses"].add(event_data["mx_mac"])
            except (json.JSONDecodeError, TypeError):
                # If _raw isn't valid JSON, continue with fallback parsing
                pass

        # Common fields that might contain resource identifiers
        resource_fields = ["dest", "src", "host", "dest_ip", "src_ip", "device", "hostname"]

        for field in resource_fields:
            value = raw_event.get(field)
            if value and isinstance(value, str):  # Only process string values
                # Check if it's an IP address
                if self._is_ip_address(value):
                    resources["ips"].add(value)
                else:
                    # Assume it's a hostname or device name
                    resources["hostnames"].add(value)
                    resources["devices"].add(value)

        # Also try to extract IPs and hostnames from description using regex
        # Ensure description and title are strings
        desc_str = str(description) if description else ""
        title_str = str(title) if title else ""
        search_text = desc_str + " " + title_str

        # IP pattern: xxx.xxx.xxx.xxx
        ip_pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
        found_ips = re.findall(ip_pattern, search_text)
        resources["ips"].update(found_ips)

        # Hostname pattern: alphanumeric with dots and hyphens
        hostname_pattern = r'\b[a-zA-Z0-9][-a-zA-Z0-9.]+[a-zA-Z0-9]\b'
        found_hostnames = re.findall(hostname_pattern, search_text)
        # Filter out obvious non-hostnames
        for hostname in found_hostnames:
            if '.' in hostname and not self._is_ip_address(hostname):
                resources["hostnames"].add(hostname)

        return resources

    def _is_ip_address(self, value: Any) -> bool:
        """Check if a value is a valid IP address string."""
        if not isinstance(value, str):
            return False
        parts = value.split('.')
        if len(parts) != 4:
            return False
        try:
            return all(0 <= int(part) <= 255 for part in parts)
        except ValueError:
            return False

    async def _fetch_meraki_context(self, resources: Dict[str, Set[str]]) -> List[Dict[str, Any]]:
        """Fetch Meraki context for the affected resources.

        Args:
            resources: Dictionary of resource identifiers

        Returns:
            List of Meraki context dictionaries (devices, networks, etc.)
        """
        context = []

        # Get all Meraki organizations
        clusters = await self.credential_manager.list_clusters(active_only=True)

        for cluster in clusters:
            try:
                credentials = await self.credential_manager.get_credentials(cluster.name)
                if not credentials:
                    continue

                # Check if this is Meraki
                base_url = credentials["base_url"].lower()
                if "meraki" not in base_url:
                    continue
            except Exception as e:
                logger.debug(f"Skipping cluster {cluster.name}: {e}")
                continue

            try:
                headers = {
                    "X-Cisco-Meraki-API-Key": credentials["api_key"],
                    "Content-Type": "application/json",
                }

                async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=30.0) as client:
                    # Get organization ID
                    org_response = await client.get(
                        f"{credentials['base_url']}/organizations", headers=headers
                    )

                    if org_response.status_code != 200:
                        continue

                    orgs = org_response.json()
                    if not orgs:
                        continue

                    org_id = orgs[0]["id"]

                    # Get all devices in the organization
                    devices_response = await client.get(
                        f"{credentials['base_url']}/organizations/{org_id}/devices",
                        headers=headers,
                    )

                    if devices_response.status_code == 200:
                        devices = devices_response.json()

                        # Match devices by name, serial, or IP
                        for device in devices:
                            device_name = device.get("name", "").lower()
                            device_serial = device.get("serial", "").lower()
                            device_mac = device.get("mac", "").lower()
                            device_ip = device.get("lanIp") or device.get("wan1Ip") or device.get("wan2Ip")

                            # Check if this device matches any of our resources
                            matched = False

                            # Match by device serial
                            for serial in resources["device_serials"]:
                                if serial.lower() == device_serial:
                                    matched = True
                                    break

                            # Match by MAC address
                            if not matched:
                                for mac in resources["mac_addresses"]:
                                    if mac.lower() == device_mac:
                                        matched = True
                                        break

                            # Match by hostname
                            if not matched:
                                for hostname in resources["hostnames"]:
                                    if hostname.lower() in device_name or hostname.lower() == device_serial:
                                        matched = True
                                        break

                            # Match by IP
                            if not matched and device_ip and device_ip in resources["ips"]:
                                matched = True

                            if matched:
                                context.append({
                                    "source": "meraki",
                                    "type": "device",
                                    "organization": cluster.name,
                                    "data": device,
                                })

            except Exception as e:
                logger.error(f"      Error fetching Meraki context: {e}")

        return context

    async def _fetch_thousandeyes_context(self, resources: Dict[str, Set[str]]) -> List[Dict[str, Any]]:
        """Fetch ThousandEyes context for the affected resources.

        Args:
            resources: Dictionary of resource identifiers

        Returns:
            List of ThousandEyes context dictionaries (tests, results, etc.)
        """
        context = []

        # Get all ThousandEyes organizations
        clusters = await self.credential_manager.list_clusters(active_only=True)

        for cluster in clusters:
            credentials = await self.credential_manager.get_credentials(cluster.name)
            if not credentials:
                continue

            # Check if this is ThousandEyes
            base_url = credentials["base_url"].lower()
            if "thousandeyes" not in base_url:
                continue

            try:
                headers = {
                    "Authorization": f"Bearer {credentials['api_key']}",
                    "Content-Type": "application/json",
                    "Accept": "application/hal+json",
                }

                # Ensure base URL includes /v7 path
                if not base_url.endswith('/v7'):
                    base_url = f"{base_url}/v7"

                async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=30.0) as client:
                    # Get all tests
                    tests_response = await client.get(
                        f"{base_url}/tests",
                        headers=headers,
                    )

                    if tests_response.status_code != 200:
                        continue

                    tests_data = tests_response.json()
                    tests = tests_data.get("tests", [])

                    # Match tests by target IPs or hostnames
                    for test in tests:
                        test_target = test.get("server") or test.get("url") or test.get("targetName", "")

                        matched = False

                        # Check if target matches any IP
                        for ip in resources["ips"]:
                            if ip in test_target:
                                matched = True
                                break

                        # Check if target matches any hostname
                        for hostname in resources["hostnames"]:
                            if hostname.lower() in test_target.lower():
                                matched = True
                                break

                        if matched:
                            # Fetch recent results for this test
                            test_id = test.get("testId")
                            test_type = test.get("type", "agent-to-server")

                            results_response = await client.get(
                                f"{base_url}/tests/{test_id}/results",
                                headers=headers,
                                params={"window": "12h"},
                            )

                            if results_response.status_code == 200:
                                results_data = results_response.json()

                                context.append({
                                    "source": "thousandeyes",
                                    "type": "test",
                                    "organization": cluster.name,
                                    "test": test,
                                    "results": results_data.get("results", []),
                                })

            except Exception as e:
                logger.error(f"      Error fetching ThousandEyes context: {e}")

        return context

    async def _create_incidents_with_ai(
        self,
        enriched_incidents: List[Dict[str, Any]],
        existing_incidents: List[Dict[str, Any]] = None
    ) -> List[int]:
        """Use AI to analyze enriched incidents and create or merge incident reports.

        Args:
            enriched_incidents: List of incidents with Splunk, Meraki, and ThousandEyes data
            existing_incidents: List of existing open/investigating incidents to consider for merging

        Returns:
            List of created or updated incident IDs
        """
        if not enriched_incidents:
            return []

        existing_incidents = existing_incidents or []

        # Build a comprehensive prompt for Claude
        incident_summaries = []
        for i, incident in enumerate(enriched_incidents, 1):
            splunk_event = incident["splunk_event"]
            resources = incident["resources"]
            meraki_context = incident["meraki_context"]
            te_context = incident["thousandeyes_context"]

            # Get grouped event info
            grouped_count = splunk_event.get("_grouped_count", 1)
            grouped_examples = splunk_event.get("_grouped_examples", [])

            # Extract network name from raw_event
            raw_event = splunk_event.get("raw_event", {})
            network_name = (
                raw_event.get("networkName") or
                raw_event.get("network", {}).get("name") if isinstance(raw_event.get("network"), dict) else None or
                "Unknown Network"
            )
            network_id = (
                raw_event.get("networkId") or
                raw_event.get("network", {}).get("id") if isinstance(raw_event.get("network"), dict) else None or
                ""
            )

            summary = f"""
Event Group {i}:

SPLUNK EVENT (representing {grouped_count} similar occurrences):
  Title: {splunk_event.get('title')}
  Description: {splunk_event.get('description', 'N/A')}
  Network Name: {network_name}
  Network ID: {network_id}
  Severity: {splunk_event.get('severity')}
  Urgency: {splunk_event.get('urgency')}
  Time: {splunk_event.get('timestamp')}
  Occurrence Count: {grouped_count}
"""
            if grouped_examples:
                summary += "  Example Messages:\n"
                for example in grouped_examples[:3]:
                    summary += f"    - {example[:150]}...\n"

            summary += f"""
AFFECTED RESOURCES:
  Network IDs: {', '.join(resources['network_ids']) if resources['network_ids'] else 'None'}
  IPs: {', '.join(resources['ips']) if resources['ips'] else 'None'}
  Hostnames: {', '.join(resources['hostnames']) if resources['hostnames'] else 'None'}
  Devices: {', '.join(resources['devices']) if resources['devices'] else 'None'}

MERAKI CONTEXT ({len(meraki_context)} devices):
"""
            for ctx in meraki_context[:5]:  # Limit to first 5
                device = ctx.get("data", {})
                summary += f"  - {device.get('name')}: Status={device.get('status')}, Model={device.get('model')}\n"

            summary += f"\nTHOUSANDEYES CONTEXT ({len(te_context)} tests):\n"
            for ctx in te_context[:5]:  # Limit to first 5
                test = ctx.get("test", {})
                summary += f"  - {test.get('testName')}: Type={test.get('type')}\n"

            incident_summaries.append(summary)

        # Build existing incidents summary for merging consideration
        existing_summary = ""
        if existing_incidents:
            existing_summary = "\n\nEXISTING OPEN/INVESTIGATING INCIDENTS (consider merging if new events are related):\n"
            for existing in existing_incidents:
                existing_summary += f"""
Incident #{existing['id']}:
  Title: {existing['title']}
  Status: {existing['status']}
  Severity: {existing['severity']}
  Started: {existing['start_time']}
  Root Cause Hypothesis: {existing.get('root_cause_hypothesis', 'N/A')[:200]}
  Affected Services: {', '.join(existing.get('affected_services', [])) or 'N/A'}
  Current Event Count: {existing['event_count']}
  Sample Events:
"""
                for evt in existing.get("events_summary", [])[:3]:
                    existing_summary += f"    - [{evt['source']}] {evt['title']} (affects: {evt.get('affected_resource', 'N/A')})\n"

        merge_instructions = ""
        if existing_incidents:
            merge_instructions = """
MERGE DECISION:
- ONLY merge if the new event group is from the SAME NETWORK as the existing incident
- DO NOT merge events from different networks into the same incident
- If the Network ID is different, CREATE a new incident even if the issue type is similar
- Merge when: SAME network AND same issue type AND same root cause
- Create new incident when: DIFFERENT network, OR distinct issue, OR different root cause
"""

        prompt = f"""You are analyzing {len(enriched_incidents)} network event groups detected by Splunk and enriched with Meraki and ThousandEyes data.

IMPORTANT GUIDELINES:
1. Each event group may contain multiple similar occurrences of the same issue - these have already been deduplicated.
2. CREATE incidents for events that indicate problems, failures, or require attention:
   - Authentication failures (401 Unauthorized, Invalid API key, credential errors)
   - Configuration errors affecting data collection or integrations
   - Network device issues (offline, connectivity problems, high latency)
   - Security alerts (intrusion attempts, policy violations)
   - Service degradation or outages
   - Warning or error level events from monitoring systems
3. DO NOT create incidents ONLY for truly routine operations such as:
   - DHCP address assignments or renewals (unless they fail)
   - Successful authentication events
   - Normal heartbeats or keepalives showing healthy status
   - Info-level logs with no issues indicated
4. Be INCLUSIVE - if there's any indication of a problem (error, warning, failure, unauthorized), CREATE an incident.
5. If an event group appears to be purely info/routine activity with no issues, return skip_incident: true for that group.
{merge_instructions}
For each EVENT GROUP that represents an actual problem, provide:
1. A clear, concise title that describes the specific issue AND includes the network name
   - Format: "[Issue Type] on [Device/Service] - [Network Name]"
   - Example: "High Packet Loss on MR42 - Riebel Home"
   - Example: "VLAN Violations on MX68 - MojoDojoCasaHouse"
   - ALWAYS include the network name from the event data
2. Root cause analysis combining all data sources
3. Confidence score (0-100%)
4. Severity (critical/high/medium/low) - do NOT use "info" for actual incidents
5. List of affected services/resources
6. Recommended remediation steps
7. The occurrence_count from the event group
8. EITHER "merge_with_incident_id" (if merging with existing) OR leave it null (to create new)
{existing_summary}
EVENT GROUPS:

{chr(10).join(incident_summaries)}

Respond in JSON format:
{{
  "incidents": [
    {{
      "incident_index": 1,
      "skip_incident": false,
      "merge_with_incident_id": null,
      "title": "Brief descriptive title of the actual problem",
      "root_cause": "Detailed analysis combining Splunk, Meraki, and ThousandEyes data",
      "confidence": 87,
      "severity": "high",
      "affected_services": ["service1", "service2"],
      "remediation": "Recommended steps to resolve",
      "occurrence_count": 5
    }},
    {{
      "incident_index": 2,
      "skip_incident": false,
      "merge_with_incident_id": 42,
      "title": "Additional events for existing incident",
      "root_cause": "Same root cause as incident #42",
      "confidence": 90,
      "severity": "high",
      "affected_services": ["service1"],
      "remediation": "Continue monitoring",
      "occurrence_count": 3
    }},
    {{
      "incident_index": 3,
      "skip_incident": true,
      "skip_reason": "Routine DHCP renewal - normal network operation"
    }}
  ]
}}
"""

        try:
            from src.services.multi_provider_ai import generate_text

            # Use multi-provider AI
            result = await generate_text(
                prompt=prompt,
                max_tokens=8192,
            )

            if not result:
                logger.warning("No AI provider configured for Splunk correlation")
                return []

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
                        alert_count=len(enriched_events),
                    )
                )
            except Exception as cost_error:
                logger.warning(f"Failed to log splunk correlation cost: {cost_error}")

            # Log raw response for debugging
            logger.info(f"AI raw response (first 500 chars): {response_text[:500]}")

            # Try to extract JSON from markdown code blocks
            json_match = re.search(r"```json\n(.*?)\n```", response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(1)
                logger.info("Extracted JSON from markdown code block")
            else:
                # Try alternate markdown format without newline
                json_match = re.search(r"```json(.*?)```", response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(1).strip()
                    logger.info("Extracted JSON from alternate markdown format")

            # Remove any leading/trailing whitespace
            response_text = response_text.strip()

            if not response_text:
                logger.error("Empty response text after extraction")
                raise ValueError("Empty response from Claude API")

            logger.info(f"Attempting to parse JSON (first 200 chars): {response_text[:200]}")
            result = json.loads(response_text)
            ai_incidents = result.get("incidents", [])

            # Create or merge incidents in database
            incident_ids = []
            skipped_count = 0
            merged_count = 0
            async with self.db.session() as session:
                from sqlalchemy import select

                for ai_incident in ai_incidents:
                    # Check if AI marked this as a routine event to skip
                    if ai_incident.get("skip_incident", False):
                        skip_reason = ai_incident.get("skip_reason", "Routine event")
                        logger.info(f"  Skipping routine event group: {skip_reason}")
                        skipped_count += 1
                        continue

                    incident_index = ai_incident.get("incident_index", 1) - 1
                    if incident_index < 0 or incident_index >= len(enriched_incidents):
                        continue

                    enriched = enriched_incidents[incident_index]
                    splunk_event = enriched["splunk_event"]

                    # Map severity
                    severity_map = {
                        "critical": EventSeverity.CRITICAL,
                        "high": EventSeverity.HIGH,
                        "medium": EventSeverity.MEDIUM,
                        "low": EventSeverity.LOW,
                        "info": EventSeverity.INFO,
                    }

                    # Skip INFO severity incidents - per user request
                    ai_severity = ai_incident.get("severity", "medium").lower()
                    if ai_severity == "info":
                        logger.info(f"  Skipping INFO severity incident: {ai_incident.get('title', 'Unknown')}")
                        skipped_count += 1
                        continue

                    # Convert timezone-aware datetime to naive for database
                    event_timestamp = splunk_event["timestamp"]
                    if event_timestamp.tzinfo is not None:
                        event_timestamp = event_timestamp.replace(tzinfo=None)

                    # Get occurrence count from AI response or fall back to grouped count
                    occurrence_count = ai_incident.get("occurrence_count") or splunk_event.get("_grouped_count", 1)

                    # Distribute AI cost across all events in this group proportionally
                    events_in_group = 1 + len(enriched.get("meraki_context", [])) + len(enriched.get("thousandeyes_context", []))
                    cost_per_event = ai_cost / max(len(enriched_incidents), 1) / events_in_group if events_in_group > 0 else 0
                    tokens_per_event = total_tokens // max(len(enriched_incidents), 1) // events_in_group if events_in_group > 0 else 0

                    # First try deterministic matching (device + event type)
                    deterministic_merge_id = self._find_matching_incident(splunk_event, existing_incidents)

                    # Use deterministic match if found, otherwise fall back to AI suggestion
                    merge_id = deterministic_merge_id or ai_incident.get("merge_with_incident_id")
                    incident = None

                    if merge_id:
                        # Try to fetch the existing incident
                        query = select(Incident).where(Incident.id == merge_id)
                        result = await session.execute(query)
                        incident = result.scalar_one_or_none()

                        if incident:
                            logger.info(f"  Merging events into existing incident #{merge_id}: {incident.title}")
                            merged_count += 1

                            # Update the incident with new information
                            incident.updated_at = datetime.utcnow()

                            # Update root cause if AI provided more detail
                            if ai_incident.get("root_cause"):
                                existing_hypothesis = incident.root_cause_hypothesis or ""
                                new_hypothesis = ai_incident.get("root_cause", "")
                                if len(new_hypothesis) > len(existing_hypothesis):
                                    incident.root_cause_hypothesis = new_hypothesis

                            # Update confidence if AI is more confident
                            new_confidence = ai_incident.get("confidence", 0)
                            if new_confidence > (incident.confidence_score or 0):
                                incident.confidence_score = new_confidence

                            # Merge affected services
                            existing_services = set(incident.affected_services or [])
                            new_services = set(ai_incident.get("affected_services", []))
                            incident.affected_services = list(existing_services | new_services)

                            # Update severity if new events are more severe
                            new_severity = severity_map.get(ai_severity, EventSeverity.MEDIUM)
                            severity_order = [EventSeverity.INFO, EventSeverity.LOW, EventSeverity.MEDIUM, EventSeverity.HIGH, EventSeverity.CRITICAL]
                            if severity_order.index(new_severity) > severity_order.index(incident.severity):
                                incident.severity = new_severity

                            incident_ids.append(incident.id)
                        else:
                            logger.warning(f"  Could not find incident #{merge_id} for merging, creating new incident")

                    # Create new incident if not merging
                    if not incident:
                        # Extract network info for this incident
                        raw_event = splunk_event.get("raw_event", {})
                        network_id, network_name = self._extract_network_info(raw_event)

                        # If we have network_id but no network_name, look it up from cache
                        if network_id and not network_name:
                            network_name = await self._lookup_network_name(network_id)
                            if network_name:
                                logger.info(f"    → Looked up network name: {network_name}")

                        # Format title to include network name
                        ai_title = ai_incident.get("title", splunk_event["title"])
                        formatted_title = self._format_incident_title(ai_title, network_name)

                        # Extract device serial for config fetching
                        device_serial = raw_event.get("deviceSerial")
                        if not device_serial:
                            # Try to get from _raw JSON
                            raw_str = raw_event.get("_raw", "")
                            if raw_str:
                                try:
                                    parsed = json.loads(raw_str)
                                    device_serial = parsed.get("deviceSerial")
                                except (json.JSONDecodeError, TypeError):
                                    pass

                        # Fetch device configuration for incident context
                        device_config = None
                        if device_serial and network_id:
                            event_type = raw_event.get("type", "unknown").lower()
                            try:
                                device_config = await self.device_config_fetcher.fetch_device_config(
                                    device_serial=device_serial,
                                    network_id=network_id,
                                    organization_name=splunk_event["organization"],
                                    incident_type=event_type,
                                )
                                if device_config:
                                    logger.info(f"    → Fetched device config for {device_serial}")
                            except Exception as e:
                                logger.warning(f"    → Failed to fetch device config: {e}")

                        incident = Incident(
                            title=formatted_title,
                            status=IncidentStatus.OPEN,
                            severity=severity_map.get(ai_severity, EventSeverity.MEDIUM),
                            start_time=event_timestamp,
                            root_cause_hypothesis=ai_incident.get("root_cause"),
                            confidence_score=ai_incident.get("confidence", 50.0),
                            affected_services=ai_incident.get("affected_services", []),
                            organizations=[splunk_event["organization"]],
                            event_count=occurrence_count,
                            # Network-specific fields
                            network_id=network_id,
                            network_name=network_name,
                            device_config=device_config,
                        )
                        session.add(incident)
                        await session.flush()
                        await session.refresh(incident)
                        incident_ids.append(incident.id)
                        logger.info(f"  Created new incident #{incident.id}: {incident.title} (network: {network_name or 'Unknown'})")

                    # Create event for the Splunk notable event
                    event = Event(
                        source=EventSource.SPLUNK,
                        source_event_id=splunk_event["raw_event"].get("event_id") or splunk_event["raw_event"].get("_cd"),
                        organization=splunk_event["organization"],
                        event_type="notable",
                        severity=severity_map.get(ai_severity, EventSeverity.MEDIUM),
                        title=splunk_event["title"],
                        description=splunk_event["description"][:1000] if splunk_event.get("description") else None,
                        timestamp=event_timestamp,
                        affected_resource=splunk_event["raw_event"].get("dest") or splunk_event["raw_event"].get("src"),
                        raw_data=splunk_event["raw_event"],
                        incident_id=incident.id,
                        ai_cost=cost_per_event,
                        token_count=tokens_per_event,
                    )
                    session.add(event)

                    # Create events for Meraki context data
                    for meraki_item in enriched.get("meraki_context", []):
                        meraki_event = Event(
                            source=EventSource.MERAKI,
                            source_event_id=f"meraki-{meraki_item.get('serial', meraki_item.get('id', ''))}",
                            organization=meraki_item.get("organization", splunk_event["organization"]),
                            event_type=meraki_item.get("type", "context"),
                            severity=EventSeverity.INFO,  # Context events are informational
                            title=f"Meraki Context: {meraki_item.get('name', 'Device')}",
                            description=str(meraki_item)[:1000],  # Full context data for AI
                            timestamp=event_timestamp,
                            affected_resource=meraki_item.get("name") or meraki_item.get("serial"),
                            raw_data=meraki_item,
                            incident_id=incident.id,
                            ai_cost=cost_per_event,
                            token_count=tokens_per_event,
                        )
                        session.add(meraki_event)

                    # Create events for ThousandEyes context data
                    for te_item in enriched.get("thousandeyes_context", []):
                        te_event = Event(
                            source=EventSource.THOUSANDEYES,
                            source_event_id=f"te-{te_item.get('testId', te_item.get('id', ''))}",
                            organization=te_item.get("organization", splunk_event["organization"]),
                            event_type=te_item.get("type", "context"),
                            severity=EventSeverity.INFO,  # Context events are informational
                            title=f"ThousandEyes Context: {te_item.get('testName', 'Test')}",
                            description=str(te_item)[:1000],  # Full context data for AI
                            timestamp=event_timestamp,
                            affected_resource=te_item.get("testName"),
                            raw_data=te_item,
                            incident_id=incident.id,
                            ai_cost=cost_per_event,
                            token_count=tokens_per_event,
                        )
                        session.add(te_event)

                    # Update incident event count
                    context_event_count = len(enriched.get("meraki_context", [])) + len(enriched.get("thousandeyes_context", []))
                    new_events_added = occurrence_count + context_event_count
                    incident.event_count = (incident.event_count or 0) + new_events_added

            if skipped_count > 0:
                logger.info(f"  → Skipped {skipped_count} routine/info event groups")
            if merged_count > 0:
                logger.info(f"  → Merged events into {merged_count} existing incidents")

            return incident_ids

        except Exception as e:
            logger.error(f"Error creating incidents with AI: {e}")
            return []
