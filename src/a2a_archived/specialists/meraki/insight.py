"""
Meraki Insight skill module.

This module provides skills for application monitoring and insight including:
- Monitored Media Servers
- Application Health
- Client Statistics
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    MerakiSkillModule,
    SkillDefinition,
    create_skill,
    success_result,
    error_result,
    api_get,
    api_post,
    api_put,
    api_delete,
    extract_network_entities,
    extract_org_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    NETWORK_ID_SCHEMA,
    ORG_ID_SCHEMA,
)

# Common schemas
MEDIA_SERVER_ID_SCHEMA = {
    "type": "string",
    "description": "Monitored media server ID"
}

APPLICATION_ID_SCHEMA = {
    "type": "string",
    "description": "Application ID"
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

# Monitored Media Servers Skills
MEDIA_SERVER_SKILLS: List[SkillDefinition] = [
    {
        "id": "insight_list_monitored_media_servers",
        "name": "List Monitored Media Servers",
        "description": "List the monitored media servers for an organization",
        "tags": ["meraki", "insight", "media-servers", "voip", "list"],
        "examples": [
            "Show monitored media servers",
            "List VoIP servers being monitored",
            "What media servers are configured?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "insight_create_monitored_media_server",
        "name": "Create Monitored Media Server",
        "description": "Create a monitored media server for an organization",
        "tags": ["meraki", "insight", "media-servers", "voip", "create"],
        "examples": [
            "Add media server to monitor",
            "Set up VoIP server monitoring",
            "Create monitored server",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "name": {"type": "string", "description": "Server name"},
                "address": {"type": "string", "description": "Server IP address or hostname"},
                "best_effort_monitoring_enabled": {"type": "boolean", "description": "Enable best effort monitoring"},
            },
            "required": ["organization_id", "name", "address"],
        },
    },
    {
        "id": "insight_get_monitored_media_server",
        "name": "Get Monitored Media Server",
        "description": "Get a specific monitored media server",
        "tags": ["meraki", "insight", "media-servers", "voip", "get"],
        "examples": [
            "Get media server details",
            "Show monitored server configuration",
            "What's this server's address?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "monitored_media_server_id": MEDIA_SERVER_ID_SCHEMA,
            },
            "required": ["organization_id", "monitored_media_server_id"],
        },
    },
    {
        "id": "insight_update_monitored_media_server",
        "name": "Update Monitored Media Server",
        "description": "Update a monitored media server",
        "tags": ["meraki", "insight", "media-servers", "voip", "update"],
        "examples": [
            "Update media server",
            "Change server address",
            "Modify monitored server",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "monitored_media_server_id": MEDIA_SERVER_ID_SCHEMA,
                "name": {"type": "string", "description": "Server name"},
                "address": {"type": "string", "description": "Server IP address or hostname"},
                "best_effort_monitoring_enabled": {"type": "boolean", "description": "Enable best effort monitoring"},
            },
            "required": ["organization_id", "monitored_media_server_id"],
        },
    },
    {
        "id": "insight_delete_monitored_media_server",
        "name": "Delete Monitored Media Server",
        "description": "Delete a monitored media server",
        "tags": ["meraki", "insight", "media-servers", "voip", "delete"],
        "examples": [
            "Delete media server",
            "Remove monitored server",
            "Stop monitoring this server",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "monitored_media_server_id": MEDIA_SERVER_ID_SCHEMA,
            },
            "required": ["organization_id", "monitored_media_server_id"],
        },
    },
]

# Application Health Skills
APPLICATION_HEALTH_SKILLS: List[SkillDefinition] = [
    {
        "id": "insight_get_application_health",
        "name": "Get Application Health",
        "description": "Get the health of an application over time for a network",
        "tags": ["meraki", "insight", "application", "health"],
        "examples": [
            "Show application health",
            "How is this application performing?",
            "Get app health metrics",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "application_id": APPLICATION_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds (max 7 days)"},
                "resolution": {"type": "integer", "description": "Sample resolution in seconds"},
            },
            "required": ["network_id", "application_id"],
        },
    },
    {
        "id": "insight_get_applications",
        "name": "Get Insight Applications",
        "description": "Get the supported application categories and apps for insight",
        "tags": ["meraki", "insight", "applications", "list"],
        "examples": [
            "List insight applications",
            "What applications can I monitor?",
            "Show supported apps",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
            },
            "required": ["organization_id"],
        },
    },
]

# Client Statistics Skills
CLIENT_STATS_SKILLS: List[SkillDefinition] = [
    {
        "id": "insight_get_clients_stats",
        "name": "Get Clients Statistics",
        "description": "Get client application usage and performance statistics",
        "tags": ["meraki", "insight", "clients", "statistics"],
        "examples": [
            "Show client statistics",
            "Get client app usage",
            "How are clients performing?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds"},
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["network_id"],
        },
    },
]

# Speed Test History Skills
SPEED_TEST_SKILLS: List[SkillDefinition] = [
    {
        "id": "insight_get_speed_test_history",
        "name": "Get Speed Test History",
        "description": "Get the speed test history for a network",
        "tags": ["meraki", "insight", "speed-test", "history"],
        "examples": [
            "Show speed test results",
            "What were the speed test scores?",
            "Get speed test history",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds"},
            },
            "required": ["network_id"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class InsightModule(MerakiSkillModule):
    """Insight skills module."""

    MODULE_NAME = "insight"
    MODULE_PREFIX = "insight_"

    # Combine all skill definitions
    ALL_SKILLS: List[SkillDefinition] = (
        MEDIA_SERVER_SKILLS
        + APPLICATION_HEALTH_SKILLS
        + CLIENT_STATS_SKILLS
        + SPEED_TEST_SKILLS
    )

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all insight skills."""
        return [create_skill(skill_def) for skill_def in cls.ALL_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Execute an insight skill."""
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
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Internal skill execution dispatcher."""
        # Extract common parameters
        network_id = params.get("network_id") or extract_network_entities(params, context)
        org_id = params.get("organization_id") or extract_org_entities(params, context)

        # Monitored Media Servers
        if skill_id == "insight_list_monitored_media_servers":
            return await api_get(client, f"/organizations/{org_id}/insight/monitoredMediaServers")

        if skill_id == "insight_create_monitored_media_server":
            body = {
                "name": params.get("name"),
                "address": params.get("address"),
            }
            if params.get("best_effort_monitoring_enabled") is not None:
                body["bestEffortMonitoringEnabled"] = params["best_effort_monitoring_enabled"]
            return await api_post(client, f"/organizations/{org_id}/insight/monitoredMediaServers", body)

        if skill_id == "insight_get_monitored_media_server":
            server_id = params.get("monitored_media_server_id")
            return await api_get(client, f"/organizations/{org_id}/insight/monitoredMediaServers/{server_id}")

        if skill_id == "insight_update_monitored_media_server":
            server_id = params.get("monitored_media_server_id")
            body = {}
            for key, api_key in [("name", "name"), ("address", "address"),
                                  ("best_effort_monitoring_enabled", "bestEffortMonitoringEnabled")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/organizations/{org_id}/insight/monitoredMediaServers/{server_id}", body)

        if skill_id == "insight_delete_monitored_media_server":
            server_id = params.get("monitored_media_server_id")
            return await api_delete(client, f"/organizations/{org_id}/insight/monitoredMediaServers/{server_id}")

        # Application Health
        if skill_id == "insight_get_application_health":
            app_id = params.get("application_id")
            query_params = {}
            for key in ["t0", "t1", "timespan", "resolution"]:
                if params.get(key) is not None:
                    query_params[key] = params[key]
            return await api_get(client, f"/networks/{network_id}/insight/applications/{app_id}/healthByTime", query_params)

        if skill_id == "insight_get_applications":
            return await api_get(client, f"/organizations/{org_id}/insight/applications")

        # Client Statistics
        if skill_id == "insight_get_clients_stats":
            query_params = {}
            for key in ["t0", "t1", "timespan", "per_page"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/networks/{network_id}/insight/clients", query_params)

        # Speed Test History
        if skill_id == "insight_get_speed_test_history":
            query_params = {}
            for key in ["t0", "t1", "timespan"]:
                if params.get(key) is not None:
                    query_params[key] = params[key]
            return await api_get(client, f"/networks/{network_id}/insight/speedTestResults", query_params)

        # Unknown skill
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    def _to_camel_case(cls, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])
