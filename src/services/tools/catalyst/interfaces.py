"""
Catalyst Interfaces Tools

Auto-generated from archived A2A skills.
Total tools: 15
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_interfaces_get_all(params: Dict, context: Any) -> Dict:
    """Handler for Get All Interfaces."""
    try:
        # Build API path
        path = "/interfaces/get/all"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Interface by ID."""
    try:
        # Build API path
        path = "/interfaces/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_by_ip(params: Dict, context: Any) -> Dict:
    """Handler for Get Interface by IP."""
    try:
        # Build API path
        path = "/interfaces/get/by/ip"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_by_device(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Interfaces."""
    try:
        # Build API path
        path = "/interfaces/get/by/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_by_range(params: Dict, context: Any) -> Dict:
    """Handler for Get Interfaces by Range."""
    try:
        # Build API path
        path = "/interfaces/get/by/range"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Interface Count."""
    try:
        # Build API path
        path = "/interfaces/get/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_by_name(params: Dict, context: Any) -> Dict:
    """Handler for Get Interface by Name."""
    try:
        # Build API path
        path = "/interfaces/get/by/name"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_update(params: Dict, context: Any) -> Dict:
    """Handler for Update Interface."""
    try:
        # Build API path
        path = "/interfaces/update"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_vlans(params: Dict, context: Any) -> Dict:
    """Handler for Get Device VLANs."""
    try:
        # Build API path
        path = "/interfaces/get/vlans"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_ospf(params: Dict, context: Any) -> Dict:
    """Handler for Get OSPF Interfaces."""
    try:
        # Build API path
        path = "/interfaces/get/ospf"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_isis(params: Dict, context: Any) -> Dict:
    """Handler for Get IS-IS Interfaces."""
    try:
        # Build API path
        path = "/interfaces/get/isis"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_clear_mac_table(params: Dict, context: Any) -> Dict:
    """Handler for Clear Interface MAC Table."""
    try:
        # Build API path
        path = "/interfaces/clear/mac/table"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_statistics(params: Dict, context: Any) -> Dict:
    """Handler for Get Interface Statistics."""
    try:
        # Build API path
        path = "/interfaces/get/statistics"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_query(params: Dict, context: Any) -> Dict:
    """Handler for Query Interfaces."""
    try:
        # Build API path
        path = "/interfaces/query"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_interfaces_get_connected_device(params: Dict, context: Any) -> Dict:
    """Handler for Get Connected Device Details."""
    try:
        # Build API path
        path = "/interfaces/get/connected/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_INTERFACES_TOOLS = [
    create_tool(
        name="catalyst_interfaces_get_all",
        description="""Get a list of all network interfaces across all devices in Catalyst Center. Returns interface details including status, speed, duplex, and VLAN assignment.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            }
},
        required=[],
        tags=["catalyst", "interfaces", "inventory", "list"],
        requires_write=False,
        handler=handle_interfaces_get_all,
    ),
    create_tool(
        name="catalyst_interfaces_get_by_id",
        description="""Get detailed information about a specific interface using its UUID.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "interface_id": {
                        "description": "Interface UUID to retrieve"
            }
},
        required=["interface_id"],
        tags=["catalyst", "interfaces", "details"],
        requires_write=False,
        handler=handle_interfaces_get_by_id,
    ),
    create_tool(
        name="catalyst_interfaces_get_by_ip",
        description="""Get interface information using the IP address configured on the interface.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "ip_address": {
                        "description": "IP address configured on the interface"
            }
},
        required=["ip_address"],
        tags=["catalyst", "interfaces", "ip", "lookup"],
        requires_write=False,
        handler=handle_interfaces_get_by_ip,
    ),
    create_tool(
        name="catalyst_interfaces_get_by_device",
        description="""Get all interfaces for a specific network device. Returns complete interface inventory for the device including status and configuration.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "device_id": {
                        "description": "Device UUID to get interfaces for"
            }
},
        required=["device_id"],
        tags=["catalyst", "interfaces", "device", "inventory"],
        requires_write=False,
        handler=handle_interfaces_get_by_device,
    ),
    create_tool(
        name="catalyst_interfaces_get_by_range",
        description="""Get interfaces for a device with pagination support. Useful for devices with many interfaces.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "device_id": {
                        "description": "Device UUID"
            },
            "start_index": {
                        "type": "integer",
                        "description": "Starting index (1-based)",
                        "default": 1
            },
            "records_to_return": {
                        "type": "integer",
                        "description": "Number of records to return",
                        "default": 500
            }
},
        required=["device_id"],
        tags=["catalyst", "interfaces", "pagination", "range"],
        requires_write=False,
        handler=handle_interfaces_get_by_range,
    ),
    create_tool(
        name="catalyst_interfaces_get_count",
        description="""Get the total count of interfaces in Catalyst Center inventory.""",
        platform="catalyst",
        category="interfaces",
        properties={},
        required=[],
        tags=["catalyst", "interfaces", "count", "statistics"],
        requires_write=False,
        handler=handle_interfaces_get_count,
    ),
    create_tool(
        name="catalyst_interfaces_get_by_name",
        description="""Get interface details by interface name for a specific device.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "device_id": {
                        "description": "Device UUID"
            },
            "interface_name": {
                        "type": "string",
                        "description": "Interface name (e.g., 'GigabitEthernet1/0/1')"
            }
},
        required=["device_id", "interface_name"],
        tags=["catalyst", "interfaces", "name", "lookup"],
        requires_write=False,
        handler=handle_interfaces_get_by_name,
    ),
    create_tool(
        name="catalyst_interfaces_update",
        description="""Update interface configuration including description, admin status, VLAN assignment, and voice VLAN.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "interface_id": {
                        "description": "Interface UUID to update"
            },
            "description": {
                        "type": "string",
                        "description": "New interface description"
            },
            "admin_status": {
                        "type": "string",
                        "description": "Administrative status",
                        "enum": [
                                    "UP",
                                    "DOWN"
                        ]
            },
            "vlan_id": {
                        "description": "Access VLAN ID"
            },
            "voice_vlan_id": {
                        "type": "string",
                        "description": "Voice VLAN ID"
            }
},
        required=["interface_id"],
        tags=["catalyst", "interfaces", "update", "configure"],
        requires_write=True,
        handler=handle_interfaces_update,
    ),
    create_tool(
        name="catalyst_interfaces_get_vlans",
        description="""Get VLAN information for a specific device including VLAN IDs, names, and associated interfaces.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "device_id": {
                        "description": "Device UUID to get VLANs for"
            },
            "interface_type": {
                        "type": "string",
                        "description": "Filter by interface type"
            }
},
        required=["device_id"],
        tags=["catalyst", "interfaces", "vlans", "device"],
        requires_write=False,
        handler=handle_interfaces_get_vlans,
    ),
    create_tool(
        name="catalyst_interfaces_get_ospf",
        description="""Get interfaces running OSPF (Open Shortest Path First) routing protocol.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            }
},
        required=[],
        tags=["catalyst", "interfaces", "ospf", "routing"],
        requires_write=False,
        handler=handle_interfaces_get_ospf,
    ),
    create_tool(
        name="catalyst_interfaces_get_isis",
        description="""Get interfaces running IS-IS (Intermediate System to Intermediate System) routing protocol.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            }
},
        required=[],
        tags=["catalyst", "interfaces", "isis", "routing"],
        requires_write=False,
        handler=handle_interfaces_get_isis,
    ),
    create_tool(
        name="catalyst_interfaces_clear_mac_table",
        description="""Clear the MAC address table on a specific interface. Triggers re-learning of MAC addresses on the port.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "interface_id": {
                        "description": "Interface UUID to clear MAC table for"
            },
            "operation": {
                        "type": "string",
                        "description": "Clear operation type",
                        "enum": [
                                    "clearMacAddress"
                        ],
                        "default": "clearMacAddress"
            },
            "deployment_mode": {
                        "type": "string",
                        "description": "Deployment mode",
                        "enum": [
                                    "Deploy",
                                    "Preview"
                        ],
                        "default": "Deploy"
            }
},
        required=["interface_id"],
        tags=["catalyst", "interfaces", "mac", "clear", "operation"],
        requires_write=False,
        handler=handle_interfaces_clear_mac_table,
    ),
    create_tool(
        name="catalyst_interfaces_get_statistics",
        description="""Get interface statistics including input/output packets, errors, discards, and bandwidth utilization.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "device_id": {
                        "description": "Device UUID to get statistics for"
            },
            "interface_id": {
                        "description": "Specific interface UUID (optional)"
            },
            "start_time": {
                        "type": "integer",
                        "description": "Start time in epoch milliseconds"
            },
            "end_time": {
                        "type": "integer",
                        "description": "End time in epoch milliseconds"
            }
},
        required=[],
        tags=["catalyst", "interfaces", "statistics", "metrics", "performance"],
        requires_write=False,
        handler=handle_interfaces_get_statistics,
    ),
    create_tool(
        name="catalyst_interfaces_query",
        description="""Advanced interface query with complex filtering using POST request. Supports filtering by multiple criteria.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "device_id": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of device UUIDs"
            },
            "interface_name": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of interface names"
            },
            "port_name": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of port names"
            },
            "admin_status": {
                        "type": "string",
                        "description": "Filter by admin status",
                        "enum": [
                                    "UP",
                                    "DOWN"
                        ]
            },
            "operational_status": {
                        "type": "string",
                        "description": "Filter by operational status",
                        "enum": [
                                    "up",
                                    "down"
                        ]
            }
},
        required=[],
        tags=["catalyst", "interfaces", "query", "search", "filter"],
        requires_write=False,
        handler=handle_interfaces_query,
    ),
    create_tool(
        name="catalyst_interfaces_get_connected_device",
        description="""Get details about devices connected to a network device's interfaces, including CDP/LLDP neighbor information.""",
        platform="catalyst",
        category="interfaces",
        properties={
            "device_id": {
                        "description": "Device UUID to get connected devices for"
            }
},
        required=["device_id"],
        tags=["catalyst", "interfaces", "neighbors", "cdp", "lldp", "connected"],
        requires_write=False,
        handler=handle_interfaces_get_connected_device,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_interfaces_tools():
    """Register all interfaces tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_INTERFACES_TOOLS)
    logger.info(f"Registered {len(CATALYST_INTERFACES_TOOLS)} catalyst interfaces tools")


# Auto-register on import
register_interfaces_tools()
