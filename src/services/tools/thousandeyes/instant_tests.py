"""
Thousandeyes Instant_Tests Tools

Auto-generated from archived A2A skills.
Total tools: 12
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_instant_run_agent_to_server(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant Agent-to-Server Test."""
    try:
        # Build API path
        path = "/instant/run/agent/to/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_agent_to_agent(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant Agent-to-Agent Test."""
    try:
        # Build API path
        path = "/instant/run/agent/to/agent"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_http_server(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant HTTP Server Test."""
    try:
        # Build API path
        path = "/instant/run/http/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_page_load(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant Page Load Test."""
    try:
        # Build API path
        path = "/instant/run/page/load"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_web_transactions(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant Web Transaction Test."""
    try:
        # Build API path
        path = "/instant/run/web/transactions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_api(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant API Test."""
    try:
        # Build API path
        path = "/instant/run/api"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_dns_server(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant DNS Server Test."""
    try:
        # Build API path
        path = "/instant/run/dns/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_dns_trace(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant DNS Trace Test."""
    try:
        # Build API path
        path = "/instant/run/dns/trace"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_sip_server(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant SIP Server Test."""
    try:
        # Build API path
        path = "/instant/run/sip/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_voice(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant Voice Test."""
    try:
        # Build API path
        path = "/instant/run/voice"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_run_ftp_server(params: Dict, context: Any) -> Dict:
    """Handler for Run Instant FTP Server Test."""
    try:
        # Build API path
        path = "/instant/run/ftp/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_instant_rerun_test(params: Dict, context: Any) -> Dict:
    """Handler for Rerun Existing Test."""
    try:
        # Build API path
        path = "/instant/rerun/test"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_INSTANT_TESTS_TOOLS = [
    create_tool(
        name="thousandeyes_instant_run_agent_to_server",
        description="""Run an instant agent-to-server network test.""",
        platform="thousandeyes",
        category="instant_tests",
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
                        "type": "integer",
                        "default": 443
            },
            "protocol": {
                        "type": "string",
                        "enum": [
                                    "TCP",
                                    "UDP",
                                    "ICMP"
                        ],
                        "default": "TCP"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            }
},
        required=["server", "agents"],
        tags=["thousandeyes", "instant", "network", "agent-to-server"],
        requires_write=False,
        handler=handle_instant_run_agent_to_server,
    ),
    create_tool(
        name="thousandeyes_instant_run_agent_to_agent",
        description="""Run an instant agent-to-agent test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "target_agent_id": {
                        "type": "string"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            },
            "direction": {
                        "type": "string",
                        "enum": [
                                    "TO_TARGET",
                                    "FROM_TARGET",
                                    "BIDIRECTIONAL"
                        ],
                        "default": "BIDIRECTIONAL"
            }
},
        required=["target_agent_id", "agents"],
        tags=["thousandeyes", "instant", "network", "agent-to-agent"],
        requires_write=False,
        handler=handle_instant_run_agent_to_agent,
    ),
    create_tool(
        name="thousandeyes_instant_run_http_server",
        description="""Run an instant HTTP server test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "url": {
                        "type": "string",
                        "description": "Url"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            },
            "http_version": {
                        "type": "integer",
                        "enum": [
                                    1,
                                    2
                        ],
                        "default": 2
            }
},
        required=["url", "agents"],
        tags=["thousandeyes", "instant", "web", "http-server"],
        requires_write=False,
        handler=handle_instant_run_http_server,
    ),
    create_tool(
        name="thousandeyes_instant_run_page_load",
        description="""Run an instant page load test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "url": {
                        "type": "string",
                        "description": "Url"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            }
},
        required=["url", "agents"],
        tags=["thousandeyes", "instant", "web", "page-load"],
        requires_write=False,
        handler=handle_instant_run_page_load,
    ),
    create_tool(
        name="thousandeyes_instant_run_web_transactions",
        description="""Run an instant web transaction test.""",
        platform="thousandeyes",
        category="instant_tests",
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
                        "type": "string"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            }
},
        required=["url", "transaction_script", "agents"],
        tags=["thousandeyes", "instant", "web", "web-transactions"],
        requires_write=False,
        handler=handle_instant_run_web_transactions,
    ),
    create_tool(
        name="thousandeyes_instant_run_api",
        description="""Run an instant API test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "url": {
                        "type": "string",
                        "description": "Url"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            },
            "requests": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["url", "agents"],
        tags=["thousandeyes", "instant", "web", "api"],
        requires_write=False,
        handler=handle_instant_run_api,
    ),
    create_tool(
        name="thousandeyes_instant_run_dns_server",
        description="""Run an instant DNS server test.""",
        platform="thousandeyes",
        category="instant_tests",
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
                                    "type": "object"
                        }
            },
            "record_type": {
                        "type": "string",
                        "default": "A"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            }
},
        required=["domain", "dns_servers", "agents"],
        tags=["thousandeyes", "instant", "dns", "dns-server"],
        requires_write=False,
        handler=handle_instant_run_dns_server,
    ),
    create_tool(
        name="thousandeyes_instant_run_dns_trace",
        description="""Run an instant DNS trace test.""",
        platform="thousandeyes",
        category="instant_tests",
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
                        "default": "A"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            }
},
        required=["domain", "agents"],
        tags=["thousandeyes", "instant", "dns", "dns-trace"],
        requires_write=False,
        handler=handle_instant_run_dns_trace,
    ),
    create_tool(
        name="thousandeyes_instant_run_sip_server",
        description="""Run an instant SIP server test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "target_sip_credentials": {
                        "type": "string"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            }
},
        required=["target_sip_credentials", "agents"],
        tags=["thousandeyes", "instant", "voice", "sip-server"],
        requires_write=False,
        handler=handle_instant_run_sip_server,
    ),
    create_tool(
        name="thousandeyes_instant_run_voice",
        description="""Run an instant voice (RTP) test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "target_agent_id": {
                        "type": "string"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            },
            "codec_id": {
                        "type": "integer"
            },
            "duration": {
                        "type": "integer",
                        "default": 5
            }
},
        required=["target_agent_id", "agents"],
        tags=["thousandeyes", "instant", "voice", "rtp"],
        requires_write=False,
        handler=handle_instant_run_voice,
    ),
    create_tool(
        name="thousandeyes_instant_run_ftp_server",
        description="""Run an instant FTP server test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_name": {
                        "type": "string",
                        "description": "Test Name"
            },
            "url": {
                        "type": "string",
                        "description": "Url"
            },
            "agents": {
                        "type": "string",
                        "description": "Agents"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            },
            "request_type": {
                        "type": "string",
                        "enum": [
                                    "Download",
                                    "Upload",
                                    "List"
                        ],
                        "default": "Download"
            }
},
        required=["url", "agents"],
        tags=["thousandeyes", "instant", "ftp", "ftp-server"],
        requires_write=False,
        handler=handle_instant_run_ftp_server,
    ),
    create_tool(
        name="thousandeyes_instant_rerun_test",
        description="""Rerun an existing test as an instant test.""",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "instant", "rerun"],
        requires_write=False,
        handler=handle_instant_rerun_test,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_instant_tests_tools():
    """Register all instant_tests tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_INSTANT_TESTS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_INSTANT_TESTS_TOOLS)} thousandeyes instant_tests tools")


# Auto-register on import
register_instant_tests_tools()
