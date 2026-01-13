"""Catalyst Center Issues skill module.

This module provides skills for issue management including:
- Issue queries and details
- Issue resolution
- Custom issue definitions
- Issue enrichment

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!issues
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
    ISSUE_ID_SCHEMA,
    ISSUE_PRIORITY_SCHEMA,
    ISSUE_STATUS_SCHEMA,
    SITE_ID_SCHEMA,
    DEVICE_ID_SCHEMA,
    CLIENT_MAC_SCHEMA,
    TIMESTAMP_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
)


# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

ISSUES_SKILLS: List[SkillDefinition] = [
    {
        "id": "issues_get_by_id",
        "name": "Get Issue by ID",
        "description": (
            "Get detailed information about a specific issue including root cause, "
            "affected devices, and suggested remediation actions."
        ),
        "tags": ["catalyst", "issues", "details", "troubleshooting"],
        "examples": [
            "Get issue details",
            "Show issue by ID",
            "Issue information",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_id": {
                    **ISSUE_ID_SCHEMA,
                    "description": "Issue ID to retrieve"
                },
            },
            "required": ["issue_id"],
        },
    },
    {
        "id": "issues_query",
        "name": "Query Issues",
        "description": (
            "Query issues with filtering by priority, status, category, site, "
            "device, or time range."
        ),
        "tags": ["catalyst", "issues", "query", "search", "filter"],
        "examples": [
            "List all issues",
            "Show P1 issues",
            "Find active issues",
            "Issues in last 24 hours",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "priority": ISSUE_PRIORITY_SCHEMA,
                "issue_status": ISSUE_STATUS_SCHEMA,
                "ai_driven": {
                    "type": "boolean",
                    "description": "Filter AI-driven issues"
                },
                "site_id": {
                    **SITE_ID_SCHEMA,
                    "description": "Filter by site"
                },
                "device_id": {
                    **DEVICE_ID_SCHEMA,
                    "description": "Filter by device"
                },
                "mac_address": {
                    **CLIENT_MAC_SCHEMA,
                    "description": "Filter by client MAC"
                },
                "category": {
                    "type": "string",
                    "description": "Issue category",
                    "enum": ["Onboarding", "Connectivity", "Connected", "Device", "Application Experience"]
                },
                "start_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "Start time for issue window"
                },
                "end_time": {
                    **TIMESTAMP_SCHEMA,
                    "description": "End time for issue window"
                },
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "issues_get_count",
        "name": "Get Issue Count",
        "description": (
            "Get the count of issues, optionally filtered by various criteria."
        ),
        "tags": ["catalyst", "issues", "count", "statistics"],
        "examples": [
            "How many issues?",
            "Count active issues",
            "Issue count by priority",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "priority": ISSUE_PRIORITY_SCHEMA,
                "issue_status": ISSUE_STATUS_SCHEMA,
                "start_time": TIMESTAMP_SCHEMA,
                "end_time": TIMESTAMP_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "issues_ignore",
        "name": "Ignore Issues",
        "description": (
            "Mark one or more issues as ignored. Ignored issues will not appear "
            "in active issue lists."
        ),
        "tags": ["catalyst", "issues", "ignore", "manage"],
        "examples": [
            "Ignore issue",
            "Suppress issue",
            "Hide issue",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Issue IDs to ignore"
                },
            },
            "required": ["issue_ids"],
        },
    },
    {
        "id": "issues_resolve",
        "name": "Resolve Issues",
        "description": (
            "Mark one or more issues as resolved. This indicates the issue "
            "has been addressed."
        ),
        "tags": ["catalyst", "issues", "resolve", "manage"],
        "examples": [
            "Resolve issue",
            "Mark issue resolved",
            "Close issue",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Issue IDs to resolve"
                },
            },
            "required": ["issue_ids"],
        },
    },
    {
        "id": "issues_get_trigger_definitions",
        "name": "Get Issue Trigger Definitions",
        "description": (
            "Get the definitions for issue triggers showing what conditions "
            "cause different types of issues."
        ),
        "tags": ["catalyst", "issues", "triggers", "definitions"],
        "examples": [
            "Show issue triggers",
            "Get issue definitions",
            "What causes issues?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "device_type": {
                    "type": "string",
                    "description": "Filter by device type"
                },
                "profile_id": {
                    "type": "string",
                    "description": "Filter by profile ID"
                },
                "priority": ISSUE_PRIORITY_SCHEMA,
                "offset": OFFSET_SCHEMA,
                "limit": LIMIT_SCHEMA,
            },
            "required": [],
        },
    },
    {
        "id": "issues_create_custom_definition",
        "name": "Create Custom Issue Definition",
        "description": (
            "Create a custom issue definition to trigger alerts based on "
            "specific conditions."
        ),
        "tags": ["catalyst", "issues", "custom", "create", "definition"],
        "examples": [
            "Create custom issue",
            "Add custom alert",
            "Define new issue type",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name for the custom issue"
                },
                "description": {
                    "type": "string",
                    "description": "Description of when this issue triggers"
                },
                "priority": ISSUE_PRIORITY_SCHEMA,
                "is_enabled": {
                    "type": "boolean",
                    "description": "Whether the issue is enabled",
                    "default": True
                },
                "rules": {
                    "type": "array",
                    "description": "Rules defining when to trigger the issue",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "severity": {"type": "integer"},
                            "facility": {"type": "string"},
                            "pattern": {"type": "string"},
                        }
                    }
                },
            },
            "required": ["name", "description", "priority"],
        },
    },
    {
        "id": "issues_update_custom_definition",
        "name": "Update Custom Issue Definition",
        "description": (
            "Update an existing custom issue definition."
        ),
        "tags": ["catalyst", "issues", "custom", "update", "definition"],
        "examples": [
            "Update custom issue",
            "Modify issue definition",
            "Change custom alert",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Custom issue definition ID"
                },
                "name": {
                    "type": "string",
                    "description": "Updated name"
                },
                "description": {
                    "type": "string",
                    "description": "Updated description"
                },
                "priority": ISSUE_PRIORITY_SCHEMA,
                "is_enabled": {
                    "type": "boolean",
                    "description": "Whether the issue is enabled"
                },
            },
            "required": ["id"],
        },
    },
    {
        "id": "issues_delete_custom_definition",
        "name": "Delete Custom Issue Definition",
        "description": (
            "Delete a custom issue definition."
        ),
        "tags": ["catalyst", "issues", "custom", "delete", "definition"],
        "examples": [
            "Delete custom issue",
            "Remove custom alert",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Custom issue definition ID to delete"
                },
            },
            "required": ["id"],
        },
    },
    {
        "id": "issues_get_enrichment",
        "name": "Get Issue Enrichment Details",
        "description": (
            "Get enriched issue details including affected entities, "
            "related issues, and suggested actions."
        ),
        "tags": ["catalyst", "issues", "enrichment", "context"],
        "examples": [
            "Get issue enrichment",
            "Issue context",
            "Related issue details",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_id": {
                    **ISSUE_ID_SCHEMA,
                    "description": "Issue ID for enrichment"
                },
            },
            "required": ["issue_id"],
        },
    },
    {
        "id": "issues_execute_suggested_actions",
        "name": "Execute Suggested Actions",
        "description": (
            "Execute the suggested remediation actions for an issue."
        ),
        "tags": ["catalyst", "issues", "remediation", "actions", "execute"],
        "examples": [
            "Run suggested fix",
            "Execute remediation",
            "Apply suggested actions",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_type": {
                    "type": "string",
                    "description": "Entity type (issue_id, device_id, etc.)"
                },
                "entity_value": {
                    "type": "string",
                    "description": "Entity value"
                },
            },
            "required": ["entity_type", "entity_value"],
        },
    },
    {
        "id": "issues_get_summary",
        "name": "Get Issue Summary",
        "description": (
            "Get a summary of issues grouped by priority, category, or status."
        ),
        "tags": ["catalyst", "issues", "summary", "dashboard", "statistics"],
        "examples": [
            "Issue summary",
            "Issues by priority",
            "Issue statistics",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "site_id": SITE_ID_SCHEMA,
                "start_time": TIMESTAMP_SCHEMA,
                "end_time": TIMESTAMP_SCHEMA,
                "group_by": {
                    "type": "string",
                    "description": "Dimension to group by",
                    "enum": ["priority", "category", "status", "site"]
                },
            },
            "required": [],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class IssuesModule(CatalystSkillModule):
    """Issue management skills module."""

    MODULE_NAME = "issues"
    MODULE_PREFIX = "issues_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all issue management skills."""
        return [create_skill(skill_def) for skill_def in ISSUES_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute an issue management skill."""
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

        if skill_id == "issues_get_by_id":
            return await cls._get_by_id(client, params)
        if skill_id == "issues_query":
            return await cls._query(client, params)
        if skill_id == "issues_get_count":
            return await cls._get_count(client, params)
        if skill_id == "issues_ignore":
            return await cls._ignore(client, params)
        if skill_id == "issues_resolve":
            return await cls._resolve(client, params)
        if skill_id == "issues_get_trigger_definitions":
            return await cls._get_trigger_definitions(client, params)
        if skill_id == "issues_create_custom_definition":
            return await cls._create_custom_definition(client, params)
        if skill_id == "issues_update_custom_definition":
            return await cls._update_custom_definition(client, params)
        if skill_id == "issues_delete_custom_definition":
            return await cls._delete_custom_definition(client, params)
        if skill_id == "issues_get_enrichment":
            return await cls._get_enrichment(client, params)
        if skill_id == "issues_execute_suggested_actions":
            return await cls._execute_suggested_actions(client, params)
        if skill_id == "issues_get_summary":
            return await cls._get_summary(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    # ========================================================================
    # SKILL IMPLEMENTATIONS
    # ========================================================================

    @classmethod
    async def _get_by_id(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Get issue by ID."""
        issue_id = params.get("issue_id")
        response = await client.get(f"issue/{issue_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get issue"))

        data = response.get("data", {})
        issue = data.get("response", {})

        return success_result(
            data={"issue": issue, "issue_id": issue_id},
            follow_up="Would you like to see suggested remediation actions?"
        )

    @classmethod
    async def _query(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Query issues."""
        payload = {}
        for key in ["priority", "ai_driven", "site_id", "device_id", "mac_address", "category", "start_time", "end_time"]:
            if params.get(key):
                api_key = {"issue_status": "issueStatus", "site_id": "siteId", "device_id": "deviceId", "mac_address": "macAddress", "start_time": "startTime", "end_time": "endTime"}.get(key, key)
                payload[api_key] = params[key]
        if params.get("issue_status"):
            payload["issueStatus"] = params["issue_status"]

        query_params = {}
        if params.get("offset"): query_params["offset"] = params["offset"]
        if params.get("limit"): query_params["limit"] = params["limit"]

        response = await client.post("issues/query", payload, query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to query issues"))

        data = response.get("data", {})
        issues = data.get("response", [])

        # Summarize by priority
        priorities = {}
        for issue in issues:
            p = issue.get("priority", "Unknown")
            priorities[p] = priorities.get(p, 0) + 1

        return success_result(
            data={"issues": issues, "count": len(issues), "summary": {"by_priority": priorities}},
            entities={"issue_ids": [i.get("issueId") for i in issues]},
            follow_up="Would you like details on a specific issue?"
        )

    @classmethod
    async def _get_count(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Get issue count."""
        query_params = {}
        if params.get("priority"): query_params["priority"] = params["priority"]
        if params.get("issue_status"): query_params["issueStatus"] = params["issue_status"]
        if params.get("start_time"): query_params["startTime"] = params["start_time"]
        if params.get("end_time"): query_params["endTime"] = params["end_time"]

        response = await client.get("issues/count", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get issue count"))

        data = response.get("data", {})
        count = data.get("response", 0)

        return success_result(data={"count": count, "message": f"Total issues: {count}"})

    @classmethod
    async def _ignore(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Ignore issues."""
        issue_ids = params.get("issue_ids", [])
        payload = {"issueIds": issue_ids}

        response = await client.post("issues/ignore", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to ignore issues"))

        return success_result(data={"message": f"Ignored {len(issue_ids)} issue(s)"})

    @classmethod
    async def _resolve(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Resolve issues."""
        issue_ids = params.get("issue_ids", [])
        payload = {"issueIds": issue_ids}

        response = await client.post("issues/resolve", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to resolve issues"))

        return success_result(data={"message": f"Resolved {len(issue_ids)} issue(s)"})

    @classmethod
    async def _get_trigger_definitions(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Get issue trigger definitions."""
        query_params = {}
        if params.get("device_type"): query_params["deviceType"] = params["device_type"]
        if params.get("profile_id"): query_params["profileId"] = params["profile_id"]
        if params.get("priority"): query_params["priority"] = params["priority"]
        if params.get("offset"): query_params["offset"] = params["offset"]
        if params.get("limit"): query_params["limit"] = params["limit"]

        response = await client.get("issue-trigger-definition", query_params)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get trigger definitions"))

        data = response.get("data", {})
        definitions = data.get("response", [])

        return success_result(data={"definitions": definitions, "count": len(definitions)})

    @classmethod
    async def _create_custom_definition(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Create custom issue definition."""
        payload = {
            "name": params.get("name"),
            "description": params.get("description"),
            "priority": params.get("priority"),
            "isEnabled": params.get("is_enabled", True),
        }
        if params.get("rules"):
            payload["rules"] = params["rules"]

        response = await client.post("customIssueDefinitions", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to create custom definition"))

        return success_result(data={"message": "Custom issue definition created", "response": response.get("data")})

    @classmethod
    async def _update_custom_definition(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Update custom issue definition."""
        def_id = params.get("id")
        payload = {}
        if params.get("name"): payload["name"] = params["name"]
        if params.get("description"): payload["description"] = params["description"]
        if params.get("priority"): payload["priority"] = params["priority"]
        if "is_enabled" in params: payload["isEnabled"] = params["is_enabled"]

        response = await client.put(f"customIssueDefinitions/{def_id}", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to update custom definition"))

        return success_result(data={"message": f"Custom issue definition {def_id} updated"})

    @classmethod
    async def _delete_custom_definition(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Delete custom issue definition."""
        def_id = params.get("id")

        response = await client.delete(f"customIssueDefinitions/{def_id}")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to delete custom definition"))

        return success_result(data={"message": f"Custom issue definition {def_id} deleted"})

    @classmethod
    async def _get_enrichment(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Get issue enrichment."""
        issue_id = params.get("issue_id")

        response = await client.get("issue-enrichment-details", {"entity_type": "issue_id", "entity_value": issue_id})

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get issue enrichment"))

        data = response.get("data", {})
        enrichment = data.get("response", [])

        return success_result(data={"enrichment": enrichment, "issue_id": issue_id})

    @classmethod
    async def _execute_suggested_actions(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Execute suggested actions."""
        payload = {
            "entity_type": params.get("entity_type"),
            "entity_value": params.get("entity_value"),
        }

        response = await client.post("execute-suggested-actions-commands", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to execute suggested actions"))

        data = response.get("data", {})
        if data.get("response", {}).get("taskId"):
            task_result = await client.get_task_result(data["response"]["taskId"])
            return success_result(data={"message": "Suggested actions executed", "result": task_result.get("data")})

        return success_result(data={"message": "Suggested actions executed", "response": data})

    @classmethod
    async def _get_summary(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        """Get issue summary."""
        payload = {}
        if params.get("site_id"): payload["siteId"] = params["site_id"]
        if params.get("start_time"): payload["startTime"] = params["start_time"]
        if params.get("end_time"): payload["endTime"] = params["end_time"]
        if params.get("group_by"): payload["groupBy"] = params["group_by"]

        response = await client.post("assuranceIssues/summary", payload)

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get issue summary"))

        data = response.get("data", {})
        summary = data.get("response", {})

        return success_result(data={"summary": summary}, follow_up="Would you like to drill down into specific issues?")
