"""Meraki Dashboard API Tools.

This module provides 400+ tools for Meraki Dashboard operations,
organized into logical categories:
- organizations: Organization-level operations
- networks: Network management
- devices: Device operations and live tools
- wireless: SSIDs, RF profiles, radio settings
- appliance: MX appliance configuration (VLANs, firewall, VPN)
- switch: Switch ports, routing, ACLs
- camera: Camera configuration and analytics
- sensor: MT sensor operations
- sm: Systems Manager (MDM)
- licensing: License management
- insight: Application insights

Tool naming convention: meraki_{action}_{entity}
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient

logger = logging.getLogger(__name__)


# =============================================================================
# EXECUTION CONTEXT
# =============================================================================

class MerakiExecutionContext:
    """Context for executing Meraki tools."""
    def __init__(
        self,
        api_key: str,
        org_id: str = None,
        network_id: str = None,
        cached_devices: List[Dict] = None,
    ):
        self.client = MerakiAPIClient(api_key)
        self.org_id = org_id
        self.network_id = network_id
        self.cached_devices = cached_devices or []


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def api_get(client: MerakiAPIClient, path: str, params: Dict = None) -> Any:
    """Make GET request to Meraki API."""
    # Note: request() already returns parsed JSON and raises on HTTP errors
    return await client.request("GET", path, params=params)


async def api_post(client: MerakiAPIClient, path: str, data: Dict = None) -> Any:
    """Make POST request to Meraki API."""
    # Note: request() already returns parsed JSON and raises on HTTP errors
    return await client.request("POST", path, json_data=data or {})


async def api_put(client: MerakiAPIClient, path: str, data: Dict = None) -> Any:
    """Make PUT request to Meraki API."""
    # Note: request() already returns parsed JSON and raises on HTTP errors
    return await client.request("PUT", path, json_data=data or {})


async def api_delete(client: MerakiAPIClient, path: str) -> Any:
    """Make DELETE request to Meraki API."""
    # Note: request() already returns parsed JSON and raises on HTTP errors
    result = await client.request("DELETE", path)
    return result if result else {"success": True}


def success_result(data: Any = None, message: str = None, entities: Dict = None) -> Dict:
    """Create a success result."""
    result = {"success": True}
    if data is not None:
        result["data"] = data
    if message:
        result["message"] = message
    if entities:
        result["entities"] = entities
    return result


def error_result(message: str) -> Dict:
    """Create an error result."""
    return {"success": False, "error": message}


# =============================================================================
# ORGANIZATION TOOLS
# =============================================================================

async def handle_list_organizations(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List all organizations."""
    data = await api_get(context.client, "/organizations")
    return success_result(data=data)


