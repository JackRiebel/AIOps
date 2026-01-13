"""Integration tests for multi-turn context persistence.

This module tests the core problem fixes:
- "Org not found" errors
- Entity amnesia (losing discovered networks/devices across turns)
- Incomplete context in tool calls
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import sys
sys.path.insert(0, str(__file__).rsplit('/tests', 1)[0])

from src.services.session_context_store import (
    SessionContextStore,
    SessionContext,
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
def session_id():
    """Unique session ID for each test."""
    return f"test-session-{datetime.utcnow().timestamp()}"


@pytest.fixture
def meraki_org_context():
    """Sample Meraki organization context."""
    return {
        "org_id": "org-meraki-123",
        "org_name": "Riebel Networks",
        "org_type": OrgType.MERAKI,
        "credentials": {
            "api_key": "test-meraki-api-key",
            "base_url": "https://api.meraki.com/api/v1"
        }
    }


@pytest.fixture
def splunk_org_context():
    """Sample Splunk organization context."""
    return {
        "org_id": "splunk-instance-456",
        "org_name": "Splunk SIEM",
        "org_type": OrgType.SPLUNK,
        "credentials": {
            "api_key": "test-splunk-token",
            "base_url": "https://splunk.riebel.com:8089"
        }
    }


@pytest.fixture
def sample_networks():
    """Sample network data."""
    return {
        "data": {
            "networks": [
                {
                    "id": "L_riebel_home",
                    "name": "Riebel Home",
                    "productTypes": ["appliance", "wireless"],
                    "timeZone": "America/Los_Angeles"
                },
                {
                    "id": "L_main_office",
                    "name": "Main Office",
                    "productTypes": ["appliance", "switch", "wireless"],
                    "timeZone": "America/New_York"
                },
                {
                    "id": "L_branch",
                    "name": "Branch Office",
                    "productTypes": ["appliance"],
                    "timeZone": "America/Chicago"
                },
            ]
        }
    }


@pytest.fixture
def sample_devices():
    """Sample device data."""
    return {
        "data": {
            "devices": [
                {
                    "serial": "Q2XX-AAAA-1111",
                    "name": "MX68-Home",
                    "model": "MX68",
                    "networkId": "L_riebel_home",
                    "lanIp": "192.168.1.1"
                },
                {
                    "serial": "Q4XX-BBBB-2222",
                    "name": "MR46-Living",
                    "model": "MR46",
                    "networkId": "L_riebel_home",
                    "lanIp": "192.168.1.10"
                },
                {
                    "serial": "Q3XX-CCCC-3333",
                    "name": "MS120-Basement",
                    "model": "MS120-8LP",
                    "networkId": "L_riebel_home",
                    "lanIp": "192.168.1.20"
                },
            ]
        }
    }


@pytest.fixture
def sample_vlans():
    """Sample VLAN data."""
    return {
        "data": {
            "vlans": [
                {"id": 1, "name": "Default", "subnet": "192.168.1.0/24"},
                {"id": 10, "name": "Guest", "subnet": "192.168.10.0/24"},
                {"id": 20, "name": "IoT", "subnet": "192.168.20.0/24"},
                {"id": 100, "name": "Management", "subnet": "192.168.100.0/24"},
            ]
        }
    }


# ============================================================================
# Test Org Context Persistence
# ============================================================================

class TestOrgContextPersistence:
    """Verify org context persists across turns (fixes 'org not found')."""

    @pytest.mark.asyncio
    async def test_org_available_after_list_networks(
        self, context_store, session_id, meraki_org_context, sample_networks
    ):
        """After listing networks, org should be available for next call."""
        # ===== TURN 1: List networks (sets org context) =====
        await context_store.update_org_context(
            session_id=session_id,
            **meraki_org_context
        )

        # Simulate extracting entities from result
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_networks",
            result=sample_networks
        )

        # ===== TURN 2: Get devices (should have org context) =====
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_devices",
            tool_input={"networkId": "L_riebel_home"}  # No organizationId provided
        )

        # Org ID should be auto-filled
        assert "organizationId" in enriched
        assert enriched["organizationId"] == "org-meraki-123"

    @pytest.mark.asyncio
    async def test_org_available_without_explicit_param(
        self, context_store, session_id, meraki_org_context
    ):
        """Tool should work without explicit organizationId."""
        # Set org via credential lookup (simulating Turn 1)
        await context_store.update_org_context(
            session_id=session_id,
            **meraki_org_context
        )

        # Turn 2: Call tool without org
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="get_organization_devices",
            tool_input={}  # Completely empty input
        )

        # Should use session org
        assert enriched.get("organizationId") == "org-meraki-123"

    @pytest.mark.asyncio
    async def test_multi_org_session(
        self, context_store, session_id, meraki_org_context, splunk_org_context
    ):
        """Session can switch between multiple orgs."""
        # ===== TURN 1: Query Meraki org =====
        await context_store.update_org_context(
            session_id=session_id,
            **meraki_org_context
        )

        # ===== TURN 2: Query Splunk org =====
        await context_store.update_org_context(
            session_id=session_id,
            **splunk_org_context
        )

        # ===== TURN 3: Query back to Meraki =====
        ctx = await context_store.get_or_create(session_id)

        # Both orgs should be available
        meraki_ctx = ctx.get_org_context(OrgType.MERAKI)
        splunk_ctx = ctx.get_org_context(OrgType.SPLUNK)

        assert meraki_ctx is not None
        assert meraki_ctx.org_id == "org-meraki-123"

        assert splunk_ctx is not None
        assert splunk_ctx.org_id == "splunk-instance-456"

        # Enrichment should use correct org for each tool type
        meraki_enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_networks",
            tool_input={}
        )
        assert meraki_enriched.get("organizationId") == "org-meraki-123"

        splunk_enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="splunk_search",
            tool_input={}
        )
        assert splunk_enriched.get("organizationId") == "splunk-instance-456"


# ============================================================================
# Test Entity Amnesia Prevention
# ============================================================================

class TestEntityAmnesiaPrevention:
    """Verify entities persist (fixes 'cannot get device details')."""

    @pytest.mark.asyncio
    async def test_networks_available_in_turn_2(
        self, context_store, session_id, sample_networks
    ):
        """Networks discovered in turn 1 available in turn 2."""
        # ===== TURN 1: list_networks() discovers networks =====
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_networks",
            result=sample_networks
        )

        # ===== TURN 2: "Show me devices in the Riebel Home network" =====
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_devices",
            tool_input={"network_name": "Riebel Home"}
        )

        # Should resolve "Riebel Home" to network ID
        assert "networkId" in enriched
        assert enriched["networkId"] == "L_riebel_home"

    @pytest.mark.asyncio
    async def test_devices_available_for_details(
        self, context_store, session_id, sample_devices
    ):
        """Devices from list available for get_device_details."""
        # ===== TURN 1: list_devices() shows devices =====
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result=sample_devices
        )

        # ===== TURN 2: "Tell me more about the MX68" =====
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="get_device",
            tool_input={"device_name": "MX68-Home"}
        )

        # Should resolve to device serial
        assert "serial" in enriched
        assert enriched["serial"] == "Q2XX-AAAA-1111"

    @pytest.mark.asyncio
    async def test_vlan_context_persists(
        self, context_store, session_id, sample_vlans
    ):
        """VLANs discovered remain available."""
        # ===== TURN 1: Discover VLANs =====
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_vlans",
            result=sample_vlans
        )

        # ===== TURN 2: Query about specific VLAN =====
        ctx = await context_store.get_or_create(session_id)
        vlans = ctx.get_all_entities(EntityType.VLAN)

        assert len(vlans) == 4

        # Should find Guest VLAN
        guest_vlan = ctx.get_entity_by_name(EntityType.VLAN, "Guest")
        assert guest_vlan is not None
        assert guest_vlan.data.get("subnet") == "192.168.10.0/24"

    @pytest.mark.asyncio
    async def test_ssid_context_persists(self, context_store, session_id):
        """SSIDs discovered remain available."""
        # ===== TURN 1: Discover SSIDs =====
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_ssids",
            result={
                "data": {
                    "ssids": [
                        {"number": 0, "name": "Riebel-WiFi", "enabled": True},
                        {"number": 1, "name": "Riebel-Guest", "enabled": True},
                        {"number": 2, "name": "Riebel-IoT", "enabled": True},
                    ]
                }
            }
        )

        # ===== TURN 2: Query about SSIDs =====
        ctx = await context_store.get_or_create(session_id)
        ssids = ctx.get_all_entities(EntityType.SSID)

        assert len(ssids) == 3

        # Should find specific SSID
        guest_ssid = ctx.get_entity_by_name(EntityType.SSID, "Riebel-Guest")
        assert guest_ssid is not None
        assert guest_ssid.data.get("enabled") == True


# ============================================================================
# Test Follow-Up Queries
# ============================================================================

class TestFollowUpQueries:
    """Follow-up query handling with context."""

    @pytest.mark.asyncio
    async def test_pronoun_resolution_via_focus(
        self, context_store, session_id, sample_devices
    ):
        """'those devices' should use previous context via focus."""
        # ===== TURN 1: "Show me devices in Main Office" =====
        await context_store.set_current_focus(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_main_office",
            display_name="Main Office"
        )

        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result=sample_devices
        )

        # ===== TURN 2: "Tell me more about those devices" =====
        ctx = await context_store.get_or_create(session_id)

        # Should have focus on network
        assert ctx.current_focus == "network:Main Office"

        # Devices should be available from previous turn
        devices = ctx.get_all_entities(EntityType.DEVICE)
        assert len(devices) == 3

    @pytest.mark.asyncio
    async def test_implicit_network_reference(
        self, context_store, session_id
    ):
        """'the network' should use current focus."""
        # ===== TURN 1: Query about specific network =====
        await context_store.set_current_focus(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_riebel_home",
            display_name="Riebel Home"
        )

        # ===== TURN 2: "What VLANs are in the network?" =====
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_vlans",
            tool_input={}  # No explicit network
        )

        # Should use focused network
        assert enriched.get("networkId") == "L_riebel_home"

    @pytest.mark.asyncio
    async def test_expansion_requests_have_context(
        self, context_store, session_id, meraki_org_context, sample_networks
    ):
        """'tell me more' should have full context."""
        # Setup full context
        await context_store.update_org_context(
            session_id=session_id,
            **meraki_org_context
        )

        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_networks",
            result=sample_networks
        )

        await context_store.set_current_focus(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_riebel_home",
            display_name="Riebel Home"
        )

        # Get enriched context for follow-up
        enriched_ctx = await context_store.get_enriched_tool_context(
            session_id=session_id,
            tool_name="get_network_details"
        )

        # Should have org context
        assert enriched_ctx["has_org_context"] == True
        assert enriched_ctx["org_id"] == "org-meraki-123"

        # Should have discovered networks
        assert len(enriched_ctx["discovered_networks"]) == 3

        # Should have current focus
        assert enriched_ctx["current_focus"] == "network:Riebel Home"


# ============================================================================
# Test Full Multi-Turn Scenario
# ============================================================================

class TestFullMultiTurnScenario:
    """Test complete multi-turn conversation scenarios."""

    @pytest.mark.asyncio
    async def test_network_discovery_to_device_details(
        self, context_store, session_id, meraki_org_context, sample_networks, sample_devices
    ):
        """
        Full scenario: Network Discovery -> Device Details

        Turn 1: "List all my networks"
        Turn 2: "Show devices in Main Office"
        Turn 3: "Tell me about the MX68"
        """
        # ===== TURN 1: List networks =====
        await context_store.update_org_context(
            session_id=session_id,
            **meraki_org_context
        )

        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_networks",
            result=sample_networks
        )

        await context_store.add_compressed_result(
            session_id=session_id,
            tool_name="list_networks",
            success=True,
            result=sample_networks
        )

        # Verify Turn 1 state
        ctx = await context_store.get_or_create(session_id)
        assert ctx.total_entities_discovered == 3
        assert len(ctx.get_all_entities(EntityType.NETWORK)) == 3

        # ===== TURN 2: Show devices in Main Office =====
        enriched_t2 = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_devices",
            tool_input={"network_name": "Main Office"}
        )

        # Should resolve network name
        assert enriched_t2.get("networkId") == "L_main_office"
        assert enriched_t2.get("organizationId") == "org-meraki-123"

        # Set focus to Main Office
        await context_store.set_current_focus(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_main_office",
            display_name="Main Office"
        )

        # Simulate device discovery
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result=sample_devices
        )

        # Verify Turn 2 state
        ctx = await context_store.get_or_create(session_id)
        assert len(ctx.get_all_entities(EntityType.DEVICE)) == 3

        # ===== TURN 3: Tell me about the MX68 =====
        enriched_t3 = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="get_device",
            tool_input={"device_name": "MX68-Home"}
        )

        # Should resolve device name to serial
        assert enriched_t3.get("serial") == "Q2XX-AAAA-1111"

        # Should still have org context
        assert enriched_t3.get("organizationId") == "org-meraki-123"

    @pytest.mark.asyncio
    async def test_cross_platform_correlation(
        self, context_store, session_id, meraki_org_context, splunk_org_context, sample_devices
    ):
        """
        Cross-Platform Correlation scenario:

        Turn 1: "Show my Meraki devices"
        Turn 2: "Find Splunk logs for these devices"
        """
        # ===== TURN 1: Show Meraki devices =====
        await context_store.update_org_context(
            session_id=session_id,
            **meraki_org_context
        )

        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result=sample_devices
        )

        # ===== TURN 2: Query Splunk for these devices =====
        await context_store.update_org_context(
            session_id=session_id,
            **splunk_org_context
        )

        # Get context for Splunk query
        ctx = await context_store.get_or_create(session_id)

        # Devices discovered in Meraki query should still be available
        devices = ctx.get_all_entities(EntityType.DEVICE)
        assert len(devices) == 3

        # Get device serials for Splunk query
        device_serials = [d.id for d in devices]
        assert "Q2XX-AAAA-1111" in device_serials

        # Enrich Splunk tool - should use Splunk org
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="splunk_search",
            tool_input={"query": f"device_serial IN ({', '.join(device_serials)})"}
        )

        assert enriched.get("organizationId") == "splunk-instance-456"


# ============================================================================
# Test Context Summary for Prompts
# ============================================================================

class TestContextSummaryForPrompts:
    """Test context summary generation for AI prompts."""

    @pytest.mark.asyncio
    async def test_summary_includes_all_context(
        self, context_store, session_id, meraki_org_context, sample_networks, sample_devices
    ):
        """Summary should include all relevant context."""
        # Setup full context
        await context_store.update_org_context(
            session_id=session_id,
            **meraki_org_context
        )

        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_networks",
            result=sample_networks
        )

        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result=sample_devices
        )

        await context_store.add_compressed_result(
            session_id=session_id,
            tool_name="list_networks",
            success=True,
            result=sample_networks
        )

        await context_store.set_current_focus(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_riebel_home",
            display_name="Riebel Home"
        )

        # Get summary
        summary = await context_store.get_context_for_prompt(session_id)

        # Should include org
        assert "Riebel Networks" in summary

        # Should include current focus
        assert "Riebel Home" in summary

        # Should include entity counts
        assert "network" in summary.lower()
        assert "device" in summary.lower()

        # Should include recent operations
        assert "list_networks" in summary
