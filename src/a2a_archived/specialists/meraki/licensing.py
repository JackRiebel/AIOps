"""
Meraki Licensing skill module.

This module provides skills for license management including:
- Co-termination Licenses
- Per-Device Licensing
- Subscription Entitlements
- License Compliance
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
    extract_org_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    ORG_ID_SCHEMA,
)

# Common schemas
LICENSE_ID_SCHEMA = {
    "type": "string",
    "description": "License ID"
}

SUBSCRIPTION_ID_SCHEMA = {
    "type": "string",
    "description": "Subscription ID"
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

# Co-termination License Skills
COTERM_LICENSE_SKILLS: List[SkillDefinition] = [
    {
        "id": "licensing_get_coterm_licenses",
        "name": "Get Co-term Licenses",
        "description": "Get the co-termination licenses for an organization",
        "tags": ["meraki", "licensing", "coterm", "list"],
        "examples": [
            "Show co-term licenses",
            "List licenses",
            "What licenses do we have?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "invalidated": {"type": "boolean", "description": "Filter by invalidated status"},
                "expired": {"type": "boolean", "description": "Filter by expired status"},
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "licensing_move_coterm_licenses",
        "name": "Move Co-term Licenses",
        "description": "Move co-termination licenses to another organization",
        "tags": ["meraki", "licensing", "coterm", "move"],
        "examples": [
            "Move licenses to another org",
            "Transfer licenses",
            "Move co-term licenses",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "destination": {"type": "string", "description": "Destination organization ID"},
                "licenses": {
                    "type": "array",
                    "description": "Licenses to move",
                    "items": {
                        "type": "object",
                        "properties": {
                            "key": {"type": "string"},
                            "counts": {"type": "array", "items": {"type": "object"}},
                        },
                    },
                },
            },
            "required": ["organization_id", "destination", "licenses"],
        },
    },
]

# Per-Device License Skills
PER_DEVICE_LICENSE_SKILLS: List[SkillDefinition] = [
    {
        "id": "licensing_get_per_device_overview",
        "name": "Get Per-Device Licensing Overview",
        "description": "Get the per-device licensing overview for an organization",
        "tags": ["meraki", "licensing", "per-device", "overview"],
        "examples": [
            "Show license overview",
            "Get licensing summary",
            "What's our license status?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "licensing_list_per_device_licenses",
        "name": "List Per-Device Licenses",
        "description": "List the per-device licenses for an organization",
        "tags": ["meraki", "licensing", "per-device", "list"],
        "examples": [
            "List device licenses",
            "Show per-device licenses",
            "What licenses are assigned?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "device_serial": {"type": "string", "description": "Filter by device serial"},
                "network_id": {"type": "string", "description": "Filter by network ID"},
                "state": {"type": "string", "description": "Filter by state: active, expired, unusedActive, recentlyQueued, etc."},
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "licensing_assign_per_device_license",
        "name": "Assign Per-Device License",
        "description": "Assign a per-device license to a device",
        "tags": ["meraki", "licensing", "per-device", "assign"],
        "examples": [
            "Assign license to device",
            "License this device",
            "Add license to serial",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "license_id": LICENSE_ID_SCHEMA,
                "device_serial": {"type": "string", "description": "Device serial to assign license to"},
            },
            "required": ["organization_id", "license_id", "device_serial"],
        },
    },
    {
        "id": "licensing_move_per_device_licenses",
        "name": "Move Per-Device Licenses",
        "description": "Move per-device licenses to another organization",
        "tags": ["meraki", "licensing", "per-device", "move"],
        "examples": [
            "Move device licenses",
            "Transfer licenses to another org",
            "Move licenses",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "dest_organization_id": {"type": "string", "description": "Destination organization ID"},
                "license_ids": {"type": "array", "items": {"type": "string"}, "description": "License IDs to move"},
            },
            "required": ["organization_id", "dest_organization_id", "license_ids"],
        },
    },
    {
        "id": "licensing_renew_per_device_seats",
        "name": "Renew Per-Device Seats",
        "description": "Renew per-device seats for an organization",
        "tags": ["meraki", "licensing", "per-device", "renew"],
        "examples": [
            "Renew license seats",
            "Extend licensing",
            "Renew seats",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "license_id_to_renew": {"type": "string", "description": "License ID to renew"},
                "unused_license_id": {"type": "string", "description": "Unused license ID to use for renewal"},
            },
            "required": ["organization_id", "license_id_to_renew", "unused_license_id"],
        },
    },
]

# Subscription Skills
SUBSCRIPTION_SKILLS: List[SkillDefinition] = [
    {
        "id": "licensing_get_subscription_entitlements",
        "name": "Get Subscription Entitlements",
        "description": "Get the subscription entitlements for the account",
        "tags": ["meraki", "licensing", "subscription", "entitlements"],
        "examples": [
            "Show subscription entitlements",
            "What subscriptions do we have?",
            "Get subscription details",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "skus": {"type": "array", "items": {"type": "string"}, "description": "Filter by SKUs"},
            },
            "required": [],
        },
    },
    {
        "id": "licensing_list_subscriptions",
        "name": "List Subscriptions",
        "description": "List the subscriptions for the account",
        "tags": ["meraki", "licensing", "subscription", "list"],
        "examples": [
            "Show subscriptions",
            "List subscription licenses",
            "What subscriptions exist?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "subscription_ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by subscription IDs"},
                "organization_ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by organization IDs"},
                "statuses": {"type": "array", "items": {"type": "string"}, "description": "Filter by statuses"},
                "product_types": {"type": "array", "items": {"type": "string"}, "description": "Filter by product types"},
            },
            "required": [],
        },
    },
    {
        "id": "licensing_get_subscription",
        "name": "Get Subscription",
        "description": "Get a specific subscription",
        "tags": ["meraki", "licensing", "subscription", "get"],
        "examples": [
            "Get subscription details",
            "Show this subscription",
            "What's in this subscription?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "subscription_id": SUBSCRIPTION_ID_SCHEMA,
            },
            "required": ["subscription_id"],
        },
    },
    {
        "id": "licensing_claim_subscription",
        "name": "Claim Subscription",
        "description": "Claim a subscription to an organization",
        "tags": ["meraki", "licensing", "subscription", "claim"],
        "examples": [
            "Claim subscription",
            "Add subscription to org",
            "Activate subscription",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "claim_key": {"type": "string", "description": "Claim key for the subscription"},
                "name": {"type": "string", "description": "Friendly name for the subscription"},
                "description": {"type": "string", "description": "Description"},
            },
            "required": ["organization_id", "claim_key"],
        },
    },
    {
        "id": "licensing_bind_subscription",
        "name": "Bind Subscription",
        "description": "Bind a subscription to networks",
        "tags": ["meraki", "licensing", "subscription", "bind"],
        "examples": [
            "Bind subscription to networks",
            "Assign subscription",
            "Link subscription to network",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "subscription_id": SUBSCRIPTION_ID_SCHEMA,
                "network_ids": {"type": "array", "items": {"type": "string"}, "description": "Network IDs to bind"},
            },
            "required": ["subscription_id", "network_ids"],
        },
    },
]

# License Compliance Skills
COMPLIANCE_SKILLS: List[SkillDefinition] = [
    {
        "id": "licensing_get_compliance",
        "name": "Get License Compliance",
        "description": "Get the license compliance status for an organization",
        "tags": ["meraki", "licensing", "compliance", "status"],
        "examples": [
            "Check license compliance",
            "Are we compliant?",
            "Show compliance status",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "licensing_get_device_licenses",
        "name": "Get Device Licenses",
        "description": "Get the licenses assigned to devices in an organization",
        "tags": ["meraki", "licensing", "devices", "list"],
        "examples": [
            "Show device licenses",
            "What licenses are on our devices?",
            "Get licensed devices",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["organization_id"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class LicensingModule(MerakiSkillModule):
    """Licensing skills module."""

    MODULE_NAME = "licensing"
    MODULE_PREFIX = "licensing_"

    # Combine all skill definitions
    ALL_SKILLS: List[SkillDefinition] = (
        COTERM_LICENSE_SKILLS
        + PER_DEVICE_LICENSE_SKILLS
        + SUBSCRIPTION_SKILLS
        + COMPLIANCE_SKILLS
    )

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all licensing skills."""
        return [create_skill(skill_def) for skill_def in cls.ALL_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Execute a licensing skill."""
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
        org_id = params.get("organization_id") or extract_org_entities(params, context)

        # Co-term Licenses
        if skill_id == "licensing_get_coterm_licenses":
            query_params = {}
            for key in ["per_page", "invalidated", "expired"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/organizations/{org_id}/licensing/coterm/licenses", query_params)

        if skill_id == "licensing_move_coterm_licenses":
            body = {
                "destination": {"organizationId": params.get("destination")},
                "licenses": params.get("licenses", []),
            }
            return await api_post(client, f"/organizations/{org_id}/licensing/coterm/licenses/move", body)

        # Per-Device Licenses
        if skill_id == "licensing_get_per_device_overview":
            return await api_get(client, f"/organizations/{org_id}/licenses/overview")

        if skill_id == "licensing_list_per_device_licenses":
            query_params = {}
            for key in ["per_page", "device_serial", "network_id", "state"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, f"/organizations/{org_id}/licenses", query_params)

        if skill_id == "licensing_assign_per_device_license":
            license_id = params.get("license_id")
            body = {"deviceSerial": params.get("device_serial")}
            return await api_put(client, f"/organizations/{org_id}/licenses/{license_id}", body)

        if skill_id == "licensing_move_per_device_licenses":
            body = {
                "destOrganizationId": params.get("dest_organization_id"),
                "licenseIds": params.get("license_ids", []),
            }
            return await api_post(client, f"/organizations/{org_id}/licenses/move", body)

        if skill_id == "licensing_renew_per_device_seats":
            body = {
                "licenseIdToRenew": params.get("license_id_to_renew"),
                "unusedLicenseId": params.get("unused_license_id"),
            }
            return await api_post(client, f"/organizations/{org_id}/licenses/renewSeats", body)

        # Subscription Licenses
        if skill_id == "licensing_get_subscription_entitlements":
            query_params = {}
            if params.get("skus"):
                query_params["skus"] = params["skus"]
            return await api_get(client, "/administered/licensing/subscription/entitlements", query_params)

        if skill_id == "licensing_list_subscriptions":
            query_params = {}
            for key in ["per_page", "subscription_ids", "organization_ids", "statuses", "product_types"]:
                if params.get(key) is not None:
                    query_params[cls._to_camel_case(key)] = params[key]
            return await api_get(client, "/administered/licensing/subscription/subscriptions", query_params)

        if skill_id == "licensing_get_subscription":
            subscription_id = params.get("subscription_id")
            return await api_get(client, f"/administered/licensing/subscription/subscriptions/{subscription_id}")

        if skill_id == "licensing_claim_subscription":
            body = {
                "organizationId": org_id,
                "claimKey": params.get("claim_key"),
            }
            if params.get("name"):
                body["name"] = params["name"]
            if params.get("description"):
                body["description"] = params["description"]
            return await api_post(client, "/administered/licensing/subscription/subscriptions/claim", body)

        if skill_id == "licensing_bind_subscription":
            subscription_id = params.get("subscription_id")
            body = {"networkIds": params.get("network_ids", [])}
            return await api_post(client, f"/administered/licensing/subscription/subscriptions/{subscription_id}/bind", body)

        # Compliance
        if skill_id == "licensing_get_compliance":
            return await api_get(client, f"/organizations/{org_id}/licensing/coterm/licenses")

        if skill_id == "licensing_get_device_licenses":
            query_params = {}
            if params.get("per_page"):
                query_params["perPage"] = params["per_page"]
            return await api_get(client, f"/organizations/{org_id}/devices/statuses", query_params)

        # Unknown skill
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    def _to_camel_case(cls, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])
