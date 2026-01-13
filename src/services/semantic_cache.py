"""Semantic caching for RAG queries.

This module provides caching that retrieves results for semantically similar
queries, not just exact matches. Uses embedding similarity to find cached
results that would likely produce the same answer.

Features:
- Cosine similarity matching for query embeddings
- Configurable similarity threshold
- TTL-based expiration
- Redis backend support for distributed caching
- Hit rate tracking for observability
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
import numpy as np

from src.config.settings import get_settings

logger = logging.getLogger(__name__)


@dataclass
class SemanticCacheEntry:
    """A cached query result with its embedding."""
    query: str
    query_embedding: List[float]
    results: List[Dict[str, Any]]  # Serialized RetrievedChunk list
    response: Optional[str] = None  # Cached AI response
    timestamp: float = field(default_factory=time.time)
    ttl: int = 3600  # 1 hour default
    hits: int = 0

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        return time.time() - self.timestamp > self.ttl

    def touch(self) -> None:
        """Record a cache hit."""
        self.hits += 1


@dataclass
class SemanticCacheStats:
    """Statistics for semantic cache performance."""
    exact_hits: int = 0
    semantic_hits: int = 0
    misses: int = 0
    sets: int = 0
    evictions: int = 0
    avg_similarity_on_hit: float = 0.0

    @property
    def total_hits(self) -> int:
        return self.exact_hits + self.semantic_hits

    @property
    def hit_rate(self) -> float:
        total = self.total_hits + self.misses
        return self.total_hits / total if total > 0 else 0.0

    @property
    def semantic_hit_rate(self) -> float:
        """Rate of hits that were semantic (not exact)."""
        if self.total_hits == 0:
            return 0.0
        return self.semantic_hits / self.total_hits

    def to_dict(self) -> Dict[str, Any]:
        return {
            "exact_hits": self.exact_hits,
            "semantic_hits": self.semantic_hits,
            "total_hits": self.total_hits,
            "misses": self.misses,
            "sets": self.sets,
            "hit_rate": round(self.hit_rate * 100, 2),
            "semantic_hit_rate": round(self.semantic_hit_rate * 100, 2),
            "avg_similarity_on_hit": round(self.avg_similarity_on_hit, 4),
        }


class SemanticCache:
    """Cache that retrieves results for semantically similar queries.

    Uses cosine similarity between query embeddings to determine if a
    cached result can be reused. This dramatically improves cache hit
    rates for natural language queries.

    Example:
        "How do I configure VLANs on Meraki?"
        "Setting up VLANs in Meraki dashboard"
        -> Would hit the same cache entry if similarity > threshold
    """

    def __init__(
        self,
        similarity_threshold: float = 0.92,
        max_entries: int = 5000,
        default_ttl: int = 3600,
        use_redis: bool = True,
    ):
        """Initialize semantic cache.

        Args:
            similarity_threshold: Minimum cosine similarity to consider a hit (0-1).
                                 Higher = more strict matching.
            max_entries: Maximum number of cached entries.
            default_ttl: Default time-to-live in seconds.
            use_redis: Whether to use Redis backend (falls back to in-memory).
        """
        self.similarity_threshold = similarity_threshold
        self.max_entries = max_entries
        self.default_ttl = default_ttl
        self.use_redis = use_redis

        # In-memory storage for embeddings (always needed for similarity search)
        self._embeddings: List[np.ndarray] = []
        self._entries: List[SemanticCacheEntry] = []
        self._query_hashes: Dict[str, int] = {}  # For exact match lookups

        # Statistics
        self.stats = SemanticCacheStats()

        # Redis client (lazy initialized)
        self._redis = None

        # Lock for thread safety
        self._lock = asyncio.Lock()

        logger.info(
            f"SemanticCache initialized: threshold={similarity_threshold}, "
            f"max_entries={max_entries}, ttl={default_ttl}s"
        )

    def _get_query_hash(self, query: str) -> str:
        """Get hash of query for exact match lookup."""
        return hashlib.sha256(query.lower().strip().encode()).hexdigest()[:16]

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two vectors."""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def _find_similar(
        self,
        query_embedding: List[float],
        top_k: int = 1,
    ) -> List[Tuple[int, float]]:
        """Find most similar cached entries by embedding.

        Args:
            query_embedding: The query embedding to match.
            top_k: Number of similar entries to return.

        Returns:
            List of (index, similarity) tuples, sorted by similarity desc.
        """
        if not self._embeddings:
            return []

        query_vec = np.array(query_embedding)
        similarities = []

        for i, cached_emb in enumerate(self._embeddings):
            # Skip expired entries
            if self._entries[i].is_expired():
                continue

            sim = self._cosine_similarity(query_vec, cached_emb)
            if sim >= self.similarity_threshold:
                similarities.append((i, sim))

        # Sort by similarity descending
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

    async def get(
        self,
        query: str,
        query_embedding: List[float],
    ) -> Optional[Tuple[List[Dict[str, Any]], Optional[str], float]]:
        """Get cached results for a query.

        First tries exact match by query hash, then falls back to
        semantic similarity matching.

        Args:
            query: The query string.
            query_embedding: The query's embedding vector.

        Returns:
            Tuple of (results, response, similarity) if found, None otherwise.
            - results: List of serialized RetrievedChunk dicts
            - response: Cached AI response (may be None)
            - similarity: 1.0 for exact match, actual similarity otherwise
        """
        async with self._lock:
            query_hash = self._get_query_hash(query)

            # Try exact match first
            if query_hash in self._query_hashes:
                idx = self._query_hashes[query_hash]
                entry = self._entries[idx]

                if not entry.is_expired():
                    entry.touch()
                    self.stats.exact_hits += 1
                    logger.debug(f"Semantic cache exact hit: '{query[:50]}...'")
                    return (entry.results, entry.response, 1.0)

            # Try semantic similarity match
            similar = self._find_similar(query_embedding)

            if similar:
                idx, similarity = similar[0]
                entry = self._entries[idx]
                entry.touch()

                self.stats.semantic_hits += 1
                # Update running average
                total_hits = self.stats.semantic_hits
                self.stats.avg_similarity_on_hit = (
                    (self.stats.avg_similarity_on_hit * (total_hits - 1) + similarity) / total_hits
                )

                logger.debug(
                    f"Semantic cache hit (sim={similarity:.3f}): "
                    f"'{query[:30]}...' matched '{entry.query[:30]}...'"
                )
                return (entry.results, entry.response, similarity)

            self.stats.misses += 1
            return None

    async def set(
        self,
        query: str,
        query_embedding: List[float],
        results: List[Dict[str, Any]],
        response: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> None:
        """Cache results for a query.

        Args:
            query: The query string.
            query_embedding: The query's embedding vector.
            results: List of serialized RetrievedChunk dicts.
            response: Optional AI response to cache.
            ttl: Time-to-live in seconds (uses default if not specified).
        """
        async with self._lock:
            query_hash = self._get_query_hash(query)

            # Check if already cached
            if query_hash in self._query_hashes:
                # Update existing entry
                idx = self._query_hashes[query_hash]
                self._entries[idx] = SemanticCacheEntry(
                    query=query,
                    query_embedding=query_embedding,
                    results=results,
                    response=response,
                    ttl=ttl or self.default_ttl,
                )
                self._embeddings[idx] = np.array(query_embedding)
                return

            # Evict if at capacity
            if len(self._entries) >= self.max_entries:
                await self._evict_oldest()

            # Add new entry
            entry = SemanticCacheEntry(
                query=query,
                query_embedding=query_embedding,
                results=results,
                response=response,
                ttl=ttl or self.default_ttl,
            )

            idx = len(self._entries)
            self._entries.append(entry)
            self._embeddings.append(np.array(query_embedding))
            self._query_hashes[query_hash] = idx

            self.stats.sets += 1
            logger.debug(f"Semantic cache set: '{query[:50]}...' ({len(results)} results)")

    async def _evict_oldest(self) -> None:
        """Evict oldest or expired entries to make room."""
        # First, try to evict expired entries
        current_time = time.time()
        expired_indices = [
            i for i, entry in enumerate(self._entries)
            if entry.is_expired()
        ]

        if expired_indices:
            # Remove oldest expired entry
            idx = expired_indices[0]
        else:
            # Remove least recently used (by timestamp + hits)
            # Score = timestamp + (hits * 60) to favor frequently accessed
            scores = [
                (i, entry.timestamp + entry.hits * 60)
                for i, entry in enumerate(self._entries)
            ]
            idx = min(scores, key=lambda x: x[1])[0]

        # Remove the entry
        entry = self._entries[idx]
        query_hash = self._get_query_hash(entry.query)

        # Swap with last and pop (efficient removal)
        last_idx = len(self._entries) - 1
        if idx != last_idx:
            self._entries[idx] = self._entries[last_idx]
            self._embeddings[idx] = self._embeddings[last_idx]
            # Update hash mapping for swapped entry
            swapped_hash = self._get_query_hash(self._entries[idx].query)
            self._query_hashes[swapped_hash] = idx

        self._entries.pop()
        self._embeddings.pop()
        if query_hash in self._query_hashes:
            del self._query_hashes[query_hash]

        self.stats.evictions += 1

    async def invalidate(self, query: Optional[str] = None) -> int:
        """Invalidate cache entries.

        Args:
            query: Specific query to invalidate, or None to clear all.

        Returns:
            Number of entries invalidated.
        """
        async with self._lock:
            if query is None:
                count = len(self._entries)
                self._entries.clear()
                self._embeddings.clear()
                self._query_hashes.clear()
                logger.info(f"Semantic cache cleared: {count} entries")
                return count

            query_hash = self._get_query_hash(query)
            if query_hash in self._query_hashes:
                idx = self._query_hashes[query_hash]
                # Mark as expired (will be evicted later)
                self._entries[idx].ttl = 0
                self._entries[idx].timestamp = 0
                del self._query_hashes[query_hash]
                return 1

            return 0

    async def cleanup_expired(self) -> int:
        """Remove all expired entries.

        Returns:
            Number of entries removed.
        """
        async with self._lock:
            expired_count = 0
            i = 0
            while i < len(self._entries):
                if self._entries[i].is_expired():
                    # Evict this entry
                    entry = self._entries[i]
                    query_hash = self._get_query_hash(entry.query)

                    # Swap with last
                    last_idx = len(self._entries) - 1
                    if i != last_idx:
                        self._entries[i] = self._entries[last_idx]
                        self._embeddings[i] = self._embeddings[last_idx]
                        swapped_hash = self._get_query_hash(self._entries[i].query)
                        self._query_hashes[swapped_hash] = i

                    self._entries.pop()
                    self._embeddings.pop()
                    if query_hash in self._query_hashes:
                        del self._query_hashes[query_hash]

                    expired_count += 1
                else:
                    i += 1

            if expired_count > 0:
                logger.info(f"Semantic cache cleanup: removed {expired_count} expired entries")

            return expired_count

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            **self.stats.to_dict(),
            "entries": len(self._entries),
            "max_entries": self.max_entries,
            "threshold": self.similarity_threshold,
        }


# Singleton instance
_semantic_cache: Optional[SemanticCache] = None


def get_semantic_cache() -> SemanticCache:
    """Get or create the global semantic cache instance."""
    global _semantic_cache
    if _semantic_cache is None:
        settings = get_settings()
        _semantic_cache = SemanticCache(
            similarity_threshold=getattr(settings, 'semantic_cache_threshold', 0.92),
            max_entries=getattr(settings, 'semantic_cache_max_entries', 5000),
            default_ttl=getattr(settings, 'semantic_cache_ttl', 3600),
        )
    return _semantic_cache
