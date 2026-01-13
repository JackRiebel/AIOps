"""Shared fixtures for agentic RAG tests."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from typing import Dict, Any, List

from src.services.agentic_rag.state import (
    RAGState,
    SubQuestion,
    GradedDocument,
    Citation,
    RetrievalStrategy,
    AnswerQuality,
)
from src.services.agentic_rag.config import AgenticRAGConfig


@pytest.fixture
def mock_llm_service():
    """Create a mock LLM service for testing."""
    service = MagicMock()
    service.generate = AsyncMock(return_value={
        "content": "Test response",
        "usage": {"input_tokens": 100, "output_tokens": 50}
    })
    service.generate_json = AsyncMock(return_value={
        "query_type": "simple",
        "cisco_topics": ["meraki"],
        "sub_questions": []
    })
    return service


@pytest.fixture
def mock_knowledge_service():
    """Create a mock knowledge service for testing."""
    service = MagicMock()
    service.enhanced_search = AsyncMock(return_value=(
        [
            MagicMock(
                id=1,
                content="Test content about Meraki",
                document_filename="meraki_guide.md",
                document_title="Meraki Guide",
                document_type="documentation",
                document_product="meraki",
                relevance=0.85,
                chunk_metadata={}
            ),
            MagicMock(
                id=2,
                content="More test content about networking",
                document_filename="network_basics.md",
                document_title="Network Basics",
                document_type="documentation",
                document_product=None,
                relevance=0.72,
                chunk_metadata={}
            ),
        ],
        {"total": 2}
    ))
    return service


@pytest.fixture
def mock_web_search_service():
    """Create a mock web search service for testing."""
    service = MagicMock()
    service.search = AsyncMock(return_value=[
        {
            "title": "Cisco Meraki Documentation",
            "url": "https://documentation.meraki.com",
            "snippet": "Official Meraki documentation for network configuration.",
        }
    ])
    return service


@pytest.fixture
def default_config():
    """Create a default agentic RAG configuration."""
    return AgenticRAGConfig(
        enabled=True,
        max_iterations=2,
        total_timeout_seconds=15.0,
        query_analysis_enabled=True,
        document_grading_enabled=True,
        reflection_enabled=True,
        web_search_enabled=False,
        debug_mode=True,
    )


@pytest.fixture
def initial_state():
    """Create an initial RAG state for testing."""
    return RAGState(
        original_query="How do I configure VLANs on Meraki?",
        context={"organization": "test_org"},
        user_id=1,
    )


@pytest.fixture
def state_with_chunks():
    """Create a RAG state with retrieved chunks."""
    state = RAGState(
        original_query="How do I configure VLANs on Meraki?",
        context={"organization": "test_org"},
    )
    state.retrieved_chunks = [
        {
            "id": 1,
            "content": "To configure VLANs on Meraki, navigate to the Network-wide > Configure > Addressing & VLANs page.",
            "document_filename": "meraki_vlans.md",
            "document_title": "Meraki VLAN Configuration",
            "document_type": "documentation",
            "document_product": "meraki",
            "relevance": 0.92,
        },
        {
            "id": 2,
            "content": "VLANs can be assigned to specific ports on Meraki switches using the Switch > Configure > Switch ports page.",
            "document_filename": "meraki_switches.md",
            "document_title": "Meraki Switch Guide",
            "document_type": "documentation",
            "document_product": "meraki",
            "relevance": 0.85,
        },
        {
            "id": 3,
            "content": "General networking concepts about VLANs and layer 2 segmentation.",
            "document_filename": "network_basics.md",
            "document_title": "Network Basics",
            "document_type": "documentation",
            "document_product": None,
            "relevance": 0.45,
        },
    ]
    return state


@pytest.fixture
def state_with_graded_docs():
    """Create a RAG state with graded documents."""
    state = RAGState(
        original_query="How do I configure VLANs on Meraki?",
        context={},
    )
    state.graded_documents = [
        GradedDocument(
            chunk_id=1,
            content="To configure VLANs on Meraki...",
            document_filename="meraki_vlans.md",
            document_title="Meraki VLAN Configuration",
            document_type="documentation",
            document_product="meraki",
            is_relevant=True,
            graded_relevance=0.95,
            reasoning="Directly addresses VLAN configuration on Meraki",
        ),
        GradedDocument(
            chunk_id=2,
            content="VLANs can be assigned to specific ports...",
            document_filename="meraki_switches.md",
            document_title="Meraki Switch Guide",
            document_type="documentation",
            document_product="meraki",
            is_relevant=True,
            graded_relevance=0.88,
            reasoning="Relevant for switch port VLAN assignment",
        ),
    ]
    return state


@pytest.fixture
def state_with_answer():
    """Create a RAG state with a synthesized answer."""
    state = RAGState(
        original_query="How do I configure VLANs on Meraki?",
        context={},
    )
    state.answer = """To configure VLANs on Meraki, follow these steps:

1. Navigate to Network-wide > Configure > Addressing & VLANs [1]
2. Create a new VLAN with your desired VLAN ID and name
3. Configure DHCP settings if needed
4. Assign the VLAN to switch ports via Switch > Configure > Switch ports [2]

**Sources:**
[1] Meraki VLAN Configuration
[2] Meraki Switch Guide"""
    state.citations = [
        Citation(
            index=1,
            document="Meraki VLAN Configuration",
            chunk_id=1,
            relevance=0.95,
            excerpt="Navigate to Network-wide > Configure > Addressing & VLANs",
        ),
        Citation(
            index=2,
            document="Meraki Switch Guide",
            chunk_id=2,
            relevance=0.88,
            excerpt="Assign the VLAN to switch ports",
        ),
    ]
    state.confidence = 0.92
    return state


@pytest.fixture
def sample_queries():
    """Sample queries for testing different scenarios."""
    return {
        "simple": "What is a VLAN?",
        "complex": "How do I configure site-to-site VPN between Meraki MX and Cisco ASA with redundant tunnels?",
        "multi_hop": "What are the performance implications of using OSPF vs EIGRP on Catalyst switches for large campus networks?",
        "action": "Show me all devices in the network",
        "troubleshooting": "My Meraki AP is showing as offline, how do I troubleshoot?",
    }
