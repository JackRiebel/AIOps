"""A2A Context Embeddings Module.

Provides semantic context enhancement using embeddings for:
- Conversation history search
- Entity resolution across conversations
- Relevant context retrieval
- Context window optimization

Uses the same embedding infrastructure as the knowledge base.
"""

import logging
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class ContextChunk:
    """A chunk of context with embedding."""
    id: str
    text: str
    embedding: Optional[List[float]] = None
    source: str = "conversation"  # conversation, api_result, knowledge
    session_id: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text[:200] + "..." if len(self.text) > 200 else self.text,
            "source": self.source,
            "session_id": self.session_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class RetrievedContext:
    """Context retrieved via semantic search."""
    chunks: List[ContextChunk]
    total_tokens: int
    query_embedding: Optional[List[float]] = None
    search_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunks": [c.to_dict() for c in self.chunks],
            "total_tokens": self.total_tokens,
            "search_time_ms": self.search_time_ms,
        }


@dataclass
class EntityMention:
    """An entity mentioned in conversation."""
    entity_type: str  # device, network, user, vlan, ssid, etc.
    entity_name: str
    entity_id: Optional[str] = None
    first_mentioned: datetime = field(default_factory=datetime.utcnow)
    last_mentioned: datetime = field(default_factory=datetime.utcnow)
    mention_count: int = 1
    context_snippets: List[str] = field(default_factory=list)


