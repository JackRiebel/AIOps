"""
Splunk Kvstore Tools

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

async def handle_kvstore_get_collections(params: Dict, context: Any) -> Dict:
    """Handler for Get KV Store Collections."""
    try:
        # Build API path
        path = "/kvstore/get/collections"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_kvstore_get_collection_data(params: Dict, context: Any) -> Dict:
    """Handler for Get KV Store Collection Data."""
    try:
        # Build API path
        path = "/kvstore/get/collection/data"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_kvstore_create_collection(params: Dict, context: Any) -> Dict:
    """Handler for Create KV Store Collection."""
    try:
        # Build API path
        path = "/kvstore/create/collection"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_kvstore_delete_collection(params: Dict, context: Any) -> Dict:
    """Handler for Delete KV Store Collection."""
    try:
        # Build API path
        path = "/kvstore/delete/collection"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

SPLUNK_KVSTORE_TOOLS = [
    create_tool(
        name="splunk_kvstore_get_collections",
        description="""Get KV Store collection statistics including size, count, and storage information. Retrieves comprehensive metrics about all KV Store collections in the Splunk instance. KV Store is a NoSQL database for storing application data.""",
        platform="splunk",
        category="kvstore",
        properties={
            "app": {
                        "type": "string",
                        "description": "Filter collections by app context"
            }
},
        required=[],
        tags=["splunk", "kvstore", "collections", "storage", "nosql", "data"],
        requires_write=False,
        handler=handle_kvstore_get_collections,
    ),
    create_tool(
        name="splunk_kvstore_get_collection_data",
        description="""Retrieve data from a specific KV Store collection. Returns records stored in the collection with optional filtering and limit.""",
        platform="splunk",
        category="kvstore",
        properties={
            "collection_name": {
                        "type": "string",
                        "description": "Name of the KV Store collection"
            },
            "app": {
                        "type": "string",
                        "description": "App context for the collection",
                        "default": "search"
            },
            "limit": {
                        "type": "integer",
                        "description": "Maximum number of records to return",
                        "default": 100
            },
            "query": {
                        "type": "string",
                        "description": "JSON query filter (MongoDB-style)"
            }
},
        required=["collection_name"],
        tags=["splunk", "kvstore", "collection", "data", "query"],
        requires_write=False,
        handler=handle_kvstore_get_collection_data,
    ),
    create_tool(
        name="splunk_kvstore_create_collection",
        description="""Create a new KV Store collection. Optionally define the schema for field types and indexing.""",
        platform="splunk",
        category="kvstore",
        properties={
            "collection_name": {
                        "type": "string",
                        "description": "Name for the new collection"
            },
            "app": {
                        "type": "string",
                        "description": "App context for the collection",
                        "default": "search"
            },
            "fields": {
                        "type": "object",
                        "description": "Field definitions with types (e.g., {'name': 'string', 'count': 'number'})"
            }
},
        required=["collection_name"],
        tags=["splunk", "kvstore", "collection", "create"],
        requires_write=True,
        handler=handle_kvstore_create_collection,
    ),
    create_tool(
        name="splunk_kvstore_delete_collection",
        description="""Delete a KV Store collection and all its data. This action cannot be undone.""",
        platform="splunk",
        category="kvstore",
        properties={
            "collection_name": {
                        "type": "string",
                        "description": "Name of the collection to delete"
            },
            "app": {
                        "type": "string",
                        "description": "App context for the collection",
                        "default": "search"
            }
},
        required=["collection_name"],
        tags=["splunk", "kvstore", "collection", "delete"],
        requires_write=True,
        handler=handle_kvstore_delete_collection,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_kvstore_tools():
    """Register all kvstore tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_KVSTORE_TOOLS)
    logger.info(f"Registered {len(SPLUNK_KVSTORE_TOOLS)} splunk kvstore tools")


# Auto-register on import
register_kvstore_tools()
