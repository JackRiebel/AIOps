"""
Meraki Appliance Tools

Provides tools for managing MX security appliances including:
- VLANs and DHCP settings
- Firewall rules (L3, L7, inbound, cellular)
- NAT rules (1:1, 1:many, port forwarding)
- VPN configuration (site-to-site, BGP, third-party)
- Traffic shaping and SD-WAN
- Security features (intrusion detection, malware, content filtering)
- Uplink management and warm spare failover

All paths follow the official Meraki Dashboard API v1 specification.
Total tools: 72
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)


def _validate_context(context: Any) -> Dict:
    """Validate that context has a Meraki client configured."""
    if not hasattr(context, 'client') or context.client is None:
        return {
            "success": False,
            "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
        }
    return None


# =============================================================================
# VLAN HANDLERS (7 tools)
# =============================================================================

async def handle_appliance_list_vlans(params: Dict, context: Any) -> Dict:
    """List VLANs for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vlans"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_vlan(params: Dict, context: Any) -> Dict:
    """Get a specific VLAN."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        vlan_id = params.get("vlan_id")
        if not network_id or not vlan_id:
            return {"success": False, "error": "network_id and vlan_id are required"}

        path = f"/networks/{network_id}/appliance/vlans/{vlan_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_create_vlan(params: Dict, context: Any) -> Dict:
    """Create a new VLAN."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vlans"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_vlan(params: Dict, context: Any) -> Dict:
    """Update a VLAN."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        vlan_id = params.get("vlan_id")
        if not network_id or not vlan_id:
            return {"success": False, "error": "network_id and vlan_id are required"}

        path = f"/networks/{network_id}/appliance/vlans/{vlan_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "vlan_id"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_delete_vlan(params: Dict, context: Any) -> Dict:
    """Delete a VLAN."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        vlan_id = params.get("vlan_id")
        if not network_id or not vlan_id:
            return {"success": False, "error": "network_id and vlan_id are required"}

        path = f"/networks/{network_id}/appliance/vlans/{vlan_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_vlans_settings(params: Dict, context: Any) -> Dict:
    """Get VLAN settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vlans/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_vlans_settings(params: Dict, context: Any) -> Dict:
    """Update VLAN settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vlans/settings"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# FIREWALL HANDLERS (9 tools)
# =============================================================================

async def handle_appliance_get_l3_firewall_rules(params: Dict, context: Any) -> Dict:
    """Get L3 firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/l3FirewallRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_l3_firewall_rules(params: Dict, context: Any) -> Dict:
    """Update L3 firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/l3FirewallRules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_l7_firewall_rules(params: Dict, context: Any) -> Dict:
    """Get L7 firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/l7FirewallRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_l7_firewall_rules(params: Dict, context: Any) -> Dict:
    """Update L7 firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/l7FirewallRules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_l7_firewall_categories(params: Dict, context: Any) -> Dict:
    """Get L7 firewall application categories."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/l7FirewallRules/applicationCategories"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_inbound_firewall_rules(params: Dict, context: Any) -> Dict:
    """Get inbound firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/inboundFirewallRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_inbound_firewall_rules(params: Dict, context: Any) -> Dict:
    """Update inbound firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/inboundFirewallRules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_cellular_firewall_rules(params: Dict, context: Any) -> Dict:
    """Get cellular firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/inboundCellularFirewallRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_cellular_firewall_rules(params: Dict, context: Any) -> Dict:
    """Update cellular firewall rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/inboundCellularFirewallRules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# NAT HANDLERS (6 tools)
# =============================================================================

async def handle_appliance_get_port_forwarding_rules(params: Dict, context: Any) -> Dict:
    """Get port forwarding rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/portForwardingRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_port_forwarding_rules(params: Dict, context: Any) -> Dict:
    """Update port forwarding rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/portForwardingRules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_one_to_one_nat_rules(params: Dict, context: Any) -> Dict:
    """Get 1:1 NAT rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/oneToOneNatRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_one_to_one_nat_rules(params: Dict, context: Any) -> Dict:
    """Update 1:1 NAT rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/oneToOneNatRules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_one_to_many_nat_rules(params: Dict, context: Any) -> Dict:
    """Get 1:many NAT rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/oneToManyNatRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_one_to_many_nat_rules(params: Dict, context: Any) -> Dict:
    """Update 1:many NAT rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/firewall/oneToManyNatRules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# SECURITY HANDLERS (6 tools)
# =============================================================================

async def handle_appliance_get_security_intrusion(params: Dict, context: Any) -> Dict:
    """Get intrusion detection settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/security/intrusion"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_security_intrusion(params: Dict, context: Any) -> Dict:
    """Update intrusion detection settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/security/intrusion"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_security_malware(params: Dict, context: Any) -> Dict:
    """Get malware protection settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/security/malware"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_security_malware(params: Dict, context: Any) -> Dict:
    """Update malware protection settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/security/malware"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_security_events(params: Dict, context: Any) -> Dict:
    """Get security events for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/security/events"
        query_params = {}
        for key in ["t0", "t1", "timespan", "perPage", "startingAfter", "endingBefore"]:
            if params.get(key):
                query_params[key] = params[key]

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_org_security_events(params: Dict, context: Any) -> Dict:
    """Get security events for an organization."""
    try:
        organization_id = params.get("organization_id")
        if not organization_id:
            return {"success": False, "error": "organization_id is required"}

        path = f"/organizations/{organization_id}/appliance/security/events"
        query_params = {}
        for key in ["t0", "t1", "timespan", "perPage", "startingAfter", "endingBefore"]:
            if params.get(key):
                query_params[key] = params[key]

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# CONTENT FILTERING HANDLERS (3 tools)
# =============================================================================

