"""
Meraki Insight Tools

Auto-generated from archived A2A skills.
Total tools: 9
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_insight_list_monitored_media_servers(params: Dict, context: Any) -> Dict:
    """Handler for List Monitored Media Servers."""
    try:
        # Build API path
        path = "/insight/list/monitored/media/servers"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_create_monitored_media_server(params: Dict, context: Any) -> Dict:
    """Handler for Create Monitored Media Server."""
    try:
        # Build API path
        path = "/insight/create/monitored/media/server"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_get_monitored_media_server(params: Dict, context: Any) -> Dict:
    """Handler for Get Monitored Media Server."""
    try:
        # Build API path
        path = "/insight/get/monitored/media/server"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_update_monitored_media_server(params: Dict, context: Any) -> Dict:
    """Handler for Update Monitored Media Server."""
    try:
        # Build API path
        path = "/insight/update/monitored/media/server"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_delete_monitored_media_server(params: Dict, context: Any) -> Dict:
    """Handler for Delete Monitored Media Server."""
    try:
        # Build API path
        path = "/insight/delete/monitored/media/server"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_get_application_health(params: Dict, context: Any) -> Dict:
    """Handler for Get Application Health."""
    try:
        # Build API path
        path = "/insight/get/application/health"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_get_applications(params: Dict, context: Any) -> Dict:
    """Handler for Get Insight Applications."""
    try:
        # Build API path
        path = "/insight/get/applications"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_get_clients_stats(params: Dict, context: Any) -> Dict:
    """Handler for Get Clients Statistics."""
    try:
        # Build API path
        path = "/insight/get/clients/stats"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_insight_get_speed_test_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Speed Test History."""
    try:
        # Build API path
        path = "/insight/get/speed/test/history"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_INSIGHT_TOOLS = [
    create_tool(
        name="meraki_insight_list_monitored_media_servers",
        description="""List the monitored media servers for an organization""",
        platform="meraki",
        category="insight",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["meraki", "insight", "media-servers", "voip", "list"],
        requires_write=False,
        handler=handle_insight_list_monitored_media_servers,
    ),
    create_tool(
        name="meraki_insight_create_monitored_media_server",
        description="""Create a monitored media server for an organization""",
        platform="meraki",
        category="insight",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "name": {
                        "type": "string",
                        "description": "Server name"
            },
            "address": {
                        "type": "string",
                        "description": "Server IP address or hostname"
            },
            "best_effort_monitoring_enabled": {
                        "type": "boolean",
                        "description": "Enable best effort monitoring"
            }
},
        required=["organization_id", "name", "address"],
        tags=["meraki", "insight", "media-servers", "voip", "create"],
        requires_write=True,
        handler=handle_insight_create_monitored_media_server,
    ),
    create_tool(
        name="meraki_insight_get_monitored_media_server",
        description="""Get a specific monitored media server""",
        platform="meraki",
        category="insight",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "monitored_media_server_id": {
                        "type": "string",
                        "description": "Monitored Media Server Id"
            }
},
        required=["organization_id", "monitored_media_server_id"],
        tags=["meraki", "insight", "media-servers", "voip", "get"],
        requires_write=False,
        handler=handle_insight_get_monitored_media_server,
    ),
    create_tool(
        name="meraki_insight_update_monitored_media_server",
        description="""Update a monitored media server""",
        platform="meraki",
        category="insight",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "monitored_media_server_id": {
                        "type": "string",
                        "description": "Monitored Media Server Id"
            },
            "name": {
                        "type": "string",
                        "description": "Server name"
            },
            "address": {
                        "type": "string",
                        "description": "Server IP address or hostname"
            },
            "best_effort_monitoring_enabled": {
                        "type": "boolean",
                        "description": "Enable best effort monitoring"
            }
},
        required=["organization_id", "monitored_media_server_id"],
        tags=["meraki", "insight", "media-servers", "voip", "update"],
        requires_write=True,
        handler=handle_insight_update_monitored_media_server,
    ),
    create_tool(
        name="meraki_insight_delete_monitored_media_server",
        description="""Delete a monitored media server""",
        platform="meraki",
        category="insight",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "monitored_media_server_id": {
                        "type": "string",
                        "description": "Monitored Media Server Id"
            }
},
        required=["organization_id", "monitored_media_server_id"],
        tags=["meraki", "insight", "media-servers", "voip", "delete"],
        requires_write=True,
        handler=handle_insight_delete_monitored_media_server,
    ),
    create_tool(
        name="meraki_insight_get_application_health",
        description="""Get the health of an application over time for a network""",
        platform="meraki",
        category="insight",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "application_id": {
                        "type": "string",
                        "description": "Application Id"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds (max 7 days)"
            },
            "resolution": {
                        "type": "integer",
                        "description": "Sample resolution in seconds"
            }
},
        required=["network_id", "application_id"],
        tags=["meraki", "insight", "application", "health"],
        requires_write=False,
        handler=handle_insight_get_application_health,
    ),
    create_tool(
        name="meraki_insight_get_applications",
        description="""Get the supported application categories and apps for insight""",
        platform="meraki",
        category="insight",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["meraki", "insight", "applications", "list"],
        requires_write=False,
        handler=handle_insight_get_applications,
    ),
    create_tool(
        name="meraki_insight_get_clients_stats",
        description="""Get client application usage and performance statistics""",
        platform="meraki",
        category="insight",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            }
},
        required=["network_id"],
        tags=["meraki", "insight", "clients", "statistics"],
        requires_write=False,
        handler=handle_insight_get_clients_stats,
    ),
    create_tool(
        name="meraki_insight_get_speed_test_history",
        description="""Get the speed test history for a network""",
        platform="meraki",
        category="insight",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            }
},
        required=["network_id"],
        tags=["meraki", "insight", "speed-test", "history"],
        requires_write=False,
        handler=handle_insight_get_speed_test_history,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_insight_tools():
    """Register all insight tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_INSIGHT_TOOLS)
    logger.info(f"Registered {len(MERAKI_INSIGHT_TOOLS)} meraki insight tools")


# Auto-register on import
register_insight_tools()
