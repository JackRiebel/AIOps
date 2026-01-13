"""
Catalyst Discovery Tools

Auto-generated from archived A2A skills.
Total tools: 12
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_discovery_start(params: Dict, context: Any) -> Dict:
    """Handler for Start Network Discovery."""
    try:
        # Build API path
        path = "/discovery/start"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Discovery by ID."""
    try:
        # Build API path
        path = "/discovery/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_all(params: Dict, context: Any) -> Dict:
    """Handler for Get All Discoveries."""
    try:
        # Build API path
        path = "/discovery/get/all"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Discovery Count."""
    try:
        # Build API path
        path = "/discovery/get/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Discovery."""
    try:
        # Build API path
        path = "/discovery/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_delete_range(params: Dict, context: Any) -> Dict:
    """Handler for Delete Discoveries by Range."""
    try:
        # Build API path
        path = "/discovery/delete/range"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_devices(params: Dict, context: Any) -> Dict:
    """Handler for Get Discovered Devices."""
    try:
        # Build API path
        path = "/discovery/get/devices"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_device_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Discovered Device Count."""
    try:
        # Build API path
        path = "/discovery/get/device/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_summary(params: Dict, context: Any) -> Dict:
    """Handler for Get Discovery Summary."""
    try:
        # Build API path
        path = "/discovery/get/summary"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_job_by_ip(params: Dict, context: Any) -> Dict:
    """Handler for Get Discovery Job by IP."""
    try:
        # Build API path
        path = "/discovery/get/job/by/ip"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_get_credentials(params: Dict, context: Any) -> Dict:
    """Handler for Get Global Credentials."""
    try:
        # Build API path
        path = "/discovery/get/credentials"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_discovery_update_credentials(params: Dict, context: Any) -> Dict:
    """Handler for Update Global Credentials."""
    try:
        # Build API path
        path = "/discovery/update/credentials"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_DISCOVERY_TOOLS = [
    create_tool(
        name="catalyst_discovery_start",
        description="""Start a new network discovery job to find devices.""",
        platform="catalyst",
        category="discovery",
        properties={
            "name": {
                        "type": "string"
            },
            "discovery_type": {
                        "type": "string",
                        "enum": [
                                    "Range",
                                    "Single",
                                    "CDP",
                                    "LLDP",
                                    "CIDR"
                        ]
            },
            "ip_address_list": {
                        "type": "string"
            },
            "snmp_ro_community": {
                        "type": "string"
            },
            "snmp_rw_community": {
                        "type": "string"
            },
            "cli_username": {
                        "type": "string"
            },
            "cli_password": {
                        "type": "string"
            },
            "enable_password": {
                        "type": "string"
            }
},
        required=["name", "discovery_type", "ip_address_list"],
        tags=["catalyst", "discovery", "start"],
        requires_write=False,
        handler=handle_discovery_start,
    ),
    create_tool(
        name="catalyst_discovery_get_by_id",
        description="""Get details of a specific discovery job.""",
        platform="catalyst",
        category="discovery",
        properties={
            "discovery_id": {
                        "type": "string",
                        "description": "Discovery Id"
            }
},
        required=["discovery_id"],
        tags=["catalyst", "discovery", "details"],
        requires_write=False,
        handler=handle_discovery_get_by_id,
    ),
    create_tool(
        name="catalyst_discovery_get_all",
        description="""Get list of all discovery jobs.""",
        platform="catalyst",
        category="discovery",
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
        tags=["catalyst", "discovery", "list"],
        requires_write=False,
        handler=handle_discovery_get_all,
    ),
    create_tool(
        name="catalyst_discovery_get_count",
        description="""Get count of discovery jobs.""",
        platform="catalyst",
        category="discovery",
        properties={},
        required=[],
        tags=["catalyst", "discovery", "count"],
        requires_write=False,
        handler=handle_discovery_get_count,
    ),
    create_tool(
        name="catalyst_discovery_delete",
        description="""Delete a discovery job.""",
        platform="catalyst",
        category="discovery",
        properties={
            "discovery_id": {
                        "type": "string",
                        "description": "Discovery Id"
            }
},
        required=["discovery_id"],
        tags=["catalyst", "discovery", "delete"],
        requires_write=True,
        handler=handle_discovery_delete,
    ),
    create_tool(
        name="catalyst_discovery_delete_range",
        description="""Delete multiple discovery jobs.""",
        platform="catalyst",
        category="discovery",
        properties={
            "start_index": {
                        "type": "integer"
            },
            "records_to_delete": {
                        "type": "integer"
            }
},
        required=["start_index", "records_to_delete"],
        tags=["catalyst", "discovery", "delete"],
        requires_write=True,
        handler=handle_discovery_delete_range,
    ),
    create_tool(
        name="catalyst_discovery_get_devices",
        description="""Get devices found by a discovery job.""",
        platform="catalyst",
        category="discovery",
        properties={
            "discovery_id": {
                        "type": "string",
                        "description": "Discovery Id"
            },
            "task_id": {
                        "type": "string"
            }
},
        required=["discovery_id"],
        tags=["catalyst", "discovery", "devices"],
        requires_write=False,
        handler=handle_discovery_get_devices,
    ),
    create_tool(
        name="catalyst_discovery_get_device_count",
        description="""Get count of devices found by discovery.""",
        platform="catalyst",
        category="discovery",
        properties={
            "discovery_id": {
                        "type": "string",
                        "description": "Discovery Id"
            }
},
        required=["discovery_id"],
        tags=["catalyst", "discovery", "count"],
        requires_write=False,
        handler=handle_discovery_get_device_count,
    ),
    create_tool(
        name="catalyst_discovery_get_summary",
        description="""Get summary of a discovery job.""",
        platform="catalyst",
        category="discovery",
        properties={
            "discovery_id": {
                        "type": "string",
                        "description": "Discovery Id"
            }
},
        required=["discovery_id"],
        tags=["catalyst", "discovery", "summary"],
        requires_write=False,
        handler=handle_discovery_get_summary,
    ),
    create_tool(
        name="catalyst_discovery_get_job_by_ip",
        description="""Get discovery job associated with an IP address.""",
        platform="catalyst",
        category="discovery",
        properties={
            "ip_address": {
                        "type": "string"
            }
},
        required=["ip_address"],
        tags=["catalyst", "discovery", "ip"],
        requires_write=False,
        handler=handle_discovery_get_job_by_ip,
    ),
    create_tool(
        name="catalyst_discovery_get_credentials",
        description="""Get global credentials used for discovery.""",
        platform="catalyst",
        category="discovery",
        properties={
            "credential_type": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "discovery", "credentials"],
        requires_write=False,
        handler=handle_discovery_get_credentials,
    ),
    create_tool(
        name="catalyst_discovery_update_credentials",
        description="""Update global credentials for discovery.""",
        platform="catalyst",
        category="discovery",
        properties={
            "credential_id": {
                        "type": "string"
            },
            "credential_type": {
                        "type": "string"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            }
},
        required=["credential_id"],
        tags=["catalyst", "discovery", "credentials", "update"],
        requires_write=True,
        handler=handle_discovery_update_credentials,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_discovery_tools():
    """Register all discovery tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_DISCOVERY_TOOLS)
    logger.info(f"Registered {len(CATALYST_DISCOVERY_TOOLS)} catalyst discovery tools")


# Auto-register on import
register_discovery_tools()
