"""ThousandEyes BGP Monitors skill module.

This module provides skills for BGP monitor operations.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    BGP_ASN_SCHEMA,
)

BGP_MONITORS_SKILLS: List[SkillDefinition] = [
    {"id": "bgp_get_monitors", "name": "List BGP Monitors", "description": "Get all available BGP monitors.", "tags": ["thousandeyes", "bgp", "monitors", "list"], "examples": ["List BGP monitors"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "bgp_get_as_prefixes", "name": "Get AS Prefixes", "description": "Get BGP prefixes for an Autonomous System.", "tags": ["thousandeyes", "bgp", "as", "prefixes"], "examples": ["Get AS prefixes"], "input_schema": {"type": "object", "properties": {"asn": BGP_ASN_SCHEMA, "aid": {"type": "string"}}, "required": ["asn"]}},
]


class BGPMonitorsModule(ThousandEyesSkillModule):
    """BGP monitors skill module."""

    MODULE_NAME = "bgp_monitors"
    MODULE_PREFIX = "bgp_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in BGP_MONITORS_SKILLS]

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
        if skill_id == "bgp_get_monitors":
            r = await client.get("monitors", {"aid": params.get("aid")})
            if r.get("success"):
                monitors = r.get("data", {}).get("monitors", [])
                return success_result(data={"bgp_monitors": monitors, "count": len(monitors)})
            return error_result(r.get("error"))

        if skill_id == "bgp_get_as_prefixes":
            r = await client.get(f"autonomous-systems/{params.get('asn')}/prefixes", {"aid": params.get("aid")})
            if r.get("success"):
                prefixes = r.get("data", {}).get("prefixes", [])
                return success_result(data={"prefixes": prefixes, "count": len(prefixes)})
            return error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
