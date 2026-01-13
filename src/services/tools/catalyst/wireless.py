"""
Catalyst Wireless Tools

Auto-generated from archived A2A skills.
Total tools: 20
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_wireless_get_enterprise_ssids(params: Dict, context: Any) -> Dict:
    """Handler for Get Enterprise SSIDs."""
    try:
        # Build API path
        path = "/wireless/get/enterprise/ssids"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_create_enterprise_ssid(params: Dict, context: Any) -> Dict:
    """Handler for Create Enterprise SSID."""
    try:
        # Build API path
        path = "/wireless/create/enterprise/ssid"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_update_enterprise_ssid(params: Dict, context: Any) -> Dict:
    """Handler for Update Enterprise SSID."""
    try:
        # Build API path
        path = "/wireless/update/enterprise/ssid"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_delete_enterprise_ssid(params: Dict, context: Any) -> Dict:
    """Handler for Delete Enterprise SSID."""
    try:
        # Build API path
        path = "/wireless/delete/enterprise/ssid"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_get_wireless_profiles(params: Dict, context: Any) -> Dict:
    """Handler for Get Wireless Profiles."""
    try:
        # Build API path
        path = "/wireless/get/wireless/profiles"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_create_wireless_profile(params: Dict, context: Any) -> Dict:
    """Handler for Create Wireless Profile."""
    try:
        # Build API path
        path = "/wireless/create/wireless/profile"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_update_wireless_profile(params: Dict, context: Any) -> Dict:
    """Handler for Update Wireless Profile."""
    try:
        # Build API path
        path = "/wireless/update/wireless/profile"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_delete_wireless_profile(params: Dict, context: Any) -> Dict:
    """Handler for Delete Wireless Profile."""
    try:
        # Build API path
        path = "/wireless/delete/wireless/profile"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_get_rf_profiles(params: Dict, context: Any) -> Dict:
    """Handler for Get RF Profiles."""
    try:
        # Build API path
        path = "/wireless/get/rf/profiles"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_create_rf_profile(params: Dict, context: Any) -> Dict:
    """Handler for Create RF Profile."""
    try:
        # Build API path
        path = "/wireless/create/rf/profile"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_delete_rf_profile(params: Dict, context: Any) -> Dict:
    """Handler for Delete RF Profile."""
    try:
        # Build API path
        path = "/wireless/delete/rf/profile"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_provision_device(params: Dict, context: Any) -> Dict:
    """Handler for Provision Wireless Device."""
    try:
        # Build API path
        path = "/wireless/provision/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_get_access_point_config(params: Dict, context: Any) -> Dict:
    """Handler for Get Access Point Configuration."""
    try:
        # Build API path
        path = "/wireless/get/access/point/config"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_configure_access_point(params: Dict, context: Any) -> Dict:
    """Handler for Configure Access Point."""
    try:
        # Build API path
        path = "/wireless/configure/access/point"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_get_dynamic_interface(params: Dict, context: Any) -> Dict:
    """Handler for Get Dynamic Interface."""
    try:
        # Build API path
        path = "/wireless/get/dynamic/interface"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_create_dynamic_interface(params: Dict, context: Any) -> Dict:
    """Handler for Create Dynamic Interface."""
    try:
        # Build API path
        path = "/wireless/create/dynamic/interface"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_delete_dynamic_interface(params: Dict, context: Any) -> Dict:
    """Handler for Delete Dynamic Interface."""
    try:
        # Build API path
        path = "/wireless/delete/dynamic/interface"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_get_managed_ap_locations(params: Dict, context: Any) -> Dict:
    """Handler for Get Managed AP Locations."""
    try:
        # Build API path
        path = "/wireless/get/managed/ap/locations"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_sensor_create_test(params: Dict, context: Any) -> Dict:
    """Handler for Create Sensor Test."""
    try:
        # Build API path
        path = "/wireless/sensor/create/test"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_sensor_delete_test(params: Dict, context: Any) -> Dict:
    """Handler for Delete Sensor Test."""
    try:
        # Build API path
        path = "/wireless/sensor/delete/test"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_WIRELESS_TOOLS = [
    create_tool(
        name="catalyst_wireless_get_enterprise_ssids",
        description="""Get list of enterprise SSIDs.""",
        platform="catalyst",
        category="wireless",
        properties={
            "ssid_name": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "wireless", "ssid", "list"],
        requires_write=False,
        handler=handle_wireless_get_enterprise_ssids,
    ),
    create_tool(
        name="catalyst_wireless_create_enterprise_ssid",
        description="""Create a new enterprise SSID.""",
        platform="catalyst",
        category="wireless",
        properties={
            "name": {
                        "type": "string"
            },
            "security_level": {
                        "type": "string",
                        "enum": [
                                    "WPA2_ENTERPRISE",
                                    "WPA2_PERSONAL",
                                    "WPA3_ENTERPRISE",
                                    "WPA3_PERSONAL",
                                    "OPEN"
                        ]
            },
            "passphrase": {
                        "type": "string"
            },
            "traffic_type": {
                        "type": "string",
                        "enum": [
                                    "voicedata",
                                    "data"
                        ]
            },
            "radio_policy": {
                        "type": "string",
                        "enum": [
                                    "Dual band operation (2.4GHz and 5GHz)",
                                    "Dual band operation with band select",
                                    "5GHz only",
                                    "2.4GHz only"
                        ]
            },
            "enable_fast_lane": {
                        "type": "boolean"
            },
            "enable_mac_filtering": {
                        "type": "boolean"
            },
            "fast_transition": {
                        "type": "string",
                        "enum": [
                                    "Adaptive",
                                    "Enable",
                                    "Disable"
                        ]
            }
},
        required=["name", "security_level"],
        tags=["catalyst", "wireless", "ssid", "create"],
        requires_write=True,
        handler=handle_wireless_create_enterprise_ssid,
    ),
    create_tool(
        name="catalyst_wireless_update_enterprise_ssid",
        description="""Update an existing enterprise SSID.""",
        platform="catalyst",
        category="wireless",
        properties={
            "name": {
                        "type": "string"
            },
            "security_level": {
                        "type": "string"
            },
            "passphrase": {
                        "type": "string"
            },
            "traffic_type": {
                        "type": "string"
            },
            "radio_policy": {
                        "type": "string"
            }
},
        required=["name"],
        tags=["catalyst", "wireless", "ssid", "update"],
        requires_write=True,
        handler=handle_wireless_update_enterprise_ssid,
    ),
    create_tool(
        name="catalyst_wireless_delete_enterprise_ssid",
        description="""Delete an enterprise SSID.""",
        platform="catalyst",
        category="wireless",
        properties={
            "ssid_name": {
                        "type": "string"
            }
},
        required=["ssid_name"],
        tags=["catalyst", "wireless", "ssid", "delete"],
        requires_write=True,
        handler=handle_wireless_delete_enterprise_ssid,
    ),
    create_tool(
        name="catalyst_wireless_get_wireless_profiles",
        description="""Get list of wireless profiles.""",
        platform="catalyst",
        category="wireless",
        properties={
            "profile_name": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "wireless", "profile", "list"],
        requires_write=False,
        handler=handle_wireless_get_wireless_profiles,
    ),
    create_tool(
        name="catalyst_wireless_create_wireless_profile",
        description="""Create a new wireless profile.""",
        platform="catalyst",
        category="wireless",
        properties={
            "profile_name": {
                        "type": "string"
            },
            "ssid_details": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "name": {
                                                            "type": "string"
                                                },
                                                "enable_fabric": {
                                                            "type": "boolean"
                                                },
                                                "flex_connect": {
                                                            "type": "object"
                                                }
                                    }
                        }
            }
},
        required=["profile_name"],
        tags=["catalyst", "wireless", "profile", "create"],
        requires_write=True,
        handler=handle_wireless_create_wireless_profile,
    ),
    create_tool(
        name="catalyst_wireless_update_wireless_profile",
        description="""Update an existing wireless profile.""",
        platform="catalyst",
        category="wireless",
        properties={
            "profile_name": {
                        "type": "string"
            },
            "ssid_details": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["profile_name"],
        tags=["catalyst", "wireless", "profile", "update"],
        requires_write=True,
        handler=handle_wireless_update_wireless_profile,
    ),
    create_tool(
        name="catalyst_wireless_delete_wireless_profile",
        description="""Delete a wireless profile.""",
        platform="catalyst",
        category="wireless",
        properties={
            "wireless_profile_name": {
                        "type": "string"
            }
},
        required=["wireless_profile_name"],
        tags=["catalyst", "wireless", "profile", "delete"],
        requires_write=True,
        handler=handle_wireless_delete_wireless_profile,
    ),
    create_tool(
        name="catalyst_wireless_get_rf_profiles",
        description="""Get list of RF (Radio Frequency) profiles.""",
        platform="catalyst",
        category="wireless",
        properties={
            "rf_profile_name": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "wireless", "rf", "profile", "list"],
        requires_write=False,
        handler=handle_wireless_get_rf_profiles,
    ),
    create_tool(
        name="catalyst_wireless_create_rf_profile",
        description="""Create a new RF profile.""",
        platform="catalyst",
        category="wireless",
        properties={
            "name": {
                        "type": "string"
            },
            "default_rf_profile": {
                        "type": "boolean",
                        "default": False
            },
            "enable_radio_type_a": {
                        "type": "boolean",
                        "default": True
            },
            "enable_radio_type_b": {
                        "type": "boolean",
                        "default": True
            },
            "channel_width": {
                        "type": "string"
            },
            "enable_custom": {
                        "type": "boolean"
            },
            "enable_brown_field": {
                        "type": "boolean"
            }
},
        required=["name"],
        tags=["catalyst", "wireless", "rf", "profile", "create"],
        requires_write=True,
        handler=handle_wireless_create_rf_profile,
    ),
    create_tool(
        name="catalyst_wireless_delete_rf_profile",
        description="""Delete an RF profile.""",
        platform="catalyst",
        category="wireless",
        properties={
            "rf_profile_name": {
                        "type": "string"
            }
},
        required=["rf_profile_name"],
        tags=["catalyst", "wireless", "rf", "profile", "delete"],
        requires_write=True,
        handler=handle_wireless_delete_rf_profile,
    ),
    create_tool(
        name="catalyst_wireless_provision_device",
        description="""Provision a wireless device to a site.""",
        platform="catalyst",
        category="wireless",
        properties={
            "device_name": {
                        "type": "string"
            },
            "site": {
                        "type": "string"
            },
            "managed_ap_locations": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "dynamic_interfaces": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["device_name", "site"],
        tags=["catalyst", "wireless", "provision"],
        requires_write=False,
        handler=handle_wireless_provision_device,
    ),
    create_tool(
        name="catalyst_wireless_get_access_point_config",
        description="""Get access point configuration details.""",
        platform="catalyst",
        category="wireless",
        properties={
            "key": {
                        "type": "string",
                        "description": "AP MAC address or name"
            }
},
        required=[],
        tags=["catalyst", "wireless", "ap", "config"],
        requires_write=False,
        handler=handle_wireless_get_access_point_config,
    ),
    create_tool(
        name="catalyst_wireless_configure_access_point",
        description="""Configure access point settings.""",
        platform="catalyst",
        category="wireless",
        properties={
            "ap_list": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "ap_name": {
                                                            "type": "string"
                                                },
                                                "ap_name_new": {
                                                            "type": "string"
                                                },
                                                "ap_mode": {
                                                            "type": "integer"
                                                },
                                                "location": {
                                                            "type": "string"
                                                },
                                                "led_status": {
                                                            "type": "boolean"
                                                },
                                                "led_brightness_level": {
                                                            "type": "integer"
                                                },
                                                "is_assigned_site_as_location": {
                                                            "type": "boolean"
                                                }
                                    }
                        }
            },
            "configure_admin_status": {
                        "type": "boolean"
            },
            "admin_status": {
                        "type": "boolean"
            },
            "configure_ap_mode": {
                        "type": "boolean"
            },
            "configure_failover_priority": {
                        "type": "boolean"
            },
            "failover_priority": {
                        "type": "integer"
            },
            "configure_led_status": {
                        "type": "boolean"
            },
            "configure_led_brightness_level": {
                        "type": "boolean"
            },
            "configure_location": {
                        "type": "boolean"
            }
},
        required=["ap_list"],
        tags=["catalyst", "wireless", "ap", "configure"],
        requires_write=False,
        handler=handle_wireless_configure_access_point,
    ),
    create_tool(
        name="catalyst_wireless_get_dynamic_interface",
        description="""Get dynamic interface configuration.""",
        platform="catalyst",
        category="wireless",
        properties={
            "interface_name": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "wireless", "interface", "dynamic"],
        requires_write=False,
        handler=handle_wireless_get_dynamic_interface,
    ),
    create_tool(
        name="catalyst_wireless_create_dynamic_interface",
        description="""Create a new dynamic interface.""",
        platform="catalyst",
        category="wireless",
        properties={
            "interface_name": {
                        "type": "string"
            },
            "vlan_id": {
                        "type": "integer"
            },
            "interface_ip_address": {
                        "type": "string"
            },
            "interface_netmask_in_cidr": {
                        "type": "integer"
            },
            "gateway_ip_address": {
                        "type": "string"
            }
},
        required=["interface_name", "vlan_id"],
        tags=["catalyst", "wireless", "interface", "create"],
        requires_write=True,
        handler=handle_wireless_create_dynamic_interface,
    ),
    create_tool(
        name="catalyst_wireless_delete_dynamic_interface",
        description="""Delete a dynamic interface.""",
        platform="catalyst",
        category="wireless",
        properties={
            "interface_name": {
                        "type": "string"
            }
},
        required=["interface_name"],
        tags=["catalyst", "wireless", "interface", "delete"],
        requires_write=True,
        handler=handle_wireless_delete_dynamic_interface,
    ),
    create_tool(
        name="catalyst_wireless_get_managed_ap_locations",
        description="""Get managed access point locations.""",
        platform="catalyst",
        category="wireless",
        properties={
            "network_device_id": {
                        "type": "string"
            }
},
        required=["network_device_id"],
        tags=["catalyst", "wireless", "ap", "locations"],
        requires_write=False,
        handler=handle_wireless_get_managed_ap_locations,
    ),
    create_tool(
        name="catalyst_wireless_sensor_create_test",
        description="""Create a wireless sensor test.""",
        platform="catalyst",
        category="wireless",
        properties={
            "name": {
                        "type": "string"
            },
            "ssid": {
                        "type": "string"
            },
            "band": {
                        "type": "string",
                        "enum": [
                                    "2.4GHz",
                                    "5GHz",
                                    "Dual"
                        ]
            },
            "connection_mode": {
                        "type": "string",
                        "enum": [
                                    "Wired",
                                    "Wireless"
                        ]
            },
            "ap_coverage": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["name", "ssid"],
        tags=["catalyst", "wireless", "sensor", "test", "create"],
        requires_write=True,
        handler=handle_wireless_sensor_create_test,
    ),
    create_tool(
        name="catalyst_wireless_sensor_delete_test",
        description="""Delete a wireless sensor test.""",
        platform="catalyst",
        category="wireless",
        properties={
            "template_name": {
                        "type": "string"
            }
},
        required=["template_name"],
        tags=["catalyst", "wireless", "sensor", "test", "delete"],
        requires_write=True,
        handler=handle_wireless_sensor_delete_test,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_wireless_tools():
    """Register all wireless tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_WIRELESS_TOOLS)
    logger.info(f"Registered {len(CATALYST_WIRELESS_TOOLS)} catalyst wireless tools")


# Auto-register on import
register_wireless_tools()
