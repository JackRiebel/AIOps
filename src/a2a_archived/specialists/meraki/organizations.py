"""
Meraki Organizations skill module.

Provides skills for organization-level operations including:
- Organization CRUD (create, read, update, delete)
- Admin management
- Device operations (org-level)
- Alerts and notifications
- Config templates
- Inventory and claiming
- Action batches
- API usage monitoring
- Clients (org-level)
- Adaptive policy
- Branding policies
- SAML and login security
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
    extract_org_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    ORG_ID_SCHEMA,
)

logger = logging.getLogger(__name__)


class OrganizationsModule(MerakiSkillModule):
    """Meraki Organizations skill module."""

    MODULE_NAME = "organizations"
    MODULE_PREFIX = "organizations_"

    # =========================================================================
    # Skill Definitions
    # =========================================================================

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Return all organization skills."""
        return [
            # -----------------------------------------------------------------
            # Core Organization CRUD
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_list",
                name="List Organizations",
                description="List all Meraki organizations accessible with the API key",
                tags=["organizations", "list", "read"],
                examples=[
                    "List all my Meraki organizations",
                    "Show me my organizations",
                    "What orgs do I have access to?",
                    "Get all organizations",
                ],
            ),
            create_skill(
                id="organizations_get",
                name="Get Organization",
                description="Get details of a specific organization by ID",
                tags=["organizations", "get", "read", "details"],
                examples=[
                    "Get organization details",
                    "Show me organization info",
                    "Get org by ID",
                ],
                input_schema=ORG_ID_SCHEMA,
            ),
            create_skill(
                id="organizations_create",
                name="Create Organization",
                description="Create a new Meraki organization",
                tags=["organizations", "create", "write"],
                examples=[
                    "Create a new organization",
                    "Add a new org",
                    "Set up new organization",
                ],
                input_schema=build_input_schema(
                    {
                        "name": {"type": "string", "description": "Organization name"},
                        "management": {
                            "type": "object",
                            "description": "Management settings",
                            "properties": {
                                "details": {
                                    "type": "array",
                                    "items": {"type": "object"},
                                }
                            },
                        },
                    },
                    required=["name"],
                ),
            ),
            create_skill(
                id="organizations_update",
                name="Update Organization",
                description="Update an organization's name or settings",
                tags=["organizations", "update", "write"],
                examples=[
                    "Update organization name",
                    "Change org settings",
                    "Rename organization",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "name": {"type": "string", "description": "New organization name"},
                        "management": {"type": "object", "description": "Management settings"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_delete",
                name="Delete Organization",
                description="Delete an organization (requires org to be empty)",
                tags=["organizations", "delete", "write", "dangerous"],
                examples=[
                    "Delete organization",
                    "Remove org",
                ],
                input_schema=ORG_ID_SCHEMA,
            ),
            create_skill(
                id="organizations_clone",
                name="Clone Organization",
                description="Clone an existing organization to create a new one",
                tags=["organizations", "clone", "create", "write"],
                examples=[
                    "Clone organization",
                    "Copy org settings to new org",
                    "Duplicate organization",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Source organization ID"},
                        "name": {"type": "string", "description": "Name for the new organization"},
                    },
                    required=["organization_id", "name"],
                ),
            ),

            # -----------------------------------------------------------------
            # Admin Management
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_list_admins",
                name="List Organization Admins",
                description="List all administrators for an organization",
                tags=["organizations", "admins", "list", "read", "users"],
                examples=[
                    "List organization admins",
                    "Show me org administrators",
                    "Who has admin access?",
                    "Get all admins for the org",
                ],
                input_schema=ORG_ID_SCHEMA,
            ),
            create_skill(
                id="organizations_create_admin",
                name="Create Organization Admin",
                description="Create a new administrator for the organization",
                tags=["organizations", "admins", "create", "write", "users"],
                examples=[
                    "Add new admin to organization",
                    "Create org administrator",
                    "Give someone admin access",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "email": {"type": "string", "description": "Admin email address"},
                        "name": {"type": "string", "description": "Admin name"},
                        "orgAccess": {
                            "type": "string",
                            "description": "Organization access level",
                            "enum": ["full", "read-only", "enterprise", "none"],
                        },
                        "tags": {
                            "type": "array",
                            "description": "Network tags for access control",
                            "items": {"type": "object"},
                        },
                        "networks": {
                            "type": "array",
                            "description": "Network-specific access",
                            "items": {"type": "object"},
                        },
                    },
                    required=["organization_id", "email", "name", "orgAccess"],
                ),
            ),
            create_skill(
                id="organizations_update_admin",
                name="Update Organization Admin",
                description="Update an administrator's access or settings",
                tags=["organizations", "admins", "update", "write", "users"],
                examples=[
                    "Update admin permissions",
                    "Change admin access level",
                    "Modify administrator settings",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "admin_id": {"type": "string", "description": "Admin ID"},
                        "name": {"type": "string", "description": "Admin name"},
                        "orgAccess": {"type": "string", "description": "Organization access level"},
                        "tags": {"type": "array", "description": "Network tags"},
                        "networks": {"type": "array", "description": "Network access"},
                    },
                    required=["organization_id", "admin_id"],
                ),
            ),
            create_skill(
                id="organizations_delete_admin",
                name="Delete Organization Admin",
                description="Remove an administrator from the organization",
                tags=["organizations", "admins", "delete", "write", "users"],
                examples=[
                    "Remove admin from organization",
                    "Delete administrator",
                    "Revoke admin access",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "admin_id": {"type": "string", "description": "Admin ID to delete"},
                    },
                    required=["organization_id", "admin_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Device Operations (Org-level)
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_list_devices",
                name="List Organization Devices",
                description="List all devices across all networks in an organization",
                tags=["organizations", "devices", "list", "read", "inventory"],
                examples=[
                    "List all devices in org",
                    "Show me all organization devices",
                    "Get all Meraki devices",
                    "What devices are in my org?",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number of entries per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "configurationUpdatedAfter": {"type": "string", "description": "Filter by config update time"},
                        "networkIds": {"type": "array", "description": "Filter by network IDs", "items": {"type": "string"}},
                        "productTypes": {"type": "array", "description": "Filter by product types", "items": {"type": "string"}},
                        "tags": {"type": "array", "description": "Filter by tags", "items": {"type": "string"}},
                        "tagsFilterType": {"type": "string", "description": "Tag filter logic (withAnyTags, withAllTags)"},
                        "name": {"type": "string", "description": "Filter by device name"},
                        "mac": {"type": "string", "description": "Filter by MAC address"},
                        "serial": {"type": "string", "description": "Filter by serial number"},
                        "model": {"type": "string", "description": "Filter by model"},
                        "macs": {"type": "array", "description": "Filter by multiple MACs", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Filter by multiple serials", "items": {"type": "string"}},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_devices_statuses",
                name="Get Device Statuses",
                description="Get the online/offline status of all devices in an organization",
                tags=["organizations", "devices", "status", "read", "health", "monitoring"],
                examples=[
                    "Get device statuses",
                    "Which devices are online?",
                    "Show me offline devices",
                    "Check device connectivity status",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "networkIds": {"type": "array", "description": "Filter by networks", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Filter by serials", "items": {"type": "string"}},
                        "statuses": {"type": "array", "description": "Filter by status (online, alerting, offline, dormant)", "items": {"type": "string"}},
                        "productTypes": {"type": "array", "description": "Filter by product type", "items": {"type": "string"}},
                        "models": {"type": "array", "description": "Filter by models", "items": {"type": "string"}},
                        "tags": {"type": "array", "description": "Filter by tags", "items": {"type": "string"}},
                        "tagsFilterType": {"type": "string", "description": "Tag filter type"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_devices_availabilities",
                name="Get Device Availabilities",
                description="Get device availability history for an organization",
                tags=["organizations", "devices", "availability", "read", "health", "uptime"],
                examples=[
                    "Get device availability",
                    "Show device uptime history",
                    "Check device availability over time",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "networkIds": {"type": "array", "description": "Filter by networks", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Filter by serials", "items": {"type": "string"}},
                        "productTypes": {"type": "array", "description": "Filter by product type", "items": {"type": "string"}},
                        "tags": {"type": "array", "description": "Filter by tags", "items": {"type": "string"}},
                        "tagsFilterType": {"type": "string", "description": "Tag filter type"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_devices_uplinks_addresses",
                name="Get Device Uplink Addresses",
                description="Get uplink IP addresses for devices in an organization",
                tags=["organizations", "devices", "uplinks", "read", "ip", "addresses"],
                examples=[
                    "Get device uplink IPs",
                    "Show me WAN IP addresses",
                    "What are my device public IPs?",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "networkIds": {"type": "array", "description": "Filter by networks", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Filter by serials", "items": {"type": "string"}},
                        "productTypes": {"type": "array", "description": "Filter by product type", "items": {"type": "string"}},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_devices_power_modules_statuses",
                name="Get Power Module Statuses",
                description="Get power module status for devices with redundant power",
                tags=["organizations", "devices", "power", "read", "hardware", "status"],
                examples=[
                    "Check power module status",
                    "Show power supply health",
                    "Get redundant power status",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "networkIds": {"type": "array", "description": "Filter by networks", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Filter by serials", "items": {"type": "string"}},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_devices_provisioning_statuses",
                name="Get Provisioning Statuses",
                description="Get provisioning status for devices in an organization",
                tags=["organizations", "devices", "provisioning", "read", "status"],
                examples=[
                    "Check device provisioning status",
                    "Which devices are being provisioned?",
                    "Get provisioning progress",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "networkIds": {"type": "array", "description": "Filter by networks", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Filter by serials", "items": {"type": "string"}},
                        "status": {"type": "string", "description": "Filter by status"},
                    },
                    required=["organization_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Alerts & Notifications
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_list_alerts_profiles",
                name="List Alert Profiles",
                description="List all alert configuration profiles for an organization",
                tags=["organizations", "alerts", "list", "read", "notifications"],
                examples=[
                    "List alert profiles",
                    "Show me alert configurations",
                    "What alerts are configured?",
                ],
                input_schema=ORG_ID_SCHEMA,
            ),
            create_skill(
                id="organizations_create_alerts_profile",
                name="Create Alert Profile",
                description="Create a new alert configuration profile",
                tags=["organizations", "alerts", "create", "write", "notifications"],
                examples=[
                    "Create new alert profile",
                    "Set up alert configuration",
                    "Add alert notification",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "type": {"type": "string", "description": "Alert type"},
                        "alertCondition": {"type": "object", "description": "Alert condition settings"},
                        "recipients": {"type": "object", "description": "Alert recipients"},
                        "networkTags": {"type": "array", "description": "Network tags to apply alert to", "items": {"type": "string"}},
                        "description": {"type": "string", "description": "Alert description"},
                    },
                    required=["organization_id", "type", "alertCondition", "recipients", "networkTags"],
                ),
            ),
            create_skill(
                id="organizations_update_alerts_profile",
                name="Update Alert Profile",
                description="Update an existing alert configuration profile",
                tags=["organizations", "alerts", "update", "write", "notifications"],
                examples=[
                    "Update alert profile",
                    "Modify alert settings",
                    "Change alert configuration",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "alert_config_id": {"type": "string", "description": "Alert config ID"},
                        "enabled": {"type": "boolean", "description": "Enable/disable alert"},
                        "type": {"type": "string", "description": "Alert type"},
                        "alertCondition": {"type": "object", "description": "Alert condition"},
                        "recipients": {"type": "object", "description": "Recipients"},
                        "networkTags": {"type": "array", "items": {"type": "string"}},
                        "description": {"type": "string", "description": "Description"},
                    },
                    required=["organization_id", "alert_config_id"],
                ),
            ),
            create_skill(
                id="organizations_delete_alerts_profile",
                name="Delete Alert Profile",
                description="Delete an alert configuration profile",
                tags=["organizations", "alerts", "delete", "write", "notifications"],
                examples=[
                    "Delete alert profile",
                    "Remove alert configuration",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "alert_config_id": {"type": "string", "description": "Alert config ID to delete"},
                    },
                    required=["organization_id", "alert_config_id"],
                ),
            ),
            create_skill(
                id="organizations_get_assurance_alerts",
                name="Get Assurance Alerts",
                description="Get current assurance alerts for the organization",
                tags=["organizations", "alerts", "assurance", "read", "health"],
                examples=[
                    "Show assurance alerts",
                    "Get current alerts",
                    "What alerts are active?",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "sortOrder": {"type": "string", "description": "Sort order (ascending, descending)"},
                        "networkId": {"type": "string", "description": "Filter by network"},
                        "severity": {"type": "string", "description": "Filter by severity"},
                        "types": {"type": "array", "description": "Filter by types", "items": {"type": "string"}},
                        "tsStart": {"type": "string", "description": "Start time"},
                        "tsEnd": {"type": "string", "description": "End time"},
                        "serials": {"type": "array", "description": "Filter by serials", "items": {"type": "string"}},
                        "deviceTypes": {"type": "array", "description": "Filter by device types", "items": {"type": "string"}},
                        "dismissed": {"type": "boolean", "description": "Include dismissed alerts"},
                        "resolved": {"type": "boolean", "description": "Include resolved alerts"},
                        "suppressAlertsForOfflineNodes": {"type": "boolean", "description": "Suppress offline alerts"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_dismiss_assurance_alerts",
                name="Dismiss Assurance Alerts",
                description="Dismiss assurance alerts",
                tags=["organizations", "alerts", "assurance", "write", "dismiss"],
                examples=[
                    "Dismiss alerts",
                    "Clear assurance alerts",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "alertIds": {"type": "array", "description": "Alert IDs to dismiss", "items": {"type": "string"}},
                    },
                    required=["organization_id", "alertIds"],
                ),
            ),

            # -----------------------------------------------------------------
            # Config Templates
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_list_config_templates",
                name="List Config Templates",
                description="List all configuration templates for an organization",
                tags=["organizations", "config", "templates", "list", "read"],
                examples=[
                    "List config templates",
                    "Show configuration templates",
                    "What templates are available?",
                ],
                input_schema=ORG_ID_SCHEMA,
            ),
            create_skill(
                id="organizations_create_config_template",
                name="Create Config Template",
                description="Create a new configuration template",
                tags=["organizations", "config", "templates", "create", "write"],
                examples=[
                    "Create config template",
                    "Add new template",
                    "Set up configuration template",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "name": {"type": "string", "description": "Template name"},
                        "timeZone": {"type": "string", "description": "Time zone"},
                        "copyFromNetworkId": {"type": "string", "description": "Network to copy settings from"},
                    },
                    required=["organization_id", "name"],
                ),
            ),
            create_skill(
                id="organizations_get_config_template",
                name="Get Config Template",
                description="Get details of a configuration template",
                tags=["organizations", "config", "templates", "get", "read"],
                examples=[
                    "Get config template details",
                    "Show template settings",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "config_template_id": {"type": "string", "description": "Config template ID"},
                    },
                    required=["organization_id", "config_template_id"],
                ),
            ),
            create_skill(
                id="organizations_update_config_template",
                name="Update Config Template",
                description="Update a configuration template",
                tags=["organizations", "config", "templates", "update", "write"],
                examples=[
                    "Update config template",
                    "Modify template settings",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "config_template_id": {"type": "string", "description": "Config template ID"},
                        "name": {"type": "string", "description": "New name"},
                        "timeZone": {"type": "string", "description": "Time zone"},
                    },
                    required=["organization_id", "config_template_id"],
                ),
            ),
            create_skill(
                id="organizations_delete_config_template",
                name="Delete Config Template",
                description="Delete a configuration template",
                tags=["organizations", "config", "templates", "delete", "write"],
                examples=[
                    "Delete config template",
                    "Remove template",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "config_template_id": {"type": "string", "description": "Config template ID to delete"},
                    },
                    required=["organization_id", "config_template_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Inventory & Claiming
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_get_inventory_devices",
                name="Get Inventory Devices",
                description="Get the device inventory for an organization",
                tags=["organizations", "inventory", "devices", "list", "read"],
                examples=[
                    "Show device inventory",
                    "Get inventory devices",
                    "What devices are in inventory?",
                    "List unclaimed devices",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "usedState": {"type": "string", "description": "Filter by state (used, unused)"},
                        "search": {"type": "string", "description": "Search string"},
                        "macs": {"type": "array", "description": "Filter by MACs", "items": {"type": "string"}},
                        "networkIds": {"type": "array", "description": "Filter by networks", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Filter by serials", "items": {"type": "string"}},
                        "models": {"type": "array", "description": "Filter by models", "items": {"type": "string"}},
                        "orderNumbers": {"type": "array", "description": "Filter by order numbers", "items": {"type": "string"}},
                        "tags": {"type": "array", "description": "Filter by tags", "items": {"type": "string"}},
                        "tagsFilterType": {"type": "string", "description": "Tag filter type"},
                        "productTypes": {"type": "array", "description": "Filter by product types", "items": {"type": "string"}},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_claim_devices",
                name="Claim Devices",
                description="Claim devices into the organization inventory",
                tags=["organizations", "inventory", "claim", "write", "devices"],
                examples=[
                    "Claim device into org",
                    "Add device to inventory",
                    "Claim serial number",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "orders": {"type": "array", "description": "Order numbers to claim", "items": {"type": "string"}},
                        "serials": {"type": "array", "description": "Serial numbers to claim", "items": {"type": "string"}},
                        "licenses": {"type": "array", "description": "License keys to claim", "items": {"type": "object"}},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_release_devices",
                name="Release Devices",
                description="Release devices from the organization inventory",
                tags=["organizations", "inventory", "release", "write", "devices"],
                examples=[
                    "Release device from org",
                    "Remove device from inventory",
                    "Unclaim device",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "serials": {"type": "array", "description": "Serial numbers to release", "items": {"type": "string"}},
                    },
                    required=["organization_id", "serials"],
                ),
            ),
            create_skill(
                id="organizations_get_inventory_onboarding_cloud_status",
                name="Get Cloud Onboarding Status",
                description="Get cloud onboarding status for inventory devices",
                tags=["organizations", "inventory", "onboarding", "cloud", "read", "status"],
                examples=[
                    "Check cloud onboarding status",
                    "Get device onboarding progress",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "serials": {"type": "array", "description": "Device serials", "items": {"type": "string"}},
                    },
                    required=["organization_id", "serials"],
                ),
            ),

            # -----------------------------------------------------------------
            # Action Batches
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_list_action_batches",
                name="List Action Batches",
                description="List all action batches for an organization",
                tags=["organizations", "actions", "batches", "list", "read", "bulk"],
                examples=[
                    "List action batches",
                    "Show bulk operations",
                    "Get pending action batches",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "status": {"type": "string", "description": "Filter by status"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_create_action_batch",
                name="Create Action Batch",
                description="Create a new action batch for bulk operations",
                tags=["organizations", "actions", "batches", "create", "write", "bulk"],
                examples=[
                    "Create action batch",
                    "Start bulk operation",
                    "Queue batch actions",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "confirmed": {"type": "boolean", "description": "Confirm batch execution"},
                        "synchronous": {"type": "boolean", "description": "Execute synchronously"},
                        "actions": {"type": "array", "description": "Actions to execute", "items": {"type": "object"}},
                    },
                    required=["organization_id", "actions"],
                ),
            ),
            create_skill(
                id="organizations_get_action_batch",
                name="Get Action Batch",
                description="Get status of an action batch",
                tags=["organizations", "actions", "batches", "get", "read", "status"],
                examples=[
                    "Get action batch status",
                    "Check batch progress",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "action_batch_id": {"type": "string", "description": "Action batch ID"},
                    },
                    required=["organization_id", "action_batch_id"],
                ),
            ),
            create_skill(
                id="organizations_delete_action_batch",
                name="Delete Action Batch",
                description="Delete an action batch",
                tags=["organizations", "actions", "batches", "delete", "write"],
                examples=[
                    "Delete action batch",
                    "Cancel batch operation",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "action_batch_id": {"type": "string", "description": "Action batch ID to delete"},
                    },
                    required=["organization_id", "action_batch_id"],
                ),
            ),
            create_skill(
                id="organizations_update_action_batch",
                name="Update Action Batch",
                description="Update an action batch (confirm execution)",
                tags=["organizations", "actions", "batches", "update", "write"],
                examples=[
                    "Confirm action batch",
                    "Update batch settings",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "action_batch_id": {"type": "string", "description": "Action batch ID"},
                        "confirmed": {"type": "boolean", "description": "Confirm batch"},
                        "synchronous": {"type": "boolean", "description": "Execute synchronously"},
                    },
                    required=["organization_id", "action_batch_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # API Usage & Requests
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_get_api_requests",
                name="Get API Requests",
                description="Get API request log for the organization",
                tags=["organizations", "api", "requests", "read", "logs", "audit"],
                examples=[
                    "Show API request log",
                    "Get API usage history",
                    "View API audit log",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                        "adminId": {"type": "string", "description": "Filter by admin"},
                        "path": {"type": "string", "description": "Filter by API path"},
                        "method": {"type": "string", "description": "Filter by HTTP method"},
                        "responseCode": {"type": "integer", "description": "Filter by response code"},
                        "sourceIp": {"type": "string", "description": "Filter by source IP"},
                        "userAgent": {"type": "string", "description": "Filter by user agent"},
                        "version": {"type": "integer", "description": "API version filter"},
                        "operationIds": {"type": "array", "description": "Filter by operation IDs", "items": {"type": "string"}},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_api_requests_overview",
                name="Get API Requests Overview",
                description="Get API request overview/summary for the organization",
                tags=["organizations", "api", "requests", "overview", "read", "summary"],
                examples=[
                    "Get API usage overview",
                    "Show API request summary",
                    "API request statistics",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_api_requests_overview_response_codes",
                name="Get API Response Codes Overview",
                description="Get breakdown of API response codes",
                tags=["organizations", "api", "requests", "response", "codes", "read"],
                examples=[
                    "Show API response code breakdown",
                    "Get API error rates",
                    "API response statistics",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                    },
                    required=["organization_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Clients (Org-level)
            # -----------------------------------------------------------------
            create_skill(
                id="organizations_search_clients",
                name="Search Clients",
                description="Search for clients across the organization",
                tags=["organizations", "clients", "search", "read"],
                examples=[
                    "Search for client",
                    "Find device by MAC",
                    "Look up client",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "mac": {"type": "string", "description": "Client MAC address"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                    },
                    required=["organization_id", "mac"],
                ),
            ),
            create_skill(
                id="organizations_get_clients_bandwidth_usage",
                name="Get Clients Bandwidth Usage",
                description="Get bandwidth usage history for clients",
                tags=["organizations", "clients", "bandwidth", "usage", "read"],
                examples=[
                    "Get client bandwidth usage",
                    "Show bandwidth history",
                    "Client data usage",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                    },
                    required=["organization_id"],
                ),
            ),
            create_skill(
                id="organizations_get_clients_overview",
                name="Get Clients Overview",
                description="Get overview of clients in the organization",
                tags=["organizations", "clients", "overview", "read", "summary"],
                examples=[
                    "Get client overview",
                    "Show client summary",
                    "How many clients are connected?",
                ],
                input_schema=build_input_schema(
                    {
                        "organization_id": {"type": "string", "description": "Organization ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                    },
                    required=["organization_id"],
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
        """Execute an organization skill."""
        log_skill_start(cls.MODULE_NAME, skill_id, params)

        try:
            # Core CRUD
            if skill_id == "organizations_list":
                return await cls._list_organizations(client, params, context)
            elif skill_id == "organizations_get":
                return await cls._get_organization(client, params, context)
            elif skill_id == "organizations_create":
                return await cls._create_organization(client, params, context)
            elif skill_id == "organizations_update":
                return await cls._update_organization(client, params, context)
            elif skill_id == "organizations_delete":
                return await cls._delete_organization(client, params, context)
            elif skill_id == "organizations_clone":
                return await cls._clone_organization(client, params, context)

            # Admins
            elif skill_id == "organizations_list_admins":
                return await cls._list_admins(client, params, context)
            elif skill_id == "organizations_create_admin":
                return await cls._create_admin(client, params, context)
            elif skill_id == "organizations_update_admin":
                return await cls._update_admin(client, params, context)
            elif skill_id == "organizations_delete_admin":
                return await cls._delete_admin(client, params, context)

            # Device Operations
            elif skill_id == "organizations_list_devices":
                return await cls._list_devices(client, params, context)
            elif skill_id == "organizations_get_devices_statuses":
                return await cls._get_devices_statuses(client, params, context)
            elif skill_id == "organizations_get_devices_availabilities":
                return await cls._get_devices_availabilities(client, params, context)
            elif skill_id == "organizations_get_devices_uplinks_addresses":
                return await cls._get_devices_uplinks_addresses(client, params, context)
            elif skill_id == "organizations_get_devices_power_modules_statuses":
                return await cls._get_power_modules_statuses(client, params, context)
            elif skill_id == "organizations_get_devices_provisioning_statuses":
                return await cls._get_provisioning_statuses(client, params, context)

            # Alerts
            elif skill_id == "organizations_list_alerts_profiles":
                return await cls._list_alerts_profiles(client, params, context)
            elif skill_id == "organizations_create_alerts_profile":
                return await cls._create_alerts_profile(client, params, context)
            elif skill_id == "organizations_update_alerts_profile":
                return await cls._update_alerts_profile(client, params, context)
            elif skill_id == "organizations_delete_alerts_profile":
                return await cls._delete_alerts_profile(client, params, context)
            elif skill_id == "organizations_get_assurance_alerts":
                return await cls._get_assurance_alerts(client, params, context)
            elif skill_id == "organizations_dismiss_assurance_alerts":
                return await cls._dismiss_assurance_alerts(client, params, context)

            # Config Templates
            elif skill_id == "organizations_list_config_templates":
                return await cls._list_config_templates(client, params, context)
            elif skill_id == "organizations_create_config_template":
                return await cls._create_config_template(client, params, context)
            elif skill_id == "organizations_get_config_template":
                return await cls._get_config_template(client, params, context)
            elif skill_id == "organizations_update_config_template":
                return await cls._update_config_template(client, params, context)
            elif skill_id == "organizations_delete_config_template":
                return await cls._delete_config_template(client, params, context)

            # Inventory
            elif skill_id == "organizations_get_inventory_devices":
                return await cls._get_inventory_devices(client, params, context)
            elif skill_id == "organizations_claim_devices":
                return await cls._claim_devices(client, params, context)
            elif skill_id == "organizations_release_devices":
                return await cls._release_devices(client, params, context)
            elif skill_id == "organizations_get_inventory_onboarding_cloud_status":
                return await cls._get_inventory_onboarding_status(client, params, context)

            # Action Batches
            elif skill_id == "organizations_list_action_batches":
                return await cls._list_action_batches(client, params, context)
            elif skill_id == "organizations_create_action_batch":
                return await cls._create_action_batch(client, params, context)
            elif skill_id == "organizations_get_action_batch":
                return await cls._get_action_batch(client, params, context)
            elif skill_id == "organizations_delete_action_batch":
                return await cls._delete_action_batch(client, params, context)
            elif skill_id == "organizations_update_action_batch":
                return await cls._update_action_batch(client, params, context)

            # API Usage
            elif skill_id == "organizations_get_api_requests":
                return await cls._get_api_requests(client, params, context)
            elif skill_id == "organizations_get_api_requests_overview":
                return await cls._get_api_requests_overview(client, params, context)
            elif skill_id == "organizations_get_api_requests_overview_response_codes":
                return await cls._get_api_response_codes(client, params, context)

            # Clients
            elif skill_id == "organizations_search_clients":
                return await cls._search_clients(client, params, context)
            elif skill_id == "organizations_get_clients_bandwidth_usage":
                return await cls._get_clients_bandwidth(client, params, context)
            elif skill_id == "organizations_get_clients_overview":
                return await cls._get_clients_overview(client, params, context)

            else:
                return error_result(f"Unknown skill: {skill_id}")

        except Exception as e:
            log_skill_error(cls.MODULE_NAME, skill_id, str(e))
            return error_result(str(e))

    # =========================================================================
    # Skill Handlers - Core CRUD
    # =========================================================================

    @classmethod
    async def _list_organizations(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List all organizations."""
        data = await api_get(client, "/organizations")
        log_skill_success(cls.MODULE_NAME, "organizations_list", len(data) if isinstance(data, list) else 1)

        if not data:
            return empty_result("No organizations found with this API key")

        entities = extract_org_entities(data)
        return success_result(
            data=data,
            entities=entities,
            follow_up="Would you like to see networks or devices in a specific organization?",
        )

    @classmethod
    async def _get_organization(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get a specific organization."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        data = await api_get(client, f"/organizations/{org_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_get")
        return success_result(data=data, entities=extract_org_entities(data))

    @classmethod
    async def _create_organization(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Create a new organization."""
        name = params.get("name")
        if not name:
            return error_result("name is required")

        body = {"name": name}
        if params.get("management"):
            body["management"] = params["management"]

        data = await api_post(client, "/organizations", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_create")
        return success_result(
            data=data,
            entities=extract_org_entities(data),
            follow_up="Organization created. Would you like to add networks or claim devices?",
        )

    @classmethod
    async def _update_organization(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Update an organization."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        body = {}
        if params.get("name"):
            body["name"] = params["name"]
        if params.get("management"):
            body["management"] = params["management"]

        if not body:
            return error_result("No update parameters provided")

        data = await api_put(client, f"/organizations/{org_id}", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_update")
        return success_result(data=data)

    @classmethod
    async def _delete_organization(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Delete an organization."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        await api_delete(client, f"/organizations/{org_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_delete")
        return success_result(data={"deleted": True, "organization_id": org_id})

    @classmethod
    async def _clone_organization(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Clone an organization."""
        org_id = params.get("organization_id")
        name = params.get("name")
        if not org_id or not name:
            return error_result("organization_id and name are required")

        data = await api_post(client, f"/organizations/{org_id}/clone", data={"name": name})
        log_skill_success(cls.MODULE_NAME, "organizations_clone")
        return success_result(
            data=data,
            entities=extract_org_entities(data),
            follow_up="Organization cloned. Review the new organization settings?",
        )

    # =========================================================================
    # Skill Handlers - Admins
    # =========================================================================

    @classmethod
    async def _list_admins(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List organization admins."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        data = await api_get(client, f"/organizations/{org_id}/admins")
        log_skill_success(cls.MODULE_NAME, "organizations_list_admins", len(data) if isinstance(data, list) else 1)

        if not data:
            return empty_result("No administrators found")

        return success_result(
            data=data,
            follow_up="Would you like to add a new admin or modify permissions?",
        )

    @classmethod
    async def _create_admin(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Create organization admin."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        required = ["email", "name", "orgAccess"]
        for field in required:
            if not params.get(field):
                return error_result(f"{field} is required")

        body = {
            "email": params["email"],
            "name": params["name"],
            "orgAccess": params["orgAccess"],
        }
        if params.get("tags"):
            body["tags"] = params["tags"]
        if params.get("networks"):
            body["networks"] = params["networks"]

        data = await api_post(client, f"/organizations/{org_id}/admins", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_create_admin")
        return success_result(data=data)

    @classmethod
    async def _update_admin(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Update organization admin."""
        org_id = params.get("organization_id")
        admin_id = params.get("admin_id")
        if not org_id or not admin_id:
            return error_result("organization_id and admin_id are required")

        body = {}
        for field in ["name", "orgAccess", "tags", "networks"]:
            if params.get(field):
                body[field] = params[field]

        if not body:
            return error_result("No update parameters provided")

        data = await api_put(client, f"/organizations/{org_id}/admins/{admin_id}", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_update_admin")
        return success_result(data=data)

    @classmethod
    async def _delete_admin(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Delete organization admin."""
        org_id = params.get("organization_id")
        admin_id = params.get("admin_id")
        if not org_id or not admin_id:
            return error_result("organization_id and admin_id are required")

        await api_delete(client, f"/organizations/{org_id}/admins/{admin_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_delete_admin")
        return success_result(data={"deleted": True, "admin_id": admin_id})

    # =========================================================================
    # Skill Handlers - Device Operations
    # =========================================================================

    @classmethod
    async def _list_devices(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List devices - supports both org-level and network-level queries."""
        # Check if we have a specific network_id - use network-scoped endpoint
        network_id = params.get("network_id")
        if network_id:
            logger.info(f"[OrganizationsModule] Listing devices for network: {network_id}")
            data = await api_get(client, f"/networks/{network_id}/devices")
            log_skill_success(cls.MODULE_NAME, "organizations_list_devices", len(data) if isinstance(data, list) else 1)

            if not data:
                return empty_result(f"No devices found in network {params.get('network_name', network_id)}")

            return success_result(
                data=data,
                follow_up="Would you like to see device status or details for a specific device?",
            )

        # Otherwise, use org-level endpoint - auto-detect org_id if needed
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            # Auto-detect: fetch organizations and use first one
            try:
                orgs = await api_get(client, "/organizations")
                if orgs and len(orgs) > 0:
                    org_id = orgs[0].get("id")
                    logger.info(f"[OrganizationsModule] Auto-detected organization: {org_id}")
            except Exception as e:
                logger.warning(f"[OrganizationsModule] Failed to auto-detect organization: {e}")

        if not org_id:
            return error_result("No organization available. Please configure Meraki credentials in Settings.")

        query_params = {}
        for key in ["perPage", "startingAfter", "configurationUpdatedAfter", "networkIds",
                    "productTypes", "tags", "tagsFilterType", "name", "mac", "serial",
                    "model", "macs", "serials"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/devices", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_list_devices", len(data) if isinstance(data, list) else 1)

        if not data:
            return empty_result("No devices found matching criteria")

        return success_result(
            data=data,
            follow_up="Would you like to see device status or details for a specific device?",
        )

    @classmethod
    async def _get_devices_statuses(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get device statuses."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["perPage", "startingAfter", "networkIds", "serials", "statuses",
                    "productTypes", "models", "tags", "tagsFilterType"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/devices/statuses", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_devices_statuses", len(data) if isinstance(data, list) else 1)

        if not data:
            return empty_result("No device statuses found")

        # Summarize status counts
        if isinstance(data, list):
            status_counts = {}
            for device in data:
                status = device.get("status", "unknown")
                status_counts[status] = status_counts.get(status, 0) + 1
            summary = {"total_devices": len(data), "by_status": status_counts}
        else:
            summary = None

        return success_result(
            data={"devices": data, "summary": summary} if summary else data,
            follow_up="Would you like to investigate offline devices?",
        )

    @classmethod
    async def _get_devices_availabilities(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get device availabilities."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["perPage", "startingAfter", "networkIds", "serials", "productTypes", "tags", "tagsFilterType"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/devices/availabilities", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_devices_availabilities", len(data) if isinstance(data, list) else 1)

        return success_result(data=data)

    @classmethod
    async def _get_devices_uplinks_addresses(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get device uplink addresses."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["perPage", "startingAfter", "networkIds", "serials", "productTypes"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/devices/uplinks/addresses/byDevice", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_devices_uplinks_addresses", len(data) if isinstance(data, list) else 1)

        return success_result(data=data)

    @classmethod
    async def _get_power_modules_statuses(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get power module statuses."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        query_params = {}
        for key in ["perPage", "startingAfter", "networkIds", "serials"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/devices/powerModules/statuses/byDevice", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_devices_power_modules_statuses", len(data) if isinstance(data, list) else 1)

        return success_result(data=data)

    @classmethod
    async def _get_provisioning_statuses(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get provisioning statuses."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        query_params = {}
        for key in ["perPage", "startingAfter", "networkIds", "serials", "status"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/devices/provisioning/statuses", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_devices_provisioning_statuses", len(data) if isinstance(data, list) else 1)

        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Alerts
    # =========================================================================

    @classmethod
    async def _list_alerts_profiles(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List alert profiles."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        data = await api_get(client, f"/organizations/{org_id}/alerts/profiles")
        log_skill_success(cls.MODULE_NAME, "organizations_list_alerts_profiles", len(data) if isinstance(data, list) else 1)
        return success_result(data=data)

    @classmethod
    async def _create_alerts_profile(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Create alert profile."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        body = {}
        for key in ["type", "alertCondition", "recipients", "networkTags", "description"]:
            if params.get(key):
                body[key] = params[key]

        data = await api_post(client, f"/organizations/{org_id}/alerts/profiles", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_create_alerts_profile")
        return success_result(data=data)

    @classmethod
    async def _update_alerts_profile(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Update alert profile."""
        org_id = params.get("organization_id")
        alert_id = params.get("alert_config_id")
        if not org_id or not alert_id:
            return error_result("organization_id and alert_config_id are required")

        body = {}
        for key in ["enabled", "type", "alertCondition", "recipients", "networkTags", "description"]:
            if key in params:
                body[key] = params[key]

        data = await api_put(client, f"/organizations/{org_id}/alerts/profiles/{alert_id}", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_update_alerts_profile")
        return success_result(data=data)

    @classmethod
    async def _delete_alerts_profile(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Delete alert profile."""
        org_id = params.get("organization_id")
        alert_id = params.get("alert_config_id")
        if not org_id or not alert_id:
            return error_result("organization_id and alert_config_id are required")

        await api_delete(client, f"/organizations/{org_id}/alerts/profiles/{alert_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_delete_alerts_profile")
        return success_result(data={"deleted": True, "alert_config_id": alert_id})

    @classmethod
    async def _get_assurance_alerts(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get assurance alerts."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["perPage", "startingAfter", "sortOrder", "networkId", "severity",
                    "types", "tsStart", "tsEnd", "serials", "deviceTypes", "dismissed",
                    "resolved", "suppressAlertsForOfflineNodes"]:
            if params.get(key) is not None:
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/assurance/alerts", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_assurance_alerts", len(data) if isinstance(data, list) else 1)
        return success_result(data=data, follow_up="Would you like to dismiss any of these alerts?")

    @classmethod
    async def _dismiss_assurance_alerts(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Dismiss assurance alerts."""
        org_id = params.get("organization_id")
        alert_ids = params.get("alertIds")
        if not org_id or not alert_ids:
            return error_result("organization_id and alertIds are required")

        data = await api_post(client, f"/organizations/{org_id}/assurance/alerts/dismiss", data={"alertIds": alert_ids})
        log_skill_success(cls.MODULE_NAME, "organizations_dismiss_assurance_alerts")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Config Templates
    # =========================================================================

    @classmethod
    async def _list_config_templates(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List config templates."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        data = await api_get(client, f"/organizations/{org_id}/configTemplates")
        log_skill_success(cls.MODULE_NAME, "organizations_list_config_templates", len(data) if isinstance(data, list) else 1)
        return success_result(data=data)

    @classmethod
    async def _create_config_template(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Create config template."""
        org_id = params.get("organization_id")
        name = params.get("name")
        if not org_id or not name:
            return error_result("organization_id and name are required")

        body = {"name": name}
        if params.get("timeZone"):
            body["timeZone"] = params["timeZone"]
        if params.get("copyFromNetworkId"):
            body["copyFromNetworkId"] = params["copyFromNetworkId"]

        data = await api_post(client, f"/organizations/{org_id}/configTemplates", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_create_config_template")
        return success_result(data=data)

    @classmethod
    async def _get_config_template(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get config template."""
        org_id = params.get("organization_id")
        template_id = params.get("config_template_id")
        if not org_id or not template_id:
            return error_result("organization_id and config_template_id are required")

        data = await api_get(client, f"/organizations/{org_id}/configTemplates/{template_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_get_config_template")
        return success_result(data=data)

    @classmethod
    async def _update_config_template(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Update config template."""
        org_id = params.get("organization_id")
        template_id = params.get("config_template_id")
        if not org_id or not template_id:
            return error_result("organization_id and config_template_id are required")

        body = {}
        if params.get("name"):
            body["name"] = params["name"]
        if params.get("timeZone"):
            body["timeZone"] = params["timeZone"]

        data = await api_put(client, f"/organizations/{org_id}/configTemplates/{template_id}", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_update_config_template")
        return success_result(data=data)

    @classmethod
    async def _delete_config_template(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Delete config template."""
        org_id = params.get("organization_id")
        template_id = params.get("config_template_id")
        if not org_id or not template_id:
            return error_result("organization_id and config_template_id are required")

        await api_delete(client, f"/organizations/{org_id}/configTemplates/{template_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_delete_config_template")
        return success_result(data={"deleted": True, "config_template_id": template_id})

    # =========================================================================
    # Skill Handlers - Inventory
    # =========================================================================

    @classmethod
    async def _get_inventory_devices(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get inventory devices."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["perPage", "startingAfter", "usedState", "search", "macs",
                    "networkIds", "serials", "models", "orderNumbers", "tags",
                    "tagsFilterType", "productTypes"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/inventory/devices", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_inventory_devices", len(data) if isinstance(data, list) else 1)
        return success_result(data=data)

    @classmethod
    async def _claim_devices(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Claim devices into inventory."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        body = {}
        if params.get("orders"):
            body["orders"] = params["orders"]
        if params.get("serials"):
            body["serials"] = params["serials"]
        if params.get("licenses"):
            body["licenses"] = params["licenses"]

        if not body:
            return error_result("At least one of orders, serials, or licenses is required")

        data = await api_post(client, f"/organizations/{org_id}/claim", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_claim_devices")
        return success_result(data=data, follow_up="Devices claimed. Would you like to assign them to a network?")

    @classmethod
    async def _release_devices(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Release devices from inventory."""
        org_id = params.get("organization_id")
        serials = params.get("serials")
        if not org_id or not serials:
            return error_result("organization_id and serials are required")

        data = await api_post(client, f"/organizations/{org_id}/inventory/release", data={"serials": serials})
        log_skill_success(cls.MODULE_NAME, "organizations_release_devices")
        return success_result(data=data)

    @classmethod
    async def _get_inventory_onboarding_status(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get inventory onboarding cloud status."""
        org_id = params.get("organization_id")
        serials = params.get("serials")
        if not org_id or not serials:
            return error_result("organization_id and serials are required")

        query_params = {"serials": serials}
        data = await api_get(client, f"/organizations/{org_id}/inventory/onboarding/cloudMonitoring/imports", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_inventory_onboarding_cloud_status")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Action Batches
    # =========================================================================

    @classmethod
    async def _list_action_batches(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """List action batches."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        if params.get("status"):
            query_params["status"] = params["status"]

        data = await api_get(client, f"/organizations/{org_id}/actionBatches", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_list_action_batches", len(data) if isinstance(data, list) else 1)
        return success_result(data=data)

    @classmethod
    async def _create_action_batch(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Create action batch."""
        org_id = params.get("organization_id")
        actions = params.get("actions")
        if not org_id or not actions:
            return error_result("organization_id and actions are required")

        body = {"actions": actions}
        if params.get("confirmed") is not None:
            body["confirmed"] = params["confirmed"]
        if params.get("synchronous") is not None:
            body["synchronous"] = params["synchronous"]

        data = await api_post(client, f"/organizations/{org_id}/actionBatches", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_create_action_batch")
        return success_result(data=data)

    @classmethod
    async def _get_action_batch(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get action batch status."""
        org_id = params.get("organization_id")
        batch_id = params.get("action_batch_id")
        if not org_id or not batch_id:
            return error_result("organization_id and action_batch_id are required")

        data = await api_get(client, f"/organizations/{org_id}/actionBatches/{batch_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_get_action_batch")
        return success_result(data=data)

    @classmethod
    async def _delete_action_batch(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Delete action batch."""
        org_id = params.get("organization_id")
        batch_id = params.get("action_batch_id")
        if not org_id or not batch_id:
            return error_result("organization_id and action_batch_id are required")

        await api_delete(client, f"/organizations/{org_id}/actionBatches/{batch_id}")
        log_skill_success(cls.MODULE_NAME, "organizations_delete_action_batch")
        return success_result(data={"deleted": True, "action_batch_id": batch_id})

    @classmethod
    async def _update_action_batch(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Update action batch."""
        org_id = params.get("organization_id")
        batch_id = params.get("action_batch_id")
        if not org_id or not batch_id:
            return error_result("organization_id and action_batch_id are required")

        body = {}
        if params.get("confirmed") is not None:
            body["confirmed"] = params["confirmed"]
        if params.get("synchronous") is not None:
            body["synchronous"] = params["synchronous"]

        data = await api_put(client, f"/organizations/{org_id}/actionBatches/{batch_id}", data=body)
        log_skill_success(cls.MODULE_NAME, "organizations_update_action_batch")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - API Usage
    # =========================================================================

    @classmethod
    async def _get_api_requests(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get API requests log."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["t0", "t1", "timespan", "perPage", "startingAfter", "adminId",
                    "path", "method", "responseCode", "sourceIp", "userAgent",
                    "version", "operationIds"]:
            if params.get(key) is not None:
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/apiRequests", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_api_requests", len(data) if isinstance(data, list) else 1)
        return success_result(data=data)

    @classmethod
    async def _get_api_requests_overview(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get API requests overview."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["t0", "t1", "timespan"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/apiRequests/overview", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_api_requests_overview")
        return success_result(data=data)

    @classmethod
    async def _get_api_response_codes(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get API response codes overview."""
        org_id = params.get("organization_id")
        if not org_id:
            return error_result("organization_id is required")

        query_params = {}
        for key in ["t0", "t1", "timespan"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/apiRequests/overview/responseCodes/byInterval", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_api_requests_overview_response_codes")
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Clients
    # =========================================================================

    @classmethod
    async def _search_clients(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Search clients."""
        org_id = params.get("organization_id")
        mac = params.get("mac")
        if not org_id or not mac:
            return error_result("organization_id and mac are required")

        query_params = {"mac": mac}
        for key in ["perPage", "startingAfter"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/clients/search", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_search_clients")
        return success_result(data=data)

    @classmethod
    async def _get_clients_bandwidth(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get clients bandwidth usage."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["t0", "t1", "timespan"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/clients/bandwidthUsageHistory", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_clients_bandwidth_usage")
        return success_result(data=data)

    @classmethod
    async def _get_clients_overview(
        cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext
    ) -> SkillResult:
        """Get clients overview."""
        org_id = params.get("organization_id") or context.org_id
        if not org_id:
            return error_result("organization_id is required - please specify an organization")

        query_params = {}
        for key in ["t0", "t1", "timespan"]:
            if params.get(key):
                query_params[key] = params[key]

        data = await api_get(client, f"/organizations/{org_id}/clients/overview", params=query_params)
        log_skill_success(cls.MODULE_NAME, "organizations_get_clients_overview")
        return success_result(data=data)
