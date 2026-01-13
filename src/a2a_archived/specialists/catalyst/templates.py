"""Catalyst Center Templates skill module for configuration template management."""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    PROJECT_ID_SCHEMA, TEMPLATE_ID_SCHEMA, OFFSET_SCHEMA, LIMIT_SCHEMA,
)

TEMPLATES_SKILLS: List[SkillDefinition] = [
    {"id": "templates_get_projects", "name": "Get Template Projects", "description": "Get list of template projects.", "tags": ["catalyst", "templates", "projects", "list"], "examples": ["List template projects"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "sort_order": {"type": "string", "enum": ["asc", "desc"]}}, "required": []}},
    {"id": "templates_create_project", "name": "Create Template Project", "description": "Create a new template project.", "tags": ["catalyst", "templates", "project", "create"], "examples": ["Create template project"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "description": {"type": "string"}, "tags": {"type": "array", "items": {"type": "string"}}}, "required": ["name"]}},
    {"id": "templates_update_project", "name": "Update Template Project", "description": "Update a template project.", "tags": ["catalyst", "templates", "project", "update"], "examples": ["Update project"], "input_schema": {"type": "object", "properties": {"project_id": PROJECT_ID_SCHEMA, "name": {"type": "string"}, "description": {"type": "string"}}, "required": ["project_id"]}},
    {"id": "templates_delete_project", "name": "Delete Template Project", "description": "Delete a template project.", "tags": ["catalyst", "templates", "project", "delete"], "examples": ["Delete project"], "input_schema": {"type": "object", "properties": {"project_id": PROJECT_ID_SCHEMA}, "required": ["project_id"]}},
    {"id": "templates_get_project_by_id", "name": "Get Project by ID", "description": "Get template project details.", "tags": ["catalyst", "templates", "project", "details"], "examples": ["Get project details"], "input_schema": {"type": "object", "properties": {"project_id": PROJECT_ID_SCHEMA}, "required": ["project_id"]}},
    {"id": "templates_get_templates", "name": "Get Templates", "description": "Get list of configuration templates.", "tags": ["catalyst", "templates", "list"], "examples": ["List templates", "Show all templates"], "input_schema": {"type": "object", "properties": {"project_id": {"type": "string"}, "software_type": {"type": "string"}, "software_version": {"type": "string"}, "product_family": {"type": "string"}, "product_series": {"type": "string"}, "product_type": {"type": "string"}, "filter_conflicting_templates": {"type": "boolean"}, "sort_order": {"type": "string", "enum": ["asc", "desc"]}}, "required": []}},
    {"id": "templates_create_template", "name": "Create Template", "description": "Create a new configuration template.", "tags": ["catalyst", "templates", "create"], "examples": ["Create template"], "input_schema": {"type": "object", "properties": {"project_id": PROJECT_ID_SCHEMA, "name": {"type": "string"}, "description": {"type": "string"}, "software_type": {"type": "string"}, "software_variant": {"type": "string"}, "software_version": {"type": "string"}, "template_content": {"type": "string"}, "template_params": {"type": "array", "items": {"type": "object"}}}, "required": ["project_id", "name", "software_type", "template_content"]}},
    {"id": "templates_update_template", "name": "Update Template", "description": "Update a configuration template.", "tags": ["catalyst", "templates", "update"], "examples": ["Update template"], "input_schema": {"type": "object", "properties": {"template_id": TEMPLATE_ID_SCHEMA, "name": {"type": "string"}, "description": {"type": "string"}, "template_content": {"type": "string"}}, "required": ["template_id"]}},
    {"id": "templates_delete_template", "name": "Delete Template", "description": "Delete a configuration template.", "tags": ["catalyst", "templates", "delete"], "examples": ["Delete template"], "input_schema": {"type": "object", "properties": {"template_id": TEMPLATE_ID_SCHEMA}, "required": ["template_id"]}},
    {"id": "templates_get_by_id", "name": "Get Template by ID", "description": "Get template details by ID.", "tags": ["catalyst", "templates", "details"], "examples": ["Get template details"], "input_schema": {"type": "object", "properties": {"template_id": TEMPLATE_ID_SCHEMA, "latest_version": {"type": "boolean", "default": True}}, "required": ["template_id"]}},
    {"id": "templates_version_template", "name": "Version Template", "description": "Create a new version of a template.", "tags": ["catalyst", "templates", "version"], "examples": ["Create template version"], "input_schema": {"type": "object", "properties": {"template_id": TEMPLATE_ID_SCHEMA, "comments": {"type": "string"}}, "required": ["template_id"]}},
    {"id": "templates_get_versions", "name": "Get Template Versions", "description": "Get all versions of a template.", "tags": ["catalyst", "templates", "versions", "history"], "examples": ["Show template versions"], "input_schema": {"type": "object", "properties": {"template_id": TEMPLATE_ID_SCHEMA}, "required": ["template_id"]}},
    {"id": "templates_deploy_template", "name": "Deploy Template", "description": "Deploy a template to devices.", "tags": ["catalyst", "templates", "deploy"], "examples": ["Deploy template", "Push config to devices"], "input_schema": {"type": "object", "properties": {"template_id": TEMPLATE_ID_SCHEMA, "target_info": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "type": {"type": "string"}, "params": {"type": "object"}}}, "description": "Deployment targets"}, "force_push_template": {"type": "boolean", "default": False}}, "required": ["template_id", "target_info"]}},
    {"id": "templates_get_deployment_status", "name": "Get Deployment Status", "description": "Get template deployment status.", "tags": ["catalyst", "templates", "deployment", "status"], "examples": ["Check deployment status"], "input_schema": {"type": "object", "properties": {"deployment_id": {"type": "string"}}, "required": ["deployment_id"]}},
    {"id": "templates_preview_template", "name": "Preview Template", "description": "Preview template with parameters.", "tags": ["catalyst", "templates", "preview"], "examples": ["Preview template output"], "input_schema": {"type": "object", "properties": {"template_id": TEMPLATE_ID_SCHEMA, "device_id": {"type": "string"}, "params": {"type": "object"}}, "required": ["template_id"]}},
    {"id": "templates_export", "name": "Export Templates", "description": "Export templates from a project.", "tags": ["catalyst", "templates", "export"], "examples": ["Export templates"], "input_schema": {"type": "object", "properties": {"project_id": PROJECT_ID_SCHEMA}, "required": ["project_id"]}},
    {"id": "templates_import", "name": "Import Templates", "description": "Import templates to a project.", "tags": ["catalyst", "templates", "import"], "examples": ["Import templates"], "input_schema": {"type": "object", "properties": {"project_id": PROJECT_ID_SCHEMA, "do_version": {"type": "boolean", "default": False}}, "required": ["project_id"]}},
    {"id": "templates_get_available_products", "name": "Get Available Products", "description": "Get products available for templates.", "tags": ["catalyst", "templates", "products"], "examples": ["List available products"], "input_schema": {"type": "object", "properties": {"product_family": {"type": "string"}, "product_series": {"type": "string"}, "product_type": {"type": "string"}}, "required": []}},
]

