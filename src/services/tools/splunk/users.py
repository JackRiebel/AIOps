"""
Splunk Users Tools

Auto-generated from archived A2A skills.
Total tools: 2
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
# Splunk client imported in handler


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_users_get_user_info(params: Dict, context: Any) -> Dict:
    """Handler for Get User Info."""
    try:
        # Build API path
        path = "/users/get/user/info"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_users_get_user_list(params: Dict, context: Any) -> Dict:
    """Handler for Get User List."""
    try:
        # Build API path
        path = "/users/get/user/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

SPLUNK_USERS_TOOLS = [
    create_tool(
        name="splunk_users_get_user_info",
        description="""Retrieves detailed information about the currently authenticated user including roles and permissions. Returns comprehensive user profile data for the current session.""",
        platform="splunk",
        category="users",
        properties={},
        required=[],
        tags=["splunk", "users", "current-user", "profile", "permissions", "roles"],
        requires_write=False,
        handler=handle_users_get_user_info,
    ),
    create_tool(
        name="splunk_users_get_user_list",
        description="""Get a list of users from Splunk. Retrieves information about all users including authentication details, roles, and account status. Requires admin privileges.""",
        platform="splunk",
        category="users",
        properties={
            "role_filter": {
                        "type": "string",
                        "description": "Filter users by role (e.g., 'admin', 'user', 'power')"
            }
},
        required=[],
        tags=["splunk", "users", "list", "admin", "management"],
        requires_write=False,
        handler=handle_users_get_user_list,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_users_tools():
    """Register all users tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_USERS_TOOLS)
    logger.info(f"Registered {len(SPLUNK_USERS_TOOLS)} splunk users tools")


# Auto-register on import
register_users_tools()
