"""A2A Agent Federation Registry.

Manages federation with external A2A agents, providing:
- Registration and discovery of external agents
- Periodic health checks
- Capability caching and routing
- Trust management
- Automatic failover

This enables Lumen to participate in a broader
A2A ecosystem by connecting to external specialized agents.
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from .types import AgentCard, AgentSkill, TaskState
from .external_client import (
    A2AExternalClient,
    ExternalAgentInfo,
    ExternalTaskResult,
    ConnectionState,
    get_external_client,
)
from .security import A2ASecurityManager, get_security_manager

logger = logging.getLogger(__name__)


class TrustLevel(str, Enum):
    """Trust level for external agents."""
    UNTRUSTED = "untrusted"      # No trust, verify everything
    VERIFIED = "verified"        # Signature verified
    TRUSTED = "trusted"          # Explicitly trusted (allowlist)
    INTERNAL = "internal"        # Internal agent (full trust)


@dataclass
class FederatedAgent:
    """A federated external agent with metadata."""
    url: str
    agent_card: Optional[AgentCard] = None
    trust_level: TrustLevel = TrustLevel.UNTRUSTED
    enabled: bool = True
    priority: int = 0  # Higher = preferred
    tags: List[str] = field(default_factory=list)
    added_at: datetime = field(default_factory=datetime.utcnow)
    last_health_check: Optional[datetime] = None
    health_check_failures: int = 0
    is_healthy: bool = False
    capabilities_cache: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "agent_id": self.agent_card.id if self.agent_card else None,
            "agent_name": self.agent_card.name if self.agent_card else None,
            "trust_level": self.trust_level.value,
            "enabled": self.enabled,
            "priority": self.priority,
            "tags": self.tags,
            "added_at": self.added_at.isoformat(),
            "last_health_check": self.last_health_check.isoformat() if self.last_health_check else None,
            "health_check_failures": self.health_check_failures,
            "is_healthy": self.is_healthy,
            "skill_count": len(self.agent_card.skills) if self.agent_card else 0,
        }


@dataclass
class FederationConfig:
    """Configuration for federation behavior."""
    health_check_interval_seconds: int = 60
    health_check_timeout_seconds: int = 10
    max_health_check_failures: int = 3
    auto_disable_unhealthy: bool = True
    require_signature_verification: bool = True
    cache_ttl_seconds: int = 300
    max_federated_agents: int = 50


class AgentFederationRegistry:
    """Registry for federated external A2A agents.

    Manages:
    - Registration of external agents
    - Periodic health checks
    - Capability-based routing to external agents
    - Trust and security policies
    - Failover when agents become unavailable
    """

    def __init__(
        self,
        config: Optional[FederationConfig] = None,
        client: Optional[A2AExternalClient] = None,
        security_manager: Optional[A2ASecurityManager] = None,
    ):
        self.config = config or FederationConfig()
        self.client = client or get_external_client()
        self.security_manager = security_manager or get_security_manager()

        self._agents: Dict[str, FederatedAgent] = {}
        self._allowlist: Set[str] = set()  # Explicitly trusted URLs
        self._blocklist: Set[str] = set()  # Blocked URLs
        self._health_check_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def start(self):
        """Start the federation registry (including health checks)."""
        if self._health_check_task is None:
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            logger.info("[Federation] Started with health check interval %ds",
                       self.config.health_check_interval_seconds)

    async def stop(self):
        """Stop the federation registry."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            self._health_check_task = None

        await self.client.close()
        logger.info("[Federation] Stopped")

    async def _health_check_loop(self):
        """Periodically check health of all federated agents."""
        while True:
            try:
                await asyncio.sleep(self.config.health_check_interval_seconds)
                await self._run_health_checks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Federation] Health check error: {e}")

    async def _run_health_checks(self):
        """Run health checks on all enabled agents."""
        async with self._lock:
            agents_to_check = [
                agent for agent in self._agents.values()
                if agent.enabled
            ]

        for agent in agents_to_check:
            try:
                is_healthy = await self.client.health_check(agent.url)
                await self._update_health_status(agent.url, is_healthy)
            except Exception as e:
                logger.warning(f"[Federation] Health check failed for {agent.url}: {e}")
                await self._update_health_status(agent.url, False)

    async def _update_health_status(self, url: str, is_healthy: bool):
        """Update health status for an agent."""
        async with self._lock:
            agent = self._agents.get(url)
            if not agent:
                return

            agent.last_health_check = datetime.utcnow()

            if is_healthy:
                agent.is_healthy = True
                agent.health_check_failures = 0
            else:
                agent.health_check_failures += 1
                if agent.health_check_failures >= self.config.max_health_check_failures:
                    agent.is_healthy = False
                    if self.config.auto_disable_unhealthy:
                        agent.enabled = False
                        logger.warning(
                            f"[Federation] Auto-disabled unhealthy agent: {url} "
                            f"(failures: {agent.health_check_failures})"
                        )

    async def register(
        self,
        url: str,
        trust_level: Optional[TrustLevel] = None,
        priority: int = 0,
        tags: Optional[List[str]] = None,
    ) -> Optional[FederatedAgent]:
        """Register an external agent with the federation.

        Args:
            url: URL of the external agent
            trust_level: Trust level (auto-determined if not specified)
            priority: Routing priority (higher = preferred)
            tags: Optional tags for categorization

        Returns:
            FederatedAgent if successful, None otherwise
        """
        # Normalize URL
        url = url.rstrip("/")
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Check blocklist
        if url in self._blocklist:
            logger.warning(f"[Federation] Rejected blocked agent: {url}")
            return None

        # Check capacity
        if len(self._agents) >= self.config.max_federated_agents:
            logger.warning(f"[Federation] Max agents reached ({self.config.max_federated_agents})")
            return None

        # Discover agent
        agent_card = await self.client.discover(url)
        if not agent_card:
            logger.error(f"[Federation] Failed to discover agent at {url}")
            return None

        # Determine trust level
        if trust_level is None:
            if url in self._allowlist:
                trust_level = TrustLevel.TRUSTED
            else:
                agent_info = self.client.get_agent_info(url)
                if agent_info and agent_info.is_trusted:
                    trust_level = TrustLevel.VERIFIED
                else:
                    trust_level = TrustLevel.UNTRUSTED

        # Enforce signature requirement for untrusted agents
        if (self.config.require_signature_verification and
            trust_level == TrustLevel.UNTRUSTED):
            logger.warning(
                f"[Federation] Agent {url} not verified - signature verification required"
            )
            # Allow registration but mark as untrusted

        async with self._lock:
            federated_agent = FederatedAgent(
                url=url,
                agent_card=agent_card,
                trust_level=trust_level,
                priority=priority,
                tags=tags or [],
                is_healthy=True,
            )

            # Cache capabilities
            federated_agent.capabilities_cache = {
                "skills": [s.id for s in agent_card.skills],
                "streaming": agent_card.capabilities.streaming,
                "skill_tags": list(set(
                    tag for skill in agent_card.skills for tag in skill.tags
                )),
            }

            self._agents[url] = federated_agent

        logger.info(
            f"[Federation] Registered agent: {agent_card.name} at {url} "
            f"(trust: {trust_level.value}, skills: {len(agent_card.skills)})"
        )

        return federated_agent

    async def unregister(self, url: str) -> bool:
        """Unregister an agent from the federation.

        Args:
            url: URL of the agent to remove

        Returns:
            True if removed, False if not found
        """
        url = url.rstrip("/")

        async with self._lock:
            if url in self._agents:
                del self._agents[url]
                logger.info(f"[Federation] Unregistered agent: {url}")
                return True

        return False

    def add_to_allowlist(self, url: str):
        """Add a URL to the trusted allowlist."""
        url = url.rstrip("/")
        self._allowlist.add(url)
        logger.info(f"[Federation] Added to allowlist: {url}")

    def add_to_blocklist(self, url: str):
        """Add a URL to the blocklist."""
        url = url.rstrip("/")
        self._blocklist.add(url)

        # Also disable if registered
        if url in self._agents:
            self._agents[url].enabled = False

        logger.info(f"[Federation] Added to blocklist: {url}")

    def remove_from_allowlist(self, url: str):
        """Remove a URL from the allowlist."""
        url = url.rstrip("/")
        self._allowlist.discard(url)

    def remove_from_blocklist(self, url: str):
        """Remove a URL from the blocklist."""
        url = url.rstrip("/")
        self._blocklist.discard(url)

    def get_agent(self, url: str) -> Optional[FederatedAgent]:
        """Get a specific federated agent."""
        url = url.rstrip("/")
        return self._agents.get(url)

    def get_all_agents(self) -> List[FederatedAgent]:
        """Get all registered federated agents."""
        return list(self._agents.values())

    def get_healthy_agents(self) -> List[FederatedAgent]:
        """Get all healthy and enabled agents."""
        return [
            agent for agent in self._agents.values()
            if agent.enabled and agent.is_healthy
        ]

    def find_agents_for_skill(
        self,
        skill_id: str,
        min_trust: TrustLevel = TrustLevel.UNTRUSTED,
    ) -> List[FederatedAgent]:
        """Find federated agents that have a specific skill.

        Args:
            skill_id: Skill ID to search for
            min_trust: Minimum trust level required

        Returns:
            List of matching agents, sorted by priority
        """
        trust_order = [
            TrustLevel.UNTRUSTED,
            TrustLevel.VERIFIED,
            TrustLevel.TRUSTED,
            TrustLevel.INTERNAL,
        ]
        min_trust_idx = trust_order.index(min_trust)

        matches = []
        for agent in self._agents.values():
            if not agent.enabled or not agent.is_healthy:
                continue

            trust_idx = trust_order.index(agent.trust_level)
            if trust_idx < min_trust_idx:
                continue

            skills = agent.capabilities_cache.get("skills", [])
            if skill_id in skills:
                matches.append(agent)

        # Sort by priority (descending) then trust level (descending)
        matches.sort(
            key=lambda a: (a.priority, trust_order.index(a.trust_level)),
            reverse=True,
        )

        return matches

    def find_agents_by_tag(
        self,
        tag: str,
        min_trust: TrustLevel = TrustLevel.UNTRUSTED,
    ) -> List[FederatedAgent]:
        """Find federated agents by skill tag.

        Args:
            tag: Tag to search for
            min_trust: Minimum trust level required

        Returns:
            List of matching agents
        """
        trust_order = [
            TrustLevel.UNTRUSTED,
            TrustLevel.VERIFIED,
            TrustLevel.TRUSTED,
            TrustLevel.INTERNAL,
        ]
        min_trust_idx = trust_order.index(min_trust)

        matches = []
        for agent in self._agents.values():
            if not agent.enabled or not agent.is_healthy:
                continue

            trust_idx = trust_order.index(agent.trust_level)
            if trust_idx < min_trust_idx:
                continue

            skill_tags = agent.capabilities_cache.get("skill_tags", [])
            if tag.lower() in [t.lower() for t in skill_tags]:
                matches.append(agent)

        matches.sort(key=lambda a: a.priority, reverse=True)
        return matches

    def find_agents_for_query(
        self,
        query: str,
        min_trust: TrustLevel = TrustLevel.UNTRUSTED,
    ) -> List[Tuple[FederatedAgent, float]]:
        """Find federated agents that might handle a query.

        Uses skill examples and descriptions for matching.

        Args:
            query: User query
            min_trust: Minimum trust level required

        Returns:
            List of (agent, score) tuples, sorted by score
        """
        trust_order = [
            TrustLevel.UNTRUSTED,
            TrustLevel.VERIFIED,
            TrustLevel.TRUSTED,
            TrustLevel.INTERNAL,
        ]
        min_trust_idx = trust_order.index(min_trust)

        query_lower = query.lower()
        query_words = set(query_lower.split())

        results = []
        for agent in self._agents.values():
            if not agent.enabled or not agent.is_healthy:
                continue
            if not agent.agent_card:
                continue

            trust_idx = trust_order.index(agent.trust_level)
            if trust_idx < min_trust_idx:
                continue

            # Score based on skill matching
            max_score = 0.0
            for skill in agent.agent_card.skills:
                score = 0.0

                # Check examples
                for example in skill.examples:
                    example_words = set(example.lower().split())
                    overlap = len(query_words & example_words)
                    if overlap > 0:
                        score = max(score, overlap / max(len(query_words), 1))

                # Check tags
                for tag in skill.tags:
                    if tag.lower() in query_lower:
                        score = max(score, 0.5)

                # Check description
                desc_words = set(skill.description.lower().split())
                overlap = len(query_words & desc_words)
                if overlap > 0:
                    score = max(score, overlap / max(len(query_words), 1) * 0.7)

                max_score = max(max_score, score)

            if max_score > 0.1:
                # Boost by priority and trust
                final_score = max_score * (1 + agent.priority * 0.1)
                final_score *= (1 + trust_idx * 0.1)
                results.append((agent, final_score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results

    async def route_to_external(
        self,
        query: str,
        context_id: Optional[str] = None,
        min_trust: TrustLevel = TrustLevel.VERIFIED,
    ) -> Optional[ExternalTaskResult]:
        """Route a query to the best matching external agent.

        Args:
            query: User query
            context_id: Optional context ID
            min_trust: Minimum trust level

        Returns:
            ExternalTaskResult or None if no matching agent
        """
        matches = self.find_agents_for_query(query, min_trust)

        if not matches:
            return None

        # Try agents in order of score
        for agent, score in matches[:3]:  # Try top 3
            try:
                from .types import A2AMessage, TextPart

                message = A2AMessage(
                    role="user",
                    parts=[TextPart(text=query)],
                )

                result = await self.client.send_message(
                    agent_url=agent.url,
                    message=message,
                    context_id=context_id,
                )

                if result.state != TaskState.FAILED:
                    return result

            except Exception as e:
                logger.warning(f"[Federation] Failed to route to {agent.url}: {e}")
                continue

        return None

    def get_statistics(self) -> Dict[str, Any]:
        """Get federation statistics."""
        agents = list(self._agents.values())

        return {
            "total_agents": len(agents),
            "healthy_agents": sum(1 for a in agents if a.is_healthy),
            "enabled_agents": sum(1 for a in agents if a.enabled),
            "by_trust_level": {
                level.value: sum(1 for a in agents if a.trust_level == level)
                for level in TrustLevel
            },
            "total_skills": sum(
                len(a.agent_card.skills) if a.agent_card else 0
                for a in agents
            ),
            "allowlist_size": len(self._allowlist),
            "blocklist_size": len(self._blocklist),
        }


# Singleton instance
_federation_registry: Optional[AgentFederationRegistry] = None


def get_federation_registry() -> AgentFederationRegistry:
    """Get singleton federation registry."""
    global _federation_registry
    if _federation_registry is None:
        _federation_registry = AgentFederationRegistry()
    return _federation_registry


async def init_federation_registry() -> AgentFederationRegistry:
    """Initialize and start the federation registry."""
    registry = get_federation_registry()
    await registry.start()
    return registry


async def shutdown_federation_registry():
    """Shutdown the federation registry."""
    global _federation_registry
    if _federation_registry:
        await _federation_registry.stop()
        _federation_registry = None