class TemplatesModule(CatalystSkillModule):
    MODULE_NAME = "templates"
    MODULE_PREFIX = "templates_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in TEMPLATES_SKILLS]

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
        base = "template-programmer"
        if skill_id == "templates_get_projects":
            qp = {k: v for k, v in {"name": params.get("name"), "sortOrder": params.get("sort_order")}.items() if v}
            r = await client.get(f"{base}/project", qp)
            return success_result(data={"projects": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_create_project":
            payload = {"name": params.get("name"), "description": params.get("description", ""), "tags": params.get("tags", [])}
            r = await client.post(f"{base}/project", payload)
            return success_result(data={"message": "Project created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_update_project":
            payload = {k: v for k, v in {"id": params.get("project_id"), "name": params.get("name"), "description": params.get("description")}.items() if v}
            r = await client.put(f"{base}/project", payload)
            return success_result(data={"message": "Project updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_delete_project":
            r = await client.delete(f"{base}/project/{params.get('project_id')}")
            return success_result(data={"message": "Project deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_get_project_by_id":
            r = await client.get(f"{base}/project/{params.get('project_id')}")
            return success_result(data={"project": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_get_templates":
            qp = {k: v for k, v in {"projectId": params.get("project_id"), "softwareType": params.get("software_type"), "softwareVersion": params.get("software_version"), "productFamily": params.get("product_family"), "productSeries": params.get("product_series"), "productType": params.get("product_type"), "filterConflictingTemplates": params.get("filter_conflicting_templates"), "sortOrder": params.get("sort_order")}.items() if v is not None}
            r = await client.get(f"{base}/template", qp)
            return success_result(data={"templates": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_create_template":
            payload = {"projectId": params.get("project_id"), "name": params.get("name"), "description": params.get("description", ""), "softwareType": params.get("software_type"), "softwareVariant": params.get("software_variant", "IOS-XE"), "softwareVersion": params.get("software_version", ""), "templateContent": params.get("template_content"), "templateParams": params.get("template_params", [])}
            r = await client.post(f"{base}/project/{params.get('project_id')}/template", payload)
            return success_result(data={"message": "Template created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_update_template":
            payload = {k: v for k, v in {"id": params.get("template_id"), "name": params.get("name"), "description": params.get("description"), "templateContent": params.get("template_content")}.items() if v}
            r = await client.put(f"{base}/template", payload)
            return success_result(data={"message": "Template updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_delete_template":
            r = await client.delete(f"{base}/template/{params.get('template_id')}")
            return success_result(data={"message": "Template deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_get_by_id":
            qp = {"latestVersion": params.get("latest_version", True)}
            r = await client.get(f"{base}/template/{params.get('template_id')}", qp)
            return success_result(data={"template": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_version_template":
            payload = {"templateId": params.get("template_id"), "comments": params.get("comments", "")}
            r = await client.post(f"{base}/template/version", payload)
            return success_result(data={"message": "Version created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_get_versions":
            r = await client.get(f"{base}/template/version/{params.get('template_id')}")
            return success_result(data={"versions": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_deploy_template":
            payload = {"templateId": params.get("template_id"), "targetInfo": params.get("target_info", []), "forcePushTemplate": params.get("force_push_template", False)}
            r = await client.post(f"{base}/template/deploy", payload)
            return success_result(data={"message": "Deployment started", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_get_deployment_status":
            r = await client.get(f"{base}/template/deploy/status/{params.get('deployment_id')}")
            return success_result(data={"status": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_preview_template":
            payload = {"templateId": params.get("template_id"), "deviceId": params.get("device_id"), "params": params.get("params", {})}
            r = await client.put(f"{base}/template/preview", payload)
            return success_result(data={"preview": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_export":
            payload = {"projectId": params.get("project_id")}
            r = await client.post(f"{base}/project/export", payload)
            return success_result(data={"export": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_import":
            payload = {"projectId": params.get("project_id"), "doVersion": params.get("do_version", False)}
            r = await client.post(f"{base}/project/import", payload)
            return success_result(data={"message": "Import started", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "templates_get_available_products":
            qp = {k: v for k, v in {"productFamily": params.get("product_family"), "productSeries": params.get("product_series"), "productType": params.get("product_type")}.items() if v}
            r = await client.get(f"{base}/availableProducts", qp)
            return success_result(data={"products": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
