"""
Meraki Devices Tools

Provides tools for managing Meraki devices including:
- Device information and updates
- Live tools (ping, cable test, throughput test)
- Management interface settings
- Cellular SIM management
- Device tables (ARP, routing, MAC)

All paths follow the official Meraki Dashboard API v1 specification.
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

async def handle_devices_get(params: Dict, context: Any) -> Dict:
    """Get details of a specific device by serial number."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_update(params: Dict, context: Any) -> Dict:
    """Update device settings like name, address, notes, tags."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_blink_leds(params: Dict, context: Any) -> Dict:
    """Blink the LEDs on a device for identification."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/blinkLeds"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_reboot(params: Dict, context: Any) -> Dict:
    """Reboot a device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/reboot"
        result = await context.client.request("POST", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_clients(params: Dict, context: Any) -> Dict:
    """Get clients connected to a specific device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/clients"
        # Pass optional query params
        query_params = {k: v for k, v in params.items() if k not in ["serial"] and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_lldp_cdp(params: Dict, context: Any) -> Dict:
    """Get LLDP and CDP neighbor information for a device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/lldpCdp"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_management_interface(params: Dict, context: Any) -> Dict:
    """Get management interface settings for a device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/managementInterface"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_update_management_interface(params: Dict, context: Any) -> Dict:
    """Update management interface settings."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/managementInterface"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_ping(params: Dict, context: Any) -> Dict:
    """Start a ping test from a device to a target."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/ping"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_ping_result(params: Dict, context: Any) -> Dict:
    """Get the result of a ping test."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        ping_id = params.get("ping_id") or params.get("pingId")
        if not serial or not ping_id:
            return {"success": False, "error": "serial and ping_id are required"}

        path = f"/devices/{serial}/liveTools/ping/{ping_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_ping_device(params: Dict, context: Any) -> Dict:
    """Ping a device from the cloud."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/pingDevice"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_ping_device_result(params: Dict, context: Any) -> Dict:
    """Get result of pinging a device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        ping_id = params.get("ping_id") or params.get("pingId")
        if not serial or not ping_id:
            return {"success": False, "error": "serial and ping_id are required"}

        path = f"/devices/{serial}/liveTools/pingDevice/{ping_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_cable_test(params: Dict, context: Any) -> Dict:
    """Run a cable test on switch ports."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/cableTest"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_cable_test_result(params: Dict, context: Any) -> Dict:
    """Get cable test results."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        test_id = params.get("test_id") or params.get("testId") or params.get("id")
        if not serial or not test_id:
            return {"success": False, "error": "serial and test_id are required"}

        path = f"/devices/{serial}/liveTools/cableTest/{test_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_throughput_test(params: Dict, context: Any) -> Dict:
    """Run a throughput test on a device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/throughputTest"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_throughput_test_result(params: Dict, context: Any) -> Dict:
    """Get throughput test results."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        test_id = params.get("test_id") or params.get("testId") or params.get("throughputTestId")
        if not serial or not test_id:
            return {"success": False, "error": "serial and test_id are required"}

        path = f"/devices/{serial}/liveTools/throughputTest/{test_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_arp_table(params: Dict, context: Any) -> Dict:
    """Get the ARP table from a device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/arpTable"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_arp_table_result(params: Dict, context: Any) -> Dict:
    """Get ARP table request results."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        arp_table_id = params.get("arp_table_id") or params.get("arpTableId")
        if not serial or not arp_table_id:
            return {"success": False, "error": "serial and arp_table_id are required"}

        path = f"/devices/{serial}/liveTools/arpTable/{arp_table_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_routing_table(params: Dict, context: Any) -> Dict:
    """Get the routing table from a device."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/routingTable"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_routing_table_result(params: Dict, context: Any) -> Dict:
    """Get routing table request results."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        serial = params.get("serial")
        routing_table_id = params.get("routing_table_id") or params.get("routingTableId")
        if not serial or not routing_table_id:
            return {"success": False, "error": "serial and routing_table_id are required"}

        path = f"/devices/{serial}/liveTools/routingTable/{routing_table_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_mac_table(params: Dict, context: Any) -> Dict:
    """Get the MAC address table from a switch."""
    try:
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/macTable"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_mac_table_result(params: Dict, context: Any) -> Dict:
    """Get MAC table request results."""
    try:
        serial = params.get("serial")
        mac_table_id = params.get("mac_table_id") or params.get("macTableId")
        if not serial or not mac_table_id:
            return {"success": False, "error": "serial and mac_table_id are required"}

        path = f"/devices/{serial}/liveTools/macTable/{mac_table_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_create_wake_on_lan(params: Dict, context: Any) -> Dict:
    """Send a Wake-on-LAN packet to a device."""
    try:
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/liveTools/wakeOnLan"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_cellular_sims(params: Dict, context: Any) -> Dict:
    """Get cellular SIM information for a device."""
    try:
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/cellular/sims"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_update_cellular_sims(params: Dict, context: Any) -> Dict:
    """Update cellular SIM settings."""
    try:
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/cellular/sims"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_loss_latency_history(params: Dict, context: Any) -> Dict:
    """Get packet loss and latency history for a device."""
    try:
        serial = params.get("serial")
        ip = params.get("ip")
        if not serial or not ip:
            return {"success": False, "error": "serial and ip are required"}

        path = f"/devices/{serial}/lossAndLatencyHistory"
        query_params = {k: v for k, v in params.items() if k not in ["serial"] and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_devices_get_sensor_readings(params: Dict, context: Any) -> Dict:
    """Get sensor readings from a sensor device (MT series)."""
    try:
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        # Note: Sensor readings are at the organization level, not device level
        # This endpoint returns latest readings for a specific device
        path = f"/devices/{serial}/sensor/relationships"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_DEVICES_TOOLS = [
    create_tool(
        name="meraki_devices_get",
        description="""Get details of a specific device by serial number. Returns device name, model, MAC address, firmware version, network ID, address, coordinates, notes, tags, and uplink information.""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "get", "read", "details", "info", "serial", "mx", "mr", "ms", "mv", "mt", "mg", "appliance", "switch", "ap", "access point", "camera", "sensor", "gateway", "mx68", "mx67", "mx64", "mx84", "mx85", "mx95", "mx100", "mx105", "mx250", "mx450", "mr36", "mr44", "mr46", "mr56", "mr57", "mr76", "mr86", "ms120", "ms125", "ms210", "ms225", "ms250", "ms350", "ms355", "ms390", "ms410", "ms425", "mv12", "mv22", "mv32", "mv52", "mv72", "mv93", "mt10", "mt11", "mt12", "mt14", "mt15", "mt20", "mt30", "mg21", "mg41", "mg51"],
        requires_write=False,
        handler=handle_devices_get,
        examples=[
            {"query": "Get device Q2HP-XXXX-XXXX", "params": {"serial": "Q2HP-XXXX-XXXX"}},
            {"query": "Show details for switch Q2QW-YYYY-YYYY", "params": {"serial": "Q2QW-YYYY-YYYY"}},
            {"query": "What is the firmware on device Q2HP-ABCD-1234?", "params": {"serial": "Q2HP-ABCD-1234"}},
        ],
    ),
    create_tool(
        name="meraki_devices_update",
        description="""Update device settings like name, address, notes, tags""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "name": {
                        "type": "string",
                        "description": "Device name"
            },
            "lat": {
                        "type": "number",
                        "description": "Latitude"
            },
            "lng": {
                        "type": "number",
                        "description": "Longitude"
            },
            "address": {
                        "type": "string",
                        "description": "Physical address"
            },
            "notes": {
                        "type": "string",
                        "description": "Notes about device"
            },
            "tags": {
                        "type": "array",
                        "description": "Device tags",
                        "items": {
                                    "type": "string"
                        }
            },
            "moveMapMarker": {
                        "type": "boolean",
                        "description": "Move map marker"
            },
            "switchProfileId": {
                        "type": "string",
                        "description": "Switch profile ID"
            },
            "floorPlanId": {
                        "type": "string",
                        "description": "Floor plan ID"
            }
},
        required=["serial"],
        tags=["meraki", "devices", "update", "write"],
        requires_write=True,
        handler=handle_devices_update,
    ),
    create_tool(
        name="meraki_devices_blink_leds",
        description="""Blink the LEDs on a device for identification""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "duration": {
                        "type": "integer",
                        "description": "Duration in seconds (default 20)"
            },
            "period": {
                        "type": "integer",
                        "description": "Blink period in ms"
            },
            "duty": {
                        "type": "integer",
                        "description": "Duty cycle (1-100)"
            }
},
        required=["serial"],
        tags=["meraki", "devices", "leds", "blink", "write", "identify"],
        requires_write=True,
        handler=handle_devices_blink_leds,
    ),
    create_tool(
        name="meraki_devices_reboot",
        description="""Reboot a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "reboot", "write", "restart"],
        requires_write=True,
        handler=handle_devices_reboot,
    ),
    create_tool(
        name="meraki_devices_get_clients",
        description="""Get clients connected to a specific device. Returns MAC addresses, IP addresses, VLAN, usage data, and connection times for clients connected to this switch, AP, or appliance.""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            }
},
        required=["serial"],
        tags=["meraki", "devices", "clients", "list", "read"],
        requires_write=False,
        handler=handle_devices_get_clients,
        examples=[
            {"query": "Show clients on device Q2HP-XXXX-XXXX", "params": {"serial": "Q2HP-XXXX-XXXX"}},
            {"query": "Who is connected to switch Q2QW-YYYY-YYYY?", "params": {"serial": "Q2QW-YYYY-YYYY"}},
            {"query": "List clients on this AP in the last 24 hours", "params": {"serial": "Q2HP-ABCD-1234", "timespan": 86400}},
        ],
    ),
    create_tool(
        name="meraki_devices_get_lldp_cdp",
        description="""Get LLDP and CDP neighbor information for a device. Returns connected neighbor devices, ports, system names, and capabilities. Useful for mapping network topology.""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "lldp", "cdp", "neighbors", "read", "discovery"],
        requires_write=False,
        handler=handle_devices_get_lldp_cdp,
        examples=[
            {"query": "Show neighbors for device Q2HP-XXXX-XXXX", "params": {"serial": "Q2HP-XXXX-XXXX"}},
            {"query": "What is connected to switch Q2QW-YYYY-YYYY?", "params": {"serial": "Q2QW-YYYY-YYYY"}},
            {"query": "Get LLDP info", "params": {"serial": "Q2HP-ABCD-1234"}},
        ],
    ),
    create_tool(
        name="meraki_devices_get_management_interface",
        description="""Get management interface settings for a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "management", "interface", "read", "network"],
        requires_write=False,
        handler=handle_devices_get_management_interface,
    ),
    create_tool(
        name="meraki_devices_update_management_interface",
        description="""Update management interface settings""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "wan1": {
                        "type": "object",
                        "description": "WAN1 settings"
            },
            "wan2": {
                        "type": "object",
                        "description": "WAN2 settings"
            }
},
        required=["serial"],
        tags=["meraki", "devices", "management", "interface", "update", "write"],
        requires_write=True,
        handler=handle_devices_update_management_interface,
    ),
    create_tool(
        name="meraki_devices_create_ping",
        description="""Start a ping test from a device to a target""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "target": {
                        "type": "string",
                        "description": "Target IP or hostname"
            },
            "count": {
                        "type": "integer",
                        "description": "Number of pings"
            }
},
        required=["serial", "target"],
        tags=["meraki", "devices", "ping", "live", "tools", "write", "test"],
        requires_write=True,
        handler=handle_devices_create_ping,
    ),
    create_tool(
        name="meraki_devices_get_ping_result",
        description="""Get the result of a ping test""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "ping_id": {
                        "type": "string",
                        "description": "Ping test ID"
            }
},
        required=["serial", "ping_id"],
        tags=["meraki", "devices", "ping", "result", "read"],
        requires_write=False,
        handler=handle_devices_get_ping_result,
    ),
    create_tool(
        name="meraki_devices_create_ping_device",
        description="""Ping a device from the cloud""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "count": {
                        "type": "integer",
                        "description": "Number of pings"
            }
},
        required=["serial"],
        tags=["meraki", "devices", "ping", "live", "tools", "write"],
        requires_write=True,
        handler=handle_devices_create_ping_device,
    ),
    create_tool(
        name="meraki_devices_get_ping_device_result",
        description="""Get result of pinging a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "ping_id": {
                        "type": "string",
                        "description": "Ping test ID"
            }
},
        required=["serial", "ping_id"],
        tags=["meraki", "devices", "ping", "result", "read"],
        requires_write=False,
        handler=handle_devices_get_ping_device_result,
    ),
    create_tool(
        name="meraki_devices_create_cable_test",
        description="""Run a cable test on switch ports""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "ports": {
                        "type": "array",
                        "description": "Ports to test",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["serial", "ports"],
        tags=["meraki", "devices", "cable", "test", "live", "tools", "write", "switch"],
        requires_write=True,
        handler=handle_devices_create_cable_test,
    ),
    create_tool(
        name="meraki_devices_get_cable_test_result",
        description="""Get cable test results""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "test_id": {
                        "type": "string",
                        "description": "Cable test ID"
            }
},
        required=["serial", "test_id"],
        tags=["meraki", "devices", "cable", "test", "result", "read"],
        requires_write=False,
        handler=handle_devices_get_cable_test_result,
    ),
    create_tool(
        name="meraki_devices_create_throughput_test",
        description="""Run a throughput test on a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "throughput", "test", "live", "tools", "write", "speed"],
        requires_write=True,
        handler=handle_devices_create_throughput_test,
    ),
    create_tool(
        name="meraki_devices_get_throughput_test_result",
        description="""Get throughput test results""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "test_id": {
                        "type": "string",
                        "description": "Throughput test ID"
            }
},
        required=["serial", "test_id"],
        tags=["meraki", "devices", "throughput", "test", "result", "read"],
        requires_write=False,
        handler=handle_devices_get_throughput_test_result,
    ),
    create_tool(
        name="meraki_devices_create_arp_table",
        description="""Get the ARP table from a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "arp", "table", "live", "tools", "read"],
        requires_write=False,
        handler=handle_devices_create_arp_table,
    ),
    create_tool(
        name="meraki_devices_get_arp_table_result",
        description="""Get ARP table request results""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "arp_table_id": {
                        "type": "string",
                        "description": "ARP table request ID"
            }
},
        required=["serial", "arp_table_id"],
        tags=["meraki", "devices", "arp", "table", "result", "read"],
        requires_write=False,
        handler=handle_devices_get_arp_table_result,
    ),
    create_tool(
        name="meraki_devices_create_routing_table",
        description="""Get the routing table from a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "routing", "table", "live", "tools", "read"],
        requires_write=False,
        handler=handle_devices_create_routing_table,
    ),
    create_tool(
        name="meraki_devices_get_routing_table_result",
        description="""Get routing table request results""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "routing_table_id": {
                        "type": "string",
                        "description": "Routing table request ID"
            }
},
        required=["serial", "routing_table_id"],
        tags=["meraki", "devices", "routing", "table", "result", "read"],
        requires_write=False,
        handler=handle_devices_get_routing_table_result,
    ),
    create_tool(
        name="meraki_devices_create_mac_table",
        description="""Get the MAC address table from a switch""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "mac", "table", "live", "tools", "read", "switch"],
        requires_write=False,
        handler=handle_devices_create_mac_table,
    ),
    create_tool(
        name="meraki_devices_get_mac_table_result",
        description="""Get MAC table request results""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "mac_table_id": {
                        "type": "string",
                        "description": "MAC table request ID"
            }
},
        required=["serial", "mac_table_id"],
        tags=["meraki", "devices", "mac", "table", "result", "read"],
        requires_write=False,
        handler=handle_devices_get_mac_table_result,
    ),
    create_tool(
        name="meraki_devices_create_wake_on_lan",
        description="""Send a Wake-on-LAN packet to a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "vlanId": {
                        "type": "integer",
                        "description": "VLAN ID"
            },
            "mac": {
                        "type": "string",
                        "description": "Target MAC address"
            }
},
        required=["serial", "vlanId", "mac"],
        tags=["meraki", "devices", "wake", "lan", "wol", "write"],
        requires_write=True,
        handler=handle_devices_create_wake_on_lan,
    ),
    create_tool(
        name="meraki_devices_get_cellular_sims",
        description="""Get cellular SIM information for a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                "type": "string",
                "description": "Device serial number"
            }
        },
        required=["serial"],
        tags=["meraki", "devices", "cellular", "sims", "read", "mobile"],
        requires_write=False,
        handler=handle_devices_get_cellular_sims,
    ),
    create_tool(
        name="meraki_devices_update_cellular_sims",
        description="""Update cellular SIM settings""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "sims": {
                        "type": "array",
                        "description": "SIM configurations",
                        "items": {
                                    "type": "object"
                        }
            },
            "simOrdering": {
                        "type": "array",
                        "description": "SIM priority ordering",
                        "items": {
                                    "type": "string"
                        }
            },
            "simFailover": {
                        "type": "object",
                        "description": "SIM failover settings"
            }
},
        required=["serial"],
        tags=["meraki", "devices", "cellular", "sims", "update", "write"],
        requires_write=True,
        handler=handle_devices_update_cellular_sims,
    ),
    create_tool(
        name="meraki_devices_get_loss_latency_history",
        description="""Get packet loss and latency history for a device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            },
            "ip": {
                        "type": "string",
                        "description": "Target IP"
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
                        "description": "Data resolution in seconds"
            },
            "uplink": {
                        "type": "string",
                        "description": "Uplink (wan1, wan2, cellular)"
            }
},
        required=["serial", "ip"],
        tags=["meraki", "devices", "loss", "latency", "history", "read", "performance"],
        requires_write=False,
        handler=handle_devices_get_loss_latency_history,
    ),
    create_tool(
        name="meraki_devices_get_sensor_readings",
        description="""Get sensor readings from a sensor device""",
        platform="meraki",
        category="devices",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial number"
            }
},
        required=["serial"],
        tags=["meraki", "devices", "sensor", "readings", "read", "environmental"],
        requires_write=False,
        handler=handle_devices_get_sensor_readings,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_devices_tools():
    """Register all devices tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_DEVICES_TOOLS)
    logger.info(f"Registered {len(MERAKI_DEVICES_TOOLS)} meraki devices tools")


# Auto-register on import
register_devices_tools()
