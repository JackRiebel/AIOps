"""Tests for QueryAnalysisAgent."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.agentic_rag.agents.query_analysis import QueryAnalysisAgent
from src.services.agentic_rag.state import RAGState, SubQuestion


class TestQueryAnalysisAgent:
    """Test suite for QueryAnalysisAgent."""

    @pytest.fixture
    def agent(self, mock_llm_service):
        """Create a QueryAnalysisAgent for testing."""
        return QueryAnalysisAgent(
            llm_service=mock_llm_service,
            enabled=True,
            max_sub_questions=3,
        )

    @pytest.fixture
    def disabled_agent(self, mock_llm_service):
        """Create a disabled QueryAnalysisAgent."""
        return QueryAnalysisAgent(
            llm_service=mock_llm_service,
            enabled=False,
        )

    @pytest.mark.asyncio
    async def test_simple_query_classification(self, agent, mock_llm_service):
        """Test that simple queries are classified correctly."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "simple",
            "cisco_topics": ["vlan"],
            "sub_questions": [],
            "intent": "informational",
        })

        state = RAGState(original_query="What is a VLAN?", context={})
        result = await agent.execute(state)

        assert result.query_type == "simple"
        assert "vlan" in result.cisco_topics
        assert len(result.sub_questions) == 0

    @pytest.mark.asyncio
    async def test_complex_query_decomposition(self, agent, mock_llm_service):
        """Test that complex queries are decomposed into sub-questions."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "complex",
            "cisco_topics": ["vpn", "meraki", "asa"],
            "sub_questions": [
                {"question": "How to configure VPN on Meraki MX?", "topic": "meraki"},
                {"question": "How to configure VPN on Cisco ASA?", "topic": "asa"},
                {"question": "How to set up redundant tunnels?", "topic": "vpn"},
            ],
            "intent": "procedural",
        })

        state = RAGState(
            original_query="How do I configure site-to-site VPN between Meraki MX and Cisco ASA?",
            context={},
        )
        result = await agent.execute(state)

        assert result.query_type == "complex"
        assert len(result.sub_questions) == 3
        assert "meraki" in result.cisco_topics
        assert "asa" in result.cisco_topics

    @pytest.mark.asyncio
    async def test_multi_hop_query(self, agent, mock_llm_service):
        """Test multi-hop query handling."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "multi-hop",
            "cisco_topics": ["ospf", "eigrp", "catalyst"],
            "sub_questions": [
                {"question": "What are the performance characteristics of OSPF?", "topic": "ospf"},
                {"question": "What are the performance characteristics of EIGRP?", "topic": "eigrp"},
            ],
            "intent": "comparative",
        })

        state = RAGState(
            original_query="What are the performance implications of OSPF vs EIGRP?",
            context={},
        )
        result = await agent.execute(state)

        assert result.query_type == "multi-hop"
        assert len(result.sub_questions) >= 2

    @pytest.mark.asyncio
    async def test_disabled_agent_passthrough(self, disabled_agent):
        """Test that disabled agent passes through state unchanged."""
        state = RAGState(original_query="Test query", context={})
        original_query_type = state.query_type

        result = await disabled_agent.execute(state)

        assert result.query_type == original_query_type
        assert len(result.sub_questions) == 0

    @pytest.mark.asyncio
    async def test_llm_error_handling(self, agent, mock_llm_service):
        """Test graceful handling of LLM errors."""
        mock_llm_service.generate_json = AsyncMock(
            side_effect=Exception("LLM API error")
        )

        state = RAGState(original_query="Test query", context={})
        result = await agent.execute(state)

        # Should default to simple query type on error
        assert result.query_type in ["simple", None, ""]
        assert result.error is None or "error" not in result.error.lower()

    @pytest.mark.asyncio
    async def test_max_sub_questions_limit(self, mock_llm_service):
        """Test that sub-questions are limited to max_sub_questions."""
        agent = QueryAnalysisAgent(
            llm_service=mock_llm_service,
            enabled=True,
            max_sub_questions=2,
        )

        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "complex",
            "cisco_topics": ["networking"],
            "sub_questions": [
                {"question": "Q1", "topic": "t1"},
                {"question": "Q2", "topic": "t2"},
                {"question": "Q3", "topic": "t3"},
                {"question": "Q4", "topic": "t4"},
            ],
        })

        state = RAGState(original_query="Complex query", context={})
        result = await agent.execute(state)

        assert len(result.sub_questions) <= 2

    @pytest.mark.asyncio
    async def test_cisco_topic_extraction(self, agent, mock_llm_service):
        """Test extraction of Cisco-specific topics."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "simple",
            "cisco_topics": ["meraki", "catalyst", "ise", "dna-center"],
            "sub_questions": [],
        })

        state = RAGState(
            original_query="How do I integrate Meraki with DNA Center and ISE?",
            context={},
        )
        result = await agent.execute(state)

        assert "meraki" in result.cisco_topics
        assert len(result.cisco_topics) >= 2

    @pytest.mark.asyncio
    async def test_agent_timing_recorded(self, agent, mock_llm_service):
        """Test that agent execution time is recorded."""
        mock_llm_service.generate_json = AsyncMock(return_value={
            "query_type": "simple",
            "cisco_topics": [],
            "sub_questions": [],
        })

        state = RAGState(original_query="Test query", context={})
        result = await agent.execute(state)

        assert "QueryAnalysisAgent" in result.agent_timings
        assert result.agent_timings["QueryAnalysisAgent"] >= 0
