"""
Thousandeyes Agents Tools

Auto-generated from archived A2A skills.
Total tools: 13
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_agents_get_list(params: Dict, context: Any) -> Dict:
    """Handler for List Agents."""
    try:
        # Build API path
        path = "/agents/get/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Agent by ID."""
    try:
        # Build API path
        path = "/agents/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_update(params: Dict, context: Any) -> Dict:
    """Handler for Update Agent."""
    try:
        # Build API path
        path = "/agents/update"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Agent."""
    try:
        # Build API path
        path = "/agents/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_get_cluster_members(params: Dict, context: Any) -> Dict:
    """Handler for Get Cluster Members."""
    try:
        # Build API path
        path = "/agents/get/cluster/members"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_add_to_cluster(params: Dict, context: Any) -> Dict:
    """Handler for Add Agent to Cluster."""
    try:
        # Build API path
        path = "/agents/add/to/cluster"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_remove_from_cluster(params: Dict, context: Any) -> Dict:
    """Handler for Remove Agent from Cluster."""
    try:
        # Build API path
        path = "/agents/remove/from/cluster"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_get_test_assignments(params: Dict, context: Any) -> Dict:
    """Handler for Get Agent Test Assignments."""
    try:
        # Build API path
        path = "/agents/get/test/assignments"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_assign_tests(params: Dict, context: Any) -> Dict:
    """Handler for Assign Tests to Agent."""
    try:
        # Build API path
        path = "/agents/assign/tests"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_unassign_tests(params: Dict, context: Any) -> Dict:
    """Handler for Unassign Tests from Agent."""
    try:
        # Build API path
        path = "/agents/unassign/tests"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_get_notification_rules(params: Dict, context: Any) -> Dict:
    """Handler for Get Agent Notification Rules."""
    try:
        # Build API path
        path = "/agents/get/notification/rules"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_get_notification_rule(params: Dict, context: Any) -> Dict:
    """Handler for Get Agent Notification Rule."""
    try:
        # Build API path
        path = "/agents/get/notification/rule"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_agents_get_proxies(params: Dict, context: Any) -> Dict:
    """Handler for Get Agent Proxies."""
    try:
        # Build API path
        path = "/agents/get/proxies"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_AGENTS_TOOLS = [
    create_tool(
        name="thousandeyes_agents_get_list",
        description="""Get all Cloud and Enterprise agents.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "aid": {
                        "type": "string"
            },
            "agent_type": {
                        "type": "string",
                        "enum": [
                                    "CLOUD",
                                    "ENTERPRISE",
                                    "ENTERPRISE_CLUSTER"
                        ]
            }
},
        required=[],
        tags=["thousandeyes", "agents", "list"],
        requires_write=False,
        handler=handle_agents_get_list,
    ),
    create_tool(
        name="thousandeyes_agents_get_by_id",
        description="""Get details of a specific agent.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "agents", "details"],
        requires_write=False,
        handler=handle_agents_get_by_id,
    ),
    create_tool(
        name="thousandeyes_agents_update",
        description="""Update an Enterprise agent's configuration.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "agent_name": {
                        "type": "string"
            },
            "enabled": {
                        "type": "boolean"
            },
            "keep_browser_cache": {
                        "type": "boolean"
            },
            "target_for_tests": {
                        "type": "string"
            },
            "ip_addresses": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "agents", "update"],
        requires_write=True,
        handler=handle_agents_update,
    ),
    create_tool(
        name="thousandeyes_agents_delete",
        description="""Delete an Enterprise agent.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "agents", "delete"],
        requires_write=True,
        handler=handle_agents_delete,
    ),
    create_tool(
        name="thousandeyes_agents_get_cluster_members",
        description="""Get members of an Enterprise agent cluster.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "agents", "cluster", "members"],
        requires_write=False,
        handler=handle_agents_get_cluster_members,
    ),
    create_tool(
        name="thousandeyes_agents_add_to_cluster",
        description="""Add an Enterprise agent to a cluster.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "cluster_id": {
                        "type": "string",
                        "description": "Target cluster ID"
            }
},
        required=["agent_id", "cluster_id"],
        tags=["thousandeyes", "agents", "cluster", "add"],
        requires_write=False,
        handler=handle_agents_add_to_cluster,
    ),
    create_tool(
        name="thousandeyes_agents_remove_from_cluster",
        description="""Remove an Enterprise agent from a cluster.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "agents", "cluster", "remove"],
        requires_write=False,
        handler=handle_agents_remove_from_cluster,
    ),
    create_tool(
        name="thousandeyes_agents_get_test_assignments",
        description="""Get tests assigned to an agent.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            }
},
        required=["agent_id"],
        tags=["thousandeyes", "agents", "tests", "assignments"],
        requires_write=False,
        handler=handle_agents_get_test_assignments,
    ),
    create_tool(
        name="thousandeyes_agents_assign_tests",
        description="""Assign tests to an Enterprise agent.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "test_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Test IDs to assign"
            }
},
        required=["agent_id", "test_ids"],
        tags=["thousandeyes", "agents", "tests", "assign"],
        requires_write=False,
        handler=handle_agents_assign_tests,
    ),
    create_tool(
        name="thousandeyes_agents_unassign_tests",
        description="""Unassign tests from an Enterprise agent.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "test_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Test IDs to unassign"
            }
},
        required=["agent_id", "test_ids"],
        tags=["thousandeyes", "agents", "tests", "unassign"],
        requires_write=False,
        handler=handle_agents_unassign_tests,
    ),
    create_tool(
        name="thousandeyes_agents_get_notification_rules",
        description="""Get notification rules for agents.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "agents", "notification", "rules", "list"],
        requires_write=False,
        handler=handle_agents_get_notification_rules,
    ),
    create_tool(
        name="thousandeyes_agents_get_notification_rule",
        description="""Get a specific notification rule.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "rule_id": {
                        "type": "string",
                        "description": "Rule Id"
            }
},
        required=["rule_id"],
        tags=["thousandeyes", "agents", "notification", "rule", "details"],
        requires_write=False,
        handler=handle_agents_get_notification_rule,
    ),
    create_tool(
        name="thousandeyes_agents_get_proxies",
        description="""Get proxy configurations for agents.""",
        platform="thousandeyes",
        category="agents",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "agents", "proxy", "list"],
        requires_write=False,
        handler=handle_agents_get_proxies,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_agents_tools():
    """Register all agents tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_AGENTS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_AGENTS_TOOLS)} thousandeyes agents tools")


# Auto-register on import
register_agents_tools()
