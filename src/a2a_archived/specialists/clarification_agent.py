"""Clarification Agent for Multi-Agent Network Management.

This specialist handles:
- Greetings and introductions
- Help requests and capability explanations
- Ambiguous queries that need clarification
- Thanks and acknowledgments

The clarification agent acts as the fallback when no other
specialist is a good match for the user's query.

Now supports dynamic capability discovery from the AgentRegistry.
"""

import logging
from typing import List, Dict, Any, Optional

from ..types import AgentSkill
from ..registry import get_agent_registry
from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    SkillResult,
)

logger = logging.getLogger(__name__)

# Default capabilities if registry is empty
DEFAULT_CAPABILITIES = {
    "meraki-agent": {
        "name": "Meraki Dashboard",
        "capabilities": [
            "View networks, devices, SSIDs, and VLANs",
            "Check device status and network health",
            "See connected clients",
        ],
        "examples": [
            "List my Meraki networks",
            "Show devices in [network name]",
            "What's the network health?",
        ],
    },
    "splunk-agent": {
        "name": "Splunk Log Analysis",
        "capabilities": [
            "Search logs and security events",
            "View alerts and saved searches",
            "Analyze log patterns",
        ],
        "examples": [
            "Search for error logs",
            "Show security events",
            "List active alerts",
        ],
    },
    "catalyst-agent": {
        "name": "Catalyst Center",
        "capabilities": [
            "View sites and devices",
            "Check network health and compliance",
            "See network topology",
        ],
        "examples": [
            "Show me sites",
            "List Catalyst devices",
            "Check network compliance",
        ],
    },
    "thousandeyes-agent": {
        "name": "ThousandEyes Monitoring",
        "capabilities": [
            "View tests and agents",
            "Check network performance",
            "See active alerts",
        ],
        "examples": [
            "List ThousandEyes tests",
            "Show active alerts",
            "Check agent status",
        ],
    },
    "knowledge-agent": {
        "name": "Cisco Knowledge Base",
        "capabilities": [
            "Get best practices for network design",
            "Troubleshooting guidance",
            "API documentation help",
        ],
        "examples": [
            "Best practices for VLANs",
            "How to troubleshoot WiFi?",
            "How do I use the Meraki API?",
        ],
    },
}


