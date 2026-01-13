"""
Thousandeyes Credentials Tools

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

async def handle_credentials_get_list(params: Dict, context: Any) -> Dict:
    """Handler for List Credentials."""
    try:
        # Build API path
        path = "/credentials/get/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_credentials_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Credential."""
    try:
        # Build API path
        path = "/credentials/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_credentials_create(params: Dict, context: Any) -> Dict:
    """Handler for Create Credential."""
    try:
        # Build API path
        path = "/credentials/create"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_credentials_update(params: Dict, context: Any) -> Dict:
    """Handler for Update Credential."""
    try:
        # Build API path
        path = "/credentials/update"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_credentials_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Credential."""
    try:
        # Build API path
        path = "/credentials/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_CREDENTIALS_TOOLS = [
    create_tool(
        name="thousandeyes_credentials_get_list",
        description="""Get all stored credentials.""",
        platform="thousandeyes",
        category="credentials",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "credentials", "list"],
        requires_write=False,
        handler=handle_credentials_get_list,
    ),
    create_tool(
        name="thousandeyes_credentials_get_by_id",
        description="""Get details of a specific credential.""",
        platform="thousandeyes",
        category="credentials",
        properties={
            "credential_id": {
                        "type": "string",
                        "description": "Credential Id"
            }
},
        required=["credential_id"],
        tags=["thousandeyes", "credentials", "details"],
        requires_write=False,
        handler=handle_credentials_get_by_id,
    ),
    create_tool(
        name="thousandeyes_credentials_create",
        description="""Create a new credential.""",
        platform="thousandeyes",
        category="credentials",
        properties={
            "name": {
                        "type": "string"
            },
            "type": {
                        "type": "string",
                        "enum": [
                                    "BASIC",
                                    "SSH",
                                    "TOKEN",
                                    "OAUTH"
                        ],
                        "description": "Credential type"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            },
            "token": {
                        "type": "string"
            },
            "ssh_private_key": {
                        "type": "string"
            },
            "ssh_passphrase": {
                        "type": "string"
            },
            "oauth_client_id": {
                        "type": "string"
            },
            "oauth_client_secret": {
                        "type": "string"
            }
},
        required=["name", "type"],
        tags=["thousandeyes", "credentials", "create"],
        requires_write=True,
        handler=handle_credentials_create,
    ),
    create_tool(
        name="thousandeyes_credentials_update",
        description="""Update an existing credential.""",
        platform="thousandeyes",
        category="credentials",
        properties={
            "credential_id": {
                        "type": "string",
                        "description": "Credential Id"
            },
            "name": {
                        "type": "string"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            },
            "token": {
                        "type": "string"
            }
},
        required=["credential_id"],
        tags=["thousandeyes", "credentials", "update"],
        requires_write=True,
        handler=handle_credentials_update,
    ),
    create_tool(
        name="thousandeyes_credentials_delete",
        description="""Delete a credential.""",
        platform="thousandeyes",
        category="credentials",
        properties={
            "credential_id": {
                        "type": "string",
                        "description": "Credential Id"
            }
},
        required=["credential_id"],
        tags=["thousandeyes", "credentials", "delete"],
        requires_write=True,
        handler=handle_credentials_delete,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_credentials_tools():
    """Register all credentials tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_CREDENTIALS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_CREDENTIALS_TOOLS)} thousandeyes credentials tools")


# Auto-register on import
register_credentials_tools()
