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
        r"dhcp_(?:ack|request|discover|offer|release|renew|lease|no_lease)",
        r"dhcp_lease",
        r"dhcp_no_lease",
        r"(?:ip|address).*(?:assigned|renewed|released)",
        # WiFi client lifecycle (routine association/auth events)
        r"\bwpa_(?:auth|deauth)\b",
        r"\bassociation\b",
        r"\bdisassociation\b",
        r"\b8021x_(?:auth|deauth)\b",
        r"\bsplash_auth\b",
        # Meraki operational events (routine logging, not actionable)
        r"\bevents_dropped",
        r"\baps_association_reject\b",
        # IDS alerts that were successfully blocked (no breach — informational)
        r"ids.*alert.*blocked",
        r"intrusion.*blocked",
        r"blocked.*true",
        # HTTP client errors (4xx) — noisy, usually misconfigured clients, not incidents
        r"http\s*4\d{2}\b",
        r"http.*(?:400|401|403|404|405|408|429)\b.*(?:error|bad request)",
        r"bad\s*request",
        # Heartbeats and keepalives
        r"heartbeat",
        r"keepalive",
        r"health.*check.*(?:pass|success|ok)",
        r"ping.*(?:success|ok|reply)",
        # Normal authentication (successes)
        r"(?:auth|login).*(?:success|succeeded|successful)",
        r"user.*logged.*in",
        r"session.*(?:started|established)",
        # Routine status messages (only health-check-style, not general status changes)
        r"(?:health.*check|heartbeat|keepalive|monitoring).*(?:normal|ok|healthy|up|online)",
        r"interface.*(?:up|online)",
        r"link.*(?:up|established)",
        # Normal traffic/connections (only routine protocol-level, not VPN or security events)
        r"(?:tcp|http|ssl|tls|socket).*connection.*(?:established|opened)",
        r"(?:wifi|wireless|wlan|802\.11).*client.*(?:connected|associated)",
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

        # 1. Network ID - prevents cross-network grouping
        network_id, _ = self._extract_network_info(raw_event)
        if network_id:
            components.append(f"network:{network_id}")
        else:
            # No network ID — group by title so identical events still merge
            # (e.g., all "HTTP 400 Errors" from the same source get grouped)
            components.append("network:unknown")

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
            self._last_run_stats = {"events_found": 0, "events_filtered": 0}
            return []

        # Step 1b: Filter out routine/normal events
        logger.info("Step 1b: Filtering out routine events...")
        filtered_events = [e for e in splunk_events if not self._is_routine_event(e)]
        filtered_count = len(splunk_events) - len(filtered_events)
        logger.info(f"  → Filtered out {filtered_count} routine events, {len(filtered_events)} remaining")

        # Track stats for callers
        self._last_run_stats = {"events_found": len(splunk_events), "events_filtered": filtered_count}

        if not filtered_events:
            logger.info("All events were routine - no incidents to create")
            return []

        # Step 1c: Group similar events to prevent duplicates
        logger.info("Step 1c: Grouping similar events to prevent duplicates...")
        grouped_events = self._group_similar_events(filtered_events)
        logger.info(f"  → Grouped into {len(grouped_events)} unique event types")

        # Cap the number of groups to process to avoid extremely long runs.
        # Prioritize groups with more occurrences (likely real issues, not noise).
        MAX_EVENT_GROUPS = 50
        if len(grouped_events) > MAX_EVENT_GROUPS:
            grouped_events.sort(key=lambda e: e.get("_grouped_count", 1), reverse=True)
            skipped = len(grouped_events) - MAX_EVENT_GROUPS
            grouped_events = grouped_events[:MAX_EVENT_GROUPS]
            logger.warning(f"  → Capped to {MAX_EVENT_GROUPS} groups (skipped {skipped} low-count groups)")

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

        # Get SSL verification setting from database (default False for self-signed certs)
        splunk_verify_ssl_str = await config_service.get_config("splunk_verify_ssl")
        splunk_verify_ssl = splunk_verify_ssl_str.lower() == "true" if splunk_verify_ssl_str else False

        # Get configurable Splunk query settings
        # splunk_correlation_indexes: comma-separated list of indexes (default: * for all)
        # splunk_correlation_query: custom SPL query (overrides default if set)
        # splunk_correlation_limit: max events to fetch (default: 500)
        splunk_indexes = await config_service.get_config("splunk_correlation_indexes")
        splunk_custom_query = await config_service.get_config("splunk_correlation_query")
        splunk_limit_str = await config_service.get_config("splunk_correlation_limit")
        splunk_limit = int(splunk_limit_str) if splunk_limit_str else 500

        credentials_list = []

        # Add system_config Splunk if configured
        if splunk_api_url and (splunk_bearer_token or (splunk_username and splunk_password)):
            credentials_list.append({
                "name": "system_config",
                "base_url": splunk_api_url,
                "api_key": splunk_bearer_token,
                "username": splunk_username,
                "password": splunk_password,
                "verify_ssl": splunk_verify_ssl,
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
                    # Build optimized search query
                    # Priority: custom query > indexed query with filters > fallback broad query
                    if splunk_custom_query:
                        # User-defined custom query - use as-is with time filter
                        search_query = f'search earliest={earliest_time} {splunk_custom_query} | head {splunk_limit}'
                        logger.info(f"      Using custom correlation query")
                    elif splunk_indexes:
                        # User-specified indexes with severity filtering
                        index_list = [idx.strip() for idx in splunk_indexes.split(",") if idx.strip()]
                        index_clause = " OR ".join([f'index="{idx}"' for idx in index_list])
                        search_query = f'search earliest={earliest_time} ({index_clause}) | head {splunk_limit}'
                        logger.info(f"      Searching indexes: {index_list}")
                    else:
                        # Smart default: search for notable/alert events across common indexes
                        # This query prioritizes actionable events:
                        # 1. Searches common network/security indexes
                        # 2. Filters for events with severity or alert indicators
                        # 3. Falls back to all indexes if no matches
                        search_query = f'''search earliest={earliest_time} (
                            (index=meraki OR index=cisco OR index=network OR index=security OR index=main OR index=notable OR index=*)
                            AND (
                                severity=* OR priority=* OR alert=* OR critical OR high OR warning OR error
                                OR type="*_down" OR type="*_offline" OR type="*_failed"
                                OR "packet loss" OR "high latency" OR "connectivity" OR "vpn"
                                OR sourcetype=meraki:* OR sourcetype=cisco:*
                            )
                        ) | head {splunk_limit}'''
                        logger.info(f"      Using smart default query (filtering for notable events)")

                    logger.info(f"      Creating search job with limit: {splunk_limit} events")
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
                        params={"output_mode": "json", "count": splunk_limit},
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
                            "organization": credentials["name"],
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
                logger.error(f"      Error fetching from {credentials['name']}: {e}")

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

        Uses credential_pool to find Meraki credentials (from system_config or clusters),
        then fetches device info, status, uplink health, and network context.

        Args:
            resources: Dictionary of resource identifiers (device_serials, network_ids, ips, etc.)

        Returns:
            List of Meraki context dictionaries with enriched device and network data
        """
        context = []
        base_url = "https://api.meraki.com/api/v1"

        # Use credential_pool to get Meraki credentials (includes system_config AND clusters)
        try:
            from src.services.credential_pool import get_initialized_pool
            pool = await get_initialized_pool()
            meraki_cred = pool.get_for_meraki()

            if not meraki_cred:
                logger.debug("    No Meraki credentials found in credential_pool")
                return context

            api_key = (
                meraki_cred.credentials.get("api_key") or
                meraki_cred.credentials.get("meraki_api_key")
            )
            if not api_key:
                logger.warning("    Meraki credentials found but no API key")
                return context

            cred_name = meraki_cred.cluster_name or "system_config"
            logger.debug(f"    Using Meraki credentials from: {cred_name}")

        except Exception as e:
            logger.warning(f"    Error getting Meraki credentials from pool: {e}")
            return context

        headers = {
            "X-Cisco-Meraki-API-Key": api_key,
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                # Step 1: Get organization ID
                org_response = await client.get(f"{base_url}/organizations", headers=headers)
                if org_response.status_code != 200:
                    logger.warning(f"    Failed to get Meraki orgs: HTTP {org_response.status_code}")
                    return context

                orgs = org_response.json()
                if not orgs:
                    logger.warning("    No Meraki organizations found")
                    return context

                org_id = orgs[0]["id"]
                org_name = orgs[0].get("name", "Unknown")
                logger.debug(f"    Using Meraki org: {org_name} ({org_id})")

                # Step 2: Fetch devices with their statuses (combined endpoint)
                devices_response = await client.get(
                    f"{base_url}/organizations/{org_id}/devices/statuses",
                    headers=headers,
                )

                devices = []
                device_statuses = {}
                if devices_response.status_code == 200:
                    device_status_list = devices_response.json()
                    # This endpoint returns device info WITH status
                    for ds in device_status_list:
                        device_statuses[ds.get("serial", "").upper()] = {
                            "status": ds.get("status"),
                            "lastReportedAt": ds.get("lastReportedAt"),
                            "publicIp": ds.get("publicIp"),
                            "lanIp": ds.get("lanIp"),
                        }
                    logger.debug(f"    Fetched status for {len(device_statuses)} devices")

                # Step 3: Fetch full device details
                devices_detail_response = await client.get(
                    f"{base_url}/organizations/{org_id}/devices",
                    headers=headers,
                )
                if devices_detail_response.status_code == 200:
                    devices = devices_detail_response.json()
                    logger.debug(f"    Fetched details for {len(devices)} devices")

                # Step 4: Fetch uplink statuses for appliances (MX, Z-series)
                uplink_statuses = {}
                try:
                    uplink_response = await client.get(
                        f"{base_url}/organizations/{org_id}/appliance/uplink/statuses",
                        headers=headers,
                    )
                    if uplink_response.status_code == 200:
                        uplinks = uplink_response.json()
                        for uplink in uplinks:
                            serial = uplink.get("serial", "").upper()
                            uplink_statuses[serial] = uplink.get("uplinks", [])
                        logger.debug(f"    Fetched uplink status for {len(uplink_statuses)} appliances")
                except Exception as e:
                    logger.debug(f"    Could not fetch uplink statuses: {e}")

                # Step 4b: Fetch security events (IDS, malware, content filtering)
                security_events = []
                try:
                    # Get security events from last 24 hours
                    from datetime import datetime, timedelta
                    t0 = (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z"
                    t1 = datetime.utcnow().isoformat() + "Z"

                    security_response = await client.get(
                        f"{base_url}/organizations/{org_id}/appliance/security/events",
                        headers=headers,
                        params={"t0": t0, "t1": t1, "perPage": 50},
                    )
                    if security_response.status_code == 200:
                        events = security_response.json()
                        if isinstance(events, list):
                            security_events = events
                        elif isinstance(events, dict):
                            security_events = events.get("events", [])
                        logger.debug(f"    Fetched {len(security_events)} security events")

                        # Add security events to context (these are critical for incident analysis)
                        for event in security_events[:10]:  # Limit to 10 most recent
                            context.append({
                                "source": "meraki",
                                "type": "security_event",
                                "organization": org_name,
                                "data": {
                                    "eventType": event.get("eventType"),
                                    "clientMac": event.get("clientMac"),
                                    "clientIp": event.get("clientIp"),
                                    "srcIp": event.get("srcIp"),
                                    "destIp": event.get("destIp"),
                                    "protocol": event.get("protocol"),
                                    "ts": event.get("ts"),
                                    "deviceSerial": event.get("deviceSerial"),
                                    "message": event.get("message"),
                                    "signature": event.get("signature"),
                                    "priority": event.get("priority"),
                                    "classification": event.get("classification"),
                                    "blocked": event.get("blocked"),
                                },
                            })
                except Exception as e:
                    logger.debug(f"    Could not fetch security events: {e}")

                # Step 4c: Fetch loss and latency history for appliances
                # This provides performance trends over time for matched devices
                loss_latency_cache = {}
                try:
                    # Only fetch for devices that match our resources (to avoid too many API calls)
                    # We'll populate this later when we have matched devices
                    pass  # Will be populated per-device below
                except Exception as e:
                    logger.debug(f"    Could not fetch loss/latency data: {e}")

                # Step 4d: Fetch organization-wide client summary
                client_summary = {}
                try:
                    # Get top clients by usage for context
                    from datetime import datetime, timedelta
                    t0 = (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z"
                    t1 = datetime.utcnow().isoformat() + "Z"

                    # Get organization-wide client count
                    clients_response = await client.get(
                        f"{base_url}/organizations/{org_id}/summary/top/clients/byUsage",
                        headers=headers,
                        params={"t0": t0, "t1": t1},
                    )
                    if clients_response.status_code == 200:
                        top_clients = clients_response.json()
                        if top_clients:
                            client_summary = {
                                "topClientsCount": len(top_clients),
                                "topClients": [
                                    {
                                        "name": c.get("name") or c.get("mac", "Unknown"),
                                        "mac": c.get("mac"),
                                        "usage": c.get("usage", {}).get("total", 0),
                                        "network": c.get("network", {}).get("name"),
                                    }
                                    for c in top_clients[:5]  # Top 5 clients
                                ],
                            }
                            logger.debug(f"    Fetched top {len(top_clients)} clients summary")
                except Exception as e:
                    logger.debug(f"    Could not fetch client summary: {e}")

                # Step 5: Build network cache for quick lookup
                networks_cache = {}
                for device in devices:
                    network_id = device.get("networkId")
                    if network_id and network_id not in networks_cache:
                        try:
                            net_response = await client.get(
                                f"{base_url}/networks/{network_id}",
                                headers=headers,
                            )
                            if net_response.status_code == 200:
                                networks_cache[network_id] = net_response.json()
                        except Exception:
                            pass

                # Step 6: Match devices against resources
                matched_devices = set()  # Track matched serials to avoid duplicates

                for device in devices:
                    device_name = device.get("name", "").lower()
                    device_serial = device.get("serial", "").upper()
                    device_mac = device.get("mac", "").lower() if device.get("mac") else ""
                    device_network_id = device.get("networkId", "")
                    device_ips = {
                        device.get("lanIp"),
                        device.get("wan1Ip"),
                        device.get("wan2Ip"),
                    }
                    device_ips.discard(None)

                    matched = False
                    match_reason = ""

                    # Match by device serial (highest priority)
                    for serial in resources["device_serials"]:
                        if serial.upper() == device_serial:
                            matched = True
                            match_reason = f"serial:{serial}"
                            break

                    # Match by network_id (if device is in affected network)
                    if not matched and device_network_id:
                        for network_id in resources["network_ids"]:
                            if network_id == device_network_id:
                                matched = True
                                match_reason = f"network:{network_id}"
                                break

                    # Match by MAC address
                    if not matched and device_mac:
                        for mac in resources["mac_addresses"]:
                            if mac.lower().replace(":", "").replace("-", "") == device_mac.replace(":", ""):
                                matched = True
                                match_reason = f"mac:{mac}"
                                break

                    # Match by IP address
                    if not matched:
                        for ip in resources["ips"]:
                            if ip in device_ips:
                                matched = True
                                match_reason = f"ip:{ip}"
                                break

                    if matched and device_serial not in matched_devices:
                        matched_devices.add(device_serial)

                        # Enrich device data with status
                        status_info = device_statuses.get(device_serial, {})
                        device["status"] = status_info.get("status", "unknown")
                        device["lastReportedAt"] = status_info.get("lastReportedAt")

                        # Enrich with uplink health for appliances
                        if device_serial in uplink_statuses:
                            device["uplinkHealth"] = {}
                            for uplink in uplink_statuses[device_serial]:
                                interface = uplink.get("interface", "unknown")
                                device["uplinkHealth"][interface] = {
                                    "status": uplink.get("status"),
                                    "ip": uplink.get("ip"),
                                    "gateway": uplink.get("gateway"),
                                    "publicIp": uplink.get("publicIp"),
                                    "primaryDns": uplink.get("primaryDns"),
                                }

                        # Fetch loss and latency history for this device (appliances only)
                        device_model = device.get("model", "").upper()
                        if device_model.startswith(("MX", "Z", "MG")):  # Appliances and cellular gateways
                            try:
                                # Get uplink IP for loss/latency check (use gateway or public IP)
                                uplink_ip = None
                                if device_serial in uplink_statuses:
                                    for uplink in uplink_statuses[device_serial]:
                                        if uplink.get("status") == "active":
                                            uplink_ip = uplink.get("gateway") or uplink.get("publicIp")
                                            break

                                if uplink_ip:
                                    # Fetch loss and latency history (last 2 hours)
                                    from datetime import datetime, timedelta
                                    t0 = (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z"
                                    t1 = datetime.utcnow().isoformat() + "Z"

                                    ll_response = await client.get(
                                        f"{base_url}/devices/{device_serial}/lossAndLatencyHistory",
                                        headers=headers,
                                        params={"ip": uplink_ip, "t0": t0, "t1": t1, "resolution": 300},
                                    )
                                    if ll_response.status_code == 200:
                                        ll_data = ll_response.json()
                                        if ll_data:
                                            # Calculate average loss and latency
                                            loss_values = [d.get("lossPercent", 0) for d in ll_data if d.get("lossPercent") is not None]
                                            latency_values = [d.get("latencyMs", 0) for d in ll_data if d.get("latencyMs") is not None]

                                            device["lossLatencyHistory"] = {
                                                "targetIp": uplink_ip,
                                                "samples": len(ll_data),
                                                "avgLossPercent": round(sum(loss_values) / len(loss_values), 2) if loss_values else 0,
                                                "maxLossPercent": max(loss_values) if loss_values else 0,
                                                "avgLatencyMs": round(sum(latency_values) / len(latency_values), 1) if latency_values else 0,
                                                "maxLatencyMs": max(latency_values) if latency_values else 0,
                                                "recentData": ll_data[-5:] if len(ll_data) > 5 else ll_data,  # Last 5 data points
                                            }
                                            logger.debug(f"      Got loss/latency history for {device_serial}: avg loss={device['lossLatencyHistory']['avgLossPercent']}%")
                            except Exception as e:
                                logger.debug(f"      Could not fetch loss/latency for {device_serial}: {e}")

                        # Add client summary to device context
                        if client_summary:
                            device["clientSummary"] = client_summary

                        # Add network context
                        network_info = None
                        if device_network_id and device_network_id in networks_cache:
                            net = networks_cache[device_network_id]
                            network_info = {
                                "id": net.get("id"),
                                "name": net.get("name"),
                                "type": net.get("productTypes", []),
                                "timeZone": net.get("timeZone"),
                                "tags": net.get("tags", []),
                            }

                        context.append({
                            "source": "meraki",
                            "type": "device",
                            "organization": org_name,
                            "matchReason": match_reason,
                            "data": device,
                            "network": network_info,
                        })
                        logger.debug(f"      Matched device: {device.get('name')} ({device_serial}) via {match_reason}")

                logger.info(f"    → Matched {len(context)} Meraki devices")

        except Exception as e:
            logger.error(f"    Error fetching Meraki context: {e}", exc_info=True)

        return context

    async def _fetch_thousandeyes_context(self, resources: Dict[str, Set[str]]) -> List[Dict[str, Any]]:
        """Fetch ThousandEyes context for the affected resources.

        Uses credential_pool to find ThousandEyes credentials, then fetches:
        - Active alerts
        - Tests matching affected resources
        - Test results with metrics
        - Agent health summary

        Args:
            resources: Dictionary of resource identifiers (ips, hostnames, etc.)

        Returns:
            List of ThousandEyes context dictionaries with alerts, tests, and results
        """
        context = []
        base_url = "https://api.thousandeyes.com/v7"

        # Use credential_pool to get ThousandEyes credentials
        try:
            from src.services.credential_pool import get_initialized_pool
            pool = await get_initialized_pool()
            te_cred = pool.get_for_thousandeyes()

            if not te_cred:
                logger.debug("    No ThousandEyes credentials found in credential_pool")
                return context

            api_key = (
                te_cred.credentials.get("api_key") or
                te_cred.credentials.get("thousandeyes_token") or
                te_cred.credentials.get("bearer_token")
            )
            if not api_key:
                logger.warning("    ThousandEyes credentials found but no API key/token")
                return context

            cred_name = te_cred.cluster_name or "system_config"
            logger.debug(f"    Using ThousandEyes credentials from: {cred_name}")

        except Exception as e:
            logger.warning(f"    Error getting ThousandEyes credentials from pool: {e}")
            return context

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/hal+json",
        }

        try:
            async with httpx.AsyncClient(verify=True, timeout=30.0) as client:
                # Step 1: Fetch active alerts (critical for incident correlation)
                try:
                    alerts_response = await client.get(
                        f"{base_url}/alerts",
                        headers=headers,
                        params={"window": "1d"},
                    )
                    if alerts_response.status_code == 200:
                        alerts_data = alerts_response.json()
                        alerts = alerts_data.get("alert", [])
                        active_alerts = [a for a in alerts if a.get("active", 0) == 1]

                        # Add active alerts to context
                        for alert in active_alerts:
                            alert_target = alert.get("testName", "") + " " + alert.get("ruleName", "")

                            # Check if alert relates to our resources
                            matched = False
                            for ip in resources["ips"]:
                                if ip in alert_target:
                                    matched = True
                                    break
                            for hostname in resources["hostnames"]:
                                if hostname.lower() in alert_target.lower():
                                    matched = True
                                    break

                            # Include all alerts if no specific resource match (could be related)
                            if matched or not resources["ips"] and not resources["hostnames"]:
                                context.append({
                                    "source": "thousandeyes",
                                    "type": "alert",
                                    "organization": cred_name,
                                    "data": {
                                        "alertId": alert.get("alertId"),
                                        "testName": alert.get("testName"),
                                        "ruleName": alert.get("ruleName"),
                                        "alertState": "active" if alert.get("active") else "cleared",
                                        "severity": alert.get("severity"),
                                        "dateStart": alert.get("dateStart"),
                                        "violationCount": alert.get("violationCount"),
                                        "agents": alert.get("agents", []),
                                    },
                                })

                        logger.debug(f"    Fetched {len(active_alerts)} active ThousandEyes alerts")
                except Exception as e:
                    logger.debug(f"    Could not fetch ThousandEyes alerts: {e}")

                # Step 2: Fetch agent health summary
                try:
                    agents_response = await client.get(
                        f"{base_url}/agents",
                        headers=headers,
                    )
                    if agents_response.status_code == 200:
                        agents_data = agents_response.json()
                        agents = agents_data.get("agents", [])
                        online_agents = [a for a in agents if a.get("enabled", 0) == 1]
                        offline_agents = [a for a in agents if a.get("enabled", 0) == 0]

                        # Add agent health summary
                        context.append({
                            "source": "thousandeyes",
                            "type": "agent_health",
                            "organization": cred_name,
                            "data": {
                                "totalAgents": len(agents),
                                "onlineAgents": len(online_agents),
                                "offlineAgents": len(offline_agents),
                                "offlineAgentNames": [a.get("agentName") for a in offline_agents[:5]],
                            },
                        })
                        logger.debug(f"    ThousandEyes agents: {len(online_agents)} online, {len(offline_agents)} offline")
                except Exception as e:
                    logger.debug(f"    Could not fetch ThousandEyes agents: {e}")

                # Step 3: Fetch tests and match against resources
                tests_response = await client.get(
                    f"{base_url}/tests",
                    headers=headers,
                )

                if tests_response.status_code != 200:
                    logger.warning(f"    Failed to get ThousandEyes tests: HTTP {tests_response.status_code}")
                    return context

                tests_data = tests_response.json()
                tests = tests_data.get("tests", [])
                logger.debug(f"    Fetched {len(tests)} ThousandEyes tests")

                # Match tests by target IPs or hostnames
                matched_tests = 0
                for test in tests:
                    test_target = (
                        test.get("server", "") +
                        test.get("url", "") +
                        test.get("targetName", "") +
                        test.get("testName", "")
                    ).lower()

                    matched = False
                    match_reason = ""

                    # Check if target matches any IP
                    for ip in resources["ips"]:
                        if ip in test_target:
                            matched = True
                            match_reason = f"ip:{ip}"
                            break

                    # Check if target matches any hostname
                    if not matched:
                        for hostname in resources["hostnames"]:
                            if hostname.lower() in test_target:
                                matched = True
                                match_reason = f"hostname:{hostname}"
                                break

                    if matched:
                        matched_tests += 1
                        test_id = test.get("testId")
                        test_type = test.get("type", "agent-to-server")

                        # Fetch recent results for this test
                        test_context = {
                            "source": "thousandeyes",
                            "type": "test",
                            "organization": cred_name,
                            "matchReason": match_reason,
                            "test": {
                                "testId": test_id,
                                "testName": test.get("testName"),
                                "type": test_type,
                                "server": test.get("server"),
                                "url": test.get("url"),
                                "enabled": test.get("enabled", 1),
                                "interval": test.get("interval"),
                            },
                            "results": None,
                            "metrics": None,
                        }

                        # Fetch test results based on test type
                        try:
                            # Get network results (loss, latency, jitter)
                            if test_type in ["agent-to-server", "agent-to-agent", "network"]:
                                results_response = await client.get(
                                    f"{base_url}/test-results/{test_id}/network",
                                    headers=headers,
                                    params={"window": "12h"},
                                )
                                if results_response.status_code == 200:
                                    results = results_response.json().get("results", [])
                                    if results:
                                        # Calculate summary metrics
                                        avg_loss = sum(r.get("loss", 0) for r in results) / len(results)
                                        avg_latency = sum(r.get("avgLatency", 0) for r in results) / len(results)
                                        max_latency = max(r.get("maxLatency", 0) for r in results)

                                        test_context["metrics"] = {
                                            "avgLossPercent": round(avg_loss, 2),
                                            "avgLatencyMs": round(avg_latency, 2),
                                            "maxLatencyMs": round(max_latency, 2),
                                            "sampleCount": len(results),
                                        }
                                        test_context["results"] = results[:5]  # Last 5 results

                            # Get HTTP results (response time, errors)
                            elif test_type in ["http-server", "page-load", "web-transactions"]:
                                results_response = await client.get(
                                    f"{base_url}/test-results/{test_id}/http-server",
                                    headers=headers,
                                    params={"window": "12h"},
                                )
                                if results_response.status_code == 200:
                                    results = results_response.json().get("results", [])
                                    if results:
                                        avg_response = sum(r.get("responseTime", 0) for r in results) / len(results)
                                        error_count = sum(1 for r in results if r.get("errorType"))

                                        test_context["metrics"] = {
                                            "avgResponseTimeMs": round(avg_response, 2),
                                            "errorCount": error_count,
                                            "sampleCount": len(results),
                                        }
                                        test_context["results"] = results[:5]

                        except Exception as e:
                            logger.debug(f"    Could not fetch results for test {test_id}: {e}")

                        context.append(test_context)

                logger.info(f"    → Matched {matched_tests} ThousandEyes tests")

        except Exception as e:
            logger.error(f"    Error fetching ThousandEyes context: {e}", exc_info=True)

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

MERAKI CONTEXT:
"""
            # Separate Meraki devices from security events
            meraki_devices = [c for c in meraki_context if c.get("type") == "device"]
            meraki_security = [c for c in meraki_context if c.get("type") == "security_event"]

            # Security events (critical - show first)
            if meraki_security:
                summary += f"  Security Events ({len(meraki_security)} in last 24h):\n"
                for ctx in meraki_security[:5]:
                    event = ctx.get("data", {})
                    event_type = event.get("eventType", "unknown")
                    src_ip = event.get("srcIp") or event.get("clientIp", "")
                    dest_ip = event.get("destIp", "")
                    blocked = "BLOCKED" if event.get("blocked") else "detected"
                    classification = event.get("classification", "")
                    signature = event.get("signature", "")

                    summary += f"    - {event_type}: {src_ip} → {dest_ip} [{blocked}]\n"
                    if signature:
                        summary += f"      Signature: {signature}\n"
                    if classification:
                        summary += f"      Classification: {classification}\n"

            # Devices
            summary += f"  Devices ({len(meraki_devices)} matched):\n"
            for ctx in meraki_devices[:5]:  # Limit to first 5
                device = ctx.get("data", {})
                network = ctx.get("network", {})
                match_reason = ctx.get("matchReason", "")

                # Basic device info
                device_line = f"    Device: {device.get('name', 'Unknown')} ({device.get('model', 'Unknown')})\n"
                device_line += f"      Serial: {device.get('serial')}\n"
                device_line += f"      Status: {device.get('status', 'unknown')}"
                if device.get('lastReportedAt'):
                    device_line += f" (last seen: {device.get('lastReportedAt')})"
                device_line += "\n"

                # IPs
                ips = []
                if device.get('lanIp'):
                    ips.append(f"LAN={device.get('lanIp')}")
                if device.get('wan1Ip'):
                    ips.append(f"WAN1={device.get('wan1Ip')}")
                if device.get('wan2Ip'):
                    ips.append(f"WAN2={device.get('wan2Ip')}")
                if ips:
                    device_line += f"      IPs: {', '.join(ips)}\n"

                # Uplink health (for appliances)
                uplink_health = device.get('uplinkHealth', {})
                if uplink_health:
                    uplink_info = []
                    for iface, health in uplink_health.items():
                        status = health.get('status', 'unknown')
                        ip = health.get('publicIp') or health.get('ip', '')
                        uplink_info.append(f"{iface}={status}" + (f" ({ip})" if ip else ""))
                    if uplink_info:
                        device_line += f"      Uplinks: {', '.join(uplink_info)}\n"

                # Loss/latency history (for appliances)
                ll_history = device.get('lossLatencyHistory', {})
                if ll_history:
                    device_line += f"      Performance (last 2h): "
                    device_line += f"Loss avg={ll_history.get('avgLossPercent', 0)}% max={ll_history.get('maxLossPercent', 0)}%, "
                    device_line += f"Latency avg={ll_history.get('avgLatencyMs', 0)}ms max={ll_history.get('maxLatencyMs', 0)}ms\n"
                    # Flag if there are performance issues
                    if ll_history.get('avgLossPercent', 0) > 1 or ll_history.get('maxLossPercent', 0) > 5:
                        device_line += f"      ⚠ ELEVATED PACKET LOSS DETECTED\n"
                    if ll_history.get('avgLatencyMs', 0) > 100 or ll_history.get('maxLatencyMs', 0) > 200:
                        device_line += f"      ⚠ HIGH LATENCY DETECTED\n"

                # Network context
                if network:
                    device_line += f"      Network: {network.get('name', 'Unknown')} ({network.get('id', '')})\n"
                    if network.get('type'):
                        device_line += f"      Network Type: {', '.join(network.get('type', []))}\n"

                # Match reason (for debugging)
                if match_reason:
                    device_line += f"      Matched via: {match_reason}\n"

                summary += device_line

            # Client summary (organization-wide)
            if meraki_devices:
                # Get client summary from first device (it's org-wide)
                first_device = meraki_devices[0].get("data", {})
                client_summary = first_device.get("clientSummary", {})
                if client_summary:
                    summary += f"  Client Summary:\n"
                    summary += f"    Top clients by usage (last 24h):\n"
                    for c in client_summary.get("topClients", []):
                        usage_mb = round(c.get("usage", 0) / (1024 * 1024), 1)
                        summary += f"      - {c.get('name', 'Unknown')}: {usage_mb} MB on {c.get('network', 'Unknown')}\n"

            # ThousandEyes context - separate alerts, agent health, and tests
            te_alerts = [c for c in te_context if c.get("type") == "alert"]
            te_agent_health = [c for c in te_context if c.get("type") == "agent_health"]
            te_tests = [c for c in te_context if c.get("type") == "test"]

            summary += f"\nTHOUSANDEYES CONTEXT:\n"

            # Active alerts
            if te_alerts:
                summary += f"  Active Alerts ({len(te_alerts)}):\n"
                for ctx in te_alerts[:3]:
                    alert = ctx.get("data", {})
                    summary += f"    - {alert.get('testName')}: {alert.get('ruleName')}\n"
                    summary += f"      Severity: {alert.get('severity')}, Violations: {alert.get('violationCount')}\n"

            # Agent health summary
            for ctx in te_agent_health:
                health = ctx.get("data", {})
                summary += f"  Agent Health: {health.get('onlineAgents', 0)}/{health.get('totalAgents', 0)} online\n"
                if health.get('offlineAgentNames'):
                    summary += f"    Offline: {', '.join(health.get('offlineAgentNames', []))}\n"

            # Test results with metrics
            if te_tests:
                summary += f"  Tests ({len(te_tests)} matched):\n"
                for ctx in te_tests[:5]:
                    test = ctx.get("test", {})
                    metrics = ctx.get("metrics", {})
                    match_reason = ctx.get("matchReason", "")

                    test_line = f"    - {test.get('testName')} ({test.get('type')})\n"
                    if metrics:
                        if "avgLossPercent" in metrics:
                            test_line += f"      Loss: {metrics.get('avgLossPercent')}%, "
                            test_line += f"Latency: {metrics.get('avgLatencyMs')}ms avg, {metrics.get('maxLatencyMs')}ms max\n"
                        elif "avgResponseTimeMs" in metrics:
                            test_line += f"      Response: {metrics.get('avgResponseTimeMs')}ms, Errors: {metrics.get('errorCount')}\n"
                    if match_reason:
                        test_line += f"      Matched via: {match_reason}\n"
                    summary += test_line

            if not te_alerts and not te_tests and not te_agent_health:
                summary += "  No ThousandEyes data available\n"

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
2. CREATE incidents ONLY for events that pose a real risk or require human action:
   - Device offline, unreachable, or dormant (VPN down, uplink disconnected)
   - Security breaches or unblocked intrusion attempts
   - Sustained connectivity or performance degradation (high packet loss, latency spikes)
   - Service outages affecting users
   - Configuration errors causing data loss or integration failures
3. DO NOT create incidents for:
   - IDS alerts that were BLOCKED — the firewall handled it, no breach occurred. Skip these.
   - HTTP 4xx client errors (400 Bad Request, 401 Unauthorized, 404 Not Found) — these are client-side issues, not network incidents
   - DHCP, WiFi association, authentication lifecycle events
   - Info-level operational logs, heartbeats, keepalives
   - Normal syslog noise from network devices
   - Events where the system already auto-remediated (e.g., blocked attacks, auto-reconnects)
4. Be SELECTIVE — only create incidents for things a network operator would need to investigate or fix. If the system already handled it (blocked, auto-recovered), skip it.
5. If an event group is informational, already handled, or not actionable, return skip_incident: true with a clear skip_reason.
{merge_instructions}
For each EVENT GROUP that represents an actual actionable problem, provide:
1. A clear, concise title that describes the specific issue AND includes the network name
   - Format: "[Issue Type] on [Device/Service] - [Network Name]"
   - Example: "High Packet Loss on MR42 - Demo Home"
   - Example: "Site-to-Site VPN Down on Z3 - Grieves"
   - ALWAYS include the network name from the event data
2. DETAILED root cause analysis — this is shown to the user as the main summary. It MUST include:
   - Specific device names, models, and serials involved
   - Specific IP addresses, ports, and protocols from the event data
   - Exact timestamps or time ranges when the issue occurred
   - What the Meraki/ThousandEyes context reveals about the impact
   - Whether traffic was blocked, degraded, or lost
   - Quantitative data: how many occurrences, error counts, latency values, loss percentages
   - A clear explanation of what this means for the network operator
   Do NOT write vague summaries like "issues detected" — be specific with IPs, devices, and numbers.
3. Confidence score (0-100%)
4. Severity (critical/high/medium/low) - do NOT use "info" for actual incidents
5. List of affected services/resources (use specific names: "Internet Gateway (MX68 - Garage)", "Site-to-Site VPN (Grieves)", etc.)
6. Specific, actionable remediation steps (not generic advice — reference the actual devices and configurations)
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
                        alert_count=len(enriched_incidents),
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

                            # Merge enrichment context
                            if enriched.get("meraki_context"):
                                existing_meraki = incident.meraki_context or []
                                # Deduplicate by device serial
                                existing_serials = {
                                    m.get("data", {}).get("serial")
                                    for m in existing_meraki if isinstance(m, dict)
                                }
                                for new_item in enriched.get("meraki_context", []):
                                    if isinstance(new_item, dict):
                                        serial = new_item.get("data", {}).get("serial")
                                        if not serial or serial not in existing_serials:
                                            existing_meraki.append(new_item)
                                            if serial:
                                                existing_serials.add(serial)
                                incident.meraki_context = existing_meraki

                            if enriched.get("te_context"):
                                existing_te = incident.thousandeyes_context or []
                                # Deduplicate by test ID or alert ID
                                existing_ids = {
                                    t.get("data", {}).get("testId") or t.get("data", {}).get("alertId")
                                    for t in existing_te if isinstance(t, dict)
                                }
                                for new_item in enriched.get("te_context", []):
                                    if isinstance(new_item, dict):
                                        item_id = new_item.get("data", {}).get("testId") or new_item.get("data", {}).get("alertId")
                                        if not item_id or item_id not in existing_ids:
                                            existing_te.append(new_item)
                                            if item_id:
                                                existing_ids.add(item_id)
                                incident.thousandeyes_context = existing_te

                            # Merge enrichment sources
                            existing_sources = set(incident.enrichment_sources or [])
                            if enriched.get("meraki_context"):
                                existing_sources.add("meraki")
                            if enriched.get("te_context"):
                                existing_sources.add("thousandeyes")
                            incident.enrichment_sources = list(existing_sources)

                            # Append to raw Splunk events
                            existing_raw = incident.splunk_events_raw or []
                            if splunk_event.get("raw_event"):
                                existing_raw.append(splunk_event.get("raw_event"))
                            incident.splunk_events_raw = existing_raw[-20:]  # Keep last 20

                            # Accumulate AI costs
                            incident.ai_analysis_cost = (incident.ai_analysis_cost or 0) + cost_per_event
                            incident.ai_tokens_used = (incident.ai_tokens_used or 0) + tokens_per_event

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

                        # Extract performance metrics from Meraki context
                        performance_metrics = {}
                        for meraki_item in enriched.get("meraki_context", []):
                            if isinstance(meraki_item, dict):
                                data = meraki_item.get("data", {}) if isinstance(meraki_item.get("data"), dict) else {}
                                if data.get("lossLatencyHistory"):
                                    performance_metrics["lossLatencyHistory"] = data.get("lossLatencyHistory")
                                if data.get("clientSummary"):
                                    performance_metrics["clientSummary"] = data.get("clientSummary")

                        # Build enrichment sources list
                        enrichment_sources = []
                        if enriched.get("meraki_context"):
                            enrichment_sources.append("meraki")
                        if enriched.get("te_context"):
                            enrichment_sources.append("thousandeyes")

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
                            # Enrichment context
                            meraki_context=enriched.get("meraki_context"),
                            thousandeyes_context=enriched.get("te_context"),
                            performance_metrics=performance_metrics if performance_metrics else None,
                            enrichment_sources=enrichment_sources if enrichment_sources else None,
                            splunk_events_raw=[splunk_event.get("raw_event")],
                            # AI analysis tracking
                            ai_analysis_cost=cost_per_event,
                            ai_tokens_used=tokens_per_event,
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
