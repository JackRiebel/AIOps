"""
Meraki Licensing Tools

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

async def handle_licensing_get_coterm_licenses(params: Dict, context: Any) -> Dict:
    """Handler for Get Co-term Licenses."""
    try:
        # Build API path
        path = "/licensing/get/coterm/licenses"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_move_coterm_licenses(params: Dict, context: Any) -> Dict:
    """Handler for Move Co-term Licenses."""
    try:
        # Build API path
        path = "/licensing/move/coterm/licenses"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_get_per_device_overview(params: Dict, context: Any) -> Dict:
    """Handler for Get Per-Device Licensing Overview."""
    try:
        # Build API path
        path = "/licensing/get/per/device/overview"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_list_per_device_licenses(params: Dict, context: Any) -> Dict:
    """Handler for List Per-Device Licenses."""
    try:
        # Build API path
        path = "/licensing/list/per/device/licenses"
        path = path.replace("{organization_id}", params.get("organization_id", ""))
        path = path.replace("{network_id}", params.get("network_id", ""))
        path = path.replace("{device_serial}", params.get("device_serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_assign_per_device_license(params: Dict, context: Any) -> Dict:
    """Handler for Assign Per-Device License."""
    try:
        # Build API path
        path = "/licensing/assign/per/device/license"
        path = path.replace("{organization_id}", params.get("organization_id", ""))
        path = path.replace("{device_serial}", params.get("device_serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_move_per_device_licenses(params: Dict, context: Any) -> Dict:
    """Handler for Move Per-Device Licenses."""
    try:
        # Build API path
        path = "/licensing/move/per/device/licenses"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_renew_per_device_seats(params: Dict, context: Any) -> Dict:
    """Handler for Renew Per-Device Seats."""
    try:
        # Build API path
        path = "/licensing/renew/per/device/seats"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_get_subscription_entitlements(params: Dict, context: Any) -> Dict:
    """Handler for Get Subscription Entitlements."""
    try:
        # Build API path
        path = "/licensing/get/subscription/entitlements"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_list_subscriptions(params: Dict, context: Any) -> Dict:
    """Handler for List Subscriptions."""
    try:
        # Build API path
        path = "/licensing/list/subscriptions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_get_subscription(params: Dict, context: Any) -> Dict:
    """Handler for Get Subscription."""
    try:
        # Build API path
        path = "/licensing/get/subscription"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_claim_subscription(params: Dict, context: Any) -> Dict:
    """Handler for Claim Subscription."""
    try:
        # Build API path
        path = "/licensing/claim/subscription"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_bind_subscription(params: Dict, context: Any) -> Dict:
    """Handler for Bind Subscription."""
    try:
        # Build API path
        path = "/licensing/bind/subscription"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_get_compliance(params: Dict, context: Any) -> Dict:
    """Handler for Get License Compliance."""
    try:
        # Build API path
        path = "/licensing/get/compliance"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_licensing_get_device_licenses(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Licenses."""
    try:
        # Build API path
        path = "/licensing/get/device/licenses"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_LICENSING_TOOLS = [
    create_tool(
        name="meraki_licensing_get_coterm_licenses",
        description="""Get the co-termination licenses for an organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            },
            "invalidated": {
                        "type": "boolean",
                        "description": "Filter by invalidated status"
            },
            "expired": {
                        "type": "boolean",
                        "description": "Filter by expired status"
            }
},
        required=["organization_id"],
        tags=["meraki", "licensing", "coterm", "list"],
        requires_write=False,
        handler=handle_licensing_get_coterm_licenses,
    ),
    create_tool(
        name="meraki_licensing_move_coterm_licenses",
        description="""Move co-termination licenses to another organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "destination": {
                        "type": "string",
                        "description": "Destination organization ID"
            },
            "licenses": {
                        "type": "array",
                        "description": "Licenses to move",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "key": {
                                                            "type": "string"
                                                },
                                                "counts": {
                                                            "type": "array",
                                                            "items": {
                                                                        "type": "object"
                                                            }
                                                }
                                    }
                        }
            }
},
        required=["organization_id", "destination", "licenses"],
        tags=["meraki", "licensing", "coterm", "move"],
        requires_write=False,
        handler=handle_licensing_move_coterm_licenses,
    ),
    create_tool(
        name="meraki_licensing_get_per_device_overview",
        description="""Get the per-device licensing overview for an organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["meraki", "licensing", "per-device", "overview"],
        requires_write=False,
        handler=handle_licensing_get_per_device_overview,
    ),
    create_tool(
        name="meraki_licensing_list_per_device_licenses",
        description="""List the per-device licenses for an organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            },
            "device_serial": {
                        "type": "string",
                        "description": "Filter by device serial"
            },
            "network_id": {
                        "type": "string",
                        "description": "Filter by network ID"
            },
            "state": {
                        "type": "string",
                        "description": "Filter by state: active, expired, unusedActive, recentlyQueued, etc."
            }
},
        required=["organization_id"],
        tags=["meraki", "licensing", "per-device", "list"],
        requires_write=False,
        handler=handle_licensing_list_per_device_licenses,
    ),
    create_tool(
        name="meraki_licensing_assign_per_device_license",
        description="""Assign a per-device license to a device""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "license_id": {
                        "type": "string",
                        "description": "License Id"
            },
            "device_serial": {
                        "type": "string",
                        "description": "Device serial to assign license to"
            }
},
        required=["organization_id", "license_id", "device_serial"],
        tags=["meraki", "licensing", "per-device", "assign"],
        requires_write=False,
        handler=handle_licensing_assign_per_device_license,
    ),
    create_tool(
        name="meraki_licensing_move_per_device_licenses",
        description="""Move per-device licenses to another organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "dest_organization_id": {
                        "type": "string",
                        "description": "Destination organization ID"
            },
            "license_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "License IDs to move"
            }
},
        required=["organization_id", "dest_organization_id", "license_ids"],
        tags=["meraki", "licensing", "per-device", "move"],
        requires_write=False,
        handler=handle_licensing_move_per_device_licenses,
    ),
    create_tool(
        name="meraki_licensing_renew_per_device_seats",
        description="""Renew per-device seats for an organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "license_id_to_renew": {
                        "type": "string",
                        "description": "License ID to renew"
            },
            "unused_license_id": {
                        "type": "string",
                        "description": "Unused license ID to use for renewal"
            }
},
        required=["organization_id", "license_id_to_renew", "unused_license_id"],
        tags=["meraki", "licensing", "per-device", "renew"],
        requires_write=False,
        handler=handle_licensing_renew_per_device_seats,
    ),
    create_tool(
        name="meraki_licensing_get_subscription_entitlements",
        description="""Get the subscription entitlements for the account""",
        platform="meraki",
        category="licensing",
        properties={
            "skus": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by SKUs"
            }
},
        required=[],
        tags=["meraki", "licensing", "subscription", "entitlements"],
        requires_write=False,
        handler=handle_licensing_get_subscription_entitlements,
    ),
    create_tool(
        name="meraki_licensing_list_subscriptions",
        description="""List the subscriptions for the account""",
        platform="meraki",
        category="licensing",
        properties={
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            },
            "subscription_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by subscription IDs"
            },
            "organization_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by organization IDs"
            },
            "statuses": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by statuses"
            },
            "product_types": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Filter by product types"
            }
},
        required=[],
        tags=["meraki", "licensing", "subscription", "list"],
        requires_write=False,
        handler=handle_licensing_list_subscriptions,
    ),
    create_tool(
        name="meraki_licensing_get_subscription",
        description="""Get a specific subscription""",
        platform="meraki",
        category="licensing",
        properties={
            "subscription_id": {
                        "type": "string",
                        "description": "Subscription Id"
            }
},
        required=["subscription_id"],
        tags=["meraki", "licensing", "subscription", "get"],
        requires_write=False,
        handler=handle_licensing_get_subscription,
    ),
    create_tool(
        name="meraki_licensing_claim_subscription",
        description="""Claim a subscription to an organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "claim_key": {
                        "type": "string",
                        "description": "Claim key for the subscription"
            },
            "name": {
                        "type": "string",
                        "description": "Friendly name for the subscription"
            },
            "description": {
                        "type": "string",
                        "description": "Description"
            }
},
        required=["organization_id", "claim_key"],
        tags=["meraki", "licensing", "subscription", "claim"],
        requires_write=False,
        handler=handle_licensing_claim_subscription,
    ),
    create_tool(
        name="meraki_licensing_bind_subscription",
        description="""Bind a subscription to networks""",
        platform="meraki",
        category="licensing",
        properties={
            "subscription_id": {
                        "type": "string",
                        "description": "Subscription Id"
            },
            "network_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "Network IDs to bind"
            }
},
        required=["subscription_id", "network_ids"],
        tags=["meraki", "licensing", "subscription", "bind"],
        requires_write=False,
        handler=handle_licensing_bind_subscription,
    ),
    create_tool(
        name="meraki_licensing_get_compliance",
        description="""Get the license compliance status for an organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["meraki", "licensing", "compliance", "status"],
        requires_write=False,
        handler=handle_licensing_get_compliance,
    ),
    create_tool(
        name="meraki_licensing_get_device_licenses",
        description="""Get the licenses assigned to devices in an organization""",
        platform="meraki",
        category="licensing",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "per_page": {
                        "type": "integer",
                        "description": "Number of entries per page"
            }
},
        required=["organization_id"],
        tags=["meraki", "licensing", "devices", "list"],
        requires_write=False,
        handler=handle_licensing_get_device_licenses,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_licensing_tools():
    """Register all licensing tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_LICENSING_TOOLS)
    logger.info(f"Registered {len(MERAKI_LICENSING_TOOLS)} meraki licensing tools")


# Auto-register on import
register_licensing_tools()
