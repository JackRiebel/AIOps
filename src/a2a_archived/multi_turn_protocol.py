"""Multi-Turn Conversation Protocol for Agent Orchestration.

This module manages multi-turn conversations between the orchestrator
and specialist agents, tracking conversation state, extracting entities,
and determining follow-up queries.

Example flow for "Are there issues on my network?":
1. Orchestrator routes to Splunk Agent (check logs for issues)
2. Splunk Agent returns issues, entities extracted (network names)
3. Orchestrator routes to Meraki Agent (get device status for those networks)
4. Meraki Agent returns device statuses
5. Orchestrator routes to ThousandEyes Agent (check monitoring alerts)
6. ThousandEyes Agent returns alerts
7. Orchestrator synthesizes all responses into final answer
"""

import logging
import uuid
from typing import List, Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from .types import TaskState, A2AMessage, TextPart, DataPart
from .collaboration import CollaborationArtifact, ArtifactType, get_artifact_store

logger = logging.getLogger(__name__)


class TurnType(str, Enum):
    """Types of conversation turns."""
    QUERY = "query"           # Initial user query
    SPECIALIST = "specialist" # Agent consultation
    SYNTHESIS = "synthesis"   # Response synthesis
    CLARIFICATION = "clarification"  # Request for clarification
    FOLLOW_UP = "follow_up"   # Follow-up query


