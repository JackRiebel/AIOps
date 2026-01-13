"""Catalyst Center Compliance skill module.

This module provides skills for device compliance management.
"""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    DEVICE_ID_SCHEMA, OFFSET_SCHEMA, LIMIT_SCHEMA,
)

COMPLIANCE_SKILLS: List[SkillDefinition] = [
    {"id": "compliance_get_status", "name": "Get Compliance Status", "description": "Get compliance status for devices.", "tags": ["catalyst", "compliance", "status"], "examples": ["Get compliance status", "Check device compliance"], "input_schema": {"type": "object", "properties": {"device_uuid": {"type": "string"}, "compliance_type": {"type": "string", "enum": ["RUNNING_CONFIG", "IMAGE", "PSIRT", "EOX", "NETWORK_SETTINGS"]}, "compliance_status": {"type": "string", "enum": ["COMPLIANT", "NON_COMPLIANT", "IN_PROGRESS", "ERROR", "NOT_APPLICABLE"]}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA}, "required": []}},
    {"id": "compliance_get_details", "name": "Get Compliance Details", "description": "Get detailed compliance info for a device.", "tags": ["catalyst", "compliance", "details"], "examples": ["Get compliance details"], "input_schema": {"type": "object", "properties": {"device_uuid": DEVICE_ID_SCHEMA, "category": {"type": "string"}, "compliance_type": {"type": "string"}, "diff_list": {"type": "boolean", "default": False}}, "required": ["device_uuid"]}},
    {"id": "compliance_run_check", "name": "Run Compliance Check", "description": "Trigger compliance check for devices.", "tags": ["catalyst", "compliance", "check", "run"], "examples": ["Run compliance check"], "input_schema": {"type": "object", "properties": {"trigger_full": {"type": "boolean", "default": False}, "categories": {"type": "array", "items": {"type": "string"}}, "device_uuids": {"type": "array", "items": {"type": "string"}}}, "required": []}},
    {"id": "compliance_get_count", "name": "Get Compliance Count", "description": "Get count of compliant and non-compliant devices.", "tags": ["catalyst", "compliance", "count"], "examples": ["Count compliant devices"], "input_schema": {"type": "object", "properties": {"compliance_status": {"type": "string", "enum": ["COMPLIANT", "NON_COMPLIANT", "IN_PROGRESS", "ERROR"]}}, "required": []}},
    {"id": "compliance_get_device_by_id", "name": "Get Device Compliance by ID", "description": "Get compliance for a specific device.", "tags": ["catalyst", "compliance", "device"], "examples": ["Get device compliance"], "input_schema": {"type": "object", "properties": {"device_id": DEVICE_ID_SCHEMA}, "required": ["device_id"]}},
    {"id": "compliance_get_config_details", "name": "Get Config Compliance Details", "description": "Get configuration compliance status.", "tags": ["catalyst", "compliance", "config"], "examples": ["Get config compliance"], "input_schema": {"type": "object", "properties": {"device_uuid": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA}, "required": []}},
    {"id": "compliance_run_full_check", "name": "Run Full Compliance Check", "description": "Trigger full compliance check for all devices.", "tags": ["catalyst", "compliance", "full", "check"], "examples": ["Run full compliance"], "input_schema": {"type": "object", "properties": {"categories": {"type": "array", "items": {"type": "string"}}}, "required": []}},
    {"id": "compliance_get_rules", "name": "Get Compliance Rules", "description": "Get compliance profile rules.", "tags": ["catalyst", "compliance", "rules", "profile"], "examples": ["Get compliance rules"], "input_schema": {"type": "object", "properties": {"profile_id": {"type": "string"}}, "required": []}},
]

class ComplianceModule(CatalystSkillModule):
    MODULE_NAME = "compliance"
    MODULE_PREFIX = "compliance_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in COMPLIANCE_SKILLS]

    @classmethod
    async def execute(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        log_skill_start(skill_id, params)
        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed: {str(e)}")

    @classmethod
    async def _execute_skill(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        if skill_id == "compliance_get_status":
            qp = {k: v for k, v in {"deviceUuid": params.get("device_uuid"), "complianceType": params.get("compliance_type"), "complianceStatus": params.get("compliance_status"), "offset": params.get("offset"), "limit": params.get("limit")}.items() if v is not None}
            r = await client.get("compliance", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"compliance": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "compliance_get_details":
            qp = {k: v for k, v in {"category": params.get("category"), "complianceType": params.get("compliance_type"), "diffList": params.get("diff_list", False)}.items() if v is not None}
            r = await client.get(f"compliance/{params.get('device_uuid')}/detail", qp)
            return success_result(data={"details": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "compliance_run_check":
            payload = {k: v for k, v in {"triggerFull": params.get("trigger_full", False), "categories": params.get("categories", []), "deviceUuids": params.get("device_uuids", [])}.items() if v}
            r = await client.post("compliance", payload)
            return success_result(data={"message": "Compliance check triggered", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "compliance_get_count":
            qp = {"complianceStatus": params.get("compliance_status")} if params.get("compliance_status") else {}
            r = await client.get("compliance/count", qp)
            return success_result(data={"count": r.get("data", {}).get("response", 0)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "compliance_get_device_by_id":
            r = await client.get(f"compliance/{params.get('device_id')}")
            return success_result(data={"compliance": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "compliance_get_config_details":
            qp = {k: v for k, v in {"deviceUuid": params.get("device_uuid"), "offset": params.get("offset"), "limit": params.get("limit")}.items() if v is not None}
            r = await client.get("compliance/configStatus", qp)
            return success_result(data={"config_status": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "compliance_run_full_check":
            payload = {"categories": params.get("categories", [])}
            r = await client.post("compliance/full", payload)
            return success_result(data={"message": "Full compliance check triggered", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "compliance_get_rules":
            qp = {"profileId": params.get("profile_id")} if params.get("profile_id") else {}
            r = await client.get("compliance/profile/rules", qp)
            return success_result(data={"rules": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
