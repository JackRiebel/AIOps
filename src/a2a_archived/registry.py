"""A2A Agent Registry - manages agent discovery and routing.

The registry is the central component that:
1. Stores agent cards for all registered agents
2. Matches user queries to appropriate agents based on skills
3. Enables dynamic capability discovery (no hardcoded routing)
"""

import logging
from typing import Dict, List, Optional, Callable, Any, Tuple
from dataclasses import dataclass, field
import re

from .types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    AgentInterface,
    A2AMessage,
    A2ATask,
    TextPart,
)

logger = logging.getLogger(__name__)

# Global registry instance
_registry: Optional["AgentRegistry"] = None


@dataclass
class RegisteredAgent:
    """An agent registered with the registry."""
    card: AgentCard
    # The callable that handles messages for this agent
    handler: Optional[Callable] = None
    # Whether this agent is currently available
    available: bool = True


class AgentRegistry:
    """Central registry for A2A agent discovery and routing.

    Key concepts:
    - Agents register with their Agent Card (capabilities, skills)
    - When a message comes in, the registry uses skill matching to find
      the best agent(s) to handle it
    - Routing is DYNAMIC based on skills, not hardcoded rules
    """

    def __init__(self):
        self._agents: Dict[str, RegisteredAgent] = {}
        self._skill_index: Dict[str, List[str]] = {}  # tag -> [agent_ids]

    def register(self, card: AgentCard, handler: Optional[Callable] = None) -> None:
        """Register an agent with the registry.

        Args:
            card: The agent's capability card
            handler: Optional async callable to handle messages for this agent
        """
        agent = RegisteredAgent(card=card, handler=handler)
        self._agents[card.id] = agent

        # Index by skill tags for fast lookup
        for skill in card.skills:
            for tag in skill.tags:
                if tag not in self._skill_index:
                    self._skill_index[tag] = []
                if card.id not in self._skill_index[tag]:
                    self._skill_index[tag].append(card.id)

        logger.info(f"[A2A Registry] Registered agent: {card.name} (id={card.id}, role={card.role})")
        logger.info(f"[A2A Registry]   Skills: {[s.name for s in card.skills]}")
        logger.info(f"[A2A Registry]   Tags indexed: {list(set(tag for s in card.skills for tag in s.tags))}")

    def unregister(self, agent_id: str) -> None:
        """Remove an agent from the registry."""
        if agent_id in self._agents:
            agent = self._agents[agent_id]
            # Remove from skill index
            for skill in agent.card.skills:
                for tag in skill.tags:
                    if tag in self._skill_index and agent_id in self._skill_index[tag]:
                        self._skill_index[tag].remove(agent_id)
            del self._agents[agent_id]
            logger.info(f"[A2A Registry] Unregistered agent: {agent_id}")

    def get_agent(self, agent_id: str) -> Optional[AgentCard]:
        """Get an agent's card by ID."""
        if agent_id in self._agents:
            return self._agents[agent_id].card
        return None

    def get_all_agents(self) -> List[AgentCard]:
        """Get all registered agent cards."""
        return [agent.card for agent in self._agents.values()]

    def get_agents_by_role(self, role: str) -> List[AgentCard]:
        """Get all agents with a specific role."""
        return [
            agent.card
            for agent in self._agents.values()
            if agent.card.role == role
        ]

    def get_agents_by_tag(self, tag: str) -> List[AgentCard]:
        """Get all agents that have skills with a specific tag."""
        agent_ids = self._skill_index.get(tag, [])
        return [self._agents[aid].card for aid in agent_ids if aid in self._agents]

    def find_agents_for_query(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        cached_networks: Optional[List[Dict[str, Any]]] = None,
        org_types: Optional[Dict[str, str]] = None
    ) -> List[Tuple[AgentCard, float]]:
        """Find the best agents to handle a query based on skill matching.

        This is the KEY method for dynamic routing. It analyzes the query
        and returns a ranked list of agents that can handle it.

        IMPORTANT: Only returns agents that have handlers registered.
        Agents without handlers (like Knowledge Agent without Cisco Circuit)
        are filtered out to prevent routing failures.

        Args:
            query: The user's query text
            context: Optional context (e.g., current environment info)
            cached_networks: List of network dicts with 'name' and org info for context-aware routing
            org_types: Map of org_name -> platform type (meraki, catalyst, etc.)

        Returns:
            List of (AgentCard, score) tuples, sorted by score descending
        """
        query_lower = query.lower()
        scores: Dict[str, float] = {}

        # Pattern matching for query classification
        patterns = {
            # Best practices / Design questions -> Knowledge Agent
            "best-practices": [
                r"best\s*(practice|way|approach)",
                r"how\s+(should|do)\s+i",
                r"what\s+is\s+the\s+(best|recommended|proper)",
                r"recommend",
                r"guidelines?",
                r"standards?",
            ],
            "design": [
                r"design",
                r"architect",
                r"segment",
                r"vlan",
                r"topology",
                r"layout",
                r"structure",
            ],
            "security": [
                r"secur",
                r"firewall",
                r"acl",
                r"access\s*control",
                r"threat",
                r"protect",
                r"harden",
            ],
            "troubleshooting": [
                r"troubleshoot",
                r"debug",
                r"not\s+working",
                r"failed?",
                r"error",
                r"issue",
                r"problem",
                r"why\s+(is|does|can)",
            ],
            "configuration": [
                r"config",
                r"set\s*up",
                r"enable",
                r"disable",
                r"create",
                r"add",
                r"change",
                r"modify",
            ],
            # API / Implementation -> Implementation Agent
            "api-query": [
                r"list",
                r"show\s+me",
                r"get",
                r"what\s+(devices|networks|clients|ssids)",
                r"status",
                r"check",
            ],
            "implementation": [
                r"implement",
                r"execute",
                r"apply",
                r"make\s+change",
                r"update",
            ],
            # Product-specific patterns
            "meraki": [
                r"meraki",
                r"dashboard",
                r"\bmx\b",
                r"\bmr\b",
                r"\bms\b",
                r"ssid",
                r"wifi",
                r"wireless",
            ],
            "splunk": [
                r"splunk",
                r"\blogs?\b",
                r"\bspl\b",
                r"events?",
                r"siem",
                r"search.*index",
            ],
            "catalyst": [
                r"catalyst",
                r"dna\s*c",
                r"dnac",
                r"assurance",
                r"cisco\s+center",
            ],
            "thousandeyes": [
                r"thousandeyes",
                r"thousand\s*eyes",
                r"\bte\s+test",
                r"path\s+vis",
                r"endpoint\s+agent",
            ],
            # Network infrastructure patterns
            "network": [
                r"network",
                r"devices?",
                r"switch(es)?",
                r"router",
                r"access\s+point",
                r"\bap\b",
            ],
            "monitoring": [
                r"health",
                r"status",
                r"monitor",
                r"alert",
                r"offline",
                r"online",
            ],
            "visualization": [
                r"chart",
                r"graph",
                r"visuali[sz]e",
                r"table",
                r"diagram",
            ],
            # Clarification agent patterns (for fallback routing)
            "greeting": [
                r"^hello\b",
                r"^hi\b",
                r"^hey\b",
                r"^greetings\b",
                r"good\s+(morning|afternoon|evening)",
            ],
            "help": [
                r"\bhelp\b",
                r"what\s+can\s+you",
                r"capabilities",
            ],
            "thanks": [
                r"thank",
                r"appreciate",
            ],
        }

        # Score each agent based on skill tag matches
        # Skip agents without handlers - they can't actually process queries
        for agent_id, registered in self._agents.items():
            # IMPORTANT: Skip agents without handlers to prevent routing failures
            if not registered.handler:
                continue

            score = 0.0
            matched_patterns = []

            for skill in registered.card.skills:
                # Check skill tags against query patterns
                for tag in skill.tags:
                    if tag in patterns:
                        for pattern in patterns[tag]:
                            if re.search(pattern, query_lower):
                                score += 1.0
                                matched_patterns.append(f"{tag}:{pattern}")
                                break  # Only count each tag once per query

                # Also check if query matches skill examples
                for example in skill.examples:
                    if self._fuzzy_match(query_lower, example.lower()):
                        score += 0.5

                # Direct skill description match
                if any(word in skill.description.lower() for word in query_lower.split() if len(word) > 3):
                    score += 0.3

            # Platform-specific boosting: explicit platform mentions should strongly prefer that agent
            # This ensures "get my meraki networks" always routes to Meraki agent
            PLATFORM_BOOST = {
                "meraki-agent": [r"\bmeraki\b", r"\bmx\d*\b", r"\bmr\d*\b", r"\bms\d*\b"],
                "catalyst-agent": [r"\bcatalyst\b", r"\bdnac?\b", r"\bdna\s*center\b"],
                "splunk-agent": [r"\bsplunk\b", r"\bsiem\b"],
                "thousandeyes-agent": [r"\bthousandeyes\b", r"\bthousand\s*eyes\b", r"\b1000eyes\b"],
            }

            if agent_id in PLATFORM_BOOST:
                for platform_pattern in PLATFORM_BOOST[agent_id]:
                    if re.search(platform_pattern, query_lower):
                        score += 30.0  # Very strong boost for explicit platform/product mention (higher than session context boost)
                        matched_patterns.append(f"PLATFORM_BOOST:{platform_pattern}")
                        logger.info(f"[A2A Registry] Platform boost (+30): pattern '{platform_pattern}' -> {agent_id}")
                        break  # Only apply boost once per agent

            # Network context boosting: if query mentions a known network name, boost that platform's agent
            # This enables "get devices on riebel home" to route to Meraki when "riebel home" is a Meraki network
            if cached_networks:
                for network in cached_networks:
                    network_name = network.get("name", "").lower()
                    if network_name and len(network_name) > 2 and network_name in query_lower:
                        # Determine platform from network's organization
                        org_name = network.get("organizationName") or network.get("org_name") or network.get("organization")
                        platform = "meraki"  # Default to Meraki since most networks come from Meraki
                        if org_types and org_name:
                            platform = org_types.get(org_name, "meraki")

                        # Boost the matching agent
                        platform_agent_map = {
                            "meraki": "meraki-agent",
                            "catalyst": "catalyst-agent",
                            "thousandeyes": "thousandeyes-agent",
                        }
                        target_agent = platform_agent_map.get(platform, "meraki-agent")

                        if agent_id == target_agent:
                            score += 25.0  # Strong boost to override generic skill matches
                            matched_patterns.append(f"NETWORK_CONTEXT:{network_name}")
                            logger.info(f"[A2A Registry] Network context boost (+25): '{network_name}' -> {agent_id}")
                            break  # Only apply once

            # Apply agent priority as a tiebreaker
            score += registered.card.priority * 0.1

            if score > 0:
                scores[agent_id] = score
                logger.debug(f"[A2A Registry] Agent {registered.card.name} scored {score} for query. Matched: {matched_patterns}")

        # Sort by score descending
        ranked = [
            (self._agents[aid].card, score)
            for aid, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)
        ]

        if ranked:
            logger.info(f"[A2A Registry] Query routing results for '{query[:50]}...':")
            for card, score in ranked[:3]:
                logger.info(f"[A2A Registry]   -> {card.name} (score={score:.2f})")
        else:
            # Fallback: always return clarification-agent if no matches
            # This ensures the orchestrator never has to handle queries directly
            clarification_agent = self.get_agent("clarification-agent")
            if clarification_agent:
                logger.info(f"[A2A Registry] No agents matched query: '{query[:50]}...' - falling back to clarification-agent")
                ranked = [(clarification_agent, 0.1)]
            else:
                logger.warning(f"[A2A Registry] No agents matched query and clarification-agent not found: {query[:50]}...")

        return ranked

    def _fuzzy_match(self, query: str, example: str) -> bool:
        """Simple fuzzy matching between query and example."""
        # Split into words and check overlap
        query_words = set(query.split())
        example_words = set(example.split())
        overlap = query_words & example_words
        # Consider it a match if at least 30% of example words are in query
        return len(overlap) >= max(1, len(example_words) * 0.3)

    def should_consult_agent(self, agent_id: str, query: str) -> bool:
        """Check if a specific agent should be consulted for a query.

        This is a convenience method that returns True if the agent
        is in the top results for the query.
        """
        ranked = self.find_agents_for_query(query)
        for card, score in ranked:
            if card.id == agent_id and score > 0.5:
                return True
        return False

    async def send_message(self, agent_id: str, message: A2AMessage, context: Any = None) -> Optional[A2AMessage]:
        """Send a message to an agent and get a response.

        Args:
            agent_id: The target agent's ID
            message: The message to send
            context: Optional execution context to pass to the agent handler

        Returns:
            The agent's response message, or None if agent not found/unavailable
        """
        if agent_id not in self._agents:
            logger.warning(f"[A2A Registry] Agent not found: {agent_id}")
            return None

        registered = self._agents[agent_id]
        if not registered.available:
            logger.warning(f"[A2A Registry] Agent unavailable: {agent_id}")
            return None

        if not registered.handler:
            logger.warning(f"[A2A Registry] Agent has no handler: {agent_id}")
            return None

        try:
            logger.info(f"[A2A Registry] Sending message to agent: {registered.card.name}")
            logger.info(f"[A2A Registry] Message parts: {len(message.parts)}, context keys: {list(message.context.keys()) if message.context else 'None'}")

            # Pass context if provided (specialist agents need it)
            if context is not None:
                logger.info(f"[A2A Registry] Calling handler with context (org={getattr(context, 'org_name', 'unknown')})")
                response = await registered.handler(message, context)
            else:
                logger.info(f"[A2A Registry] Calling handler without context")
                response = await registered.handler(message)

            # Log response details
            if response:
                logger.info(f"[A2A Registry] Agent {agent_id} returned response with {len(response.parts) if response.parts else 0} parts")
                if response.parts:
                    for i, part in enumerate(response.parts):
                        part_type = type(part).__name__
                        if hasattr(part, 'text'):
                            logger.info(f"[A2A Registry]   Part {i}: {part_type} - text length={len(part.text)}")
                        elif hasattr(part, 'data'):
                            logger.info(f"[A2A Registry]   Part {i}: {part_type} - data keys={list(part.data.keys()) if isinstance(part.data, dict) else 'not-dict'}")
            else:
                logger.warning(f"[A2A Registry] Agent {agent_id} returned None response")

            return response
        except Exception as e:
            import traceback
            logger.error(f"[A2A Registry] Error calling agent {agent_id}: {e}")
            logger.error(f"[A2A Registry] Traceback:\n{traceback.format_exc()}")
            return None

    def get_agent_card_json(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get an agent's card as JSON (for /.well-known/agent.json)."""
        if agent_id in self._agents:
            return self._agents[agent_id].card.to_dict()
        return None

    def build_capability_context(self) -> str:
        """Build a context string describing all available agents and their capabilities.

        This is used to inform the orchestrating agent about what other agents
        can do, enabling dynamic routing decisions.
        """
        lines = ["Available Agents and Their Capabilities:"]
        lines.append("=" * 50)

        for agent_id, registered in self._agents.items():
            card = registered.card
            lines.append(f"\n## {card.name} (role: {card.role})")
            lines.append(f"   ID: {card.id}")
            lines.append(f"   Description: {card.description}")

            if card.skills:
                lines.append("   Skills:")
                for skill in card.skills:
                    lines.append(f"     - {skill.name}: {skill.description}")
                    if skill.tags:
                        lines.append(f"       Tags: {', '.join(skill.tags)}")
                    if skill.examples:
                        lines.append(f"       Examples: {skill.examples[:2]}")

        return "\n".join(lines)


def get_agent_registry() -> AgentRegistry:
    """Get the global agent registry instance."""
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry


def reset_registry() -> None:
    """Reset the global registry (for testing)."""
    global _registry
    _registry = None
