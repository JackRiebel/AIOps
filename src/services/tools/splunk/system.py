"""
Splunk System Tools

Auto-generated from archived A2A skills.
Total tools: 4
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
# Splunk client imported in handler


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_system_get_splunk_info(params: Dict, context: Any) -> Dict:
    """Handler for Get Splunk Info."""
    try:
        # Build API path
        path = "/system/get/splunk/info"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_system_get_indexes(params: Dict, context: Any) -> Dict:
    """Handler for Get Indexes."""
    try:
        # Build API path
        path = "/system/get/indexes"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_system_get_index_info(params: Dict, context: Any) -> Dict:
    """Handler for Get Index Info."""
    try:
        # Build API path
        path = "/system/get/index/info"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_system_get_metadata(params: Dict, context: Any) -> Dict:
    """Handler for Get Metadata."""
    try:
        # Build API path
        path = "/system/get/metadata"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

SPLUNK_SYSTEM_TOOLS = [
    create_tool(
        name="splunk_system_get_splunk_info",
        description="""Get comprehensive information about the Splunk instance. Retrieves system information including version, hardware specs, operating system, license info, and operational status.""",
        platform="splunk",
        category="system",
        properties={},
        required=[],
        tags=["splunk", "system", "info", "version", "status"],
        requires_write=False,
        handler=handle_system_get_splunk_info,
    ),
    create_tool(
        name="splunk_system_get_indexes",
        description="""Get a list of indexes from Splunk. Indexes are data repositories where machine data is stored and organized. Returns index names, sizes, event counts, and status.""",
        platform="splunk",
        category="system",
        properties={
            "filter": {
                        "type": "string",
                        "description": "Filter indexes by name pattern"
            }
},
        required=[],
        tags=["splunk", "indexes", "data", "storage", "list"],
        requires_write=False,
        handler=handle_system_get_indexes,
    ),
    create_tool(
        name="splunk_system_get_index_info",
        description="""Get detailed information about a specific Splunk index. Returns comprehensive configuration and status information including size, event count, retention settings, bucket info, and more.""",
        platform="splunk",
        category="system",
        properties={
            "index_name": {
                        "type": "string",
                        "description": "Index Name"
            }
},
        required=["index_name"],
        tags=["splunk", "index", "details", "configuration", "status"],
        requires_write=False,
        handler=handle_system_get_index_info,
    ),
    create_tool(
        name="splunk_system_get_metadata",
        description="""Retrieve metadata about hosts, sources, or sourcetypes across one or more indexes in the selected time window. Useful for discovering what data is available in Splunk.""",
        platform="splunk",
        category="system",
        properties={
            "metadata_type": {
                        "type": "string",
                        "description": "Type of metadata to retrieve",
                        "enum": [
                                    "hosts",
                                    "sources",
                                    "sourcetypes"
                        ],
                        "default": "sourcetypes"
            },
            "index": {
                        "type": "string",
                        "description": "Index to query (use * for all indexes)",
                        "default": "*"
            },
            "earliest_time": {
                        "type": "string",
                        "description": "Start time for metadata query",
                        "default": "-24h"
            },
            "latest_time": {
                        "type": "string",
                        "description": "End time for metadata query",
                        "default": "now"
            }
},
        required=[],
        tags=["splunk", "metadata", "hosts", "sources", "sourcetypes", "discovery"],
        requires_write=False,
        handler=handle_system_get_metadata,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_system_tools():
    """Register all system tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_SYSTEM_TOOLS)
    logger.info(f"Registered {len(SPLUNK_SYSTEM_TOOLS)} splunk system tools")


# Auto-register on import
register_system_tools()
