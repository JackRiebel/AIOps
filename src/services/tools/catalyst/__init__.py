"""Cisco Catalyst Center API Tools.

This module provides 200+ tools for Catalyst Center operations,
organized into logical categories:
- sites: Site hierarchy and management
- devices: Device inventory and management
- health: Device and network health
- issues: Network issues and resolution
- clients: Client health and details
- topology: Network topology
- assurance: Network assurance
- discovery: Network discovery
- command_runner: Device command execution
- templates: Configuration templates
- swim: Software image management

Tool naming convention: catalyst_{action}_{entity}
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient

logger = logging.getLogger(__name__)


# =============================================================================
# EXECUTION CONTEXT
# =============================================================================

class CatalystExecutionContext:
    """Context for executing Catalyst tools."""
    def __init__(
        self,
        username: str = None,
        password: str = None,
        base_url: str = None,
        api_token: str = None,
        site_id: str = None,
    ):
        self.client = CatalystCenterClient(
            username=username,
            password=password,
            base_url=base_url,
            api_token=api_token
        )
        self.site_id = site_id


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def api_get(client: CatalystCenterClient, path: str, params: Dict = None) -> Any:
    """Make GET request to Catalyst API."""
    response = await client.request("GET", path, params=params)
    return response


async def api_post(client: CatalystCenterClient, path: str, data: Dict = None) -> Any:
    """Make POST request to Catalyst API."""
    response = await client.request("POST", path, json_data=data or {})
    return response


async def api_put(client: CatalystCenterClient, path: str, data: Dict = None) -> Any:
    """Make PUT request to Catalyst API."""
    response = await client.request("PUT", path, json_data=data or {})
    return response


async def api_delete(client: CatalystCenterClient, path: str) -> Any:
    """Make DELETE request to Catalyst API."""
    response = await client.request("DELETE", path)
    return response


def success_result(data: Any = None, message: str = None) -> Dict:
    """Create a success result."""
    result = {"success": True}
    if data is not None:
        result["data"] = data
    if message:
        result["message"] = message
    return result


def error_result(message: str) -> Dict:
    """Create an error result."""
    return {"success": False, "error": message}


# =============================================================================
# SITE TOOLS
# =============================================================================

async def handle_get_sites(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get all sites."""
    query_params = {k: params[k] for k in ["name", "siteId", "type", "offset", "limit"] if params.get(k)}
    data = await api_get(context.client, "/site", params=query_params)
    return success_result(data=data)


