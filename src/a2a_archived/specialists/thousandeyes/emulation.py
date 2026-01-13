"""ThousandEyes Emulation skill module.

This module provides skills for user agent and device emulation settings.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
)

EMULATION_SKILLS: List[SkillDefinition] = [
    {"id": "emulation_get_user_agents", "name": "List User Agents", "description": "Get available user agent strings for browser tests.", "tags": ["thousandeyes", "emulation", "user-agents", "list"], "examples": ["List user agents"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "emulation_get_emulated_devices", "name": "List Emulated Devices", "description": "Get available emulated devices for page load tests.", "tags": ["thousandeyes", "emulation", "devices", "list"], "examples": ["List emulated devices"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
]


class EmulationModule(ThousandEyesSkillModule):
    """Emulation skill module for user agent and device settings."""

    MODULE_NAME = "emulation"
    MODULE_PREFIX = "emulation_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in EMULATION_SKILLS]

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
        if skill_id == "emulation_get_user_agents":
            r = await client.get("emulation/user-agents", {"aid": params.get("aid")})
            if r.get("success"):
                agents = r.get("data", {}).get("userAgents", [])
                return success_result(data={"user_agents": agents, "count": len(agents)})
            return error_result(r.get("error"))

        if skill_id == "emulation_get_emulated_devices":
            r = await client.get("emulation/emulated-devices", {"aid": params.get("aid")})
            if r.get("success"):
                devices = r.get("data", {}).get("emulatedDevices", [])
                return success_result(data={"emulated_devices": devices, "count": len(devices)})
            return error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
