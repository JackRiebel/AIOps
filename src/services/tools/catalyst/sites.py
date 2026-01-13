"""
Catalyst Sites Tools

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

async def handle_sites_get_site(params: Dict, context: Any) -> Dict:
    """Handler for Get Sites."""
    try:
        # Build API path
        path = "/sites/get/site"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_get_site_v2(params: Dict, context: Any) -> Dict:
    """Handler for Get Sites (v2 API)."""
    try:
        # Build API path
        path = "/sites/get/site/v2"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_create_site(params: Dict, context: Any) -> Dict:
    """Handler for Create Site."""
    try:
        # Build API path
        path = "/sites/create/site"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_update_site(params: Dict, context: Any) -> Dict:
    """Handler for Update Site."""
    try:
        # Build API path
        path = "/sites/update/site"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_delete_site(params: Dict, context: Any) -> Dict:
    """Handler for Delete Site."""
    try:
        # Build API path
        path = "/sites/delete/site"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_get_site_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Site Count."""
    try:
        # Build API path
        path = "/sites/get/site/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_get_site_health(params: Dict, context: Any) -> Dict:
    """Handler for Get Site Health."""
    try:
        # Build API path
        path = "/sites/get/site/health"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_assign_devices(params: Dict, context: Any) -> Dict:
    """Handler for Assign Devices to Site."""
    try:
        # Build API path
        path = "/sites/assign/devices"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_get_membership(params: Dict, context: Any) -> Dict:
    """Handler for Get Site Membership."""
    try:
        # Build API path
        path = "/sites/get/membership"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_get_devices_assigned(params: Dict, context: Any) -> Dict:
    """Handler for Get Devices Assigned to Site."""
    try:
        # Build API path
        path = "/sites/get/devices/assigned"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_create_floor(params: Dict, context: Any) -> Dict:
    """Handler for Create Floor."""
    try:
        # Build API path
        path = "/sites/create/floor"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_get_floor(params: Dict, context: Any) -> Dict:
    """Handler for Get Floor Details."""
    try:
        # Build API path
        path = "/sites/get/floor"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_update_floor(params: Dict, context: Any) -> Dict:
    """Handler for Update Floor."""
    try:
        # Build API path
        path = "/sites/update/floor"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_delete_floor(params: Dict, context: Any) -> Dict:
    """Handler for Delete Floor."""
    try:
        # Build API path
        path = "/sites/delete/floor"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sites_upload_floor_image(params: Dict, context: Any) -> Dict:
    """Handler for Upload Floor Image."""
    try:
        # Build API path
        path = "/sites/upload/floor/image"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_SITES_TOOLS = [
    create_tool(
        name="catalyst_sites_get_site",
        description="""Get site hierarchy from Catalyst Center. Returns all sites or filter by name, type, or site ID. Sites are organized in a hierarchy: Global > Area > Building > Floor.""",
        platform="catalyst",
        category="sites",
        properties={
            "name": {
                        "type": "string",
                        "description": "Site name to filter by (supports hierarchy like 'Global/US/Building1')"
            },
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "type": {
                        "description": "Filter by site type (area, building, floor)"
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
        tags=["catalyst", "sites", "hierarchy", "inventory"],
        requires_write=False,
        handler=handle_sites_get_site,
    ),
    create_tool(
        name="catalyst_sites_get_site_v2",
        description="""Get sites using the v2 API which provides enhanced site information including additional metadata and improved hierarchy representation.""",
        platform="catalyst",
        category="sites",
        properties={
            "group_name_hierarchy": {
                        "type": "string",
                        "description": "Full group name hierarchy (e.g., 'Global/US/Building1')"
            },
            "id": {
                        "type": "string",
                        "description": "Id"
            },
            "type": {
                        "type": "string",
                        "description": "Type"
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
        tags=["catalyst", "sites", "hierarchy", "v2"],
        requires_write=False,
        handler=handle_sites_get_site_v2,
    ),
    create_tool(
        name="catalyst_sites_create_site",
        description="""Create a new site in Catalyst Center. Sites can be areas (regions), buildings, or floors. Each site must have a parent in the hierarchy (except Global).""",
        platform="catalyst",
        category="sites",
        properties={
            "type": {
                        "description": "Type of site to create (area, building, floor)"
            },
            "site_name": {
                        "type": "string",
                        "description": "Name for the new site"
            },
            "parent_name": {
                        "type": "string",
                        "description": "Parent site hierarchy (e.g., 'Global/US' for creating a building under US)"
            },
            "address": {
                        "type": "string",
                        "description": "Physical address (for buildings)"
            },
            "latitude": {
                        "type": "number",
                        "description": "Latitude coordinate (for buildings)"
            },
            "longitude": {
                        "type": "number",
                        "description": "Longitude coordinate (for buildings)"
            },
            "rf_model": {
                        "type": "string",
                        "description": "RF model for floor (e.g., 'Cubes And Walled Offices')",
                        "enum": [
                                    "Cubes And Walled Offices",
                                    "Drywall Office Only",
                                    "Indoor High Ceiling",
                                    "Outdoor Open Space"
                        ]
            },
            "width": {
                        "type": "number",
                        "description": "Floor width in feet"
            },
            "length": {
                        "type": "number",
                        "description": "Floor length in feet"
            },
            "height": {
                        "type": "number",
                        "description": "Floor height in feet"
            }
},
        required=["type", "site_name", "parent_name"],
        tags=["catalyst", "sites", "create", "hierarchy"],
        requires_write=True,
        handler=handle_sites_create_site,
    ),
    create_tool(
        name="catalyst_sites_update_site",
        description="""Update an existing site's configuration including name, address, coordinates, or floor dimensions.""",
        platform="catalyst",
        category="sites",
        properties={
            "site_id": {
                        "description": "ID of the site to update"
            },
            "type": {
                        "type": "string",
                        "description": "Type"
            },
            "site_name": {
                        "type": "string",
                        "description": "New name for the site"
            },
            "address": {
                        "type": "string",
                        "description": "New physical address (for buildings)"
            },
            "latitude": {
                        "type": "number",
                        "description": "New latitude coordinate"
            },
            "longitude": {
                        "type": "number",
                        "description": "New longitude coordinate"
            },
            "rf_model": {
                        "type": "string",
                        "description": "New RF model for floor"
            },
            "width": {
                        "type": "number",
                        "description": "New floor width in feet"
            },
            "length": {
                        "type": "number",
                        "description": "New floor length in feet"
            },
            "height": {
                        "type": "number",
                        "description": "New floor height in feet"
            }
},
        required=["site_id", "type"],
        tags=["catalyst", "sites", "update", "modify"],
        requires_write=True,
        handler=handle_sites_update_site,
    ),
    create_tool(
        name="catalyst_sites_delete_site",
        description="""Delete a site from Catalyst Center. The site must not have any child sites or assigned devices before deletion.""",
        platform="catalyst",
        category="sites",
        properties={
            "site_id": {
                        "description": "ID of the site to delete"
            }
},
        required=["site_id"],
        tags=["catalyst", "sites", "delete", "remove"],
        requires_write=True,
        handler=handle_sites_delete_site,
    ),
    create_tool(
        name="catalyst_sites_get_site_count",
        description="""Get the total count of sites in Catalyst Center, optionally filtered by site ID.""",
        platform="catalyst",
        category="sites",
        properties={
            "site_id": {
                        "description": "Optional site ID to count children"
            }
},
        required=[],
        tags=["catalyst", "sites", "count", "statistics"],
        requires_write=False,
        handler=handle_sites_get_site_count,
    ),
    create_tool(
        name="catalyst_sites_get_site_health",
        description="""Get health metrics for sites including network health scores, client health, and device health summaries. Supports time-based filtering.""",
        platform="catalyst",
        category="sites",
        properties={
            "site_id": {
                        "description": "Filter health data for specific site"
            },
            "timestamp": {
                        "description": "Epoch timestamp for point-in-time health data"
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
        tags=["catalyst", "sites", "health", "monitoring", "assurance"],
        requires_write=False,
        handler=handle_sites_get_site_health,
    ),
    create_tool(
        name="catalyst_sites_assign_devices",
        description="""Assign one or more network devices to a site. Devices can be assigned to buildings or floors for location-based management.""",
        platform="catalyst",
        category="sites",
        properties={
            "site_id": {
                        "description": "Target site ID to assign devices to"
            },
            "device_ids": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        },
                        "description": "List of device UUIDs to assign"
            }
},
        required=["site_id", "device_ids"],
        tags=["catalyst", "sites", "devices", "assign", "membership"],
        requires_write=False,
        handler=handle_sites_assign_devices,
    ),
    create_tool(
        name="catalyst_sites_get_membership",
        description="""Get the device membership for a site, showing which devices are assigned to the site and its children.""",
        platform="catalyst",
        category="sites",
        properties={
            "site_id": {
                        "description": "Site ID to get membership for"
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
        required=["site_id"],
        tags=["catalyst", "sites", "membership", "devices"],
        requires_write=False,
        handler=handle_sites_get_membership,
    ),
    create_tool(
        name="catalyst_sites_get_devices_assigned",
        description="""Get detailed list of network devices assigned to a specific site, including device details and status.""",
        platform="catalyst",
        category="sites",
        properties={
            "site_id": {
                        "description": "Site ID to get devices for"
            }
},
        required=["site_id"],
        tags=["catalyst", "sites", "devices", "inventory"],
        requires_write=False,
        handler=handle_sites_get_devices_assigned,
    ),
    create_tool(
        name="catalyst_sites_create_floor",
        description="""Create a new floor within a building. Floors require dimensions and can include RF model settings for wireless planning.""",
        platform="catalyst",
        category="sites",
        properties={
            "parent_building_id": {
                        "type": "string",
                        "description": "Building ID to create floor under"
            },
            "name": {
                        "type": "string",
                        "description": "Floor name (e.g., 'Floor 1')"
            },
            "floor_number": {
                        "type": "integer",
                        "description": "Floor number"
            },
            "rf_model": {
                        "type": "string",
                        "description": "RF model for wireless planning",
                        "enum": [
                                    "Cubes And Walled Offices",
                                    "Drywall Office Only",
                                    "Indoor High Ceiling",
                                    "Outdoor Open Space"
                        ]
            },
            "width": {
                        "type": "number",
                        "description": "Floor width in feet"
            },
            "length": {
                        "type": "number",
                        "description": "Floor length in feet"
            },
            "height": {
                        "type": "number",
                        "description": "Ceiling height in feet",
                        "default": 10
            }
},
        required=["parent_building_id", "name", "width", "length"],
        tags=["catalyst", "sites", "floor", "create", "wireless"],
        requires_write=True,
        handler=handle_sites_create_floor,
    ),
    create_tool(
        name="catalyst_sites_get_floor",
        description="""Get detailed information about a specific floor including dimensions, RF model, and associated devices.""",
        platform="catalyst",
        category="sites",
        properties={
            "floor_id": {
                        "type": "string",
                        "description": "Floor ID to retrieve"
            }
},
        required=["floor_id"],
        tags=["catalyst", "sites", "floor", "details"],
        requires_write=False,
        handler=handle_sites_get_floor,
    ),
    create_tool(
        name="catalyst_sites_update_floor",
        description="""Update floor configuration including dimensions, RF model, and other floor-specific settings.""",
        platform="catalyst",
        category="sites",
        properties={
            "floor_id": {
                        "type": "string",
                        "description": "Floor ID to update"
            },
            "name": {
                        "type": "string",
                        "description": "New floor name"
            },
            "rf_model": {
                        "type": "string",
                        "description": "New RF model"
            },
            "width": {
                        "type": "number",
                        "description": "New width in feet"
            },
            "length": {
                        "type": "number",
                        "description": "New length in feet"
            },
            "height": {
                        "type": "number",
                        "description": "New ceiling height in feet"
            }
},
        required=["floor_id"],
        tags=["catalyst", "sites", "floor", "update"],
        requires_write=True,
        handler=handle_sites_update_floor,
    ),
    create_tool(
        name="catalyst_sites_delete_floor",
        description="""Delete a floor from a building. All devices must be unassigned from the floor before deletion.""",
        platform="catalyst",
        category="sites",
        properties={
            "floor_id": {
                        "type": "string",
                        "description": "Floor ID to delete"
            }
},
        required=["floor_id"],
        tags=["catalyst", "sites", "floor", "delete"],
        requires_write=True,
        handler=handle_sites_delete_floor,
    ),
    create_tool(
        name="catalyst_sites_upload_floor_image",
        description="""Upload a floor plan image for a floor. The image is used for wireless heat maps and AP placement visualization.""",
        platform="catalyst",
        category="sites",
        properties={
            "floor_id": {
                        "type": "string",
                        "description": "Floor ID to upload image for"
            },
            "image_url": {
                        "type": "string",
                        "description": "URL of the floor plan image to upload"
            }
},
        required=["floor_id", "image_url"],
        tags=["catalyst", "sites", "floor", "image", "floorplan"],
        requires_write=False,
        handler=handle_sites_upload_floor_image,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_sites_tools():
    """Register all sites tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_SITES_TOOLS)
    logger.info(f"Registered {len(CATALYST_SITES_TOOLS)} catalyst sites tools")


# Auto-register on import
register_sites_tools()
