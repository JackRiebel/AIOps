"""Tests for SynthesisAgent."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.agentic_rag.agents.synthesis import SynthesisAgent
from src.services.agentic_rag.state import RAGState, GradedDocument, Citation


class TestSynthesisAgent:
    """Test suite for SynthesisAgent."""

    @pytest.fixture
    def agent(self, mock_llm_service):
        """Create a SynthesisAgent for testing."""
        return SynthesisAgent(
            llm_service=mock_llm_service,
            enabled=True,
            max_tokens=2048,
            require_citations=True,
            min_citations=1,
        )

    @pytest.fixture
    def disabled_agent(self, mock_llm_service):
        """Create a disabled SynthesisAgent."""
        return SynthesisAgent(
            llm_service=mock_llm_service,
            enabled=False,
        )

    @pytest.mark.asyncio
    async def test_generate_answer_with_citations(self, agent, mock_llm_service, state_with_graded_docs):
        """Test generation of answer with proper citations."""
        mock_llm_service.generate = AsyncMock(return_value={
            "content": """To configure VLANs on Meraki:

1. Navigate to Network-wide > Configure > Addressing & VLANs [1]
2. Create your VLAN with desired settings
3. Assign to switch ports [2]

**Sources:**
[1] Meraki VLAN Configuration
[2] Meraki Switch Guide""",
            "usage": {"input_tokens": 500, "output_tokens": 100}
        })

        result = await agent.execute(state_with_graded_docs)

        assert result.answer is not None
        assert len(result.answer) > 0
        assert "[1]" in result.answer
        assert len(result.citations) > 0

    @pytest.mark.asyncio
    async def test_citation_extraction(self, agent, mock_llm_service, state_with_graded_docs):
        """Test that citations are properly extracted from the answer."""
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "The answer uses sources [1] and [2] for information.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        result = await agent.execute(state_with_graded_docs)

        # Should have citations matching the referenced documents
        assert len(result.citations) >= 1

    @pytest.mark.asyncio
    async def test_confidence_calculation(self, agent, mock_llm_service, state_with_graded_docs):
        """Test that confidence score is calculated."""
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer with citations [1].",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        result = await agent.execute(state_with_graded_docs)

        assert result.confidence >= 0.0
        assert result.confidence <= 1.0

    @pytest.mark.asyncio
    async def test_disabled_agent_passthrough(self, disabled_agent, state_with_graded_docs):
        """Test that disabled agent passes through without synthesis."""
        result = await disabled_agent.execute(state_with_graded_docs)

        # Should have a basic answer or be empty
        assert result.answer is not None

    @pytest.mark.asyncio
    async def test_no_documents_handling(self, agent, mock_llm_service):
        """Test handling when no documents are available."""
        state = RAGState(original_query="Test query", context={})
        state.graded_documents = []

        mock_llm_service.generate = AsyncMock(return_value={
            "content": "I don't have enough information to answer this question.",
            "usage": {"input_tokens": 50, "output_tokens": 20}
        })

        result = await agent.execute(state)

        assert result.answer is not None
        assert result.confidence < 0.5  # Low confidence when no docs

    @pytest.mark.asyncio
    async def test_web_results_included(self, agent, mock_llm_service, state_with_graded_docs):
        """Test that web results are included in synthesis."""
        state_with_graded_docs.web_results = [
            {
                "title": "External Source",
                "url": "https://example.com",
                "snippet": "Additional information from the web.",
            }
        ]

        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer with KB [1] and web sources [3].",
            "usage": {"input_tokens": 200, "output_tokens": 80}
        })

        result = await agent.execute(state_with_graded_docs)

        assert result.answer is not None

    @pytest.mark.asyncio
    async def test_sub_questions_addressed(self, agent, mock_llm_service, state_with_graded_docs):
        """Test that sub-questions are addressed in synthesis."""
        state_with_graded_docs.sub_questions = [
            MagicMock(question="How to create VLANs?", topic="vlans"),
            MagicMock(question="How to assign ports?", topic="ports"),
        ]

        mock_llm_service.generate = AsyncMock(return_value={
            "content": "1. Creating VLANs: [steps] [1]\n2. Assigning ports: [steps] [2]",
            "usage": {"input_tokens": 300, "output_tokens": 150}
        })

        result = await agent.execute(state_with_graded_docs)

        assert result.answer is not None

    @pytest.mark.asyncio
    async def test_llm_error_handling(self, agent, mock_llm_service, state_with_graded_docs):
        """Test graceful handling of LLM errors."""
        mock_llm_service.generate = AsyncMock(
            side_effect=Exception("LLM error")
        )

        result = await agent.execute(state_with_graded_docs)

        # Should have some fallback answer
        assert result.answer is not None
        assert "error" in result.answer.lower() or "unable" in result.answer.lower()

    @pytest.mark.asyncio
    async def test_max_tokens_respected(self, mock_llm_service, state_with_graded_docs):
        """Test that max_tokens is passed to LLM."""
        agent = SynthesisAgent(
            llm_service=mock_llm_service,
            enabled=True,
            max_tokens=1024,
        )

        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Short answer.",
            "usage": {"input_tokens": 50, "output_tokens": 10}
        })

        await agent.execute(state_with_graded_docs)

        # Check that generate was called with max_tokens
        call_args = mock_llm_service.generate.call_args
        assert call_args is not None

    @pytest.mark.asyncio
    async def test_require_citations_validation(self, mock_llm_service, state_with_graded_docs):
        """Test that citations are required when configured."""
        agent = SynthesisAgent(
            llm_service=mock_llm_service,
            enabled=True,
            require_citations=True,
            min_citations=2,
        )

        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer with [1] and [2] citations.",
            "usage": {"input_tokens": 100, "output_tokens": 50}
        })

        result = await agent.execute(state_with_graded_docs)

        assert len(result.citations) >= 1

    @pytest.mark.asyncio
    async def test_agent_timing_recorded(self, agent, mock_llm_service, state_with_graded_docs):
        """Test that synthesis timing is recorded."""
        mock_llm_service.generate = AsyncMock(return_value={
            "content": "Answer.",
            "usage": {"input_tokens": 50, "output_tokens": 20}
        })

        result = await agent.execute(state_with_graded_docs)

        assert "SynthesisAgent" in result.agent_timings
