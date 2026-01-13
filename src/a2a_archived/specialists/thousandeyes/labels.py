"""ThousandEyes Labels skill module.

This module provides skills for test and agent labeling/grouping.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    LABEL_ID_SCHEMA,
)

LABELS_SKILLS: List[SkillDefinition] = [
    {"id": "labels_get_list", "name": "List Labels", "description": "Get all labels/groups.", "tags": ["thousandeyes", "labels", "groups", "list"], "examples": ["List labels", "Show groups"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}, "type": {"type": "string", "enum": ["tests", "agents", "endpoint-agents"], "description": "Label type"}}, "required": []}},
    {"id": "labels_get_by_id", "name": "Get Label", "description": "Get details of a specific label.", "tags": ["thousandeyes", "labels", "groups", "details"], "examples": ["Get label"], "input_schema": {"type": "object", "properties": {"label_id": LABEL_ID_SCHEMA, "type": {"type": "string", "enum": ["tests", "agents", "endpoint-agents"]}}, "required": ["label_id"]}},
    {"id": "labels_create", "name": "Create Label", "description": "Create a new label/group.", "tags": ["thousandeyes", "labels", "groups", "create"], "examples": ["Create label"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "type": {"type": "string", "enum": ["tests", "agents", "endpoint-agents"]}, "color": {"type": "string", "description": "Hex color code"}, "description": {"type": "string"}, "tests": {"type": "array", "items": {"type": "object", "properties": {"testId": {"type": "string"}}}}, "agents": {"type": "array", "items": {"type": "object", "properties": {"agentId": {"type": "string"}}}}}, "required": ["name", "type"]}},
    {"id": "labels_update", "name": "Update Label", "description": "Update an existing label.", "tags": ["thousandeyes", "labels", "groups", "update"], "examples": ["Update label"], "input_schema": {"type": "object", "properties": {"label_id": LABEL_ID_SCHEMA, "type": {"type": "string", "enum": ["tests", "agents", "endpoint-agents"]}, "name": {"type": "string"}, "color": {"type": "string"}, "description": {"type": "string"}, "tests": {"type": "array", "items": {"type": "object"}}, "agents": {"type": "array", "items": {"type": "object"}}}, "required": ["label_id", "type"]}},
    {"id": "labels_delete", "name": "Delete Label", "description": "Delete a label.", "tags": ["thousandeyes", "labels", "groups", "delete"], "examples": ["Delete label"], "input_schema": {"type": "object", "properties": {"label_id": LABEL_ID_SCHEMA, "type": {"type": "string", "enum": ["tests", "agents", "endpoint-agents"]}}, "required": ["label_id", "type"]}},
]


class LabelsModule(ThousandEyesSkillModule):
    """Labels skill module for test/agent grouping."""

    MODULE_NAME = "labels"
    MODULE_PREFIX = "labels_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in LABELS_SKILLS]

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
        label_type = params.get("type", "tests")
        endpoint = f"groups/{label_type}" if label_type else "groups"

        if skill_id == "labels_get_list":
            r = await client.get(endpoint, {"aid": params.get("aid")})
            if r.get("success"):
                labels = r.get("data", {}).get("groups", [])
                return success_result(data={"labels": labels, "count": len(labels)})
            return error_result(r.get("error"))

        if skill_id == "labels_get_by_id":
            r = await client.get(f"groups/{label_type}/{params.get('label_id')}")
            return success_result(data={"label": r.get("data", {}).get("groups", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "labels_create":
            payload = {k: v for k, v in {
                "name": params.get("name"),
                "color": params.get("color"),
                "description": params.get("description"),
                "tests": params.get("tests"),
                "agents": params.get("agents"),
            }.items() if v is not None}
            r = await client.post(f"groups/{label_type}", payload)
            if r.get("success"):
                label = r.get("data", {}).get("groups", [{}])[0] if isinstance(r.get("data", {}).get("groups"), list) else r.get("data", {})
                return success_result(data={"message": "Label created", "label": label})
            return error_result(r.get("error"))

        if skill_id == "labels_update":
            label_id = params.pop("label_id", None)
            payload = {k: v for k, v in {
                "name": params.get("name"),
                "color": params.get("color"),
                "description": params.get("description"),
                "tests": params.get("tests"),
                "agents": params.get("agents"),
            }.items() if v is not None}
            r = await client.put(f"groups/{label_type}/{label_id}", payload)
            return success_result(data={"message": "Label updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "labels_delete":
            r = await client.delete(f"groups/{label_type}/{params.get('label_id')}")
            return success_result(data={"message": "Label deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
