"""
Thousandeyes Admin Tools

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

async def handle_admin_get_account_groups(params: Dict, context: Any) -> Dict:
    """Handler for List Account Groups."""
    try:
        # Build API path
        path = "/admin/get/account/groups"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_account_group(params: Dict, context: Any) -> Dict:
    """Handler for Get Account Group."""
    try:
        # Build API path
        path = "/admin/get/account/group"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_create_account_group(params: Dict, context: Any) -> Dict:
    """Handler for Create Account Group."""
    try:
        # Build API path
        path = "/admin/create/account/group"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_update_account_group(params: Dict, context: Any) -> Dict:
    """Handler for Update Account Group."""
    try:
        # Build API path
        path = "/admin/update/account/group"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_delete_account_group(params: Dict, context: Any) -> Dict:
    """Handler for Delete Account Group."""
    try:
        # Build API path
        path = "/admin/delete/account/group"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_users(params: Dict, context: Any) -> Dict:
    """Handler for List Users."""
    try:
        # Build API path
        path = "/admin/get/users"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_user(params: Dict, context: Any) -> Dict:
    """Handler for Get User."""
    try:
        # Build API path
        path = "/admin/get/user"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_current_user(params: Dict, context: Any) -> Dict:
    """Handler for Get Current User."""
    try:
        # Build API path
        path = "/admin/get/current/user"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_create_user(params: Dict, context: Any) -> Dict:
    """Handler for Create User."""
    try:
        # Build API path
        path = "/admin/create/user"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_update_user(params: Dict, context: Any) -> Dict:
    """Handler for Update User."""
    try:
        # Build API path
        path = "/admin/update/user"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_delete_user(params: Dict, context: Any) -> Dict:
    """Handler for Delete User."""
    try:
        # Build API path
        path = "/admin/delete/user"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_roles(params: Dict, context: Any) -> Dict:
    """Handler for List Roles."""
    try:
        # Build API path
        path = "/admin/get/roles"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_role(params: Dict, context: Any) -> Dict:
    """Handler for Get Role."""
    try:
        # Build API path
        path = "/admin/get/role"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_permissions(params: Dict, context: Any) -> Dict:
    """Handler for List Permissions."""
    try:
        # Build API path
        path = "/admin/get/permissions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_admin_get_activity_log(params: Dict, context: Any) -> Dict:
    """Handler for Get Activity Log."""
    try:
        # Build API path
        path = "/admin/get/activity/log"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_ADMIN_TOOLS = [
    create_tool(
        name="thousandeyes_admin_get_account_groups",
        description="""Get all account groups.""",
        platform="thousandeyes",
        category="admin",
        properties={},
        required=[],
        tags=["thousandeyes", "admin", "account-groups", "list"],
        requires_write=False,
        handler=handle_admin_get_account_groups,
    ),
    create_tool(
        name="thousandeyes_admin_get_account_group",
        description="""Get details of a specific account group.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "aid": {
                        "type": "string",
                        "description": "Aid"
            }
},
        required=["aid"],
        tags=["thousandeyes", "admin", "account-group", "details"],
        requires_write=False,
        handler=handle_admin_get_account_group,
    ),
    create_tool(
        name="thousandeyes_admin_create_account_group",
        description="""Create a new account group.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "account_group_name": {
                        "type": "string"
            },
            "organization_id": {
                        "type": "string"
            }
},
        required=["account_group_name"],
        tags=["thousandeyes", "admin", "account-group", "create"],
        requires_write=True,
        handler=handle_admin_create_account_group,
    ),
    create_tool(
        name="thousandeyes_admin_update_account_group",
        description="""Update an account group.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "aid": {
                        "type": "string",
                        "description": "Aid"
            },
            "account_group_name": {
                        "type": "string"
            }
},
        required=["aid"],
        tags=["thousandeyes", "admin", "account-group", "update"],
        requires_write=True,
        handler=handle_admin_update_account_group,
    ),
    create_tool(
        name="thousandeyes_admin_delete_account_group",
        description="""Delete an account group.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "aid": {
                        "type": "string",
                        "description": "Aid"
            }
},
        required=["aid"],
        tags=["thousandeyes", "admin", "account-group", "delete"],
        requires_write=True,
        handler=handle_admin_delete_account_group,
    ),
    create_tool(
        name="thousandeyes_admin_get_users",
        description="""Get all users.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "admin", "users", "list"],
        requires_write=False,
        handler=handle_admin_get_users,
    ),
    create_tool(
        name="thousandeyes_admin_get_user",
        description="""Get details of a specific user.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "uid": {
                        "type": "string",
                        "description": "Uid"
            }
},
        required=["uid"],
        tags=["thousandeyes", "admin", "user", "details"],
        requires_write=False,
        handler=handle_admin_get_user,
    ),
    create_tool(
        name="thousandeyes_admin_get_current_user",
        description="""Get the current authenticated user.""",
        platform="thousandeyes",
        category="admin",
        properties={},
        required=[],
        tags=["thousandeyes", "admin", "user", "current"],
        requires_write=False,
        handler=handle_admin_get_current_user,
    ),
    create_tool(
        name="thousandeyes_admin_create_user",
        description="""Create a new user.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "email": {
                        "type": "string"
            },
            "name": {
                        "type": "string"
            },
            "account_group_roles": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "accountGroupId": {
                                                            "type": "string"
                                                },
                                                "roleId": {
                                                            "type": "string"
                                                }
                                    }
                        }
            },
            "login_account_group_id": {
                        "type": "string"
            }
},
        required=["email", "name", "account_group_roles"],
        tags=["thousandeyes", "admin", "user", "create"],
        requires_write=True,
        handler=handle_admin_create_user,
    ),
    create_tool(
        name="thousandeyes_admin_update_user",
        description="""Update a user.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "uid": {
                        "type": "string",
                        "description": "Uid"
            },
            "name": {
                        "type": "string"
            },
            "account_group_roles": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            },
            "login_account_group_id": {
                        "type": "string"
            }
},
        required=["uid"],
        tags=["thousandeyes", "admin", "user", "update"],
        requires_write=True,
        handler=handle_admin_update_user,
    ),
    create_tool(
        name="thousandeyes_admin_delete_user",
        description="""Delete a user.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "uid": {
                        "type": "string",
                        "description": "Uid"
            }
},
        required=["uid"],
        tags=["thousandeyes", "admin", "user", "delete"],
        requires_write=True,
        handler=handle_admin_delete_user,
    ),
    create_tool(
        name="thousandeyes_admin_get_roles",
        description="""Get all roles.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "admin", "roles", "list"],
        requires_write=False,
        handler=handle_admin_get_roles,
    ),
    create_tool(
        name="thousandeyes_admin_get_role",
        description="""Get details of a specific role.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "role_id": {
                        "type": "string",
                        "description": "Role Id"
            }
},
        required=["role_id"],
        tags=["thousandeyes", "admin", "role", "details"],
        requires_write=False,
        handler=handle_admin_get_role,
    ),
    create_tool(
        name="thousandeyes_admin_get_permissions",
        description="""Get all available permissions.""",
        platform="thousandeyes",
        category="admin",
        properties={},
        required=[],
        tags=["thousandeyes", "admin", "permissions", "list"],
        requires_write=False,
        handler=handle_admin_get_permissions,
    ),
    create_tool(
        name="thousandeyes_admin_get_activity_log",
        description="""Get audit activity log.""",
        platform="thousandeyes",
        category="admin",
        properties={
            "aid": {
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
            "event_type": {
                        "type": "string"
            },
            "user_email": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "admin", "audit", "activity", "log"],
        requires_write=False,
        handler=handle_admin_get_activity_log,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_admin_tools():
    """Register all admin tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_ADMIN_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_ADMIN_TOOLS)} thousandeyes admin tools")


# Auto-register on import
register_admin_tools()
