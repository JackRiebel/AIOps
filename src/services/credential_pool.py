"""Platform-Aware Credential Pool Service.

This module provides dynamic credential resolution for multi-platform
tool execution. Each platform has different authentication models:

- Meraki: API key with multi-org access (requires org discovery)
- Catalyst: Token/password with base_url as identifier
- ThousandEyes: OAuth token (usually single account)
- Splunk: Token/password with base_url as identifier

Features:
- Automatic platform detection from credential keys
- Meraki org discovery (maps org_id → credentials)
- Redis caching for org mappings (1 hour TTL)
- In-memory fallback when Redis unavailable

Usage:
    pool = CredentialPool()
    await pool.load_all()
    await pool.discover_meraki_orgs()

    # Resolve credentials for a tool
    cred = pool.get_for_platform(
        platform="meraki",
        organization_id="248496"
    )
"""

import logging
import json
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum

logger = logging.getLogger(__name__)

# Cache configuration
CACHE_KEY_ORG_MAPPINGS = "credential_pool:meraki_org_mappings"
CACHE_TTL_SECONDS = 3600  # 1 hour


class Platform(Enum):
    """Supported platform types."""
    MERAKI = "meraki"
    CATALYST = "catalyst"
    THOUSANDEYES = "thousandeyes"
    SPLUNK = "splunk"
    KNOWLEDGE = "knowledge"


def _is_valid_meraki_key(api_key: str) -> bool:
    """Validate Meraki API key format.

    Valid Meraki API keys are:
    - Exactly 40 characters
    - Alphanumeric only (a-z, A-Z, 0-9)
    - NOT a JWT (no dots)

    Args:
        api_key: The API key string to validate

    Returns:
        True if the key matches Meraki format, False otherwise
    """
    if not api_key or len(api_key) != 40:
        return False
    if '.' in api_key:  # JWT tokens have dots
        return False
    return api_key.isalnum()


@dataclass
class PlatformCredential:
    """Credentials for a specific platform.

    Attributes:
        platform: Platform type
        cluster_name: User-defined cluster name from DB
        cluster_id: Database cluster ID
        credentials: Full credential dict
        org_ids: Meraki org IDs this key can access
        base_url: Instance URL (Catalyst/Splunk)
        account_id: ThousandEyes account ID
    """
    platform: Platform
    cluster_name: str
    cluster_id: int
    credentials: Dict[str, Any]
    org_ids: List[str] = field(default_factory=list)
    base_url: str = ""
    account_id: str = ""


