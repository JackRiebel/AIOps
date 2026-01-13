"""Catalyst Center Sites skill module.

This module provides skills for site hierarchy management including:
- Site CRUD operations (create, read, update, delete)
- Site health monitoring
- Site membership and device assignment
- Floor management

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!sites
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
    SITE_ID_SCHEMA,
    SITE_NAME_SCHEMA,
    SITE_TYPE_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
    TIMESTAMP_SCHEMA,
)


# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

SITES_SKILLS: List[SkillDefinition] = [
    {
        "id": "sites_get_site",
        "name": "Get Sites",
        "description": (
            "Get site hierarchy from Catalyst Center. Returns all sites or filter by name, "
            "type, or site ID. Sites are organized in a hierarchy: Global > Area > Building > Floor."
        ),
        "tags": ["catalyst", "sites", "hierarchy", "inventory"],
        "examples": [
            "List all sites",
            "Get site hierarchy",
            "Show me all buildings",
            "Find site by name",
            "Get site details",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Site name to filter by (supports hierarchy like 'Global/US/Building1')"
                },
                "site_id": SITE_ID_SCHEMA,
                "type": {
                    **SITE_TYPE_SCHEMA,
                    "description": "Filter by site type (area, building, floor)"
                },
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "sites_get_site_v2",
        "name": "Get Sites (v2 API)",
        "description": (
            "Get sites using the v2 API which provides enhanced site information including "
            "additional metadata and improved hierarchy representation."
        ),
        "tags": ["catalyst", "sites", "hierarchy", "v2"],
        "examples": [
            "Get sites v2",
            "List sites with enhanced details",
            "Get site hierarchy v2",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "group_name_hierarchy": {
                    "type": "string",
                    "description": "Full group name hierarchy (e.g., 'Global/US/Building1')"
                },
                "id": SITE_ID_SCHEMA,
                "type": SITE_TYPE_SCHEMA,
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "sites_create_site",
        "name": "Create Site",
        "description": (
            "Create a new site in Catalyst Center. Sites can be areas (regions), buildings, "
            "or floors. Each site must have a parent in the hierarchy (except Global)."
        ),
        "tags": ["catalyst", "sites", "create", "hierarchy"],
        "examples": [
            "Create a new building",
            "Add a floor to building",
            "Create site area",
            "Add new site",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {
                    **SITE_TYPE_SCHEMA,
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
                },
            },
            "required": ["type", "site_name", "parent_name"],
        },
    },
    {
        "id": "sites_update_site",
        "name": "Update Site",
        "description": (
            "Update an existing site's configuration including name, address, "
            "coordinates, or floor dimensions."
        ),
        "tags": ["catalyst", "sites", "update", "modify"],
        "examples": [
            "Update site address",
            "Change building coordinates",
            "Modify floor dimensions",
            "Rename site",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "ID of the site to update"
                },
                "type": SITE_TYPE_SCHEMA,
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
                },
            },
            "required": ["site_id", "type"],
        },
    },
    {
        "id": "sites_delete_site",
        "name": "Delete Site",
        "description": (
            "Delete a site from Catalyst Center. The site must not have any child sites "
            "or assigned devices before deletion."
        ),
        "tags": ["catalyst", "sites", "delete", "remove"],
        "examples": [
            "Delete site",
            "Remove building",
            "Delete floor",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "ID of the site to delete"
                },
            },
            "required": ["site_id"],
        },
    },
    {
        "id": "sites_get_site_count",
        "name": "Get Site Count",
        "description": (
            "Get the total count of sites in Catalyst Center, optionally filtered by site ID."
        ),
        "tags": ["catalyst", "sites", "count", "statistics"],
        "examples": [
            "How many sites are there?",
            "Count all sites",
            "Get site count",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Optional site ID to count children"
                },
            },
            "required": [],
        },
    },
    {
        "id": "sites_get_site_health",
        "name": "Get Site Health",
        "description": (
            "Get health metrics for sites including network health scores, client health, "
            "and device health summaries. Supports time-based filtering."
        ),
        "tags": ["catalyst", "sites", "health", "monitoring", "assurance"],
        "examples": [
            "Show site health",
            "Get health for all buildings",
            "Site health summary",
            "Check site network health",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Filter health data for specific site"
                },
                "timestamp": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Epoch timestamp for point-in-time health data"
                },
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "sites_assign_devices",
        "name": "Assign Devices to Site",
        "description": (
            "Assign one or more network devices to a site. Devices can be assigned "
            "to buildings or floors for location-based management."
        ),
        "tags": ["catalyst", "sites", "devices", "assign", "membership"],
        "examples": [
            "Assign device to site",
            "Move device to building",
            "Add device to floor",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Target site ID to assign devices to"
                },
                "device_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of device UUIDs to assign"
                },
            },
            "required": ["site_id", "device_ids"],
        },
    },
    {
        "id": "sites_get_membership",
        "name": "Get Site Membership",
        "description": (
            "Get the device membership for a site, showing which devices are assigned "
            "to the site and its children."
        ),
        "tags": ["catalyst", "sites", "membership", "devices"],
        "examples": [
            "Show devices in site",
            "Get site membership",
            "List devices assigned to building",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Site ID to get membership for"
                },
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": ["site_id"],
        },
    },
    {
        "id": "sites_get_devices_assigned",
        "name": "Get Devices Assigned to Site",
        "description": (
            "Get detailed list of network devices assigned to a specific site, "
            "including device details and status."
        ),
        "tags": ["catalyst", "sites", "devices", "inventory"],
        "examples": [
            "List devices at site",
            "What devices are in building X?",
            "Show site devices",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Site ID to get devices for"
                },
            },
            "required": ["site_id"],
        },
    },
    {
        "id": "sites_create_floor",
        "name": "Create Floor",
        "description": (
            "Create a new floor within a building. Floors require dimensions and "
            "can include RF model settings for wireless planning."
        ),
        "tags": ["catalyst", "sites", "floor", "create", "wireless"],
        "examples": [
            "Add floor to building",
            "Create new floor",
            "Add floor with dimensions",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
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
                },
            },
            "required": ["parent_building_id", "name", "width", "length"],
        },
    },
    {
        "id": "sites_get_floor",
        "name": "Get Floor Details",
        "description": (
            "Get detailed information about a specific floor including dimensions, "
            "RF model, and associated devices."
        ),
        "tags": ["catalyst", "sites", "floor", "details"],
        "examples": [
            "Get floor details",
            "Show floor information",
            "Floor dimensions",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "floor_id": {
                    "type": "string",
                    "description": "Floor ID to retrieve"
                },
            },
            "required": ["floor_id"],
        },
    },
    {
        "id": "sites_update_floor",
        "name": "Update Floor",
        "description": (
            "Update floor configuration including dimensions, RF model, "
            "and other floor-specific settings."
        ),
        "tags": ["catalyst", "sites", "floor", "update"],
        "examples": [
            "Update floor dimensions",
            "Change floor RF model",
            "Modify floor settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
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
                },
            },
            "required": ["floor_id"],
        },
    },
    {
        "id": "sites_delete_floor",
        "name": "Delete Floor",
        "description": (
            "Delete a floor from a building. All devices must be unassigned "
            "from the floor before deletion."
        ),
        "tags": ["catalyst", "sites", "floor", "delete"],
        "examples": [
            "Delete floor",
            "Remove floor from building",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "floor_id": {
                    "type": "string",
                    "description": "Floor ID to delete"
                },
            },
            "required": ["floor_id"],
        },
    },
    {
        "id": "sites_upload_floor_image",
        "name": "Upload Floor Image",
        "description": (
            "Upload a floor plan image for a floor. The image is used for "
            "wireless heat maps and AP placement visualization."
        ),
        "tags": ["catalyst", "sites", "floor", "image", "floorplan"],
        "examples": [
            "Upload floor plan",
            "Add floor image",
            "Upload floor map",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "floor_id": {
                    "type": "string",
                    "description": "Floor ID to upload image for"
                },
                "image_url": {
                    "type": "string",
                    "description": "URL of the floor plan image to upload"
                },
            },
            "required": ["floor_id", "image_url"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class SitesModule(CatalystSkillModule):
    """Sites management skills module."""

    MODULE_NAME = "sites"
    MODULE_PREFIX = "sites_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all site management skills."""
        return [create_skill(skill_def) for skill_def in SITES_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a site management skill."""
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

        if skill_id == "sites_get_site":
            return await cls._get_site(client, params)

        if skill_id == "sites_get_site_v2":
            return await cls._get_site_v2(client, params)

        if skill_id == "sites_create_site":
            return await cls._create_site(client, params)

        if skill_id == "sites_update_site":
            return await cls._update_site(client, params)

        if skill_id == "sites_delete_site":
            return await cls._delete_site(client, params)

        if skill_id == "sites_get_site_count":
            return await cls._get_site_count(client, params)

        if skill_id == "sites_get_site_health":
            return await cls._get_site_health(client, params)

        if skill_id == "sites_assign_devices":
            return await cls._assign_devices(client, params)

        if skill_id == "sites_get_membership":
            return await cls._get_membership(client, params)

        if skill_id == "sites_get_devices_assigned":
            return await cls._get_devices_assigned(client, params)

        if skill_id == "sites_create_floor":
            return await cls._create_floor(client, params)

        if skill_id == "sites_get_floor":
            return await cls._get_floor(client, params)

        if skill_id == "sites_update_floor":
            return await cls._update_floor(client, params)

        if skill_id == "sites_delete_floor":
            return await cls._delete_floor(client, params)

        if skill_id == "sites_upload_floor_image":
            return await cls._upload_floor_image(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    # ========================================================================
    # SKILL IMPLEMENTATIONS
    # ========================================================================

    @classmethod
    async def _get_site(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get sites from Catalyst Center."""
        query_params = {}

        if params.get("name"):
            query_params["name"] = params["name"]
        if params.get("site_id"):
            query_params["siteId"] = params["site_id"]
        if params.get("type"):
            query_params["type"] = params["type"]
        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get("site", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get sites"))

        data = response.get("data", {})
        sites = data.get("response", [])

        # Build summary
        site_types = {}
        for site in sites:
            additional_info = site.get("additionalInfo", [])
            for info in additional_info:
                if info.get("nameSpace") == "Location":
                    site_type = info.get("attributes", {}).get("type", "unknown")
                    site_types[site_type] = site_types.get(site_type, 0) + 1

        return success_result(
            data={
                "sites": sites,
                "count": len(sites),
                "summary": {
                    "total": len(sites),
                    "by_type": site_types,
                },
            },
            entities={"site_ids": [s.get("id") for s in sites]},
            follow_up="Would you like to see site health or device assignments?"
        )

    @classmethod
    async def _get_site_v2(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get sites using v2 API."""
        query_params = {}

        if params.get("group_name_hierarchy"):
            query_params["groupNameHierarchy"] = params["group_name_hierarchy"]
        if params.get("id"):
            query_params["id"] = params["id"]
        if params.get("type"):
            query_params["type"] = params["type"]
        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get("site", query_params, use_v2=True)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get sites (v2)"))

        data = response.get("data", {})
        sites = data.get("response", [])

        return success_result(
            data={
                "sites": sites,
                "count": len(sites),
            },
            entities={"site_ids": [s.get("id") for s in sites]},
            follow_up="Would you like to see details for a specific site?"
        )

    @classmethod
    async def _create_site(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Create a new site."""
        site_type = params.get("type")
        site_name = params.get("site_name")
        parent_name = params.get("parent_name")

        # Build site payload based on type
        site_payload = {"type": site_type}

        if site_type == "area":
            site_payload["site"] = {
                "area": {
                    "name": site_name,
                    "parentName": parent_name,
                }
            }
        elif site_type == "building":
            building_data = {
                "name": site_name,
                "parentName": parent_name,
            }
            if params.get("address"):
                building_data["address"] = params["address"]
            if params.get("latitude"):
                building_data["latitude"] = params["latitude"]
            if params.get("longitude"):
                building_data["longitude"] = params["longitude"]

            site_payload["site"] = {"building": building_data}

        elif site_type == "floor":
            floor_data = {
                "name": site_name,
                "parentName": parent_name,
            }
            if params.get("rf_model"):
                floor_data["rfModel"] = params["rf_model"]
            if params.get("width"):
                floor_data["width"] = params["width"]
            if params.get("length"):
                floor_data["length"] = params["length"]
            if params.get("height"):
                floor_data["height"] = params["height"]

            site_payload["site"] = {"floor": floor_data}

        response = await client.post("site", site_payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to create site"))

        data = response.get("data", {})

        # Check for task-based response
        if "executionId" in data or "taskId" in data:
            task_id = data.get("taskId") or data.get("executionId")
            task_result = await client.get_task_result(task_id)
            if not task_result.get("success"):
                return error_result(task_result.get("error", "Site creation task failed"))
            data = task_result.get("data", {})

        return success_result(
            data={
                "message": f"Site '{site_name}' created successfully",
                "site_type": site_type,
                "parent": parent_name,
                "response": data,
            },
            follow_up="Would you like to assign devices to this site?"
        )

    @classmethod
    async def _update_site(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Update an existing site."""
        site_id = params.get("site_id")
        site_type = params.get("type")

        # Build update payload based on type
        update_payload = {"type": site_type}

        if site_type == "area":
            area_data = {}
            if params.get("site_name"):
                area_data["name"] = params["site_name"]
            update_payload["site"] = {"area": area_data}

        elif site_type == "building":
            building_data = {}
            if params.get("site_name"):
                building_data["name"] = params["site_name"]
            if params.get("address"):
                building_data["address"] = params["address"]
            if params.get("latitude"):
                building_data["latitude"] = params["latitude"]
            if params.get("longitude"):
                building_data["longitude"] = params["longitude"]
            update_payload["site"] = {"building": building_data}

        elif site_type == "floor":
            floor_data = {}
            if params.get("site_name"):
                floor_data["name"] = params["site_name"]
            if params.get("rf_model"):
                floor_data["rfModel"] = params["rf_model"]
            if params.get("width"):
                floor_data["width"] = params["width"]
            if params.get("length"):
                floor_data["length"] = params["length"]
            if params.get("height"):
                floor_data["height"] = params["height"]
            update_payload["site"] = {"floor": floor_data}

        response = await client.put(f"site/{site_id}", update_payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update site"))

        return success_result(
            data={
                "message": f"Site {site_id} updated successfully",
                "site_type": site_type,
            }
        )

    @classmethod
    async def _delete_site(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Delete a site."""
        site_id = params.get("site_id")

        response = await client.delete(f"site/{site_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to delete site"))

        return success_result(
            data={
                "message": f"Site {site_id} deleted successfully",
            }
        )

    @classmethod
    async def _get_site_count(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get site count."""
        query_params = {}
        if params.get("site_id"):
            query_params["siteId"] = params["site_id"]

        response = await client.get("site/count", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get site count"))

        data = response.get("data", {})
        count = data.get("response", 0)

        return success_result(
            data={
                "count": count,
                "message": f"Total sites: {count}",
            }
        )

    @classmethod
    async def _get_site_health(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get site health metrics."""
        query_params = {}

        if params.get("site_id"):
            query_params["siteId"] = params["site_id"]
        if params.get("timestamp"):
            query_params["timestamp"] = params["timestamp"]
        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get("site-health", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get site health"))

        data = response.get("data", {})
        health_data = data.get("response", [])

        # Summarize health scores
        total_sites = len(health_data)
        healthy = sum(1 for h in health_data if h.get("networkHealthAverage", 0) >= 80)
        warning = sum(1 for h in health_data if 50 <= h.get("networkHealthAverage", 0) < 80)
        critical = sum(1 for h in health_data if h.get("networkHealthAverage", 0) < 50)

        return success_result(
            data={
                "health_data": health_data,
                "count": total_sites,
                "summary": {
                    "total_sites": total_sites,
                    "healthy": healthy,
                    "warning": warning,
                    "critical": critical,
                },
            },
            entities={"site_ids": [h.get("siteId") for h in health_data]},
            follow_up="Would you like details on specific site issues?"
        )

    @classmethod
    async def _assign_devices(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Assign devices to a site."""
        site_id = params.get("site_id")
        device_ids = params.get("device_ids", [])

        payload = {
            "device": [{"ip": device_id} for device_id in device_ids]
        }

        response = await client.post(
            f"assign-device-to-site/{site_id}/device",
            payload
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to assign devices"))

        data = response.get("data", {})

        # Handle async task
        if "executionId" in data:
            task_result = await client.get_task_result(data["executionId"])
            if not task_result.get("success"):
                return error_result(task_result.get("error", "Device assignment failed"))

        return success_result(
            data={
                "message": f"Successfully assigned {len(device_ids)} device(s) to site",
                "site_id": site_id,
                "device_count": len(device_ids),
            },
            follow_up="Would you like to verify the device assignments?"
        )

    @classmethod
    async def _get_membership(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get site membership."""
        site_id = params.get("site_id")
        query_params = {}

        if params.get("offset"):
            query_params["offset"] = params["offset"]
        if params.get("limit"):
            query_params["limit"] = params["limit"]

        response = await client.get(f"membership/{site_id}", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get membership"))

        data = response.get("data", {})
        membership = data.get("response", {})

        device_list = membership.get("device", [])

        return success_result(
            data={
                "membership": membership,
                "device_count": len(device_list),
                "site_id": site_id,
            },
            entities={"device_ids": [d.get("instanceUuid") for d in device_list]},
            follow_up="Would you like details on specific devices?"
        )

    @classmethod
    async def _get_devices_assigned(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get devices assigned to a site."""
        site_id = params.get("site_id")

        response = await client.get(f"site/{site_id}/device")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get assigned devices"))

        data = response.get("data", {})
        devices = data.get("response", [])

        return success_result(
            data={
                "devices": devices,
                "count": len(devices),
                "site_id": site_id,
            },
            entities={"device_ids": [d.get("instanceUuid") for d in devices]},
            follow_up="Would you like to see device health or configuration?"
        )

    @classmethod
    async def _create_floor(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Create a new floor."""
        payload = {
            "parentId": params.get("parent_building_id"),
            "name": params.get("name"),
            "floorNumber": params.get("floor_number", 1),
            "width": params.get("width"),
            "length": params.get("length"),
            "height": params.get("height", 10),
        }

        if params.get("rf_model"):
            payload["rfModel"] = params["rf_model"]

        response = await client.post("floors", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to create floor"))

        data = response.get("data", {})

        return success_result(
            data={
                "message": f"Floor '{params.get('name')}' created successfully",
                "response": data,
            },
            follow_up="Would you like to upload a floor plan image?"
        )

    @classmethod
    async def _get_floor(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get floor details."""
        floor_id = params.get("floor_id")

        response = await client.get(f"floors/{floor_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get floor"))

        data = response.get("data", {})
        floor = data.get("response", {})

        return success_result(
            data={
                "floor": floor,
                "floor_id": floor_id,
            },
            follow_up="Would you like to see devices on this floor?"
        )

    @classmethod
    async def _update_floor(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Update floor configuration."""
        floor_id = params.get("floor_id")

        payload = {}
        if params.get("name"):
            payload["name"] = params["name"]
        if params.get("rf_model"):
            payload["rfModel"] = params["rf_model"]
        if params.get("width"):
            payload["width"] = params["width"]
        if params.get("length"):
            payload["length"] = params["length"]
        if params.get("height"):
            payload["height"] = params["height"]

        response = await client.put(f"floors/{floor_id}", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update floor"))

        return success_result(
            data={
                "message": f"Floor {floor_id} updated successfully",
            }
        )

    @classmethod
    async def _delete_floor(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Delete a floor."""
        floor_id = params.get("floor_id")

        response = await client.delete(f"floors/{floor_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to delete floor"))

        return success_result(
            data={
                "message": f"Floor {floor_id} deleted successfully",
            }
        )

    @classmethod
    async def _upload_floor_image(
        cls,
        client: CatalystAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Upload floor plan image."""
        floor_id = params.get("floor_id")
        image_url = params.get("image_url")

        # Note: Actual image upload requires multipart form data
        # This implementation assumes URL-based upload
        payload = {
            "imageUrl": image_url
        }

        response = await client.post(f"floors/{floor_id}/uploadImage", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to upload floor image"))

        return success_result(
            data={
                "message": f"Floor image uploaded successfully for floor {floor_id}",
            },
            follow_up="Would you like to place access points on the floor map?"
        )
