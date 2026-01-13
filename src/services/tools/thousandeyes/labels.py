"""
Thousandeyes Labels Tools

Auto-generated from archived A2A skills.
Total tools: 5
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_labels_get_list(params: Dict, context: Any) -> Dict:
    """Handler for List Labels."""
    try:
        # Build API path
        path = "/labels/get/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_labels_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Label."""
    try:
        # Build API path
        path = "/labels/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_labels_create(params: Dict, context: Any) -> Dict:
    """Handler for Create Label."""
    try:
        # Build API path
        path = "/labels/create"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_labels_update(params: Dict, context: Any) -> Dict:
    """Handler for Update Label."""
    try:
        # Build API path
        path = "/labels/update"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_labels_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Label."""
    try:
        # Build API path
        path = "/labels/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_LABELS_TOOLS = [
    create_tool(
        name="thousandeyes_labels_get_list",
        description="""Get all labels/groups.""",
        platform="thousandeyes",
        category="labels",
        properties={
            "aid": {
                        "type": "string"
            },
            "type": {
                        "type": "string",
                        "enum": [
                                    "tests",
                                    "agents",
                                    "endpoint-agents"
                        ],
                        "description": "Label type"
            }
},
        required=[],
        tags=["thousandeyes", "labels", "groups", "list"],
        requires_write=False,
        handler=handle_labels_get_list,
    ),
    create_tool(
        name="thousandeyes_labels_get_by_id",
        description="""Get details of a specific label.""",
        platform="thousandeyes",
        category="labels",
        properties={
            "label_id": {
                        "type": "string",
                        "description": "Label Id"
            },
            "type": {
                        "type": "string",
                        "enum": [
                                    "tests",
                                    "agents",
                                    "endpoint-agents"
                        ]
            }
},
        required=["label_id"],
        tags=["thousandeyes", "labels", "groups", "details"],
        requires_write=False,
        handler=handle_labels_get_by_id,
    ),
    create_tool(
        name="thousandeyes_labels_create",
        description="""Create a new label/group.""",
        platform="thousandeyes",
        category="labels",
        properties={
            "name": {
                        "type": "string"
            },
            "type": {
                        "type": "string",
                        "enum": [
                                    "tests",
                                    "agents",
                                    "endpoint-agents"
                        ]
            },
            "color": {
                        "type": "string",
                        "description": "Hex color code"
            },
            "description": {
                        "type": "string"
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
            "agents": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "agentId": {
                                                            "type": "string"
                                                }
                                    }
                        }
            }
},
        required=["name", "type"],
        tags=["thousandeyes", "labels", "groups", "create"],
        requires_write=True,
        handler=handle_labels_create,
    ),
    create_tool(
        name="thousandeyes_labels_update",
        description="""Update an existing label.""",
        platform="thousandeyes",
        category="labels",
        properties={
            "label_id": {
                        "type": "string",
                        "description": "Label Id"
            },
            "type": {
                        "type": "string",
                        "enum": [
                                    "tests",
                                    "agents",
                                    "endpoint-agents"
                        ]
            },
            "name": {
                        "type": "string"
            },
            "color": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            },
            "tests": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            },
            "agents": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["label_id", "type"],
        tags=["thousandeyes", "labels", "groups", "update"],
        requires_write=True,
        handler=handle_labels_update,
    ),
    create_tool(
        name="thousandeyes_labels_delete",
        description="""Delete a label.""",
        platform="thousandeyes",
        category="labels",
        properties={
            "label_id": {
                        "type": "string",
                        "description": "Label Id"
            },
            "type": {
                        "type": "string",
                        "enum": [
                                    "tests",
                                    "agents",
                                    "endpoint-agents"
                        ]
            }
},
        required=["label_id", "type"],
        tags=["thousandeyes", "labels", "groups", "delete"],
        requires_write=True,
        handler=handle_labels_delete,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_labels_tools():
    """Register all labels tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_LABELS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_LABELS_TOOLS)} thousandeyes labels tools")


# Auto-register on import
register_labels_tools()
