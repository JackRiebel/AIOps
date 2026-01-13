"""Catalyst Center Interfaces skill module.

This module provides skills for network interface management including:
- Interface inventory and details
- Interface statistics
- VLAN information
- OSPF/ISIS interface details
- Interface operations

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!interfaces
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    CatalystSkillModule,
    CatalystAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    empty_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    DEVICE_ID_SCHEMA,
    INTERFACE_ID_SCHEMA,
    DEVICE_IP_SCHEMA,
    VLAN_ID_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
)


# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

INTERFACES_SKILLS: List[SkillDefinition] = [
    {
        "id": "interfaces_get_all",
        "name": "Get All Interfaces",
        "description": (
            "Get a list of all network interfaces across all devices in Catalyst Center. "
            "Returns interface details including status, speed, duplex, and VLAN assignment."
        ),
        "tags": ["catalyst", "interfaces", "inventory", "list"],
        "examples": [
            "List all interfaces",
            "Show all network interfaces",
            "Get interface inventory",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "interfaces_get_by_id",
        "name": "Get Interface by ID",
        "description": (
            "Get detailed information about a specific interface using its UUID."
        ),
        "tags": ["catalyst", "interfaces", "details"],
        "examples": [
            "Get interface details",
            "Show interface by ID",
            "Interface information",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "interface_id": {
                    **INTERFACE_ID_SCHEMA,
                    "description": "Interface UUID to retrieve"
                },
            },
            "required": ["interface_id"],
        },
    },
    {
        "id": "interfaces_get_by_ip",
        "name": "Get Interface by IP",
        "description": (
            "Get interface information using the IP address configured on the interface."
        ),
        "tags": ["catalyst", "interfaces", "ip", "lookup"],
        "examples": [
            "Find interface by IP",
            "Get interface at IP address",
            "Look up interface IP",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "ip_address": {
                    **DEVICE_IP_SCHEMA,
                    "description": "IP address configured on the interface"
                },
            },
            "required": ["ip_address"],
        },
    },
    {
        "id": "interfaces_get_by_device",
        "name": "Get Device Interfaces",
        "description": (
            "Get all interfaces for a specific network device. Returns complete "
            "interface inventory for the device including status and configuration."
        ),
        "tags": ["catalyst", "interfaces", "device", "inventory"],
        "examples": [
            "Show device interfaces",
            "List interfaces on device",
            "Get interfaces for switch",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get interfaces for"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "interfaces_get_by_range",
        "name": "Get Interfaces by Range",
        "description": (
            "Get interfaces for a device with pagination support. Useful for "
            "devices with many interfaces."
        ),
        "tags": ["catalyst", "interfaces", "pagination", "range"],
        "examples": [
            "Get interfaces with pagination",
            "List interfaces starting at index",
            "Paginate device interfaces",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID"
                },
                "start_index": {
                    "type": "integer",
                    "description": "Starting index (1-based)",
                    "default": 1
                },
                "records_to_return": {
                    "type": "integer",
                    "description": "Number of records to return",
                    "default": 500
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "interfaces_get_count",
        "name": "Get Interface Count",
        "description": (
            "Get the total count of interfaces in Catalyst Center inventory."
        ),
        "tags": ["catalyst", "interfaces", "count", "statistics"],
        "examples": [
            "How many interfaces?",
            "Count all interfaces",
            "Interface count",
        ],
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "id": "interfaces_get_by_name",
        "name": "Get Interface by Name",
        "description": (
            "Get interface details by interface name for a specific device."
        ),
        "tags": ["catalyst", "interfaces", "name", "lookup"],
        "examples": [
            "Find interface by name",
            "Get GigabitEthernet0/1",
            "Show interface Gig1/0/1",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID"
                },
                "interface_name": {
                    "type": "string",
                    "description": "Interface name (e.g., 'GigabitEthernet1/0/1')"
                },
            },
            "required": ["device_id", "interface_name"],
        },
    },
    {
        "id": "interfaces_update",
        "name": "Update Interface",
        "description": (
            "Update interface configuration including description, admin status, "
            "VLAN assignment, and voice VLAN."
        ),
        "tags": ["catalyst", "interfaces", "update", "configure"],
        "examples": [
            "Update interface description",
            "Change interface VLAN",
            "Modify interface settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "interface_id": {
                    **INTERFACE_ID_SCHEMA,
                    "description": "Interface UUID to update"
                },
                "description": {
                    "type": "string",
                    "description": "New interface description"
                },
                "admin_status": {
                    "type": "string",
                    "description": "Administrative status",
                    "enum": ["UP", "DOWN"]
                },
                "vlan_id": {
                    **VLAN_ID_SCHEMA,
                    "description": "Access VLAN ID"
                },
                "voice_vlan_id": {
                    "type": "string",
                    "description": "Voice VLAN ID"
                },
            },
            "required": ["interface_id"],
        },
    },
    {
        "id": "interfaces_get_vlans",
        "name": "Get Device VLANs",
        "description": (
            "Get VLAN information for a specific device including VLAN IDs, "
            "names, and associated interfaces."
        ),
        "tags": ["catalyst", "interfaces", "vlans", "device"],
        "examples": [
            "Show VLANs on device",
            "Get device VLAN list",
            "List VLANs",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get VLANs for"
                },
                "interface_type": {
                    "type": "string",
                    "description": "Filter by interface type"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "interfaces_get_ospf",
        "name": "Get OSPF Interfaces",
        "description": (
            "Get interfaces running OSPF (Open Shortest Path First) routing protocol."
        ),
        "tags": ["catalyst", "interfaces", "ospf", "routing"],
        "examples": [
            "Show OSPF interfaces",
            "Get OSPF enabled ports",
            "List OSPF interfaces",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "interfaces_get_isis",
        "name": "Get IS-IS Interfaces",
        "description": (
            "Get interfaces running IS-IS (Intermediate System to Intermediate System) "
            "routing protocol."
        ),
        "tags": ["catalyst", "interfaces", "isis", "routing"],
        "examples": [
            "Show IS-IS interfaces",
            "Get IS-IS enabled ports",
            "List IS-IS interfaces",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "interfaces_clear_mac_table",
        "name": "Clear Interface MAC Table",
        "description": (
            "Clear the MAC address table on a specific interface. Triggers re-learning "
            "of MAC addresses on the port."
        ),
        "tags": ["catalyst", "interfaces", "mac", "clear", "operation"],
        "examples": [
            "Clear MAC table on interface",
            "Reset MAC address table",
            "Clear learned MACs",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "interface_id": {
                    **INTERFACE_ID_SCHEMA,
                    "description": "Interface UUID to clear MAC table for"
                },
                "operation": {
                    "type": "string",
                    "description": "Clear operation type",
                    "enum": ["clearMacAddress"],
                    "default": "clearMacAddress"
                },
                "deployment_mode": {
                    "type": "string",
                    "description": "Deployment mode",
                    "enum": ["Deploy", "Preview"],
                    "default": "Deploy"
                },
            },
            "required": ["interface_id"],
        },
    },
    {
        "id": "interfaces_get_statistics",
        "name": "Get Interface Statistics",
        "description": (
            "Get interface statistics including input/output packets, errors, "
            "discards, and bandwidth utilization."
        ),
        "tags": ["catalyst", "interfaces", "statistics", "metrics", "performance"],
        "examples": [
            "Show interface statistics",
            "Get interface metrics",
            "Interface performance data",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get statistics for"
                },
                "interface_id": {
                    **INTERFACE_ID_SCHEMA,
                    "description": "Specific interface UUID (optional)"
                },
                "start_time": {
                    "type": "integer",
                    "description": "Start time in epoch milliseconds"
                },
                "end_time": {
                    "type": "integer",
                    "description": "End time in epoch milliseconds"
                },
            },
            "required": [],
        },
    },
    {
        "id": "interfaces_query",
        "name": "Query Interfaces",
        "description": (
            "Advanced interface query with complex filtering using POST request. "
            "Supports filtering by multiple criteria."
        ),
        "tags": ["catalyst", "interfaces", "query", "search", "filter"],
        "examples": [
            "Search for interfaces",
            "Query interface inventory",
            "Advanced interface search",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of device UUIDs"
                },
                "interface_name": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of interface names"
                },
                "port_name": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of port names"
                },
                "admin_status": {
                    "type": "string",
                    "description": "Filter by admin status",
                    "enum": ["UP", "DOWN"]
                },
                "operational_status": {
                    "type": "string",
                    "description": "Filter by operational status",
                    "enum": ["up", "down"]
                },
            },
            "required": [],
        },
    },
    {
        "id": "interfaces_get_connected_device",
        "name": "Get Connected Device Details",
        "description": (
            "Get details about devices connected to a network device's interfaces, "
            "including CDP/LLDP neighbor information."
        ),
        "tags": ["catalyst", "interfaces", "neighbors", "cdp", "lldp", "connected"],
        "examples": [
            "Show connected devices",
            "Get CDP neighbors",
            "Show LLDP neighbors",
            "Connected device details",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get connected devices for"
                },
            },
            "required": ["device_id"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class InterfacesModule(CatalystSkillModule):
    """Network interface management skills module."""

    MODULE_NAME = "interfaces"
    MODULE_PREFIX = "interfaces_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all interface management skills."""
        return [create_skill(skill_def) for skill_def in INTERFACES_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute an interface management skill."""
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
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Internal skill execution dispatcher."""

        if skill_id == "interfaces_get_all":
            return await cls._get_all(client, params)

        if skill_id == "interfaces_get_by_id":
            return await cls._get_by_id(client, params)

        if skill_id == "interfaces_get_by_ip":
            return await cls._get_by_ip(client, params)

        if skill_id == "interfaces_get_by_device":
            return await cls._get_by_device(client, params)

        if skill_id == "interfaces_get_by_range":
            return await cls._get_by_range(client, params)

        if skill_id == "interfaces_get_count":
            return await cls._get_count(client, params)

        if skill_id == "interfaces_get_by_name":
            return await cls._get_by_name(client, params)

        if skill_id == "interfaces_update":
            return await cls._update(client, params)

        if skill_id == "interfaces_get_vlans":
            return await cls._get_vlans(client, params)

        if skill_id == "interfaces_get_ospf":
            return await cls._get_ospf(client, params)

        if skill_id == "interfaces_get_isis":
            return await cls._get_isis(client, params)

        if skill_id == "interfaces_clear_mac_table":
            return await cls._clear_mac_table(client, params)

        if skill_id == "interfaces_get_statistics":
            return await cls._get_statistics(client, params)

        if skill_id == "interfaces_query":
            return await cls._query(client, params)

        if skill_id == "interfaces_get_connected_device":
            return await cls._get_connected_device(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    # ========================================================================
    # SKILL IMPLEMENTATIONS
    # ========================================================================

    @classmethod
    async def _get_all(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get all interfaces."""
        query_params = {}

        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get("interface", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get interfaces"))

        data = response.get("data", {})
        interfaces = data.get("response", [])

        # Summarize interface statuses
        admin_up = sum(1 for i in interfaces if i.get("adminStatus") == "UP")
        oper_up = sum(1 for i in interfaces if i.get("status") == "up")

        return success_result(
            data={
                "interfaces": interfaces,
                "count": len(interfaces),
                "summary": {
                    "total": len(interfaces),
                    "admin_up": admin_up,
                    "admin_down": len(interfaces) - admin_up,
                    "operational_up": oper_up,
                    "operational_down": len(interfaces) - oper_up,
                },
            },
            entities={"interface_ids": [i.get("id") for i in interfaces]},
            follow_up="Would you like to see interface statistics or filter by device?"
        )

    @classmethod
    async def _get_by_id(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get interface by UUID."""
        interface_id = params.get("interface_id")

        response = await client.get(f"interface/{interface_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get interface"))

        data = response.get("data", {})
        interface = data.get("response", {})

        if not interface:
            return empty_result(f"Interface {interface_id} not found")

        return success_result(
            data={
                "interface": interface,
                "interface_id": interface_id,
            },
            follow_up="Would you like to see interface statistics?"
        )

    @classmethod
    async def _get_by_ip(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get interface by IP address."""
        ip_address = params.get("ip_address")

        response = await client.get(f"interface/ip-address/{ip_address}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get interface by IP"))

        data = response.get("data", {})
        interfaces = data.get("response", [])

        if not interfaces:
            return empty_result(f"No interface found with IP {ip_address}")

        return success_result(
            data={
                "interfaces": interfaces,
                "count": len(interfaces),
                "ip_address": ip_address,
            },
            entities={"interface_ids": [i.get("id") for i in interfaces]},
            follow_up="Would you like to see interface details?"
        )

    @classmethod
    async def _get_by_device(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get all interfaces for a device."""
        device_id = params.get("device_id")

        response = await client.get(f"interface/network-device/{device_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device interfaces"))

        data = response.get("data", {})
        interfaces = data.get("response", [])

        # Categorize interfaces
        interface_types = {}
        for iface in interfaces:
            iface_type = iface.get("interfaceType", "Unknown")
            interface_types[iface_type] = interface_types.get(iface_type, 0) + 1

        return success_result(
            data={
                "interfaces": interfaces,
                "count": len(interfaces),
                "device_id": device_id,
                "summary": {
                    "total": len(interfaces),
                    "by_type": interface_types,
                },
            },
            entities={"interface_ids": [i.get("id") for i in interfaces]},
            follow_up="Would you like to see VLANs or connected devices?"
        )

    @classmethod
    async def _get_by_range(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get interfaces by range."""
        device_id = params.get("device_id")
        start_index = params.get("start_index", 1)
        records_to_return = params.get("records_to_return", 500)

        response = await client.get(
            f"interface/{device_id}/{start_index}/{records_to_return}"
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get interfaces"))

        data = response.get("data", {})
        interfaces = data.get("response", [])

        return success_result(
            data={
                "interfaces": interfaces,
                "count": len(interfaces),
                "device_id": device_id,
                "start_index": start_index,
                "records_returned": len(interfaces),
            },
            entities={"interface_ids": [i.get("id") for i in interfaces]}
        )

    @classmethod
    async def _get_count(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get interface count."""
        response = await client.get("interface/count")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get interface count"))

        data = response.get("data", {})
        count = data.get("response", 0)

        return success_result(
            data={
                "count": count,
                "message": f"Total interfaces: {count}",
            }
        )

    @classmethod
    async def _get_by_name(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get interface by name."""
        device_id = params.get("device_id")
        interface_name = params.get("interface_name")

        response = await client.get(
            f"interface/network-device/{device_id}/interface-name",
            {"name": interface_name}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get interface by name"))

        data = response.get("data", {})
        interface = data.get("response", {})

        if not interface:
            return empty_result(f"Interface '{interface_name}' not found on device")

        return success_result(
            data={
                "interface": interface,
                "interface_name": interface_name,
                "device_id": device_id,
            },
            entities={"interface_id": interface.get("id")},
            follow_up="Would you like to see interface statistics?"
        )

    @classmethod
    async def _update(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Update interface configuration."""
        interface_id = params.get("interface_id")

        payload = {"id": interface_id}

        if params.get("description"):
            payload["description"] = params["description"]
        if params.get("admin_status"):
            payload["adminStatus"] = params["admin_status"]
        if params.get("vlan_id"):
            payload["vlanId"] = params["vlan_id"]
        if params.get("voice_vlan_id"):
            payload["voiceVlanId"] = params["voice_vlan_id"]

        response = await client.put("interface", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update interface"))

        data = response.get("data", {})

        # Handle async task
        if data.get("response", {}).get("taskId"):
            task_result = await client.get_task_result(data["response"]["taskId"])
            if not task_result.get("success"):
                return error_result(task_result.get("error", "Interface update failed"))

        return success_result(
            data={
                "message": f"Interface {interface_id} updated successfully",
            }
        )

    @classmethod
    async def _get_vlans(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get VLANs for a device."""
        device_id = params.get("device_id")
        query_params = {}

        if params.get("interface_type"):
            query_params["interfaceType"] = params["interface_type"]

        response = await client.get(f"network-device/{device_id}/vlan", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get VLANs"))

        data = response.get("data", {})
        vlans = data.get("response", [])

        return success_result(
            data={
                "vlans": vlans,
                "count": len(vlans),
                "device_id": device_id,
            },
            entities={"vlan_ids": [v.get("vlanNumber") for v in vlans]},
            follow_up="Would you like to see interfaces in a specific VLAN?"
        )

    @classmethod
    async def _get_ospf(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get OSPF interfaces."""
        query_params = {}

        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get("interface/ospf", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get OSPF interfaces"))

        data = response.get("data", {})
        interfaces = data.get("response", [])

        return success_result(
            data={
                "interfaces": interfaces,
                "count": len(interfaces),
            },
            entities={"interface_ids": [i.get("id") for i in interfaces]},
            follow_up="Would you like to see OSPF neighbor details?"
        )

    @classmethod
    async def _get_isis(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get IS-IS interfaces."""
        query_params = {}

        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get("interface/isis", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get IS-IS interfaces"))

        data = response.get("data", {})
        interfaces = data.get("response", [])

        return success_result(
            data={
                "interfaces": interfaces,
                "count": len(interfaces),
            },
            entities={"interface_ids": [i.get("id") for i in interfaces]}
        )

    @classmethod
    async def _clear_mac_table(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Clear MAC address table on interface."""
        interface_id = params.get("interface_id")
        deployment_mode = params.get("deployment_mode", "Deploy")

        payload = {
            "operation": "clearMacAddress",
            "deploymentMode": deployment_mode,
        }

        response = await client.post(
            f"interface/{interface_id}/operation/clearMacAddress",
            payload
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to clear MAC table"))

        data = response.get("data", {})

        # Handle async task
        if data.get("response", {}).get("taskId"):
            task_result = await client.get_task_result(data["response"]["taskId"])
            if not task_result.get("success"):
                return error_result(task_result.get("error", "Clear MAC table failed"))

        return success_result(
            data={
                "message": f"MAC table cleared on interface {interface_id}",
            }
        )

    @classmethod
    async def _get_statistics(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get interface statistics."""
        query_params = {}

        if params.get("device_id"):
            query_params["deviceId"] = params["device_id"]
        if params.get("interface_id"):
            query_params["interfaceId"] = params["interface_id"]
        if params.get("start_time"):
            query_params["startTime"] = params["start_time"]
        if params.get("end_time"):
            query_params["endTime"] = params["end_time"]

        response = await client.get("interface/statistics", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get interface statistics"))

        data = response.get("data", {})
        statistics = data.get("response", [])

        return success_result(
            data={
                "statistics": statistics,
                "count": len(statistics),
            },
            follow_up="Would you like to see error rates or utilization details?"
        )

    @classmethod
    async def _query(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Query interfaces with complex filters."""
        payload = {}

        if params.get("device_id"):
            payload["deviceId"] = params["device_id"]
        if params.get("interface_name"):
            payload["interfaceName"] = params["interface_name"]
        if params.get("port_name"):
            payload["portName"] = params["port_name"]
        if params.get("admin_status"):
            payload["adminStatus"] = params["admin_status"]
        if params.get("operational_status"):
            payload["status"] = params["operational_status"]

        response = await client.post("interface/query", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to query interfaces"))

        data = response.get("data", {})
        interfaces = data.get("response", [])

        return success_result(
            data={
                "interfaces": interfaces,
                "count": len(interfaces),
            },
            entities={"interface_ids": [i.get("id") for i in interfaces]},
            follow_up="Would you like more details on any of these interfaces?"
        )

    @classmethod
    async def _get_connected_device(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get connected device details (CDP/LLDP neighbors)."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}/connected-device-detail")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get connected devices"))

        data = response.get("data", {})
        connected = data.get("response", [])

        return success_result(
            data={
                "connected_devices": connected,
                "count": len(connected),
                "device_id": device_id,
            },
            follow_up="Would you like to see details for a specific neighbor?"
        )
