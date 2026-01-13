"""Corrective RAG Agent (CRAG) for agentic RAG pipeline.

This agent detects when the knowledge base has insufficient coverage
for a query and can optionally trigger web search as a fallback.

CRAG is based on the paper "Corrective Retrieval Augmented Generation"
which introduces knowledge refinement through corrective actions.
"""

import logging
from typing import Optional, Any, List

from ..base_agent import BaseRAGAgent
from ..state import RAGState, WebSearchResult

logger = logging.getLogger(__name__)


class CorrectiveRAGAgent(BaseRAGAgent):
    """Detects insufficient KB coverage and triggers corrective actions.

    This agent evaluates the quality of retrieved documents and
    determines if additional sources (like web search) are needed.

    Corrective actions:
    1. Detect low relevance scores indicating poor KB coverage
    2. Identify queries about very recent topics not in KB
    3. Optionally trigger web search for supplemental information
    """

    def __init__(
        self,
        enabled: bool = True,
        web_search_enabled: bool = False,
        web_search_service: Optional[Any] = None,
        min_relevant_docs: int = 2,
        min_avg_relevance: float = 0.6,
        max_web_results: int = 3,
    ):
        super().__init__(
            name="corrective_rag",
            llm_service=None,  # No LLM needed for threshold checks
            enabled=enabled,
            timeout_ms=3000,
        )
        self.web_search_enabled = web_search_enabled
        self.web_search_service = web_search_service
        self.min_relevant_docs = min_relevant_docs
        self.min_avg_relevance = min_avg_relevance
        self.max_web_results = max_web_results

    async def process(self, state: RAGState) -> RAGState:
        """Evaluate KB coverage and apply corrective actions.

        Args:
            state: Current RAG state with graded documents

        Returns:
            Updated state with corrective actions applied
        """
        # Evaluate KB coverage
        coverage_assessment = self._assess_kb_coverage(state)

        state.kb_coverage_sufficient = coverage_assessment["sufficient"]

        if coverage_assessment["sufficient"]:
            logger.info(
                f"KB coverage sufficient: {state.num_relevant_docs} relevant docs, "
                f"avg_relevance={state.avg_graded_relevance:.2f}"
            )
            return state

        # KB coverage is insufficient
        logger.warning(
            f"KB coverage insufficient: {coverage_assessment['reason']}. "
            f"relevant_docs={state.num_relevant_docs}, "
            f"avg_relevance={state.avg_graded_relevance:.2f}"
        )

        state.web_search_reason = coverage_assessment["reason"]

        # Trigger web search if enabled
        if self.web_search_enabled and self.web_search_service:
            state = await self._perform_web_search(state)
        else:
            logger.info(
                "Web search disabled or no service configured. "
                "Proceeding with available KB content."
            )

        return state

    def _assess_kb_coverage(self, state: RAGState) -> dict:
        """Assess if KB provides sufficient coverage for the query.

        Args:
            state: Current RAG state

        Returns:
            Assessment dict with 'sufficient' bool and 'reason' string
        """
        # Check number of relevant documents
        if state.num_relevant_docs < self.min_relevant_docs:
            return {
                "sufficient": False,
                "reason": f"Only {state.num_relevant_docs} relevant documents "
                          f"(minimum: {self.min_relevant_docs})",
            }

        # Check average relevance
        if state.avg_graded_relevance < self.min_avg_relevance:
            return {
                "sufficient": False,
                "reason": f"Average relevance {state.avg_graded_relevance:.2f} "
                          f"below threshold {self.min_avg_relevance}",
            }

        # Check if any document has high relevance (direct answer)
        high_relevance_docs = [
            d for d in state.graded_documents
            if d.is_relevant and d.graded_relevance >= 0.8
        ]

        if not high_relevance_docs and state.num_relevant_docs < 3:
            return {
                "sufficient": False,
                "reason": "No high-relevance documents and limited moderate-relevance coverage",
            }

        # Check for recency indicators in query (might need web search)
        recency_indicators = [
            "latest", "newest", "recent", "2024", "2025",
            "just released", "new feature", "update",
        ]

        query_lower = state.original_query.lower()
        for indicator in recency_indicators:
            if indicator in query_lower:
                # If asking about recent topics and relevance is borderline
                if state.avg_graded_relevance < 0.7:
                    return {
                        "sufficient": False,
                        "reason": f"Query mentions '{indicator}' but KB coverage is moderate",
                    }

        return {
            "sufficient": True,
            "reason": "KB coverage is adequate",
        }

    async def _perform_web_search(self, state: RAGState) -> RAGState:
        """Perform web search to supplement KB content.

        Args:
            state: Current RAG state

        Returns:
            Updated state with web search results
        """
        try:
            logger.info(f"Triggering web search for: {state.original_query}")

            # Build search query (might want to refine for Cisco-specific results)
            search_query = self._build_search_query(state)

            # Perform search using web search service
            results = await self.web_search_service.search(
                query=search_query,
                max_results=self.max_web_results,
                cisco_focus=bool(state.cisco_topics),
            )

            # Convert WebSearchResult objects to state format
            state.web_results = [
                WebSearchResult(
                    title=r.title if hasattr(r, 'title') else r.get("title", ""),
                    url=r.url if hasattr(r, 'url') else r.get("url", ""),
                    snippet=r.snippet if hasattr(r, 'snippet') else r.get("snippet", ""),
                    content=getattr(r, 'snippet', None) or r.get("snippet"),
                    relevance=r.relevance_score if hasattr(r, 'relevance_score') else r.get("relevance", 0.5),
                )
                for r in results
            ]

            state.web_search_triggered = True

            logger.info(f"Web search returned {len(state.web_results)} results")

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            state.web_search_triggered = True  # Mark as triggered even on failure
            state.web_results = []

        return state

    def _build_search_query(self, state: RAGState) -> str:
        """Build optimized search query for web search.

        Args:
            state: Current RAG state

        Returns:
            Search query string
        """
        query = state.original_query

        # Add Cisco context if relevant topics detected
        if state.cisco_topics and "general" not in state.cisco_topics:
            topics_str = " ".join(state.cisco_topics)
            query = f"Cisco {topics_str} {query}"

        # Limit query length
        if len(query) > 200:
            query = query[:200]

        return query

    def get_combined_context(self, state: RAGState) -> List[dict]:
        """Combine KB documents with web results for synthesis.

        Args:
            state: Current RAG state

        Returns:
            Combined list of context items
        """
        context = []

        # Add relevant KB documents
        for doc in state.get_relevant_documents():
            context.append({
                "source": "knowledge_base",
                "title": doc.document_title or doc.document_filename,
                "content": doc.content,
                "relevance": doc.graded_relevance,
                "chunk_id": doc.chunk_id,
            })

        # Add web results
        for result in state.web_results:
            context.append({
                "source": "web_search",
                "title": result.title,
                "url": result.url,
                "content": result.content or result.snippet,
                "relevance": result.relevance,
            })

        # Sort by relevance
        context.sort(key=lambda x: x.get("relevance", 0), reverse=True)

        return context
