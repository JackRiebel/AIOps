"""
Thousandeyes Tests_Dns Tools

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

async def handle_tests_get_dns_server_list(params: Dict, context: Any) -> Dict:
    """Handler for List DNS Server Tests."""
    try:
        # Build API path
        path = "/tests/get/dns/server/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_dns_server(params: Dict, context: Any) -> Dict:
    """Handler for Get DNS Server Test."""
    try:
        # Build API path
        path = "/tests/get/dns/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_dns_server(params: Dict, context: Any) -> Dict:
    """Handler for Create DNS Server Test."""
    try:
        # Build API path
        path = "/tests/create/dns/server"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_dns_server(params: Dict, context: Any) -> Dict:
    """Handler for Update DNS Server Test."""
    try:
        # Build API path
        path = "/tests/update/dns/server"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_dns_server(params: Dict, context: Any) -> Dict:
    """Handler for Delete DNS Server Test."""
    try:
        # Build API path
        path = "/tests/delete/dns/server"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_dns_trace_list(params: Dict, context: Any) -> Dict:
    """Handler for List DNS Trace Tests."""
    try:
        # Build API path
        path = "/tests/get/dns/trace/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_dns_trace(params: Dict, context: Any) -> Dict:
    """Handler for Get DNS Trace Test."""
    try:
        # Build API path
        path = "/tests/get/dns/trace"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_dns_trace(params: Dict, context: Any) -> Dict:
    """Handler for Create DNS Trace Test."""
    try:
        # Build API path
        path = "/tests/create/dns/trace"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_dns_trace(params: Dict, context: Any) -> Dict:
    """Handler for Update DNS Trace Test."""
    try:
        # Build API path
        path = "/tests/update/dns/trace"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_dns_trace(params: Dict, context: Any) -> Dict:
    """Handler for Delete DNS Trace Test."""
    try:
        # Build API path
        path = "/tests/delete/dns/trace"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_dnssec_list(params: Dict, context: Any) -> Dict:
    """Handler for List DNSSEC Tests."""
    try:
        # Build API path
        path = "/tests/get/dnssec/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_dnssec(params: Dict, context: Any) -> Dict:
    """Handler for Get DNSSEC Test."""
    try:
        # Build API path
        path = "/tests/get/dnssec"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_dnssec(params: Dict, context: Any) -> Dict:
    """Handler for Create DNSSEC Test."""
    try:
        # Build API path
        path = "/tests/create/dnssec"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_dnssec(params: Dict, context: Any) -> Dict:
    """Handler for Update DNSSEC Test."""
    try:
        # Build API path
        path = "/tests/update/dnssec"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_dnssec(params: Dict, context: Any) -> Dict:
    """Handler for Delete DNSSEC Test."""
    try:
        # Build API path
        path = "/tests/delete/dnssec"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_TESTS_DNS_TOOLS = [
    create_tool(
        name="thousandeyes_tests_get_dns_server_list",
        description="""Get all DNS server tests.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "dns", "dns-server", "list"],
        requires_write=False,
        handler=handle_tests_get_dns_server_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_dns_server",
        description="""Get details of a specific DNS server test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "dns", "dns-server", "details"],
        requires_write=False,
        handler=handle_tests_get_dns_server,
    ),
    create_tool(
        name="thousandeyes_tests_create_dns_server",
        description="""Create a new DNS server test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "domain": {
                        "type": "string",
                        "description": "Domain"
            },
            "dns_servers": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "serverName": {
                                                            "type": "string"
                                                }
                                    }
                        },
                        "description": "DNS servers to query"
            },
            "record_type": {
                        "type": "string",
                        "description": "Record Type"
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
            "dns_query_class": {
                        "type": "string",
                        "enum": [
                                    "IN",
                                    "CH",
                                    "HS",
                                    "ANY"
                        ],
                        "default": "IN"
            },
            "recursion_desired": {
                        "type": "boolean",
                        "default": True
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
        required=["test_name", "domain", "dns_servers", "agents"],
        tags=["thousandeyes", "tests", "dns", "dns-server", "create"],
        requires_write=True,
        handler=handle_tests_create_dns_server,
    ),
    create_tool(
        name="thousandeyes_tests_update_dns_server",
        description="""Update an existing DNS server test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "domain": {
                        "type": "string",
                        "description": "Domain"
            },
            "dns_servers": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            },
            "record_type": {
                        "type": "string",
                        "description": "Record Type"
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
        tags=["thousandeyes", "tests", "dns", "dns-server", "update"],
        requires_write=True,
        handler=handle_tests_update_dns_server,
    ),
    create_tool(
        name="thousandeyes_tests_delete_dns_server",
        description="""Delete a DNS server test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "dns", "dns-server", "delete"],
        requires_write=True,
        handler=handle_tests_delete_dns_server,
    ),
    create_tool(
        name="thousandeyes_tests_get_dns_trace_list",
        description="""Get all DNS trace tests.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "dns", "dns-trace", "list"],
        requires_write=False,
        handler=handle_tests_get_dns_trace_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_dns_trace",
        description="""Get details of a specific DNS trace test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "dns", "dns-trace", "details"],
        requires_write=False,
        handler=handle_tests_get_dns_trace,
    ),
    create_tool(
        name="thousandeyes_tests_create_dns_trace",
        description="""Create a new DNS trace test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "domain": {
                        "type": "string",
                        "description": "Domain"
            },
            "record_type": {
                        "type": "string",
                        "description": "Record Type"
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
            "dns_query_class": {
                        "type": "string",
                        "enum": [
                                    "IN",
                                    "CH",
                                    "HS",
                                    "ANY"
                        ],
                        "default": "IN"
            }
},
        required=["test_name", "domain", "agents"],
        tags=["thousandeyes", "tests", "dns", "dns-trace", "create"],
        requires_write=True,
        handler=handle_tests_create_dns_trace,
    ),
    create_tool(
        name="thousandeyes_tests_update_dns_trace",
        description="""Update an existing DNS trace test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "domain": {
                        "type": "string",
                        "description": "Domain"
            },
            "record_type": {
                        "type": "string",
                        "description": "Record Type"
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
        tags=["thousandeyes", "tests", "dns", "dns-trace", "update"],
        requires_write=True,
        handler=handle_tests_update_dns_trace,
    ),
    create_tool(
        name="thousandeyes_tests_delete_dns_trace",
        description="""Delete a DNS trace test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "dns", "dns-trace", "delete"],
        requires_write=True,
        handler=handle_tests_delete_dns_trace,
    ),
    create_tool(
        name="thousandeyes_tests_get_dnssec_list",
        description="""Get all DNSSEC validation tests.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "dns", "dnssec", "list"],
        requires_write=False,
        handler=handle_tests_get_dnssec_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_dnssec",
        description="""Get details of a specific DNSSEC test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "dns", "dnssec", "details"],
        requires_write=False,
        handler=handle_tests_get_dnssec,
    ),
    create_tool(
        name="thousandeyes_tests_create_dnssec",
        description="""Create a new DNSSEC validation test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "domain": {
                        "type": "string",
                        "description": "Domain"
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
        required=["test_name", "domain", "agents"],
        tags=["thousandeyes", "tests", "dns", "dnssec", "create"],
        requires_write=True,
        handler=handle_tests_create_dnssec,
    ),
    create_tool(
        name="thousandeyes_tests_update_dnssec",
        description="""Update an existing DNSSEC test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "domain": {
                        "type": "string",
                        "description": "Domain"
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
        tags=["thousandeyes", "tests", "dns", "dnssec", "update"],
        requires_write=True,
        handler=handle_tests_update_dnssec,
    ),
    create_tool(
        name="thousandeyes_tests_delete_dnssec",
        description="""Delete a DNSSEC test.""",
        platform="thousandeyes",
        category="tests_dns",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "dns", "dnssec", "delete"],
        requires_write=True,
        handler=handle_tests_delete_dnssec,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_tests_dns_tools():
    """Register all tests_dns tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_TESTS_DNS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_TESTS_DNS_TOOLS)} thousandeyes tests_dns tools")


# Auto-register on import
register_tests_dns_tools()
