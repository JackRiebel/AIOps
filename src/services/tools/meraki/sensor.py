"""
Meraki Sensor Tools

Auto-generated from archived A2A skills.
Total tools: 14
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_sensor_list_alerts_profiles(params: Dict, context: Any) -> Dict:
    """Handler for List Sensor Alert Profiles."""
    try:
        # Build API path
        path = "/sensor/list/alerts/profiles"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_create_alerts_profile(params: Dict, context: Any) -> Dict:
    """Handler for Create Sensor Alert Profile."""
    try:
        # Build API path
        path = "/sensor/create/alerts/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_get_alerts_profile(params: Dict, context: Any) -> Dict:
    """Handler for Get Sensor Alert Profile."""
    try:
        # Build API path
        path = "/sensor/get/alerts/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_update_alerts_profile(params: Dict, context: Any) -> Dict:
    """Handler for Update Sensor Alert Profile."""
    try:
        # Build API path
        path = "/sensor/update/alerts/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_delete_alerts_profile(params: Dict, context: Any) -> Dict:
    """Handler for Delete Sensor Alert Profile."""
    try:
        # Build API path
        path = "/sensor/delete/alerts/profile"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_get_alerts_current(params: Dict, context: Any) -> Dict:
    """Handler for Get Current Sensor Alerts."""
    try:
        # Build API path
        path = "/sensor/get/alerts/current"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_get_alerts_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Sensor Alerts History."""
    try:
        # Build API path
        path = "/sensor/get/alerts/history"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_get_readings_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Sensor Readings History."""
    try:
        # Build API path
        path = "/sensor/get/readings/history"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_get_readings_latest(params: Dict, context: Any) -> Dict:
    """Handler for Get Sensor Readings Latest."""
    try:
        # Build API path
        path = "/sensor/get/readings/latest"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_list_relationships(params: Dict, context: Any) -> Dict:
    """Handler for List Sensor Relationships."""
    try:
        # Build API path
        path = "/sensor/list/relationships"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_get_device_relationships(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Sensor Relationships."""
    try:
        # Build API path
        path = "/sensor/get/device/relationships"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_update_device_relationships(params: Dict, context: Any) -> Dict:
    """Handler for Update Device Sensor Relationships."""
    try:
        # Build API path
        path = "/sensor/update/device/relationships"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_create_command(params: Dict, context: Any) -> Dict:
    """Handler for Create Sensor Command."""
    try:
        # Build API path
        path = "/sensor/create/command"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sensor_get_command(params: Dict, context: Any) -> Dict:
    """Handler for Get Sensor Command."""
    try:
        # Build API path
        path = "/sensor/get/command"
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_SENSOR_TOOLS = [
    create_tool(
        name="meraki_sensor_list_alerts_profiles",
        description="""List the sensor alert profiles for a network""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["meraki", "sensor", "alerts", "profiles", "list"],
        requires_write=False,
        handler=handle_sensor_list_alerts_profiles,
    ),
    create_tool(
        name="meraki_sensor_create_alerts_profile",
        description="""Create a sensor alert profile for a network""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "name": {
                        "type": "string",
                        "description": "Profile name"
            },
            "schedule": {
                        "type": "object",
                        "description": "Alert schedule"
            },
            "conditions": {
                        "type": "array",
                        "description": "Alert conditions",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "metric": {
                                                            "type": "string",
                                                            "description": "Metric: temperature, humidity, water, door, etc."
                                                },
                                                "threshold": {
                                                            "type": "object",
                                                            "description": "Threshold configuration"
                                                },
                                                "direction": {
                                                            "type": "string",
                                                            "description": "above or below"
                                                },
                                                "duration": {
                                                            "type": "integer",
                                                            "description": "Duration in seconds"
                                                }
                                    }
                        }
            },
            "recipients": {
                        "type": "object",
                        "description": "Alert recipients (emails, SMS, webhooks)"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device serials to apply profile"
            }
},
        required=["network_id", "name", "conditions"],
        tags=["meraki", "sensor", "alerts", "profiles", "create"],
        requires_write=True,
        handler=handle_sensor_create_alerts_profile,
    ),
    create_tool(
        name="meraki_sensor_get_alerts_profile",
        description="""Get a specific sensor alert profile""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "alert_profile_id": {
                        "type": "string",
                        "description": "Alert Profile Id"
            }
},
        required=["network_id", "alert_profile_id"],
        tags=["meraki", "sensor", "alerts", "profiles", "get"],
        requires_write=False,
        handler=handle_sensor_get_alerts_profile,
    ),
    create_tool(
        name="meraki_sensor_update_alerts_profile",
        description="""Update a sensor alert profile""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "alert_profile_id": {
                        "type": "string",
                        "description": "Alert Profile Id"
            },
            "name": {
                        "type": "string",
                        "description": "Profile name"
            },
            "schedule": {
                        "type": "object",
                        "description": "Alert schedule"
            },
            "conditions": {
                        "type": "array",
                        "description": "Alert conditions"
            },
            "recipients": {
                        "type": "object",
                        "description": "Alert recipients"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Device serials"
            }
},
        required=["network_id", "alert_profile_id"],
        tags=["meraki", "sensor", "alerts", "profiles", "update"],
        requires_write=True,
        handler=handle_sensor_update_alerts_profile,
    ),
    create_tool(
        name="meraki_sensor_delete_alerts_profile",
        description="""Delete a sensor alert profile""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "alert_profile_id": {
                        "type": "string",
                        "description": "Alert Profile Id"
            }
},
        required=["network_id", "alert_profile_id"],
        tags=["meraki", "sensor", "alerts", "profiles", "delete"],
        requires_write=True,
        handler=handle_sensor_delete_alerts_profile,
    ),
    create_tool(
        name="meraki_sensor_get_alerts_current",
        description="""Get the current sensor alerts by metric for a network""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["meraki", "sensor", "alerts", "current", "status"],
        requires_write=False,
        handler=handle_sensor_get_alerts_current,
    ),
    create_tool(
        name="meraki_sensor_get_alerts_history",
        description="""Get the sensor alerts history by metric for a network""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            }
},
        required=["network_id"],
        tags=["meraki", "sensor", "alerts", "history"],
        requires_write=False,
        handler=handle_sensor_get_alerts_history,
    ),
    create_tool(
        name="meraki_sensor_get_readings_history",
        description="""Get historical sensor readings for a network""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
                        "description": "Timespan in seconds (max 730 days)"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page (max 1000)"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by device serials"
            },
            "metrics": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by metrics"
            }
},
        required=["network_id"],
        tags=["meraki", "sensor", "readings", "history", "data"],
        requires_write=False,
        handler=handle_sensor_get_readings_history,
    ),
    create_tool(
        name="meraki_sensor_get_readings_latest",
        description="""Get the latest sensor readings for a network""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            },
            "serials": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by device serials"
            },
            "metrics": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by metrics"
            }
},
        required=["network_id"],
        tags=["meraki", "sensor", "readings", "latest", "current"],
        requires_write=False,
        handler=handle_sensor_get_readings_latest,
    ),
    create_tool(
        name="meraki_sensor_list_relationships",
        description="""List the sensor relationships for a network""",
        platform="meraki",
        category="sensor",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["meraki", "sensor", "relationships", "gateway"],
        requires_write=False,
        handler=handle_sensor_list_relationships,
    ),
    create_tool(
        name="meraki_sensor_get_device_relationships",
        description="""Get the sensor relationships for a specific device""",
        platform="meraki",
        category="sensor",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            }
},
        required=["serial"],
        tags=["meraki", "sensor", "relationships", "device"],
        requires_write=False,
        handler=handle_sensor_get_device_relationships,
    ),
    create_tool(
        name="meraki_sensor_update_device_relationships",
        description="""Update the sensor relationships for a specific device""",
        platform="meraki",
        category="sensor",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "livestream": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["serial"],
        tags=["meraki", "sensor", "relationships", "device", "update"],
        requires_write=True,
        handler=handle_sensor_update_device_relationships,
    ),
    create_tool(
        name="meraki_sensor_create_command",
        description="""Send a command to a sensor""",
        platform="meraki",
        category="sensor",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "operation": {
                        "type": "string",
                        "description": "Command operation"
            }
},
        required=["serial", "operation"],
        tags=["meraki", "sensor", "commands", "action"],
        requires_write=False,
        handler=handle_sensor_create_command,
    ),
    create_tool(
        name="meraki_sensor_get_command",
        description="""Get the status of a sensor command""",
        platform="meraki",
        category="sensor",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Serial"
            },
            "command_id": {
                        "type": "string",
                        "description": "Command ID"
            }
},
        required=["serial", "command_id"],
        tags=["meraki", "sensor", "commands", "status"],
        requires_write=False,
        handler=handle_sensor_get_command,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_sensor_tools():
    """Register all sensor tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_SENSOR_TOOLS)
    logger.info(f"Registered {len(MERAKI_SENSOR_TOOLS)} meraki sensor tools")


# Auto-register on import
register_sensor_tools()
