"""
Tool Response Cache for reducing API calls and improving performance.

This module provides caching for tool execution results with:
- Configurable TTL per tool or global
- Memory-based cache with optional Redis backend
- Cache key generation based on tool name and parameters
- Automatic cache invalidation for write operations
- Cache statistics for monitoring

Usage:
    cache = get_tool_cache()

    # Check cache before executing
    cached = await cache.get(tool_name, params)
    if cached:
        return cached

    # Execute and cache result
    result = await execute_tool(tool_name, params)
    await cache.set(tool_name, params, result)
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, Any, Optional
from dataclasses import dataclass, field

from src.config.settings import get_settings

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """A single cache entry with metadata."""
    value: Dict[str, Any]
    timestamp: float
    ttl: int
    hits: int = 0

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        return time.time() - self.timestamp > self.ttl


@dataclass
class CacheStats:
    """Cache statistics."""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    evictions: int = 0
    size: int = 0

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "sets": self.sets,
            "evictions": self.evictions,
            "size": self.size,
            "hit_rate": round(self.hit_rate * 100, 2),
        }


# Tools that should not be cached (write operations, real-time data)
NON_CACHEABLE_TOOLS = {
    # Write operations
    "meraki_create_network",
    "meraki_update_network",
    "meraki_delete_network",
    "meraki_create_vlan",
    "meraki_update_vlan",
    "meraki_delete_vlan",
    "meraki_update_device",
    "meraki_reboot_device",
    "catalyst_create_site",
    "catalyst_delete_site",
    "thousandeyes_create_test",
    "thousandeyes_delete_test",
    "splunk_create_search",
    # Real-time data that changes frequently
    "meraki_get_device_uplink_status",
    "meraki_get_network_clients",
    "meraki_get_live_tools",
    "catalyst_get_client_health",
    "thousandeyes_get_test_results",
    "splunk_get_search_results",
}

# Tools with shorter TTL (frequently changing data)
SHORT_TTL_TOOLS = {
    "meraki_get_device_status": 60,
    "meraki_organizations_get_devices_statuses": 60,  # Device online/offline status changes quickly
    "meraki_get_network_devices": 60,  # Device list with status
    "meraki_list_network_clients": 120,
    "catalyst_get_device_health": 60,
    "catalyst_get_site_health": 60,
    "thousandeyes_list_alerts": 60,
    "splunk_list_alerts": 60,
}

# Tools with longer TTL (relatively static data)
LONG_TTL_TOOLS = {
    "meraki_list_organizations": 3600,
    "meraki_list_networks": 600,
    "meraki_get_organization": 3600,
    "catalyst_list_sites": 600,
    "catalyst_get_site": 600,
    "thousandeyes_list_tests": 600,
    "splunk_list_saved_searches": 600,
}


class ToolResponseCache:
    """
    Cache for tool execution results.

    Supports both memory and Redis backends for flexibility.
    Memory cache is always used; Redis provides persistence.
    """

    def __init__(
        self,
        default_ttl: int = 300,
        max_entries: int = 10000,
        redis_client=None,
    ):
        """
        Initialize the tool cache.

        Args:
            default_ttl: Default TTL in seconds (5 minutes)
            max_entries: Maximum entries in memory cache
            redis_client: Optional Redis client for persistence
        """
        self._memory_cache: Dict[str, CacheEntry] = {}
        self._redis = redis_client
        self._default_ttl = default_ttl
        self._max_entries = max_entries
        self._stats = CacheStats()
        self._lock = asyncio.Lock()

        logger.info(
            f"[ToolCache] Initialized with TTL={default_ttl}s, "
            f"max_entries={max_entries}, redis={'enabled' if redis_client else 'disabled'}"
        )

    def _normalize_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize parameter values for consistent cache keys.

        This prevents cache misses due to trivial differences like:
        - "123456" vs 123456 (string vs int)
        - " value " vs "value" (whitespace)
        - "VALUE" vs "value" (case - for IDs that may be case-insensitive)

        Note: Only normalizes known ID fields to lowercase, not all strings.
        """
        ID_FIELDS = {
            "organization_id", "organizationId", "org_id",
            "network_id", "networkId", "net_id",
            "serial", "device_serial",
        }

        normalized = {}
        for key, value in params.items():
            if value is None:
                continue  # Skip None values for cleaner keys

            if isinstance(value, str):
                value = value.strip()
                # Normalize known ID fields to lowercase
                if key in ID_FIELDS:
                    value = value.lower()
            elif isinstance(value, (int, float)):
                # Keep numeric values as-is (JSON will handle)
                pass
            elif isinstance(value, list):
                # Sort lists for consistent hashing
                try:
                    value = sorted(value) if all(isinstance(x, (str, int, float)) for x in value) else value
                except TypeError:
                    pass  # Can't sort, keep as-is

            normalized[key] = value

        return normalized

    def _generate_cache_key(self, tool_name: str, params: Dict[str, Any]) -> str:
        """Generate a unique cache key for tool + params."""
        # Normalize params for consistent key generation
        normalized = self._normalize_params(params)
        params_str = json.dumps(normalized, sort_keys=True)
        params_hash = hashlib.sha256(params_str.encode()).hexdigest()[:12]
        return f"tool_cache:{tool_name}:{params_hash}"

    def _get_ttl_for_tool(self, tool_name: str) -> int:
        """Get TTL for a specific tool."""
        if tool_name in SHORT_TTL_TOOLS:
            return SHORT_TTL_TOOLS[tool_name]
        if tool_name in LONG_TTL_TOOLS:
            return LONG_TTL_TOOLS[tool_name]
        return self._default_ttl

    def _is_cacheable(self, tool_name: str, params: Dict[str, Any]) -> bool:
        """Check if a tool result should be cached."""
        # Don't cache if explicitly disabled
        if not get_settings().tool_cache_enabled:
            return False

        # Don't cache write operations or real-time data
        if tool_name in NON_CACHEABLE_TOOLS:
            return False

        # Don't cache if tool name suggests write operation
        write_patterns = ["create", "update", "delete", "reboot", "enable", "disable"]
        for pattern in write_patterns:
            if pattern in tool_name.lower():
                return False

        return True

    async def get(
        self,
        tool_name: str,
        params: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached result for a tool call.

        Args:
            tool_name: Name of the tool
            params: Tool parameters

        Returns:
            Cached result or None if not found/expired
        """
        if not self._is_cacheable(tool_name, params):
            return None

        key = self._generate_cache_key(tool_name, params)

        # Check memory cache first
        async with self._lock:
            if key in self._memory_cache:
                entry = self._memory_cache[key]
                if not entry.is_expired():
                    entry.hits += 1
                    self._stats.hits += 1
                    logger.debug(f"[ToolCache] HIT: {tool_name} (hits={entry.hits})")
                    return entry.value
                else:
                    # Expired - remove from cache
                    del self._memory_cache[key]
                    self._stats.evictions += 1

        # Check Redis if available
        if self._redis:
            try:
                cached = await self._redis.get(key)
                if cached:
                    result = json.loads(cached)
                    # Store in memory cache too
                    async with self._lock:
                        ttl = self._get_ttl_for_tool(tool_name)
                        self._memory_cache[key] = CacheEntry(
                            value=result,
                            timestamp=time.time(),
                            ttl=ttl,
                        )
                        self._stats.hits += 1
                    logger.debug(f"[ToolCache] HIT (Redis): {tool_name}")
                    return result
            except Exception as e:
                logger.warning(f"[ToolCache] Redis get failed: {e}")

        self._stats.misses += 1
        logger.debug(f"[ToolCache] MISS: {tool_name}")
        return None

    async def set(
        self,
        tool_name: str,
        params: Dict[str, Any],
        result: Dict[str, Any],
        ttl: Optional[int] = None,
        cache_errors: bool = True,
    ) -> bool:
        """
        Cache a tool result.

        Args:
            tool_name: Name of the tool
            params: Tool parameters
            result: Tool execution result
            ttl: Optional TTL override
            cache_errors: Whether to cache error responses (with short TTL)

        Returns:
            True if cached successfully
        """
        if not self._is_cacheable(tool_name, params):
            return False

        # Handle error caching with short TTL (prevents rapid retries on failures)
        is_error = not result.get("success", True)
        if is_error:
            if not cache_errors:
                return False
            # Cache errors for 30 seconds to prevent hammering failing APIs
            ttl = 30
            logger.debug(f"[ToolCache] Caching error response for {tool_name} (TTL=30s)")
        else:
            ttl = ttl or self._get_ttl_for_tool(tool_name)

        key = self._generate_cache_key(tool_name, params)

        # Store in memory cache
        async with self._lock:
            # Evict oldest entries if at capacity
            if len(self._memory_cache) >= self._max_entries:
                await self._evict_oldest()

            self._memory_cache[key] = CacheEntry(
                value=result,
                timestamp=time.time(),
                ttl=ttl,
            )
            self._stats.sets += 1
            self._stats.size = len(self._memory_cache)

        # Store in Redis if available
        if self._redis:
            try:
                await self._redis.setex(key, ttl, json.dumps(result))
            except Exception as e:
                logger.warning(f"[ToolCache] Redis set failed: {e}")

        logger.debug(f"[ToolCache] SET: {tool_name} (ttl={ttl}s)")
        return True

    async def invalidate(self, tool_name: str, params: Dict[str, Any] = None) -> int:
        """
        Invalidate cached results for a tool.

        Args:
            tool_name: Name of the tool
            params: Optional specific params to invalidate

        Returns:
            Number of entries invalidated
        """
        count = 0

        if params:
            # Invalidate specific entry
            key = self._generate_cache_key(tool_name, params)
            async with self._lock:
                if key in self._memory_cache:
                    del self._memory_cache[key]
                    count = 1
            if self._redis:
                try:
                    await self._redis.delete(key)
                except Exception as e:
                    logger.warning(f"[ToolCache] Redis delete failed: {e}")
        else:
            # Invalidate all entries for this tool
            prefix = f"tool_cache:{tool_name}:"
            async with self._lock:
                keys_to_delete = [k for k in self._memory_cache if k.startswith(prefix)]
                for key in keys_to_delete:
                    del self._memory_cache[key]
                    count += 1
            if self._redis:
                try:
                    # Scan and delete matching keys
                    cursor = 0
                    while True:
                        cursor, keys = await self._redis.scan(cursor, match=f"{prefix}*")
                        if keys:
                            await self._redis.delete(*keys)
                            count += len(keys)
                        if cursor == 0:
                            break
                except Exception as e:
                    logger.warning(f"[ToolCache] Redis invalidate failed: {e}")

        self._stats.evictions += count
        self._stats.size = len(self._memory_cache)
        logger.info(f"[ToolCache] Invalidated {count} entries for {tool_name}")
        return count

    # Cascade invalidation rules: write operation -> related read operations to invalidate
    INVALIDATION_RULES: Dict[str, list] = {
        # Meraki network operations
        "meraki_create_network": ["meraki_list_networks", "meraki_list_organization_networks"],
        "meraki_update_network": ["meraki_get_network", "meraki_list_networks"],
        "meraki_delete_network": ["meraki_list_networks", "meraki_list_organization_networks"],
        # Meraki device operations
        "meraki_update_device": ["meraki_get_device", "meraki_list_devices", "meraki_list_organization_devices"],
        "meraki_claim_device": ["meraki_list_devices", "meraki_list_organization_devices", "meraki_get_organization_inventory"],
        "meraki_remove_device": ["meraki_list_devices", "meraki_list_organization_devices"],
        # Meraki VLAN operations
        "meraki_create_vlan": ["meraki_list_vlans", "meraki_get_network_vlans"],
        "meraki_update_vlan": ["meraki_get_vlan", "meraki_list_vlans"],
        "meraki_delete_vlan": ["meraki_list_vlans", "meraki_get_network_vlans"],
        # Meraki SSID operations
        "meraki_update_ssid": ["meraki_get_ssid", "meraki_list_ssids"],
        # Catalyst site operations
        "catalyst_create_site": ["catalyst_list_sites", "catalyst_get_sites"],
        "catalyst_update_site": ["catalyst_get_site", "catalyst_list_sites"],
        "catalyst_delete_site": ["catalyst_list_sites", "catalyst_get_sites"],
        # ThousandEyes test operations
        "thousandeyes_create_test": ["thousandeyes_list_tests"],
        "thousandeyes_update_test": ["thousandeyes_get_test", "thousandeyes_list_tests"],
        "thousandeyes_delete_test": ["thousandeyes_list_tests"],
        # Splunk operations
        "splunk_create_saved_search": ["splunk_list_saved_searches"],
        "splunk_update_saved_search": ["splunk_get_saved_search", "splunk_list_saved_searches"],
        "splunk_delete_saved_search": ["splunk_list_saved_searches"],
    }

    async def invalidate_related(self, tool_name: str) -> int:
        """
        Invalidate cache entries related to a write operation.

        When a write operation completes successfully, this method
        invalidates cached read operations that may return stale data.

        For example, when meraki_create_network succeeds, we invalidate
        meraki_list_networks cache entries.

        Args:
            tool_name: The write operation that was executed

        Returns:
            Number of entries invalidated across all related tools
        """
        related_tools = self.INVALIDATION_RULES.get(tool_name, [])
        if not related_tools:
            return 0

        total_count = 0
        for related_tool in related_tools:
            count = await self.invalidate(related_tool)
            total_count += count

        if total_count > 0:
            logger.info(
                f"[ToolCache] Cascade invalidation for {tool_name}: "
                f"invalidated {total_count} entries across {len(related_tools)} related tools"
            )

        return total_count

    async def clear(self) -> int:
        """Clear all cached entries."""
        async with self._lock:
            count = len(self._memory_cache)
            self._memory_cache.clear()
            self._stats.evictions += count
            self._stats.size = 0

        if self._redis:
            try:
                # Scan and delete all tool cache keys
                cursor = 0
                while True:
                    cursor, keys = await self._redis.scan(cursor, match="tool_cache:*")
                    if keys:
                        await self._redis.delete(*keys)
                    if cursor == 0:
                        break
            except Exception as e:
                logger.warning(f"[ToolCache] Redis clear failed: {e}")

        logger.info(f"[ToolCache] Cleared {count} entries")
        return count

    async def _evict_oldest(self) -> None:
        """Evict oldest entries to make room."""
        # Sort by timestamp and remove oldest 10%
        sorted_entries = sorted(
            self._memory_cache.items(),
            key=lambda x: x[1].timestamp
        )
        to_remove = max(1, len(sorted_entries) // 10)

        for key, _ in sorted_entries[:to_remove]:
            del self._memory_cache[key]
            self._stats.evictions += 1

        logger.debug(f"[ToolCache] Evicted {to_remove} oldest entries")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return self._stats.to_dict()


# Singleton instance
_tool_cache: Optional[ToolResponseCache] = None


def get_tool_cache() -> ToolResponseCache:
    """Get the singleton tool cache instance."""
    global _tool_cache
    if _tool_cache is None:
        settings = get_settings()
        _tool_cache = ToolResponseCache(
            default_ttl=settings.tool_cache_ttl,
        )
    return _tool_cache


async def init_tool_cache(redis_client=None) -> ToolResponseCache:
    """Initialize tool cache with optional Redis backend."""
    global _tool_cache
    settings = get_settings()
    _tool_cache = ToolResponseCache(
        default_ttl=settings.tool_cache_ttl,
        redis_client=redis_client,
    )
    logger.info("[ToolCache] Initialized with persistence options")
    return _tool_cache
