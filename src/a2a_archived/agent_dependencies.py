"""Agent Dependencies Loader for Multi-Agent System.

This module provides dependency loading for specialist agents, including:
- Organization credentials
- Cached network/device data
- Per-agent dependency lists based on org type

Each specialist agent operates on specific org types:
- MerakiAgent: orgs with Meraki API
- ThousandEyesAgent: orgs with ThousandEyes API
- CatalystAgent: orgs with Catalyst Center API
- SplunkAgent: orgs with Splunk API
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from src.services.credential_manager import CredentialManager
from src.services.network_cache_service import NetworkCacheService
from src.services.session_context_store import (
    get_session_context_store,
    EntityType,
    OrgType,
)

logger = logging.getLogger(__name__)


# Mapping of org types to agent IDs
ORG_TYPE_TO_AGENT = {
    "meraki": "meraki-agent",
    "catalyst": "catalyst-agent",
    "thousandeyes": "thousandeyes-agent",
    "splunk": "splunk-agent",
}

# Mapping of agent IDs to supported org types
AGENT_TO_ORG_TYPES = {
    "meraki-agent": ["meraki"],
    "catalyst-agent": ["catalyst"],
    "thousandeyes-agent": ["thousandeyes"],
    "splunk-agent": ["splunk"],
    "ui-agent": ["meraki", "catalyst", "thousandeyes", "splunk"],  # UI agent works with all
}


@dataclass
class AgentDependency:
    """Represents an organization/system available to a specialist agent."""
    org_name: str
    org_id: str  # Organization ID (from cache or API)
    org_type: str  # "meraki", "catalyst", "thousandeyes", "splunk"

    # Quick stats from cache
    cached_networks_count: int = 0
    cached_devices_count: int = 0

    # Whether data is stale
    is_stale: bool = False

    # Additional metadata
    display_name: Optional[str] = None
    base_url: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "org_name": self.org_name,
            "org_id": self.org_id,
            "org_type": self.org_type,
            "cached_networks_count": self.cached_networks_count,
            "cached_devices_count": self.cached_devices_count,
            "is_stale": self.is_stale,
            "display_name": self.display_name,
            "base_url": self.base_url,
        }


@dataclass
class AgentOrgContext:
    """Full context for an agent operating on a specific organization."""
    org_name: str
    org_id: str
    org_type: str

    # Credentials (decrypted at runtime)
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    username: Optional[str] = None
    base_url: Optional[str] = None
    verify_ssl: bool = True

    # Cached data for quick responses
    cached_networks: List[Dict[str, Any]] = field(default_factory=list)
    cached_devices: List[Dict[str, Any]] = field(default_factory=list)

    # Session context
    session_id: Optional[str] = None
    user_id: Optional[str] = None

    def has_cached_data(self) -> bool:
        """Check if context has cached data."""
        return bool(self.cached_networks or self.cached_devices)

    def to_execution_context(self):
        """Convert to AgentExecutionContext for skill execution.

        Also enriches the context with discovered entities from the
        SessionContextStore if session_id is available.
        """
        from src.a2a.specialists.base_specialist import AgentExecutionContext

        # Start with base cached data
        networks = list(self.cached_networks)
        devices = list(self.cached_devices)
        entities_from_session: Dict[str, Any] = {}

        # Enrich with entities discovered during this session
        if self.session_id:
            try:
                # Synchronous access to session context (best effort)
                # The store is already populated by _execute_tool calls
                context_store = get_session_context_store()
                if self.session_id in context_store._memory_store:
                    session_ctx = context_store._memory_store[self.session_id]

                    # Add discovered networks not in cache
                    session_networks = session_ctx.get_all_entities(EntityType.NETWORK)
                    for net_entity in session_networks:
                        if not any(n.get("id") == net_entity.id for n in networks):
                            networks.append({
                                "id": net_entity.id,
                                "name": net_entity.name or net_entity.id,
                                **net_entity.data
                            })

                    # Add discovered devices not in cache
                    session_devices = session_ctx.get_all_entities(EntityType.DEVICE)
                    for dev_entity in session_devices:
                        if not any(d.get("serial") == dev_entity.id for d in devices):
                            devices.append({
                                "serial": dev_entity.id,
                                "name": dev_entity.name or dev_entity.id,
                                **dev_entity.data
                            })

                    # Add other discovered entities to context
                    session_vlans = session_ctx.get_all_entities(EntityType.VLAN)
                    if session_vlans:
                        entities_from_session["vlans"] = [
                            {"id": v.id, "name": v.name, **v.data}
                            for v in session_vlans
                        ]

                    session_ssids = session_ctx.get_all_entities(EntityType.SSID)
                    if session_ssids:
                        entities_from_session["ssids"] = [
                            {"number": s.id, "name": s.name, **s.data}
                            for s in session_ssids
                        ]

                    # Log enrichment
                    if session_networks or session_devices:
                        logger.debug(
                            f"[AgentOrgContext] Enriched context with "
                            f"{len(session_networks)} session networks, "
                            f"{len(session_devices)} session devices"
                        )

            except Exception as e:
                logger.warning(f"[AgentOrgContext] Could not enrich from session: {e}")

        return AgentExecutionContext(
            org_name=self.org_name,
            org_id=self.org_id,
            org_type=self.org_type,
            api_key=self.api_key,
            api_secret=self.api_secret,
            base_url=self.base_url,
            cached_networks=networks,
            cached_devices=devices,
            session_id=self.session_id,
            user_id=self.user_id,
            entities_from_previous_turns=entities_from_session,
        )


class AgentDependencyLoader:
    """Loads dependencies for specialist agents.

    Provides each agent with:
    - List of organizations it can operate on
    - Credentials for those organizations
    - Cached data for quick responses

    Usage:
        loader = AgentDependencyLoader()

        # Get all orgs for Meraki agent
        meraki_deps = await loader.load_for_agent("meraki-agent")

        # Get full context for a specific org
        context = await loader.load_org_context("MyMerakiOrg")
    """

    def __init__(self):
        self.credential_manager = CredentialManager()
        self.cache_service = NetworkCacheService()
        self._dependency_cache: Dict[str, List[AgentDependency]] = {}

    async def load_for_agent(self, agent_id: str, refresh: bool = False) -> List[AgentDependency]:
        """Load all organizations/dependencies available to a specific agent.

        Args:
            agent_id: The agent ID (e.g., "meraki-agent")
            refresh: Force refresh from database

        Returns:
            List of AgentDependency objects for orgs this agent can operate on
        """
        # Check cache unless refresh requested
        if not refresh and agent_id in self._dependency_cache:
            return self._dependency_cache[agent_id]

        # Get supported org types for this agent
        supported_types = AGENT_TO_ORG_TYPES.get(agent_id, [])
        if not supported_types:
            logger.warning(f"Unknown agent ID: {agent_id}")
            return []

        # Get all clusters/orgs
        clusters = await self.credential_manager.list_clusters(active_only=True)

        dependencies = []
        for cluster in clusters:
            # Determine org type from base URL
            org_type = self._detect_org_type(cluster.url)

            # Skip if not supported by this agent
            if org_type not in supported_types:
                continue

            # Get cached data counts
            cached_networks = await self.cache_service.get_cached_networks(cluster.name)
            cached_devices = await self.cache_service.get_cached_devices(cluster.name)

            # Check if stale
            is_stale = any(n.get("is_stale") == "true" for n in cached_networks)

            # Get org ID from cached data or use name
            org_id = ""
            if cached_networks:
                # For Meraki, the org ID might be in raw_data
                first_network = cached_networks[0]
                raw_data = first_network.get("raw_data", {})
                org_id = raw_data.get("organizationId", cluster.name)
            else:
                org_id = cluster.name

            dep = AgentDependency(
                org_name=cluster.name,
                org_id=org_id,
                org_type=org_type,
                cached_networks_count=len(cached_networks),
                cached_devices_count=len(cached_devices),
                is_stale=is_stale,
                display_name=cluster.display_name,
                base_url=cluster.url,
            )
            dependencies.append(dep)

        # Cache for future calls
        self._dependency_cache[agent_id] = dependencies

        logger.info(f"[DependencyLoader] Loaded {len(dependencies)} dependencies for {agent_id}")
        return dependencies

    async def load_org_context(
        self,
        org_name: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        sync_cache: bool = True
    ) -> Optional[AgentOrgContext]:
        """Load full context for operating on a specific organization.

        This includes decrypted credentials and cached data.

        Args:
            org_name: Organization name
            session_id: Session ID for tracking
            user_id: User ID for audit
            sync_cache: Whether to sync cache if stale (default True)

        Returns:
            AgentOrgContext with credentials and cached data, or None if not found
        """
        # Get credentials
        credentials = await self.credential_manager.get_credentials(org_name)
        if not credentials:
            logger.warning(f"No credentials found for org: {org_name}")
            return None

        # Detect org type
        org_type = self._detect_org_type(credentials["base_url"])

        # Optionally sync cache
        if sync_cache:
            try:
                await self.cache_service.sync_organization(org_name)
            except Exception as e:
                logger.warning(f"Failed to sync cache for {org_name}: {e}")

        # Get cached data
        cached_networks = await self.cache_service.get_cached_networks(org_name)
        cached_devices = await self.cache_service.get_cached_devices(org_name)

        # Get org ID from cached data or fetch from API
        org_id = org_name
        if cached_networks:
            first_network = cached_networks[0]
            raw_data = first_network.get("raw_data", {})
            org_id = raw_data.get("organizationId", org_name)
        elif org_type == "meraki" and credentials.get("api_key"):
            # If no cache, try to fetch org_id from Meraki API
            try:
                from src.services.meraki_api import MerakiAPIClient
                async with MerakiAPIClient(api_key=credentials.get("api_key")) as client:
                    orgs = await client.get("/organizations")
                    if orgs and len(orgs) > 0:
                        # Find org matching name or use first one
                        matching_org = next(
                            (o for o in orgs if o.get("name", "").lower() == org_name.lower()),
                            orgs[0]
                        )
                        org_id = matching_org.get("id", org_name)
                        logger.info(f"[DependencyLoader] Fetched org_id from API: {org_id}")
            except Exception as e:
                logger.warning(f"[DependencyLoader] Could not fetch org_id from API: {e}")

        return AgentOrgContext(
            org_name=org_name,
            org_id=org_id,
            org_type=org_type,
            api_key=credentials.get("api_key"),
            username=credentials.get("username"),
            base_url=credentials["base_url"],
            verify_ssl=credentials.get("verify_ssl", True),
            cached_networks=cached_networks,
            cached_devices=cached_devices,
            session_id=session_id,
            user_id=user_id,
        )

    async def get_orgs_by_type(self, org_type: str) -> List[AgentDependency]:
        """Get all organizations of a specific type.

        Args:
            org_type: The org type ("meraki", "catalyst", "thousandeyes", "splunk")

        Returns:
            List of AgentDependency objects
        """
        agent_id = ORG_TYPE_TO_AGENT.get(org_type)
        if not agent_id:
            return []
        return await self.load_for_agent(agent_id)

    async def get_all_orgs(self) -> List[AgentDependency]:
        """Get all configured organizations.

        Returns:
            List of AgentDependency objects for all org types
        """
        all_deps = []
        seen_orgs = set()

        for agent_id in AGENT_TO_ORG_TYPES.keys():
            if agent_id == "ui-agent":
                continue  # Skip UI agent as it's a meta-agent

            deps = await self.load_for_agent(agent_id)
            for dep in deps:
                if dep.org_name not in seen_orgs:
                    all_deps.append(dep)
                    seen_orgs.add(dep.org_name)

        return all_deps

    async def get_agents_for_org(self, org_name: str) -> List[str]:
        """Get list of agent IDs that can operate on a given organization.

        Args:
            org_name: Organization name

        Returns:
            List of agent IDs
        """
        credentials = await self.credential_manager.get_credentials(org_name)
        if not credentials:
            return []

        org_type = self._detect_org_type(credentials["base_url"])

        agents = []
        for agent_id, supported_types in AGENT_TO_ORG_TYPES.items():
            if org_type in supported_types:
                agents.append(agent_id)

        return agents

    def _detect_org_type(self, base_url: str) -> str:
        """Detect organization type from base URL.

        Args:
            base_url: API base URL

        Returns:
            Org type string
        """
        base_url_lower = base_url.lower()

        if "thousandeyes.com" in base_url_lower:
            return "thousandeyes"
        elif ":8089" in base_url_lower or "splunk" in base_url_lower:
            return "splunk"
        elif "dna" in base_url_lower or "catalyst" in base_url_lower or "maglev" in base_url_lower:
            return "catalyst"
        else:
            # Default to Meraki for api.meraki.com and similar
            return "meraki"

    def clear_cache(self, agent_id: Optional[str] = None) -> None:
        """Clear the dependency cache.

        Args:
            agent_id: Specific agent to clear, or None to clear all
        """
        if agent_id:
            if agent_id in self._dependency_cache:
                del self._dependency_cache[agent_id]
        else:
            self._dependency_cache.clear()


# Global instance for convenience
_loader: Optional[AgentDependencyLoader] = None


def get_dependency_loader() -> AgentDependencyLoader:
    """Get the global dependency loader instance."""
    global _loader
    if _loader is None:
        _loader = AgentDependencyLoader()
    return _loader
