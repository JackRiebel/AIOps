"""
Catalyst Clients Tools

Auto-generated from archived A2A skills.
Total tools: 10
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_clients_get_detail(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Details."""
    try:
        # Build API path
        path = "/clients/get/detail"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_by_mac(params: Dict, context: Any) -> Dict:
    """Handler for Get Client by MAC Address."""
    try:
        # Build API path
        path = "/clients/get/by/mac"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_health(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Health."""
    try:
        # Build API path
        path = "/clients/get/health"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Count."""
    try:
        # Build API path
        path = "/clients/get/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_proximity(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Proximity."""
    try:
        # Build API path
        path = "/clients/get/proximity"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_enrichment(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Enrichment Details."""
    try:
        # Build API path
        path = "/clients/get/enrichment"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_query(params: Dict, context: Any) -> Dict:
    """Handler for Query Clients."""
    try:
        # Build API path
        path = "/clients/query"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_trend(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Health Trend."""
    try:
        # Build API path
        path = "/clients/get/trend"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_summary(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Summary."""
    try:
        # Build API path
        path = "/clients/get/summary"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_clients_get_top_n(params: Dict, context: Any) -> Dict:
    """Handler for Get Top N Clients."""
    try:
        # Build API path
        path = "/clients/get/top/n"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_CLIENTS_TOOLS = [
    create_tool(
        name="catalyst_clients_get_detail",
        description="""Get detailed information about network clients including connection status, device details, VLAN, SSID, and health scores.""",
        platform="catalyst",
        category="clients",
        properties={
            "mac_address": {
                        "description": "Client MAC address"
            },
            "timestamp": {
                        "description": "Point in time for client details"
            }
},
        required=[],
        tags=["catalyst", "clients", "details", "endpoints"],
        requires_write=False,
        handler=handle_clients_get_detail,
    ),
    create_tool(
        name="catalyst_clients_get_by_mac",
        description="""Get specific client details using its MAC address. Returns comprehensive client information including connection state and associated network devices.""",
        platform="catalyst",
        category="clients",
        properties={
            "mac_address": {
                        "description": "Client MAC address to look up"
            }
},
        required=["mac_address"],
        tags=["catalyst", "clients", "mac", "lookup"],
        requires_write=False,
        handler=handle_clients_get_by_mac,
    ),
    create_tool(
        name="catalyst_clients_get_health",
        description="""Get health metrics for network clients including connectivity scores, onboarding success rates, and health distribution.""",
        platform="catalyst",
        category="clients",
        properties={
            "timestamp": {
                        "description": "Point in time for health data"
            }
},
        required=[],
        tags=["catalyst", "clients", "health", "assurance"],
        requires_write=False,
        handler=handle_clients_get_health,
    ),
    create_tool(
        name="catalyst_clients_get_count",
        description="""Get the count of network clients, optionally filtered by health status.""",
        platform="catalyst",
        category="clients",
        properties={
            "timestamp": {
                        "description": "Point in time for count"
            }
},
        required=[],
        tags=["catalyst", "clients", "count", "statistics"],
        requires_write=False,
        handler=handle_clients_get_count,
    ),
    create_tool(
        name="catalyst_clients_get_proximity",
        description="""Get client proximity information showing location and nearby access points. Useful for location tracking and wireless optimization.""",
        platform="catalyst",
        category="clients",
        properties={
            "username": {
                        "type": "string",
                        "description": "Client username to track"
            },
            "number_days": {
                        "type": "integer",
                        "description": "Number of days to look back",
                        "default": 1
            },
            "time_resolution": {
                        "type": "integer",
                        "description": "Time resolution in minutes",
                        "default": 5
            }
},
        required=["username"],
        tags=["catalyst", "clients", "proximity", "location", "wireless"],
        requires_write=False,
        handler=handle_clients_get_proximity,
    ),
    create_tool(
        name="catalyst_clients_get_enrichment",
        description="""Get enriched client details including connected device information, issues, and contextual data for troubleshooting.""",
        platform="catalyst",
        category="clients",
        properties={
            "mac_address": {
                        "description": "Client MAC address for enrichment"
            }
},
        required=["mac_address"],
        tags=["catalyst", "clients", "enrichment", "context", "troubleshooting"],
        requires_write=False,
        handler=handle_clients_get_enrichment,
    ),
    create_tool(
        name="catalyst_clients_query",
        description="""Advanced client query with filtering by various criteria including site, SSID, health score, and connection type.""",
        platform="catalyst",
        category="clients",
        properties={
            "site_id": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of site IDs to filter"
            },
            "ssid": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of SSIDs to filter"
            },
            "band": {
                        "type": "string",
                        "description": "Wireless band filter",
                        "enum": [
                                    "2.4",
                                    "5",
                                    "6"
                        ]
            },
            "health_score": {
                        "type": "integer"
            },
            "connection_type": {
                        "type": "string",
                        "description": "Connection type filter",
                        "enum": [
                                    "WIRED",
                                    "WIRELESS"
                        ]
            },
            "start_time": {
                        "description": "Start time for query window"
            },
            "end_time": {
                        "description": "End time for query window"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            }
},
        required=[],
        tags=["catalyst", "clients", "query", "search", "filter"],
        requires_write=False,
        handler=handle_clients_query,
    ),
    create_tool(
        name="catalyst_clients_get_trend",
        description="""Get client health trends over time showing connectivity patterns and health score changes.""",
        platform="catalyst",
        category="clients",
        properties={
            "site_id": {
                        "description": "Site ID to get trends for"
            },
            "start_time": {
                        "description": "Start time for trend"
            },
            "end_time": {
                        "description": "End time for trend"
            },
            "trend_interval": {
                        "type": "string",
                        "description": "Aggregation interval",
                        "enum": [
                                    "5m",
                                    "15m",
                                    "30m",
                                    "1h",
                                    "1d"
                        ]
            }
},
        required=[],
        tags=["catalyst", "clients", "trend", "health", "analytics"],
        requires_write=False,
        handler=handle_clients_get_trend,
    ),
    create_tool(
        name="catalyst_clients_get_summary",
        description="""Get a summary of clients grouped by various dimensions like site, device, SSID, or health status.""",
        platform="catalyst",
        category="clients",
        properties={
            "site_id": {
                        "description": "Site ID to summarize"
            },
            "group_by": {
                        "type": "string",
                        "description": "Dimension to group by",
                        "enum": [
                                    "site",
                                    "ssid",
                                    "band",
                                    "healthScore"
                        ]
            },
            "start_time": {
                        "description": "Start time for summary"
            },
            "end_time": {
                        "description": "End time for summary"
            }
},
        required=[],
        tags=["catalyst", "clients", "summary", "statistics", "dashboard"],
        requires_write=False,
        handler=handle_clients_get_summary,
    ),
    create_tool(
        name="catalyst_clients_get_top_n",
        description="""Get top clients by various metrics like health score, traffic, or issue count.""",
        platform="catalyst",
        category="clients",
        properties={
            "site_id": {
                        "description": "Site ID to query"
            },
            "top_n": {
                        "type": "integer",
                        "description": "Number of top clients to return",
                        "default": 10
            },
            "sort_by": {
                        "type": "string",
                        "description": "Metric to sort by",
                        "enum": [
                                    "healthScore",
                                    "traffic",
                                    "issueCount"
                        ]
            },
            "order": {
                        "type": "string",
                        "description": "Sort order",
                        "enum": [
                                    "asc",
                                    "desc"
                        ],
                        "default": "desc"
            },
            "start_time": {
                        "description": "Start time for query"
            },
            "end_time": {
                        "description": "End time for query"
            }
},
        required=[],
        tags=["catalyst", "clients", "top", "ranking", "analytics"],
        requires_write=False,
        handler=handle_clients_get_top_n,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_clients_tools():
    """Register all clients tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_CLIENTS_TOOLS)
    logger.info(f"Registered {len(CATALYST_CLIENTS_TOOLS)} catalyst clients tools")


# Auto-register on import
register_clients_tools()
