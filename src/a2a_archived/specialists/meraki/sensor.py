"""
Meraki Sensor (MT) skill module.

This module provides skills for MT environmental sensors including:
- Alert Profiles
- Readings (History, Latest)
- Relationships
- Commands
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
    extract_device_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    NETWORK_ID_SCHEMA,
    DEVICE_SERIAL_SCHEMA,
)

# Common schemas
ALERT_PROFILE_ID_SCHEMA = {
    "type": "string",
    "description": "Sensor alert profile ID"
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

# Alert Profile Skills
ALERT_PROFILE_SKILLS: List[SkillDefinition] = [
    {
        "id": "sensor_list_alerts_profiles",
        "name": "List Sensor Alert Profiles",
        "description": "List the sensor alert profiles for a network",
        "tags": ["meraki", "sensor", "alerts", "profiles", "list"],
        "examples": [
            "Show sensor alert profiles",
            "List environmental alerts",
            "What sensor alerts are configured?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sensor_create_alerts_profile",
        "name": "Create Sensor Alert Profile",
        "description": "Create a sensor alert profile for a network",
        "tags": ["meraki", "sensor", "alerts", "profiles", "create"],
        "examples": [
            "Create temperature alert",
            "Set up humidity alert profile",
            "Add environmental alert",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "name": {"type": "string", "description": "Profile name"},
                "schedule": {"type": "object", "description": "Alert schedule"},
                "conditions": {
                    "type": "array",
                    "description": "Alert conditions",
                    "items": {
                        "type": "object",
                        "properties": {
                            "metric": {"type": "string", "description": "Metric: temperature, humidity, water, door, etc."},
                            "threshold": {"type": "object", "description": "Threshold configuration"},
                            "direction": {"type": "string", "description": "above or below"},
                            "duration": {"type": "integer", "description": "Duration in seconds"},
                        },
                    },
                },
                "recipients": {"type": "object", "description": "Alert recipients (emails, SMS, webhooks)"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Device serials to apply profile"},
            },
            "required": ["network_id", "name", "conditions"],
        },
    },
    {
        "id": "sensor_get_alerts_profile",
        "name": "Get Sensor Alert Profile",
        "description": "Get a specific sensor alert profile",
        "tags": ["meraki", "sensor", "alerts", "profiles", "get"],
        "examples": [
            "Get alert profile details",
            "Show sensor alert configuration",
            "What's in this alert profile?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "alert_profile_id": ALERT_PROFILE_ID_SCHEMA,
            },
            "required": ["network_id", "alert_profile_id"],
        },
    },
    {
        "id": "sensor_update_alerts_profile",
        "name": "Update Sensor Alert Profile",
        "description": "Update a sensor alert profile",
        "tags": ["meraki", "sensor", "alerts", "profiles", "update"],
        "examples": [
            "Update alert profile",
            "Change temperature threshold",
            "Modify sensor alert",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "alert_profile_id": ALERT_PROFILE_ID_SCHEMA,
                "name": {"type": "string", "description": "Profile name"},
                "schedule": {"type": "object", "description": "Alert schedule"},
                "conditions": {"type": "array", "description": "Alert conditions"},
                "recipients": {"type": "object", "description": "Alert recipients"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Device serials"},
            },
            "required": ["network_id", "alert_profile_id"],
        },
    },
    {
        "id": "sensor_delete_alerts_profile",
        "name": "Delete Sensor Alert Profile",
        "description": "Delete a sensor alert profile",
        "tags": ["meraki", "sensor", "alerts", "profiles", "delete"],
        "examples": [
            "Delete alert profile",
            "Remove sensor alert",
            "Delete this profile",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "alert_profile_id": ALERT_PROFILE_ID_SCHEMA,
            },
            "required": ["network_id", "alert_profile_id"],
        },
    },
]

# Alert Status Skills
ALERT_STATUS_SKILLS: List[SkillDefinition] = [
    {
        "id": "sensor_get_alerts_current",
        "name": "Get Current Sensor Alerts",
        "description": "Get the current sensor alerts by metric for a network",
        "tags": ["meraki", "sensor", "alerts", "current", "status"],
        "examples": [
            "Show current sensor alerts",
            "Are there any active alerts?",
            "What alerts are triggering now?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sensor_get_alerts_history",
        "name": "Get Sensor Alerts History",
        "description": "Get the sensor alerts history by metric for a network",
        "tags": ["meraki", "sensor", "alerts", "history"],
        "examples": [
            "Show alert history",
            "What alerts have triggered?",
            "Get past sensor alerts",
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

# Readings Skills
READINGS_SKILLS: List[SkillDefinition] = [
    {
        "id": "sensor_get_readings_history",
        "name": "Get Sensor Readings History",
        "description": "Get historical sensor readings for a network",
        "tags": ["meraki", "sensor", "readings", "history", "data"],
        "examples": [
            "Show sensor history",
            "What were the temperatures yesterday?",
            "Get sensor data for the past week",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds (max 730 days)"},
                "per_page": {"type": "integer", "description": "Number of entries per page (max 1000)"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Filter by device serials"},
                "metrics": {"type": "array", "items": {"type": "string"}, "description": "Filter by metrics"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sensor_get_readings_latest",
        "name": "Get Sensor Readings Latest",
        "description": "Get the latest sensor readings for a network",
        "tags": ["meraki", "sensor", "readings", "latest", "current"],
        "examples": [
            "Show current sensor readings",
            "What's the temperature now?",
            "Get latest sensor data",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Filter by device serials"},
                "metrics": {"type": "array", "items": {"type": "string"}, "description": "Filter by metrics"},
            },
            "required": ["network_id"],
        },
    },
]

# Relationships Skills
RELATIONSHIPS_SKILLS: List[SkillDefinition] = [
    {
        "id": "sensor_list_relationships",
        "name": "List Sensor Relationships",
        "description": "List the sensor relationships for a network",
        "tags": ["meraki", "sensor", "relationships", "gateway"],
        "examples": [
            "Show sensor relationships",
            "Which gateway is each sensor connected to?",
            "List sensor-gateway mappings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sensor_get_device_relationships",
        "name": "Get Device Sensor Relationships",
        "description": "Get the sensor relationships for a specific device",
        "tags": ["meraki", "sensor", "relationships", "device"],
        "examples": [
            "Show relationships for this sensor",
            "What gateway is this sensor using?",
            "Get device relationships",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
            },
            "required": ["serial"],
        },
    },
    {
        "id": "sensor_update_device_relationships",
        "name": "Update Device Sensor Relationships",
        "description": "Update the sensor relationships for a specific device",
        "tags": ["meraki", "sensor", "relationships", "device", "update"],
        "examples": [
            "Update sensor relationship",
            "Change sensor gateway",
            "Assign sensor to gateway",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "livestream": {
                    "type": "object",
                    "description": "Livestream relationship",
                    "properties": {
                        "related_devices": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
            "required": ["serial"],
        },
    },
]

# Commands Skills
COMMANDS_SKILLS: List[SkillDefinition] = [
    {
        "id": "sensor_create_command",
        "name": "Create Sensor Command",
        "description": "Send a command to a sensor",
        "tags": ["meraki", "sensor", "commands", "action"],
        "examples": [
            "Send command to sensor",
            "Trigger sensor action",
            "Execute sensor command",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "operation": {"type": "string", "description": "Command operation"},
            },
            "required": ["serial", "operation"],
        },
    },
    {
        "id": "sensor_get_command",
        "name": "Get Sensor Command",
        "description": "Get the status of a sensor command",
        "tags": ["meraki", "sensor", "commands", "status"],
        "examples": [
            "Check command status",
            "Did the command complete?",
            "Get command result",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "command_id": {"type": "string", "description": "Command ID"},
            },
            "required": ["serial", "command_id"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class SensorModule(MerakiSkillModule):
    """Sensor skills module."""

    MODULE_NAME = "sensor"
    MODULE_PREFIX = "sensor_"

    # Combine all skill definitions
    ALL_SKILLS: List[SkillDefinition] = (
        ALERT_PROFILE_SKILLS
        + ALERT_STATUS_SKILLS
        + READINGS_SKILLS
        + RELATIONSHIPS_SKILLS
        + COMMANDS_SKILLS
    )

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all sensor skills."""
        return [create_skill(skill_def) for skill_def in cls.ALL_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Execute a sensor skill."""
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
        serial = params.get("serial") or extract_device_entities(params, context)

        # Alert Profiles
        if skill_id == "sensor_list_alerts_profiles":
            return await api_get(client, f"/networks/{network_id}/sensor/alerts/profiles")

        if skill_id == "sensor_create_alerts_profile":
            body = {
                "name": params.get("name"),
                "conditions": params.get("conditions", []),
            }
            for key, api_key in [("schedule", "schedule"), ("recipients", "recipients"), ("serials", "serials")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_post(client, f"/networks/{network_id}/sensor/alerts/profiles", body)

        if skill_id == "sensor_get_alerts_profile":
            profile_id = params.get("alert_profile_id")
            return await api_get(client, f"/networks/{network_id}/sensor/alerts/profiles/{profile_id}")

        if skill_id == "sensor_update_alerts_profile":
            profile_id = params.get("alert_profile_id")
            body = {}
            for key, api_key in [("name", "name"), ("schedule", "schedule"), ("conditions", "conditions"),
                                  ("recipients", "recipients"), ("serials", "serials")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/sensor/alerts/profiles/{profile_id}", body)

        if skill_id == "sensor_delete_alerts_profile":
            profile_id = params.get("alert_profile_id")
            return await api_delete(client, f"/networks/{network_id}/sensor/alerts/profiles/{profile_id}")

        # Alert Status
        if skill_id == "sensor_get_alerts_current":
            return await api_get(client, f"/networks/{network_id}/sensor/alerts/current/overview/byMetric")

        if skill_id == "sensor_get_alerts_history":
            query_params = {}
            for key in ["t0", "t1", "timespan"]:
                if params.get(key) is not None:
                    query_params[key] = params[key]
            return await api_get(client, f"/networks/{network_id}/sensor/alerts/overview/byMetric", query_params)

        # Readings
        if skill_id == "sensor_get_readings_history":
            query_params = {}
            for key in ["t0", "t1", "timespan", "per_page", "serials", "metrics"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/networks/{network_id}/sensor/readings/history", query_params)

        if skill_id == "sensor_get_readings_latest":
            query_params = {}
            for key in ["per_page", "serials", "metrics"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/networks/{network_id}/sensor/readings/latest", query_params)

        # Relationships
        if skill_id == "sensor_list_relationships":
            return await api_get(client, f"/networks/{network_id}/sensor/relationships")

        if skill_id == "sensor_get_device_relationships":
            return await api_get(client, f"/devices/{serial}/sensor/relationships")

        if skill_id == "sensor_update_device_relationships":
            body = {}
            if params.get("livestream"):
                body["livestream"] = params["livestream"]
            return await api_put(client, f"/devices/{serial}/sensor/relationships", body)

        # Commands
        if skill_id == "sensor_create_command":
            body = {"operation": params.get("operation")}
            return await api_post(client, f"/devices/{serial}/sensor/commands", body)

        if skill_id == "sensor_get_command":
            command_id = params.get("command_id")
            return await api_get(client, f"/devices/{serial}/sensor/commands/{command_id}")

        # Unknown skill
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    def _to_camel_case(cls, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])
