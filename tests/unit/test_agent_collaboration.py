"""Tests for multi-agent collaboration features.

Tests the collaborative workflow execution, entity extraction,
cross-referencing, and error recovery mechanisms.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

import sys
sys.path.insert(0, str(__file__).rsplit('/tests', 1)[0])

from src.a2a.enhanced_orchestrator import (
    EnhancedOrchestrator,
    AgentResponse,
    CollaborativeResult,
)


class TestEntityExtraction:
    """Tests for entity extraction from agent responses."""

    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator with mocked registry."""
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry'):
            return EnhancedOrchestrator()

    def test_extract_entities_from_response(self, orchestrator):
        """Test extracting entities from agent response."""
        response = AgentResponse(
            agent_id="meraki-agent",
            agent_name="Meraki",
            success=True,
            response="Found devices",
            data={
                "devices": [
                    {"name": "MX68", "serial": "Q2AA-BBCC-DDEE"},
                    {"name": "MS120", "serial": "Q3FF-GGHH-IIJJ"},
                ],
            },
            entities={"device_ids": ["d1", "d2"]},
        )

        entities = orchestrator._extract_collaboration_entities(response)

        assert "device_ids" in entities
        assert "device_names" in entities
        assert "device_serials" in entities
        assert "MX68" in entities["device_names"]
        assert "Q2AA-BBCC-DDEE" in entities["device_serials"]

    def test_extract_network_entities(self, orchestrator):
        """Test extracting network entities."""
        response = AgentResponse(
            agent_id="meraki-agent",
            agent_name="Meraki",
            success=True,
            response="Found networks",
            data={
                "networks": [
                    {"id": "L_123", "name": "Main Office"},
                    {"id": "L_456", "name": "Branch Office"},
                ],
            },
        )

        entities = orchestrator._extract_collaboration_entities(response)

        assert "network_names" in entities
        assert "network_ids" in entities
        assert "Main Office" in entities["network_names"]
        assert "L_123" in entities["network_ids"]

    def test_extract_from_empty_response(self, orchestrator):
        """Test extraction from empty response."""
        response = AgentResponse(
            agent_id="test-agent",
            agent_name="Test",
            success=True,
            response="No data found",
            data={},
        )

        entities = orchestrator._extract_collaboration_entities(response)
        # Should not fail, just return empty or minimal entities
        assert isinstance(entities, dict)


class TestQueryEnrichment:
    """Tests for query enrichment with extracted entities."""

    @pytest.fixture
    def orchestrator(self):
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry'):
            return EnhancedOrchestrator()

    def test_enrich_splunk_query(self, orchestrator):
        """Test enriching query for Splunk agent."""
        entities = {
            "device_names": ["MX68", "MS120"],
            "device_serials": ["Q2AA-BBCC-DDEE"],
        }

        enriched = orchestrator._enrich_query_with_entities(
            "Search for events",
            entities,
            "splunk-agent"
        )

        assert "MX68" in enriched or "devices:" in enriched
        assert "Context from previous query" in enriched

    def test_enrich_meraki_query(self, orchestrator):
        """Test enriching query for Meraki agent."""
        entities = {
            "network_names": ["Main Office"],
            "network_ids": ["L_123"],
        }

        enriched = orchestrator._enrich_query_with_entities(
            "Show device status",
            entities,
            "meraki-agent"
        )

        assert "Main Office" in enriched or "networks:" in enriched

    def test_no_enrichment_without_entities(self, orchestrator):
        """Test that empty entities don't modify query."""
        original = "Show me devices"
        enriched = orchestrator._enrich_query_with_entities(
            original,
            {},
            "meraki-agent"
        )

        assert enriched == original


