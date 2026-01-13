"""ThousandEyes Other Tests skill module.

This module provides skills for other test types:
- FTP Server tests
- BGP tests
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    TEST_ID_SCHEMA, TEST_NAME_SCHEMA, TEST_INTERVAL_SCHEMA, TEST_ENABLED_SCHEMA,
    TEST_AGENTS_SCHEMA, TEST_ALERT_RULES_SCHEMA, TEST_URL_SCHEMA, BGP_PREFIX_SCHEMA,
)

OTHER_TEST_SKILLS: List[SkillDefinition] = [
    # FTP Server Tests
    {"id": "tests_get_ftp_server_list", "name": "List FTP Server Tests", "description": "Get all FTP server tests.", "tags": ["thousandeyes", "tests", "ftp", "ftp-server", "list"], "examples": ["List FTP tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_ftp_server", "name": "Get FTP Server Test", "description": "Get details of a specific FTP server test.", "tags": ["thousandeyes", "tests", "ftp", "ftp-server", "details"], "examples": ["Get FTP test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_ftp_server", "name": "Create FTP Server Test", "description": "Create a new FTP server test.", "tags": ["thousandeyes", "tests", "ftp", "ftp-server", "create"], "examples": ["Create FTP test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "username": {"type": "string"}, "password": {"type": "string"}, "ftp_time_limit": {"type": "integer"}, "ftp_target_time": {"type": "integer"}, "request_type": {"type": "string", "enum": ["Download", "Upload", "List"], "default": "Download"}, "use_active_ftp": {"type": "boolean", "default": False}, "network_measurements": {"type": "boolean", "default": True}, "bgp_measurements": {"type": "boolean", "default": True}, "mtu_measurements": {"type": "boolean", "default": False}}, "required": ["test_name", "url", "agents"]}},
    {"id": "tests_update_ftp_server", "name": "Update FTP Server Test", "description": "Update an existing FTP server test.", "tags": ["thousandeyes", "tests", "ftp", "ftp-server", "update"], "examples": ["Update FTP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "username": {"type": "string"}, "password": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "tests_delete_ftp_server", "name": "Delete FTP Server Test", "description": "Delete an FTP server test.", "tags": ["thousandeyes", "tests", "ftp", "ftp-server", "delete"], "examples": ["Delete FTP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # BGP Tests
    {"id": "tests_get_bgp_list", "name": "List BGP Tests", "description": "Get all BGP routing tests.", "tags": ["thousandeyes", "tests", "bgp", "routing", "list"], "examples": ["List BGP tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_bgp", "name": "Get BGP Test", "description": "Get details of a specific BGP test.", "tags": ["thousandeyes", "tests", "bgp", "routing", "details"], "examples": ["Get BGP test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_bgp", "name": "Create BGP Test", "description": "Create a new BGP routing test.", "tags": ["thousandeyes", "tests", "bgp", "routing", "create"], "examples": ["Create BGP test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "prefix": BGP_PREFIX_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "include_covered_prefixes": {"type": "boolean", "default": False}, "use_public_bgp": {"type": "boolean", "default": True}, "bgp_monitors": {"type": "array", "items": {"type": "object", "properties": {"monitorId": {"type": "string"}}}, "description": "BGP monitors to use"}}, "required": ["test_name", "prefix"]}},
    {"id": "tests_update_bgp", "name": "Update BGP Test", "description": "Update an existing BGP test.", "tags": ["thousandeyes", "tests", "bgp", "routing", "update"], "examples": ["Update BGP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "prefix": BGP_PREFIX_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_bgp", "name": "Delete BGP Test", "description": "Delete a BGP test.", "tags": ["thousandeyes", "tests", "bgp", "routing", "delete"], "examples": ["Delete BGP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
]


class OtherTestsModule(ThousandEyesSkillModule):
    """Other tests skill module (ftp-server, bgp)."""

    MODULE_NAME = "tests_other"
    MODULE_PREFIX = "tests_"

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        return skill_id in [s["id"] for s in OTHER_TEST_SKILLS]

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in OTHER_TEST_SKILLS]

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
        # FTP Server Tests
        if skill_id == "tests_get_ftp_server_list":
            r = await client.get("tests/ftp-server", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_ftp_server":
            r = await client.get(f"tests/ftp-server/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_ftp_server":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "url": params.get("url"),
                "interval": params.get("interval", 300),
                "agents": params.get("agents", []),
                "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True),
                "description": params.get("description"),
                "username": params.get("username"),
                "password": params.get("password"),
                "ftpTimeLimit": params.get("ftp_time_limit"),
                "ftpTargetTime": params.get("ftp_target_time"),
                "requestType": params.get("request_type", "Download"),
                "useActiveFtp": params.get("use_active_ftp", False),
                "networkMeasurements": params.get("network_measurements", True),
                "bgpMeasurements": params.get("bgp_measurements", True),
                "mtuMeasurements": params.get("mtu_measurements", False),
            }.items() if v is not None}
            r = await client.post("tests/ftp-server", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_ftp_server":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "url": params.get("url"), "interval": params.get("interval"), "enabled": params.get("enabled"), "username": params.get("username"), "password": params.get("password")}.items() if v is not None}
            r = await client.put(f"tests/ftp-server/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_ftp_server":
            r = await client.delete(f"tests/ftp-server/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # BGP Tests
        if skill_id == "tests_get_bgp_list":
            r = await client.get("tests/bgp", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_bgp":
            r = await client.get(f"tests/bgp/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_bgp":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "prefix": params.get("prefix"),
                "interval": params.get("interval", 300),
                "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True),
                "description": params.get("description"),
                "includeCoveredPrefixes": params.get("include_covered_prefixes", False),
                "usePublicBgp": params.get("use_public_bgp", True),
                "bgpMonitors": params.get("bgp_monitors"),
            }.items() if v is not None}
            r = await client.post("tests/bgp", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_bgp":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "prefix": params.get("prefix"), "interval": params.get("interval"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/bgp/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_bgp":
            r = await client.delete(f"tests/bgp/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
