"""
Catalyst Devices Tools

Auto-generated from archived A2A skills.
Total tools: 25
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_devices_get_device_list(params: Dict, context: Any) -> Dict:
    """Handler for Get Device List."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_device_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Device by ID."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_add_device(params: Dict, context: Any) -> Dict:
    """Handler for Add Device."""
    try:
        # Build API path
        path = "/devices/{serial}/add"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_update_device(params: Dict, context: Any) -> Dict:
    """Handler for Update Device."""
    try:
        # Build API path
        path = "/devices/{serial}/update"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_delete_device(params: Dict, context: Any) -> Dict:
    """Handler for Delete Device."""
    try:
        # Build API path
        path = "/devices/{serial}/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_device_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Count."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_sync_devices(params: Dict, context: Any) -> Dict:
    """Handler for Sync Devices."""
    try:
        # Build API path
        path = "/devices/{serial}/sync"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_device_config(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Configuration."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_device_by_ip(params: Dict, context: Any) -> Dict:
    """Handler for Get Device by IP."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_device_by_serial(params: Dict, context: Any) -> Dict:
    """Handler for Get Device by Serial Number."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_query_devices(params: Dict, context: Any) -> Dict:
    """Handler for Query Devices."""
    try:
        # Build API path
        path = "/devices/{serial}/query"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_export_device_list(params: Dict, context: Any) -> Dict:
    """Handler for Export Device List."""
    try:
        # Build API path
        path = "/devices/{serial}/export"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_device_summary(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Summary."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_device_enrichment(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Enrichment Details."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_modules(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Modules."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_chassis(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Chassis."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_stack(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Stack Details."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_poe_details(params: Dict, context: Any) -> Dict:
    """Handler for Get PoE Details."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_functional_capability(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Functional Capability."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_update_role(params: Dict, context: Any) -> Dict:
    """Handler for Update Device Role."""
    try:
        # Build API path
        path = "/devices/{serial}/update"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_update_management_address(params: Dict, context: Any) -> Dict:
    """Handler for Update Management IP Address."""
    try:
        # Build API path
        path = "/devices/{serial}/update"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_polling_interval(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Polling Interval."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_update_resync_interval(params: Dict, context: Any) -> Dict:
    """Handler for Update Resync Interval."""
    try:
        # Build API path
        path = "/devices/{serial}/update"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_delete_with_cleanup(params: Dict, context: Any) -> Dict:
    """Handler for Delete Device with Cleanup."""
    try:
        # Build API path
        path = "/devices/{serial}/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_user_defined_fields(params: Dict, context: Any) -> Dict:
    """Handler for Get User Defined Fields."""
    try:
        # Build API path
        path = "/devices/{serial}/get"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_DEVICES_TOOLS = [
    create_tool(
        name="catalyst_devices_get_device_list",
        description="""Get a list of all network devices in Catalyst Center inventory. Supports filtering by family, series, hostname, management IP, platform, role, reachability status, and more.""",
        platform="catalyst",
        category="devices",
        properties={
            "hostname": {
                        "type": "string",
                        "description": "Filter by hostname (supports wildcards)"
            },
            "management_ip_address": {
                        "type": "string",
                        "description": "Filter by management IP address"
            },
            "mac_address": {
                        "type": "string",
                        "description": "Filter by MAC address"
            },
            "family": {
                        "type": "string",
                        "description": "Family"
            },
            "type": {
                        "type": "string",
                        "description": "Filter by device type (e.g., 'Cisco Catalyst 9300')"
            },
            "series": {
                        "type": "string",
                        "description": "Filter by device series"
            },
            "platform_id": {
                        "type": "string",
                        "description": "Filter by platform ID"
            },
            "software_type": {
                        "type": "string",
                        "description": "Filter by software type (IOS, IOS-XE, etc.)"
            },
            "software_version": {
                        "type": "string",
                        "description": "Filter by software version"
            },
            "role": {
                        "type": "string",
                        "description": "Filter by device role",
                        "enum": [
                                    "ACCESS",
                                    "DISTRIBUTION",
                                    "CORE",
                                    "BORDER ROUTER",
                                    "UNKNOWN"
                        ]
            },
            "reachability_status": {
                        "type": "string",
                        "description": "Reachability Status"
            },
            "up_time": {
                        "type": "string",
                        "description": "Filter by uptime (e.g., '> 10 days')"
            },
            "location_name": {
                        "type": "string",
                        "description": "Filter by location/site name"
            },
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
        tags=["catalyst", "devices", "inventory", "list"],
        requires_write=False,
        handler=handle_devices_get_device_list,
    ),
    create_tool(
        name="catalyst_devices_get_device_by_id",
        description="""Get detailed information about a specific network device using its UUID. Returns comprehensive device details including hardware, software, and status.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to retrieve"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "details", "uuid"],
        requires_write=False,
        handler=handle_devices_get_device_by_id,
    ),
    create_tool(
        name="catalyst_devices_add_device",
        description="""Add a new network device to Catalyst Center inventory. Requires device IP, SNMP credentials, and optionally CLI credentials for full management.""",
        platform="catalyst",
        category="devices",
        properties={
            "ip_address": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of IP addresses of devices to add"
            },
            "snmp_version": {
                        "type": "string",
                        "description": "SNMP version",
                        "enum": [
                                    "v2",
                                    "v3"
                        ]
            },
            "snmp_ro_community": {
                        "type": "string",
                        "description": "SNMP read-only community string (v2)"
            },
            "snmp_rw_community": {
                        "type": "string",
                        "description": "SNMP read-write community string (v2)"
            },
            "snmp_username": {
                        "type": "string",
                        "description": "SNMPv3 username"
            },
            "snmp_auth_protocol": {
                        "type": "string",
                        "description": "SNMPv3 auth protocol",
                        "enum": [
                                    "SHA",
                                    "MD5"
                        ]
            },
            "snmp_auth_passphrase": {
                        "type": "string",
                        "description": "SNMPv3 auth passphrase"
            },
            "snmp_priv_protocol": {
                        "type": "string",
                        "description": "SNMPv3 privacy protocol",
                        "enum": [
                                    "AES128",
                                    "DES"
                        ]
            },
            "snmp_priv_passphrase": {
                        "type": "string",
                        "description": "SNMPv3 privacy passphrase"
            },
            "cli_transport": {
                        "type": "string",
                        "description": "CLI transport protocol",
                        "enum": [
                                    "ssh",
                                    "telnet"
                        ]
            },
            "username": {
                        "type": "string",
                        "description": "CLI username"
            },
            "password": {
                        "type": "string",
                        "description": "CLI password"
            },
            "enable_password": {
                        "type": "string",
                        "description": "Enable password"
            },
            "http_username": {
                        "type": "string",
                        "description": "HTTP username (for WLCs)"
            },
            "http_password": {
                        "type": "string",
                        "description": "HTTP password (for WLCs)"
            },
            "http_port": {
                        "type": "string",
                        "description": "HTTP port"
            }
},
        required=["ip_address"],
        tags=["catalyst", "devices", "add", "discovery", "inventory"],
        requires_write=False,
        handler=handle_devices_add_device,
    ),
    create_tool(
        name="catalyst_devices_update_device",
        description="""Update an existing network device's configuration in Catalyst Center. Can update credentials, role, and other device properties.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            },
            "role": {
                        "type": "string",
                        "description": "New device role",
                        "enum": [
                                    "ACCESS",
                                    "DISTRIBUTION",
                                    "CORE",
                                    "BORDER ROUTER"
                        ]
            },
            "username": {
                        "type": "string",
                        "description": "Updated CLI username"
            },
            "password": {
                        "type": "string",
                        "description": "Updated CLI password"
            },
            "enable_password": {
                        "type": "string",
                        "description": "Updated enable password"
            },
            "snmp_ro_community": {
                        "type": "string",
                        "description": "Updated SNMP read-only community"
            },
            "snmp_rw_community": {
                        "type": "string",
                        "description": "Updated SNMP read-write community"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "update", "modify"],
        requires_write=True,
        handler=handle_devices_update_device,
    ),
    create_tool(
        name="catalyst_devices_delete_device",
        description="""Delete a network device from Catalyst Center inventory. This removes the device from management but does not affect the physical device.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to delete"
            },
            "clean_config": {
                        "type": "boolean",
                        "description": "Remove device configuration from Catalyst Center",
                        "default": False
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "delete", "remove"],
        requires_write=True,
        handler=handle_devices_delete_device,
    ),
    create_tool(
        name="catalyst_devices_get_device_count",
        description="""Get the total count of network devices in Catalyst Center, optionally filtered by various criteria.""",
        platform="catalyst",
        category="devices",
        properties={
            "hostname": {
                        "type": "string",
                        "description": "Filter count by hostname"
            },
            "management_ip_address": {
                        "type": "string",
                        "description": "Filter count by management IP"
            },
            "family": {
                        "type": "string",
                        "description": "Family"
            },
            "reachability_status": {
                        "type": "string",
                        "description": "Reachability Status"
            }
},
        required=[],
        tags=["catalyst", "devices", "count", "statistics"],
        requires_write=False,
        handler=handle_devices_get_device_count,
    ),
    create_tool(
        name="catalyst_devices_sync_devices",
        description="""Trigger a resync of one or more network devices to refresh their configuration and status in Catalyst Center.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of device UUIDs to sync"
            },
            "force_sync": {
                        "type": "boolean",
                        "description": "Force full sync even if no changes detected",
                        "default": False
            }
},
        required=["device_ids"],
        tags=["catalyst", "devices", "sync", "refresh", "resync"],
        requires_write=False,
        handler=handle_devices_sync_devices,
    ),
    create_tool(
        name="catalyst_devices_get_device_config",
        description="""Retrieve the running configuration of a network device. Returns the full device configuration as stored in Catalyst Center.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to get configuration for"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "config", "configuration"],
        requires_write=False,
        handler=handle_devices_get_device_config,
    ),
    create_tool(
        name="catalyst_devices_get_device_by_ip",
        description="""Get device information using its management IP address. Useful when you know the device IP but not its UUID.""",
        platform="catalyst",
        category="devices",
        properties={
            "ip_address": {
                        "description": "Management IP address of the device"
            }
},
        required=["ip_address"],
        tags=["catalyst", "devices", "ip", "lookup"],
        requires_write=False,
        handler=handle_devices_get_device_by_ip,
    ),
    create_tool(
        name="catalyst_devices_get_device_by_serial",
        description="""Get device information using its serial number. Useful for hardware tracking and inventory management.""",
        platform="catalyst",
        category="devices",
        properties={
            "serial_number": {
                        "description": "Serial number of the device"
            }
},
        required=["serial_number"],
        tags=["catalyst", "devices", "serial", "lookup"],
        requires_write=False,
        handler=handle_devices_get_device_by_serial,
    ),
    create_tool(
        name="catalyst_devices_query_devices",
        description="""Advanced device query with complex filtering using POST request. Supports multiple filter criteria and logical operators.""",
        platform="catalyst",
        category="devices",
        properties={
            "hostname": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of hostnames to search"
            },
            "management_ip_address": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of management IPs to search"
            },
            "serial_number": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of serial numbers to search"
            },
            "mac_address": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of MAC addresses to search"
            },
            "device_id": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of device UUIDs to search"
            }
},
        required=[],
        tags=["catalyst", "devices", "query", "search", "filter"],
        requires_write=False,
        handler=handle_devices_query_devices,
    ),
    create_tool(
        name="catalyst_devices_export_device_list",
        description="""Export device inventory to a file. Returns device list in a format suitable for reporting and analysis.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Specific device IDs to export (optional, exports all if not specified)"
            },
            "operation_id_list": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Operation IDs to filter by"
            }
},
        required=[],
        tags=["catalyst", "devices", "export", "report"],
        requires_write=False,
        handler=handle_devices_export_device_list,
    ),
    create_tool(
        name="catalyst_devices_get_device_summary",
        description="""Get a summary of all network devices including counts by family, reachability status, and other aggregate statistics.""",
        platform="catalyst",
        category="devices",
        properties={
            "summary_type": {
                        "type": "string",
                        "description": "Type of summary to generate",
                        "enum": [
                                    "FLAVOR",
                                    "STATUS"
                        ]
            }
},
        required=[],
        tags=["catalyst", "devices", "summary", "statistics"],
        requires_write=False,
        handler=handle_devices_get_device_summary,
    ),
    create_tool(
        name="catalyst_devices_get_device_enrichment",
        description="""Get enriched device details including connected devices, interface information, and contextual data.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID for enrichment"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "enrichment", "context"],
        requires_write=False,
        handler=handle_devices_get_device_enrichment,
    ),
    create_tool(
        name="catalyst_devices_get_modules",
        description="""Get information about hardware modules installed in network devices, including line cards, supervisors, and expansion modules.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to get modules for"
            },
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
        tags=["catalyst", "devices", "modules", "hardware"],
        requires_write=False,
        handler=handle_devices_get_modules,
    ),
    create_tool(
        name="catalyst_devices_get_chassis",
        description="""Get chassis details for a network device including physical layout and slot information.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to get chassis for"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "chassis", "hardware"],
        requires_write=False,
        handler=handle_devices_get_chassis,
    ),
    create_tool(
        name="catalyst_devices_get_stack",
        description="""Get stack information for stackable switches including stack members, roles, and stack state.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Stack master device UUID"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "stack", "switches"],
        requires_write=False,
        handler=handle_devices_get_stack,
    ),
    create_tool(
        name="catalyst_devices_get_poe_details",
        description="""Get Power over Ethernet (PoE) information for a device including power budget, allocated power, and port status.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to get PoE details for"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "poe", "power"],
        requires_write=False,
        handler=handle_devices_get_poe_details,
    ),
    create_tool(
        name="catalyst_devices_get_functional_capability",
        description="""Get the functional capabilities of a network device, showing what features and functions the device supports.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "capability", "features"],
        requires_write=False,
        handler=handle_devices_get_functional_capability,
    ),
    create_tool(
        name="catalyst_devices_update_role",
        description="""Update the role designation of a network device. Roles help categorize devices for management and policy purposes.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to update"
            },
            "role": {
                        "type": "string",
                        "description": "New role for the device",
                        "enum": [
                                    "ACCESS",
                                    "DISTRIBUTION",
                                    "CORE",
                                    "BORDER ROUTER"
                        ]
            },
            "role_source": {
                        "type": "string",
                        "description": "Source of role assignment",
                        "enum": [
                                    "AUTO",
                                    "MANUAL"
                        ]
            }
},
        required=["device_id", "role"],
        tags=["catalyst", "devices", "role", "update"],
        requires_write=True,
        handler=handle_devices_update_role,
    ),
    create_tool(
        name="catalyst_devices_update_management_address",
        description="""Update the management IP address used to communicate with a device. Use when device IP changes but device should remain in inventory.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to update"
            },
            "new_ip": {
                        "type": "string",
                        "description": "New management IP address"
            }
},
        required=["device_id", "new_ip"],
        tags=["catalyst", "devices", "management", "ip"],
        requires_write=False,
        handler=handle_devices_update_management_address,
    ),
    create_tool(
        name="catalyst_devices_get_polling_interval",
        description="""Get the collection/polling schedule for a device showing how often Catalyst Center collects data from the device.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID"
            }
},
        required=["device_id"],
        tags=["catalyst", "devices", "polling", "schedule"],
        requires_write=False,
        handler=handle_devices_get_polling_interval,
    ),
    create_tool(
        name="catalyst_devices_update_resync_interval",
        description="""Update the automatic resync interval for devices, controlling how often Catalyst Center automatically syncs device configuration.""",
        platform="catalyst",
        category="devices",
        properties={
            "interval": {
                        "type": "integer",
                        "description": "Resync interval in minutes (0 to disable)"
            }
},
        required=["interval"],
        tags=["catalyst", "devices", "resync", "interval", "schedule"],
        requires_write=False,
        handler=handle_devices_update_resync_interval,
    ),
    create_tool(
        name="catalyst_devices_delete_with_cleanup",
        description="""Delete devices with full cleanup including associated data, configurations, and historical information.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of device UUIDs to delete"
            },
            "clean_config": {
                        "type": "boolean",
                        "description": "Clean up device configuration",
                        "default": True
            }
},
        required=["device_ids"],
        tags=["catalyst", "devices", "delete", "cleanup"],
        requires_write=True,
        handler=handle_devices_delete_with_cleanup,
    ),
    create_tool(
        name="catalyst_devices_get_user_defined_fields",
        description="""Get user-defined custom fields for devices. These fields allow storing custom metadata with devices.""",
        platform="catalyst",
        category="devices",
        properties={
            "device_id": {
                        "description": "Device UUID to get UDFs for"
            },
            "name": {
                        "type": "string",
                        "description": "Filter by field name"
            }
},
        required=[],
        tags=["catalyst", "devices", "custom", "fields", "udf"],
        requires_write=False,
        handler=handle_devices_get_user_defined_fields,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_devices_tools():
    """Register all devices tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_DEVICES_TOOLS)
    logger.info(f"Registered {len(CATALYST_DEVICES_TOOLS)} catalyst devices tools")


# Auto-register on import
register_devices_tools()
