"""A2A Quality Enhancement Integration.

Integrates Phase 4 quality modules into the orchestrator pipeline:
- Response Quality Scoring
- Context Embeddings Enhancement
- Response Synthesis

Provides a unified interface for quality-enhanced agent responses.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from .response_quality import (
    ResponseQualityScorer,
    QualityGate,
    QualityScore,
    ValidationResult,
    QualityLevel,
    get_quality_scorer,
    get_quality_gate,
)
from .context_embeddings import (
    ContextEmbeddingStore,
    ContextWindowOptimizer,
    RetrievedContext,
    get_context_store,
    get_context_optimizer,
)
from .synthesis import (
    ResponseSynthesizer,
    AgentResponse,
    SynthesizedResponse,
    FollowUpGenerator,
    get_synthesizer,
    get_follow_up_generator,
)

logger = logging.getLogger(__name__)


@dataclass
class EnhancedResponse:
    """A quality-enhanced response with all metadata."""
    content: str
    quality_score: QualityScore
    validation: ValidationResult
    context_used: Optional[RetrievedContext] = None
    synthesis_info: Optional[Dict[str, Any]] = None
    follow_up_suggestions: List[str] = field(default_factory=list)
    sources: List[str] = field(default_factory=list)
    enhancement_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "quality": {
                "score": self.quality_score.overall,
                "level": self.quality_score.level.value,
                "dimensions": {
                    k.value: v for k, v in self.quality_score.dimensions.items()
                },
            },
            "validation": self.validation.to_dict(),
            "follow_up_suggestions": self.follow_up_suggestions,
            "sources": self.sources,
            "enhancement_time_ms": self.enhancement_time_ms,
        }


class QualityEnhancementPipeline:
    """Pipeline for enhancing agent responses with quality features.

    Stages:
    1. Context Enhancement - Add relevant context from embeddings
    2. Multi-Agent Synthesis - Merge responses from multiple agents
    3. Quality Scoring - Score the response quality
    4. Validation - Validate accuracy against API data
    5. Follow-up Generation - Generate intelligent follow-ups
    """

    def __init__(
        self,
        quality_scorer: Optional[ResponseQualityScorer] = None,
        quality_gate: Optional[QualityGate] = None,
        context_store: Optional[ContextEmbeddingStore] = None,
        context_optimizer: Optional[ContextWindowOptimizer] = None,
        synthesizer: Optional[ResponseSynthesizer] = None,
        follow_up_generator: Optional[FollowUpGenerator] = None,
        enable_quality_gate: bool = False,
        min_quality_score: float = 0.5,
    ):
        self.quality_scorer = quality_scorer or get_quality_scorer()
        self.quality_gate = quality_gate or get_quality_gate()
        self.context_store = context_store or get_context_store()
        self.context_optimizer = context_optimizer or get_context_optimizer()
        self.synthesizer = synthesizer or get_synthesizer()
        self.follow_up_generator = follow_up_generator or get_follow_up_generator()
        self.enable_quality_gate = enable_quality_gate
        self.min_quality_score = min_quality_score

    async def enhance_response(
        self,
        query: str,
        response: str,
        session_id: Optional[str] = None,
        api_data: Optional[Dict[str, Any]] = None,
        agent_responses: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> EnhancedResponse:
        """Enhance a response through the full quality pipeline.

        Args:
            query: Original user query
            response: Agent response to enhance
            session_id: Session ID for context lookup
            api_data: Optional API data for validation
            agent_responses: Optional list of multi-agent responses to synthesize
            context: Optional additional context

        Returns:
            EnhancedResponse with quality metadata
        """
        import time
        start_time = time.time()

        # Stage 1: Retrieve relevant context
        retrieved_context = None
        if session_id:
            try:
                retrieved_context = await self.context_store.search(
                    query=query,
                    session_id=session_id,
                    max_results=3,
                )
            except Exception as e:
                logger.warning(f"[QualityPipeline] Context retrieval failed: {e}")

        # Stage 2: Multi-agent synthesis if multiple responses provided
        synthesis_info = None
        if agent_responses and len(agent_responses) > 1:
            try:
                # Convert to AgentResponse objects
                agent_resp_objects = [
                    AgentResponse(
                        agent_id=r.get("agent_id", "unknown"),
                        agent_name=r.get("agent_name", "Unknown Agent"),
                        agent_role=r.get("agent_role", "implementation"),
                        content=r.get("content", r.get("response", "")),
                        confidence=r.get("confidence", 0.8),
                    )
                    for r in agent_responses
                ]

                synthesized = self.synthesizer.synthesize(
                    query=query,
                    responses=agent_resp_objects,
                )
                response = synthesized.content
                synthesis_info = {
                    "sources": synthesized.sources,
                    "conflicts_resolved": len(synthesized.conflicts_resolved),
                    "confidence": synthesized.confidence,
                }
            except Exception as e:
                logger.warning(f"[QualityPipeline] Synthesis failed: {e}")

        # Stage 3: Quality scoring
        quality_score = self.quality_scorer.score(
            query=query,
            response=response,
            context=context,
            api_data=api_data,
        )

        # Stage 4: Validation
        validation = self.quality_scorer.validate(
            response=response,
            api_data=api_data,
        )

        # Stage 5: Quality gate check (optional)
        if self.enable_quality_gate and quality_score.overall < self.min_quality_score:
            logger.warning(
                f"[QualityPipeline] Response below quality threshold: "
                f"{quality_score.overall:.2f} < {self.min_quality_score}"
            )
            # Could trigger retry or improvement request here

        # Stage 6: Generate follow-up suggestions
        follow_ups = self.follow_up_generator.generate(
            query=query,
            response=response,
        )

        # Add quality-based follow-ups
        if quality_score.improvements:
            for improvement in quality_score.improvements[:2]:
                if "specific" in improvement.lower():
                    follow_ups.append("Would you like me to provide more specific details?")
                    break

        enhancement_time = (time.time() - start_time) * 1000

        # Store response in context for future queries
        if session_id:
            try:
                await self.context_store.add_chunk(
                    text=response[:500],  # Store truncated for efficiency
                    session_id=session_id,
                    source="agent_response",
                    metadata={"query": query[:100], "quality": quality_score.overall},
                )
            except Exception as e:
                logger.warning(f"[QualityPipeline] Failed to store context: {e}")

        return EnhancedResponse(
            content=response,
            quality_score=quality_score,
            validation=validation,
            context_used=retrieved_context,
            synthesis_info=synthesis_info,
            follow_up_suggestions=follow_ups[:3],
            sources=synthesis_info.get("sources", []) if synthesis_info else [],
            enhancement_time_ms=round(enhancement_time, 2),
        )

    async def enhance_with_context(
        self,
        query: str,
        session_id: str,
        system_prompt_tokens: int = 0,
    ) -> Tuple[str, List[str]]:
        """Enhance a query with relevant context from history.

        Args:
            query: User query
            session_id: Session ID
            system_prompt_tokens: Tokens already used by system prompt

        Returns:
            Tuple of (context_prompt, entity_list)
        """
        # Search for relevant context
        retrieved = await self.context_store.search(
            query=query,
            session_id=session_id,
            max_results=5,
        )

        if not retrieved.chunks:
            return "", []

        # Optimize context window
        selected = self.context_optimizer.optimize(
            retrieved=retrieved,
            query=query,
            system_prompt_tokens=system_prompt_tokens,
        )

        if not selected:
            return "", []

        # Build context prompt
        context_prompt = self.context_optimizer.build_context_prompt(
            chunks=selected,
            include_metadata=True,
        )

        # Get recent entities for reference
        entities = self.context_store.get_recent_entities(session_id, limit=5)
        entity_list = [f"{e.entity_type}:{e.entity_name}" for e in entities]

        return context_prompt, entity_list

    def score_response(
        self,
        query: str,
        response: str,
        api_data: Optional[Dict[str, Any]] = None,
    ) -> QualityScore:
        """Quick method to just score a response.

        Args:
            query: Original query
            response: Response to score
            api_data: Optional API data for accuracy checking

        Returns:
            QualityScore
        """
        return self.quality_scorer.score(
            query=query,
            response=response,
            api_data=api_data,
        )

    def check_quality_gate(
        self,
        query: str,
        response: str,
        api_data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, QualityScore, Optional[str]]:
        """Check if response passes quality gate.

        Args:
            query: Original query
            response: Response to check
            api_data: Optional API data

        Returns:
            Tuple of (passed, score, improvement_request)
        """
        return self.quality_gate.check(
            query=query,
            response=response,
            api_data=api_data,
        )

    async def record_interaction(
        self,
        session_id: str,
        query: str,
        response: str,
        source: str = "conversation",
    ):
        """Record an interaction for future context enhancement.

        Args:
            session_id: Session ID
            query: User query
            response: Agent response
            source: Source type
        """
        # Record query
        await self.context_store.add_chunk(
            text=f"User: {query}",
            session_id=session_id,
            source=source,
            metadata={"type": "query"},
        )

        # Record response (truncated)
        await self.context_store.add_chunk(
            text=f"Agent: {response[:500]}",
            session_id=session_id,
            source=source,
            metadata={"type": "response"},
        )

    def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        """Get quality and context summary for a session.

        Args:
            session_id: Session ID

        Returns:
            Summary dict with context and entity info
        """
        return self.context_store.get_session_summary(session_id)


# Singleton instance
_enhancement_pipeline: Optional[QualityEnhancementPipeline] = None


def get_enhancement_pipeline() -> QualityEnhancementPipeline:
    """Get singleton enhancement pipeline."""
    global _enhancement_pipeline
    if _enhancement_pipeline is None:
        _enhancement_pipeline = QualityEnhancementPipeline()
    return _enhancement_pipeline


# Convenience functions for direct use

async def enhance_response(
    query: str,
    response: str,
    session_id: Optional[str] = None,
    api_data: Optional[Dict[str, Any]] = None,
) -> EnhancedResponse:
    """Enhance a response using the default pipeline.

    Args:
        query: Original user query
        response: Response to enhance
        session_id: Optional session ID
        api_data: Optional API data for validation

    Returns:
        EnhancedResponse
    """
    pipeline = get_enhancement_pipeline()
    return await pipeline.enhance_response(
        query=query,
        response=response,
        session_id=session_id,
        api_data=api_data,
    )


def score_response(
    query: str,
    response: str,
    api_data: Optional[Dict[str, Any]] = None,
) -> QualityScore:
    """Score a response quality.

    Args:
        query: Original query
        response: Response to score
        api_data: Optional API data

    Returns:
        QualityScore
    """
    pipeline = get_enhancement_pipeline()
    return pipeline.score_response(query, response, api_data)


def check_quality(
    query: str,
    response: str,
) -> Tuple[bool, float]:
    """Quick quality check.

    Args:
        query: Original query
        response: Response to check

    Returns:
        Tuple of (passes_threshold, score)
    """
    pipeline = get_enhancement_pipeline()
    score = pipeline.score_response(query, response)
    return score.overall >= 0.5, score.overall
