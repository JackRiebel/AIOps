"""
Thousandeyes Tests_Network Tools

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

async def handle_tests_get_agent_to_server_list(params: Dict, context: Any) -> Dict:
    """Handler for List Agent-to-Server Tests."""
    try:
        # Build API path
        path = "/tests/get/agent/to/server/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_agent_to_server(params: Dict, context: Any) -> Dict:
    """Handler for Get Agent-to-Server Test."""
    try:
        # Build API path
        path = "/tests/get/agent/to/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_agent_to_server(params: Dict, context: Any) -> Dict:
    """Handler for Create Agent-to-Server Test."""
    try:
        # Build API path
        path = "/tests/create/agent/to/server"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_agent_to_server(params: Dict, context: Any) -> Dict:
    """Handler for Update Agent-to-Server Test."""
    try:
        # Build API path
        path = "/tests/update/agent/to/server"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_agent_to_server(params: Dict, context: Any) -> Dict:
    """Handler for Delete Agent-to-Server Test."""
    try:
        # Build API path
        path = "/tests/delete/agent/to/server"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_agent_to_agent_list(params: Dict, context: Any) -> Dict:
    """Handler for List Agent-to-Agent Tests."""
    try:
        # Build API path
        path = "/tests/get/agent/to/agent/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_agent_to_agent(params: Dict, context: Any) -> Dict:
    """Handler for Get Agent-to-Agent Test."""
    try:
        # Build API path
        path = "/tests/get/agent/to/agent"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_agent_to_agent(params: Dict, context: Any) -> Dict:
    """Handler for Create Agent-to-Agent Test."""
    try:
        # Build API path
        path = "/tests/create/agent/to/agent"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_agent_to_agent(params: Dict, context: Any) -> Dict:
    """Handler for Update Agent-to-Agent Test."""
    try:
        # Build API path
        path = "/tests/update/agent/to/agent"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_agent_to_agent(params: Dict, context: Any) -> Dict:
    """Handler for Delete Agent-to-Agent Test."""
    try:
        # Build API path
        path = "/tests/delete/agent/to/agent"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_TESTS_NETWORK_TOOLS = [
    create_tool(
        name="thousandeyes_tests_get_agent_to_server_list",
        description="""Get all agent-to-server network tests.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "aid": {
                        "type": "string",
                        "description": "Account group ID"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "network", "agent-to-server", "list"],
        requires_write=False,
        handler=handle_tests_get_agent_to_server_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_agent_to_server",
        description="""Get details of a specific agent-to-server test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "network", "agent-to-server", "details"],
        requires_write=False,
        handler=handle_tests_get_agent_to_server,
    ),
    create_tool(
        name="thousandeyes_tests_create_agent_to_server",
        description="""Create a new agent-to-server network test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "server": {
                        "type": "string",
                        "description": "Server"
            },
            "port": {
                        "type": "string",
                        "description": "Port"
            },
            "protocol": {
                        "type": "string",
                        "description": "Protocol"
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
            "bandwidth_measurements": {
                        "type": "boolean",
                        "default": False
            },
            "mtu_measurements": {
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
            "probe_mode": {
                        "type": "string",
                        "enum": [
                                    "AUTO",
                                    "SACK",
                                    "SYN"
                        ]
            }
},
        required=["test_name", "server", "agents"],
        tags=["thousandeyes", "tests", "network", "agent-to-server", "create"],
        requires_write=True,
        handler=handle_tests_create_agent_to_server,
    ),
    create_tool(
        name="thousandeyes_tests_update_agent_to_server",
        description="""Update an existing agent-to-server test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "server": {
                        "type": "string",
                        "description": "Server"
            },
            "port": {
                        "type": "string",
                        "description": "Port"
            },
            "protocol": {
                        "type": "string",
                        "description": "Protocol"
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
        tags=["thousandeyes", "tests", "network", "agent-to-server", "update"],
        requires_write=True,
        handler=handle_tests_update_agent_to_server,
    ),
    create_tool(
        name="thousandeyes_tests_delete_agent_to_server",
        description="""Delete an agent-to-server test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "network", "agent-to-server", "delete"],
        requires_write=True,
        handler=handle_tests_delete_agent_to_server,
    ),
    create_tool(
        name="thousandeyes_tests_get_agent_to_agent_list",
        description="""Get all agent-to-agent bidirectional network tests.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "aid": {
                        "type": "string",
                        "description": "Account group ID"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "network", "agent-to-agent", "list"],
        requires_write=False,
        handler=handle_tests_get_agent_to_agent_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_agent_to_agent",
        description="""Get details of a specific agent-to-agent test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "network", "agent-to-agent", "details"],
        requires_write=False,
        handler=handle_tests_get_agent_to_agent,
    ),
    create_tool(
        name="thousandeyes_tests_create_agent_to_agent",
        description="""Create a new agent-to-agent bidirectional test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "target_agent_id": {
                        "type": "string",
                        "description": "Target agent ID"
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
            "direction": {
                        "type": "string",
                        "enum": [
                                    "TO_TARGET",
                                    "FROM_TARGET",
                                    "BIDIRECTIONAL"
                        ],
                        "default": "BIDIRECTIONAL"
            },
            "dscp_id": {
                        "type": "integer"
            },
            "port": {
                        "type": "string",
                        "description": "Port"
            },
            "protocol": {
                        "type": "string",
                        "description": "Protocol"
            },
            "throughput_measurements": {
                        "type": "boolean",
                        "default": False
            }
},
        required=["test_name", "target_agent_id", "agents"],
        tags=["thousandeyes", "tests", "network", "agent-to-agent", "create"],
        requires_write=True,
        handler=handle_tests_create_agent_to_agent,
    ),
    create_tool(
        name="thousandeyes_tests_update_agent_to_agent",
        description="""Update an existing agent-to-agent test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
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
        tags=["thousandeyes", "tests", "network", "agent-to-agent", "update"],
        requires_write=True,
        handler=handle_tests_update_agent_to_agent,
    ),
    create_tool(
        name="thousandeyes_tests_delete_agent_to_agent",
        description="""Delete an agent-to-agent test.""",
        platform="thousandeyes",
        category="tests_network",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "network", "agent-to-agent", "delete"],
        requires_write=True,
        handler=handle_tests_delete_agent_to_agent,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_tests_network_tools():
    """Register all tests_network tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_TESTS_NETWORK_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_TESTS_NETWORK_TOOLS)} thousandeyes tests_network tools")


# Auto-register on import
register_tests_network_tools()
