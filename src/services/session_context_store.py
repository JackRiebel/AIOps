"""Session Context Store for AI Agent Context Management.

This module provides centralized session context management to solve the
"disconnected models problem" where agents lose track of organization context,
discovered entities, and conversation state across multi-turn conversations.

Key features:
- Persistent org context (fixes "org not found" errors)
- Entity discovery tracking (networks, devices, VLANs, SSIDs, clients)
- Prior tool result compression
- Automatic context enrichment for tool calls

Based on 2025 best practices from Cognition AI, LangChain, and Microsoft:
"Default to single-threaded linear agents where context remains continuous.
Share full agent traces, not just individual messages."
"""

import logging
import json
import hashlib
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum

logger = logging.getLogger(__name__)


class EntityType(str, Enum):
    """Types of entities that can be discovered and tracked."""
    ORGANIZATION = "organization"
    NETWORK = "network"
    DEVICE = "device"
    VLAN = "vlan"
    SSID = "ssid"
    CLIENT = "client"
    SITE = "site"
    ALERT = "alert"
    TEST = "test"  # ThousandEyes tests


class ImportanceLevel(int, Enum):
    """Importance levels for context prioritization.

    Based on MemGPT research: treat context as constrained memory resource.
    Higher scores = more likely to be kept in context window.
    """
    CRITICAL = 100    # Current focus, active operations, just used
    HIGH = 75         # Recently accessed (< 5 min), frequently used
    MEDIUM = 50       # Discovered entities, prior results
    LOW = 25          # Old context (> 30 min), rarely accessed
    MINIMAL = 10      # Background data, can be evicted first


class OrgType(str, Enum):
    """Types of organizations/platforms."""
    MERAKI = "meraki"
    CATALYST = "catalyst"
    SPLUNK = "splunk"
    THOUSANDEYES = "thousandeyes"


@dataclass
class DiscoveredEntity:
    """A discovered entity from a tool call."""
    entity_type: EntityType
    id: str  # Primary identifier (network_id, serial, vlan_id, etc.)
    name: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)
    discovered_at: datetime = field(default_factory=datetime.utcnow)
    last_accessed: datetime = field(default_factory=datetime.utcnow)  # For LRU eviction
    source_tool: Optional[str] = None  # Tool that discovered this entity
    access_count: int = 0  # Number of times entity was accessed

    def touch(self) -> None:
        """Update last_accessed timestamp and increment access count."""
        self.last_accessed = datetime.utcnow()
        self.access_count += 1

    def calculate_importance(self, current_focus_id: Optional[str] = None) -> int:
        """Calculate importance score for context prioritization.

        Based on MemGPT research: importance is a function of recency,
        frequency, and current focus.

        Args:
            current_focus_id: ID of the currently focused entity (if any)

        Returns:
            Importance score (0-100)
        """
        score = ImportanceLevel.MEDIUM.value  # Base score: 50

        # Boost if current focus
        if current_focus_id and self.id == current_focus_id:
            score += 50  # Max: 100

        # Recency bonus (decay over time)
        minutes_since_access = (datetime.utcnow() - self.last_accessed).total_seconds() / 60
        if minutes_since_access < 2:
            score += 30  # Just accessed
        elif minutes_since_access < 5:
            score += 20  # Very recent
        elif minutes_since_access < 15:
            score += 10  # Recent
        elif minutes_since_access > 60:
            score -= 20  # Old, less relevant

        # Frequency bonus (capped to prevent runaway)
        score += min(self.access_count * 3, 15)  # Max +15 for frequent access

        # Entity type priority (some types more important than others)
        type_bonus = {
            EntityType.NETWORK: 5,    # Networks often referenced
            EntityType.DEVICE: 3,     # Devices commonly queried
            EntityType.ALERT: 8,      # Alerts are actionable
            EntityType.VLAN: 2,
            EntityType.SSID: 2,
            EntityType.CLIENT: 1,
            EntityType.SITE: 4,
            EntityType.TEST: 3,
        }
        score += type_bonus.get(self.entity_type, 0)

        # Clamp to valid range
        return max(0, min(100, score))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "entity_type": self.entity_type.value,
            "id": self.id,
            "name": self.name,
            "data": self.data,
            "discovered_at": self.discovered_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat(),
            "source_tool": self.source_tool,
            "access_count": self.access_count,
            "importance": self.calculate_importance(),
        }


@dataclass
class CompressedToolResult:
    """Compressed summary of a tool result for context."""
    tool_name: str
    timestamp: datetime
    success: bool
    summary: str  # Compressed summary (e.g., "Found 5 networks, 12 devices")
    key_findings: List[str] = field(default_factory=list)  # Important extracted info
    entity_ids: List[str] = field(default_factory=list)  # IDs of entities involved

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "tool_name": self.tool_name,
            "timestamp": self.timestamp.isoformat(),
            "success": self.success,
            "summary": self.summary,
            "key_findings": self.key_findings,
            "entity_ids": self.entity_ids,
        }


@dataclass
class OrgContext:
    """Organization context with credentials."""
    org_id: str
    org_name: str
    org_type: OrgType
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    base_url: Optional[str] = None
    username: Optional[str] = None
    additional_credentials: Dict[str, str] = field(default_factory=dict)

    def get_credentials(self) -> Dict[str, str]:
        """Get credentials dictionary for API calls."""
        creds = {}
        if self.api_key:
            creds["api_key"] = self.api_key
        if self.api_secret:
            creds["api_secret"] = self.api_secret
        if self.base_url:
            creds["base_url"] = self.base_url
        if self.username:
            creds["username"] = self.username
        creds.update(self.additional_credentials)
        return creds


@dataclass
class CanvasCardState:
    """State of a canvas card for AI context awareness.

    This allows the AI to know what cards are currently displayed on
    the user's canvas, enabling contextual conversations about visible data.
    """
    card_id: str
    card_type: str
    title: str
    data_summary: str = ""  # Brief summary of card data (e.g., "91% healthy, 3 alerts")
    network_id: Optional[str] = None
    org_id: Optional[str] = None
    added_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "card_id": self.card_id,
            "card_type": self.card_type,
            "title": self.title,
            "data_summary": self.data_summary,
            "network_id": self.network_id,
            "org_id": self.org_id,
            "added_at": self.added_at.isoformat(),
        }

    def to_context_line(self) -> str:
        """Format as a context line for system prompt."""
        parts = [f"- **{self.title}** ({self.card_type})"]
        if self.network_id:
            parts.append(f"[network: {self.network_id[:20]}...]")
        if self.data_summary:
            parts.append(f": {self.data_summary}")
        return " ".join(parts)


