"""Unit tests for context enrichment in Claude service.

This module tests the context integration in ClaudeNetworkAssistant
including org type detection and entity extraction.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import sys
sys.path.insert(0, str(__file__).rsplit('/tests', 1)[0])

from src.services.session_context_store import (
    SessionContextStore,
    EntityType,
    OrgType,
    get_session_context_store,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def context_store():
    """Create a fresh SessionContextStore for testing."""
    return SessionContextStore()


@pytest.fixture
def sample_session_id():
    """Sample session ID."""
    return "test-session-enrichment"


@pytest.fixture
def mock_tool_result_networks():
    """Mock result from list_networks tool."""
    return {
        "success": True,
        "data": {
            "networks": [
                {"id": "L_123", "name": "Main Office", "productTypes": ["appliance", "switch"]},
                {"id": "L_456", "name": "Branch Office", "productTypes": ["wireless"]},
            ]
        }
    }


@pytest.fixture
def mock_tool_result_devices():
    """Mock result from list_devices tool."""
    return {
        "success": True,
        "data": {
            "devices": [
                {"serial": "Q2XX-1111-AAAA", "name": "MX68-Main", "model": "MX68"},
                {"serial": "Q3XX-2222-BBBB", "name": "MS120-Floor1", "model": "MS120-8"},
            ]
        }
    }


# ============================================================================
# Test Claude Service Context Integration
# ============================================================================

class TestClaudeServiceContextIntegration:
    """Context integration in ClaudeNetworkAssistant."""

    @pytest.mark.asyncio
    async def test_execute_tool_sets_org_context(self, context_store, sample_session_id):
        """First tool call should set org context in session."""
        # Simulate setting org context (as would happen in _execute_tool)
        await context_store.update_org_context(
            session_id=sample_session_id,
            org_id="org-123",
            org_name="Test Organization",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "test-key", "base_url": "https://api.meraki.com/api/v1"}
        )

        # Verify org context is set
        ctx = await context_store.get_or_create(sample_session_id)
        org_ctx = ctx.get_org_context(OrgType.MERAKI)

        assert org_ctx is not None
        assert org_ctx.org_id == "org-123"
        assert org_ctx.org_name == "Test Organization"

    @pytest.mark.asyncio
    async def test_execute_tool_uses_session_context(
        self, context_store, sample_session_id
    ):
        """Subsequent calls should use session org context."""
        # Setup org context (simulating first tool call)
        await context_store.update_org_context(
            session_id=sample_session_id,
            org_id="org-123",
            org_name="Test Organization",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "test-key"}
        )

        # Simulate second tool call - enrich input
        original_input = {"networkId": "L_123"}  # No organizationId
        enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="list_devices",
            tool_input=original_input
        )

        # Should have auto-filled organizationId
        assert "organizationId" in enriched
        assert enriched["organizationId"] == "org-123"

    @pytest.mark.asyncio
    async def test_entity_extraction_after_tool(
        self, context_store, sample_session_id, mock_tool_result_networks
    ):
        """Entities should be extracted after tool execution."""
        # Simulate entity extraction (as would happen after tool execution)
        count = await context_store.extract_entities_from_result(
            session_id=sample_session_id,
            tool_name="list_networks",
            result=mock_tool_result_networks
        )

        assert count == 2

        # Verify entities are available
        ctx = await context_store.get_or_create(sample_session_id)
        networks = ctx.get_all_entities(EntityType.NETWORK)

        assert len(networks) == 2
        network_names = [n.name for n in networks]
        assert "Main Office" in network_names
        assert "Branch Office" in network_names


# ============================================================================
# Test Org Type Detection
# ============================================================================

class TestOrgTypeDetection:
    """Org type detection from tool names."""

    def test_detect_meraki_tools(self, context_store):
        """Meraki tools should detect as MERAKI type."""
        meraki_tools = [
            "list_networks",
            "get_network",
            "list_devices",
            "get_device",
            "list_ssids",
            "get_ssid",
            "list_vlans",
            "get_vlan",
            "list_clients",
            "get_client",
            "meraki_get_organizations",
            "getOrganizationNetworks",
            "getNetworkDevices",
        ]

        for tool in meraki_tools:
            detected = context_store._detect_org_type_from_tool(tool)
            assert detected == OrgType.MERAKI, f"Tool '{tool}' should detect as MERAKI"

    def test_detect_splunk_tools(self, context_store):
        """Splunk tools should detect as SPLUNK type."""
        splunk_tools = [
            "splunk_search",
            "run_spl_query",
            "get_splunk_indexes",
            "search_splunk_events",
            "list_indexes",
        ]

        for tool in splunk_tools:
            detected = context_store._detect_org_type_from_tool(tool)
            assert detected == OrgType.SPLUNK, f"Tool '{tool}' should detect as SPLUNK"

    def test_detect_thousandeyes_tools(self, context_store):
        """ThousandEyes tools should detect correctly."""
        te_tools = [
            "thousandeyes_get_tests",
            "get_thousandeyes_agents",
            "get_test_results",
            "get_path_visualization",
            "list_agents",
        ]

        for tool in te_tools:
            detected = context_store._detect_org_type_from_tool(tool)
            assert detected == OrgType.THOUSANDEYES, f"Tool '{tool}' should detect as THOUSANDEYES"

    def test_detect_catalyst_tools(self, context_store):
        """Catalyst/DNAC tools should detect correctly."""
        catalyst_tools = [
            "catalyst_get_sites",
            "get_catalyst_devices",
            "dnac_get_issues",
            "get_site_health",
            "get_assurance_data",
        ]

        for tool in catalyst_tools:
            detected = context_store._detect_org_type_from_tool(tool)
            assert detected == OrgType.CATALYST, f"Tool '{tool}' should detect as CATALYST"

    def test_detect_unknown_tool(self, context_store):
        """Unknown tools should return None."""
        unknown_tools = [
            "unknown_operation",
            "custom_tool",
            "some_other_api",
        ]

        for tool in unknown_tools:
            detected = context_store._detect_org_type_from_tool(tool)
            assert detected is None, f"Tool '{tool}' should detect as None (unknown)"


# ============================================================================
# Test Multi-Turn Enrichment Flow
# ============================================================================

class TestMultiTurnEnrichmentFlow:
    """Test enrichment across multiple turns."""

    @pytest.mark.asyncio
    async def test_turn1_sets_context_turn2_uses_it(
        self, context_store, sample_session_id
    ):
        """Turn 1 should set context, Turn 2 should use it."""
        # Turn 1: Set org context and discover networks
        await context_store.update_org_context(
            session_id=sample_session_id,
            org_id="org-123",
            org_name="Test Organization",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "test-key"}
        )

        await context_store.extract_entities_from_result(
            session_id=sample_session_id,
            tool_name="list_networks",
            result={
                "data": {
                    "networks": [
                        {"id": "L_main", "name": "Main Office"},
                        {"id": "L_branch", "name": "Branch Office"},
                    ]
                }
            }
        )

        # Turn 2: Enrich with network name
        enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="list_devices",
            tool_input={"network_name": "Main Office"}
        )

        # Should have resolved network_name to networkId
        assert "networkId" in enriched
        assert enriched["networkId"] == "L_main"

        # Should have auto-filled organizationId
        assert "organizationId" in enriched
        assert enriched["organizationId"] == "org-123"

    @pytest.mark.asyncio
    async def test_turn1_devices_turn2_details(
        self, context_store, sample_session_id
    ):
        """Turn 1 lists devices, Turn 2 can get details by name."""
        # Turn 1: Discover devices
        await context_store.extract_entities_from_result(
            session_id=sample_session_id,
            tool_name="list_devices",
            result={
                "data": {
                    "devices": [
                        {"serial": "Q2XX-AAAA-BBBB", "name": "MX68-Main", "model": "MX68"},
                        {"serial": "Q3XX-CCCC-DDDD", "name": "MS120-Floor1", "model": "MS120-8"},
                    ]
                }
            }
        )

        # Turn 2: Get device details by name
        enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="get_device",
            tool_input={"device_name": "MX68-Main"}
        )

        # Should have resolved device_name to serial
        assert "serial" in enriched
        assert enriched["serial"] == "Q2XX-AAAA-BBBB"

    @pytest.mark.asyncio
    async def test_cross_org_type_session(self, context_store, sample_session_id):
        """Session should maintain context for multiple org types."""
        # Set Meraki context
        await context_store.update_org_context(
            session_id=sample_session_id,
            org_id="meraki-org",
            org_name="Meraki Org",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "meraki-key"}
        )

        # Set Splunk context
        await context_store.update_org_context(
            session_id=sample_session_id,
            org_id="splunk-org",
            org_name="Splunk Instance",
            org_type=OrgType.SPLUNK,
            credentials={"api_key": "splunk-token", "base_url": "https://splunk.test.com:8089"}
        )

        # Enrich Meraki tool - should use Meraki org
        meraki_enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="list_networks",
            tool_input={}
        )

        # Enrich Splunk tool - should use Splunk org
        splunk_enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="splunk_search",
            tool_input={}
        )

        # Verify correct org IDs are used
        assert meraki_enriched.get("organizationId") == "meraki-org"
        assert splunk_enriched.get("organizationId") == "splunk-org"


# ============================================================================
# Test Current Focus Handling
# ============================================================================

class TestCurrentFocusHandling:
    """Test current focus entity handling."""

    @pytest.mark.asyncio
    async def test_focus_set_and_used(self, context_store, sample_session_id):
        """Current focus should be set and used for enrichment."""
        # Set current focus to a network
        await context_store.set_current_focus(
            session_id=sample_session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_focused_network",
            display_name="Focused Network"
        )

        # Enrich a network tool without explicit networkId
        enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="list_vlans",
            tool_input={}
        )

        # Should use focused network
        assert "networkId" in enriched
        assert enriched["networkId"] == "L_focused_network"

    @pytest.mark.asyncio
    async def test_focus_not_used_when_explicit_provided(
        self, context_store, sample_session_id
    ):
        """Explicit networkId should override focus."""
        # Set current focus
        await context_store.set_current_focus(
            session_id=sample_session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_focused_network"
        )

        # Enrich with explicit networkId
        enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="list_vlans",
            tool_input={"networkId": "L_explicit_network"}
        )

        # Should use explicit value, not focus
        assert enriched["networkId"] == "L_explicit_network"


# ============================================================================
# Test Entity Resolution Edge Cases
# ============================================================================

class TestEntityResolutionEdgeCases:
    """Test edge cases in entity resolution."""

    @pytest.mark.asyncio
    async def test_case_insensitive_network_name(self, context_store, sample_session_id):
        """Network name resolution should be case-insensitive."""
        # Add network
        await context_store.add_discovered_entity(
            session_id=sample_session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_main",
            name="Main Office"
        )

        # Try different cases
        test_cases = ["Main Office", "main office", "MAIN OFFICE", "mAiN oFfIcE"]

        for name in test_cases:
            enriched = await context_store.enrich_tool_input(
                session_id=sample_session_id,
                tool_name="list_devices",
                tool_input={"network_name": name}
            )
            assert enriched.get("networkId") == "L_main", f"Failed for '{name}'"

    @pytest.mark.asyncio
    async def test_no_match_keeps_original(self, context_store, sample_session_id):
        """If no match found, original input should be preserved."""
        # Add a network
        await context_store.add_discovered_entity(
            session_id=sample_session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_existing",
            name="Existing Network"
        )

        # Try to resolve non-existent network
        enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="list_devices",
            tool_input={"network_name": "NonExistent Network"}
        )

        # Should keep network_name but not add networkId
        assert "network_name" in enriched
        assert enriched.get("networkId") is None

    @pytest.mark.asyncio
    async def test_empty_session_returns_original(self, context_store, sample_session_id):
        """Empty session should return original input unchanged."""
        original_input = {"networkId": "L_123", "custom_param": "value"}
        enriched = await context_store.enrich_tool_input(
            session_id=sample_session_id,
            tool_name="list_devices",
            tool_input=original_input
        )

        # Should be essentially unchanged
        assert enriched["networkId"] == "L_123"
        assert enriched["custom_param"] == "value"


# ============================================================================
# Test Enriched Tool Context
# ============================================================================

class TestEnrichedToolContext:
    """Test the get_enriched_tool_context method."""

    @pytest.mark.asyncio
    async def test_enriched_context_includes_org(
        self, context_store, sample_session_id
    ):
        """Enriched context should include org information."""
        await context_store.update_org_context(
            session_id=sample_session_id,
            org_id="org-123",
            org_name="Test Organization",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "test-key"}
        )

        enriched_ctx = await context_store.get_enriched_tool_context(
            session_id=sample_session_id,
            tool_name="list_networks"
        )

        assert enriched_ctx["has_org_context"] == True
        assert enriched_ctx["org_id"] == "org-123"
        assert enriched_ctx["org_name"] == "Test Organization"
        assert enriched_ctx["org_type"] == "meraki"

    @pytest.mark.asyncio
    async def test_enriched_context_includes_entities(
        self, context_store, sample_session_id
    ):
        """Enriched context should include discovered entities."""
        # Add entities
        await context_store.add_discovered_entity(
            session_id=sample_session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_1",
            name="Network 1"
        )
        await context_store.add_discovered_entity(
            session_id=sample_session_id,
            entity_type=EntityType.DEVICE,
            entity_id="SERIAL-1",
            name="Device 1",
            data={"model": "MX68"}
        )

        enriched_ctx = await context_store.get_enriched_tool_context(
            session_id=sample_session_id,
            tool_name="list_devices"
        )

        assert len(enriched_ctx["discovered_networks"]) == 1
        assert enriched_ctx["discovered_networks"][0]["id"] == "L_1"

        assert len(enriched_ctx["discovered_devices"]) == 1
        assert enriched_ctx["discovered_devices"][0]["serial"] == "SERIAL-1"

    @pytest.mark.asyncio
    async def test_enriched_context_includes_summary(
        self, context_store, sample_session_id
    ):
        """Enriched context should include context summary."""
        await context_store.update_org_context(
            session_id=sample_session_id,
            org_id="org-123",
            org_name="Test Organization",
            org_type=OrgType.MERAKI,
            credentials={}
        )

        enriched_ctx = await context_store.get_enriched_tool_context(
            session_id=sample_session_id,
            tool_name="list_networks"
        )

        assert "context_summary" in enriched_ctx
        assert "Test Organization" in enriched_ctx["context_summary"]
