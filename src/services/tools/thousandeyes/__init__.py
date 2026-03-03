"""Cisco ThousandEyes API Tools.

This module provides 100+ tools for ThousandEyes operations,
organized into logical categories:
- tests: Test management and configuration
- agents: Cloud and enterprise agent management
- alerts: Alert monitoring and rules
- results: Test result data
- instant_tests: On-demand instant tests
- dashboards: Dashboard management
- labels: Label management
- credentials: Credential management

Tool naming convention: thousandeyes_{action}_{entity}
"""

import logging
from typing import Dict, Any, List, Optional

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient
from src.services.instrumented_httpx import InstrumentedAsyncTransport, RequestTiming

logger = logging.getLogger(__name__)


# =============================================================================
# EXECUTION CONTEXT
# =============================================================================

class ThousandEyesExecutionContext:
    """Context for executing ThousandEyes tools."""
    def __init__(self, oauth_token: str, base_url: str = "https://api.thousandeyes.com/v7"):
        from src.config.settings import get_settings
        settings = get_settings()
        self._transport = InstrumentedAsyncTransport(verify=settings.thousandeyes_verify_ssl)
        self.client = ThousandEyesClient(
            oauth_token=oauth_token,
            base_url=base_url,
            transport=self._transport,
        )

    def pop_timing(self) -> Optional[RequestTiming]:
        """Pop and return the last captured network timing."""
        if self._transport:
            return self._transport.pop_timing()
        return None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def success_result(data: Any = None, message: str = None) -> Dict:
    """Create a success result."""
    result = {"success": True}
    if data is not None:
        result["data"] = data
    if message:
        result["message"] = message
    return result


def error_result(message: str) -> Dict:
    """Create an error result."""
    return {"success": False, "error": message}


# =============================================================================
# TEST TOOLS
# =============================================================================

