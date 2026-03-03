"""
Meraki Sm Tools

Auto-generated from archived A2A skills.
Total tools: 29
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)


def _validate_context(context: Any) -> Dict:
    """Validate that context has a Meraki client configured."""
    if not hasattr(context, 'client') or context.client is None:
        return {
            "success": False,
            "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
        }
    return None


# =============================================================================
# HANDLERS
# =============================================================================

async def handle_sm_list_devices(params: Dict, context: Any) -> Dict:
    """Handler for List SM Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/list/devices"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_desktop_logs(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Desktop Logs."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/desktop/logs"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_command_logs(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Command Logs."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/command/logs"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_profiles(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Profiles."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/profiles"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_restrictions(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Restrictions."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/restrictions"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_software(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Software."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/software"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_security_centers(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Security Centers."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/security/centers"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_network_adapters(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Network Adapters."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/network/adapters"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_wlan_lists(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device WLAN Lists."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/wlan/lists"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_connectivity(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Connectivity."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/connectivity"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_device_performance_history(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Device Performance History."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/device/performance/history"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_lock_devices(params: Dict, context: Any) -> Dict:
    """Handler for Lock SM Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/lock/devices"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_wipe_devices(params: Dict, context: Any) -> Dict:
    """Handler for Wipe SM Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/wipe/devices"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_move_devices(params: Dict, context: Any) -> Dict:
    """Handler for Move SM Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/move/devices"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_unenroll_device(params: Dict, context: Any) -> Dict:
    """Handler for Unenroll SM Device."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/unenroll/device"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_modify_device_tags(params: Dict, context: Any) -> Dict:
    """Handler for Modify SM Device Tags."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/modify/device/tags"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_checkin_devices(params: Dict, context: Any) -> Dict:
    """Handler for Check In SM Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/checkin/devices"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_refresh_device_details(params: Dict, context: Any) -> Dict:
    """Handler for Refresh SM Device Details."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/refresh/device/details"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_list_users(params: Dict, context: Any) -> Dict:
    """Handler for List SM Users."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/list/users"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_user_device_profiles(params: Dict, context: Any) -> Dict:
    """Handler for Get SM User Device Profiles."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/user/device/profiles"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_user_softwares(params: Dict, context: Any) -> Dict:
    """Handler for Get SM User Softwares."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/user/softwares"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_list_profiles(params: Dict, context: Any) -> Dict:
    """Handler for List SM Profiles."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/list/profiles"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_list_target_groups(params: Dict, context: Any) -> Dict:
    """Handler for List SM Target Groups."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/list/target/groups"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_create_target_group(params: Dict, context: Any) -> Dict:
    """Handler for Create SM Target Group."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/create/target/group"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_target_group(params: Dict, context: Any) -> Dict:
    """Handler for Get SM Target Group."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/target/group"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_update_target_group(params: Dict, context: Any) -> Dict:
    """Handler for Update SM Target Group."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/update/target/group"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_delete_target_group(params: Dict, context: Any) -> Dict:
    """Handler for Delete SM Target Group."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/delete/target/group"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_get_bypass_activation_lock_attempts(params: Dict, context: Any) -> Dict:
    """Handler for Get Bypass Activation Lock Attempts."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/get/bypass/activation/lock/attempts"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sm_create_bypass_activation_lock_attempt(params: Dict, context: Any) -> Dict:
    """Handler for Create Bypass Activation Lock Attempt."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/sm/create/bypass/activation/lock/attempt"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_SM_TOOLS = [
    create_tool(
        name="meraki_sm_list_devices",
        description="""List the devices enrolled in Systems Manager for a network""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            },
            "fields": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Fields to include"
            },
            "wifi_macs": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by WiFi MACs"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by serials"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by device IDs"
            },
            "scope": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by scope"
            },
            "batch_token": {
                        "type": "string",
                        "description": "Batch token for pagination"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "devices", "mdm", "list"],
        requires_write=False,
        handler=handle_sm_list_devices,
    ),
    create_tool(
        name="meraki_sm_get_device_desktop_logs",
        description="""Get the desktop log entries for a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "logs", "desktop"],
        requires_write=False,
        handler=handle_sm_get_device_desktop_logs,
    ),
    create_tool(
        name="meraki_sm_get_device_command_logs",
        description="""Get the command log entries for a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "logs", "commands"],
        requires_write=False,
        handler=handle_sm_get_device_command_logs,
    ),
    create_tool(
        name="meraki_sm_get_device_profiles",
        description="""Get the profiles installed on a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "profiles"],
        requires_write=False,
        handler=handle_sm_get_device_profiles,
    ),
    create_tool(
        name="meraki_sm_get_device_restrictions",
        description="""Get the restrictions for a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "restrictions"],
        requires_write=False,
        handler=handle_sm_get_device_restrictions,
    ),
    create_tool(
        name="meraki_sm_get_device_software",
        description="""Get the software installed on a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "software", "apps"],
        requires_write=False,
        handler=handle_sm_get_device_software,
    ),
    create_tool(
        name="meraki_sm_get_device_security_centers",
        description="""Get the security center settings for a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "security"],
        requires_write=False,
        handler=handle_sm_get_device_security_centers,
    ),
    create_tool(
        name="meraki_sm_get_device_network_adapters",
        description="""Get the network adapters for a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "network", "adapters"],
        requires_write=False,
        handler=handle_sm_get_device_network_adapters,
    ),
    create_tool(
        name="meraki_sm_get_device_wlan_lists",
        description="""Get the WLANs seen by a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "wlan", "wifi"],
        requires_write=False,
        handler=handle_sm_get_device_wlan_lists,
    ),
    create_tool(
        name="meraki_sm_get_device_connectivity",
        description="""Get the connectivity history for a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "connectivity", "history"],
        requires_write=False,
        handler=handle_sm_get_device_connectivity,
    ),
    create_tool(
        name="meraki_sm_get_device_performance_history",
        description="""Get the performance history for a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "performance", "history"],
        requires_write=False,
        handler=handle_sm_get_device_performance_history,
    ),
    create_tool(
        name="meraki_sm_lock_devices",
        description="""Lock devices enrolled in Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "wifi_macs": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "WiFi MACs of devices to lock"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device IDs to lock"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Serials to lock"
            },
            "scope": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Scope of devices to lock"
            },
            "pin": {
                        "type": "integer",
                        "description": "PIN for unlocking (Android)"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "devices", "lock", "action"],
        requires_write=False,
        handler=handle_sm_lock_devices,
    ),
    create_tool(
        name="meraki_sm_wipe_devices",
        description="""Wipe devices enrolled in Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "wifi_macs": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "WiFi MACs of devices to wipe"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device IDs to wipe"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Serials to wipe"
            },
            "scope": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Scope of devices to wipe"
            },
            "pin": {
                        "type": "integer",
                        "description": "PIN for confirmation"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "devices", "wipe", "action"],
        requires_write=False,
        handler=handle_sm_wipe_devices,
    ),
    create_tool(
        name="meraki_sm_move_devices",
        description="""Move devices to a different network in Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "new_network": {
                        "type": "string",
                        "description": "Destination network ID"
            },
            "wifi_macs": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "WiFi MACs to move"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device IDs to move"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Serials to move"
            },
            "scope": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Scope of devices to move"
            }
},
        required=["network_id", "new_network"],
        tags=["meraki", "sm", "devices", "move", "action"],
        requires_write=False,
        handler=handle_sm_move_devices,
    ),
    create_tool(
        name="meraki_sm_unenroll_device",
        description="""Unenroll a device from Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "unenroll", "action"],
        requires_write=False,
        handler=handle_sm_unenroll_device,
    ),
    create_tool(
        name="meraki_sm_modify_device_tags",
        description="""Modify tags on devices in Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "tags": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Tags to add"
            },
            "update_action": {
                        "type": "string",
                        "description": "Action: add, delete, or update"
            },
            "wifi_macs": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "WiFi MACs"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device IDs"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Serials"
            },
            "scope": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Scope"
            }
},
        required=["network_id", "tags", "update_action"],
        tags=["meraki", "sm", "devices", "tags", "modify"],
        requires_write=False,
        handler=handle_sm_modify_device_tags,
    ),
    create_tool(
        name="meraki_sm_checkin_devices",
        description="""Force devices to check in with Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "wifi_macs": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "WiFi MACs"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device IDs"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Serials"
            },
            "scope": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Scope"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "devices", "checkin", "action"],
        requires_write=False,
        handler=handle_sm_checkin_devices,
    ),
    create_tool(
        name="meraki_sm_refresh_device_details",
        description="""Refresh the details of a Systems Manager device""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["network_id", "device_id"],
        tags=["meraki", "sm", "devices", "refresh", "action"],
        requires_write=False,
        handler=handle_sm_refresh_device_details,
    ),
    create_tool(
        name="meraki_sm_list_users",
        description="""List the users in Systems Manager for a network""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by user IDs"
            },
            "usernames": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by usernames"
            },
            "emails": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by emails"
            },
            "scope": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by scope"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "users", "list"],
        requires_write=False,
        handler=handle_sm_list_users,
    ),
    create_tool(
        name="meraki_sm_get_user_device_profiles",
        description="""Get the device profiles for a Systems Manager user""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "user_id": {
                        "type": "string",
                        "description": "User Id"
            }
},
        required=["network_id", "user_id"],
        tags=["meraki", "sm", "users", "profiles"],
        requires_write=False,
        handler=handle_sm_get_user_device_profiles,
    ),
    create_tool(
        name="meraki_sm_get_user_softwares",
        description="""Get the software for a Systems Manager user""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "user_id": {
                        "type": "string",
                        "description": "User Id"
            }
},
        required=["network_id", "user_id"],
        tags=["meraki", "sm", "users", "software"],
        requires_write=False,
        handler=handle_sm_get_user_softwares,
    ),
    create_tool(
        name="meraki_sm_list_profiles",
        description="""List the profiles in Systems Manager for a network""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "profiles", "list"],
        requires_write=False,
        handler=handle_sm_list_profiles,
    ),
    create_tool(
        name="meraki_sm_list_target_groups",
        description="""List the target groups in Systems Manager for a network""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "with_details": {
                        "type": "boolean",
                        "description": "Include detailed scope"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "target-groups", "list"],
        requires_write=False,
        handler=handle_sm_list_target_groups,
    ),
    create_tool(
        name="meraki_sm_create_target_group",
        description="""Create a target group in Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "name": {
                        "type": "string",
                        "description": "Group name"
            },
            "scope": {
                        "type": "string",
                        "description": "Scope (device tags/serials/ids)"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "target-groups", "create"],
        requires_write=True,
        handler=handle_sm_create_target_group,
    ),
    create_tool(
        name="meraki_sm_get_target_group",
        description="""Get a specific target group""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "target_group_id": {
                        "type": "string",
                        "description": "Target Group Id"
            },
            "with_details": {
                        "type": "boolean",
                        "description": "Include detailed scope"
            }
},
        required=["network_id", "target_group_id"],
        tags=["meraki", "sm", "target-groups", "get"],
        requires_write=False,
        handler=handle_sm_get_target_group,
    ),
    create_tool(
        name="meraki_sm_update_target_group",
        description="""Update a target group in Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "target_group_id": {
                        "type": "string",
                        "description": "Target Group Id"
            },
            "name": {
                        "type": "string",
                        "description": "Group name"
            },
            "scope": {
                        "type": "string",
                        "description": "Scope"
            }
},
        required=["network_id", "target_group_id"],
        tags=["meraki", "sm", "target-groups", "update"],
        requires_write=True,
        handler=handle_sm_update_target_group,
    ),
    create_tool(
        name="meraki_sm_delete_target_group",
        description="""Delete a target group from Systems Manager""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "target_group_id": {
                        "type": "string",
                        "description": "Target Group Id"
            }
},
        required=["network_id", "target_group_id"],
        tags=["meraki", "sm", "target-groups", "delete"],
        requires_write=True,
        handler=handle_sm_delete_target_group,
    ),
    create_tool(
        name="meraki_sm_get_bypass_activation_lock_attempts",
        description="""Get the bypass activation lock attempts for a network""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["meraki", "sm", "bypass", "activation-lock"],
        requires_write=False,
        handler=handle_sm_get_bypass_activation_lock_attempts,
    ),
    create_tool(
        name="meraki_sm_create_bypass_activation_lock_attempt",
        description="""Attempt to bypass activation lock on devices""",
        platform="meraki",
        category="sm",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device IDs to bypass"
            }
},
        required=["network_id", "ids"],
        tags=["meraki", "sm", "bypass", "activation-lock", "action"],
        requires_write=False,
        handler=handle_sm_create_bypass_activation_lock_attempt,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_sm_tools():
    """Register all sm tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_SM_TOOLS)
    logger.info(f"Registered {len(MERAKI_SM_TOOLS)} meraki sm tools")


# Auto-register on import
register_sm_tools()