async def handle_get_site(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get site by ID."""
    site_id = params.get("site_id") or context.site_id
    if not site_id:
        return error_result("site_id is required")
    data = await api_get(context.client, f"/site/{site_id}")
    return success_result(data=data)


async def handle_get_site_count(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get site count."""
    query_params = {k: params[k] for k in ["siteId"] if params.get(k)}
    data = await api_get(context.client, "/site/count", params=query_params)
    return success_result(data=data)


async def handle_get_site_health(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get site health summary."""
    query_params = {k: params[k] for k in ["timestamp", "siteType", "offset", "limit"] if params.get(k)}
    data = await api_get(context.client, "/site-health", params=query_params)
    return success_result(data=data)


async def handle_create_site(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Create a new site."""
    site_type = params.get("type")
    if not site_type:
        return error_result("type is required (area, building, floor)")
    body = {"type": site_type, "site": {}}
    if site_type == "area":
        body["site"]["area"] = {"name": params.get("name"), "parentName": params.get("parent_name")}
    elif site_type == "building":
        body["site"]["building"] = {
            "name": params.get("name"),
            "parentName": params.get("parent_name"),
            "address": params.get("address"),
            "latitude": params.get("latitude"),
            "longitude": params.get("longitude"),
        }
    elif site_type == "floor":
        body["site"]["floor"] = {
            "name": params.get("name"),
            "parentName": params.get("parent_name"),
            "rfModel": params.get("rf_model", "Cubes And Walled Offices"),
            "width": params.get("width"),
            "length": params.get("length"),
            "height": params.get("height"),
        }
    data = await api_post(context.client, "/site", data=body)
    return success_result(data=data)


# =============================================================================
# DEVICE TOOLS
# =============================================================================

async def handle_get_device_list(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device list with optional filters."""
    query_params = {}
    for key in ["hostname", "managementIpAddress", "macAddress", "family", "type", "series",
                "platformId", "softwareType", "softwareVersion", "role", "reachabilityStatus",
                "upTime", "locationName", "offset", "limit"]:
        if params.get(key):
            query_params[key] = params[key]
    data = await api_get(context.client, "/network-device", params=query_params)
    return success_result(data=data)


async def handle_get_device_by_id(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device by ID."""
    device_id = params.get("device_id")
    if not device_id:
        return error_result("device_id is required")
    data = await api_get(context.client, f"/network-device/{device_id}")
    return success_result(data=data)


async def handle_get_device_by_ip(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device by management IP address."""
    ip_address = params.get("ip_address")
    if not ip_address:
        return error_result("ip_address is required")
    data = await api_get(context.client, f"/network-device/ip-address/{ip_address}")
    return success_result(data=data)


async def handle_get_device_by_serial(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device by serial number."""
    serial = params.get("serial")
    if not serial:
        return error_result("serial is required")
    data = await api_get(context.client, f"/network-device/serial-number/{serial}")
    return success_result(data=data)


async def handle_get_device_count(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device count."""
    data = await api_get(context.client, "/network-device/count")
    return success_result(data=data)


async def handle_get_device_config(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device running configuration."""
    device_id = params.get("device_id")
    if not device_id:
        return error_result("device_id is required")
    data = await api_get(context.client, f"/network-device/{device_id}/config")
    return success_result(data=data)


async def handle_get_device_interfaces(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device interfaces."""
    device_id = params.get("device_id")
    if not device_id:
        return error_result("device_id is required")
    data = await api_get(context.client, f"/interface/network-device/{device_id}")
    return success_result(data=data)


async def handle_sync_devices(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Sync devices by ID."""
    device_ids = params.get("device_ids", [])
    if not device_ids:
        return error_result("device_ids is required")
    body = {"deviceIds": device_ids}
    data = await api_put(context.client, "/network-device/sync", data=body)
    return success_result(data=data)


async def handle_delete_device(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Delete device from inventory."""
    device_id = params.get("device_id")
    if not device_id:
        return error_result("device_id is required")
    data = await api_delete(context.client, f"/network-device/{device_id}")
    return success_result(data=data)


# =============================================================================
# HEALTH TOOLS
# =============================================================================

async def handle_get_overall_network_health(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get overall network health."""
    query_params = {k: params[k] for k in ["timestamp"] if params.get(k)}
    data = await api_get(context.client, "/network-health", params=query_params)
    return success_result(data=data)


async def handle_get_device_health(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device health list."""
    query_params = {k: params[k] for k in ["deviceRole", "siteId", "health", "startTime", "endTime", "limit", "offset"] if params.get(k)}
    data = await api_get(context.client, "/device-health", params=query_params)
    return success_result(data=data)


async def handle_get_device_detail_health(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get detailed device health."""
    identifier = params.get("identifier")
    search_by = params.get("search_by", "macAddress")
    if not identifier:
        return error_result("identifier is required")
    query_params = {"identifier": identifier, "searchBy": search_by}
    if params.get("timestamp"):
        query_params["timestamp"] = params["timestamp"]
    data = await api_get(context.client, "/device-detail", params=query_params)
    return success_result(data=data)


async def handle_get_device_enrichment(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device enrichment details."""
    # Enrichment requires entity type and value in headers
    data = await api_get(context.client, "/device-enrichment-details")
    return success_result(data=data)


# =============================================================================
# CLIENT TOOLS
# =============================================================================

async def handle_get_client_health(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get client health."""
    query_params = {k: params[k] for k in ["timestamp"] if params.get(k)}
    data = await api_get(context.client, "/client-health", params=query_params)
    return success_result(data=data)


async def handle_get_client_detail(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get client detail by MAC address."""
    mac_address = params.get("mac_address")
    if not mac_address:
        return error_result("mac_address is required")
    query_params = {"macAddress": mac_address}
    if params.get("timestamp"):
        query_params["timestamp"] = params["timestamp"]
    data = await api_get(context.client, "/client-detail", params=query_params)
    return success_result(data=data)


async def handle_get_client_enrichment(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get client enrichment details."""
    data = await api_get(context.client, "/client-enrichment-details")
    return success_result(data=data)


# =============================================================================
# ISSUE TOOLS
# =============================================================================

async def handle_get_issues(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get network issues."""
    query_params = {}
    for key in ["startTime", "endTime", "siteId", "deviceId", "macAddress", "priority", "aiDriven", "issueStatus", "offset", "limit"]:
        if params.get(key):
            query_params[key] = params[key]
    data = await api_get(context.client, "/issue", params=query_params)
    return success_result(data=data)


async def handle_get_issue_enrichment(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get issue enrichment details."""
    data = await api_get(context.client, "/issue-enrichment-details")
    return success_result(data=data)


async def handle_execute_suggested_actions(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Execute suggested actions for an issue."""
    issue_id = params.get("issue_id")
    if not issue_id:
        return error_result("issue_id is required")
    data = await api_post(context.client, f"/issue/{issue_id}/suggested-actions")
    return success_result(data=data)


# =============================================================================
# TOPOLOGY TOOLS
# =============================================================================

async def handle_get_physical_topology(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get physical network topology."""
    query_params = {k: params[k] for k in ["nodeType"] if params.get(k)}
    data = await api_get(context.client, "/topology/physical-topology", params=query_params)
    return success_result(data=data)


async def handle_get_site_topology(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get site topology."""
    data = await api_get(context.client, "/topology/site-topology")
    return success_result(data=data)


async def handle_get_vlan_topology(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get VLAN network topology."""
    data = await api_get(context.client, "/topology/vlan/vlan-names")
    return success_result(data=data)


async def handle_get_l3_topology(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get Layer 3 network topology."""
    topology_type = params.get("topology_type", "OSPF")
    data = await api_get(context.client, f"/topology/l3/{topology_type}")
    return success_result(data=data)


# =============================================================================
# PATH TRACE TOOLS
# =============================================================================

async def handle_create_path_trace(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Create a flow analysis (path trace)."""
    source_ip = params.get("source_ip")
    dest_ip = params.get("dest_ip")
    if not source_ip or not dest_ip:
        return error_result("source_ip and dest_ip are required")
    body = {
        "sourceIP": source_ip,
        "destIP": dest_ip,
    }
    for key in ["sourcePort", "destPort", "protocol", "periodicRefresh", "inclusions"]:
        if params.get(key):
            body[key] = params[key]
    data = await api_post(context.client, "/flow-analysis", data=body)
    return success_result(data=data)


async def handle_get_path_trace_result(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get path trace result by flow ID."""
    flow_id = params.get("flow_id")
    if not flow_id:
        return error_result("flow_id is required")
    data = await api_get(context.client, f"/flow-analysis/{flow_id}")
    return success_result(data=data)


async def handle_delete_path_trace(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Delete a flow analysis."""
    flow_id = params.get("flow_id")
    if not flow_id:
        return error_result("flow_id is required")
    data = await api_delete(context.client, f"/flow-analysis/{flow_id}")
    return success_result(data=data)


# =============================================================================
# COMMAND RUNNER TOOLS
# =============================================================================

async def handle_run_read_only_commands(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Run read-only CLI commands on devices."""
    commands = params.get("commands", [])
    device_uuids = params.get("device_uuids", [])
    if not commands:
        return error_result("commands is required")
    if not device_uuids:
        return error_result("device_uuids is required")
    body = {
        "commands": commands,
        "deviceUuids": device_uuids,
    }
    data = await api_post(context.client, "/network-device-poller/cli/read-request", data=body)
    return success_result(data=data)


async def handle_get_command_runner_task(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get command runner task result."""
    task_id = params.get("task_id")
    if not task_id:
        return error_result("task_id is required")
    data = await api_get(context.client, f"/task/{task_id}")
    return success_result(data=data)


# =============================================================================
# DISCOVERY TOOLS
# =============================================================================

async def handle_get_discoveries(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get network discoveries."""
    query_params = {k: params[k] for k in ["offset", "limit"] if params.get(k)}
    data = await api_get(context.client, "/discovery", params=query_params)
    return success_result(data=data)


async def handle_get_discovery_by_id(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get discovery by ID."""
    discovery_id = params.get("discovery_id")
    if not discovery_id:
        return error_result("discovery_id is required")
    data = await api_get(context.client, f"/discovery/{discovery_id}")
    return success_result(data=data)


async def handle_start_discovery(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Start a new network discovery."""
    discovery_type = params.get("discovery_type", "Range")
    name = params.get("name")
    ip_address_list = params.get("ip_address_list")
    if not name:
        return error_result("name is required")
    if not ip_address_list:
        return error_result("ip_address_list is required")
    body = {
        "discoveryType": discovery_type,
        "name": name,
        "ipAddressList": ip_address_list,
        "protocolOrder": params.get("protocol_order", "ssh,telnet"),
    }
    for key in ["cdpLevel", "snmpROCommunity", "snmpRWCommunity", "snmpVersion", "enablePasswordList", "passwordList", "userNameList", "globalCredentialIdList", "retry", "timeout"]:
        if params.get(key):
            body[key] = params[key]
    data = await api_post(context.client, "/discovery", data=body)
    return success_result(data=data)


async def handle_delete_discovery(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Delete a discovery."""
    discovery_id = params.get("discovery_id")
    if not discovery_id:
        return error_result("discovery_id is required")
    data = await api_delete(context.client, f"/discovery/{discovery_id}")
    return success_result(data=data)


async def handle_get_discovered_devices(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get devices from a discovery."""
    discovery_id = params.get("discovery_id")
    if not discovery_id:
        return error_result("discovery_id is required")
    query_params = {k: params[k] for k in ["taskId", "offset", "limit"] if params.get(k)}
    data = await api_get(context.client, f"/discovery/{discovery_id}/network-device", params=query_params)
    return success_result(data=data)


# =============================================================================
# INTERFACE TOOLS
# =============================================================================

async def handle_get_interface_by_id(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get interface by ID."""
    interface_id = params.get("interface_id")
    if not interface_id:
        return error_result("interface_id is required")
    data = await api_get(context.client, f"/interface/{interface_id}")
    return success_result(data=data)


async def handle_get_interface_by_ip(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get interface by IP address."""
    ip_address = params.get("ip_address")
    if not ip_address:
        return error_result("ip_address is required")
    data = await api_get(context.client, f"/interface/ip-address/{ip_address}")
    return success_result(data=data)


async def handle_get_interface_count(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get interface count."""
    data = await api_get(context.client, "/interface/count")
    return success_result(data=data)


# =============================================================================
# SWIM (Software Image Management) TOOLS
# =============================================================================

async def handle_get_software_images(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get software images."""
    query_params = {k: params[k] for k in ["imageFamily", "imageName", "isTaggedGolden", "offset", "limit"] if params.get(k)}
    data = await api_get(context.client, "/image/importation", params=query_params)
    return success_result(data=data)


async def handle_get_device_software_images(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get software images applicable to a device family."""
    device_family = params.get("device_family")
    if not device_family:
        return error_result("device_family is required")
    query_params = {"deviceFamily": device_family}
    data = await api_get(context.client, "/image/activation/device", params=query_params)
    return success_result(data=data)


# =============================================================================
# COMPLIANCE TOOLS
# =============================================================================

async def handle_get_compliance_status(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get device compliance status."""
    query_params = {k: params[k] for k in ["complianceStatus", "deviceUuid", "offset", "limit"] if params.get(k)}
    data = await api_get(context.client, "/compliance", params=query_params)
    return success_result(data=data)


async def handle_get_compliance_detail(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Get compliance detail for a device."""
    device_uuid = params.get("device_uuid")
    if not device_uuid:
        return error_result("device_uuid is required")
    query_params = {"deviceUuid": device_uuid}
    data = await api_get(context.client, "/compliance/detail", params=query_params)
    return success_result(data=data)


async def handle_run_compliance(params: Dict, context: CatalystExecutionContext) -> Dict:
    """Run compliance check on devices."""
    device_uuids = params.get("device_uuids", [])
    if not device_uuids:
        return error_result("device_uuids is required")
    body = {"triggerFull": params.get("trigger_full", True), "deviceUuids": device_uuids}
    data = await api_post(context.client, "/compliance", data=body)
    return success_result(data=data)


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_TOOLS = [
    # Site Tools - with examples for improved accuracy (per Anthropic: 72% → 90%)
    create_tool(
        name="catalyst_get_sites",
        description="Get all sites in the Catalyst Center hierarchy",
        platform="catalyst",
        category="sites",
        properties={
            "name": {"type": "string", "description": "Filter by site name"},
            "type": {"type": "string", "description": "Filter by type (area, building, floor)"},
        },
        handler=handle_get_sites,
        examples=[
            {"query": "List all sites in Catalyst Center", "params": {}},
            {"query": "Show site hierarchy", "params": {}},
            {"query": "Get all buildings", "params": {"type": "building"}},
        ],
    ),
    create_tool(
        name="catalyst_get_site",
        description="Get site details by ID",
        platform="catalyst",
        category="sites",
        properties={"site_id": {"type": "string", "description": "Site UUID"}},
        required=["site_id"],
        handler=handle_get_site,
        examples=[
            {"query": "Get site details for abc-123", "params": {"site_id": "abc-123"}},
        ],
    ),
    create_tool(
        name="catalyst_get_site_count",
        description="Get count of sites",
        platform="catalyst",
        category="sites",
        handler=handle_get_site_count,
        examples=[
            {"query": "How many sites are configured?", "params": {}},
            {"query": "Get total site count", "params": {}},
        ],
    ),
    create_tool(
        name="catalyst_get_site_health",
        description="Get site health summary",
        platform="catalyst",
        category="sites",
        properties={
            "siteType": {"type": "string", "description": "Site type filter"},
            "timestamp": {"type": "string", "description": "Timestamp for historical data"},
        },
        handler=handle_get_site_health,
        examples=[
            {"query": "What is the health of all sites?", "params": {}},
            {"query": "Show site health summary", "params": {}},
            {"query": "Get building health scores", "params": {"siteType": "building"}},
        ],
    ),
    create_tool(
        name="catalyst_create_site",
        description="Create a new site (area, building, or floor)",
        platform="catalyst",
        category="sites",
        properties={
            "type": {"type": "string", "description": "Site type (area, building, floor)"},
            "name": {"type": "string", "description": "Site name"},
            "parent_name": {"type": "string", "description": "Parent site name"},
            "address": {"type": "string", "description": "Building address"},
            "latitude": {"type": "number", "description": "Latitude"},
            "longitude": {"type": "number", "description": "Longitude"},
            "width": {"type": "number", "description": "Floor width"},
            "length": {"type": "number", "description": "Floor length"},
            "height": {"type": "number", "description": "Floor height"},
        },
        required=["type", "name"],
        handler=handle_create_site,
        requires_write=True,
    ),

    # Device Tools - with examples for improved accuracy
    create_tool(
        name="catalyst_get_device_list",
        description="Get list of network devices with optional filters",
        platform="catalyst",
        category="devices",
        properties={
            "hostname": {"type": "string", "description": "Filter by hostname"},
            "managementIpAddress": {"type": "string", "description": "Filter by management IP"},
            "family": {"type": "string", "description": "Filter by device family"},
            "role": {"type": "string", "description": "Filter by role (ACCESS, DISTRIBUTION, CORE)"},
            "reachabilityStatus": {"type": "string", "description": "Filter by reachability"},
            "limit": {"type": "integer", "description": "Maximum results"},
        },
        handler=handle_get_device_list,
        examples=[
            {"query": "List all devices in Catalyst Center", "params": {}},
            {"query": "Show all access switches", "params": {"role": "ACCESS"}},
            {"query": "Get all unreachable devices", "params": {"reachabilityStatus": "Unreachable"}},
            {"query": "Find device by hostname sw1", "params": {"hostname": "sw1"}},
        ],
    ),
    create_tool(
        name="catalyst_get_device_by_id",
        description="Get device details by UUID",
        platform="catalyst",
        category="devices",
        properties={"device_id": {"type": "string", "description": "Device UUID"}},
        required=["device_id"],
        handler=handle_get_device_by_id,
        examples=[
            {"query": "Get device details for uuid abc-123", "params": {"device_id": "abc-123"}},
        ],
    ),
    create_tool(
        name="catalyst_get_device_by_ip",
        description="Get device by management IP address",
        platform="catalyst",
        category="devices",
        properties={"ip_address": {"type": "string", "description": "Management IP address"}},
        required=["ip_address"],
        handler=handle_get_device_by_ip,
        examples=[
            {"query": "Get device at 10.1.1.1", "params": {"ip_address": "10.1.1.1"}},
            {"query": "Find device by IP 192.168.1.100", "params": {"ip_address": "192.168.1.100"}},
        ],
    ),
    create_tool(
        name="catalyst_get_device_by_serial",
        description="Get device by serial number",
        platform="catalyst",
        category="devices",
        properties={"serial": {"type": "string", "description": "Device serial number"}},
        required=["serial"],
        handler=handle_get_device_by_serial,
        examples=[
            {"query": "Get device with serial FCW12345ABC", "params": {"serial": "FCW12345ABC"}},
        ],
    ),
    create_tool(
        name="catalyst_get_device_count",
        description="Get total device count",
        platform="catalyst",
        category="devices",
        handler=handle_get_device_count,
    ),
    create_tool(
        name="catalyst_get_device_config",
        description="Get device running configuration",
        platform="catalyst",
        category="devices",
        properties={"device_id": {"type": "string", "description": "Device UUID"}},
        required=["device_id"],
        handler=handle_get_device_config,
    ),
    create_tool(
        name="catalyst_get_device_interfaces",
        description="Get all interfaces on a device",
        platform="catalyst",
        category="devices",
        properties={"device_id": {"type": "string", "description": "Device UUID"}},
        required=["device_id"],
        handler=handle_get_device_interfaces,
    ),
    create_tool(
        name="catalyst_sync_devices",
        description="Sync (resync) devices by UUID",
        platform="catalyst",
        category="devices",
        properties={"device_ids": {"type": "array", "items": {"type": "string"}, "description": "Device UUIDs to sync"}},
        required=["device_ids"],
        handler=handle_sync_devices,
        requires_write=True,
    ),
    create_tool(
        name="catalyst_delete_device",
        description="Delete device from inventory",
        platform="catalyst",
        category="devices",
        properties={"device_id": {"type": "string", "description": "Device UUID"}},
        required=["device_id"],
        handler=handle_delete_device,
        requires_write=True,
    ),

    # Health Tools - with examples for improved accuracy
    create_tool(
        name="catalyst_get_overall_network_health",
        description="Get overall network health score",
        platform="catalyst",
        category="health",
        properties={"timestamp": {"type": "string", "description": "Timestamp for historical data"}},
        handler=handle_get_overall_network_health,
        examples=[
            {"query": "What is the overall network health?", "params": {}},
            {"query": "Show network health score", "params": {}},
            {"query": "How healthy is my network?", "params": {}},
        ],
    ),
    create_tool(
        name="catalyst_get_device_health",
        description="Get device health list with scores",
        platform="catalyst",
        category="health",
        properties={
            "deviceRole": {"type": "string", "description": "Filter by device role"},
            "siteId": {"type": "string", "description": "Filter by site ID"},
            "health": {"type": "string", "description": "Filter by health (Poor, Fair, Good)"},
        },
        handler=handle_get_device_health,
        examples=[
            {"query": "Show device health scores", "params": {}},
            {"query": "Get all devices with poor health", "params": {"health": "Poor"}},
            {"query": "Show access switch health", "params": {"deviceRole": "ACCESS"}},
        ],
    ),
    create_tool(
        name="catalyst_get_device_detail_health",
        description="Get detailed device health by identifier",
        platform="catalyst",
        category="health",
        properties={
            "identifier": {"type": "string", "description": "Device identifier (MAC, IP, or hostname)"},
            "search_by": {"type": "string", "description": "Search by (macAddress, nwDeviceName, etc.)"},
        },
        required=["identifier"],
        handler=handle_get_device_detail_health,
        examples=[
            {"query": "Get detailed health for device sw1", "params": {"identifier": "sw1"}},
            {"query": "Show health details for 10.1.1.1", "params": {"identifier": "10.1.1.1", "search_by": "managementIpAddress"}},
        ],
    ),
    create_tool(
        name="catalyst_get_device_enrichment",
        description="Get enriched device details",
        platform="catalyst",
        category="health",
        handler=handle_get_device_enrichment,
    ),

    # Client Tools
    create_tool(
        name="catalyst_get_client_health",
        description="Get client health summary",
        platform="catalyst",
        category="clients",
        properties={"timestamp": {"type": "string", "description": "Timestamp"}},
        handler=handle_get_client_health,
    ),
    create_tool(
        name="catalyst_get_client_detail",
        description="Get client details by MAC address",
        platform="catalyst",
        category="clients",
        properties={
            "mac_address": {"type": "string", "description": "Client MAC address"},
            "timestamp": {"type": "string", "description": "Timestamp"},
        },
        required=["mac_address"],
        handler=handle_get_client_detail,
    ),
    create_tool(
        name="catalyst_get_client_enrichment",
        description="Get enriched client details",
        platform="catalyst",
        category="clients",
        handler=handle_get_client_enrichment,
    ),

    # Issue Tools
    create_tool(
        name="catalyst_get_issues",
        description="Get network issues with optional filters",
        platform="catalyst",
        category="issues",
        properties={
            "siteId": {"type": "string", "description": "Filter by site ID"},
            "deviceId": {"type": "string", "description": "Filter by device ID"},
            "macAddress": {"type": "string", "description": "Filter by MAC address"},
            "priority": {"type": "string", "description": "Filter by priority (P1, P2, P3, P4)"},
            "aiDriven": {"type": "boolean", "description": "Filter AI-driven issues"},
            "issueStatus": {"type": "string", "description": "Filter by status"},
        },
        handler=handle_get_issues,
    ),
    create_tool(
        name="catalyst_get_issue_enrichment",
        description="Get enriched issue details",
        platform="catalyst",
        category="issues",
        handler=handle_get_issue_enrichment,
    ),
    create_tool(
        name="catalyst_execute_suggested_actions",
        description="Execute suggested remediation actions for an issue",
        platform="catalyst",
        category="issues",
        properties={"issue_id": {"type": "string", "description": "Issue ID"}},
        required=["issue_id"],
        handler=handle_execute_suggested_actions,
        requires_write=True,
    ),

    # Topology Tools
    create_tool(
        name="catalyst_get_physical_topology",
        description="Get physical network topology",
        platform="catalyst",
        category="topology",
        properties={"nodeType": {"type": "string", "description": "Filter by node type"}},
        handler=handle_get_physical_topology,
    ),
    create_tool(
        name="catalyst_get_site_topology",
        description="Get site hierarchy topology",
        platform="catalyst",
        category="topology",
        handler=handle_get_site_topology,
    ),
    create_tool(
        name="catalyst_get_vlan_topology",
        description="Get VLAN network topology",
        platform="catalyst",
        category="topology",
        handler=handle_get_vlan_topology,
    ),
    create_tool(
        name="catalyst_get_l3_topology",
        description="Get Layer 3 network topology",
        platform="catalyst",
        category="topology",
        properties={"topology_type": {"type": "string", "description": "Topology type (OSPF, ISIS, etc.)"}},
        handler=handle_get_l3_topology,
    ),

    # Path Trace Tools
    create_tool(
        name="catalyst_create_path_trace",
        description="Create a network path trace between two IP addresses",
        platform="catalyst",
        category="path_trace",
        properties={
            "source_ip": {"type": "string", "description": "Source IP address"},
            "dest_ip": {"type": "string", "description": "Destination IP address"},
            "sourcePort": {"type": "string", "description": "Source port"},
            "destPort": {"type": "string", "description": "Destination port"},
            "protocol": {"type": "string", "description": "Protocol (TCP, UDP, etc.)"},
        },
        required=["source_ip", "dest_ip"],
        handler=handle_create_path_trace,
    ),
    create_tool(
        name="catalyst_get_path_trace_result",
        description="Get path trace result by flow ID",
        platform="catalyst",
        category="path_trace",
        properties={"flow_id": {"type": "string", "description": "Flow analysis ID"}},
        required=["flow_id"],
        handler=handle_get_path_trace_result,
    ),
    create_tool(
        name="catalyst_delete_path_trace",
        description="Delete a path trace",
        platform="catalyst",
        category="path_trace",
        properties={"flow_id": {"type": "string", "description": "Flow analysis ID"}},
        required=["flow_id"],
        handler=handle_delete_path_trace,
    ),

    # Command Runner Tools
    create_tool(
        name="catalyst_run_read_only_commands",
        description="Run read-only CLI commands on devices",
        platform="catalyst",
        category="command_runner",
        properties={
            "commands": {"type": "array", "items": {"type": "string"}, "description": "CLI commands to run"},
            "device_uuids": {"type": "array", "items": {"type": "string"}, "description": "Device UUIDs"},
        },
        required=["commands", "device_uuids"],
        handler=handle_run_read_only_commands,
    ),
    create_tool(
        name="catalyst_get_command_runner_task",
        description="Get command runner task result",
        platform="catalyst",
        category="command_runner",
        properties={"task_id": {"type": "string", "description": "Task ID"}},
        required=["task_id"],
        handler=handle_get_command_runner_task,
    ),

    # Discovery Tools
    create_tool(
        name="catalyst_get_discoveries",
        description="Get network discoveries",
        platform="catalyst",
        category="discovery",
        handler=handle_get_discoveries,
    ),
    create_tool(
        name="catalyst_get_discovery_by_id",
        description="Get discovery details by ID",
        platform="catalyst",
        category="discovery",
        properties={"discovery_id": {"type": "string", "description": "Discovery ID"}},
        required=["discovery_id"],
        handler=handle_get_discovery_by_id,
    ),
    create_tool(
        name="catalyst_start_discovery",
        description="Start a new network discovery",
        platform="catalyst",
        category="discovery",
        properties={
            "name": {"type": "string", "description": "Discovery name"},
            "ip_address_list": {"type": "string", "description": "IP range to discover"},
            "discovery_type": {"type": "string", "description": "Discovery type (Range, CDP, LLDP)"},
            "snmpROCommunity": {"type": "string", "description": "SNMP read-only community"},
        },
        required=["name", "ip_address_list"],
        handler=handle_start_discovery,
        requires_write=True,
    ),
    create_tool(
        name="catalyst_delete_discovery",
        description="Delete a discovery",
        platform="catalyst",
        category="discovery",
        properties={"discovery_id": {"type": "string", "description": "Discovery ID"}},
        required=["discovery_id"],
        handler=handle_delete_discovery,
        requires_write=True,
    ),
    create_tool(
        name="catalyst_get_discovered_devices",
        description="Get devices found by a discovery",
        platform="catalyst",
        category="discovery",
        properties={"discovery_id": {"type": "string", "description": "Discovery ID"}},
        required=["discovery_id"],
        handler=handle_get_discovered_devices,
    ),

    # Interface Tools
    create_tool(
        name="catalyst_get_interface_by_id",
        description="Get interface details by ID",
        platform="catalyst",
        category="interfaces",
        properties={"interface_id": {"type": "string", "description": "Interface UUID"}},
        required=["interface_id"],
        handler=handle_get_interface_by_id,
    ),
    create_tool(
        name="catalyst_get_interface_by_ip",
        description="Get interface by IP address",
        platform="catalyst",
        category="interfaces",
        properties={"ip_address": {"type": "string", "description": "Interface IP address"}},
        required=["ip_address"],
        handler=handle_get_interface_by_ip,
    ),
    create_tool(
        name="catalyst_get_interface_count",
        description="Get total interface count",
        platform="catalyst",
        category="interfaces",
        handler=handle_get_interface_count,
    ),

    # SWIM Tools
    create_tool(
        name="catalyst_get_software_images",
        description="Get software images in repository",
        platform="catalyst",
        category="swim",
        properties={
            "imageFamily": {"type": "string", "description": "Filter by image family"},
            "imageName": {"type": "string", "description": "Filter by image name"},
            "isTaggedGolden": {"type": "boolean", "description": "Filter golden images only"},
        },
        handler=handle_get_software_images,
    ),
    create_tool(
        name="catalyst_get_device_software_images",
        description="Get software images applicable to a device family",
        platform="catalyst",
        category="swim",
        properties={"device_family": {"type": "string", "description": "Device family name"}},
        required=["device_family"],
        handler=handle_get_device_software_images,
    ),

    # Compliance Tools
    create_tool(
        name="catalyst_get_compliance_status",
        description="Get device compliance status",
        platform="catalyst",
        category="compliance",
        properties={
            "complianceStatus": {"type": "string", "description": "Filter by status"},
            "deviceUuid": {"type": "string", "description": "Filter by device UUID"},
        },
        handler=handle_get_compliance_status,
    ),
    create_tool(
        name="catalyst_get_compliance_detail",
        description="Get compliance detail for a device",
        platform="catalyst",
        category="compliance",
        properties={"device_uuid": {"type": "string", "description": "Device UUID"}},
        required=["device_uuid"],
        handler=handle_get_compliance_detail,
    ),
    create_tool(
        name="catalyst_run_compliance",
        description="Run compliance check on devices",
        platform="catalyst",
        category="compliance",
        properties={
            "device_uuids": {"type": "array", "items": {"type": "string"}, "description": "Device UUIDs"},
            "trigger_full": {"type": "boolean", "description": "Run full compliance check"},
        },
        required=["device_uuids"],
        handler=handle_run_compliance,
        requires_write=True,
    ),
]


# =============================================================================
# REGISTRATION
# =============================================================================

def register_catalyst_tools():
    """Register all Catalyst tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_TOOLS)
    logger.info(f"[Catalyst Tools] Registered {len(CATALYST_TOOLS)} tools")


# Auto-register on import
register_catalyst_tools()

# Import generated modules (they auto-register)
try:
    from . import clients
    from . import command_runner
    from . import compliance
    from . import devices
    from . import discovery
    from . import events
    from . import health
    from . import interfaces
    from . import issues
    from . import network_settings
    from . import path_trace
    from . import sda
    from . import sites
    from . import swim
    from . import templates
    from . import topology
    from . import wireless
    logger.info("[Catalyst Tools] Loaded generated tool modules")
except ImportError as e:
    logger.warning(f"[Catalyst Tools] Could not load some generated modules: {e}")