class TestCrossReferenceDetection:
    """Tests for cross-reference detection between agent responses."""

    @pytest.fixture
    def orchestrator(self):
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry'):
            return EnhancedOrchestrator()

    def test_find_matching_devices(self, orchestrator):
        """Test finding matching device names across agents."""
        entities_a = {
            "device_names": ["MX68", "MS120", "MR46"],
        }
        entities_b = {
            "device_names": ["MX68", "Switch-01"],  # MX68 matches
        }

        cross_ref = orchestrator._find_cross_references(
            entities_a, entities_b,
            "meraki-agent", "splunk-agent"
        )

        assert cross_ref is not None
        assert "meraki-agent" in cross_ref["agents"]
        assert "splunk-agent" in cross_ref["agents"]
        assert any(m["type"] == "device_names" for m in cross_ref["matches"])

    def test_no_cross_reference_when_no_match(self, orchestrator):
        """Test no cross-reference when entities don't match."""
        entities_a = {"device_names": ["MX68"]}
        entities_b = {"device_names": ["Switch-01"]}

        cross_ref = orchestrator._find_cross_references(
            entities_a, entities_b,
            "agent-a", "agent-b"
        )

        assert cross_ref is None

    def test_correlation_strength(self, orchestrator):
        """Test correlation strength calculation."""
        # Multiple matching types = strong correlation
        entities_a = {
            "device_names": ["MX68"],
            "network_names": ["Main Office"],
        }
        entities_b = {
            "device_names": ["MX68"],
            "network_names": ["Main Office"],
        }

        cross_ref = orchestrator._find_cross_references(
            entities_a, entities_b,
            "agent-a", "agent-b"
        )

        assert cross_ref is not None
        assert cross_ref["correlation_strength"] == "strong"


class TestCollaborativeSynthesis:
    """Tests for collaborative response synthesis."""

    @pytest.fixture
    def orchestrator(self):
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry'):
            return EnhancedOrchestrator()

    def test_synthesize_multiple_responses(self, orchestrator):
        """Test synthesizing responses from multiple agents."""
        primary = AgentResponse(
            agent_id="meraki-agent",
            agent_name="Meraki Network Specialist",
            success=True,
            response="Found 5 devices online.",
        )

        supporting = [
            AgentResponse(
                agent_id="splunk-agent",
                agent_name="Splunk Security Specialist",
                success=True,
                response="No security alerts in the last 24 hours.",
            ),
        ]

        synthesis = orchestrator._synthesize_collaborative_response(
            primary, supporting, {}, []
        )

        assert "Meraki" in synthesis
        assert "Splunk" in synthesis
        assert "5 devices" in synthesis
        assert "No security alerts" in synthesis

    def test_synthesize_with_cross_references(self, orchestrator):
        """Test synthesis includes cross-references."""
        primary = AgentResponse(
            agent_id="meraki-agent",
            agent_name="Meraki",
            success=True,
            response="Device MX68 is online.",
        )

        cross_refs = [{
            "agents": ["meraki-agent", "splunk-agent"],
            "matches": [{"type": "device_names", "matching_values": ["mx68"], "count": 1}],
            "correlation_strength": "moderate",
        }]

        synthesis = orchestrator._synthesize_collaborative_response(
            primary, [], {}, cross_refs
        )

        assert "Cross-Platform Correlations" in synthesis
        assert "device" in synthesis.lower()

    def test_synthesize_with_errors(self, orchestrator):
        """Test synthesis handles agent errors gracefully."""
        primary = AgentResponse(
            agent_id="meraki-agent",
            agent_name="Meraki",
            success=False,
            response="",
            error="API timeout",
        )

        synthesis = orchestrator._synthesize_collaborative_response(
            primary, [], {}, []
        )

        assert "Unable to complete" in synthesis or "timeout" in synthesis.lower()