@dataclass
class ConversationTurn:
    """Represents a single turn in a multi-turn conversation."""
    turn_id: str
    turn_number: int
    turn_type: TurnType
    agent_id: str
    agent_name: str
    query: str
    response: Optional[str] = None
    artifacts: List[CollaborationArtifact] = field(default_factory=list)
    entities_extracted: Dict[str, Any] = field(default_factory=dict)
    duration_ms: int = 0
    status: TaskState = TaskState.SUBMITTED
    error: Optional[str] = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "turn_id": self.turn_id,
            "turn_number": self.turn_number,
            "turn_type": self.turn_type.value,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "query": self.query,
            "response": self.response,
            "entities_extracted": self.entities_extracted,
            "duration_ms": self.duration_ms,
            "status": self.status.value,
            "error": self.error,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class MultiTurnConversation:
    """Represents a complete multi-turn conversation."""
    conversation_id: str
    session_id: str
    user_query: str
    turns: List[ConversationTurn] = field(default_factory=list)
    max_turns: int = 15  # Prevent infinite loops
    status: TaskState = TaskState.SUBMITTED
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    # Accumulated context
    all_entities: Dict[str, List[Any]] = field(default_factory=dict)
    final_response: Optional[str] = None

    # Routing decisions
    routing_history: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def current_turn_number(self) -> int:
        """Get the current turn number."""
        return len(self.turns)

    @property
    def is_complete(self) -> bool:
        """Check if conversation is complete."""
        return self.status in [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELED]

    @property
    def can_continue(self) -> bool:
        """Check if conversation can continue."""
        return not self.is_complete and self.current_turn_number < self.max_turns

    def get_latest_turn(self) -> Optional[ConversationTurn]:
        """Get the most recent turn."""
        return self.turns[-1] if self.turns else None

    def get_turns_by_agent(self, agent_id: str) -> List[ConversationTurn]:
        """Get all turns for a specific agent."""
        return [t for t in self.turns if t.agent_id == agent_id]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "conversation_id": self.conversation_id,
            "session_id": self.session_id,
            "user_query": self.user_query,
            "turns": [t.to_dict() for t in self.turns],
            "current_turn": self.current_turn_number,
            "max_turns": self.max_turns,
            "status": self.status.value,
            "all_entities": self.all_entities,
            "final_response": self.final_response,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class TurnManager:
    """Manages multi-turn conversation state and progression.

    Handles:
    - Starting/ending conversations
    - Adding and completing turns
    - Entity extraction and accumulation
    - Follow-up query generation
    - Conversation synthesis
    """

    def __init__(self):
        self._active_conversations: Dict[str, MultiTurnConversation] = {}
        self._artifact_store = get_artifact_store()

    def start_conversation(
        self,
        query: str,
        session_id: str,
        max_turns: int = 15
    ) -> MultiTurnConversation:
        """Start a new multi-turn conversation.

        Args:
            query: The user's initial query
            session_id: Session ID for tracking
            max_turns: Maximum allowed turns

        Returns:
            New MultiTurnConversation instance
        """
        conversation_id = str(uuid.uuid4())

        conversation = MultiTurnConversation(
            conversation_id=conversation_id,
            session_id=session_id,
            user_query=query,
            max_turns=max_turns,
            status=TaskState.WORKING,
        )

        self._active_conversations[conversation_id] = conversation

        logger.info(f"[TurnManager] Started conversation {conversation_id[:8]}... for query: {query[:50]}")

        return conversation

    def add_turn(
        self,
        conversation: MultiTurnConversation,
        agent_id: str,
        agent_name: str,
        query: str,
        turn_type: TurnType = TurnType.SPECIALIST
    ) -> ConversationTurn:
        """Add a new turn to the conversation.

        Args:
            conversation: The conversation to add to
            agent_id: ID of the agent handling this turn
            agent_name: Display name of the agent
            query: The query being sent to the agent
            turn_type: Type of turn

        Returns:
            New ConversationTurn instance
        """
        turn = ConversationTurn(
            turn_id=str(uuid.uuid4()),
            turn_number=conversation.current_turn_number + 1,
            turn_type=turn_type,
            agent_id=agent_id,
            agent_name=agent_name,
            query=query,
            status=TaskState.WORKING,
        )

        conversation.turns.append(turn)

        logger.info(
            f"[TurnManager] Turn {turn.turn_number}: {agent_name} ({agent_id}) - {query[:50]}..."
        )

        return turn

    def complete_turn(
        self,
        turn: ConversationTurn,
        response: str,
        artifacts: List[CollaborationArtifact],
        entities: Dict[str, Any],
        success: bool = True,
        error: Optional[str] = None
    ) -> None:
        """Mark a turn as complete.

        Args:
            turn: The turn to complete
            response: The agent's response
            artifacts: Artifacts produced
            entities: Entities extracted from the response
            success: Whether the turn succeeded
            error: Error message if failed
        """
        turn.completed_at = datetime.utcnow()
        turn.duration_ms = int((turn.completed_at - turn.started_at).total_seconds() * 1000)
        turn.response = response
        turn.artifacts = artifacts
        turn.entities_extracted = entities
        turn.status = TaskState.COMPLETED if success else TaskState.FAILED
        turn.error = error

        logger.info(
            f"[TurnManager] Turn {turn.turn_number} complete: "
            f"{turn.agent_name} ({turn.duration_ms}ms, {len(artifacts)} artifacts)"
        )

    def accumulate_entities(
        self,
        conversation: MultiTurnConversation,
        entities: Dict[str, Any]
    ) -> None:
        """Accumulate entities from a turn into conversation context.

        Args:
            conversation: The conversation
            entities: New entities to add
        """
        for key, values in entities.items():
            if key not in conversation.all_entities:
                conversation.all_entities[key] = []

            if isinstance(values, list):
                for v in values:
                    if v not in conversation.all_entities[key]:
                        conversation.all_entities[key].append(v)
            else:
                if values not in conversation.all_entities[key]:
                    conversation.all_entities[key].append(values)

    def should_continue(self, conversation: MultiTurnConversation) -> bool:
        """Determine if the conversation should continue.

        Returns True if:
        - Under max turns
        - Not already complete
        - No critical errors
        """
        if not conversation.can_continue:
            return False

        # Check for critical errors in recent turns
        if conversation.turns:
            last_turn = conversation.get_latest_turn()
            if last_turn and last_turn.status == TaskState.FAILED:
                # Allow retry but not infinite failures
                failed_turns = sum(1 for t in conversation.turns[-3:] if t.status == TaskState.FAILED)
                if failed_turns >= 3:
                    return False

        return True

    def extract_entities(self, response: Any, source_agent: str) -> Dict[str, Any]:
        """Extract entities from an agent response.

        Entities are things like:
        - Network IDs, names
        - Device serials, names
        - Alert IDs
        - Site IDs

        Args:
            response: The response data to extract from
            source_agent: Agent that produced the response

        Returns:
            Dict of entity types to values
        """
        entities: Dict[str, List[Any]] = {}

        if isinstance(response, dict):
            # Check for explicitly extracted entities
            if "entities_extracted" in response:
                return response["entities_extracted"]

            # Extract from common data structures
            self._extract_from_dict(response, entities)

        elif isinstance(response, list):
            for item in response:
                if isinstance(item, dict):
                    self._extract_from_dict(item, entities)

        # Remove empty lists
        return {k: v for k, v in entities.items() if v}

    def _extract_from_dict(self, data: Dict[str, Any], entities: Dict[str, List[Any]]) -> None:
        """Extract entities from a dictionary."""
        # Network entities
        for key in ["networkId", "network_id", "id"]:
            if key in data and "network" in str(data.get("name", "")).lower():
                if "network_ids" not in entities:
                    entities["network_ids"] = []
                entities["network_ids"].append(data[key])

        if "name" in data:
            name = data["name"]
            if "network_names" not in entities:
                entities["network_names"] = []
            if name not in entities["network_names"]:
                entities["network_names"].append(name)

        # Device entities
        if "serial" in data:
            if "device_serials" not in entities:
                entities["device_serials"] = []
            entities["device_serials"].append(data["serial"])

        if "hostname" in data:
            if "device_names" not in entities:
                entities["device_names"] = []
            entities["device_names"].append(data["hostname"])

        # Alert entities
        for key in ["alertId", "alert_id"]:
            if key in data:
                if "alert_ids" not in entities:
                    entities["alert_ids"] = []
                entities["alert_ids"].append(data[key])

        # Site entities
        for key in ["siteId", "site_id"]:
            if key in data:
                if "site_ids" not in entities:
                    entities["site_ids"] = []
                entities["site_ids"].append(data[key])

        # Issue entities
        for key in ["issueId", "issue_id"]:
            if key in data:
                if "issue_ids" not in entities:
                    entities["issue_ids"] = []
                entities["issue_ids"].append(data[key])

    def get_follow_up_queries(
        self,
        conversation: MultiTurnConversation,
        current_query: str
    ) -> List[Dict[str, Any]]:
        """Generate follow-up queries based on conversation context.

        Args:
            conversation: The current conversation
            current_query: The current query context

        Returns:
            List of suggested follow-up queries with target agents
        """
        follow_ups = []
        entities = conversation.all_entities

        # Check what we've already consulted
        consulted_agents = set(t.agent_id for t in conversation.turns)

        # If we found issues/alerts, suggest investigating devices
        if entities.get("issue_ids") or entities.get("alert_ids"):
            if "meraki-agent" not in consulted_agents:
                follow_ups.append({
                    "agent_id": "meraki-agent",
                    "query": "Check status of devices related to these issues",
                    "reason": "Issues/alerts found, need to verify device status",
                })
            if "catalyst-agent" not in consulted_agents:
                follow_ups.append({
                    "agent_id": "catalyst-agent",
                    "query": "Check network health and device status",
                    "reason": "Issues found, need Catalyst Center perspective",
                })

        # If we found devices, suggest checking monitoring
        if entities.get("device_serials") or entities.get("device_names"):
            if "thousandeyes-agent" not in consulted_agents:
                follow_ups.append({
                    "agent_id": "thousandeyes-agent",
                    "query": "Check monitoring status and alerts for these devices",
                    "reason": "Devices identified, need monitoring perspective",
                })

        # If we have health data, suggest visualization
        if any(t.agent_id != "ui-agent" for t in conversation.turns):
            if "ui-agent" not in consulted_agents:
                follow_ups.append({
                    "agent_id": "ui-agent",
                    "query": "Generate visualization for the collected data",
                    "reason": "Data collected, can be visualized",
                })

        return follow_ups

    def complete_conversation(
        self,
        conversation: MultiTurnConversation,
        final_response: str,
        success: bool = True
    ) -> None:
        """Mark a conversation as complete.

        Args:
            conversation: The conversation to complete
            final_response: The final synthesized response
            success: Whether the conversation succeeded
        """
        conversation.completed_at = datetime.utcnow()
        conversation.final_response = final_response
        conversation.status = TaskState.COMPLETED if success else TaskState.FAILED

        # Remove from active conversations
        if conversation.conversation_id in self._active_conversations:
            del self._active_conversations[conversation.conversation_id]

        total_duration = int((conversation.completed_at - conversation.started_at).total_seconds() * 1000)

        logger.info(
            f"[TurnManager] Conversation {conversation.conversation_id[:8]}... complete: "
            f"{len(conversation.turns)} turns, {total_duration}ms total"
        )

    def get_conversation(self, conversation_id: str) -> Optional[MultiTurnConversation]:
        """Get an active conversation by ID."""
        return self._active_conversations.get(conversation_id)

    def get_active_conversations(self) -> List[MultiTurnConversation]:
        """Get all active conversations."""
        return list(self._active_conversations.values())

    def build_context_for_agent(
        self,
        conversation: MultiTurnConversation,
        agent_id: str
    ) -> str:
        """Build context string for an agent based on previous turns.

        Args:
            conversation: The conversation
            agent_id: The target agent

        Returns:
            Context string with relevant information from previous turns
        """
        lines = []

        if conversation.turns:
            lines.append("## Previous Agent Consultations:")

            for turn in conversation.turns:
                if turn.status == TaskState.COMPLETED and turn.response:
                    lines.append(f"\n### {turn.agent_name} (Turn {turn.turn_number}):")
                    lines.append(f"Query: {turn.query}")
                    lines.append(f"Response: {turn.response[:500]}...")

                    if turn.entities_extracted:
                        lines.append(f"Entities found: {list(turn.entities_extracted.keys())}")

        if conversation.all_entities:
            lines.append("\n## Accumulated Entities:")
            for key, values in conversation.all_entities.items():
                lines.append(f"- {key}: {values[:5]}{'...' if len(values) > 5 else ''}")

        return "\n".join(lines)


# Global instance
_turn_manager: Optional[TurnManager] = None


def get_turn_manager() -> TurnManager:
    """Get the global turn manager instance."""
    global _turn_manager
    if _turn_manager is None:
        _turn_manager = TurnManager()
    return _turn_manager
