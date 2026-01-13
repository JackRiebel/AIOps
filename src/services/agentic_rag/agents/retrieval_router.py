"""Retrieval Router Agent for agentic RAG pipeline.

This agent selects the optimal retrieval strategy based on query analysis.
It's a fast, rule-based agent that doesn't require LLM calls.

Strategies:
- SEMANTIC: Pure vector similarity search
- HYBRID: Vector + keyword matching (BM25-style)
- HYDE: Hypothetical Document Embeddings for abstract queries
- MULTI_QUERY: Generate query variants for better coverage
- FULL_PIPELINE: Use all advanced techniques
"""

import logging
from typing import Optional, Any, Dict, List

from ..base_agent import BaseRAGAgent
from ..state import RAGState, RetrievalStrategy, QueryType

logger = logging.getLogger(__name__)


# Strategy selection rules based on query characteristics
STRATEGY_RULES: Dict[QueryType, RetrievalStrategy] = {
    QueryType.SIMPLE: RetrievalStrategy.HYBRID,
    QueryType.COMPLEX: RetrievalStrategy.FULL_PIPELINE,
    QueryType.MULTI_HOP: RetrievalStrategy.FULL_PIPELINE,
    QueryType.PROCEDURAL: RetrievalStrategy.HYDE,
    QueryType.COMPARATIVE: RetrievalStrategy.MULTI_QUERY,
    QueryType.TROUBLESHOOTING: RetrievalStrategy.FULL_PIPELINE,
}


