"""Base Specialist Agent for Multi-Agent Network Management.

This module provides the foundation for specialist agents that wrap
specific API services (Meraki, ThousandEyes, Catalyst, Splunk) and
provide domain-specific skills to the orchestrator.

Specialist agents:
- Register with the A2A registry with their skills and tags
- Execute skills based on orchestrator routing
- Return structured results with artifacts for downstream agents
"""

import logging
import uuid
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime

from ..types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    AgentInterface,
    A2AMessage,
    TextPart,
    DataPart,
    TaskState,
)
from ..registry import get_agent_registry
from ..collaboration import (
    CollaborationArtifact,
    ArtifactType,
    get_artifact_store,
)

logger = logging.getLogger(__name__)


@dataclass
class AgentDependency:
    """Represents an organization/system this agent can operate on."""
    org_name: str
    org_id: str
    org_type: str  # "meraki", "catalyst", "thousandeyes", "splunk"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    additional_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentExecutionContext:
    """Context provided to specialist agents during skill execution.

    Contains all the information an agent needs to execute a skill,
    including credentials, cached data, and session information.
    """
    # Organization context
    org_name: str
    org_id: str
    org_type: str

    # Credentials (securely passed at runtime)
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    base_url: Optional[str] = None

    # Pre-loaded cached data for quick responses
    cached_networks: List[Dict[str, Any]] = field(default_factory=list)
    cached_devices: List[Dict[str, Any]] = field(default_factory=list)
    cached_sites: List[Dict[str, Any]] = field(default_factory=list)

    # Session/conversation context
    session_id: Optional[str] = None
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None

    # Previous turn context for multi-turn conversations
    previous_artifacts: List[CollaborationArtifact] = field(default_factory=list)
    entities_from_previous_turns: Dict[str, Any] = field(default_factory=dict)

    # Execution flags
    allow_modifications: bool = False  # Edit mode flag
    verbose: bool = False  # Detailed logging

    def has_cached_data(self) -> bool:
        """Check if context has any cached data."""
        return bool(self.cached_networks or self.cached_devices or self.cached_sites)

    def get_network_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find a network by name in cached data."""
        for network in self.cached_networks:
            if network.get("name", "").lower() == name.lower():
                return network
        return None

    def get_network_by_id(self, network_id: str) -> Optional[Dict[str, Any]]:
        """Find a network by ID in cached data."""
        for network in self.cached_networks:
            if network.get("id") == network_id:
                return network
        return None

    def get_device_by_serial(self, serial: str) -> Optional[Dict[str, Any]]:
        """Find a device by serial in cached data."""
        for device in self.cached_devices:
            if device.get("serial") == serial:
                return device
        return None


@dataclass
class SkillResult:
    """Result from executing a specialist skill."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    artifacts: List[CollaborationArtifact] = field(default_factory=list)
    entities_extracted: Dict[str, Any] = field(default_factory=dict)
    suggested_follow_up: Optional[str] = None
    duration_ms: int = 0
    # Token usage tracking (populated when AI services are used)
    input_tokens: int = 0
    output_tokens: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "entities_extracted": self.entities_extracted,
            "suggested_follow_up": self.suggested_follow_up,
            "duration_ms": self.duration_ms,
            "artifact_count": len(self.artifacts),
            "usage": {
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
            },
        }


