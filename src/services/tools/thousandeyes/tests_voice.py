"""
Thousandeyes Tests_Voice Tools

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

async def handle_tests_get_sip_server_list(params: Dict, context: Any) -> Dict:
    """Handler for List SIP Server Tests."""
    try:
        # Build API path
        path = "/tests/get/sip/server/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_sip_server(params: Dict, context: Any) -> Dict:
    """Handler for Get SIP Server Test."""
    try:
        # Build API path
        path = "/tests/get/sip/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_sip_server(params: Dict, context: Any) -> Dict:
    """Handler for Create SIP Server Test."""
    try:
        # Build API path
        path = "/tests/create/sip/server"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_sip_server(params: Dict, context: Any) -> Dict:
    """Handler for Update SIP Server Test."""
    try:
        # Build API path
        path = "/tests/update/sip/server"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_sip_server(params: Dict, context: Any) -> Dict:
    """Handler for Delete SIP Server Test."""
    try:
        # Build API path
        path = "/tests/delete/sip/server"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_voice_list(params: Dict, context: Any) -> Dict:
    """Handler for List Voice Tests."""
    try:
        # Build API path
        path = "/tests/get/voice/list"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_get_voice(params: Dict, context: Any) -> Dict:
    """Handler for Get Voice Test."""
    try:
        # Build API path
        path = "/tests/get/voice"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_create_voice(params: Dict, context: Any) -> Dict:
    """Handler for Create Voice Test."""
    try:
        # Build API path
        path = "/tests/create/voice"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_update_voice(params: Dict, context: Any) -> Dict:
    """Handler for Update Voice Test."""
    try:
        # Build API path
        path = "/tests/update/voice"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_tests_delete_voice(params: Dict, context: Any) -> Dict:
    """Handler for Delete Voice Test."""
    try:
        # Build API path
        path = "/tests/delete/voice"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_TESTS_VOICE_TOOLS = [
    create_tool(
        name="thousandeyes_tests_get_sip_server_list",
        description="""Get all SIP server tests.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "voice", "sip-server", "list"],
        requires_write=False,
        handler=handle_tests_get_sip_server_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_sip_server",
        description="""Get details of a specific SIP server test.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "voice", "sip-server", "details"],
        requires_write=False,
        handler=handle_tests_get_sip_server,
    ),
    create_tool(
        name="thousandeyes_tests_create_sip_server",
        description="""Create a new SIP server test.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "target_sip_credentials": {
                        "type": "string"
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
            "options_regex": {
                        "type": "string"
            },
            "register_enabled": {
                        "type": "boolean",
                        "default": False
            },
            "sip_time_limit": {
                        "type": "integer"
            },
            "sip_target_time": {
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
        required=["test_name", "target_sip_credentials", "agents"],
        tags=["thousandeyes", "tests", "voice", "sip-server", "create"],
        requires_write=True,
        handler=handle_tests_create_sip_server,
    ),
    create_tool(
        name="thousandeyes_tests_update_sip_server",
        description="""Update an existing SIP server test.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "target_sip_credentials": {
                        "type": "object"
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
        tags=["thousandeyes", "tests", "voice", "sip-server", "update"],
        requires_write=True,
        handler=handle_tests_update_sip_server,
    ),
    create_tool(
        name="thousandeyes_tests_delete_sip_server",
        description="""Delete a SIP server test.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "voice", "sip-server", "delete"],
        requires_write=True,
        handler=handle_tests_delete_sip_server,
    ),
    create_tool(
        name="thousandeyes_tests_get_voice_list",
        description="""Get all voice (RTP stream) tests.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "tests", "voice", "rtp", "list"],
        requires_write=False,
        handler=handle_tests_get_voice_list,
    ),
    create_tool(
        name="thousandeyes_tests_get_voice",
        description="""Get details of a specific voice test.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "voice", "rtp", "details"],
        requires_write=False,
        handler=handle_tests_get_voice,
    ),
    create_tool(
        name="thousandeyes_tests_create_voice",
        description="""Create a new voice (RTP stream) test.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "target_agent_id": {
                        "type": "string",
                        "description": "Target agent for RTP stream"
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
            "codec_id": {
                        "type": "integer",
                        "description": "Voice codec ID"
            },
            "codec": {
                        "type": "string",
                        "description": "Codec"
            },
            "dscp_id": {
                        "type": "integer"
            },
            "dscp": {
                        "type": "string",
                        "description": "Dscp"
            },
            "duration": {
                        "type": "integer",
                        "description": "Call duration in seconds",
                        "default": 5
            },
            "jitter_buffer": {
                        "type": "integer",
                        "description": "Jitter buffer size in ms"
            },
            "num_path_traces": {
                        "type": "integer",
                        "default": 3
            },
            "target_sip_credentials": {
                        "type": "string"
            }
},
        required=["test_name", "target_agent_id", "agents"],
        tags=["thousandeyes", "tests", "voice", "rtp", "create"],
        requires_write=True,
        handler=handle_tests_create_voice,
    ),
    create_tool(
        name="thousandeyes_tests_update_voice",
        description="""Update an existing voice test.""",
        platform="thousandeyes",
        category="tests_voice",
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
            "enabled": {
                        "type": "string",
                        "description": "Enabled"
            },
            "codec_id": {
                        "type": "integer"
            },
            "duration": {
                        "type": "integer"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "voice", "rtp", "update"],
        requires_write=True,
        handler=handle_tests_update_voice,
    ),
    create_tool(
        name="thousandeyes_tests_delete_voice",
        description="""Delete a voice test.""",
        platform="thousandeyes",
        category="tests_voice",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "tests", "voice", "rtp", "delete"],
        requires_write=True,
        handler=handle_tests_delete_voice,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_tests_voice_tools():
    """Register all tests_voice tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_TESTS_VOICE_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_TESTS_VOICE_TOOLS)} thousandeyes tests_voice tools")


# Auto-register on import
register_tests_voice_tools()
