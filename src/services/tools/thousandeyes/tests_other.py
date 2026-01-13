"""
Thousandeyes Tests_Other Tools

Auto-generated from archived A2A skills.
Total tools: 10
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_tests_get_ftp_server_list(params: Dict, context: Any) -> Dict:
    """Handler for List FTP Server Tests."""
    try:
        # Build API path
        path = "/tests/get/ftp/server/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_ftp_server(params: Dict, context: Any) -> Dict:
    """Handler for Get FTP Server Test."""
    try:
        # Build API path
        path = "/tests/get/ftp/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_ftp_server(params: Dict, context: Any) -> Dict:
    """Handler for Create FTP Server Test."""
    try:
        # Build API path
        path = "/tests/create/ftp/server"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_ftp_server(params: Dict, context: Any) -> Dict:
    """Handler for Update FTP Server Test."""
    try:
        # Build API path
        path = "/tests/update/ftp/server"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_ftp_server(params: Dict, context: Any) -> Dict:
    """Handler for Delete FTP Server Test."""
    try:
        # Build API path
        path = "/tests/delete/ftp/server"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_bgp_list(params: Dict, context: Any) -> Dict:
    """Handler for List BGP Tests."""
    try:
        # Build API path
        path = "/tests/get/bgp/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_bgp(params: Dict, context: Any) -> Dict:
    """Handler for Get BGP Test."""
    try:
        # Build API path
        path = "/tests/get/bgp"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_bgp(params: Dict, context: Any) -> Dict:
    """Handler for Create BGP Test."""
    try:
        # Build API path
        path = "/tests/create/bgp"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_bgp(params: Dict, context: Any) -> Dict:
    """Handler for Update BGP Test."""
    try:
        # Build API path
        path = "/tests/update/bgp"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_bgp(params: Dict, context: Any) -> Dict:
    """Handler for Delete BGP Test."""
    try:
        # Build API path
        path = "/tests/delete/bgp"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_TESTS_OTHER_TOOLS = [
    create_tool(
        name="thousandeyes_tests_get_ftp_server_list",
        description="""Get all FTP server tests.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "ftp", "ftp-server", "list"],
        requires_write=False,
        handler=handle_tests_get_ftp_server_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_ftp_server",
        description="""Get details of a specific FTP server test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "ftp", "ftp-server", "details"],
        requires_write=False,
        handler=handle_tests_get_ftp_server,
    ),
    create_tool(
        name="thousandeyes_tests_create_ftp_server",
        description="""Create a new FTP server test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "url": {
                        "type": "string",
                        "description": "Url"
            },
            "interval": {
                        "type": "string",
                        "description": "Interval"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            },
            "alert_rules": {
                        "type": "string",
                        "description": "Alert Rules"
            },
            "enabled": {
                        "type": "string",
                        "description": "Enabled"
            },
            "description": {
                        "type": "string"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            },
            "ftp_time_limit": {
                        "type": "integer"
            },
            "ftp_target_time": {
                        "type": "integer"
            },
            "request_type": {
                        "type": "string",
                        "enum": [
                                    "Download",
                                    "Upload",
                                    "List"
                        ],
                        "default": "Download"
            },
            "use_active_ftp": {
                        "type": "boolean",
                        "default": False
            },
            "network_measurements": {
                        "type": "boolean",
                        "default": True
            },
            "bgp_measurements": {
                        "type": "boolean",
                        "default": True
            },
            "mtu_measurements": {
                        "type": "boolean",
                        "default": False
            }
},
        required=["test_name", "url", "agents"],
        tags=["thousandeyes", "tests", "ftp", "ftp-server", "create"],
        requires_write=True,
        handler=handle_tests_create_ftp_server,
    ),
    create_tool(
        name="thousandeyes_tests_update_ftp_server",
        description="""Update an existing FTP server test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "url": {
                        "type": "string",
                        "description": "Url"
            },
            "interval": {
                        "type": "string",
                        "description": "Interval"
            },
            "enabled": {
                        "type": "string",
                        "description": "Enabled"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "ftp", "ftp-server", "update"],
        requires_write=True,
        handler=handle_tests_update_ftp_server,
    ),
    create_tool(
        name="thousandeyes_tests_delete_ftp_server",
        description="""Delete an FTP server test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "ftp", "ftp-server", "delete"],
        requires_write=True,
        handler=handle_tests_delete_ftp_server,
    ),
    create_tool(
        name="thousandeyes_tests_get_bgp_list",
        description="""Get all BGP routing tests.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "bgp", "routing", "list"],
        requires_write=False,
        handler=handle_tests_get_bgp_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_bgp",
        description="""Get details of a specific BGP test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "bgp", "routing", "details"],
        requires_write=False,
        handler=handle_tests_get_bgp,
    ),
    create_tool(
        name="thousandeyes_tests_create_bgp",
        description="""Create a new BGP routing test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "prefix": {
                        "type": "string",
                        "description": "Prefix"
            },
            "interval": {
                        "type": "string",
                        "description": "Interval"
            },
            "alert_rules": {
                        "type": "string",
                        "description": "Alert Rules"
            },
            "enabled": {
                        "type": "string",
                        "description": "Enabled"
            },
            "description": {
                        "type": "string"
            },
            "include_covered_prefixes": {
                        "type": "boolean",
                        "default": False
            },
            "use_public_bgp": {
                        "type": "boolean",
                        "default": True
            },
            "bgp_monitors": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "monitorId": {
                                                            "type": "string"
                                                }
                                    }
                        },
                        "description": "BGP monitors to use"
            }
},
        required=["test_name", "prefix"],
        tags=["thousandeyes", "tests", "bgp", "routing", "create"],
        requires_write=True,
        handler=handle_tests_create_bgp,
    ),
    create_tool(
        name="thousandeyes_tests_update_bgp",
        description="""Update an existing BGP test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "prefix": {
                        "type": "string",
                        "description": "Prefix"
            },
            "interval": {
                        "type": "string",
                        "description": "Interval"
            },
            "enabled": {
                        "type": "string",
                        "description": "Enabled"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "bgp", "routing", "update"],
        requires_write=True,
        handler=handle_tests_update_bgp,
    ),
    create_tool(
        name="thousandeyes_tests_delete_bgp",
        description="""Delete a BGP test.""",
        platform="thousandeyes",
        category="tests_other",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "bgp", "routing", "delete"],
        requires_write=True,
        handler=handle_tests_delete_bgp,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_tests_other_tools():
    """Register all tests_other tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_TESTS_OTHER_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_TESTS_OTHER_TOOLS)} thousandeyes tests_other tools")


# Auto-register on import
register_tests_other_tools()
