"""Splunk System skill module.

This module provides skills for retrieving system information including:
- Splunk instance information
- Index listing and details
- Metadata retrieval
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
    INDEX_NAME_SCHEMA,
    TIME_RANGE_SCHEMA,
)

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

SYSTEM_SKILLS: List[SkillDefinition] = [
    {
        "id": "system_get_splunk_info",
        "name": "Get Splunk Info",
        "description": (
            "Get comprehensive information about the Splunk instance. Retrieves system "
            "information including version, hardware specs, operating system, license info, "
            "and operational status."
        ),
        "tags": ["splunk", "system", "info", "version", "status"],
        "examples": [
            "What version of Splunk is running?",
            "Get Splunk system information",
            "Show me Splunk server details",
            "What's the Splunk instance status?",
            "Check Splunk health",
        ],
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "id": "system_get_indexes",
        "name": "Get Indexes",
        "description": (
            "Get a list of indexes from Splunk. Indexes are data repositories where machine "
            "data is stored and organized. Returns index names, sizes, event counts, and status."
        ),
        "tags": ["splunk", "indexes", "data", "storage", "list"],
        "examples": [
            "List all Splunk indexes",
            "What indexes are available?",
            "Show me data sources",
            "Get index list",
            "What data do we have in Splunk?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "filter": {
                    "type": "string",
                    "description": "Filter indexes by name pattern"
                },
            },
            "required": [],
        },
    },
    {
        "id": "system_get_index_info",
        "name": "Get Index Info",
        "description": (
            "Get detailed information about a specific Splunk index. Returns comprehensive "
            "configuration and status information including size, event count, retention settings, "
            "bucket info, and more."
        ),
        "tags": ["splunk", "index", "details", "configuration", "status"],
        "examples": [
            "Get details about the main index",
            "Show me index configuration",
            "What are the settings for this index?",
            "Index info for security",
            "How big is the main index?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "index_name": INDEX_NAME_SCHEMA,
            },
            "required": ["index_name"],
        },
    },
    {
        "id": "system_get_metadata",
        "name": "Get Metadata",
        "description": (
            "Retrieve metadata about hosts, sources, or sourcetypes across one or more indexes "
            "in the selected time window. Useful for discovering what data is available in Splunk."
        ),
        "tags": ["splunk", "metadata", "hosts", "sources", "sourcetypes", "discovery"],
        "examples": [
            "What hosts are sending data?",
            "List all sourcetypes",
            "Show me data sources in the main index",
            "Get metadata for security index",
            "What types of data do we have?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "metadata_type": {
                    "type": "string",
                    "description": "Type of metadata to retrieve",
                    "enum": ["hosts", "sources", "sourcetypes"],
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
                },
            },
            "required": [],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class SystemModule(SplunkSkillModule):
    """System information skills module."""

    MODULE_NAME = "system"
    MODULE_PREFIX = "system_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all system skills."""
        return [create_skill(skill_def) for skill_def in SYSTEM_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a system skill."""
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

        if skill_id == "system_get_splunk_info":
            return await cls._get_splunk_info(client, params)

        if skill_id == "system_get_indexes":
            return await cls._get_indexes(client, params)

        if skill_id == "system_get_index_info":
            return await cls._get_index_info(client, params)

        if skill_id == "system_get_metadata":
            return await cls._get_metadata(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _get_splunk_info(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get Splunk instance information."""
        response = await client.get("/services/server/info")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get Splunk info"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        if not entries:
            return error_result("No server info available")

        content = entries[0].get("content", {})

        info = {
            "version": content.get("version"),
            "build": content.get("build"),
            "product_type": content.get("product_type"),
            "server_name": content.get("serverName"),
            "os_name": content.get("os_name"),
            "os_version": content.get("os_version"),
            "cpu_arch": content.get("cpu_arch"),
            "license_state": content.get("licenseState"),
            "license_type": content.get("activeLicenseGroup"),
            "is_free": content.get("isFree"),
            "is_trial": content.get("isTrial"),
            "startup_time": content.get("startup_time"),
            "guid": content.get("guid"),
        }

        return success_result(
            data=info,
            entities={"server_name": info.get("server_name")},
            follow_up="Would you like to see available indexes or run a search?"
        )

    @classmethod
    async def _get_indexes(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get list of Splunk indexes."""
        filter_pattern = params.get("filter", "")

        response = await client.get(
            "/services/data/indexes",
            {"count": 100}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get indexes"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        indexes = []
        total_size_mb = 0
        total_events = 0

        for entry in entries:
            name = entry.get("name", "")

            # Apply filter if specified
            if filter_pattern and filter_pattern.lower() not in name.lower():
                continue

            content = entry.get("content", {})

            size_mb = content.get("currentDBSizeMB", 0)
            event_count = content.get("totalEventCount", 0)

            indexes.append({
                "name": name,
                "datatype": content.get("datatype"),
                "currentDBSizeMB": size_mb,
                "totalEventCount": event_count,
                "maxDataSizeMB": content.get("maxDataSizeMB"),
                "frozenTimePeriodInSecs": content.get("frozenTimePeriodInSecs"),
                "homePath": content.get("homePath"),
                "disabled": content.get("disabled", False),
            })

            total_size_mb += size_mb
            total_events += event_count

        # Sort by size descending
        indexes.sort(key=lambda x: x.get("currentDBSizeMB", 0), reverse=True)

        summary = {
            "total_indexes": len(indexes),
            "total_size_mb": round(total_size_mb, 2),
            "total_events": total_events,
        }

        return success_result(
            data={
                "indexes": indexes,
                "summary": summary,
            },
            entities={"index_names": [i["name"] for i in indexes]},
            follow_up="Would you like details on a specific index or search one of these indexes?"
        )

    @classmethod
    async def _get_index_info(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get detailed information about a specific index."""
        index_name = params.get("index_name", "")

        if not index_name:
            return error_result("index_name is required")

        response = await client.get(f"/services/data/indexes/{index_name}")

        if not response.get("success"):
            return error_result(response.get("error", f"Failed to get info for index '{index_name}'"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        if not entries:
            return error_result(f"Index '{index_name}' not found")

        content = entries[0].get("content", {})

        info = {
            "name": index_name,
            "datatype": content.get("datatype"),
            "currentDBSizeMB": content.get("currentDBSizeMB", 0),
            "totalEventCount": content.get("totalEventCount", 0),
            "maxDataSizeMB": content.get("maxDataSizeMB"),
            "maxHotBuckets": content.get("maxHotBuckets"),
            "maxWarmDBCount": content.get("maxWarmDBCount"),
            "frozenTimePeriodInSecs": content.get("frozenTimePeriodInSecs"),
            "coldPath": content.get("coldPath"),
            "homePath": content.get("homePath"),
            "thawedPath": content.get("thawedPath"),
            "disabled": content.get("disabled", False),
            "isInternal": content.get("isInternal", False),
            "minTime": content.get("minTime"),
            "maxTime": content.get("maxTime"),
            "assureUTF8": content.get("assureUTF8"),
            "blockSignSize": content.get("blockSignSize"),
            "enableDataIntegrityControl": content.get("enableDataIntegrityControl"),
        }

        # Calculate retention in days
        frozen_secs = content.get("frozenTimePeriodInSecs", 0)
        if frozen_secs:
            info["retention_days"] = round(frozen_secs / 86400, 1)

        return success_result(
            data=info,
            follow_up=f"Would you like to search the '{index_name}' index?"
        )

    @classmethod
    async def _get_metadata(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get metadata about hosts, sources, or sourcetypes."""
        metadata_type = params.get("metadata_type", "sourcetypes")
        index = params.get("index", "*")
        earliest_time = params.get("earliest_time", "-24h")
        latest_time = params.get("latest_time", "now")

        # Build metadata search
        query = f"| metadata type={metadata_type} index={index}"

        results = await client.run_search(
            query=query,
            earliest_time=earliest_time,
            latest_time=latest_time,
            max_results=500
        )

        if not results:
            return success_result(
                data={
                    "metadata_type": metadata_type,
                    "index": index,
                    "items": [],
                    "count": 0,
                    "message": f"No {metadata_type} found in index '{index}' for the specified time range",
                }
            )

        # Process metadata results
        items = []
        for result in results:
            item = {
                metadata_type[:-1]: result.get(metadata_type[:-1]),  # Remove 's' for singular
                "totalCount": result.get("totalCount", 0),
                "recentTime": result.get("recentTime"),
                "firstTime": result.get("firstTime"),
                "lastTime": result.get("lastTime"),
            }
            items.append(item)

        # Sort by total count descending
        items.sort(key=lambda x: int(x.get("totalCount", 0)), reverse=True)

        return success_result(
            data={
                "metadata_type": metadata_type,
                "index": index,
                "items": items,
                "count": len(items),
                "time_range": f"{earliest_time} to {latest_time}",
            },
            entities={metadata_type: [i.get(metadata_type[:-1]) for i in items[:20]]},
            follow_up=f"Would you like to search for events from a specific {metadata_type[:-1]}?"
        )
