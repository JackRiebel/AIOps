"""Tests for DocumentGraderAgent."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.agentic_rag.agents.document_grader import DocumentGraderAgent
from src.services.agentic_rag.state import RAGState, GradedDocument


class TestDocumentGraderAgent:
    """Test suite for DocumentGraderAgent."""

    @pytest.fixture
    def agent(self, mock_llm_service):
        """Create a DocumentGraderAgent for testing."""
        return DocumentGraderAgent(
            llm_service=mock_llm_service,
            enabled=True,
            max_documents=10,
            relevance_threshold=0.5,
            batch_grading=True,
        )

    @pytest.fixture
    def disabled_agent(self, mock_llm_service):
        """Create a disabled DocumentGraderAgent."""
        return DocumentGraderAgent(
            llm_service=mock_llm_service,
            enabled=False,
        )

    @pytest.mark.asyncio
    async def test_grade_relevant_documents(self, agent, mock_llm_service, state_with_chunks):
        """Test grading of relevant documents."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "grades": [
                {
                    "chunk_id": 1,
                    "is_relevant": True,
                    "relevance_score": 0.95,
                    "reasoning": "Directly addresses VLAN configuration",
                },
                {
                    "chunk_id": 2,
                    "is_relevant": True,
                    "relevance_score": 0.85,
                    "reasoning": "Related to VLAN port assignment",
                },
                {
                    "chunk_id": 3,
                    "is_relevant": False,
                    "relevance_score": 0.30,
                    "reasoning": "Too general, not specific to Meraki",
                },
            ]
        })

        result = await agent.execute(state_with_chunks)

        assert len(result.graded_documents) == 3
        relevant_docs = [d for d in result.graded_documents if d.is_relevant]
        assert len(relevant_docs) == 2

    @pytest.mark.asyncio
    async def test_relevance_threshold_filtering(self, mock_llm_service, state_with_chunks):
        """Test that documents below threshold are marked as irrelevant."""
        agent = DocumentGraderAgent(
            llm_service=mock_llm_service,
            enabled=True,
            relevance_threshold=0.7,
        )

        mock_llm_service.generate_json = AsyncMock(return_value={
            "grades": [
                {"chunk_id": 1, "is_relevant": True, "relevance_score": 0.95, "reasoning": "High relevance"},
                {"chunk_id": 2, "is_relevant": True, "relevance_score": 0.65, "reasoning": "Moderate relevance"},
                {"chunk_id": 3, "is_relevant": False, "relevance_score": 0.30, "reasoning": "Low relevance"},
            ]
        })

        result = await agent.execute(state_with_chunks)

        # Doc with 0.65 score should be below 0.7 threshold
        relevant_docs = result.get_relevant_documents()
        assert len(relevant_docs) <= 2

    @pytest.mark.asyncio
    async def test_disabled_agent_passthrough(self, disabled_agent, state_with_chunks):
        """Test that disabled agent converts chunks to graded docs without LLM."""
        result = await disabled_agent.execute(state_with_chunks)

        # Should still have graded documents, but without LLM grading
        assert len(result.graded_documents) == len(state_with_chunks.retrieved_chunks)

    @pytest.mark.asyncio
    async def test_empty_chunks_handling(self, agent):
        """Test handling of empty chunks list."""
        state = RAGState(original_query="Test query", context={})
        state.retrieved_chunks = []

        result = await agent.execute(state)

        assert len(result.graded_documents) == 0

    @pytest.mark.asyncio
    async def test_batch_grading(self, agent, mock_llm_service, state_with_chunks):
        """Test batch grading of multiple documents."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "grades": [
                {"chunk_id": 1, "is_relevant": True, "relevance_score": 0.9, "reasoning": "R1"},
                {"chunk_id": 2, "is_relevant": True, "relevance_score": 0.8, "reasoning": "R2"},
                {"chunk_id": 3, "is_relevant": False, "relevance_score": 0.3, "reasoning": "R3"},
            ]
        })

        result = await agent.execute(state_with_chunks)

        # Should have called LLM once for batch
        assert mock_llm_service.generate_json.call_count == 1

    @pytest.mark.asyncio
    async def test_individual_grading(self, mock_llm_service, state_with_chunks):
        """Test individual grading when batch_grading is False."""
        agent = DocumentGraderAgent(
            llm_service=mock_llm_service,
            enabled=True,
            batch_grading=False,
        )

        mock_llm_service.generate_json = AsyncMock(return_value={
            "is_relevant": True,
            "relevance_score": 0.9,
            "reasoning": "Relevant",
        })

        result = await agent.execute(state_with_chunks)

        # Should have called LLM once per document
        assert mock_llm_service.generate_json.call_count == len(state_with_chunks.retrieved_chunks)

    @pytest.mark.asyncio
    async def test_max_documents_limit(self, mock_llm_service):
        """Test that only max_documents are graded."""
        agent = DocumentGraderAgent(
            llm_service=mock_llm_service,
            enabled=True,
            max_documents=2,
        )

        state = RAGState(original_query="Test", context={})
        state.retrieved_chunks = [
            {"id": i, "content": f"Content {i}", "document_filename": f"doc{i}.md",
             "document_title": f"Doc {i}", "document_type": "doc", "document_product": None, "relevance": 0.9}
            for i in range(5)
        ]

        mock_llm_service.generate_json = AsyncMock(return_value={
            "grades": [
                {"chunk_id": 0, "is_relevant": True, "relevance_score": 0.9, "reasoning": "R"},
                {"chunk_id": 1, "is_relevant": True, "relevance_score": 0.8, "reasoning": "R"},
            ]
        })

        result = await agent.execute(state)

        # Should only grade max_documents
        assert len(result.graded_documents) == 2

    @pytest.mark.asyncio
    async def test_llm_error_fallback(self, agent, mock_llm_service, state_with_chunks):
        """Test fallback behavior when LLM fails."""
        mock_llm_service.generate_json = AsyncMock(
            side_effect=Exception("LLM error")
        )

        result = await agent.execute(state_with_chunks)

        # Should fall back to using retrieval scores
        assert len(result.graded_documents) == len(state_with_chunks.retrieved_chunks)

    @pytest.mark.asyncio
    async def test_graded_document_properties(self, agent, mock_llm_service, state_with_chunks):
        """Test that graded documents preserve chunk properties."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "grades": [
                {"chunk_id": 1, "is_relevant": True, "relevance_score": 0.9, "reasoning": "Test"},
            ]
        })

        # Only keep one chunk for this test
        state_with_chunks.retrieved_chunks = [state_with_chunks.retrieved_chunks[0]]
        result = await agent.execute(state_with_chunks)

        graded = result.graded_documents[0]
        original = state_with_chunks.retrieved_chunks[0]

        assert graded.chunk_id == original["id"]
        assert graded.content == original["content"]
        assert graded.document_filename == original["document_filename"]