class TestErrorRecovery:
    """Tests for agent failure recovery."""

    @pytest.fixture
    def orchestrator(self):
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry') as mock_reg:
            # Setup mock registry
            mock_reg.return_value.get_agent.return_value = MagicMock(
                id="splunk-agent", name="Splunk", skills=[]
            )
            return EnhancedOrchestrator()

    def test_recovery_map_exists(self, orchestrator):
        """Test that recovery map is defined for major agents."""
        assert "meraki-agent" in orchestrator.AGENT_RECOVERY_MAP
        assert "splunk-agent" in orchestrator.AGENT_RECOVERY_MAP
        assert "catalyst-agent" in orchestrator.AGENT_RECOVERY_MAP
        assert "thousandeyes-agent" in orchestrator.AGENT_RECOVERY_MAP

    def test_recovery_map_has_alternatives(self, orchestrator):
        """Test that each agent has recovery alternatives."""
        for agent_id, alternatives in orchestrator.AGENT_RECOVERY_MAP.items():
            assert len(alternatives) > 0
            for alt_agent, hint in alternatives:
                assert isinstance(alt_agent, str)
                assert isinstance(hint, str)

    @pytest.mark.asyncio
    async def test_handle_agent_failure_attempts_recovery(self, orchestrator, sample_execution_context):
        """Test that failure handling attempts recovery."""
        # Mock execute_agent to succeed on recovery agent
        async def mock_execute(agent_id, query, context, *args, **kwargs):
            if agent_id == "splunk-agent":
                return AgentResponse(
                    agent_id="splunk-agent",
                    agent_name="Splunk",
                    success=True,
                    response="Found related logs.",
                )
            return AgentResponse(
                agent_id=agent_id,
                agent_name=agent_id,
                success=False,
                response="",
                error="Failed",
            )

        orchestrator.execute_agent = mock_execute

        result = await orchestrator.handle_agent_failure(
            failed_agent="meraki-agent",
            query="Show devices",
            error="API timeout",
            context=sample_execution_context,
        )

        assert result is not None
        assert result.success is True
        assert "fallback" in result.response.lower()

    @pytest.mark.asyncio
    async def test_handle_agent_failure_returns_none_when_all_fail(self, orchestrator, sample_execution_context):
        """Test that failure handling returns None when all recovery fails."""
        # Mock all agents to fail
        async def mock_execute_fail(*args, **kwargs):
            return AgentResponse(
                agent_id="test",
                agent_name="Test",
                success=False,
                response="",
                error="Failed",
            )

        orchestrator.execute_agent = mock_execute_fail

        result = await orchestrator.handle_agent_failure(
            failed_agent="meraki-agent",
            query="Show devices",
            error="API timeout",
            context=sample_execution_context,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_handle_agent_failure_no_recovery_options(self, orchestrator, sample_execution_context):
        """Test handling failure for agent with no recovery options."""
        result = await orchestrator.handle_agent_failure(
            failed_agent="unknown-agent",  # Not in recovery map
            query="Test query",
            error="Error",
            context=sample_execution_context,
        )

        assert result is None


@pytest.mark.asyncio
class TestCollaborativeWorkflow:
    """Tests for full collaborative workflow execution."""

    @pytest.fixture
    def orchestrator(self):
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry') as mock_reg:
            mock_reg.return_value.get_agent.return_value = MagicMock(
                id="test-agent", name="Test Agent", skills=[]
            )
            return EnhancedOrchestrator()

    async def test_parallel_collaboration(self, orchestrator, sample_execution_context):
        """Test parallel collaborative workflow."""
        # Mock parallel_execute
        async def mock_parallel(agent_ids, query, context, callback=None):
            return [
                AgentResponse(
                    agent_id=agent_id,
                    agent_name=agent_id,
                    success=True,
                    response=f"Response from {agent_id}",
                )
                for agent_id in agent_ids
            ]

        orchestrator.parallel_execute = mock_parallel

        result = await orchestrator.execute_collaborative_workflow(
            query="Check all systems",
            primary_agent="meraki-agent",
            supporting_agents=["splunk-agent", "catalyst-agent"],
            context=sample_execution_context,
            collaboration_type="parallel",
        )

        assert isinstance(result, CollaborativeResult)
        assert result.primary_response is not None
        assert len(result.supporting_responses) == 2
        assert result.collaboration_type == "parallel"

    async def test_sequential_collaboration(self, orchestrator, sample_execution_context):
        """Test sequential collaborative workflow."""
        call_order = []

        async def mock_execute(agent_id, query, context, *args, **kwargs):
            call_order.append(agent_id)
            return AgentResponse(
                agent_id=agent_id,
                agent_name=agent_id,
                success=True,
                response=f"Response from {agent_id}",
                entities={"device_names": ["MX68"]} if agent_id == "meraki-agent" else {},
            )

        orchestrator.execute_agent = mock_execute

        result = await orchestrator.execute_collaborative_workflow(
            query="Correlate data",
            primary_agent="meraki-agent",
            supporting_agents=["splunk-agent"],
            context=sample_execution_context,
            collaboration_type="sequential",
        )

        assert result.collaboration_type == "sequential"
        # Primary should execute first
        assert call_order[0] == "meraki-agent"
        assert "splunk-agent" in call_order
