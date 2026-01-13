"""
Meraki Camera Tools

Auto-generated from archived A2A skills.
Total tools: 27
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_camera_get_quality_retention(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Quality and Retention."""
    try:
        # Build API path
        path = "/camera/get/quality/retention"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_update_quality_retention(params: Dict, context: Any) -> Dict:
    """Handler for Update Camera Quality and Retention."""
    try:
        # Build API path
        path = "/camera/update/quality/retention"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_video_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Video Settings."""
    try:
        # Build API path
        path = "/camera/get/video/settings"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_update_video_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update Camera Video Settings."""
    try:
        # Build API path
        path = "/camera/update/video/settings"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_sense(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Sense Settings."""
    try:
        # Build API path
        path = "/camera/get/sense"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_update_sense(params: Dict, context: Any) -> Dict:
    """Handler for Update Camera Sense Settings."""
    try:
        # Build API path
        path = "/camera/update/sense"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_list_wireless_profiles(params: Dict, context: Any) -> Dict:
    """Handler for List Camera Wireless Profiles."""
    try:
        # Build API path
        path = "/camera/list/wireless/profiles"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_create_wireless_profile(params: Dict, context: Any) -> Dict:
    """Handler for Create Camera Wireless Profile."""
    try:
        # Build API path
        path = "/camera/create/wireless/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_wireless_profile(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Wireless Profile."""
    try:
        # Build API path
        path = "/camera/get/wireless/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_update_wireless_profile(params: Dict, context: Any) -> Dict:
    """Handler for Update Camera Wireless Profile."""
    try:
        # Build API path
        path = "/camera/update/wireless/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_delete_wireless_profile(params: Dict, context: Any) -> Dict:
    """Handler for Delete Camera Wireless Profile."""
    try:
        # Build API path
        path = "/camera/delete/wireless/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_device_wireless_profiles(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Wireless Profiles."""
    try:
        # Build API path
        path = "/camera/get/device/wireless/profiles"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_update_device_wireless_profiles(params: Dict, context: Any) -> Dict:
    """Handler for Update Device Wireless Profiles."""
    try:
        # Build API path
        path = "/camera/update/device/wireless/profiles"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_generate_snapshot(params: Dict, context: Any) -> Dict:
    """Handler for Generate Camera Snapshot."""
    try:
        # Build API path
        path = "/camera/generate/snapshot"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_video_link(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Video Link."""
    try:
        # Build API path
        path = "/camera/get/video/link"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_analytics_zones(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Analytics Zones."""
    try:
        # Build API path
        path = "/camera/get/analytics/zones"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_analytics_zone_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Analytics Zone History."""
    try:
        # Build API path
        path = "/camera/get/analytics/zone/history"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_analytics_recent(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Analytics Recent."""
    try:
        # Build API path
        path = "/camera/get/analytics/recent"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_analytics_live(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Analytics Live."""
    try:
        # Build API path
        path = "/camera/get/analytics/live"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_analytics_overview(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Analytics Overview."""
    try:
        # Build API path
        path = "/camera/get/analytics/overview"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_list_custom_analytics(params: Dict, context: Any) -> Dict:
    """Handler for List Custom Analytics Artifacts."""
    try:
        # Build API path
        path = "/camera/list/custom/analytics"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_create_custom_analytics(params: Dict, context: Any) -> Dict:
    """Handler for Create Custom Analytics Artifact."""
    try:
        # Build API path
        path = "/camera/create/custom/analytics"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_custom_analytics(params: Dict, context: Any) -> Dict:
    """Handler for Get Custom Analytics Artifact."""
    try:
        # Build API path
        path = "/camera/get/custom/analytics"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_update_custom_analytics(params: Dict, context: Any) -> Dict:
    """Handler for Update Custom Analytics Artifact."""
    try:
        # Build API path
        path = "/camera/update/custom/analytics"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_delete_custom_analytics(params: Dict, context: Any) -> Dict:
    """Handler for Delete Custom Analytics Artifact."""
    try:
        # Build API path
        path = "/camera/delete/custom/analytics"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_list_boundaries(params: Dict, context: Any) -> Dict:
    """Handler for List Camera Boundaries."""
    try:
        # Build API path
        path = "/camera/list/boundaries"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_camera_get_boundaries_by_device(params: Dict, context: Any) -> Dict:
    """Handler for Get Camera Boundaries by Device."""
    try:
        # Build API path
        path = "/camera/get/boundaries/by/device"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_CAMERA_TOOLS = [
    create_tool(
        name="meraki_camera_get_quality_retention",
        description="""Get the quality and retention settings for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "quality", "retention", "video"],
        requires_write=False,
        handler=handle_camera_get_quality_retention,
    ),
    create_tool(
        name="meraki_camera_update_quality_retention",
        description="""Update the quality and retention settings for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "profile_id": {
                        "type": "string",
                        "description": "Quality profile ID"
            },
            "motion_based_retention_enabled": {
                        "type": "boolean",
                        "description": "Enable motion-based retention"
            },
            "audio_recording_enabled": {
                        "type": "boolean",
                        "description": "Enable audio recording"
            },
            "restricted_bandwidth_mode_enabled": {
                        "type": "boolean",
                        "description": "Enable restricted bandwidth mode"
            },
            "quality": {
                        "type": "string",
                        "description": "Video quality: Standard, High, Enhanced"
            },
            "resolution": {
                        "type": "string",
                        "description": "Video resolution"
            },
            "motion_detector_version": {
                        "type": "integer",
                        "description": "Motion detector version (1 or 2)"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "quality", "retention", "video", "update"],
        requires_write=True,
        handler=handle_camera_update_quality_retention,
    ),
    create_tool(
        name="meraki_camera_get_video_settings",
        description="""Get the video settings for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "video", "settings"],
        requires_write=False,
        handler=handle_camera_get_video_settings,
    ),
    create_tool(
        name="meraki_camera_update_video_settings",
        description="""Update the video settings for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "external_rtsp_enabled": {
                        "type": "boolean",
                        "description": "Enable external RTSP streaming"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "video", "settings", "update"],
        requires_write=True,
        handler=handle_camera_update_video_settings,
    ),
    create_tool(
        name="meraki_camera_get_sense",
        description="""Get the Sense (object detection) settings for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "sense", "detection", "ai"],
        requires_write=False,
        handler=handle_camera_get_sense,
    ),
    create_tool(
        name="meraki_camera_update_sense",
        description="""Update the Sense (object detection) settings for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "sense_enabled": {
                        "type": "boolean",
                        "description": "Enable Sense"
            },
            "mqtt_broker_id": {
                        "type": "string",
                        "description": "MQTT broker ID"
            },
            "audio_detection": {
                        "type": "object",
                        "description": "Audio detection settings"
            },
            "detection_model_id": {
                        "type": "string",
                        "description": "Detection model ID"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "sense", "detection", "ai", "update"],
        requires_write=True,
        handler=handle_camera_update_sense,
    ),
    create_tool(
        name="meraki_camera_list_wireless_profiles",
        description="""List the wireless profiles for cameras in a network""",
        platform="meraki",
        category="camera",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["meraki", "camera", "wireless", "profiles", "list"],
        requires_write=False,
        handler=handle_camera_list_wireless_profiles,
    ),
    create_tool(
        name="meraki_camera_create_wireless_profile",
        description="""Create a wireless profile for cameras in a network""",
        platform="meraki",
        category="camera",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "name": {
                        "type": "string",
                        "description": "Profile name"
            },
            "ssid": {
                        "type": "string"
            },
            "identity": {
                        "type": "string"
            }
},
        required=["network_id", "name", "ssid"],
        tags=["meraki", "camera", "wireless", "profiles", "create"],
        requires_write=True,
        handler=handle_camera_create_wireless_profile,
    ),
    create_tool(
        name="meraki_camera_get_wireless_profile",
        description="""Get a specific wireless profile for cameras""",
        platform="meraki",
        category="camera",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "wireless_profile_id": {
                        "type": "string",
                        "description": "Wireless profile ID"
            }
},
        required=["network_id", "wireless_profile_id"],
        tags=["meraki", "camera", "wireless", "profiles", "get"],
        requires_write=False,
        handler=handle_camera_get_wireless_profile,
    ),
    create_tool(
        name="meraki_camera_update_wireless_profile",
        description="""Update a wireless profile for cameras""",
        platform="meraki",
        category="camera",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "wireless_profile_id": {
                        "type": "string",
                        "description": "Wireless profile ID"
            },
            "name": {
                        "type": "string",
                        "description": "Profile name"
            },
            "ssid": {
                        "type": "object",
                        "description": "SSID settings"
            },
            "identity": {
                        "type": "object",
                        "description": "Identity settings"
            }
},
        required=["network_id", "wireless_profile_id"],
        tags=["meraki", "camera", "wireless", "profiles", "update"],
        requires_write=True,
        handler=handle_camera_update_wireless_profile,
    ),
    create_tool(
        name="meraki_camera_delete_wireless_profile",
        description="""Delete a wireless profile for cameras""",
        platform="meraki",
        category="camera",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "wireless_profile_id": {
                        "type": "string",
                        "description": "Wireless profile ID"
            }
},
        required=["network_id", "wireless_profile_id"],
        tags=["meraki", "camera", "wireless", "profiles", "delete"],
        requires_write=True,
        handler=handle_camera_delete_wireless_profile,
    ),
    create_tool(
        name="meraki_camera_get_device_wireless_profiles",
        description="""Get the wireless profiles assigned to a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "wireless", "profiles", "device"],
        requires_write=False,
        handler=handle_camera_get_device_wireless_profiles,
    ),
    create_tool(
        name="meraki_camera_update_device_wireless_profiles",
        description="""Update the wireless profiles assigned to a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "ids": {
                        "type": "string"
            }
},
        required=["serial", "ids"],
        tags=["meraki", "camera", "wireless", "profiles", "device", "update"],
        requires_write=True,
        handler=handle_camera_update_device_wireless_profiles,
    ),
    create_tool(
        name="meraki_camera_generate_snapshot",
        description="""Generate a snapshot from a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp for snapshot (ISO8601 or epoch)"
            },
            "fullframe": {
                        "type": "boolean",
                        "description": "Generate full resolution snapshot"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "snapshot", "image"],
        requires_write=False,
        handler=handle_camera_generate_snapshot,
    ),
    create_tool(
        name="meraki_camera_get_video_link",
        description="""Get a link to view video from a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "timestamp": {
                        "type": "string",
                        "description": "Timestamp for video (ISO8601 or epoch)"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "video", "link", "stream"],
        requires_write=False,
        handler=handle_camera_get_video_link,
    ),
    create_tool(
        name="meraki_camera_get_analytics_zones",
        description="""Get the analytics zones for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "analytics", "zones"],
        requires_write=False,
        handler=handle_camera_get_analytics_zones,
    ),
    create_tool(
        name="meraki_camera_get_analytics_zone_history",
        description="""Get historical analytics data for a zone""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "zone_id": {
                        "type": "string",
                        "description": "Zone Id"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            },
            "resolution": {
                        "type": "integer",
                        "description": "Sample resolution in seconds"
            },
            "object_type": {
                        "type": "string",
                        "description": "Object type: person or vehicle"
            }
},
        required=["serial", "zone_id"],
        tags=["meraki", "camera", "analytics", "zones", "history"],
        requires_write=False,
        handler=handle_camera_get_analytics_zone_history,
    ),
    create_tool(
        name="meraki_camera_get_analytics_recent",
        description="""Get recent analytics data for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "object_type": {
                        "type": "string",
                        "description": "Object type: person or vehicle"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "analytics", "recent"],
        requires_write=False,
        handler=handle_camera_get_analytics_recent,
    ),
    create_tool(
        name="meraki_camera_get_analytics_live",
        description="""Get live analytics data for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "analytics", "live", "realtime"],
        requires_write=False,
        handler=handle_camera_get_analytics_live,
    ),
    create_tool(
        name="meraki_camera_get_analytics_overview",
        description="""Get an overview of analytics data for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            },
            "object_type": {
                        "type": "string",
                        "description": "Object type: person or vehicle"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "analytics", "overview", "summary"],
        requires_write=False,
        handler=handle_camera_get_analytics_overview,
    ),
    create_tool(
        name="meraki_camera_list_custom_analytics",
        description="""List custom analytics artifacts for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "custom-analytics", "artifacts"],
        requires_write=False,
        handler=handle_camera_list_custom_analytics,
    ),
    create_tool(
        name="meraki_camera_create_custom_analytics",
        description="""Create a custom analytics artifact for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "name": {
                        "type": "string",
                        "description": "Artifact name"
            },
            "enabled": {
                        "type": "boolean",
                        "description": "Enable artifact"
            },
            "artifact_id": {
                        "type": "string",
                        "description": "Artifact ID from organization"
            },
            "parameters": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        },
                        "description": "Artifact parameters"
            }
},
        required=["serial", "artifact_id"],
        tags=["meraki", "camera", "custom-analytics", "artifacts", "create"],
        requires_write=True,
        handler=handle_camera_create_custom_analytics,
    ),
    create_tool(
        name="meraki_camera_get_custom_analytics",
        description="""Get a custom analytics artifact for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "custom_analytics_artifact_id": {
                        "type": "string",
                        "description": "Custom analytics artifact ID"
            }
},
        required=["serial", "custom_analytics_artifact_id"],
        tags=["meraki", "camera", "custom-analytics", "artifacts", "get"],
        requires_write=False,
        handler=handle_camera_get_custom_analytics,
    ),
    create_tool(
        name="meraki_camera_update_custom_analytics",
        description="""Update a custom analytics artifact for a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "custom_analytics_artifact_id": {
                        "type": "string",
                        "description": "Custom analytics artifact ID"
            },
            "name": {
                        "type": "string",
                        "description": "Artifact name"
            },
            "enabled": {
                        "type": "boolean",
                        "description": "Enable artifact"
            },
            "parameters": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        },
                        "description": "Artifact parameters"
            }
},
        required=["serial", "custom_analytics_artifact_id"],
        tags=["meraki", "camera", "custom-analytics", "artifacts", "update"],
        requires_write=True,
        handler=handle_camera_update_custom_analytics,
    ),
    create_tool(
        name="meraki_camera_delete_custom_analytics",
        description="""Delete a custom analytics artifact from a camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "custom_analytics_artifact_id": {
                        "type": "string",
                        "description": "Custom analytics artifact ID"
            }
},
        required=["serial", "custom_analytics_artifact_id"],
        tags=["meraki", "camera", "custom-analytics", "artifacts", "delete"],
        requires_write=True,
        handler=handle_camera_delete_custom_analytics,
    ),
    create_tool(
        name="meraki_camera_list_boundaries",
        description="""List analytics boundaries for cameras in a network""",
        platform="meraki",
        category="camera",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["meraki", "camera", "boundaries", "analytics"],
        requires_write=False,
        handler=handle_camera_list_boundaries,
    ),
    create_tool(
        name="meraki_camera_get_boundaries_by_device",
        description="""Get analytics boundaries for a specific camera""",
        platform="meraki",
        category="camera",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "camera", "boundaries", "device"],
        requires_write=False,
        handler=handle_camera_get_boundaries_by_device,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_camera_tools():
    """Register all camera tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_CAMERA_TOOLS)
    logger.info(f"Registered {len(MERAKI_CAMERA_TOOLS)} meraki camera tools")


# Auto-register on import
register_camera_tools()
