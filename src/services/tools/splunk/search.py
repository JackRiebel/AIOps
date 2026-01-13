"""
Splunk Search Tools

Auto-generated from archived A2A skills.
Total tools: 4
"""

import logging
import os
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
# Splunk client imported in handler


logger = logging.getLogger(__name__)

def _get_backend_url() -> str:
    """Get the backend API URL from environment or settings."""
    # Check environment variable first
    backend_url = os.environ.get("BACKEND_URL") or os.environ.get("API_BASE_URL")
    if backend_url:
        return backend_url.rstrip("/")

    # Try to get from settings
    try:
        from src.config import get_settings
        settings = get_settings()
        port = getattr(settings, 'port', 8002)
        host = getattr(settings, 'host', 'localhost')
        # Use http for localhost, could be made configurable
        return f"http://{host}:{port}"
    except Exception:
        pass

    # Fallback to default
    return "http://localhost:8002"

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_search_run_splunk_query(params: Dict, context: Any) -> Dict:
    """Handler for Run Splunk Query.

    Uses the SplunkClient from context directly (same credentials as Splunk page).
    """
    try:
        # Get search parameters
        search_query = params.get("search_query", "search index=* | head 100")
        earliest_time = params.get("earliest_time", "-24h")
        latest_time = params.get("latest_time", "now")
        max_results = params.get("max_results", 100)

        # Use SplunkClient from context if available (preferred - uses same creds as Splunk page)
        if context and hasattr(context, 'client') and context.client:
            logger.info(f"[Splunk Tool] Using SplunkClient directly to run search: {search_query[:50]}...")
            try:
                results = await context.client.run_search(
                    query=search_query,
                    earliest_time=earliest_time,
                    latest_time=latest_time,
                    max_results=max_results,
                )
                logger.info(f"[Splunk Tool] Search returned {len(results)} results")
                return {"success": True, "data": results}
            except Exception as e:
                logger.error(f"[Splunk Tool] SplunkClient search failed: {e}")
                return {"success": False, "error": f"Splunk search failed: {str(e)}"}

        # Fallback: Use local API endpoint (requires organization)
        logger.info("[Splunk Tool] No SplunkClient in context, falling back to API endpoint")
        organization = params.get("organization") or getattr(context, "splunk_organization", None)

        if not organization:
            # Try to find a Splunk organization from credentials
            try:
                from src.api.dependencies import credential_manager
                clusters = await credential_manager.list_clusters()
                for cluster in clusters:
                    if 'splunk' in cluster.url.lower() or ':8089' in cluster.url:
                        organization = cluster.name
                        break
            except Exception as e:
                logger.warning(f"Could not auto-detect Splunk org: {e}")

        if not organization:
            return {"success": False, "error": "No Splunk organization found. Please configure Splunk credentials."}

        # Build request body matching the API format
        request_body = {
            "search": search_query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "max_results": max_results,
        }

        # Call LOCAL API endpoint (not context.base_url which is the Splunk server)
        import httpx
        async with httpx.AsyncClient(timeout=120.0, verify=False) as client:
            # Always use localhost for API calls - context.base_url is the Splunk server URL
            api_base_url = _get_backend_url()
            logger.info(f"[Splunk Tool] Calling API: {api_base_url}/api/splunk/search?organization={organization}")
            response = await client.post(
                f"{api_base_url}/api/splunk/search",
                params={"organization": organization},
                json=request_body,
            )

            if response.status_code == 200:
                data = response.json()
                return {"success": True, "data": data.get("results", []), "organization": organization}
            else:
                error_detail = response.json().get("detail", response.text) if response.headers.get("content-type", "").startswith("application/json") else response.text
                return {"success": False, "error": f"Splunk search failed: {error_detail}"}

    except Exception as e:
        logger.error(f"Splunk search error: {e}")
        return {"success": False, "error": str(e)}


async def handle_search_generate_spl(params: Dict, context: Any) -> Dict:
    """Handler for Generate SPL - uses AI to convert natural language to SPL."""
    try:
        # Get the Splunk organization from context or find one
        organization = params.get("organization") or getattr(context, "splunk_organization", None)

        if not organization:
            try:
                from src.api.dependencies import credential_manager
                clusters = await credential_manager.list_clusters()
                for cluster in clusters:
                    if 'splunk' in cluster.url.lower() or ':8089' in cluster.url:
                        organization = cluster.name
                        break
            except Exception as e:
                logger.warning(f"Could not auto-detect Splunk org: {e}")

        if not organization:
            return {"success": False, "error": "No Splunk organization found."}

        # Build request body
        request_body = {
            "prompt": params.get("natural_language_query", ""),
            "earliest_time": params.get("time_range", "-24h"),
        }

        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Always use localhost for API calls - context.base_url is the Splunk server URL
            api_base_url = _get_backend_url()
            response = await client.post(
                f"{api_base_url}/api/splunk/search/ai",
                params={"organization": organization},
                json=request_body,
            )

            if response.status_code == 200:
                data = response.json()
                return {"success": True, "data": data, "organization": organization}
            else:
                error_detail = response.json().get("detail", response.text) if response.headers.get("content-type", "").startswith("application/json") else response.text
                return {"success": False, "error": f"SPL generation failed: {error_detail}"}

    except Exception as e:
        logger.error(f"Generate SPL error: {e}")
        return {"success": False, "error": str(e)}


