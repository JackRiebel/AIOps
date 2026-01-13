"""Knowledge query service for RAG-based Cisco networking expert.

This service handles:
- Semantic search over knowledge base using vector similarity
- Hybrid search combining semantic + keyword matching
- Response generation with source citations (using Cisco Circuit ONLY)
- Implementation plan generation for the Implementation Agent

IMPORTANT: The Knowledge Agent ONLY uses Cisco Circuit for response generation.
The Implementation Agent (claude_service.py) can use Claude, Gemini, etc.
"""

import base64
import json
import logging
import os
import time
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

import httpx
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.knowledge import (
    KnowledgeDocument,
    KnowledgeChunk,
    KnowledgeQuery,
    RetrievedChunk,
    ParentChunk,
    ChunkWithContext,
    KnowledgeResponse,
    KnowledgeTextResponse,
    ImplementationStep,
    SourceCitation,
    KnowledgeQueryRequest
)
from src.services.embedding_service import EmbeddingService, get_embedding_service
from src.services.query_expander import CiscoQueryExpander, get_cisco_query_expander, ExpandedQuery
from src.services.mmr_reranker import DiversityReranker, get_diversity_reranker, ScoredItem
from src.services.knowledge_graph import KnowledgeGraphService, get_knowledge_graph_service
from src.services.entity_extractor import get_entity_extractor
from src.services.feedback_service import FeedbackService
from src.services.knowledge_cache import KnowledgeCache, get_knowledge_cache
from src.services.query_classifier import (
    QueryClassifier,
    QueryClassification,
    AdaptiveParameters,
    RetrievalMetrics,
    get_query_classifier,
)
from src.config.settings import get_settings

logger = logging.getLogger(__name__)