class ContextEmbeddingStore:
    """In-memory store for context embeddings with semantic search.

    Features:
    - Store conversation chunks with embeddings
    - Semantic search for relevant context
    - Entity tracking across sessions
    - Context window optimization
    - TTL-based cleanup
    """

    def __init__(
        self,
        max_chunks_per_session: int = 100,
        max_total_chunks: int = 10000,
        chunk_ttl_hours: int = 24,
        embedding_dimension: int = 1536,  # OpenAI ada-002 dimension
    ):
        self._chunks: Dict[str, ContextChunk] = {}
        self._session_chunks: Dict[str, List[str]] = defaultdict(list)
        self._entities: Dict[str, Dict[str, EntityMention]] = defaultdict(dict)
        self._max_chunks_per_session = max_chunks_per_session
        self._max_total_chunks = max_total_chunks
        self._chunk_ttl = timedelta(hours=chunk_ttl_hours)
        self._embedding_dimension = embedding_dimension
        self._embedding_service = None
        self._lock = asyncio.Lock()

    async def _get_embedding_service(self):
        """Lazy load embedding service."""
        if self._embedding_service is None:
            try:
                from src.services.embedding_service import get_embedding_service
                self._embedding_service = get_embedding_service()
            except ImportError:
                logger.warning("[ContextEmbeddings] Embedding service not available")
        return self._embedding_service

    def _generate_chunk_id(self, text: str, session_id: str) -> str:
        """Generate unique ID for a chunk."""
        content = f"{session_id}:{text}:{datetime.utcnow().isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:12]

    async def add_chunk(
        self,
        text: str,
        session_id: str,
        source: str = "conversation",
        metadata: Optional[Dict[str, Any]] = None,
        compute_embedding: bool = True,
    ) -> ContextChunk:
        """Add a context chunk with optional embedding.

        Args:
            text: The text content
            session_id: Session ID for grouping
            source: Source type (conversation, api_result, knowledge)
            metadata: Optional metadata
            compute_embedding: Whether to compute embedding

        Returns:
            The created ContextChunk
        """
        async with self._lock:
            # Check session limit
            session_chunk_ids = self._session_chunks[session_id]
            if len(session_chunk_ids) >= self._max_chunks_per_session:
                # Remove oldest chunk from session
                oldest_id = session_chunk_ids.pop(0)
                if oldest_id in self._chunks:
                    del self._chunks[oldest_id]

            # Check total limit
            if len(self._chunks) >= self._max_total_chunks:
                await self._cleanup_old_chunks()

            # Create chunk
            chunk_id = self._generate_chunk_id(text, session_id)
            chunk = ContextChunk(
                id=chunk_id,
                text=text,
                source=source,
                session_id=session_id,
                metadata=metadata or {},
            )

            # Compute embedding if requested
            if compute_embedding:
                chunk.embedding = await self._compute_embedding(text)

            # Store
            self._chunks[chunk_id] = chunk
            self._session_chunks[session_id].append(chunk_id)

            # Extract and track entities
            entities = self._extract_entities(text)
            for entity_type, entity_name in entities:
                self._track_entity(session_id, entity_type, entity_name, text)

            logger.debug(f"[ContextEmbeddings] Added chunk {chunk_id} to session {session_id}")
            return chunk

    async def _compute_embedding(self, text: str) -> Optional[List[float]]:
        """Compute embedding for text."""
        embedding_service = await self._get_embedding_service()
        if embedding_service is None:
            return None

        try:
            embedding = await embedding_service.get_embedding(text)
            return embedding
        except Exception as e:
            logger.warning(f"[ContextEmbeddings] Failed to compute embedding: {e}")
            return None

    async def search(
        self,
        query: str,
        session_id: Optional[str] = None,
        max_results: int = 5,
        min_similarity: float = 0.7,
        source_filter: Optional[str] = None,
    ) -> RetrievedContext:
        """Search for relevant context using semantic similarity.

        Args:
            query: Search query
            session_id: Optional session filter
            max_results: Maximum chunks to return
            min_similarity: Minimum similarity threshold
            source_filter: Optional source type filter

        Returns:
            RetrievedContext with matching chunks
        """
        import time
        start_time = time.time()

        # Compute query embedding
        query_embedding = await self._compute_embedding(query)

        if query_embedding is None:
            # Fall back to keyword search
            return await self._keyword_search(
                query, session_id, max_results, source_filter
            )

        # Search with embeddings
        results = []
        for chunk_id, chunk in self._chunks.items():
            # Apply filters
            if session_id and chunk.session_id != session_id:
                continue
            if source_filter and chunk.source != source_filter:
                continue
            if chunk.embedding is None:
                continue

            # Compute similarity
            similarity = self._cosine_similarity(query_embedding, chunk.embedding)
            if similarity >= min_similarity:
                results.append((chunk, similarity))

        # Sort by similarity
        results.sort(key=lambda x: x[1], reverse=True)
        results = results[:max_results]

        # Calculate total tokens (rough estimate)
        total_tokens = sum(len(chunk.text.split()) * 1.3 for chunk, _ in results)

        search_time = (time.time() - start_time) * 1000

        return RetrievedContext(
            chunks=[chunk for chunk, _ in results],
            total_tokens=int(total_tokens),
            query_embedding=query_embedding,
            search_time_ms=round(search_time, 2),
        )

    async def _keyword_search(
        self,
        query: str,
        session_id: Optional[str],
        max_results: int,
        source_filter: Optional[str],
    ) -> RetrievedContext:
        """Fallback keyword search when embeddings unavailable."""
        import time
        start_time = time.time()

        query_words = set(query.lower().split())
        results = []

        for chunk in self._chunks.values():
            if session_id and chunk.session_id != session_id:
                continue
            if source_filter and chunk.source != source_filter:
                continue

            chunk_words = set(chunk.text.lower().split())
            overlap = len(query_words & chunk_words)
            if overlap > 0:
                score = overlap / max(len(query_words), 1)
                results.append((chunk, score))

        results.sort(key=lambda x: x[1], reverse=True)
        results = results[:max_results]

        total_tokens = sum(len(chunk.text.split()) * 1.3 for chunk, _ in results)
        search_time = (time.time() - start_time) * 1000

        return RetrievedContext(
            chunks=[chunk for chunk, _ in results],
            total_tokens=int(total_tokens),
            search_time_ms=round(search_time, 2),
        )

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(vec1) != len(vec2):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def _extract_entities(self, text: str) -> List[Tuple[str, str]]:
        """Extract entities from text using pattern matching."""
        import re

        entities = []

        # Network patterns
        network_patterns = [
            (r'network\s+["\']?([A-Za-z0-9_\- ]+)["\']?', "network"),
            (r'SSID\s+["\']?([A-Za-z0-9_\-]+)["\']?', "ssid"),
            (r'VLAN\s+(\d+)', "vlan"),
        ]

        # Device patterns
        device_patterns = [
            (r'(?:device|AP|switch|router|MX|MS|MR)\s+["\']?([A-Za-z0-9_\-]+)["\']?', "device"),
            (r'serial\s+([A-Z0-9\-]+)', "device_serial"),
        ]

        # IP patterns
        ip_pattern = r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b'

        for pattern, entity_type in network_patterns + device_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                entities.append((entity_type, match))

        # IPs
        ips = re.findall(ip_pattern, text)
        for ip in ips:
            entities.append(("ip_address", ip))

        return entities

    def _track_entity(
        self,
        session_id: str,
        entity_type: str,
        entity_name: str,
        context: str,
    ):
        """Track entity mention in session."""
        key = f"{entity_type}:{entity_name.lower()}"

        if key in self._entities[session_id]:
            entity = self._entities[session_id][key]
            entity.last_mentioned = datetime.utcnow()
            entity.mention_count += 1
            if len(entity.context_snippets) < 5:
                entity.context_snippets.append(context[:100])
        else:
            self._entities[session_id][key] = EntityMention(
                entity_type=entity_type,
                entity_name=entity_name,
                context_snippets=[context[:100]],
            )

    def get_session_entities(self, session_id: str) -> List[EntityMention]:
        """Get all entities mentioned in a session."""
        return list(self._entities.get(session_id, {}).values())

    def get_recent_entities(
        self,
        session_id: str,
        entity_type: Optional[str] = None,
        limit: int = 10,
    ) -> List[EntityMention]:
        """Get recently mentioned entities."""
        entities = self._entities.get(session_id, {}).values()

        if entity_type:
            entities = [e for e in entities if e.entity_type == entity_type]

        sorted_entities = sorted(
            entities,
            key=lambda e: e.last_mentioned,
            reverse=True,
        )

        return sorted_entities[:limit]

    def resolve_entity(
        self,
        session_id: str,
        partial_name: str,
        entity_type: Optional[str] = None,
    ) -> Optional[EntityMention]:
        """Resolve a partial entity name to a tracked entity."""
        partial_lower = partial_name.lower()
        candidates = []

        for key, entity in self._entities.get(session_id, {}).items():
            if entity_type and entity.entity_type != entity_type:
                continue

            name_lower = entity.entity_name.lower()
            if partial_lower in name_lower or name_lower in partial_lower:
                candidates.append(entity)

        if not candidates:
            return None

        # Return most recently mentioned match
        return max(candidates, key=lambda e: e.last_mentioned)

    async def _cleanup_old_chunks(self):
        """Remove chunks older than TTL."""
        now = datetime.utcnow()
        expired = []

        for chunk_id, chunk in self._chunks.items():
            if now - chunk.timestamp > self._chunk_ttl:
                expired.append(chunk_id)

        for chunk_id in expired:
            chunk = self._chunks.pop(chunk_id, None)
            if chunk and chunk.session_id:
                session_chunks = self._session_chunks.get(chunk.session_id, [])
                if chunk_id in session_chunks:
                    session_chunks.remove(chunk_id)

        if expired:
            logger.info(f"[ContextEmbeddings] Cleaned up {len(expired)} expired chunks")

    def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        """Get a summary of context for a session."""
        chunk_ids = self._session_chunks.get(session_id, [])
        chunks = [self._chunks[cid] for cid in chunk_ids if cid in self._chunks]

        entities = self.get_session_entities(session_id)

        return {
            "session_id": session_id,
            "chunk_count": len(chunks),
            "total_text_length": sum(len(c.text) for c in chunks),
            "sources": list(set(c.source for c in chunks)),
            "entity_count": len(entities),
            "entity_types": list(set(e.entity_type for e in entities)),
            "recent_entities": [
                {"type": e.entity_type, "name": e.entity_name}
                for e in self.get_recent_entities(session_id, limit=5)
            ],
        }

    def clear_session(self, session_id: str):
        """Clear all context for a session."""
        chunk_ids = self._session_chunks.pop(session_id, [])
        for chunk_id in chunk_ids:
            self._chunks.pop(chunk_id, None)

        self._entities.pop(session_id, None)

        logger.info(f"[ContextEmbeddings] Cleared session {session_id}")


