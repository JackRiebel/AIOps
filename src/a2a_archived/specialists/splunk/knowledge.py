"""Splunk Knowledge Objects skill module.

This module provides skills for retrieving and managing Splunk knowledge objects including:
- Saved searches
- Alerts
- Field extractions
- Lookups
- Macros
- Data models
- And more...
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    SplunkSkillModule,
    SplunkAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    KNOWLEDGE_OBJECT_TYPE_SCHEMA,
)

# Knowledge object type to API endpoint mapping
KNOWLEDGE_OBJECT_ENDPOINTS = {
    "saved_searches": "/servicesNS/-/-/saved/searches",
    "alerts": "/servicesNS/-/-/alerts/fired_alerts",
    "field_extractions": "/servicesNS/-/-/data/props/extractions",
    "field_aliases": "/servicesNS/-/-/data/props/fieldaliases",
    "calculated_fields": "/servicesNS/-/-/data/props/calcfields",
    "lookups": "/servicesNS/-/-/data/lookup-table-files",
    "automatic_lookups": "/servicesNS/-/-/data/props/lookups",
    "lookup_transforms": "/servicesNS/-/-/data/transforms/lookups",
    "macros": "/servicesNS/-/-/admin/macros",
    "tags": "/servicesNS/-/-/configs/conf-tags",
    "data_models": "/servicesNS/-/-/datamodel/model",
    "workflow_actions": "/servicesNS/-/-/data/ui/workflow-actions",
    "views": "/servicesNS/-/-/data/ui/views",
    "panels": "/servicesNS/-/-/data/ui/panels",
    "apps": "/services/apps/local",
    "mltk_models": "/servicesNS/-/-/mltk/models",
    "mltk_algorithms": "/servicesNS/-/-/mltk/algorithms",
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

KNOWLEDGE_SKILLS: List[SkillDefinition] = [
    {
        "id": "knowledge_get_objects",
        "name": "Get Knowledge Objects",
        "description": (
            "Retrieve Splunk knowledge objects by type. Supports various knowledge object types "
            "including saved searches, alerts, field extractions, lookups, macros, data models, "
            "views, panels, apps, and MLTK models/algorithms. Knowledge objects are reusable "
            "configurations that enhance Splunk's search and analysis capabilities."
        ),
        "tags": ["splunk", "knowledge", "objects", "saved-searches", "alerts", "lookups", "macros"],
        "examples": [
            "List all saved searches",
            "Show me alerts",
            "What lookups are available?",
            "Get field extractions",
            "List data models",
            "Show macros",
            "What apps are installed?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "object_type": KNOWLEDGE_OBJECT_TYPE_SCHEMA,
                "app": {
                    "type": "string",
                    "description": "Filter by app context"
                },
                "search": {
                    "type": "string",
                    "description": "Filter by name pattern"
                },
            },
            "required": ["object_type"],
        },
    },
    {
        "id": "knowledge_get_saved_searches",
        "name": "Get Saved Searches",
        "description": (
            "List saved searches and reports in Splunk. Saved searches are reusable SPL queries "
            "that can be scheduled, shared, and used as the basis for alerts and reports."
        ),
        "tags": ["splunk", "knowledge", "saved-searches", "reports", "scheduled"],
        "examples": [
            "Show saved searches",
            "List scheduled reports",
            "What searches are saved?",
            "Get my saved searches",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "app": {
                    "type": "string",
                    "description": "Filter by app context"
                },
                "scheduled_only": {
                    "type": "boolean",
                    "description": "Only show scheduled searches",
                    "default": False
                },
            },
            "required": [],
        },
    },
    {
        "id": "knowledge_get_alerts",
        "name": "Get Alerts",
        "description": (
            "Get Splunk alerts including alert definitions and triggered (fired) alerts. "
            "Alerts are saved searches that trigger actions when conditions are met."
        ),
        "tags": ["splunk", "knowledge", "alerts", "monitoring", "triggered"],
        "examples": [
            "Show alerts",
            "What alerts are configured?",
            "List triggered alerts",
            "Get fired alerts",
            "Show alert history",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "include_fired": {
                    "type": "boolean",
                    "description": "Include fired/triggered alerts",
                    "default": True
                },
                "severity": {
                    "type": "string",
                    "description": "Filter by severity (critical, high, medium, low)",
                    "enum": ["critical", "high", "medium", "low"]
                },
            },
            "required": [],
        },
    },
    {
        "id": "knowledge_get_lookups",
        "name": "Get Lookups",
        "description": (
            "List lookup tables and definitions in Splunk. Lookups are used to enrich events "
            "with additional data from external sources like CSV files or KV Store collections."
        ),
        "tags": ["splunk", "knowledge", "lookups", "enrichment", "tables"],
        "examples": [
            "Show lookup tables",
            "What lookups are available?",
            "List lookup definitions",
            "Get lookup files",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "include_transforms": {
                    "type": "boolean",
                    "description": "Include lookup transform definitions",
                    "default": True
                },
                "include_automatic": {
                    "type": "boolean",
                    "description": "Include automatic lookup configurations",
                    "default": False
                },
            },
            "required": [],
        },
    },
    {
        "id": "knowledge_get_data_models",
        "name": "Get Data Models",
        "description": (
            "List data models in Splunk. Data models are hierarchical schemas that define "
            "and normalize data for Pivot and accelerated searches."
        ),
        "tags": ["splunk", "knowledge", "data-models", "cim", "pivot"],
        "examples": [
            "Show data models",
            "What data models exist?",
            "List CIM data models",
            "Get accelerated data models",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "accelerated_only": {
                    "type": "boolean",
                    "description": "Only show accelerated data models",
                    "default": False
                },
            },
            "required": [],
        },
    },
    {
        "id": "knowledge_get_macros",
        "name": "Get Macros",
        "description": (
            "List search macros in Splunk. Macros are reusable search fragments that can "
            "accept arguments and be used across multiple searches."
        ),
        "tags": ["splunk", "knowledge", "macros", "search", "reusable"],
        "examples": [
            "Show macros",
            "What macros are defined?",
            "List search macros",
            "Get macro definitions",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "app": {
                    "type": "string",
                    "description": "Filter by app context"
                },
            },
            "required": [],
        },
    },
    {
        "id": "knowledge_get_field_extractions",
        "name": "Get Field Extractions",
        "description": (
            "List field extraction configurations in Splunk. Field extractions define how "
            "Splunk parses and extracts fields from raw event data."
        ),
        "tags": ["splunk", "knowledge", "field-extractions", "parsing", "regex"],
        "examples": [
            "Show field extractions",
            "What fields are being extracted?",
            "List extraction rules",
            "Get regex extractions",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "sourcetype": {
                    "type": "string",
                    "description": "Filter by sourcetype"
                },
            },
            "required": [],
        },
    },
    {
        "id": "knowledge_get_apps",
        "name": "Get Apps",
        "description": (
            "List installed Splunk apps. Apps are packages that extend Splunk functionality "
            "with dashboards, saved searches, data inputs, and more."
        ),
        "tags": ["splunk", "knowledge", "apps", "installed", "packages"],
        "examples": [
            "What apps are installed?",
            "List Splunk apps",
            "Show installed apps",
            "Get app list",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "visible_only": {
                    "type": "boolean",
                    "description": "Only show visible apps",
                    "default": True
                },
            },
            "required": [],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class KnowledgeModule(SplunkSkillModule):
    """Knowledge objects skills module."""

    MODULE_NAME = "knowledge"
    MODULE_PREFIX = "knowledge_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all knowledge object skills."""
        return [create_skill(skill_def) for skill_def in KNOWLEDGE_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a knowledge object skill."""
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
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Internal skill execution dispatcher."""

        if skill_id == "knowledge_get_objects":
            return await cls._get_knowledge_objects(client, params)

        if skill_id == "knowledge_get_saved_searches":
            return await cls._get_saved_searches(client, params)

        if skill_id == "knowledge_get_alerts":
            return await cls._get_alerts(client, params)

        if skill_id == "knowledge_get_lookups":
            return await cls._get_lookups(client, params)

        if skill_id == "knowledge_get_data_models":
            return await cls._get_data_models(client, params)

        if skill_id == "knowledge_get_macros":
            return await cls._get_macros(client, params)

        if skill_id == "knowledge_get_field_extractions":
            return await cls._get_field_extractions(client, params)

        if skill_id == "knowledge_get_apps":
            return await cls._get_apps(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _get_knowledge_objects(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get knowledge objects by type."""
        object_type = params.get("object_type", "")
        app_filter = params.get("app", "")
        search_filter = params.get("search", "")

        if not object_type:
            return error_result("object_type is required")

        if object_type not in KNOWLEDGE_OBJECT_ENDPOINTS:
            return error_result(f"Unknown object type: {object_type}. Valid types: {', '.join(KNOWLEDGE_OBJECT_ENDPOINTS.keys())}")

        endpoint = KNOWLEDGE_OBJECT_ENDPOINTS[object_type]
        query_params = {"count": 200}

        if search_filter:
            query_params["search"] = f"name=*{search_filter}*"

        response = await client.get(endpoint, query_params)

        if not response.get("success"):
            return error_result(response.get("error", f"Failed to get {object_type}"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        objects = []
        for entry in entries:
            acl = entry.get("acl", {})
            entry_app = acl.get("app", "")

            # Apply app filter if specified
            if app_filter and app_filter.lower() != entry_app.lower():
                continue

            content = entry.get("content", {})
            obj = {
                "name": entry.get("name"),
                "app": entry_app,
                "owner": acl.get("owner"),
                "sharing": acl.get("sharing"),
            }

            # Add type-specific fields
            if object_type == "saved_searches":
                obj["search"] = content.get("search", "")[:200]
                obj["is_scheduled"] = content.get("is_scheduled", False)
                obj["cron_schedule"] = content.get("cron_schedule")
            elif object_type == "data_models":
                obj["acceleration"] = content.get("acceleration", False)
                obj["description"] = content.get("description", "")[:200]
            elif object_type == "macros":
                obj["definition"] = content.get("definition", "")[:200]
                obj["args"] = content.get("args")

            objects.append(obj)

        # Sort by name
        objects.sort(key=lambda x: x.get("name", "").lower())

        return success_result(
            data={
                "object_type": object_type,
                "objects": objects,
                "count": len(objects),
            },
            entities={"names": [o["name"] for o in objects[:50]]},
            follow_up=f"Would you like details on a specific {object_type[:-1]}?"
        )

    @classmethod
    async def _get_saved_searches(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get saved searches."""
        app_filter = params.get("app", "")
        scheduled_only = params.get("scheduled_only", False)

        response = await client.get(
            "/servicesNS/-/-/saved/searches",
            {"count": 200}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get saved searches"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        searches = []
        for entry in entries:
            acl = entry.get("acl", {})
            entry_app = acl.get("app", "")
            content = entry.get("content", {})

            # Apply filters
            if app_filter and app_filter.lower() != entry_app.lower():
                continue

            is_scheduled = content.get("is_scheduled", False)
            if scheduled_only and not is_scheduled:
                continue

            search = {
                "name": entry.get("name"),
                "app": entry_app,
                "owner": acl.get("owner"),
                "search": content.get("search", "")[:300],
                "description": content.get("description", ""),
                "is_scheduled": is_scheduled,
                "cron_schedule": content.get("cron_schedule"),
                "next_scheduled_time": content.get("next_scheduled_time"),
                "is_visible": content.get("is_visible", True),
                "alert_type": content.get("alert_type"),
            }
            searches.append(search)

        # Sort by name
        searches.sort(key=lambda x: x.get("name", "").lower())

        scheduled_count = sum(1 for s in searches if s.get("is_scheduled"))
        alert_count = sum(1 for s in searches if s.get("alert_type"))

        summary = {
            "total": len(searches),
            "scheduled": scheduled_count,
            "alerts": alert_count,
        }

        return success_result(
            data={
                "searches": searches,
                "summary": summary,
            },
            entities={"search_names": [s["name"] for s in searches[:50]]},
            follow_up="Would you like to run or view details of a specific saved search?"
        )

    @classmethod
    async def _get_alerts(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get alerts including fired alerts."""
        include_fired = params.get("include_fired", True)
        severity_filter = params.get("severity", "")

        # Get alert definitions (saved searches with alert actions)
        response = await client.get(
            "/servicesNS/-/-/saved/searches",
            {"count": 200, "search": "alert.track=1"}
        )

        alerts = []
        if response.get("success"):
            data = response.get("data", {})
            for entry in data.get("entry", []):
                content = entry.get("content", {})
                acl = entry.get("acl", {})

                severity = content.get("alert.severity", "")
                if severity_filter and severity != severity_filter:
                    continue

                alert = {
                    "name": entry.get("name"),
                    "type": "definition",
                    "app": acl.get("app"),
                    "severity": severity,
                    "search": content.get("search", "")[:200],
                    "cron_schedule": content.get("cron_schedule"),
                    "alert_condition": content.get("alert.condition"),
                    "alert_expires": content.get("alert.expires"),
                }
                alerts.append(alert)

        # Get fired alerts if requested
        fired_alerts = []
        if include_fired:
            fired_response = await client.get(
                "/services/alerts/fired_alerts",
                {"count": 100}
            )

            if fired_response.get("success"):
                fired_data = fired_response.get("data", {})
                for entry in fired_data.get("entry", []):
                    content = entry.get("content", {})

                    severity = content.get("severity", "")
                    if severity_filter and severity != severity_filter:
                        continue

                    fired = {
                        "name": entry.get("name"),
                        "type": "fired",
                        "severity": severity,
                        "triggered_count": content.get("triggered_alert_count", 0),
                        "trigger_time": content.get("trigger_time"),
                    }
                    fired_alerts.append(fired)

        summary = {
            "total_definitions": len(alerts),
            "total_fired": len(fired_alerts),
            "by_severity": {},
        }

        # Count by severity
        for alert in alerts + fired_alerts:
            sev = alert.get("severity", "unknown")
            summary["by_severity"][sev] = summary["by_severity"].get(sev, 0) + 1

        return success_result(
            data={
                "alert_definitions": alerts,
                "fired_alerts": fired_alerts,
                "summary": summary,
            },
            entities={"alert_names": [a["name"] for a in alerts]},
            follow_up="Would you like details on a specific alert?"
        )

    @classmethod
    async def _get_lookups(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get lookup tables and definitions."""
        include_transforms = params.get("include_transforms", True)
        include_automatic = params.get("include_automatic", False)

        # Get lookup table files
        response = await client.get(
            "/servicesNS/-/-/data/lookup-table-files",
            {"count": 200}
        )

        lookups = []
        if response.get("success"):
            data = response.get("data", {})
            for entry in data.get("entry", []):
                acl = entry.get("acl", {})
                lookup = {
                    "name": entry.get("name"),
                    "type": "table_file",
                    "app": acl.get("app"),
                    "owner": acl.get("owner"),
                }
                lookups.append(lookup)

        # Get lookup transforms if requested
        transforms = []
        if include_transforms:
            transforms_response = await client.get(
                "/servicesNS/-/-/data/transforms/lookups",
                {"count": 200}
            )

            if transforms_response.get("success"):
                transforms_data = transforms_response.get("data", {})
                for entry in transforms_data.get("entry", []):
                    content = entry.get("content", {})
                    acl = entry.get("acl", {})
                    transform = {
                        "name": entry.get("name"),
                        "type": "transform",
                        "app": acl.get("app"),
                        "filename": content.get("filename"),
                        "external_type": content.get("external_type"),
                    }
                    transforms.append(transform)

        # Get automatic lookups if requested
        automatic = []
        if include_automatic:
            auto_response = await client.get(
                "/servicesNS/-/-/data/props/lookups",
                {"count": 200}
            )

            if auto_response.get("success"):
                auto_data = auto_response.get("data", {})
                for entry in auto_data.get("entry", []):
                    content = entry.get("content", {})
                    acl = entry.get("acl", {})
                    auto_lookup = {
                        "name": entry.get("name"),
                        "type": "automatic",
                        "app": acl.get("app"),
                        "stanza": content.get("stanza"),
                    }
                    automatic.append(auto_lookup)

        summary = {
            "table_files": len(lookups),
            "transforms": len(transforms),
            "automatic_lookups": len(automatic),
        }

        return success_result(
            data={
                "lookup_files": lookups,
                "lookup_transforms": transforms,
                "automatic_lookups": automatic,
                "summary": summary,
            },
            entities={"lookup_names": [l["name"] for l in lookups]},
            follow_up="Would you like to use one of these lookups in a search?"
        )

    @classmethod
    async def _get_data_models(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get data models."""
        accelerated_only = params.get("accelerated_only", False)

        response = await client.get(
            "/servicesNS/-/-/datamodel/model",
            {"count": 200}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get data models"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        models = []
        for entry in entries:
            content = entry.get("content", {})
            acl = entry.get("acl", {})

            is_accelerated = content.get("acceleration", False)
            if accelerated_only and not is_accelerated:
                continue

            model = {
                "name": entry.get("name"),
                "app": acl.get("app"),
                "description": content.get("description", ""),
                "acceleration": is_accelerated,
                "acceleration_earliest": content.get("acceleration.earliest_time"),
                "dataset_type": content.get("dataset.type"),
            }
            models.append(model)

        # Sort by name
        models.sort(key=lambda x: x.get("name", "").lower())

        accelerated_count = sum(1 for m in models if m.get("acceleration"))

        summary = {
            "total": len(models),
            "accelerated": accelerated_count,
        }

        return success_result(
            data={
                "data_models": models,
                "summary": summary,
            },
            entities={"model_names": [m["name"] for m in models]},
            follow_up="Would you like to search using a specific data model?"
        )

    @classmethod
    async def _get_macros(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get search macros."""
        app_filter = params.get("app", "")

        response = await client.get(
            "/servicesNS/-/-/admin/macros",
            {"count": 200}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get macros"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        macros = []
        for entry in entries:
            acl = entry.get("acl", {})
            entry_app = acl.get("app", "")
            content = entry.get("content", {})

            if app_filter and app_filter.lower() != entry_app.lower():
                continue

            macro = {
                "name": entry.get("name"),
                "app": entry_app,
                "owner": acl.get("owner"),
                "definition": content.get("definition", ""),
                "args": content.get("args"),
                "description": content.get("description", ""),
            }
            macros.append(macro)

        # Sort by name
        macros.sort(key=lambda x: x.get("name", "").lower())

        return success_result(
            data={
                "macros": macros,
                "count": len(macros),
            },
            entities={"macro_names": [m["name"] for m in macros]},
            follow_up="Would you like to use one of these macros in a search?"
        )

    @classmethod
    async def _get_field_extractions(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get field extractions."""
        sourcetype_filter = params.get("sourcetype", "")

        response = await client.get(
            "/servicesNS/-/-/data/props/extractions",
            {"count": 200}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get field extractions"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        extractions = []
        for entry in entries:
            content = entry.get("content", {})
            acl = entry.get("acl", {})
            stanza = content.get("stanza", "")

            if sourcetype_filter and sourcetype_filter.lower() not in stanza.lower():
                continue

            extraction = {
                "name": entry.get("name"),
                "app": acl.get("app"),
                "stanza": stanza,
                "type": content.get("type"),
                "value": content.get("value", "")[:200],
            }
            extractions.append(extraction)

        # Sort by name
        extractions.sort(key=lambda x: x.get("name", "").lower())

        return success_result(
            data={
                "extractions": extractions,
                "count": len(extractions),
            },
            entities={"extraction_names": [e["name"] for e in extractions]},
        )

    @classmethod
    async def _get_apps(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get installed apps."""
        visible_only = params.get("visible_only", True)

        response = await client.get(
            "/services/apps/local",
            {"count": 200}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get apps"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        apps = []
        for entry in entries:
            content = entry.get("content", {})

            is_visible = content.get("visible", True)
            if visible_only and not is_visible:
                continue

            app = {
                "name": entry.get("name"),
                "label": content.get("label"),
                "version": content.get("version"),
                "description": content.get("description", "")[:200],
                "author": content.get("author"),
                "visible": is_visible,
                "disabled": content.get("disabled", False),
                "configured": content.get("configured", False),
            }
            apps.append(app)

        # Sort by label
        apps.sort(key=lambda x: (x.get("label") or x.get("name", "")).lower())

        enabled_count = sum(1 for a in apps if not a.get("disabled"))

        summary = {
            "total": len(apps),
            "enabled": enabled_count,
            "disabled": len(apps) - enabled_count,
        }

        return success_result(
            data={
                "apps": apps,
                "summary": summary,
            },
            entities={"app_names": [a["name"] for a in apps]},
            follow_up="Would you like to explore a specific app's contents?"
        )
