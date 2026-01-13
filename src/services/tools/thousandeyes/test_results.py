"""
Thousandeyes Test_Results Tools

Auto-generated from archived A2A skills.
Total tools: 19
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_results_get_network(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Results."""
    try:
        # Build API path
        path = "/results/get/network"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_path_vis(params: Dict, context: Any) -> Dict:
    """Handler for Get Path Visualization."""
    try:
        # Build API path
        path = "/results/get/path/vis"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_detailed_path(params: Dict, context: Any) -> Dict:
    """Handler for Get Detailed Path."""
    try:
        # Build API path
        path = "/results/get/detailed/path"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_bgp(params: Dict, context: Any) -> Dict:
    """Handler for Get BGP Results."""
    try:
        # Build API path
        path = "/results/get/bgp"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_bgp_routes(params: Dict, context: Any) -> Dict:
    """Handler for Get BGP Routes."""
    try:
        # Build API path
        path = "/results/get/bgp/routes"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_http_server(params: Dict, context: Any) -> Dict:
    """Handler for Get HTTP Server Results."""
    try:
        # Build API path
        path = "/results/get/http/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_page_load(params: Dict, context: Any) -> Dict:
    """Handler for Get Page Load Results."""
    try:
        # Build API path
        path = "/results/get/page/load"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_page_load_component(params: Dict, context: Any) -> Dict:
    """Handler for Get Page Load Component Details."""
    try:
        # Build API path
        path = "/results/get/page/load/component"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_web_transactions(params: Dict, context: Any) -> Dict:
    """Handler for Get Web Transaction Results."""
    try:
        # Build API path
        path = "/results/get/web/transactions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_web_transactions_component(params: Dict, context: Any) -> Dict:
    """Handler for Get Web Transaction Component Details."""
    try:
        # Build API path
        path = "/results/get/web/transactions/component"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_api(params: Dict, context: Any) -> Dict:
    """Handler for Get API Test Results."""
    try:
        # Build API path
        path = "/results/get/api"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_dns_server(params: Dict, context: Any) -> Dict:
    """Handler for Get DNS Server Results."""
    try:
        # Build API path
        path = "/results/get/dns/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_dns_trace(params: Dict, context: Any) -> Dict:
    """Handler for Get DNS Trace Results."""
    try:
        # Build API path
        path = "/results/get/dns/trace"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_dnssec(params: Dict, context: Any) -> Dict:
    """Handler for Get DNSSEC Results."""
    try:
        # Build API path
        path = "/results/get/dnssec"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_sip_server(params: Dict, context: Any) -> Dict:
    """Handler for Get SIP Server Results."""
    try:
        # Build API path
        path = "/results/get/sip/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_voice(params: Dict, context: Any) -> Dict:
    """Handler for Get Voice Results."""
    try:
        # Build API path
        path = "/results/get/voice"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_voice_metrics(params: Dict, context: Any) -> Dict:
    """Handler for Get Voice Metrics."""
    try:
        # Build API path
        path = "/results/get/voice/metrics"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_ftp_server(params: Dict, context: Any) -> Dict:
    """Handler for Get FTP Server Results."""
    try:
        # Build API path
        path = "/results/get/ftp/server"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_results_get_network_by_agent(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Results by Agent."""
    try:
        # Build API path
        path = "/results/get/network/by/agent"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_TEST_RESULTS_TOOLS = [
    create_tool(
        name="thousandeyes_results_get_network",
        description="""Get network layer test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "network"],
        requires_write=False,
        handler=handle_results_get_network,
    ),
    create_tool(
        name="thousandeyes_results_get_path_vis",
        description="""Get path visualization results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "path-vis", "traceroute"],
        requires_write=False,
        handler=handle_results_get_path_vis,
    ),
    create_tool(
        name="thousandeyes_results_get_detailed_path",
        description="""Get detailed path trace for specific agent and round.""",
        platform="thousandeyes",
        category="test_results",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "round_id": {
                        "type": "string",
                        "description": "Round Id"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["test_id", "agent_id", "round_id"],
        tags=["thousandeyes", "results", "path-vis", "detailed"],
        requires_write=False,
        handler=handle_results_get_detailed_path,
    ),
    create_tool(
        name="thousandeyes_results_get_bgp",
        description="""Get BGP test results.""",
        platform="thousandeyes",
        category="test_results",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
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
        tags=["thousandeyes", "results", "bgp"],
        requires_write=False,
        handler=handle_results_get_bgp,
    ),
    create_tool(
        name="thousandeyes_results_get_bgp_routes",
        description="""Get BGP route prefix information.""",
        platform="thousandeyes",
        category="test_results",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "prefix_id": {
                        "type": "string"
            },
            "round_id": {
                        "type": "string",
                        "description": "Round Id"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["test_id"],
        tags=["thousandeyes", "results", "bgp", "routes"],
        requires_write=False,
        handler=handle_results_get_bgp_routes,
    ),
    create_tool(
        name="thousandeyes_results_get_http_server",
        description="""Get HTTP server test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "http-server"],
        requires_write=False,
        handler=handle_results_get_http_server,
    ),
    create_tool(
        name="thousandeyes_results_get_page_load",
        description="""Get page load test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "page-load"],
        requires_write=False,
        handler=handle_results_get_page_load,
    ),
    create_tool(
        name="thousandeyes_results_get_page_load_component",
        description="""Get detailed component information for page load.""",
        platform="thousandeyes",
        category="test_results",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "round_id": {
                        "type": "string",
                        "description": "Round Id"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["test_id", "agent_id", "round_id"],
        tags=["thousandeyes", "results", "page-load", "component"],
        requires_write=False,
        handler=handle_results_get_page_load_component,
    ),
    create_tool(
        name="thousandeyes_results_get_web_transactions",
        description="""Get web transaction test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "web-transactions"],
        requires_write=False,
        handler=handle_results_get_web_transactions,
    ),
    create_tool(
        name="thousandeyes_results_get_web_transactions_component",
        description="""Get detailed component information for web transaction.""",
        platform="thousandeyes",
        category="test_results",
        properties={
            "test_id": {
                        "type": "string",
                        "description": "Test Id"
            },
            "agent_id": {
                        "type": "string",
                        "description": "Agent Id"
            },
            "round_id": {
                        "type": "string",
                        "description": "Round Id"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["test_id", "agent_id", "round_id"],
        tags=["thousandeyes", "results", "web-transactions", "component"],
        requires_write=False,
        handler=handle_results_get_web_transactions_component,
    ),
    create_tool(
        name="thousandeyes_results_get_api",
        description="""Get API test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "api"],
        requires_write=False,
        handler=handle_results_get_api,
    ),
    create_tool(
        name="thousandeyes_results_get_dns_server",
        description="""Get DNS server test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "dns-server"],
        requires_write=False,
        handler=handle_results_get_dns_server,
    ),
    create_tool(
        name="thousandeyes_results_get_dns_trace",
        description="""Get DNS trace test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "dns-trace"],
        requires_write=False,
        handler=handle_results_get_dns_trace,
    ),
    create_tool(
        name="thousandeyes_results_get_dnssec",
        description="""Get DNSSEC validation test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "dnssec"],
        requires_write=False,
        handler=handle_results_get_dnssec,
    ),
    create_tool(
        name="thousandeyes_results_get_sip_server",
        description="""Get SIP server test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "sip-server"],
        requires_write=False,
        handler=handle_results_get_sip_server,
    ),
    create_tool(
        name="thousandeyes_results_get_voice",
        description="""Get voice (RTP) test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "voice", "rtp"],
        requires_write=False,
        handler=handle_results_get_voice,
    ),
    create_tool(
        name="thousandeyes_results_get_voice_metrics",
        description="""Get detailed voice quality metrics (MOS, jitter, packet loss).""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "voice", "metrics", "mos"],
        requires_write=False,
        handler=handle_results_get_voice_metrics,
    ),
    create_tool(
        name="thousandeyes_results_get_ftp_server",
        description="""Get FTP server test results.""",
        platform="thousandeyes",
        category="test_results",
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
        tags=["thousandeyes", "results", "ftp-server"],
        requires_write=False,
        handler=handle_results_get_ftp_server,
    ),
    create_tool(
        name="thousandeyes_results_get_network_by_agent",
        description="""Get network results for a specific agent.""",
        platform="thousandeyes",
        category="test_results",
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
        required=["test_id", "agent_id"],
        tags=["thousandeyes", "results", "network", "agent"],
        requires_write=False,
        handler=handle_results_get_network_by_agent,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_test_results_tools():
    """Register all test_results tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_TEST_RESULTS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_TEST_RESULTS_TOOLS)} thousandeyes test_results tools")


# Auto-register on import
register_test_results_tools()
