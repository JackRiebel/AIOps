"""
Thousandeyes Endpoint_Agents Tools

Auto-generated from archived A2A skills.
Total tools: 11
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_endpoint_get_agents(params: Dict, context: Any) -> Dict:
    """Handler for List Endpoint Agents."""
    try:
        # Build API path
        path = "/endpoint/get/agents"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_agent(params: Dict, context: Any) -> Dict:
    """Handler for Get Endpoint Agent."""
    try:
        # Build API path
        path = "/endpoint/get/agent"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_update_agent(params: Dict, context: Any) -> Dict:
    """Handler for Update Endpoint Agent."""
    try:
        # Build API path
        path = "/endpoint/update/agent"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_delete_agent(params: Dict, context: Any) -> Dict:
    """Handler for Delete Endpoint Agent."""
    try:
        # Build API path
        path = "/endpoint/delete/agent"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_agent_labels(params: Dict, context: Any) -> Dict:
    """Handler for Get Endpoint Agent Labels."""
    try:
        # Build API path
        path = "/endpoint/get/agent/labels"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_tests(params: Dict, context: Any) -> Dict:
    """Handler for List Endpoint Tests."""
    try:
        # Build API path
        path = "/endpoint/get/tests"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_test(params: Dict, context: Any) -> Dict:
    """Handler for Get Endpoint Test."""
    try:
        # Build API path
        path = "/endpoint/get/test"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_scheduled_tests(params: Dict, context: Any) -> Dict:
    """Handler for Get Scheduled Tests."""
    try:
        # Build API path
        path = "/endpoint/get/scheduled/tests"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_test_results(params: Dict, context: Any) -> Dict:
    """Handler for Get Endpoint Test Results."""
    try:
        # Build API path
        path = "/endpoint/get/test/results"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_network_topology(params: Dict, context: Any) -> Dict:
    """Handler for Get Endpoint Network Topology."""
    try:
        # Build API path
        path = "/endpoint/get/network/topology"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_endpoint_get_network_topology_details(params: Dict, context: Any) -> Dict:
    """Handler for Get Endpoint Network Topology Details."""
    try:
        # Build API path
        path = "/endpoint/get/network/topology/details"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_ENDPOINT_AGENTS_TOOLS = [
    create_tool(
        name="thousandeyes_endpoint_get_agents",
        description="""Get all endpoint agents.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "aid": {
                        "type": "string"
            },
            "computer_name": {
                        "type": "string"
            },
            "platform": {
                        "type": "string",
                        "enum": [
                                    "MAC",
                                    "WINDOWS"
                        ]
            },
            "agent_version": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "endpoint", "agents", "list"],
        requires_write=False,
        handler=handle_endpoint_get_agents,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_agent",
        description="""Get details of a specific endpoint agent.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "endpoint", "agent", "details"],
        requires_write=False,
        handler=handle_endpoint_get_agent,
    ),
    create_tool(
        name="thousandeyes_endpoint_update_agent",
        description="""Update an endpoint agent's configuration.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "name": {
                        "type": "string"
            },
            "labels": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "endpoint", "agent", "update"],
        requires_write=True,
        handler=handle_endpoint_update_agent,
    ),
    create_tool(
        name="thousandeyes_endpoint_delete_agent",
        description="""Delete an endpoint agent.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "endpoint", "agent", "delete"],
        requires_write=True,
        handler=handle_endpoint_delete_agent,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_agent_labels",
        description="""Get labels assigned to an endpoint agent.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "endpoint", "agent", "labels"],
        requires_write=False,
        handler=handle_endpoint_get_agent_labels,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_tests",
        description="""Get all endpoint scheduled tests.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "aid": {
                        "type": "string"
            },
            "test_type": {
                        "type": "string",
                        "enum": [
                                    "http-server",
                                    "agent-to-server"
                        ]
            }
},
        required=[],
        tags=["thousandeyes", "endpoint", "tests", "list"],
        requires_write=False,
        handler=handle_endpoint_get_tests,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_test",
        description="""Get details of a specific endpoint test.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "endpoint", "test", "details"],
        requires_write=False,
        handler=handle_endpoint_get_test,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_scheduled_tests",
        description="""Get endpoint scheduled tests.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "endpoint", "tests", "scheduled"],
        requires_write=False,
        handler=handle_endpoint_get_scheduled_tests,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_test_results",
        description="""Get results for an endpoint test.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "window": {
                        "type": "string",
                        "description": "Window"
            },
            "start_date": {
                        "type": "string",
                        "description": "Start Date"
            },
            "end_date": {
                        "type": "string",
                        "description": "End Date"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "endpoint", "results"],
        requires_write=False,
        handler=handle_endpoint_get_test_results,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_network_topology",
        description="""Get network topology data for endpoints.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "aid": {
                        "type": "string"
            },
            "window": {
                        "type": "string",
                        "description": "Window"
            },
            "start_date": {
                        "type": "string",
                        "description": "Start Date"
            },
            "end_date": {
                        "type": "string",
                        "description": "End Date"
            }
},
        required=[],
        tags=["thousandeyes", "endpoint", "topology", "network"],
        requires_write=False,
        handler=handle_endpoint_get_network_topology,
    ),
    create_tool(
        name="thousandeyes_endpoint_get_network_topology_details",
        description="""Get detailed network topology for a specific endpoint.""",
        platform="thousandeyes",
        category="endpoint_agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "window": {
                        "type": "string",
                        "description": "Window"
            },
            "start_date": {
                        "type": "string",
                        "description": "Start Date"
            },
            "end_date": {
                        "type": "string",
                        "description": "End Date"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "endpoint", "topology", "details"],
        requires_write=False,
        handler=handle_endpoint_get_network_topology_details,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_endpoint_agents_tools():
    """Register all endpoint_agents tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_ENDPOINT_AGENTS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_ENDPOINT_AGENTS_TOOLS)} thousandeyes endpoint_agents tools")


# Auto-register on import
register_endpoint_agents_tools()
