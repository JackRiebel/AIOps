"""
Meraki Devices skill module.

Provides skills for device-level operations including:
- Device management (get, update, reboot, blink LEDs)
- Live tools (ping, cable test, throughput test, etc.)
- Management interface configuration
- LLDP/CDP neighbor discovery
- Cellular SIM management
- Loss and latency monitoring
"""

import logging
from typing import List, Dict, Any

from src.a2a.types import AgentSkill
from src.a2a.specialists.base_specialist import AgentExecutionContext, SkillResult
from src.services.meraki_api import MerakiAPIClient

from .base import (
    MerakiSkillModule,
    create_skill,
    build_input_schema,
    success_result,
    error_result,
    api_get,
    api_post,
    api_put,
    extract_device_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    DEVICE_SERIAL_SCHEMA,
)

logger = logging.getLogger(__name__)


class DevicesModule(MerakiSkillModule):
    """Meraki Devices skill module."""

    MODULE_NAME = "devices"
    MODULE_PREFIX = "devices_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Return all device skills."""
        return [
            # -----------------------------------------------------------------
            # Device Management
            # -----------------------------------------------------------------
            create_skill(
                id="devices_get",
                name="Get Device",
                description="Get details of a specific device by serial number or model name",
                tags=[
                    "meraki", "devices", "get", "read", "details", "info", "serial",
                    # Device model families
                    "mx", "mr", "ms", "mv", "mt", "mg", "appliance", "switch", "ap", "access point", "camera", "sensor", "gateway",
                    # Common MX appliance models
                    "mx68", "mx67", "mx64", "mx84", "mx85", "mx95", "mx100", "mx105", "mx250", "mx450",
                    # Common MR access point models
                    "mr36", "mr44", "mr46", "mr56", "mr57", "mr76", "mr86",
                    # Common MS switch models
                    "ms120", "ms125", "ms210", "ms225", "ms250", "ms350", "ms355", "ms390", "ms410", "ms425",
                    # Common MV camera models
                    "mv12", "mv22", "mv32", "mv52", "mv72", "mv93",
                    # Common MT sensor models
                    "mt10", "mt11", "mt12", "mt14", "mt15", "mt20", "mt30",
                    # Common MG cellular gateway models
                    "mg21", "mg41", "mg51",
                ],
                examples=[
                    "Get device details",
                    "Show device info",
                    "Get device by serial",
                    "Tell me about the MX68",
                    "Get details on MX68",
                    "Show MX details",
                    "Get AP information",
                    "Show switch details",
                    "Get camera info",
                    "What is the status of the MR46?",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_update",
                name="Update Device",
                description="Update device settings like name, address, notes, tags",
                tags=["meraki", "devices", "update", "write"],
                examples=[
                    "Update device name",
                    "Change device settings",
                    "Set device address",
                    "Add tags to device",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "name": {"type": "string", "description": "Device name"},
                        "lat": {"type": "number", "description": "Latitude"},
                        "lng": {"type": "number", "description": "Longitude"},
                        "address": {"type": "string", "description": "Physical address"},
                        "notes": {"type": "string", "description": "Notes about device"},
                        "tags": {"type": "array", "description": "Device tags", "items": {"type": "string"}},
                        "moveMapMarker": {"type": "boolean", "description": "Move map marker"},
                        "switchProfileId": {"type": "string", "description": "Switch profile ID"},
                        "floorPlanId": {"type": "string", "description": "Floor plan ID"},
                    },
                    required=["serial"],
                ),
            ),
            create_skill(
                id="devices_blink_leds",
                name="Blink Device LEDs",
                description="Blink the LEDs on a device for identification",
                tags=["meraki", "devices", "leds", "blink", "write", "identify"],
                examples=[
                    "Blink device LEDs",
                    "Make device blink",
                    "Identify device",
                    "Flash LEDs on device",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "duration": {"type": "integer", "description": "Duration in seconds (default 20)"},
                        "period": {"type": "integer", "description": "Blink period in ms"},
                        "duty": {"type": "integer", "description": "Duty cycle (1-100)"},
                    },
                    required=["serial"],
                ),
            ),
            create_skill(
                id="devices_reboot",
                name="Reboot Device",
                description="Reboot a device",
                tags=["meraki", "devices", "reboot", "write", "restart"],
                examples=[
                    "Reboot device",
                    "Restart device",
                    "Power cycle device",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_get_clients",
                name="Get Device Clients",
                description="Get clients connected to a specific device",
                tags=["meraki", "devices", "clients", "list", "read"],
                examples=[
                    "Get clients on device",
                    "Who is connected to this device?",
                    "Show device clients",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "t0": {"type": "string", "description": "Start time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                    },
                    required=["serial"],
                ),
            ),
            create_skill(
                id="devices_get_lldp_cdp",
                name="Get LLDP/CDP Neighbors",
                description="Get LLDP and CDP neighbor information for a device",
                tags=["meraki", "devices", "lldp", "cdp", "neighbors", "read", "discovery"],
                examples=[
                    "Get LLDP neighbors",
                    "Show CDP neighbors",
                    "What is connected to this device?",
                    "Get device neighbors",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),

            # -----------------------------------------------------------------
            # Management Interface
            # -----------------------------------------------------------------
            create_skill(
                id="devices_get_management_interface",
                name="Get Management Interface",
                description="Get management interface settings for a device",
                tags=["meraki", "devices", "management", "interface", "read", "network"],
                examples=[
                    "Get management interface",
                    "Show management IP settings",
                    "Get device management config",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_update_management_interface",
                name="Update Management Interface",
                description="Update management interface settings",
                tags=["meraki", "devices", "management", "interface", "update", "write"],
                examples=[
                    "Update management interface",
                    "Change management IP",
                    "Configure management VLAN",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "wan1": {"type": "object", "description": "WAN1 settings"},
                        "wan2": {"type": "object", "description": "WAN2 settings"},
                    },
                    required=["serial"],
                ),
            ),

            # -----------------------------------------------------------------
            # Live Tools
            # -----------------------------------------------------------------
            create_skill(
                id="devices_create_ping",
                name="Ping from Device",
                description="Start a ping test from a device to a target",
                tags=["meraki", "devices", "ping", "live", "tools", "write", "test"],
                examples=[
                    "Ping from device",
                    "Test connectivity from device",
                    "Run ping test",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "target": {"type": "string", "description": "Target IP or hostname"},
                        "count": {"type": "integer", "description": "Number of pings"},
                    },
                    required=["serial", "target"],
                ),
            ),
            create_skill(
                id="devices_get_ping_result",
                name="Get Ping Result",
                description="Get the result of a ping test",
                tags=["meraki", "devices", "ping", "result", "read"],
                examples=[
                    "Get ping result",
                    "Show ping test results",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "ping_id": {"type": "string", "description": "Ping test ID"},
                    },
                    required=["serial", "ping_id"],
                ),
            ),
            create_skill(
                id="devices_create_ping_device",
                name="Ping Device",
                description="Ping a device from the cloud",
                tags=["meraki", "devices", "ping", "live", "tools", "write"],
                examples=[
                    "Ping device from cloud",
                    "Check device reachability",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "count": {"type": "integer", "description": "Number of pings"},
                    },
                    required=["serial"],
                ),
            ),
            create_skill(
                id="devices_get_ping_device_result",
                name="Get Ping Device Result",
                description="Get result of pinging a device",
                tags=["meraki", "devices", "ping", "result", "read"],
                examples=[
                    "Get device ping result",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "ping_id": {"type": "string", "description": "Ping test ID"},
                    },
                    required=["serial", "ping_id"],
                ),
            ),
            create_skill(
                id="devices_create_cable_test",
                name="Run Cable Test",
                description="Run a cable test on switch ports",
                tags=["meraki", "devices", "cable", "test", "live", "tools", "write", "switch"],
                examples=[
                    "Run cable test",
                    "Test cable on ports",
                    "Check cable status",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "ports": {"type": "array", "description": "Ports to test", "items": {"type": "string"}},
                    },
                    required=["serial", "ports"],
                ),
            ),
            create_skill(
                id="devices_get_cable_test_result",
                name="Get Cable Test Result",
                description="Get cable test results",
                tags=["meraki", "devices", "cable", "test", "result", "read"],
                examples=[
                    "Get cable test result",
                    "Show cable test results",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "test_id": {"type": "string", "description": "Cable test ID"},
                    },
                    required=["serial", "test_id"],
                ),
            ),
            create_skill(
                id="devices_create_throughput_test",
                name="Run Throughput Test",
                description="Run a throughput test on a device",
                tags=["meraki", "devices", "throughput", "test", "live", "tools", "write", "speed"],
                examples=[
                    "Run throughput test",
                    "Test device speed",
                    "Check throughput",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_get_throughput_test_result",
                name="Get Throughput Test Result",
                description="Get throughput test results",
                tags=["meraki", "devices", "throughput", "test", "result", "read"],
                examples=[
                    "Get throughput result",
                    "Show speed test results",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "test_id": {"type": "string", "description": "Throughput test ID"},
                    },
                    required=["serial", "test_id"],
                ),
            ),
            create_skill(
                id="devices_create_arp_table",
                name="Get ARP Table",
                description="Get the ARP table from a device",
                tags=["meraki", "devices", "arp", "table", "live", "tools", "read"],
                examples=[
                    "Get ARP table",
                    "Show ARP entries",
                    "View ARP cache",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_get_arp_table_result",
                name="Get ARP Table Result",
                description="Get ARP table request results",
                tags=["meraki", "devices", "arp", "table", "result", "read"],
                examples=[
                    "Get ARP table result",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "arp_table_id": {"type": "string", "description": "ARP table request ID"},
                    },
                    required=["serial", "arp_table_id"],
                ),
            ),
            create_skill(
                id="devices_create_routing_table",
                name="Get Routing Table",
                description="Get the routing table from a device",
                tags=["meraki", "devices", "routing", "table", "live", "tools", "read"],
                examples=[
                    "Get routing table",
                    "Show routes",
                    "View routing entries",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_get_routing_table_result",
                name="Get Routing Table Result",
                description="Get routing table request results",
                tags=["meraki", "devices", "routing", "table", "result", "read"],
                examples=[
                    "Get routing table result",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "routing_table_id": {"type": "string", "description": "Routing table request ID"},
                    },
                    required=["serial", "routing_table_id"],
                ),
            ),
            create_skill(
                id="devices_create_mac_table",
                name="Get MAC Table",
                description="Get the MAC address table from a switch",
                tags=["meraki", "devices", "mac", "table", "live", "tools", "read", "switch"],
                examples=[
                    "Get MAC table",
                    "Show MAC addresses",
                    "View MAC address table",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_get_mac_table_result",
                name="Get MAC Table Result",
                description="Get MAC table request results",
                tags=["meraki", "devices", "mac", "table", "result", "read"],
                examples=[
                    "Get MAC table result",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "mac_table_id": {"type": "string", "description": "MAC table request ID"},
                    },
                    required=["serial", "mac_table_id"],
                ),
            ),
            create_skill(
                id="devices_create_wake_on_lan",
                name="Wake on LAN",
                description="Send a Wake-on-LAN packet to a device",
                tags=["meraki", "devices", "wake", "lan", "wol", "write"],
                examples=[
                    "Wake device",
                    "Send WOL packet",
                    "Wake on LAN",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "vlanId": {"type": "integer", "description": "VLAN ID"},
                        "mac": {"type": "string", "description": "Target MAC address"},
                    },
                    required=["serial", "vlanId", "mac"],
                ),
            ),

            # -----------------------------------------------------------------
            # Cellular SIMs
            # -----------------------------------------------------------------
            create_skill(
                id="devices_get_cellular_sims",
                name="Get Cellular SIMs",
                description="Get cellular SIM information for a device",
                tags=["meraki", "devices", "cellular", "sims", "read", "mobile"],
                examples=[
                    "Get cellular SIMs",
                    "Show SIM information",
                    "Get cellular config",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="devices_update_cellular_sims",
                name="Update Cellular SIMs",
                description="Update cellular SIM settings",
                tags=["meraki", "devices", "cellular", "sims", "update", "write"],
                examples=[
                    "Update cellular SIMs",
                    "Configure SIM settings",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "sims": {"type": "array", "description": "SIM configurations", "items": {"type": "object"}},
                        "simOrdering": {"type": "array", "description": "SIM priority ordering", "items": {"type": "string"}},
                        "simFailover": {"type": "object", "description": "SIM failover settings"},
                    },
                    required=["serial"],
                ),
            ),

            # -----------------------------------------------------------------
            # Loss and Latency
            # -----------------------------------------------------------------
            create_skill(
                id="devices_get_loss_latency_history",
                name="Get Loss and Latency History",
                description="Get packet loss and latency history for a device",
                tags=["meraki", "devices", "loss", "latency", "history", "read", "performance"],
                examples=[
                    "Get loss and latency",
                    "Show packet loss history",
                    "Check device latency",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                        "ip": {"type": "string", "description": "Target IP"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "resolution": {"type": "integer", "description": "Data resolution in seconds"},
                        "uplink": {"type": "string", "description": "Uplink (wan1, wan2, cellular)"},
                    },
                    required=["serial", "ip"],
                ),
            ),

            # -----------------------------------------------------------------
            # Sensor Readings (for environmental sensors)
            # -----------------------------------------------------------------
            create_skill(
                id="devices_get_sensor_readings",
                name="Get Sensor Readings",
                description="Get sensor readings from a sensor device",
                tags=["meraki", "devices", "sensor", "readings", "read", "environmental"],
                examples=[
                    "Get sensor readings",
                    "Show temperature/humidity",
                    "Check sensor data",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial number"},
                    },
                    required=["serial"],
                ),
            ),
        ]

    # =========================================================================
    # Skill Execution
    # =========================================================================

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: MerakiAPIClient,
        params: Dict[str, Any],
        context: AgentExecutionContext,
    ) -> SkillResult:
        """Execute a device skill."""
        log_skill_start(cls.MODULE_NAME, skill_id, params)

        try:
            # Device Management
            if skill_id == "devices_get":
                return await cls._get_device(client, params, context)
            elif skill_id == "devices_update":
                return await cls._update_device(client, params, context)
            elif skill_id == "devices_blink_leds":
                return await cls._blink_leds(client, params, context)
            elif skill_id == "devices_reboot":
                return await cls._reboot_device(client, params, context)
            elif skill_id == "devices_get_clients":
                return await cls._get_clients(client, params, context)
            elif skill_id == "devices_get_lldp_cdp":
                return await cls._get_lldp_cdp(client, params, context)

            # Management Interface
            elif skill_id == "devices_get_management_interface":
                return await cls._get_management_interface(client, params, context)
            elif skill_id == "devices_update_management_interface":
                return await cls._update_management_interface(client, params, context)

            # Live Tools - Ping
            elif skill_id == "devices_create_ping":
                return await cls._create_ping(client, params, context)
            elif skill_id == "devices_get_ping_result":
                return await cls._get_ping_result(client, params, context)
            elif skill_id == "devices_create_ping_device":
                return await cls._create_ping_device(client, params, context)
            elif skill_id == "devices_get_ping_device_result":
                return await cls._get_ping_device_result(client, params, context)

            # Live Tools - Cable Test
            elif skill_id == "devices_create_cable_test":
                return await cls._create_cable_test(client, params, context)
            elif skill_id == "devices_get_cable_test_result":
                return await cls._get_cable_test_result(client, params, context)

            # Live Tools - Throughput
            elif skill_id == "devices_create_throughput_test":
                return await cls._create_throughput_test(client, params, context)
            elif skill_id == "devices_get_throughput_test_result":
                return await cls._get_throughput_test_result(client, params, context)

            # Live Tools - Tables
            elif skill_id == "devices_create_arp_table":
                return await cls._create_arp_table(client, params, context)
            elif skill_id == "devices_get_arp_table_result":
                return await cls._get_arp_table_result(client, params, context)
            elif skill_id == "devices_create_routing_table":
                return await cls._create_routing_table(client, params, context)
            elif skill_id == "devices_get_routing_table_result":
                return await cls._get_routing_table_result(client, params, context)
            elif skill_id == "devices_create_mac_table":
                return await cls._create_mac_table(client, params, context)
            elif skill_id == "devices_get_mac_table_result":
                return await cls._get_mac_table_result(client, params, context)

            # Wake on LAN
            elif skill_id == "devices_create_wake_on_lan":
                return await cls._create_wake_on_lan(client, params, context)

            # Cellular SIMs
            elif skill_id == "devices_get_cellular_sims":
                return await cls._get_cellular_sims(client, params, context)
            elif skill_id == "devices_update_cellular_sims":
                return await cls._update_cellular_sims(client, params, context)

            # Loss and Latency
            elif skill_id == "devices_get_loss_latency_history":
                return await cls._get_loss_latency_history(client, params, context)

            # Sensor Readings
            elif skill_id == "devices_get_sensor_readings":
                return await cls._get_sensor_readings(client, params, context)

            else:
                return error_result(f"Unknown skill: {skill_id}")

        except Exception as e:
            log_skill_error(cls.MODULE_NAME, skill_id, str(e))
            return error_result(str(e))

    # =========================================================================
    # Skill Handlers - Device Management
    # =========================================================================

    @classmethod
    async def _get_device(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial") or params.get("device_serial")
        device_name = params.get("device_name") or params.get("name")
        device_model = params.get("device_model")

        # Build search terms from params
        search_terms = []
        if device_name:
            search_terms.append(device_name.lower())
        if device_model:
            search_terms.append(device_model.lower())

        # If no serial, try to look up by device name/model from context or API
        if not serial:
            # Check if we have cached devices in context
            if context.cached_devices and search_terms:
                # Search cached devices
                for device in context.cached_devices:
                    dev_name = device.get("name", "").lower()
                    dev_model = device.get("model", "").lower()
                    dev_serial = device.get("serial", "")

                    for term in search_terms:
                        if term in dev_name or term == dev_model.lower():
                            serial = dev_serial
                            logger.info(f"[DevicesModule] Resolved device '{term}' to serial: {serial}")
                            break
                    if serial:
                        break

            # If still no serial, try to fetch from org and find by model/name
            if not serial and context.org_id and search_terms:
                try:
                    logger.info(f"[DevicesModule] Looking up device by model/name in org {context.org_id}, search terms: {search_terms}")
                    org_devices = await api_get(client, f"/organizations/{context.org_id}/devices")
                    if org_devices:
                        for device in org_devices:
                            dev_name = device.get("name", "").lower()
                            dev_model = device.get("model", "").lower()
                            dev_serial = device.get("serial", "")

                            for term in search_terms:
                                if term in dev_name or term == dev_model.lower():
                                    serial = dev_serial
                                    logger.info(f"[DevicesModule] Found device '{term}' via org lookup: {serial} (name: {device.get('name')})")
                                    break
                            if serial:
                                break
                except Exception as e:
                    logger.warning(f"[DevicesModule] Failed to lookup device from org: {e}")

        if not serial:
            return error_result("serial is required - please provide the device serial number or specify a device by model name (e.g., MX68, MR36)")

        data = await api_get(client, f"/devices/{serial}")
        log_skill_success(cls.MODULE_NAME, "devices_get")
        return success_result(data=data, entities=extract_device_entities(data))

    @classmethod
    async def _update_device(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        body = {k: params[k] for k in ["name", "lat", "lng", "address", "notes", "tags", "moveMapMarker", "switchProfileId", "floorPlanId"] if params.get(k) is not None}
        if not body:
            return error_result("No update parameters provided")
        data = await api_put(client, f"/devices/{serial}", data=body)
        log_skill_success(cls.MODULE_NAME, "devices_update")
        return success_result(data=data)

    @classmethod
    async def _blink_leds(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        body = {k: params[k] for k in ["duration", "period", "duty"] if params.get(k)}
        data = await api_post(client, f"/devices/{serial}/blinkLeds", data=body)
        log_skill_success(cls.MODULE_NAME, "devices_blink_leds")
        return success_result(data=data)

    @classmethod
    async def _reboot_device(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_post(client, f"/devices/{serial}/reboot", data={})
        log_skill_success(cls.MODULE_NAME, "devices_reboot")
        return success_result(data=data)

    @classmethod
    async def _get_clients(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        query_params = {k: params[k] for k in ["t0", "timespan"] if params.get(k)}
        data = await api_get(client, f"/devices/{serial}/clients", params=query_params)
        log_skill_success(cls.MODULE_NAME, "devices_get_clients", len(data) if isinstance(data, list) else 1)
        return success_result(data=data)

    @classmethod
    async def _get_lldp_cdp(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_get(client, f"/devices/{serial}/lldpCdp")
        log_skill_success(cls.MODULE_NAME, "devices_get_lldp_cdp")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Management Interface
    # =========================================================================

    @classmethod
    async def _get_management_interface(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_get(client, f"/devices/{serial}/managementInterface")
        return success_result(data=data)

    @classmethod
    async def _update_management_interface(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        body = {k: params[k] for k in ["wan1", "wan2"] if params.get(k)}
        data = await api_put(client, f"/devices/{serial}/managementInterface", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Live Tools
    # =========================================================================

    @classmethod
    async def _create_ping(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        target = params.get("target")
        if not serial or not target:
            return error_result("serial and target are required")
        body = {"target": target}
        if params.get("count"):
            body["count"] = params["count"]
        data = await api_post(client, f"/devices/{serial}/liveTools/ping", data=body)
        return success_result(data=data, follow_up="Use devices_get_ping_result to get the test results")

    @classmethod
    async def _get_ping_result(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        ping_id = params.get("ping_id")
        if not serial or not ping_id:
            return error_result("serial and ping_id are required")
        data = await api_get(client, f"/devices/{serial}/liveTools/ping/{ping_id}")
        return success_result(data=data)

    @classmethod
    async def _create_ping_device(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        body = {}
        if params.get("count"):
            body["count"] = params["count"]
        data = await api_post(client, f"/devices/{serial}/liveTools/pingDevice", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_ping_device_result(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        ping_id = params.get("ping_id")
        if not serial or not ping_id:
            return error_result("serial and ping_id are required")
        data = await api_get(client, f"/devices/{serial}/liveTools/pingDevice/{ping_id}")
        return success_result(data=data)

    @classmethod
    async def _create_cable_test(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        ports = params.get("ports")
        if not serial or not ports:
            return error_result("serial and ports are required")
        data = await api_post(client, f"/devices/{serial}/liveTools/cableTest", data={"ports": ports})
        return success_result(data=data)

    @classmethod
    async def _get_cable_test_result(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        test_id = params.get("test_id")
        if not serial or not test_id:
            return error_result("serial and test_id are required")
        data = await api_get(client, f"/devices/{serial}/liveTools/cableTest/{test_id}")
        return success_result(data=data)

    @classmethod
    async def _create_throughput_test(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_post(client, f"/devices/{serial}/liveTools/throughputTest", data={})
        return success_result(data=data)

    @classmethod
    async def _get_throughput_test_result(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        test_id = params.get("test_id")
        if not serial or not test_id:
            return error_result("serial and test_id are required")
        data = await api_get(client, f"/devices/{serial}/liveTools/throughputTest/{test_id}")
        return success_result(data=data)

    @classmethod
    async def _create_arp_table(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_post(client, f"/devices/{serial}/liveTools/arpTable", data={})
        return success_result(data=data)

    @classmethod
    async def _get_arp_table_result(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        arp_id = params.get("arp_table_id")
        if not serial or not arp_id:
            return error_result("serial and arp_table_id are required")
        data = await api_get(client, f"/devices/{serial}/liveTools/arpTable/{arp_id}")
        return success_result(data=data)

    @classmethod
    async def _create_routing_table(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_post(client, f"/devices/{serial}/liveTools/routingTable", data={})
        return success_result(data=data)

    @classmethod
    async def _get_routing_table_result(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        rt_id = params.get("routing_table_id")
        if not serial or not rt_id:
            return error_result("serial and routing_table_id are required")
        data = await api_get(client, f"/devices/{serial}/liveTools/routingTable/{rt_id}")
        return success_result(data=data)

    @classmethod
    async def _create_mac_table(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_post(client, f"/devices/{serial}/liveTools/macTable", data={})
        return success_result(data=data)

    @classmethod
    async def _get_mac_table_result(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        mac_id = params.get("mac_table_id")
        if not serial or not mac_id:
            return error_result("serial and mac_table_id are required")
        data = await api_get(client, f"/devices/{serial}/liveTools/macTable/{mac_id}")
        return success_result(data=data)

    @classmethod
    async def _create_wake_on_lan(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        vlan_id = params.get("vlanId")
        mac = params.get("mac")
        if not serial or vlan_id is None or not mac:
            return error_result("serial, vlanId, and mac are required")
        data = await api_post(client, f"/devices/{serial}/liveTools/wakeOnLan", data={"vlanId": vlan_id, "mac": mac})
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Cellular SIMs
    # =========================================================================

    @classmethod
    async def _get_cellular_sims(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_get(client, f"/devices/{serial}/cellularSims")
        return success_result(data=data)

    @classmethod
    async def _update_cellular_sims(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        body = {k: params[k] for k in ["sims", "simOrdering", "simFailover"] if params.get(k)}
        data = await api_put(client, f"/devices/{serial}/cellularSims", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Loss and Latency
    # =========================================================================

    @classmethod
    async def _get_loss_latency_history(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        ip = params.get("ip")
        if not serial or not ip:
            return error_result("serial and ip are required")
        query_params = {"ip": ip}
        for k in ["t0", "t1", "timespan", "resolution", "uplink"]:
            if params.get(k):
                query_params[k] = params[k]
        data = await api_get(client, f"/devices/{serial}/lossAndLatencyHistory", params=query_params)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Sensor Readings
    # =========================================================================

    @classmethod
    async def _get_sensor_readings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        # Sensor readings are typically retrieved via the sensor API endpoints
        # This is a simplified version that gets device-specific sensor data
        data = await api_get(client, f"/devices/{serial}/sensor/readings/latest")
        return success_result(data=data)
