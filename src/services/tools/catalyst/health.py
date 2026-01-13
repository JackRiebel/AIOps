"""
Catalyst Health Tools

Auto-generated from archived A2A skills.
Total tools: 15
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_health_get_site_health(params: Dict, context: Any) -> Dict:
    """Handler for Get Site Health."""
    try:
        # Build API path
        path = "/health/get/site/health"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_query_site(params: Dict, context: Any) -> Dict:
    """Handler for Query Site Health."""
    try:
        # Build API path
        path = "/health/query/site"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_network(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Health."""
    try:
        # Build API path
        path = "/health/get/network"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_device(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Health."""
    try:
        # Build API path
        path = "/health/get/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_query_device(params: Dict, context: Any) -> Dict:
    """Handler for Query Device Health."""
    try:
        # Build API path
        path = "/health/query/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_client(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Health."""
    try:
        # Build API path
        path = "/health/get/client"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_query_client(params: Dict, context: Any) -> Dict:
    """Handler for Query Client Health."""
    try:
        # Build API path
        path = "/health/query/client"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_trend(params: Dict, context: Any) -> Dict:
    """Handler for Get Health Trend."""
    try:
        # Build API path
        path = "/health/get/trend"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_summary(params: Dict, context: Any) -> Dict:
    """Handler for Get Health Summary."""
    try:
        # Build API path
        path = "/health/get/summary"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_top_n(params: Dict, context: Any) -> Dict:
    """Handler for Get Top N by Health."""
    try:
        # Build API path
        path = "/health/get/top/n"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_score_definitions(params: Dict, context: Any) -> Dict:
    """Handler for Get Health Score Definitions."""
    try:
        # Build API path
        path = "/health/get/score/definitions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_update_score_definitions(params: Dict, context: Any) -> Dict:
    """Handler for Update Health Score Definitions."""
    try:
        # Build API path
        path = "/health/update/score/definitions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_assurance_alerts(params: Dict, context: Any) -> Dict:
    """Handler for Get Assurance Alerts."""
    try:
        # Build API path
        path = "/health/get/assurance/alerts"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_query_assurance_events(params: Dict, context: Any) -> Dict:
    """Handler for Query Assurance Events."""
    try:
        # Build API path
        path = "/health/query/assurance/events"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_health_get_kpi_detail(params: Dict, context: Any) -> Dict:
    """Handler for Get KPI Details."""
    try:
        # Build API path
        path = "/health/get/kpi/detail"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_HEALTH_TOOLS = [
    create_tool(
        name="catalyst_health_get_site_health",
        description="""Get health metrics for sites including network health scores and device status.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp"
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
        tags=["catalyst", "health", "sites", "assurance"],
        requires_write=False,
        handler=handle_health_get_site_health,
    ),
    create_tool(
        name="catalyst_health_query_site",
        description="""Advanced site health query with filtering and aggregation options.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "view": {
                        "type": "string",
                        "enum": [
                                    "summary",
                                    "detail"
                        ]
            },
            "start_time": {
                        "type": "string",
                        "description": "Start Time"
            },
            "end_time": {
                        "type": "string",
                        "description": "End Time"
            }
},
        required=[],
        tags=["catalyst", "health", "sites", "query"],
        requires_write=False,
        handler=handle_health_query_site,
    ),
    create_tool(
        name="catalyst_health_get_network",
        description="""Get overall network health including device and client health distribution.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp"
            }
},
        required=[],
        tags=["catalyst", "health", "network", "overview"],
        requires_write=False,
        handler=handle_health_get_network,
    ),
    create_tool(
        name="catalyst_health_get_device",
        description="""Get device health metrics including CPU, memory, and reachability.""",
        platform="catalyst",
        category="health",
        properties={
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp"
            }
},
        required=[],
        tags=["catalyst", "health", "devices", "metrics"],
        requires_write=False,
        handler=handle_health_get_device,
    ),
    create_tool(
        name="catalyst_health_query_device",
        description="""Advanced device health query with filtering options.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "device_role": {
                        "type": "string",
                        "enum": [
                                    "ACCESS",
                                    "DISTRIBUTION",
                                    "CORE"
                        ]
            },
            "health_score_range": {
                        "type": "integer"
            },
            "start_time": {
                        "type": "string",
                        "description": "Start Time"
            },
            "end_time": {
                        "type": "string",
                        "description": "End Time"
            }
},
        required=[],
        tags=["catalyst", "health", "devices", "query"],
        requires_write=False,
        handler=handle_health_query_device,
    ),
    create_tool(
        name="catalyst_health_get_client",
        description="""Get client health metrics including connectivity and onboarding success.""",
        platform="catalyst",
        category="health",
        properties={
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp"
            }
},
        required=[],
        tags=["catalyst", "health", "clients", "wireless"],
        requires_write=False,
        handler=handle_health_get_client,
    ),
    create_tool(
        name="catalyst_health_query_client",
        description="""Advanced client health query with filtering by connection type, SSID, etc.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "ssid": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "band": {
                        "type": "string",
                        "enum": [
                                    "2.4",
                                    "5",
                                    "6"
                        ]
            },
            "connection_type": {
                        "type": "string",
                        "enum": [
                                    "WIRED",
                                    "WIRELESS"
                        ]
            },
            "start_time": {
                        "type": "string",
                        "description": "Start Time"
            },
            "end_time": {
                        "type": "string",
                        "description": "End Time"
            }
},
        required=[],
        tags=["catalyst", "health", "clients", "query"],
        requires_write=False,
        handler=handle_health_query_client,
    ),
    create_tool(
        name="catalyst_health_get_trend",
        description="""Get health trends over time for sites, devices, or clients.""",
        platform="catalyst",
        category="health",
        properties={
            "entity_type": {
                        "type": "string",
                        "enum": [
                                    "site",
                                    "device",
                                    "client"
                        ]
            },
            "entity_id": {
                        "type": "string"
            },
            "start_time": {
                        "type": "string",
                        "description": "Start Time"
            },
            "end_time": {
                        "type": "string",
                        "description": "End Time"
            },
            "trend_interval": {
                        "type": "string",
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
        tags=["catalyst", "health", "trend", "analytics"],
        requires_write=False,
        handler=handle_health_get_trend,
    ),
    create_tool(
        name="catalyst_health_get_summary",
        description="""Get aggregated health summary across network, devices, and clients.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp"
            }
},
        required=[],
        tags=["catalyst", "health", "summary", "dashboard"],
        requires_write=False,
        handler=handle_health_get_summary,
    ),
    create_tool(
        name="catalyst_health_get_top_n",
        description="""Get top or bottom N entities by health score.""",
        platform="catalyst",
        category="health",
        properties={
            "entity_type": {
                        "type": "string",
                        "enum": [
                                    "site",
                                    "device",
                                    "client"
                        ]
            },
            "top_n": {
                        "type": "integer",
                        "default": 10
            },
            "order": {
                        "type": "string",
                        "enum": [
                                    "asc",
                                    "desc"
                        ],
                        "default": "asc"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp"
            }
},
        required=[],
        tags=["catalyst", "health", "ranking", "analytics"],
        requires_write=False,
        handler=handle_health_get_top_n,
    ),
    create_tool(
        name="catalyst_health_get_score_definitions",
        description="""Get definitions for health score calculations and thresholds.""",
        platform="catalyst",
        category="health",
        properties={},
        required=[],
        tags=["catalyst", "health", "definitions", "thresholds"],
        requires_write=False,
        handler=handle_health_get_score_definitions,
    ),
    create_tool(
        name="catalyst_health_update_score_definitions",
        description="""Update health score thresholds and weights.""",
        platform="catalyst",
        category="health",
        properties={
            "include_for_overall": {
                        "type": "boolean"
            },
            "thresholds": {
                        "type": "integer"
            }
},
        required=[],
        tags=["catalyst", "health", "definitions", "configure"],
        requires_write=False,
        handler=handle_health_update_score_definitions,
    ),
    create_tool(
        name="catalyst_health_get_assurance_alerts",
        description="""Get proactive assurance alerts about potential issues.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "severity": {
                        "type": "string",
                        "enum": [
                                    "HIGH",
                                    "MEDIUM",
                                    "LOW"
                        ]
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
        tags=["catalyst", "health", "alerts", "proactive"],
        requires_write=False,
        handler=handle_health_get_assurance_alerts,
    ),
    create_tool(
        name="catalyst_health_query_assurance_events",
        description="""Query assurance events for troubleshooting and analysis.""",
        platform="catalyst",
        category="health",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            },
            "event_type": {
                        "type": "string"
            },
            "start_time": {
                        "type": "string",
                        "description": "Start Time"
            },
            "end_time": {
                        "type": "string",
                        "description": "End Time"
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
        tags=["catalyst", "health", "events", "assurance"],
        requires_write=False,
        handler=handle_health_query_assurance_events,
    ),
    create_tool(
        name="catalyst_health_get_kpi_detail",
        description="""Get detailed KPI metrics for health monitoring.""",
        platform="catalyst",
        category="health",
        properties={
            "kpi_name": {
                        "type": "string"
            },
            "entity_type": {
                        "type": "string",
                        "enum": [
                                    "site",
                                    "device",
                                    "client"
                        ]
            },
            "entity_id": {
                        "type": "string"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp"
            }
},
        required=[],
        tags=["catalyst", "health", "kpi", "metrics"],
        requires_write=False,
        handler=handle_health_get_kpi_detail,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_health_tools():
    """Register all health tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_HEALTH_TOOLS)
    logger.info(f"Registered {len(CATALYST_HEALTH_TOOLS)} catalyst health tools")


# Auto-register on import
register_health_tools()
