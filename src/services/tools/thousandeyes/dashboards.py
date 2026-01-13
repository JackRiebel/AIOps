"""
Thousandeyes Dashboards Tools

Auto-generated from archived A2A skills.
Total tools: 15
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_dashboards_get_list(params: Dict, context: Any) -> Dict:
    """Handler for List Dashboards."""
    try:
        # Build API path
        path = "/dashboards/get/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Dashboard."""
    try:
        # Build API path
        path = "/dashboards/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_create(params: Dict, context: Any) -> Dict:
    """Handler for Create Dashboard."""
    try:
        # Build API path
        path = "/dashboards/create"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_update(params: Dict, context: Any) -> Dict:
    """Handler for Update Dashboard."""
    try:
        # Build API path
        path = "/dashboards/update"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Dashboard."""
    try:
        # Build API path
        path = "/dashboards/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_get_widget_data(params: Dict, context: Any) -> Dict:
    """Handler for Get Widget Data."""
    try:
        # Build API path
        path = "/dashboards/get/widget/data"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_get_widget_card_data(params: Dict, context: Any) -> Dict:
    """Handler for Get Widget Card Data."""
    try:
        # Build API path
        path = "/dashboards/get/widget/card/data"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_get_snapshots(params: Dict, context: Any) -> Dict:
    """Handler for List Dashboard Snapshots."""
    try:
        # Build API path
        path = "/dashboards/get/snapshots"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_get_snapshot(params: Dict, context: Any) -> Dict:
    """Handler for Get Dashboard Snapshot."""
    try:
        # Build API path
        path = "/dashboards/get/snapshot"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_create_snapshot(params: Dict, context: Any) -> Dict:
    """Handler for Create Dashboard Snapshot."""
    try:
        # Build API path
        path = "/dashboards/create/snapshot"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_delete_snapshot(params: Dict, context: Any) -> Dict:
    """Handler for Delete Dashboard Snapshot."""
    try:
        # Build API path
        path = "/dashboards/delete/snapshot"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_update_snapshot_expiry(params: Dict, context: Any) -> Dict:
    """Handler for Update Snapshot Expiry."""
    try:
        # Build API path
        path = "/dashboards/update/snapshot/expiry"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_get_filters(params: Dict, context: Any) -> Dict:
    """Handler for List Dashboard Filters."""
    try:
        # Build API path
        path = "/dashboards/get/filters"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_create_filter(params: Dict, context: Any) -> Dict:
    """Handler for Create Dashboard Filter."""
    try:
        # Build API path
        path = "/dashboards/create/filter"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_dashboards_delete_filter(params: Dict, context: Any) -> Dict:
    """Handler for Delete Dashboard Filter."""
    try:
        # Build API path
        path = "/dashboards/delete/filter"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_DASHBOARDS_TOOLS = [
    create_tool(
        name="thousandeyes_dashboards_get_list",
        description="""Get all dashboards.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "dashboards", "list"],
        requires_write=False,
        handler=handle_dashboards_get_list,
    ),
    create_tool(
        name="thousandeyes_dashboards_get_by_id",
        description="""Get details of a specific dashboard.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "dashboard_id": {
                        "type": "string",
                        "description": "Dashboard Id"
            }
},
        required=["dashboard_id"],
        tags=["thousandeyes", "dashboards", "details"],
        requires_write=False,
        handler=handle_dashboards_get_by_id,
    ),
    create_tool(
        name="thousandeyes_dashboards_create",
        description="""Create a new dashboard.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "title": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            },
            "is_default": {
                        "type": "boolean",
                        "default": False
            },
            "is_private": {
                        "type": "boolean",
                        "default": False
            },
            "widgets": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "type": {
                                                            "type": "string"
                                                },
                                                "title": {
                                                            "type": "string"
                                                },
                                                "testId": {
                                                            "type": "string"
                                                },
                                                "metric": {
                                                            "type": "string"
                                                }
                                    }
                        }
            }
},
        required=["title"],
        tags=["thousandeyes", "dashboards", "create"],
        requires_write=True,
        handler=handle_dashboards_create,
    ),
    create_tool(
        name="thousandeyes_dashboards_update",
        description="""Update an existing dashboard.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "dashboard_id": {
                        "type": "string",
                        "description": "Dashboard Id"
            },
            "title": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            },
            "is_default": {
                        "type": "boolean"
            },
            "is_private": {
                        "type": "boolean"
            },
            "widgets": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["dashboard_id"],
        tags=["thousandeyes", "dashboards", "update"],
        requires_write=True,
        handler=handle_dashboards_update,
    ),
    create_tool(
        name="thousandeyes_dashboards_delete",
        description="""Delete a dashboard.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "dashboard_id": {
                        "type": "string",
                        "description": "Dashboard Id"
            }
},
        required=["dashboard_id"],
        tags=["thousandeyes", "dashboards", "delete"],
        requires_write=True,
        handler=handle_dashboards_delete,
    ),
    create_tool(
        name="thousandeyes_dashboards_get_widget_data",
        description="""Get data for a specific widget.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "dashboard_id": {
                        "type": "string",
                        "description": "Dashboard Id"
            },
            "widget_id": {
                        "type": "string",
                        "description": "Widget Id"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["dashboard_id", "widget_id"],
        tags=["thousandeyes", "dashboards", "widget", "data"],
        requires_write=False,
        handler=handle_dashboards_get_widget_data,
    ),
    create_tool(
        name="thousandeyes_dashboards_get_widget_card_data",
        description="""Get data for a specific widget card.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "dashboard_id": {
                        "type": "string",
                        "description": "Dashboard Id"
            },
            "widget_id": {
                        "type": "string",
                        "description": "Widget Id"
            },
            "card_id": {
                        "type": "string",
                        "description": "Card ID"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["dashboard_id", "widget_id", "card_id"],
        tags=["thousandeyes", "dashboards", "widget", "card"],
        requires_write=False,
        handler=handle_dashboards_get_widget_card_data,
    ),
    create_tool(
        name="thousandeyes_dashboards_get_snapshots",
        description="""Get all dashboard snapshots.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "dashboards", "snapshots", "list"],
        requires_write=False,
        handler=handle_dashboards_get_snapshots,
    ),
    create_tool(
        name="thousandeyes_dashboards_get_snapshot",
        description="""Get details of a specific snapshot.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "snapshot_id": {
                        "type": "string",
                        "description": "Snapshot Id"
            }
},
        required=["snapshot_id"],
        tags=["thousandeyes", "dashboards", "snapshot", "details"],
        requires_write=False,
        handler=handle_dashboards_get_snapshot,
    ),
    create_tool(
        name="thousandeyes_dashboards_create_snapshot",
        description="""Create a snapshot of a dashboard.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "dashboard_id": {
                        "type": "string",
                        "description": "Dashboard Id"
            },
            "display_name": {
                        "type": "string"
            },
            "is_shared": {
                        "type": "boolean",
                        "default": False
            },
            "expiration_date": {
                        "type": "string"
            }
},
        required=["dashboard_id"],
        tags=["thousandeyes", "dashboards", "snapshot", "create"],
        requires_write=True,
        handler=handle_dashboards_create_snapshot,
    ),
    create_tool(
        name="thousandeyes_dashboards_delete_snapshot",
        description="""Delete a dashboard snapshot.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "snapshot_id": {
                        "type": "string",
                        "description": "Snapshot Id"
            }
},
        required=["snapshot_id"],
        tags=["thousandeyes", "dashboards", "snapshot", "delete"],
        requires_write=True,
        handler=handle_dashboards_delete_snapshot,
    ),
    create_tool(
        name="thousandeyes_dashboards_update_snapshot_expiry",
        description="""Update the expiration date of a snapshot.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "snapshot_id": {
                        "type": "string",
                        "description": "Snapshot Id"
            },
            "expiration_date": {
                        "type": "string"
            }
},
        required=["snapshot_id", "expiration_date"],
        tags=["thousandeyes", "dashboards", "snapshot", "expiry", "update"],
        requires_write=True,
        handler=handle_dashboards_update_snapshot_expiry,
    ),
    create_tool(
        name="thousandeyes_dashboards_get_filters",
        description="""Get all dashboard filters.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "dashboards", "filters", "list"],
        requires_write=False,
        handler=handle_dashboards_get_filters,
    ),
    create_tool(
        name="thousandeyes_dashboards_create_filter",
        description="""Create a new dashboard filter.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "name": {
                        "type": "string"
            },
            "filter_type": {
                        "type": "string"
            },
            "filter_values": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["name", "filter_type"],
        tags=["thousandeyes", "dashboards", "filter", "create"],
        requires_write=True,
        handler=handle_dashboards_create_filter,
    ),
    create_tool(
        name="thousandeyes_dashboards_delete_filter",
        description="""Delete a dashboard filter.""",
        platform="thousandeyes",
        category="dashboards",
        properties={
            "filter_id": {
                        "type": "string",
                        "description": "Filter ID"
            }
},
        required=["filter_id"],
        tags=["thousandeyes", "dashboards", "filter", "delete"],
        requires_write=True,
        handler=handle_dashboards_delete_filter,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_dashboards_tools():
    """Register all dashboards tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_DASHBOARDS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_DASHBOARDS_TOOLS)} thousandeyes dashboards tools")


# Auto-register on import
register_dashboards_tools()
