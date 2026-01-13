"""Catalyst Center Health skill module.

This module provides skills for health analytics including:
- Site, network, device, and client health
- Health trends and summaries
- Health score definitions
- Assurance alerts and events

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!health-and-performance
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
    log_skill_start,
    log_skill_success,
    log_skill_error,
    SITE_ID_SCHEMA,
    DEVICE_ID_SCHEMA,
    TIMESTAMP_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
)


# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

HEALTH_SKILLS: List[SkillDefinition] = [
    {
        "id": "health_get_site_health",
        "name": "Get Site Health",
        "description": "Get health metrics for sites including network health scores and device status.",
        "tags": ["catalyst", "health", "sites", "assurance"],
        "examples": ["Show site health", "Site health summary", "How healthy are sites?"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "timestamp": TIMESTAMP_SCHEMA,
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_query_site",
        "name": "Query Site Health",
        "description": "Advanced site health query with filtering and aggregation options.",
        "tags": ["catalyst", "health", "sites", "query"],
        "examples": ["Query site health", "Site health analytics"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "view": {"type": "string", "enum": ["summary", "detail"]},
                "start_time": TIMESTAMP_SCHEMA,
                "end_time": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_get_network",
        "name": "Get Network Health",
        "description": "Get overall network health including device and client health distribution.",
        "tags": ["catalyst", "health", "network", "overview"],
        "examples": ["Network health", "Overall health", "How healthy is the network?"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "timestamp": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_get_device",
        "name": "Get Device Health",
        "description": "Get device health metrics including CPU, memory, and reachability.",
        "tags": ["catalyst", "health", "devices", "metrics"],
        "examples": ["Device health", "Show device health scores"],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": DEVICE_ID_SCHEMA,
                "timestamp": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_query_device",
        "name": "Query Device Health",
        "description": "Advanced device health query with filtering options.",
        "tags": ["catalyst", "health", "devices", "query"],
        "examples": ["Query device health", "Device health analytics"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "device_role": {"type": "string", "enum": ["ACCESS", "DISTRIBUTION", "CORE"]},
                "health_score_range": {"type": "object", "properties": {"min": {"type": "integer"}, "max": {"type": "integer"}}},
                "start_time": TIMESTAMP_SCHEMA,
                "end_time": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_get_client",
        "name": "Get Client Health",
        "description": "Get client health metrics including connectivity and onboarding success.",
        "tags": ["catalyst", "health", "clients", "wireless"],
        "examples": ["Client health", "Wireless client health"],
        "input_schema": {
            "type": "object",
            "properties": {"timestamp": TIMESTAMP_SCHEMA},
            "required": [],
        },
    },
    {
        "id": "health_query_client",
        "name": "Query Client Health",
        "description": "Advanced client health query with filtering by connection type, SSID, etc.",
        "tags": ["catalyst", "health", "clients", "query"],
        "examples": ["Query client health", "Client health by SSID"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "ssid": {"type": "array", "items": {"type": "string"}},
                "band": {"type": "string", "enum": ["2.4", "5", "6"]},
                "connection_type": {"type": "string", "enum": ["WIRED", "WIRELESS"]},
                "start_time": TIMESTAMP_SCHEMA,
                "end_time": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_get_trend",
        "name": "Get Health Trend",
        "description": "Get health trends over time for sites, devices, or clients.",
        "tags": ["catalyst", "health", "trend", "analytics"],
        "examples": ["Health trend", "Health over time"],
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_type": {"type": "string", "enum": ["site", "device", "client"]},
                "entity_id": {"type": "string"},
                "start_time": TIMESTAMP_SCHEMA,
                "end_time": TIMESTAMP_SCHEMA,
                "trend_interval": {"type": "string", "enum": ["5m", "15m", "30m", "1h", "1d"]},
            },
            "required": [],
        },
    },
    {
        "id": "health_get_summary",
        "name": "Get Health Summary",
        "description": "Get aggregated health summary across network, devices, and clients.",
        "tags": ["catalyst", "health", "summary", "dashboard"],
        "examples": ["Health summary", "Overall health overview"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "timestamp": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_get_top_n",
        "name": "Get Top N by Health",
        "description": "Get top or bottom N entities by health score.",
        "tags": ["catalyst", "health", "ranking", "analytics"],
        "examples": ["Worst devices by health", "Top healthy sites"],
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_type": {"type": "string", "enum": ["site", "device", "client"]},
                "top_n": {"type": "integer", "default": 10},
                "order": {"type": "string", "enum": ["asc", "desc"], "default": "asc"},
                "timestamp": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_get_score_definitions",
        "name": "Get Health Score Definitions",
        "description": "Get definitions for health score calculations and thresholds.",
        "tags": ["catalyst", "health", "definitions", "thresholds"],
        "examples": ["Health score definitions", "What determines health score?"],
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "id": "health_update_score_definitions",
        "name": "Update Health Score Definitions",
        "description": "Update health score thresholds and weights.",
        "tags": ["catalyst", "health", "definitions", "configure"],
        "examples": ["Update health thresholds", "Change score definitions"],
        "input_schema": {
            "type": "object",
            "properties": {
                "include_for_overall": {"type": "boolean"},
                "thresholds": {"type": "object", "properties": {"good": {"type": "integer"}, "fair": {"type": "integer"}}},
            },
            "required": [],
        },
    },
    {
        "id": "health_get_assurance_alerts",
        "name": "Get Assurance Alerts",
        "description": "Get proactive assurance alerts about potential issues.",
        "tags": ["catalyst", "health", "alerts", "proactive"],
        "examples": ["Assurance alerts", "Proactive alerts"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "severity": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_query_assurance_events",
        "name": "Query Assurance Events",
        "description": "Query assurance events for troubleshooting and analysis.",
        "tags": ["catalyst", "health", "events", "assurance"],
        "examples": ["Query assurance events", "Get network events"],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "device_id": DEVICE_ID_SCHEMA,
                "event_type": {"type": "string"},
                "start_time": TIMESTAMP_SCHEMA,
                "end_time": TIMESTAMP_SCHEMA,
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "health_get_kpi_detail",
        "name": "Get KPI Details",
        "description": "Get detailed KPI metrics for health monitoring.",
        "tags": ["catalyst", "health", "kpi", "metrics"],
        "examples": ["KPI details", "Health KPIs"],
        "input_schema": {
            "type": "object",
            "properties": {
                "kpi_name": {"type": "string"},
                "entity_type": {"type": "string", "enum": ["site", "device", "client"]},
                "entity_id": {"type": "string"},
                "timestamp": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class HealthModule(CatalystSkillModule):
    """Health analytics skills module."""

    MODULE_NAME = "health"
    MODULE_PREFIX = "health_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(skill_def) for skill_def in HEALTH_SKILLS]

    @classmethod
    async def execute(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        log_skill_start(skill_id, params)
        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed to execute {skill_id}: {str(e)}")

    @classmethod
    async def _execute_skill(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        handlers = {
            "health_get_site_health": cls._get_site_health,
            "health_query_site": cls._query_site,
            "health_get_network": cls._get_network,
            "health_get_device": cls._get_device,
            "health_query_device": cls._query_device,
            "health_get_client": cls._get_client,
            "health_query_client": cls._query_client,
            "health_get_trend": cls._get_trend,
            "health_get_summary": cls._get_summary,
            "health_get_top_n": cls._get_top_n,
            "health_get_score_definitions": cls._get_score_definitions,
            "health_update_score_definitions": cls._update_score_definitions,
            "health_get_assurance_alerts": cls._get_assurance_alerts,
            "health_query_assurance_events": cls._query_assurance_events,
            "health_get_kpi_detail": cls._get_kpi_detail,
        }
        handler = handlers.get(skill_id)
        if handler:
            return await handler(client, params)
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _get_site_health(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {k: v for k, v in {"siteId": params.get("site_id"), "timestamp": params.get("timestamp"), "offset": params.get("offset"), "limit": params.get("limit")}.items() if v}
        response = await client.get("site-health", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get site health"))
        data = response.get("data", {}).get("response", [])
        return success_result(data={"health_data": data, "count": len(data)}, follow_up="Would you like details on specific sites?")

    @classmethod
    async def _query_site(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"siteId": params.get("site_id"), "view": params.get("view"), "startTime": params.get("start_time"), "endTime": params.get("end_time")}.items() if v}
        response = await client.post("siteHealthSummaries/query", payload)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to query site health"))
        return success_result(data={"result": response.get("data", {}).get("response", {})})

    @classmethod
    async def _get_network(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {k: v for k, v in {"siteId": params.get("site_id"), "timestamp": params.get("timestamp")}.items() if v}
        response = await client.get("network-health", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get network health"))
        return success_result(data={"health": response.get("data", {}).get("response", {})})

    @classmethod
    async def _get_device(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {k: v for k, v in {"deviceId": params.get("device_id"), "timestamp": params.get("timestamp")}.items() if v}
        response = await client.get("device-health", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device health"))
        return success_result(data={"health": response.get("data", {}).get("response", [])})

    @classmethod
    async def _query_device(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"siteId": params.get("site_id"), "deviceRole": params.get("device_role"), "healthScoreRange": params.get("health_score_range"), "startTime": params.get("start_time"), "endTime": params.get("end_time")}.items() if v}
        response = await client.post("deviceHealthSummaries/query", payload)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to query device health"))
        return success_result(data={"result": response.get("data", {}).get("response", {})})

    @classmethod
    async def _get_client(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {"timestamp": params.get("timestamp")} if params.get("timestamp") else {}
        response = await client.get("client-health", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get client health"))
        return success_result(data={"health": response.get("data", {}).get("response", [])})

    @classmethod
    async def _query_client(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"siteId": params.get("site_id"), "ssid": params.get("ssid"), "band": params.get("band"), "connectionType": params.get("connection_type"), "startTime": params.get("start_time"), "endTime": params.get("end_time")}.items() if v}
        response = await client.post("clientHealthSummaries/query", payload)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to query client health"))
        return success_result(data={"result": response.get("data", {}).get("response", {})})

    @classmethod
    async def _get_trend(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"entityType": params.get("entity_type"), "entityId": params.get("entity_id"), "startTime": params.get("start_time"), "endTime": params.get("end_time"), "trendInterval": params.get("trend_interval")}.items() if v}
        response = await client.post("health/trend", payload)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get health trend"))
        return success_result(data={"trend": response.get("data", {}).get("response", [])})

    @classmethod
    async def _get_summary(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"siteId": params.get("site_id"), "timestamp": params.get("timestamp")}.items() if v}
        response = await client.post("health/summary", payload)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get health summary"))
        return success_result(data={"summary": response.get("data", {}).get("response", {})})

    @classmethod
    async def _get_top_n(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"entityType": params.get("entity_type"), "topN": params.get("top_n", 10), "order": params.get("order", "asc"), "timestamp": params.get("timestamp")}.items() if v}
        response = await client.post("health/topN", payload)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get top N"))
        return success_result(data={"top_entities": response.get("data", {}).get("response", [])})

    @classmethod
    async def _get_score_definitions(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        response = await client.get("health-score-definitions")
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get score definitions"))
        return success_result(data={"definitions": response.get("data", {}).get("response", [])})

    @classmethod
    async def _update_score_definitions(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"includeForOverall": params.get("include_for_overall"), "thresholds": params.get("thresholds")}.items() if v}
        response = await client.post("health-score-definitions", payload)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to update score definitions"))
        return success_result(data={"message": "Score definitions updated"})

    @classmethod
    async def _get_assurance_alerts(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {k: v for k, v in {"siteId": params.get("site_id"), "severity": params.get("severity"), "offset": params.get("offset"), "limit": params.get("limit")}.items() if v}
        response = await client.get("assuranceAlerts", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get assurance alerts"))
        return success_result(data={"alerts": response.get("data", {}).get("response", [])})

    @classmethod
    async def _query_assurance_events(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        payload = {k: v for k, v in {"siteId": params.get("site_id"), "deviceId": params.get("device_id"), "eventType": params.get("event_type"), "startTime": params.get("start_time"), "endTime": params.get("end_time")}.items() if v}
        query_params = {k: v for k, v in {"offset": params.get("offset"), "limit": params.get("limit")}.items() if v}
        response = await client.post("assuranceEvents/query", payload, query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to query events"))
        return success_result(data={"events": response.get("data", {}).get("response", [])})

    @classmethod
    async def _get_kpi_detail(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {k: v for k, v in {"kpiName": params.get("kpi_name"), "entityType": params.get("entity_type"), "entityId": params.get("entity_id"), "timestamp": params.get("timestamp")}.items() if v}
        response = await client.get("kpi/detail", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get KPI detail"))
        return success_result(data={"kpi": response.get("data", {}).get("response", {})})
