"""
Catalyst Path_Trace Tools

Auto-generated from archived A2A skills.
Total tools: 5
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_pathtrace_initiate(params: Dict, context: Any) -> Dict:
    """Handler for Initiate Path Trace."""
    try:
        # Build API path
        path = "/pathtrace/initiate"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_pathtrace_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Path Trace by ID."""
    try:
        # Build API path
        path = "/pathtrace/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_pathtrace_get_all(params: Dict, context: Any) -> Dict:
    """Handler for Get All Path Traces."""
    try:
        # Build API path
        path = "/pathtrace/get/all"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_pathtrace_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Path Trace."""
    try:
        # Build API path
        path = "/pathtrace/delete"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_pathtrace_get_detailed_result(params: Dict, context: Any) -> Dict:
    """Handler for Get Detailed Path Trace Result."""
    try:
        # Build API path
        path = "/pathtrace/get/detailed/result"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_PATH_TRACE_TOOLS = [
    create_tool(
        name="catalyst_pathtrace_initiate",
        description="""Start a new path trace between source and destination.""",
        platform="catalyst",
        category="path_trace",
        properties={
            "source_ip": {
                        "type": "string",
                        "description": "Source IP address"
            },
            "dest_ip": {
                        "type": "string",
                        "description": "Destination IP address"
            },
            "source_port": {
                        "type": "string"
            },
            "dest_port": {
                        "type": "string"
            },
            "protocol": {
                        "type": "string",
                        "enum": [
                                    "TCP",
                                    "UDP",
                                    "ICMP"
                        ]
            },
            "periodic_refresh": {
                        "type": "boolean",
                        "default": False
            },
            "inclusions": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["source_ip", "dest_ip"],
        tags=["catalyst", "pathtrace", "flow", "initiate"],
        requires_write=False,
        handler=handle_pathtrace_initiate,
    ),
    create_tool(
        name="catalyst_pathtrace_get_by_id",
        description="""Get results of a specific path trace.""",
        platform="catalyst",
        category="path_trace",
        properties={
            "flow_analysis_id": {
                        "type": "string"
            }
},
        required=["flow_analysis_id"],
        tags=["catalyst", "pathtrace", "results"],
        requires_write=False,
        handler=handle_pathtrace_get_by_id,
    ),
    create_tool(
        name="catalyst_pathtrace_get_all",
        description="""Get list of all path trace analyses.""",
        platform="catalyst",
        category="path_trace",
        properties={
            "periodic_refresh": {
                        "type": "boolean"
            },
            "source_ip": {
                        "type": "string"
            },
            "dest_ip": {
                        "type": "string"
            },
            "source_port": {
                        "type": "string"
            },
            "dest_port": {
                        "type": "string"
            },
            "gt_create_time": {
                        "type": "integer"
            },
            "lt_create_time": {
                        "type": "integer"
            },
            "protocol": {
                        "type": "string"
            },
            "status": {
                        "type": "string"
            },
            "task_id": {
                        "type": "string"
            },
            "last_update_time": {
                        "type": "integer"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "order": {
                        "type": "string",
                        "enum": [
                                    "asc",
                                    "desc"
                        ]
            },
            "sort_by": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "pathtrace", "list"],
        requires_write=False,
        handler=handle_pathtrace_get_all,
    ),
    create_tool(
        name="catalyst_pathtrace_delete",
        description="""Delete a path trace analysis.""",
        platform="catalyst",
        category="path_trace",
        properties={
            "flow_analysis_id": {
                        "type": "string"
            }
},
        required=["flow_analysis_id"],
        tags=["catalyst", "pathtrace", "delete"],
        requires_write=True,
        handler=handle_pathtrace_delete,
    ),
    create_tool(
        name="catalyst_pathtrace_get_detailed_result",
        description="""Get detailed path trace result with all hops.""",
        platform="catalyst",
        category="path_trace",
        properties={
            "flow_analysis_id": {
                        "type": "string"
            }
},
        required=["flow_analysis_id"],
        tags=["catalyst", "pathtrace", "detailed", "result"],
        requires_write=False,
        handler=handle_pathtrace_get_detailed_result,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_path_trace_tools():
    """Register all path_trace tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_PATH_TRACE_TOOLS)
    logger.info(f"Registered {len(CATALYST_PATH_TRACE_TOOLS)} catalyst path_trace tools")


# Auto-register on import
register_path_trace_tools()
