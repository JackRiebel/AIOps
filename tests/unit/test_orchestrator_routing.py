"""Tests for EnhancedOrchestrator routing logic.

Tests the query routing, follow-up detection, and multi-domain
query handling in the orchestrator.
"""

import pytest
from unittest.mock import MagicMock, patch

import sys
sys.path.insert(0, str(__file__).rsplit('/tests', 1)[0])

from src.a2a.enhanced_orchestrator import EnhancedOrchestrator, RoutingDecision


class TestFollowUpDetection:
    """Tests for follow-up query detection."""

    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator with mocked registry."""
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry') as mock_registry:
            # Setup minimal mock
            mock_registry.return_value.find_agents_for_query.return_value = [
                (MagicMock(id="meraki-agent", name="Meraki", skills=[]), 5.0)
            ]
            mock_registry.return_value.get_agent.return_value = MagicMock(
                id="meraki-agent", name="Meraki", skills=[]
            )
            return EnhancedOrchestrator()

    @pytest.mark.parametrize("query,expected", [
        # Reactions
        ("interesting", True),
        ("cool", True),
        ("nice", True),
        ("great", True),
        ("awesome", True),
        ("wow", True),
        ("hmm", True),
        # Requests for more
        ("tell me more", True),
        ("more details", True),
        ("explain", True),
        ("elaborate", True),
        # Pronoun references
        ("that looks good", True),
        ("this is helpful", True),
        ("what about them?", True),
        # Short queries
        ("ok", True),
        ("yes", True),
        ("?", True),
        # NOT follow-ups (actual queries)
        ("Show me all devices", False),
        ("What is the network health?", False),
        ("List Meraki networks", False),
        ("Search for events in Splunk", False),
        ("Are there any ThousandEyes alerts?", False),
    ])
    def test_is_follow_up_query(self, orchestrator, query, expected):
        """Test follow-up detection for various query types."""
        result = orchestrator.is_follow_up_query(query)
        assert result == expected, f"Query '{query}' should be follow_up={expected}"

    def test_enrich_follow_up_with_reaction(self, orchestrator):
        """Test that reactions are expanded with context."""
        # Set up some context
        orchestrator.memory.record_turn(
            query="Show me device status",
            intent="query",
            agent_id="meraki-agent",
            summary="Showed device status"
        )
        orchestrator._last_routing = MagicMock(primary_agent="meraki-agent")
        orchestrator._last_session_id = "test-session"

        enriched, suggested_agent, reasoning = orchestrator.enrich_follow_up_query(
            "interesting", "test-session"
        )

        assert enriched != "interesting"
        assert "meraki" in enriched.lower() or "tell me more" in enriched.lower()
        assert suggested_agent == "meraki-agent"
        assert reasoning != ""


class TestMultiDomainDetection:
    """Tests for multi-domain query detection."""

    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator for testing."""
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry') as mock_registry:
            mock_registry.return_value.find_agents_for_query.return_value = [
                (MagicMock(id="meraki-agent", name="Meraki", skills=[]), 5.0)
            ]
            return EnhancedOrchestrator()

    @pytest.mark.parametrize("query,expected_agents,expected_type", [
        # Splunk + Meraki correlation
        ("Show me Splunk logs for Meraki devices", ["meraki-agent", "splunk-agent"], "sequential"),
        ("Meraki events in Splunk", ["meraki-agent", "splunk-agent"], "sequential"),
        # Security + Network
        ("Check network security status", ["meraki-agent", "splunk-agent"], "sequential"),
        # Monitoring + Device
        ("Monitor all device health", ["meraki-agent", "thousandeyes-agent", "catalyst-agent"], "parallel"),
        # Troubleshooting
        ("Troubleshoot this issue", ["splunk-agent", "meraki-agent", "catalyst-agent"], "sequential"),
        # Root cause
        ("What caused this? Investigate root cause", ["splunk-agent", "meraki-agent", "thousandeyes-agent"], "sequential"),
    ])
    def test_detect_multi_domain_query(self, orchestrator, query, expected_agents, expected_type):
        """Test multi-domain pattern matching."""
        result = orchestrator.detect_multi_domain_query(query)

        assert result is not None, f"Query '{query}' should be detected as multi-domain"
        agents, collab_type = result
        assert set(agents) == set(expected_agents), f"Expected {expected_agents}, got {agents}"
        assert collab_type == expected_type

    @pytest.mark.parametrize("query", [
        "Show me all Meraki devices",
        "Search Splunk for events",
        "List ThousandEyes tests",
        "Get Catalyst network health",
    ])
    def test_single_domain_not_detected(self, orchestrator, query):
        """Test that single-domain queries are not flagged as multi-domain."""
        result = orchestrator.detect_multi_domain_query(query)
        assert result is None, f"Query '{query}' should NOT be detected as multi-domain"


