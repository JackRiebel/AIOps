"""A2A Conversation Memory - tracks context across multi-turn conversations.

This module provides:
1. Conversation memory for tracking discussed entities (networks, devices, etc.)
2. Query intent classification for more nuanced routing
3. Response quality feedback tracking for improving routing decisions
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum
import re

logger = logging.getLogger(__name__)


class QueryIntent(str, Enum):
    """Classified intents for user queries."""
    # Knowledge-seeking intents
    BEST_PRACTICES = "best_practices"      # "How should I...", "What's the best way..."
    TROUBLESHOOTING = "troubleshooting"    # "Why is...", "Not working", "Debug"
    CONFIGURATION = "configuration"        # "How do I configure...", "Set up"
    EXPLANATION = "explanation"            # "What is...", "Explain..."

    # Action intents
    STATUS_CHECK = "status_check"          # "Show me...", "List...", "What devices..."
    MODIFICATION = "modification"          # "Create...", "Update...", "Delete..."
    COMPARISON = "comparison"              # "Compare...", "Difference between..."
    AUDIT = "audit"                        # "Check compliance...", "Security scan..."
    ANALYSIS = "analysis"                  # "Analyze...", "Report on..."

    # Meta intents
    FOLLOW_UP = "follow_up"                # Continuation of previous topic
    CLARIFICATION = "clarification"        # "What do you mean...", "Can you explain..."
    UNKNOWN = "unknown"


@dataclass
class EntityMention:
    """Tracks a mentioned entity (network, device, etc.)."""
    entity_type: str  # "network", "device", "vlan", "ssid", "client"
    name: str
    id: Optional[str] = None
    mentioned_at: datetime = field(default_factory=datetime.utcnow)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConversationContext:
    """Stores context for a conversation session."""
    session_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)

    # Entity memory - what has been discussed
    mentioned_entities: List[EntityMention] = field(default_factory=list)

    # Last known state
    current_network: Optional[EntityMention] = None
    current_device: Optional[EntityMention] = None

    # Intent tracking
    last_intent: Optional[QueryIntent] = None
    intent_history: List[Tuple[QueryIntent, datetime]] = field(default_factory=list)

    # Topics discussed
    topics: List[str] = field(default_factory=list)  # e.g., "security", "vlans", "ssids"


@dataclass
class RoutingFeedback:
    """Feedback on a routing decision for learning."""
    query: str
    intent: QueryIntent
    primary_agent_id: str
    secondary_agent_ids: List[str]
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # Outcome
    success: Optional[bool] = None
    user_feedback: Optional[str] = None  # "helpful", "not_helpful", "wrong_agent"
    response_quality_score: Optional[float] = None  # 0.0 - 1.0


class ConversationMemory:
    """Manages conversation context across sessions.

    Provides:
    - Entity memory (networks, devices, VLANs mentioned)
    - Context carryover (remember what was discussed)
    - Reference resolution ("that network", "the device")
    """

    def __init__(self, session_timeout_minutes: int = 30):
        self._sessions: Dict[str, ConversationContext] = {}
        self._session_timeout = timedelta(minutes=session_timeout_minutes)
        # Global state for follow-up context (used when no session is specified)
        self._global_current_network: Optional[str] = None
        self._global_current_device: Optional[str] = None
        self._global_topics: List[str] = []
        self._global_intent_history: List[Dict[str, Any]] = []
        self._global_last_agent: Optional[str] = None

    def get_or_create_session(self, session_id: str) -> ConversationContext:
        """Get existing session or create new one."""
        self._cleanup_expired_sessions()

        if session_id not in self._sessions:
            self._sessions[session_id] = ConversationContext(session_id=session_id)
            logger.info(f"[A2A Memory] Created new session: {session_id}")
        else:
            self._sessions[session_id].last_activity = datetime.utcnow()

        return self._sessions[session_id]

    def record_entity(
        self,
        session_id: str,
        entity_type: str,
        name: str,
        entity_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record an entity mentioned in conversation."""
        session = self.get_or_create_session(session_id)

        entity = EntityMention(
            entity_type=entity_type,
            name=name,
            id=entity_id,
            details=details or {}
        )

        session.mentioned_entities.append(entity)

        # Update current focus based on type
        if entity_type == "network":
            session.current_network = entity
        elif entity_type == "device":
            session.current_device = entity

        logger.info(f"[A2A Memory] Recorded {entity_type}: {name} (session: {session_id})")

    def get_current_network(self, session_id: str) -> Optional[EntityMention]:
        """Get the currently focused network for a session."""
        session = self.get_or_create_session(session_id)
        return session.current_network

    def get_current_device(self, session_id: str) -> Optional[EntityMention]:
        """Get the currently focused device for a session."""
        session = self.get_or_create_session(session_id)
        return session.current_device

    def resolve_reference(self, session_id: str, reference: str) -> Optional[EntityMention]:
        """Resolve a reference like 'that network' or 'the device' to an entity.

        Args:
            session_id: The conversation session
            reference: The reference to resolve (e.g., "that network", "the device", "it")

        Returns:
            The referenced entity if found, None otherwise
        """
        session = self.get_or_create_session(session_id)
        reference_lower = reference.lower()

        # Direct type references
        if "network" in reference_lower:
            return session.current_network
        elif "device" in reference_lower or "ap" in reference_lower or "switch" in reference_lower:
            return session.current_device
        elif reference_lower in ("it", "that", "this"):
            # Return most recently mentioned entity
            if session.mentioned_entities:
                return session.mentioned_entities[-1]

        # Search by name in mentioned entities
        for entity in reversed(session.mentioned_entities):
            if reference_lower in entity.name.lower():
                return entity

        return None

    def record_intent(self, session_id: str, intent: QueryIntent) -> None:
        """Record the classified intent for a query."""
        session = self.get_or_create_session(session_id)
        session.last_intent = intent
        session.intent_history.append((intent, datetime.utcnow()))

    def record_topic(self, session_id: str, topic: str) -> None:
        """Record a topic that was discussed."""
        session = self.get_or_create_session(session_id)
        if topic not in session.topics:
            session.topics.append(topic)

    def get_context_summary(self, session_id: str) -> Dict[str, Any]:
        """Get a summary of the conversation context for prompting."""
        session = self.get_or_create_session(session_id)

        summary = {
            "has_context": bool(session.mentioned_entities),
            "current_network": None,
            "current_device": None,
            "recent_entities": [],
            "topics_discussed": session.topics[-5:],  # Last 5 topics
            "last_intent": session.last_intent.value if session.last_intent else None,
        }

        if session.current_network:
            summary["current_network"] = {
                "name": session.current_network.name,
                "id": session.current_network.id,
            }

        if session.current_device:
            summary["current_device"] = {
                "name": session.current_device.name,
                "id": session.current_device.id,
            }

        # Last 5 unique entities
        seen = set()
        for entity in reversed(session.mentioned_entities):
            key = f"{entity.entity_type}:{entity.name}"
            if key not in seen:
                seen.add(key)
                summary["recent_entities"].append({
                    "type": entity.entity_type,
                    "name": entity.name,
                    "id": entity.id,
                })
                if len(summary["recent_entities"]) >= 5:
                    break

        return summary

    def _cleanup_expired_sessions(self) -> None:
        """Remove sessions that have timed out."""
        now = datetime.utcnow()
        expired = [
            sid for sid, session in self._sessions.items()
            if now - session.last_activity > self._session_timeout
        ]
        for sid in expired:
            del self._sessions[sid]
            logger.info(f"[A2A Memory] Expired session: {sid}")

    # =========================================================================
    # Global/Cross-Session Convenience Methods for Orchestrator
    # =========================================================================

    @property
    def current_network(self) -> Optional[str]:
        """Get current network (global context for orchestrator)."""
        return self._global_current_network

    @current_network.setter
    def current_network(self, value: Optional[str]) -> None:
        """Set current network (global context for orchestrator)."""
        self._global_current_network = value

    @property
    def current_device(self) -> Optional[str]:
        """Get current device (global context for orchestrator)."""
        return self._global_current_device

    @current_device.setter
    def current_device(self, value: Optional[str]) -> None:
        """Set current device (global context for orchestrator)."""
        self._global_current_device = value

    @property
    def topics(self) -> List[str]:
        """Get discussed topics (global context for orchestrator)."""
        return self._global_topics

    @property
    def intent_history(self) -> List[Dict[str, Any]]:
        """Get intent history (global context for orchestrator)."""
        return self._global_intent_history

    def get_last_agent(self) -> Optional[str]:
        """Get the last agent that handled a query (global context)."""
        return self._global_last_agent

    def get_last_intent(self) -> Optional[str]:
        """Get the last classified intent (global context)."""
        if self._global_intent_history:
            return self._global_intent_history[-1].get("intent")
        return None

    def get_context_summary(self, session_id: Optional[str] = None) -> str:
        """Get a brief text summary of current conversation context.

        If session_id is provided, uses that session's context.
        Otherwise, uses global context.

        Args:
            session_id: Optional session ID

        Returns:
            Human-readable context summary
        """
        if session_id:
            # Use session-based context
            session = self.get_or_create_session(session_id)
            parts = []
            if session.current_network:
                parts.append(f"network '{session.current_network.name}'")
            if session.current_device:
                parts.append(f"device '{session.current_device.name}'")
            if session.topics:
                parts.append(f"topics: {', '.join(session.topics[-3:])}")
            return "; ".join(parts) if parts else "general inquiry"

        # Use global context
        parts = []
        if self._global_current_network:
            parts.append(f"network '{self._global_current_network}'")
        if self._global_current_device:
            parts.append(f"device '{self._global_current_device}'")
        if self._global_topics:
            parts.append(f"topics: {', '.join(self._global_topics[-3:])}")
        if self._global_intent_history:
            last = self._global_intent_history[-1]
            if "summary" in last:
                parts.append(f"last: {last['summary'][:50]}")

        return "; ".join(parts) if parts else "general inquiry"

    def record_turn(
        self,
        query: str,
        intent: str,
        agent_id: str,
        summary: str,
        session_id: Optional[str] = None
    ) -> None:
        """Record a conversation turn for context tracking.

        Args:
            query: The user's query
            intent: Classified intent
            agent_id: ID of agent that handled it
            summary: Brief summary of the turn
            session_id: Optional session ID
        """
        turn_record = {
            "query": query,
            "intent": intent,
            "agent_id": agent_id,
            "summary": summary,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Update global state
        self._global_intent_history.append(turn_record)
        self._global_last_agent = agent_id

        # Keep only last 20 turns
        if len(self._global_intent_history) > 20:
            self._global_intent_history = self._global_intent_history[-20:]

        # Extract topics from query
        self._extract_topics_from_query(query)

        # If session_id provided, also update session
        if session_id:
            session = self.get_or_create_session(session_id)
            session.intent_history.append((QueryIntent.UNKNOWN, datetime.utcnow()))

        logger.debug(f"[A2A Memory] Recorded turn: agent={agent_id}, intent={intent}")

    def _extract_topics_from_query(self, query: str) -> None:
        """Extract and track topics from a query."""
        query_lower = query.lower()

        topic_keywords = {
            "splunk": ["splunk", "events", "logs", "siem"],
            "meraki": ["meraki", "dashboard", "mx", "mr", "ms"],
            "network": ["network", "networks", "connectivity"],
            "devices": ["device", "devices", "hardware"],
            "security": ["security", "threat", "attack", "firewall"],
            "performance": ["performance", "latency", "bandwidth", "slow"],
            "alerts": ["alert", "alerts", "alarm", "notification"],
            "thousandeyes": ["thousandeyes", "monitoring", "path"],
            "catalyst": ["catalyst", "dnac", "dna center"],
        }

        for topic, keywords in topic_keywords.items():
            if any(kw in query_lower for kw in keywords):
                if topic not in self._global_topics:
                    self._global_topics.append(topic)

        # Keep only last 10 topics
        if len(self._global_topics) > 10:
            self._global_topics = self._global_topics[-10:]

    def clear_global_context(self) -> None:
        """Clear global context (useful for testing or resetting)."""
        self._global_current_network = None
        self._global_current_device = None
        self._global_topics = []
        self._global_intent_history = []
        self._global_last_agent = None
        logger.info("[A2A Memory] Global context cleared")


class IntentClassifier:
    """Classifies user query intents for better routing."""

    # Intent patterns - ordered by priority (STATUS_CHECK FIRST for immediate action)
    INTENT_PATTERNS = {
        # STATUS_CHECK first - simple data requests should be matched immediately
        QueryIntent.STATUS_CHECK: [
            # "get my networks", "show me my devices", "list all clients"
            r"(?:show|list|get|display|fetch)\s+(?:me\s+)?(?:my\s+)?(?:the\s+)?(?:all\s+)?(?:meraki\s+)?(?:networks?|devices?|clients?|ssids?|vlans?|switches?|aps?|appliances?)",
            # "what are my networks", "which devices"
            r"(?:what|which)\s+(?:are\s+)?(?:my\s+)?(?:the\s+)?(?:meraki\s+)?(?:networks?|devices?|clients?|ssids?|vlans?)",
            # "show network list", "get device status"
            r"(?:show|list|get|display)\s+(?:me\s+)?(?:the\s+)?(?:network|device|client|ssid|vlan)\s+(?:list|status|info|details?)",
            # "get Riebel Home", "show [network name]" - specific network requests
            r"(?:show|get|display)\s+(?:me\s+)?(?:the\s+)?[A-Z][a-zA-Z0-9\s]+(?:network)?",
            # "how many devices", "are there any clients"
            r"(?:are\s+there\s+any|how\s+many)\s+(?:devices?|clients?|networks?|ssids?|vlans?)",
            # "status of", "health of"
            r"(?:status|health|state)\s+of\s+(?:the\s+)?(?:network|device|client)",
            # "is X online/offline"
            r"(?:is|are)\s+\w+\s+(?:online|offline|up|down)",
            # "network health", "device status"
            r"(?:network|device|client)\s+(?:health|status|overview)",
        ],
        QueryIntent.BEST_PRACTICES: [
            r"(?:what(?:'s| is) the )?best\s+(?:practice|way|approach)",
            r"how\s+should\s+i",
            r"what(?:'s| is)\s+(?:the\s+)?recommend",
            r"what\s+are\s+(?:the\s+)?(?:best|recommended)",
            r"guidelines?\s+for",
            r"standards?\s+for",
        ],
        QueryIntent.TROUBLESHOOTING: [
            r"(?:why\s+is|why\s+does|why\s+can't|why\s+won't)",
            r"not\s+working",
            r"(?:doesn't|does not|isn't|is not)\s+work",
            r"troubleshoot",
            r"debug",
            r"(?:error|issue|problem|fail)",
            r"can't\s+connect",
            r"(?:down|offline|unreachable)",
        ],
        QueryIntent.CONFIGURATION: [
            r"how\s+(?:do\s+i|to|can\s+i)\s+(?:configure|set\s*up|enable|disable)",
            r"configure\s+(?:the|a|my)",
            r"set\s*up\s+(?:the|a|my)",
            r"create\s+(?:a\s+)?(?:new\s+)?(?:vlan|ssid|network|rule)",
        ],
        QueryIntent.EXPLANATION: [
            r"what\s+(?:is|are)\s+(?:a\s+)?(?!the\s+best)",  # "what is/are" but not "what is the best"
            r"explain\s+(?:what|how|why)",
            r"tell\s+me\s+about",
            r"describe\s+(?:the|a)?",
            r"what\s+does\s+\w+\s+mean",
        ],
        QueryIntent.MODIFICATION: [
            r"(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?",
            r"(?:update|change|modify|edit)\s+(?:the\s+)?",
            r"(?:delete|remove|disable)\s+(?:the\s+)?",
            r"(?:enable|turn\s+on)",
            r"(?:rename|move)",
        ],
        QueryIntent.COMPARISON: [
            r"compare\s+(?:the\s+)?",
            r"(?:difference|differences)\s+between",
            r"(?:which\s+is|what's)\s+(?:better|faster|more)",
            r"(?:versus|vs\.?)\s+",
        ],
        QueryIntent.AUDIT: [
            r"(?:security\s+)?audit",
            r"(?:check|verify)\s+(?:compliance|security)",
            r"(?:scan|assess)\s+(?:the\s+)?(?:network|security)",
            r"compliance\s+(?:check|report|status)",
            r"(?:vulnerabilities|risks|threats)",
        ],
        QueryIntent.ANALYSIS: [
            r"analyze\s+(?:the\s+)?",
            r"(?:report|summary)\s+(?:on|of|for)",
            r"(?:trends?|patterns?)\s+(?:in|for)",
            r"(?:statistics|stats|metrics)\s+(?:for|on)",
        ],
        QueryIntent.FOLLOW_UP: [
            r"^(?:and|also|what\s+about|how\s+about)",
            r"^(?:can\s+you\s+also|additionally)",
            r"^(?:now|next|then)\s+",
        ],
        QueryIntent.CLARIFICATION: [
            r"what\s+do\s+you\s+mean",
            r"can\s+you\s+(?:explain|clarify)",
            r"(?:i\s+don't|didn't)\s+understand",
            r"(?:be\s+)?more\s+specific",
        ],
    }

    # Topic extraction patterns
    TOPIC_PATTERNS = {
        "security": [r"secur", r"firewall", r"acl", r"threat", r"attack", r"vpn"],
        "vlans": [r"vlan", r"segment", r"subnet"],
        "wireless": [r"wifi", r"wireless", r"ssid", r"ap\b", r"access\s*point"],
        "switching": [r"switch", r"port", r"trunk", r"spanning"],
        "routing": [r"route", r"routing", r"bgp", r"ospf", r"gateway"],
        "clients": [r"client", r"user", r"device\s+connect"],
        "performance": [r"performance", r"latency", r"bandwidth", r"speed", r"slow"],
        "monitoring": [r"monitor", r"alert", r"status", r"health"],
    }

    def classify(self, query: str, context: Optional[ConversationContext] = None) -> QueryIntent:
        """Classify the intent of a user query.

        Args:
            query: The user's query text
            context: Optional conversation context for follow-up detection

        Returns:
            The classified QueryIntent
        """
        query_lower = query.lower().strip()

        # Check each intent pattern
        for intent, patterns in self.INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query_lower, re.IGNORECASE):
                    logger.debug(f"[IntentClassifier] Matched intent {intent.value} with pattern: {pattern}")
                    return intent

        # Check for follow-up based on context
        if context and context.last_intent:
            # Short queries after a previous intent are likely follow-ups
            if len(query.split()) <= 5:
                return QueryIntent.FOLLOW_UP

        return QueryIntent.UNKNOWN

    def extract_topics(self, query: str) -> List[str]:
        """Extract discussion topics from a query."""
        query_lower = query.lower()
        topics = []

        for topic, patterns in self.TOPIC_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query_lower, re.IGNORECASE):
                    topics.append(topic)
                    break

        return topics


