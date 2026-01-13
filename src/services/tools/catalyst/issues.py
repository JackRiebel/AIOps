"""
Catalyst Issues Tools

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

async def handle_issues_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Issue by ID."""
    try:
        # Build API path
        path = "/issues/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_query(params: Dict, context: Any) -> Dict:
    """Handler for Query Issues."""
    try:
        # Build API path
        path = "/issues/query"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_get_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Issue Count."""
    try:
        # Build API path
        path = "/issues/get/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_ignore(params: Dict, context: Any) -> Dict:
    """Handler for Ignore Issues."""
    try:
        # Build API path
        path = "/issues/ignore"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_resolve(params: Dict, context: Any) -> Dict:
    """Handler for Resolve Issues."""
    try:
        # Build API path
        path = "/issues/resolve"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_get_trigger_definitions(params: Dict, context: Any) -> Dict:
    """Handler for Get Issue Trigger Definitions."""
    try:
        # Build API path
        path = "/issues/get/trigger/definitions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_create_custom_definition(params: Dict, context: Any) -> Dict:
    """Handler for Create Custom Issue Definition."""
    try:
        # Build API path
        path = "/issues/create/custom/definition"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_update_custom_definition(params: Dict, context: Any) -> Dict:
    """Handler for Update Custom Issue Definition."""
    try:
        # Build API path
        path = "/issues/update/custom/definition"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_delete_custom_definition(params: Dict, context: Any) -> Dict:
    """Handler for Delete Custom Issue Definition."""
    try:
        # Build API path
        path = "/issues/delete/custom/definition"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_get_enrichment(params: Dict, context: Any) -> Dict:
    """Handler for Get Issue Enrichment Details."""
    try:
        # Build API path
        path = "/issues/get/enrichment"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_execute_suggested_actions(params: Dict, context: Any) -> Dict:
    """Handler for Execute Suggested Actions."""
    try:
        # Build API path
        path = "/issues/execute/suggested/actions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_issues_get_summary(params: Dict, context: Any) -> Dict:
    """Handler for Get Issue Summary."""
    try:
        # Build API path
        path = "/issues/get/summary"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_ISSUES_TOOLS = [
    create_tool(
        name="catalyst_issues_get_by_id",
        description="""Get detailed information about a specific issue including root cause, affected devices, and suggested remediation actions.""",
        platform="catalyst",
        category="issues",
        properties={
            "issue_id": {
                        "description": "Issue ID to retrieve"
            }
},
        required=["issue_id"],
        tags=["catalyst", "issues", "details", "troubleshooting"],
        requires_write=False,
        handler=handle_issues_get_by_id,
    ),
    create_tool(
        name="catalyst_issues_query",
        description="""Query issues with filtering by priority, status, category, site, device, or time range.""",
        platform="catalyst",
        category="issues",
        properties={
            "priority": {
                        "type": "string",
                        "description": "Priority"
            },
            "issue_status": {
                        "type": "string",
                        "description": "Issue Status"
            },
            "ai_driven": {
                        "type": "boolean",
                        "description": "Filter AI-driven issues"
            },
            "site_id": {
                        "description": "Filter by site"
            },
            "device_id": {
                        "description": "Filter by device"
            },
            "mac_address": {
                        "description": "Filter by client MAC"
            },
            "category": {
                        "type": "string",
                        "description": "Issue category",
                        "enum": [
                                    "Onboarding",
                                    "Connectivity",
                                    "Connected",
                                    "Device",
                                    "Application Experience"
                        ]
            },
            "start_time": {
                        "description": "Start time for issue window"
            },
            "end_time": {
                        "description": "End time for issue window"
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
        tags=["catalyst", "issues", "query", "search", "filter"],
        requires_write=False,
        handler=handle_issues_query,
    ),
    create_tool(
        name="catalyst_issues_get_count",
        description="""Get the count of issues, optionally filtered by various criteria.""",
        platform="catalyst",
        category="issues",
        properties={
            "priority": {
                        "type": "string",
                        "description": "Priority"
            },
            "issue_status": {
                        "type": "string",
                        "description": "Issue Status"
            },
            "start_time": {
                        "type": "string",
                        "description": "Start Time"
            },
            "end_time": {
                        "type": "string",
                        "description": "End Time"
            }
},
        required=[],
        tags=["catalyst", "issues", "count", "statistics"],
        requires_write=False,
        handler=handle_issues_get_count,
    ),
    create_tool(
        name="catalyst_issues_ignore",
        description="""Mark one or more issues as ignored. Ignored issues will not appear in active issue lists.""",
        platform="catalyst",
        category="issues",
        properties={
            "issue_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Issue IDs to ignore"
            }
},
        required=["issue_ids"],
        tags=["catalyst", "issues", "ignore", "manage"],
        requires_write=False,
        handler=handle_issues_ignore,
    ),
    create_tool(
        name="catalyst_issues_resolve",
        description="""Mark one or more issues as resolved. This indicates the issue has been addressed.""",
        platform="catalyst",
        category="issues",
        properties={
            "issue_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Issue IDs to resolve"
            }
},
        required=["issue_ids"],
        tags=["catalyst", "issues", "resolve", "manage"],
        requires_write=False,
        handler=handle_issues_resolve,
    ),
    create_tool(
        name="catalyst_issues_get_trigger_definitions",
        description="""Get the definitions for issue triggers showing what conditions cause different types of issues.""",
        platform="catalyst",
        category="issues",
        properties={
            "device_type": {
                        "type": "string",
                        "description": "Filter by device type"
            },
            "profile_id": {
                        "type": "string",
                        "description": "Filter by profile ID"
            },
            "priority": {
                        "type": "string",
                        "description": "Priority"
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
        tags=["catalyst", "issues", "triggers", "definitions"],
        requires_write=False,
        handler=handle_issues_get_trigger_definitions,
    ),
    create_tool(
        name="catalyst_issues_create_custom_definition",
        description="""Create a custom issue definition to trigger alerts based on specific conditions.""",
        platform="catalyst",
        category="issues",
        properties={
            "name": {
                        "type": "string",
                        "description": "Name for the custom issue"
            },
            "description": {
                        "type": "string",
                        "description": "Description of when this issue triggers"
            },
            "priority": {
                        "type": "string",
                        "description": "Priority"
            },
            "is_enabled": {
                        "type": "boolean",
                        "description": "Whether the issue is enabled",
                        "default": True
            },
            "rules": {
                        "type": "array",
                        "description": "Rules defining when to trigger the issue",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "type": {
                                                            "type": "string"
                                                },
                                                "severity": {
                                                            "type": "integer"
                                                },
                                                "facility": {
                                                            "type": "string"
                                                },
                                                "pattern": {
                                                            "type": "string"
                                                }
                                    }
                        }
            }
},
        required=["name", "description", "priority"],
        tags=["catalyst", "issues", "custom", "create", "definition"],
        requires_write=True,
        handler=handle_issues_create_custom_definition,
    ),
    create_tool(
        name="catalyst_issues_update_custom_definition",
        description="""Update an existing custom issue definition.""",
        platform="catalyst",
        category="issues",
        properties={
            "id": {
                        "type": "string",
                        "description": "Custom issue definition ID"
            },
            "name": {
                        "type": "string",
                        "description": "Updated name"
            },
            "description": {
                        "type": "string",
                        "description": "Updated description"
            },
            "priority": {
                        "type": "string",
                        "description": "Priority"
            },
            "is_enabled": {
                        "type": "boolean",
                        "description": "Whether the issue is enabled"
            }
},
        required=["id"],
        tags=["catalyst", "issues", "custom", "update", "definition"],
        requires_write=True,
        handler=handle_issues_update_custom_definition,
    ),
    create_tool(
        name="catalyst_issues_delete_custom_definition",
        description="""Delete a custom issue definition.""",
        platform="catalyst",
        category="issues",
        properties={
            "id": {
                        "type": "string",
                        "description": "Custom issue definition ID to delete"
            }
},
        required=["id"],
        tags=["catalyst", "issues", "custom", "delete", "definition"],
        requires_write=True,
        handler=handle_issues_delete_custom_definition,
    ),
    create_tool(
        name="catalyst_issues_get_enrichment",
        description="""Get enriched issue details including affected entities, related issues, and suggested actions.""",
        platform="catalyst",
        category="issues",
        properties={
            "issue_id": {
                        "description": "Issue ID for enrichment"
            }
},
        required=["issue_id"],
        tags=["catalyst", "issues", "enrichment", "context"],
        requires_write=False,
        handler=handle_issues_get_enrichment,
    ),
    create_tool(
        name="catalyst_issues_execute_suggested_actions",
        description="""Execute the suggested remediation actions for an issue.""",
        platform="catalyst",
        category="issues",
        properties={
            "entity_type": {
                        "type": "string",
                        "description": "Entity type (issue_id, device_id, etc.)"
            },
            "entity_value": {
                        "type": "string",
                        "description": "Entity value"
            }
},
        required=["entity_type", "entity_value"],
        tags=["catalyst", "issues", "remediation", "actions", "execute"],
        requires_write=False,
        handler=handle_issues_execute_suggested_actions,
    ),
    create_tool(
        name="catalyst_issues_get_summary",
        description="""Get a summary of issues grouped by priority, category, or status.""",
        platform="catalyst",
        category="issues",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "start_time": {
                        "type": "string",
                        "description": "Start Time"
            },
            "end_time": {
                        "type": "string",
                        "description": "End Time"
            },
            "group_by": {
                        "type": "string",
                        "description": "Dimension to group by",
                        "enum": [
                                    "priority",
                                    "category",
                                    "status",
                                    "site"
                        ]
            }
},
        required=[],
        tags=["catalyst", "issues", "summary", "dashboard", "statistics"],
        requires_write=False,
        handler=handle_issues_get_summary,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_issues_tools():
    """Register all issues tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_ISSUES_TOOLS)
    logger.info(f"Registered {len(CATALYST_ISSUES_TOOLS)} catalyst issues tools")


# Auto-register on import
register_issues_tools()