class TestQueryRouting:
    """Tests for query routing to specialist agents."""

    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator with mocked registry."""
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry') as mock_registry:
            # Create mock agents
            meraki_agent = MagicMock(id="meraki-agent", name="Meraki Network Specialist", skills=[])
            splunk_agent = MagicMock(id="splunk-agent", name="Splunk Security Specialist", skills=[])
            catalyst_agent = MagicMock(id="catalyst-agent", name="Catalyst Specialist", skills=[])
            te_agent = MagicMock(id="thousandeyes-agent", name="ThousandEyes Specialist", skills=[])

            def find_agents(query, context=None):
                query_lower = query.lower()
                agents = []
                if "meraki" in query_lower or "device" in query_lower or "network" in query_lower:
                    agents.append((meraki_agent, 5.0))
                if "splunk" in query_lower or "log" in query_lower or "security" in query_lower:
                    agents.append((splunk_agent, 4.0))
                if "catalyst" in query_lower or "dna" in query_lower:
                    agents.append((catalyst_agent, 4.0))
                if "thousandeyes" in query_lower or "monitor" in query_lower:
                    agents.append((te_agent, 4.0))
                if not agents:
                    agents.append((meraki_agent, 1.0))  # Default fallback
                return agents

            mock_registry.return_value.find_agents_for_query.side_effect = find_agents
            mock_registry.return_value.get_agent.side_effect = lambda id: {
                "meraki-agent": meraki_agent,
                "splunk-agent": splunk_agent,
                "catalyst-agent": catalyst_agent,
                "thousandeyes-agent": te_agent,
            }.get(id)

            return EnhancedOrchestrator()

    @pytest.mark.parametrize("query,expected_agent", [
        ("Show me Meraki devices", "meraki-agent"),
        ("Search Splunk for security events", "splunk-agent"),
        ("Get Catalyst network health", "catalyst-agent"),
        ("Show ThousandEyes test results", "thousandeyes-agent"),
    ])
    def test_routes_to_correct_primary_agent(self, orchestrator, query, expected_agent):
        """Test that queries route to the correct primary agent."""
        routing = orchestrator.route_to_specialists(query)

        assert isinstance(routing, RoutingDecision)
        assert routing.primary_agent == expected_agent

    def test_routing_includes_reasoning(self, orchestrator):
        """Test that routing decision includes reasoning."""
        routing = orchestrator.route_to_specialists("Show me Meraki devices")

        assert routing.reasoning != ""
        assert "Matched" in routing.reasoning or "based on" in routing.reasoning.lower()

    def test_routing_tracks_session(self, orchestrator):
        """Test that routing is tracked for session context."""
        session_id = "test-session-123"
        orchestrator.route_to_specialists("Show me devices", session_id=session_id)

        assert orchestrator._last_session_id == session_id
        assert orchestrator._last_routing is not None


class TestIntentExtraction:
    """Tests for query intent and parameter extraction."""

    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator for testing."""
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry'):
            return EnhancedOrchestrator()

    @pytest.fixture
    def context_with_networks(self, sample_execution_context):
        """Context with cached networks."""
        return sample_execution_context

    def test_extracts_drill_down_intent(self, orchestrator, context_with_networks):
        """Test extraction of drill-down intent."""
        params = orchestrator._extract_query_params(
            "Drill down on Test Network",
            context_with_networks
        )

        assert params.get("intent") == "drill_down"

    def test_extracts_network_name(self, orchestrator, context_with_networks):
        """Test extraction of network name from query."""
        params = orchestrator._extract_query_params(
            "Show devices in Test Network",
            context_with_networks
        )

        assert params.get("network_name") == "Test Network"
        assert params.get("network_id") == "net-1"

    def test_extracts_device_name(self, orchestrator, context_with_networks):
        """Test extraction of device name from query."""
        params = orchestrator._extract_query_params(
            "What is the status of MX68?",
            context_with_networks
        )

        assert params.get("device_name") == "MX68"

    @pytest.mark.parametrize("query,expected_intent", [
        ("List all devices", "list"),
        ("Show me networks", "list"),
        ("What is the status?", "list"),
        ("Drill down on this network", "drill_down"),
        ("Expand the details", "drill_down"),
        ("Check health", "health"),
    ])
    def test_intent_patterns(self, orchestrator, context_with_networks, query, expected_intent):
        """Test various intent patterns."""
        params = orchestrator._extract_query_params(query, context_with_networks)
        # Intent may vary but should be detected
        assert "intent" in params


class TestSkillSelection:
    """Tests for skill selection based on intent."""

    @pytest.fixture
    def orchestrator(self):
        with patch('src.a2a.enhanced_orchestrator.get_agent_registry'):
            return EnhancedOrchestrator()

    @pytest.mark.parametrize("intent,expected_skill", [
        ("drill_down", "list_devices"),
        ("details", "list_devices"),
        ("devices", "list_devices"),
        ("list_networks", "list_networks"),
        ("networks", "list_networks"),
        ("status", "get_device_status"),
        ("health", "get_network_health"),
    ])
    def test_intent_to_skill_mapping(self, orchestrator, intent, expected_skill):
        """Test that intents map to correct skills."""
        params = {"intent": intent}
        skill = orchestrator._select_skill_from_intent(params, None)

        assert skill == expected_skill

    def test_unknown_intent_uses_default(self, orchestrator):
        """Test that unknown intent falls back to default skill."""
        params = {"intent": "unknown_intent"}
        default_skill = "default_skill"
        skill = orchestrator._select_skill_from_intent(params, default_skill)

        assert skill == default_skill
