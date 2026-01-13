"""ThousandEyes Voice Tests skill module.

This module provides skills for voice/VoIP tests:
- SIP Server tests
- Voice (RTP) tests
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    TEST_ID_SCHEMA, TEST_NAME_SCHEMA, TEST_INTERVAL_SCHEMA, TEST_ENABLED_SCHEMA,
    TEST_AGENTS_SCHEMA, TEST_ALERT_RULES_SCHEMA, SIP_TARGET_SCHEMA, SIP_USER_SCHEMA,
    SIP_AUTH_USER_SCHEMA, CODEC_SCHEMA, DSCP_SCHEMA,
)

VOICE_TEST_SKILLS: List[SkillDefinition] = [
    # SIP Server Tests
    {"id": "tests_get_sip_server_list", "name": "List SIP Server Tests", "description": "Get all SIP server tests.", "tags": ["thousandeyes", "tests", "voice", "sip-server", "list"], "examples": ["List SIP tests", "Show VoIP tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_sip_server", "name": "Get SIP Server Test", "description": "Get details of a specific SIP server test.", "tags": ["thousandeyes", "tests", "voice", "sip-server", "details"], "examples": ["Get SIP test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_sip_server", "name": "Create SIP Server Test", "description": "Create a new SIP server test.", "tags": ["thousandeyes", "tests", "voice", "sip-server", "create"], "examples": ["Create SIP test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "target_sip_credentials": {"type": "object", "properties": {"sipRegistrar": {"type": "string"}, "port": {"type": "integer", "default": 5060}, "protocol": {"type": "string", "enum": ["TCP", "UDP", "TLS"], "default": "UDP"}, "user": {"type": "string"}, "authUser": {"type": "string"}, "password": {"type": "string"}}}, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "options_regex": {"type": "string"}, "register_enabled": {"type": "boolean", "default": False}, "sip_time_limit": {"type": "integer"}, "sip_target_time": {"type": "integer"}, "network_measurements": {"type": "boolean", "default": True}, "bgp_measurements": {"type": "boolean", "default": True}}, "required": ["test_name", "target_sip_credentials", "agents"]}},
    {"id": "tests_update_sip_server", "name": "Update SIP Server Test", "description": "Update an existing SIP server test.", "tags": ["thousandeyes", "tests", "voice", "sip-server", "update"], "examples": ["Update SIP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "target_sip_credentials": {"type": "object"}, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_sip_server", "name": "Delete SIP Server Test", "description": "Delete a SIP server test.", "tags": ["thousandeyes", "tests", "voice", "sip-server", "delete"], "examples": ["Delete SIP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # Voice (RTP) Tests
    {"id": "tests_get_voice_list", "name": "List Voice Tests", "description": "Get all voice (RTP stream) tests.", "tags": ["thousandeyes", "tests", "voice", "rtp", "list"], "examples": ["List voice tests", "Show RTP tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_voice", "name": "Get Voice Test", "description": "Get details of a specific voice test.", "tags": ["thousandeyes", "tests", "voice", "rtp", "details"], "examples": ["Get voice test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_voice", "name": "Create Voice Test", "description": "Create a new voice (RTP stream) test.", "tags": ["thousandeyes", "tests", "voice", "rtp", "create"], "examples": ["Create voice test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "target_agent_id": {"type": "string", "description": "Target agent for RTP stream"}, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "codec_id": {"type": "integer", "description": "Voice codec ID"}, "codec": CODEC_SCHEMA, "dscp_id": {"type": "integer"}, "dscp": DSCP_SCHEMA, "duration": {"type": "integer", "description": "Call duration in seconds", "default": 5}, "jitter_buffer": {"type": "integer", "description": "Jitter buffer size in ms"}, "num_path_traces": {"type": "integer", "default": 3}, "target_sip_credentials": {"type": "object", "properties": {"sipRegistrar": {"type": "string"}, "port": {"type": "integer"}, "protocol": {"type": "string"}, "user": {"type": "string"}, "authUser": {"type": "string"}, "password": {"type": "string"}}}}, "required": ["test_name", "target_agent_id", "agents"]}},
    {"id": "tests_update_voice", "name": "Update Voice Test", "description": "Update an existing voice test.", "tags": ["thousandeyes", "tests", "voice", "rtp", "update"], "examples": ["Update voice test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "codec_id": {"type": "integer"}, "duration": {"type": "integer"}}, "required": ["test_id"]}},
    {"id": "tests_delete_voice", "name": "Delete Voice Test", "description": "Delete a voice test.", "tags": ["thousandeyes", "tests", "voice", "rtp", "delete"], "examples": ["Delete voice test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
]


class VoiceTestsModule(ThousandEyesSkillModule):
    """Voice tests skill module (sip-server, voice/RTP)."""

    MODULE_NAME = "tests_voice"
    MODULE_PREFIX = "tests_"

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        return skill_id in [s["id"] for s in VOICE_TEST_SKILLS]

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in VOICE_TEST_SKILLS]

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
        # SIP Server Tests
        if skill_id == "tests_get_sip_server_list":
            r = await client.get("tests/sip-server", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_sip_server":
            r = await client.get(f"tests/sip-server/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_sip_server":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "targetSipCredentials": params.get("target_sip_credentials"),
                "interval": params.get("interval", 300),
                "agents": params.get("agents", []),
                "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True),
                "description": params.get("description"),
                "optionsRegex": params.get("options_regex"),
                "registerEnabled": params.get("register_enabled", False),
                "sipTimeLimit": params.get("sip_time_limit"),
                "sipTargetTime": params.get("sip_target_time"),
                "networkMeasurements": params.get("network_measurements", True),
                "bgpMeasurements": params.get("bgp_measurements", True),
            }.items() if v is not None}
            r = await client.post("tests/sip-server", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_sip_server":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "targetSipCredentials": params.get("target_sip_credentials"), "interval": params.get("interval"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/sip-server/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_sip_server":
            r = await client.delete(f"tests/sip-server/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # Voice (RTP) Tests
        if skill_id == "tests_get_voice_list":
            r = await client.get("tests/voice", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_voice":
            r = await client.get(f"tests/voice/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_voice":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "targetAgentId": params.get("target_agent_id"),
                "interval": params.get("interval", 300),
                "agents": params.get("agents", []),
                "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True),
                "description": params.get("description"),
                "codecId": params.get("codec_id"),
                "codec": params.get("codec"),
                "dscpId": params.get("dscp_id"),
                "dscp": params.get("dscp"),
                "duration": params.get("duration", 5),
                "jitterBuffer": params.get("jitter_buffer"),
                "numPathTraces": params.get("num_path_traces", 3),
                "targetSipCredentials": params.get("target_sip_credentials"),
            }.items() if v is not None}
            r = await client.post("tests/voice", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_voice":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "interval": params.get("interval"), "enabled": params.get("enabled"), "codecId": params.get("codec_id"), "duration": params.get("duration")}.items() if v is not None}
            r = await client.put(f"tests/voice/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_voice":
            r = await client.delete(f"tests/voice/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
