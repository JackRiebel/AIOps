"""
Catalyst Compliance Tools

Auto-generated from archived A2A skills.
Total tools: 8
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_compliance_get_status(params: Dict, context: Any) -> Dict:
    """Handler for Get Compliance Status."""
    try:
        # Build API path
        path = "/compliance/get/status"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_compliance_get_details(params: Dict, context: Any) -> Dict:
    """Handler for Get Compliance Details."""
    try:
        # Build API path
        path = "/compliance/get/details"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_compliance_run_check(params: Dict, context: Any) -> Dict:
    """Handler for Run Compliance Check."""
    try:
        # Build API path
        path = "/compliance/run/check"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_compliance_get_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Compliance Count."""
    try:
        # Build API path
        path = "/compliance/get/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_compliance_get_device_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Compliance by ID."""
    try:
        # Build API path
        path = "/compliance/get/device/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_compliance_get_config_details(params: Dict, context: Any) -> Dict:
    """Handler for Get Config Compliance Details."""
    try:
        # Build API path
        path = "/compliance/get/config/details"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_compliance_run_full_check(params: Dict, context: Any) -> Dict:
    """Handler for Run Full Compliance Check."""
    try:
        # Build API path
        path = "/compliance/run/full/check"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_compliance_get_rules(params: Dict, context: Any) -> Dict:
    """Handler for Get Compliance Rules."""
    try:
        # Build API path
        path = "/compliance/get/rules"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_COMPLIANCE_TOOLS = [
    create_tool(
        name="catalyst_compliance_get_status",
        description="""Get compliance status for devices.""",
        platform="catalyst",
        category="compliance",
        properties={
            "device_uuid": {
                        "type": "string"
            },
            "compliance_type": {
                        "type": "string",
                        "enum": [
                                    "RUNNING_CONFIG",
                                    "IMAGE",
                                    "PSIRT",
                                    "EOX",
                                    "NETWORK_SETTINGS"
                        ]
            },
            "compliance_status": {
                        "type": "string",
                        "enum": [
                                    "COMPLIANT",
                                    "NON_COMPLIANT",
                                    "IN_PROGRESS",
                                    "ERROR",
                                    "NOT_APPLICABLE"
                        ]
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            }
},
        required=[],
        tags=["catalyst", "compliance", "status"],
        requires_write=False,
        handler=handle_compliance_get_status,
    ),
    create_tool(
        name="catalyst_compliance_get_details",
        description="""Get detailed compliance info for a device.""",
        platform="catalyst",
        category="compliance",
        properties={
            "device_uuid": {
                        "type": "string",
                        "description": "Device Uuid"
            },
            "category": {
                        "type": "string"
            },
            "compliance_type": {
                        "type": "string"
            },
            "diff_list": {
                        "type": "boolean",
                        "default": False
            }
},
        required=["device_uuid"],
        tags=["catalyst", "compliance", "details"],
        requires_write=False,
        handler=handle_compliance_get_details,
    ),
    create_tool(
        name="catalyst_compliance_run_check",
        description="""Trigger compliance check for devices.""",
        platform="catalyst",
        category="compliance",
        properties={
            "trigger_full": {
                        "type": "boolean",
                        "default": False
            },
            "categories": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "device_uuids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=[],
        tags=["catalyst", "compliance", "check", "run"],
        requires_write=False,
        handler=handle_compliance_run_check,
    ),
    create_tool(
        name="catalyst_compliance_get_count",
        description="""Get count of compliant and non-compliant devices.""",
        platform="catalyst",
        category="compliance",
        properties={
            "compliance_status": {
                        "type": "string",
                        "enum": [
                                    "COMPLIANT",
                                    "NON_COMPLIANT",
                                    "IN_PROGRESS",
                                    "ERROR"
                        ]
            }
},
        required=[],
        tags=["catalyst", "compliance", "count"],
        requires_write=False,
        handler=handle_compliance_get_count,
    ),
    create_tool(
        name="catalyst_compliance_get_device_by_id",
        description="""Get compliance for a specific device.""",
        platform="catalyst",
        category="compliance",
        properties={
            "device_id": {
                        "type": "string",
                        "description": "Device Id"
            }
},
        required=["device_id"],
        tags=["catalyst", "compliance", "device"],
        requires_write=False,
        handler=handle_compliance_get_device_by_id,
    ),
    create_tool(
        name="catalyst_compliance_get_config_details",
        description="""Get configuration compliance status.""",
        platform="catalyst",
        category="compliance",
        properties={
            "device_uuid": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            }
},
        required=[],
        tags=["catalyst", "compliance", "config"],
        requires_write=False,
        handler=handle_compliance_get_config_details,
    ),
    create_tool(
        name="catalyst_compliance_run_full_check",
        description="""Trigger full compliance check for all devices.""",
        platform="catalyst",
        category="compliance",
        properties={
            "categories": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=[],
        tags=["catalyst", "compliance", "full", "check"],
        requires_write=False,
        handler=handle_compliance_run_full_check,
    ),
    create_tool(
        name="catalyst_compliance_get_rules",
        description="""Get compliance profile rules.""",
        platform="catalyst",
        category="compliance",
        properties={
            "profile_id": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "compliance", "rules", "profile"],
        requires_write=False,
        handler=handle_compliance_get_rules,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_compliance_tools():
    """Register all compliance tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_COMPLIANCE_TOOLS)
    logger.info(f"Registered {len(CATALYST_COMPLIANCE_TOOLS)} catalyst compliance tools")


# Auto-register on import
register_compliance_tools()