class RoutingFeedbackTracker:
    """Tracks routing decision outcomes for learning.

    Stores feedback on routing decisions to help improve future routing.
    Can be used to:
    - Track which agents handle which intents best
    - Identify patterns in successful/unsuccessful routing
    - Adjust agent priorities based on historical performance
    """

    def __init__(self, max_history: int = 1000):
        self._history: List[RoutingFeedback] = []
        self._max_history = max_history
        self._agent_scores: Dict[str, Dict[str, List[float]]] = defaultdict(
            lambda: defaultdict(list)
        )  # agent_id -> intent -> scores

    def record_routing(
        self,
        query: str,
        intent: QueryIntent,
        primary_agent_id: str,
        secondary_agent_ids: Optional[List[str]] = None
    ) -> RoutingFeedback:
        """Record a routing decision for later feedback."""
        feedback = RoutingFeedback(
            query=query,
            intent=intent,
            primary_agent_id=primary_agent_id,
            secondary_agent_ids=secondary_agent_ids or []
        )

        self._history.append(feedback)

        # Trim history if needed
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        return feedback

    def record_feedback(
        self,
        feedback: RoutingFeedback,
        success: bool,
        quality_score: Optional[float] = None,
        user_feedback: Optional[str] = None
    ) -> None:
        """Record feedback on a routing decision."""
        feedback.success = success
        feedback.response_quality_score = quality_score
        feedback.user_feedback = user_feedback

        # Update agent scores
        if quality_score is not None:
            self._agent_scores[feedback.primary_agent_id][feedback.intent.value].append(
                quality_score
            )

        logger.info(
            f"[A2A Feedback] Recorded: intent={feedback.intent.value}, "
            f"agent={feedback.primary_agent_id}, success={success}, score={quality_score}"
        )

    def get_agent_performance(self, agent_id: str) -> Dict[str, float]:
        """Get average performance scores by intent for an agent."""
        if agent_id not in self._agent_scores:
            return {}

        return {
            intent: sum(scores) / len(scores) if scores else 0.0
            for intent, scores in self._agent_scores[agent_id].items()
        }

    def get_best_agent_for_intent(self, intent: QueryIntent) -> Optional[str]:
        """Get the best performing agent for a given intent based on history."""
        intent_key = intent.value
        best_agent = None
        best_score = 0.0

        for agent_id, intents in self._agent_scores.items():
            if intent_key in intents and intents[intent_key]:
                avg_score = sum(intents[intent_key]) / len(intents[intent_key])
                if avg_score > best_score:
                    best_score = avg_score
                    best_agent = agent_id

        return best_agent

    def get_priority_adjustment(self, agent_id: str, intent: QueryIntent) -> float:
        """Get a priority adjustment based on historical performance.

        Returns a multiplier (0.5 - 1.5) to adjust agent priority for routing.
        """
        scores = self._agent_scores.get(agent_id, {}).get(intent.value, [])

        if not scores or len(scores) < 3:  # Need enough data
            return 1.0

        avg_score = sum(scores[-10:]) / len(scores[-10:])  # Recent 10 scores

        # Map score (0-1) to multiplier (0.5-1.5)
        # Score 0.5 = multiplier 1.0, score 1.0 = multiplier 1.5, score 0.0 = multiplier 0.5
        return 0.5 + avg_score

    def get_statistics(self) -> Dict[str, Any]:
        """Get overall routing statistics."""
        total = len(self._history)
        successful = sum(1 for f in self._history if f.success is True)
        failed = sum(1 for f in self._history if f.success is False)

        intent_counts = defaultdict(int)
        for f in self._history:
            intent_counts[f.intent.value] += 1

        return {
            "total_routings": total,
            "successful": successful,
            "failed": failed,
            "success_rate": successful / total if total > 0 else 0.0,
            "intent_distribution": dict(intent_counts),
            "agents_tracked": list(self._agent_scores.keys()),
        }


# Global instances
_memory: Optional[ConversationMemory] = None
_classifier: Optional[IntentClassifier] = None
_feedback_tracker: Optional[RoutingFeedbackTracker] = None


def get_conversation_memory() -> ConversationMemory:
    """Get the global conversation memory instance."""
    global _memory
    if _memory is None:
        _memory = ConversationMemory()
    return _memory


def get_intent_classifier() -> IntentClassifier:
    """Get the global intent classifier instance."""
    global _classifier
    if _classifier is None:
        _classifier = IntentClassifier()
    return _classifier


def get_feedback_tracker() -> RoutingFeedbackTracker:
    """Get the global feedback tracker instance."""
    global _feedback_tracker
    if _feedback_tracker is None:
        _feedback_tracker = RoutingFeedbackTracker()
    return _feedback_tracker
