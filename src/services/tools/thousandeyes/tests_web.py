"""
Thousandeyes Tests_Web Tools

Auto-generated from archived A2A skills.
Total tools: 20
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_tests_get_http_server_list(params: Dict, context: Any) -> Dict:
    """Handler for List HTTP Server Tests."""
    try:
        # Build API path
        path = "/tests/get/http/server/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_http_server(params: Dict, context: Any) -> Dict:
    """Handler for Get HTTP Server Test."""
    try:
        # Build API path
        path = "/tests/get/http/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_http_server(params: Dict, context: Any) -> Dict:
    """Handler for Create HTTP Server Test."""
    try:
        # Build API path
        path = "/tests/create/http/server"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_http_server(params: Dict, context: Any) -> Dict:
    """Handler for Update HTTP Server Test."""
    try:
        # Build API path
        path = "/tests/update/http/server"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_http_server(params: Dict, context: Any) -> Dict:
    """Handler for Delete HTTP Server Test."""
    try:
        # Build API path
        path = "/tests/delete/http/server"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_page_load_list(params: Dict, context: Any) -> Dict:
    """Handler for List Page Load Tests."""
    try:
        # Build API path
        path = "/tests/get/page/load/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_page_load(params: Dict, context: Any) -> Dict:
    """Handler for Get Page Load Test."""
    try:
        # Build API path
        path = "/tests/get/page/load"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_page_load(params: Dict, context: Any) -> Dict:
    """Handler for Create Page Load Test."""
    try:
        # Build API path
        path = "/tests/create/page/load"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_page_load(params: Dict, context: Any) -> Dict:
    """Handler for Update Page Load Test."""
    try:
        # Build API path
        path = "/tests/update/page/load"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_page_load(params: Dict, context: Any) -> Dict:
    """Handler for Delete Page Load Test."""
    try:
        # Build API path
        path = "/tests/delete/page/load"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_web_transactions_list(params: Dict, context: Any) -> Dict:
    """Handler for List Web Transaction Tests."""
    try:
        # Build API path
        path = "/tests/get/web/transactions/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_web_transactions(params: Dict, context: Any) -> Dict:
    """Handler for Get Web Transaction Test."""
    try:
        # Build API path
        path = "/tests/get/web/transactions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_web_transactions(params: Dict, context: Any) -> Dict:
    """Handler for Create Web Transaction Test."""
    try:
        # Build API path
        path = "/tests/create/web/transactions"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_web_transactions(params: Dict, context: Any) -> Dict:
    """Handler for Update Web Transaction Test."""
    try:
        # Build API path
        path = "/tests/update/web/transactions"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_web_transactions(params: Dict, context: Any) -> Dict:
    """Handler for Delete Web Transaction Test."""
    try:
        # Build API path
        path = "/tests/delete/web/transactions"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_api_list(params: Dict, context: Any) -> Dict:
    """Handler for List API Tests."""
    try:
        # Build API path
        path = "/tests/get/api/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_api(params: Dict, context: Any) -> Dict:
    """Handler for Get API Test."""
    try:
        # Build API path
        path = "/tests/get/api"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_api(params: Dict, context: Any) -> Dict:
    """Handler for Create API Test."""
    try:
        # Build API path
        path = "/tests/create/api"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_api(params: Dict, context: Any) -> Dict:
    """Handler for Update API Test."""
    try:
        # Build API path
        path = "/tests/update/api"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_api(params: Dict, context: Any) -> Dict:
    """Handler for Delete API Test."""
    try:
        # Build API path
        path = "/tests/delete/api"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_TESTS_WEB_TOOLS = [
    create_tool(
        name="thousandeyes_tests_get_http_server_list",
        description="""Get all HTTP server tests.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "web", "http-server", "list"],
        requires_write=False,
        handler=handle_tests_get_http_server_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_http_server",
        description="""Get details of a specific HTTP server test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "http-server", "details"],
        requires_write=False,
        handler=handle_tests_get_http_server,
    ),
    create_tool(
        name="thousandeyes_tests_create_http_server",
        description="""Create a new HTTP server test.""",
        platform="thousandeyes",
        category="tests_web",
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
            "http_version": {
                        "type": "integer",
                        "enum": [
                                    1,
                                    2
                        ],
                        "default": 2
            },
            "ssl_version_id": {
                        "type": "integer"
            },
            "verify_certificate": {
                        "type": "boolean",
                        "default": True
            },
            "auth_type": {
                        "type": "string",
                        "enum": [
                                    "NONE",
                                    "BASIC",
                                    "NTLM",
                                    "KERBEROS"
                        ]
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            },
            "headers": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            },
            "post_body": {
                        "type": "string"
            },
            "http_target_time": {
                        "type": "integer"
            },
            "http_time_limit": {
                        "type": "integer"
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
        tags=["thousandeyes", "tests", "web", "http-server", "create"],
        requires_write=True,
        handler=handle_tests_create_http_server,
    ),
    create_tool(
        name="thousandeyes_tests_update_http_server",
        description="""Update an existing HTTP server test.""",
        platform="thousandeyes",
        category="tests_web",
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
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "http-server", "update"],
        requires_write=True,
        handler=handle_tests_update_http_server,
    ),
    create_tool(
        name="thousandeyes_tests_delete_http_server",
        description="""Delete an HTTP server test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "http-server", "delete"],
        requires_write=True,
        handler=handle_tests_delete_http_server,
    ),
    create_tool(
        name="thousandeyes_tests_get_page_load_list",
        description="""Get all page load tests.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "web", "page-load", "list"],
        requires_write=False,
        handler=handle_tests_get_page_load_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_page_load",
        description="""Get details of a specific page load test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "page-load", "details"],
        requires_write=False,
        handler=handle_tests_get_page_load,
    ),
    create_tool(
        name="thousandeyes_tests_create_page_load",
        description="""Create a new page load test.""",
        platform="thousandeyes",
        category="tests_web",
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
            "http_version": {
                        "type": "integer",
                        "enum": [
                                    1,
                                    2
                        ]
            },
            "page_load_target_time": {
                        "type": "integer"
            },
            "page_load_time_limit": {
                        "type": "integer"
            },
            "include_headers": {
                        "type": "boolean"
            },
            "emulated_device_id": {
                        "type": "integer"
            },
            "user_agent_id": {
                        "type": "integer"
            },
            "network_measurements": {
                        "type": "boolean",
                        "default": True
            },
            "bgp_measurements": {
                        "type": "boolean",
                        "default": True
            }
},
        required=["test_name", "url", "agents"],
        tags=["thousandeyes", "tests", "web", "page-load", "create"],
        requires_write=True,
        handler=handle_tests_create_page_load,
    ),
    create_tool(
        name="thousandeyes_tests_update_page_load",
        description="""Update an existing page load test.""",
        platform="thousandeyes",
        category="tests_web",
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
            "agents": {
                        "type": "string",
                        "description": "Agents"
            },
            "enabled": {
                        "type": "string",
                        "description": "Enabled"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "page-load", "update"],
        requires_write=True,
        handler=handle_tests_update_page_load,
    ),
    create_tool(
        name="thousandeyes_tests_delete_page_load",
        description="""Delete a page load test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "page-load", "delete"],
        requires_write=True,
        handler=handle_tests_delete_page_load,
    ),
    create_tool(
        name="thousandeyes_tests_get_web_transactions_list",
        description="""Get all web transaction tests.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "web", "web-transactions", "list"],
        requires_write=False,
        handler=handle_tests_get_web_transactions_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_web_transactions",
        description="""Get details of a specific web transaction test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "web-transactions", "details"],
        requires_write=False,
        handler=handle_tests_get_web_transactions,
    ),
    create_tool(
        name="thousandeyes_tests_create_web_transactions",
        description="""Create a new web transaction test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "url": {
                        "type": "string",
                        "description": "Url"
            },
            "transaction_script": {
                        "type": "string",
                        "description": "Selenium script for the transaction"
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
            "target_time": {
                        "type": "integer"
            },
            "time_limit": {
                        "type": "integer"
            },
            "emulated_device_id": {
                        "type": "integer"
            },
            "credentials": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            },
            "network_measurements": {
                        "type": "boolean",
                        "default": True
            }
},
        required=["test_name", "url", "transaction_script", "agents"],
        tags=["thousandeyes", "tests", "web", "web-transactions", "create"],
        requires_write=True,
        handler=handle_tests_create_web_transactions,
    ),
    create_tool(
        name="thousandeyes_tests_update_web_transactions",
        description="""Update an existing web transaction test.""",
        platform="thousandeyes",
        category="tests_web",
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
            "transaction_script": {
                        "type": "string"
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
        tags=["thousandeyes", "tests", "web", "web-transactions", "update"],
        requires_write=True,
        handler=handle_tests_update_web_transactions,
    ),
    create_tool(
        name="thousandeyes_tests_delete_web_transactions",
        description="""Delete a web transaction test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "web-transactions", "delete"],
        requires_write=True,
        handler=handle_tests_delete_web_transactions,
    ),
    create_tool(
        name="thousandeyes_tests_get_api_list",
        description="""Get all API tests.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "web", "api", "list"],
        requires_write=False,
        handler=handle_tests_get_api_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_api",
        description="""Get details of a specific API test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "api", "details"],
        requires_write=False,
        handler=handle_tests_get_api,
    ),
    create_tool(
        name="thousandeyes_tests_create_api",
        description="""Create a new API test.""",
        platform="thousandeyes",
        category="tests_web",
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
            "requests": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "url": {
                                                            "type": "string"
                                                },
                                                "method": {
                                                            "type": "string"
                                                },
                                                "headers": {
                                                            "type": "object"
                                                },
                                                "body": {
                                                            "type": "string"
                                                }
                                    }
                        },
                        "description": "API request definitions"
            },
            "target_time": {
                        "type": "integer"
            },
            "time_limit": {
                        "type": "integer"
            },
            "network_measurements": {
                        "type": "boolean",
                        "default": True
            }
},
        required=["test_name", "url", "agents"],
        tags=["thousandeyes", "tests", "web", "api", "create"],
        requires_write=True,
        handler=handle_tests_create_api,
    ),
    create_tool(
        name="thousandeyes_tests_update_api",
        description="""Update an existing API test.""",
        platform="thousandeyes",
        category="tests_web",
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
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "api", "update"],
        requires_write=True,
        handler=handle_tests_update_api,
    ),
    create_tool(
        name="thousandeyes_tests_delete_api",
        description="""Delete an API test.""",
        platform="thousandeyes",
        category="tests_web",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "web", "api", "delete"],
        requires_write=True,
        handler=handle_tests_delete_api,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_tests_web_tools():
    """Register all tests_web tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_TESTS_WEB_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_TESTS_WEB_TOOLS)} thousandeyes tests_web tools")


# Auto-register on import
register_tests_web_tools()
