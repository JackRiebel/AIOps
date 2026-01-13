"""Splunk KV Store skill module.

This module provides skills for KV Store management including:
- Listing KV Store collections
- Collection statistics
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    SplunkSkillModule,
    SplunkAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
)

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

KVSTORE_SKILLS: List[SkillDefinition] = [
    {
        "id": "kvstore_get_collections",
        "name": "Get KV Store Collections",
        "description": (
            "Get KV Store collection statistics including size, count, and storage information. "
            "Retrieves comprehensive metrics about all KV Store collections in the Splunk instance. "
            "KV Store is a NoSQL database for storing application data."
        ),
        "tags": ["splunk", "kvstore", "collections", "storage", "nosql", "data"],
        "examples": [
            "List KV Store collections",
            "What data is in KV Store?",
            "Show me KV Store statistics",
            "Get collection info",
            "How much data is in KV Store?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "app": {
                    "type": "string",
                    "description": "Filter collections by app context"
                },
            },
            "required": [],
        },
    },
    {
        "id": "kvstore_get_collection_data",
        "name": "Get KV Store Collection Data",
        "description": (
            "Retrieve data from a specific KV Store collection. Returns records stored "
            "in the collection with optional filtering and limit."
        ),
        "tags": ["splunk", "kvstore", "collection", "data", "query"],
        "examples": [
            "Get data from KV Store collection",
            "Show records in collection",
            "Query KV Store",
            "Fetch collection contents",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
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
                },
            },
            "required": ["collection_name"],
        },
    },
    {
        "id": "kvstore_create_collection",
        "name": "Create KV Store Collection",
        "description": (
            "Create a new KV Store collection. Optionally define the schema for "
            "field types and indexing."
        ),
        "tags": ["splunk", "kvstore", "collection", "create"],
        "examples": [
            "Create a KV Store collection",
            "Add new collection to KV Store",
            "Set up a data collection",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
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
                },
            },
            "required": ["collection_name"],
        },
    },
    {
        "id": "kvstore_delete_collection",
        "name": "Delete KV Store Collection",
        "description": (
            "Delete a KV Store collection and all its data. This action cannot be undone."
        ),
        "tags": ["splunk", "kvstore", "collection", "delete"],
        "examples": [
            "Delete KV Store collection",
            "Remove collection",
            "Drop KV Store table",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "collection_name": {
                    "type": "string",
                    "description": "Name of the collection to delete"
                },
                "app": {
                    "type": "string",
                    "description": "App context for the collection",
                    "default": "search"
                },
            },
            "required": ["collection_name"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class KVStoreModule(SplunkSkillModule):
    """KV Store skills module."""

    MODULE_NAME = "kvstore"
    MODULE_PREFIX = "kvstore_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all KV Store skills."""
        return [create_skill(skill_def) for skill_def in KVSTORE_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a KV Store skill."""
        log_skill_start(skill_id, params)

        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed to execute {skill_id}: {str(e)}")

    @classmethod
    async def _execute_skill(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Internal skill execution dispatcher."""

        if skill_id == "kvstore_get_collections":
            return await cls._get_collections(client, params)

        if skill_id == "kvstore_get_collection_data":
            return await cls._get_collection_data(client, params)

        if skill_id == "kvstore_create_collection":
            return await cls._create_collection(client, params)

        if skill_id == "kvstore_delete_collection":
            return await cls._delete_collection(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _get_collections(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get list of KV Store collections with statistics."""
        app_filter = params.get("app", "")

        # Get collections config
        response = await client.get("/servicesNS/-/-/storage/collections/config")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get KV Store collections"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        collections = []
        apps_seen = set()

        for entry in entries:
            acl = entry.get("acl", {})
            app = acl.get("app", "")

            # Apply app filter if specified
            if app_filter and app_filter.lower() != app.lower():
                continue

            collection = {
                "name": entry.get("name"),
                "app": app,
                "owner": acl.get("owner"),
                "sharing": acl.get("sharing"),
            }
            collections.append(collection)
            apps_seen.add(app)

        # Get statistics for each collection
        for collection in collections:
            try:
                stats_response = await client.get(
                    f"/servicesNS/-/{collection['app']}/storage/collections/data/{collection['name']}/_stats"
                )
                if stats_response.get("success"):
                    stats = stats_response.get("data", {})
                    collection["count"] = stats.get("count", 0)
                    collection["size_bytes"] = stats.get("size", 0)
            except Exception:
                collection["count"] = "unknown"
                collection["size_bytes"] = "unknown"

        # Sort by name
        collections.sort(key=lambda x: x.get("name", "").lower())

        summary = {
            "total_collections": len(collections),
            "apps": list(apps_seen),
        }

        return success_result(
            data={
                "collections": collections,
                "summary": summary,
            },
            entities={"collection_names": [c["name"] for c in collections]},
            follow_up="Would you like to query data from a specific collection?"
        )

    @classmethod
    async def _get_collection_data(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get data from a KV Store collection."""
        collection_name = params.get("collection_name", "")
        app = params.get("app", "search")
        limit = params.get("limit", 100)
        query = params.get("query", "")

        if not collection_name:
            return error_result("collection_name is required")

        endpoint = f"/servicesNS/-/{app}/storage/collections/data/{collection_name}"
        query_params = {"limit": limit}

        if query:
            query_params["query"] = query

        response = await client.get(endpoint, query_params)

        if not response.get("success"):
            return error_result(response.get("error", f"Failed to get data from '{collection_name}'"))

        records = response.get("data", [])

        return success_result(
            data={
                "collection": collection_name,
                "app": app,
                "records": records,
                "count": len(records),
                "limit": limit,
            },
            follow_up="Would you like to filter or search within this data?"
        )

    @classmethod
    async def _create_collection(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Create a new KV Store collection."""
        collection_name = params.get("collection_name", "")
        app = params.get("app", "search")
        fields = params.get("fields", {})

        if not collection_name:
            return error_result("collection_name is required")

        # Create collection
        response = await client.post(
            f"/servicesNS/nobody/{app}/storage/collections/config",
            {"name": collection_name}
        )

        if not response.get("success"):
            return error_result(response.get("error", f"Failed to create collection '{collection_name}'"))

        # Define schema if fields provided
        if fields:
            for field_name, field_type in fields.items():
                await client.post(
                    f"/servicesNS/nobody/{app}/storage/collections/config/{collection_name}",
                    {f"field.{field_name}": field_type}
                )

        return success_result(
            data={
                "collection": collection_name,
                "app": app,
                "fields": fields,
                "message": f"Collection '{collection_name}' created successfully",
            },
            follow_up="Would you like to add data to this collection?"
        )

    @classmethod
    async def _delete_collection(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Delete a KV Store collection."""
        collection_name = params.get("collection_name", "")
        app = params.get("app", "search")

        if not collection_name:
            return error_result("collection_name is required")

        response = await client.delete(
            f"/servicesNS/nobody/{app}/storage/collections/config/{collection_name}"
        )

        if not response.get("success"):
            return error_result(response.get("error", f"Failed to delete collection '{collection_name}'"))

        return success_result(
            data={
                "collection": collection_name,
                "app": app,
                "message": f"Collection '{collection_name}' deleted successfully",
            }
        )
