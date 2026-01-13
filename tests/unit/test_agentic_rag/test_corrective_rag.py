"""Tests for CorrectiveRAGAgent."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.agentic_rag.agents.corrective_rag import CorrectiveRAGAgent
from src.services.agentic_rag.state import RAGState, GradedDocument


class TestCorrectiveRAGAgent:
    """Test suite for CorrectiveRAGAgent."""

    @pytest.fixture
    def agent(self):
        """Create a CorrectiveRAGAgent for testing."""
        return CorrectiveRAGAgent(
            enabled=True,
            web_search_enabled=False,
            web_search_service=None,
            min_relevant_docs=2,
            min_avg_relevance=0.6,
            max_web_results=3,
        )

    @pytest.fixture
    def agent_with_web_search(self, mock_web_search_service):
        """Create a CorrectiveRAGAgent with web search enabled."""
        return CorrectiveRAGAgent(
            enabled=True,
            web_search_enabled=True,
            web_search_service=mock_web_search_service,
            min_relevant_docs=2,
            min_avg_relevance=0.6,
            max_web_results=3,
        )

    @pytest.fixture
    def disabled_agent(self):
        """Create a disabled CorrectiveRAGAgent."""
        return CorrectiveRAGAgent(enabled=False)

    @pytest.mark.asyncio
    async def test_sufficient_kb_coverage(self, agent, state_with_graded_docs):
        """Test that no correction is needed when KB coverage is sufficient."""
        result = await agent.execute(state_with_graded_docs)

        assert result.web_search_triggered is False
        assert result.kb_coverage_sufficient is True
        assert len(result.web_results) == 0

    @pytest.mark.asyncio
    async def test_insufficient_relevant_docs(self, agent):
        """Test detection of insufficient relevant documents."""
        state = RAGState(original_query="Test query", context={})
        state.graded_documents = [
            GradedDocument(
                chunk_id=1,
                content="Content",
                document_filename="doc.md",
                document_title="Doc",
                document_type="documentation",
                is_relevant=True,
                graded_relevance=0.9,
            ),
        ]

        result = await agent.execute(state)

        # Only 1 relevant doc, needs 2
        assert result.kb_coverage_sufficient is False

    @pytest.mark.asyncio
    async def test_low_average_relevance(self, agent):
        """Test detection of low average relevance."""
        state = RAGState(original_query="Test query", context={})
        state.graded_documents = [
            GradedDocument(
                chunk_id=1, content="C1", document_filename="d1.md",
                document_title="D1", document_type="doc",
                is_relevant=True, graded_relevance=0.55,
            ),
            GradedDocument(
                chunk_id=2, content="C2", document_filename="d2.md",
                document_title="D2", document_type="doc",
                is_relevant=True, graded_relevance=0.50,
            ),
        ]

        result = await agent.execute(state)

        # Avg relevance 0.525 < 0.6 threshold
        assert result.kb_coverage_sufficient is False

    @pytest.mark.asyncio
    async def test_web_search_triggered(self, agent_with_web_search, mock_web_search_service):
        """Test that web search is triggered when KB is insufficient."""
        state = RAGState(original_query="What is SD-WAN?", context={})
        state.graded_documents = [
            GradedDocument(
                chunk_id=1, content="Partial info",
                document_filename="d.md", document_title="D",
                document_type="doc", is_relevant=True, graded_relevance=0.5,
            ),
        ]

        result = await agent_with_web_search.execute(state)

        assert result.web_search_triggered is True
        assert mock_web_search_service.search.called
        assert len(result.web_results) > 0

    @pytest.mark.asyncio
    async def test_web_search_disabled(self, agent):
        """Test that web search is not triggered when disabled."""
        state = RAGState(original_query="Test query", context={})
        state.graded_documents = []  # No relevant docs

        result = await agent.execute(state)

        assert result.web_search_triggered is False
        assert len(result.web_results) == 0

    @pytest.mark.asyncio
    async def test_disabled_agent_passthrough(self, disabled_agent, state_with_graded_docs):
        """Test that disabled agent passes through state unchanged."""
        original_coverage = state_with_graded_docs.kb_coverage_sufficient

        result = await disabled_agent.execute(state_with_graded_docs)

        # Should not modify the state
        assert result.web_search_triggered is False

    @pytest.mark.asyncio
    async def test_max_web_results_limit(self, mock_web_search_service):
        """Test that web results are limited to max_web_results."""
        mock_web_search_service.search = AsyncMock(return_value=[
            {"title": f"Result {i}", "url": f"https://example.com/{i}", "snippet": f"Snippet {i}"}
            for i in range(10)
        ])

        agent = CorrectiveRAGAgent(
            enabled=True,
            web_search_enabled=True,
            web_search_service=mock_web_search_service,
            min_relevant_docs=2,
            max_web_results=3,
        )

        state = RAGState(original_query="Test", context={})
        state.graded_documents = []

        result = await agent.execute(state)

        assert len(result.web_results) <= 3

    @pytest.mark.asyncio
    async def test_web_search_error_handling(self, mock_web_search_service):
        """Test graceful handling of web search errors."""
        mock_web_search_service.search = AsyncMock(
            side_effect=Exception("Web search failed")
        )

        agent = CorrectiveRAGAgent(
            enabled=True,
            web_search_enabled=True,
            web_search_service=mock_web_search_service,
            min_relevant_docs=2,
        )

        state = RAGState(original_query="Test", context={})
        state.graded_documents = []

        result = await agent.execute(state)

        # Should handle error gracefully
        assert result.web_search_triggered is True
        assert len(result.web_results) == 0

    @pytest.mark.asyncio
    async def test_coverage_metrics_calculation(self, agent, state_with_graded_docs):
        """Test that coverage metrics are calculated correctly."""
        result = await agent.execute(state_with_graded_docs)

        relevant_count = sum(1 for d in state_with_graded_docs.graded_documents if d.is_relevant)
        avg_relevance = sum(d.graded_relevance for d in state_with_graded_docs.graded_documents if d.is_relevant) / max(relevant_count, 1)

        assert relevant_count >= agent.min_relevant_docs
        assert avg_relevance >= agent.min_avg_relevance

    @pytest.mark.asyncio
    async def test_empty_graded_documents(self, agent):
        """Test handling of empty graded documents."""
        state = RAGState(original_query="Test", context={})
        state.graded_documents = []

        result = await agent.execute(state)

        assert result.kb_coverage_sufficient is False
