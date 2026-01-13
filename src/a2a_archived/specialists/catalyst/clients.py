"""Catalyst Center Clients skill module.

This module provides skills for client/endpoint management including:
- Client details and health
- Client proximity
- Client enrichment
- Health trends and summaries

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!clients
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    CatalystSkillModule,
    CatalystAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    empty_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    CLIENT_MAC_SCHEMA,
    SITE_ID_SCHEMA,
    TIMESTAMP_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
)


# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

CLIENTS_SKILLS: List[SkillDefinition] = [
    {
        "id": "clients_get_detail",
        "name": "Get Client Details",
        "description": (
            "Get detailed information about network clients including connection status, "
            "device details, VLAN, SSID, and health scores."
        ),
        "tags": ["catalyst", "clients", "details", "endpoints"],
        "examples": [
            "Show client details",
            "Get client information",
            "Client endpoint details",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "mac_address": {
                    **CLIENT_MAC_SCHEMA,
                    "description": "Client MAC address"
                },
                "timestamp": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Point in time for client details"
                },
            },
            "required": [],
        },
    },
    {
        "id": "clients_get_by_mac",
        "name": "Get Client by MAC Address",
        "description": (
            "Get specific client details using its MAC address. Returns comprehensive "
            "client information including connection state and associated network devices."
        ),
        "tags": ["catalyst", "clients", "mac", "lookup"],
        "examples": [
            "Find client by MAC",
            "Look up client MAC address",
            "Get client by MAC",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "mac_address": {
                    **CLIENT_MAC_SCHEMA,
                    "description": "Client MAC address to look up"
                },
            },
            "required": ["mac_address"],
        },
    },
    {
        "id": "clients_get_health",
        "name": "Get Client Health",
        "description": (
            "Get health metrics for network clients including connectivity scores, "
            "onboarding success rates, and health distribution."
        ),
        "tags": ["catalyst", "clients", "health", "assurance"],
        "examples": [
            "Show client health",
            "Get client health scores",
            "Client health summary",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "timestamp": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Point in time for health data"
                },
            },
            "required": [],
        },
    },
    {
        "id": "clients_get_count",
        "name": "Get Client Count",
        "description": (
            "Get the count of network clients, optionally filtered by health status."
        ),
        "tags": ["catalyst", "clients", "count", "statistics"],
        "examples": [
            "How many clients?",
            "Count network clients",
            "Total clients connected",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "timestamp": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Point in time for count"
                },
            },
            "required": [],
        },
    },
    {
        "id": "clients_get_proximity",
        "name": "Get Client Proximity",
        "description": (
            "Get client proximity information showing location and nearby access points. "
            "Useful for location tracking and wireless optimization."
        ),
        "tags": ["catalyst", "clients", "proximity", "location", "wireless"],
        "examples": [
            "Get client location",
            "Client proximity",
            "Where is client located?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
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
                },
            },
            "required": ["username"],
        },
    },
    {
        "id": "clients_get_enrichment",
        "name": "Get Client Enrichment Details",
        "description": (
            "Get enriched client details including connected device information, "
            "issues, and contextual data for troubleshooting."
        ),
        "tags": ["catalyst", "clients", "enrichment", "context", "troubleshooting"],
        "examples": [
            "Get client enrichment",
            "Client context details",
            "Enriched client information",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "mac_address": {
                    **CLIENT_MAC_SCHEMA,
                    "description": "Client MAC address for enrichment"
                },
            },
            "required": ["mac_address"],
        },
    },
    {
        "id": "clients_query",
        "name": "Query Clients",
        "description": (
            "Advanced client query with filtering by various criteria including "
            "site, SSID, health score, and connection type."
        ),
        "tags": ["catalyst", "clients", "query", "search", "filter"],
        "examples": [
            "Search for clients",
            "Query client inventory",
            "Find clients by criteria",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of site IDs to filter"
                },
                "ssid": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of SSIDs to filter"
                },
                "band": {
                    "type": "string",
                    "description": "Wireless band filter",
                    "enum": ["2.4", "5", "6"]
                },
                "health_score": {
                    "type": "object",
                    "description": "Health score filter with min/max",
                    "properties": {
                        "min": {"type": "integer"},
                        "max": {"type": "integer"}
                    }
                },
                "connection_type": {
                    "type": "string",
                    "description": "Connection type filter",
                    "enum": ["WIRED", "WIRELESS"]
                },
                "start_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Start time for query window"
                },
                "end_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "End time for query window"
                },
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "clients_get_trend",
        "name": "Get Client Health Trend",
        "description": (
            "Get client health trends over time showing connectivity patterns "
            "and health score changes."
        ),
        "tags": ["catalyst", "clients", "trend", "health", "analytics"],
        "examples": [
            "Show client health trend",
            "Client connectivity over time",
            "Health trend analysis",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Site ID to get trends for"
                },
                "start_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Start time for trend"
                },
                "end_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "End time for trend"
                },
                "trend_interval": {
                    "type": "string",
                    "description": "Aggregation interval",
                    "enum": ["5m", "15m", "30m", "1h", "1d"]
                },
            },
            "required": [],
        },
    },
    {
        "id": "clients_get_summary",
        "name": "Get Client Summary",
        "description": (
            "Get a summary of clients grouped by various dimensions like site, "
            "device, SSID, or health status."
        ),
        "tags": ["catalyst", "clients", "summary", "statistics", "dashboard"],
        "examples": [
            "Client summary",
            "Client statistics by site",
            "Summarize client data",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Site ID to summarize"
                },
                "group_by": {
                    "type": "string",
                    "description": "Dimension to group by",
                    "enum": ["site", "ssid", "band", "healthScore"]
                },
                "start_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Start time for summary"
                },
                "end_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "End time for summary"
                },
            },
            "required": [],
        },
    },
    {
        "id": "clients_get_top_n",
        "name": "Get Top N Clients",
        "description": (
            "Get top clients by various metrics like health score, traffic, "
            "or issue count."
        ),
        "tags": ["catalyst", "clients", "top", "ranking", "analytics"],
        "examples": [
            "Top clients by health",
            "Clients with most issues",
            "Highest traffic clients",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
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
                    "enum": ["healthScore", "traffic", "issueCount"]
                },
                "order": {
                    "type": "string",
                    "description": "Sort order",
                    "enum": ["asc", "desc"],
                    "default": "desc"
                },
                "start_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Start time for query"
                },
                "end_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "End time for query"
                },
            },
            "required": [],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class ClientsModule(CatalystSkillModule):
    """Client management skills module."""

    MODULE_NAME = "clients"
    MODULE_PREFIX = "clients_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all client management skills."""
        return [create_skill(skill_def) for skill_def in CLIENTS_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a client management skill."""
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
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Internal skill execution dispatcher."""

        if skill_id == "clients_get_detail":
            return await cls._get_detail(client, params)

        if skill_id == "clients_get_by_mac":
            return await cls._get_by_mac(client, params)

        if skill_id == "clients_get_health":
            return await cls._get_health(client, params)

        if skill_id == "clients_get_count":
            return await cls._get_count(client, params)

        if skill_id == "clients_get_proximity":
            return await cls._get_proximity(client, params)

        if skill_id == "clients_get_enrichment":
            return await cls._get_enrichment(client, params)

        if skill_id == "clients_query":
            return await cls._query(client, params)

        if skill_id == "clients_get_trend":
            return await cls._get_trend(client, params)

        if skill_id == "clients_get_summary":
            return await cls._get_summary(client, params)

        if skill_id == "clients_get_top_n":
            return await cls._get_top_n(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    # ========================================================================
    # SKILL IMPLEMENTATIONS
    # ========================================================================

    @classmethod
    async def _get_detail(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client details."""
        query_params = {}

        if params.get("mac_address"):
            query_params["macAddress"] = params["mac_address"]
        if params.get("timestamp"):
            query_params["timestamp"] = params["timestamp"]

        response = await client.get("client-detail", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client details"))

        data = response.get("data", {})
        detail = data.get("response", data.get("detail", {}))

        return success_result(
            data={
                "detail": detail,
            },
            follow_up="Would you like to see client health or proximity?"
        )

    @classmethod
    async def _get_by_mac(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client by MAC address."""
        mac_address = params.get("mac_address")

        response = await client.get("client-detail", {"macAddress": mac_address})

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client"))

        data = response.get("data", {})
        detail = data.get("response", data.get("detail", {}))

        if not detail:
            return empty_result(f"Client with MAC {mac_address} not found")

        return success_result(
            data={
                "client": detail,
                "mac_address": mac_address,
            },
            entities={"mac_address": mac_address},
            follow_up="Would you like to see client health or connection history?"
        )

    @classmethod
    async def _get_health(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client health."""
        query_params = {}

        if params.get("timestamp"):
            query_params["timestamp"] = params["timestamp"]

        response = await client.get("client-health", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client health"))

        data = response.get("data", {})
        health = data.get("response", [])

        # Calculate summary
        total = sum(h.get("count", 0) for h in health)
        healthy = sum(h.get("count", 0) for h in health if h.get("scoreCategory") == "GOOD")
        fair = sum(h.get("count", 0) for h in health if h.get("scoreCategory") == "FAIR")
        poor = sum(h.get("count", 0) for h in health if h.get("scoreCategory") == "POOR")

        return success_result(
            data={
                "health": health,
                "summary": {
                    "total_clients": total,
                    "healthy": healthy,
                    "fair": fair,
                    "poor": poor,
                },
            },
            follow_up="Would you like to see clients with poor health?"
        )

    @classmethod
    async def _get_count(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client count."""
        query_params = {}

        if params.get("timestamp"):
            query_params["timestamp"] = params["timestamp"]

        response = await client.get("client-health/count", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client count"))

        data = response.get("data", {})
        count = data.get("response", 0)

        return success_result(
            data={
                "count": count,
                "message": f"Total clients: {count}",
            }
        )

    @classmethod
    async def _get_proximity(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client proximity."""
        username = params.get("username")
        number_days = params.get("number_days", 1)
        time_resolution = params.get("time_resolution", 5)

        query_params = {
            "username": username,
            "numberDays": number_days,
            "timeResolution": time_resolution,
        }

        response = await client.get("client-proximity", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client proximity"))

        data = response.get("data", {})
        proximity = data.get("response", [])

        return success_result(
            data={
                "proximity": proximity,
                "username": username,
            },
            follow_up="Would you like to see client details?"
        )

    @classmethod
    async def _get_enrichment(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client enrichment details."""
        mac_address = params.get("mac_address")

        # Enrichment API uses headers for entity info
        response = await client.get(
            "client-enrichment-details",
            params={"entity_type": "mac_address", "entity_value": mac_address}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client enrichment"))

        data = response.get("data", {})
        enrichment = data.get("response", [])

        return success_result(
            data={
                "enrichment": enrichment,
                "mac_address": mac_address,
            },
            follow_up="Would you like to see related issues?"
        )

    @classmethod
    async def _query(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Query clients with filters."""
        payload = {}

        if params.get("site_id"):
            payload["siteId"] = params["site_id"]
        if params.get("ssid"):
            payload["ssid"] = params["ssid"]
        if params.get("band"):
            payload["band"] = params["band"]
        if params.get("health_score"):
            payload["healthScore"] = params["health_score"]
        if params.get("connection_type"):
            payload["connectionType"] = params["connection_type"]
        if params.get("start_time"):
            payload["startTime"] = params["start_time"]
        if params.get("end_time"):
            payload["endTime"] = params["end_time"]

        query_params = {}
        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.post("clients/query", payload, query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to query clients"))

        data = response.get("data", {})
        clients_data = data.get("response", [])

        return success_result(
            data={
                "clients": clients_data,
                "count": len(clients_data),
            },
            entities={"mac_addresses": [c.get("macAddress") for c in clients_data]},
            follow_up="Would you like details on any of these clients?"
        )

    @classmethod
    async def _get_trend(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client health trend."""
        payload = {}

        if params.get("site_id"):
            payload["siteId"] = params["site_id"]
        if params.get("start_time"):
            payload["startTime"] = params["start_time"]
        if params.get("end_time"):
            payload["endTime"] = params["end_time"]
        if params.get("trend_interval"):
            payload["trendInterval"] = params["trend_interval"]

        response = await client.post("client-health/trend", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client trend"))

        data = response.get("data", {})
        trend = data.get("response", [])

        return success_result(
            data={
                "trend": trend,
                "data_points": len(trend),
            },
            follow_up="Would you like to see client details for a specific time?"
        )

    @classmethod
    async def _get_summary(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get client summary."""
        payload = {}

        if params.get("site_id"):
            payload["siteId"] = params["site_id"]
        if params.get("group_by"):
            payload["groupBy"] = params["group_by"]
        if params.get("start_time"):
            payload["startTime"] = params["start_time"]
        if params.get("end_time"):
            payload["endTime"] = params["end_time"]

        response = await client.post("clients/summary", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client summary"))

        data = response.get("data", {})
        summary = data.get("response", {})

        return success_result(
            data={
                "summary": summary,
            },
            follow_up="Would you like more detailed client metrics?"
        )

    @classmethod
    async def _get_top_n(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get top N clients."""
        payload = {}

        if params.get("site_id"):
            payload["siteId"] = params["site_id"]
        if params.get("top_n"):
            payload["topN"] = params["top_n"]
        if params.get("sort_by"):
            payload["sortBy"] = params["sort_by"]
        if params.get("order"):
            payload["order"] = params["order"]
        if params.get("start_time"):
            payload["startTime"] = params["start_time"]
        if params.get("end_time"):
            payload["endTime"] = params["end_time"]

        response = await client.post("clients/topN", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get top clients"))

        data = response.get("data", {})
        top_clients = data.get("response", [])

        return success_result(
            data={
                "top_clients": top_clients,
                "count": len(top_clients),
            },
            entities={"mac_addresses": [c.get("macAddress") for c in top_clients]},
            follow_up="Would you like details on any of these clients?"
        )