async def handle_search_explain_spl(params: Dict, context: Any) -> Dict:
    """Handler for Explain SPL."""
    try:
        # Build API path
        path = "/search/explain/spl"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_search_optimize_spl(params: Dict, context: Any) -> Dict:
    """Handler for Optimize SPL."""
    try:
        # Build API path
        path = "/search/optimize/spl"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

SPLUNK_SEARCH_TOOLS = [
    create_tool(
        name="splunk_search_run_splunk_query",
        description="""Execute a Splunk search query. Queries are auto-optimized to exclude noise and add aggregations.

Use specific sourcetypes when possible:
- Wireless/AP: sourcetype=meraki:accesspoints
- Switches: sourcetype=meraki:switches
- Security/MX: sourcetype=meraki:securityappliances
- Audit: sourcetype=meraki:organization_audit_logs

Queries without stats/aggregations will auto-add: | stats count by sourcetype, type | sort -count""",
        platform="splunk",
        category="search",
        properties={
            "search_query": {
                        "type": "string",
                        "description": "SPL search query (must include sourcetype filter)"
            },
            "earliest_time": {
                        "type": "string",
                        "description": "Start time for search (e.g., '-24h', '-7d')",
                        "default": "-24h"
            },
            "latest_time": {
                        "type": "string",
                        "description": "End time for search (e.g., 'now', '-1h')",
                        "default": "now"
            },
            "max_results": {
                        "type": "integer",
                        "description": "Maximum results (max 1000)",
                        "default": 100
            }
        },
        required=["search_query"],
        tags=["splunk", "search", "query", "spl", "logs", "events"],
        requires_write=False,
        handler=handle_search_run_splunk_query,
        examples=[
            {"query": "Association failures", "params": {
                "search_query": "sourcetype=meraki:accesspoints type IN (association, disassociation, deauth) | stats count by type, clientMac, ssid, reason | sort -count",
                "earliest_time": "-24h"
            }},
            {"query": "WPA auth failures", "params": {
                "search_query": "sourcetype=meraki:accesspoints (type=wpa_auth OR type=802.11_auth OR reason=*auth*) | stats count by clientMac, reason | sort -count",
                "earliest_time": "-24h"
            }},
            {"query": "Switch port events", "params": {
                "search_query": "sourcetype=meraki:switches type IN (port_status, stp_port_role_change, mac_flap_detected) | stats count by type, deviceSerial | sort -count",
                "earliest_time": "-24h"
            }},
            {"query": "Security events", "params": {
                "search_query": "sourcetype=meraki:securityappliances category IN (ids_alerted, air_marshal, security_event) | stats count by type",
                "earliest_time": "-24h"
            }},
            {"query": "Logs for specific device", "params": {
                "search_query": "deviceSerial=Q2KY-EVGL-CL3C NOT sourcetype=meraki:sensorreadingshistory | stats count by type, category | sort -count",
                "earliest_time": "-24h"
            }},
        ],
    ),
    create_tool(
        name="splunk_search_generate_spl",
        description="""Generate SPL (Search Processing Language) from natural language queries using Splunk AI Assistant. Converts plain English descriptions into valid SPL queries that can be executed against your Splunk environment.""",
        platform="splunk",
        category="search",
        properties={
            "natural_language_query": {
                        "type": "string",
                        "description": "Natural language description of what you want to search for"
            },
            "index": {
                        "type": "string",
                        "description": "Target index to search (optional)"
            },
            "time_range": {
                        "type": "string",
                        "description": "Time Range"
            }
},
        required=["natural_language_query"],
        tags=["splunk", "search", "spl", "generate", "ai", "natural-language"],
        requires_write=False,
        handler=handle_search_generate_spl,
    ),
    create_tool(
        name="splunk_search_explain_spl",
        description="""Explain SPL queries in natural language using Splunk AI Assistant. Converts complex SPL commands into human-readable explanations, helping users understand what a query does step by step.""",
        platform="splunk",
        category="search",
        properties={
            "spl_query": {
                        "type": "string",
                        "description": "SPL query to explain"
            }
},
        required=["spl_query"],
        tags=["splunk", "search", "spl", "explain", "ai", "documentation"],
        requires_write=False,
        handler=handle_search_explain_spl,
    ),
    create_tool(
        name="splunk_search_optimize_spl",
        description="""Optimize SPL (Search Processing Language) queries using Splunk AI Assistant. Improves query performance, efficiency, and follows best practices. Returns an optimized version of the query with explanations of improvements.""",
        platform="splunk",
        category="search",
        properties={
            "spl_query": {
                        "type": "string",
                        "description": "SPL query to optimize"
            }
},
        required=["spl_query"],
        tags=["splunk", "search", "spl", "optimize", "performance", "ai"],
        requires_write=False,
        handler=handle_search_optimize_spl,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_search_tools():
    """Register all search tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_SEARCH_TOOLS)
    logger.info(f"Registered {len(SPLUNK_SEARCH_TOOLS)} splunk search tools")


# Auto-register on import
register_search_tools()
