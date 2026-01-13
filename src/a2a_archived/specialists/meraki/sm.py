"""
Meraki Systems Manager (SM) skill module.

This module provides skills for mobile device management (MDM) including:
- Devices (list, get, lock, wipe, move, modify tags)
- Users
- Profiles
- Target Groups
- Apps
- Device Connectivity
- Desktop Logs
- Performance History
- Network Adapters
- Security Centers
- Restrictions
- Software
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
    log_skill_start,
    log_skill_success,
    log_skill_error,
    NETWORK_ID_SCHEMA,
)

# Common schemas
SM_DEVICE_ID_SCHEMA = {
    "type": "string",
    "description": "Systems Manager device ID"
}

USER_ID_SCHEMA = {
    "type": "string",
    "description": "User ID"
}

PROFILE_ID_SCHEMA = {
    "type": "string",
    "description": "Profile ID"
}

TARGET_GROUP_ID_SCHEMA = {
    "type": "string",
    "description": "Target group ID"
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

# Device Skills
DEVICE_SKILLS: List[SkillDefinition] = [
    {
        "id": "sm_list_devices",
        "name": "List SM Devices",
        "description": "List the devices enrolled in Systems Manager for a network",
        "tags": ["meraki", "sm", "devices", "mdm", "list"],
        "examples": [
            "Show enrolled devices",
            "List SM devices",
            "What devices are managed?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "fields": {"type": "array", "items": {"type": "string"}, "description": "Fields to include"},
                "wifi_macs": {"type": "array", "items": {"type": "string"}, "description": "Filter by WiFi MACs"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Filter by serials"},
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by device IDs"},
                "scope": {"type": "array", "items": {"type": "string"}, "description": "Filter by scope"},
                "batch_token": {"type": "string", "description": "Batch token for pagination"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sm_get_device_desktop_logs",
        "name": "Get SM Device Desktop Logs",
        "description": "Get the desktop log entries for a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "logs", "desktop"],
        "examples": [
            "Show device logs",
            "Get desktop logs",
            "What happened on this device?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_command_logs",
        "name": "Get SM Device Command Logs",
        "description": "Get the command log entries for a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "logs", "commands"],
        "examples": [
            "Show command logs",
            "What commands were sent to this device?",
            "Get device command history",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_profiles",
        "name": "Get SM Device Profiles",
        "description": "Get the profiles installed on a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "profiles"],
        "examples": [
            "Show device profiles",
            "What profiles are installed?",
            "List device configurations",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_restrictions",
        "name": "Get SM Device Restrictions",
        "description": "Get the restrictions for a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "restrictions"],
        "examples": [
            "Show device restrictions",
            "What restrictions are applied?",
            "Get device policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_software",
        "name": "Get SM Device Software",
        "description": "Get the software installed on a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "software", "apps"],
        "examples": [
            "Show installed software",
            "What apps are on this device?",
            "List device applications",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_security_centers",
        "name": "Get SM Device Security Centers",
        "description": "Get the security center settings for a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "security"],
        "examples": [
            "Show security center info",
            "What's the device security status?",
            "Get security settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_network_adapters",
        "name": "Get SM Device Network Adapters",
        "description": "Get the network adapters for a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "network", "adapters"],
        "examples": [
            "Show network adapters",
            "What NICs does this device have?",
            "Get device network info",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_wlan_lists",
        "name": "Get SM Device WLAN Lists",
        "description": "Get the WLANs seen by a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "wlan", "wifi"],
        "examples": [
            "Show WiFi networks seen",
            "What WLANs does this device see?",
            "Get wireless networks",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_connectivity",
        "name": "Get SM Device Connectivity",
        "description": "Get the connectivity history for a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "connectivity", "history"],
        "examples": [
            "Show connectivity history",
            "When was this device online?",
            "Get connection status",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_get_device_performance_history",
        "name": "Get SM Device Performance History",
        "description": "Get the performance history for a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "performance", "history"],
        "examples": [
            "Show performance history",
            "How has this device been performing?",
            "Get CPU/memory usage",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["network_id", "device_id"],
        },
    },
]

# Device Actions Skills
DEVICE_ACTION_SKILLS: List[SkillDefinition] = [
    {
        "id": "sm_lock_devices",
        "name": "Lock SM Devices",
        "description": "Lock devices enrolled in Systems Manager",
        "tags": ["meraki", "sm", "devices", "lock", "action"],
        "examples": [
            "Lock this device",
            "Lock the phone",
            "Secure the device",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "wifi_macs": {"type": "array", "items": {"type": "string"}, "description": "WiFi MACs of devices to lock"},
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Device IDs to lock"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Serials to lock"},
                "scope": {"type": "array", "items": {"type": "string"}, "description": "Scope of devices to lock"},
                "pin": {"type": "integer", "description": "PIN for unlocking (Android)"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sm_wipe_devices",
        "name": "Wipe SM Devices",
        "description": "Wipe devices enrolled in Systems Manager",
        "tags": ["meraki", "sm", "devices", "wipe", "action"],
        "examples": [
            "Wipe this device",
            "Factory reset the device",
            "Erase device data",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "wifi_macs": {"type": "array", "items": {"type": "string"}, "description": "WiFi MACs of devices to wipe"},
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Device IDs to wipe"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Serials to wipe"},
                "scope": {"type": "array", "items": {"type": "string"}, "description": "Scope of devices to wipe"},
                "pin": {"type": "integer", "description": "PIN for confirmation"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sm_move_devices",
        "name": "Move SM Devices",
        "description": "Move devices to a different network in Systems Manager",
        "tags": ["meraki", "sm", "devices", "move", "action"],
        "examples": [
            "Move device to another network",
            "Transfer this device",
            "Reassign device network",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "new_network": {"type": "string", "description": "Destination network ID"},
                "wifi_macs": {"type": "array", "items": {"type": "string"}, "description": "WiFi MACs to move"},
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Device IDs to move"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Serials to move"},
                "scope": {"type": "array", "items": {"type": "string"}, "description": "Scope of devices to move"},
            },
            "required": ["network_id", "new_network"],
        },
    },
    {
        "id": "sm_unenroll_device",
        "name": "Unenroll SM Device",
        "description": "Unenroll a device from Systems Manager",
        "tags": ["meraki", "sm", "devices", "unenroll", "action"],
        "examples": [
            "Unenroll this device",
            "Remove device from MDM",
            "Unenroll the phone",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
    {
        "id": "sm_modify_device_tags",
        "name": "Modify SM Device Tags",
        "description": "Modify tags on devices in Systems Manager",
        "tags": ["meraki", "sm", "devices", "tags", "modify"],
        "examples": [
            "Add tag to device",
            "Update device tags",
            "Tag this device",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags to add"},
                "update_action": {"type": "string", "description": "Action: add, delete, or update"},
                "wifi_macs": {"type": "array", "items": {"type": "string"}, "description": "WiFi MACs"},
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Device IDs"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Serials"},
                "scope": {"type": "array", "items": {"type": "string"}, "description": "Scope"},
            },
            "required": ["network_id", "tags", "update_action"],
        },
    },
    {
        "id": "sm_checkin_devices",
        "name": "Check In SM Devices",
        "description": "Force devices to check in with Systems Manager",
        "tags": ["meraki", "sm", "devices", "checkin", "action"],
        "examples": [
            "Force device check-in",
            "Refresh device status",
            "Make device sync",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "wifi_macs": {"type": "array", "items": {"type": "string"}, "description": "WiFi MACs"},
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Device IDs"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Serials"},
                "scope": {"type": "array", "items": {"type": "string"}, "description": "Scope"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sm_refresh_device_details",
        "name": "Refresh SM Device Details",
        "description": "Refresh the details of a Systems Manager device",
        "tags": ["meraki", "sm", "devices", "refresh", "action"],
        "examples": [
            "Refresh device details",
            "Update device info",
            "Sync device data",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "device_id": SM_DEVICE_ID_SCHEMA,
            },
            "required": ["network_id", "device_id"],
        },
    },
]

# User Skills
USER_SKILLS: List[SkillDefinition] = [
    {
        "id": "sm_list_users",
        "name": "List SM Users",
        "description": "List the users in Systems Manager for a network",
        "tags": ["meraki", "sm", "users", "list"],
        "examples": [
            "Show SM users",
            "List managed users",
            "Who are the SM users?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by user IDs"},
                "usernames": {"type": "array", "items": {"type": "string"}, "description": "Filter by usernames"},
                "emails": {"type": "array", "items": {"type": "string"}, "description": "Filter by emails"},
                "scope": {"type": "array", "items": {"type": "string"}, "description": "Filter by scope"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sm_get_user_device_profiles",
        "name": "Get SM User Device Profiles",
        "description": "Get the device profiles for a Systems Manager user",
        "tags": ["meraki", "sm", "users", "profiles"],
        "examples": [
            "Show user's device profiles",
            "What profiles does this user have?",
            "Get user device configs",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "user_id": USER_ID_SCHEMA,
            },
            "required": ["network_id", "user_id"],
        },
    },
    {
        "id": "sm_get_user_softwares",
        "name": "Get SM User Softwares",
        "description": "Get the software for a Systems Manager user",
        "tags": ["meraki", "sm", "users", "software"],
        "examples": [
            "Show user's software",
            "What software does this user have?",
            "Get user applications",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "user_id": USER_ID_SCHEMA,
            },
            "required": ["network_id", "user_id"],
        },
    },
]

# Profile Skills
PROFILE_SKILLS: List[SkillDefinition] = [
    {
        "id": "sm_list_profiles",
        "name": "List SM Profiles",
        "description": "List the profiles in Systems Manager for a network",
        "tags": ["meraki", "sm", "profiles", "list"],
        "examples": [
            "Show SM profiles",
            "List configuration profiles",
            "What profiles exist?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
]

# Target Group Skills
TARGET_GROUP_SKILLS: List[SkillDefinition] = [
    {
        "id": "sm_list_target_groups",
        "name": "List SM Target Groups",
        "description": "List the target groups in Systems Manager for a network",
        "tags": ["meraki", "sm", "target-groups", "list"],
        "examples": [
            "Show target groups",
            "List device groups",
            "What target groups exist?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "with_details": {"type": "boolean", "description": "Include detailed scope"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sm_create_target_group",
        "name": "Create SM Target Group",
        "description": "Create a target group in Systems Manager",
        "tags": ["meraki", "sm", "target-groups", "create"],
        "examples": [
            "Create target group",
            "Add device group",
            "Set up new target group",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "name": {"type": "string", "description": "Group name"},
                "scope": {"type": "string", "description": "Scope (device tags/serials/ids)"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "sm_get_target_group",
        "name": "Get SM Target Group",
        "description": "Get a specific target group",
        "tags": ["meraki", "sm", "target-groups", "get"],
        "examples": [
            "Get target group details",
            "Show this group",
            "What's in this target group?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "target_group_id": TARGET_GROUP_ID_SCHEMA,
                "with_details": {"type": "boolean", "description": "Include detailed scope"},
            },
            "required": ["network_id", "target_group_id"],
        },
    },
    {
        "id": "sm_update_target_group",
        "name": "Update SM Target Group",
        "description": "Update a target group in Systems Manager",
        "tags": ["meraki", "sm", "target-groups", "update"],
        "examples": [
            "Update target group",
            "Change group scope",
            "Modify device group",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "target_group_id": TARGET_GROUP_ID_SCHEMA,
                "name": {"type": "string", "description": "Group name"},
                "scope": {"type": "string", "description": "Scope"},
            },
            "required": ["network_id", "target_group_id"],
        },
    },
    {
        "id": "sm_delete_target_group",
        "name": "Delete SM Target Group",
        "description": "Delete a target group from Systems Manager",
        "tags": ["meraki", "sm", "target-groups", "delete"],
        "examples": [
            "Delete target group",
            "Remove device group",
            "Delete this group",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "target_group_id": TARGET_GROUP_ID_SCHEMA,
            },
            "required": ["network_id", "target_group_id"],
        },
    },
]

# Bypass Activation Lock Skills
BYPASS_LOCK_SKILLS: List[SkillDefinition] = [
    {
        "id": "sm_get_bypass_activation_lock_attempts",
        "name": "Get Bypass Activation Lock Attempts",
        "description": "Get the bypass activation lock attempts for a network",
        "tags": ["meraki", "sm", "bypass", "activation-lock"],
        "examples": [
            "Show bypass attempts",
            "Get activation lock bypasses",
            "What bypass attempts are there?",
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
        "id": "sm_create_bypass_activation_lock_attempt",
        "name": "Create Bypass Activation Lock Attempt",
        "description": "Attempt to bypass activation lock on devices",
        "tags": ["meraki", "sm", "bypass", "activation-lock", "action"],
        "examples": [
            "Bypass activation lock",
            "Unlock this device",
            "Remove activation lock",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Device IDs to bypass"},
            },
            "required": ["network_id", "ids"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class SMModule(MerakiSkillModule):
    """Systems Manager skills module."""

    MODULE_NAME = "sm"
    MODULE_PREFIX = "sm_"

    # Combine all skill definitions
    ALL_SKILLS: List[SkillDefinition] = (
        DEVICE_SKILLS
        + DEVICE_ACTION_SKILLS
        + USER_SKILLS
        + PROFILE_SKILLS
        + TARGET_GROUP_SKILLS
        + BYPASS_LOCK_SKILLS
    )

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all SM skills."""
        return [create_skill(skill_def) for skill_def in cls.ALL_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Execute an SM skill."""
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

        # Device listing and info
        if skill_id == "sm_list_devices":
            query_params = {}
            for key in ["per_page", "fields", "wifi_macs", "serials", "ids", "scope", "batch_token"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/networks/{network_id}/sm/devices", query_params)

        if skill_id == "sm_get_device_desktop_logs":
            device_id = params.get("device_id")
            query_params = {}
            if params.get("per_page"):
                query_params["perPage"] = params["per_page"]
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/desktopLogs", query_params)

        if skill_id == "sm_get_device_command_logs":
            device_id = params.get("device_id")
            query_params = {}
            if params.get("per_page"):
                query_params["perPage"] = params["per_page"]
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/deviceCommandLogs", query_params)

        if skill_id == "sm_get_device_profiles":
            device_id = params.get("device_id")
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/deviceProfiles")

        if skill_id == "sm_get_device_restrictions":
            device_id = params.get("device_id")
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/restrictions")

        if skill_id == "sm_get_device_software":
            device_id = params.get("device_id")
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/softwares")

        if skill_id == "sm_get_device_security_centers":
            device_id = params.get("device_id")
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/securityCenters")

        if skill_id == "sm_get_device_network_adapters":
            device_id = params.get("device_id")
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/networkAdapters")

        if skill_id == "sm_get_device_wlan_lists":
            device_id = params.get("device_id")
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/wlanLists")

        if skill_id == "sm_get_device_connectivity":
            device_id = params.get("device_id")
            query_params = {}
            if params.get("per_page"):
                query_params["perPage"] = params["per_page"]
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/connectivity", query_params)

        if skill_id == "sm_get_device_performance_history":
            device_id = params.get("device_id")
            query_params = {}
            if params.get("per_page"):
                query_params["perPage"] = params["per_page"]
            return await api_get(client, f"/networks/{network_id}/sm/devices/{device_id}/performanceHistory", query_params)

        # Device actions
        if skill_id == "sm_lock_devices":
            body = {}
            for key in ["wifi_macs", "ids", "serials", "scope", "pin"]:
                if params.get(key) is not None:
                    body[cls._to_camel_case(key)] = params[key]
            return await api_post(client, f"/networks/{network_id}/sm/devices/lock", body)

        if skill_id == "sm_wipe_devices":
            body = {}
            for key in ["wifi_macs", "ids", "serials", "scope", "pin"]:
                if params.get(key) is not None:
                    body[cls._to_camel_case(key)] = params[key]
            return await api_post(client, f"/networks/{network_id}/sm/devices/wipe", body)

        if skill_id == "sm_move_devices":
            body = {"newNetwork": params.get("new_network")}
            for key in ["wifi_macs", "ids", "serials", "scope"]:
                if params.get(key) is not None:
                    body[cls._to_camel_case(key)] = params[key]
            return await api_post(client, f"/networks/{network_id}/sm/devices/move", body)

        if skill_id == "sm_unenroll_device":
            device_id = params.get("device_id")
            return await api_post(client, f"/networks/{network_id}/sm/devices/{device_id}/unenroll", {})

        if skill_id == "sm_modify_device_tags":
            body = {
                "tags": params.get("tags", []),
                "updateAction": params.get("update_action"),
            }
            for key in ["wifi_macs", "ids", "serials", "scope"]:
                if params.get(key) is not None:
                    body[cls._to_camel_case(key)] = params[key]
            return await api_post(client, f"/networks/{network_id}/sm/devices/modifyTags", body)

        if skill_id == "sm_checkin_devices":
            body = {}
            for key in ["wifi_macs", "ids", "serials", "scope"]:
                if params.get(key) is not None:
                    body[cls._to_camel_case(key)] = params[key]
            return await api_post(client, f"/networks/{network_id}/sm/devices/checkin", body)

        if skill_id == "sm_refresh_device_details":
            device_id = params.get("device_id")
            return await api_post(client, f"/networks/{network_id}/sm/devices/{device_id}/refreshDetails", {})

        # Users
        if skill_id == "sm_list_users":
            query_params = {}
            for key in ["per_page", "ids", "usernames", "emails", "scope"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/networks/{network_id}/sm/users", query_params)

        if skill_id == "sm_get_user_device_profiles":
            user_id = params.get("user_id")
            return await api_get(client, f"/networks/{network_id}/sm/users/{user_id}/deviceProfiles")

        if skill_id == "sm_get_user_softwares":
            user_id = params.get("user_id")
            return await api_get(client, f"/networks/{network_id}/sm/users/{user_id}/softwares")

        # Profiles
        if skill_id == "sm_list_profiles":
            return await api_get(client, f"/networks/{network_id}/sm/profiles")

        # Target Groups
        if skill_id == "sm_list_target_groups":
            query_params = {}
            if params.get("with_details"):
                query_params["withDetails"] = params["with_details"]
            return await api_get(client, f"/networks/{network_id}/sm/targetGroups", query_params)

        if skill_id == "sm_create_target_group":
            body = {}
            if params.get("name"):
                body["name"] = params["name"]
            if params.get("scope"):
                body["scope"] = params["scope"]
            return await api_post(client, f"/networks/{network_id}/sm/targetGroups", body)

        if skill_id == "sm_get_target_group":
            group_id = params.get("target_group_id")
            query_params = {}
            if params.get("with_details"):
                query_params["withDetails"] = params["with_details"]
            return await api_get(client, f"/networks/{network_id}/sm/targetGroups/{group_id}", query_params)

        if skill_id == "sm_update_target_group":
            group_id = params.get("target_group_id")
            body = {}
            if params.get("name"):
                body["name"] = params["name"]
            if params.get("scope"):
                body["scope"] = params["scope"]
            return await api_put(client, f"/networks/{network_id}/sm/targetGroups/{group_id}", body)

        if skill_id == "sm_delete_target_group":
            group_id = params.get("target_group_id")
            return await api_delete(client, f"/networks/{network_id}/sm/targetGroups/{group_id}")

        # Bypass Activation Lock
        if skill_id == "sm_get_bypass_activation_lock_attempts":
            return await api_get(client, f"/networks/{network_id}/sm/bypassActivationLockAttempts")

        if skill_id == "sm_create_bypass_activation_lock_attempt":
            body = {"ids": params.get("ids", [])}
            return await api_post(client, f"/networks/{network_id}/sm/bypassActivationLockAttempts", body)

        # Unknown skill
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    def _to_camel_case(cls, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])