class ClarificationAgent(BaseSpecialistAgent):
    """Specialist agent for handling unclear or conversational queries.

    This agent handles:
    - Greetings: "Hello", "Hi there", "Good morning"
    - Help requests: "What can you do?", "Help"
    - Ambiguous queries: Short or unclear inputs
    - Acknowledgments: "Thanks", "Thank you"

    It introduces the system's capabilities and asks for
    clarification when queries are ambiguous.
    """

    AGENT_ID = "clarification-agent"
    AGENT_NAME = "Clarification Assistant"
    AGENT_ROLE = "clarification-specialist"
    AGENT_DESCRIPTION = "Handles greetings, help requests, and asks for clarification on ambiguous queries"

    def get_skills(self) -> List[AgentSkill]:
        """Define skills for handling conversational and unclear queries."""
        return [
            AgentSkill(
                id="handle_greeting",
                name="Handle Greeting",
                description="Respond to greetings and introduce the system's capabilities",
                tags=["greeting", "hello", "introduction", "general"],
                examples=[
                    "Hello",
                    "Hi there",
                    "Hey",
                    "Good morning",
                    "Good afternoon",
                    "Greetings",
                ]
            ),
            AgentSkill(
                id="handle_help",
                name="Handle Help Request",
                description="Explain what the system can do and available capabilities",
                tags=["help", "capabilities", "what can you do", "general"],
                examples=[
                    "Help",
                    "What can you do?",
                    "What are your capabilities?",
                    "How can you help me?",
                    "What commands are available?",
                ]
            ),
            AgentSkill(
                id="request_clarification",
                name="Request Clarification",
                description="Ask the user to clarify an ambiguous query",
                tags=["clarification", "unclear", "ambiguous", "general"],
                examples=[
                    # Short/ambiguous queries often need clarification
                ]
            ),
            AgentSkill(
                id="handle_thanks",
                name="Handle Thanks",
                description="Acknowledge user gratitude",
                tags=["thanks", "thank you", "acknowledgment", "general"],
                examples=[
                    "Thanks",
                    "Thank you",
                    "Thanks for your help",
                    "Appreciate it",
                ]
            ),
        ]

    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a clarification skill."""

        query = params.get("query", "")

        if skill_id == "handle_greeting":
            return self._handle_greeting(context)
        elif skill_id == "handle_help":
            return self._handle_help(context)
        elif skill_id == "request_clarification":
            return self._request_clarification(query, context)
        elif skill_id == "handle_thanks":
            return self._handle_thanks()
        else:
            # Default to clarification for unknown skills
            return self._request_clarification(query, context)

    def _get_dynamic_capabilities(self) -> Dict[str, Dict[str, Any]]:
        """Fetch capabilities dynamically from the AgentRegistry.

        Returns a dict of agent capabilities, falling back to defaults
        if the registry is empty or agents aren't registered.
        """
        capabilities = {}

        try:
            registry = get_agent_registry()
            registered_agents = registry.get_all_agents()

            for agent in registered_agents:
                agent_id = agent.card.id

                # Skip internal agents
                if agent_id in ["clarification-agent", "ui-agent", "gateway-agent"]:
                    continue

                # Use default info if available, otherwise build from agent card
                if agent_id in DEFAULT_CAPABILITIES:
                    capabilities[agent_id] = DEFAULT_CAPABILITIES[agent_id]
                else:
                    # Build from agent card
                    card = agent.card
                    skills = card.skills[:3] if card.skills else []  # First 3 skills

                    capabilities[agent_id] = {
                        "name": card.name,
                        "capabilities": [s.description for s in skills],
                        "examples": [ex for s in skills for ex in (s.examples or [])[:2]][:3],
                    }

            # If no agents registered, use defaults
            if not capabilities:
                return DEFAULT_CAPABILITIES

            return capabilities

        except Exception as e:
            logger.warning(f"[ClarificationAgent] Failed to get dynamic capabilities: {e}")
            return DEFAULT_CAPABILITIES

    def _handle_greeting(self, context: AgentExecutionContext) -> SkillResult:
        """Generate a greeting response with dynamic capability overview."""

        # Get capabilities dynamically
        capabilities = self._get_dynamic_capabilities()

        # Build response dynamically
        response_parts = ["Hello! I'm the Lumen Network Assistant. I can help you with:\n"]

        for agent_id, info in capabilities.items():
            response_parts.append(f"\n**{info['name']}**")
            for cap in info.get("capabilities", [])[:3]:
                response_parts.append(f"- {cap}")

        response_parts.append("\nWhat would you like to explore?")
        response = "\n".join(response_parts)

        return SkillResult(
            success=True,
            data={
                "type": "greeting",
                "message": response,
                "capabilities": list(capabilities.keys()),
                "dynamic": True,  # Indicates capabilities were loaded dynamically
            },
            suggested_follow_up="Try: 'Show me my Meraki networks' or 'List network devices'"
        )

    def _handle_help(self, context: AgentExecutionContext) -> SkillResult:
        """Generate detailed help information with dynamic capabilities."""

        # Get capabilities dynamically
        capabilities = self._get_dynamic_capabilities()

        # Build response dynamically
        response_parts = ["Here's what I can help you with:\n"]
        all_examples = []

        for agent_id, info in capabilities.items():
            response_parts.append(f"\n**{info['name']}**")
            examples = info.get("examples", [])[:4]
            for ex in examples:
                response_parts.append(f'- "{ex}"')
                all_examples.append(ex)

        response_parts.append("\nJust describe what you're looking for and I'll route you to the right specialist!")
        response = "\n".join(response_parts)

        return SkillResult(
            success=True,
            data={
                "type": "help",
                "message": response,
                "example_queries": all_examples[:8],  # First 8 examples
                "dynamic": True,
            },
            suggested_follow_up="Try one of the example queries above!"
        )

    def _request_clarification(self, query: str, context: AgentExecutionContext) -> SkillResult:
        """Ask the user to clarify an ambiguous query."""

        # Try to identify what the user might mean
        query_lower = query.lower().strip()

        # Check if query looks like a network/device name
        has_network_hint = any(word in query_lower for word in [
            "network", "site", "device", "home", "office", "branch"
        ])

        if has_network_hint or len(query.split()) <= 3:
            # Likely a network or device name
            response = f"""I see "{query}" - could you clarify what you'd like to do?

- **View details**: "Show me details for {query}"
- **Check status**: "What's the status of {query}?"
- **List devices**: "Show devices in {query}"
- **Check health**: "Is {query} healthy?"

Or tell me more about what you're looking for."""

            suggestions = [
                f"Show me details for {query}",
                f"What's the status of {query}?",
                f"List devices in {query}",
            ]
        else:
            # General unclear query
            response = f"""I'm not sure how to help with that. Could you clarify?

I can help with:
- **Meraki**: Networks, devices, SSIDs, clients
- **Splunk**: Logs, security events, alerts
- **Catalyst**: Sites, devices, topology, compliance
- **ThousandEyes**: Tests, agents, performance

What specifically would you like to know?"""

            suggestions = [
                "Show me my networks",
                "Check network health",
                "List devices",
            ]

        return SkillResult(
            success=True,
            data={
                "type": "clarification_request",
                "original_query": query,
                "message": response,
                "suggestions": suggestions,
            },
            entities_extracted={
                "possible_entity": query if len(query.split()) <= 3 else None
            },
            suggested_follow_up=suggestions[0] if suggestions else None
        )

    def _handle_thanks(self) -> SkillResult:
        """Acknowledge user gratitude."""

        response = "You're welcome! Let me know if you need anything else."

        return SkillResult(
            success=True,
            data={
                "type": "acknowledgment",
                "message": response,
            }
        )

    def _generate_text_summary(self, skill_id: str, result: SkillResult) -> str:
        """Generate text summary for response."""
        if result.success and result.data and "message" in result.data:
            return result.data["message"]
        return super()._generate_text_summary(skill_id, result)