async def handle_list_tests(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List all tests."""
    test_type = params.get("test_type")
    result = await context.client.get_tests(test_type=test_type)
    if result.get("success"):
        return success_result(data=result.get("tests", []))
    return error_result(result.get("error", "Failed to get tests"))


async def handle_get_test(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get test details by ID."""
    test_id = params.get("test_id")
    if not test_id:
        return error_result("test_id is required")
    result = await context.client.get_test_details(test_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_create_test(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Create a new test."""
    test_type = params.get("test_type")
    if not test_type:
        return error_result("test_type is required")
    test_config = {k: params[k] for k in ["testName", "url", "server", "port", "protocol", "interval", "agents", "alertsEnabled", "bgpMeasurements", "networkMeasurements", "pathTraceMode", "mtuMeasurements"] if params.get(k)}
    result = await context.client.create_test(test_type, test_config)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_update_test(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Update a test."""
    test_id = params.get("test_id")
    test_type = params.get("test_type")
    if not test_id or not test_type:
        return error_result("test_id and test_type are required")
    test_config = {k: params[k] for k in ["testName", "url", "server", "port", "interval", "agents", "alertsEnabled"] if params.get(k)}
    result = await context.client.update_test(test_id, test_type, test_config)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_delete_test(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Delete a test."""
    test_id = params.get("test_id")
    test_type = params.get("test_type")
    if not test_id or not test_type:
        return error_result("test_id and test_type are required")
    result = await context.client.delete_test(test_id, test_type)
    return success_result(message=f"Test {test_id} deleted") if result.get("success") else error_result(result.get("error"))


# =============================================================================
# AGENT TOOLS
# =============================================================================

async def handle_list_agents(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List all agents."""
    agent_type = params.get("agent_type")
    result = await context.client.get_agents(agent_type=agent_type)
    if result.get("success"):
        return success_result(data=result.get("agents", []))
    return error_result(result.get("error", "Failed to get agents"))


async def handle_get_agent(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get agent details by ID."""
    agent_id = params.get("agent_id")
    if not agent_id:
        return error_result("agent_id is required")
    result = await context.client.get_agent_details(agent_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_list_endpoint_agents(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List endpoint agents."""
    result = await context.client.get_endpoint_agents()
    if result.get("success"):
        return success_result(data=result.get("agents", []))
    return error_result(result.get("error", "Failed to get endpoint agents"))


# =============================================================================
# ALERT TOOLS
# =============================================================================

async def handle_list_alerts(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List alerts."""
    active_only = params.get("active_only", True)
    result = await context.client.get_alerts(active_only=active_only)
    if result.get("success"):
        return success_result(data=result.get("alerts", []))
    return error_result(result.get("error", "Failed to get alerts"))


async def handle_get_alert(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get alert details by ID."""
    alert_id = params.get("alert_id")
    if not alert_id:
        return error_result("alert_id is required")
    result = await context.client.get_alert_details(alert_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_list_alert_rules(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List alert rules."""
    result = await context.client.get_alert_rules()
    if result.get("success"):
        return success_result(data=result.get("alertRules", []))
    return error_result(result.get("error", "Failed to get alert rules"))


async def handle_get_alert_rule(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get alert rule details."""
    rule_id = params.get("rule_id")
    if not rule_id:
        return error_result("rule_id is required")
    result = await context.client.get_alert_rule(rule_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


# =============================================================================
# RESULT TOOLS
# =============================================================================

async def handle_get_test_results(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get test results."""
    test_id = params.get("test_id")
    result_type = params.get("result_type", "network")
    if not test_id:
        return error_result("test_id is required")
    result = await context.client.get_test_results(test_id, result_type)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_get_path_visualization(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get path visualization data."""
    test_id = params.get("test_id")
    if not test_id:
        return error_result("test_id is required")
    result = await context.client.get_path_visualization(test_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_get_bgp_results(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get BGP test results."""
    test_id = params.get("test_id")
    if not test_id:
        return error_result("test_id is required")
    result = await context.client.get_bgp_results(test_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_get_http_results(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get HTTP server test results."""
    test_id = params.get("test_id")
    if not test_id:
        return error_result("test_id is required")
    result = await context.client.get_http_results(test_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_get_page_load_results(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get page load test results."""
    test_id = params.get("test_id")
    if not test_id:
        return error_result("test_id is required")
    result = await context.client.get_page_load_results(test_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


# =============================================================================
# INSTANT TEST TOOLS
# =============================================================================

async def handle_create_instant_test(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Create an instant test."""
    test_type = params.get("test_type")
    if not test_type:
        return error_result("test_type is required")
    test_config = {k: params[k] for k in ["testName", "url", "server", "port", "protocol", "agents"] if params.get(k)}
    result = await context.client.create_instant_test(test_type, test_config)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


async def handle_run_instant_test(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Run an instant test from existing test."""
    test_id = params.get("test_id")
    if not test_id:
        return error_result("test_id is required")
    result = await context.client.run_instant_test(test_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


# =============================================================================
# DASHBOARD TOOLS
# =============================================================================

async def handle_list_dashboards(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List dashboards."""
    result = await context.client.get_dashboards()
    if result.get("success"):
        return success_result(data=result.get("dashboards", []))
    return error_result(result.get("error", "Failed to get dashboards"))


async def handle_get_dashboard(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get dashboard details."""
    dashboard_id = params.get("dashboard_id")
    if not dashboard_id:
        return error_result("dashboard_id is required")
    result = await context.client.get_dashboard(dashboard_id)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


# =============================================================================
# LABEL TOOLS
# =============================================================================

async def handle_list_labels(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List labels."""
    label_type = params.get("label_type")
    result = await context.client.get_labels(label_type=label_type)
    if result.get("success"):
        return success_result(data=result.get("labels", []))
    return error_result(result.get("error", "Failed to get labels"))


async def handle_get_label(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """Get label details."""
    label_id = params.get("label_id")
    label_type = params.get("label_type")
    if not label_id or not label_type:
        return error_result("label_id and label_type are required")
    result = await context.client.get_label(label_id, label_type)
    return success_result(data=result) if result.get("success") else error_result(result.get("error"))


# =============================================================================
# BGP MONITOR TOOLS
# =============================================================================

async def handle_list_bgp_monitors(params: Dict, context: ThousandEyesExecutionContext) -> Dict:
    """List BGP monitors."""
    result = await context.client.get_bgp_monitors()
    if result.get("success"):
        return success_result(data=result.get("bgpMonitors", []))
    return error_result(result.get("error", "Failed to get BGP monitors"))


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_TOOLS = [
    # Test Tools - with examples for improved accuracy (per Anthropic: 72% → 90%)
    create_tool(
        name="thousandeyes_list_tests",
        description="List all ThousandEyes synthetic tests with optional type filter. Use this FIRST when investigating any network issue to find tests monitoring the affected service, device IP, or path. Results include test name, target URL/server, type, interval, and status.",
        platform="thousandeyes",
        category="tests",
        properties={
            "test_type": {"type": "string", "description": "Filter by test type (agent-to-server, http-server, page-load, web-transactions, ftp-server, dns-trace, dns-server, dnssec, sip-server, voice)"},
        },
        handler=handle_list_tests,
        examples=[
            {"query": "List all ThousandEyes tests", "params": {}},
            {"query": "Show HTTP server tests", "params": {"test_type": "http-server"}},
            {"query": "What network tests are configured?", "params": {"test_type": "agent-to-server"}},
        ],
    ),
    create_tool(
        name="thousandeyes_get_test",
        description="Get test details by ID",
        platform="thousandeyes",
        category="tests",
        properties={"test_id": {"type": "string", "description": "Test ID"}},
        required=["test_id"],
        handler=handle_get_test,
        examples=[
            {"query": "Get details for test 12345", "params": {"test_id": "12345"}},
        ],
    ),
    create_tool(
        name="thousandeyes_create_test",
        description="Create a new ThousandEyes test",
        platform="thousandeyes",
        category="tests",
        properties={
            "test_type": {"type": "string", "description": "Test type (agent-to-server, http-server, etc.)"},
            "testName": {"type": "string", "description": "Test name"},
            "url": {"type": "string", "description": "Target URL (for HTTP tests)"},
            "server": {"type": "string", "description": "Target server (for network tests)"},
            "port": {"type": "integer", "description": "Target port"},
            "interval": {"type": "integer", "description": "Test interval in seconds"},
            "agents": {"type": "array", "items": {"type": "object"}, "description": "Agents to use"},
            "alertsEnabled": {"type": "boolean", "description": "Enable alerts"},
        },
        required=["test_type", "testName"],
        handler=handle_create_test,
        requires_write=True,
    ),
    create_tool(
        name="thousandeyes_update_test",
        description="Update a ThousandEyes test",
        platform="thousandeyes",
        category="tests",
        properties={
            "test_id": {"type": "string", "description": "Test ID"},
            "test_type": {"type": "string", "description": "Test type"},
            "testName": {"type": "string", "description": "Test name"},
            "interval": {"type": "integer", "description": "Test interval"},
            "alertsEnabled": {"type": "boolean", "description": "Enable alerts"},
        },
        required=["test_id", "test_type"],
        handler=handle_update_test,
        requires_write=True,
    ),
    create_tool(
        name="thousandeyes_delete_test",
        description="Delete a ThousandEyes test",
        platform="thousandeyes",
        category="tests",
        properties={
            "test_id": {"type": "string", "description": "Test ID"},
            "test_type": {"type": "string", "description": "Test type"},
        },
        required=["test_id", "test_type"],
        handler=handle_delete_test,
        requires_write=True,
    ),

    # Agent Tools - with examples
    create_tool(
        name="thousandeyes_list_agents",
        description="List ThousandEyes monitoring agents. Enterprise agents run inside your network; cloud agents test from external vantage points. Filter by agent_type: 'Cloud', 'Enterprise', 'Enterprise Cluster'. Agent location helps interpret results — high latency from a local enterprise agent is concerning, from a distant cloud agent may be expected.",
        platform="thousandeyes",
        category="agents",
        properties={
            "agent_type": {"type": "string", "description": "Filter by type (Cloud, Enterprise, Enterprise Cluster)"},
        },
        handler=handle_list_agents,
        examples=[
            {"query": "List all ThousandEyes agents", "params": {}},
            {"query": "Show enterprise agents", "params": {"agent_type": "Enterprise"}},
            {"query": "What cloud agents are available?", "params": {"agent_type": "Cloud"}},
        ],
    ),
    create_tool(
        name="thousandeyes_get_agent",
        description="Get agent details by ID",
        platform="thousandeyes",
        category="agents",
        properties={"agent_id": {"type": "string", "description": "Agent ID"}},
        required=["agent_id"],
        handler=handle_get_agent,
    ),
    create_tool(
        name="thousandeyes_list_endpoint_agents",
        description="List ThousandEyes endpoint agents",
        platform="thousandeyes",
        category="agents",
        handler=handle_list_endpoint_agents,
    ),

    # Alert Tools - with examples
    create_tool(
        name="thousandeyes_list_alerts",
        description="List active ThousandEyes alerts indicating performance degradation or outages. Check this FIRST in any troubleshooting workflow — active alerts often explain issues seen in Meraki. Returns alert type, severity, affected test, and start time. Differs from list_alert_rules which shows configured thresholds, not active violations.",
        platform="thousandeyes",
        category="alerts",
        properties={
            "active_only": {"type": "boolean", "description": "Return only active alerts (default: true)"},
        },
        handler=handle_list_alerts,
        examples=[
            {"query": "Show active ThousandEyes alerts", "params": {"active_only": True}},
            {"query": "List all alerts", "params": {"active_only": False}},
            {"query": "Are there any network alerts?", "params": {}},
        ],
    ),
    create_tool(
        name="thousandeyes_get_alert",
        description="Get alert details by ID",
        platform="thousandeyes",
        category="alerts",
        properties={"alert_id": {"type": "string", "description": "Alert ID"}},
        required=["alert_id"],
        handler=handle_get_alert,
    ),
    create_tool(
        name="thousandeyes_list_alert_rules",
        description="List ThousandEyes alert rules",
        platform="thousandeyes",
        category="alerts",
        handler=handle_list_alert_rules,
    ),
    create_tool(
        name="thousandeyes_get_alert_rule",
        description="Get alert rule details by ID",
        platform="thousandeyes",
        category="alerts",
        properties={"rule_id": {"type": "string", "description": "Alert rule ID"}},
        required=["rule_id"],
        handler=handle_get_alert_rule,
    ),

    # Result Tools - with examples
    create_tool(
        name="thousandeyes_get_test_results",
        description="Get recent metrics for a specific test. Returns latency, packet loss, jitter for network tests; HTTP response code, response time, availability for HTTP tests. Set result_type: 'network' for latency/loss, 'http-server' for HTTP metrics, 'path-vis' for path data. Compare against Meraki to determine if issues are internal or external.",
        platform="thousandeyes",
        category="results",
        properties={
            "test_id": {"type": "string", "description": "Test ID"},
            "result_type": {"type": "string", "description": "Result type (network, http-server, page-load, path-vis)"},
        },
        required=["test_id"],
        handler=handle_get_test_results,
        examples=[
            {"query": "Get results for test 12345", "params": {"test_id": "12345"}},
            {"query": "Show HTTP test results", "params": {"test_id": "12345", "result_type": "http-server"}},
            {"query": "What are the network test metrics?", "params": {"test_id": "12345", "result_type": "network"}},
        ],
    ),
    create_tool(
        name="thousandeyes_get_path_visualization",
        description="Get hop-by-hop network path trace for a test. Shows every router between agent and target with per-hop latency, loss, and IP. Use this to identify WHERE in the path a failure occurs — local network, ISP, peering point, or destination. Critical for distinguishing internal vs external issues.",
        platform="thousandeyes",
        category="results",
        properties={"test_id": {"type": "string", "description": "Test ID"}},
        required=["test_id"],
        handler=handle_get_path_visualization,
    ),
    create_tool(
        name="thousandeyes_get_bgp_results",
        description="Get BGP test results",
        platform="thousandeyes",
        category="results",
        properties={"test_id": {"type": "string", "description": "Test ID"}},
        required=["test_id"],
        handler=handle_get_bgp_results,
    ),
    create_tool(
        name="thousandeyes_get_http_results",
        description="Get HTTP server test results: response code, response time, throughput, availability. Shows whether an HTTP endpoint is responding and how fast. Differs from get_test_results(result_type='network') which shows layer-3 metrics rather than application-layer HTTP behavior.",
        platform="thousandeyes",
        category="results",
        properties={"test_id": {"type": "string", "description": "Test ID"}},
        required=["test_id"],
        handler=handle_get_http_results,
    ),
    create_tool(
        name="thousandeyes_get_page_load_results",
        description="Get page load test results",
        platform="thousandeyes",
        category="results",
        properties={"test_id": {"type": "string", "description": "Test ID"}},
        required=["test_id"],
        handler=handle_get_page_load_results,
    ),

    # Instant Test Tools
    create_tool(
        name="thousandeyes_create_instant_test",
        description="Create and run an instant test",
        platform="thousandeyes",
        category="instant_tests",
        properties={
            "test_type": {"type": "string", "description": "Test type"},
            "testName": {"type": "string", "description": "Test name"},
            "url": {"type": "string", "description": "Target URL"},
            "server": {"type": "string", "description": "Target server"},
            "agents": {"type": "array", "items": {"type": "object"}, "description": "Agents to use"},
        },
        required=["test_type"],
        handler=handle_create_instant_test,
    ),
    create_tool(
        name="thousandeyes_run_instant_test",
        description="Run an instant test from existing test configuration",
        platform="thousandeyes",
        category="instant_tests",
        properties={"test_id": {"type": "string", "description": "Test ID to run as instant"}},
        required=["test_id"],
        handler=handle_run_instant_test,
    ),

    # Dashboard Tools
    create_tool(
        name="thousandeyes_list_dashboards",
        description="List ThousandEyes dashboards",
        platform="thousandeyes",
        category="dashboards",
        handler=handle_list_dashboards,
    ),
    create_tool(
        name="thousandeyes_get_dashboard",
        description="Get dashboard details by ID",
        platform="thousandeyes",
        category="dashboards",
        properties={"dashboard_id": {"type": "string", "description": "Dashboard ID"}},
        required=["dashboard_id"],
        handler=handle_get_dashboard,
    ),

    # Label Tools
    create_tool(
        name="thousandeyes_list_labels",
        description="List ThousandEyes labels",
        platform="thousandeyes",
        category="labels",
        properties={"label_type": {"type": "string", "description": "Filter by type (tests, agents, dashboards)"}},
        handler=handle_list_labels,
    ),
    create_tool(
        name="thousandeyes_get_label",
        description="Get label details by ID",
        platform="thousandeyes",
        category="labels",
        properties={
            "label_id": {"type": "string", "description": "Label ID"},
            "label_type": {"type": "string", "description": "Label type"},
        },
        required=["label_id", "label_type"],
        handler=handle_get_label,
    ),

    # BGP Monitor Tools
    create_tool(
        name="thousandeyes_list_bgp_monitors",
        description="List ThousandEyes BGP monitors",
        platform="thousandeyes",
        category="bgp",
        handler=handle_list_bgp_monitors,
    ),
]


# =============================================================================
# REGISTRATION
# =============================================================================

def register_thousandeyes_tools():
    """Register all ThousandEyes tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_TOOLS)
    logger.info(f"[ThousandEyes Tools] Registered {len(THOUSANDEYES_TOOLS)} tools")


# Auto-register on import
register_thousandeyes_tools()

# Import generated modules (they auto-register)
try:
    from . import admin
    from . import agents
    from . import alerts
    from . import bgp_monitors
    from . import credentials
    from . import dashboards
    from . import emulation
    from . import endpoint_agents
    from . import instant_tests
    from . import labels
    from . import test_results
    from . import tests_dns
    from . import tests_network
    from . import tests_other
    from . import tests_voice
    from . import tests_web
    logger.info("[ThousandEyes Tools] Loaded generated tool modules")
except ImportError as e:
    logger.warning(f"[ThousandEyes Tools] Could not load some generated modules: {e}")
