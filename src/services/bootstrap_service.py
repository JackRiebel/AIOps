"""
Bootstrap Service - Auto-fetch platform context before AI response.

This service automatically executes platform bootstrap API calls (like listing
organizations, sites, tests) BEFORE the AI gets to respond. The results are
injected into the session context so the AI has all the IDs it needs without
having to call discovery tools.

Key features:
- Parallel execution across platforms
- Memory + Redis caching with configurable TTLs
- Dependency resolution (networks depend on organizations)
- Graceful failure handling
"""

import asyncio
import logging
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


@dataclass
class BootstrapConfig:
    """Configuration for a bootstrap API call."""
    name: str                           # e.g., "organizations"
    tool_name: str                      # e.g., "meraki_list_organizations"
    params: Dict[str, Any] = field(default_factory=dict)  # Parameters to pass
    cache_ttl: int = 3600               # Cache TTL in seconds (default 1 hour)
    depends_on: Optional[str] = None    # Dependency (e.g., "organizations" for networks)


@dataclass
class BootstrapResult:
    """Cached result from a bootstrap call."""
    name: str
    data: Any
    cached_at: datetime = field(default_factory=datetime.utcnow)
    ttl: int = 3600


# Bootstrap configurations per platform
BOOTSTRAP_CONFIGS: Dict[str, List[BootstrapConfig]] = {
    "meraki": [
        BootstrapConfig(
            name="organizations",
            tool_name="meraki_list_organizations",
            params={},
            cache_ttl=3600,  # 1 hour
        ),
        # Networks are fetched per-org after organizations
    ],
    "catalyst": [
        BootstrapConfig(
            name="sites",
            tool_name="catalyst_get_sites",
            params={},
            cache_ttl=3600,  # 1 hour
        ),
    ],
    "thousandeyes": [
        BootstrapConfig(
            name="tests",
            tool_name="thousandeyes_list_tests",
            params={},
            cache_ttl=1800,  # 30 min
        ),
        BootstrapConfig(
            name="agents",
            tool_name="thousandeyes_list_agents",
            params={},
            cache_ttl=3600,  # 1 hour
        ),
    ],
    "splunk": [
        BootstrapConfig(
            name="saved_searches",
            tool_name="splunk_list_saved_searches",
            params={},
            cache_ttl=1800,  # 30 min
        ),
    ],
}


class BootstrapCache:
    """Cache for bootstrap results with memory and optional Redis support."""

    def __init__(self, redis_client=None):
        self._redis = redis_client
        self._memory_cache: Dict[str, BootstrapResult] = {}

    def cache_key(self, platform: str, session_id: str, name: str) -> str:
        """Generate cache key."""
        return f"bootstrap:{platform}:{session_id}:{name}"

    async def get(self, key: str) -> Optional[BootstrapResult]:
        """Get cached result."""
        # Try memory first
        if key in self._memory_cache:
            result = self._memory_cache[key]
            if not self.is_stale(result):
                return result
            else:
                del self._memory_cache[key]

        # Try Redis if available
        if self._redis:
            try:
                cached = await self._redis.get(key)
                if cached:
                    data = json.loads(cached)
                    return BootstrapResult(
                        name=data["name"],
                        data=data["data"],
                        cached_at=datetime.fromisoformat(data["cached_at"]),
                        ttl=data["ttl"],
                    )
            except Exception as e:
                logger.debug(f"Redis cache get failed: {e}")

        return None

    async def set(self, key: str, result: BootstrapResult) -> None:
        """Store result in cache."""
        # Always store in memory
        self._memory_cache[key] = result

        # Store in Redis if available
        if self._redis:
            try:
                data = {
                    "name": result.name,
                    "data": result.data,
                    "cached_at": result.cached_at.isoformat(),
                    "ttl": result.ttl,
                }
                await self._redis.setex(key, result.ttl, json.dumps(data))
            except Exception as e:
                logger.debug(f"Redis cache set failed: {e}")

    def is_stale(self, result: BootstrapResult) -> bool:
        """Check if result is stale."""
        elapsed = (datetime.utcnow() - result.cached_at).total_seconds()
        return elapsed > result.ttl


