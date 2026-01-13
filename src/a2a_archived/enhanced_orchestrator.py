"""Enhanced Orchestrator for Multi-Agent Network Management.

This orchestrator coordinates specialist agents (Meraki, ThousandEyes,
Catalyst, Splunk, UI) using multi-turn conversations with real-time
SSE event emission for frontend visualization.

Key capabilities:
- Skill-based routing to specialists
- Multi-turn conversation management
- Parallel and sequential agent execution
- Response synthesis
- Real-time event emission
"""

import logging
import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Callable, Awaitable, AsyncGenerator, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from .types import (
    AgentCard,
    A2AMessage,
    TextPart,
    DataPart,
    TaskState,
)
from .registry import get_agent_registry
from .memory import ConversationMemory, get_conversation_memory
from .collaboration import (
    ArtifactStore,
    CollaborationArtifact,
    ArtifactType,
    get_artifact_store,
)
from .multi_turn_protocol import (
    TurnManager,
    MultiTurnConversation,
    ConversationTurn,
    TurnType,
    get_turn_manager,
)
from .agent_dependencies import (
    AgentDependencyLoader,
    AgentOrgContext,
    get_dependency_loader,
)
from .specialists.base_specialist import AgentExecutionContext
from .feedback import RoutingFeedbackTracker, get_feedback_tracker

logger = logging.getLogger(__name__)

# Agent to org type mapping for credential lookup
AGENT_TO_ORG_TYPE = {
    "meraki-agent": "meraki",
    "catalyst-agent": "catalyst",
    "thousandeyes-agent": "thousandeyes",
    "splunk-agent": "splunk",
}


@dataclass
class RoutingDecision:
    """Result of routing analysis."""
    primary_agent: str
    primary_agent_name: str
    primary_skill: Optional[str] = None
    secondary_agents: List[str] = field(default_factory=list)
    confidence: float = 0.0
    reasoning: str = ""
    parallel_execution: bool = False
    is_multi_domain: bool = False
    detected_domains: List[str] = field(default_factory=list)


@dataclass
class CollaborativeResult:
    """Result from a collaborative multi-agent workflow."""
    primary_response: 'AgentResponse'
    supporting_responses: List['AgentResponse'] = field(default_factory=list)
    shared_entities: Dict[str, Any] = field(default_factory=dict)
    cross_references: List[Dict[str, Any]] = field(default_factory=list)
    synthesis: str = ""
    total_duration_ms: int = 0
    collaboration_type: str = "sequential"  # sequential, parallel, or hybrid


@dataclass
class AgentResponse:
    """Response from an agent consultation."""
    agent_id: str
    agent_name: str
    success: bool
    response: str
    data: Any = None
    artifacts: List[CollaborationArtifact] = field(default_factory=list)
    entities: Dict[str, Any] = field(default_factory=dict)
    duration_ms: int = 0
    error: Optional[str] = None
    # Token usage tracking
    input_tokens: int = 0
    output_tokens: int = 0
    # Structured data for canvas cards
    structured_data: Any = None


def calculate_cost(input_tokens: int, output_tokens: int, model: str = "") -> float:
    """Calculate estimated USD cost for API usage.

    Uses model-specific pricing from settings when available.
    Falls back to Claude 3.5 Sonnet pricing as default.
    """
    if model:
        try:
            from src.services.ai_service import get_model_costs
            cost_input_1k, cost_output_1k = get_model_costs(model)
            input_cost = (input_tokens / 1000) * cost_input_1k
            output_cost = (output_tokens / 1000) * cost_output_1k
            return round(input_cost + output_cost, 6)
        except Exception:
            pass  # Fall back to default pricing

    # Default: Claude 3.5 Sonnet pricing ($3/M input, $15/M output)
    input_cost = (input_tokens / 1_000_000) * 3.0
    output_cost = (output_tokens / 1_000_000) * 15.0
    return round(input_cost + output_cost, 6)


# Event callback type for SSE streaming
EventCallback = Callable[[str, Dict[str, Any]], Awaitable[None]]


