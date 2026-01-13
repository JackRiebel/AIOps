"""ThousandEyes Dashboards skill module.

This module provides skills for dashboard management including:
- Dashboards
- Widgets
- Snapshots
- Filters
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    DASHBOARD_ID_SCHEMA, WIDGET_ID_SCHEMA, SNAPSHOT_ID_SCHEMA,
)

DASHBOARDS_SKILLS: List[SkillDefinition] = [
    # Dashboards
    {"id": "dashboards_get_list", "name": "List Dashboards", "description": "Get all dashboards.", "tags": ["thousandeyes", "dashboards", "list"], "examples": ["List dashboards"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "dashboards_get_by_id", "name": "Get Dashboard", "description": "Get details of a specific dashboard.", "tags": ["thousandeyes", "dashboards", "details"], "examples": ["Get dashboard"], "input_schema": {"type": "object", "properties": {"dashboard_id": DASHBOARD_ID_SCHEMA}, "required": ["dashboard_id"]}},
    {"id": "dashboards_create", "name": "Create Dashboard", "description": "Create a new dashboard.", "tags": ["thousandeyes", "dashboards", "create"], "examples": ["Create dashboard"], "input_schema": {"type": "object", "properties": {"title": {"type": "string"}, "description": {"type": "string"}, "is_default": {"type": "boolean", "default": False}, "is_private": {"type": "boolean", "default": False}, "widgets": {"type": "array", "items": {"type": "object", "properties": {"type": {"type": "string"}, "title": {"type": "string"}, "testId": {"type": "string"}, "metric": {"type": "string"}}}}}, "required": ["title"]}},
    {"id": "dashboards_update", "name": "Update Dashboard", "description": "Update an existing dashboard.", "tags": ["thousandeyes", "dashboards", "update"], "examples": ["Update dashboard"], "input_schema": {"type": "object", "properties": {"dashboard_id": DASHBOARD_ID_SCHEMA, "title": {"type": "string"}, "description": {"type": "string"}, "is_default": {"type": "boolean"}, "is_private": {"type": "boolean"}, "widgets": {"type": "array", "items": {"type": "object"}}}, "required": ["dashboard_id"]}},
    {"id": "dashboards_delete", "name": "Delete Dashboard", "description": "Delete a dashboard.", "tags": ["thousandeyes", "dashboards", "delete"], "examples": ["Delete dashboard"], "input_schema": {"type": "object", "properties": {"dashboard_id": DASHBOARD_ID_SCHEMA}, "required": ["dashboard_id"]}},

    # Widgets
    {"id": "dashboards_get_widget_data", "name": "Get Widget Data", "description": "Get data for a specific widget.", "tags": ["thousandeyes", "dashboards", "widget", "data"], "examples": ["Get widget data"], "input_schema": {"type": "object", "properties": {"dashboard_id": DASHBOARD_ID_SCHEMA, "widget_id": WIDGET_ID_SCHEMA, "aid": {"type": "string"}}, "required": ["dashboard_id", "widget_id"]}},
    {"id": "dashboards_get_widget_card_data", "name": "Get Widget Card Data", "description": "Get data for a specific widget card.", "tags": ["thousandeyes", "dashboards", "widget", "card"], "examples": ["Get card data"], "input_schema": {"type": "object", "properties": {"dashboard_id": DASHBOARD_ID_SCHEMA, "widget_id": WIDGET_ID_SCHEMA, "card_id": {"type": "string", "description": "Card ID"}, "aid": {"type": "string"}}, "required": ["dashboard_id", "widget_id", "card_id"]}},

    # Snapshots
    {"id": "dashboards_get_snapshots", "name": "List Dashboard Snapshots", "description": "Get all dashboard snapshots.", "tags": ["thousandeyes", "dashboards", "snapshots", "list"], "examples": ["List snapshots"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "dashboards_get_snapshot", "name": "Get Dashboard Snapshot", "description": "Get details of a specific snapshot.", "tags": ["thousandeyes", "dashboards", "snapshot", "details"], "examples": ["Get snapshot"], "input_schema": {"type": "object", "properties": {"snapshot_id": SNAPSHOT_ID_SCHEMA}, "required": ["snapshot_id"]}},
    {"id": "dashboards_create_snapshot", "name": "Create Dashboard Snapshot", "description": "Create a snapshot of a dashboard.", "tags": ["thousandeyes", "dashboards", "snapshot", "create"], "examples": ["Create snapshot"], "input_schema": {"type": "object", "properties": {"dashboard_id": DASHBOARD_ID_SCHEMA, "display_name": {"type": "string"}, "is_shared": {"type": "boolean", "default": False}, "expiration_date": {"type": "string"}}, "required": ["dashboard_id"]}},
    {"id": "dashboards_delete_snapshot", "name": "Delete Dashboard Snapshot", "description": "Delete a dashboard snapshot.", "tags": ["thousandeyes", "dashboards", "snapshot", "delete"], "examples": ["Delete snapshot"], "input_schema": {"type": "object", "properties": {"snapshot_id": SNAPSHOT_ID_SCHEMA}, "required": ["snapshot_id"]}},
    {"id": "dashboards_update_snapshot_expiry", "name": "Update Snapshot Expiry", "description": "Update the expiration date of a snapshot.", "tags": ["thousandeyes", "dashboards", "snapshot", "expiry", "update"], "examples": ["Update snapshot expiry"], "input_schema": {"type": "object", "properties": {"snapshot_id": SNAPSHOT_ID_SCHEMA, "expiration_date": {"type": "string"}}, "required": ["snapshot_id", "expiration_date"]}},

    # Filters
    {"id": "dashboards_get_filters", "name": "List Dashboard Filters", "description": "Get all dashboard filters.", "tags": ["thousandeyes", "dashboards", "filters", "list"], "examples": ["List filters"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "dashboards_create_filter", "name": "Create Dashboard Filter", "description": "Create a new dashboard filter.", "tags": ["thousandeyes", "dashboards", "filter", "create"], "examples": ["Create filter"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "filter_type": {"type": "string"}, "filter_values": {"type": "array", "items": {"type": "string"}}}, "required": ["name", "filter_type"]}},
    {"id": "dashboards_delete_filter", "name": "Delete Dashboard Filter", "description": "Delete a dashboard filter.", "tags": ["thousandeyes", "dashboards", "filter", "delete"], "examples": ["Delete filter"], "input_schema": {"type": "object", "properties": {"filter_id": {"type": "string", "description": "Filter ID"}}, "required": ["filter_id"]}},
]


class DashboardsModule(ThousandEyesSkillModule):
    """Dashboards skill module for dashboard management."""

    MODULE_NAME = "dashboards"
    MODULE_PREFIX = "dashboards_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in DASHBOARDS_SKILLS]

    @classmethod
    async def execute(cls, skill_id: str, client: ThousandEyesAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        log_skill_start(skill_id, params)
        try:
            result = await cls._execute_skill(skill_id, client, params)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed: {str(e)}")

    @classmethod
    async def _execute_skill(cls, skill_id: str, client: ThousandEyesAPIClient, params: Dict[str, Any]) -> SkillResult:
        # Dashboards
        if skill_id == "dashboards_get_list":
            r = await client.get("dashboards", {"aid": params.get("aid")})
            if r.get("success"):
                dashboards = r.get("data", {}).get("dashboards", [])
                return success_result(data={"dashboards": dashboards, "count": len(dashboards)})
            return error_result(r.get("error"))

        if skill_id == "dashboards_get_by_id":
            r = await client.get(f"dashboards/{params.get('dashboard_id')}")
            return success_result(data={"dashboard": r.get("data", {}).get("dashboards", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "dashboards_create":
            payload = {k: v for k, v in {
                "title": params.get("title"),
                "description": params.get("description"),
                "isDefault": params.get("is_default", False),
                "isPrivate": params.get("is_private", False),
                "widgets": params.get("widgets"),
            }.items() if v is not None}
            r = await client.post("dashboards", payload)
            if r.get("success"):
                dashboard = r.get("data", {}).get("dashboards", [{}])[0] if isinstance(r.get("data", {}).get("dashboards"), list) else r.get("data", {})
                return success_result(data={"message": "Dashboard created", "dashboard": dashboard})
            return error_result(r.get("error"))

        if skill_id == "dashboards_update":
            dashboard_id = params.pop("dashboard_id", None)
            payload = {k: v for k, v in {
                "title": params.get("title"),
                "description": params.get("description"),
                "isDefault": params.get("is_default"),
                "isPrivate": params.get("is_private"),
                "widgets": params.get("widgets"),
            }.items() if v is not None}
            r = await client.put(f"dashboards/{dashboard_id}", payload)
            return success_result(data={"message": "Dashboard updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "dashboards_delete":
            r = await client.delete(f"dashboards/{params.get('dashboard_id')}")
            return success_result(data={"message": "Dashboard deleted"}) if r.get("success") else error_result(r.get("error"))

        # Widgets
        if skill_id == "dashboards_get_widget_data":
            r = await client.get(f"dashboards/{params.get('dashboard_id')}/widgets/{params.get('widget_id')}", {"aid": params.get("aid")})
            return success_result(data={"widget_data": r.get("data", {})}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "dashboards_get_widget_card_data":
            r = await client.get(f"dashboards/{params.get('dashboard_id')}/widgets/{params.get('widget_id')}/cards/{params.get('card_id')}", {"aid": params.get("aid")})
            return success_result(data={"card_data": r.get("data", {})}) if r.get("success") else error_result(r.get("error"))

        # Snapshots
        if skill_id == "dashboards_get_snapshots":
            r = await client.get("dashboard-snapshots", {"aid": params.get("aid")})
            if r.get("success"):
                snapshots = r.get("data", {}).get("dashboardSnapshots", [])
                return success_result(data={"snapshots": snapshots, "count": len(snapshots)})
            return error_result(r.get("error"))

        if skill_id == "dashboards_get_snapshot":
            r = await client.get(f"dashboard-snapshots/{params.get('snapshot_id')}")
            return success_result(data={"snapshot": r.get("data", {}).get("dashboardSnapshots", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "dashboards_create_snapshot":
            payload = {k: v for k, v in {
                "dashboardId": params.get("dashboard_id"),
                "displayName": params.get("display_name"),
                "isShared": params.get("is_shared", False),
                "expirationDate": params.get("expiration_date"),
            }.items() if v is not None}
            r = await client.post("dashboard-snapshots", payload)
            if r.get("success"):
                snapshot = r.get("data", {}).get("dashboardSnapshots", [{}])[0] if isinstance(r.get("data", {}).get("dashboardSnapshots"), list) else r.get("data", {})
                return success_result(data={"message": "Snapshot created", "snapshot": snapshot})
            return error_result(r.get("error"))

        if skill_id == "dashboards_delete_snapshot":
            r = await client.delete(f"dashboard-snapshots/{params.get('snapshot_id')}")
            return success_result(data={"message": "Snapshot deleted"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "dashboards_update_snapshot_expiry":
            r = await client.patch(f"dashboard-snapshots/{params.get('snapshot_id')}", {"expirationDate": params.get("expiration_date")})
            return success_result(data={"message": "Snapshot expiry updated"}) if r.get("success") else error_result(r.get("error"))

        # Filters
        if skill_id == "dashboards_get_filters":
            r = await client.get("dashboards/filters", {"aid": params.get("aid")})
            if r.get("success"):
                filters = r.get("data", {}).get("filters", [])
                return success_result(data={"filters": filters, "count": len(filters)})
            return error_result(r.get("error"))

        if skill_id == "dashboards_create_filter":
            payload = {k: v for k, v in {
                "name": params.get("name"),
                "filterType": params.get("filter_type"),
                "filterValues": params.get("filter_values"),
            }.items() if v is not None}
            r = await client.post("dashboards/filters", payload)
            if r.get("success"):
                filter_data = r.get("data", {})
                return success_result(data={"message": "Filter created", "filter": filter_data})
            return error_result(r.get("error"))

        if skill_id == "dashboards_delete_filter":
            r = await client.delete(f"dashboards/filters/{params.get('filter_id')}")
            return success_result(data={"message": "Filter deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