class BootstrapService:
    """Executes platform bootstrap calls before AI interaction."""

    def __init__(self, cache: Optional[BootstrapCache] = None):
        self._cache = cache or BootstrapCache()
        self._tool_registry = None  # Lazy load

    def _get_registry(self):
        """Lazy load tool registry to avoid circular imports."""
        if self._tool_registry is None:
            from src.services.tool_registry import get_tool_registry
            self._tool_registry = get_tool_registry()
        return self._tool_registry

    async def run_bootstrap(
        self,
        credential_pool,
        session_id: str,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """Execute all applicable bootstrap calls for available platforms.

        Args:
            credential_pool: Pool of available credentials
            session_id: Session ID for caching
            force_refresh: Skip cache and re-fetch

        Returns:
            Dict with bootstrap data keyed by platform
        """
        available = credential_pool.get_available_platforms()
        results = {}

        logger.info(f"[Bootstrap] Starting for platforms: {available}")

        # Run bootstrap for each available platform in parallel
        tasks = []
        platforms_to_bootstrap = []
        for platform in available:
            if platform in BOOTSTRAP_CONFIGS:
                tasks.append(
                    self._bootstrap_platform(
                        platform=platform,
                        credential_pool=credential_pool,
                        session_id=session_id,
                        force_refresh=force_refresh,
                    )
                )
                platforms_to_bootstrap.append(platform)

        if tasks:
            platform_results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, platform in enumerate(platforms_to_bootstrap):
                result = platform_results[i]
                if isinstance(result, Exception):
                    logger.warning(f"[Bootstrap] Failed for {platform}: {result}")
                elif result:
                    results[platform] = result
                    logger.info(f"[Bootstrap] {platform}: {list(result.keys())}")

        return results

    async def _bootstrap_platform(
        self,
        platform: str,
        credential_pool,
        session_id: str,
        force_refresh: bool,
    ) -> Dict[str, Any]:
        """Execute bootstrap for a single platform."""
        configs = BOOTSTRAP_CONFIGS.get(platform, [])
        results = {}

        for config in configs:
            # Check cache first
            if not force_refresh:
                cache_key = self._cache.cache_key(platform, session_id, config.name)
                cached = await self._cache.get(cache_key)
                if cached:
                    results[config.name] = cached.data
                    logger.debug(f"[Bootstrap] Cache hit: {platform}/{config.name}")
                    continue

            # Skip if dependency not met
            if config.depends_on and config.depends_on not in results:
                logger.debug(f"[Bootstrap] Skipping {config.name}: dependency {config.depends_on} not met")
                continue

            # Execute bootstrap call
            try:
                result = await self._execute_bootstrap_call(
                    config=config,
                    platform=platform,
                    credential_pool=credential_pool,
                    prior_results=results,
                )

                if result.get("success"):
                    data = result.get("data", [])
                    results[config.name] = data

                    # Cache result
                    await self._cache.set(
                        self._cache.cache_key(platform, session_id, config.name),
                        BootstrapResult(
                            name=config.name,
                            data=data,
                            ttl=config.cache_ttl,
                        ),
                    )
                    logger.debug(f"[Bootstrap] Fetched {platform}/{config.name}: {len(data) if isinstance(data, list) else 'ok'}")
                else:
                    logger.warning(f"[Bootstrap] {config.tool_name} failed: {result.get('error')}")

            except Exception as e:
                logger.warning(f"[Bootstrap] {config.tool_name} error: {e}")

        # Special handling: fetch networks for each Meraki org
        if platform == "meraki" and "organizations" in results:
            results["networks"] = await self._fetch_meraki_networks(
                credential_pool=credential_pool,
                session_id=session_id,
                organizations=results["organizations"],
                force_refresh=force_refresh,
            )

        return results

    async def _fetch_meraki_networks(
        self,
        credential_pool,
        session_id: str,
        organizations: List[Dict],
        force_refresh: bool,
    ) -> Dict[str, List[Dict]]:
        """Fetch networks for all Meraki organizations."""
        networks_by_org = {}

        for org in organizations[:5]:  # Limit to first 5 orgs to avoid rate limiting
            org_id = str(org.get("id", ""))
            if not org_id:
                continue

            # Check cache
            cache_key = self._cache.cache_key("meraki", session_id, f"networks_{org_id}")
            if not force_refresh:
                cached = await self._cache.get(cache_key)
                if cached:
                    networks_by_org[org_id] = cached.data
                    continue

            # Fetch networks
            try:
                registry = self._get_registry()
                tool = registry.get("meraki_list_organization_networks")
                if not tool or not tool.handler:
                    continue

                # Get credentials
                from src.services.credential_pool import CredentialPool
                creds = credential_pool.get_for_meraki(organization_id=org_id)
                if not creds:
                    continue

                # Create execution context
                from src.services.tools.meraki import MerakiExecutionContext
                context = MerakiExecutionContext(
                    api_key=creds.credentials.get("meraki_api_key") or creds.credentials.get("api_key"),
                    org_id=org_id,
                )

                result = await tool.handler({"organization_id": org_id}, context)
                if result.get("success"):
                    data = result.get("data", [])
                    networks_by_org[org_id] = data

                    # Cache
                    await self._cache.set(
                        cache_key,
                        BootstrapResult(name=f"networks_{org_id}", data=data, ttl=1800),
                    )

            except Exception as e:
                logger.debug(f"[Bootstrap] Failed to fetch networks for org {org_id}: {e}")

        return networks_by_org

    async def _execute_bootstrap_call(
        self,
        config: BootstrapConfig,
        platform: str,
        credential_pool,
        prior_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute a single bootstrap tool call."""
        registry = self._get_registry()
        tool = registry.get(config.tool_name)

        if not tool:
            return {"success": False, "error": f"Tool not found: {config.tool_name}"}

        if not tool.handler:
            return {"success": False, "error": f"Tool has no handler: {config.tool_name}"}

        # Resolve parameters
        params = dict(config.params)

        # Get credentials
        creds = credential_pool.get_for_platform(platform)
        if not creds:
            return {"success": False, "error": f"No credentials for {platform}"}

        # Create execution context based on platform
        context = self._create_execution_context(platform, creds)
        if not context:
            return {"success": False, "error": f"Cannot create context for {platform}"}

        # Execute
        try:
            return await tool.handler(params, context)
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _create_execution_context(self, platform: str, creds):
        """Create execution context for a platform."""
        try:
            if platform == "meraki":
                from src.services.tools.meraki import MerakiExecutionContext
                return MerakiExecutionContext(
                    api_key=creds.credentials.get("meraki_api_key") or creds.credentials.get("api_key"),
                    org_id=creds.org_ids[0] if creds.org_ids else "",
                )
            elif platform == "catalyst":
                from src.services.tools.catalyst import CatalystExecutionContext
                return CatalystExecutionContext(
                    username=creds.credentials.get("catalyst_username"),
                    password=creds.credentials.get("catalyst_password"),
                    base_url=creds.credentials.get("catalyst_base_url"),
                    api_token=creds.credentials.get("catalyst_token"),
                )
            elif platform == "thousandeyes":
                from src.services.tools.thousandeyes import ThousandEyesExecutionContext
                return ThousandEyesExecutionContext(
                    oauth_token=creds.credentials.get("thousandeyes_token"),
                )
            elif platform == "splunk":
                from src.services.tools.splunk import SplunkExecutionContext
                return SplunkExecutionContext(
                    base_url=creds.credentials.get("base_url"),
                    username=creds.credentials.get("username"),
                    password=creds.credentials.get("password"),
                    token=creds.credentials.get("splunk_token"),
                    verify_ssl=creds.credentials.get("verify_ssl", False),
                )
        except Exception as e:
            logger.warning(f"[Bootstrap] Failed to create context for {platform}: {e}")

        return None


# Singleton instance
_bootstrap_service: Optional[BootstrapService] = None


def get_bootstrap_service(redis_client=None) -> BootstrapService:
    """Get or create the bootstrap service singleton."""
    global _bootstrap_service
    if _bootstrap_service is None:
        cache = BootstrapCache(redis_client)
        _bootstrap_service = BootstrapService(cache)
    return _bootstrap_service


def reset_bootstrap_service() -> None:
    """Reset the singleton (for testing)."""
    global _bootstrap_service
    _bootstrap_service = None
