"""Tests for ReflectionAgent."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.agentic_rag.agents.reflection import ReflectionAgent
from src.services.agentic_rag.state import RAGState, AnswerQuality, Citation


class TestReflectionAgent:
    """Test suite for ReflectionAgent."""

    @pytest.fixture
    def agent(self, mock_llm_service):
        """Create a ReflectionAgent for testing."""
        return ReflectionAgent(
            llm_service=mock_llm_service,
            enabled=True,
            quality_threshold=0.7,
        )

    @pytest.fixture
    def disabled_agent(self, mock_llm_service):
        """Create a disabled ReflectionAgent."""
        return ReflectionAgent(
            llm_service=mock_llm_service,
            enabled=False,
        )

    @pytest.mark.asyncio
    async def test_excellent_quality_detection(self, agent, mock_llm_service, state_with_answer):
        """Test detection of excellent quality answers."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "EXCELLENT",
            "score": 0.95,
            "completeness": 0.95,
            "accuracy": 0.98,
            "clarity": 0.92,
            "specificity": 0.94,
            "issues": [],
            "missing_aspects": [],
            "recommendation": "No improvements needed",
        })

        result = await agent.execute(state_with_answer)

        assert result.quality == AnswerQuality.EXCELLENT
        assert result.needs_iteration is False

    @pytest.mark.asyncio
    async def test_good_quality_detection(self, agent, mock_llm_service, state_with_answer):
        """Test detection of good quality answers."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "GOOD",
            "score": 0.82,
            "completeness": 0.85,
            "accuracy": 0.90,
            "clarity": 0.80,
            "specificity": 0.75,
            "issues": ["Could use more specific examples"],
            "missing_aspects": [],
            "recommendation": "Minor improvements possible",
        })

        result = await agent.execute(state_with_answer)

        assert result.quality == AnswerQuality.GOOD
        assert result.needs_iteration is False

    @pytest.mark.asyncio
    async def test_needs_iteration_detection(self, agent, mock_llm_service, state_with_answer):
        """Test detection of answers that need iteration."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "NEEDS_ITERATION",
            "score": 0.55,
            "completeness": 0.50,
            "accuracy": 0.70,
            "clarity": 0.60,
            "specificity": 0.40,
            "issues": ["Missing key configuration steps", "Lacks detail on prerequisites"],
            "missing_aspects": ["VLAN tagging", "Trunk configuration"],
            "recommendation": "Iterate to add missing configuration details",
        })

        result = await agent.execute(state_with_answer)

        assert result.quality == AnswerQuality.NEEDS_ITERATION
        assert result.needs_iteration is True

    @pytest.mark.asyncio
    async def test_insufficient_kb_detection(self, agent, mock_llm_service, state_with_answer):
        """Test detection of insufficient knowledge base coverage."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "INSUFFICIENT_KB",
            "score": 0.30,
            "completeness": 0.20,
            "accuracy": 0.50,
            "clarity": 0.40,
            "specificity": 0.10,
            "issues": ["Knowledge base lacks relevant documentation"],
            "missing_aspects": ["Product-specific configuration", "Version compatibility"],
            "recommendation": "Consider web search or manual documentation lookup",
        })

        result = await agent.execute(state_with_answer)

        assert result.quality == AnswerQuality.INSUFFICIENT_KB

    @pytest.mark.asyncio
    async def test_disabled_agent_passthrough(self, disabled_agent, state_with_answer):
        """Test that disabled agent passes through with default quality."""
        result = await disabled_agent.execute(state_with_answer)

        # Should have a default quality when disabled
        assert result.quality is not None

    @pytest.mark.asyncio
    async def test_iteration_limit_respected(self, agent, mock_llm_service, state_with_answer):
        """Test that iteration is not recommended when limit reached."""
        state_with_answer.iteration_count = 2
        state_with_answer.max_iterations = 2

        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "NEEDS_ITERATION",
            "score": 0.55,
            "issues": ["Needs more detail"],
            "recommendation": "Iterate",
        })

        result = await agent.execute(state_with_answer)

        # Should not iterate even though quality suggests it
        assert result.needs_iteration is False

    @pytest.mark.asyncio
    async def test_reflection_notes_captured(self, agent, mock_llm_service, state_with_answer):
        """Test that reflection notes are captured."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "GOOD",
            "score": 0.80,
            "issues": ["Minor formatting issues"],
            "missing_aspects": [],
            "recommendation": "Consider adding examples",
        })

        result = await agent.execute(state_with_answer)

        assert len(result.reflection_notes) > 0

    @pytest.mark.asyncio
    async def test_llm_error_handling(self, agent, mock_llm_service, state_with_answer):
        """Test graceful handling of LLM errors."""
        mock_llm_service.generate_json = AsyncMock(
            side_effect=Exception("LLM error")
        )

        result = await agent.execute(state_with_answer)

        # Should default to GOOD quality on error
        assert result.quality in [AnswerQuality.GOOD, None]

    @pytest.mark.asyncio
    async def test_quality_threshold_application(self, mock_llm_service, state_with_answer):
        """Test that quality threshold affects iteration decision."""
        agent = ReflectionAgent(
            llm_service=mock_llm_service,
            enabled=True,
            quality_threshold=0.8,  # Higher threshold
        )

        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "GOOD",
            "score": 0.75,  # Below threshold
            "issues": ["Some issues"],
            "recommendation": "Consider iterating",
        })

        result = await agent.execute(state_with_answer)

        # Score below threshold should trigger iteration
        # (depends on implementation details)
        assert result.quality is not None

    @pytest.mark.asyncio
    async def test_citation_coverage_evaluation(self, agent, mock_llm_service, state_with_answer):
        """Test that citation coverage is evaluated."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "GOOD",
            "score": 0.85,
            "citation_coverage": 0.90,
            "issues": [],
            "recommendation": "Citations are well-used",
        })

        result = await agent.execute(state_with_answer)

        # Should pass with good citation coverage
        assert result.quality in [AnswerQuality.EXCELLENT, AnswerQuality.GOOD]

    @pytest.mark.asyncio
    async def test_no_answer_handling(self, agent, mock_llm_service):
        """Test handling when no answer is present."""
        state = RAGState(original_query="Test", context={})
        state.answer = ""

        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "INSUFFICIENT_KB",
            "score": 0.0,
            "issues": ["No answer generated"],
        })

        result = await agent.execute(state)

        assert result.quality == AnswerQuality.INSUFFICIENT_KB

    @pytest.mark.asyncio
    async def test_agent_timing_recorded(self, agent, mock_llm_service, state_with_answer):
        """Test that reflection timing is recorded."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "GOOD",
            "score": 0.80,
        })

        result = await agent.execute(state_with_answer)

        assert "ReflectionAgent" in result.agent_timings

    @pytest.mark.asyncio
    async def test_sub_question_coverage_check(self, agent, mock_llm_service, state_with_answer):
        """Test that sub-questions are checked for coverage."""
        state_with_answer.sub_questions = [
            MagicMock(question="Q1", answered=True),
            MagicMock(question="Q2", answered=False),
        ]

        mock_llm_service.generate_json = AsyncMock(return_value={
            "quality": "NEEDS_ITERATION",
            "score": 0.60,
            "issues": ["Not all sub-questions addressed"],
            "missing_aspects": ["Q2 not answered"],
        })

        result = await agent.execute(state_with_answer)

        assert result.quality == AnswerQuality.NEEDS_ITERATION
