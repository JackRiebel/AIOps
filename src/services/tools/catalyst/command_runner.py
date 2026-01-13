"""
Catalyst Command_Runner Tools

Auto-generated from archived A2A skills.
Total tools: 5
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_command_get_keywords(params: Dict, context: Any) -> Dict:
    """Handler for Get Command Keywords."""
    try:
        # Build API path
        path = "/command/get/keywords"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_command_run_read_only(params: Dict, context: Any) -> Dict:
    """Handler for Run Read-Only Commands."""
    try:
        # Build API path
        path = "/command/run/read/only"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_command_get_result(params: Dict, context: Any) -> Dict:
    """Handler for Get Command Result."""
    try:
        # Build API path
        path = "/command/get/result"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_command_run_commands(params: Dict, context: Any) -> Dict:
    """Handler for Run Commands."""
    try:
        # Build API path
        path = "/command/run/commands"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_command_get_all_keywords(params: Dict, context: Any) -> Dict:
    """Handler for Get All Command Keywords."""
    try:
        # Build API path
        path = "/command/get/all/keywords"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_COMMAND_RUNNER_TOOLS = [
    create_tool(
        name="catalyst_command_get_keywords",
        description="""Get allowed read-only command keywords.""",
        platform="catalyst",
        category="command_runner",
        properties={},
        required=[],
        tags=["catalyst", "command", "keywords"],
        requires_write=False,
        handler=handle_command_get_keywords,
    ),
    create_tool(
        name="catalyst_command_run_read_only",
        description="""Execute read-only CLI commands on devices.""",
        platform="catalyst",
        category="command_runner",
        properties={
            "device_uuids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device UUIDs to run commands on"
            },
            "commands": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "CLI commands to execute"
            }
},
        required=["device_uuids", "commands"],
        tags=["catalyst", "command", "execute", "cli"],
        requires_write=False,
        handler=handle_command_run_read_only,
    ),
    create_tool(
        name="catalyst_command_get_result",
        description="""Get results of a command execution.""",
        platform="catalyst",
        category="command_runner",
        properties={
            "file_id": {
                        "type": "string",
                        "description": "File ID from command execution"
            }
},
        required=["file_id"],
        tags=["catalyst", "command", "result"],
        requires_write=False,
        handler=handle_command_get_result,
    ),
    create_tool(
        name="catalyst_command_run_commands",
        description="""Execute CLI commands on network devices.""",
        platform="catalyst",
        category="command_runner",
        properties={
            "device_uuids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "commands": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "timeout": {
                        "type": "integer",
                        "default": 0
            }
},
        required=["device_uuids", "commands"],
        tags=["catalyst", "command", "execute"],
        requires_write=False,
        handler=handle_command_run_commands,
    ),
    create_tool(
        name="catalyst_command_get_all_keywords",
        description="""Get all available command keywords.""",
        platform="catalyst",
        category="command_runner",
        properties={},
        required=[],
        tags=["catalyst", "command", "keywords", "all"],
        requires_write=False,
        handler=handle_command_get_all_keywords,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_command_runner_tools():
    """Register all command_runner tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_COMMAND_RUNNER_TOOLS)
    logger.info(f"Registered {len(CATALYST_COMMAND_RUNNER_TOOLS)} catalyst command_runner tools")


# Auto-register on import
register_command_runner_tools()
