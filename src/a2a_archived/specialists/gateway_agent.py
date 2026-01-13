"""Gateway Agent for External A2A Federation.

This specialist agent routes queries to federated external A2A agents
when internal agents cannot handle the request, or when specialized
external capabilities are needed.

Features:
- Intelligent routing to external agents
- Response aggregation from multiple external sources
- Fallback handling when external agents fail
- Trust-based routing decisions
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

from ..types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    A2AMessage,
    TextPart,
    DataPart,
    TaskState,
)
from ..federation import (
    AgentFederationRegistry,
    FederatedAgent,
    TrustLevel,
    get_federation_registry,
)
from ..external_client import ExternalTaskResult
from ..registry import get_agent_registry
from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    SkillResult,
)

logger = logging.getLogger(__name__)


@dataclass
class GatewayRoutingResult:
    """Result of routing through the gateway."""
    success: bool
    response: str = ""
    source_agent_url: Optional[str] = None
    source_agent_name: Optional[str] = None
    external_task_id: Optional[str] = None
    duration_ms: float = 0.0
    fallback_used: bool = False
    error: Optional[str] = None
    aggregated_from: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "response": self.response,
            "source_agent_url": self.source_agent_url,
            "source_agent_name": self.source_agent_name,
            "external_task_id": self.external_task_id,
            "duration_ms": self.duration_ms,
            "fallback_used": self.fallback_used,
            "error": self.error,
            "aggregated_from": self.aggregated_from,
        }


class GatewayAgent(BaseSpecialistAgent):
    """Gateway agent for routing to external A2A agents.

    The gateway agent:
    1. Analyzes queries to determine if external routing is beneficial
    2. Selects the best external agent(s) based on capabilities and trust
    3. Routes queries and aggregates responses
    4. Handles failures with fallback strategies

    Now inherits from BaseSpecialistAgent for consistency with other specialists.
    """

    # BaseSpecialistAgent class attributes
    AGENT_ID = "gateway-agent"
    AGENT_NAME = "Federation Gateway Agent"
    AGENT_ROLE = "gateway"
    AGENT_PRIORITY = 1  # Low priority - used as fallback
    AGENT_DESCRIPTION = (
        "Routes queries to federated external A2A agents when specialized "
        "external capabilities are needed. Handles response aggregation and failover."
    )

    # Query patterns that suggest external routing might be needed
    EXTERNAL_ROUTING_PATTERNS = [
        "third-party",
        "external",
        "partner",
        "integration",
        "other system",
        "outside",
    ]

    def __init__(
        self,
        federation_registry: Optional[AgentFederationRegistry] = None,
        min_trust_level: TrustLevel = TrustLevel.VERIFIED,
        enable_aggregation: bool = True,
        max_external_agents: int = 3,
    ):
        self.federation = federation_registry or get_federation_registry()
        self.min_trust_level = min_trust_level
        self.enable_aggregation = enable_aggregation
        self.max_external_agents = max_external_agents

    def get_skills(self) -> List[AgentSkill]:
        """Get gateway skills - implements BaseSpecialistAgent interface."""
        return [
            AgentSkill(
                id="external-routing",
                name="External Agent Routing",
                description="Route queries to external A2A agents in the federation",
                tags=["federation", "external", "routing", "integration"],
                examples=[
                    "Can you check with external systems?",
                    "Is there a third-party service that can help?",
                    "Route this to an external agent",
                ],
            ),
            AgentSkill(
                id="federation-status",
                name="Federation Status",
                description="Check status of federated external agents",
                tags=["federation", "status", "health"],
                examples=[
                    "What external agents are available?",
                    "Show me federation status",
                    "List federated agents",
                ],
            ),
        ]

    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a gateway skill - implements BaseSpecialistAgent interface.

        Args:
            skill_id: The skill to execute (external-routing or federation-status)
            params: Skill parameters including 'query'
            context: Execution context

        Returns:
            SkillResult with response
        """
        try:
            if skill_id == "federation-status":
                status = await self.get_federation_status()
                return SkillResult(
                    success=True,
                    data={
                        "status": status,
                        "summary": (
                            f"Federation Status:\n"
                            f"- Total agents: {status['statistics']['total_agents']}\n"
                            f"- Healthy agents: {status['statistics']['healthy_agents']}\n"
                            f"- Enabled agents: {status['statistics']['enabled_agents']}"
                        ),
                    },
                )

            elif skill_id == "external-routing":
                query = params.get("query", "")
                if not query:
                    return SkillResult(
                        success=False,
                        error="No query provided for external routing"
                    )

                result = await self.route(
                    query=query,
                    context_id=context.session_id,
                    prefer_agent_url=params.get("prefer_agent_url"),
                    aggregate=params.get("aggregate"),
                )

                if result.success:
                    return SkillResult(
                        success=True,
                        data={
                            "response": result.response,
                            "source_agent": result.source_agent_name or result.source_agent_url,
                            "aggregated_from": result.aggregated_from,
                            "duration_ms": result.duration_ms,
                        },
                        entities_extracted={
                            "external_sources": result.aggregated_from or [result.source_agent_url],
                        },
                    )
                else:
                    return SkillResult(
                        success=False,
                        error=result.error or "External routing failed",
                        data={"fallback_used": result.fallback_used},
                    )

            else:
                return SkillResult(
                    success=False,
                    error=f"Unknown skill: {skill_id}"
                )

        except Exception as e:
            logger.error(f"[Gateway] Skill execution error: {e}", exc_info=True)
            return SkillResult(
                success=False,
                error=str(e)
            )

    def get_agent_card(self) -> AgentCard:
        """Get the agent card for the gateway agent.

        Kept for backward compatibility - delegates to parent class.
        """
        return AgentCard(
            id=self.AGENT_ID,
            name=self.AGENT_NAME,
            description=self.AGENT_DESCRIPTION,
            provider=AgentProvider(
                organization="Lumen",
                url="https://github.com/lumen",
            ),
            role=self.AGENT_ROLE,
            priority=self.AGENT_PRIORITY,
            skills=self.get_skills(),
            capabilities=AgentCapabilities(
                streaming=False,
                pushNotifications=False,
            ),
        )

    def should_route_externally(self, query: str) -> bool:
        """Determine if a query should be routed to external agents.

        Args:
            query: The user query

        Returns:
            True if external routing is recommended
        """
        query_lower = query.lower()

        # Check for explicit external routing patterns
        for pattern in self.EXTERNAL_ROUTING_PATTERNS:
            if pattern in query_lower:
                return True

        # Check if we have matching external agents
        matches = self.federation.find_agents_for_query(query, self.min_trust_level)
        if matches and matches[0][1] > 0.5:  # Good match score
            return True

        return False

    async def route(
        self,
        query: str,
        context_id: Optional[str] = None,
        prefer_agent_url: Optional[str] = None,
        aggregate: Optional[bool] = None,
    ) -> GatewayRoutingResult:
        """Route a query through the gateway to external agents.

        Args:
            query: User query
            context_id: Optional context/session ID
            prefer_agent_url: Optional preferred external agent URL
            aggregate: Whether to aggregate from multiple agents (default: self.enable_aggregation)

        Returns:
            GatewayRoutingResult with the response
        """
        start_time = datetime.utcnow()
        aggregate = aggregate if aggregate is not None else self.enable_aggregation

        # If preferred agent specified, try it first
        if prefer_agent_url:
            result = await self._route_to_specific(prefer_agent_url, query, context_id)
            if result.success:
                return result

        # Find matching external agents
        matches = self.federation.find_agents_for_query(query, self.min_trust_level)

        if not matches:
            return GatewayRoutingResult(
                success=False,
                error="No matching external agents found",
                duration_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
            )

        # Route to single agent or aggregate
        if aggregate and len(matches) > 1:
            result = await self._route_aggregated(
                matches[:self.max_external_agents],
                query,
                context_id,
            )
        else:
            result = await self._route_single(matches[0][0], query, context_id)

        result.duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        return result

    async def _route_to_specific(
        self,
        agent_url: str,
        query: str,
        context_id: Optional[str],
    ) -> GatewayRoutingResult:
        """Route to a specific external agent."""
        agent = self.federation.get_agent(agent_url)
        if not agent or not agent.enabled or not agent.is_healthy:
            return GatewayRoutingResult(
                success=False,
                error=f"Agent at {agent_url} is not available",
            )

        return await self._route_single(agent, query, context_id)

    async def _route_single(
        self,
        agent: FederatedAgent,
        query: str,
        context_id: Optional[str],
    ) -> GatewayRoutingResult:
        """Route to a single external agent."""
        try:
            message = A2AMessage(
                role="user",
                parts=[TextPart(text=query)],
            )

            result = await self.federation.client.send_message(
                agent_url=agent.url,
                message=message,
                context_id=context_id,
            )

            if result.state == TaskState.FAILED:
                return GatewayRoutingResult(
                    success=False,
                    error=result.error or "External agent request failed",
                    source_agent_url=agent.url,
                    duration_ms=result.duration_ms,
                )

            return GatewayRoutingResult(
                success=True,
                response=result.response or "",
                source_agent_url=agent.url,
                source_agent_name=agent.agent_card.name if agent.agent_card else None,
                external_task_id=result.task_id,
                duration_ms=result.duration_ms,
            )

        except Exception as e:
            logger.error(f"[Gateway] Error routing to {agent.url}: {e}")
            return GatewayRoutingResult(
                success=False,
                error=str(e),
                source_agent_url=agent.url,
            )

    async def _route_aggregated(
        self,
        agents: List[tuple],
        query: str,
        context_id: Optional[str],
    ) -> GatewayRoutingResult:
        """Route to multiple agents and aggregate responses."""
        import asyncio

        async def query_agent(agent: FederatedAgent) -> tuple:
            """Query a single agent and return result."""
            result = await self._route_single(agent, query, context_id)
            return (agent, result)

        # Query all agents in parallel
        tasks = [query_agent(agent) for agent, _ in agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect successful responses
        successful = []
        failed = []
        aggregated_from = []

        for item in results:
            if isinstance(item, Exception):
                continue
            agent, result = item
            if result.success and result.response:
                successful.append((agent, result))
                aggregated_from.append(agent.url)
            else:
                failed.append((agent, result))

        if not successful:
            return GatewayRoutingResult(
                success=False,
                error="All external agents failed",
                aggregated_from=[a.url for a, _ in failed],
            )

        # Aggregate responses
        if len(successful) == 1:
            agent, result = successful[0]
            return GatewayRoutingResult(
                success=True,
                response=result.response,
                source_agent_url=agent.url,
                source_agent_name=agent.agent_card.name if agent.agent_card else None,
                aggregated_from=aggregated_from,
            )

        # Multiple responses - synthesize
        aggregated_response = self._synthesize_responses(successful)

        return GatewayRoutingResult(
            success=True,
            response=aggregated_response,
            aggregated_from=aggregated_from,
        )

    def _synthesize_responses(
        self,
        responses: List[tuple],
    ) -> str:
        """Synthesize multiple external agent responses."""
        sections = ["**Aggregated Response from External Agents:**\n"]

        for agent, result in responses:
            agent_name = agent.agent_card.name if agent.agent_card else agent.url
            sections.append(f"\n### From {agent_name}:\n")
            sections.append(result.response)

        return "\n".join(sections)

    async def get_federation_status(self) -> Dict[str, Any]:
        """Get status of the federation for this gateway."""
        stats = self.federation.get_statistics()
        agents = self.federation.get_all_agents()

        return {
            "statistics": stats,
            "agents": [agent.to_dict() for agent in agents],
            "min_trust_level": self.min_trust_level.value,
            "aggregation_enabled": self.enable_aggregation,
        }

    async def handle_message(self, message: A2AMessage) -> A2AMessage:
        """Handle an A2A message directed to the gateway.

        Args:
            message: Incoming A2A message

        Returns:
            Response A2A message
        """
        # Extract query
        query = ""
        for part in message.parts:
            if isinstance(part, TextPart):
                query = part.text
                break

        if not query:
            return A2AMessage(
                role="agent",
                parts=[TextPart(text="No query provided")],
                sourceAgentId="gateway-agent",
            )

        # Check if it's a federation status request
        query_lower = query.lower()
        if any(word in query_lower for word in ["status", "list", "show", "available"]):
            if "agent" in query_lower or "federation" in query_lower:
                status = await self.get_federation_status()
                return A2AMessage(
                    role="agent",
                    parts=[
                        TextPart(text=f"Federation Status:\n"
                                     f"- Total agents: {status['statistics']['total_agents']}\n"
                                     f"- Healthy agents: {status['statistics']['healthy_agents']}\n"
                                     f"- Enabled agents: {status['statistics']['enabled_agents']}"),
                        DataPart(data=status),
                    ],
                    sourceAgentId="gateway-agent",
                )

        # Route to external agents
        result = await self.route(query, context_id=message.context.get("session_id") if message.context else None)

        if result.success:
            response_text = result.response
            if result.aggregated_from:
                response_text += f"\n\n*Sources: {', '.join(result.aggregated_from)}*"

            return A2AMessage(
                role="agent",
                parts=[TextPart(text=response_text)],
                sourceAgentId="gateway-agent",
                context={
                    "external_source": result.source_agent_url,
                    "external_task_id": result.external_task_id,
                },
            )
        else:
            return A2AMessage(
                role="agent",
                parts=[TextPart(text=f"Unable to route to external agents: {result.error}")],
                sourceAgentId="gateway-agent",
            )


# Singleton instance
_gateway_agent: Optional[GatewayAgent] = None


def get_gateway_agent() -> GatewayAgent:
    """Get singleton gateway agent."""
    global _gateway_agent
    if _gateway_agent is None:
        _gateway_agent = GatewayAgent()
    return _gateway_agent


def register_gateway_agent():
    """Register the gateway agent with the A2A registry."""
    agent = get_gateway_agent()
    registry = get_agent_registry()
    registry.register(agent.get_agent_card())
    logger.info("[Gateway] Registered gateway agent with A2A registry")
    return agent
