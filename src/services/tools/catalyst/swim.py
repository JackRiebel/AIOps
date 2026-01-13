"""
Catalyst Swim Tools

Auto-generated from archived A2A skills.
Total tools: 15
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_swim_get_images(params: Dict, context: Any) -> Dict:
    """Handler for Get Software Images."""
    try:
        # Build API path
        path = "/swim/get/images"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_import_image_url(params: Dict, context: Any) -> Dict:
    """Handler for Import Image from URL."""
    try:
        # Build API path
        path = "/swim/import/image/url"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_import_image_file(params: Dict, context: Any) -> Dict:
    """Handler for Import Image from File."""
    try:
        # Build API path
        path = "/swim/import/image/file"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_get_image_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Image by ID."""
    try:
        # Build API path
        path = "/swim/get/image/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_distribute_image(params: Dict, context: Any) -> Dict:
    """Handler for Distribute Image."""
    try:
        # Build API path
        path = "/swim/distribute/image"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_get_distribution_status(params: Dict, context: Any) -> Dict:
    """Handler for Get Distribution Status."""
    try:
        # Build API path
        path = "/swim/get/distribution/status"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_activate_image(params: Dict, context: Any) -> Dict:
    """Handler for Activate Image."""
    try:
        # Build API path
        path = "/swim/activate/image"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_get_activation_status(params: Dict, context: Any) -> Dict:
    """Handler for Get Activation Status."""
    try:
        # Build API path
        path = "/swim/get/activation/status"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_get_device_family(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Family for Images."""
    try:
        # Build API path
        path = "/swim/get/device/family"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_tag_image_golden(params: Dict, context: Any) -> Dict:
    """Handler for Tag Image as Golden."""
    try:
        # Build API path
        path = "/swim/tag/image/golden"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_remove_golden_tag(params: Dict, context: Any) -> Dict:
    """Handler for Remove Golden Tag."""
    try:
        # Build API path
        path = "/swim/remove/golden/tag"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_get_golden_images(params: Dict, context: Any) -> Dict:
    """Handler for Get Golden Images."""
    try:
        # Build API path
        path = "/swim/get/golden/images"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_delete_image(params: Dict, context: Any) -> Dict:
    """Handler for Delete Image."""
    try:
        # Build API path
        path = "/swim/delete/image"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_get_applicable_devices(params: Dict, context: Any) -> Dict:
    """Handler for Get Applicable Devices."""
    try:
        # Build API path
        path = "/swim/get/applicable/devices"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_swim_trigger_upgrade(params: Dict, context: Any) -> Dict:
    """Handler for Trigger Image Upgrade."""
    try:
        # Build API path
        path = "/swim/trigger/upgrade"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_SWIM_TOOLS = [
    create_tool(
        name="catalyst_swim_get_images",
        description="""Get list of software images in repository.""",
        platform="catalyst",
        category="swim",
        properties={
            "image_uuid": {
                        "type": "string"
            },
            "name": {
                        "type": "string"
            },
            "family": {
                        "type": "string"
            },
            "application_type": {
                        "type": "string"
            },
            "image_integrity_status": {
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
        tags=["catalyst", "swim", "images", "list"],
        requires_write=False,
        handler=handle_swim_get_images,
    ),
    create_tool(
        name="catalyst_swim_import_image_url",
        description="""Import software image from a URL.""",
        platform="catalyst",
        category="swim",
        properties={
            "source_url": {
                        "type": "string"
            },
            "schedule_at": {
                        "type": "string"
            },
            "schedule_desc": {
                        "type": "string"
            },
            "third_party_vendor": {
                        "type": "string"
            },
            "third_party_image_family": {
                        "type": "string"
            }
},
        required=["source_url"],
        tags=["catalyst", "swim", "import", "url"],
        requires_write=False,
        handler=handle_swim_import_image_url,
    ),
    create_tool(
        name="catalyst_swim_import_image_file",
        description="""Import software image from local file.""",
        platform="catalyst",
        category="swim",
        properties={
            "file_path": {
                        "type": "string"
            },
            "third_party_vendor": {
                        "type": "string"
            },
            "third_party_image_family": {
                        "type": "string"
            }
},
        required=["file_path"],
        tags=["catalyst", "swim", "import", "file"],
        requires_write=False,
        handler=handle_swim_import_image_file,
    ),
    create_tool(
        name="catalyst_swim_get_image_by_id",
        description="""Get details of a specific software image.""",
        platform="catalyst",
        category="swim",
        properties={
            "image_id": {
                        "type": "string",
                        "description": "Image Id"
            }
},
        required=["image_id"],
        tags=["catalyst", "swim", "details"],
        requires_write=False,
        handler=handle_swim_get_image_by_id,
    ),
    create_tool(
        name="catalyst_swim_distribute_image",
        description="""Distribute software image to devices.""",
        platform="catalyst",
        category="swim",
        properties={
            "image_id": {
                        "type": "string",
                        "description": "Image Id"
            },
            "device_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["image_id", "device_ids"],
        tags=["catalyst", "swim", "distribute"],
        requires_write=False,
        handler=handle_swim_distribute_image,
    ),
    create_tool(
        name="catalyst_swim_get_distribution_status",
        description="""Get status of image distribution.""",
        platform="catalyst",
        category="swim",
        properties={
            "task_id": {
                        "type": "string"
            }
},
        required=["task_id"],
        tags=["catalyst", "swim", "distribution", "status"],
        requires_write=False,
        handler=handle_swim_get_distribution_status,
    ),
    create_tool(
        name="catalyst_swim_activate_image",
        description="""Activate software image on devices.""",
        platform="catalyst",
        category="swim",
        properties={
            "device_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "activate_lower_image_version": {
                        "type": "boolean",
                        "default": False
            },
            "schedule_validate": {
                        "type": "boolean",
                        "default": False
            }
},
        required=["device_ids"],
        tags=["catalyst", "swim", "activate"],
        requires_write=False,
        handler=handle_swim_activate_image,
    ),
    create_tool(
        name="catalyst_swim_get_activation_status",
        description="""Get status of image activation.""",
        platform="catalyst",
        category="swim",
        properties={
            "task_id": {
                        "type": "string"
            }
},
        required=["task_id"],
        tags=["catalyst", "swim", "activation", "status"],
        requires_write=False,
        handler=handle_swim_get_activation_status,
    ),
    create_tool(
        name="catalyst_swim_get_device_family",
        description="""Get device families for image management.""",
        platform="catalyst",
        category="swim",
        properties={},
        required=[],
        tags=["catalyst", "swim", "device", "family"],
        requires_write=False,
        handler=handle_swim_get_device_family,
    ),
    create_tool(
        name="catalyst_swim_tag_image_golden",
        description="""Mark an image as golden for a device family.""",
        platform="catalyst",
        category="swim",
        properties={
            "image_id": {
                        "type": "string",
                        "description": "Image Id"
            },
            "site_id": {
                        "type": "string"
            },
            "device_family": {
                        "type": "string"
            },
            "device_role": {
                        "type": "string"
            }
},
        required=["image_id"],
        tags=["catalyst", "swim", "golden", "tag"],
        requires_write=False,
        handler=handle_swim_tag_image_golden,
    ),
    create_tool(
        name="catalyst_swim_remove_golden_tag",
        description="""Remove golden tag from an image.""",
        platform="catalyst",
        category="swim",
        properties={
            "image_id": {
                        "type": "string",
                        "description": "Image Id"
            },
            "site_id": {
                        "type": "string"
            },
            "device_family": {
                        "type": "string"
            }
},
        required=["image_id"],
        tags=["catalyst", "swim", "golden", "untag"],
        requires_write=False,
        handler=handle_swim_remove_golden_tag,
    ),
    create_tool(
        name="catalyst_swim_get_golden_images",
        description="""Get list of golden images.""",
        platform="catalyst",
        category="swim",
        properties={
            "site_id": {
                        "type": "string"
            },
            "device_family": {
                        "type": "string"
            },
            "device_role": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "swim", "golden", "list"],
        requires_write=False,
        handler=handle_swim_get_golden_images,
    ),
    create_tool(
        name="catalyst_swim_delete_image",
        description="""Delete a software image from repository.""",
        platform="catalyst",
        category="swim",
        properties={
            "image_id": {
                        "type": "string",
                        "description": "Image Id"
            }
},
        required=["image_id"],
        tags=["catalyst", "swim", "delete"],
        requires_write=True,
        handler=handle_swim_delete_image,
    ),
    create_tool(
        name="catalyst_swim_get_applicable_devices",
        description="""Get devices that can use a specific image.""",
        platform="catalyst",
        category="swim",
        properties={
            "image_id": {
                        "type": "string",
                        "description": "Image Id"
            }
},
        required=["image_id"],
        tags=["catalyst", "swim", "applicable", "devices"],
        requires_write=False,
        handler=handle_swim_get_applicable_devices,
    ),
    create_tool(
        name="catalyst_swim_trigger_upgrade",
        description="""Trigger software upgrade on devices.""",
        platform="catalyst",
        category="swim",
        properties={
            "device_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "image_id": {
                        "type": "string",
                        "description": "Image Id"
            },
            "distribute_if_needed": {
                        "type": "boolean",
                        "default": True
            }
},
        required=["device_ids"],
        tags=["catalyst", "swim", "upgrade", "trigger"],
        requires_write=False,
        handler=handle_swim_trigger_upgrade,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_swim_tools():
    """Register all swim tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_SWIM_TOOLS)
    logger.info(f"Registered {len(CATALYST_SWIM_TOOLS)} catalyst swim tools")


# Auto-register on import
register_swim_tools()