class BaseSpecialistAgent(ABC):
    """Abstract base class for specialist agents.

    Specialist agents wrap specific API services and provide
    domain-specific skills to the orchestrator. Each specialist:

    1. Defines its skills with tags for routing
    2. Registers with the A2A registry
    3. Executes skills when routed by the orchestrator
    4. Returns structured results with artifacts

    Subclasses must implement:
    - AGENT_ID, AGENT_NAME, AGENT_ROLE class attributes
    - get_skills() - define available skills
    - execute_skill() - execute a specific skill

    Example:
        class MerakiAgent(BaseSpecialistAgent):
            AGENT_ID = "meraki-agent"
            AGENT_NAME = "Meraki Network Specialist"
            AGENT_ROLE = "meraki-specialist"

            def get_skills(self) -> List[AgentSkill]:
                return [
                    AgentSkill(
                        id="list_networks",
                        name="List Networks",
                        description="List all networks in an organization",
                        tags=["meraki", "networks", "list"],
                        examples=["Show me my Meraki networks", "List networks"]
                    ),
                ]
    """

    # Subclasses must define these
    AGENT_ID: str = "base-specialist"
    AGENT_NAME: str = "Base Specialist"
    AGENT_ROLE: str = "specialist"
    AGENT_DESCRIPTION: str = "Base specialist agent"

    def __init__(self):
        """Initialize the specialist agent."""
        self._registered = False
        self._api_client = None
        self._skills: Dict[str, AgentSkill] = {}

        # Build skills index
        for skill in self.get_skills():
            self._skills[skill.id] = skill

    @abstractmethod
    def get_skills(self) -> List[AgentSkill]:
        """Get the list of skills this agent provides.

        Returns:
            List of AgentSkill objects with tags for routing
        """
        pass

    @abstractmethod
    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a specific skill with the given parameters.

        Args:
            skill_id: ID of the skill to execute
            params: Parameters for the skill (from routing/query parsing)
            context: Execution context with credentials and cached data

        Returns:
            SkillResult with data, artifacts, and extracted entities
        """
        pass

    def get_agent_card(self) -> AgentCard:
        """Build the AgentCard for this specialist.

        Returns:
            AgentCard with skills, capabilities, and metadata
        """
        return AgentCard(
            id=self.AGENT_ID,
            name=self.AGENT_NAME,
            description=self.AGENT_DESCRIPTION,
            protocolVersion="0.3",
            provider=AgentProvider(
                organization="Lumen",
                url="https://lumen.local"
            ),
            capabilities=AgentCapabilities(
                streaming=True,
                pushNotifications=False,
                stateTransitionHistory=True,
            ),
            skills=self.get_skills(),
            interfaces=[
                AgentInterface(
                    protocol="jsonrpc/2.0",
                    url=f"/a2a/agents/{self.AGENT_ID}"
                )
            ],
            role=self.AGENT_ROLE,
            priority=getattr(self, 'AGENT_PRIORITY', 5),  # Use agent-specific priority or default to 5
        )

    async def handle_message(self, message: A2AMessage, context: AgentExecutionContext) -> A2AMessage:
        """Handle an A2A message from the orchestrator.

        This is the main entry point for messages from the orchestrator.
        It parses the message, determines the skill to use, and returns a response.

        Args:
            message: The incoming A2A message
            context: Execution context

        Returns:
            Response A2A message with results
        """
        # Extract text content from message
        query = ""
        params = {}
        requested_skill = None

        for part in message.parts:
            if isinstance(part, TextPart):
                query = part.text
            elif isinstance(part, DataPart):
                data = part.data
                params = data.get("params", {})
                requested_skill = data.get("skill_id")

        # If skill was explicitly requested, use it
        if requested_skill and requested_skill in self._skills:
            skill_id = requested_skill
        else:
            # Route to best matching skill based on query
            skill_id = self._route_to_skill(query)

        if not skill_id:
            return self._create_error_response(
                message.messageId,
                f"No matching skill found for query: {query[:100]}"
            )

        # Execute the skill
        logger.info(f"[{self.AGENT_NAME}] Executing skill: {skill_id}")
        logger.info(f"[{self.AGENT_NAME}] Params: {params}")
        start_time = datetime.utcnow()

        try:
            result = await self.execute_skill(skill_id, params, context)
            result.duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.info(f"[{self.AGENT_NAME}] Skill completed: success={result.success}, data_type={type(result.data).__name__}, duration={result.duration_ms}ms")
            if result.error:
                logger.warning(f"[{self.AGENT_NAME}] Skill returned error: {result.error}")
        except Exception as e:
            import traceback
            logger.error(f"[{self.AGENT_NAME}] Skill execution error: {e}")
            logger.error(f"[{self.AGENT_NAME}] Traceback:\n{traceback.format_exc()}")
            result = SkillResult(
                success=False,
                error=str(e),
                duration_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
            )

        # Build response message
        logger.info(f"[{self.AGENT_NAME}] Building response message...")
        try:
            response = self._create_response(message.messageId, skill_id, result)
            logger.info(f"[{self.AGENT_NAME}] Response created: {len(response.parts)} parts")
            return response
        except Exception as e:
            import traceback
            logger.error(f"[{self.AGENT_NAME}] Error creating response: {e}")
            logger.error(f"[{self.AGENT_NAME}] Traceback:\n{traceback.format_exc()}")
            raise

    def _route_to_skill(self, query: str) -> Optional[str]:
        """Route a query to the best matching skill.

        Uses simple keyword matching on skill tags and examples.
        The orchestrator should do primary routing; this is a fallback.

        Args:
            query: The user's query text

        Returns:
            Skill ID or None if no match
        """
        query_lower = query.lower()
        best_skill = None
        best_score = 0

        for skill_id, skill in self._skills.items():
            score = 0

            # Check tags
            for tag in skill.tags:
                if tag.lower() in query_lower:
                    score += 1

            # Check examples
            for example in skill.examples:
                example_words = set(example.lower().split())
                query_words = set(query_lower.split())
                overlap = len(example_words & query_words)
                score += overlap * 0.5

            # Check skill name/description
            if skill.name.lower() in query_lower:
                score += 2

            if score > best_score:
                best_score = score
                best_skill = skill_id

        return best_skill if best_score > 0 else None

    def _create_response(
        self,
        in_reply_to: str,
        skill_id: str,
        result: SkillResult
    ) -> A2AMessage:
        """Create an A2A response message."""
        logger.info(f"[{self.AGENT_NAME}] _create_response: skill={skill_id}, result_type={type(result).__name__}")
        logger.info(f"[{self.AGENT_NAME}] _create_response: result.success={result.success}")
        logger.info(f"[{self.AGENT_NAME}] _create_response: result.data type={type(result.data).__name__}")

        parts = []

        # Add data part with structured result
        logger.info(f"[{self.AGENT_NAME}] _create_response: calling result.to_dict()...")
        result_dict = result.to_dict()
        logger.info(f"[{self.AGENT_NAME}] _create_response: result_dict keys={list(result_dict.keys())}")

        logger.info(f"[{self.AGENT_NAME}] _create_response: accessing result.input_tokens={result.input_tokens}")
        logger.info(f"[{self.AGENT_NAME}] _create_response: accessing result.output_tokens={result.output_tokens}")

        parts.append(DataPart(data={
            "skill_id": skill_id,
            "result": result_dict,
            "data": result.data,
            "usage": {
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
            },
        }))

        # Add text summary
        if result.success:
            summary = self._generate_text_summary(skill_id, result)
        else:
            summary = f"Error executing {skill_id}: {result.error}"

        parts.append(TextPart(text=summary))

        return A2AMessage(
            role="agent",
            parts=parts,
            sourceAgentId=self.AGENT_ID,
            context={
                "in_reply_to": in_reply_to,
                "skill_id": skill_id,
                "success": result.success,
                "entities_extracted": result.entities_extracted,
                "suggested_follow_up": result.suggested_follow_up,
                "usage": {
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                },
            }
        )

    def _create_error_response(self, in_reply_to: str, error: str) -> A2AMessage:
        """Create an error response message."""
        return A2AMessage(
            role="agent",
            parts=[
                TextPart(text=f"Error: {error}"),
                DataPart(data={"success": False, "error": error})
            ],
            sourceAgentId=self.AGENT_ID,
            context={"in_reply_to": in_reply_to, "success": False}
        )

    def _generate_text_summary(self, skill_id: str, result: SkillResult) -> str:
        """Generate a human-readable summary of the result.

        Subclasses can override for custom formatting.
        """
        if not result.success:
            return f"Failed to execute {skill_id}: {result.error}"

        data = result.data
        if isinstance(data, list):
            return f"Found {len(data)} items."
        elif isinstance(data, dict):
            if "count" in data:
                return f"Found {data['count']} items."
            return f"Retrieved data with {len(data)} fields."
        else:
            return f"Operation completed successfully."

    def create_artifact(
        self,
        artifact_type: ArtifactType,
        data: Dict[str, Any],
        session_id: str,
        target_agent: Optional[str] = None
    ) -> CollaborationArtifact:
        """Create a collaboration artifact from skill results.

        Args:
            artifact_type: Type of artifact
            data: Artifact data
            session_id: Session ID for tracking
            target_agent: Specific agent to target (None = broadcast)

        Returns:
            CollaborationArtifact ready for the artifact store
        """
        artifact = CollaborationArtifact(
            id=f"{self.AGENT_ID}_{artifact_type.value}_{uuid.uuid4().hex[:8]}",
            artifact_type=artifact_type,
            source_agent=self.AGENT_ID,
            target_agent=target_agent,
            data=data,
        )

        # Auto-add to artifact store if session_id provided
        if session_id:
            store = get_artifact_store()
            store.add_artifact(session_id, artifact)

        return artifact

    def extract_entities(self, data: Any) -> Dict[str, Any]:
        """Extract entities from result data for follow-up queries.

        Entities are things like network IDs, device serials, site names
        that can be referenced in subsequent turns.

        Args:
            data: Result data to extract from

        Returns:
            Dict of entity types to lists of entity values
        """
        entities: Dict[str, List[Any]] = {
            "network_ids": [],
            "network_names": [],
            "device_serials": [],
            "device_names": [],
            "site_ids": [],
            "site_names": [],
            "alert_ids": [],
            "test_ids": [],
        }

        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    self._extract_from_item(item, entities)
        elif isinstance(data, dict):
            self._extract_from_item(data, entities)

        # Remove empty lists
        return {k: v for k, v in entities.items() if v}

    def _extract_from_item(self, item: Dict[str, Any], entities: Dict[str, List[Any]]) -> None:
        """Extract entities from a single data item."""
        # Network entities
        if "networkId" in item or "network_id" in item:
            entities["network_ids"].append(item.get("networkId") or item.get("network_id"))
        if "name" in item and "networkId" in item:
            entities["network_names"].append(item["name"])

        # Device entities
        if "serial" in item:
            entities["device_serials"].append(item["serial"])
        if "name" in item and "serial" in item:
            entities["device_names"].append(item["name"])

        # Site entities
        if "siteId" in item or "site_id" in item:
            entities["site_ids"].append(item.get("siteId") or item.get("site_id"))
        if "siteName" in item or "site_name" in item:
            entities["site_names"].append(item.get("siteName") or item.get("site_name"))

        # Alert/Test entities
        if "alertId" in item or "alert_id" in item:
            entities["alert_ids"].append(item.get("alertId") or item.get("alert_id"))
        if "testId" in item or "test_id" in item:
            entities["test_ids"].append(item.get("testId") or item.get("test_id"))

    def register(self) -> None:
        """Register this agent with the A2A registry."""
        if self._registered:
            logger.warning(f"[{self.AGENT_NAME}] Already registered")
            return

        registry = get_agent_registry()
        registry.register(
            card=self.get_agent_card(),
            handler=self.handle_message
        )

        self._registered = True
        logger.info(f"[{self.AGENT_NAME}] Registered with A2A registry")
        logger.info(f"[{self.AGENT_NAME}] Skills: {list(self._skills.keys())}")

    def unregister(self) -> None:
        """Unregister this agent from the A2A registry."""
        if not self._registered:
            return

        registry = get_agent_registry()
        registry.unregister(self.AGENT_ID)

        self._registered = False
        logger.info(f"[{self.AGENT_NAME}] Unregistered from A2A registry")

    @property
    def is_registered(self) -> bool:
        """Check if agent is registered."""
        return self._registered

    def get_skill(self, skill_id: str) -> Optional[AgentSkill]:
        """Get a skill by ID."""
        return self._skills.get(skill_id)

    def list_skill_ids(self) -> List[str]:
        """Get list of all skill IDs."""
        return list(self._skills.keys())


# ============================================================================
# Smart Agent Mixins
# ============================================================================
# These mixins provide reusable intelligent behaviors extracted from
# the Splunk agent implementation. Other agents can inherit these to get
# smart time handling, positive framing, and contextual suggestions.
# ============================================================================


class TimeRangeAwareMixin:
    """Mixin for agents that support time-based queries.

    Provides:
    - Natural language time inference ("recent" -> "-24h")
    - Automatic time range expansion when no data found
    - Human-readable time descriptions

    Usage:
        class MyAgent(BaseSpecialistAgent, TimeRangeAwareMixin):
            async def _search_data(self, params, context):
                time_range = self.infer_time_range(query, params.get("time_range"))
                data, actual_range, note = await self.search_with_expansion(
                    fetch_func=self._fetch_api_data,
                    initial_range=time_range,
                    context=context,
                )
    """

    # Natural language to time range mapping
    TIME_RANGE_MAPPINGS = {
        "recent": "-24h",
        "recently": "-24h",
        "today": "-24h",
        "now": "-1h",
        "current": "-1h",
        "last hour": "-1h",
        "past hour": "-1h",
        "last few hours": "-4h",
        "yesterday": "-48h",
        "this week": "-7d",
        "last week": "-7d",
        "past week": "-7d",
        "this month": "-30d",
        "last month": "-30d",
        "past month": "-30d",
    }

    # Time range expansion ladder - try progressively broader ranges
    TIME_RANGE_EXPANSION = [
        ("-1h", "last hour"),
        ("-4h", "last 4 hours"),
        ("-24h", "last 24 hours"),
        ("-7d", "last 7 days"),
        ("-30d", "last 30 days"),
    ]

    def infer_time_range(
        self,
        query: str,
        specified_range: Optional[str] = None,
        default: str = "-24h"
    ) -> str:
        """Infer the best time range from natural language in the query.

        Args:
            query: The user's query text
            specified_range: Explicitly specified time range (takes precedence)
            default: Default time range if nothing can be inferred

        Returns:
            Time range specification like '-24h' or '-7d'
        """
        if specified_range:
            return specified_range

        query_lower = query.lower()

        # Check for natural language time references
        for phrase, time_spec in self.TIME_RANGE_MAPPINGS.items():
            if phrase in query_lower:
                logger.info(
                    f"[TimeRangeAwareMixin] Inferred time range '{time_spec}' "
                    f"from phrase '{phrase}'"
                )
                return time_spec

        # Default to provided default
        return default

    async def search_with_expansion(
        self,
        fetch_func: Callable[..., Awaitable[List[Any]]],
        initial_range: str,
        auto_expand: bool = True,
        max_expansion_levels: int = 3,
        **fetch_kwargs
    ) -> tuple[List[Any], str, Optional[str]]:
        """Search with automatic time range expansion if no results.

        Args:
            fetch_func: Async function that fetches data, must accept 'time_range' kwarg
            initial_range: Starting time range specification
            auto_expand: Whether to expand time range if no results
            max_expansion_levels: Maximum expansion levels to try
            **fetch_kwargs: Additional kwargs passed to fetch_func

        Returns:
            Tuple of (results, actual_time_range_used, expansion_note_or_none)

        Example:
            async def _fetch_alerts(self, time_range, context):
                return await self.api.get_alerts(earliest=time_range)

            data, actual_range, note = await self.search_with_expansion(
                fetch_func=self._fetch_alerts,
                initial_range="-24h",
                context=context
            )
        """
        # Try initial range
        try:
            results = await fetch_func(time_range=initial_range, **fetch_kwargs)
        except Exception as e:
            logger.error(f"[TimeRangeAwareMixin] Initial fetch failed: {e}")
            results = []

        if results:
            return results, initial_range, None

        if not auto_expand:
            return [], initial_range, None

        # Try progressively broader time ranges
        tried_ranges = {initial_range}
        expansion_count = 0

        for time_spec, description in self.TIME_RANGE_EXPANSION:
            if time_spec in tried_ranges:
                continue

            if expansion_count >= max_expansion_levels:
                break

            logger.info(
                f"[TimeRangeAwareMixin] No results in {initial_range}, "
                f"trying {description}..."
            )

            try:
                results = await fetch_func(time_range=time_spec, **fetch_kwargs)
            except Exception as e:
                logger.warning(f"[TimeRangeAwareMixin] Expansion fetch failed: {e}")
                results = []

            if results:
                expansion_note = (
                    f"No events in {initial_range}. "
                    f"Showing events from {description}."
                )
                logger.info(
                    f"[TimeRangeAwareMixin] Found {len(results)} results "
                    f"after expanding to {description}"
                )
                return results, time_spec, expansion_note

            tried_ranges.add(time_spec)
            expansion_count += 1

        # No results even after expansion
        return [], initial_range, None

    def get_time_range_description(self, time_spec: str) -> str:
        """Get human-readable description for a time range spec.

        Args:
            time_spec: Time specification like '-24h' or '-7d'

        Returns:
            Human-readable description like 'last 24 hours'
        """
        for spec, description in self.TIME_RANGE_EXPANSION:
            if spec == time_spec:
                return description

        # Parse custom time specs
        if time_spec.endswith("h"):
            hours = time_spec.lstrip("-").rstrip("h")
            return f"last {hours} hours"
        elif time_spec.endswith("d"):
            days = time_spec.lstrip("-").rstrip("d")
            return f"last {days} days"
        elif time_spec.endswith("m"):
            minutes = time_spec.lstrip("-").rstrip("m")
            return f"last {minutes} minutes"

        return time_spec


class SmartResponseMixin:
    """Mixin for intelligent 'no data' handling and response framing.

    Provides:
    - Contextual suggestions when no data found
    - Positive framing for absence of problems
    - Domain-specific helpful messages

    Usage:
        class MyAgent(BaseSpecialistAgent, SmartResponseMixin):
            async def _get_alerts(self, params, context):
                alerts = await self.api.get_alerts()
                if not alerts:
                    return SkillResult(
                        success=True,
                        data={"alerts": [], "count": 0},
                        suggested_follow_up=self.frame_positive_absence(
                            domain="security",
                            result_type="alerts"
                        )
                    )
    """

    # Domain-specific positive framing messages
    POSITIVE_ABSENCE_MESSAGES = {
        ("security", "alerts"): "No security alerts detected - this is a positive indicator of healthy operations.",
        ("security", "events"): "No security events detected - your environment appears secure.",
        ("security", "threats"): "No threats detected - security posture looks healthy.",
        ("network", "issues"): "No network issues detected - all systems operating normally.",
        ("network", "errors"): "No network errors detected - connectivity appears healthy.",
        ("monitoring", "alerts"): "No monitoring alerts - all monitored services are healthy.",
        ("monitoring", "failures"): "No test failures detected - monitoring shows healthy status.",
        ("devices", "offline"): "No offline devices detected - all devices are operational.",
        ("devices", "issues"): "No device issues detected - infrastructure is healthy.",
    }

    # Domain-specific suggestions when no data found
    NO_DATA_SUGGESTIONS = {
        "security": [
            "Try a broader time range (e.g., last 7 days)",
            "Verify the security indexes are receiving data",
            "Check if log forwarding is configured correctly",
        ],
        "network": [
            "Try a different network or organization",
            "Verify the devices are online and reporting",
            "Check if the API credentials have correct permissions",
        ],
        "monitoring": [
            "Try a broader time range",
            "Verify the monitoring agents are active",
            "Check if tests are configured and running",
        ],
        "devices": [
            "Try searching across all networks",
            "Check if the device name/serial is correct",
            "Verify the organization has devices configured",
        ],
        "general": [
            "Try a broader search criteria",
            "Verify the data source is available",
            "Check if you have access to this resource",
        ],
    }

    def frame_positive_absence(
        self,
        domain: str,
        result_type: str,
        custom_message: Optional[str] = None
    ) -> str:
        """Frame the absence of results positively when appropriate.

        For situations where no results is actually good news (no errors,
        no security alerts, no issues), this provides positive messaging.

        Args:
            domain: The domain area (security, network, monitoring, devices)
            result_type: Type of result (alerts, errors, issues, etc.)
            custom_message: Optional custom message to use instead

        Returns:
            Positive framing message
        """
        if custom_message:
            return custom_message

        key = (domain.lower(), result_type.lower())
        if key in self.POSITIVE_ABSENCE_MESSAGES:
            return self.POSITIVE_ABSENCE_MESSAGES[key]

        # Fallback to generic positive message
        return f"No {result_type} found - this may indicate healthy operations."

    def generate_no_data_response(
        self,
        query: str,
        domain: str,
        searched_params: Optional[Dict[str, Any]] = None,
        include_positive_framing: bool = False
    ) -> str:
        """Generate helpful suggestions when no data is found.

        Args:
            query: The original user query
            domain: The domain area (security, network, monitoring, etc.)
            searched_params: Parameters that were searched (for context)
            include_positive_framing: Whether to include positive framing

        Returns:
            Formatted suggestions string with helpful guidance
        """
        suggestions = []

        # Header
        if searched_params and searched_params.get("time_range"):
            time_desc = searched_params.get("time_range", "the specified time range")
            suggestions.append(f"No results found for the specified search in {time_desc}.")
        else:
            suggestions.append("No results found for the specified search.")

        suggestions.append("")

        # Positive framing if appropriate
        if include_positive_framing:
            # Check if this is a "problems" type query
            problem_keywords = ["error", "fail", "issue", "alert", "threat", "problem"]
            if any(kw in query.lower() for kw in problem_keywords):
                suggestions.append("**Note:** The absence of results may actually be good news!")
                suggestions.append("")

        # Domain-specific suggestions
        suggestions.append("**Suggestions:**")
        domain_lower = domain.lower()
        domain_suggestions = self.NO_DATA_SUGGESTIONS.get(
            domain_lower,
            self.NO_DATA_SUGGESTIONS["general"]
        )

        for suggestion in domain_suggestions:
            suggestions.append(f"- {suggestion}")

        # Add query-specific suggestions
        query_lower = query.lower()
        if "index" in query_lower or "source" in query_lower:
            suggestions.append("- Verify the specified index/source exists and has data")
        if "device" in query_lower or "serial" in query_lower:
            suggestions.append("- Check if the device name or serial number is correct")
        if "network" in query_lower:
            suggestions.append("- Try listing available networks first")

        return "\n".join(suggestions)

    def create_smart_empty_result(
        self,
        domain: str,
        result_type: str,
        query: str,
        searched_params: Optional[Dict[str, Any]] = None,
        is_problem_search: bool = False
    ) -> Dict[str, Any]:
        """Create a smart result for empty data scenarios.

        Instead of returning just an empty list, returns structured data
        with helpful context, suggestions, and appropriate framing.

        Args:
            domain: The domain area (security, network, monitoring)
            result_type: Type of result (alerts, devices, events)
            query: Original query for context
            searched_params: Parameters that were searched
            is_problem_search: Whether searching for problems (errors, alerts)

        Returns:
            Dictionary with structured empty result and helpful metadata
        """
        result = {
            "data": [],
            "count": 0,
            "searched_params": searched_params or {},
        }

        if is_problem_search:
            # Positive framing for problem searches
            result["note"] = self.frame_positive_absence(domain, result_type)
            result["status"] = "healthy"
        else:
            # Helpful suggestions for general searches
            result["suggestions"] = self.generate_no_data_response(
                query=query,
                domain=domain,
                searched_params=searched_params,
                include_positive_framing=False
            )

        return result


class CacheableAgentMixin:
    """Mixin for agents with inference caching support.

    Provides simple in-memory caching for expensive operations like
    API calls or AI inferences, reducing repeated calls.

    Usage:
        class MyAgent(BaseSpecialistAgent, CacheableAgentMixin):
            def __init__(self):
                super().__init__()
                self.init_cache()  # Initialize cache

            async def get_expensive_data(self, key):
                cached = self.get_cached(f"data:{key}")
                if cached:
                    return cached
                result = await self._fetch_expensive_data(key)
                self.set_cached(f"data:{key}", result)
                return result
    """

    def init_cache(self, ttl_seconds: int = 300):
        """Initialize the cache. Call this in __init__.

        Args:
            ttl_seconds: Time-to-live for cache entries (default 5 minutes)
        """
        self._inference_cache: Dict[str, tuple[Any, datetime]] = {}
        self._cache_ttl = ttl_seconds

    def get_cached(self, key: str) -> Optional[Any]:
        """Get a cached value if not expired.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        if not hasattr(self, "_inference_cache"):
            return None

        if key not in self._inference_cache:
            return None

        value, timestamp = self._inference_cache[key]
        age_seconds = (datetime.utcnow() - timestamp).total_seconds()

        if age_seconds > self._cache_ttl:
            # Expired
            del self._inference_cache[key]
            return None

        return value

    def set_cached(self, key: str, value: Any) -> None:
        """Set a cached value.

        Args:
            key: Cache key
            value: Value to cache
        """
        if not hasattr(self, "_inference_cache"):
            self.init_cache()

        self._inference_cache[key] = (value, datetime.utcnow())

    def clear_cache(self, prefix: Optional[str] = None) -> int:
        """Clear cache entries.

        Args:
            prefix: Optional prefix to clear only matching keys

        Returns:
            Number of entries cleared
        """
        if not hasattr(self, "_inference_cache"):
            return 0

        if prefix is None:
            count = len(self._inference_cache)
            self._inference_cache.clear()
            return count

        keys_to_delete = [k for k in self._inference_cache if k.startswith(prefix)]
        for key in keys_to_delete:
            del self._inference_cache[key]
        return len(keys_to_delete)

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        if not hasattr(self, "_inference_cache"):
            return {"entries": 0, "ttl_seconds": 0}

        now = datetime.utcnow()
        valid_count = 0
        expired_count = 0

        for key, (value, timestamp) in self._inference_cache.items():
            age = (now - timestamp).total_seconds()
            if age <= self._cache_ttl:
                valid_count += 1
            else:
                expired_count += 1

        return {
            "entries": len(self._inference_cache),
            "valid": valid_count,
            "expired": expired_count,
            "ttl_seconds": self._cache_ttl,
        }