async def handle_appliance_get_content_filtering(params: Dict, context: Any) -> Dict:
    """Get content filtering settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/contentFiltering"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_content_filtering(params: Dict, context: Any) -> Dict:
    """Update content filtering settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/contentFiltering"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_content_filtering_categories(params: Dict, context: Any) -> Dict:
    """Get content filtering categories for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/contentFiltering/categories"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# VPN HANDLERS (8 tools)
# =============================================================================

async def handle_appliance_get_site_to_site_vpn(params: Dict, context: Any) -> Dict:
    """Get site-to-site VPN settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vpn/siteToSiteVpn"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_site_to_site_vpn(params: Dict, context: Any) -> Dict:
    """Update site-to-site VPN settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vpn/siteToSiteVpn"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_vpn_bgp(params: Dict, context: Any) -> Dict:
    """Get BGP configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vpn/bgp"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_vpn_bgp(params: Dict, context: Any) -> Dict:
    """Update BGP configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/vpn/bgp"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_third_party_vpn_peers(params: Dict, context: Any) -> Dict:
    """Get third-party VPN peers for an organization."""
    try:
        organization_id = params.get("organization_id")
        if not organization_id:
            return {"success": False, "error": "organization_id is required"}

        path = f"/organizations/{organization_id}/appliance/vpn/thirdPartyVPNPeers"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_third_party_vpn_peers(params: Dict, context: Any) -> Dict:
    """Update third-party VPN peers for an organization."""
    try:
        organization_id = params.get("organization_id")
        if not organization_id:
            return {"success": False, "error": "organization_id is required"}

        path = f"/organizations/{organization_id}/appliance/vpn/thirdPartyVPNPeers"
        body = {k: v for k, v in params.items() if k != "organization_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_vpn_statuses(params: Dict, context: Any) -> Dict:
    """Get VPN statuses for an organization."""
    try:
        organization_id = params.get("organization_id")
        if not organization_id:
            return {"success": False, "error": "organization_id is required"}

        path = f"/organizations/{organization_id}/appliance/vpn/statuses"
        query_params = {}
        for key in ["perPage", "startingAfter", "endingBefore", "networkIds"]:
            if params.get(key):
                query_params[key] = params[key]

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_vpn_stats(params: Dict, context: Any) -> Dict:
    """Get VPN stats for an organization."""
    try:
        organization_id = params.get("organization_id")
        if not organization_id:
            return {"success": False, "error": "organization_id is required"}

        path = f"/organizations/{organization_id}/appliance/vpn/stats"
        query_params = {}
        for key in ["perPage", "startingAfter", "endingBefore", "networkIds", "t0", "t1", "timespan"]:
            if params.get(key):
                query_params[key] = params[key]

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TRAFFIC SHAPING HANDLERS (8 tools)
# =============================================================================

async def handle_appliance_get_traffic_shaping(params: Dict, context: Any) -> Dict:
    """Get traffic shaping settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_traffic_shaping(params: Dict, context: Any) -> Dict:
    """Update traffic shaping settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_traffic_shaping_rules(params: Dict, context: Any) -> Dict:
    """Get traffic shaping rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping/rules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_traffic_shaping_rules(params: Dict, context: Any) -> Dict:
    """Update traffic shaping rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping/rules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_uplink_bandwidth(params: Dict, context: Any) -> Dict:
    """Get uplink bandwidth settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping/uplinkBandwidth"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_uplink_bandwidth(params: Dict, context: Any) -> Dict:
    """Update uplink bandwidth settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping/uplinkBandwidth"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_uplink_selection(params: Dict, context: Any) -> Dict:
    """Get uplink selection settings for a network (SD-WAN)."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping/uplinkSelection"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_uplink_selection(params: Dict, context: Any) -> Dict:
    """Update uplink selection settings for a network (SD-WAN)."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/trafficShaping/uplinkSelection"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# STATIC ROUTE HANDLERS (5 tools)
# =============================================================================

async def handle_appliance_list_static_routes(params: Dict, context: Any) -> Dict:
    """List static routes for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/staticRoutes"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_static_route(params: Dict, context: Any) -> Dict:
    """Get a specific static route."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        static_route_id = params.get("static_route_id")
        if not network_id or not static_route_id:
            return {"success": False, "error": "network_id and static_route_id are required"}

        path = f"/networks/{network_id}/appliance/staticRoutes/{static_route_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_create_static_route(params: Dict, context: Any) -> Dict:
    """Create a static route."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/staticRoutes"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_static_route(params: Dict, context: Any) -> Dict:
    """Update a static route."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        static_route_id = params.get("static_route_id")
        if not network_id or not static_route_id:
            return {"success": False, "error": "network_id and static_route_id are required"}

        path = f"/networks/{network_id}/appliance/staticRoutes/{static_route_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "static_route_id"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_delete_static_route(params: Dict, context: Any) -> Dict:
    """Delete a static route."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        static_route_id = params.get("static_route_id")
        if not network_id or not static_route_id:
            return {"success": False, "error": "network_id and static_route_id are required"}

        path = f"/networks/{network_id}/appliance/staticRoutes/{static_route_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# PORT HANDLERS (3 tools)