class ContextWindowOptimizer:
    """Optimizes context window usage for LLM calls.

    Selects the most relevant context chunks to fit within
    token limits while maximizing information value.
    """

    def __init__(
        self,
        max_context_tokens: int = 4000,
        reserve_tokens: int = 1000,  # Reserve for response
    ):
        self.max_context_tokens = max_context_tokens
        self.reserve_tokens = reserve_tokens

    def optimize(
        self,
        retrieved: RetrievedContext,
        query: str,
        system_prompt_tokens: int = 0,
    ) -> List[ContextChunk]:
        """Select optimal context chunks within token budget.

        Args:
            retrieved: Retrieved context from semantic search
            query: The current query
            system_prompt_tokens: Tokens used by system prompt

        Returns:
            Optimized list of context chunks
        """
        available_tokens = (
            self.max_context_tokens - system_prompt_tokens - self.reserve_tokens
        )

        if available_tokens <= 0:
            return []

        selected = []
        used_tokens = 0

        # Prioritize by recency and diversity
        for chunk in retrieved.chunks:
            chunk_tokens = len(chunk.text.split()) * 1.3  # Rough token estimate

            if used_tokens + chunk_tokens <= available_tokens:
                selected.append(chunk)
                used_tokens += chunk_tokens
            else:
                # Try to fit a truncated version
                remaining_tokens = available_tokens - used_tokens
                if remaining_tokens > 50:
                    truncated_text = self._truncate_to_tokens(
                        chunk.text, int(remaining_tokens)
                    )
                    truncated_chunk = ContextChunk(
                        id=chunk.id,
                        text=truncated_text,
                        source=chunk.source,
                        session_id=chunk.session_id,
                        timestamp=chunk.timestamp,
                        metadata={**chunk.metadata, "truncated": True},
                    )
                    selected.append(truncated_chunk)
                break

        return selected

    def _truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        """Truncate text to approximate token count."""
        words = text.split()
        target_words = int(max_tokens / 1.3)
        if len(words) <= target_words:
            return text
        return " ".join(words[:target_words]) + "..."

    def build_context_prompt(
        self,
        chunks: List[ContextChunk],
        include_metadata: bool = False,
    ) -> str:
        """Build a context prompt from selected chunks."""
        if not chunks:
            return ""

        sections = []
        sections.append("**RELEVANT CONTEXT:**\n")

        for i, chunk in enumerate(chunks, 1):
            if include_metadata:
                source_info = f"[{chunk.source}]"
                sections.append(f"{i}. {source_info} {chunk.text}\n")
            else:
                sections.append(f"{i}. {chunk.text}\n")

        return "\n".join(sections)


# Singleton instances
_context_store: Optional[ContextEmbeddingStore] = None
_context_optimizer: Optional[ContextWindowOptimizer] = None


def get_context_store() -> ContextEmbeddingStore:
    """Get singleton context store."""
    global _context_store
    if _context_store is None:
        _context_store = ContextEmbeddingStore()
    return _context_store


def get_context_optimizer() -> ContextWindowOptimizer:
    """Get singleton context optimizer."""
    global _context_optimizer
    if _context_optimizer is None:
        _context_optimizer = ContextWindowOptimizer()
    return _context_optimizer
