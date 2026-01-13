"""Catalyst Center Command Runner skill module."""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    DEVICE_ID_SCHEMA,
)

COMMAND_RUNNER_SKILLS: List[SkillDefinition] = [
    {"id": "command_get_keywords", "name": "Get Command Keywords", "description": "Get allowed read-only command keywords.", "tags": ["catalyst", "command", "keywords"], "examples": ["Get allowed commands"], "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"id": "command_run_read_only", "name": "Run Read-Only Commands", "description": "Execute read-only CLI commands on devices.", "tags": ["catalyst", "command", "execute", "cli"], "examples": ["Run show commands", "Execute CLI commands"], "input_schema": {"type": "object", "properties": {"device_uuids": {"type": "array", "items": {"type": "string"}, "description": "Device UUIDs to run commands on"}, "commands": {"type": "array", "items": {"type": "string"}, "description": "CLI commands to execute"}}, "required": ["device_uuids", "commands"]}},
    {"id": "command_get_result", "name": "Get Command Result", "description": "Get results of a command execution.", "tags": ["catalyst", "command", "result"], "examples": ["Get command output"], "input_schema": {"type": "object", "properties": {"file_id": {"type": "string", "description": "File ID from command execution"}}, "required": ["file_id"]}},
    {"id": "command_run_commands", "name": "Run Commands", "description": "Execute CLI commands on network devices.", "tags": ["catalyst", "command", "execute"], "examples": ["Run CLI on device"], "input_schema": {"type": "object", "properties": {"device_uuids": {"type": "array", "items": {"type": "string"}}, "commands": {"type": "array", "items": {"type": "string"}}, "timeout": {"type": "integer", "default": 0}}, "required": ["device_uuids", "commands"]}},
    {"id": "command_get_all_keywords", "name": "Get All Command Keywords", "description": "Get all available command keywords.", "tags": ["catalyst", "command", "keywords", "all"], "examples": ["List all keywords"], "input_schema": {"type": "object", "properties": {}, "required": []}},
]

class CommandRunnerModule(CatalystSkillModule):
    MODULE_NAME = "command_runner"
    MODULE_PREFIX = "command_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in COMMAND_RUNNER_SKILLS]

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
        if skill_id == "command_get_keywords":
            r = await client.get("network-device-poller/cli/legit-reads")
            return success_result(data={"keywords": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "command_run_read_only":
            payload = {"commands": params.get("commands", []), "deviceUuids": params.get("device_uuids", [])}
            r = await client.post("network-device-poller/cli/read-request", payload)
            if r.get("success"):
                data = r.get("data", {})
                if data.get("response", {}).get("taskId"):
                    task_result = await client.get_task_result(data["response"]["taskId"])
                    return success_result(data={"message": "Commands executed", "result": task_result.get("data")})
                return success_result(data={"message": "Commands queued", "response": data})
            return error_result(r.get("error"))
        if skill_id == "command_get_result":
            r = await client.get(f"file/{params.get('file_id')}")
            return success_result(data={"result": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "command_run_commands":
            payload = {"commands": params.get("commands", []), "deviceUuids": params.get("device_uuids", []), "timeout": params.get("timeout", 0)}
            r = await client.post("network-device-poller/cli/read-request", payload)
            if r.get("success"):
                data = r.get("data", {})
                if data.get("response", {}).get("taskId"):
                    return success_result(data={"message": "Commands submitted", "task_id": data["response"]["taskId"]})
                return success_result(data={"message": "Commands submitted", "response": data})
            return error_result(r.get("error"))
        if skill_id == "command_get_all_keywords":
            r = await client.get("network-device-poller/cli/all-keywords")
            return success_result(data={"keywords": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
