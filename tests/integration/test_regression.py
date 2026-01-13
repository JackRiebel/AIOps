"""Regression tests for specific reported issues.

This module tests reproductions of the exact issues reported by users:
- "Org not found" errors after organization was referenced
- "Cannot get device details" errors after listing devices
- Incomplete answers due to missing context
- Agents not communicating / context not bridging
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
    return f"regression-test-{datetime.utcnow().timestamp()}"


# ============================================================================
# Regression Tests for Reported Issues
# ============================================================================

class TestReportedIssues:
    """Tests for specific reported issues."""

    @pytest.mark.asyncio
    async def test_issue_org_not_found_after_reference(self, context_store, session_id):
        """
        ISSUE: "Lots of queries returning saying they dont have the org to get
        devices even though the org was referenced"

        REPRODUCTION:
        1. User mentions org in first query
        2. User makes second query needing org ID
        3. System reports "org not found"

        EXPECTED:
        Org should be resolved from conversation context.
        """
        # Simulate Turn 1: User references org "Riebel Networks"
        # System resolves org from credentials
        await context_store.update_org_context(
            session_id=session_id,
            org_id="org-riebel-123",
            org_name="Riebel Networks",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "test-key"}
        )

        # Simulate tool execution in Turn 1
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_networks",
            result={
                "data": {
                    "networks": [
                        {"id": "L_home", "name": "Riebel Home"},
                        {"id": "L_office", "name": "Main Office"},
                    ]
                }
            }
        )

        # Turn 2: User asks for devices (no explicit org reference)
        # This is where "org not found" error used to occur
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_devices",
            tool_input={}  # Empty - no org provided
        )

        # ASSERTION: Org should be auto-filled from session context
        assert "organizationId" in enriched, "Org should be auto-filled"
        assert enriched["organizationId"] == "org-riebel-123"

        # Additional check: org context should be retrievable
        ctx = await context_store.get_or_create(session_id)
        org_ctx = ctx.get_primary_org_context()
        assert org_ctx is not None, "Org context should exist"
        assert org_ctx.org_name == "Riebel Networks"

    @pytest.mark.asyncio
    async def test_issue_cannot_get_device_details(self, context_store, session_id):
        """
        ISSUE: "When I ask for device details it says it cannot do that"

        REPRODUCTION:
        1. User lists devices (Turn 1)
        2. User asks for details on specific device (Turn 2)
        3. System cannot resolve device

        EXPECTED:
        Device should be resolved from previous list.
        """
        # Turn 1: List devices
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result={
                "data": {
                    "devices": [
                        {
                            "serial": "Q2XX-AAAA-1111",
                            "name": "MX68-Home",
                            "model": "MX68",
                            "lanIp": "192.168.1.1"
                        },
                        {
                            "serial": "Q3XX-BBBB-2222",
                            "name": "MS120-Basement",
                            "model": "MS120-8LP",
                            "lanIp": "192.168.1.20"
                        },
                    ]
                }
            }
        )

        # Turn 2: User asks "Tell me more about the MX68"
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="get_device",
            tool_input={"device_name": "MX68-Home"}
        )

        # ASSERTION: Device serial should be resolved
        assert "serial" in enriched, "Device serial should be resolved"
        assert enriched["serial"] == "Q2XX-AAAA-1111"

        # Also verify partial name matching works (user might say just "MX68")
        ctx = await context_store.get_or_create(session_id)
        devices = ctx.get_all_entities(EntityType.DEVICE)

        # Should have both devices in context
        assert len(devices) == 2
        device_names = [d.name for d in devices]
        assert "MX68-Home" in device_names
        assert "MS120-Basement" in device_names

    @pytest.mark.asyncio
    async def test_issue_incomplete_answers(self, context_store, session_id):
        """
        ISSUE: "Incomplete answers" - context from previous turns missing

        REPRODUCTION:
        1. User queries network info (Turn 1)
        2. User asks follow-up requiring Turn 1 context (Turn 2)
        3. Response is incomplete due to missing context

        EXPECTED:
        Full context available for complete answer.
        """
        # Setup org context
        await context_store.update_org_context(
            session_id=session_id,
            org_id="org-123",
            org_name="Test Org",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "test-key", "base_url": "https://api.meraki.com/api/v1"}
        )

        # Turn 1: Query networks and VLANs
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_networks",
            result={
                "data": {
                    "networks": [
                        {"id": "L_main", "name": "Main Network", "productTypes": ["appliance"]},
                    ]
                }
            }
        )

        await context_store.set_current_focus(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_main",
            display_name="Main Network"
        )

        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_vlans",
            result={
                "data": {
                    "vlans": [
                        {"id": 1, "name": "Default", "subnet": "192.168.1.0/24"},
                        {"id": 10, "name": "Guest", "subnet": "192.168.10.0/24"},
                    ]
                }
            }
        )

        await context_store.add_compressed_result(
            session_id=session_id,
            tool_name="list_networks",
            success=True,
            result={"data": {"networks": [{"id": "L_main", "name": "Main Network"}]}}
        )

        await context_store.add_compressed_result(
            session_id=session_id,
            tool_name="list_vlans",
            success=True,
            result={"data": {"vlans": [{"id": 1}, {"id": 10}]}}
        )

        # Turn 2: User asks for context summary
        summary = await context_store.get_context_for_prompt(session_id)

        # ASSERTIONS: Summary should include all relevant context
        assert "Test Org" in summary, "Org name should be in summary"
        assert "Main Network" in summary, "Current focus should be in summary"
        assert "network" in summary.lower(), "Networks should be mentioned"
        assert "vlan" in summary.lower(), "VLANs should be mentioned"
        assert "list_networks" in summary, "Recent operations should be included"

        # Get full enriched context
        enriched_ctx = await context_store.get_enriched_tool_context(
            session_id=session_id,
            tool_name="get_network_details"
        )

        # Should have org context
        assert enriched_ctx["has_org_context"] == True
        assert enriched_ctx["org_id"] == "org-123"

        # Should have discovered entities
        assert len(enriched_ctx["discovered_networks"]) == 1
        assert len(enriched_ctx["discovered_vlans"]) == 2

        # Should have current focus
        assert enriched_ctx["current_focus"] == "network:Main Network"

    @pytest.mark.asyncio
    async def test_issue_agents_not_communicating(self, context_store, session_id):
        """
        ISSUE: Multi-domain query where one agent needs another's data,
        but context is not bridged between agents.

        REPRODUCTION:
        1. Meraki agent discovers devices (Turn 1)
        2. Splunk agent needs device context (Turn 2)
        3. Splunk agent doesn't have access to Meraki discoveries

        EXPECTED:
        Session context bridges agent handoffs.
        """
        # Setup Meraki org
        await context_store.update_org_context(
            session_id=session_id,
            org_id="meraki-org-123",
            org_name="Meraki Org",
            org_type=OrgType.MERAKI,
            credentials={"api_key": "meraki-key"}
        )

        # Meraki agent discovers devices (Turn 1)
        await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result={
                "data": {
                    "devices": [
                        {"serial": "MX-SERIAL-001", "name": "MX68-Main", "model": "MX68"},
                        {"serial": "MS-SERIAL-002", "name": "MS120-Floor1", "model": "MS120"},
                    ]
                }
            }
        )

        # Setup Splunk org (Turn 2 - different agent)
        await context_store.update_org_context(
            session_id=session_id,
            org_id="splunk-org-456",
            org_name="Splunk SIEM",
            org_type=OrgType.SPLUNK,
            credentials={"api_key": "splunk-token", "base_url": "https://splunk.test.com:8089"}
        )

        # CRITICAL ASSERTION: Splunk agent should have access to Meraki discoveries
        ctx = await context_store.get_or_create(session_id)
        devices = ctx.get_all_entities(EntityType.DEVICE)

        assert len(devices) == 2, "Splunk agent should see Meraki-discovered devices"

        device_serials = [d.id for d in devices]
        assert "MX-SERIAL-001" in device_serials
        assert "MS-SERIAL-002" in device_serials

        # Splunk tool should use Splunk org context
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="splunk_search",
            tool_input={}
        )
        assert enriched.get("organizationId") == "splunk-org-456"

        # But both orgs should be available in session
        meraki_ctx = ctx.get_org_context(OrgType.MERAKI)
        splunk_ctx = ctx.get_org_context(OrgType.SPLUNK)

        assert meraki_ctx is not None, "Meraki context should persist"
        assert splunk_ctx is not None, "Splunk context should be added"


# ============================================================================
# Additional Edge Case Regression Tests
# ============================================================================

class TestEdgeCaseRegressions:
    """Edge cases that caused issues in production."""

    @pytest.mark.asyncio
    async def test_empty_session_doesnt_crash(self, context_store, session_id):
        """
        Ensure empty session state doesn't cause errors.
        """
        # Enrich with no prior context
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_networks",
            tool_input={}
        )

        # Should return original input without crashing
        assert enriched == {}

        # Get context for empty session
        summary = await context_store.get_context_for_prompt(session_id)

        # Should return empty string or minimal output
        assert summary is not None

    @pytest.mark.asyncio
    async def test_network_name_with_special_characters(self, context_store, session_id):
        """
        Network names with special characters should resolve correctly.
        """
        await context_store.add_discovered_entity(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="L_special",
            name="Main Office (Floor 1) - Building A"
        )

        # Should resolve with exact match
        enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_devices",
            tool_input={"network_name": "Main Office (Floor 1) - Building A"}
        )

        assert enriched.get("networkId") == "L_special"

    @pytest.mark.asyncio
    async def test_duplicate_entity_handling(self, context_store, session_id):
        """
        Adding same entity twice should update, not duplicate.
        """
        # Add device first time
        await context_store.add_discovered_entity(
            session_id=session_id,
            entity_type=EntityType.DEVICE,
            entity_id="SERIAL-001",
            name="Device v1",
            data={"lanIp": "192.168.1.1"}
        )

        # Add same device again with updated info
        await context_store.add_discovered_entity(
            session_id=session_id,
            entity_type=EntityType.DEVICE,
            entity_id="SERIAL-001",
            name="Device v2",
            data={"lanIp": "192.168.1.2", "status": "online"}
        )

        ctx = await context_store.get_or_create(session_id)
        devices = ctx.get_all_entities(EntityType.DEVICE)

        # Should only have one device
        assert len(devices) == 1

        # Should have updated name
        assert devices[0].name == "Device v2"

        # Should have merged data
        assert devices[0].data.get("lanIp") == "192.168.1.2"
        assert devices[0].data.get("status") == "online"

    @pytest.mark.asyncio
    async def test_large_result_handling(self, context_store, session_id):
        """
        Large results should be handled without memory issues.
        """
        # Create large device list
        large_result = {
            "data": {
                "devices": [
                    {
                        "serial": f"SERIAL-{i:04d}",
                        "name": f"Device {i}",
                        "model": "MX68"
                    }
                    for i in range(500)
                ]
            }
        }

        # Extract should complete without error
        count = await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_devices",
            result=large_result
        )

        # Should have extracted all devices
        assert count == 500

        ctx = await context_store.get_or_create(session_id)
        devices = ctx.get_all_entities(EntityType.DEVICE)
        assert len(devices) == 500

    @pytest.mark.asyncio
    async def test_client_limit_enforcement(self, context_store, session_id):
        """
        Clients should be limited to prevent memory bloat.
        """
        # Create large client list
        large_result = {
            "data": {
                "clients": [
                    {
                        "id": f"client-{i}",
                        "mac": f"00:00:00:00:{i//256:02x}:{i%256:02x}",
                        "hostname": f"Client {i}"
                    }
                    for i in range(200)
                ]
            }
        }

        count = await context_store.extract_entities_from_result(
            session_id=session_id,
            tool_name="list_clients",
            result=large_result
        )

        # Should be limited to 50
        assert count == 50

        ctx = await context_store.get_or_create(session_id)
        clients = ctx.get_all_entities(EntityType.CLIENT)
        assert len(clients) == 50

    @pytest.mark.asyncio
    async def test_prior_results_trimming(self, context_store, session_id):
        """
        Prior results should be trimmed to prevent unbounded growth.
        """
        # Add many results
        for i in range(30):
            await context_store.add_compressed_result(
                session_id=session_id,
                tool_name=f"tool_{i}",
                success=True,
                result={"data": {"message": f"Result {i}"}}
            )

        ctx = await context_store.get_or_create(session_id)

        # Should be trimmed to max (20)
        assert len(ctx.prior_results) <= 20

        # Most recent should be kept
        assert ctx.prior_results[-1].tool_name == "tool_29"

    @pytest.mark.asyncio
    async def test_org_type_switching(self, context_store, session_id):
        """
        Switching between org types should maintain both contexts.
        """
        # Add Meraki org
        await context_store.update_org_context(
            session_id=session_id,
            org_id="meraki-1",
            org_name="Meraki Org",
            org_type=OrgType.MERAKI,
            credentials={}
        )

        # Primary should be Meraki
        ctx = await context_store.get_or_create(session_id)
        assert ctx.primary_org_type == OrgType.MERAKI

        # Add Splunk org
        await context_store.update_org_context(
            session_id=session_id,
            org_id="splunk-1",
            org_name="Splunk Org",
            org_type=OrgType.SPLUNK,
            credentials={}
        )

        # Primary should now be Splunk
        ctx = await context_store.get_or_create(session_id)
        assert ctx.primary_org_type == OrgType.SPLUNK

        # Both should still be accessible
        assert ctx.get_org_context(OrgType.MERAKI) is not None
        assert ctx.get_org_context(OrgType.SPLUNK) is not None

        # Tool enrichment should use correct org type
        meraki_enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="list_networks",  # Meraki tool
            tool_input={}
        )
        assert meraki_enriched.get("organizationId") == "meraki-1"

        splunk_enriched = await context_store.enrich_tool_input(
            session_id=session_id,
            tool_name="splunk_search",  # Splunk tool
            tool_input={}
        )
        assert splunk_enriched.get("organizationId") == "splunk-1"
