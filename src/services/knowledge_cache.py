"""Knowledge Base caching layer for improved performance.

Provides multi-level caching for:
- Query embeddings: Avoid re-embedding the same queries (24h TTL)
- Search results: Cache frequent searches (1h TTL)
- AI responses: Cache identical Q&A pairs (4h TTL)

Supports:
- In-memory LRU cache for fast access
- Optional Redis backend for distributed caching
- Cache warming and preloading
- Statistics and monitoring
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from collections import OrderedDict
from enum import Enum

from src.config.settings import get_settings

logger = logging.getLogger(__name__)


class CacheType(str, Enum):
    """Types of cached data."""
    EMBEDDING = "embedding"
    SEARCH = "search"
    RESPONSE = "response"


# Default TTLs in seconds
DEFAULT_TTLS = {
    CacheType.EMBEDDING: 86400,  # 24 hours
    CacheType.SEARCH: 3600,      # 1 hour
    CacheType.RESPONSE: 14400,   # 4 hours
}


@dataclass
class CacheEntry:
    """A single cache entry with metadata."""
    value: Any
    timestamp: float
    ttl: int
    cache_type: CacheType
    hits: int = 0
    size_bytes: int = 0

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        return time.time() - self.timestamp > self.ttl

    def touch(self) -> None:
        """Record a cache hit."""
        self.hits += 1


@dataclass
class CacheStats:
    """Cache statistics per type."""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    evictions: int = 0
    size: int = 0
    size_bytes: int = 0

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
            "size_bytes": self.size_bytes,
            "hit_rate": round(self.hit_rate * 100, 2),
        }


class LRUCache:
    """Thread-safe LRU cache with size limits."""

    def __init__(self, max_size: int = 1000, max_bytes: int = 100 * 1024 * 1024):
        """Initialize LRU cache.

        Args:
            max_size: Maximum number of entries.
            max_bytes: Maximum total size in bytes (default 100MB).
        """
        self.max_size = max_size
        self.max_bytes = max_bytes
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = asyncio.Lock()
        self._total_bytes = 0

    async def get(self, key: str) -> Optional[CacheEntry]:
        """Get entry from cache, moving it to end (most recent)."""
        async with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                if entry.is_expired():
                    del self._cache[key]
                    self._total_bytes -= entry.size_bytes
                    return None
                # Move to end (most recently used)
                self._cache.move_to_end(key)
                entry.touch()
                return entry
            return None

    async def set(self, key: str, entry: CacheEntry) -> None:
        """Add entry to cache, evicting if necessary."""
        async with self._lock:
            # Remove existing entry if present
            if key in self._cache:
                old_entry = self._cache.pop(key)
                self._total_bytes -= old_entry.size_bytes

            # Evict oldest entries if over limits
            while (len(self._cache) >= self.max_size or
                   self._total_bytes + entry.size_bytes > self.max_bytes):
                if not self._cache:
                    break
                _, evicted = self._cache.popitem(last=False)
                self._total_bytes -= evicted.size_bytes

            self._cache[key] = entry
            self._total_bytes += entry.size_bytes

    async def delete(self, key: str) -> bool:
        """Delete entry from cache."""
        async with self._lock:
            if key in self._cache:
                entry = self._cache.pop(key)
                self._total_bytes -= entry.size_bytes
                return True
            return False

    async def clear(self) -> int:
        """Clear all entries, return count cleared."""
        async with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._total_bytes = 0
            return count

    async def cleanup_expired(self) -> int:
        """Remove expired entries, return count removed."""
        async with self._lock:
            expired_keys = [
                key for key, entry in self._cache.items()
                if entry.is_expired()
            ]
            for key in expired_keys:
                entry = self._cache.pop(key)
                self._total_bytes -= entry.size_bytes
            return len(expired_keys)

    @property
    def size(self) -> int:
        """Current number of entries."""
        return len(self._cache)

    @property
    def total_bytes(self) -> int:
        """Total size in bytes."""
        return self._total_bytes


class KnowledgeCache:
    """Multi-level cache for knowledge base operations.

    Provides caching for:
    - Query embeddings (expensive to generate)
    - Search results (expensive vector search)
    - AI responses (expensive LLM calls)
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        embedding_ttl: int = DEFAULT_TTLS[CacheType.EMBEDDING],
        search_ttl: int = DEFAULT_TTLS[CacheType.SEARCH],
        response_ttl: int = DEFAULT_TTLS[CacheType.RESPONSE],
        max_memory_entries: int = 1000,
        max_memory_bytes: int = 100 * 1024 * 1024,
    ):
        """Initialize knowledge cache.

        Args:
            redis_url: Optional Redis URL for distributed caching.
            embedding_ttl: TTL for embedding cache in seconds.
            search_ttl: TTL for search result cache in seconds.
            response_ttl: TTL for AI response cache in seconds.
            max_memory_entries: Max entries in memory cache.
            max_memory_bytes: Max bytes in memory cache.
        """
        self.redis_url = redis_url
        self._redis = None
        self._redis_available = False

        # TTLs per cache type
        self.ttls = {
            CacheType.EMBEDDING: embedding_ttl,
            CacheType.SEARCH: search_ttl,
            CacheType.RESPONSE: response_ttl,
        }

        # In-memory LRU cache
        self._memory_cache = LRUCache(
            max_size=max_memory_entries,
            max_bytes=max_memory_bytes,
        )

        # Statistics per cache type
        self._stats: Dict[CacheType, CacheStats] = {
            ct: CacheStats() for ct in CacheType
        }

        # Background cleanup task
        self._cleanup_task: Optional[asyncio.Task] = None

    async def initialize(self) -> None:
        """Initialize cache, connect to Redis if configured."""
        if self.redis_url:
            try:
                import redis.asyncio as aioredis
                self._redis = await aioredis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=False,
                )
                await self._redis.ping()
                self._redis_available = True
                logger.info("Knowledge cache connected to Redis")
            except Exception as e:
                logger.warning(f"Redis not available, using memory cache only: {e}")
                self._redis_available = False

        # Start background cleanup
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def close(self) -> None:
        """Close cache connections."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        if self._redis:
            await self._redis.close()

    # =========================================================================
    # Cache Key Generation
    # =========================================================================

    def _generate_key(
        self,
        cache_type: CacheType,
        *args,
        **kwargs,
    ) -> str:
        """Generate a unique cache key."""
        # Build key components
        components = [cache_type.value]
        components.extend(str(arg) for arg in args)
        components.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))

        # Hash for consistent key length
        key_str = ":".join(components)
        key_hash = hashlib.sha256(key_str.encode()).hexdigest()[:16]

        return f"knowledge:{cache_type.value}:{key_hash}"

    def _estimate_size(self, value: Any) -> int:
        """Estimate size of value in bytes."""
        try:
            if isinstance(value, (list, tuple)):
                # For embeddings (list of floats)
                if value and isinstance(value[0], (int, float)):
                    return len(value) * 8  # 8 bytes per float
            return len(json.dumps(value, default=str).encode())
        except Exception:
            return 1024  # Default estimate

    # =========================================================================
    # Embedding Cache
    # =========================================================================

    async def get_embedding(self, query: str) -> Optional[List[float]]:
        """Get cached embedding for a query.

        Args:
            query: The query text.

        Returns:
            Cached embedding or None if not found.
        """
        key = self._generate_key(CacheType.EMBEDDING, query.lower().strip())
        return await self._get(key, CacheType.EMBEDDING)

    async def set_embedding(self, query: str, embedding: List[float]) -> None:
        """Cache an embedding.

        Args:
            query: The query text.
            embedding: The embedding vector.
        """
        key = self._generate_key(CacheType.EMBEDDING, query.lower().strip())
        await self._set(key, embedding, CacheType.EMBEDDING)

    # =========================================================================
    # Search Results Cache
    # =========================================================================

    async def get_search_results(
        self,
        query: str,
        top_k: int,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached search results.

        Args:
            query: Search query.
            top_k: Number of results.
            filters: Applied filters.

        Returns:
            Cached results or None if not found.
        """
        key = self._generate_key(
            CacheType.SEARCH,
            query.lower().strip(),
            top_k=top_k,
            filters=json.dumps(filters or {}, sort_keys=True),
        )
        return await self._get(key, CacheType.SEARCH)

    async def set_search_results(
        self,
        query: str,
        top_k: int,
        results: List[Dict[str, Any]],
        filters: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Cache search results.

        Args:
            query: Search query.
            top_k: Number of results.
            results: Search results to cache.
            filters: Applied filters.
        """
        key = self._generate_key(
            CacheType.SEARCH,
            query.lower().strip(),
            top_k=top_k,
            filters=json.dumps(filters or {}, sort_keys=True),
        )
        await self._set(key, results, CacheType.SEARCH)

    # =========================================================================
    # AI Response Cache
    # =========================================================================

    async def get_response(
        self,
        query: str,
        context_hash: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get cached AI response.

        Args:
            query: User query.
            context_hash: Hash of context chunks (for uniqueness).

        Returns:
            Cached response or None if not found.
        """
        key = self._generate_key(
            CacheType.RESPONSE,
            query.lower().strip(),
            context=context_hash or "none",
        )
        return await self._get(key, CacheType.RESPONSE)

    async def set_response(
        self,
        query: str,
        response: Dict[str, Any],
        context_hash: Optional[str] = None,
    ) -> None:
        """Cache an AI response.

        Args:
            query: User query.
            response: AI response data.
            context_hash: Hash of context chunks.
        """
        key = self._generate_key(
            CacheType.RESPONSE,
            query.lower().strip(),
            context=context_hash or "none",
        )
        await self._set(key, response, CacheType.RESPONSE)

    # =========================================================================
    # Core Cache Operations
    # =========================================================================

    async def _get(self, key: str, cache_type: CacheType) -> Optional[Any]:
        """Get value from cache (memory first, then Redis)."""
        stats = self._stats[cache_type]

        # Try memory cache first
        entry = await self._memory_cache.get(key)
        if entry is not None:
            stats.hits += 1
            return entry.value

        # Try Redis if available
        if self._redis_available:
            try:
                data = await self._redis.get(key)
                if data is not None:
                    value = json.loads(data)
                    stats.hits += 1

                    # Populate memory cache
                    await self._memory_cache.set(key, CacheEntry(
                        value=value,
                        timestamp=time.time(),
                        ttl=self.ttls[cache_type],
                        cache_type=cache_type,
                        size_bytes=len(data),
                    ))

                    return value
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")

        stats.misses += 1
        return None

    async def _set(self, key: str, value: Any, cache_type: CacheType) -> None:
        """Set value in cache (both memory and Redis)."""
        stats = self._stats[cache_type]
        ttl = self.ttls[cache_type]

        # Serialize value
        try:
            serialized = json.dumps(value, default=str)
        except Exception as e:
            logger.warning(f"Failed to serialize cache value: {e}")
            return

        size_bytes = len(serialized.encode())

        # Set in memory cache
        entry = CacheEntry(
            value=value,
            timestamp=time.time(),
            ttl=ttl,
            cache_type=cache_type,
            size_bytes=size_bytes,
        )
        await self._memory_cache.set(key, entry)

        # Set in Redis if available
        if self._redis_available:
            try:
                await self._redis.setex(key, ttl, serialized)
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")

        stats.sets += 1
        stats.size = self._memory_cache.size

    async def invalidate_by_document(self, document_id: str) -> int:
        """Invalidate cache entries related to a specific document.

        This should be called when a document is updated or deleted.
        Since we can't easily track which cache entries reference which documents,
        this clears all search and response caches to ensure consistency.
        Embedding cache is preserved as it's query-based, not document-based.

        Args:
            document_id: The ID of the document that was modified.

        Returns:
            Number of entries invalidated.
        """
        logger.info(f"Invalidating cache for document: {document_id}")
        count = 0

        # Invalidate search results (may contain chunks from this document)
        count += await self.invalidate(CacheType.SEARCH)

        # Invalidate AI responses (may reference this document)
        count += await self.invalidate(CacheType.RESPONSE)

        logger.info(f"Invalidated {count} cache entries for document {document_id}")
        return count

    async def invalidate(self, cache_type: Optional[CacheType] = None) -> int:
        """Invalidate cache entries.

        Args:
            cache_type: Type to invalidate, or None for all.

        Returns:
            Number of entries invalidated.
        """
        count = 0

        if cache_type is None:
            # Clear all
            count = await self._memory_cache.clear()
            if self._redis_available:
                try:
                    async for key in self._redis.scan_iter("knowledge:*"):
                        await self._redis.delete(key)
                        count += 1
                except Exception as e:
                    logger.warning(f"Redis invalidation failed: {e}")
        else:
            # Clear specific type
            pattern = f"knowledge:{cache_type.value}:*"
            if self._redis_available:
                try:
                    async for key in self._redis.scan_iter(pattern):
                        await self._redis.delete(key)
                        count += 1
                except Exception as e:
                    logger.warning(f"Redis invalidation failed: {e}")

        logger.info(f"Invalidated {count} cache entries")
        return count

    # =========================================================================
    # Statistics
    # =========================================================================

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "memory_cache": {
                "size": self._memory_cache.size,
                "total_bytes": self._memory_cache.total_bytes,
                "max_size": self._memory_cache.max_size,
                "max_bytes": self._memory_cache.max_bytes,
            },
            "redis_available": self._redis_available,
            "by_type": {
                ct.value: self._stats[ct].to_dict()
                for ct in CacheType
            },
            "total": {
                "hits": sum(s.hits for s in self._stats.values()),
                "misses": sum(s.misses for s in self._stats.values()),
                "sets": sum(s.sets for s in self._stats.values()),
                "hit_rate": round(
                    sum(s.hits for s in self._stats.values()) /
                    max(1, sum(s.hits + s.misses for s in self._stats.values())) * 100,
                    2
                ),
            },
        }

    # =========================================================================
    # Background Cleanup
    # =========================================================================

    async def _cleanup_loop(self) -> None:
        """Periodically clean up expired entries."""
        while True:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                expired = await self._memory_cache.cleanup_expired()
                if expired > 0:
                    logger.debug(f"Cleaned up {expired} expired cache entries")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cache cleanup error: {e}")


# Singleton instance
_knowledge_cache: Optional[KnowledgeCache] = None


def get_knowledge_cache() -> KnowledgeCache:
    """Get or create the knowledge cache singleton."""
    global _knowledge_cache
    if _knowledge_cache is None:
        settings = get_settings()
        _knowledge_cache = KnowledgeCache(
            redis_url=settings.redis_url,
        )
    return _knowledge_cache


async def initialize_knowledge_cache() -> KnowledgeCache:
    """Initialize the knowledge cache (call at startup)."""
    cache = get_knowledge_cache()
    await cache.initialize()
    return cache
