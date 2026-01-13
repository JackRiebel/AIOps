"""Tests for AgenticRAGOrchestrator."""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.agentic_rag.orchestrator import AgenticRAGOrchestrator
from src.services.agentic_rag.config import AgenticRAGConfig
from src.services.agentic_rag.state import RAGState, AnswerQuality


class TestAgenticRAGOrchestrator:
    """Test suite for AgenticRAGOrchestrator."""

    @pytest.fixture
    def config(self):
        """Create a test configuration."""
        return AgenticRAGConfig(
            enabled=True,
            max_iterations=2,
            total_timeout_seconds=10.0,
            query_analysis_enabled=True,
            document_grading_enabled=True,
            reflection_enabled=True,
            web_search_enabled=False,
            debug_mode=True,
        )

    @pytest.fixture
    def orchestrator(self, config, mock_llm_service, mock_knowledge_service):
        """Create an orchestrator for testing."""
        return AgenticRAGOrchestrator(
            config=config,
            llm_service=mock_llm_service,
            knowledge_service=mock_knowledge_service,
            web_search_service=None,
        )

    @pytest.fixture
    def mock_session(self):
        """Create a mock database session."""
        session = MagicMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_basic_pipeline_execution(self, orchestrator, mock_session, mock_llm_service):
        """Test basic pipeline execution from start to finish."""
        # Setup mock responses
        mock_llm_service.generate_json = AsyncMock(side_effect=[
            # Query analysis
            {"query_type": "simple", "cisco_topics": ["vlan"], "sub_questions": []},
            # Document grading
            {"grades": [{"chunk_id": 1, "is_relevant": True, "relevance_score": 0.9, "reasoning": "Relevant"}]},
            # Reflection
            {"quality": "GOOD", "score": 0.85, "issues": [], "recommendation": "OK"},
        ])
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Here is the answer about VLANs [1].",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="What is a VLAN?",
        )

        assert answer is not None
        assert len(answer) > 0
        assert metrics["enabled"] is True

    @pytest.mark.asyncio
    async def test_pipeline_timeout(self, mock_session, mock_llm_service, mock_knowledge_service):
        """Test that pipeline respects timeout."""
        config = AgenticRAGConfig(
            enabled=True,
            total_timeout_seconds=0.1,  # Very short timeout
        )

        orchestrator = AgenticRAGOrchestrator(
            config=config,
            llm_service=mock_llm_service,
            knowledge_service=mock_knowledge_service,
        )

        # Make LLM call slow
        async def slow_response(*args, **kwargs):
            await asyncio.sleep(1)
            return {"query_type": "simple", "cisco_topics": [], "sub_questions": []}

        mock_llm_service.generate_json = slow_response

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Test query",
        )

        # Should return timeout response
        assert "timeout" in answer.lower() or "unable" in answer.lower()

    @pytest.mark.asyncio
    async def test_iteration_on_needs_improvement(self, orchestrator, mock_session, mock_llm_service):
        """Test that pipeline iterates when quality needs improvement."""
        call_count = {"value": 0}

        async def mock_reflection(*args, **kwargs):
            call_count["value"] += 1
            if call_count["value"] == 1:
                return {
                    "quality": "NEEDS_ITERATION",
                    "score": 0.55,
                    "issues": ["Needs more detail"],
                    "recommendation": "Iterate",
                }
            return {
                "quality": "GOOD",
                "score": 0.85,
                "issues": [],
                "recommendation": "OK",
            }

        mock_llm_service.generate_json = AsyncMock(side_effect=[
            {"query_type": "simple", "cisco_topics": [], "sub_questions": []},
            {"grades": [{"chunk_id": 1, "is_relevant": True, "relevance_score": 0.9, "reasoning": "R"}]},
        ])
        mock_llm_service.generate_json.side_effect = None
        mock_llm_service.generate_json = mock_reflection

        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer [1].",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Test query",
        )

        # Should have iterated
        assert metrics["iterations"] >= 1

    @pytest.mark.asyncio
    async def test_max_iterations_respected(self, mock_session, mock_llm_service, mock_knowledge_service):
        """Test that max_iterations limit is respected."""
        config = AgenticRAGConfig(
            enabled=True,
            max_iterations=2,
        )

        orchestrator = AgenticRAGOrchestrator(
            config=config,
            llm_service=mock_llm_service,
            knowledge_service=mock_knowledge_service,
        )

        # Always return NEEDS_ITERATION
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "NEEDS_ITERATION",
            "score": 0.50,
            "issues": ["Always needs more"],
        })
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Test query",
        )

        assert metrics["iterations"] <= 2

    @pytest.mark.asyncio
    async def test_error_handling(self, orchestrator, mock_session, mock_llm_service):
        """Test graceful error handling in pipeline."""
        mock_llm_service.generate_json = AsyncMock(
            side_effect=Exception("LLM service error")
        )

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Test query",
        )

        # Should return error response
        assert answer is not None
        assert "error" in answer.lower()

    @pytest.mark.asyncio
    async def test_output_format(self, orchestrator, mock_session, mock_llm_service):
        """Test that output format is correct."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "simple",
            "cisco_topics": [],
            "sub_questions": [],
            "quality": "GOOD",
            "score": 0.85,
        })
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer with [1] citation.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Test query",
        )

        # Check output types
        assert isinstance(answer, str)
        assert isinstance(citations, list)
        assert isinstance(chunks, list)
        assert isinstance(metrics, dict)

        # Check metrics structure
        assert "enabled" in metrics
        assert "iterations" in metrics
        assert "agents_used" in metrics

    @pytest.mark.asyncio
    async def test_agents_used_tracking(self, orchestrator, mock_session, mock_llm_service):
        """Test that used agents are tracked in metrics."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "simple",
            "cisco_topics": [],
            "sub_questions": [],
            "quality": "GOOD",
            "score": 0.85,
            "grades": [],
        })
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Test query",
        )

        assert len(metrics["agents_used"]) > 0

    @pytest.mark.asyncio
    async def test_web_search_metrics(self, mock_session, mock_llm_service, mock_knowledge_service, mock_web_search_service):
        """Test that web search usage is tracked in metrics."""
        config = AgenticRAGConfig(
            enabled=True,
            web_search_enabled=True,
        )

        orchestrator = AgenticRAGOrchestrator(
            config=config,
            llm_service=mock_llm_service,
            knowledge_service=mock_knowledge_service,
            web_search_service=mock_web_search_service,
        )

        # Make KB insufficient to trigger web search
        mock_knowledge_service.enhanced_search = AsyncMock(return_value=([], {}))

        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "simple",
            "quality": "GOOD",
            "score": 0.80,
        })
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer from web.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Obscure topic",
        )

        assert "web_search_used" in metrics

    @pytest.mark.asyncio
    async def test_query_type_in_metrics(self, orchestrator, mock_session, mock_llm_service):
        """Test that query type is included in metrics."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "complex",
            "cisco_topics": ["vpn", "meraki"],
            "sub_questions": [{"question": "Q1", "topic": "vpn"}],
            "quality": "GOOD",
            "score": 0.85,
        })
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Complex VPN query",
        )

        assert metrics.get("query_type") == "complex"

    @pytest.mark.asyncio
    async def test_quality_in_metrics(self, orchestrator, mock_session, mock_llm_service):
        """Test that final quality is included in metrics."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "simple",
            "quality": "EXCELLENT",
            "score": 0.95,
        })
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Excellent answer.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        answer, citations, chunks, metrics = await orchestrator.process(
            session=mock_session,
            query="Test query",
        )

        assert "quality" in metrics
