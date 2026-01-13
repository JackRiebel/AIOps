"""Catalyst Center Path Trace skill module.

This module provides skills for network path analysis and flow tracing.
"""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    OFFSET_SCHEMA, LIMIT_SCHEMA,
)

PATH_TRACE_SKILLS: List[SkillDefinition] = [
    {"id": "pathtrace_initiate", "name": "Initiate Path Trace", "description": "Start a new path trace between source and destination.", "tags": ["catalyst", "pathtrace", "flow", "initiate"], "examples": ["Trace path", "Start flow analysis"], "input_schema": {"type": "object", "properties": {"source_ip": {"type": "string", "description": "Source IP address"}, "dest_ip": {"type": "string", "description": "Destination IP address"}, "source_port": {"type": "string"}, "dest_port": {"type": "string"}, "protocol": {"type": "string", "enum": ["TCP", "UDP", "ICMP"]}, "periodic_refresh": {"type": "boolean", "default": False}, "inclusions": {"type": "array", "items": {"type": "string"}}}, "required": ["source_ip", "dest_ip"]}},
    {"id": "pathtrace_get_by_id", "name": "Get Path Trace by ID", "description": "Get results of a specific path trace.", "tags": ["catalyst", "pathtrace", "results"], "examples": ["Get trace results"], "input_schema": {"type": "object", "properties": {"flow_analysis_id": {"type": "string"}}, "required": ["flow_analysis_id"]}},
    {"id": "pathtrace_get_all", "name": "Get All Path Traces", "description": "Get list of all path trace analyses.", "tags": ["catalyst", "pathtrace", "list"], "examples": ["List path traces", "Show all traces"], "input_schema": {"type": "object", "properties": {"periodic_refresh": {"type": "boolean"}, "source_ip": {"type": "string"}, "dest_ip": {"type": "string"}, "source_port": {"type": "string"}, "dest_port": {"type": "string"}, "gt_create_time": {"type": "integer"}, "lt_create_time": {"type": "integer"}, "protocol": {"type": "string"}, "status": {"type": "string"}, "task_id": {"type": "string"}, "last_update_time": {"type": "integer"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "order": {"type": "string", "enum": ["asc", "desc"]}, "sort_by": {"type": "string"}}, "required": []}},
    {"id": "pathtrace_delete", "name": "Delete Path Trace", "description": "Delete a path trace analysis.", "tags": ["catalyst", "pathtrace", "delete"], "examples": ["Delete path trace"], "input_schema": {"type": "object", "properties": {"flow_analysis_id": {"type": "string"}}, "required": ["flow_analysis_id"]}},
    {"id": "pathtrace_get_detailed_result", "name": "Get Detailed Path Trace Result", "description": "Get detailed path trace result with all hops.", "tags": ["catalyst", "pathtrace", "detailed", "result"], "examples": ["Get detailed trace"], "input_schema": {"type": "object", "properties": {"flow_analysis_id": {"type": "string"}}, "required": ["flow_analysis_id"]}},
]

class PathTraceModule(CatalystSkillModule):
    MODULE_NAME = "path_trace"
    MODULE_PREFIX = "pathtrace_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in PATH_TRACE_SKILLS]

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
        if skill_id == "pathtrace_initiate":
            payload = {k: v for k, v in {"sourceIP": params.get("source_ip"), "destIP": params.get("dest_ip"), "sourcePort": params.get("source_port"), "destPort": params.get("dest_port"), "protocol": params.get("protocol"), "periodicRefresh": params.get("periodic_refresh", False), "inclusions": params.get("inclusions", [])}.items() if v is not None}
            r = await client.post("flow-analysis", payload)
            if r.get("success"):
                data = r.get("data", {})
                flow_id = data.get("response", {}).get("flowAnalysisId")
                return success_result(data={"message": "Path trace initiated", "flow_analysis_id": flow_id, "response": data})
            return error_result(r.get("error"))
        if skill_id == "pathtrace_get_by_id":
            r = await client.get(f"flow-analysis/{params.get('flow_analysis_id')}")
            return success_result(data={"path_trace": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "pathtrace_get_all":
            qp = {k: v for k, v in {"periodicRefresh": params.get("periodic_refresh"), "sourceIP": params.get("source_ip"), "destIP": params.get("dest_ip"), "sourcePort": params.get("source_port"), "destPort": params.get("dest_port"), "gtCreateTime": params.get("gt_create_time"), "ltCreateTime": params.get("lt_create_time"), "protocol": params.get("protocol"), "status": params.get("status"), "taskId": params.get("task_id"), "lastUpdateTime": params.get("last_update_time"), "offset": params.get("offset"), "limit": params.get("limit"), "order": params.get("order"), "sortBy": params.get("sort_by")}.items() if v is not None}
            r = await client.get("flow-analysis", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"path_traces": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "pathtrace_delete":
            r = await client.delete(f"flow-analysis/{params.get('flow_analysis_id')}")
            return success_result(data={"message": "Path trace deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "pathtrace_get_detailed_result":
            r = await client.get(f"flow-analysis/{params.get('flow_analysis_id')}/result")
            return success_result(data={"detailed_result": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
