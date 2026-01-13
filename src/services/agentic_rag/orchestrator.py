"""Agentic RAG Orchestrator - Coordinates the multi-agent RAG pipeline.

The orchestrator:
1. Initializes all agents based on configuration
2. Manages the pipeline flow and state
3. Handles iteration logic for quality improvement
4. Provides the same interface as get_knowledge_context() for drop-in replacement
5. Emits real-time events for WebSocket clients
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from .state import RAGState, RAGMetrics, Citation, GradedDocument
from .config import AgenticRAGConfig, get_agentic_rag_config
from .agents.query_analysis import QueryAnalysisAgent
from .agents.retrieval_router import RetrievalRouterAgent
from .agents.document_grader import DocumentGraderAgent
from .agents.corrective_rag import CorrectiveRAGAgent
from .agents.synthesis import SynthesisAgent
from .agents.reflection import ReflectionAgent
from .event_emitter import get_event_emitter, RAGPipelineEventEmitter

logger = logging.getLogger(__name__)


class AgenticRAGOrchestrator:
    """Orchestrates the agentic RAG pipeline.

    This class coordinates all agents in the pipeline and provides
    the same interface as get_knowledge_context() for easy integration.
    """

    def __init__(
        self,
        config: Optional[AgenticRAGConfig] = None,
        llm_service: Optional[Any] = None,
        knowledge_service: Optional[Any] = None,
        web_search_service: Optional[Any] = None,
    ):
        """Initialize the orchestrator.

        Args:
            config: Agentic RAG configuration
            llm_service: LLM service for agent calls
            knowledge_service: Knowledge service for retrieval
            web_search_service: Optional web search service for CRAG
        """
        self.config = config or get_agentic_rag_config()
        self.llm_service = llm_service
        self.knowledge_service = knowledge_service
        self.web_search_service = web_search_service

        # Initialize agents
        self._init_agents()

    def _init_agents(self):
        """Initialize all agents based on configuration."""
        # Query Analysis Agent
        self.query_analyzer = QueryAnalysisAgent(
            llm_service=self.llm_service,
            enabled=self.config.query_analysis_enabled,
            max_sub_questions=self.config.max_sub_questions,
        )

        # Retrieval Router Agent
        self.retrieval_router = RetrievalRouterAgent(
            enabled=self.config.retrieval_router_enabled,
            hyde_enabled=self.config.hyde_enabled,
            multi_query_enabled=self.config.multi_query_enabled,
        )

        # Document Grader Agent
        self.document_grader = DocumentGraderAgent(
            llm_service=self.llm_service,
            enabled=self.config.document_grading_enabled,
            max_documents=self.config.max_documents_to_grade,
            relevance_threshold=self.config.relevance_threshold,
            batch_grading=self.config.batch_grading,
        )

        # Corrective RAG Agent
        self.corrective_rag = CorrectiveRAGAgent(
            enabled=self.config.corrective_rag_enabled,
            web_search_enabled=self.config.web_search_enabled,
            web_search_service=self.web_search_service,
            min_relevant_docs=self.config.min_relevant_docs,
            min_avg_relevance=self.config.min_avg_relevance,
            max_web_results=self.config.max_web_results,
        )

        # Synthesis Agent
        self.synthesizer = SynthesisAgent(
            llm_service=self.llm_service,
            enabled=True,  # Always enabled
            max_tokens=self.config.synthesis_max_tokens,
            require_citations=self.config.require_citations,
            min_citations=self.config.min_citations,
        )

        # Reflection Agent
        self.reflector = ReflectionAgent(
            llm_service=self.llm_service,
            enabled=self.config.reflection_enabled,
            quality_threshold=self.config.quality_threshold,
        )

    async def process(
        self,
        session: AsyncSession,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[int] = None,
    ) -> Tuple[str, List[Dict], List[Dict], Dict[str, Any]]:
        """Process a query through the agentic RAG pipeline.

        This method has the same signature as get_knowledge_context()
        for drop-in replacement.

        Args:
            session: Database session
            query: User query
            context: Optional context dictionary
            user_id: Optional user ID

        Returns:
            Tuple of (answer, citations, chunks, agentic_rag_metrics)
        """
        # Initialize state
        state = RAGState(
            original_query=query,
            context=context or {},
            user_id=user_id,
            session_id=str(uuid.uuid4()),
            max_iterations=self.config.max_iterations,
        )

        logger.info(f"Starting agentic RAG pipeline for query: {query[:100]}...")

        # Create event emitter for real-time updates
        emitter = get_event_emitter(state.session_id)
        await emitter.pipeline_start(query)

        try:
            # Apply timeout to entire pipeline
            state = await asyncio.wait_for(
                self._run_pipeline(session, state, emitter),
                timeout=self.config.total_timeout_seconds,
            )

            # Emit completion event
            await emitter.pipeline_complete(
                quality=state.quality.value if state.quality else "UNKNOWN",
                iterations=state.iteration_count,
                citations_count=len(state.citations),
            )

        except asyncio.TimeoutError:
            logger.error(
                f"Agentic RAG pipeline timed out after {self.config.total_timeout_seconds}s"
            )
            state.error = "Pipeline timeout"
            await emitter.pipeline_error("Pipeline timeout")
            # Return whatever we have so far
            if not state.answer:
                state.answer = self._generate_timeout_response(query)

        except Exception as e:
            logger.error(f"Agentic RAG pipeline failed: {e}")
            state.error = str(e)
            state.answer = self._generate_error_response(query, str(e))
            await emitter.pipeline_error(str(e))

        # Log metrics
        if self.config.log_metrics:
            self._log_metrics(state)

        # Convert to expected output format
        return self._format_output(state)

    async def _run_pipeline(
        self,
        session: AsyncSession,
        state: RAGState,
        emitter: Optional[RAGPipelineEventEmitter] = None,
    ) -> RAGState:
        """Run the full agentic RAG pipeline.

        Args:
            session: Database session
            state: Initial RAG state
            emitter: Optional event emitter for real-time updates

        Returns:
            Final RAG state
        """
        # Phase 1: Query Analysis
        if emitter:
            await emitter.agent_start("QueryAnalysisAgent")
        state = await self.query_analyzer.execute(state)
        if emitter:
            await emitter.agent_complete(
                "QueryAnalysisAgent",
                state.agent_timings.get("QueryAnalysisAgent", 0) * 1000,
                {"query_type": state.query_type, "topics": state.cisco_topics}
            )

        if emitter:
            await emitter.agent_start("RetrievalRouterAgent")
        state = await self.retrieval_router.execute(state)
        if emitter:
            await emitter.agent_complete(
                "RetrievalRouterAgent",
                state.agent_timings.get("RetrievalRouterAgent", 0) * 1000,
                {"strategy": state.strategy.value if state.strategy else "default"}
            )

        # Iteration loop
        while not state.is_complete and state.iteration_count <= state.max_iterations:
            state.increment_iteration()
            logger.info(f"Starting iteration {state.iteration_count}")

            if emitter:
                await emitter.iteration_start(state.iteration_count)

            # Phase 2: Retrieval
            state = await self._perform_retrieval(session, state)
            if emitter:
                await emitter.retrieval_complete(
                    len(state.retrieved_chunks),
                    state.strategy.value if state.strategy else "default"
                )

            # Phase 3: Document Grading
            if emitter:
                await emitter.agent_start("DocumentGraderAgent")
            state = await self.document_grader.execute(state)
            if emitter:
                await emitter.agent_complete(
                    "DocumentGraderAgent",
                    state.agent_timings.get("DocumentGraderAgent", 0) * 1000,
                )
                await emitter.grading_complete(
                    state.num_relevant_docs,
                    state.avg_graded_relevance
                )

            # Phase 4: Corrective RAG
            if emitter:
                await emitter.agent_start("CorrectiveRAGAgent")
            state = await self.corrective_rag.execute(state)
            if emitter:
                await emitter.agent_complete(
                    "CorrectiveRAGAgent",
                    state.agent_timings.get("CorrectiveRAGAgent", 0) * 1000,
                )
                if state.web_search_triggered:
                    await emitter.web_search_triggered(
                        state.web_search_reason or "KB coverage insufficient",
                        len(state.web_results)
                    )

            # Phase 5: Synthesis
            if emitter:
                await emitter.agent_start("SynthesisAgent")
            state = await self.synthesizer.execute(state)
            if emitter:
                await emitter.agent_complete(
                    "SynthesisAgent",
                    state.agent_timings.get("SynthesisAgent", 0) * 1000,
                )
                await emitter.synthesis_complete(
                    len(state.answer) if state.answer else 0,
                    len(state.citations)
                )

            # Phase 6: Reflection
            if emitter:
                await emitter.agent_start("ReflectionAgent")
            state = await self.reflector.execute(state)
            if emitter:
                await emitter.agent_complete(
                    "ReflectionAgent",
                    state.agent_timings.get("ReflectionAgent", 0) * 1000,
                )
                await emitter.reflection_complete(
                    state.quality.value if state.quality else "UNKNOWN",
                    state.should_iterate
                )

            # Check if we should iterate
            if not state.check_should_iterate():
                state.mark_complete()
                break

            logger.info(f"Iteration {state.iteration_count} complete, iterating...")

        return state

    async def _perform_retrieval(
        self,
        session: AsyncSession,
        state: RAGState
    ) -> RAGState:
        """Perform document retrieval based on strategy.

        Args:
            session: Database session
            state: Current state with retrieval strategy

        Returns:
            Updated state with retrieved chunks
        """
        if not self.knowledge_service:
            logger.error("Knowledge service not configured")
            state.error = "Knowledge service not available"
            return state

        try:
            # Get strategy configuration
            strategy_config = self.retrieval_router.get_strategy_config(state.strategy)

            # Build retrieval parameters
            filters = state.retrieval_filters.copy()
            top_k = strategy_config.get("top_k", 10)

            # Perform retrieval using existing knowledge service
            chunks, _ = await self.knowledge_service.enhanced_search(
                session=session,
                query=state.original_query,
                top_k=top_k,
                filters=filters,
                use_hyde=strategy_config.get("use_hyde", False),
                use_mmr=True,  # Use MMR for diversity in results
            )

            # Convert chunks to expected format
            state.retrieved_chunks = [
                {
                    "id": chunk.id,
                    "content": chunk.content,
                    "document_filename": chunk.document_filename,
                    "document_title": chunk.document_title,
                    "document_type": chunk.document_type,
                    "document_product": chunk.document_product,
                    "relevance": chunk.relevance,
                    "chunk_metadata": chunk.chunk_metadata,
                }
                for chunk in chunks
            ]

            state.total_chunks_retrieved = len(state.retrieved_chunks)

            logger.info(
                f"Retrieved {state.total_chunks_retrieved} chunks "
                f"using strategy {state.strategy.value}"
            )

        except Exception as e:
            logger.error(f"Retrieval failed: {e}")
            state.error = f"Retrieval failed: {e}"

        return state

    def _format_output(
        self,
        state: RAGState
    ) -> Tuple[str, List[Dict], List[Dict], Dict[str, Any]]:
        """Format state into expected output.

        Args:
            state: Final RAG state

        Returns:
            Tuple of (answer, citations, chunks, agentic_rag_metrics)
        """
        # Format citations
        citations = [
            {
                "index": c.index,
                "document": c.document,
                "chunk_id": c.chunk_id,
                "relevance": c.relevance,
                "excerpt": c.excerpt,
            }
            for c in state.citations
        ]

        # Format chunks (relevant documents only)
        chunks = [
            {
                "id": doc.chunk_id,
                "content": doc.content,
                "document_filename": doc.document_filename,
                "document_title": doc.document_title,
                "document_type": doc.document_type,
                "document_product": doc.document_product,
                "relevance": doc.graded_relevance,
            }
            for doc in state.get_relevant_documents()
        ]

        # Build agentic RAG metrics for frontend
        agentic_rag_metrics = {
            "enabled": True,
            "iterations": state.iteration_count,
            "agents_used": list(state.agent_timings.keys()),
            "query_type": state.query_type if hasattr(state, 'query_type') else None,
            "quality": state.quality.value if state.quality else None,
            "latency_ms": int(sum(state.agent_timings.values()) * 1000) if state.agent_timings else None,
            "web_search_used": state.web_search_triggered,
        }

        return (state.answer, citations, chunks, agentic_rag_metrics)

    def _generate_timeout_response(self, query: str) -> str:
        """Generate response when pipeline times out."""
        return (
            f"I was unable to complete the search for: {query}\n\n"
            "The request took longer than expected. This might be due to:\n"
            "- Complex query requiring multiple processing steps\n"
            "- High system load\n\n"
            "Please try again or simplify your question."
        )

    def _generate_error_response(self, query: str, error: str) -> str:
        """Generate response when pipeline fails."""
        return (
            f"I encountered an error while processing: {query}\n\n"
            f"Error: {error}\n\n"
            "Please try again or rephrase your question."
        )

    def _log_metrics(self, state: RAGState):
        """Log pipeline metrics for monitoring."""
        metrics = RAGMetrics.from_state(state, state.session_id or "unknown")

        logger.info(
            f"Agentic RAG metrics: "
            f"latency={metrics.total_latency_ms:.0f}ms, "
            f"llm_calls={metrics.llm_calls}, "
            f"iterations={metrics.iterations}, "
            f"quality={metrics.final_quality}, "
            f"citations={metrics.num_citations}"
        )

        if self.config.debug_mode:
            logger.debug(f"Agent timings: {metrics.agent_timings}")


# Global orchestrator instance
_orchestrator: Optional[AgenticRAGOrchestrator] = None


def get_agentic_rag_orchestrator() -> Optional[AgenticRAGOrchestrator]:
    """Get the global agentic RAG orchestrator instance.

    Returns:
        AgenticRAGOrchestrator or None if not initialized
    """
    return _orchestrator


async def init_agentic_rag_orchestrator(
    session: AsyncSession,
    llm_service: Any,
    knowledge_service: Any,
    web_search_service: Optional[Any] = None,
) -> AgenticRAGOrchestrator:
    """Initialize the global agentic RAG orchestrator.

    Args:
        session: Database session for loading config
        llm_service: LLM service
        knowledge_service: Knowledge service
        web_search_service: Optional web search service

    Returns:
        Initialized orchestrator
    """
    global _orchestrator

    from .config import init_agentic_rag_config

    # Load config from database
    config = await init_agentic_rag_config(session)

    # Create orchestrator
    _orchestrator = AgenticRAGOrchestrator(
        config=config,
        llm_service=llm_service,
        knowledge_service=knowledge_service,
        web_search_service=web_search_service,
    )

    logger.info("Agentic RAG orchestrator initialized")

    return _orchestrator
