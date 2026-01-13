"""
Meraki Networks skill module.

Provides skills for network-level operations including:
- Network CRUD (create, read, update, delete)
- Network binding to templates
- Clients management
- Events and alerts
- Firmware upgrades
- Floor plans
- Group policies
- Meraki Auth users
- Traffic analysis
- Webhooks
"""

import logging
from typing import List, Dict, Any, Optional

from src.a2a.types import AgentSkill
from src.a2a.specialists.base_specialist import AgentExecutionContext, SkillResult
from src.services.meraki_api import MerakiAPIClient

from .base import (
    MerakiSkillModule,
    create_skill,
    build_input_schema,
    success_result,
    error_result,
    empty_result,
    api_get,
    api_post,
    api_put,
    api_delete,
    extract_network_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    ORG_ID_SCHEMA,
    NETWORK_ID_SCHEMA,
)

logger = logging.getLogger(__name__)


class NetworksModule(MerakiSkillModule):
    """Meraki Networks skill module."""

    MODULE_NAME = "networks"
    MODULE_PREFIX = "networks_"

    # =========================================================================
    # Skill Definitions
    # =========================================================================

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Return all network skills."""
        return [
            # -----------------------------------------------------------------
            # Core Network CRUD
            # -----------------------------------------------------------------
            create_skill(
                id="networks_list",
                name="List Networks",
                description="List all networks in an organization",
                tags=["networks", "list", "read"],
                examples=[
                    "List all networks",
                    "Show me my networks",
                    "Get networks in organization",
                    "What networks do I have?",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "configTemplateId": {"type": "string", "description": "Filter by config template"},
                        "isBoundToConfigTemplate": {"type": "boolean", "description": "Filter by template binding"},
                        "tags": {"type": "array", "description": "Filter by tags", "items": {"type": "string"}},
                        "tagsFilterType": {"type": "string", "description": "Tag filter type"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="networks_get",
                name="Get Network",
                description="Get details of a specific network",
                tags=["networks", "get", "read", "details"],
                examples=[
                    "Get network details",
                    "Show network info",
                    "Get network by ID",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_create",
                name="Create Network",
                description="Create a new network in an organization",
                tags=["networks", "create", "write"],
                examples=[
                    "Create a new network",
                    "Add network to organization",
                    "Set up new network",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "name": {"type": "string", "description": "Network name"},
                        "productTypes": {
                            "type": "array",
                            "description": "Product types (appliance, switch, wireless, camera, etc.)",
                            "items": {"type": "string"},
                        },
                        "tags": {"type": "array", "description": "Network tags", "items": {"type": "string"}},
                        "timeZone": {"type": "string", "description": "Time zone"},
                        "copyFromNetworkId": {"type": "string", "description": "Network to copy from"},
                        "notes": {"type": "string", "description": "Notes"},
                    },
                    required=["organization_id", "name", "productTypes"],
                ),
            ),
            create_skill(
                id="networks_update",
                name="Update Network",
                description="Update a network's settings",
                tags=["networks", "update", "write"],
                examples=[
                    "Update network settings",
                    "Change network name",
                    "Modify network configuration",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "name": {"type": "string", "description": "New network name"},
                        "timeZone": {"type": "string", "description": "Time zone"},
                        "tags": {"type": "array", "description": "Network tags", "items": {"type": "string"}},
                        "enrollmentString": {"type": "string", "description": "Enrollment string"},
                        "notes": {"type": "string", "description": "Notes"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_delete",
                name="Delete Network",
                description="Delete a network",
                tags=["networks", "delete", "write", "dangerous"],
                examples=[
                    "Delete network",
                    "Remove network",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_bind_to_template",
                name="Bind Network to Template",
                description="Bind a network to a configuration template",
                tags=["networks", "template", "bind", "write"],
                examples=[
                    "Bind network to template",
                    "Apply template to network",
                    "Link network to config template",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "configTemplateId": {"type": "string", "description": "Config template ID"},
                        "autoBind": {"type": "boolean", "description": "Auto bind settings"},
                    },
                    required=["network_id", "configTemplateId"],
                ),
            ),
            create_skill(
                id="networks_unbind_from_template",
                name="Unbind Network from Template",
                description="Unbind a network from its configuration template",
                tags=["networks", "template", "unbind", "write"],
                examples=[
                    "Unbind network from template",
                    "Remove template from network",
                    "Unlink network from config template",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "retainConfigs": {"type": "boolean", "description": "Retain configuration settings"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_split",
                name="Split Combined Network",
                description="Split a combined network into individual product networks",
                tags=["networks", "split", "write"],
                examples=[
                    "Split combined network",
                    "Separate network by product type",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_list_devices",
                name="List Network Devices",
                description="List all devices in a specific network by network name or ID",
                tags=[
                    "networks", "devices", "list", "read", "inventory",
                    # Device model families for better matching
                    "mx", "mr", "ms", "mv", "mt", "mg", "appliance", "switch", "ap", "camera", "sensor",
                ],
                examples=[
                    "List devices on Riebel Home network",
                    "Show devices in Main Office",
                    "Get all devices on the guest network",
                    "What devices are on this network?",
                    "Show network inventory",
                    "List MX, MR, MS devices in network",
                ],
                input_schema=build_input_schema(
                    {
                        "network_name": {"type": "string", "description": "Network name to search for"},
                        "network_id": {"type": "string", "description": "Network ID (if known)"},
                        "organization_id": {"type": "string", "description": "Organization ID (optional)"},
                    },
                    required=[],
                ),
            ),
            create_skill(
                id="networks_combine",
                name="Combine Networks",
                description="Combine multiple networks into a single combined network",
                tags=["networks", "combine", "write"],
                examples=[
                    "Combine networks",
                    "Merge networks together",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "name": {"type": "string", "description": "Name for combined network"},
                        "networkIds": {"type": "array", "description": "Network IDs to combine", "items": {"type": "string"}},
                        "enrollmentString": {"type": "string", "description": "Enrollment string"},
                    },
                    required=["organization_id", "name", "networkIds"],
                ),
            ),

            # -----------------------------------------------------------------
            # Clients
            # -----------------------------------------------------------------
            create_skill(
                id="networks_list_clients",
                name="List Network Clients",
                description="List clients connected to a network",
                tags=["networks", "clients", "list", "read"],
                examples=[
                    "List network clients",
                    "Show connected devices",
                    "Who is connected to the network?",
                    "Get all clients",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds (max 2592000)"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "statuses": {"type": "array", "description": "Filter by status", "items": {"type": "string"}},
                        "ip": {"type": "string", "description": "Filter by IP"},
                        "ip6": {"type": "string", "description": "Filter by IPv6"},
                        "ip6Local": {"type": "string", "description": "Filter by local IPv6"},
                        "mac": {"type": "string", "description": "Filter by MAC"},
                        "os": {"type": "string", "description": "Filter by OS"},
                        "pskGroup": {"type": "string", "description": "Filter by PSK group"},
                        "description": {"type": "string", "description": "Filter by description"},
                        "vlan": {"type": "string", "description": "Filter by VLAN"},
                        "recentDeviceConnections": {"type": "array", "description": "Filter by recent connections", "items": {"type": "string"}},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_get_client",
                name="Get Network Client",
                description="Get details of a specific client",
                tags=["networks", "clients", "get", "read", "details"],
                examples=[
                    "Get client details",
                    "Show client info",
                    "Look up client",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "client_id": {"type": "string", "description": "Client ID or MAC address"},
                    },
                    required=["network_id", "client_id"],
                ),
            ),
            create_skill(
                id="networks_get_client_policy",
                name="Get Client Policy",
                description="Get the policy assigned to a client",
                tags=["networks", "clients", "policy", "read"],
                examples=[
                    "Get client policy",
                    "What policy is assigned to client?",
                    "Check client policy",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "client_id": {"type": "string", "description": "Client ID or MAC"},
                    },
                    required=["network_id", "client_id"],
                ),
            ),
            create_skill(
                id="networks_update_client_policy",
                name="Update Client Policy",
                description="Update the policy for a client",
                tags=["networks", "clients", "policy", "update", "write"],
                examples=[
                    "Update client policy",
                    "Change client group policy",
                    "Assign policy to client",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "client_id": {"type": "string", "description": "Client ID or MAC"},
                        "devicePolicy": {"type": "string", "description": "Device policy (Group policy, Allowed, Blocked, Normal)"},
                        "groupPolicyId": {"type": "string", "description": "Group policy ID"},
                    },
                    required=["network_id", "client_id", "devicePolicy"],
                ),
            ),
            create_skill(
                id="networks_provision_clients",
                name="Provision Clients",
                description="Provision clients with policies",
                tags=["networks", "clients", "provision", "write"],
                examples=[
                    "Provision client",
                    "Set up client with policy",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "clients": {"type": "array", "description": "Clients to provision", "items": {"type": "object"}},
                        "devicePolicy": {"type": "string", "description": "Device policy"},
                        "groupPolicyId": {"type": "string", "description": "Group policy ID"},
                        "policiesBySecurityAppliance": {"type": "object", "description": "Security appliance policies"},
                        "policiesBySsid": {"type": "object", "description": "SSID policies"},
                    },
                    required=["network_id", "clients", "devicePolicy"],
                ),
            ),
            create_skill(
                id="networks_get_client_traffic",
                name="Get Client Traffic History",
                description="Get traffic history for a specific client",
                tags=["networks", "clients", "traffic", "read", "history"],
                examples=[
                    "Get client traffic history",
                    "Show client bandwidth usage",
                    "What has client been doing?",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "client_id": {"type": "string", "description": "Client ID or MAC"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                    },
                    required=["network_id", "client_id"],
                ),
            ),
            create_skill(
                id="networks_get_client_usage",
                name="Get Client Usage History",
                description="Get data usage history for a specific client",
                tags=["networks", "clients", "usage", "read", "bandwidth"],
                examples=[
                    "Get client usage",
                    "Show client data consumption",
                    "How much data has client used?",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "client_id": {"type": "string", "description": "Client ID or MAC"},
                    },
                    required=["network_id", "client_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Events & Alerts
            # -----------------------------------------------------------------
            create_skill(
                id="networks_get_events",
                name="Get Network Events",
                description="Get events log for a network",
                tags=["networks", "events", "logs", "read", "audit"],
                examples=[
                    "Get network events",
                    "Show event log",
                    "What happened on the network?",
                    "Get recent events",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "productType": {"type": "string", "description": "Filter by product type"},
                        "includedEventTypes": {"type": "array", "description": "Event types to include", "items": {"type": "string"}},
                        "excludedEventTypes": {"type": "array", "description": "Event types to exclude", "items": {"type": "string"}},
                        "deviceMac": {"type": "string", "description": "Filter by device MAC"},
                        "deviceSerial": {"type": "string", "description": "Filter by device serial"},
                        "deviceName": {"type": "string", "description": "Filter by device name"},
                        "clientIp": {"type": "string", "description": "Filter by client IP"},
                        "clientMac": {"type": "string", "description": "Filter by client MAC"},
                        "clientName": {"type": "string", "description": "Filter by client name"},
                        "smDeviceMac": {"type": "string", "description": "Filter by SM device MAC"},
                        "smDeviceName": {"type": "string", "description": "Filter by SM device name"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "endingBefore": {"type": "string", "description": "End pagination cursor"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_get_event_types",
                name="Get Network Event Types",
                description="Get list of event types for a network",
                tags=["networks", "events", "types", "read"],
                examples=[
                    "Get event types",
                    "What events can occur?",
                    "List event categories",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_get_alerts_history",
                name="Get Alerts History",
                description="Get alert history for a network",
                tags=["networks", "alerts", "history", "read"],
                examples=[
                    "Get alert history",
                    "Show past alerts",
                    "What alerts have fired?",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_get_alerts_settings",
                name="Get Alerts Settings",
                description="Get alert settings for a network",
                tags=["networks", "alerts", "settings", "read"],
                examples=[
                    "Get alert settings",
                    "Show alert configuration",
                    "What alerts are enabled?",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_update_alerts_settings",
                name="Update Alerts Settings",
                description="Update alert settings for a network",
                tags=["networks", "alerts", "settings", "update", "write"],
                examples=[
                    "Update alert settings",
                    "Configure alerts",
                    "Change alert configuration",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "defaultDestinations": {"type": "object", "description": "Default alert destinations"},
                        "alerts": {"type": "array", "description": "Alert configurations", "items": {"type": "object"}},
                        "muting": {"type": "object", "description": "Muting settings"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_get_health_alerts",
                name="Get Health Alerts",
                description="Get health alerts for a network",
                tags=["networks", "health", "alerts", "read"],
                examples=[
                    "Get health alerts",
                    "Show network health issues",
                    "What health problems exist?",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),

            # -----------------------------------------------------------------
            # Firmware
            # -----------------------------------------------------------------
            create_skill(
                id="networks_get_firmware_upgrades",
                name="Get Firmware Upgrades",
                description="Get firmware upgrade information for a network",
                tags=["networks", "firmware", "upgrades", "read"],
                examples=[
                    "Get firmware upgrades",
                    "Check firmware versions",
                    "What firmware is scheduled?",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_update_firmware_upgrades",
                name="Update Firmware Upgrades",
                description="Update firmware upgrade settings",
                tags=["networks", "firmware", "upgrades", "update", "write"],
                examples=[
                    "Schedule firmware upgrade",
                    "Update firmware settings",
                    "Configure firmware upgrades",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "upgradeWindow": {"type": "object", "description": "Upgrade window settings"},
                        "timezone": {"type": "string", "description": "Timezone"},
                        "products": {"type": "object", "description": "Product-specific settings"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_create_firmware_rollback",
                name="Rollback Firmware",
                description="Rollback firmware to a previous version",
                tags=["networks", "firmware", "rollback", "write"],
                examples=[
                    "Rollback firmware",
                    "Revert firmware version",
                    "Downgrade firmware",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "product": {"type": "string", "description": "Product type"},
                        "time": {"type": "string", "description": "Scheduled time"},
                        "reasons": {"type": "array", "description": "Rollback reasons", "items": {"type": "object"}},
                        "toVersion": {"type": "object", "description": "Target version"},
                    },
                    required=["network_id", "product"],
                ),
            ),
            create_skill(
                id="networks_get_firmware_staged_events",
                name="Get Staged Firmware Events",
                description="Get staged firmware upgrade events",
                tags=["networks", "firmware", "staged", "read"],
                examples=[
                    "Get staged firmware events",
                    "Show scheduled firmware upgrades",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),

            # -----------------------------------------------------------------
            # Group Policies
            # -----------------------------------------------------------------
            create_skill(
                id="networks_list_group_policies",
                name="List Group Policies",
                description="List group policies for a network",
                tags=["networks", "policies", "group", "list", "read"],
                examples=[
                    "List group policies",
                    "Show network policies",
                    "What policies exist?",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_create_group_policy",
                name="Create Group Policy",
                description="Create a new group policy",
                tags=["networks", "policies", "group", "create", "write"],
                examples=[
                    "Create group policy",
                    "Add new policy",
                    "Set up group policy",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "name": {"type": "string", "description": "Policy name"},
                        "scheduling": {"type": "object", "description": "Scheduling settings"},
                        "bandwidth": {"type": "object", "description": "Bandwidth limits"},
                        "firewallAndTrafficShaping": {"type": "object", "description": "Firewall and traffic shaping"},
                        "contentFiltering": {"type": "object", "description": "Content filtering"},
                        "splashAuthSettings": {"type": "string", "description": "Splash auth settings"},
                        "vlanTagging": {"type": "object", "description": "VLAN tagging"},
                        "bonjourForwarding": {"type": "object", "description": "Bonjour forwarding"},
                    },
                    required=["network_id", "name"],
                ),
            ),
            create_skill(
                id="networks_get_group_policy",
                name="Get Group Policy",
                description="Get details of a group policy",
                tags=["networks", "policies", "group", "get", "read"],
                examples=[
                    "Get group policy details",
                    "Show policy settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "group_policy_id": {"type": "string", "description": "Group policy ID"},
                    },
                    required=["network_id", "group_policy_id"],
                ),
            ),
            create_skill(
                id="networks_update_group_policy",
                name="Update Group Policy",
                description="Update a group policy",
                tags=["networks", "policies", "group", "update", "write"],
                examples=[
                    "Update group policy",
                    "Modify policy settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "group_policy_id": {"type": "string", "description": "Group policy ID"},
                        "name": {"type": "string", "description": "Policy name"},
                        "scheduling": {"type": "object", "description": "Scheduling settings"},
                        "bandwidth": {"type": "object", "description": "Bandwidth limits"},
                        "firewallAndTrafficShaping": {"type": "object", "description": "Firewall and traffic shaping"},
                        "contentFiltering": {"type": "object", "description": "Content filtering"},
                        "splashAuthSettings": {"type": "string", "description": "Splash auth settings"},
                        "vlanTagging": {"type": "object", "description": "VLAN tagging"},
                        "bonjourForwarding": {"type": "object", "description": "Bonjour forwarding"},
                    },
                    required=["network_id", "group_policy_id"],
                ),
            ),
            create_skill(
                id="networks_delete_group_policy",
                name="Delete Group Policy",
                description="Delete a group policy",
                tags=["networks", "policies", "group", "delete", "write"],
                examples=[
                    "Delete group policy",
                    "Remove policy",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "group_policy_id": {"type": "string", "description": "Group policy ID to delete"},
                    },
                    required=["network_id", "group_policy_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Meraki Auth Users
            # -----------------------------------------------------------------
            create_skill(
                id="networks_list_meraki_auth_users",
                name="List Meraki Auth Users",
                description="List Meraki authentication users for a network",
                tags=["networks", "auth", "users", "list", "read"],
                examples=[
                    "List auth users",
                    "Show Meraki auth users",
                    "Get splash page users",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_create_meraki_auth_user",
                name="Create Meraki Auth User",
                description="Create a new Meraki authentication user",
                tags=["networks", "auth", "users", "create", "write"],
                examples=[
                    "Create auth user",
                    "Add splash page user",
                    "Set up Meraki auth user",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "email": {"type": "string", "description": "User email"},
                        "name": {"type": "string", "description": "User name"},
                        "password": {"type": "string", "description": "User password"},
                        "authorizations": {"type": "array", "description": "Authorization settings", "items": {"type": "object"}},
                        "accountType": {"type": "string", "description": "Account type (802.1X, Guest)"},
                        "emailPasswordToUser": {"type": "boolean", "description": "Email password to user"},
                        "isAdmin": {"type": "boolean", "description": "Is admin user"},
                    },
                    required=["network_id", "email", "authorizations"],
                ),
            ),
            create_skill(
                id="networks_get_meraki_auth_user",
                name="Get Meraki Auth User",
                description="Get details of a Meraki auth user",
                tags=["networks", "auth", "users", "get", "read"],
                examples=[
                    "Get auth user details",
                    "Show user info",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "meraki_auth_user_id": {"type": "string", "description": "Meraki auth user ID"},
                    },
                    required=["network_id", "meraki_auth_user_id"],
                ),
            ),
            create_skill(
                id="networks_update_meraki_auth_user",
                name="Update Meraki Auth User",
                description="Update a Meraki auth user",
                tags=["networks", "auth", "users", "update", "write"],
                examples=[
                    "Update auth user",
                    "Modify user settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "meraki_auth_user_id": {"type": "string", "description": "Meraki auth user ID"},
                        "name": {"type": "string", "description": "User name"},
                        "password": {"type": "string", "description": "New password"},
                        "authorizations": {"type": "array", "description": "Authorization settings", "items": {"type": "object"}},
                        "emailPasswordToUser": {"type": "boolean", "description": "Email password"},
                    },
                    required=["network_id", "meraki_auth_user_id"],
                ),
            ),
            create_skill(
                id="networks_delete_meraki_auth_user",
                name="Delete Meraki Auth User",
                description="Delete a Meraki auth user",
                tags=["networks", "auth", "users", "delete", "write"],
                examples=[
                    "Delete auth user",
                    "Remove splash page user",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "meraki_auth_user_id": {"type": "string", "description": "Meraki auth user ID to delete"},
                    },
                    required=["network_id", "meraki_auth_user_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Webhooks
            # -----------------------------------------------------------------
            create_skill(
                id="networks_list_webhooks",
                name="List Webhooks",
                description="List webhook HTTP servers for a network",
                tags=["networks", "webhooks", "list", "read"],
                examples=[
                    "List webhooks",
                    "Show webhook servers",
                    "What webhooks are configured?",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_create_webhook",
                name="Create Webhook",
                description="Create a new webhook HTTP server",
                tags=["networks", "webhooks", "create", "write"],
                examples=[
                    "Create webhook",
                    "Add webhook server",
                    "Set up webhook endpoint",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "name": {"type": "string", "description": "Webhook name"},
                        "url": {"type": "string", "description": "Webhook URL"},
                        "sharedSecret": {"type": "string", "description": "Shared secret for validation"},
                        "payloadTemplate": {"type": "object", "description": "Payload template settings"},
                    },
                    required=["network_id", "name", "url"],
                ),
            ),
            create_skill(
                id="networks_get_webhook",
                name="Get Webhook",
                description="Get details of a webhook HTTP server",
                tags=["networks", "webhooks", "get", "read"],
                examples=[
                    "Get webhook details",
                    "Show webhook config",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "http_server_id": {"type": "string", "description": "HTTP server ID"},
                    },
                    required=["network_id", "http_server_id"],
                ),
            ),
            create_skill(
                id="networks_update_webhook",
                name="Update Webhook",
                description="Update a webhook HTTP server",
                tags=["networks", "webhooks", "update", "write"],
                examples=[
                    "Update webhook",
                    "Modify webhook settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "http_server_id": {"type": "string", "description": "HTTP server ID"},
                        "name": {"type": "string", "description": "Webhook name"},
                        "url": {"type": "string", "description": "Webhook URL"},
                        "sharedSecret": {"type": "string", "description": "Shared secret"},
                        "payloadTemplate": {"type": "object", "description": "Payload template"},
                    },
                    required=["network_id", "http_server_id"],
                ),
            ),
            create_skill(
                id="networks_delete_webhook",
                name="Delete Webhook",
                description="Delete a webhook HTTP server",
                tags=["networks", "webhooks", "delete", "write"],
                examples=[
                    "Delete webhook",
                    "Remove webhook server",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "http_server_id": {"type": "string", "description": "HTTP server ID to delete"},
                    },
                    required=["network_id", "http_server_id"],
                ),
            ),
            create_skill(
                id="networks_test_webhook",
                name="Test Webhook",
                description="Send a test webhook payload",
                tags=["networks", "webhooks", "test", "write"],
                examples=[
                    "Test webhook",
                    "Send test webhook",
                    "Verify webhook works",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "url": {"type": "string", "description": "URL to test"},
                        "sharedSecret": {"type": "string", "description": "Shared secret"},
                        "payloadTemplate": {"type": "object", "description": "Payload template"},
                        "alertTypeId": {"type": "string", "description": "Alert type to simulate"},
                    },
                    required=["network_id", "url"],
                ),
            ),

            # -----------------------------------------------------------------
            # Floor Plans
            # -----------------------------------------------------------------
            create_skill(
                id="networks_list_floor_plans",
                name="List Floor Plans",
                description="List floor plans for a network",
                tags=["networks", "floor", "plans", "list", "read"],
                examples=[
                    "List floor plans",
                    "Show floor plans",
                    "Get network maps",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_get_floor_plan",
                name="Get Floor Plan",
                description="Get details of a floor plan",
                tags=["networks", "floor", "plans", "get", "read"],
                examples=[
                    "Get floor plan",
                    "Show floor plan details",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "floor_plan_id": {"type": "string", "description": "Floor plan ID"},
                    },
                    required=["network_id", "floor_plan_id"],
                ),
            ),
            create_skill(
                id="networks_update_floor_plan",
                name="Update Floor Plan",
                description="Update a floor plan",
                tags=["networks", "floor", "plans", "update", "write"],
                examples=[
                    "Update floor plan",
                    "Modify floor plan settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "floor_plan_id": {"type": "string", "description": "Floor plan ID"},
                        "name": {"type": "string", "description": "Floor plan name"},
                        "center": {"type": "object", "description": "Center coordinates"},
                        "bottomLeftCorner": {"type": "object", "description": "Bottom left corner"},
                        "bottomRightCorner": {"type": "object", "description": "Bottom right corner"},
                        "topLeftCorner": {"type": "object", "description": "Top left corner"},
                        "topRightCorner": {"type": "object", "description": "Top right corner"},
                    },
                    required=["network_id", "floor_plan_id"],
                ),
            ),
            create_skill(
                id="networks_delete_floor_plan",
                name="Delete Floor Plan",
                description="Delete a floor plan",
                tags=["networks", "floor", "plans", "delete", "write"],
                examples=[
                    "Delete floor plan",
                    "Remove floor plan",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "floor_plan_id": {"type": "string", "description": "Floor plan ID to delete"},
                    },
                    required=["network_id", "floor_plan_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Traffic Analysis
            # -----------------------------------------------------------------
            create_skill(
                id="networks_get_traffic_analysis",
                name="Get Traffic Analysis Settings",
                description="Get traffic analysis settings for a network",
                tags=["networks", "traffic", "analysis", "settings", "read"],
                examples=[
                    "Get traffic analysis settings",
                    "Show traffic analysis config",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_update_traffic_analysis",
                name="Update Traffic Analysis",
                description="Update traffic analysis settings",
                tags=["networks", "traffic", "analysis", "update", "write"],
                examples=[
                    "Update traffic analysis",
                    "Configure traffic analysis",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "mode": {"type": "string", "description": "Traffic analysis mode (disabled, basic, detailed)"},
                        "customPieChartItems": {"type": "array", "description": "Custom pie chart items", "items": {"type": "object"}},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="networks_get_traffic",
                name="Get Network Traffic",
                description="Get traffic data for a network",
                tags=["networks", "traffic", "data", "read"],
                examples=[
                    "Get network traffic",
                    "Show traffic data",
                    "What applications are using bandwidth?",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "deviceType": {"type": "string", "description": "Filter by device type"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Network Settings
            # -----------------------------------------------------------------
            create_skill(
                id="networks_get_settings",
                name="Get Network Settings",
                description="Get general settings for a network",
                tags=["networks", "settings", "read"],
                examples=[
                    "Get network settings",
                    "Show network configuration",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_update_settings",
                name="Update Network Settings",
                description="Update general network settings",
                tags=["networks", "settings", "update", "write"],
                examples=[
                    "Update network settings",
                    "Change network configuration",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "localStatusPageEnabled": {"type": "boolean", "description": "Enable local status page"},
                        "remoteStatusPageEnabled": {"type": "boolean", "description": "Enable remote status page"},
                        "localStatusPage": {"type": "object", "description": "Local status page settings"},
                        "securePort": {"type": "object", "description": "Secure port settings"},
                        "fips": {"type": "object", "description": "FIPS settings"},
                        "namedVlans": {"type": "object", "description": "Named VLANs settings"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # SNMP
            # -----------------------------------------------------------------
            create_skill(
                id="networks_get_snmp",
                name="Get SNMP Settings",
                description="Get SNMP settings for a network",
                tags=["networks", "snmp", "settings", "read"],
                examples=[
                    "Get SNMP settings",
                    "Show SNMP configuration",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_update_snmp",
                name="Update SNMP Settings",
                description="Update SNMP settings for a network",
                tags=["networks", "snmp", "settings", "update", "write"],
                examples=[
                    "Update SNMP settings",
                    "Configure SNMP",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "access": {"type": "string", "description": "SNMP access (none, community, users)"},
                        "communityString": {"type": "string", "description": "SNMP community string"},
                        "users": {"type": "array", "description": "SNMP v3 users", "items": {"type": "object"}},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Syslog
            # -----------------------------------------------------------------
            create_skill(
                id="networks_get_syslog_servers",
                name="Get Syslog Servers",
                description="Get syslog server settings for a network",
                tags=["networks", "syslog", "servers", "read"],
                examples=[
                    "Get syslog servers",
                    "Show syslog configuration",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="networks_update_syslog_servers",
                name="Update Syslog Servers",
                description="Update syslog server settings",
                tags=["networks", "syslog", "servers", "update", "write"],
                examples=[
                    "Update syslog servers",
                    "Configure syslog",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "servers": {"type": "array", "description": "Syslog servers", "items": {"type": "object"}},
                    },
                    required=["network_id", "servers"],
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
        """Execute a network skill."""
        log_skill_start(cls.MODULE_NAME, skill_id, params)

        try:
            # Core Network CRUD
            if skill_id == "networks_list":
                return await cls._list_networks(client, params, context)
            elif skill_id == "networks_get":
                return await cls._get_network(client, params, context)
            elif skill_id == "networks_create":
                return await cls._create_network(client, params, context)
            elif skill_id == "networks_update":
                return await cls._update_network(client, params, context)
            elif skill_id == "networks_delete":
                return await cls._delete_network(client, params, context)
            elif skill_id == "networks_bind_to_template":
                return await cls._bind_to_template(client, params, context)
            elif skill_id == "networks_unbind_from_template":
                return await cls._unbind_from_template(client, params, context)
            elif skill_id == "networks_split":
                return await cls._split_network(client, params, context)
            elif skill_id == "networks_list_devices":
                return await cls._list_network_devices(client, params, context)
            elif skill_id == "networks_combine":
                return await cls._combine_networks(client, params, context)

            # Clients
            elif skill_id == "networks_list_clients":
                return await cls._list_clients(client, params, context)
            elif skill_id == "networks_get_client":
                return await cls._get_client(client, params, context)
            elif skill_id == "networks_get_client_policy":
                return await cls._get_client_policy(client, params, context)
            elif skill_id == "networks_update_client_policy":
                return await cls._update_client_policy(client, params, context)
            elif skill_id == "networks_provision_clients":
                return await cls._provision_clients(client, params, context)
            elif skill_id == "networks_get_client_traffic":
                return await cls._get_client_traffic(client, params, context)
            elif skill_id == "networks_get_client_usage":
                return await cls._get_client_usage(client, params, context)

            # Events & Alerts
            elif skill_id == "networks_get_events":
                return await cls._get_events(client, params, context)
            elif skill_id == "networks_get_event_types":
                return await cls._get_event_types(client, params, context)
            elif skill_id == "networks_get_alerts_history":
                return await cls._get_alerts_history(client, params, context)
            elif skill_id == "networks_get_alerts_settings":
                return await cls._get_alerts_settings(client, params, context)
            elif skill_id == "networks_update_alerts_settings":
                return await cls._update_alerts_settings(client, params, context)
            elif skill_id == "networks_get_health_alerts":
                return await cls._get_health_alerts(client, params, context)

            # Firmware
            elif skill_id == "networks_get_firmware_upgrades":
                return await cls._get_firmware_upgrades(client, params, context)
            elif skill_id == "networks_update_firmware_upgrades":
                return await cls._update_firmware_upgrades(client, params, context)
            elif skill_id == "networks_create_firmware_rollback":
                return await cls._create_firmware_rollback(client, params, context)
            elif skill_id == "networks_get_firmware_staged_events":
                return await cls._get_firmware_staged_events(client, params, context)

            # Group Policies
            elif skill_id == "networks_list_group_policies":
                return await cls._list_group_policies(client, params, context)
            elif skill_id == "networks_create_group_policy":
                return await cls._create_group_policy(client, params, context)
            elif skill_id == "networks_get_group_policy":
                return await cls._get_group_policy(client, params, context)
            elif skill_id == "networks_update_group_policy":
                return await cls._update_group_policy(client, params, context)
            elif skill_id == "networks_delete_group_policy":
                return await cls._delete_group_policy(client, params, context)

            # Meraki Auth Users
            elif skill_id == "networks_list_meraki_auth_users":
                return await cls._list_meraki_auth_users(client, params, context)
            elif skill_id == "networks_create_meraki_auth_user":
                return await cls._create_meraki_auth_user(client, params, context)
            elif skill_id == "networks_get_meraki_auth_user":
                return await cls._get_meraki_auth_user(client, params, context)
            elif skill_id == "networks_update_meraki_auth_user":
                return await cls._update_meraki_auth_user(client, params, context)
            elif skill_id == "networks_delete_meraki_auth_user":
                return await cls._delete_meraki_auth_user(client, params, context)

            # Webhooks
            elif skill_id == "networks_list_webhooks":
                return await cls._list_webhooks(client, params, context)
            elif skill_id == "networks_create_webhook":
                return await cls._create_webhook(client, params, context)
            elif skill_id == "networks_get_webhook":
                return await cls._get_webhook(client, params, context)
            elif skill_id == "networks_update_webhook":
                return await cls._update_webhook(client, params, context)
            elif skill_id == "networks_delete_webhook":
                return await cls._delete_webhook(client, params, context)
            elif skill_id == "networks_test_webhook":
                return await cls._test_webhook(client, params, context)

            # Floor Plans
            elif skill_id == "networks_list_floor_plans":
                return await cls._list_floor_plans(client, params, context)
            elif skill_id == "networks_get_floor_plan":
                return await cls._get_floor_plan(client, params, context)
            elif skill_id == "networks_update_floor_plan":
                return await cls._update_floor_plan(client, params, context)
            elif skill_id == "networks_delete_floor_plan":
                return await cls._delete_floor_plan(client, params, context)

            # Traffic Analysis
            elif skill_id == "networks_get_traffic_analysis":
                return await cls._get_traffic_analysis(client, params, context)
            elif skill_id == "networks_update_traffic_analysis":
                return await cls._update_traffic_analysis(client, params, context)
            elif skill_id == "networks_get_traffic":
                return await cls._get_traffic(client, params, context)

            # Settings
            elif skill_id == "networks_get_settings":
                return await cls._get_settings(client, params, context)
            elif skill_id == "networks_update_settings":
                return await cls._update_settings(client, params, context)

            # SNMP
            elif skill_id == "networks_get_snmp":
                return await cls._get_snmp(client, params, context)
            elif skill_id == "networks_update_snmp":
                return await cls._update_snmp(client, params, context)

            # Syslog
            elif skill_id == "networks_get_syslog_servers":
                return await cls._get_syslog_servers(client, params, context)
            elif skill_id == "networks_update_syslog_servers":
                return await cls._update_syslog_servers(client, params, context)

            else:
                return error_result(f"Unknown skill: {skill_id}")

        except Exception as e:
            log_skill_error(cls.MODULE_NAME, skill_id, str(e))
            return error_result(str(e))

    # =========================================================================
    # Skill Handlers - Core Network CRUD
    # =========================================================================

    @classmethod
    async def _list_networks(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List networks in organization."""
        # Use param, fallback to context.org_id (from credentials), or auto-detect
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            # Auto-detect: fetch organizations and use first one
            try:
                orgs = await api_get(client, "/organizations")
                if orgs and len(orgs) > 0:
                    org_id = orgs[0].get("id")
                    logger.info(f"[NetworksModule] Auto-detected organization: {org_id}")
            except Exception as e:
                logger.warning(f"[NetworksModule] Failed to auto-detect organization: {e}")

        if not org_id:
            return error_result("No organization available. Please configure Meraki credentials in Settings.")

        query_params = {}
        for key in ["configTemplateId", "isBoundToConfigTemplate", "tags", "tagsFilterType", "perPage", "startingAfter"]:
            if params.get(key) is not None:
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/networks", params=query_params)
        log_skill_success(cls.MODULE_NAME, "networks_list", len(data) if isinstance(data, list) else 1)

        if not data:
            return empty_result("No networks found in this organization")

        entities = extract_network_entities(data)
        return success_result(data=data, entities=entities, follow_up="Would you like details about a specific network?")

    @classmethod
    async def _get_network(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get network details."""
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")

        data = await api_get(client, f"/networks/{network_id}")
        log_skill_success(cls.MODULE_NAME, "networks_get")
        return success_result(data=data, entities=extract_network_entities(data))

    @classmethod
    async def _create_network(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Create a network."""
        org_id = params.get("organization_id")
        name = params.get("name")
        product_types = params.get("productTypes")

        if not all([org_id, name, product_types]):
            return error_result("organization_id, name, and productTypes are required")

        body = {"name": name, "productTypes": product_types}
        for key in ["tags", "timeZone", "copyFromNetworkId", "notes"]:
            if params.get(key):
                body[key] = params[key]

        data = await api_post(client, f"/organizations/{org_id}/networks", data=body)
        log_skill_success(cls.MODULE_NAME, "networks_create")
        return success_result(data=data, entities=extract_network_entities(data), follow_up="Network created. Would you like to configure it?")

    @classmethod
    async def _update_network(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Update a network."""
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")

        body = {}
        for key in ["name", "timeZone", "tags", "enrollmentString", "notes"]:
            if params.get(key):
                body[key] = params[key]

        if not body:
            return error_result("No update parameters provided")

        data = await api_put(client, f"/networks/{network_id}", data=body)
        log_skill_success(cls.MODULE_NAME, "networks_update")
        return success_result(data=data)

    @classmethod
    async def _delete_network(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Delete a network."""
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")

        await api_delete(client, f"/networks/{network_id}")
        log_skill_success(cls.MODULE_NAME, "networks_delete")
        return success_result(data={"deleted": True, "network_id": network_id})

    @classmethod
    async def _bind_to_template(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Bind network to template."""
        network_id = params.get("network_id")
        config_template_id = params.get("configTemplateId")
        if not network_id or not config_template_id:
            return error_result("network_id and configTemplateId are required")

        body = {"configTemplateId": config_template_id}
        if params.get("autoBind") is not None:
            body["autoBind"] = params["autoBind"]

        data = await api_post(client, f"/networks/{network_id}/bind", data=body)
        log_skill_success(cls.MODULE_NAME, "networks_bind_to_template")
        return success_result(data=data)

    @classmethod
    async def _unbind_from_template(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Unbind network from template."""
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")

        body = {}
        if params.get("retainConfigs") is not None:
            body["retainConfigs"] = params["retainConfigs"]

        data = await api_post(client, f"/networks/{network_id}/unbind", data=body)
        log_skill_success(cls.MODULE_NAME, "networks_unbind_from_template")
        return success_result(data=data)

    @classmethod
    async def _split_network(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Split combined network."""
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")

        data = await api_post(client, f"/networks/{network_id}/split", data={})
        log_skill_success(cls.MODULE_NAME, "networks_split")
        return success_result(data=data)

    @classmethod
    async def _list_network_devices(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List devices in a network by name or ID."""
        network_id = params.get("network_id")
        network_name = params.get("network_name")

        # If we have network_id, use it directly
        if network_id:
            data = await api_get(client, f"/networks/{network_id}/devices")
            log_skill_success(cls.MODULE_NAME, "networks_list_devices", len(data) if isinstance(data, list) else 1)
            if not data:
                return empty_result(f"No devices found in network")
            return success_result(
                data=data,
                follow_up="Would you like details on a specific device?",
            )

        # If we have network_name, first list networks to find matching network
        if network_name:
            # Get org_id from context or params
            org_id = params.get("organization_id") or context.org_id
            if not org_id:
                # Try to auto-detect
                try:
                    orgs = await api_get(client, "/organizations")
                    if orgs and len(orgs) > 0:
                        org_id = orgs[0].get("id")
                except Exception:
                    pass

            if not org_id:
                return error_result("Could not determine organization. Please specify organization_id.")

            # List networks and find matching one
            networks = await api_get(client, f"/organizations/{org_id}/networks")
            if not networks:
                return error_result(f"No networks found in organization")

            # Find network by name (case-insensitive partial match)
            network_name_lower = network_name.lower()
            matching_networks = [
                n for n in networks
                if network_name_lower in n.get("name", "").lower()
            ]

            if not matching_networks:
                return error_result(f"No network found matching '{network_name}'")

            if len(matching_networks) > 1:
                # Multiple matches - list them
                network_names = [n.get("name") for n in matching_networks]
                return error_result(
                    f"Multiple networks match '{network_name}': {', '.join(network_names)}. "
                    f"Please be more specific."
                )

            # Found exactly one match
            matched_network = matching_networks[0]
            network_id = matched_network.get("id")
            logger.info(f"[NetworksModule] Resolved network '{network_name}' to ID: {network_id}")

            # Get devices in the network
            data = await api_get(client, f"/networks/{network_id}/devices")
            log_skill_success(cls.MODULE_NAME, "networks_list_devices", len(data) if isinstance(data, list) else 1)

            if not data:
                return empty_result(f"No devices found in network '{matched_network.get('name')}'")

            return success_result(
                data={
                    "network": {
                        "id": network_id,
                        "name": matched_network.get("name"),
                    },
                    "devices": data,
                    "device_count": len(data),
                },
                follow_up="Would you like details on a specific device?",
            )

        # No network_id or network_name provided - try to use context
        if context.cached_networks:
            # Use first cached network
            first_network = context.cached_networks[0]
            network_id = first_network.get("id")
            if network_id:
                data = await api_get(client, f"/networks/{network_id}/devices")
                return success_result(data=data)

        return error_result("Please specify either network_name or network_id")

    @classmethod
    async def _combine_networks(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Combine networks."""
        org_id = params.get("organization_id")
        name = params.get("name")
        network_ids = params.get("networkIds")

        if not all([org_id, name, network_ids]):
            return error_result("organization_id, name, and networkIds are required")

        body = {"name": name, "networkIds": network_ids}
        if params.get("enrollmentString"):
            body["enrollmentString"] = params["enrollmentString"]

        data = await api_post(client, f"/organizations/{org_id}/networks/combine", data=body)
        log_skill_success(cls.MODULE_NAME, "networks_combine")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Clients (Simplified for brevity)
    # =========================================================================

    @classmethod
    async def _list_clients(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "timespan", "perPage", "startingAfter", "statuses", "ip", "ip6", "ip6Local", "mac", "os", "pskGroup", "description", "vlan", "recentDeviceConnections"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/clients", params=query_params)
        log_skill_success(cls.MODULE_NAME, "networks_list_clients", len(data) if isinstance(data, list) else 1)
        return success_result(data=data)

    @classmethod
    async def _get_client(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        client_id = params.get("client_id")
        if not network_id or not client_id:
            return error_result("network_id and client_id are required")
        data = await api_get(client, f"/networks/{network_id}/clients/{client_id}")
        return success_result(data=data)

    @classmethod
    async def _get_client_policy(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        client_id = params.get("client_id")
        if not network_id or not client_id:
            return error_result("network_id and client_id are required")
        data = await api_get(client, f"/networks/{network_id}/clients/{client_id}/policy")
        return success_result(data=data)

    @classmethod
    async def _update_client_policy(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        client_id = params.get("client_id")
        if not network_id or not client_id:
            return error_result("network_id and client_id are required")
        body = {"devicePolicy": params.get("devicePolicy")}
        if params.get("groupPolicyId"):
            body["groupPolicyId"] = params["groupPolicyId"]
        data = await api_put(client, f"/networks/{network_id}/clients/{client_id}/policy", data=body)
        return success_result(data=data)

    @classmethod
    async def _provision_clients(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["clients", "devicePolicy", "groupPolicyId", "policiesBySecurityAppliance", "policiesBySsid"] if params.get(k)}
        data = await api_post(client, f"/networks/{network_id}/clients/provision", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_client_traffic(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        client_id = params.get("client_id")
        if not network_id or not client_id:
            return error_result("network_id and client_id are required")
        query_params = {k: params[k] for k in ["perPage", "startingAfter"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/clients/{client_id}/trafficHistory", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_client_usage(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        client_id = params.get("client_id")
        if not network_id or not client_id:
            return error_result("network_id and client_id are required")
        data = await api_get(client, f"/networks/{network_id}/clients/{client_id}/usageHistory")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Events & Alerts
    # =========================================================================

    @classmethod
    async def _get_events(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["productType", "includedEventTypes", "excludedEventTypes", "deviceMac", "deviceSerial", "deviceName", "clientIp", "clientMac", "clientName", "smDeviceMac", "smDeviceName", "perPage", "startingAfter", "endingBefore"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/events", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_event_types(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/events/eventTypes")
        return success_result(data=data)

    @classmethod
    async def _get_alerts_history(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["perPage", "startingAfter"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/alerts/history", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_alerts_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/alerts/settings")
        return success_result(data=data)

    @classmethod
    async def _update_alerts_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["defaultDestinations", "alerts", "muting"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/alerts/settings", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_health_alerts(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/health/alerts")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Firmware
    # =========================================================================

    @classmethod
    async def _get_firmware_upgrades(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/firmwareUpgrades")
        return success_result(data=data)

    @classmethod
    async def _update_firmware_upgrades(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["upgradeWindow", "timezone", "products"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/firmwareUpgrades", data=body)
        return success_result(data=data)

    @classmethod
    async def _create_firmware_rollback(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        product = params.get("product")
        if not network_id or not product:
            return error_result("network_id and product are required")
        body = {"product": product}
        for k in ["time", "reasons", "toVersion"]:
            if params.get(k):
                body[k] = params[k]
        data = await api_post(client, f"/networks/{network_id}/firmwareUpgrades/rollbacks", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_firmware_staged_events(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/firmwareUpgrades/staged/events")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Group Policies
    # =========================================================================

    @classmethod
    async def _list_group_policies(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/groupPolicies")
        return success_result(data=data)

    @classmethod
    async def _create_group_policy(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        name = params.get("name")
        if not network_id or not name:
            return error_result("network_id and name are required")
        body = {"name": name}
        for k in ["scheduling", "bandwidth", "firewallAndTrafficShaping", "contentFiltering", "splashAuthSettings", "vlanTagging", "bonjourForwarding"]:
            if params.get(k):
                body[k] = params[k]
        data = await api_post(client, f"/networks/{network_id}/groupPolicies", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_group_policy(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        policy_id = params.get("group_policy_id")
        if not network_id or not policy_id:
            return error_result("network_id and group_policy_id are required")
        data = await api_get(client, f"/networks/{network_id}/groupPolicies/{policy_id}")
        return success_result(data=data)

    @classmethod
    async def _update_group_policy(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        policy_id = params.get("group_policy_id")
        if not network_id or not policy_id:
            return error_result("network_id and group_policy_id are required")
        body = {k: params[k] for k in ["name", "scheduling", "bandwidth", "firewallAndTrafficShaping", "contentFiltering", "splashAuthSettings", "vlanTagging", "bonjourForwarding"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/groupPolicies/{policy_id}", data=body)
        return success_result(data=data)

    @classmethod
    async def _delete_group_policy(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        policy_id = params.get("group_policy_id")
        if not network_id or not policy_id:
            return error_result("network_id and group_policy_id are required")
        await api_delete(client, f"/networks/{network_id}/groupPolicies/{policy_id}")
        return success_result(data={"deleted": True})

    # =========================================================================
    # Skill Handlers - Auth Users
    # =========================================================================

    @classmethod
    async def _list_meraki_auth_users(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/merakiAuthUsers")
        return success_result(data=data)

    @classmethod
    async def _create_meraki_auth_user(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        email = params.get("email")
        authorizations = params.get("authorizations")
        if not network_id or not email or not authorizations:
            return error_result("network_id, email, and authorizations are required")
        body = {"email": email, "authorizations": authorizations}
        for k in ["name", "password", "accountType", "emailPasswordToUser", "isAdmin"]:
            if params.get(k) is not None:
                body[k] = params[k]
        data = await api_post(client, f"/networks/{network_id}/merakiAuthUsers", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_meraki_auth_user(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        user_id = params.get("meraki_auth_user_id")
        if not network_id or not user_id:
            return error_result("network_id and meraki_auth_user_id are required")
        data = await api_get(client, f"/networks/{network_id}/merakiAuthUsers/{user_id}")
        return success_result(data=data)

    @classmethod
    async def _update_meraki_auth_user(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        user_id = params.get("meraki_auth_user_id")
        if not network_id or not user_id:
            return error_result("network_id and meraki_auth_user_id are required")
        body = {k: params[k] for k in ["name", "password", "authorizations", "emailPasswordToUser"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/merakiAuthUsers/{user_id}", data=body)
        return success_result(data=data)

    @classmethod
    async def _delete_meraki_auth_user(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        user_id = params.get("meraki_auth_user_id")
        if not network_id or not user_id:
            return error_result("network_id and meraki_auth_user_id are required")
        await api_delete(client, f"/networks/{network_id}/merakiAuthUsers/{user_id}")
        return success_result(data={"deleted": True})

    # =========================================================================
    # Skill Handlers - Webhooks
    # =========================================================================

    @classmethod
    async def _list_webhooks(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/webhooks/httpServers")
        return success_result(data=data)

    @classmethod
    async def _create_webhook(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        name = params.get("name")
        url = params.get("url")
        if not network_id or not name or not url:
            return error_result("network_id, name, and url are required")
        body = {"name": name, "url": url}
        for k in ["sharedSecret", "payloadTemplate"]:
            if params.get(k):
                body[k] = params[k]
        data = await api_post(client, f"/networks/{network_id}/webhooks/httpServers", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_webhook(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        server_id = params.get("http_server_id")
        if not network_id or not server_id:
            return error_result("network_id and http_server_id are required")
        data = await api_get(client, f"/networks/{network_id}/webhooks/httpServers/{server_id}")
        return success_result(data=data)

    @classmethod
    async def _update_webhook(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        server_id = params.get("http_server_id")
        if not network_id or not server_id:
            return error_result("network_id and http_server_id are required")
        body = {k: params[k] for k in ["name", "url", "sharedSecret", "payloadTemplate"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/webhooks/httpServers/{server_id}", data=body)
        return success_result(data=data)

    @classmethod
    async def _delete_webhook(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        server_id = params.get("http_server_id")
        if not network_id or not server_id:
            return error_result("network_id and http_server_id are required")
        await api_delete(client, f"/networks/{network_id}/webhooks/httpServers/{server_id}")
        return success_result(data={"deleted": True})

    @classmethod
    async def _test_webhook(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        url = params.get("url")
        if not network_id or not url:
            return error_result("network_id and url are required")
        body = {"url": url}
        for k in ["sharedSecret", "payloadTemplate", "alertTypeId"]:
            if params.get(k):
                body[k] = params[k]
        data = await api_post(client, f"/networks/{network_id}/webhooks/webhookTests", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Floor Plans
    # =========================================================================

    @classmethod
    async def _list_floor_plans(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/floorPlans")
        return success_result(data=data)

    @classmethod
    async def _get_floor_plan(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        floor_plan_id = params.get("floor_plan_id")
        if not network_id or not floor_plan_id:
            return error_result("network_id and floor_plan_id are required")
        data = await api_get(client, f"/networks/{network_id}/floorPlans/{floor_plan_id}")
        return success_result(data=data)

    @classmethod
    async def _update_floor_plan(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        floor_plan_id = params.get("floor_plan_id")
        if not network_id or not floor_plan_id:
            return error_result("network_id and floor_plan_id are required")
        body = {k: params[k] for k in ["name", "center", "bottomLeftCorner", "bottomRightCorner", "topLeftCorner", "topRightCorner"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/floorPlans/{floor_plan_id}", data=body)
        return success_result(data=data)

    @classmethod
    async def _delete_floor_plan(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        floor_plan_id = params.get("floor_plan_id")
        if not network_id or not floor_plan_id:
            return error_result("network_id and floor_plan_id are required")
        await api_delete(client, f"/networks/{network_id}/floorPlans/{floor_plan_id}")
        return success_result(data={"deleted": True})

    # =========================================================================
    # Skill Handlers - Traffic Analysis
    # =========================================================================

    @classmethod
    async def _get_traffic_analysis(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/trafficAnalysis")
        return success_result(data=data)

    @classmethod
    async def _update_traffic_analysis(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["mode", "customPieChartItems"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/trafficAnalysis", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_traffic(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "timespan", "deviceType"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/traffic", params=query_params)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Settings
    # =========================================================================

    @classmethod
    async def _get_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/settings")
        return success_result(data=data)

    @classmethod
    async def _update_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["localStatusPageEnabled", "remoteStatusPageEnabled", "localStatusPage", "securePort", "fips", "namedVlans"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/settings", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - SNMP
    # =========================================================================

    @classmethod
    async def _get_snmp(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/snmp")
        return success_result(data=data)

    @classmethod
    async def _update_snmp(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["access", "communityString", "users"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/snmp", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Syslog
    # =========================================================================

    @classmethod
    async def _get_syslog_servers(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/syslogServers")
        return success_result(data=data)

    @classmethod
    async def _update_syslog_servers(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        servers = params.get("servers")
        if not network_id or not servers:
            return error_result("network_id and servers are required")
        data = await api_put(client, f"/networks/{network_id}/syslogServers", data={"servers": servers})
        return success_result(data=data)
