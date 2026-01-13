"""
Thousandeyes Alerts Tools

Auto-generated from archived A2A skills.
Total tools: 12
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_alerts_get_list(params: Dict, context: Any) -> Dict:
    """Handler for List Active Alerts."""
    try:
        # Build API path
        path = "/alerts/get/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Alert by ID."""
    try:
        # Build API path
        path = "/alerts/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_get_by_test(params: Dict, context: Any) -> Dict:
    """Handler for Get Alerts by Test."""
    try:
        # Build API path
        path = "/alerts/get/by/test"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_get_rules(params: Dict, context: Any) -> Dict:
    """Handler for List Alert Rules."""
    try:
        # Build API path
        path = "/alerts/get/rules"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_get_rule(params: Dict, context: Any) -> Dict:
    """Handler for Get Alert Rule."""
    try:
        # Build API path
        path = "/alerts/get/rule"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_create_rule(params: Dict, context: Any) -> Dict:
    """Handler for Create Alert Rule."""
    try:
        # Build API path
        path = "/alerts/create/rule"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_update_rule(params: Dict, context: Any) -> Dict:
    """Handler for Update Alert Rule."""
    try:
        # Build API path
        path = "/alerts/update/rule"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_delete_rule(params: Dict, context: Any) -> Dict:
    """Handler for Delete Alert Rule."""
    try:
        # Build API path
        path = "/alerts/delete/rule"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_get_suppression_windows(params: Dict, context: Any) -> Dict:
    """Handler for List Alert Suppression Windows."""
    try:
        # Build API path
        path = "/alerts/get/suppression/windows"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_get_suppression_window(params: Dict, context: Any) -> Dict:
    """Handler for Get Alert Suppression Window."""
    try:
        # Build API path
        path = "/alerts/get/suppression/window"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_create_suppression_window(params: Dict, context: Any) -> Dict:
    """Handler for Create Alert Suppression Window."""
    try:
        # Build API path
        path = "/alerts/create/suppression/window"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_alerts_delete_suppression_window(params: Dict, context: Any) -> Dict:
    """Handler for Delete Alert Suppression Window."""
    try:
        # Build API path
        path = "/alerts/delete/suppression/window"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_ALERTS_TOOLS = [
    create_tool(
        name="thousandeyes_alerts_get_list",
        description="""Get all active alerts.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "aid": {
                        "type": "string"
            },
            "window": {
                        "type": "string"
            },
            "start_date": {
                        "type": "string",
                        "description": "Start Date"
            },
            "end_date": {
                        "type": "string",
                        "description": "End Date"
            },
            "alert_state": {
                        "type": "string",
                        "enum": [
                                    "ACTIVE",
                                    "CLEARED"
                        ]
            }
},
        required=[],
        tags=["thousandeyes", "alerts", "active", "list"],
        requires_write=False,
        handler=handle_alerts_get_list,
    ),
    create_tool(
        name="thousandeyes_alerts_get_by_id",
        description="""Get details of a specific alert.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "alert_id": {
                        "type": "string",
                        "description": "Alert Id"
            }
},
        required=["alert_id"],
        tags=["thousandeyes", "alerts", "details"],
        requires_write=False,
        handler=handle_alerts_get_by_id,
    ),
    create_tool(
        name="thousandeyes_alerts_get_by_test",
        description="""Get alerts for a specific test.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "window": {
                        "type": "string"
            },
            "start_date": {
                        "type": "string",
                        "description": "Start Date"
            },
            "end_date": {
                        "type": "string",
                        "description": "End Date"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "alerts", "test"],
        requires_write=False,
        handler=handle_alerts_get_by_test,
    ),
    create_tool(
        name="thousandeyes_alerts_get_rules",
        description="""Get all alert rules.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "alerts", "rules", "list"],
        requires_write=False,
        handler=handle_alerts_get_rules,
    ),
    create_tool(
        name="thousandeyes_alerts_get_rule",
        description="""Get details of a specific alert rule.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "rule_id": {
                        "type": "string",
                        "description": "Rule Id"
            }
},
        required=["rule_id"],
        tags=["thousandeyes", "alerts", "rule", "details"],
        requires_write=False,
        handler=handle_alerts_get_rule,
    ),
    create_tool(
        name="thousandeyes_alerts_create_rule",
        description="""Create a new alert rule.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "rule_name": {
                        "type": "string"
            },
            "alert_type": {
                        "type": "string",
                        "enum": [
                                    "http-server",
                                    "page-load",
                                    "network",
                                    "dns-server",
                                    "dns-trace",
                                    "voice",
                                    "sip-server",
                                    "bgp",
                                    "ftp-server",
                                    "web-transactions",
                                    "api"
                        ]
            },
            "expression": {
                        "type": "string",
                        "description": "Alert expression"
            },
            "minimum_sources": {
                        "type": "integer",
                        "default": 1
            },
            "minimum_sources_pct": {
                        "type": "integer"
            },
            "rounds_violating_required": {
                        "type": "integer",
                        "default": 1
            },
            "rounds_violating_out_of": {
                        "type": "integer",
                        "default": 1
            },
            "notifications": {
                        "type": "object"
            },
            "severity": {
                        "type": "string",
                        "enum": [
                                    "INFO",
                                    "MINOR",
                                    "MAJOR",
                                    "CRITICAL"
                        ],
                        "default": "MAJOR"
            },
            "direction": {
                        "type": "string",
                        "enum": [
                                    "TO_TARGET",
                                    "FROM_TARGET",
                                    "BIDIRECTIONAL"
                        ]
            }
},
        required=["rule_name", "alert_type", "expression"],
        tags=["thousandeyes", "alerts", "rule", "create"],
        requires_write=True,
        handler=handle_alerts_create_rule,
    ),
    create_tool(
        name="thousandeyes_alerts_update_rule",
        description="""Update an existing alert rule.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "rule_id": {
                        "type": "string",
                        "description": "Rule Id"
            },
            "rule_name": {
                        "type": "string"
            },
            "expression": {
                        "type": "string"
            },
            "minimum_sources": {
                        "type": "integer"
            },
            "rounds_violating_required": {
                        "type": "integer"
            },
            "rounds_violating_out_of": {
                        "type": "integer"
            },
            "notifications": {
                        "type": "object"
            },
            "severity": {
                        "type": "string",
                        "enum": [
                                    "INFO",
                                    "MINOR",
                                    "MAJOR",
                                    "CRITICAL"
                        ]
            }
},
        required=["rule_id"],
        tags=["thousandeyes", "alerts", "rule", "update"],
        requires_write=True,
        handler=handle_alerts_update_rule,
    ),
    create_tool(
        name="thousandeyes_alerts_delete_rule",
        description="""Delete an alert rule.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "rule_id": {
                        "type": "string",
                        "description": "Rule Id"
            }
},
        required=["rule_id"],
        tags=["thousandeyes", "alerts", "rule", "delete"],
        requires_write=True,
        handler=handle_alerts_delete_rule,
    ),
    create_tool(
        name="thousandeyes_alerts_get_suppression_windows",
        description="""Get all alert suppression windows.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "alerts", "suppression", "windows", "list"],
        requires_write=False,
        handler=handle_alerts_get_suppression_windows,
    ),
    create_tool(
        name="thousandeyes_alerts_get_suppression_window",
        description="""Get details of a specific suppression window.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "window_id": {
                        "type": "string",
                        "description": "Window Id"
            }
},
        required=["window_id"],
        tags=["thousandeyes", "alerts", "suppression", "window", "details"],
        requires_write=False,
        handler=handle_alerts_get_suppression_window,
    ),
    create_tool(
        name="thousandeyes_alerts_create_suppression_window",
        description="""Create a new alert suppression window.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "name": {
                        "type": "string"
            },
            "start_date": {
                        "type": "string",
                        "description": "Start Date"
            },
            "end_date": {
                        "type": "string",
                        "description": "End Date"
            },
            "repeat": {
                        "type": "string",
                        "enum": [
                                    "DAY",
                                    "WEEK",
                                    "MONTH"
                        ]
            },
            "tests": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "testId": {
                                                            "type": "string"
                                                }
                                    }
                        }
            },
            "status": {
                        "type": "string",
                        "enum": [
                                    "ENABLED",
                                    "DISABLED"
                        ],
                        "default": "ENABLED"
            }
},
        required=["name", "start_date", "end_date"],
        tags=["thousandeyes", "alerts", "suppression", "window", "create"],
        requires_write=True,
        handler=handle_alerts_create_suppression_window,
    ),
    create_tool(
        name="thousandeyes_alerts_delete_suppression_window",
        description="""Delete an alert suppression window.""",
        platform="thousandeyes",
        category="alerts",
        properties={
            "window_id": {
                        "type": "string",
                        "description": "Window Id"
            }
},
        required=["window_id"],
        tags=["thousandeyes", "alerts", "suppression", "window", "delete"],
        requires_write=True,
        handler=handle_alerts_delete_suppression_window,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_alerts_tools():
    """Register all alerts tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_ALERTS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_ALERTS_TOOLS)} thousandeyes alerts tools")


# Auto-register on import
register_alerts_tools()
