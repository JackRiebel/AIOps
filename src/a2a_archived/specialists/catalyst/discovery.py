"""Catalyst Center Discovery skill module.

This module provides skills for network discovery operations.
"""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    DISCOVERY_ID_SCHEMA, OFFSET_SCHEMA, LIMIT_SCHEMA,
)

DISCOVERY_SKILLS: List[SkillDefinition] = [
    {"id": "discovery_start", "name": "Start Network Discovery", "description": "Start a new network discovery job to find devices.", "tags": ["catalyst", "discovery", "start"], "examples": ["Start discovery", "Discover devices"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "discovery_type": {"type": "string", "enum": ["Range", "Single", "CDP", "LLDP", "CIDR"]}, "ip_address_list": {"type": "string"}, "snmp_ro_community": {"type": "string"}, "snmp_rw_community": {"type": "string"}, "cli_username": {"type": "string"}, "cli_password": {"type": "string"}, "enable_password": {"type": "string"}}, "required": ["name", "discovery_type", "ip_address_list"]}},
    {"id": "discovery_get_by_id", "name": "Get Discovery by ID", "description": "Get details of a specific discovery job.", "tags": ["catalyst", "discovery", "details"], "examples": ["Get discovery status"], "input_schema": {"type": "object", "properties": {"discovery_id": DISCOVERY_ID_SCHEMA}, "required": ["discovery_id"]}},
    {"id": "discovery_get_all", "name": "Get All Discoveries", "description": "Get list of all discovery jobs.", "tags": ["catalyst", "discovery", "list"], "examples": ["List discoveries"], "input_schema": {"type": "object", "properties": {"offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA}, "required": []}},
    {"id": "discovery_get_count", "name": "Get Discovery Count", "description": "Get count of discovery jobs.", "tags": ["catalyst", "discovery", "count"], "examples": ["How many discoveries?"], "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"id": "discovery_delete", "name": "Delete Discovery", "description": "Delete a discovery job.", "tags": ["catalyst", "discovery", "delete"], "examples": ["Delete discovery"], "input_schema": {"type": "object", "properties": {"discovery_id": DISCOVERY_ID_SCHEMA}, "required": ["discovery_id"]}},
    {"id": "discovery_delete_range", "name": "Delete Discoveries by Range", "description": "Delete multiple discovery jobs.", "tags": ["catalyst", "discovery", "delete"], "examples": ["Delete multiple discoveries"], "input_schema": {"type": "object", "properties": {"start_index": {"type": "integer"}, "records_to_delete": {"type": "integer"}}, "required": ["start_index", "records_to_delete"]}},
    {"id": "discovery_get_devices", "name": "Get Discovered Devices", "description": "Get devices found by a discovery job.", "tags": ["catalyst", "discovery", "devices"], "examples": ["Show discovered devices"], "input_schema": {"type": "object", "properties": {"discovery_id": DISCOVERY_ID_SCHEMA, "task_id": {"type": "string"}}, "required": ["discovery_id"]}},
    {"id": "discovery_get_device_count", "name": "Get Discovered Device Count", "description": "Get count of devices found by discovery.", "tags": ["catalyst", "discovery", "count"], "examples": ["How many devices found?"], "input_schema": {"type": "object", "properties": {"discovery_id": DISCOVERY_ID_SCHEMA}, "required": ["discovery_id"]}},
    {"id": "discovery_get_summary", "name": "Get Discovery Summary", "description": "Get summary of a discovery job.", "tags": ["catalyst", "discovery", "summary"], "examples": ["Discovery summary"], "input_schema": {"type": "object", "properties": {"discovery_id": DISCOVERY_ID_SCHEMA}, "required": ["discovery_id"]}},
    {"id": "discovery_get_job_by_ip", "name": "Get Discovery Job by IP", "description": "Get discovery job associated with an IP address.", "tags": ["catalyst", "discovery", "ip"], "examples": ["Find discovery by IP"], "input_schema": {"type": "object", "properties": {"ip_address": {"type": "string"}}, "required": ["ip_address"]}},
    {"id": "discovery_get_credentials", "name": "Get Global Credentials", "description": "Get global credentials used for discovery.", "tags": ["catalyst", "discovery", "credentials"], "examples": ["Get discovery credentials"], "input_schema": {"type": "object", "properties": {"credential_type": {"type": "string"}}, "required": []}},
    {"id": "discovery_update_credentials", "name": "Update Global Credentials", "description": "Update global credentials for discovery.", "tags": ["catalyst", "discovery", "credentials", "update"], "examples": ["Update discovery credentials"], "input_schema": {"type": "object", "properties": {"credential_id": {"type": "string"}, "credential_type": {"type": "string"}, "username": {"type": "string"}, "password": {"type": "string"}}, "required": ["credential_id"]}},
]

class DiscoveryModule(CatalystSkillModule):
    MODULE_NAME = "discovery"
    MODULE_PREFIX = "discovery_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in DISCOVERY_SKILLS]

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
        if skill_id == "discovery_start":
            payload = {"name": params.get("name"), "discoveryType": params.get("discovery_type"), "ipAddressList": params.get("ip_address_list")}
            if params.get("snmp_ro_community"): payload["snmpROCommunity"] = params["snmp_ro_community"]
            if params.get("snmp_rw_community"): payload["snmpRWCommunity"] = params["snmp_rw_community"]
            if params.get("cli_username"): payload["userNameList"] = [params["cli_username"]]
            if params.get("cli_password"): payload["passwordList"] = [params["cli_password"]]
            if params.get("enable_password"): payload["enablePasswordList"] = [params["enable_password"]]
            r = await client.post("discovery", payload)
            if r.get("success"):
                d = r.get("data", {})
                if d.get("response", {}).get("taskId"):
                    return success_result(data={"message": "Discovery started", "task_id": d["response"]["taskId"]})
                return success_result(data={"message": "Discovery started", "response": d})
            return error_result(r.get("error"))
        if skill_id == "discovery_get_by_id":
            r = await client.get(f"discovery/{params.get('discovery_id')}")
            return success_result(data={"discovery": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_get_all":
            off, lim = params.get("offset", 1), params.get("limit", 10)
            r = await client.get(f"discovery/{off}/{lim}")
            return success_result(data={"discoveries": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_get_count":
            r = await client.get("discovery/count")
            return success_result(data={"count": r.get("data", {}).get("response", 0)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_delete":
            r = await client.delete(f"discovery/{params.get('discovery_id')}")
            return success_result(data={"message": "Discovery deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_delete_range":
            r = await client.delete(f"discovery/{params.get('start_index')}/{params.get('records_to_delete')}")
            return success_result(data={"message": "Discoveries deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_get_devices":
            qp = {"taskId": params.get("task_id")} if params.get("task_id") else {}
            r = await client.get(f"discovery/{params.get('discovery_id')}/network-device", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"devices": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_get_device_count":
            r = await client.get(f"discovery/{params.get('discovery_id')}/network-device/count")
            return success_result(data={"count": r.get("data", {}).get("response", 0)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_get_summary":
            r = await client.get(f"discovery/{params.get('discovery_id')}/summary")
            return success_result(data={"summary": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_get_job_by_ip":
            r = await client.get(f"discovery/job/{params.get('ip_address')}")
            return success_result(data={"jobs": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_get_credentials":
            qp = {"credentialType": params.get("credential_type")} if params.get("credential_type") else {}
            r = await client.get("global-credential", qp)
            return success_result(data={"credentials": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "discovery_update_credentials":
            payload = {k: v for k, v in {"id": params.get("credential_id"), "credentialType": params.get("credential_type"), "username": params.get("username"), "password": params.get("password")}.items() if v}
            r = await client.put("global-credential", payload)
            return success_result(data={"message": "Credentials updated"}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
