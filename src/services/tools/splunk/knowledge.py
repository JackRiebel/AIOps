"""
Splunk Knowledge Tools

Auto-generated from archived A2A skills.
Total tools: 8
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
# Splunk client imported in handler


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_knowledge_get_objects(params: Dict, context: Any) -> Dict:
    """Handler for Get Knowledge Objects."""
    try:
        # Build API path
        path = "/knowledge/get/objects"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_knowledge_get_saved_searches(params: Dict, context: Any) -> Dict:
    """Handler for Get Saved Searches."""
    try:
        # Build API path
        path = "/knowledge/get/saved/searches"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_knowledge_get_alerts(params: Dict, context: Any) -> Dict:
    """Handler for Get Alerts - retrieves both alert definitions and fired alerts."""
    try:
        results = {"alert_definitions": [], "fired_alerts": []}

        # Get alert definitions (saved searches with alert actions)
        # Splunk REST API: /servicesNS/-/-/saved/searches
        try:
            search_params = {"search": "is_scheduled=1 OR alert.track=1", "count": 50}
            saved_searches = await context.client.request(
                "GET", "/servicesNS/-/-/saved/searches", params=search_params
            )
            if saved_searches and "entry" in saved_searches:
                results["alert_definitions"] = [
                    {
                        "name": entry.get("name"),
                        "search": entry.get("content", {}).get("search"),
                        "cron": entry.get("content", {}).get("cron_schedule"),
                        "alert_type": entry.get("content", {}).get("alert_type"),
                    }
                    for entry in saved_searches.get("entry", [])
                ]
        except Exception as e:
            results["alert_definitions_error"] = str(e)

        # Get fired/triggered alerts
        # Splunk REST API: /services/alerts/fired_alerts
        include_fired = params.get("include_fired", True)
        if include_fired:
            try:
                fired_params = {"count": params.get("limit", 50)}
                fired = await context.client.request(
                    "GET", "/services/alerts/fired_alerts", params=fired_params
                )
                if fired and "entry" in fired:
                    results["fired_alerts"] = [
                        {
                            "name": entry.get("name"),
                            "trigger_time": entry.get("content", {}).get("trigger_time"),
                            "severity": entry.get("content", {}).get("severity"),
                        }
                        for entry in fired.get("entry", [])
                    ]
            except Exception as e:
                results["fired_alerts_error"] = str(e)

        return {"success": True, "data": results}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_knowledge_get_lookups(params: Dict, context: Any) -> Dict:
    """Handler for Get Lookups."""
    try:
        # Build API path
        path = "/knowledge/get/lookups"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_knowledge_get_data_models(params: Dict, context: Any) -> Dict:
    """Handler for Get Data Models."""
    try:
        # Build API path
        path = "/knowledge/get/data/models"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_knowledge_get_macros(params: Dict, context: Any) -> Dict:
    """Handler for Get Macros."""
    try:
        # Build API path
        path = "/knowledge/get/macros"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_knowledge_get_field_extractions(params: Dict, context: Any) -> Dict:
    """Handler for Get Field Extractions."""
    try:
        # Build API path
        path = "/knowledge/get/field/extractions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_knowledge_get_apps(params: Dict, context: Any) -> Dict:
    """Handler for Get Apps."""
    try:
        # Build API path
        path = "/knowledge/get/apps"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

SPLUNK_KNOWLEDGE_TOOLS = [
    create_tool(
        name="splunk_knowledge_get_objects",
        description="""Retrieve Splunk knowledge objects by type. Supports various knowledge object types including saved searches, alerts, field extractions, lookups, macros, data models, views, panels, apps, and MLTK models/algorithms. Knowledge objects are reusable configurations that enhance Splunk's search and analysis capabilities.""",
        platform="splunk",
        category="knowledge",
        properties={
            "object_type": {
                        "type": "string",
                        "description": "Object Type"
            },
            "app": {
                        "type": "string",
                        "description": "Filter by app context"
            },
            "search": {
                        "type": "string",
                        "description": "Filter by name pattern"
            }
},
        required=["object_type"],
        tags=["splunk", "knowledge", "objects", "saved-searches", "alerts", "lookups", "macros"],
        requires_write=False,
        handler=handle_knowledge_get_objects,
    ),
    create_tool(
        name="splunk_knowledge_get_saved_searches",
        description="""List saved searches and reports in Splunk. Saved searches are reusable SPL queries that can be scheduled, shared, and used as the basis for alerts and reports.""",
        platform="splunk",
        category="knowledge",
        properties={
            "app": {
                        "type": "string",
                        "description": "Filter by app context"
            },
            "scheduled_only": {
                        "type": "boolean",
                        "description": "Only show scheduled searches",
                        "default": False
            }
},
        required=[],
        tags=["splunk", "knowledge", "saved-searches", "reports", "scheduled"],
        requires_write=False,
        handler=handle_knowledge_get_saved_searches,
    ),
    create_tool(
        name="splunk_knowledge_get_alerts",
        description="""Get Splunk alerts including alert definitions and triggered (fired) alerts. Alerts are saved searches that trigger actions when conditions are met.""",
        platform="splunk",
        category="knowledge",
        properties={
            "include_fired": {
                        "type": "boolean",
                        "description": "Include fired/triggered alerts",
                        "default": True
            },
            "severity": {
                        "type": "string",
                        "description": "Filter by severity (critical, high, medium, low)",
                        "enum": [
                                    "critical",
                                    "high",
                                    "medium",
                                    "low"
                        ]
            }
},
        required=[],
        tags=["splunk", "knowledge", "alerts", "monitoring", "triggered"],
        requires_write=False,
        handler=handle_knowledge_get_alerts,
    ),
    create_tool(
        name="splunk_knowledge_get_lookups",
        description="""List lookup tables and definitions in Splunk. Lookups are used to enrich events with additional data from external sources like CSV files or KV Store collections.""",
        platform="splunk",
        category="knowledge",
        properties={
            "include_transforms": {
                        "type": "boolean",
                        "description": "Include lookup transform definitions",
                        "default": True
            },
            "include_automatic": {
                        "type": "boolean",
                        "description": "Include automatic lookup configurations",
                        "default": False
            }
},
        required=[],
        tags=["splunk", "knowledge", "lookups", "enrichment", "tables"],
        requires_write=False,
        handler=handle_knowledge_get_lookups,
    ),
    create_tool(
        name="splunk_knowledge_get_data_models",
        description="""List data models in Splunk. Data models are hierarchical schemas that define and normalize data for Pivot and accelerated searches.""",
        platform="splunk",
        category="knowledge",
        properties={
            "accelerated_only": {
                        "type": "boolean",
                        "description": "Only show accelerated data models",
                        "default": False
            }
},
        required=[],
        tags=["splunk", "knowledge", "data-models", "cim", "pivot"],
        requires_write=False,
        handler=handle_knowledge_get_data_models,
    ),
    create_tool(
        name="splunk_knowledge_get_macros",
        description="""List search macros in Splunk. Macros are reusable search fragments that can accept arguments and be used across multiple searches.""",
        platform="splunk",
        category="knowledge",
        properties={
            "app": {
                        "type": "string",
                        "description": "Filter by app context"
            }
},
        required=[],
        tags=["splunk", "knowledge", "macros", "search", "reusable"],
        requires_write=False,
        handler=handle_knowledge_get_macros,
    ),
    create_tool(
        name="splunk_knowledge_get_field_extractions",
        description="""List field extraction configurations in Splunk. Field extractions define how Splunk parses and extracts fields from raw event data.""",
        platform="splunk",
        category="knowledge",
        properties={
            "sourcetype": {
                        "type": "string",
                        "description": "Filter by sourcetype"
            }
},
        required=[],
        tags=["splunk", "knowledge", "field-extractions", "parsing", "regex"],
        requires_write=False,
        handler=handle_knowledge_get_field_extractions,
    ),
    create_tool(
        name="splunk_knowledge_get_apps",
        description="""List installed Splunk apps. Apps are packages that extend Splunk functionality with dashboards, saved searches, data inputs, and more.""",
        platform="splunk",
        category="knowledge",
        properties={
            "visible_only": {
                        "type": "boolean",
                        "description": "Only show visible apps",
                        "default": True
            }
},
        required=[],
        tags=["splunk", "knowledge", "apps", "installed", "packages"],
        requires_write=False,
        handler=handle_knowledge_get_apps,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_knowledge_tools():
    """Register all knowledge tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_KNOWLEDGE_TOOLS)
    logger.info(f"Registered {len(SPLUNK_KNOWLEDGE_TOOLS)} splunk knowledge tools")


# Auto-register on import
register_knowledge_tools()