class RetrievalRouterAgent(BaseRAGAgent):
    """Selects optimal retrieval strategy based on query analysis.

    This is a fast, rule-based agent that uses the query analysis
    to determine which retrieval techniques will work best.

    No LLM calls are made - this agent is optimized for speed.
    """

    def __init__(
        self,
        enabled: bool = True,
        hyde_enabled: bool = True,
        multi_query_enabled: bool = True,
    ):
        super().__init__(
            name="retrieval_router",
            llm_service=None,  # No LLM needed
            enabled=enabled,
            timeout_ms=100,  # Very fast
        )
        self.hyde_enabled = hyde_enabled
        self.multi_query_enabled = multi_query_enabled

    async def process(self, state: RAGState) -> RAGState:
        """Select retrieval strategy based on query analysis.

        Args:
            state: Current RAG state with query analysis

        Returns:
            Updated state with selected strategy
        """
        # Start with base strategy from query type
        base_strategy = STRATEGY_RULES.get(state.query_type, RetrievalStrategy.HYBRID)

        # Apply adjustments based on other factors
        strategy = self._adjust_strategy(state, base_strategy)

        # Set retrieval filters based on topics
        filters = self._build_retrieval_filters(state)

        state.strategy = strategy
        state.retrieval_filters = filters

        logger.info(
            f"Retrieval strategy selected: {strategy.value} "
            f"(base: {base_strategy.value}, filters: {filters})"
        )

        return state

    def _adjust_strategy(
        self,
        state: RAGState,
        base_strategy: RetrievalStrategy
    ) -> RetrievalStrategy:
        """Adjust strategy based on additional factors.

        Args:
            state: Current state
            base_strategy: Initial strategy from query type

        Returns:
            Adjusted strategy
        """
        # If this is an iteration (not first pass), use full pipeline
        if state.iteration_count > 0:
            logger.debug("Using FULL_PIPELINE for iteration pass")
            return RetrievalStrategy.FULL_PIPELINE

        # If we have sub-questions, use multi-query
        if len(state.sub_questions) > 1 and self.multi_query_enabled:
            logger.debug("Using MULTI_QUERY due to sub-questions")
            return RetrievalStrategy.MULTI_QUERY

        # High complexity queries benefit from full pipeline
        if state.complexity_score >= 0.7:
            logger.debug(f"Using FULL_PIPELINE due to high complexity: {state.complexity_score}")
            return RetrievalStrategy.FULL_PIPELINE

        # Procedural queries benefit from HyDE
        if state.query_type == QueryType.PROCEDURAL and self.hyde_enabled:
            if base_strategy != RetrievalStrategy.FULL_PIPELINE:
                logger.debug("Using HYDE for procedural query")
                return RetrievalStrategy.HYDE

        # Abstract or conceptual queries benefit from HyDE
        if self._is_abstract_query(state.original_query) and self.hyde_enabled:
            logger.debug("Using HYDE for abstract query")
            return RetrievalStrategy.HYDE

        # Downgrade if features are disabled
        if base_strategy == RetrievalStrategy.HYDE and not self.hyde_enabled:
            return RetrievalStrategy.HYBRID
        if base_strategy == RetrievalStrategy.MULTI_QUERY and not self.multi_query_enabled:
            return RetrievalStrategy.HYBRID

        return base_strategy

    def _is_abstract_query(self, query: str) -> bool:
        """Detect if query is abstract/conceptual (benefits from HyDE).

        Abstract queries ask about concepts, best practices, architecture,
        etc. rather than specific facts.

        Args:
            query: User query

        Returns:
            True if query is abstract
        """
        query_lower = query.lower()

        abstract_indicators = [
            "best practice", "best way", "recommended",
            "architecture", "design pattern", "approach",
            "strategy", "methodology", "framework",
            "concept", "principle", "guideline",
            "should i", "when to use", "why use",
        ]

        for indicator in abstract_indicators:
            if indicator in query_lower:
                return True

        return False

    def _build_retrieval_filters(self, state: RAGState) -> Dict[str, Any]:
        """Build retrieval filters from state.

        Args:
            state: Current state

        Returns:
            Dictionary of filters for retrieval
        """
        filters = {}

        # Add product filter if specific topics detected
        if state.cisco_topics and "general" not in state.cisco_topics:
            filters["products"] = state.cisco_topics

        # Add iteration-specific adjustments
        if state.iteration_count > 0 and state.iteration_focus:
            filters["focus"] = state.iteration_focus

        # If troubleshooting, prioritize error messages and solutions
        if state.query_type == QueryType.TROUBLESHOOTING:
            filters["doc_types"] = ["troubleshooting", "guide", "kb_article"]

        # If procedural, prioritize guides and documentation
        if state.query_type == QueryType.PROCEDURAL:
            filters["doc_types"] = ["guide", "cli_reference", "api_spec"]

        return filters

    def get_strategy_config(self, strategy: RetrievalStrategy) -> Dict[str, Any]:
        """Get configuration for a specific strategy.

        Args:
            strategy: Retrieval strategy

        Returns:
            Configuration dict for the strategy
        """
        configs = {
            RetrievalStrategy.SEMANTIC: {
                "use_vectors": True,
                "use_keywords": False,
                "use_hyde": False,
                "use_multi_query": False,
                "top_k": 10,
            },
            RetrievalStrategy.HYBRID: {
                "use_vectors": True,
                "use_keywords": True,
                "use_hyde": False,
                "use_multi_query": False,
                "top_k": 10,
            },
            RetrievalStrategy.HYDE: {
                "use_vectors": True,
                "use_keywords": True,
                "use_hyde": True,
                "use_multi_query": False,
                "top_k": 10,
            },
            RetrievalStrategy.MULTI_QUERY: {
                "use_vectors": True,
                "use_keywords": True,
                "use_hyde": False,
                "use_multi_query": True,
                "num_query_variants": 3,
                "top_k": 15,
            },
            RetrievalStrategy.FULL_PIPELINE: {
                "use_vectors": True,
                "use_keywords": True,
                "use_hyde": self.hyde_enabled,
                "use_multi_query": self.multi_query_enabled,
                "num_query_variants": 3,
                "top_k": 15,
            },
        }

        return configs.get(strategy, configs[RetrievalStrategy.HYBRID])