class CredentialPool:
    """Manages multi-platform credentials with dynamic resolution.

    This class loads all available credentials from the database and
    provides platform-specific resolution methods. For Meraki, it
    discovers accessible organizations per API key.

    Features:
    - Redis caching for Meraki org mappings (1 hour TTL)
    - In-memory fallback when Redis unavailable
    - Per-request credential resolution

    Resolution priority:
    1. Direct identifier match (org_id, base_url)
    2. Session context (previously used org)
    3. First available for platform
    """

    def __init__(self, redis_client=None):
        """Initialize empty credential pool.

        Args:
            redis_client: Optional Redis client for caching org mappings
        """
        self._redis = redis_client
        self._by_platform: Dict[Platform, List[PlatformCredential]] = {
            p: [] for p in Platform
        }
        self._meraki_org_map: Dict[str, PlatformCredential] = {}
        self._catalyst_instance_map: Dict[str, PlatformCredential] = {}
        self._splunk_instance_map: Dict[str, PlatformCredential] = {}
        self._loaded = False
        self._orgs_discovered = False
        # In-memory cache fallback (stores timestamp and data)
        self._memory_cache: Dict[str, tuple] = {}

    async def _load_from_system_config(self) -> None:
        """Load credentials from system_config table.

        This is the preferred method for storing single API keys.
        Keys loaded: meraki_api_key, thousandeyes_oauth_token, catalyst_center_*,
                     splunk_host, splunk_hec_token, etc.
        """
        try:
            from src.services.config_service import get_config_service
            config_service = get_config_service()

            # Load Meraki from system_config
            meraki_key = await config_service.get_config("meraki_api_key")
            if meraki_key and _is_valid_meraki_key(meraki_key):
                logger.info("[CredPool] Found Meraki API key in system_config: [REDACTED]")
                pc = PlatformCredential(
                    platform=Platform.MERAKI,
                    cluster_name="system_config",
                    cluster_id=0,  # System config has no cluster ID
                    credentials={"meraki_api_key": meraki_key, "api_key": meraki_key},
                )
                self._by_platform[Platform.MERAKI].append(pc)

            # Load ThousandEyes from system_config
            te_token = await config_service.get_config("thousandeyes_oauth_token")
            if te_token:
                logger.info("[CredPool] Found ThousandEyes token in system_config")
                pc = PlatformCredential(
                    platform=Platform.THOUSANDEYES,
                    cluster_name="system_config",
                    cluster_id=0,
                    credentials={"thousandeyes_token": te_token},
                )
                self._by_platform[Platform.THOUSANDEYES].append(pc)

            # Load Catalyst from system_config
            catalyst_host = await config_service.get_config("catalyst_center_host")
            catalyst_user = await config_service.get_config("catalyst_center_username")
            catalyst_pass = await config_service.get_config("catalyst_center_password")
            if catalyst_host and catalyst_user and catalyst_pass:
                logger.info("[CredPool] Found Catalyst Center credentials in system_config")
                pc = PlatformCredential(
                    platform=Platform.CATALYST,
                    cluster_name="system_config",
                    cluster_id=0,
                    credentials={
                        "catalyst_base_url": catalyst_host,
                        "catalyst_username": catalyst_user,
                        "catalyst_password": catalyst_pass,
                    },
                    base_url=catalyst_host,
                )
                self._by_platform[Platform.CATALYST].append(pc)
                self._catalyst_instance_map[catalyst_host] = pc

            # Load Splunk from system_config
            splunk_host = await config_service.get_config("splunk_host")
            splunk_token = await config_service.get_config("splunk_hec_token")
            splunk_api_url = await config_service.get_config("splunk_api_url")
            splunk_user = await config_service.get_config("splunk_username")
            splunk_pass = await config_service.get_config("splunk_password")
            splunk_bearer = await config_service.get_config("splunk_bearer_token")
            # Load per-credential verify_ssl setting (stored as string "true"/"false" in DB)
            splunk_verify_ssl_str = await config_service.get_config("splunk_verify_ssl")
            # Default to False for self-signed certs, common in local Splunk
            splunk_verify_ssl = splunk_verify_ssl_str.lower() == "true" if splunk_verify_ssl_str else False

            # Accept either splunk_host OR splunk_api_url as valid host identifier
            splunk_base = splunk_api_url or splunk_host
            if splunk_base and (splunk_token or splunk_bearer or (splunk_user and splunk_pass)):
                logger.info(f"[CredPool] Found Splunk credentials in system_config: base_url={splunk_base}, bearer={bool(splunk_bearer)}, hec={bool(splunk_token)}, verify_ssl={splunk_verify_ssl}")
                # Map credentials to match what unified_chat_service expects:
                # - "token" = API auth token (bearer or Splunk token) for search API
                # - "splunk_token" = HEC token for sending events
                # - "splunk_username"/"splunk_password" = basic auth fallback
                # - "verify_ssl" = SSL verification setting from UI
                pc = PlatformCredential(
                    platform=Platform.SPLUNK,
                    cluster_name="system_config",
                    cluster_id=0,
                    credentials={
                        "base_url": splunk_base,
                        "splunk_base_url": splunk_base,
                        "token": splunk_bearer,  # API auth token for SplunkClient
                        "splunk_token": splunk_token,  # HEC token (for sending events)
                        "splunk_username": splunk_user,
                        "splunk_password": splunk_pass,
                        "username": splunk_user,
                        "password": splunk_pass,
                        "verify_ssl": splunk_verify_ssl,  # Per-credential SSL setting from UI
                    },
                    base_url=splunk_base,
                )
                self._by_platform[Platform.SPLUNK].append(pc)
                self._splunk_instance_map[splunk_base] = pc

            logger.info(
                f"[CredPool] From system_config: Meraki={len([p for p in self._by_platform[Platform.MERAKI] if p.cluster_name == 'system_config'])}, "
                f"ThousandEyes={len([p for p in self._by_platform[Platform.THOUSANDEYES] if p.cluster_name == 'system_config'])}, "
                f"Catalyst={len([p for p in self._by_platform[Platform.CATALYST] if p.cluster_name == 'system_config'])}, "
                f"Splunk={len([p for p in self._by_platform[Platform.SPLUNK] if p.cluster_name == 'system_config'])}"
            )

        except Exception as e:
            logger.warning(f"[CredPool] Failed to load from system_config: {e}")

    async def load_all(self) -> None:
        """Load all active credentials and categorize by platform.

        Credentials are loaded from two sources:
        1. System Config table (preferred for single API keys like meraki_api_key)
        2. Clusters table (legacy, for multiple org credentials)

        Platform detection:
        - Meraki: api_key or meraki_api_key (system_config or clusters)
        - Catalyst: catalyst_token or catalyst_username
        - ThousandEyes: thousandeyes_token (system_config or clusters)
        - Splunk: splunk_token or username+password with base_url
        """
        from src.api.dependencies import credential_manager

        # First, try to load from system_config (new approach)
        await self._load_from_system_config()

        # Then load from clusters table (legacy approach - may add additional credentials)
        clusters = await credential_manager.list_clusters(active_only=True)
        logger.info(f"[CredPool] Loading credentials from {len(clusters)} clusters")

        for cluster in clusters:
            creds = await credential_manager.get_credentials(cluster.name)
            if not creds:
                logger.warning(f"[CredPool] No credentials for cluster: {cluster.name}")
                continue

            # Meraki detection - VALIDATE key format to avoid misclassification
            api_key = creds.get("meraki_api_key") or creds.get("api_key", "")
            if api_key and _is_valid_meraki_key(api_key):
                # Valid Meraki API key (40 chars, alphanumeric)
                logger.info(f"[CredPool] Valid Meraki API key for {cluster.name}: [REDACTED]")
                pc = PlatformCredential(
                    platform=Platform.MERAKI,
                    cluster_name=cluster.name,
                    cluster_id=cluster.id,
                    credentials=creds,
                )
                self._by_platform[Platform.MERAKI].append(pc)
            elif api_key and not _is_valid_meraki_key(api_key):
                # Not a Meraki key - skip (but log for debugging)
                logger.debug(f"[CredPool] Skipping {cluster.name} for Meraki - api_key is not Meraki format (len={len(api_key)}, has_dots={'.' in api_key})")

            # Catalyst detection
            if creds.get("catalyst_token") or creds.get("catalyst_username"):
                base_url = creds.get("catalyst_base_url", "")
                pc = PlatformCredential(
                    platform=Platform.CATALYST,
                    cluster_name=cluster.name,
                    cluster_id=cluster.id,
                    credentials=creds,
                    base_url=base_url,
                )
                self._by_platform[Platform.CATALYST].append(pc)
                if base_url:
                    self._catalyst_instance_map[base_url] = pc
                logger.debug(f"[CredPool] Added Catalyst creds from {cluster.name}")

            # ThousandEyes detection
            if creds.get("thousandeyes_token"):
                pc = PlatformCredential(
                    platform=Platform.THOUSANDEYES,
                    cluster_name=cluster.name,
                    cluster_id=cluster.id,
                    credentials=creds,
                )
                self._by_platform[Platform.THOUSANDEYES].append(pc)
                logger.debug(f"[CredPool] Added ThousandEyes creds from {cluster.name}")

            # Splunk detection - must have splunk_token OR base_url containing "splunk" or ":8089"
            # This prevents misidentifying Catalyst/DNAC as Splunk (both have username/password/base_url)
            base_url = creds.get("base_url", "")
            is_splunk_url = base_url and ('splunk' in base_url.lower() or ':8089' in base_url)
            has_splunk_token = bool(creds.get("splunk_token"))

            if has_splunk_token or (is_splunk_url and (creds.get("username") or creds.get("api_key"))):
                pc = PlatformCredential(
                    platform=Platform.SPLUNK,
                    cluster_name=cluster.name,
                    cluster_id=cluster.id,
                    credentials=creds,
                    base_url=base_url,
                )
                self._by_platform[Platform.SPLUNK].append(pc)
                if base_url:
                    self._splunk_instance_map[base_url] = pc
                logger.info(f"[CredPool] Added Splunk creds from {cluster.name}: {base_url}")

        self._loaded = True
        logger.info(
            f"[CredPool] Loaded: Meraki={len(self._by_platform[Platform.MERAKI])}, "
            f"Catalyst={len(self._by_platform[Platform.CATALYST])}, "
            f"ThousandEyes={len(self._by_platform[Platform.THOUSANDEYES])}, "
            f"Splunk={len(self._by_platform[Platform.SPLUNK])}"
        )

    async def _load_cached_org_mappings(self) -> bool:
        """Load org mappings from cache (Redis or in-memory).

        Returns:
            True if cache hit, False if cache miss
        """
        try:
            # Try Redis first
            if self._redis:
                cached = await self._redis.get(CACHE_KEY_ORG_MAPPINGS)
                if cached:
                    data = json.loads(cached)
                    logger.info(f"[CredPool] Loaded org mappings from Redis cache")
                    return self._restore_org_mappings_from_cache(data)

            # Fall back to in-memory cache
            if CACHE_KEY_ORG_MAPPINGS in self._memory_cache:
                timestamp, data = self._memory_cache[CACHE_KEY_ORG_MAPPINGS]
                if time.time() - timestamp < CACHE_TTL_SECONDS:
                    logger.info(f"[CredPool] Loaded org mappings from memory cache")
                    return self._restore_org_mappings_from_cache(data)
                else:
                    del self._memory_cache[CACHE_KEY_ORG_MAPPINGS]

        except Exception as e:
            logger.warning(f"[CredPool] Failed to load cached org mappings: {e}")

        return False

    def _restore_org_mappings_from_cache(self, data: Dict[str, Any]) -> bool:
        """Restore org mappings from cached data.

        Args:
            data: Cached data with cluster_name → org_ids mapping

        Returns:
            True if restore successful
        """
        try:
            # Build a lookup from cluster_name to PlatformCredential
            cluster_map = {
                pc.cluster_name: pc for pc in self._by_platform[Platform.MERAKI]
            }

            # Restore mappings
            for cluster_name, org_data in data.items():
                pc = cluster_map.get(cluster_name)
                if not pc:
                    continue

                org_ids = org_data.get("org_ids", [])
                org_names = org_data.get("org_names", [])

                pc.org_ids = org_ids
                for org_id in org_ids:
                    self._meraki_org_map[org_id] = pc
                for org_name in org_names:
                    self._meraki_org_map[org_name.lower()] = pc

            logger.info(f"[CredPool] Restored {len(self._meraki_org_map)} org mappings from cache")
            return True

        except Exception as e:
            logger.warning(f"[CredPool] Failed to restore org mappings: {e}")
            return False

    async def _save_org_mappings_to_cache(self) -> None:
        """Save org mappings to cache (Redis or in-memory).

        Cache structure:
        {
            "cluster_name": {
                "org_ids": ["123", "456"],
                "org_names": ["DevNet Sandbox", "My Org"]
            }
        }
        """
        try:
            # Build cache data
            cache_data = {}
            for pc in self._by_platform[Platform.MERAKI]:
                if pc.org_ids:
                    # Collect org names from the mapping
                    org_names = [
                        key for key, cred in self._meraki_org_map.items()
                        if cred == pc and not key.isdigit()
                    ]
                    cache_data[pc.cluster_name] = {
                        "org_ids": pc.org_ids,
                        "org_names": org_names,
                    }

            if not cache_data:
                return

            # Save to Redis
            if self._redis:
                await self._redis.setex(
                    CACHE_KEY_ORG_MAPPINGS,
                    CACHE_TTL_SECONDS,
                    json.dumps(cache_data),
                )
                logger.info(f"[CredPool] Saved org mappings to Redis cache (TTL={CACHE_TTL_SECONDS}s)")
                return

            # Fall back to in-memory cache
            self._memory_cache[CACHE_KEY_ORG_MAPPINGS] = (time.time(), cache_data)
            logger.info(f"[CredPool] Saved org mappings to memory cache (TTL={CACHE_TTL_SECONDS}s)")

        except Exception as e:
            logger.warning(f"[CredPool] Failed to save org mappings to cache: {e}")

    async def discover_meraki_orgs(self, force_refresh: bool = False) -> None:
        """Discover which Meraki org IDs each API key can access.

        This queries the Meraki API to get all organizations accessible
        by each API key, then builds a mapping from org_id to credential.

        Uses caching to avoid repeated API calls:
        - First checks Redis/memory cache
        - On cache miss, calls Meraki API and caches results
        - Cache TTL is 1 hour

        Args:
            force_refresh: If True, skip cache and refresh from API
        """
        if self._orgs_discovered and not force_refresh:
            return

        # Try to load from cache first (unless force refresh)
        if not force_refresh and await self._load_cached_org_mappings():
            self._orgs_discovered = True
            return

        from src.services.meraki_api import MerakiAPIClient

        logger.info("[CredPool] Discovering Meraki organizations from API...")

        for pc in self._by_platform[Platform.MERAKI]:
            api_key = pc.credentials.get("api_key") or pc.credentials.get("meraki_api_key")
            if not api_key:
                continue

            try:
                client = MerakiAPIClient(api_key)
                orgs = await client.request("GET", "/organizations")
                # Note: request() already returns parsed JSON, no .json() needed

                for org in orgs:
                    org_id = str(org.get("id"))
                    org_name = org.get("name", "")
                    pc.org_ids.append(org_id)
                    self._meraki_org_map[org_id] = pc
                    # Also map by org name (case-insensitive)
                    self._meraki_org_map[org_name.lower()] = pc

                logger.info(
                    f"[CredPool] {pc.cluster_name} has access to {len(pc.org_ids)} Meraki orgs"
                )
            except Exception as e:
                logger.warning(
                    f"[CredPool] Failed to discover orgs for {pc.cluster_name}: {e}"
                )

        self._orgs_discovered = True

        # Save to cache for future requests
        await self._save_org_mappings_to_cache()

    # =========================================================================
    # Platform-Specific Resolution Methods
    # =========================================================================

    def get_for_meraki(
        self,
        organization_id: Optional[str] = None,
        organization_name: Optional[str] = None,
        network_id: Optional[str] = None,
        serial: Optional[str] = None,
    ) -> Optional[PlatformCredential]:
        """Resolve Meraki credentials based on context.

        Resolution order:
        1. Direct org_id match from discovery map
        2. Org name match (case-insensitive)
        3. Fallback to first available

        Args:
            organization_id: Meraki organization ID
            organization_name: Meraki organization name
            network_id: Network ID (for future network→org mapping)
            serial: Device serial (for future device→org mapping)

        Returns:
            PlatformCredential or None if no Meraki creds available
        """
        # 1. Direct org_id lookup
        if organization_id:
            if organization_id in self._meraki_org_map:
                return self._meraki_org_map[organization_id]

        # 2. Org name lookup (case-insensitive)
        if organization_name:
            name_lower = organization_name.lower()
            if name_lower in self._meraki_org_map:
                return self._meraki_org_map[name_lower]

        # 3. TODO: network_id → org lookup (requires caching network→org mapping)
        # 4. TODO: serial → org lookup (requires caching device→org mapping)

        # 5. Fallback: Prefer credentials with discovered orgs, but allow any if none have orgs
        for pc in self._by_platform[Platform.MERAKI]:
            if pc.org_ids:  # Prefer credentials with discovered orgs
                logger.info(f"[CredPool] Fallback to {pc.cluster_name} (has {len(pc.org_ids)} discovered orgs)")
                return pc

        # 6. Last resort: Use any available credentials even without org discovery
        # This handles cases where org discovery hasn't run yet or is pending
        if self._by_platform[Platform.MERAKI]:
            pc = self._by_platform[Platform.MERAKI][0]
            logger.info(f"[CredPool] Using {pc.cluster_name} credentials (org discovery pending)")
            return pc

        logger.warning("[CredPool] No Meraki credentials available")
        return None

    def get_for_catalyst(
        self,
        base_url: Optional[str] = None,
        site_id: Optional[str] = None,
    ) -> Optional[PlatformCredential]:
        """Resolve Catalyst credentials based on context.

        Args:
            base_url: Catalyst Center instance URL
            site_id: Site ID (for future site→instance mapping)

        Returns:
            PlatformCredential or None
        """
        # 1. Direct instance lookup by URL
        if base_url and base_url in self._catalyst_instance_map:
            return self._catalyst_instance_map[base_url]

        # 2. Fallback to first available
        if self._by_platform[Platform.CATALYST]:
            return self._by_platform[Platform.CATALYST][0]

        return None

    def get_for_thousandeyes(
        self,
        account_group_id: Optional[str] = None,
    ) -> Optional[PlatformCredential]:
        """Resolve ThousandEyes credentials.

        ThousandEyes typically has single-account access per token,
        so we return the first available.

        Args:
            account_group_id: Account group ID (for future multi-account support)

        Returns:
            PlatformCredential or None
        """
        if self._by_platform[Platform.THOUSANDEYES]:
            return self._by_platform[Platform.THOUSANDEYES][0]
        return None

    def get_for_splunk(
        self,
        base_url: Optional[str] = None,
    ) -> Optional[PlatformCredential]:
        """Resolve Splunk credentials.

        Args:
            base_url: Splunk instance URL

        Returns:
            PlatformCredential or None
        """
        # 1. Direct instance lookup by URL
        if base_url and base_url in self._splunk_instance_map:
            return self._splunk_instance_map[base_url]

        # 2. Fallback to first available
        if self._by_platform[Platform.SPLUNK]:
            return self._by_platform[Platform.SPLUNK][0]

        return None

    def get_for_knowledge(self) -> Optional[PlatformCredential]:
        """Get credentials for knowledge tools (RAG, docs).

        Knowledge tools typically don't need external credentials,
        but we provide this for consistency.

        Returns:
            None (knowledge tools don't need platform creds)
        """
        return None

    def get_for_platform(
        self,
        platform: str,
        **context
    ) -> Optional[PlatformCredential]:
        """Generic resolver that dispatches to platform-specific method.

        This is the main entry point for credential resolution during
        tool execution.

        Args:
            platform: Platform name (meraki, catalyst, thousandeyes, splunk)
            **context: Platform-specific context (org_id, base_url, etc.)

        Returns:
            PlatformCredential or None
        """
        if platform == "meraki":
            return self.get_for_meraki(
                organization_id=context.get("organization_id"),
                organization_name=context.get("organization_name"),
                network_id=context.get("network_id"),
                serial=context.get("serial"),
            )
        elif platform == "catalyst":
            return self.get_for_catalyst(
                base_url=context.get("base_url"),
                site_id=context.get("site_id"),
            )
        elif platform == "thousandeyes":
            return self.get_for_thousandeyes(
                account_group_id=context.get("account_group_id"),
            )
        elif platform == "splunk":
            return self.get_for_splunk(
                base_url=context.get("base_url"),
            )
        elif platform == "knowledge":
            return self.get_for_knowledge()

        logger.warning(f"[CredPool] Unknown platform: {platform}")
        return None

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def has_platform(self, platform: str) -> bool:
        """Check if we have credentials for a platform.

        Args:
            platform: Platform name

        Returns:
            True if at least one credential exists for the platform
        """
        try:
            p = Platform(platform)
            return len(self._by_platform.get(p, [])) > 0
        except ValueError:
            return False

    def get_all_for_platform(self, platform: str) -> List[PlatformCredential]:
        """Get all credentials for a platform.

        Args:
            platform: Platform name

        Returns:
            List of PlatformCredential for the platform
        """
        try:
            p = Platform(platform)
            return self._by_platform.get(p, [])
        except ValueError:
            return []

    def get_available_platforms(self) -> List[str]:
        """Get list of platforms with available credentials.

        Returns:
            List of platform names that have credentials
        """
        available = []
        for p in Platform:
            if self._by_platform.get(p):
                available.append(p.value)
        return available

    def get_stats(self) -> Dict[str, Any]:
        """Get credential pool statistics.

        Returns:
            Dict with counts per platform and org mappings
        """
        return {
            "loaded": self._loaded,
            "orgs_discovered": self._orgs_discovered,
            "platforms": {
                p.value: len(self._by_platform[p])
                for p in Platform
            },
            "meraki_orgs_mapped": len(self._meraki_org_map),
            "catalyst_instances": len(self._catalyst_instance_map),
            "splunk_instances": len(self._splunk_instance_map),
        }