# =============================================================================

async def handle_appliance_list_ports(params: Dict, context: Any) -> Dict:
    """List ports for a network appliance."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/ports"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_port(params: Dict, context: Any) -> Dict:
    """Get a specific port on a network appliance."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        port_id = params.get("port_id")
        if not network_id or not port_id:
            return {"success": False, "error": "network_id and port_id are required"}

        path = f"/networks/{network_id}/appliance/ports/{port_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_port(params: Dict, context: Any) -> Dict:
    """Update a port on a network appliance."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        port_id = params.get("port_id")
        if not network_id or not port_id:
            return {"success": False, "error": "network_id and port_id are required"}

        path = f"/networks/{network_id}/appliance/ports/{port_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "port_id"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# UPLINK HANDLERS (4 tools)
# =============================================================================

async def handle_appliance_get_uplinks_settings(params: Dict, context: Any) -> Dict:
    """Get uplink settings for a device."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/appliance/uplinks/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_uplinks_settings(params: Dict, context: Any) -> Dict:
    """Update uplink settings for a device."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/appliance/uplinks/settings"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_uplink_statuses(params: Dict, context: Any) -> Dict:
    """Get uplink statuses for an organization."""
    try:
        organization_id = params.get("organization_id")
        if not organization_id:
            return {"success": False, "error": "organization_id is required"}

        path = f"/organizations/{organization_id}/appliance/uplink/statuses"
        query_params = {}
        for key in ["perPage", "startingAfter", "endingBefore", "networkIds", "serials", "iccids"]:
            if params.get(key):
                query_params[key] = params[key]

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_get_uplinks_usage(params: Dict, context: Any) -> Dict:
    """Get uplinks usage by network for an organization."""
    try:
        organization_id = params.get("organization_id")
        if not organization_id:
            return {"success": False, "error": "organization_id is required"}

        path = f"/organizations/{organization_id}/appliance/uplinks/usage/byNetwork"
        query_params = {}
        for key in ["t0", "t1", "timespan"]:
            if params.get(key):
                query_params[key] = params[key]

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# SINGLE LAN HANDLERS (2 tools)
# =============================================================================

async def handle_appliance_get_single_lan(params: Dict, context: Any) -> Dict:
    """Get single LAN configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/singleLan"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_single_lan(params: Dict, context: Any) -> Dict:
    """Update single LAN configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/singleLan"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# DHCP HANDLERS (1 tool)
# =============================================================================

async def handle_appliance_get_dhcp_subnets(params: Dict, context: Any) -> Dict:
    """Get DHCP subnets for a device."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/appliance/dhcp/subnets"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# PERFORMANCE HANDLERS (1 tool)
# =============================================================================