class EnhancedOrchestrator:
    """Enhanced orchestrator with multi-turn specialist agent coordination.

    This orchestrator:
    1. Routes queries to specialist agents based on skill matching
    2. Manages multi-turn conversations
    3. Executes agents in parallel or sequence as appropriate
    4. Synthesizes responses from multiple agents
    5. Emits events for frontend visualization

    Usage:
        orchestrator = EnhancedOrchestrator()

        async for event in orchestrator.stream_multi_turn(
            query="Are there any network issues?",
            session_id="session-123",
            org_context=context
        ):
            # Handle SSE event
            yield f"data: {json.dumps(event)}\n\n"
    """

    # Intent-to-skill mapping for better skill selection
    # Maps user intents to actual skill IDs used by specialist agents
    INTENT_TO_SKILL = {
        # NOTE: "drill_down" and "details" removed from here because they need
        # context-aware mapping (device-specific → devices_get, general → organizations_list_devices)
        "devices": "organizations_list_devices",     # explicit device request
        "list_networks": "networks_list",  # Meraki networks skill ID
        "networks": "networks_list",
        "list_devices": "organizations_list_devices",  # Meraki devices skill ID
        "device_details": "devices_get",  # specific device details
        "status": "devices_get",
        "health": "networks_get",
    }

    # Device model patterns for detecting device-specific queries
    DEVICE_MODEL_PATTERNS = [
        r'\b(mx\d+|mr\d+|ms\d+|mv\d+|mt\d+|mg\d+|z\d+|cw\d+)\b',  # Model names like MX68, MR36
        r'\b[Q][A-Z\d]{3}-[A-Z\d]{4}-[A-Z\d]{4}\b',  # Serial numbers like Q2KY-EVGL-CL3C
    ]

    # Patterns for detecting follow-up/reaction queries
    FOLLOW_UP_PATTERNS = [
        # Reactions and acknowledgments
        r'^(interesting|cool|nice|great|thanks|ok|okay|wow|hmm|huh|neat|awesome)\b',
        # Requests for more information
        r'^(tell me more|more details|explain|what about|elaborate|expand|continue)\b',
        # Pronoun references to previous content
        r'^(that|this|it|they|those|these)\b',
        # Short affirmative follow-ups
        r'^(yes|yeah|yep|sure|right|exactly)\b',
        # Question follow-ups
        r'^(why|how come|what does that mean|what happened)\b',
    ]

    # Reaction-to-expansion mapping
    REACTION_EXPANSIONS = {
        "interesting": "Tell me more about",
        "cool": "Can you elaborate on",
        "nice": "What else can you tell me about",
        "great": "Please provide more details about",
        "awesome": "Can you expand on",
        "neat": "What are the implications of",
        "wow": "Can you explain more about",
        "thanks": "Is there anything else important about",
        "ok": "What should I know next about",
        "okay": "What should I know next about",
        "hmm": "Can you clarify",
        "huh": "Can you explain",
    }

    # Multi-domain query patterns for collaborative workflows
    # Each tuple: (pattern, [agents_needed], collaboration_type)
    MULTI_DOMAIN_PATTERNS = [
        # Cross-platform correlation
        (r"splunk.*meraki|meraki.*splunk|logs.*from.*meraki|meraki.*logs",
         ["meraki-agent", "splunk-agent"], "sequential"),
        (r"splunk.*catalyst|catalyst.*splunk|logs.*from.*catalyst",
         ["catalyst-agent", "splunk-agent"], "sequential"),
        (r"thousandeyes.*meraki|meraki.*thousandeyes|test.*network.*device",
         ["meraki-agent", "thousandeyes-agent"], "parallel"),
        (r"thousandeyes.*catalyst|catalyst.*thousandeyes",
         ["catalyst-agent", "thousandeyes-agent"], "parallel"),

        # Security + network correlation
        (r"security.*network|network.*security|security.*device|device.*security",
         ["meraki-agent", "splunk-agent"], "sequential"),
        (r"security.*alert.*device|alert.*affect.*network",
         ["splunk-agent", "meraki-agent"], "sequential"),

        # Monitoring + infrastructure correlation
        (r"monitor.*device|device.*monitor|health.*all|all.*health|overall.*status",
         ["meraki-agent", "thousandeyes-agent", "catalyst-agent"], "parallel"),
        (r"performance.*network|network.*performance|slow.*network",
         ["thousandeyes-agent", "meraki-agent"], "parallel"),

        # Incident correlation
        (r"incident.*correlation|correlat.*incident|what.*caused|root.*cause",
         ["splunk-agent", "meraki-agent", "thousandeyes-agent"], "sequential"),
        (r"troubleshoot|diagnose|investigate.*issue",
         ["splunk-agent", "meraki-agent", "catalyst-agent"], "sequential"),

        # Comprehensive overview
        (r"full.*report|comprehensive.*report|executive.*summary",
         ["meraki-agent", "catalyst-agent", "thousandeyes-agent", "splunk-agent"], "parallel"),
    ]

    # Device/product patterns for entity extraction (used for session context)
    # Maps regex patterns to (entity_type, platform) tuples
    DEVICE_ENTITY_PATTERNS = [
        # Meraki device models
        (r"\b(MX\d+[A-Z]?)\b", "device", "meraki"),  # MX68, MX100, MX250W
        (r"\b(MR\d+[A-Z]?)\b", "device", "meraki"),  # MR42, MR56
        (r"\b(MS\d+[A-Z]?)\b", "device", "meraki"),  # MS120, MS225
        (r"\b(MV\d+[A-Z]?)\b", "device", "meraki"),  # MV12, MV72
        (r"\b(MT\d+)\b", "device", "meraki"),        # MT10, MT20
        (r"\b(Z\d+[A-Z]?)\b", "device", "meraki"),   # Z3, Z4
        # Catalyst device models
        (r"\b(C9\d{3}[A-Z]?)\b", "device", "catalyst"),  # C9300, C9500
        (r"\b(ISR\d{4}[A-Z]?)\b", "device", "catalyst"), # ISR4451
        (r"\b(ASR\d{4}[A-Z]?)\b", "device", "catalyst"), # ASR1001
        # Generic device references
        (r"\b(firewall|router|switch|ap|access point)\b", "device_type", "network"),
    ]

    # Agent recovery/fallback mapping for error handling
    # If primary agent fails, try these alternatives
    AGENT_RECOVERY_MAP = {
        "meraki-agent": [
            ("splunk-agent", "search for recent Meraki API logs or device events"),
            ("catalyst-agent", "check if device is managed in Catalyst Center"),
        ],
        "catalyst-agent": [
            ("splunk-agent", "search for Catalyst Center logs or DNA events"),
            ("meraki-agent", "check if network is managed in Meraki Dashboard"),
        ],
        "thousandeyes-agent": [
            ("splunk-agent", "search for ThousandEyes alert logs"),
            ("meraki-agent", "check network device status directly"),
        ],
        "splunk-agent": [
            ("meraki-agent", "check device events in Meraki Dashboard"),
            ("catalyst-agent", "check issues in Catalyst Center"),
        ],
    }

    def __init__(self):
        self.registry = get_agent_registry()
        self.memory = get_conversation_memory()
        self.artifact_store = get_artifact_store()
        self.dependency_loader = get_dependency_loader()
        self.turn_manager = get_turn_manager()
        self.feedback_tracker = get_feedback_tracker()
        # Track last routing for follow-up context
        self._last_routing: Optional[RoutingDecision] = None
        self._last_query: Optional[str] = None
        self._last_session_id: Optional[str] = None
        # Cache agent performance scores for adaptive routing
        self._agent_performance_cache: Dict[str, float] = {}
        self._load_performance_scores()

    def extract_entities_from_query(self, query: str) -> List[Dict[str, Any]]:
        """Extract device/network entities from a query for session context.

        Detects product models (MX68, MR42, C9300), network references,
        and other entity mentions that should be tracked across turns.

        Args:
            query: The user's query

        Returns:
            List of extracted entities with type, name, and platform
        """
        entities = []
        query_upper = query.upper()  # Device models are typically uppercase

        # Check device patterns
        for pattern, entity_type, platform in self.DEVICE_ENTITY_PATTERNS:
            matches = re.findall(pattern, query_upper if entity_type == "device" else query.lower(), re.IGNORECASE)
            for match in matches:
                entity = {
                    "type": entity_type,
                    "name": match.upper() if entity_type == "device" else match.lower(),
                    "platform": platform,
                }
                # Avoid duplicates
                if entity not in entities:
                    entities.append(entity)
                    logger.info(f"[Orchestrator] Extracted entity: {entity}")

        return entities

    def record_query_entities(
        self,
        query: str,
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Extract and record entities from a query in session memory.

        Args:
            query: The user's query
            session_id: Optional session ID

        Returns:
            List of extracted entities
        """
        entities = self.extract_entities_from_query(query)

        for entity in entities:
            # Record in memory (both session and global)
            if session_id:
                self.memory.record_entity(
                    session_id=session_id,
                    entity_type=entity["type"],
                    name=entity["name"],
                    details={"platform": entity["platform"]}
                )

            # Also update global context for follow-up detection
            if entity["type"] == "device":
                self.memory.current_device = entity["name"]
                # Track the platform for this device
                self._last_device_platform = entity.get("platform")
            elif entity["type"] == "network":
                self.memory.current_network = entity["name"]

        return entities

    def get_session_context_boost(self, agent_id: str) -> float:
        """Get a routing score boost based on session context.

        If the user recently mentioned a device/network that belongs to a
        specific platform, boost that platform's agent for follow-up queries.

        Args:
            agent_id: The agent to check for boost

        Returns:
            Score boost (0.0 if no context match, positive if match)
        """
        boost = 0.0

        # Check if we have a current device with platform context
        if self.memory.current_device and hasattr(self, '_last_device_platform'):
            platform = self._last_device_platform

            platform_agent_map = {
                "meraki": "meraki-agent",
                "catalyst": "catalyst-agent",
            }

            if platform and platform_agent_map.get(platform) == agent_id:
                boost = 15.0  # Significant boost for session context
                logger.info(
                    f"[Orchestrator] Session context boost (+{boost}): "
                    f"device '{self.memory.current_device}' ({platform}) -> {agent_id}"
                )

        return boost

    def _load_performance_scores(self) -> None:
        """Load historical performance scores for agents from feedback tracker.

        This populates the performance cache with success rates for each agent,
        which is used to adjust routing scores in route_to_specialists().
        """
        try:
            all_stats = self.feedback_tracker.get_all_agent_stats()
            for agent_id, stats in all_stats.items():
                if stats and stats.get("total_queries", 0) >= 10:
                    # Use success rate from stats
                    success_rate = stats.get("success_rate", 0.5)
                    self._agent_performance_cache[agent_id] = success_rate
                    logger.debug(
                        f"[Orchestrator] Loaded performance for {agent_id}: {success_rate:.2%}"
                    )
            logger.info(
                f"[Orchestrator] Loaded performance scores for {len(self._agent_performance_cache)} agents"
            )
        except Exception as e:
            logger.warning(f"[Orchestrator] Failed to load performance scores: {e}")

    def refresh_performance_scores(self) -> None:
        """Refresh performance scores from feedback tracker.

        Call this periodically to update routing weights based on recent outcomes.
        """
        self._agent_performance_cache.clear()
        self._load_performance_scores()

    def is_follow_up_query(self, query: str) -> bool:
        """Detect if a query is a follow-up or reaction to previous results.

        Args:
            query: The user's query

        Returns:
            True if this appears to be a follow-up query
        """
        query_lower = query.lower().strip()

        # Check against follow-up patterns
        for pattern in self.FOLLOW_UP_PATTERNS:
            if re.match(pattern, query_lower, re.IGNORECASE):
                return True

        # Also detect very short queries (likely reactions)
        words = query_lower.split()
        if len(words) <= 2 and len(query_lower) <= 15:
            return True

        return False

    def enrich_follow_up_query(
        self,
        query: str,
        session_id: Optional[str] = None
    ) -> Tuple[str, Optional[str], str]:
        """Enrich a follow-up query with context from previous turns.

        Args:
            query: The follow-up query
            session_id: Current session ID

        Returns:
            Tuple of (enriched_query, suggested_agent, reasoning)
        """
        query_lower = query.lower().strip()

        # Get context from memory
        context_summary = self.memory.get_context_summary()
        last_agent = self.memory.get_last_agent()
        last_topics = self.memory.topics[-3:] if self.memory.topics else []

        # Also use stored routing if same session
        if (self._last_routing and self._last_session_id == session_id):
            if not last_agent:
                last_agent = self._last_routing.primary_agent

        # Build context string - prioritize device/network for specific follow-ups
        context_parts = []
        device_context = None
        network_context = None

        if self.memory.current_device:
            device_context = self.memory.current_device
            context_parts.append(f"device: {device_context}")
        if self.memory.current_network:
            network_context = self.memory.current_network
            context_parts.append(f"network: {network_context}")
        if last_topics:
            context_parts.append(f"topics: {', '.join(last_topics)}")

        context_str = "; ".join(context_parts) if context_parts else "the previous results"

        # For device-specific follow-ups, include the device name in the enriched query
        # This ensures "give me config details" becomes "give me config details for MX68"
        device_suffix = f" for {device_context}" if device_context else ""
        network_suffix = f" on {network_context}" if network_context and not device_context else ""

        # Check if it's a reaction we can expand
        first_word = query_lower.split()[0] if query_lower.split() else ""

        if first_word in self.REACTION_EXPANSIONS:
            expansion = self.REACTION_EXPANSIONS[first_word]

            # Build domain-specific enrichment based on last agent
            if last_agent:
                if "splunk" in last_agent.lower():
                    enriched = f"{expansion} these Splunk events and logs? What patterns or anomalies are notable?"
                elif "meraki" in last_agent.lower():
                    # Include device context if available
                    if device_context:
                        enriched = f"{expansion} the {device_context}? What are the key insights?"
                    else:
                        enriched = f"{expansion} this Meraki network data? What are the key insights?"
                elif "thousandeyes" in last_agent.lower():
                    enriched = f"{expansion} these ThousandEyes monitoring results? Any concerns?"
                elif "catalyst" in last_agent.lower():
                    if device_context:
                        enriched = f"{expansion} the {device_context}? What should I focus on?"
                    else:
                        enriched = f"{expansion} this Catalyst Center information? What should I focus on?"
                else:
                    enriched = f"{expansion} {context_str}?"
            else:
                enriched = f"{expansion} {context_str}?"

            reasoning = f"Expanded '{query}' to contextual query based on previous {last_agent or 'interaction'}"
            return (enriched, last_agent, reasoning)

        # Handle pronoun references
        if re.match(r'^(that|this|it|they|those|these)\b', query_lower):
            enriched = f"Regarding {context_str}: {query}"
            reasoning = f"Added context to pronoun reference"
            return (enriched, last_agent, reasoning)

        # Handle requests for more info
        if re.match(r'^(tell me more|more details|explain|elaborate)', query_lower):
            enriched = f"Provide more details about {context_str}"
            reasoning = "Expanded 'tell me more' with context"
            return (enriched, last_agent, reasoning)

        # Handle "details" or "config" queries that should include device/network context
        # e.g., "give me config details" -> "give me config details for MX68"
        if re.search(r'\b(details|config|configuration|settings|status|info)\b', query_lower):
            if device_context:
                enriched = f"{query} for {device_context}"
                reasoning = f"Added device context '{device_context}' to query"
                logger.info(f"[Orchestrator] Enriched query with device context: '{query}' -> '{enriched}'")
                return (enriched, last_agent, reasoning)
            elif network_context:
                enriched = f"{query} on {network_context}"
                reasoning = f"Added network context '{network_context}' to query"
                logger.info(f"[Orchestrator] Enriched query with network context: '{query}' -> '{enriched}'")
                return (enriched, last_agent, reasoning)

        # Default: return original with context suggestion
        return (query, last_agent, "Query appears to be follow-up but no specific enrichment applied")

    def detect_multi_domain_query(
        self,
        query: str
    ) -> Optional[Tuple[List[str], str]]:
        """Detect if a query requires multiple specialist agents.

        Checks the query against predefined multi-domain patterns to identify
        queries that span multiple platforms (e.g., "Splunk logs for Meraki devices").

        Args:
            query: The user's query

        Returns:
            Tuple of (agents_needed, collaboration_type) if multi-domain detected,
            None otherwise
        """
        query_lower = query.lower()

        for pattern, agents, collab_type in self.MULTI_DOMAIN_PATTERNS:
            if re.search(pattern, query_lower, re.IGNORECASE):
                logger.info(
                    f"[Orchestrator] Multi-domain query detected: pattern='{pattern}', "
                    f"agents={agents}, type={collab_type}"
                )
                return (agents, collab_type)

        return None

    def _extract_collaboration_entities(
        self,
        response: AgentResponse
    ) -> Dict[str, Any]:
        """Extract entities from an agent response for cross-referencing.

        Extracts identifiable entities (device names, IPs, serials, network IDs)
        that can be used to enrich queries for other agents.

        Args:
            response: The agent's response

        Returns:
            Dict of extracted entities by type
        """
        entities = {}

        # Get entities from response
        if response.entities:
            entities.update(response.entities)

        # Extract from response data if present
        if response.data:
            data = response.data
            if isinstance(data, dict):
                # Look for common entity patterns
                for key in ["device_ids", "device_names", "device_serials",
                           "network_ids", "network_names", "client_macs",
                           "ip_addresses", "hostnames", "serial_numbers",
                           "organization_ids", "site_ids", "issue_ids"]:
                    if key in data:
                        entities[key] = data[key]

                # Check nested structures
                if "devices" in data and isinstance(data["devices"], list):
                    entities["device_names"] = [
                        d.get("name") or d.get("hostname") for d in data["devices"]
                        if d.get("name") or d.get("hostname")
                    ]
                    entities["device_serials"] = [
                        d.get("serial") or d.get("serialNumber") for d in data["devices"]
                        if d.get("serial") or d.get("serialNumber")
                    ]

                if "networks" in data and isinstance(data["networks"], list):
                    entities["network_names"] = [
                        n.get("name") for n in data["networks"] if n.get("name")
                    ]
                    entities["network_ids"] = [
                        n.get("id") for n in data["networks"] if n.get("id")
                    ]

        return entities

    def _enrich_query_with_entities(
        self,
        query: str,
        entities: Dict[str, Any],
        target_agent: str
    ) -> str:
        """Enrich a query with entities discovered from other agents.

        Creates a more specific query for supporting agents using
        entities extracted from the primary agent's response.

        Args:
            query: Original query
            entities: Extracted entities from previous agent
            target_agent: The agent that will receive the enriched query

        Returns:
            Enriched query string
        """
        enrichments = []

        # Build context based on target agent
        if "splunk" in target_agent.lower():
            # Splunk benefits from device names, IPs, serials for log correlation
            if entities.get("device_names"):
                names = entities["device_names"][:5]  # Limit to avoid huge queries
                enrichments.append(f"devices: {', '.join(str(n) for n in names)}")
            if entities.get("device_serials"):
                serials = entities["device_serials"][:5]
                enrichments.append(f"serial numbers: {', '.join(str(s) for s in serials)}")
            if entities.get("ip_addresses"):
                ips = entities["ip_addresses"][:5]
                enrichments.append(f"IP addresses: {', '.join(str(ip) for ip in ips)}")

        elif "meraki" in target_agent.lower():
            # Meraki benefits from network context
            if entities.get("network_names"):
                enrichments.append(f"networks: {', '.join(entities['network_names'][:3])}")
            if entities.get("network_ids"):
                enrichments.append(f"network IDs: {', '.join(entities['network_ids'][:3])}")

        elif "catalyst" in target_agent.lower():
            # Catalyst benefits from site/device context
            if entities.get("site_names"):
                enrichments.append(f"sites: {', '.join(entities['site_names'][:3])}")
            if entities.get("device_names"):
                enrichments.append(f"devices: {', '.join(str(n) for n in entities['device_names'][:3])}")

        elif "thousandeyes" in target_agent.lower():
            # ThousandEyes benefits from target IPs/hostnames
            if entities.get("ip_addresses"):
                enrichments.append(f"target IPs: {', '.join(str(ip) for ip in entities['ip_addresses'][:3])}")
            if entities.get("hostnames"):
                enrichments.append(f"targets: {', '.join(entities['hostnames'][:3])}")

        if enrichments:
            context = f" [Context from previous query - {'; '.join(enrichments)}]"
            return f"{query}{context}"

        return query

    async def execute_collaborative_workflow(
        self,
        query: str,
        primary_agent: str,
        supporting_agents: List[str],
        context: AgentExecutionContext,
        collaboration_type: str = "sequential",
        event_callback: Optional[EventCallback] = None
    ) -> CollaborativeResult:
        """Execute a multi-agent collaborative workflow.

        This method orchestrates multiple agents working together on a query,
        sharing context and entities between them for better results.

        Collaboration types:
        - sequential: Primary executes first, entities passed to supporting agents
        - parallel: All agents execute simultaneously, results merged
        - hybrid: Primary first, then supporting in parallel with shared context

        Args:
            query: The user's query
            primary_agent: ID of the primary agent
            supporting_agents: List of supporting agent IDs
            context: Execution context
            collaboration_type: "sequential", "parallel", or "hybrid"
            event_callback: Optional SSE event callback

        Returns:
            CollaborativeResult with all responses and cross-references
        """
        start_time = datetime.utcnow()
        shared_entities: Dict[str, Any] = {}
        cross_references: List[Dict[str, Any]] = []

        if event_callback:
            await event_callback("collaboration_start", {
                "primary_agent": primary_agent,
                "supporting_agents": supporting_agents,
                "collaboration_type": collaboration_type,
                "query": query[:100],
            })

        # Execute based on collaboration type
        if collaboration_type == "parallel":
            # All agents execute simultaneously
            all_agents = [primary_agent] + supporting_agents
            responses = await self.parallel_execute(all_agents, query, context, event_callback)

            primary_response = responses[0]
            supporting_responses = responses[1:]

            # Collect entities from all responses
            for resp in responses:
                if resp.success:
                    extracted = self._extract_collaboration_entities(resp)
                    for key, values in extracted.items():
                        if key not in shared_entities:
                            shared_entities[key] = []
                        if isinstance(values, list):
                            shared_entities[key].extend(values)
                        else:
                            shared_entities[key].append(values)

        else:
            # Sequential or hybrid: primary first
            primary_response = await self.execute_agent(primary_agent, query, context)

            if event_callback:
                await event_callback("collaboration_primary_complete", {
                    "agent_id": primary_agent,
                    "success": primary_response.success,
                    "entities_found": list(primary_response.entities.keys()) if primary_response.entities else [],
                })

            # Extract entities from primary for context enrichment
            if primary_response.success:
                shared_entities = self._extract_collaboration_entities(primary_response)

            # Execute supporting agents
            supporting_responses = []

            if collaboration_type == "sequential":
                # Sequential: one at a time with accumulated context
                for agent_id in supporting_agents:
                    enriched_query = self._enrich_query_with_entities(query, shared_entities, agent_id)

                    if event_callback:
                        await event_callback("collaboration_handoff", {
                            "from_agent": primary_agent if not supporting_responses else supporting_responses[-1].agent_id,
                            "to_agent": agent_id,
                            "entities_passed": list(shared_entities.keys()),
                        })

                    # Update context with shared entities
                    context.entities_from_previous_turns = shared_entities

                    response = await self.execute_agent(agent_id, enriched_query, context)
                    supporting_responses.append(response)

                    # Accumulate new entities
                    if response.success:
                        new_entities = self._extract_collaboration_entities(response)
                        for key, values in new_entities.items():
                            if key not in shared_entities:
                                shared_entities[key] = []
                            if isinstance(values, list):
                                shared_entities[key].extend(values)
                            else:
                                shared_entities[key].append(values)

                        # Track cross-references
                        if primary_response.entities and response.entities:
                            cross_ref = self._find_cross_references(
                                primary_response.entities,
                                response.entities,
                                primary_agent,
                                agent_id
                            )
                            if cross_ref:
                                cross_references.append(cross_ref)

            else:
                # Hybrid: supporting agents in parallel with enriched context
                enriched_queries = [
                    self._enrich_query_with_entities(query, shared_entities, agent_id)
                    for agent_id in supporting_agents
                ]

                tasks = [
                    self.execute_agent(agent_id, eq, context)
                    for agent_id, eq in zip(supporting_agents, enriched_queries)
                ]

                responses = await asyncio.gather(*tasks, return_exceptions=True)

                for i, resp in enumerate(responses):
                    if isinstance(resp, Exception):
                        supporting_responses.append(AgentResponse(
                            agent_id=supporting_agents[i],
                            agent_name=supporting_agents[i],
                            success=False,
                            response="",
                            error=str(resp),
                        ))
                    else:
                        supporting_responses.append(resp)
                        if resp.success:
                            new_entities = self._extract_collaboration_entities(resp)
                            for key, values in new_entities.items():
                                if key not in shared_entities:
                                    shared_entities[key] = []
                                if isinstance(values, list):
                                    shared_entities[key].extend(values)
                                else:
                                    shared_entities[key].append(values)

        # Synthesize collaborative response
        synthesis = self._synthesize_collaborative_response(
            primary_response,
            supporting_responses,
            shared_entities,
            cross_references
        )

        total_duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        if event_callback:
            await event_callback("collaboration_complete", {
                "primary_agent": primary_agent,
                "supporting_agents": supporting_agents,
                "total_responses": 1 + len(supporting_responses),
                "successful_responses": sum(1 for r in [primary_response] + supporting_responses if r.success),
                "cross_references_found": len(cross_references),
                "total_duration_ms": total_duration,
            })

        return CollaborativeResult(
            primary_response=primary_response,
            supporting_responses=supporting_responses,
            shared_entities=shared_entities,
            cross_references=cross_references,
            synthesis=synthesis,
            total_duration_ms=total_duration,
            collaboration_type=collaboration_type,
        )

    def _find_cross_references(
        self,
        entities_a: Dict[str, Any],
        entities_b: Dict[str, Any],
        agent_a: str,
        agent_b: str
    ) -> Optional[Dict[str, Any]]:
        """Find cross-references between two sets of entities.

        Identifies common entities between two agent responses,
        indicating potential correlation points.

        Args:
            entities_a: Entities from first agent
            entities_b: Entities from second agent
            agent_a: First agent ID
            agent_b: Second agent ID

        Returns:
            Cross-reference dict if matches found, None otherwise
        """
        matches = []

        # Check for matching device names/serials
        for key in ["device_names", "device_serials", "device_ids"]:
            if key in entities_a and key in entities_b:
                set_a = set(str(v).lower() for v in entities_a[key] if v)
                set_b = set(str(v).lower() for v in entities_b[key] if v)
                common = set_a & set_b
                if common:
                    matches.append({
                        "type": key,
                        "matching_values": list(common)[:5],
                        "count": len(common),
                    })

        # Check for matching network references
        for key in ["network_names", "network_ids"]:
            if key in entities_a and key in entities_b:
                set_a = set(str(v).lower() for v in entities_a[key] if v)
                set_b = set(str(v).lower() for v in entities_b[key] if v)
                common = set_a & set_b
                if common:
                    matches.append({
                        "type": key,
                        "matching_values": list(common)[:5],
                        "count": len(common),
                    })

        if matches:
            return {
                "agents": [agent_a, agent_b],
                "matches": matches,
                "correlation_strength": "strong" if len(matches) > 1 else "moderate",
            }

        return None

    def _synthesize_collaborative_response(
        self,
        primary: AgentResponse,
        supporting: List[AgentResponse],
        entities: Dict[str, Any],
        cross_refs: List[Dict[str, Any]]
    ) -> str:
        """Synthesize a unified response from collaborative results.

        Creates a coherent narrative from multiple agent responses,
        highlighting correlations and insights.

        Args:
            primary: Primary agent response
            supporting: List of supporting agent responses
            entities: Shared entities discovered
            cross_refs: Cross-references between agents

        Returns:
            Synthesized response string
        """
        parts = []

        # Primary agent response
        if primary.success and primary.response:
            parts.append(f"### Primary Analysis ({primary.agent_name})")
            parts.append(primary.response)
        elif primary.error:
            parts.append(f"### Primary Analysis ({primary.agent_name})")
            parts.append(f"*Unable to complete: {primary.error}*")

        # Supporting agent responses
        for resp in supporting:
            if resp.success and resp.response:
                parts.append(f"\n### Supporting Analysis ({resp.agent_name})")
                parts.append(resp.response)
            elif resp.error:
                parts.append(f"\n### {resp.agent_name}")
                parts.append(f"*Unable to complete: {resp.error}*")

        # Cross-references found
        if cross_refs:
            parts.append("\n### Cross-Platform Correlations")
            for ref in cross_refs:
                agents = " & ".join(ref["agents"])
                for match in ref["matches"]:
                    parts.append(
                        f"- **{match['type'].replace('_', ' ').title()}**: "
                        f"{match['count']} matching item(s) found across {agents}"
                    )

        return "\n".join(parts)

    async def handle_agent_failure(
        self,
        failed_agent: str,
        query: str,
        error: str,
        context: AgentExecutionContext,
        event_callback: Optional[EventCallback] = None
    ) -> Optional[AgentResponse]:
        """Handle agent failure by attempting recovery via alternative agents.

        When an agent fails, this method attempts to recover by routing
        to alternative agents that might provide similar information.

        Args:
            failed_agent: ID of the agent that failed
            query: Original query
            error: Error message from failed agent
            context: Execution context
            event_callback: Optional SSE callback

        Returns:
            AgentResponse from recovery agent, or None if recovery fails
        """
        logger.warning(
            f"[Orchestrator] Agent {failed_agent} failed: {error}. Attempting recovery..."
        )

        # Get recovery options for this agent
        recovery_options = self.AGENT_RECOVERY_MAP.get(failed_agent, [])

        if not recovery_options:
            logger.info(f"[Orchestrator] No recovery options for {failed_agent}")
            return None

        if event_callback:
            await event_callback("agent_recovery_start", {
                "failed_agent": failed_agent,
                "error": error[:200],
                "recovery_options": [opt[0] for opt in recovery_options],
            })

        # Try each recovery option
        for recovery_agent, recovery_hint in recovery_options:
            logger.info(
                f"[Orchestrator] Trying recovery via {recovery_agent}: {recovery_hint}"
            )

            # Modify query to include recovery context
            recovery_query = f"{query} (Note: {recovery_hint} as fallback for {failed_agent})"

            try:
                response = await self.execute_agent(
                    recovery_agent,
                    recovery_query,
                    context
                )

                if response.success:
                    logger.info(
                        f"[Orchestrator] Recovery successful via {recovery_agent}"
                    )

                    if event_callback:
                        await event_callback("agent_recovery_success", {
                            "failed_agent": failed_agent,
                            "recovery_agent": recovery_agent,
                            "recovery_hint": recovery_hint,
                        })

                    # Add note about recovery to response
                    response.response = (
                        f"*Note: Primary agent ({failed_agent}) was unavailable. "
                        f"Response from {response.agent_name} as fallback.*\n\n"
                        f"{response.response}"
                    )

                    return response

            except Exception as e:
                logger.warning(
                    f"[Orchestrator] Recovery via {recovery_agent} also failed: {e}"
                )
                continue

        if event_callback:
            await event_callback("agent_recovery_failed", {
                "failed_agent": failed_agent,
                "attempted_agents": [opt[0] for opt in recovery_options],
            })

        logger.warning(
            f"[Orchestrator] All recovery options exhausted for {failed_agent}"
        )
        return None

    async def _get_agent_specific_context(
        self,
        agent_id: str,
        current_context: AgentExecutionContext
    ) -> Optional[AgentExecutionContext]:
        """Get credentials/context specific to an agent's required org type.

        When routing to a specialist agent (e.g., Splunk), we need to use
        the credentials for that platform, not the user's currently selected org.

        Args:
            agent_id: The agent being called
            current_context: The current execution context

        Returns:
            AgentExecutionContext with correct credentials, or None if not found
        """
        required_org_type = AGENT_TO_ORG_TYPE.get(agent_id)
        if not required_org_type:
            return None

        # Already have the right type
        if current_context.org_type == required_org_type:
            return current_context

        try:
            # Load dependencies for this agent type
            deps = await self.dependency_loader.load_for_agent(agent_id)
            if not deps:
                logger.warning(f"[Orchestrator] No {required_org_type} credentials configured")
                return None

            # Use the first available org of the required type
            first_dep = deps[0]
            logger.info(f"[Orchestrator] Found {required_org_type} org: {first_dep.org_name}")

            # Build context from the dependency
            return AgentExecutionContext(
                org_name=first_dep.org_name,
                org_id=first_dep.org_id,
                org_type=first_dep.org_type,
                api_key=first_dep.api_key,
                api_secret=first_dep.api_secret,
                base_url=first_dep.base_url,
                cached_networks=first_dep.cached_networks,
                cached_devices=first_dep.cached_devices,
                session_id=current_context.session_id,  # Keep original session
                user_id=current_context.user_id,  # Keep original user
            )

        except Exception as e:
            logger.error(f"[Orchestrator] Error loading {required_org_type} credentials: {e}")
            return None

    def _extract_query_params(
        self,
        query: str,
        context: AgentExecutionContext
    ) -> Dict[str, Any]:
        """Extract intent and entities from a query using pattern matching.

        This method parses the user's query to extract:
        - Intent: what action they want (list, drill down, status, etc.)
        - Network name: if they mention a specific network
        - Device name: if they mention a specific device
        - Network ID: resolved from network name using cached data

        Args:
            query: The user's query text
            context: Execution context with cached networks/devices

        Returns:
            Dict with extracted parameters:
            {
                "intent": "drill_down" | "list" | "status" | "health" | etc.,
                "network_name": "Riebel Home" | None,
                "network_id": "L_123..." | None,
                "device_name": "Device Name" | None,
                "device_serial": "XXXX-XXXX-XXXX" | None,
            }
        """
        params: Dict[str, Any] = {}
        query_lower = query.lower()

        # 1. Extract intent from query patterns
        intent_patterns = {
            "drill_down": [r"drill\s*down", r"dive\s*into", r"expand", r"details\s+(of|on|for)"],
            "list_devices": [r"devices?\s+(in|on|for)", r"what\s+devices", r"show.*devices", r"list.*devices"],
            "list_networks": [r"list.*networks?", r"show.*networks?", r"what\s+networks"],
            "status": [r"status\s+(of|for)", r"check\s+status", r"is\s+\w+\s+(online|offline|up|down)"],
            "health": [r"health\s+(of|for|check)", r"network\s+health", r"how\s+is\s+\w+\s+doing"],
            "search": [r"find\s+", r"search\s+for", r"look\s+for"],
        }

        for intent, patterns in intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    params["intent"] = intent
                    break
            if "intent" in params:
                break

        # Default intent based on query structure
        if "intent" not in params:
            if "?" in query or query_lower.startswith(("what", "how", "show", "list")):
                params["intent"] = "list"
            else:
                params["intent"] = "query"

        # 2. Extract network name by matching against cached networks
        if context.cached_networks:
            network_name = self._extract_network_mention(query, context.cached_networks)
            if network_name:
                params["network_name"] = network_name
                # Resolve to network_id
                network = context.get_network_by_name(network_name)
                if network:
                    params["network_id"] = network.get("id")
                    logger.info(f"[Orchestrator] Extracted network: {network_name} -> {params.get('network_id')}")

        # 3. Extract device name by matching against cached devices
        if context.cached_devices:
            device_name = self._extract_device_mention(query, context.cached_devices)
            if device_name:
                params["device_name"] = device_name
                # Resolve to device serial
                device = context.get_device_by_serial(device_name)  # Try serial first
                if not device:
                    # Search by name or model
                    for d in context.cached_devices:
                        if d.get("name", "").lower() == device_name.lower():
                            device = d
                            break
                        # Also try to match by model if device_name looks like a model
                        if d.get("model", "").lower() == device_name.lower():
                            device = d
                            break
                if device:
                    params["device_serial"] = device.get("serial")
                    params["device_model"] = device.get("model")

        # 3b. Also extract device model pattern from query (even if no cached devices)
        device_model = self._extract_device_model(query)
        if device_model and "device_model" not in params:
            params["device_model"] = device_model
            logger.info(f"[Orchestrator] Extracted device model from query: {device_model}")

        # 4. Extract quoted strings as potential entity references
        quoted_matches = re.findall(r'["\']([^"\']+)["\']', query)
        if quoted_matches and "network_name" not in params:
            # Try to match quoted string against networks
            for quoted in quoted_matches:
                network = context.get_network_by_name(quoted)
                if network:
                    params["network_name"] = quoted
                    params["network_id"] = network.get("id")
                    break

        logger.info(f"[Orchestrator] Extracted params from query: {params}")
        return params

    def _extract_network_mention(
        self,
        query: str,
        cached_networks: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Extract network name from query by matching against known networks.

        Uses case-insensitive matching and handles partial matches.

        Args:
            query: The user's query
            cached_networks: List of cached network objects with 'name' field

        Returns:
            The matched network name or None
        """
        query_lower = query.lower()

        # Sort by name length descending to match longer names first
        # This prevents "Home" matching before "Riebel Home"
        sorted_networks = sorted(
            cached_networks,
            key=lambda n: len(n.get("name", "")),
            reverse=True
        )

        for network in sorted_networks:
            network_name = network.get("name", "")
            if network_name and network_name.lower() in query_lower:
                return network_name

        return None

    def _extract_device_mention(
        self,
        query: str,
        cached_devices: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Extract device name from query by matching against known devices.

        Args:
            query: The user's query
            cached_devices: List of cached device objects with 'name' field

        Returns:
            The matched device name or None
        """
        query_lower = query.lower()

        # Sort by name length descending
        sorted_devices = sorted(
            cached_devices,
            key=lambda d: len(d.get("name", "")),
            reverse=True
        )

        for device in sorted_devices:
            device_name = device.get("name", "")
            if device_name and device_name.lower() in query_lower:
                return device_name
            # Also check serial numbers
            serial = device.get("serial", "")
            if serial and serial.lower() in query_lower:
                return serial
            # Also check model (e.g., "MX68" matches device with model "MX68")
            model = device.get("model", "")
            if model and model.lower() in query_lower:
                return device_name or serial  # Return name or serial for lookup

        return None

    def _extract_device_model(self, query: str) -> Optional[str]:
        """Extract device model from query using patterns.

        Args:
            query: The user's query

        Returns:
            The matched device model (e.g., "mx68") or None
        """
        query_lower = query.lower()
        for pattern in self.DEVICE_MODEL_PATTERNS:
            match = re.search(pattern, query_lower, re.IGNORECASE)
            if match:
                return match.group(1).lower()
        return None

    def _select_skill_from_intent(
        self,
        parsed_params: Dict[str, Any],
        default_skill: Optional[str],
        query: str = ""
    ) -> Optional[str]:
        """Select the best skill based on parsed intent.

        Args:
            parsed_params: Extracted query parameters with intent
            default_skill: Fallback skill if no intent mapping
            query: Original query for context-aware skill selection

        Returns:
            Skill ID to use
        """
        intent = parsed_params.get("intent", "").lower()
        query_lower = query.lower() if query else ""

        # Check for device-specific queries (details on MX68, info about MR36, etc.)
        if intent in ("drill_down", "details", "query"):
            # Check if query mentions a specific device model or serial
            import re
            for pattern in self.DEVICE_MODEL_PATTERNS:
                if re.search(pattern, query_lower, re.IGNORECASE):
                    logger.info(f"[Orchestrator] Detected device-specific query, using devices_get")
                    return "devices_get"

        # Check standard intent mapping
        if intent in self.INTENT_TO_SKILL:
            return self.INTENT_TO_SKILL[intent]

        return default_skill

    def route_to_specialists(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        cached_networks: Optional[List[Dict[str, Any]]] = None,
        org_type: Optional[str] = None
    ) -> RoutingDecision:
        """Route a query to the best specialist agents.

        Uses the registry's skill-based routing to find matching agents.
        Handles follow-up queries by enriching them with context.
        Detects multi-domain queries that require collaborative workflows.

        Args:
            query: The user's query
            context: Optional context for routing
            session_id: Optional session ID for follow-up tracking
            cached_networks: List of network dicts for context-aware routing
            org_type: Platform type (meraki, catalyst, etc.) for org_types lookup

        Returns:
            RoutingDecision with primary and secondary agents
        """
        original_query = query
        suggested_agent = None
        enrichment_reasoning = ""
        detected_domains: List[str] = []
        is_multi_domain = False
        collaboration_type = "parallel"

        # Check if this is a follow-up query and enrich it
        if self.is_follow_up_query(query):
            enriched_query, suggested_agent, enrichment_reasoning = self.enrich_follow_up_query(
                query, session_id
            )

            if enriched_query != query:
                logger.info(
                    f"[Orchestrator] Follow-up detected. "
                    f"Enriched: '{query}' -> '{enriched_query}'. "
                    f"Reasoning: {enrichment_reasoning}"
                )
                query = enriched_query

                # Record the enrichment in memory
                self.memory.record_turn(
                    query=original_query,
                    intent="follow_up",
                    agent_id=suggested_agent or "unknown",
                    summary=f"Follow-up enriched to: {enriched_query[:100]}"
                )

        # Check for explicit multi-domain patterns FIRST (Phase 6.2)
        multi_domain_result = self.detect_multi_domain_query(query)
        if multi_domain_result:
            detected_domains, collaboration_type = multi_domain_result
            is_multi_domain = True
            logger.info(
                f"[Orchestrator] Multi-domain query detected: agents={detected_domains}, "
                f"collaboration_type={collaboration_type}"
            )

        # Get ranked agents from registry
        # Note: Registry now always returns at least one agent (clarification-agent as fallback)
        # Pass cached networks for context-aware routing (e.g., "devices on riebel home" -> Meraki)
        org_types = {org_type: org_type} if org_type else None  # Simple mapping for now
        ranked_agents = self.registry.find_agents_for_query(
            query, context,
            cached_networks=cached_networks,
            org_types=org_types
        )

        # Apply feedback-based score adjustments for adaptive routing
        # This uses historical performance data to boost or penalize agents
        adjusted_agents = []
        for card, base_score in ranked_agents:
            # Get performance multiplier from cache (default 1.0 = neutral)
            performance_multiplier = self._agent_performance_cache.get(card.id, 1.0)

            # Get dynamic priority adjustment from feedback tracker
            # This returns -0.3 to +0.3 based on recent success rates
            priority_adjustment = self.feedback_tracker.get_priority_adjustment(
                intent=context.get("intent") if context else None,
                agent_id=card.id
            )

            # Get session context boost (e.g., user mentioned MX68 earlier -> boost Meraki)
            # This enables follow-up queries to route to the same platform
            session_boost = self.get_session_context_boost(card.id)

            # Calculate adjusted score
            # Formula: base_score * performance * (1 + adjustment) + session_boost
            adjusted_score = base_score * performance_multiplier * (1 + priority_adjustment) + session_boost

            adjusted_agents.append((card, adjusted_score, base_score, priority_adjustment))

            if priority_adjustment != 0 or session_boost > 0:
                logger.debug(
                    f"[Orchestrator] Agent {card.id}: base={base_score:.2f}, "
                    f"perf={performance_multiplier:.2f}, adj={priority_adjustment:+.2f}, "
                    f"session_boost={session_boost:.2f}, final={adjusted_score:.2f}"
                )

        # Re-rank by adjusted scores
        adjusted_agents.sort(key=lambda x: x[1], reverse=True)
        ranked_agents = [(card, adj_score) for card, adj_score, _, _ in adjusted_agents]

        # Determine primary agent
        primary_card, primary_score = ranked_agents[0]

        # If multi-domain detected, use detected agents; first is primary
        if is_multi_domain and detected_domains:
            # Find the primary from detected domains
            for card, _ in ranked_agents:
                if card.id in detected_domains:
                    primary_card = card
                    break

            # Secondary agents are the rest from detected domains
            secondary_agents = [a for a in detected_domains if a != primary_card.id]
            parallel_execution = collaboration_type == "parallel"
        else:
            # Standard routing: determine secondary agents
            secondary_agents = []
            parallel_execution = False

            # Check for implicit multi-domain queries
            query_lower = query.lower()
            implicit_multi_domain = any(kw in query_lower for kw in [
                "network issues", "all issues", "health", "status", "overview"
            ])

            # Check if this is a security/monitoring query (should include Splunk)
            is_security_query = any(kw in query_lower for kw in [
                "health", "security", "logs", "alerts", "incidents", "issues", "problems", "events"
            ])

            # For implicit multi-domain, build secondary agents list
            if implicit_multi_domain and len(ranked_agents) > 1:
                # Include secondary agents for comprehensive response
                # Note: UI agent is excluded from parallel - it runs as follow-up with collected data
                for card, score in ranked_agents[1:4]:  # Up to 3 secondary
                    # Exclude UI agent from parallel - it will run as follow-up
                    if card.id == "ui-agent":
                        continue
                    if score > 0.5:  # Only if reasonably relevant
                        secondary_agents.append(card.id)

                # Ensure Splunk is included for security/health queries
                if is_security_query and "splunk-agent" not in secondary_agents:
                    if primary_card.id != "splunk-agent":
                        secondary_agents.append("splunk-agent")

                # Parallel execution for independent agents
                parallel_execution = len(secondary_agents) > 0
                is_multi_domain = implicit_multi_domain

        # Determine the best skill to use
        primary_skill = self._find_best_skill(primary_card, query)

        # If follow-up suggested a different agent with context, prefer it
        if suggested_agent and suggested_agent != primary_card.id:
            suggested_card = self.registry.get_agent(suggested_agent)
            if suggested_card:
                logger.info(
                    f"[Orchestrator] Follow-up context suggests {suggested_agent}, "
                    f"overriding registry match {primary_card.id}"
                )
                primary_card = suggested_card
                primary_skill = self._find_best_skill(primary_card, query)

        # Build reasoning with follow-up context if applicable
        reasoning = f"Matched {primary_card.name} based on skill tags"
        if enrichment_reasoning:
            reasoning = f"{enrichment_reasoning}. {reasoning}"
        if is_multi_domain:
            reasoning += f". Multi-domain query detected ({collaboration_type} collaboration)."

        # Store routing for future follow-up context
        routing_decision = RoutingDecision(
            primary_agent=primary_card.id,
            primary_agent_name=primary_card.name,
            primary_skill=primary_skill,
            secondary_agents=secondary_agents,
            confidence=min(primary_score / 5.0, 1.0),  # Normalize score
            reasoning=reasoning,
            parallel_execution=parallel_execution,
            is_multi_domain=is_multi_domain,
            detected_domains=detected_domains if detected_domains else secondary_agents,
        )

        # Store for follow-up tracking
        self._last_routing = routing_decision
        self._last_query = original_query
        self._last_session_id = session_id

        # Record turn in memory for context tracking
        self.memory.record_turn(
            query=original_query,
            intent="routing",
            agent_id=primary_card.id,
            summary=f"Routed to {primary_card.name}"
        )

        return routing_decision

    def _find_best_skill(self, agent_card: AgentCard, query: str) -> Optional[str]:
        """Find the best skill for a query within an agent."""
        query_lower = query.lower()
        best_skill = None
        best_score = 0

        for skill in agent_card.skills:
            score = 0

            # Check tags
            for tag in skill.tags:
                if tag.lower() in query_lower:
                    score += 1

            # Check examples
            for example in skill.examples:
                words = set(example.lower().split())
                query_words = set(query_lower.split())
                overlap = len(words & query_words)
                score += overlap * 0.5

            if score > best_score:
                best_score = score
                best_skill = skill.id

        return best_skill

    async def execute_agent(
        self,
        agent_id: str,
        query: str,
        context: AgentExecutionContext,
        skill_id: Optional[str] = None,
        extracted_params: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """Execute a single agent with the given query.

        Args:
            agent_id: ID of the agent to execute
            query: Query to send
            context: Execution context
            skill_id: Optional specific skill to use
            extracted_params: Pre-extracted query parameters (intent, network_name, etc.)

        Returns:
            AgentResponse with results
        """
        start_time = datetime.utcnow()

        try:
            agent_card = self.registry.get_agent(agent_id)
            if not agent_card:
                return AgentResponse(
                    agent_id=agent_id,
                    agent_name="Unknown",
                    success=False,
                    response="",
                    error=f"Agent not found: {agent_id}",
                )

            # Extract params from query if not provided
            params = extracted_params if extracted_params else self._extract_query_params(query, context)

            # Select skill based on intent if not explicitly provided
            if not skill_id and params.get("intent"):
                skill_id = self._select_skill_from_intent(params, skill_id, query)

            # If still no skill, find best skill for agent
            if not skill_id:
                skill_id = self._find_best_skill(agent_card, query)

            logger.info(f"[Orchestrator] Executing agent {agent_id} with skill={skill_id}, params={params}")

            # Check if we need agent-specific credentials
            agent_context = context
            required_org_type = AGENT_TO_ORG_TYPE.get(agent_id)
            if required_org_type and context.org_type != required_org_type:
                logger.info(f"[Orchestrator] Agent {agent_id} requires {required_org_type} credentials, current context has {context.org_type}")
                # Try to load credentials for the correct org type
                agent_specific_context = await self._get_agent_specific_context(agent_id, context)
                if agent_specific_context:
                    agent_context = agent_specific_context
                    logger.info(f"[Orchestrator] Using {required_org_type} credentials: base_url={agent_context.base_url}")
                else:
                    logger.warning(f"[Orchestrator] Could not find {required_org_type} credentials, using original context")

            # Build message for agent with extracted params
            message = A2AMessage(
                role="user",
                parts=[
                    TextPart(text=query),
                    DataPart(data={"skill_id": skill_id, "params": params}),
                ],
                context={"session_id": context.session_id},
            )

            # Send to agent via registry with context for specialist agents
            logger.info(f"[Orchestrator] Calling registry.send_message for {agent_id}...")
            response_message = await self.registry.send_message(agent_id, message, agent_context)
            logger.info(f"[Orchestrator] Registry returned: response_message={response_message is not None}")

            if not response_message:
                return AgentResponse(
                    agent_id=agent_id,
                    agent_name=agent_card.name,
                    success=False,
                    response="",
                    error="No response from agent",
                    duration_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                )

            # Extract response components
            response_text = ""
            response_data = None
            entities = {}
            structured_data = None
            input_tokens = 0
            output_tokens = 0

            logger.info(f"[Orchestrator] Processing response parts: parts={response_message.parts}, type={type(response_message.parts)}")
            if response_message.parts is None:
                logger.error(f"[Orchestrator] response_message.parts is None!")
                return AgentResponse(
                    agent_id=agent_id,
                    agent_name=agent_card.name,
                    success=False,
                    response="",
                    error="Agent returned response with no parts",
                    duration_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                )

            logger.info(f"[Orchestrator] Iterating over {len(response_message.parts)} parts...")
            for part in response_message.parts:
                if isinstance(part, TextPart):
                    response_text = part.text
                elif isinstance(part, DataPart):
                    response_data = part.data
                    if "result" in response_data:
                        entities = response_data["result"].get("entities_extracted", {})
                    # Extract structured data for canvas cards (lists/arrays of data)
                    if "data" in response_data:
                        data = response_data["data"]
                        if isinstance(data, list) and len(data) > 0:
                            structured_data = data
                        elif isinstance(data, dict) and any(isinstance(v, list) for v in data.values()):
                            # Find the first list in the dict
                            for v in data.values():
                                if isinstance(v, list) and len(v) > 0:
                                    structured_data = v
                                    break
                    # Extract token usage if present
                    if "usage" in response_data:
                        usage = response_data["usage"]
                        input_tokens = usage.get("input_tokens", 0)
                        output_tokens = usage.get("output_tokens", 0)

            # Get artifacts and usage from context
            artifacts = []
            if response_message.context:
                # Handle case where entities_extracted is explicitly None
                context_entities = response_message.context.get("entities_extracted")
                if context_entities:
                    entities.update(context_entities)
                # Also check context for usage
                if "usage" in response_message.context:
                    usage = response_message.context["usage"]
                    input_tokens = max(input_tokens, usage.get("input_tokens", 0))
                    output_tokens = max(output_tokens, usage.get("output_tokens", 0))

            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return AgentResponse(
                agent_id=agent_id,
                agent_name=agent_card.name,
                success=True,
                response=response_text,
                data=response_data,
                artifacts=artifacts,
                entities=entities,
                duration_ms=duration_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                structured_data=structured_data,
            )

        except Exception as e:
            logger.error(f"[Orchestrator] Agent execution error for {agent_id}: {e}", exc_info=True)
            return AgentResponse(
                agent_id=agent_id,
                agent_name=agent_id,
                success=False,
                response="",
                error=str(e),
                duration_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
            )

    async def parallel_execute(
        self,
        agent_ids: List[str],
        query: str,
        context: AgentExecutionContext,
        event_callback: Optional[EventCallback] = None
    ) -> List[AgentResponse]:
        """Execute multiple agents in parallel.

        Args:
            agent_ids: List of agent IDs to execute
            query: Query to send to all
            context: Execution context
            event_callback: Optional callback for SSE events

        Returns:
            List of AgentResponses
        """
        if event_callback:
            await event_callback("parallel_start", {
                "agents": agent_ids,
                "query": query[:100],
            })

        # Create tasks for parallel execution
        tasks = [
            self.execute_agent(agent_id, query, context)
            for agent_id in agent_ids
        ]

        # Execute in parallel
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        results = []
        completed_agents = []

        for i, response in enumerate(responses):
            if isinstance(response, Exception):
                results.append(AgentResponse(
                    agent_id=agent_ids[i],
                    agent_name=agent_ids[i],
                    success=False,
                    response="",
                    error=str(response),
                ))
            else:
                results.append(response)
                if response.success:
                    completed_agents.append(response.agent_id)

        if event_callback:
            await event_callback("parallel_complete", {
                "agents_completed": completed_agents,
                "total_agents": len(agent_ids),
            })

        return results

    async def sequential_execute(
        self,
        agent_sequence: List[str],
        initial_query: str,
        context: AgentExecutionContext,
        event_callback: Optional[EventCallback] = None
    ) -> List[AgentResponse]:
        """Execute agents in sequence, passing context between them.

        Args:
            agent_sequence: Ordered list of agent IDs
            initial_query: Initial query
            context: Execution context
            event_callback: Optional callback for SSE events

        Returns:
            List of AgentResponses in order
        """
        responses = []
        current_query = initial_query
        accumulated_entities = {}

        for i, agent_id in enumerate(agent_sequence):
            if event_callback:
                await event_callback("multi_agent_handoff", {
                    "from_agent": agent_sequence[i-1] if i > 0 else "orchestrator",
                    "from_agent_name": agent_sequence[i-1] if i > 0 else "Orchestrator",
                    "to_agent": agent_id,
                    "to_agent_name": agent_id,  # Will be resolved
                    "turn_number": i + 1,
                    "context_summary": f"Passing {len(accumulated_entities)} entity types",
                    "entities_passed": list(accumulated_entities.keys()),
                })

            # Update context with accumulated entities
            context.entities_from_previous_turns = accumulated_entities

            response = await self.execute_agent(agent_id, current_query, context)
            responses.append(response)

            # Accumulate entities
            if response.success and response.entities:
                for key, values in response.entities.items():
                    if key not in accumulated_entities:
                        accumulated_entities[key] = []
                    if isinstance(values, list):
                        accumulated_entities[key].extend(values)
                    else:
                        accumulated_entities[key].append(values)

            # Update query for next agent based on findings
            if response.success and response.response:
                current_query = f"Based on previous findings: {response.response[:200]}... {initial_query}"

        return responses

    async def execute_multi_turn(
        self,
        query: str,
        session_id: str,
        org_context: AgentOrgContext,
        event_callback: Optional[EventCallback] = None,
        max_turns: int = 10
    ) -> MultiTurnConversation:
        """Execute a multi-turn conversation with specialists.

        Main entry point for complex queries that may need multiple
        agent consultations.

        Args:
            query: User's query
            session_id: Session ID for tracking
            org_context: Organization context with credentials
            event_callback: Callback for SSE events
            max_turns: Maximum turns allowed

        Returns:
            Complete MultiTurnConversation
        """
        # Start conversation
        conversation = self.turn_manager.start_conversation(query, session_id, max_turns)

        # Convert org context to execution context
        exec_context = org_context.to_execution_context()

        try:
            # Extract and record entities from query for session context tracking
            # This enables follow-up queries like "give me config details" to remember
            # that we were discussing "MX68" earlier
            query_entities = self.record_query_entities(query, session_id)
            if query_entities:
                logger.info(f"[Orchestrator] Recorded {len(query_entities)} entities for session context")

            # Extract query parameters ONCE (intent, network_name, network_id, etc.)
            extracted_params = self._extract_query_params(query, exec_context)
            logger.info(f"[Orchestrator] Query params extracted: {extracted_params}")

            # Initial routing - pass cached networks for context-aware routing
            routing = self.route_to_specialists(
                query,
                cached_networks=exec_context.cached_networks if exec_context else None,
                org_type=exec_context.org_type if exec_context else None
            )

            # Override skill based on extracted intent if applicable
            skill_to_use = routing.primary_skill
            if extracted_params.get("intent"):
                intent_skill = self._select_skill_from_intent(extracted_params, routing.primary_skill, query)
                if intent_skill and intent_skill != routing.primary_skill:
                    logger.info(f"[Orchestrator] Intent '{extracted_params['intent']}' overriding skill: {routing.primary_skill} -> {intent_skill}")
                    skill_to_use = intent_skill

            if event_callback:
                await event_callback("orchestrator_routing", {
                    "primary_agent": routing.primary_agent,
                    "primary_agent_name": routing.primary_agent_name,
                    "secondary_agents": routing.secondary_agents,
                    "confidence": routing.confidence,
                    "reasoning": routing.reasoning,
                    "parallel_execution": routing.parallel_execution,
                    "is_multi_domain": routing.is_multi_domain,
                    "detected_domains": routing.detected_domains,
                    "extracted_params": extracted_params,  # Include for debugging
                    "selected_skill": skill_to_use,
                })

            conversation.routing_history.append({
                "query": query,
                "routing": {
                    "primary": routing.primary_agent,
                    "secondary": routing.secondary_agents,
                    "is_multi_domain": routing.is_multi_domain,
                },
                "extracted_params": extracted_params,
            })

            # Check if this is a multi-domain query requiring collaborative workflow
            if routing.is_multi_domain and routing.secondary_agents:
                # Use collaborative workflow for cross-platform queries
                collaboration_type = "parallel" if routing.parallel_execution else "sequential"

                if event_callback:
                    await event_callback("collaborative_workflow_start", {
                        "primary_agent": routing.primary_agent,
                        "supporting_agents": routing.secondary_agents,
                        "collaboration_type": collaboration_type,
                    })

                collab_result = await self.execute_collaborative_workflow(
                    query=query,
                    primary_agent=routing.primary_agent,
                    supporting_agents=routing.secondary_agents,
                    context=exec_context,
                    collaboration_type=collaboration_type,
                    event_callback=event_callback,
                )

                # Record results in conversation
                # Primary response
                primary_turn = self.turn_manager.add_turn(
                    conversation,
                    collab_result.primary_response.agent_id,
                    collab_result.primary_response.agent_name,
                    query,
                    TurnType.SPECIALIST
                )
                self.turn_manager.complete_turn(
                    primary_turn,
                    collab_result.primary_response.response,
                    collab_result.primary_response.artifacts,
                    collab_result.primary_response.entities,
                    collab_result.primary_response.success,
                    collab_result.primary_response.error,
                )

                # Supporting responses
                for resp in collab_result.supporting_responses:
                    turn = self.turn_manager.add_turn(
                        conversation, resp.agent_id, resp.agent_name, query, TurnType.SPECIALIST
                    )
                    self.turn_manager.complete_turn(
                        turn, resp.response, resp.artifacts, resp.entities, resp.success, resp.error
                    )

                # Accumulate all entities
                if collab_result.shared_entities:
                    self.turn_manager.accumulate_entities(conversation, collab_result.shared_entities)

                # Store cross-references in conversation context
                if collab_result.cross_references:
                    conversation.routing_history.append({
                        "cross_references": collab_result.cross_references,
                    })

            else:
                # Standard single-agent execution with error recovery
                primary_turn = await self._execute_turn(
                    conversation,
                    routing.primary_agent,
                    routing.primary_agent_name,
                    query,
                    exec_context,
                    skill_to_use,
                    event_callback,
                    extracted_params=extracted_params,
                )

                # Check if primary agent failed and attempt recovery (Phase 6.3)
                if primary_turn.status != TaskState.COMPLETED or primary_turn.error:
                    logger.warning(
                        f"[Orchestrator] Primary agent {routing.primary_agent} failed. "
                        f"Attempting recovery..."
                    )

                    recovery_response = await self.handle_agent_failure(
                        failed_agent=routing.primary_agent,
                        query=query,
                        error=primary_turn.error or "Unknown error",
                        context=exec_context,
                        event_callback=event_callback,
                    )

                    if recovery_response and recovery_response.success:
                        # Add recovery turn
                        recovery_turn = self.turn_manager.add_turn(
                            conversation,
                            recovery_response.agent_id,
                            recovery_response.agent_name,
                            query,
                            TurnType.SPECIALIST
                        )
                        self.turn_manager.complete_turn(
                            recovery_turn,
                            recovery_response.response,
                            recovery_response.artifacts,
                            recovery_response.entities,
                            recovery_response.success,
                            None,
                        )
                        if recovery_response.entities:
                            self.turn_manager.accumulate_entities(conversation, recovery_response.entities)

                # Execute secondary agents in parallel if appropriate
                if routing.secondary_agents and routing.parallel_execution:
                    await self._execute_parallel_turns(
                        conversation,
                        routing.secondary_agents,
                        query,
                        exec_context,
                        event_callback,
                    )

            # Check for follow-ups
            while self.turn_manager.should_continue(conversation):
                follow_ups = self.turn_manager.get_follow_up_queries(conversation, query)

                if not follow_ups:
                    break

                # Execute first follow-up
                follow_up = follow_ups[0]
                await self._execute_turn(
                    conversation,
                    follow_up["agent_id"],
                    follow_up.get("agent_name", follow_up["agent_id"]),
                    follow_up["query"],
                    exec_context,
                    None,
                    event_callback,
                    TurnType.FOLLOW_UP,
                )

            # Synthesize final response (returns tuple with token counts for code-based synthesis)
            final_response, _, _, _ = await self._synthesize_responses(conversation, event_callback)

            self.turn_manager.complete_conversation(conversation, final_response, success=True)

        except Exception as e:
            logger.error(f"[Orchestrator] Multi-turn execution error: {e}", exc_info=True)
            self.turn_manager.complete_conversation(
                conversation,
                f"Error during multi-turn execution: {str(e)}",
                success=False
            )

        return conversation

    async def _execute_turn(
        self,
        conversation: MultiTurnConversation,
        agent_id: str,
        agent_name: str,
        query: str,
        context: AgentExecutionContext,
        skill_id: Optional[str],
        event_callback: Optional[EventCallback],
        turn_type: TurnType = TurnType.SPECIALIST,
        extracted_params: Optional[Dict[str, Any]] = None
    ) -> ConversationTurn:
        """Execute a single turn in the conversation.

        Args:
            conversation: The multi-turn conversation
            agent_id: ID of agent to execute
            agent_name: Display name of agent
            query: User's query
            context: Execution context
            skill_id: Skill to use
            event_callback: SSE event callback
            turn_type: Type of turn
            extracted_params: Pre-extracted query parameters (intent, network_name, etc.)
        """
        # Add turn
        turn = self.turn_manager.add_turn(
            conversation, agent_id, agent_name, query, turn_type
        )

        if event_callback:
            await event_callback("turn_start", {
                "turn_number": turn.turn_number,
                "agent_id": agent_id,
                "agent_name": agent_name,
                "query": query[:100],
                "skill_id": skill_id,
                "extracted_params": extracted_params,
            })

        # Execute agent with extracted params
        response = await self.execute_agent(
            agent_id, query, context, skill_id, extracted_params
        )

        # Complete turn
        self.turn_manager.complete_turn(
            turn,
            response.response,
            response.artifacts,
            response.entities,
            response.success,
            response.error,
        )

        # Accumulate entities
        if response.entities:
            self.turn_manager.accumulate_entities(conversation, response.entities)

        if event_callback:
            await event_callback("turn_complete", {
                "turn_number": turn.turn_number,
                "agent_id": agent_id,
                "agent_name": agent_name,
                "success": response.success,
                "duration_ms": response.duration_ms,
                "entities_found": list(response.entities.keys()) if response.entities else [],
                # Token usage for cost tracking
                "input_tokens": response.input_tokens,
                "output_tokens": response.output_tokens,
                # Structured data for canvas cards
                "structured_data": response.structured_data,
            })

        return turn

    async def _execute_parallel_turns(
        self,
        conversation: MultiTurnConversation,
        agent_ids: List[str],
        query: str,
        context: AgentExecutionContext,
        event_callback: Optional[EventCallback]
    ) -> List[ConversationTurn]:
        """Execute multiple agents in parallel as separate turns."""
        if event_callback:
            await event_callback("parallel_start", {
                "agents": agent_ids,
            })

        turns = []
        tasks = []

        for agent_id in agent_ids:
            agent_card = self.registry.get_agent(agent_id)
            agent_name = agent_card.name if agent_card else agent_id

            turn = self.turn_manager.add_turn(
                conversation, agent_id, agent_name, query, TurnType.SPECIALIST
            )
            turns.append(turn)

            tasks.append(self.execute_agent(agent_id, query, context))

        # Execute in parallel
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for i, (turn, response) in enumerate(zip(turns, responses)):
            if isinstance(response, Exception):
                self.turn_manager.complete_turn(
                    turn, "", [], {}, False, str(response)
                )
            else:
                self.turn_manager.complete_turn(
                    turn,
                    response.response,
                    response.artifacts,
                    response.entities,
                    response.success,
                    response.error,
                )
                if response.entities:
                    self.turn_manager.accumulate_entities(conversation, response.entities)

        if event_callback:
            await event_callback("parallel_complete", {
                "agents_completed": [t.agent_id for t in turns if t.status == TaskState.COMPLETED],
            })

        return turns

    async def _synthesize_responses(
        self,
        conversation: MultiTurnConversation,
        event_callback: Optional[EventCallback],
        ai_provider: Optional[Any] = None,
        original_query: str = ""
    ) -> Tuple[str, int, int, float]:
        """Synthesize responses from all turns into a comprehensive final response.

        If ai_provider is provided, uses AI to generate a natural language response.
        Otherwise falls back to code-based synthesis.

        Args:
            conversation: The multi-turn conversation
            event_callback: SSE event callback
            ai_provider: Optional streaming provider for AI synthesis
            original_query: The original user query

        Returns:
            Tuple of (response_text, input_tokens, output_tokens, cost_usd)
        """
        if event_callback:
            await event_callback("synthesis_start", {
                "turns_to_synthesize": len(conversation.turns),
                "agents_consulted": list(set(t.agent_id for t in conversation.turns)),
            })

        # Collect all responses with their data
        responses = []
        all_data = {}
        for turn in conversation.turns:
            if turn.status == TaskState.COMPLETED and turn.response:
                responses.append({
                    "agent": turn.agent_name,
                    "agent_id": turn.agent_id,
                    "response": turn.response,
                })
                # Track data by agent type for visualization suggestions
                all_data[turn.agent_id] = turn.response

        if not responses:
            return ("I wasn't able to find specific information for your query. The specialist agents may not have data matching your request, or there may be a connectivity issue with the APIs.", 0, 0, 0.0)

        # If only one agent responded and no AI provider, return response directly
        # Otherwise, always use AI synthesis to enable cost tracking
        if len(responses) == 1 and not ai_provider:
            return (responses[0]["response"], 0, 0, 0.0)

        # Try AI-powered synthesis if provider is available (includes single-agent for cost tracking)
        if ai_provider and original_query:
            try:
                return await self._ai_synthesize(responses, conversation, ai_provider, original_query)
            except Exception as e:
                logger.warning(f"[Orchestrator] AI synthesis failed, falling back to code: {e}")
                # Fall through to code-based synthesis

        # Code-based synthesis (fallback)
        synthesis_parts = []

        # Organize by domain
        meraki_data = next((r for r in responses if "meraki" in r["agent_id"].lower()), None)
        catalyst_data = next((r for r in responses if "catalyst" in r["agent_id"].lower()), None)
        thousandeyes_data = next((r for r in responses if "thousandeyes" in r["agent_id"].lower()), None)
        splunk_data = next((r for r in responses if "splunk" in r["agent_id"].lower()), None)

        # Meraki section
        if meraki_data:
            synthesis_parts.append(f"### Meraki Network")
            synthesis_parts.append(meraki_data["response"])

        # Catalyst section
        if catalyst_data:
            synthesis_parts.append(f"\n### Catalyst Center")
            synthesis_parts.append(catalyst_data["response"])

        # ThousandEyes section
        if thousandeyes_data:
            synthesis_parts.append(f"\n### ThousandEyes Monitoring")
            synthesis_parts.append(thousandeyes_data["response"])

        # Splunk section
        if splunk_data:
            synthesis_parts.append(f"\n### Splunk Security & Logs")
            synthesis_parts.append(splunk_data["response"])

        # Any other agents
        other_responses = [r for r in responses if r["agent_id"] not in
                         ["meraki-agent", "catalyst-agent", "thousandeyes-agent", "splunk-agent", "ui-agent"]]
        for r in other_responses:
            synthesis_parts.append(f"\n### {r['agent']}")
            synthesis_parts.append(r["response"])

        # Summary of entities found
        if conversation.all_entities:
            synthesis_parts.append("\n\n---\n*Discovered Resources:*")
            for entity_type, values in conversation.all_entities.items():
                if values and len(values) > 0:
                    display_name = entity_type.replace('_', ' ').title()
                    # Show first few values
                    preview = values[:3] if isinstance(values, list) else [str(values)]
                    preview_str = ", ".join(str(v) for v in preview)
                    if len(values) > 3:
                        preview_str += f"... (+{len(values) - 3} more)"
                    synthesis_parts.append(f"- **{display_name}**: {preview_str}")

        return ("\n".join(synthesis_parts), 0, 0, 0.0)

    async def _ai_synthesize(
        self,
        responses: List[Dict[str, Any]],
        conversation: MultiTurnConversation,
        ai_provider: Any,
        original_query: str
    ) -> Tuple[str, int, int, float]:
        """Use AI to synthesize a natural language response from agent data.

        Args:
            responses: List of agent responses
            conversation: The conversation context
            ai_provider: Streaming AI provider
            original_query: User's original query

        Returns:
            Tuple of (response_text, input_tokens, output_tokens, cost_usd)
        """
        # Build context for AI - exclude UI Agent since it provides card configs, not informational data
        context_parts = ["Here is the data collected from specialist network agents:\n"]

        for r in responses:
            # Skip UI Agent - it provides visualization cards, not data to synthesize
            if r.get("agent_id") == "ui-agent":
                continue
            context_parts.append(f"## {r['agent']} Response:")
            context_parts.append(r["response"])
            context_parts.append("")

        if conversation.all_entities:
            context_parts.append("## Discovered Entities:")
            for entity_type, values in conversation.all_entities.items():
                if values:
                    context_parts.append(f"- {entity_type}: {values[:5]}")

        context = "\n".join(context_parts)

        system_prompt = """You are a helpful network assistant synthesizing information from specialist agents.
Your task is to provide a clear, concise, and helpful response to the user's question.

Guidelines:
- Directly answer the user's question based on the data provided
- Be concise but complete
- Use markdown formatting for readability
- If the data doesn't fully answer the question, say so
- Don't make up information not in the data"""

        messages = [
            {"role": "user", "content": f"User's question: {original_query}\n\n{context}\n\nPlease synthesize a helpful response."}
        ]

        # Use the AI provider to generate response
        full_text = ""
        input_tokens = 0
        output_tokens = 0
        cost_usd = 0.0

        async for event in ai_provider.stream_chat(messages, system_prompt):
            # Parse SSE event
            if event.startswith("data: "):
                try:
                    data = json.loads(event[6:])
                    if data.get("type") == "text_delta":
                        full_text += data.get("text", "")
                    elif data.get("type") == "done":
                        usage = data.get("usage", {})
                        input_tokens = usage.get("input_tokens", 0)
                        output_tokens = usage.get("output_tokens", 0)
                        cost_usd = data.get("cost_usd", 0.0)
                except:
                    pass

        return (full_text or "\n".join([r["response"] for r in responses]), input_tokens, output_tokens, cost_usd)

    async def stream_multi_turn(
        self,
        query: str,
        session_id: str,
        org_context: AgentOrgContext,
        ai_provider: Optional[Any] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream multi-turn conversation events.

        Yields SSE events for frontend visualization.

        Args:
            query: User's query
            session_id: Session ID
            org_context: Organization context
            ai_provider: Optional AI provider for response synthesis (enables cost tracking)

        Yields:
            SSE event dictionaries
        """
        events_queue: asyncio.Queue = asyncio.Queue()

        # Token and data accumulators
        total_input_tokens = 0
        total_output_tokens = 0
        collected_tool_data: List[Dict[str, Any]] = []

        async def event_callback(event_type: str, data: Dict[str, Any]):
            await events_queue.put({"type": event_type, **data})

        # Start execution in background
        task = asyncio.create_task(
            self.execute_multi_turn(
                query, session_id, org_context, event_callback
            )
        )

        # Yield events as they come, accumulating tokens and tool_data
        try:
            while not task.done() or not events_queue.empty():
                try:
                    event = await asyncio.wait_for(events_queue.get(), timeout=0.1)

                    # Accumulate tokens and structured data from turn_complete events
                    if event.get("type") == "turn_complete":
                        total_input_tokens += event.get("input_tokens", 0)
                        total_output_tokens += event.get("output_tokens", 0)

                        # Collect structured data for canvas cards
                        structured_data = event.get("structured_data")
                        if structured_data:
                            collected_tool_data.append({
                                "agent": event.get("agent_id"),
                                "agent_name": event.get("agent_name"),
                                "data": structured_data,
                            })

                    yield event
                except asyncio.TimeoutError:
                    continue

            # Get final result
            conversation = await task

            # If AI provider available, use it to synthesize a better response
            synthesis_input_tokens = 0
            synthesis_output_tokens = 0
            synthesis_cost_usd = 0.0

            if ai_provider and conversation.final_response:
                # Check if we have multiple responses to synthesize
                completed_turns = [t for t in conversation.turns if t.status == TaskState.COMPLETED and t.response]
                if len(completed_turns) > 1:
                    logger.info(f"[Orchestrator] Using AI to synthesize {len(completed_turns)} agent responses")
                    yield {"type": "synthesis_ai_start", "agents": len(completed_turns)}

                    try:
                        # Re-synthesize with AI
                        ai_response, synthesis_input_tokens, synthesis_output_tokens, synthesis_cost_usd = await self._synthesize_responses(
                            conversation, None, ai_provider, query
                        )
                        if ai_response:
                            conversation.final_response = ai_response
                            total_input_tokens += synthesis_input_tokens
                            total_output_tokens += synthesis_output_tokens
                            logger.info(f"[Orchestrator] AI synthesis used {synthesis_input_tokens} input, {synthesis_output_tokens} output tokens, cost: ${synthesis_cost_usd:.6f}")
                    except Exception as e:
                        logger.warning(f"[Orchestrator] AI synthesis failed: {e}")

            # Use AI provider cost if available, otherwise calculate (for non-AI agents, cost is 0)
            cost_usd = synthesis_cost_usd if synthesis_cost_usd > 0 else calculate_cost(total_input_tokens, total_output_tokens)

            # Yield final multi-agent completion event with accumulated data
            yield {
                "type": "multi_agent_done",
                "conversation_id": conversation.conversation_id,
                "total_turns": len(conversation.turns),
                "agents_consulted": list(set(t.agent_id for t in conversation.turns)),
                "total_duration_ms": int((datetime.utcnow() - conversation.started_at).total_seconds() * 1000) if conversation.started_at else 0,
                "usage": {
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "cost_usd": cost_usd,
                },
                "tool_data": collected_tool_data,  # For canvas cards
                "entities_discovered": conversation.all_entities or {},
                "final_response": conversation.final_response,
                "success": conversation.status == TaskState.COMPLETED,
            }

        except Exception as e:
            logger.error(f"[Orchestrator] Stream error: {e}", exc_info=True)
            yield {
                "type": "error",
                "error": str(e),
            }


# Global instance
_orchestrator: Optional[EnhancedOrchestrator] = None


def get_enhanced_orchestrator() -> EnhancedOrchestrator:
    """Get the global enhanced orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = EnhancedOrchestrator()
    return _orchestrator