@dataclass
class SessionContext:
    """Persistent session context across all tool calls.

    This is the core data structure that solves context fragmentation.
    It persists across conversation turns and provides full context
    to every tool call.
    """
    session_id: str

    # Organization contexts (can have multiple - meraki, splunk, etc.)
    org_contexts: Dict[str, OrgContext] = field(default_factory=dict)
    primary_org_type: Optional[OrgType] = None  # Most recently used org type

    # Discovered entities by type
    discovered_entities: Dict[EntityType, Dict[str, DiscoveredEntity]] = field(
        default_factory=lambda: defaultdict(dict)
    )

    # Conversation state
    current_focus: Optional[str] = None  # e.g., "network:Demo Home"
    current_focus_type: Optional[EntityType] = None
    current_focus_id: Optional[str] = None

    # Prior tool results (compressed)
    prior_results: List[CompressedToolResult] = field(default_factory=list)
    max_prior_results: int = 20  # Keep last N results

    # Conversation summary
    conversation_topics: List[str] = field(default_factory=list)
    conversation_summary: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_updated: datetime = field(default_factory=datetime.utcnow)
    last_tool_call: Optional[datetime] = None

    # Statistics
    tool_call_count: int = 0
    total_entities_discovered: int = 0

    # Bootstrap data (auto-fetched platform context)
    bootstrap_data: Dict[str, Any] = field(default_factory=dict)
    bootstrap_timestamp: Optional[datetime] = None

    # Cardable data cache (for "Add to Canvas" when AI responds from context)
    # Format: [{tool, data, data_type, live_topic, network_id, org_id, cached_at}, ...]
    cardable_data_cache: List[Dict[str, Any]] = field(default_factory=list)
    cardable_cache_ttl_minutes: int = 30  # How long cached data remains cardable

    # Canvas state - cards currently displayed on user's canvas
    # Synced from frontend to enable AI awareness of visible data
    canvas_cards: List[CanvasCardState] = field(default_factory=list)

    # Track card types added in this session to prevent duplicates
    # Format: ["card_type:network_id", "card_type:org_id", ...]
    active_card_types: List[str] = field(default_factory=list)

    # Track incident analysis to detect context switches
    # This prevents cardable_data_cache pollution across different incidents
    _last_incident_id: Optional[int] = None
    _last_incident_network_id: Optional[str] = None

    def get_org_context(self, org_type: OrgType) -> Optional[OrgContext]:
        """Get organization context by type."""
        return self.org_contexts.get(org_type.value)

    def get_primary_org_context(self) -> Optional[OrgContext]:
        """Get the primary (most recently used) org context."""
        if self.primary_org_type:
            return self.org_contexts.get(self.primary_org_type.value)
        # Return first available if no primary
        if self.org_contexts:
            return next(iter(self.org_contexts.values()))
        return None

    def get_entity(self, entity_type: EntityType, entity_id: str, touch: bool = True) -> Optional[DiscoveredEntity]:
        """Get a discovered entity by type and ID.

        Args:
            entity_type: Type of entity
            entity_id: Entity identifier
            touch: If True, update last_accessed for LRU tracking

        Returns:
            The entity if found, None otherwise
        """
        entity = self.discovered_entities.get(entity_type, {}).get(entity_id)
        if entity and touch:
            entity.touch()
        return entity

    def get_entity_by_name(self, entity_type: EntityType, name: str, touch: bool = True) -> Optional[DiscoveredEntity]:
        """Get a discovered entity by type and name (case-insensitive).

        Args:
            entity_type: Type of entity
            name: Entity name to search for
            touch: If True, update last_accessed for LRU tracking

        Returns:
            The entity if found, None otherwise
        """
        name_lower = name.lower()
        for entity in self.discovered_entities.get(entity_type, {}).values():
            if entity.name and entity.name.lower() == name_lower:
                if touch:
                    entity.touch()
                return entity
        return None

    def get_all_entities(self, entity_type: EntityType) -> List[DiscoveredEntity]:
        """Get all discovered entities of a type (sorted by recency)."""
        entities = list(self.discovered_entities.get(entity_type, {}).values())
        # Sort by last_accessed descending (most recent first)
        entities.sort(key=lambda e: e.last_accessed, reverse=True)
        return entities

    def get_prioritized_entities(self, max_entities: int = 20) -> List[DiscoveredEntity]:
        """Get entities sorted by importance score (highest first).

        Args:
            max_entities: Maximum number of entities to return

        Returns:
            List of entities sorted by importance, limited to max_entities
        """
        all_entities = []
        for entity_dict in self.discovered_entities.values():
            all_entities.extend(entity_dict.values())

        # Calculate importance for each entity
        scored = [
            (entity, entity.calculate_importance(self.current_focus_id))
            for entity in all_entities
        ]

        # Sort by importance descending
        scored.sort(key=lambda x: x[1], reverse=True)

        # Return top N
        return [entity for entity, score in scored[:max_entities]]

    def get_prioritized_context(self, token_budget: int = 1000) -> str:
        """Build context string prioritized by importance within token budget.

        Based on MemGPT pattern: treat context as constrained memory resource.
        Include most important entities first, then fill remaining budget.

        Args:
            token_budget: Approximate token budget (uses 4 chars per token estimate)

        Returns:
            Prioritized context string for inclusion in prompts
        """
        char_budget = token_budget * 4  # Rough estimate
        parts = []
        total_chars = 0

        # Always include org context (highest priority)
        primary_org = self.get_primary_org_context()
        if primary_org:
            org_line = f"**Organization**: {primary_org.org_name} (ID: {primary_org.org_id})"
            parts.append(org_line)
            total_chars += len(org_line)

        # Add current focus if set
        if self.current_focus:
            focus_line = f"**Current Focus**: {self.current_focus}"
            parts.append(focus_line)
            total_chars += len(focus_line)

        # Get prioritized entities
        prioritized = self.get_prioritized_entities(max_entities=30)

        # Group by entity type for readability
        by_type: Dict[EntityType, List[DiscoveredEntity]] = defaultdict(list)
        for entity in prioritized:
            by_type[entity.entity_type].append(entity)

        # Add entities by type until budget exhausted
        type_order = [
            EntityType.NETWORK, EntityType.DEVICE, EntityType.VLAN,
            EntityType.SSID, EntityType.ALERT, EntityType.SITE
        ]

        for entity_type in type_order:
            entities = by_type.get(entity_type, [])
            if not entities:
                continue

            type_header = f"\n**{entity_type.value.title()}s** ({len(entities)}):"
            if total_chars + len(type_header) > char_budget:
                break

            parts.append(type_header)
            total_chars += len(type_header)

            for entity in entities:
                # Format: "- Name (ID: xxx) [importance: 85]"
                importance = entity.calculate_importance(self.current_focus_id)
                if entity.name:
                    entity_line = f"  - {entity.name} (ID: {entity.id[:20]}...) [{importance}]"
                else:
                    entity_line = f"  - {entity.id[:30]}... [{importance}]"

                if total_chars + len(entity_line) > char_budget:
                    parts.append(f"  - ...and {len(entities) - entities.index(entity)} more")
                    break

                parts.append(entity_line)
                total_chars += len(entity_line)

        return "\n".join(parts)

    def evict_low_importance_entities(self, max_entities_per_type: int = 50) -> int:
        """Evict low-importance entities to prevent unbounded growth.

        Args:
            max_entities_per_type: Maximum entities to keep per type

        Returns:
            Number of entities evicted
        """
        evicted = 0

        for entity_type, entities_dict in self.discovered_entities.items():
            if len(entities_dict) <= max_entities_per_type:
                continue

            # Get entities sorted by importance (lowest first)
            entities = list(entities_dict.values())
            scored = [
                (entity, entity.calculate_importance(self.current_focus_id))
                for entity in entities
            ]
            scored.sort(key=lambda x: x[1])  # Lowest importance first

            # Evict lowest importance entities
            to_evict = len(entities) - max_entities_per_type
            for entity, score in scored[:to_evict]:
                del entities_dict[entity.id]
                evicted += 1
                logger.debug(f"[ContextEviction] Evicted {entity_type.value}: {entity.id} (score: {score})")

        if evicted > 0:
            logger.info(f"[ContextEviction] Evicted {evicted} low-importance entities")

        return evicted

    def get_context_stats(self) -> Dict[str, Any]:
        """Get context statistics for monitoring and SSE events.

        Returns:
            Dictionary with context size metrics
        """
        entity_counts = {
            et.value: len(entities)
            for et, entities in self.discovered_entities.items()
            if entities
        }
        total_entities = sum(entity_counts.values())

        return {
            "total_entities": total_entities,
            "entity_counts": entity_counts,
            "prior_results_count": len(self.prior_results),
            "tool_call_count": self.tool_call_count,
            "has_bootstrap_data": bool(self.bootstrap_data),
            "cardable_cache_size": len(self.cardable_data_cache),
            "conversation_summary_length": len(self.conversation_summary),
        }

    def add_cardable_data(self, tool_data: Dict[str, Any]):
        """Add tool result to cardable data cache for "Add to Canvas" buttons.

        Args:
            tool_data: Dict with keys: tool, data, data_type, live_topic, network_id, org_id
        """
        # Add timestamp
        cached_item = {
            **tool_data,
            "cached_at": datetime.utcnow().isoformat(),
        }

        # Check for duplicate (same tool + same data_type + same network/org)
        for existing in self.cardable_data_cache:
            if (existing.get("tool") == tool_data.get("tool") and
                existing.get("data_type") == tool_data.get("data_type") and
                existing.get("network_id") == tool_data.get("network_id") and
                existing.get("org_id") == tool_data.get("org_id")):
                # Replace with newer data
                self.cardable_data_cache.remove(existing)
                break

        self.cardable_data_cache.append(cached_item)

        # Keep only last 20 items
        if len(self.cardable_data_cache) > 20:
            self.cardable_data_cache = self.cardable_data_cache[-20:]

        logger.debug(f"[CardableCache] Added {tool_data.get('tool')} (total: {len(self.cardable_data_cache)})")

    def get_valid_cardable_data(self) -> List[Dict[str, Any]]:
        """Get cardable data that hasn't expired.

        Returns:
            List of valid cardable data items (within TTL)
        """
        now = datetime.utcnow()
        valid_items = []

        for item in self.cardable_data_cache:
            cached_at_str = item.get("cached_at")
            if cached_at_str:
                try:
                    cached_at = datetime.fromisoformat(cached_at_str)
                    age_minutes = (now - cached_at).total_seconds() / 60
                    if age_minutes <= self.cardable_cache_ttl_minutes:
                        valid_items.append(item)
                except (ValueError, TypeError):
                    pass  # Skip invalid timestamps

        return valid_items

    def clear_cardable_cache(self):
        """Clear the cardable data cache."""
        self.cardable_data_cache = []
        logger.debug("[CardableCache] Cleared cache")

    def set_incident_context(self, incident_id: int, network_id: Optional[str] = None):
        """Set the current incident context and clear cache if incident changed.

        This prevents cardable_data_cache pollution when switching between incidents.
        When a new incident is detected (different ID), the cardable cache is cleared.

        Args:
            incident_id: The incident ID being analyzed
            network_id: Optional network ID associated with the incident
        """
        # Check if this is a different incident than last analyzed
        if self._last_incident_id != incident_id:
            # New incident - clear stale cache to prevent pollution
            self.clear_cardable_cache()
            logger.info(f"[SessionContext] New incident detected (#{incident_id}), cleared cardable cache (was incident #{self._last_incident_id})")

        # Update incident tracking
        self._last_incident_id = incident_id
        self._last_incident_network_id = network_id
        self.last_updated = datetime.utcnow()

    def to_context_summary(self) -> str:
        """Generate a context summary for inclusion in prompts."""
        lines = []

        # Bootstrap data at the TOP (most important)
        if self.bootstrap_data:
            lines.append("## AVAILABLE PLATFORM DATA (AUTO-FETCHED)")
            lines.append("_Use these IDs directly - DO NOT call list_organizations, list_networks, or get_sites._\n")

            # Meraki organizations and networks
            if "meraki" in self.bootstrap_data:
                meraki = self.bootstrap_data["meraki"]
                orgs = meraki.get("organizations", [])
                if orgs:
                    lines.append(f"### Meraki Organizations ({len(orgs)})")
                    for org in orgs[:10]:  # Show first 10
                        org_name = org.get("name", "Unknown")
                        org_id = org.get("id", "")
                        lines.append(f"- **{org_name}** → org_id: `{org_id}`")
                    if len(orgs) > 10:
                        lines.append(f"  _...and {len(orgs) - 10} more organizations_")

                networks = meraki.get("networks", {})
                if networks:
                    lines.append("")
                    for org_id, nets in networks.items():
                        if nets:
                            # Find org name
                            org_name = next((o.get("name") for o in orgs if str(o.get("id")) == str(org_id)), org_id)
                            lines.append(f"**Networks in {org_name} (org_id: {org_id}):**")
                            for net in nets[:10]:
                                net_name = net.get("name", "Unknown")
                                net_id = net.get("id", "")
                                lines.append(f"- **{net_name}** → network_id: `{net_id}`")
                            if len(nets) > 10:
                                lines.append(f"  _...and {len(nets) - 10} more networks_")

            # Catalyst sites
            if "catalyst" in self.bootstrap_data:
                catalyst = self.bootstrap_data["catalyst"]
                sites = catalyst.get("sites", [])
                if sites:
                    lines.append(f"\n### Catalyst Sites ({len(sites)})")
                    for site in sites[:10]:
                        site_name = site.get("name", site.get("siteName", "Unknown"))
                        site_id = site.get("id", site.get("siteId", ""))
                        lines.append(f"- **{site_name}** → site_id: `{site_id}`")

            # ThousandEyes tests and agents
            if "thousandeyes" in self.bootstrap_data:
                te = self.bootstrap_data["thousandeyes"]
                tests = te.get("tests", [])
                if tests:
                    lines.append(f"\n### ThousandEyes Tests ({len(tests)})")
                    for test in tests[:10]:
                        test_name = test.get("testName", test.get("name", "Unknown"))
                        test_id = test.get("testId", test.get("id", ""))
                        lines.append(f"- **{test_name}** → test_id: `{test_id}`")
                agents = te.get("agents", [])
                if agents:
                    lines.append(f"\n### ThousandEyes Agents ({len(agents)})")
                    for agent in agents[:5]:
                        agent_name = agent.get("agentName", agent.get("name", "Unknown"))
                        agent_id = agent.get("agentId", agent.get("id", ""))
                        lines.append(f"- **{agent_name}** → agent_id: `{agent_id}`")

            # Splunk
            if "splunk" in self.bootstrap_data:
                splunk = self.bootstrap_data["splunk"]
                searches = splunk.get("saved_searches", [])
                if searches:
                    lines.append(f"\n### Splunk Saved Searches ({len(searches)})")
                    for search in searches[:5]:
                        search_name = search.get("name", "Unknown")
                        lines.append(f"- **{search_name}**")

            lines.append("\n---\n")

        # Context freshness indicator
        elapsed = (datetime.utcnow() - self.last_updated).total_seconds()
        if elapsed < 60:
            freshness = "just now"
        elif elapsed < 300:  # 5 minutes
            mins = int(elapsed / 60)
            freshness = f"{mins} min ago"
        elif elapsed < 3600:  # 1 hour
            mins = int(elapsed / 60)
            freshness = f"{mins} min ago (may be stale)"
        else:
            hours = int(elapsed / 3600)
            freshness = f"{hours}h ago (consider refreshing)"

        lines.append(f"_Context updated: {freshness}_\n")

        # Organization context
        if self.org_contexts:
            lines.append("## Active Organizations")
            for org_type, org_ctx in self.org_contexts.items():
                marker = " (primary)" if org_type == self.primary_org_type else ""
                lines.append(f"- **{org_ctx.org_name}** ({org_type}){marker}")

        # Current focus
        if self.current_focus:
            lines.append(f"\n## Current Focus: {self.current_focus}")

        # Canvas state - what the user is currently viewing
        if self.canvas_cards:
            lines.append("\n## CANVAS STATE (User's Current View)")
            lines.append("_The user has these visualization cards on their canvas. You can reference them directly._\n")
            for card in self.canvas_cards:
                lines.append(card.to_context_line())
            lines.append("")

        # Discovered entities summary
        entity_counts = {
            et: len(entities)
            for et, entities in self.discovered_entities.items()
            if entities
        }
        if entity_counts:
            lines.append("\n## Discovered Entities")
            for et, count in entity_counts.items():
                sample_names = [
                    e.name or e.id
                    for e in list(self.discovered_entities[et].values())[:3]
                ]
                names_str = ", ".join(sample_names)
                if count > 3:
                    names_str += f", ... ({count - 3} more)"
                lines.append(f"- **{et.value}s**: {count} ({names_str})")

        # Recent tool results
        if self.prior_results:
            lines.append("\n## Recent Operations")
            for result in self.prior_results[-5:]:
                status = "OK" if result.success else "ERROR"
                lines.append(f"- [{status}] {result.tool_name}: {result.summary}")

        # Include compacted history if available
        if self.conversation_summary:
            lines.append("\n## Session History (Compacted)")
            lines.append(self.conversation_summary)

        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "session_id": self.session_id,
            "org_contexts": {
                k: asdict(v) for k, v in self.org_contexts.items()
            },
            "primary_org_type": self.primary_org_type.value if self.primary_org_type else None,
            "discovered_entities": {
                et.value: {
                    eid: e.to_dict()
                    for eid, e in entities.items()
                }
                for et, entities in self.discovered_entities.items()
            },
            "current_focus": self.current_focus,
            "prior_results": [r.to_dict() for r in self.prior_results],
            "conversation_summary": self.conversation_summary,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "tool_call_count": self.tool_call_count,
            "total_entities_discovered": self.total_entities_discovered,
            "bootstrap_data": self.bootstrap_data,
            "bootstrap_timestamp": self.bootstrap_timestamp.isoformat() if self.bootstrap_timestamp else None,
            "canvas_cards": [c.to_dict() for c in self.canvas_cards],
            "active_card_types": self.active_card_types,
        }


