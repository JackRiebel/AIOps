"""Catalyst Center SWIM (Software Image Management) skill module."""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    IMAGE_ID_SCHEMA, DEVICE_ID_SCHEMA, OFFSET_SCHEMA, LIMIT_SCHEMA,
)

SWIM_SKILLS: List[SkillDefinition] = [
    {"id": "swim_get_images", "name": "Get Software Images", "description": "Get list of software images in repository.", "tags": ["catalyst", "swim", "images", "list"], "examples": ["List software images", "Show available images"], "input_schema": {"type": "object", "properties": {"image_uuid": {"type": "string"}, "name": {"type": "string"}, "family": {"type": "string"}, "application_type": {"type": "string"}, "image_integrity_status": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA}, "required": []}},
    {"id": "swim_import_image_url", "name": "Import Image from URL", "description": "Import software image from a URL.", "tags": ["catalyst", "swim", "import", "url"], "examples": ["Import image from URL"], "input_schema": {"type": "object", "properties": {"source_url": {"type": "string"}, "schedule_at": {"type": "string"}, "schedule_desc": {"type": "string"}, "third_party_vendor": {"type": "string"}, "third_party_image_family": {"type": "string"}}, "required": ["source_url"]}},
    {"id": "swim_import_image_file", "name": "Import Image from File", "description": "Import software image from local file.", "tags": ["catalyst", "swim", "import", "file"], "examples": ["Upload image file"], "input_schema": {"type": "object", "properties": {"file_path": {"type": "string"}, "third_party_vendor": {"type": "string"}, "third_party_image_family": {"type": "string"}}, "required": ["file_path"]}},
    {"id": "swim_get_image_by_id", "name": "Get Image by ID", "description": "Get details of a specific software image.", "tags": ["catalyst", "swim", "details"], "examples": ["Get image details"], "input_schema": {"type": "object", "properties": {"image_id": IMAGE_ID_SCHEMA}, "required": ["image_id"]}},
    {"id": "swim_distribute_image", "name": "Distribute Image", "description": "Distribute software image to devices.", "tags": ["catalyst", "swim", "distribute"], "examples": ["Distribute image to devices"], "input_schema": {"type": "object", "properties": {"image_id": IMAGE_ID_SCHEMA, "device_ids": {"type": "array", "items": {"type": "string"}}}, "required": ["image_id", "device_ids"]}},
    {"id": "swim_get_distribution_status", "name": "Get Distribution Status", "description": "Get status of image distribution.", "tags": ["catalyst", "swim", "distribution", "status"], "examples": ["Check distribution status"], "input_schema": {"type": "object", "properties": {"task_id": {"type": "string"}}, "required": ["task_id"]}},
    {"id": "swim_activate_image", "name": "Activate Image", "description": "Activate software image on devices.", "tags": ["catalyst", "swim", "activate"], "examples": ["Activate image on device"], "input_schema": {"type": "object", "properties": {"device_ids": {"type": "array", "items": {"type": "string"}}, "activate_lower_image_version": {"type": "boolean", "default": False}, "schedule_validate": {"type": "boolean", "default": False}}, "required": ["device_ids"]}},
    {"id": "swim_get_activation_status", "name": "Get Activation Status", "description": "Get status of image activation.", "tags": ["catalyst", "swim", "activation", "status"], "examples": ["Check activation status"], "input_schema": {"type": "object", "properties": {"task_id": {"type": "string"}}, "required": ["task_id"]}},
    {"id": "swim_get_device_family", "name": "Get Device Family for Images", "description": "Get device families for image management.", "tags": ["catalyst", "swim", "device", "family"], "examples": ["Get device families"], "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"id": "swim_tag_image_golden", "name": "Tag Image as Golden", "description": "Mark an image as golden for a device family.", "tags": ["catalyst", "swim", "golden", "tag"], "examples": ["Mark image golden"], "input_schema": {"type": "object", "properties": {"image_id": IMAGE_ID_SCHEMA, "site_id": {"type": "string"}, "device_family": {"type": "string"}, "device_role": {"type": "string"}}, "required": ["image_id"]}},
    {"id": "swim_remove_golden_tag", "name": "Remove Golden Tag", "description": "Remove golden tag from an image.", "tags": ["catalyst", "swim", "golden", "untag"], "examples": ["Remove golden tag"], "input_schema": {"type": "object", "properties": {"image_id": IMAGE_ID_SCHEMA, "site_id": {"type": "string"}, "device_family": {"type": "string"}}, "required": ["image_id"]}},
    {"id": "swim_get_golden_images", "name": "Get Golden Images", "description": "Get list of golden images.", "tags": ["catalyst", "swim", "golden", "list"], "examples": ["List golden images"], "input_schema": {"type": "object", "properties": {"site_id": {"type": "string"}, "device_family": {"type": "string"}, "device_role": {"type": "string"}}, "required": []}},
    {"id": "swim_delete_image", "name": "Delete Image", "description": "Delete a software image from repository.", "tags": ["catalyst", "swim", "delete"], "examples": ["Delete image"], "input_schema": {"type": "object", "properties": {"image_id": IMAGE_ID_SCHEMA}, "required": ["image_id"]}},
    {"id": "swim_get_applicable_devices", "name": "Get Applicable Devices", "description": "Get devices that can use a specific image.", "tags": ["catalyst", "swim", "applicable", "devices"], "examples": ["Show applicable devices"], "input_schema": {"type": "object", "properties": {"image_id": IMAGE_ID_SCHEMA}, "required": ["image_id"]}},
    {"id": "swim_trigger_upgrade", "name": "Trigger Image Upgrade", "description": "Trigger software upgrade on devices.", "tags": ["catalyst", "swim", "upgrade", "trigger"], "examples": ["Upgrade device software"], "input_schema": {"type": "object", "properties": {"device_ids": {"type": "array", "items": {"type": "string"}}, "image_id": IMAGE_ID_SCHEMA, "distribute_if_needed": {"type": "boolean", "default": True}}, "required": ["device_ids"]}},
]

class SwimModule(CatalystSkillModule):
    MODULE_NAME = "swim"
    MODULE_PREFIX = "swim_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in SWIM_SKILLS]

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
        if skill_id == "swim_get_images":
            qp = {k: v for k, v in {"imageUuid": params.get("image_uuid"), "name": params.get("name"), "family": params.get("family"), "applicationType": params.get("application_type"), "imageIntegrityStatus": params.get("image_integrity_status"), "offset": params.get("offset"), "limit": params.get("limit")}.items() if v}
            r = await client.get("image/importation", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"images": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_import_image_url":
            payload = [{"sourceURL": params.get("source_url")}]
            if params.get("schedule_at"): payload[0]["scheduleAt"] = params["schedule_at"]
            if params.get("schedule_desc"): payload[0]["scheduleDesc"] = params["schedule_desc"]
            if params.get("third_party_vendor"): payload[0]["thirdPartyVendor"] = params["third_party_vendor"]
            if params.get("third_party_image_family"): payload[0]["thirdPartyImageFamily"] = params["third_party_image_family"]
            r = await client.post("image/importation/source/url", payload)
            return success_result(data={"message": "Import started", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_get_image_by_id":
            r = await client.get(f"image/importation/{params.get('image_id')}")
            return success_result(data={"image": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_distribute_image":
            payload = [{"imageUuid": params.get("image_id"), "deviceUuid": did} for did in params.get("device_ids", [])]
            r = await client.post("image/distribution", payload)
            return success_result(data={"message": "Distribution started", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_get_distribution_status":
            r = await client.get(f"image/distribution/{params.get('task_id')}")
            return success_result(data={"status": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_activate_image":
            payload = [{"deviceUuid": did, "activateLowerImageVersion": params.get("activate_lower_image_version", False), "scheduleValidate": params.get("schedule_validate", False)} for did in params.get("device_ids", [])]
            r = await client.post("image/activation/device", payload)
            return success_result(data={"message": "Activation started", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_get_activation_status":
            r = await client.get(f"image/activation/device/{params.get('task_id')}")
            return success_result(data={"status": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_get_device_family":
            r = await client.get("image/importation/device-family")
            return success_result(data={"families": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_tag_image_golden":
            payload = {"imageId": params.get("image_id"), "siteId": params.get("site_id"), "deviceFamilyIdentifier": params.get("device_family"), "deviceRole": params.get("device_role", "ALL")}
            r = await client.post("image/importation/golden", payload)
            return success_result(data={"message": "Image tagged as golden", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_remove_golden_tag":
            qp = {k: v for k, v in {"imageId": params.get("image_id"), "siteId": params.get("site_id"), "deviceFamilyIdentifier": params.get("device_family")}.items() if v}
            r = await client.delete("image/importation/golden", qp)
            return success_result(data={"message": "Golden tag removed"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_get_golden_images":
            qp = {k: v for k, v in {"siteId": params.get("site_id"), "deviceFamily": params.get("device_family"), "deviceRole": params.get("device_role")}.items() if v}
            r = await client.get("image/importation/golden", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"golden_images": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_delete_image":
            r = await client.delete(f"image/importation/{params.get('image_id')}")
            return success_result(data={"message": "Image deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_get_applicable_devices":
            r = await client.get(f"image/{params.get('image_id')}/applicable-devices")
            return success_result(data={"devices": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "swim_trigger_upgrade":
            payload = {"deviceUuids": params.get("device_ids"), "imageUuid": params.get("image_id"), "distributeIfNeeded": params.get("distribute_if_needed", True)}
            r = await client.post("image/upgrade", payload)
            return success_result(data={"message": "Upgrade triggered", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
