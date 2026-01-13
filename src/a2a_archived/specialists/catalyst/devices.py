"""Catalyst Center Devices skill module.

This module provides skills for network device management including:
- Device CRUD operations
- Device inventory queries
- Device configuration retrieval
- Device sync operations

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!devices
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
    DEVICE_IP_SCHEMA,
    DEVICE_SERIAL_SCHEMA,
    DEVICE_FAMILY_SCHEMA,
    REACHABILITY_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
)


# ============================================================================
# SKILL DEFINITIONS - Part 1 (CRUD & Basic Operations)
# ============================================================================

DEVICES_SKILLS_PART1: List[SkillDefinition] = [
    {
        "id": "devices_get_device_list",
        "name": "Get Device List",
        "description": (
            "Get a list of all network devices in Catalyst Center inventory. "
            "Supports filtering by family, series, hostname, management IP, "
            "platform, role, reachability status, and more."
        ),
        "tags": ["catalyst", "devices", "inventory", "list"],
        "examples": [
            "List all devices",
            "Show network devices",
            "Get all switches",
            "Find all routers",
            "Show unreachable devices",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "hostname": {
                    "type": "string",
                    "description": "Filter by hostname (supports wildcards)"
                },
                "management_ip_address": {
                    "type": "string",
                    "description": "Filter by management IP address"
                },
                "mac_address": {
                    "type": "string",
                    "description": "Filter by MAC address"
                },
                "family": DEVICE_FAMILY_SCHEMA,
                "type": {
                    "type": "string",
                    "description": "Filter by device type (e.g., 'Cisco Catalyst 9300')"
                },
                "series": {
                    "type": "string",
                    "description": "Filter by device series"
                },
                "platform_id": {
                    "type": "string",
                    "description": "Filter by platform ID"
                },
                "software_type": {
                    "type": "string",
                    "description": "Filter by software type (IOS, IOS-XE, etc.)"
                },
                "software_version": {
                    "type": "string",
                    "description": "Filter by software version"
                },
                "role": {
                    "type": "string",
                    "description": "Filter by device role",
                    "enum": ["ACCESS", "DISTRIBUTION", "CORE", "BORDER ROUTER", "UNKNOWN"]
                },
                "reachability_status": REACHABILITY_SCHEMA,
                "up_time": {
                    "type": "string",
                    "description": "Filter by uptime (e.g., '> 10 days')"
                },
                "location_name": {
                    "type": "string",
                    "description": "Filter by location/site name"
                },
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "devices_get_device_by_id",
        "name": "Get Device by ID",
        "description": (
            "Get detailed information about a specific network device using its UUID. "
            "Returns comprehensive device details including hardware, software, and status."
        ),
        "tags": ["catalyst", "devices", "details", "uuid"],
        "examples": [
            "Get device details",
            "Show device by ID",
            "Device information",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to retrieve"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_add_device",
        "name": "Add Device",
        "description": (
            "Add a new network device to Catalyst Center inventory. Requires device IP, "
            "SNMP credentials, and optionally CLI credentials for full management."
        ),
        "tags": ["catalyst", "devices", "add", "discovery", "inventory"],
        "examples": [
            "Add new device",
            "Add device to inventory",
            "Register new network device",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "ip_address": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of IP addresses of devices to add"
                },
                "snmp_version": {
                    "type": "string",
                    "description": "SNMP version",
                    "enum": ["v2", "v3"]
                },
                "snmp_ro_community": {
                    "type": "string",
                    "description": "SNMP read-only community string (v2)"
                },
                "snmp_rw_community": {
                    "type": "string",
                    "description": "SNMP read-write community string (v2)"
                },
                "snmp_username": {
                    "type": "string",
                    "description": "SNMPv3 username"
                },
                "snmp_auth_protocol": {
                    "type": "string",
                    "description": "SNMPv3 auth protocol",
                    "enum": ["SHA", "MD5"]
                },
                "snmp_auth_passphrase": {
                    "type": "string",
                    "description": "SNMPv3 auth passphrase"
                },
                "snmp_priv_protocol": {
                    "type": "string",
                    "description": "SNMPv3 privacy protocol",
                    "enum": ["AES128", "DES"]
                },
                "snmp_priv_passphrase": {
                    "type": "string",
                    "description": "SNMPv3 privacy passphrase"
                },
                "cli_transport": {
                    "type": "string",
                    "description": "CLI transport protocol",
                    "enum": ["ssh", "telnet"]
                },
                "username": {
                    "type": "string",
                    "description": "CLI username"
                },
                "password": {
                    "type": "string",
                    "description": "CLI password"
                },
                "enable_password": {
                    "type": "string",
                    "description": "Enable password"
                },
                "http_username": {
                    "type": "string",
                    "description": "HTTP username (for WLCs)"
                },
                "http_password": {
                    "type": "string",
                    "description": "HTTP password (for WLCs)"
                },
                "http_port": {
                    "type": "string",
                    "description": "HTTP port"
                },
            },
            "required": ["ip_address"],
        },
    },
    {
        "id": "devices_update_device",
        "name": "Update Device",
        "description": (
            "Update an existing network device's configuration in Catalyst Center. "
            "Can update credentials, role, and other device properties."
        ),
        "tags": ["catalyst", "devices", "update", "modify"],
        "examples": [
            "Update device credentials",
            "Change device role",
            "Modify device settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": DEVICE_ID_SCHEMA,
                "role": {
                    "type": "string",
                    "description": "New device role",
                    "enum": ["ACCESS", "DISTRIBUTION", "CORE", "BORDER ROUTER"]
                },
                "username": {
                    "type": "string",
                    "description": "Updated CLI username"
                },
                "password": {
                    "type": "string",
                    "description": "Updated CLI password"
                },
                "enable_password": {
                    "type": "string",
                    "description": "Updated enable password"
                },
                "snmp_ro_community": {
                    "type": "string",
                    "description": "Updated SNMP read-only community"
                },
                "snmp_rw_community": {
                    "type": "string",
                    "description": "Updated SNMP read-write community"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_delete_device",
        "name": "Delete Device",
        "description": (
            "Delete a network device from Catalyst Center inventory. "
            "This removes the device from management but does not affect the physical device."
        ),
        "tags": ["catalyst", "devices", "delete", "remove"],
        "examples": [
            "Delete device",
            "Remove device from inventory",
            "Unmanage device",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to delete"
                },
                "clean_config": {
                    "type": "boolean",
                    "description": "Remove device configuration from Catalyst Center",
                    "default": False
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_get_device_count",
        "name": "Get Device Count",
        "description": (
            "Get the total count of network devices in Catalyst Center, "
            "optionally filtered by various criteria."
        ),
        "tags": ["catalyst", "devices", "count", "statistics"],
        "examples": [
            "How many devices are there?",
            "Count all devices",
            "Number of switches",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "hostname": {
                    "type": "string",
                    "description": "Filter count by hostname"
                },
                "management_ip_address": {
                    "type": "string",
                    "description": "Filter count by management IP"
                },
                "family": DEVICE_FAMILY_SCHEMA,
                "reachability_status": REACHABILITY_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "devices_sync_devices",
        "name": "Sync Devices",
        "description": (
            "Trigger a resync of one or more network devices to refresh their "
            "configuration and status in Catalyst Center."
        ),
        "tags": ["catalyst", "devices", "sync", "refresh", "resync"],
        "examples": [
            "Sync device",
            "Resync device inventory",
            "Refresh device configuration",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of device UUIDs to sync"
                },
                "force_sync": {
                    "type": "boolean",
                    "description": "Force full sync even if no changes detected",
                    "default": False
                },
            },
            "required": ["device_ids"],
        },
    },
    {
        "id": "devices_get_device_config",
        "name": "Get Device Configuration",
        "description": (
            "Retrieve the running configuration of a network device. "
            "Returns the full device configuration as stored in Catalyst Center."
        ),
        "tags": ["catalyst", "devices", "config", "configuration"],
        "examples": [
            "Get device config",
            "Show running config",
            "Device configuration",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get configuration for"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_get_device_by_ip",
        "name": "Get Device by IP",
        "description": (
            "Get device information using its management IP address. "
            "Useful when you know the device IP but not its UUID."
        ),
        "tags": ["catalyst", "devices", "ip", "lookup"],
        "examples": [
            "Find device by IP",
            "Get device at IP address",
            "Look up device by IP",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "ip_address": {
                    **DEVICE_IP_SCHEMA,
                    "description": "Management IP address of the device"
                },
            },
            "required": ["ip_address"],
        },
    },
    {
        "id": "devices_get_device_by_serial",
        "name": "Get Device by Serial Number",
        "description": (
            "Get device information using its serial number. "
            "Useful for hardware tracking and inventory management."
        ),
        "tags": ["catalyst", "devices", "serial", "lookup"],
        "examples": [
            "Find device by serial",
            "Get device by serial number",
            "Look up device serial",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial_number": {
                    **DEVICE_SERIAL_SCHEMA,
                    "description": "Serial number of the device"
                },
            },
            "required": ["serial_number"],
        },
    },
    {
        "id": "devices_query_devices",
        "name": "Query Devices",
        "description": (
            "Advanced device query with complex filtering using POST request. "
            "Supports multiple filter criteria and logical operators."
        ),
        "tags": ["catalyst", "devices", "query", "search", "filter"],
        "examples": [
            "Search for devices",
            "Query device inventory",
            "Advanced device search",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "hostname": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of hostnames to search"
                },
                "management_ip_address": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of management IPs to search"
                },
                "serial_number": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of serial numbers to search"
                },
                "mac_address": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of MAC addresses to search"
                },
                "device_id": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of device UUIDs to search"
                },
            },
            "required": [],
        },
    },
    {
        "id": "devices_export_device_list",
        "name": "Export Device List",
        "description": (
            "Export device inventory to a file. Returns device list "
            "in a format suitable for reporting and analysis."
        ),
        "tags": ["catalyst", "devices", "export", "report"],
        "examples": [
            "Export device list",
            "Download device inventory",
            "Get device report",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific device IDs to export (optional, exports all if not specified)"
                },
                "operation_id_list": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Operation IDs to filter by"
                },
            },
            "required": [],
        },
    },
]


# ============================================================================
# SKILL DEFINITIONS - Part 2 (Advanced Operations)
# ============================================================================

DEVICES_SKILLS_PART2: List[SkillDefinition] = [
    {
        "id": "devices_get_device_summary",
        "name": "Get Device Summary",
        "description": (
            "Get a summary of all network devices including counts by family, "
            "reachability status, and other aggregate statistics."
        ),
        "tags": ["catalyst", "devices", "summary", "statistics"],
        "examples": [
            "Device summary",
            "Show device statistics",
            "Device inventory overview",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "summary_type": {
                    "type": "string",
                    "description": "Type of summary to generate",
                    "enum": ["FLAVOR", "STATUS"]
                },
            },
            "required": [],
        },
    },
    {
        "id": "devices_get_device_enrichment",
        "name": "Get Device Enrichment Details",
        "description": (
            "Get enriched device details including connected devices, "
            "interface information, and contextual data."
        ),
        "tags": ["catalyst", "devices", "enrichment", "context"],
        "examples": [
            "Get device enrichment",
            "Show enriched device details",
            "Device context information",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID for enrichment"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_get_modules",
        "name": "Get Device Modules",
        "description": (
            "Get information about hardware modules installed in network devices, "
            "including line cards, supervisors, and expansion modules."
        ),
        "tags": ["catalyst", "devices", "modules", "hardware"],
        "examples": [
            "Show device modules",
            "Get hardware modules",
            "List line cards",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get modules for"
                },
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "devices_get_chassis",
        "name": "Get Device Chassis",
        "description": (
            "Get chassis details for a network device including physical layout "
            "and slot information."
        ),
        "tags": ["catalyst", "devices", "chassis", "hardware"],
        "examples": [
            "Get device chassis",
            "Show chassis details",
            "Device physical layout",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get chassis for"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_get_stack",
        "name": "Get Device Stack Details",
        "description": (
            "Get stack information for stackable switches including stack members, "
            "roles, and stack state."
        ),
        "tags": ["catalyst", "devices", "stack", "switches"],
        "examples": [
            "Get stack details",
            "Show stack members",
            "Switch stack information",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Stack master device UUID"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_get_poe_details",
        "name": "Get PoE Details",
        "description": (
            "Get Power over Ethernet (PoE) information for a device including "
            "power budget, allocated power, and port status."
        ),
        "tags": ["catalyst", "devices", "poe", "power"],
        "examples": [
            "Get PoE details",
            "Show power over ethernet",
            "Device power status",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get PoE details for"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_get_functional_capability",
        "name": "Get Device Functional Capability",
        "description": (
            "Get the functional capabilities of a network device, "
            "showing what features and functions the device supports."
        ),
        "tags": ["catalyst", "devices", "capability", "features"],
        "examples": [
            "Get device capabilities",
            "Show device features",
            "What can this device do?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_update_role",
        "name": "Update Device Role",
        "description": (
            "Update the role designation of a network device. Roles help "
            "categorize devices for management and policy purposes."
        ),
        "tags": ["catalyst", "devices", "role", "update"],
        "examples": [
            "Change device role",
            "Set device as access switch",
            "Update device role",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to update"
                },
                "role": {
                    "type": "string",
                    "description": "New role for the device",
                    "enum": ["ACCESS", "DISTRIBUTION", "CORE", "BORDER ROUTER"]
                },
                "role_source": {
                    "type": "string",
                    "description": "Source of role assignment",
                    "enum": ["AUTO", "MANUAL"]
                },
            },
            "required": ["device_id", "role"],
        },
    },
    {
        "id": "devices_update_management_address",
        "name": "Update Management IP Address",
        "description": (
            "Update the management IP address used to communicate with a device. "
            "Use when device IP changes but device should remain in inventory."
        ),
        "tags": ["catalyst", "devices", "management", "ip"],
        "examples": [
            "Update device IP",
            "Change management address",
            "Update device management IP",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to update"
                },
                "new_ip": {
                    "type": "string",
                    "description": "New management IP address"
                },
            },
            "required": ["device_id", "new_ip"],
        },
    },
    {
        "id": "devices_get_polling_interval",
        "name": "Get Device Polling Interval",
        "description": (
            "Get the collection/polling schedule for a device showing how often "
            "Catalyst Center collects data from the device."
        ),
        "tags": ["catalyst", "devices", "polling", "schedule"],
        "examples": [
            "Get polling interval",
            "Show collection schedule",
            "Device sync interval",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID"
                },
            },
            "required": ["device_id"],
        },
    },
    {
        "id": "devices_update_resync_interval",
        "name": "Update Resync Interval",
        "description": (
            "Update the automatic resync interval for devices, controlling how often "
            "Catalyst Center automatically syncs device configuration."
        ),
        "tags": ["catalyst", "devices", "resync", "interval", "schedule"],
        "examples": [
            "Change resync interval",
            "Update sync schedule",
            "Set device sync interval",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "interval": {
                    "type": "integer",
                    "description": "Resync interval in minutes (0 to disable)"
                },
            },
            "required": ["interval"],
        },
    },
    {
        "id": "devices_delete_with_cleanup",
        "name": "Delete Device with Cleanup",
        "description": (
            "Delete devices with full cleanup including associated data, "
            "configurations, and historical information."
        ),
        "tags": ["catalyst", "devices", "delete", "cleanup"],
        "examples": [
            "Delete device completely",
            "Remove device and cleanup",
            "Full device deletion",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of device UUIDs to delete"
                },
                "clean_config": {
                    "type": "boolean",
                    "description": "Clean up device configuration",
                    "default": True
                },
            },
            "required": ["device_ids"],
        },
    },
    {
        "id": "devices_get_user_defined_fields",
        "name": "Get User Defined Fields",
        "description": (
            "Get user-defined custom fields for devices. These fields allow "
            "storing custom metadata with devices."
        ),
        "tags": ["catalyst", "devices", "custom", "fields", "udf"],
        "examples": [
            "Get custom device fields",
            "Show user defined fields",
            "Device metadata fields",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Device UUID to get UDFs for"
                },
                "name": {
                    "type": "string",
                    "description": "Filter by field name"
                },
            },
            "required": [],
        },
    },
]


# Combine all skills
DEVICES_SKILLS = DEVICES_SKILLS_PART1 + DEVICES_SKILLS_PART2


# ============================================================================
# MODULE CLASS
# ============================================================================

class DevicesModule(CatalystSkillModule):
    """Network device management skills module."""

    MODULE_NAME = "devices"
    MODULE_PREFIX = "devices_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all device management skills."""
        return [create_skill(skill_def) for skill_def in DEVICES_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a device management skill."""
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

        # Part 1 skills
        if skill_id == "devices_get_device_list":
            return await cls._get_device_list(client, params)

        if skill_id == "devices_get_device_by_id":
            return await cls._get_device_by_id(client, params)

        if skill_id == "devices_add_device":
            return await cls._add_device(client, params)

        if skill_id == "devices_update_device":
            return await cls._update_device(client, params)

        if skill_id == "devices_delete_device":
            return await cls._delete_device(client, params)

        if skill_id == "devices_get_device_count":
            return await cls._get_device_count(client, params)

        if skill_id == "devices_sync_devices":
            return await cls._sync_devices(client, params)

        if skill_id == "devices_get_device_config":
            return await cls._get_device_config(client, params)

        if skill_id == "devices_get_device_by_ip":
            return await cls._get_device_by_ip(client, params)

        if skill_id == "devices_get_device_by_serial":
            return await cls._get_device_by_serial(client, params)

        if skill_id == "devices_query_devices":
            return await cls._query_devices(client, params)

        if skill_id == "devices_export_device_list":
            return await cls._export_device_list(client, params)

        # Part 2 skills
        if skill_id == "devices_get_device_summary":
            return await cls._get_device_summary(client, params)

        if skill_id == "devices_get_device_enrichment":
            return await cls._get_device_enrichment(client, params)

        if skill_id == "devices_get_modules":
            return await cls._get_modules(client, params)

        if skill_id == "devices_get_chassis":
            return await cls._get_chassis(client, params)

        if skill_id == "devices_get_stack":
            return await cls._get_stack(client, params)

        if skill_id == "devices_get_poe_details":
            return await cls._get_poe_details(client, params)

        if skill_id == "devices_get_functional_capability":
            return await cls._get_functional_capability(client, params)

        if skill_id == "devices_update_role":
            return await cls._update_role(client, params)

        if skill_id == "devices_update_management_address":
            return await cls._update_management_address(client, params)

        if skill_id == "devices_get_polling_interval":
            return await cls._get_polling_interval(client, params)

        if skill_id == "devices_update_resync_interval":
            return await cls._update_resync_interval(client, params)

        if skill_id == "devices_delete_with_cleanup":
            return await cls._delete_with_cleanup(client, params)

        if skill_id == "devices_get_user_defined_fields":
            return await cls._get_user_defined_fields(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    # ========================================================================
    # SKILL IMPLEMENTATIONS - Part 1
    # ========================================================================

    @classmethod
    async def _get_device_list(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get list of network devices."""
        query_params = {}

        param_mapping = {
            "hostname": "hostname",
            "management_ip_address": "managementIpAddress",
            "mac_address": "macAddress",
            "family": "family",
            "type": "type",
            "series": "series",
            "platform_id": "platformId",
            "software_type": "softwareType",
            "software_version": "softwareVersion",
            "role": "role",
            "reachability_status": "reachabilityStatus",
            "up_time": "upTime",
            "location_name": "locationName",
            "offset": "offset",
            "limit": "limit",
        }

        for param_key, api_key in param_mapping.items():
            if params.get(param_key):
                query_params[api_key] = params[param_key]

        response = await client.get("network-device", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get devices"))

        data = response.get("data", {})
        devices = data.get("response", [])

        # Build summary
        families = {}
        reachability = {"Reachable": 0, "Unreachable": 0}
        for device in devices:
            family = device.get("family", "Unknown")
            families[family] = families.get(family, 0) + 1
            status = device.get("reachabilityStatus", "Unknown")
            if status in reachability:
                reachability[status] += 1

        return success_result(
            data={
                "devices": devices,
                "count": len(devices),
                "summary": {
                    "total": len(devices),
                    "by_family": families,
                    "reachability": reachability,
                },
            },
            entities={"device_ids": [d.get("id") for d in devices]},
            follow_up="Would you like to see device health or configuration?"
        )

    @classmethod
    async def _get_device_by_id(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device by UUID."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device"))

        data = response.get("data", {})
        device = data.get("response", {})

        if not device:
            return empty_result(f"Device {device_id} not found")

        return success_result(
            data={
                "device": device,
                "device_id": device_id,
            },
            entities={"device_id": device_id},
            follow_up="Would you like to see device interfaces or configuration?"
        )

    @classmethod
    async def _add_device(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Add new device to inventory."""
        payload = {
            "ipAddress": params.get("ip_address", []),
            "type": "NETWORK_DEVICE",
        }

        # Add SNMP credentials
        if params.get("snmp_version") == "v2":
            payload["snmpVersion"] = "v2"
            if params.get("snmp_ro_community"):
                payload["snmpROCommunity"] = params["snmp_ro_community"]
            if params.get("snmp_rw_community"):
                payload["snmpRWCommunity"] = params["snmp_rw_community"]
        elif params.get("snmp_version") == "v3":
            payload["snmpVersion"] = "v3"
            if params.get("snmp_username"):
                payload["snmpUserName"] = params["snmp_username"]
            if params.get("snmp_auth_protocol"):
                payload["snmpAuthProtocol"] = params["snmp_auth_protocol"]
            if params.get("snmp_auth_passphrase"):
                payload["snmpAuthPassphrase"] = params["snmp_auth_passphrase"]
            if params.get("snmp_priv_protocol"):
                payload["snmpPrivProtocol"] = params["snmp_priv_protocol"]
            if params.get("snmp_priv_passphrase"):
                payload["snmpPrivPassphrase"] = params["snmp_priv_passphrase"]

        # Add CLI credentials
        if params.get("cli_transport"):
            payload["cliTransport"] = params["cli_transport"]
        if params.get("username"):
            payload["userName"] = params["username"]
        if params.get("password"):
            payload["password"] = params["password"]
        if params.get("enable_password"):
            payload["enablePassword"] = params["enable_password"]

        # Add HTTP credentials
        if params.get("http_username"):
            payload["httpUserName"] = params["http_username"]
        if params.get("http_password"):
            payload["httpPassword"] = params["http_password"]
        if params.get("http_port"):
            payload["httpPort"] = params["http_port"]

        response = await client.post("network-device", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to add device"))

        data = response.get("data", {})

        # Handle async task
        if data.get("response", {}).get("taskId"):
            task_id = data["response"]["taskId"]
            task_result = await client.get_task_result(task_id)
            if not task_result.get("success"):
                return error_result(task_result.get("error", "Device add task failed"))
            data = task_result.get("data", {})

        return success_result(
            data={
                "message": f"Device(s) added successfully",
                "ip_addresses": params.get("ip_address"),
                "response": data,
            },
            follow_up="Would you like to sync the new device?"
        )

    @classmethod
    async def _update_device(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Update device properties."""
        device_id = params.get("device_id")

        payload = {"id": device_id}

        if params.get("role"):
            payload["role"] = params["role"]
        if params.get("username"):
            payload["userName"] = params["username"]
        if params.get("password"):
            payload["password"] = params["password"]
        if params.get("enable_password"):
            payload["enablePassword"] = params["enable_password"]
        if params.get("snmp_ro_community"):
            payload["snmpROCommunity"] = params["snmp_ro_community"]
        if params.get("snmp_rw_community"):
            payload["snmpRWCommunity"] = params["snmp_rw_community"]

        response = await client.put("network-device", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update device"))

        return success_result(
            data={
                "message": f"Device {device_id} updated successfully",
            }
        )

    @classmethod
    async def _delete_device(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Delete device from inventory."""
        device_id = params.get("device_id")
        clean_config = params.get("clean_config", False)

        query_params = {}
        if clean_config:
            query_params["cleanConfig"] = "true"

        response = await client.delete(f"network-device/{device_id}", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to delete device"))

        return success_result(
            data={
                "message": f"Device {device_id} deleted successfully",
            }
        )

    @classmethod
    async def _get_device_count(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device count."""
        query_params = {}

        if params.get("hostname"):
            query_params["hostname"] = params["hostname"]
        if params.get("management_ip_address"):
            query_params["managementIpAddress"] = params["management_ip_address"]
        if params.get("family"):
            query_params["family"] = params["family"]
        if params.get("reachability_status"):
            query_params["reachabilityStatus"] = params["reachability_status"]

        response = await client.get("network-device/count", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device count"))

        data = response.get("data", {})
        count = data.get("response", 0)

        return success_result(
            data={
                "count": count,
                "message": f"Total devices: {count}",
            }
        )

    @classmethod
    async def _sync_devices(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Sync devices."""
        device_ids = params.get("device_ids", [])
        force_sync = params.get("force_sync", False)

        payload = device_ids

        query_params = {}
        if force_sync:
            query_params["forceSync"] = "true"

        response = await client.put("network-device/sync", payload, query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to sync devices"))

        data = response.get("data", {})

        # Handle async task
        if data.get("response", {}).get("taskId"):
            task_id = data["response"]["taskId"]
            # Don't wait for completion, just return task info
            return success_result(
                data={
                    "message": f"Sync initiated for {len(device_ids)} device(s)",
                    "task_id": task_id,
                    "device_count": len(device_ids),
                },
                follow_up="Would you like to check the sync status?"
            )

        return success_result(
            data={
                "message": f"Sync completed for {len(device_ids)} device(s)",
                "device_count": len(device_ids),
            }
        )

    @classmethod
    async def _get_device_config(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device running configuration."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}/config")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device config"))

        data = response.get("data", {})
        config = data.get("response", "")

        return success_result(
            data={
                "config": config,
                "device_id": device_id,
            },
            follow_up="Would you like to compare this with another device?"
        )

    @classmethod
    async def _get_device_by_ip(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device by IP address."""
        ip_address = params.get("ip_address")

        response = await client.get(f"network-device/ip-address/{ip_address}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device by IP"))

        data = response.get("data", {})
        device = data.get("response", {})

        if not device:
            return empty_result(f"Device with IP {ip_address} not found")

        return success_result(
            data={
                "device": device,
                "ip_address": ip_address,
            },
            entities={"device_id": device.get("id")},
            follow_up="Would you like to see device details or health?"
        )

    @classmethod
    async def _get_device_by_serial(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device by serial number."""
        serial_number = params.get("serial_number")

        response = await client.get(f"network-device/serial-number/{serial_number}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device by serial"))

        data = response.get("data", {})
        device = data.get("response", {})

        if not device:
            return empty_result(f"Device with serial {serial_number} not found")

        return success_result(
            data={
                "device": device,
                "serial_number": serial_number,
            },
            entities={"device_id": device.get("id")},
            follow_up="Would you like to see device details?"
        )

    @classmethod
    async def _query_devices(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Query devices with complex filters."""
        payload = {}

        if params.get("hostname"):
            payload["hostname"] = params["hostname"]
        if params.get("management_ip_address"):
            payload["managementIpAddress"] = params["management_ip_address"]
        if params.get("serial_number"):
            payload["serialNumber"] = params["serial_number"]
        if params.get("mac_address"):
            payload["macAddress"] = params["mac_address"]
        if params.get("device_id"):
            payload["id"] = params["device_id"]

        response = await client.post("network-device/query", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to query devices"))

        data = response.get("data", {})
        devices = data.get("response", [])

        return success_result(
            data={
                "devices": devices,
                "count": len(devices),
            },
            entities={"device_ids": [d.get("id") for d in devices]},
            follow_up="Would you like more details on any of these devices?"
        )

    @classmethod
    async def _export_device_list(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Export device list."""
        payload = {}

        if params.get("device_ids"):
            payload["deviceUuids"] = params["device_ids"]
        if params.get("operation_id_list"):
            payload["operationIdList"] = params["operation_id_list"]

        response = await client.post("network-device/file", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to export device list"))

        data = response.get("data", {})

        # Handle async task for file generation
        if data.get("response", {}).get("taskId"):
            task_result = await client.get_task_result(data["response"]["taskId"])
            if not task_result.get("success"):
                return error_result(task_result.get("error", "Export task failed"))
            data = task_result.get("data", {})

        return success_result(
            data={
                "message": "Device list exported successfully",
                "response": data,
            }
        )

    # ========================================================================
    # SKILL IMPLEMENTATIONS - Part 2
    # ========================================================================

    @classmethod
    async def _get_device_summary(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device summary statistics."""
        query_params = {}
        if params.get("summary_type"):
            query_params["summaryType"] = params["summary_type"]

        response = await client.get("network-device/summary", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device summary"))

        data = response.get("data", {})
        summary = data.get("response", {})

        return success_result(
            data={
                "summary": summary,
            },
            follow_up="Would you like to drill down into specific device categories?"
        )

    @classmethod
    async def _get_device_enrichment(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device enrichment details."""
        device_id = params.get("device_id")

        # Enrichment API uses headers for entity info
        response = await client.get(
            "device-enrichment-details",
            params={"entity_type": "network_device", "entity_uuid": device_id}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get device enrichment"))

        data = response.get("data", {})
        enrichment = data.get("response", [])

        return success_result(
            data={
                "enrichment": enrichment,
                "device_id": device_id,
            },
            follow_up="Would you like to see connected devices or issues?"
        )

    @classmethod
    async def _get_modules(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device modules."""
        query_params = {}

        if params.get("device_id"):
            query_params["deviceId"] = params["device_id"]
        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get("network-device/module", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get modules"))

        data = response.get("data", {})
        modules = data.get("response", [])

        return success_result(
            data={
                "modules": modules,
                "count": len(modules),
            },
            follow_up="Would you like details on specific modules?"
        )

    @classmethod
    async def _get_chassis(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device chassis details."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}/chassis")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get chassis"))

        data = response.get("data", {})
        chassis = data.get("response", {})

        return success_result(
            data={
                "chassis": chassis,
                "device_id": device_id,
            }
        )

    @classmethod
    async def _get_stack(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device stack details."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}/stack")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get stack details"))

        data = response.get("data", {})
        stack = data.get("response", {})

        return success_result(
            data={
                "stack": stack,
                "device_id": device_id,
            },
            follow_up="Would you like to see stack member details?"
        )

    @classmethod
    async def _get_poe_details(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get PoE details for device."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}/poe")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get PoE details"))

        data = response.get("data", {})
        poe = data.get("response", {})

        return success_result(
            data={
                "poe": poe,
                "device_id": device_id,
            }
        )

    @classmethod
    async def _get_functional_capability(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device functional capabilities."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}/functional-capability")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get capabilities"))

        data = response.get("data", {})
        capabilities = data.get("response", [])

        return success_result(
            data={
                "capabilities": capabilities,
                "device_id": device_id,
            }
        )

    @classmethod
    async def _update_role(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Update device role."""
        device_id = params.get("device_id")
        role = params.get("role")
        role_source = params.get("role_source", "MANUAL")

        payload = {
            "id": device_id,
            "role": role,
            "roleSource": role_source,
        }

        response = await client.put("network-device/brief", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update role"))

        return success_result(
            data={
                "message": f"Device {device_id} role updated to {role}",
            }
        )

    @classmethod
    async def _update_management_address(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Update device management IP address."""
        device_id = params.get("device_id")
        new_ip = params.get("new_ip")

        payload = {"newIP": new_ip}

        response = await client.put(f"network-device/{device_id}/management-address", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update management address"))

        return success_result(
            data={
                "message": f"Device {device_id} management IP updated to {new_ip}",
            }
        )

    @classmethod
    async def _get_polling_interval(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get device polling/collection interval."""
        device_id = params.get("device_id")

        response = await client.get(f"network-device/{device_id}/collection-schedule")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get polling interval"))

        data = response.get("data", {})
        schedule = data.get("response", {})

        return success_result(
            data={
                "schedule": schedule,
                "device_id": device_id,
            }
        )

    @classmethod
    async def _update_resync_interval(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Update device resync interval."""
        interval = params.get("interval")

        payload = {"interval": interval}

        response = await client.put("networkDevices/resyncIntervalSettings", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update resync interval"))

        return success_result(
            data={
                "message": f"Resync interval updated to {interval} minutes",
            }
        )

    @classmethod
    async def _delete_with_cleanup(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Delete devices with full cleanup."""
        device_ids = params.get("device_ids", [])
        clean_config = params.get("clean_config", True)

        payload = {
            "deviceIdList": device_ids,
            "cleanConfig": clean_config,
        }

        response = await client.post("network-device/delete", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to delete devices"))

        data = response.get("data", {})

        # Handle async task
        if data.get("response", {}).get("taskId"):
            task_result = await client.get_task_result(data["response"]["taskId"])
            if not task_result.get("success"):
                return error_result(task_result.get("error", "Delete task failed"))

        return success_result(
            data={
                "message": f"Deleted {len(device_ids)} device(s) with cleanup",
                "device_count": len(device_ids),
            }
        )

    @classmethod
    async def _get_user_defined_fields(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get user-defined fields for devices."""
        query_params = {}

        if params.get("device_id"):
            query_params["id"] = params["device_id"]
        if params.get("name"):
            query_params["name"] = params["name"]

        response = await client.get("network-device/user-defined-field", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get user-defined fields"))

        data = response.get("data", {})
        fields = data.get("response", [])

        return success_result(
            data={
                "fields": fields,
                "count": len(fields),
            }
        )
