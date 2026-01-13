"""
Meraki Camera (MV) skill module.

This module provides skills for MV cameras including:
- Quality and Retention Settings
- Video Settings
- Sense (Object Detection)
- Wireless Profiles
- Snapshots
- Video Links
- Analytics (Zones, Recent, Live, Overview)
- Custom Analytics
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

# Common schemas for camera operations
ZONE_ID_SCHEMA = {
    "type": "string",
    "description": "Analytics zone ID"
}

BOUNDARY_ID_SCHEMA = {
    "type": "string",
    "description": "Custom analytics boundary ID"
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

# Quality and Retention Skills
QUALITY_RETENTION_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_get_quality_retention",
        "name": "Get Camera Quality and Retention",
        "description": "Get the quality and retention settings for a camera",
        "tags": ["meraki", "camera", "quality", "retention", "video"],
        "examples": [
            "Show camera quality settings",
            "What's the retention period?",
            "Get video quality configuration",
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
        "id": "camera_update_quality_retention",
        "name": "Update Camera Quality and Retention",
        "description": "Update the quality and retention settings for a camera",
        "tags": ["meraki", "camera", "quality", "retention", "video", "update"],
        "examples": [
            "Set camera to high quality",
            "Change retention to 30 days",
            "Update video quality settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "profile_id": {"type": "string", "description": "Quality profile ID"},
                "motion_based_retention_enabled": {"type": "boolean", "description": "Enable motion-based retention"},
                "audio_recording_enabled": {"type": "boolean", "description": "Enable audio recording"},
                "restricted_bandwidth_mode_enabled": {"type": "boolean", "description": "Enable restricted bandwidth mode"},
                "quality": {"type": "string", "description": "Video quality: Standard, High, Enhanced"},
                "resolution": {"type": "string", "description": "Video resolution"},
                "motion_detector_version": {"type": "integer", "description": "Motion detector version (1 or 2)"},
            },
            "required": ["serial"],
        },
    },
]

# Video Settings Skills
VIDEO_SETTINGS_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_get_video_settings",
        "name": "Get Camera Video Settings",
        "description": "Get the video settings for a camera",
        "tags": ["meraki", "camera", "video", "settings"],
        "examples": [
            "Show video settings",
            "What's the camera configuration?",
            "Get camera video config",
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
        "id": "camera_update_video_settings",
        "name": "Update Camera Video Settings",
        "description": "Update the video settings for a camera",
        "tags": ["meraki", "camera", "video", "settings", "update"],
        "examples": [
            "Update video settings",
            "Enable external RTSP",
            "Configure video output",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "external_rtsp_enabled": {"type": "boolean", "description": "Enable external RTSP streaming"},
            },
            "required": ["serial"],
        },
    },
]

# Sense (Object Detection) Skills
SENSE_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_get_sense",
        "name": "Get Camera Sense Settings",
        "description": "Get the Sense (object detection) settings for a camera",
        "tags": ["meraki", "camera", "sense", "detection", "ai"],
        "examples": [
            "Show Sense settings",
            "Is object detection enabled?",
            "Get camera AI settings",
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
        "id": "camera_update_sense",
        "name": "Update Camera Sense Settings",
        "description": "Update the Sense (object detection) settings for a camera",
        "tags": ["meraki", "camera", "sense", "detection", "ai", "update"],
        "examples": [
            "Enable object detection",
            "Configure Sense settings",
            "Turn on people detection",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "sense_enabled": {"type": "boolean", "description": "Enable Sense"},
                "mqtt_broker_id": {"type": "string", "description": "MQTT broker ID"},
                "audio_detection": {"type": "object", "description": "Audio detection settings"},
                "detection_model_id": {"type": "string", "description": "Detection model ID"},
            },
            "required": ["serial"],
        },
    },
]

# Wireless Profiles Skills
WIRELESS_PROFILE_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_list_wireless_profiles",
        "name": "List Camera Wireless Profiles",
        "description": "List the wireless profiles for cameras in a network",
        "tags": ["meraki", "camera", "wireless", "profiles", "list"],
        "examples": [
            "Show camera wireless profiles",
            "List wireless configurations for cameras",
            "What WiFi profiles are available?",
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
        "id": "camera_create_wireless_profile",
        "name": "Create Camera Wireless Profile",
        "description": "Create a wireless profile for cameras in a network",
        "tags": ["meraki", "camera", "wireless", "profiles", "create"],
        "examples": [
            "Create camera wireless profile",
            "Add WiFi profile for cameras",
            "Set up camera wireless config",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "name": {"type": "string", "description": "Profile name"},
                "ssid": {
                    "type": "object",
                    "description": "SSID settings",
                    "properties": {
                        "name": {"type": "string"},
                        "auth_mode": {"type": "string"},
                        "encryption_mode": {"type": "string"},
                        "psk": {"type": "string"},
                    },
                },
                "identity": {
                    "type": "object",
                    "description": "Identity settings (for 802.1X)",
                    "properties": {
                        "username": {"type": "string"},
                        "password": {"type": "string"},
                    },
                },
            },
            "required": ["network_id", "name", "ssid"],
        },
    },
    {
        "id": "camera_get_wireless_profile",
        "name": "Get Camera Wireless Profile",
        "description": "Get a specific wireless profile for cameras",
        "tags": ["meraki", "camera", "wireless", "profiles", "get"],
        "examples": [
            "Get camera wireless profile details",
            "Show specific WiFi profile",
            "What's in this profile?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "wireless_profile_id": {"type": "string", "description": "Wireless profile ID"},
            },
            "required": ["network_id", "wireless_profile_id"],
        },
    },
    {
        "id": "camera_update_wireless_profile",
        "name": "Update Camera Wireless Profile",
        "description": "Update a wireless profile for cameras",
        "tags": ["meraki", "camera", "wireless", "profiles", "update"],
        "examples": [
            "Update camera wireless profile",
            "Change WiFi password for cameras",
            "Modify wireless profile",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "wireless_profile_id": {"type": "string", "description": "Wireless profile ID"},
                "name": {"type": "string", "description": "Profile name"},
                "ssid": {"type": "object", "description": "SSID settings"},
                "identity": {"type": "object", "description": "Identity settings"},
            },
            "required": ["network_id", "wireless_profile_id"],
        },
    },
    {
        "id": "camera_delete_wireless_profile",
        "name": "Delete Camera Wireless Profile",
        "description": "Delete a wireless profile for cameras",
        "tags": ["meraki", "camera", "wireless", "profiles", "delete"],
        "examples": [
            "Delete camera wireless profile",
            "Remove WiFi profile",
            "Delete this profile",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "wireless_profile_id": {"type": "string", "description": "Wireless profile ID"},
            },
            "required": ["network_id", "wireless_profile_id"],
        },
    },
    {
        "id": "camera_get_device_wireless_profiles",
        "name": "Get Device Wireless Profiles",
        "description": "Get the wireless profiles assigned to a camera",
        "tags": ["meraki", "camera", "wireless", "profiles", "device"],
        "examples": [
            "What wireless profile is assigned to this camera?",
            "Show camera's WiFi configuration",
            "Get device wireless profiles",
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
        "id": "camera_update_device_wireless_profiles",
        "name": "Update Device Wireless Profiles",
        "description": "Update the wireless profiles assigned to a camera",
        "tags": ["meraki", "camera", "wireless", "profiles", "device", "update"],
        "examples": [
            "Assign wireless profile to camera",
            "Change camera's WiFi profile",
            "Update device wireless assignment",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "ids": {
                    "type": "object",
                    "description": "Wireless profile IDs",
                    "properties": {
                        "primary": {"type": "string"},
                        "secondary": {"type": "string"},
                        "backup": {"type": "string"},
                    },
                },
            },
            "required": ["serial", "ids"],
        },
    },
]

# Snapshot and Video Link Skills
SNAPSHOT_VIDEO_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_generate_snapshot",
        "name": "Generate Camera Snapshot",
        "description": "Generate a snapshot from a camera",
        "tags": ["meraki", "camera", "snapshot", "image"],
        "examples": [
            "Take a snapshot",
            "Capture camera image",
            "Generate snapshot from camera",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "timestamp": {"type": "string", "description": "Timestamp for snapshot (ISO8601 or epoch)"},
                "fullframe": {"type": "boolean", "description": "Generate full resolution snapshot"},
            },
            "required": ["serial"],
        },
    },
    {
        "id": "camera_get_video_link",
        "name": "Get Camera Video Link",
        "description": "Get a link to view video from a camera",
        "tags": ["meraki", "camera", "video", "link", "stream"],
        "examples": [
            "Get video link",
            "How do I view this camera?",
            "Get camera stream URL",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "timestamp": {"type": "string", "description": "Timestamp for video (ISO8601 or epoch)"},
            },
            "required": ["serial"],
        },
    },
]

# Analytics Skills
ANALYTICS_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_get_analytics_zones",
        "name": "Get Camera Analytics Zones",
        "description": "Get the analytics zones for a camera",
        "tags": ["meraki", "camera", "analytics", "zones"],
        "examples": [
            "Show analytics zones",
            "What zones are configured?",
            "List camera zones",
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
        "id": "camera_get_analytics_zone_history",
        "name": "Get Analytics Zone History",
        "description": "Get historical analytics data for a zone",
        "tags": ["meraki", "camera", "analytics", "zones", "history"],
        "examples": [
            "Show zone history",
            "Get analytics history for this zone",
            "What was the foot traffic in this zone?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "zone_id": ZONE_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds"},
                "resolution": {"type": "integer", "description": "Sample resolution in seconds"},
                "object_type": {"type": "string", "description": "Object type: person or vehicle"},
            },
            "required": ["serial", "zone_id"],
        },
    },
    {
        "id": "camera_get_analytics_recent",
        "name": "Get Camera Analytics Recent",
        "description": "Get recent analytics data for a camera",
        "tags": ["meraki", "camera", "analytics", "recent"],
        "examples": [
            "Show recent analytics",
            "What's the current activity?",
            "Get recent camera data",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "object_type": {"type": "string", "description": "Object type: person or vehicle"},
            },
            "required": ["serial"],
        },
    },
    {
        "id": "camera_get_analytics_live",
        "name": "Get Camera Analytics Live",
        "description": "Get live analytics data for a camera",
        "tags": ["meraki", "camera", "analytics", "live", "realtime"],
        "examples": [
            "Show live analytics",
            "What's happening now?",
            "Get real-time camera data",
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
        "id": "camera_get_analytics_overview",
        "name": "Get Camera Analytics Overview",
        "description": "Get an overview of analytics data for a camera",
        "tags": ["meraki", "camera", "analytics", "overview", "summary"],
        "examples": [
            "Show analytics overview",
            "Summarize camera activity",
            "Get analytics summary",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds"},
                "object_type": {"type": "string", "description": "Object type: person or vehicle"},
            },
            "required": ["serial"],
        },
    },
]

# Custom Analytics Skills
CUSTOM_ANALYTICS_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_list_custom_analytics",
        "name": "List Custom Analytics Artifacts",
        "description": "List custom analytics artifacts for a camera",
        "tags": ["meraki", "camera", "custom-analytics", "artifacts"],
        "examples": [
            "Show custom analytics models",
            "List custom analytics artifacts",
            "What custom analytics are configured?",
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
        "id": "camera_create_custom_analytics",
        "name": "Create Custom Analytics Artifact",
        "description": "Create a custom analytics artifact for a camera",
        "tags": ["meraki", "camera", "custom-analytics", "artifacts", "create"],
        "examples": [
            "Add custom analytics model",
            "Create custom artifact",
            "Upload analytics artifact",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "name": {"type": "string", "description": "Artifact name"},
                "enabled": {"type": "boolean", "description": "Enable artifact"},
                "artifact_id": {"type": "string", "description": "Artifact ID from organization"},
                "parameters": {"type": "array", "items": {"type": "object"}, "description": "Artifact parameters"},
            },
            "required": ["serial", "artifact_id"],
        },
    },
    {
        "id": "camera_get_custom_analytics",
        "name": "Get Custom Analytics Artifact",
        "description": "Get a custom analytics artifact for a camera",
        "tags": ["meraki", "camera", "custom-analytics", "artifacts", "get"],
        "examples": [
            "Get custom analytics details",
            "Show artifact configuration",
            "What are the artifact settings?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "custom_analytics_artifact_id": {"type": "string", "description": "Custom analytics artifact ID"},
            },
            "required": ["serial", "custom_analytics_artifact_id"],
        },
    },
    {
        "id": "camera_update_custom_analytics",
        "name": "Update Custom Analytics Artifact",
        "description": "Update a custom analytics artifact for a camera",
        "tags": ["meraki", "camera", "custom-analytics", "artifacts", "update"],
        "examples": [
            "Update custom analytics",
            "Modify artifact settings",
            "Change analytics parameters",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "custom_analytics_artifact_id": {"type": "string", "description": "Custom analytics artifact ID"},
                "name": {"type": "string", "description": "Artifact name"},
                "enabled": {"type": "boolean", "description": "Enable artifact"},
                "parameters": {"type": "array", "items": {"type": "object"}, "description": "Artifact parameters"},
            },
            "required": ["serial", "custom_analytics_artifact_id"],
        },
    },
    {
        "id": "camera_delete_custom_analytics",
        "name": "Delete Custom Analytics Artifact",
        "description": "Delete a custom analytics artifact from a camera",
        "tags": ["meraki", "camera", "custom-analytics", "artifacts", "delete"],
        "examples": [
            "Delete custom analytics artifact",
            "Remove artifact",
            "Delete this artifact",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "custom_analytics_artifact_id": {"type": "string", "description": "Custom analytics artifact ID"},
            },
            "required": ["serial", "custom_analytics_artifact_id"],
        },
    },
]

# Boundaries Skills
BOUNDARIES_SKILLS: List[SkillDefinition] = [
    {
        "id": "camera_list_boundaries",
        "name": "List Camera Boundaries",
        "description": "List analytics boundaries for cameras in a network",
        "tags": ["meraki", "camera", "boundaries", "analytics"],
        "examples": [
            "Show camera boundaries",
            "List configured boundaries",
            "What boundaries are set up?",
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
        "id": "camera_get_boundaries_by_device",
        "name": "Get Camera Boundaries by Device",
        "description": "Get analytics boundaries for a specific camera",
        "tags": ["meraki", "camera", "boundaries", "device"],
        "examples": [
            "Show boundaries for this camera",
            "What boundaries are on this device?",
            "Get camera boundaries",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
            },
            "required": ["serial"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class CameraModule(MerakiSkillModule):
    """Camera skills module."""

    MODULE_NAME = "camera"
    MODULE_PREFIX = "camera_"

    # Combine all skill definitions
    ALL_SKILLS: List[SkillDefinition] = (
        QUALITY_RETENTION_SKILLS
        + VIDEO_SETTINGS_SKILLS
        + SENSE_SKILLS
        + WIRELESS_PROFILE_SKILLS
        + SNAPSHOT_VIDEO_SKILLS
        + ANALYTICS_SKILLS
        + CUSTOM_ANALYTICS_SKILLS
        + BOUNDARIES_SKILLS
    )

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all camera skills."""
        return [create_skill(skill_def) for skill_def in cls.ALL_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Execute a camera skill."""
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

        # Quality and Retention
        if skill_id == "camera_get_quality_retention":
            return await api_get(client, f"/devices/{serial}/camera/qualityAndRetention")

        if skill_id == "camera_update_quality_retention":
            body = {}
            for key, api_key in [("profile_id", "profileId"), ("motion_based_retention_enabled", "motionBasedRetentionEnabled"),
                                  ("audio_recording_enabled", "audioRecordingEnabled"),
                                  ("restricted_bandwidth_mode_enabled", "restrictedBandwidthModeEnabled"),
                                  ("quality", "quality"), ("resolution", "resolution"),
                                  ("motion_detector_version", "motionDetectorVersion")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/devices/{serial}/camera/qualityAndRetention", body)

        # Video Settings
        if skill_id == "camera_get_video_settings":
            return await api_get(client, f"/devices/{serial}/camera/video/settings")

        if skill_id == "camera_update_video_settings":
            body = {}
            if params.get("external_rtsp_enabled") is not None:
                body["externalRtspEnabled"] = params["external_rtsp_enabled"]
            return await api_put(client, f"/devices/{serial}/camera/video/settings", body)

        # Sense
        if skill_id == "camera_get_sense":
            return await api_get(client, f"/devices/{serial}/camera/sense")

        if skill_id == "camera_update_sense":
            body = {}
            for key, api_key in [("sense_enabled", "senseEnabled"), ("mqtt_broker_id", "mqttBrokerId"),
                                  ("audio_detection", "audioDetection"), ("detection_model_id", "detectionModelId")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/devices/{serial}/camera/sense", body)

        # Wireless Profiles
        if skill_id == "camera_list_wireless_profiles":
            return await api_get(client, f"/networks/{network_id}/camera/wirelessProfiles")

        if skill_id == "camera_create_wireless_profile":
            body = {
                "name": params.get("name"),
                "ssid": params.get("ssid"),
            }
            if params.get("identity"):
                body["identity"] = params["identity"]
            return await api_post(client, f"/networks/{network_id}/camera/wirelessProfiles", body)

        if skill_id == "camera_get_wireless_profile":
            profile_id = params.get("wireless_profile_id")
            return await api_get(client, f"/networks/{network_id}/camera/wirelessProfiles/{profile_id}")

        if skill_id == "camera_update_wireless_profile":
            profile_id = params.get("wireless_profile_id")
            body = {}
            for key in ["name", "ssid", "identity"]:
                if params.get(key) is not None:
                    body[key] = params[key]
            return await api_put(client, f"/networks/{network_id}/camera/wirelessProfiles/{profile_id}", body)

        if skill_id == "camera_delete_wireless_profile":
            profile_id = params.get("wireless_profile_id")
            return await api_delete(client, f"/networks/{network_id}/camera/wirelessProfiles/{profile_id}")

        if skill_id == "camera_get_device_wireless_profiles":
            return await api_get(client, f"/devices/{serial}/camera/wirelessProfiles")

        if skill_id == "camera_update_device_wireless_profiles":
            body = {"ids": params.get("ids")}
            return await api_put(client, f"/devices/{serial}/camera/wirelessProfiles", body)

        # Snapshot and Video Link
        if skill_id == "camera_generate_snapshot":
            body = {}
            if params.get("timestamp"):
                body["timestamp"] = params["timestamp"]
            if params.get("fullframe") is not None:
                body["fullframe"] = params["fullframe"]
            return await api_post(client, f"/devices/{serial}/camera/generateSnapshot", body)

        if skill_id == "camera_get_video_link":
            query_params = {}
            if params.get("timestamp"):
                query_params["timestamp"] = params["timestamp"]
            return await api_get(client, f"/devices/{serial}/camera/videoLink", query_params)

        # Analytics
        if skill_id == "camera_get_analytics_zones":
            return await api_get(client, f"/devices/{serial}/camera/analytics/zones")

        if skill_id == "camera_get_analytics_zone_history":
            zone_id = params.get("zone_id")
            query_params = {}
            for key in ["t0", "t1", "timespan", "resolution", "object_type"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/devices/{serial}/camera/analytics/zones/{zone_id}/history", query_params)

        if skill_id == "camera_get_analytics_recent":
            query_params = {}
            if params.get("object_type"):
                query_params["objectType"] = params["object_type"]
            return await api_get(client, f"/devices/{serial}/camera/analytics/recent", query_params)

        if skill_id == "camera_get_analytics_live":
            return await api_get(client, f"/devices/{serial}/camera/analytics/live")

        if skill_id == "camera_get_analytics_overview":
            query_params = {}
            for key in ["t0", "t1", "timespan", "object_type"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/devices/{serial}/camera/analytics/overview", query_params)

        # Custom Analytics
        if skill_id == "camera_list_custom_analytics":
            return await api_get(client, f"/devices/{serial}/camera/customAnalytics")

        if skill_id == "camera_create_custom_analytics":
            body = {"artifactId": params.get("artifact_id")}
            if params.get("name"):
                body["name"] = params["name"]
            if params.get("enabled") is not None:
                body["enabled"] = params["enabled"]
            if params.get("parameters"):
                body["parameters"] = params["parameters"]
            return await api_post(client, f"/devices/{serial}/camera/customAnalytics", body)

        if skill_id == "camera_get_custom_analytics":
            artifact_id = params.get("custom_analytics_artifact_id")
            return await api_get(client, f"/devices/{serial}/camera/customAnalytics/{artifact_id}")

        if skill_id == "camera_update_custom_analytics":
            artifact_id = params.get("custom_analytics_artifact_id")
            body = {}
            for key, api_key in [("name", "name"), ("enabled", "enabled"), ("parameters", "parameters")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/devices/{serial}/camera/customAnalytics/{artifact_id}", body)

        if skill_id == "camera_delete_custom_analytics":
            artifact_id = params.get("custom_analytics_artifact_id")
            return await api_delete(client, f"/devices/{serial}/camera/customAnalytics/{artifact_id}")

        # Boundaries
        if skill_id == "camera_list_boundaries":
            return await api_get(client, f"/networks/{network_id}/camera/boundaries/linesByDevice")

        if skill_id == "camera_get_boundaries_by_device":
            return await api_get(client, f"/devices/{serial}/camera/analytics/boundaries/lines")

        # Unknown skill
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    def _to_camel_case(cls, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])