# Singleton instance
_credential_pool: Optional[CredentialPool] = None


def get_credential_pool(redis_client=None) -> CredentialPool:
    """Get or create the singleton CredentialPool instance.

    Args:
        redis_client: Optional Redis client for caching. If provided and
                      pool doesn't exist yet, it will be used for caching.

    Returns:
        CredentialPool singleton
    """
    global _credential_pool
    if _credential_pool is None:
        _credential_pool = CredentialPool(redis_client=redis_client)
    elif redis_client is not None and _credential_pool._redis is None:
        # Update existing pool with Redis client
        _credential_pool._redis = redis_client
    return _credential_pool


async def get_initialized_pool(redis_client=None) -> CredentialPool:
    """Get a fully initialized credential pool.

    This loads all credentials and discovers Meraki orgs.
    Uses Redis caching when available to avoid repeated Meraki API calls.

    Args:
        redis_client: Optional Redis client for caching org mappings

    Returns:
        Initialized CredentialPool
    """
    pool = get_credential_pool(redis_client=redis_client)
    if not pool._loaded:
        await pool.load_all()
    if not pool._orgs_discovered:
        await pool.discover_meraki_orgs()
    return pool


def reset_credential_pool() -> None:
    """Reset the singleton credential pool.

    Useful for testing or when credentials change.
    """
    global _credential_pool
    _credential_pool = None