async def handle_get_organization(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get organization details."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    data = await api_get(context.client, f"/organizations/{org_id}")
    return success_result(data=data)


async def handle_list_organization_networks(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List networks in organization."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    data = await api_get(context.client, f"/organizations/{org_id}/networks")
    return success_result(data=data)


async def handle_list_organization_devices(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List all devices in organization."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["perPage", "startingAfter", "endingBefore", "networkIds", "productTypes", "tags", "tagsFilterType", "name", "mac", "serial", "model", "macs", "serials", "sensorMetrics", "sensorAlertProfileIds", "models"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/devices", params=query_params)
    return success_result(data=data)


async def handle_get_organization_inventory(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get organization inventory devices."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["perPage", "startingAfter", "endingBefore", "usedState", "search", "macs", "networkIds", "serials", "models", "orderNumbers", "tags", "tagsFilterType", "productTypes"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/inventory/devices", params=query_params)
    return success_result(data=data)


async def handle_get_organization_licenses(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get organization licenses overview."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    data = await api_get(context.client, f"/organizations/{org_id}/licenses/overview")
    return success_result(data=data)


async def handle_get_organization_admins(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get organization administrators."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    data = await api_get(context.client, f"/organizations/{org_id}/admins")
    return success_result(data=data)


async def handle_get_organization_config_changes(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get organization configuration changes."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["timespan", "perPage", "startingAfter", "endingBefore", "networkId", "adminId"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/configurationChanges", params=query_params)
    return success_result(data=data)


async def handle_get_organization_api_requests(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get organization API requests."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["t0", "t1", "timespan", "perPage", "startingAfter", "endingBefore", "adminId", "path", "method", "responseCode", "sourceIp", "userAgent", "version", "operationIds"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/apiRequests", params=query_params)
    return success_result(data=data)


# =============================================================================
# NETWORK TOOLS
# =============================================================================

async def handle_get_network(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get network details."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}")
    return success_result(data=data)


async def handle_get_network_by_name(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Find network by name."""
    name = params.get("name")
    if not name:
        return error_result("name is required")
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    networks = await api_get(context.client, f"/organizations/{org_id}/networks")
    name_lower = name.lower()
    matches = [n for n in networks if name_lower in n.get("name", "").lower()]
    if not matches:
        return error_result(f"No network found matching '{name}'")
    return success_result(data=matches[0] if len(matches) == 1 else matches)


async def handle_list_network_devices(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List devices in a network."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/devices")
    return success_result(data=data)


async def handle_get_network_clients(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get clients in a network."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["t0", "timespan", "perPage", "startingAfter", "endingBefore", "statuses", "ip", "ip6", "ip6Local", "mac", "os", "pskGroup", "description", "vlan", "namedVlan", "recentDeviceConnections"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/clients", params=query_params)
    return success_result(data=data)


async def handle_get_network_traffic(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get network traffic analysis."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["t0", "timespan", "deviceType"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/traffic", params=query_params)
    return success_result(data=data)


async def handle_get_network_events(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get network events."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["productType", "includedEventTypes", "excludedEventTypes", "deviceMac", "deviceSerial", "deviceName", "clientIp", "clientMac", "clientName", "smDeviceMac", "smDeviceName", "perPage", "startingAfter", "endingBefore"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/events", params=query_params)
    return success_result(data=data)


async def handle_get_network_alerts_settings(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get network alert settings."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/alerts/settings")
    return success_result(data=data)


# =============================================================================
# DEVICE TOOLS
# =============================================================================

async def handle_get_device(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get device details by serial or model name."""
    serial = params.get("serial") or params.get("device_serial")
    device_name = params.get("device_name") or params.get("name")
    device_model = params.get("device_model")

    # Build search terms
    search_terms = []
    if device_name:
        search_terms.append(device_name.lower())
    if device_model:
        search_terms.append(device_model.lower())

    # Try to find device by name/model if no serial
    if not serial and search_terms:
        # Check cached devices
        if context.cached_devices:
            for device in context.cached_devices:
                dev_name = device.get("name", "").lower()
                dev_model = device.get("model", "").lower()
                for term in search_terms:
                    if term in dev_name or term == dev_model.lower():
                        serial = device.get("serial")
                        break
                if serial:
                    break

        # Try org lookup if still no serial
        if not serial and context.org_id:
            try:
                org_devices = await api_get(context.client, f"/organizations/{context.org_id}/devices")
                for device in org_devices:
                    dev_name = device.get("name", "").lower()
                    dev_model = device.get("model", "").lower()
                    for term in search_terms:
                        if term in dev_name or term == dev_model.lower():
                            serial = device.get("serial")
                            break
                    if serial:
                        break
            except Exception as e:
                logger.warning(f"Failed to lookup device: {e}")

    if not serial:
        return error_result("serial is required - provide device serial or model name (e.g., MX68, MR36)")

    data = await api_get(context.client, f"/devices/{serial}")
    return success_result(data=data)


async def handle_update_device(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Update device settings."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    body = {k: params[k] for k in ["name", "lat", "lng", "address", "notes", "tags", "moveMapMarker", "switchProfileId", "floorPlanId"] if params.get(k) is not None}
    if not body:
        return error_result("No update parameters provided")
    data = await api_put(context.client, f"/devices/{serial}", data=body)
    return success_result(data=data)


async def handle_reboot_device(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Reboot a device."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_post(context.client, f"/devices/{serial}/reboot")
    return success_result(data=data, message="Reboot initiated")


async def handle_blink_device_leds(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Blink device LEDs."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    body = {k: params[k] for k in ["duration", "period", "duty"] if params.get(k)}
    data = await api_post(context.client, f"/devices/{serial}/blinkLeds", data=body)
    return success_result(data=data)


async def handle_get_device_clients(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get clients connected to a device."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    query_params = {k: params[k] for k in ["t0", "timespan"] if params.get(k)}
    data = await api_get(context.client, f"/devices/{serial}/clients", params=query_params)
    return success_result(data=data)


async def handle_get_device_lldp_cdp(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get LLDP/CDP neighbors."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/lldpCdp")
    return success_result(data=data)


async def handle_get_device_management_interface(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get device management interface settings."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/managementInterface")
    return success_result(data=data)


async def handle_create_device_ping(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Create a ping test from device."""
    serial = params.get("serial")
    target = params.get("target")
    if not serial:
        return error_result("serial is required")
    if not target:
        return error_result("target is required")
    body = {"target": target}
    if params.get("count"):
        body["count"] = params["count"]
    data = await api_post(context.client, f"/devices/{serial}/liveTools/ping", data=body)
    return success_result(data=data)


async def handle_get_device_ping_result(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get ping test results."""
    serial = params.get("serial")
    ping_id = params.get("ping_id")
    if not serial:
        return error_result("serial is required")
    if not ping_id:
        return error_result("ping_id is required")
    data = await api_get(context.client, f"/devices/{serial}/liveTools/ping/{ping_id}")
    return success_result(data=data)


async def handle_get_device_loss_latency(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get device loss and latency history."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "uplink", "ip"] if params.get(k)}
    data = await api_get(context.client, f"/devices/{serial}/lossAndLatencyHistory", params=query_params)
    return success_result(data=data)


# =============================================================================
# WIRELESS TOOLS (SSIDs)
# =============================================================================

async def handle_list_ssids(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List all SSIDs in a network."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/wireless/ssids")
    return success_result(data=data)


async def handle_get_ssid(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get SSID details."""
    network_id = params.get("network_id") or context.network_id
    number = params.get("number")
    if not network_id:
        return error_result("network_id is required")
    if number is None:
        return error_result("number is required (0-14)")
    data = await api_get(context.client, f"/networks/{network_id}/wireless/ssids/{number}")
    return success_result(data=data)


async def handle_update_ssid(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Update SSID configuration."""
    network_id = params.get("network_id") or context.network_id
    number = params.get("number")
    if not network_id:
        return error_result("network_id is required")
    if number is None:
        return error_result("number is required (0-14)")
    body = {k: params[k] for k in ["name", "enabled", "authMode", "encryptionMode", "psk", "wpaEncryptionMode", "visible", "availableOnAllAps", "availabilityTags", "perClientBandwidthLimitUp", "perClientBandwidthLimitDown", "perSsidBandwidthLimitUp", "perSsidBandwidthLimitDown", "mandatoryDhcpEnabled", "ipAssignmentMode", "vlanId", "defaultVlanId", "useVlanTagging", "splashPage", "minBitrate", "bandSelection", "radiusServers", "radiusAccountingEnabled", "radiusAccountingServers", "dot11w", "dot11r", "lanIsolationEnabled", "concentratorNetworkId", "secondaryConcentratorNetworkId", "disassociateClientsOnVpnFailover", "dnsRewrite", "speedBurst"] if params.get(k) is not None}
    if not body:
        return error_result("No update parameters provided")
    data = await api_put(context.client, f"/networks/{network_id}/wireless/ssids/{number}", data=body)
    return success_result(data=data)


async def handle_get_ssid_splash_settings(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get SSID splash page settings."""
    network_id = params.get("network_id") or context.network_id
    number = params.get("number")
    if not network_id:
        return error_result("network_id is required")
    if number is None:
        return error_result("number is required")
    data = await api_get(context.client, f"/networks/{network_id}/wireless/ssids/{number}/splash/settings")
    return success_result(data=data)


async def handle_list_wireless_rf_profiles(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List RF profiles for a network."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/wireless/rfProfiles")
    return success_result(data=data)


async def handle_get_device_wireless_status(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get wireless device status (AP)."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/wireless/status")
    return success_result(data=data)


async def handle_get_wireless_connection_stats(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get wireless connection statistics."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/wireless/connectionStats", params=query_params)
    return success_result(data=data)


async def handle_get_wireless_client_count_history(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get wireless client count history."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band", "ssid"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/wireless/clientCountHistory", params=query_params)
    return success_result(data=data)


async def handle_get_wireless_latency_stats(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get wireless latency statistics."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag", "fields"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/wireless/latencyStats", params=query_params)
    return success_result(data=data)


async def handle_get_wireless_channel_utilization(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get wireless channel utilization."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/wireless/channelUtilizationHistory", params=query_params)
    return success_result(data=data)


# =============================================================================
# APPLIANCE TOOLS (MX - VLANs, Firewall, VPN)
# =============================================================================

async def handle_list_vlans(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List VLANs in a network."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/vlans")
    return success_result(data=data)


async def handle_get_vlan(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get VLAN details."""
    network_id = params.get("network_id") or context.network_id
    vlan_id = params.get("vlan_id")
    if not network_id:
        return error_result("network_id is required")
    if not vlan_id:
        return error_result("vlan_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/vlans/{vlan_id}")
    return success_result(data=data)


async def handle_create_vlan(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Create a new VLAN."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    required = ["id", "name"]
    for field in required:
        if not params.get(field):
            return error_result(f"{field} is required")
    body = {k: params[k] for k in ["id", "name", "subnet", "applianceIp", "groupPolicyId", "templateVlanType", "cidr", "mask", "ipv6", "dhcpHandling", "dhcpRelayServerIps", "dhcpLeaseTime", "dhcpBootOptionsEnabled", "dhcpBootNextServer", "dhcpBootFilename", "fixedIpAssignments", "reservedIpRanges", "dnsNameservers", "dhcpOptions", "vpnNatSubnet", "mandatoryDhcp"] if params.get(k) is not None}
    data = await api_post(context.client, f"/networks/{network_id}/appliance/vlans", data=body)
    return success_result(data=data)


async def handle_update_vlan(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Update VLAN settings."""
    network_id = params.get("network_id") or context.network_id
    vlan_id = params.get("vlan_id")
    if not network_id:
        return error_result("network_id is required")
    if not vlan_id:
        return error_result("vlan_id is required")
    body = {k: params[k] for k in ["name", "subnet", "applianceIp", "groupPolicyId", "templateVlanType", "cidr", "mask", "ipv6", "dhcpHandling", "dhcpRelayServerIps", "dhcpLeaseTime", "dhcpBootOptionsEnabled", "dhcpBootNextServer", "dhcpBootFilename", "fixedIpAssignments", "reservedIpRanges", "dnsNameservers", "dhcpOptions", "vpnNatSubnet", "mandatoryDhcp"] if params.get(k) is not None}
    if not body:
        return error_result("No update parameters provided")
    data = await api_put(context.client, f"/networks/{network_id}/appliance/vlans/{vlan_id}", data=body)
    return success_result(data=data)


async def handle_delete_vlan(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Delete a VLAN."""
    network_id = params.get("network_id") or context.network_id
    vlan_id = params.get("vlan_id")
    if not network_id:
        return error_result("network_id is required")
    if not vlan_id:
        return error_result("vlan_id is required")
    await api_delete(context.client, f"/networks/{network_id}/appliance/vlans/{vlan_id}")
    return success_result(message=f"VLAN {vlan_id} deleted")


async def handle_get_appliance_firewall_rules(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get L3 firewall rules."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/firewall/l3FirewallRules")
    return success_result(data=data)


async def handle_update_appliance_firewall_rules(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Update L3 firewall rules."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    rules = params.get("rules")
    if not rules:
        return error_result("rules is required")
    data = await api_put(context.client, f"/networks/{network_id}/appliance/firewall/l3FirewallRules", data={"rules": rules})
    return success_result(data=data)


async def handle_get_appliance_vpn_site_to_site(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get site-to-site VPN settings."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/vpn/siteToSiteVpn")
    return success_result(data=data)


async def handle_update_appliance_vpn_site_to_site(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Update site-to-site VPN settings."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    body = {k: params[k] for k in ["mode", "hubs", "subnets"] if params.get(k) is not None}
    if not body:
        return error_result("No update parameters provided")
    data = await api_put(context.client, f"/networks/{network_id}/appliance/vpn/siteToSiteVpn", data=body)
    return success_result(data=data)


async def handle_get_appliance_ports(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get MX appliance ports."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/ports")
    return success_result(data=data)


async def handle_get_appliance_uplinks_status(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get appliance uplink statuses for organization."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["perPage", "startingAfter", "endingBefore", "networkIds", "serials", "iccids"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/appliance/uplink/statuses", params=query_params)
    return success_result(data=data)


async def handle_get_appliance_dhcp_subnets(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get DHCP subnet info for an appliance."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/appliance/dhcp/subnets")
    return success_result(data=data)


async def handle_get_appliance_security_intrusion(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get intrusion detection settings."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/security/intrusion")
    return success_result(data=data)


async def handle_get_appliance_security_malware(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get malware protection settings."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/security/malware")
    return success_result(data=data)


async def handle_get_appliance_content_filtering(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get content filtering settings."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/appliance/contentFiltering")
    return success_result(data=data)


# =============================================================================
# SWITCH TOOLS
# =============================================================================

async def handle_list_switch_ports(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List switch ports."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/switch/ports")
    return success_result(data=data)


async def handle_get_switch_port(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get switch port details."""
    serial = params.get("serial")
    port_id = params.get("port_id")
    if not serial:
        return error_result("serial is required")
    if not port_id:
        return error_result("port_id is required")
    data = await api_get(context.client, f"/devices/{serial}/switch/ports/{port_id}")
    return success_result(data=data)


async def handle_update_switch_port(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Update switch port settings."""
    serial = params.get("serial")
    port_id = params.get("port_id")
    if not serial:
        return error_result("serial is required")
    if not port_id:
        return error_result("port_id is required")
    body = {k: params[k] for k in ["name", "tags", "enabled", "poeEnabled", "type", "vlan", "voiceVlan", "allowedVlans", "isolationEnabled", "rstpEnabled", "stpGuard", "linkNegotiation", "portScheduleId", "udld", "accessPolicyType", "accessPolicyNumber", "macAllowList", "stickyMacAllowList", "stickyMacAllowListLimit", "stormControlEnabled", "adaptivePolicyGroupId", "peerSgtCapable", "flexibleStackingEnabled", "daiTrusted", "profile"] if params.get(k) is not None}
    if not body:
        return error_result("No update parameters provided")
    data = await api_put(context.client, f"/devices/{serial}/switch/ports/{port_id}", data=body)
    return success_result(data=data)


async def handle_get_switch_ports_statuses(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get switch port statuses for organization."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["perPage", "startingAfter", "endingBefore", "networkIds", "portProfileIds", "name", "mac", "macs", "serial", "serials", "configurationUpdatedAfter"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/switch/ports/bySwitch", params=query_params)
    return success_result(data=data)


async def handle_get_switch_routing_interfaces(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get switch L3 routing interfaces."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/switch/routing/interfaces")
    return success_result(data=data)


async def handle_get_switch_routing_static_routes(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get switch static routes."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/switch/routing/staticRoutes")
    return success_result(data=data)


async def handle_list_switch_stacks(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List switch stacks in a network."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/switch/stacks")
    return success_result(data=data)


async def handle_get_switch_acls(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get switch access control lists."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/switch/accessControlLists")
    return success_result(data=data)


async def handle_get_switch_dhcp_server_policy(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get DHCP server policy for a switch."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/switch/dhcpServerPolicy")
    return success_result(data=data)


# =============================================================================
# CAMERA TOOLS
# =============================================================================

async def handle_get_camera_video_settings(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get camera video settings."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/camera/video/settings")
    return success_result(data=data)


async def handle_get_camera_quality_retention(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get camera quality and retention settings."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/camera/qualityAndRetention")
    return success_result(data=data)


async def handle_get_camera_sense(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get camera sense settings (analytics)."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/devices/{serial}/camera/sense")
    return success_result(data=data)


async def handle_get_camera_wireless_profiles(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get camera wireless profiles."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/camera/wirelessProfiles")
    return success_result(data=data)


async def handle_generate_camera_snapshot(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Generate camera snapshot."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    body = {}
    if params.get("timestamp"):
        body["timestamp"] = params["timestamp"]
    if params.get("fullframe"):
        body["fullframe"] = params["fullframe"]
    data = await api_post(context.client, f"/devices/{serial}/camera/generateSnapshot", data=body)
    return success_result(data=data)


async def handle_get_camera_video_link(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get camera video link."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    query_params = {}
    if params.get("timestamp"):
        query_params["timestamp"] = params["timestamp"]
    data = await api_get(context.client, f"/devices/{serial}/camera/videoLink", params=query_params)
    return success_result(data=data)


# =============================================================================
# SENSOR TOOLS
# =============================================================================

async def handle_list_sensor_alerts_profiles(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List sensor alert profiles."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/sensor/alerts/profiles")
    return success_result(data=data)


async def handle_get_sensor_readings_latest(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get latest sensor readings for organization."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["perPage", "startingAfter", "endingBefore", "networkIds", "serials", "metrics"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/sensor/readings/latest", params=query_params)
    return success_result(data=data)


async def handle_get_sensor_readings_history(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get sensor readings history."""
    org_id = params.get("organization_id") or context.org_id
    if not org_id:
        return error_result("organization_id is required")
    query_params = {k: params[k] for k in ["perPage", "startingAfter", "endingBefore", "t0", "t1", "timespan", "networkIds", "serials", "metrics"] if params.get(k)}
    data = await api_get(context.client, f"/organizations/{org_id}/sensor/readings/history", params=query_params)
    return success_result(data=data)


# =============================================================================
# SYSTEMS MANAGER TOOLS
# =============================================================================

async def handle_list_sm_devices(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List Systems Manager devices."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["fields", "wifiMacs", "serials", "ids", "uuids", "systemTypes", "scope", "perPage", "startingAfter", "endingBefore"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/sm/devices", params=query_params)
    return success_result(data=data)


async def handle_get_sm_device_profiles(params: Dict, context: MerakiExecutionContext) -> Dict:
    """Get device profiles for an SM device."""
    network_id = params.get("network_id") or context.network_id
    device_id = params.get("device_id")
    if not network_id:
        return error_result("network_id is required")
    if not device_id:
        return error_result("device_id is required")
    data = await api_get(context.client, f"/networks/{network_id}/sm/devices/{device_id}/deviceProfiles")
    return success_result(data=data)


async def handle_list_sm_users(params: Dict, context: MerakiExecutionContext) -> Dict:
    """List SM users."""
    network_id = params.get("network_id") or context.network_id
    if not network_id:
        return error_result("network_id is required")
    query_params = {k: params[k] for k in ["ids", "usernames", "emails", "scope"] if params.get(k)}
    data = await api_get(context.client, f"/networks/{network_id}/sm/users", params=query_params)
    return success_result(data=data)


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_TOOLS = [
    # Organization Tools - with examples for improved accuracy (per Anthropic research: 72% -> 90%)
    create_tool(
        name="meraki_list_organizations",
        description="List all organizations accessible to the API key",
        platform="meraki",
        category="organizations",
        handler=handle_list_organizations,
        examples=[
            {"query": "What organizations do I have access to?", "params": {}},
            {"query": "List all my Meraki organizations", "params": {}},
            {"query": "Show me available orgs", "params": {}},
        ],
    ),
    create_tool(
        name="meraki_get_organization",
        description="Get details of a specific organization",
        platform="meraki",
        category="organizations",
        properties={"organization_id": {"type": "string", "description": "Organization ID"}},
        handler=handle_get_organization,
        examples=[
            {"query": "Get details for org 123456", "params": {"organization_id": "123456"}},
            {"query": "Show organization info", "params": {"organization_id": "123456"}},
        ],
    ),
    create_tool(
        name="meraki_list_organization_networks",
        description="List all networks in an organization",
        platform="meraki",
        category="organizations",
        properties={"organization_id": {"type": "string", "description": "Organization ID"}},
        handler=handle_list_organization_networks,
        examples=[
            {"query": "List all networks in my org", "params": {}},
            {"query": "Show networks for organization 123456", "params": {"organization_id": "123456"}},
            {"query": "What networks are configured?", "params": {}},
        ],
    ),
    create_tool(
        name="meraki_list_organization_devices",
        description="List all devices in an organization with optional filters",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {"type": "string", "description": "Organization ID"},
            "networkIds": {"type": "array", "items": {"type": "string"}, "description": "Filter by network IDs"},
            "productTypes": {"type": "array", "items": {"type": "string"}, "description": "Filter by product types"},
            "model": {"type": "string", "description": "Filter by model"},
            "tags": {"type": "array", "items": {"type": "string"}, "description": "Filter by tags"},
        },
        handler=handle_list_organization_devices,
        examples=[
            {"query": "List all devices in my org", "params": {}},
            {"query": "Show all MX devices", "params": {"productTypes": ["appliance"]}},
            {"query": "Find all MR33 access points", "params": {"model": "MR33"}},
        ],
    ),
    create_tool(
        name="meraki_get_organization_inventory",
        description="Get all devices in organization inventory (claimed and unclaimed)",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {"type": "string", "description": "Organization ID"},
            "usedState": {"type": "string", "description": "Filter by used state (used, unused)"},
            "search": {"type": "string", "description": "Search string"},
        },
        handler=handle_get_organization_inventory,
    ),
    create_tool(
        name="meraki_get_organization_licenses",
        description="Get license overview for the organization",
        platform="meraki",
        category="organizations",
        properties={"organization_id": {"type": "string", "description": "Organization ID"}},
        handler=handle_get_organization_licenses,
    ),
    create_tool(
        name="meraki_get_organization_admins",
        description="Get list of administrators in the organization",
        platform="meraki",
        category="organizations",
        properties={"organization_id": {"type": "string", "description": "Organization ID"}},
        handler=handle_get_organization_admins,
    ),
    create_tool(
        name="meraki_get_organization_config_changes",
        description="Get recent configuration changes in the organization",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {"type": "string", "description": "Organization ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds (max 31 days)"},
            "networkId": {"type": "string", "description": "Filter by network ID"},
        },
        handler=handle_get_organization_config_changes,
    ),
    create_tool(
        name="meraki_get_organization_api_requests",
        description="Get API request log for the organization",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {"type": "string", "description": "Organization ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
            "adminId": {"type": "string", "description": "Filter by admin ID"},
        },
        handler=handle_get_organization_api_requests,
    ),

    # Network Tools - with examples for improved accuracy
    create_tool(
        name="meraki_get_network",
        description="Get details of a specific network",
        platform="meraki",
        category="networks",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_network,
        examples=[
            {"query": "Get details for network L_12345", "params": {"network_id": "L_12345"}},
            {"query": "Show network configuration", "params": {"network_id": "N_12345"}},
        ],
    ),
    create_tool(
        name="meraki_get_network_by_name",
        description="Find a network by name (supports partial match)",
        platform="meraki",
        category="networks",
        properties={
            "name": {"type": "string", "description": "Network name or partial name"},
            "organization_id": {"type": "string", "description": "Organization ID"},
        },
        required=["name"],
        handler=handle_get_network_by_name,
        examples=[
            {"query": "Find the HQ network", "params": {"name": "HQ"}},
            {"query": "Get the Main Office network", "params": {"name": "Main Office"}},
            {"query": "Search for branch networks", "params": {"name": "branch"}},
        ],
    ),
    create_tool(
        name="meraki_list_network_devices",
        description="List all devices in a network",
        platform="meraki",
        category="devices",  # Changed from "networks" to match device queries
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_list_network_devices,
        examples=[
            {"query": "List devices in network L_12345", "params": {"network_id": "L_12345"}},
            {"query": "Show all devices in this network", "params": {}},
        ],
    ),
    create_tool(
        name="meraki_get_network_clients",
        description="Get clients in a network",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
            "t0": {"type": "string", "description": "Start time (ISO 8601)"},
        },
        required=["network_id"],
        handler=handle_get_network_clients,
        examples=[
            {"query": "Show clients connected to the network", "params": {}},
            {"query": "Get clients from last 24 hours", "params": {"timespan": 86400}},
            {"query": "List clients for network L_12345", "params": {"network_id": "L_12345"}},
        ],
    ),
    create_tool(
        name="meraki_get_network_traffic",
        description="Get traffic analysis data for a network",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
        },
        required=["network_id"],
        handler=handle_get_network_traffic,
    ),
    create_tool(
        name="meraki_get_network_events",
        description="Get network events log",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "productType": {"type": "string", "description": "Filter by product type"},
            "deviceSerial": {"type": "string", "description": "Filter by device serial"},
        },
        required=["network_id"],
        handler=handle_get_network_events,
    ),
    create_tool(
        name="meraki_get_network_alerts_settings",
        description="Get alert settings for a network",
        platform="meraki",
        category="networks",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_network_alerts_settings,
    ),

    # Device Tools - with examples for improved accuracy
    create_tool(
        name="meraki_get_device",
        description="Get device details by serial number or model name (e.g., MX68, MR36)",
        platform="meraki",
        category="devices",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "device_model": {"type": "string", "description": "Device model (e.g., MX68, MR36)"},
            "device_name": {"type": "string", "description": "Device name"},
        },
        handler=handle_get_device,
        tags=["mx68", "mr36", "ms", "mv", "mt", "mg", "appliance", "switch", "ap", "camera", "sensor"],
        examples=[
            {"query": "Get details on the MX68", "params": {"device_model": "MX68"}},
            {"query": "Show device info for serial Q2KY-1234-ABCD", "params": {"serial": "Q2KY-1234-ABCD"}},
            {"query": "What's the status of the Garage router?", "params": {"device_name": "Garage"}},
        ],
    ),
    create_tool(
        name="meraki_update_device",
        description="Update device settings (name, address, tags, etc.)",
        platform="meraki",
        category="devices",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "name": {"type": "string", "description": "Device name"},
            "address": {"type": "string", "description": "Physical address"},
            "notes": {"type": "string", "description": "Notes"},
            "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags"},
            "lat": {"type": "number", "description": "Latitude"},
            "lng": {"type": "number", "description": "Longitude"},
        },
        required=["serial"],
        handler=handle_update_device,
        requires_write=True,
        examples=[
            {"query": "Rename device Q2KY-1234 to Main Router", "params": {"serial": "Q2KY-1234", "name": "Main Router"}},
            {"query": "Add office tag to device", "params": {"serial": "Q2KY-1234", "tags": ["office"]}},
        ],
    ),
    create_tool(
        name="meraki_reboot_device",
        description="Reboot a device",
        platform="meraki",
        category="devices",
        properties={"serial": {"type": "string", "description": "Device serial number"}},
        required=["serial"],
        handler=handle_reboot_device,
        requires_write=True,
    ),
    create_tool(
        name="meraki_blink_device_leds",
        description="Blink device LEDs for identification",
        platform="meraki",
        category="devices",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "duration": {"type": "integer", "description": "Duration in seconds"},
        },
        required=["serial"],
        handler=handle_blink_device_leds,
        requires_write=True,
    ),
    create_tool(
        name="meraki_get_device_clients",
        description="Get clients connected to a device",
        platform="meraki",
        category="devices",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
        },
        required=["serial"],
        handler=handle_get_device_clients,
    ),
    create_tool(
        name="meraki_get_device_lldp_cdp",
        description="Get LLDP/CDP neighbor information",
        platform="meraki",
        category="devices",
        properties={"serial": {"type": "string", "description": "Device serial number"}},
        required=["serial"],
        handler=handle_get_device_lldp_cdp,
    ),
    create_tool(
        name="meraki_get_device_management_interface",
        description="Get device management interface settings",
        platform="meraki",
        category="devices",
        properties={"serial": {"type": "string", "description": "Device serial number"}},
        required=["serial"],
        handler=handle_get_device_management_interface,
    ),
    create_tool(
        name="meraki_create_device_ping",
        description="Create a ping test from a device",
        platform="meraki",
        category="devices",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "target": {"type": "string", "description": "Target IP or hostname"},
            "count": {"type": "integer", "description": "Number of pings"},
        },
        required=["serial", "target"],
        handler=handle_create_device_ping,
    ),
    create_tool(
        name="meraki_get_device_ping_result",
        description="Get ping test results",
        platform="meraki",
        category="devices",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "ping_id": {"type": "string", "description": "Ping test ID"},
        },
        required=["serial", "ping_id"],
        handler=handle_get_device_ping_result,
    ),
    create_tool(
        name="meraki_get_device_loss_latency",
        description="Get device loss and latency history",
        platform="meraki",
        category="devices",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "t0": {"type": "string", "description": "Start time"},
            "t1": {"type": "string", "description": "End time"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
            "uplink": {"type": "string", "description": "Uplink (wan1 or wan2)"},
            "ip": {"type": "string", "description": "Destination IP"},
        },
        required=["serial"],
        handler=handle_get_device_loss_latency,
    ),

    # Wireless Tools - with examples for improved accuracy
    create_tool(
        name="meraki_list_ssids",
        description="List all SSIDs (slots 0-14) in a network",
        platform="meraki",
        category="wireless",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_list_ssids,
        examples=[
            {"query": "List all SSIDs in this network", "params": {}},
            {"query": "Show wireless networks configured", "params": {}},
            {"query": "What SSIDs are configured on my network?", "params": {}},
        ],
    ),
    create_tool(
        name="meraki_get_ssid",
        description="Get SSID details",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "number": {"type": "integer", "description": "SSID number (0-14)"},
        },
        required=["network_id", "number"],
        handler=handle_get_ssid,
        examples=[
            {"query": "Get SSID 0 configuration", "params": {"number": 0}},
            {"query": "Show details for SSID number 1", "params": {"number": 1}},
        ],
    ),
    create_tool(
        name="meraki_update_ssid",
        description="Update SSID configuration",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "number": {"type": "integer", "description": "SSID number (0-14)"},
            "name": {"type": "string", "description": "SSID name"},
            "enabled": {"type": "boolean", "description": "Enable/disable SSID"},
            "authMode": {"type": "string", "description": "Authentication mode"},
            "psk": {"type": "string", "description": "PSK password"},
            "visible": {"type": "boolean", "description": "Broadcast SSID"},
            "vlanId": {"type": "integer", "description": "VLAN ID"},
        },
        required=["network_id", "number"],
        handler=handle_update_ssid,
        requires_write=True,
    ),
    create_tool(
        name="meraki_get_ssid_splash_settings",
        description="Get SSID splash page settings",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "number": {"type": "integer", "description": "SSID number"},
        },
        required=["network_id", "number"],
        handler=handle_get_ssid_splash_settings,
    ),
    create_tool(
        name="meraki_list_wireless_rf_profiles",
        description="List RF profiles for a network",
        platform="meraki",
        category="wireless",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_list_wireless_rf_profiles,
    ),
    create_tool(
        name="meraki_get_device_wireless_status",
        description="Get wireless status for an AP",
        platform="meraki",
        category="wireless",
        properties={"serial": {"type": "string", "description": "AP serial number"}},
        required=["serial"],
        handler=handle_get_device_wireless_status,
    ),
    create_tool(
        name="meraki_get_wireless_connection_stats",
        description="Get wireless connection statistics",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
            "band": {"type": "string", "description": "Filter by band (2.4, 5, 6)"},
            "ssid": {"type": "integer", "description": "Filter by SSID number"},
        },
        required=["network_id"],
        handler=handle_get_wireless_connection_stats,
    ),
    create_tool(
        name="meraki_get_wireless_client_count_history",
        description="Get wireless client count history",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
            "resolution": {"type": "integer", "description": "Resolution in seconds"},
        },
        required=["network_id"],
        handler=handle_get_wireless_client_count_history,
    ),
    create_tool(
        name="meraki_get_wireless_latency_stats",
        description="Get wireless latency statistics",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
        },
        required=["network_id"],
        handler=handle_get_wireless_latency_stats,
    ),
    create_tool(
        name="meraki_get_wireless_channel_utilization",
        description="Get wireless channel utilization history",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
        },
        required=["network_id"],
        handler=handle_get_wireless_channel_utilization,
    ),

    # Appliance Tools (VLANs) - with examples for improved accuracy
    create_tool(
        name="meraki_list_vlans",
        description="List VLANs in a network",
        platform="meraki",
        category="appliance",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_list_vlans,
        examples=[
            {"query": "List VLANs in this network", "params": {}},
            {"query": "Show all VLANs configured on the MX", "params": {}},
            {"query": "Get VLANs for network L_12345", "params": {"network_id": "L_12345"}},
        ],
    ),
    create_tool(
        name="meraki_get_vlan",
        description="Get VLAN details",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "vlan_id": {"type": "string", "description": "VLAN ID"},
        },
        required=["network_id", "vlan_id"],
        handler=handle_get_vlan,
        examples=[
            {"query": "Get VLAN 10 details", "params": {"vlan_id": "10"}},
            {"query": "Show configuration for VLAN 100", "params": {"vlan_id": "100"}},
        ],
    ),
    create_tool(
        name="meraki_create_vlan",
        description="Create a new VLAN",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "id": {"type": "string", "description": "VLAN ID"},
            "name": {"type": "string", "description": "VLAN name"},
            "subnet": {"type": "string", "description": "Subnet (e.g., 192.168.1.0/24)"},
            "applianceIp": {"type": "string", "description": "MX IP in this VLAN"},
        },
        required=["network_id", "id", "name"],
        handler=handle_create_vlan,
        requires_write=True,
    ),
    create_tool(
        name="meraki_update_vlan",
        description="Update VLAN settings",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "vlan_id": {"type": "string", "description": "VLAN ID"},
            "name": {"type": "string", "description": "VLAN name"},
            "subnet": {"type": "string", "description": "Subnet"},
            "applianceIp": {"type": "string", "description": "MX IP"},
        },
        required=["network_id", "vlan_id"],
        handler=handle_update_vlan,
        requires_write=True,
    ),
    create_tool(
        name="meraki_delete_vlan",
        description="Delete a VLAN",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "vlan_id": {"type": "string", "description": "VLAN ID"},
        },
        required=["network_id", "vlan_id"],
        handler=handle_delete_vlan,
        requires_write=True,
    ),

    # Appliance Tools (Firewall)
    create_tool(
        name="meraki_get_appliance_firewall_rules",
        description="Get L3 firewall rules",
        platform="meraki",
        category="appliance",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_appliance_firewall_rules,
    ),
    create_tool(
        name="meraki_update_appliance_firewall_rules",
        description="Update L3 firewall rules",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "rules": {"type": "array", "description": "Firewall rules array"},
        },
        required=["network_id", "rules"],
        handler=handle_update_appliance_firewall_rules,
        requires_write=True,
    ),

    # Appliance Tools (VPN)
    create_tool(
        name="meraki_get_appliance_vpn_site_to_site",
        description="Get site-to-site VPN configuration",
        platform="meraki",
        category="appliance",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_appliance_vpn_site_to_site,
    ),
    create_tool(
        name="meraki_update_appliance_vpn_site_to_site",
        description="Update site-to-site VPN settings",
        platform="meraki",
        category="appliance",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "mode": {"type": "string", "description": "VPN mode (none, spoke, hub)"},
            "hubs": {"type": "array", "description": "Hub network IDs"},
            "subnets": {"type": "array", "description": "Subnets to include"},
        },
        required=["network_id"],
        handler=handle_update_appliance_vpn_site_to_site,
        requires_write=True,
    ),
    create_tool(
        name="meraki_get_appliance_ports",
        description="Get MX appliance port configuration",
        platform="meraki",
        category="appliance",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_appliance_ports,
    ),
    create_tool(
        name="meraki_get_appliance_uplinks_status",
        description="Get appliance uplink statuses organization-wide",
        platform="meraki",
        category="appliance",
        properties={"organization_id": {"type": "string", "description": "Organization ID"}},
        handler=handle_get_appliance_uplinks_status,
    ),
    create_tool(
        name="meraki_get_appliance_dhcp_subnets",
        description="Get DHCP subnet info for an MX appliance",
        platform="meraki",
        category="appliance",
        properties={"serial": {"type": "string", "description": "MX serial number"}},
        required=["serial"],
        handler=handle_get_appliance_dhcp_subnets,
    ),
    create_tool(
        name="meraki_get_appliance_security_intrusion",
        description="Get intrusion detection settings",
        platform="meraki",
        category="appliance",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_appliance_security_intrusion,
    ),
    create_tool(
        name="meraki_get_appliance_security_malware",
        description="Get malware protection settings",
        platform="meraki",
        category="appliance",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_appliance_security_malware,
    ),
    create_tool(
        name="meraki_get_appliance_content_filtering",
        description="Get content filtering settings",
        platform="meraki",
        category="appliance",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_appliance_content_filtering,
    ),

    # Switch Tools
    create_tool(
        name="meraki_list_switch_ports",
        description="List all ports on a switch",
        platform="meraki",
        category="switch",
        properties={"serial": {"type": "string", "description": "Switch serial number"}},
        required=["serial"],
        handler=handle_list_switch_ports,
    ),
    create_tool(
        name="meraki_get_switch_port",
        description="Get switch port details",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "port_id": {"type": "string", "description": "Port ID"},
        },
        required=["serial", "port_id"],
        handler=handle_get_switch_port,
    ),
    create_tool(
        name="meraki_update_switch_port",
        description="Update switch port configuration",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "port_id": {"type": "string", "description": "Port ID"},
            "name": {"type": "string", "description": "Port name"},
            "enabled": {"type": "boolean", "description": "Enable/disable port"},
            "poeEnabled": {"type": "boolean", "description": "Enable/disable PoE"},
            "type": {"type": "string", "description": "Port type (trunk, access)"},
            "vlan": {"type": "integer", "description": "Access VLAN"},
            "voiceVlan": {"type": "integer", "description": "Voice VLAN"},
            "allowedVlans": {"type": "string", "description": "Allowed VLANs for trunk"},
        },
        required=["serial", "port_id"],
        handler=handle_update_switch_port,
        requires_write=True,
    ),
    create_tool(
        name="meraki_get_switch_ports_statuses",
        description="Get switch port statuses organization-wide",
        platform="meraki",
        category="switch",
        properties={"organization_id": {"type": "string", "description": "Organization ID"}},
        handler=handle_get_switch_ports_statuses,
    ),
    create_tool(
        name="meraki_get_switch_routing_interfaces",
        description="Get L3 routing interfaces on a switch",
        platform="meraki",
        category="switch",
        properties={"serial": {"type": "string", "description": "Switch serial number"}},
        required=["serial"],
        handler=handle_get_switch_routing_interfaces,
    ),
    create_tool(
        name="meraki_get_switch_routing_static_routes",
        description="Get static routes on a switch",
        platform="meraki",
        category="switch",
        properties={"serial": {"type": "string", "description": "Switch serial number"}},
        required=["serial"],
        handler=handle_get_switch_routing_static_routes,
    ),
    create_tool(
        name="meraki_list_switch_stacks",
        description="List switch stacks in a network",
        platform="meraki",
        category="switch",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_list_switch_stacks,
    ),
    create_tool(
        name="meraki_get_switch_acls",
        description="Get switch access control lists",
        platform="meraki",
        category="switch",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_switch_acls,
    ),
    create_tool(
        name="meraki_get_switch_dhcp_server_policy",
        description="Get DHCP server policy for switches",
        platform="meraki",
        category="switch",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_switch_dhcp_server_policy,
    ),

    # Camera Tools
    create_tool(
        name="meraki_get_camera_video_settings",
        description="Get camera video settings",
        platform="meraki",
        category="camera",
        properties={"serial": {"type": "string", "description": "Camera serial number"}},
        required=["serial"],
        handler=handle_get_camera_video_settings,
    ),
    create_tool(
        name="meraki_get_camera_quality_retention",
        description="Get camera quality and retention settings",
        platform="meraki",
        category="camera",
        properties={"serial": {"type": "string", "description": "Camera serial number"}},
        required=["serial"],
        handler=handle_get_camera_quality_retention,
    ),
    create_tool(
        name="meraki_get_camera_sense",
        description="Get camera analytics (MV Sense) settings",
        platform="meraki",
        category="camera",
        properties={"serial": {"type": "string", "description": "Camera serial number"}},
        required=["serial"],
        handler=handle_get_camera_sense,
    ),
    create_tool(
        name="meraki_get_camera_wireless_profiles",
        description="Get camera wireless profiles for a network",
        platform="meraki",
        category="camera",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_get_camera_wireless_profiles,
    ),
    create_tool(
        name="meraki_generate_camera_snapshot",
        description="Generate a camera snapshot",
        platform="meraki",
        category="camera",
        properties={
            "serial": {"type": "string", "description": "Camera serial number"},
            "timestamp": {"type": "string", "description": "Timestamp for snapshot"},
            "fullframe": {"type": "boolean", "description": "Full resolution frame"},
        },
        required=["serial"],
        handler=handle_generate_camera_snapshot,
    ),
    create_tool(
        name="meraki_get_camera_video_link",
        description="Get video link for a camera",
        platform="meraki",
        category="camera",
        properties={
            "serial": {"type": "string", "description": "Camera serial number"},
            "timestamp": {"type": "string", "description": "Timestamp for video"},
        },
        required=["serial"],
        handler=handle_get_camera_video_link,
    ),

    # Sensor Tools
    create_tool(
        name="meraki_list_sensor_alerts_profiles",
        description="List sensor alert profiles",
        platform="meraki",
        category="sensor",
        properties={"network_id": {"type": "string", "description": "Network ID"}},
        required=["network_id"],
        handler=handle_list_sensor_alerts_profiles,
    ),
    create_tool(
        name="meraki_get_sensor_readings_latest",
        description="Get latest sensor readings organization-wide",
        platform="meraki",
        category="sensor",
        properties={
            "organization_id": {"type": "string", "description": "Organization ID"},
            "metrics": {"type": "array", "items": {"type": "string"}, "description": "Metrics to include"},
            "serials": {"type": "array", "items": {"type": "string"}, "description": "Sensor serials"},
        },
        handler=handle_get_sensor_readings_latest,
    ),
    create_tool(
        name="meraki_get_sensor_readings_history",
        description="Get sensor readings history",
        platform="meraki",
        category="sensor",
        properties={
            "organization_id": {"type": "string", "description": "Organization ID"},
            "timespan": {"type": "integer", "description": "Timespan in seconds"},
            "metrics": {"type": "array", "items": {"type": "string"}, "description": "Metrics"},
        },
        handler=handle_get_sensor_readings_history,
    ),

    # Systems Manager Tools
    create_tool(
        name="meraki_list_sm_devices",
        description="List Systems Manager managed devices",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "fields": {"type": "array", "items": {"type": "string"}, "description": "Fields to include"},
        },
        required=["network_id"],
        handler=handle_list_sm_devices,
    ),
    create_tool(
        name="meraki_get_sm_device_profiles",
        description="Get profiles for an SM device",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "device_id": {"type": "string", "description": "SM device ID"},
        },
        required=["network_id", "device_id"],
        handler=handle_get_sm_device_profiles,
    ),
    create_tool(
        name="meraki_list_sm_users",
        description="List Systems Manager users",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "emails": {"type": "array", "items": {"type": "string"}, "description": "Filter by emails"},
        },
        required=["network_id"],
        handler=handle_list_sm_users,
    ),
]


# =============================================================================
# REGISTRATION
# =============================================================================

def register_meraki_tools():
    """Register all Meraki tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_TOOLS)
    logger.info(f"[Meraki Tools] Registered {len(MERAKI_TOOLS)} tools")


# Auto-register on import
register_meraki_tools()

# Import generated modules (they auto-register)
try:
    from . import appliance
    from . import camera
    from . import devices
    from . import insight
    from . import licensing
    from . import networks
    from . import organizations
    from . import sensor
    from . import sm
    from . import switch
    from . import wireless
    logger.info("[Meraki Tools] Loaded generated tool modules")
except ImportError as e:
    logger.warning(f"[Meraki Tools] Could not load some generated modules: {e}")