async def handle_appliance_get_performance(params: Dict, context: Any) -> Dict:
    """Get performance metrics for a device."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/appliance/performance"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# WARM SPARE HANDLERS (3 tools)
# =============================================================================

async def handle_appliance_get_warm_spare(params: Dict, context: Any) -> Dict:
    """Get warm spare configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/warmSpare"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_warm_spare(params: Dict, context: Any) -> Dict:
    """Update warm spare configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/warmSpare"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_swap_warm_spare(params: Dict, context: Any) -> Dict:
    """Swap warm spare for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/warmSpare/swap"
        result = await context.client.request("POST", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# PREFIX DELEGATION HANDLERS (4 tools)
# =============================================================================

async def handle_appliance_get_prefixes_delegated_statics(params: Dict, context: Any) -> Dict:
    """Get prefixes delegated statics for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/prefixes/delegated/statics"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_create_prefixes_delegated_static(params: Dict, context: Any) -> Dict:
    """Create a prefixes delegated static for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/prefixes/delegated/statics"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_prefixes_delegated_static(params: Dict, context: Any) -> Dict:
    """Update a prefixes delegated static for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        static_delegated_prefix_id = params.get("static_delegated_prefix_id")
        if not network_id or not static_delegated_prefix_id:
            return {"success": False, "error": "network_id and static_delegated_prefix_id are required"}

        path = f"/networks/{network_id}/appliance/prefixes/delegated/statics/{static_delegated_prefix_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "static_delegated_prefix_id"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_delete_prefixes_delegated_static(params: Dict, context: Any) -> Dict:
    """Delete a prefixes delegated static for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        static_delegated_prefix_id = params.get("static_delegated_prefix_id")
        if not network_id or not static_delegated_prefix_id:
            return {"success": False, "error": "network_id and static_delegated_prefix_id are required"}

        path = f"/networks/{network_id}/appliance/prefixes/delegated/statics/{static_delegated_prefix_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# SD-WAN HANDLERS (2 tools)
# =============================================================================

async def handle_appliance_get_sdwan_internet_policies(params: Dict, context: Any) -> Dict:
    """Get SD-WAN internet policies for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/sdwan/internetPolicies"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_appliance_update_sdwan_internet_policies(params: Dict, context: Any) -> Dict:
    """Update SD-WAN internet policies for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/appliance/sdwan/internetPolicies"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_APPLIANCE_TOOLS = [
    # VLAN Tools (7)
    create_tool(
        name="meraki_appliance_list_vlans",
        description="List the VLANs for an MX network. Returns all configured VLANs including their IDs, names, subnets, DHCP settings, and other configuration details.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "vlan", "network", "list"],
        handler=handle_appliance_list_vlans,
        examples=[
            {"query": "Show VLANs for network N_123456", "params": {"network_id": "N_123456789012345678"}},
            {"query": "List all VLANs", "params": {"network_id": "L_636983396225539102"}},
            {"query": "What VLANs are configured?", "params": {"network_id": "N_123456789012345678"}},
        ],
    ),
    create_tool(
        name="meraki_appliance_get_vlan",
        description="Get details of a specific VLAN including its ID, name, subnet, appliance IP, DHCP settings, and other configuration.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "vlan_id": {"type": "string", "description": "The VLAN ID"}
        },
        required=["network_id", "vlan_id"],
        tags=["meraki", "appliance", "vlan", "network", "get"],
        handler=handle_appliance_get_vlan,
        examples=[
            {"query": "Get VLAN 100 details", "params": {"network_id": "N_123456789012345678", "vlan_id": "100"}},
            {"query": "Show the Guest VLAN", "params": {"network_id": "L_636983396225539102", "vlan_id": "50"}},
        ],
    ),
    create_tool(
        name="meraki_appliance_create_vlan",
        description="Create a new VLAN on an MX network. Requires VLAN ID, name, subnet, and appliance IP at minimum.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "id": {"type": "string", "description": "The VLAN ID (1-4094)"},
            "name": {"type": "string", "description": "The name of the VLAN"},
            "subnet": {"type": "string", "description": "The subnet of the VLAN (e.g., 192.168.1.0/24)"},
            "applianceIp": {"type": "string", "description": "The appliance IP for the VLAN"}
        },
        required=["network_id", "id", "name", "subnet", "applianceIp"],
        tags=["meraki", "appliance", "vlan", "network", "create"],
        requires_write=True,
        handler=handle_appliance_create_vlan,
    ),
    create_tool(
        name="meraki_appliance_update_vlan",
        description="Update an existing VLAN's configuration including name, subnet, DHCP settings, and more.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "vlan_id": {"type": "string", "description": "The VLAN ID"},
            "name": {"type": "string", "description": "The name of the VLAN"},
            "subnet": {"type": "string", "description": "The subnet of the VLAN"},
            "applianceIp": {"type": "string", "description": "The appliance IP for the VLAN"}
        },
        required=["network_id", "vlan_id"],
        tags=["meraki", "appliance", "vlan", "network", "update"],
        requires_write=True,
        handler=handle_appliance_update_vlan,
    ),
    create_tool(
        name="meraki_appliance_delete_vlan",
        description="Delete a VLAN from an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "vlan_id": {"type": "string", "description": "The VLAN ID to delete"}
        },
        required=["network_id", "vlan_id"],
        tags=["meraki", "appliance", "vlan", "network", "delete"],
        requires_write=True,
        handler=handle_appliance_delete_vlan,
    ),
    create_tool(
        name="meraki_appliance_get_vlans_settings",
        description="Get the VLAN settings for an MX network, including whether VLANs are enabled.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "vlan", "settings"],
        handler=handle_appliance_get_vlans_settings,
    ),
    create_tool(
        name="meraki_appliance_update_vlans_settings",
        description="Update the VLAN settings for an MX network (enable/disable VLANs).",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "vlansEnabled": {"type": "boolean", "description": "Whether VLANs are enabled"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "vlan", "settings", "update"],
        requires_write=True,
        handler=handle_appliance_update_vlans_settings,
    ),

    # Firewall Tools (9)
    create_tool(
        name="meraki_appliance_get_l3_firewall_rules",
        description="Get the L3 firewall rules for an MX network. Returns outbound rules including policy, protocol, source/destination CIDR, ports, and comments.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "firewall", "l3", "rules"],
        handler=handle_appliance_get_l3_firewall_rules,
    ),
    create_tool(
        name="meraki_appliance_update_l3_firewall_rules",
        description="Update the L3 firewall rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of L3 firewall rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "appliance", "firewall", "l3", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_l3_firewall_rules,
    ),
    create_tool(
        name="meraki_appliance_get_l7_firewall_rules",
        description="Get the L7 firewall rules for an MX network. Returns application-based rules.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "firewall", "l7", "rules"],
        handler=handle_appliance_get_l7_firewall_rules,
    ),
    create_tool(
        name="meraki_appliance_update_l7_firewall_rules",
        description="Update the L7 firewall rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of L7 firewall rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "appliance", "firewall", "l7", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_l7_firewall_rules,
    ),
    create_tool(
        name="meraki_appliance_get_l7_firewall_categories",
        description="Get L7 firewall application categories for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "firewall", "l7", "categories"],
        handler=handle_appliance_get_l7_firewall_categories,
    ),
    create_tool(
        name="meraki_appliance_get_inbound_firewall_rules",
        description="Get inbound firewall rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "firewall", "inbound", "rules"],
        handler=handle_appliance_get_inbound_firewall_rules,
    ),
    create_tool(
        name="meraki_appliance_update_inbound_firewall_rules",
        description="Update inbound firewall rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of inbound firewall rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "appliance", "firewall", "inbound", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_inbound_firewall_rules,
    ),
    create_tool(
        name="meraki_appliance_get_cellular_firewall_rules",
        description="Get cellular firewall rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "firewall", "cellular", "rules"],
        handler=handle_appliance_get_cellular_firewall_rules,
    ),
    create_tool(
        name="meraki_appliance_update_cellular_firewall_rules",
        description="Update cellular firewall rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of cellular firewall rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "appliance", "firewall", "cellular", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_cellular_firewall_rules,
    ),

    # NAT Tools (6)
    create_tool(
        name="meraki_appliance_get_port_forwarding_rules",
        description="Get port forwarding rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "nat", "port-forwarding", "rules"],
        handler=handle_appliance_get_port_forwarding_rules,
    ),
    create_tool(
        name="meraki_appliance_update_port_forwarding_rules",
        description="Update port forwarding rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of port forwarding rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "appliance", "nat", "port-forwarding", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_port_forwarding_rules,
    ),
    create_tool(
        name="meraki_appliance_get_one_to_one_nat_rules",
        description="Get 1:1 NAT rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "nat", "1:1", "rules"],
        handler=handle_appliance_get_one_to_one_nat_rules,
    ),
    create_tool(
        name="meraki_appliance_update_one_to_one_nat_rules",
        description="Update 1:1 NAT rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of 1:1 NAT rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "appliance", "nat", "1:1", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_one_to_one_nat_rules,
    ),
    create_tool(
        name="meraki_appliance_get_one_to_many_nat_rules",
        description="Get 1:many NAT rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "nat", "1:many", "rules"],
        handler=handle_appliance_get_one_to_many_nat_rules,
    ),
    create_tool(
        name="meraki_appliance_update_one_to_many_nat_rules",
        description="Update 1:many NAT rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of 1:many NAT rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "appliance", "nat", "1:many", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_one_to_many_nat_rules,
    ),

    # Security Tools (6)
    create_tool(
        name="meraki_appliance_get_security_intrusion",
        description="Get intrusion detection/prevention settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "security", "intrusion", "ids", "ips"],
        handler=handle_appliance_get_security_intrusion,
    ),
    create_tool(
        name="meraki_appliance_update_security_intrusion",
        description="Update intrusion detection/prevention settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "mode": {"type": "string", "description": "IDS/IPS mode: disabled, detection, prevention"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "security", "intrusion", "ids", "ips", "update"],
        requires_write=True,
        handler=handle_appliance_update_security_intrusion,
    ),
    create_tool(
        name="meraki_appliance_get_security_malware",
        description="Get malware protection settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "security", "malware", "amp"],
        handler=handle_appliance_get_security_malware,
    ),
    create_tool(
        name="meraki_appliance_update_security_malware",
        description="Update malware protection settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "mode": {"type": "string", "description": "Malware mode: disabled, enabled"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "security", "malware", "amp", "update"],
        requires_write=True,
        handler=handle_appliance_update_security_malware,
    ),
    create_tool(
        name="meraki_appliance_get_security_events",
        description="Get security events for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "t0": {"type": "string", "description": "Start time (ISO 8601)"},
            "t1": {"type": "string", "description": "End time (ISO 8601)"},
            "timespan": {"type": "number", "description": "Timespan in seconds (max 31 days)"},
            "perPage": {"type": "number", "description": "Results per page"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "security", "events"],
        handler=handle_appliance_get_security_events,
    ),
    create_tool(
        name="meraki_appliance_get_org_security_events",
        description="Get security events for an organization.",
        platform="meraki",
        category="appliance",
        properties={
            "organization_id": {"type": "string", "description": "The organization ID"},
            "t0": {"type": "string", "description": "Start time (ISO 8601)"},
            "t1": {"type": "string", "description": "End time (ISO 8601)"},
            "timespan": {"type": "number", "description": "Timespan in seconds"},
            "perPage": {"type": "number", "description": "Results per page"}
        },
        required=["organization_id"],
        tags=["meraki", "appliance", "security", "events", "organization"],
        handler=handle_appliance_get_org_security_events,
    ),

    # Content Filtering Tools (3)
    create_tool(
        name="meraki_appliance_get_content_filtering",
        description="Get content filtering settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "content-filtering", "web-filtering"],
        handler=handle_appliance_get_content_filtering,
    ),
    create_tool(
        name="meraki_appliance_update_content_filtering",
        description="Update content filtering settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "allowedUrlPatterns": {"type": "array", "description": "Allowed URL patterns"},
            "blockedUrlPatterns": {"type": "array", "description": "Blocked URL patterns"},
            "blockedUrlCategories": {"type": "array", "description": "Blocked URL categories"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "content-filtering", "web-filtering", "update"],
        requires_write=True,
        handler=handle_appliance_update_content_filtering,
    ),
    create_tool(
        name="meraki_appliance_get_content_filtering_categories",
        description="Get content filtering categories for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "content-filtering", "categories"],
        handler=handle_appliance_get_content_filtering_categories,
    ),

    # VPN Tools (8)
    create_tool(
        name="meraki_appliance_get_site_to_site_vpn",
        description="Get site-to-site VPN settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "vpn", "site-to-site"],
        handler=handle_appliance_get_site_to_site_vpn,
    ),
    create_tool(
        name="meraki_appliance_update_site_to_site_vpn",
        description="Update site-to-site VPN settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "mode": {"type": "string", "description": "VPN mode: none, hub, spoke"},
            "hubs": {"type": "array", "description": "Hub networks (if spoke)"},
            "subnets": {"type": "array", "description": "Subnets to include in VPN"}
        },
        required=["network_id", "mode"],
        tags=["meraki", "appliance", "vpn", "site-to-site", "update"],
        requires_write=True,
        handler=handle_appliance_update_site_to_site_vpn,
    ),
    create_tool(
        name="meraki_appliance_get_vpn_bgp",
        description="Get BGP configuration for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "vpn", "bgp"],
        handler=handle_appliance_get_vpn_bgp,
    ),
    create_tool(
        name="meraki_appliance_update_vpn_bgp",
        description="Update BGP configuration for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "enabled": {"type": "boolean", "description": "Enable BGP"},
            "asNumber": {"type": "number", "description": "BGP AS number"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "vpn", "bgp", "update"],
        requires_write=True,
        handler=handle_appliance_update_vpn_bgp,
    ),
    create_tool(
        name="meraki_appliance_get_third_party_vpn_peers",
        description="Get third-party VPN peers for an organization.",
        platform="meraki",
        category="appliance",
        properties={
            "organization_id": {"type": "string", "description": "The organization ID"}
        },
        required=["organization_id"],
        tags=["meraki", "appliance", "vpn", "third-party", "peers", "organization"],
        handler=handle_appliance_get_third_party_vpn_peers,
    ),
    create_tool(
        name="meraki_appliance_update_third_party_vpn_peers",
        description="Update third-party VPN peers for an organization.",
        platform="meraki",
        category="appliance",
        properties={
            "organization_id": {"type": "string", "description": "The organization ID"},
            "peers": {"type": "array", "description": "Array of VPN peer configurations"}
        },
        required=["organization_id", "peers"],
        tags=["meraki", "appliance", "vpn", "third-party", "peers", "organization", "update"],
        requires_write=True,
        handler=handle_appliance_update_third_party_vpn_peers,
    ),
    create_tool(
        name="meraki_appliance_get_vpn_statuses",
        description="Get VPN statuses for all MX appliances in an organization.",
        platform="meraki",
        category="appliance",
        properties={
            "organization_id": {"type": "string", "description": "The organization ID"},
            "perPage": {"type": "number", "description": "Results per page"},
            "networkIds": {"type": "array", "description": "Filter by network IDs"}
        },
        required=["organization_id"],
        tags=["meraki", "appliance", "vpn", "status", "organization"],
        handler=handle_appliance_get_vpn_statuses,
    ),
    create_tool(
        name="meraki_appliance_get_vpn_stats",
        description="Get VPN statistics for an organization.",
        platform="meraki",
        category="appliance",
        properties={
            "organization_id": {"type": "string", "description": "The organization ID"},
            "t0": {"type": "string", "description": "Start time"},
            "t1": {"type": "string", "description": "End time"},
            "timespan": {"type": "number", "description": "Timespan in seconds"},
            "perPage": {"type": "number", "description": "Results per page"},
            "networkIds": {"type": "array", "description": "Filter by network IDs"}
        },
        required=["organization_id"],
        tags=["meraki", "appliance", "vpn", "stats", "organization"],
        handler=handle_appliance_get_vpn_stats,
    ),

    # Traffic Shaping Tools (8)
    create_tool(
        name="meraki_appliance_get_traffic_shaping",
        description="Get traffic shaping settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "traffic-shaping", "qos"],
        handler=handle_appliance_get_traffic_shaping,
    ),
    create_tool(
        name="meraki_appliance_update_traffic_shaping",
        description="Update traffic shaping settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "globalBandwidthLimits": {"type": "object", "description": "Global bandwidth limits"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "traffic-shaping", "qos", "update"],
        requires_write=True,
        handler=handle_appliance_update_traffic_shaping,
    ),
    create_tool(
        name="meraki_appliance_get_traffic_shaping_rules",
        description="Get traffic shaping rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "traffic-shaping", "rules"],
        handler=handle_appliance_get_traffic_shaping_rules,
    ),
    create_tool(
        name="meraki_appliance_update_traffic_shaping_rules",
        description="Update traffic shaping rules for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "rules": {"type": "array", "description": "Array of traffic shaping rules"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "traffic-shaping", "rules", "update"],
        requires_write=True,
        handler=handle_appliance_update_traffic_shaping_rules,
    ),
    create_tool(
        name="meraki_appliance_get_uplink_bandwidth",
        description="Get uplink bandwidth settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "uplink", "bandwidth"],
        handler=handle_appliance_get_uplink_bandwidth,
    ),
    create_tool(
        name="meraki_appliance_update_uplink_bandwidth",
        description="Update uplink bandwidth settings for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "bandwidthLimits": {"type": "object", "description": "Bandwidth limits per uplink"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "uplink", "bandwidth", "update"],
        requires_write=True,
        handler=handle_appliance_update_uplink_bandwidth,
    ),
    create_tool(
        name="meraki_appliance_get_uplink_selection",
        description="Get uplink selection settings (SD-WAN) for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "uplink", "selection", "sdwan"],
        handler=handle_appliance_get_uplink_selection,
    ),
    create_tool(
        name="meraki_appliance_update_uplink_selection",
        description="Update uplink selection settings (SD-WAN) for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "activeActiveAutoVpnEnabled": {"type": "boolean", "description": "Enable active-active Auto VPN"},
            "defaultUplink": {"type": "string", "description": "Default uplink: wan1, wan2, bestForVoIP, loadBalancing"},
            "vpnTrafficUplinkPreferences": {"type": "array", "description": "VPN traffic uplink preferences"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "uplink", "selection", "sdwan", "update"],
        requires_write=True,
        handler=handle_appliance_update_uplink_selection,
    ),

    # Static Route Tools (5)
    create_tool(
        name="meraki_appliance_list_static_routes",
        description="List static routes for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "static-routes", "routing"],
        handler=handle_appliance_list_static_routes,
    ),
    create_tool(
        name="meraki_appliance_get_static_route",
        description="Get a specific static route.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "static_route_id": {"type": "string", "description": "The static route ID"}
        },
        required=["network_id", "static_route_id"],
        tags=["meraki", "appliance", "static-routes", "routing"],
        handler=handle_appliance_get_static_route,
    ),
    create_tool(
        name="meraki_appliance_create_static_route",
        description="Create a static route for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "name": {"type": "string", "description": "Route name"},
            "subnet": {"type": "string", "description": "Destination subnet"},
            "gatewayIp": {"type": "string", "description": "Gateway IP address"}
        },
        required=["network_id", "name", "subnet", "gatewayIp"],
        tags=["meraki", "appliance", "static-routes", "routing", "create"],
        requires_write=True,
        handler=handle_appliance_create_static_route,
    ),
    create_tool(
        name="meraki_appliance_update_static_route",
        description="Update a static route.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "static_route_id": {"type": "string", "description": "The static route ID"},
            "name": {"type": "string", "description": "Route name"},
            "subnet": {"type": "string", "description": "Destination subnet"},
            "gatewayIp": {"type": "string", "description": "Gateway IP address"}
        },
        required=["network_id", "static_route_id"],
        tags=["meraki", "appliance", "static-routes", "routing", "update"],
        requires_write=True,
        handler=handle_appliance_update_static_route,
    ),
    create_tool(
        name="meraki_appliance_delete_static_route",
        description="Delete a static route.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "static_route_id": {"type": "string", "description": "The static route ID"}
        },
        required=["network_id", "static_route_id"],
        tags=["meraki", "appliance", "static-routes", "routing", "delete"],
        requires_write=True,
        handler=handle_appliance_delete_static_route,
    ),

    # Port Tools (3)
    create_tool(
        name="meraki_appliance_list_ports",
        description="List ports for an MX network appliance.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "ports"],
        handler=handle_appliance_list_ports,
    ),
    create_tool(
        name="meraki_appliance_get_port",
        description="Get a specific port on an MX appliance.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "port_id": {"type": "string", "description": "The port ID"}
        },
        required=["network_id", "port_id"],
        tags=["meraki", "appliance", "ports"],
        handler=handle_appliance_get_port,
    ),
    create_tool(
        name="meraki_appliance_update_port",
        description="Update a port on an MX appliance.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "port_id": {"type": "string", "description": "The port ID"},
            "enabled": {"type": "boolean", "description": "Enable port"},
            "type": {"type": "string", "description": "Port type: trunk, access"},
            "vlan": {"type": "number", "description": "VLAN ID for access port"}
        },
        required=["network_id", "port_id"],
        tags=["meraki", "appliance", "ports", "update"],
        requires_write=True,
        handler=handle_appliance_update_port,
    ),

    # Uplink Tools (4)
    create_tool(
        name="meraki_appliance_get_uplinks_settings",
        description="Get uplink settings for a device.",
        platform="meraki",
        category="appliance",
        properties={
            "serial": {"type": "string", "description": "The device serial number"}
        },
        required=["serial"],
        tags=["meraki", "appliance", "uplink", "settings", "device"],
        handler=handle_appliance_get_uplinks_settings,
    ),
    create_tool(
        name="meraki_appliance_update_uplinks_settings",
        description="Update uplink settings for a device.",
        platform="meraki",
        category="appliance",
        properties={
            "serial": {"type": "string", "description": "The device serial number"},
            "interfaces": {"type": "object", "description": "Interface configurations"}
        },
        required=["serial"],
        tags=["meraki", "appliance", "uplink", "settings", "device", "update"],
        requires_write=True,
        handler=handle_appliance_update_uplinks_settings,
    ),
    create_tool(
        name="meraki_appliance_get_uplink_statuses",
        description="Get uplink statuses for all MX appliances in an organization.",
        platform="meraki",
        category="appliance",
        properties={
            "organization_id": {"type": "string", "description": "The organization ID"},
            "perPage": {"type": "number", "description": "Results per page"},
            "networkIds": {"type": "array", "description": "Filter by network IDs"},
            "serials": {"type": "array", "description": "Filter by device serials"}
        },
        required=["organization_id"],
        tags=["meraki", "appliance", "uplink", "status", "organization"],
        handler=handle_appliance_get_uplink_statuses,
    ),
    create_tool(
        name="meraki_appliance_get_uplinks_usage",
        description="Get uplink usage by network for an organization.",
        platform="meraki",
        category="appliance",
        properties={
            "organization_id": {"type": "string", "description": "The organization ID"},
            "t0": {"type": "string", "description": "Start time"},
            "t1": {"type": "string", "description": "End time"},
            "timespan": {"type": "number", "description": "Timespan in seconds"}
        },
        required=["organization_id"],
        tags=["meraki", "appliance", "uplink", "usage", "organization"],
        handler=handle_appliance_get_uplinks_usage,
    ),

    # Single LAN Tools (2)
    create_tool(
        name="meraki_appliance_get_single_lan",
        description="Get single LAN configuration for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "single-lan", "lan"],
        handler=handle_appliance_get_single_lan,
    ),
    create_tool(
        name="meraki_appliance_update_single_lan",
        description="Update single LAN configuration for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "subnet": {"type": "string", "description": "Subnet"},
            "applianceIp": {"type": "string", "description": "Appliance IP"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "single-lan", "lan", "update"],
        requires_write=True,
        handler=handle_appliance_update_single_lan,
    ),

    # DHCP Tools (1)
    create_tool(
        name="meraki_appliance_get_dhcp_subnets",
        description="Get DHCP subnets for an MX device.",
        platform="meraki",
        category="appliance",
        properties={
            "serial": {"type": "string", "description": "The device serial number"}
        },
        required=["serial"],
        tags=["meraki", "appliance", "dhcp", "subnets", "device"],
        handler=handle_appliance_get_dhcp_subnets,
    ),

    # Performance Tools (1)
    create_tool(
        name="meraki_appliance_get_performance",
        description="Get performance metrics for an MX device.",
        platform="meraki",
        category="appliance",
        properties={
            "serial": {"type": "string", "description": "The device serial number"}
        },
        required=["serial"],
        tags=["meraki", "appliance", "performance", "metrics", "device"],
        handler=handle_appliance_get_performance,
    ),

    # Warm Spare Tools (3)
    create_tool(
        name="meraki_appliance_get_warm_spare",
        description="Get warm spare configuration for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "warm-spare", "ha", "failover"],
        handler=handle_appliance_get_warm_spare,
    ),
    create_tool(
        name="meraki_appliance_update_warm_spare",
        description="Update warm spare configuration for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "enabled": {"type": "boolean", "description": "Enable warm spare"},
            "spareSerial": {"type": "string", "description": "Serial of spare device"},
            "uplinkMode": {"type": "string", "description": "Uplink mode: virtual, direct"}
        },
        required=["network_id", "enabled"],
        tags=["meraki", "appliance", "warm-spare", "ha", "failover", "update"],
        requires_write=True,
        handler=handle_appliance_update_warm_spare,
    ),
    create_tool(
        name="meraki_appliance_swap_warm_spare",
        description="Swap warm spare for an MX network (failover).",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "warm-spare", "ha", "failover", "swap"],
        requires_write=True,
        handler=handle_appliance_swap_warm_spare,
    ),

    # Prefix Delegation Tools (4)
    create_tool(
        name="meraki_appliance_get_prefixes_delegated_statics",
        description="Get prefixes delegated statics for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "prefixes", "ipv6"],
        handler=handle_appliance_get_prefixes_delegated_statics,
    ),
    create_tool(
        name="meraki_appliance_create_prefixes_delegated_static",
        description="Create a prefixes delegated static for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "prefix": {"type": "string", "description": "IPv6 prefix"},
            "origin": {"type": "object", "description": "Origin configuration"}
        },
        required=["network_id", "prefix", "origin"],
        tags=["meraki", "appliance", "prefixes", "ipv6", "create"],
        requires_write=True,
        handler=handle_appliance_create_prefixes_delegated_static,
    ),
    create_tool(
        name="meraki_appliance_update_prefixes_delegated_static",
        description="Update a prefixes delegated static for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "static_delegated_prefix_id": {"type": "string", "description": "The static prefix ID"},
            "prefix": {"type": "string", "description": "IPv6 prefix"},
            "origin": {"type": "object", "description": "Origin configuration"}
        },
        required=["network_id", "static_delegated_prefix_id"],
        tags=["meraki", "appliance", "prefixes", "ipv6", "update"],
        requires_write=True,
        handler=handle_appliance_update_prefixes_delegated_static,
    ),
    create_tool(
        name="meraki_appliance_delete_prefixes_delegated_static",
        description="Delete a prefixes delegated static for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "static_delegated_prefix_id": {"type": "string", "description": "The static prefix ID"}
        },
        required=["network_id", "static_delegated_prefix_id"],
        tags=["meraki", "appliance", "prefixes", "ipv6", "delete"],
        requires_write=True,
        handler=handle_appliance_delete_prefixes_delegated_static,
    ),

    # SD-WAN Tools (2)
    create_tool(
        name="meraki_appliance_get_sdwan_internet_policies",
        description="Get SD-WAN internet policies for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "sdwan", "internet-policies"],
        handler=handle_appliance_get_sdwan_internet_policies,
    ),
    create_tool(
        name="meraki_appliance_update_sdwan_internet_policies",
        description="Update SD-WAN internet policies for an MX network.",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "The network ID"},
            "wanTrafficUplinkPreferences": {"type": "array", "description": "WAN traffic uplink preferences"}
        },
        required=["network_id"],
        tags=["meraki", "appliance", "sdwan", "internet-policies", "update"],
        requires_write=True,
        handler=handle_appliance_update_sdwan_internet_policies,
    ),
]


def register_appliance_tools():
    """Register all appliance tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_APPLIANCE_TOOLS)
    logger.info(f"Registered {len(MERAKI_APPLIANCE_TOOLS)} Meraki appliance tools")


# Auto-register on import
register_appliance_tools()