class SessionContextStore:
    """Manages session contexts with automatic enrichment.

    This is the primary interface for context management. It:
    - Creates and retrieves session contexts
    - Tracks organization credentials
    - Stores discovered entities from tool results
    - Compresses and stores prior tool results
    - Enriches tool inputs with session context
    - Implements LRU eviction to prevent unbounded memory growth
    """

    # Entity limits to prevent unbounded memory growth
    MAX_ENTITIES_PER_TYPE = 50  # Max entities per category (networks, devices, etc.)
    MAX_TOTAL_ENTITIES = 200    # Max total entities across all types

    def __init__(self, redis_client=None, db_session=None):
        """Initialize the context store.

        Args:
            redis_client: Optional Redis client for persistence
            db_session: Optional database session for persistence
        """
        self._memory_store: Dict[str, SessionContext] = {}
        self._redis = redis_client
        self._db = db_session

        # Configuration
        self.max_sessions = 1000  # Max sessions in memory
        self.session_ttl = timedelta(hours=24)  # Session expiry

        logger.info("[SessionContextStore] Initialized")

    async def get_or_create(self, session_id: str) -> SessionContext:
        """Get existing context or create new one.

        Args:
            session_id: Unique session identifier

        Returns:
            SessionContext for the session
        """
        # Check memory first
        if session_id in self._memory_store:
            ctx = self._memory_store[session_id]
            ctx.last_updated = datetime.utcnow()
            return ctx

        # Check Redis if available
        if self._redis:
            try:
                cached = await self._redis.get(f"session_ctx:{session_id}")
                if cached:
                    ctx = self._deserialize_context(json.loads(cached))
                    self._memory_store[session_id] = ctx
                    return ctx
            except Exception as e:
                logger.warning(f"[SessionContextStore] Redis get failed: {e}")

        # Create new context
        ctx = SessionContext(session_id=session_id)
        self._memory_store[session_id] = ctx

        # Cleanup old sessions if needed
        await self._cleanup_old_sessions()

        logger.info(f"[SessionContextStore] Created new session context: {session_id}")
        return ctx

    async def update_org_context(
        self,
        session_id: str,
        org_id: str,
        org_name: str,
        org_type: OrgType,
        credentials: Dict[str, str]
    ) -> None:
        """Update organization context for a session.

        This is called when an organization is resolved (e.g., from credential lookup).

        Args:
            session_id: Session identifier
            org_id: Organization ID
            org_name: Organization name
            org_type: Type of organization (meraki, splunk, etc.)
            credentials: Dictionary of credentials (api_key, base_url, etc.)
        """
        ctx = await self.get_or_create(session_id)

        org_ctx = OrgContext(
            org_id=org_id,
            org_name=org_name,
            org_type=org_type,
            api_key=credentials.get("api_key"),
            api_secret=credentials.get("api_secret"),
            base_url=credentials.get("base_url"),
            username=credentials.get("username"),
            additional_credentials={
                k: v for k, v in credentials.items()
                if k not in ("api_key", "api_secret", "base_url", "username")
            }
        )

        ctx.org_contexts[org_type.value] = org_ctx
        ctx.primary_org_type = org_type
        ctx.last_updated = datetime.utcnow()

        logger.info(
            f"[SessionContextStore] Updated org context: {org_name} ({org_type.value}) "
            f"for session {session_id}"
        )

        await self._persist_context(ctx)

    async def update_bootstrap_context(
        self,
        session_id: str,
        bootstrap_data: Dict[str, Any],
    ) -> None:
        """Update bootstrap context for a session.

        This stores automatically-fetched platform data (organizations, networks,
        sites, tests, etc.) that was retrieved before the AI responded.

        Also extracts entities (orgs, networks) and adds them to discovered_entities
        so that name resolution works for AI providers like Circuit that may use
        names instead of IDs.

        Args:
            session_id: Session identifier
            bootstrap_data: Dict of platform data keyed by platform name
        """
        ctx = await self.get_or_create(session_id)
        ctx.bootstrap_data = bootstrap_data
        ctx.bootstrap_timestamp = datetime.utcnow()
        ctx.last_updated = datetime.utcnow()

        # Extract entities from bootstrap data for name resolution
        # This is critical for Circuit AI which may output names instead of IDs
        entities_added = 0

        # Process Meraki data
        meraki_data = bootstrap_data.get("meraki", {})

        # Add organizations
        for org in meraki_data.get("organizations", []):
            org_id = str(org.get("id", ""))
            org_name = org.get("name", "")
            if org_id and org_name:
                ctx.discovered_entities[EntityType.ORGANIZATION][org_id] = DiscoveredEntity(
                    entity_type=EntityType.ORGANIZATION,
                    id=org_id,
                    name=org_name,
                    data={"url": org.get("url", "")},
                    source_tool="bootstrap",
                )
                entities_added += 1

        # Add networks (nested by org_id)
        networks_by_org = meraki_data.get("networks", {})
        for org_id, networks in networks_by_org.items():
            for network in networks:
                network_id = network.get("id", "")
                network_name = network.get("name", "")
                if network_id and network_name:
                    ctx.discovered_entities[EntityType.NETWORK][network_id] = DiscoveredEntity(
                        entity_type=EntityType.NETWORK,
                        id=network_id,
                        name=network_name,
                        data={
                            "organizationId": org_id,
                            "productTypes": network.get("productTypes", []),
                            "timeZone": network.get("timeZone", ""),
                        },
                        source_tool="bootstrap",
                    )
                    entities_added += 1

        # Process Catalyst sites
        catalyst_data = bootstrap_data.get("catalyst", {})
        for site in catalyst_data.get("sites", []):
            site_id = site.get("id", "") or site.get("siteId", "")
            site_name = site.get("name", "") or site.get("siteName", "")
            if site_id and site_name:
                ctx.discovered_entities[EntityType.SITE][str(site_id)] = DiscoveredEntity(
                    entity_type=EntityType.SITE,
                    id=str(site_id),
                    name=site_name,
                    data={},
                    source_tool="bootstrap",
                )
                entities_added += 1

        logger.info(
            f"[SessionContextStore] Updated bootstrap context for session {session_id}: "
            f"platforms={list(bootstrap_data.keys())}, entities_added={entities_added}"
        )

        await self._persist_context(ctx)

    async def update_canvas_state(
        self,
        session_id: str,
        cards: List[Dict[str, Any]],
    ) -> None:
        """Update canvas state for a session.

        This is called by the frontend to sync canvas cards with the backend,
        enabling the AI to be aware of what the user is currently viewing.

        Args:
            session_id: Session identifier
            cards: List of card state dicts with:
                - card_id: Unique card identifier
                - card_type: Type of card (e.g., "network-health")
                - title: Card title
                - data_summary: Brief summary of card data
                - network_id: Optional network context
                - org_id: Optional org context
        """
        ctx = await self.get_or_create(session_id)

        # Convert dicts to CanvasCardState objects
        ctx.canvas_cards = [
            CanvasCardState(
                card_id=card.get("card_id", ""),
                card_type=card.get("card_type", ""),
                title=card.get("title", ""),
                data_summary=card.get("data_summary", ""),
                network_id=card.get("network_id"),
                org_id=card.get("org_id"),
            )
            for card in cards
        ]

        # Update active card types for deduplication
        ctx.active_card_types = [
            f"{card.get('card_type')}:{card.get('network_id') or card.get('org_id') or 'global'}"
            for card in cards
        ]

        ctx.last_updated = datetime.utcnow()

        logger.info(
            f"[SessionContextStore] Updated canvas state for session {session_id}: "
            f"{len(cards)} cards"
        )

        await self._persist_context(ctx)

    def is_card_type_active(self, session_id: str, card_type: str, network_id: Optional[str] = None, org_id: Optional[str] = None) -> bool:
        """Check if a card type is already active on the canvas.

        Used for deduplication before suggesting new cards.

        Args:
            session_id: Session identifier
            card_type: Type of card to check
            network_id: Optional network context
            org_id: Optional org context

        Returns:
            True if a card of this type/context already exists
        """
        ctx = self._memory_store.get(session_id)
        if not ctx:
            return False

        context_key = network_id or org_id or "global"
        check_key = f"{card_type}:{context_key}"
        return check_key in ctx.active_card_types

    async def add_discovered_entity(
        self,
        session_id: str,
        entity_type: EntityType,
        entity_id: str,
        name: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        source_tool: Optional[str] = None
    ) -> DiscoveredEntity:
        """Track a discovered entity from a tool result.

        Args:
            session_id: Session identifier
            entity_type: Type of entity (network, device, etc.)
            entity_id: Unique identifier for the entity
            name: Human-readable name
            data: Additional entity data
            source_tool: Tool that discovered this entity

        Returns:
            The created or updated DiscoveredEntity
        """
        ctx = await self.get_or_create(session_id)

        # Check if entity already exists
        existing = ctx.discovered_entities[entity_type].get(entity_id)
        if existing:
            # Update existing entity and touch for LRU
            if name:
                existing.name = name
            if data:
                existing.data.update(data)
            existing.touch()  # Update last_accessed for LRU
            return existing

        # Enforce per-type limit with LRU eviction
        type_entities = ctx.discovered_entities[entity_type]
        if len(type_entities) >= self.MAX_ENTITIES_PER_TYPE:
            evicted = self._evict_stale_entities(ctx, entity_type, count=1)
            if evicted > 0:
                logger.debug(
                    f"[SessionContextStore] Evicted {evicted} stale {entity_type.value}(s) "
                    f"to make room for new entity"
                )

        # Enforce total limit with LRU eviction
        total_entities = sum(len(e) for e in ctx.discovered_entities.values())
        if total_entities >= self.MAX_TOTAL_ENTITIES:
            evicted = self._evict_stale_entities_global(ctx, count=5)
            if evicted > 0:
                logger.debug(
                    f"[SessionContextStore] Evicted {evicted} stale entities globally "
                    f"(total was {total_entities})"
                )

        # Create new entity
        entity = DiscoveredEntity(
            entity_type=entity_type,
            id=entity_id,
            name=name,
            data=data or {},
            source_tool=source_tool
        )

        ctx.discovered_entities[entity_type][entity_id] = entity
        ctx.total_entities_discovered += 1
        ctx.last_updated = datetime.utcnow()

        logger.debug(
            f"[SessionContextStore] Discovered {entity_type.value}: "
            f"{name or entity_id} (session: {session_id})"
        )

        return entity

    def _evict_stale_entities(
        self,
        ctx: SessionContext,
        entity_type: EntityType,
        count: int = 1
    ) -> int:
        """Evict least-recently-used entities of a specific type.

        Args:
            ctx: Session context
            entity_type: Type of entities to evict
            count: Number of entities to evict

        Returns:
            Number of entities evicted
        """
        entities = ctx.discovered_entities.get(entity_type, {})
        if not entities:
            return 0

        # Sort by last_accessed (oldest first)
        sorted_entities = sorted(
            entities.items(),
            key=lambda x: x[1].last_accessed
        )

        evicted = 0
        for entity_id, entity in sorted_entities[:count]:
            del entities[entity_id]
            evicted += 1
            logger.debug(
                f"[SessionContextStore] Evicted {entity_type.value}: "
                f"{entity.name or entity_id} (last accessed: {entity.last_accessed})"
            )

        return evicted

    def _evict_stale_entities_global(
        self,
        ctx: SessionContext,
        count: int = 5
    ) -> int:
        """Evict least-recently-used entities across all types.

        Args:
            ctx: Session context
            count: Number of entities to evict

        Returns:
            Number of entities evicted
        """
        # Collect all entities with their type
        all_entities: List[tuple[EntityType, str, DiscoveredEntity]] = []
        for entity_type, entities in ctx.discovered_entities.items():
            for entity_id, entity in entities.items():
                all_entities.append((entity_type, entity_id, entity))

        if not all_entities:
            return 0

        # Sort by last_accessed (oldest first)
        all_entities.sort(key=lambda x: x[2].last_accessed)

        evicted = 0
        for entity_type, entity_id, entity in all_entities[:count]:
            del ctx.discovered_entities[entity_type][entity_id]
            evicted += 1
            logger.debug(
                f"[SessionContextStore] Evicted {entity_type.value}: "
                f"{entity.name or entity_id} (last accessed: {entity.last_accessed})"
            )

        return evicted

    async def set_current_focus(
        self,
        session_id: str,
        entity_type: EntityType,
        entity_id: str,
        display_name: Optional[str] = None
    ) -> None:
        """Set the current focus entity for the session.

        Also adds the entity to discovered_entities so that name resolution works.
        This is critical for Circuit AI which may use names instead of IDs.

        Args:
            session_id: Session identifier
            entity_type: Type of entity being focused on
            entity_id: ID of the entity
            display_name: Optional display name
        """
        ctx = await self.get_or_create(session_id)

        ctx.current_focus_type = entity_type
        ctx.current_focus_id = entity_id
        ctx.current_focus = f"{entity_type.value}:{display_name or entity_id}"
        ctx.last_updated = datetime.utcnow()

        # Also add to discovered_entities so name resolution works
        # This is essential for Circuit AI which may output names instead of IDs
        if display_name and display_name != entity_id:
            ctx.add_entity(
                entity_type=entity_type,
                entity_id=entity_id,
                name=display_name,
                data={}
            )
            logger.debug(
                f"[SessionContextStore] Added focus entity to discovered: "
                f"{entity_type.value} '{display_name}' ({entity_id})"
            )

        logger.debug(f"[SessionContextStore] Focus set to: {ctx.current_focus}")

    async def add_compressed_result(
        self,
        session_id: str,
        tool_name: str,
        success: bool,
        result: Dict[str, Any]
    ) -> None:
        """Compress and store a tool result for context.

        Args:
            session_id: Session identifier
            tool_name: Name of the tool that was executed
            success: Whether the tool execution succeeded
            result: The tool result to compress
        """
        ctx = await self.get_or_create(session_id)

        # Generate compressed summary
        summary, key_findings, entity_ids = self._compress_result(tool_name, result)

        compressed = CompressedToolResult(
            tool_name=tool_name,
            timestamp=datetime.utcnow(),
            success=success,
            summary=summary,
            key_findings=key_findings,
            entity_ids=entity_ids
        )

        ctx.prior_results.append(compressed)
        ctx.tool_call_count += 1
        ctx.last_tool_call = datetime.utcnow()
        ctx.last_updated = datetime.utcnow()

        # Trim old results with compaction
        if len(ctx.prior_results) > ctx.max_prior_results:
            # Compact older results into conversation summary before trimming
            await self.compact_context(session_id)
            ctx.prior_results = ctx.prior_results[-ctx.max_prior_results:]

    async def compact_context(self, session_id: str) -> None:
        """Compress old context while preserving key information.

        This method is called automatically when prior_results exceed max_prior_results.
        It summarizes older results into the conversation_summary field to preserve
        context while reducing token usage.

        Per Anthropic guidance: treat context as a finite resource with diminishing returns.
        Summarize history while preserving architectural decisions and key findings.
        """
        ctx = self._memory_store.get(session_id)
        if not ctx:
            return

        # Only compact if we have more than 10 results
        if len(ctx.prior_results) <= 10:
            return

        # Summarize older results (keep only last 10 in detail)
        old_results = ctx.prior_results[:-10]
        if not old_results:
            return

        # Build summary from older results
        summaries = []
        tool_counts = defaultdict(int)
        success_count = 0
        error_count = 0

        for r in old_results:
            tool_counts[r.tool_name.split('_')[0]] += 1  # Platform prefix (meraki, catalyst, etc.)
            if r.success:
                success_count += 1
            else:
                error_count += 1
            # Keep key findings from older results
            if r.key_findings:
                summaries.extend(r.key_findings[:2])

        # Build compact summary
        platform_str = ", ".join(f"{cnt}x {platform}" for platform, cnt in tool_counts.items())
        status_str = f"{success_count} OK" + (f", {error_count} errors" if error_count else "")
        summary = f"Earlier: {len(old_results)} operations ({platform_str}), {status_str}"

        if summaries:
            # Keep most important findings (up to 5)
            summary += f"\nKey findings: {'; '.join(summaries[:5])}"

        # Update or append to conversation summary
        if ctx.conversation_summary:
            ctx.conversation_summary = summary + "\n---\n" + ctx.conversation_summary
        else:
            ctx.conversation_summary = summary

        # Keep conversation summary under 500 chars
        if len(ctx.conversation_summary) > 500:
            ctx.conversation_summary = ctx.conversation_summary[:500] + "..."

        logger.debug(
            f"[SessionContextStore] Compacted context for {session_id}: "
            f"summarized {len(old_results)} older results"
        )

    def _compress_result(
        self,
        tool_name: str,
        result: Dict[str, Any]
    ) -> tuple[str, List[str], List[str]]:
        """Compress a tool result into summary, findings, and entity IDs.

        Returns:
            Tuple of (summary, key_findings, entity_ids)
        """
        summary_parts = []
        key_findings = []
        entity_ids = []

        data = result.get("data", result)

        # Handle common result patterns
        if "networks" in data:
            count = len(data["networks"])
            summary_parts.append(f"Found {count} networks")
            for n in data["networks"][:5]:
                entity_ids.append(n.get("id", ""))

        if "devices" in data:
            count = len(data["devices"])
            summary_parts.append(f"Found {count} devices")
            # Group by model
            models = defaultdict(int)
            for d in data["devices"]:
                models[d.get("model", "unknown")] += 1
                entity_ids.append(d.get("serial", ""))
            for model, cnt in list(models.items())[:3]:
                key_findings.append(f"{cnt}x {model}")

        if "vlans" in data:
            count = len(data["vlans"])
            summary_parts.append(f"Found {count} VLANs")

        if "ssids" in data:
            enabled = sum(1 for s in data["ssids"] if s.get("enabled"))
            total = len(data["ssids"])
            summary_parts.append(f"{enabled}/{total} SSIDs enabled")

        if "clients" in data:
            count = len(data["clients"])
            summary_parts.append(f"Found {count} clients")

        if "alerts" in data:
            count = len(data["alerts"])
            summary_parts.append(f"Found {count} alerts")
            # Categorize alerts
            severities = defaultdict(int)
            for a in data["alerts"]:
                severities[a.get("severity", "unknown")] += 1
            for sev, cnt in severities.items():
                key_findings.append(f"{cnt} {sev} alerts")

        if "tests" in data:
            count = len(data["tests"])
            summary_parts.append(f"Found {count} tests")

        # Handle error case
        if "error" in result:
            summary_parts.append(f"Error: {result['error'][:50]}")

        # Default summary
        if not summary_parts:
            summary_parts.append(f"Executed {tool_name}")

        return ", ".join(summary_parts), key_findings, entity_ids

    async def get_enriched_tool_context(
        self,
        session_id: str,
        tool_name: str
    ) -> Dict[str, Any]:
        """Get full context for a tool call.

        This returns context that should be used to enrich tool inputs,
        including org IDs, discovered entities, and prior results.

        Args:
            session_id: Session identifier
            tool_name: Name of the tool being called

        Returns:
            Dictionary with enrichment context
        """
        ctx = await self.get_or_create(session_id)

        # Determine org type from tool name
        org_type = self._detect_org_type_from_tool(tool_name)
        org_ctx = ctx.get_org_context(org_type) if org_type else ctx.get_primary_org_context()

        enrichment = {
            "session_id": session_id,
            "has_org_context": org_ctx is not None,
            "current_focus": ctx.current_focus,
        }

        if org_ctx:
            enrichment.update({
                "org_id": org_ctx.org_id,
                "org_name": org_ctx.org_name,
                "org_type": org_ctx.org_type.value,
                "credentials": org_ctx.get_credentials(),
            })

        # Include discovered entities for resolution
        enrichment["discovered_networks"] = [
            {"id": e.id, "name": e.name}
            for e in ctx.get_all_entities(EntityType.NETWORK)
        ]
        enrichment["discovered_devices"] = [
            {"serial": e.id, "name": e.name, "model": e.data.get("model")}
            for e in ctx.get_all_entities(EntityType.DEVICE)
        ]
        enrichment["discovered_vlans"] = [
            {"id": e.id, "name": e.name}
            for e in ctx.get_all_entities(EntityType.VLAN)
        ]

        # Include context summary
        enrichment["context_summary"] = ctx.to_context_summary()

        return enrichment

    async def enrich_tool_input(
        self,
        session_id: str,
        tool_name: str,
        tool_input: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Enrich tool input with session context.

        This auto-fills missing parameters from session context:
        - organizationId from org context
        - networkId from discovered networks (by name)
        - deviceSerial from discovered devices (by name)

        Args:
            session_id: Session identifier
            tool_name: Name of the tool
            tool_input: Original tool input

        Returns:
            Enriched tool input
        """
        ctx = await self.get_or_create(session_id)
        enriched = tool_input.copy()

        # Always add session_id for tools that need context access (like canvas tools)
        enriched["session_id"] = session_id

        # Get appropriate org context
        org_type = self._detect_org_type_from_tool(tool_name)
        org_ctx = ctx.get_org_context(org_type) if org_type else ctx.get_primary_org_context()

        # Auto-fill organizationId
        if "organizationId" not in enriched and "organization_id" not in enriched:
            if org_ctx:
                enriched["organizationId"] = org_ctx.org_id
                logger.debug(
                    f"[SessionContextStore] Auto-filled organizationId: {org_ctx.org_id} "
                    f"for {tool_name}"
                )

        # Resolve network_name to networkId
        if "network_name" in enriched and "networkId" not in enriched:
            network = ctx.get_entity_by_name(EntityType.NETWORK, enriched["network_name"])
            if network:
                enriched["networkId"] = network.id
                enriched["network_id"] = network.id  # Also set snake_case for compatibility
                logger.debug(
                    f"[SessionContextStore] Resolved network '{enriched['network_name']}' "
                    f"to ID: {network.id}"
                )

        # IMPORTANT: Check if network_id contains a name (not an actual ID) and resolve it
        # This handles cases where AI outputs network_id: "Demo Home" instead of network_id: "L_123..."
        network_id_value = enriched.get("network_id") or enriched.get("networkId")
        if network_id_value and isinstance(network_id_value, str):
            # Check if this looks like a network name rather than an ID
            # Valid Meraki network IDs start with L_ or N_ followed by digits
            is_network_id = (
                network_id_value.startswith("L_") or
                network_id_value.startswith("N_")
            ) and len(network_id_value) > 10

            if not is_network_id:
                # Try to resolve as a network name
                network = ctx.get_entity_by_name(EntityType.NETWORK, network_id_value)
                if network:
                    enriched["networkId"] = network.id
                    enriched["network_id"] = network.id
                    logger.info(
                        f"[SessionContextStore] Resolved network name '{network_id_value}' "
                        f"(from network_id field) to ID: {network.id}"
                    )
                else:
                    logger.warning(
                        f"[SessionContextStore] network_id '{network_id_value}' looks like a name "
                        f"but no matching network found in session context. "
                        f"Available networks: {[e.name for e in ctx.entities.values() if e.entity_type == EntityType.NETWORK]}"
                    )

        # Resolve device_name to serial
        if "device_name" in enriched and "serial" not in enriched:
            device = ctx.get_entity_by_name(EntityType.DEVICE, enriched["device_name"])
            if device:
                enriched["serial"] = device.id
                logger.debug(
                    f"[SessionContextStore] Resolved device '{enriched['device_name']}' "
                    f"to serial: {device.id}"
                )

        # Use current focus if no explicit target
        if ctx.current_focus_type == EntityType.NETWORK:
            # Auto-fill network_id for tools that don't already have it
            has_network_id = (
                "networkId" in enriched or
                "network_id" in enriched
            )
            if not has_network_id and ctx.current_focus_id:
                # Expanded list: include wireless, latency, channel, signal, health, clients, etc.
                # These tools commonly need network_id for wireless analysis
                network_tools = [
                    "get_network", "list_devices", "list_ssids", "list_vlans",
                    "get_clients", "get_events", "wireless", "latency",
                    "channel", "signal", "health", "client", "connection",
                    "bandwidth", "traffic", "ssid", "rf", "radio",
                    "uplink", "appliance", "switch", "camera", "sensor"
                ]
                if any(t in tool_name.lower() for t in network_tools):
                    enriched["networkId"] = ctx.current_focus_id
                    enriched["network_id"] = ctx.current_focus_id  # Also set snake_case
                    logger.info(
                        f"[SessionContextStore] Auto-filled network from focus: "
                        f"{ctx.current_focus_id} for {tool_name}"
                    )

        return enriched

    def _detect_org_type_from_tool(self, tool_name: str) -> Optional[OrgType]:
        """Detect organization type from tool name.

        Note: Order matters! More specific patterns (catalyst, dnac) must be
        checked before generic ones (device, network) to avoid false matches.
        """
        tool_lower = tool_name.lower()

        # Check specific platform identifiers first (before generic terms)
        if any(x in tool_lower for x in ["catalyst", "dnac"]):
            return OrgType.CATALYST
        if any(x in tool_lower for x in ["splunk", "spl"]):
            return OrgType.SPLUNK
        if any(x in tool_lower for x in ["thousandeyes"]):
            return OrgType.THOUSANDEYES

        # Then check more generic patterns
        if any(x in tool_lower for x in ["meraki", "network", "device", "ssid", "vlan", "client"]):
            return OrgType.MERAKI
        if any(x in tool_lower for x in ["search", "index"]):
            return OrgType.SPLUNK
        if any(x in tool_lower for x in ["test", "agent", "path"]):
            return OrgType.THOUSANDEYES
        if any(x in tool_lower for x in ["site", "assurance"]):
            return OrgType.CATALYST

        return None

    async def extract_entities_from_result(
        self,
        session_id: str,
        tool_name: str,
        result: Dict[str, Any]
    ) -> int:
        """Extract and store entities from a tool result.

        Args:
            session_id: Session identifier
            tool_name: Name of the tool that produced the result
            result: The tool result

        Returns:
            Number of entities extracted
        """
        entities_added = 0
        data = result.get("data", result)

        # Extract networks
        if "networks" in data:
            for net in data["networks"]:
                await self.add_discovered_entity(
                    session_id=session_id,
                    entity_type=EntityType.NETWORK,
                    entity_id=net.get("id", ""),
                    name=net.get("name"),
                    data={
                        "productTypes": net.get("productTypes", []),
                        "timeZone": net.get("timeZone"),
                        "tags": net.get("tags", []),
                    },
                    source_tool=tool_name
                )
                entities_added += 1

        # Extract devices
        if "devices" in data:
            for dev in data["devices"]:
                await self.add_discovered_entity(
                    session_id=session_id,
                    entity_type=EntityType.DEVICE,
                    entity_id=dev.get("serial", ""),
                    name=dev.get("name"),
                    data={
                        "model": dev.get("model"),
                        "mac": dev.get("mac"),
                        "lanIp": dev.get("lanIp"),
                        "wan1Ip": dev.get("wan1Ip"),
                        "networkId": dev.get("networkId"),
                        "status": dev.get("status"),
                    },
                    source_tool=tool_name
                )
                entities_added += 1

        # Extract VLANs
        if "vlans" in data:
            for vlan in data["vlans"]:
                await self.add_discovered_entity(
                    session_id=session_id,
                    entity_type=EntityType.VLAN,
                    entity_id=str(vlan.get("id", "")),
                    name=vlan.get("name"),
                    data={
                        "subnet": vlan.get("subnet"),
                        "applianceIp": vlan.get("applianceIp"),
                        "networkId": vlan.get("networkId"),
                    },
                    source_tool=tool_name
                )
                entities_added += 1

        # Extract SSIDs
        if "ssids" in data:
            for ssid in data["ssids"]:
                await self.add_discovered_entity(
                    session_id=session_id,
                    entity_type=EntityType.SSID,
                    entity_id=str(ssid.get("number", "")),
                    name=ssid.get("name"),
                    data={
                        "enabled": ssid.get("enabled"),
                        "authMode": ssid.get("authMode"),
                        "encryptionMode": ssid.get("encryptionMode"),
                    },
                    source_tool=tool_name
                )
                entities_added += 1

        # Extract clients
        if "clients" in data:
            for client in data["clients"][:50]:  # Limit clients stored
                await self.add_discovered_entity(
                    session_id=session_id,
                    entity_type=EntityType.CLIENT,
                    entity_id=client.get("id", client.get("mac", "")),
                    name=client.get("description") or client.get("hostname"),
                    data={
                        "mac": client.get("mac"),
                        "ip": client.get("ip"),
                        "vlan": client.get("vlan"),
                        "status": client.get("status"),
                    },
                    source_tool=tool_name
                )
                entities_added += 1

        # Extract sites (Catalyst)
        if "sites" in data:
            for site in data["sites"]:
                await self.add_discovered_entity(
                    session_id=session_id,
                    entity_type=EntityType.SITE,
                    entity_id=site.get("id", ""),
                    name=site.get("name"),
                    data={
                        "type": site.get("type"),
                        "parentId": site.get("parentId"),
                    },
                    source_tool=tool_name
                )
                entities_added += 1

        # Extract alerts
        if "alerts" in data:
            for alert in data["alerts"][:20]:  # Limit alerts stored
                await self.add_discovered_entity(
                    session_id=session_id,
                    entity_type=EntityType.ALERT,
                    entity_id=alert.get("id", alert.get("alertId", "")),
                    name=alert.get("type") or alert.get("title"),
                    data={
                        "severity": alert.get("severity"),
                        "category": alert.get("category"),
                        "occurred_at": alert.get("occurredAt"),
                    },
                    source_tool=tool_name
                )
                entities_added += 1

        if entities_added > 0:
            logger.info(
                f"[SessionContextStore] Extracted {entities_added} entities "
                f"from {tool_name} (session: {session_id})"
            )

        return entities_added

    async def get_context_for_prompt(self, session_id: str) -> str:
        """Get formatted context for inclusion in system prompt.

        Args:
            session_id: Session identifier

        Returns:
            Formatted context string
        """
        ctx = await self.get_or_create(session_id)
        return ctx.to_context_summary()

    async def get_context_stats(self, session_id: str) -> Dict[str, Any]:
        """Get context statistics for monitoring and SSE events.

        Args:
            session_id: Session identifier

        Returns:
            Dictionary with context size metrics including:
            - total_entities: Total number of entities in context
            - entity_counts: Breakdown by entity type
            - prior_results_count: Number of compressed tool results
            - tool_call_count: Total tool calls in session
            - limits: Current limit configuration
        """
        ctx = await self.get_or_create(session_id)
        stats = ctx.get_context_stats()

        # Add limit configuration for frontend display
        stats["limits"] = {
            "max_entities_per_type": self.MAX_ENTITIES_PER_TYPE,
            "max_total_entities": self.MAX_TOTAL_ENTITIES,
        }

        # Add utilization percentages
        total = stats.get("total_entities", 0)
        stats["utilization"] = {
            "total_percent": round((total / self.MAX_TOTAL_ENTITIES) * 100, 1) if self.MAX_TOTAL_ENTITIES > 0 else 0,
        }

        return stats

    async def _persist_context(self, ctx: SessionContext) -> None:
        """Persist context to Redis if available."""
        if self._redis:
            try:
                key = f"session_ctx:{ctx.session_id}"
                await self._redis.setex(
                    key,
                    int(self.session_ttl.total_seconds()),
                    json.dumps(ctx.to_dict())
                )
            except Exception as e:
                logger.warning(f"[SessionContextStore] Redis persist failed: {e}")

    async def _cleanup_old_sessions(self) -> None:
        """Clean up old sessions from memory."""
        if len(self._memory_store) <= self.max_sessions:
            return

        # Sort by last_updated and remove oldest
        sorted_sessions = sorted(
            self._memory_store.items(),
            key=lambda x: x[1].last_updated
        )

        # Remove oldest 10%
        to_remove = len(sorted_sessions) // 10
        for session_id, _ in sorted_sessions[:to_remove]:
            del self._memory_store[session_id]

        logger.info(f"[SessionContextStore] Cleaned up {to_remove} old sessions")

    def _deserialize_context(self, data: Dict[str, Any]) -> SessionContext:
        """Deserialize context from dictionary."""
        ctx = SessionContext(session_id=data["session_id"])

        # Restore org contexts
        for org_type_str, org_data in data.get("org_contexts", {}).items():
            ctx.org_contexts[org_type_str] = OrgContext(
                org_id=org_data["org_id"],
                org_name=org_data["org_name"],
                org_type=OrgType(org_data["org_type"]),
                api_key=org_data.get("api_key"),
                api_secret=org_data.get("api_secret"),
                base_url=org_data.get("base_url"),
            )

        if data.get("primary_org_type"):
            ctx.primary_org_type = OrgType(data["primary_org_type"])

        # Restore discovered entities
        for et_str, entities in data.get("discovered_entities", {}).items():
            et = EntityType(et_str)
            for eid, e_data in entities.items():
                # Parse last_accessed if present, otherwise use discovered_at or now
                last_accessed = datetime.utcnow()
                if e_data.get("last_accessed"):
                    try:
                        last_accessed = datetime.fromisoformat(e_data["last_accessed"])
                    except (ValueError, TypeError):
                        pass
                elif e_data.get("discovered_at"):
                    try:
                        last_accessed = datetime.fromisoformat(e_data["discovered_at"])
                    except (ValueError, TypeError):
                        pass

                ctx.discovered_entities[et][eid] = DiscoveredEntity(
                    entity_type=et,
                    id=e_data["id"],
                    name=e_data.get("name"),
                    data=e_data.get("data", {}),
                    last_accessed=last_accessed,
                    source_tool=e_data.get("source_tool"),
                )

        ctx.current_focus = data.get("current_focus")
        ctx.conversation_summary = data.get("conversation_summary", "")
        ctx.tool_call_count = data.get("tool_call_count", 0)
        ctx.total_entities_discovered = data.get("total_entities_discovered", 0)

        return ctx


# Singleton instance
_session_context_store: Optional[SessionContextStore] = None


def get_session_context_store() -> SessionContextStore:
    """Get the singleton SessionContextStore instance."""
    global _session_context_store
    if _session_context_store is None:
        _session_context_store = SessionContextStore()
    return _session_context_store


async def init_session_context_store(redis_client=None, db_session=None) -> SessionContextStore:
    """Initialize the session context store with optional persistence.

    Args:
        redis_client: Optional Redis client for persistence
        db_session: Optional database session for persistence

    Returns:
        The initialized SessionContextStore
    """
    global _session_context_store
    _session_context_store = SessionContextStore(
        redis_client=redis_client,
        db_session=db_session
    )
    logger.info("[SessionContextStore] Initialized with persistence options")
    return _session_context_store