class KnowledgeService:
    """Service for querying the RAG knowledge base.

    IMPORTANT: This service uses Cisco Circuit exclusively for response generation.
    The Knowledge Agent is the authoritative source for Cisco networking information
    and must use Cisco's own AI infrastructure.
    """

    # Cisco Circuit API Configuration
    TOKEN_URL = "https://id.cisco.com/oauth2/default/v1/token"
    CHAT_BASE_URL = "https://chat-ai.cisco.com/openai/deployments"
    API_VERSION = "2025-04-01-preview"
    DEFAULT_MODEL = "gpt-4.1"  # Cisco Circuit's default model

    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        app_key: Optional[str] = None,
        use_query_expansion: bool = True,
        use_mmr_reranking: bool = True,
    ):
        """Initialize the knowledge service with Cisco Circuit credentials.

        Args:
            embedding_service: Service for generating query embeddings.
            client_id: Cisco OAuth Client ID.
            client_secret: Cisco OAuth Client Secret.
            app_key: Cisco Circuit App Key.
            use_query_expansion: Enable HyDE and multi-query expansion.
            use_mmr_reranking: Enable MMR diversity re-ranking.
        """
        self._embedding_service = embedding_service
        self.use_query_expansion = use_query_expansion
        self.use_mmr_reranking = use_mmr_reranking

        # Load Cisco Circuit credentials - database first, then passed params, then settings
        from src.services.config_service import get_config_or_env
        settings = get_settings()
        self.client_id = (
            client_id or
            get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID") or
            settings.cisco_circuit_client_id
        )
        self.client_secret = (
            client_secret or
            get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET") or
            settings.cisco_circuit_client_secret
        )
        self.app_key = (
            app_key or
            get_config_or_env("cisco_circuit_app_key", "CISCO_CIRCUIT_APP_KEY") or
            settings.cisco_circuit_app_key
        )

        # Token caching
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0

        # Query expansion and reranking
        self._query_expander: Optional[CiscoQueryExpander] = None
        self._reranker: Optional[DiversityReranker] = None
        self._graph_service: Optional[KnowledgeGraphService] = None
        self._feedback_service: Optional[FeedbackService] = None
        self._cache: Optional[KnowledgeCache] = None

    @property
    def graph_service(self) -> KnowledgeGraphService:
        """Lazy-load knowledge graph service."""
        if self._graph_service is None:
            self._graph_service = get_knowledge_graph_service()
        return self._graph_service

    @property
    def query_expander(self) -> CiscoQueryExpander:
        """Lazy-load query expander."""
        if self._query_expander is None:
            self._query_expander = get_cisco_query_expander()
        return self._query_expander

    @property
    def reranker(self) -> DiversityReranker:
        """Lazy-load diversity reranker."""
        if self._reranker is None:
            self._reranker = get_diversity_reranker()
        return self._reranker

    @property
    def embedding_service(self) -> EmbeddingService:
        """Lazy-load embedding service."""
        if self._embedding_service is None:
            self._embedding_service = get_embedding_service()
        return self._embedding_service

    @property
    def feedback_service(self) -> FeedbackService:
        """Lazy-load feedback service."""
        if self._feedback_service is None:
            self._feedback_service = FeedbackService(self._embedding_service)
        return self._feedback_service

    @property
    def cache(self) -> KnowledgeCache:
        """Lazy-load knowledge cache."""
        if self._cache is None:
            self._cache = get_knowledge_cache()
        return self._cache

    @property
    def query_classifier(self) -> QueryClassifier:
        """Lazy-load query classifier."""
        if not hasattr(self, '_query_classifier') or self._query_classifier is None:
            self._query_classifier = get_query_classifier()
        return self._query_classifier

    def _get_chat_url(self, model: str = None) -> str:
        """Get the chat URL for the specified model."""
        model = model or self.DEFAULT_MODEL
        return f"{self.CHAT_BASE_URL}/{model}/chat/completions?api-version={self.API_VERSION}"

    async def _get_access_token(self) -> str:
        """Fetch OAuth token with client credentials, with caching.

        Returns:
            Access token string

        Raises:
            ValueError: If Cisco Circuit credentials not configured
            Exception: If token request fails
        """
        # Return cached token if still valid (with 5 min buffer)
        if self._access_token and time.time() < (self._token_expiry - 300):
            return self._access_token

        if not self.client_id or not self.client_secret:
            raise ValueError(
                "Cisco Circuit credentials not configured. "
                "Set CISCO_CIRCUIT_CLIENT_ID and CISCO_CIRCUIT_CLIENT_SECRET."
            )

        # Build Basic auth header
        credentials = f"{self.client_id}:{self.client_secret}"
        basic_auth = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                self.TOKEN_URL,
                headers={
                    "Authorization": f"Basic {basic_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data="grant_type=client_credentials",
                timeout=30.0
            )

            if response.status_code != 200:
                logger.error(f"Cisco Circuit token request failed: {response.status_code} - {response.text}")
                raise Exception(f"Failed to get Cisco Circuit access token: {response.status_code}")

            token_data = response.json()
            self._access_token = token_data["access_token"]
            # expires_in is in seconds
            self._token_expiry = time.time() + token_data.get("expires_in", 3600)

            logger.info("Successfully obtained Cisco Circuit access token for Knowledge Agent")
            return self._access_token

    async def _call_circuit_api(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000
    ) -> Tuple[str, int, int]:
        """Call Cisco Circuit API for response generation.

        Args:
            system_prompt: System prompt for the model.
            user_prompt: User prompt/question.
            max_tokens: Maximum response tokens.

        Returns:
            Tuple of (response_text, input_tokens, output_tokens)
        """
        access_token = await self._get_access_token()
        chat_url = self._get_chat_url()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                chat_url,
                headers={
                    "Content-Type": "application/json",
                    "api-key": access_token,
                },
                json={
                    "messages": messages,
                    "user": json.dumps({"appkey": self.app_key}) if self.app_key else None,
                    "temperature": 0.3,  # Lower temperature for factual responses
                    "max_tokens": max_tokens,
                    "stop": ["<|im_end|>"],
                },
                timeout=120.0
            )

            if response.status_code != 200:
                logger.error(f"Cisco Circuit API error: {response.status_code} - {response.text}")
                raise Exception(f"Cisco Circuit API error: {response.status_code}")

            data = response.json()
            response_text = data["choices"][0]["message"]["content"] or ""

            input_tokens = data.get("usage", {}).get("prompt_tokens", 0)
            output_tokens = data.get("usage", {}).get("completion_tokens", 0)

            return response_text, input_tokens, output_tokens

    async def semantic_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[RetrievedChunk]:
        """Perform semantic search over knowledge chunks.

        Args:
            session: Database session.
            query: Search query text.
            top_k: Number of results to return.
            filters: Optional filters (product, doc_type).

        Returns:
            List of retrieved chunks with relevance scores.
        """
        # Generate query embedding (is_query=True adds "query:" prefix for e5 models)
        query_embedding = await self.embedding_service.generate_embedding(query, is_query=True)

        # Build query with optional filters
        filter_clauses = []
        params = {
            "embedding": str(query_embedding),
            "limit": top_k
        }

        if filters:
            if filters.get("product"):
                filter_clauses.append("kd.product = :product")
                params["product"] = filters["product"]
            if filters.get("doc_type"):
                filter_clauses.append("kd.doc_type = :doc_type")
                params["doc_type"] = filters["doc_type"]

        where_clause = ""
        if filter_clauses:
            where_clause = "WHERE " + " AND ".join(filter_clauses)

        # Use cosine similarity for ranking
        # Note: Use CAST instead of :: to avoid SQLAlchemy parameter parsing issues
        sql = f"""
            SELECT
                kc.id,
                kc.document_id,
                kc.content,
                kc.chunk_metadata,
                kc.chunk_index,
                kd.filename,
                kd.title,
                kd.doc_type,
                kd.product,
                1 - (kc.embedding <=> CAST(:embedding AS vector)) as relevance,
                kc.quality_score,
                kc.hierarchy_level,
                kc.parent_chunk_id
            FROM knowledge_chunks kc
            JOIN knowledge_documents kd ON kc.document_id = kd.id
            {where_clause}
            ORDER BY kc.embedding <=> CAST(:embedding AS vector)
            LIMIT :limit
        """

        result = await session.execute(text(sql), params)
        rows = result.fetchall()

        chunks = []
        for row in rows:
            chunks.append(RetrievedChunk(
                id=row[0],
                document_id=row[1],
                content=row[2],
                chunk_metadata=row[3] or {},
                chunk_index=row[4],
                document_filename=row[5],
                document_title=row[6],
                document_type=row[7],
                document_product=row[8],
                relevance=float(row[9]),
                quality_score=float(row[10]) if row[10] is not None else None,
                hierarchy_level=row[11],
                parent_chunk_id=row[12],
            ))

        return chunks

    async def hybrid_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        semantic_weight: float = 0.7
    ) -> List[RetrievedChunk]:
        """Perform hybrid search combining semantic and keyword matching.

        Args:
            session: Database session.
            query: Search query.
            top_k: Number of results.
            filters: Optional filters.
            semantic_weight: Weight for semantic vs keyword (0-1).

        Returns:
            Combined search results.
        """
        # Get semantic results
        semantic_results = await self.semantic_search(
            session, query, top_k=top_k * 2, filters=filters
        )

        # Get keyword results using PostgreSQL full-text search
        filter_clauses = []
        params = {"query": query, "limit": top_k * 2}

        if filters:
            if filters.get("product"):
                filter_clauses.append("kd.product = :product")
                params["product"] = filters["product"]
            if filters.get("doc_type"):
                filter_clauses.append("kd.doc_type = :doc_type")
                params["doc_type"] = filters["doc_type"]

        where_clause = ""
        if filter_clauses:
            where_clause = "AND " + " AND ".join(filter_clauses)

        # Full-text search query
        keyword_sql = f"""
            SELECT
                kc.id,
                kc.document_id,
                kc.content,
                kc.chunk_metadata,
                kc.chunk_index,
                kd.filename,
                kd.title,
                kd.doc_type,
                kd.product,
                ts_rank(to_tsvector('english', kc.content), plainto_tsquery('english', :query)) as rank,
                kc.hierarchy_level,
                kc.parent_chunk_id
            FROM knowledge_chunks kc
            JOIN knowledge_documents kd ON kc.document_id = kd.id
            WHERE to_tsvector('english', kc.content) @@ plainto_tsquery('english', :query)
            {where_clause}
            ORDER BY rank DESC
            LIMIT :limit
        """

        try:
            result = await session.execute(text(keyword_sql), params)
            keyword_rows = result.fetchall()
        except Exception:
            # Fall back to LIKE search if full-text fails
            keyword_rows = []

        # Build keyword results map
        keyword_map = {}
        max_keyword_rank = 1.0
        for row in keyword_rows:
            if row[9] > max_keyword_rank:
                max_keyword_rank = row[9]
            keyword_map[row[0]] = {
                "id": row[0],
                "document_id": row[1],
                "content": row[2],
                "chunk_metadata": row[3] or {},
                "chunk_index": row[4],
                "filename": row[5],
                "title": row[6],
                "doc_type": row[7],
                "product": row[8],
                "keyword_score": row[9],
                "hierarchy_level": row[10],
                "parent_chunk_id": row[11],
            }

        # Combine scores
        combined = {}

        for chunk in semantic_results:
            keyword_score = 0
            if chunk.id in keyword_map:
                keyword_score = keyword_map[chunk.id]["keyword_score"] / max_keyword_rank

            combined_score = (
                semantic_weight * chunk.relevance +
                (1 - semantic_weight) * keyword_score
            )

            combined[chunk.id] = RetrievedChunk(
                id=chunk.id,
                document_id=chunk.document_id,
                content=chunk.content,
                chunk_metadata=chunk.chunk_metadata,
                chunk_index=chunk.chunk_index,
                document_filename=chunk.document_filename,
                document_title=chunk.document_title,
                document_type=chunk.document_type,
                document_product=chunk.document_product,
                relevance=combined_score,
                hierarchy_level=chunk.hierarchy_level,
                parent_chunk_id=chunk.parent_chunk_id,
            )

        # Add keyword-only results
        for chunk_id, data in keyword_map.items():
            if chunk_id not in combined:
                combined[chunk_id] = RetrievedChunk(
                    id=data["id"],
                    document_id=data["document_id"],
                    content=data["content"],
                    chunk_metadata=data["chunk_metadata"],
                    chunk_index=data["chunk_index"],
                    document_filename=data["filename"],
                    document_title=data["title"],
                    document_type=data["doc_type"],
                    document_product=data["product"],
                    relevance=(1 - semantic_weight) * (data["keyword_score"] / max_keyword_rank),
                    hierarchy_level=data.get("hierarchy_level"),
                    parent_chunk_id=data.get("parent_chunk_id"),
                )

        # Sort by combined score and return top_k
        sorted_results = sorted(combined.values(), key=lambda x: x.relevance, reverse=True)
        return sorted_results[:top_k]

    async def enhanced_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        use_hyde: bool = True,
        use_multi_query: bool = True,
        use_mmr: bool = True,
        use_feedback_boost: bool = True,
        feedback_boost_weight: float = 0.2,
        use_cache: bool = True,
        context: Optional[str] = None,
    ) -> Tuple[List[RetrievedChunk], Optional[ExpandedQuery]]:
        """Perform enhanced search with query expansion and MMR reranking.

        This is the recommended search method for production use.
        It combines:
        1. HyDE (Hypothetical Document Embeddings) for better semantic matching
        2. Multi-query expansion for broader coverage
        3. MMR re-ranking for diverse, relevant results
        4. Feedback-based score boosting (using historical feedback data)
        5. Multi-level caching for performance

        Args:
            session: Database session.
            query: Search query.
            top_k: Number of final results.
            filters: Optional filters (product, doc_type).
            use_hyde: Use HyDE for query expansion.
            use_multi_query: Generate query variations.
            use_mmr: Apply MMR diversity reranking.
            use_feedback_boost: Apply feedback-based score boosting.
            feedback_boost_weight: Weight for feedback boost (0-1).
            use_cache: Use caching for improved performance.
            context: Optional context for HyDE generation.

        Returns:
            Tuple of (results, expanded_query) where expanded_query contains
            the HyDE document and query variations if used.
        """
        start_time = time.time()

        # Check cache first
        if use_cache:
            try:
                cached_results = await self.cache.get_search_results(
                    query=query,
                    top_k=top_k,
                    filters=filters,
                )
                if cached_results is not None:
                    # Reconstruct RetrievedChunk objects from cached data
                    results = [
                        RetrievedChunk(
                            id=r["id"],
                            document_id=r["document_id"],
                            content=r["content"],
                            chunk_metadata=r.get("chunk_metadata", {}),
                            chunk_index=r.get("chunk_index"),
                            document_filename=r.get("document_filename", ""),
                            document_title=r.get("document_title"),
                            document_type=r.get("document_type", "unknown"),
                            document_product=r.get("document_product"),
                            relevance=r["relevance"],
                        )
                        for r in cached_results
                    ]
                    logger.debug(f"Cache hit for query: {query[:50]}...")
                    return results, ExpandedQuery(original_query=query)
            except Exception as e:
                logger.warning(f"Cache lookup failed: {e}")

        expanded_query: Optional[ExpandedQuery] = None

        # Step 1: Query Expansion (if enabled)
        if self.use_query_expansion and (use_hyde or use_multi_query):
            try:
                expanded_query = await self.query_expander.expand_query(
                    query=query,
                    use_hyde=use_hyde,
                    use_multi_query=use_multi_query,
                    num_variations=3,
                    context=context,
                )
                logger.debug(f"Query expanded: HyDE={bool(expanded_query.hyde_document)}, "
                           f"variations={len(expanded_query.query_variations)}")
            except Exception as e:
                logger.warning(f"Query expansion failed, using original query: {e}")
                expanded_query = ExpandedQuery(original_query=query)
        else:
            expanded_query = ExpandedQuery(original_query=query)

        # Step 2: Retrieve candidates using multiple queries
        all_candidates: Dict[int, RetrievedChunk] = {}
        candidate_embeddings: Dict[int, List[float]] = {}
        candidate_doc_ids: Dict[int, int] = {}
        candidate_doc_types: Dict[int, str] = {}

        # Get queries to search with
        search_queries = []

        # If HyDE is available, use it as primary search
        if expanded_query.hyde_document:
            search_queries.append(expanded_query.hyde_document)

        # Add original query
        search_queries.append(query)

        # Add query variations
        if expanded_query.query_variations:
            search_queries.extend(expanded_query.query_variations[:2])  # Limit to avoid too many

        # Search with each query and aggregate results
        for search_query in search_queries:
            try:
                # Use hybrid search for each query
                results = await self.hybrid_search(
                    session=session,
                    query=search_query,
                    top_k=top_k * 2,  # Get more candidates for reranking
                    filters=filters,
                )

                # Get embeddings for MMR if needed
                if use_mmr and self.use_mmr_reranking and results:
                    # Get chunk embeddings from database
                    chunk_ids = [r.id for r in results if r.id not in candidate_embeddings]
                    if chunk_ids:
                        emb_sql = """
                            SELECT kc.id, kc.embedding, kc.document_id, kd.doc_type
                            FROM knowledge_chunks kc
                            JOIN knowledge_documents kd ON kc.document_id = kd.id
                            WHERE kc.id = ANY(:ids)
                        """
                        emb_result = await session.execute(
                            text(emb_sql),
                            {"ids": chunk_ids}
                        )
                        for row in emb_result.fetchall():
                            chunk_id, embedding, doc_id, doc_type = row
                            if embedding is not None:
                                # Convert to list if needed
                                if hasattr(embedding, 'tolist'):
                                    candidate_embeddings[chunk_id] = embedding.tolist()
                                else:
                                    candidate_embeddings[chunk_id] = list(embedding)
                                candidate_doc_ids[chunk_id] = doc_id
                                candidate_doc_types[chunk_id] = doc_type

                # Aggregate results (keep highest score for duplicates)
                for chunk in results:
                    if chunk.id not in all_candidates or chunk.relevance > all_candidates[chunk.id].relevance:
                        all_candidates[chunk.id] = chunk

            except Exception as e:
                logger.warning(f"Search with query variation failed: {e}")
                continue

        if not all_candidates:
            return [], expanded_query

        # Step 3: MMR Reranking (if enabled)
        if use_mmr and self.use_mmr_reranking and len(all_candidates) > top_k:
            try:
                # Generate query embedding for MMR (is_query=True for e5 models)
                query_embedding = await self.embedding_service.generate_embedding(query, is_query=True)

                # Build scored items for reranking
                scored_items = []
                doc_ids_list = []
                doc_types_list = []

                for chunk_id, chunk in all_candidates.items():
                    if chunk_id in candidate_embeddings:
                        scored_items.append(ScoredItem(
                            item=chunk,
                            embedding=candidate_embeddings[chunk_id],
                            relevance_score=chunk.relevance,
                        ))
                        doc_ids_list.append(candidate_doc_ids.get(chunk_id, 0))
                        doc_types_list.append(candidate_doc_types.get(chunk_id, "unknown"))

                if scored_items:
                    # Apply diversity reranking
                    reranked = self.reranker.rerank_with_metadata(
                        query_embedding=query_embedding,
                        candidates=scored_items,
                        doc_ids=doc_ids_list,
                        doc_types=doc_types_list,
                        top_k=top_k,
                    )

                    # Update relevance scores with MMR scores
                    results = []
                    for scored_item in reranked:
                        chunk = scored_item.item
                        # Blend original relevance with MMR score
                        if scored_item.mmr_score is not None:
                            chunk.relevance = (chunk.relevance + scored_item.mmr_score) / 2
                        results.append(chunk)

                    logger.debug(f"MMR reranked {len(scored_items)} candidates to {len(results)} results")

                    # Step 4: Apply feedback boosts (if enabled)
                    if use_feedback_boost and results:
                        results = await self._apply_feedback_boosts(
                            session, results, feedback_boost_weight
                        )

                    # Step 5: Apply quality-based reranking
                    results = self.rerank_by_quality(results)

                    # Cache results for future queries
                    if use_cache and results:
                        await self._cache_results(query, top_k, filters, results)

                    return results, expanded_query

            except Exception as e:
                logger.warning(f"MMR reranking failed, using original ranking: {e}")

        # Fallback: return top_k by relevance
        sorted_results = sorted(all_candidates.values(), key=lambda x: x.relevance, reverse=True)
        final_results = sorted_results[:top_k]

        # Apply feedback boosts (if enabled)
        if use_feedback_boost and final_results:
            final_results = await self._apply_feedback_boosts(
                session, final_results, feedback_boost_weight
            )

        # Apply quality-based reranking
        final_results = self.rerank_by_quality(final_results)

        # Cache results for future queries
        if use_cache and final_results:
            await self._cache_results(query, top_k, filters, final_results)

        return final_results, expanded_query

    async def _cache_results(
        self,
        query: str,
        top_k: int,
        filters: Optional[Dict[str, Any]],
        results: List[RetrievedChunk],
    ) -> None:
        """Cache search results for future queries."""
        try:
            # Convert to serializable format
            cacheable = [
                {
                    "id": r.id,
                    "document_id": r.document_id,
                    "content": r.content,
                    "relevance": r.relevance,
                    "chunk_index": r.chunk_index,
                    "metadata": r.metadata,
                }
                for r in results
            ]
            await self.cache.set_search_results(
                query=query,
                top_k=top_k,
                results=cacheable,
                filters=filters,
            )
        except Exception as e:
            logger.warning(f"Failed to cache results: {e}")

    async def _apply_feedback_boosts(
        self,
        session: AsyncSession,
        chunks: List[RetrievedChunk],
        boost_weight: float = 0.2,
    ) -> List[RetrievedChunk]:
        """Apply feedback-based score boosts to retrieved chunks.

        Args:
            session: Database session.
            chunks: Retrieved chunks to boost.
            boost_weight: Weight for feedback boost (0-1).

        Returns:
            Chunks with adjusted relevance scores, re-sorted.
        """
        try:
            chunk_ids = [c.id for c in chunks]
            chunk_scores = {c.id: c.relevance for c in chunks}

            # Get boosted scores from feedback service
            boosted_scores = await self.feedback_service.apply_feedback_boosts(
                session=session,
                chunk_scores=chunk_scores,
                boost_weight=boost_weight,
            )

            # Update chunk relevance scores
            for chunk in chunks:
                if chunk.id in boosted_scores:
                    chunk.relevance = boosted_scores[chunk.id]

            # Re-sort by boosted scores
            chunks.sort(key=lambda x: x.relevance, reverse=True)

            logger.debug(f"Applied feedback boosts to {len(chunks)} chunks")
            return chunks

        except Exception as e:
            logger.warning(f"Failed to apply feedback boosts: {e}")
            return chunks

    # =========================================================================
    # Parent-Child Context Retrieval
    # =========================================================================

    async def retrieve_with_context(
        self,
        session: AsyncSession,
        chunk_ids: List[int],
        include_parent: bool = True,
    ) -> List[ChunkWithContext]:
        """Retrieve chunks with their hierarchical parent context.

        When a chunk is retrieved, this method fetches its parent section
        to provide fuller context for response generation.

        Args:
            session: Database session.
            chunk_ids: List of chunk IDs to retrieve with context.
            include_parent: Whether to fetch parent chunks.

        Returns:
            List of ChunkWithContext objects with parent context.
        """
        if not chunk_ids:
            return []

        # Fetch chunks with hierarchy info
        sql = """
            SELECT
                kc.id,
                kc.document_id,
                kc.content,
                kc.chunk_metadata,
                kc.chunk_index,
                kc.hierarchy_level,
                kc.parent_chunk_id,
                kd.filename,
                kd.title,
                kd.doc_type,
                kd.product,
                kc.quality_score
            FROM knowledge_chunks kc
            JOIN knowledge_documents kd ON kc.document_id = kd.id
            WHERE kc.id = ANY(:chunk_ids)
        """

        result = await session.execute(text(sql), {"chunk_ids": chunk_ids})
        rows = result.fetchall()

        # Build chunk map
        chunks_map: Dict[int, RetrievedChunk] = {}
        parent_ids_needed: set = set()

        for row in rows:
            chunk_id = row[0]
            parent_chunk_id = row[6]

            chunk = RetrievedChunk(
                id=chunk_id,
                document_id=row[1],
                content=row[2],
                chunk_metadata=row[3] or {},
                chunk_index=row[4],
                hierarchy_level=row[5],
                parent_chunk_id=parent_chunk_id,
                document_filename=row[7],
                document_title=row[8],
                document_type=row[9],
                document_product=row[10],
                quality_score=float(row[11]) if row[11] is not None else None,
                relevance=1.0,  # Will be set by caller
            )
            chunks_map[chunk_id] = chunk

            if include_parent and parent_chunk_id:
                parent_ids_needed.add(parent_chunk_id)

        # Fetch parent chunks if needed
        parents_map: Dict[int, ParentChunk] = {}

        if parent_ids_needed:
            parent_sql = """
                SELECT id, content, chunk_index, hierarchy_level, chunk_metadata
                FROM knowledge_chunks
                WHERE id = ANY(:parent_ids)
            """
            parent_result = await session.execute(
                text(parent_sql),
                {"parent_ids": list(parent_ids_needed)}
            )
            parent_rows = parent_result.fetchall()

            for prow in parent_rows:
                parents_map[prow[0]] = ParentChunk(
                    id=prow[0],
                    content=prow[1],
                    chunk_index=prow[2],
                    hierarchy_level=prow[3],
                    chunk_metadata=prow[4] or {},
                )

        # Build results with context, preserving original order
        results: List[ChunkWithContext] = []
        for chunk_id in chunk_ids:
            if chunk_id not in chunks_map:
                continue

            chunk = chunks_map[chunk_id]
            parent = parents_map.get(chunk.parent_chunk_id) if chunk.parent_chunk_id else None

            # Build context text with parent content prepended
            context_text = self._build_context_text(chunk, parent)

            results.append(ChunkWithContext(
                chunk=chunk,
                parent=parent,
                context_text=context_text,
            ))

        logger.debug(
            f"Retrieved {len(results)} chunks with context "
            f"({len(parents_map)} parent chunks fetched)"
        )
        return results

    def _build_context_text(
        self,
        chunk: RetrievedChunk,
        parent: Optional[ParentChunk],
    ) -> str:
        """Build context string with parent section prepended.

        Args:
            chunk: The retrieved chunk.
            parent: Optional parent section chunk.

        Returns:
            Combined text with parent context if available.
        """
        if not parent:
            return chunk.content

        # Extract section header from parent metadata if available
        header = parent.chunk_metadata.get('h1') or parent.chunk_metadata.get('h2') or ''

        # Build context with section indicator
        parts = []

        if header:
            parts.append(f"[Section: {header}]")

        # Include parent content (truncated if very long)
        parent_content = parent.content
        if len(parent_content) > 500:
            parent_content = parent_content[:500] + "..."
        parts.append(f"[Parent Context: {parent_content}]")

        # Add the actual chunk content
        parts.append(chunk.content)

        return "\n\n".join(parts)

    async def _add_parent_context(
        self,
        session: AsyncSession,
        results: List[RetrievedChunk],
    ) -> List[RetrievedChunk]:
        """Add parent context to retrieved chunks by expanding their content.

        This method enriches RetrievedChunk objects by prepending parent
        section context to their content field, making the context available
        for downstream processing without changing the return type.

        Args:
            session: Database session.
            results: List of retrieved chunks.

        Returns:
            The same chunks with expanded content including parent context.
        """
        if not results:
            return results

        # Fetch chunks with context
        chunk_ids = [r.id for r in results]
        chunks_with_context = await self.retrieve_with_context(
            session, chunk_ids, include_parent=True
        )

        # Build map of chunk_id -> context_text
        context_map = {cwc.chunk.id: cwc.context_text for cwc in chunks_with_context}

        # Update result content with context
        for result in results:
            if result.id in context_map:
                # Store original content in metadata for reference
                if 'original_content' not in result.chunk_metadata:
                    result.chunk_metadata['original_content'] = result.content
                # Replace content with context-enriched version
                result.content = context_map[result.id]

        return results

    def _collect_metrics_from_results(
        self,
        results: List[RetrievedChunk],
        params: AdaptiveParameters,
        cache_hit: bool = False,
        total_ms: Optional[int] = None,
    ) -> RetrievalMetrics:
        """Collect retrieval metrics from results.

        Args:
            results: Final retrieved chunks.
            params: Adaptive parameters that were used.
            cache_hit: Whether results came from cache.
            total_ms: Total elapsed time in milliseconds.

        Returns:
            RetrievalMetrics with computed values.
        """
        metrics = RetrievalMetrics(
            final_count=len(results),
            used_hyde=params.use_hyde,
            used_multi_query=params.use_multi_query,
            used_mmr=params.use_mmr,
            used_feedback_boost=True,  # Always used in adaptive_search
            used_parent_context=params.include_parent_context,
            cache_hit=cache_hit,
            total_ms=total_ms,
        )

        if not results:
            return metrics

        # Calculate quality metrics
        metrics.avg_relevance = sum(r.relevance for r in results) / len(results)
        metrics.avg_quality_score = sum(
            (r.quality_score or 0.5) for r in results
        ) / len(results)

        # Calculate diversity (unique documents / total)
        doc_ids = set()
        for r in results:
            doc_ids.add(r.document_id)

            # Build distributions
            doc_type = r.document_type or "unknown"
            metrics.doc_type_distribution[doc_type] = \
                metrics.doc_type_distribution.get(doc_type, 0) + 1

            if r.document_product:
                metrics.product_distribution[r.document_product] = \
                    metrics.product_distribution.get(r.document_product, 0) + 1

        metrics.diversity_score = len(doc_ids) / len(results)

        return metrics

    async def adaptive_search(
        self,
        session: AsyncSession,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        override_params: Optional[Dict[str, Any]] = None,
        use_cache: bool = True,
        context: Optional[str] = None,
        collect_metrics: bool = True,
    ) -> Tuple[List[RetrievedChunk], QueryClassification, AdaptiveParameters, Optional[RetrievalMetrics]]:
        """Perform search with adaptive parameters based on query classification.

        This is the recommended search method for production use when you want
        the system to automatically tune retrieval parameters based on query type.

        The method:
        1. Classifies the query by intent and complexity
        2. Determines optimal retrieval parameters
        3. Executes enhanced_search with those parameters
        4. Collects retrieval metrics for observability
        5. Returns results with classification and metrics

        Args:
            session: Database session.
            query: Search query.
            filters: Optional filters (product, doc_type). If provided, these
                    override the auto-detected filters from classification.
            override_params: Optional dict to override specific adaptive parameters.
                           Useful for A/B testing or user preferences.
            use_cache: Use caching for improved performance.
            context: Optional context for HyDE generation.
            collect_metrics: Whether to collect detailed retrieval metrics.

        Returns:
            Tuple of (results, classification, params, metrics) where:
            - results: Retrieved chunks sorted by relevance
            - classification: Query classification details
            - params: The adaptive parameters that were used
            - metrics: Retrieval pipeline metrics (if collect_metrics=True)
        """
        start_time = time.time()

        # Step 1: Classify the query
        classification = self.query_classifier.classify(query)
        logger.info(
            f"Query classified: intent={classification.intent.value}, "
            f"complexity={classification.complexity.value}, "
            f"products={classification.detected_products}"
        )

        # Step 2: Get adaptive parameters
        params = self.query_classifier.get_adaptive_parameters(classification)

        # Step 3: Apply any user overrides
        if override_params:
            for key, value in override_params.items():
                if hasattr(params, key):
                    setattr(params, key, value)
                    logger.debug(f"Override applied: {key}={value}")

        # Step 4: Build filters (user-provided filters take precedence)
        search_filters = filters.copy() if filters else {}

        # Add product filters from classification if not already specified
        if params.product_filters and "product" not in search_filters:
            # If multiple products detected, use the first one
            # (could be enhanced to support multi-product search)
            if len(params.product_filters) == 1:
                search_filters["product"] = params.product_filters[0]

        # Add doc_type filters from classification if not already specified
        if params.doc_type_filters and "doc_type" not in search_filters:
            # Use first doc type as primary filter
            # (enhanced_search handles single doc_type, could be extended)
            if len(params.doc_type_filters) == 1:
                search_filters["doc_type"] = params.doc_type_filters[0]

        # Step 5: Execute enhanced search with adaptive parameters
        results, expanded_query = await self.enhanced_search(
            session=session,
            query=query,
            top_k=params.top_k,
            filters=search_filters if search_filters else None,
            use_hyde=params.use_hyde,
            use_multi_query=params.use_multi_query,
            use_mmr=params.use_mmr,
            use_feedback_boost=True,
            feedback_boost_weight=params.feedback_boost_weight,
            use_cache=use_cache,
            context=context,
        )

        # Step 6: Apply parent context if enabled (Sprint 3)
        if params.include_parent_context and results:
            results = await self._add_parent_context(session, results)
            logger.debug(f"Applied parent context to {len(results)} chunks")

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Step 7: Collect retrieval metrics (Sprint 4)
        metrics = None
        if collect_metrics:
            metrics = self._collect_metrics_from_results(
                results=results,
                params=params,
                cache_hit=False,  # Cache handled in enhanced_search
                total_ms=elapsed_ms,
            )

        logger.info(
            f"Adaptive search completed: {len(results)} results in {elapsed_ms}ms "
            f"(top_k={params.top_k}, hyde={params.use_hyde}, mmr={params.use_mmr})"
        )

        return results, classification, params, metrics

    async def log_adaptive_search(
        self,
        session: AsyncSession,
        query: str,
        results: List[RetrievedChunk],
        classification: QueryClassification,
        params: AdaptiveParameters,
        user_id: Optional[int] = None,
        latency_ms: Optional[int] = None,
        metrics: Optional[RetrievalMetrics] = None,
    ) -> None:
        """Log an adaptive search query with classification and retrieval metrics.

        This should be called by API endpoints that use adaptive_search to enable
        analytics on query classification and retrieval metrics.

        Args:
            session: Database session.
            query: The original query text.
            results: Retrieved chunks from the search.
            classification: Query classification result.
            params: Adaptive parameters that were used.
            user_id: Optional user ID.
            latency_ms: Total latency in milliseconds.
            metrics: Pre-computed retrieval metrics. If not provided, will
                    calculate basic metrics from results.
        """
        try:
            # Build classification metadata
            classification_data = classification.to_dict()

            # Use provided metrics or calculate basic ones
            if metrics:
                retrieval_metrics_data = metrics.to_dict()
                # Add params_used to the stored metrics
                retrieval_metrics_data["params_used"] = params.to_dict()
            else:
                # Fallback: calculate basic metrics
                retrieval_metrics_data = {
                    "final_count": len(results),
                    "avg_relevance": sum(r.relevance for r in results) / len(results) if results else 0,
                    "avg_quality_score": sum((r.quality_score or 0.5) for r in results) / len(results) if results else 0,
                    "doc_type_distribution": {},
                    "product_distribution": {},
                    "diversity_score": 0,
                    "params_used": params.to_dict(),
                }

                # Calculate distributions
                if results:
                    doc_ids = set()
                    for r in results:
                        doc_ids.add(r.document_id)
                        doc_type = r.document_type or "unknown"
                        retrieval_metrics_data["doc_type_distribution"][doc_type] = \
                            retrieval_metrics_data["doc_type_distribution"].get(doc_type, 0) + 1
                        if r.document_product:
                            retrieval_metrics_data["product_distribution"][r.document_product] = \
                                retrieval_metrics_data["product_distribution"].get(r.document_product, 0) + 1

                    # Diversity score = unique docs / total results
                    retrieval_metrics_data["diversity_score"] = len(doc_ids) / len(results)

            # Create query log entry
            query_log = KnowledgeQuery(
                user_id=user_id,
                query_text=query,
                retrieved_chunk_ids=[r.id for r in results],
                latency_ms=latency_ms or (metrics.total_ms if metrics else None),
                created_at=datetime.utcnow(),
                query_classification=classification_data,
                retrieval_metrics=retrieval_metrics_data,
            )
            session.add(query_log)
            await session.commit()

            logger.debug(f"Logged adaptive search query: intent={classification.intent.value}")

        except Exception as e:
            logger.warning(f"Failed to log adaptive search: {e}")
            # Don't raise - logging failures shouldn't break search

    def rerank_by_quality(
        self,
        chunks: List[RetrievedChunk],
        relevance_weight: float = 0.7,
        quality_weight: float = 0.2,
        feedback_weight: float = 0.1,
    ) -> List[RetrievedChunk]:
        """Re-rank chunks using quality scores combined with relevance.

        Computes a final score that balances:
        - Semantic/keyword relevance (primary signal)
        - Content quality score (penalizes low-quality content)
        - Feedback score (if available from historical data)

        Args:
            chunks: Retrieved chunks to rerank.
            relevance_weight: Weight for semantic relevance (0-1).
            quality_weight: Weight for quality score (0-1).
            feedback_weight: Weight for feedback score (0-1).

        Returns:
            Chunks sorted by final_score.
        """
        if not chunks:
            return chunks

        for chunk in chunks:
            # Default quality score if not set (neutral)
            quality = chunk.quality_score if chunk.quality_score is not None else 0.5

            # Compute final score
            final_score = (
                relevance_weight * chunk.relevance +
                quality_weight * quality
            )

            # Store the final score
            chunk.final_score = final_score

        # Sort by final score (descending)
        chunks.sort(key=lambda x: x.final_score or x.relevance, reverse=True)

        logger.debug(
            f"Re-ranked {len(chunks)} chunks by quality "
            f"(relevance={relevance_weight}, quality={quality_weight})"
        )

        return chunks

    async def graph_enhanced_search(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        graph_hops: int = 1,
        entity_boost: float = 0.2,
    ) -> List[RetrievedChunk]:
        """Search enhanced with knowledge graph expansion.

        Combines traditional search with graph-based retrieval:
        1. Extract entities from query
        2. Find related entities via graph traversal
        3. Get chunks mentioning related entities
        4. Merge with regular search results

        Args:
            session: Database session.
            query: Search query.
            top_k: Number of results.
            filters: Optional filters.
            graph_hops: Number of hops in graph traversal.
            entity_boost: Relevance boost for graph-expanded results.

        Returns:
            Enhanced search results.
        """
        # Step 1: Regular enhanced search
        regular_results, expanded_query = await self.enhanced_search(
            session=session,
            query=query,
            top_k=top_k * 2,  # Get more for merging
            filters=filters,
        )

        # Step 2: Extract entities from query
        entity_extractor = get_entity_extractor()
        query_entities = entity_extractor.extract_from_query(query)

        if not query_entities:
            # No entities found, return regular results
            return regular_results[:top_k]

        # Step 3: Find entity IDs in our graph
        entity_ids = []
        for extracted in query_entities:
            entity = await self.graph_service.find_entity(
                session, extracted.name, extracted.entity_type
            )
            if entity:
                entity_ids.append(entity.id)

        if not entity_ids:
            # No matching entities in graph
            return regular_results[:top_k]

        # Step 4: Get graph neighborhood
        try:
            neighborhood = await self.graph_service.get_neighborhood(
                session=session,
                entity_ids=entity_ids,
                hops=graph_hops,
            )

            # Step 5: Get chunks from graph-related entities
            graph_chunk_ids = set(neighborhood.related_chunks)

            # Remove chunks already in regular results
            regular_chunk_ids = {r.id for r in regular_results}
            new_chunk_ids = graph_chunk_ids - regular_chunk_ids

            if new_chunk_ids:
                # Fetch the new chunks
                chunk_sql = """
                    SELECT
                        kc.id,
                        kc.document_id,
                        kc.content,
                        kc.chunk_metadata,
                        kc.chunk_index,
                        kd.filename,
                        kd.title,
                        kd.doc_type,
                        kd.product
                    FROM knowledge_chunks kc
                    JOIN knowledge_documents kd ON kc.document_id = kd.id
                    WHERE kc.id = ANY(:ids)
                """
                result = await session.execute(text(chunk_sql), {"ids": list(new_chunk_ids)})

                for row in result.fetchall():
                    # Graph-expanded results get a boost but lower base relevance
                    chunk = RetrievedChunk(
                        id=row[0],
                        document_id=row[1],
                        content=row[2],
                        chunk_metadata=row[3] or {},
                        chunk_index=row[4],
                        document_filename=row[5],
                        document_title=row[6],
                        document_type=row[7],
                        document_product=row[8],
                        relevance=entity_boost  # Lower relevance, but they're contextually related
                    )
                    regular_results.append(chunk)

            # Log graph enhancement
            logger.debug(
                f"Graph enhanced search: {len(query_entities)} query entities, "
                f"{len(entity_ids)} matched, {len(new_chunk_ids)} new chunks added"
            )

        except Exception as e:
            logger.warning(f"Graph enhancement failed: {e}")

        # Sort by relevance and return top_k
        regular_results.sort(key=lambda x: x.relevance, reverse=True)
        return regular_results[:top_k]

    async def query_knowledge(
        self,
        session: AsyncSession,
        request: KnowledgeQueryRequest,
        user_id: Optional[int] = None,
        use_enhanced_search: bool = True,
    ) -> KnowledgeTextResponse:
        """Query the knowledge base and generate a response.

        This method supports true agent-to-agent communication by accepting
        an AgentContext that provides full conversation context from the
        Implementation Agent.

        Args:
            session: Database session.
            request: Query request with query text, agent context, and options.
            user_id: Optional user ID for logging.
            use_enhanced_search: Use query expansion and MMR reranking.

        Returns:
            Text response with sources and confidence.
        """
        import time
        start_time = time.time()

        # Build context string for HyDE if agent context is available
        hyde_context = None
        if request.agent_context and request.agent_context.environment:
            hyde_context = json.dumps(request.agent_context.environment)

        # Retrieve relevant chunks using enhanced or basic search
        expanded_query = None
        if use_enhanced_search and self.use_query_expansion:
            chunks, expanded_query = await self.enhanced_search(
                session=session,
                query=request.query,
                top_k=request.top_k,
                filters=request.filters,
                context=hyde_context,
            )
        else:
            chunks = await self.hybrid_search(
                session=session,
                query=request.query,
                top_k=request.top_k,
                filters=request.filters
            )

        if not chunks:
            return KnowledgeTextResponse(
                response="I couldn't find relevant information in the knowledge base for your query.",
                sources=[],
                confidence=0.0
            )

        # Build context from chunks
        context_parts = []
        for i, chunk in enumerate(chunks):
            context_parts.append(f"""
[Source {i+1}: {chunk.document_filename}]
{chunk.content}
---""")

        context = "\n".join(context_parts)

        # Build enhanced system prompt for agent-to-agent communication
        system_prompt = """You are the Cisco Knowledge Agent - the authoritative source for Cisco networking expertise.

You are being consulted by an Implementation Agent that is helping a user with their network.
Your role is to provide accurate, actionable information that the Implementation Agent can use.

You have access to a knowledge base containing:
- API documentation for Meraki, Catalyst Center, and other Cisco products
- Configuration guides and best practices
- CLI command references
- Validated Cisco Designs (CVDs)

IMPORTANT - Agent Communication Protocol:
1. The Implementation Agent may provide context about the user's environment and prior discoveries
2. Consider this context when formulating your response
3. Be specific about API endpoints, parameters, and CLI commands when applicable
4. If the question requires information not in your knowledge base, clearly state what you don't know
5. Provide actionable guidance that the Implementation Agent can directly use

When answering:
1. Base your response primarily on the provided knowledge base context
2. Be specific and technical - the Implementation Agent needs precise information
3. Cite sources when making specific claims
4. If the context doesn't contain enough information, say so
5. For configuration examples, use proper syntax"""

        # Build enhanced user prompt with agent context
        agent_context = request.agent_context
        user_prompt_parts = []

        # Add agent context if provided
        if agent_context:
            user_prompt_parts.append("=== AGENT COMMUNICATION CONTEXT ===")

            if agent_context.user_query:
                user_prompt_parts.append(f"User's Original Request: {agent_context.user_query}")

            if agent_context.conversation_summary:
                user_prompt_parts.append(f"Conversation Summary: {agent_context.conversation_summary}")

            if agent_context.environment:
                env_str = json.dumps(agent_context.environment, indent=2)
                user_prompt_parts.append(f"Discovered Environment:\n{env_str}")

            if agent_context.prior_tool_results:
                user_prompt_parts.append("Prior Tool Results:")
                for i, result in enumerate(agent_context.prior_tool_results[:5]):  # Limit to 5
                    user_prompt_parts.append(f"  {i+1}. {json.dumps(result)[:500]}")

            if agent_context.specific_questions:
                user_prompt_parts.append("Specific Questions from Implementation Agent:")
                for q in agent_context.specific_questions:
                    user_prompt_parts.append(f"  - {q}")

            user_prompt_parts.append("=== END CONTEXT ===\n")

        # Add the main query
        user_prompt_parts.append(f"Question: {request.query}")
        user_prompt_parts.append(f"\nContext from knowledge base:\n{context}")
        user_prompt_parts.append("\nPlease provide a helpful, accurate response based on the context provided.")

        user_prompt = "\n".join(user_prompt_parts)

        try:
            response_text, input_tokens, output_tokens = await self._call_circuit_api(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=2000
            )

            # Calculate confidence based on chunk relevance
            avg_relevance = sum(c.relevance for c in chunks[:5]) / min(len(chunks), 5)
            confidence = min(avg_relevance, 0.95)  # Cap at 0.95

            # Build source citations
            sources = [
                SourceCitation(
                    document=chunk.document_filename,
                    chunk_id=chunk.id,
                    relevance=chunk.relevance
                )
                for chunk in chunks[:5]  # Top 5 sources
            ]

            # Log query
            latency_ms = int((time.time() - start_time) * 1000)
            query_log = KnowledgeQuery(
                user_id=user_id,
                query_text=request.query,
                context=request.context,
                retrieved_chunk_ids=[c.id for c in chunks],
                response=response_text,
                response_tokens=output_tokens,
                latency_ms=latency_ms,
                model_used=f"cisco-circuit/{self.DEFAULT_MODEL}",
                created_at=datetime.utcnow()
            )
            session.add(query_log)
            await session.commit()

            return KnowledgeTextResponse(
                response=response_text,
                sources=sources,
                confidence=confidence
            )

        except Exception as e:
            logger.error(f"Failed to generate response via Cisco Circuit: {e}")
            raise

    async def get_implementation_plan(
        self,
        session: AsyncSession,
        request: KnowledgeQueryRequest,
        environment_context: Dict[str, Any],
        use_enhanced_search: bool = True,
    ) -> KnowledgeResponse:
        """Generate a structured implementation plan for the Implementation Agent.

        This is the key integration point where the Knowledge Agent provides
        actionable steps to the Implementation Agent with full context awareness.

        Args:
            session: Database session.
            request: Query request with agent context describing what needs to be done.
            environment_context: Current environment state from Implementation Agent.
            use_enhanced_search: Use query expansion and MMR reranking.

        Returns:
            Structured response with implementation steps.
        """
        import time
        start_time = time.time()

        # Retrieve relevant chunks using enhanced search for better coverage
        hyde_context = json.dumps(environment_context) if environment_context else None

        if use_enhanced_search and self.use_query_expansion:
            chunks, _ = await self.enhanced_search(
                session=session,
                query=request.query,
                top_k=request.top_k,
                filters=request.filters,
                context=hyde_context,
            )
        else:
            chunks = await self.hybrid_search(
                session=session,
                query=request.query,
                top_k=request.top_k,
                filters=request.filters
            )

        # Build context
        context_parts = []
        for i, chunk in enumerate(chunks):
            context_parts.append(f"""
[Source {i+1}: {chunk.document_filename} - {chunk.document_type}]
{chunk.content}
---""")

        context = "\n".join(context_parts)

        # Format environment context (merge with agent_context.environment if available)
        agent_context = request.agent_context
        merged_env = {**environment_context}
        if agent_context and agent_context.environment:
            merged_env.update(agent_context.environment)
        env_summary = json.dumps(merged_env, indent=2)

        system_prompt = """You are the Cisco Knowledge Agent - the authoritative source for implementation planning.

You are being consulted by an Implementation Agent that needs to execute changes on a user's network.
Your role is to provide precise, executable implementation steps that the agent can follow.

AGENT COMMUNICATION PROTOCOL:
1. The Implementation Agent has provided context about their current situation
2. Prior tool results show what they've already discovered
3. The implementation goal tells you the desired end state
4. Any constraints must be respected in your plan

You must respond with a JSON object in this exact format:
{
    "recommendation": "Brief summary of what needs to be done",
    "confidence": 0.0-1.0,
    "steps": [
        {
            "order": 1,
            "action": "create|update|delete|configure|verify",
            "api": "meraki|catalyst|cli|ise",
            "endpoint": "/api/v1/...",
            "command": "CLI command if applicable",
            "params": {"key": "value"},
            "description": "What this step does",
            "rollback": "How to undo this step"
        }
    ],
    "warnings": ["Any important warnings"],
    "requires_confirmation": true/false
}

Guidelines:
- Consider the prior discoveries when planning (don't duplicate work)
- Match steps to the specific environment (e.g., use Meraki APIs if it's a Meraki network)
- Include rollback instructions for risky operations
- Set requires_confirmation=true for destructive operations
- Order steps logically with dependencies
- Use specific API endpoints from the documentation
- Be precise about parameters - the Implementation Agent will use these directly"""

        # Build enhanced user prompt with agent context
        user_prompt_parts = []

        # Add agent context if provided
        if agent_context:
            user_prompt_parts.append("=== AGENT COMMUNICATION CONTEXT ===")

            if agent_context.user_query:
                user_prompt_parts.append(f"User's Original Request: {agent_context.user_query}")

            if agent_context.implementation_goal:
                user_prompt_parts.append(f"Implementation Goal: {agent_context.implementation_goal}")

            if agent_context.prior_tool_results:
                user_prompt_parts.append("Prior Discoveries by Implementation Agent:")
                for i, result in enumerate(agent_context.prior_tool_results[:5]):
                    user_prompt_parts.append(f"  {i+1}. {json.dumps(result)[:500]}")

            if agent_context.specific_questions:
                user_prompt_parts.append("Constraints/Requirements:")
                for q in agent_context.specific_questions:
                    user_prompt_parts.append(f"  - {q}")

            user_prompt_parts.append("=== END CONTEXT ===\n")

        user_prompt_parts.append(f"Implementation Request: {request.query}")
        user_prompt_parts.append(f"\nCurrent Environment:\n{env_summary}")
        user_prompt_parts.append(f"\nKnowledge Base Context:\n{context}")
        user_prompt_parts.append("\nRespond with a JSON implementation plan.")

        user_prompt = "\n".join(user_prompt_parts)

        try:
            # Use Cisco Circuit for response generation (Knowledge Agent ONLY uses Circuit)
            response_text, input_tokens, output_tokens = await self._call_circuit_api(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=3000
            )

            # Parse JSON response
            # Try to extract JSON if wrapped in markdown
            json_text = response_text
            if "```json" in json_text:
                json_start = json_text.find("```json") + 7
                json_end = json_text.find("```", json_start)
                json_text = json_text[json_start:json_end].strip()
            elif "```" in json_text:
                json_start = json_text.find("```") + 3
                json_end = json_text.find("```", json_start)
                json_text = json_text[json_start:json_end].strip()

            plan_data = json.loads(json_text)

            # Build implementation steps
            steps = []
            for step_data in plan_data.get("steps", []):
                steps.append(ImplementationStep(
                    order=step_data.get("order", 0),
                    action=step_data.get("action", ""),
                    api=step_data.get("api", ""),
                    endpoint=step_data.get("endpoint"),
                    command=step_data.get("command"),
                    params=step_data.get("params", {}),
                    description=step_data.get("description", ""),
                    rollback=step_data.get("rollback")
                ))

            # Build source citations
            sources = [
                SourceCitation(
                    document=chunk.document_filename,
                    chunk_id=chunk.id,
                    relevance=chunk.relevance
                )
                for chunk in chunks[:5]
            ]

            # Log query
            latency_ms = int((time.time() - start_time) * 1000)
            query_log = KnowledgeQuery(
                query_text=request.query,
                context=environment_context,
                retrieved_chunk_ids=[c.id for c in chunks],
                response=response_text,
                response_tokens=output_tokens,
                latency_ms=latency_ms,
                model_used=f"cisco-circuit/{self.DEFAULT_MODEL}",
                created_at=datetime.utcnow()
            )
            session.add(query_log)
            await session.commit()

            return KnowledgeResponse(
                recommendation=plan_data.get("recommendation", ""),
                confidence=plan_data.get("confidence", 0.5),
                steps=steps,
                warnings=plan_data.get("warnings", []),
                sources=sources,
                requires_confirmation=plan_data.get("requires_confirmation", False)
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse implementation plan JSON: {e}")
            # Return a basic response
            return KnowledgeResponse(
                recommendation="Failed to generate structured plan. Please try rephrasing your request.",
                confidence=0.0,
                steps=[],
                warnings=["JSON parsing failed - response may not be properly formatted"],
                sources=[],
                requires_confirmation=False
            )
        except Exception as e:
            logger.error(f"Failed to generate implementation plan via Cisco Circuit: {e}")
            raise

    # =========================================================================
    # Agent Session Management for Multi-Turn Consultations
    # =========================================================================

    async def create_agent_session(
        self,
        session: AsyncSession,
        implementation_goal: str,
        environment: Dict[str, Any],
        user_id: Optional[int] = None,
        expires_in_hours: int = 24
    ) -> str:
        """Create a new agent session for multi-turn consultations.

        Args:
            session: Database session.
            implementation_goal: What the Implementation Agent is trying to achieve.
            environment: Initial environment snapshot.
            user_id: Optional user ID.
            expires_in_hours: Session expiry time.

        Returns:
            Session ID (UUID) for future references.
        """
        import uuid
        from datetime import timedelta
        from src.models.knowledge import AgentSession

        session_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

        agent_session = AgentSession(
            session_id=session_id,
            user_id=user_id,
            implementation_goal=implementation_goal,
            environment_snapshot=environment,
            expires_at=expires_at,
            accumulated_discoveries=[],
            consultation_count=0,
            total_tokens=0
        )

        session.add(agent_session)
        await session.commit()

        logger.info(f"Created agent session {session_id} for goal: {implementation_goal[:100]}")
        return session_id

    async def get_agent_session(
        self,
        session: AsyncSession,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve an agent session with its accumulated context.

        Args:
            session: Database session.
            session_id: The session UUID.

        Returns:
            Session data including accumulated discoveries, or None if not found/expired.
        """
        from src.models.knowledge import AgentSession

        result = await session.execute(
            select(AgentSession).where(
                AgentSession.session_id == session_id,
                AgentSession.status == "active",
                AgentSession.expires_at > datetime.utcnow()
            )
        )
        agent_session = result.scalar_one_or_none()

        if not agent_session:
            return None

        return {
            "session_id": agent_session.session_id,
            "implementation_goal": agent_session.implementation_goal,
            "environment_snapshot": agent_session.environment_snapshot,
            "accumulated_discoveries": agent_session.accumulated_discoveries or [],
            "conversation_summary": agent_session.conversation_summary,
            "consultation_count": agent_session.consultation_count,
            "created_at": agent_session.created_at,
            "status": agent_session.status
        }

    async def update_agent_session(
        self,
        session: AsyncSession,
        session_id: str,
        new_discoveries: List[Dict[str, Any]] = None,
        tokens_used: int = 0,
        conversation_summary: str = None
    ) -> bool:
        """Update an agent session with new discoveries and context.

        Args:
            session: Database session.
            session_id: The session UUID.
            new_discoveries: New tool results to add.
            tokens_used: Tokens used in this consultation.
            conversation_summary: Updated conversation summary.

        Returns:
            True if updated, False if session not found.
        """
        from src.models.knowledge import AgentSession

        result = await session.execute(
            select(AgentSession).where(
                AgentSession.session_id == session_id,
                AgentSession.status == "active"
            )
        )
        agent_session = result.scalar_one_or_none()

        if not agent_session:
            return False

        # Append new discoveries
        if new_discoveries:
            current = agent_session.accumulated_discoveries or []
            agent_session.accumulated_discoveries = current + new_discoveries

        # Update counts
        agent_session.consultation_count += 1
        agent_session.total_tokens += tokens_used

        # Update summary if provided
        if conversation_summary:
            agent_session.conversation_summary = conversation_summary

        agent_session.updated_at = datetime.utcnow()
        await session.commit()

        logger.info(f"Updated agent session {session_id}: consultation #{agent_session.consultation_count}")
        return True

    async def complete_agent_session(
        self,
        session: AsyncSession,
        session_id: str,
        final_summary: str = None
    ) -> bool:
        """Mark an agent session as completed.

        Args:
            session: Database session.
            session_id: The session UUID.
            final_summary: Optional final summary of the session.

        Returns:
            True if completed, False if session not found.
        """
        from src.models.knowledge import AgentSession

        result = await session.execute(
            select(AgentSession).where(AgentSession.session_id == session_id)
        )
        agent_session = result.scalar_one_or_none()

        if not agent_session:
            return False

        agent_session.status = "completed"
        if final_summary:
            agent_session.conversation_summary = final_summary
        agent_session.updated_at = datetime.utcnow()

        await session.commit()
        logger.info(f"Completed agent session {session_id} after {agent_session.consultation_count} consultations")
        return True

    async def get_stats(self, session: AsyncSession) -> Dict[str, Any]:
        """Get knowledge base statistics.

        Args:
            session: Database session.

        Returns:
            Statistics about the knowledge base.
        """
        # Document count by type
        doc_result = await session.execute(
            text("""
                SELECT doc_type, COUNT(*) as count
                FROM knowledge_documents
                GROUP BY doc_type
            """)
        )
        docs_by_type = {row[0]: row[1] for row in doc_result.fetchall()}

        # Document count by product
        product_result = await session.execute(
            text("""
                SELECT product, COUNT(*) as count
                FROM knowledge_documents
                WHERE product IS NOT NULL
                GROUP BY product
            """)
        )
        docs_by_product = {row[0]: row[1] for row in product_result.fetchall()}

        # Total chunks
        chunk_result = await session.execute(
            text("SELECT COUNT(*) FROM knowledge_chunks")
        )
        total_chunks = chunk_result.scalar()

        # Total queries
        query_result = await session.execute(
            text("SELECT COUNT(*) FROM knowledge_queries")
        )
        total_queries = query_result.scalar()

        # Average query latency
        latency_result = await session.execute(
            text("SELECT AVG(latency_ms) FROM knowledge_queries WHERE latency_ms IS NOT NULL")
        )
        avg_latency = latency_result.scalar()

        return {
            "documents": {
                "total": sum(docs_by_type.values()),
                "by_type": docs_by_type,
                "by_product": docs_by_product
            },
            "chunks": {
                "total": total_chunks
            },
            "queries": {
                "total": total_queries,
                "avg_latency_ms": round(avg_latency, 2) if avg_latency else None
            }
        }


# Singleton instance
_knowledge_service: Optional[KnowledgeService] = None


def get_knowledge_service() -> KnowledgeService:
    """Get or create singleton knowledge service."""
    global _knowledge_service
    if _knowledge_service is None:
        _knowledge_service = KnowledgeService()
    return _knowledge_service
