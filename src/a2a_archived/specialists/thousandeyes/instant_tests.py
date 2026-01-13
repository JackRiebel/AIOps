"""ThousandEyes Instant Tests skill module.

This module provides skills for running instant (on-demand) tests.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    TEST_ID_SCHEMA, TEST_NAME_SCHEMA, TEST_URL_SCHEMA, TEST_SERVER_SCHEMA,
    TEST_AGENTS_SCHEMA, DNS_DOMAIN_SCHEMA,
)

INSTANT_TEST_SKILLS: List[SkillDefinition] = [
    {"id": "instant_run_agent_to_server", "name": "Run Instant Agent-to-Server Test", "description": "Run an instant agent-to-server network test.", "tags": ["thousandeyes", "instant", "network", "agent-to-server"], "examples": ["Run instant network test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "server": TEST_SERVER_SCHEMA, "port": {"type": "integer", "default": 443}, "protocol": {"type": "string", "enum": ["TCP", "UDP", "ICMP"], "default": "TCP"}, "agents": TEST_AGENTS_SCHEMA}, "required": ["server", "agents"]}},
    {"id": "instant_run_agent_to_agent", "name": "Run Instant Agent-to-Agent Test", "description": "Run an instant agent-to-agent test.", "tags": ["thousandeyes", "instant", "network", "agent-to-agent"], "examples": ["Run instant bidirectional test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "target_agent_id": {"type": "string"}, "agents": TEST_AGENTS_SCHEMA, "direction": {"type": "string", "enum": ["TO_TARGET", "FROM_TARGET", "BIDIRECTIONAL"], "default": "BIDIRECTIONAL"}}, "required": ["target_agent_id", "agents"]}},
    {"id": "instant_run_http_server", "name": "Run Instant HTTP Server Test", "description": "Run an instant HTTP server test.", "tags": ["thousandeyes", "instant", "web", "http-server"], "examples": ["Run instant HTTP test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "http_version": {"type": "integer", "enum": [1, 2], "default": 2}}, "required": ["url", "agents"]}},
    {"id": "instant_run_page_load", "name": "Run Instant Page Load Test", "description": "Run an instant page load test.", "tags": ["thousandeyes", "instant", "web", "page-load"], "examples": ["Run instant page load test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "agents": TEST_AGENTS_SCHEMA}, "required": ["url", "agents"]}},
    {"id": "instant_run_web_transactions", "name": "Run Instant Web Transaction Test", "description": "Run an instant web transaction test.", "tags": ["thousandeyes", "instant", "web", "web-transactions"], "examples": ["Run instant transaction test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "transaction_script": {"type": "string"}, "agents": TEST_AGENTS_SCHEMA}, "required": ["url", "transaction_script", "agents"]}},
    {"id": "instant_run_api", "name": "Run Instant API Test", "description": "Run an instant API test.", "tags": ["thousandeyes", "instant", "web", "api"], "examples": ["Run instant API test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "requests": {"type": "array", "items": {"type": "object"}}}, "required": ["url", "agents"]}},
    {"id": "instant_run_dns_server", "name": "Run Instant DNS Server Test", "description": "Run an instant DNS server test.", "tags": ["thousandeyes", "instant", "dns", "dns-server"], "examples": ["Run instant DNS test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "dns_servers": {"type": "array", "items": {"type": "object"}}, "record_type": {"type": "string", "default": "A"}, "agents": TEST_AGENTS_SCHEMA}, "required": ["domain", "dns_servers", "agents"]}},
    {"id": "instant_run_dns_trace", "name": "Run Instant DNS Trace Test", "description": "Run an instant DNS trace test.", "tags": ["thousandeyes", "instant", "dns", "dns-trace"], "examples": ["Run instant DNS trace"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "record_type": {"type": "string", "default": "A"}, "agents": TEST_AGENTS_SCHEMA}, "required": ["domain", "agents"]}},
    {"id": "instant_run_sip_server", "name": "Run Instant SIP Server Test", "description": "Run an instant SIP server test.", "tags": ["thousandeyes", "instant", "voice", "sip-server"], "examples": ["Run instant SIP test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "target_sip_credentials": {"type": "object", "properties": {"sipRegistrar": {"type": "string"}, "port": {"type": "integer"}, "protocol": {"type": "string"}, "user": {"type": "string"}}}, "agents": TEST_AGENTS_SCHEMA}, "required": ["target_sip_credentials", "agents"]}},
    {"id": "instant_run_voice", "name": "Run Instant Voice Test", "description": "Run an instant voice (RTP) test.", "tags": ["thousandeyes", "instant", "voice", "rtp"], "examples": ["Run instant voice test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "target_agent_id": {"type": "string"}, "agents": TEST_AGENTS_SCHEMA, "codec_id": {"type": "integer"}, "duration": {"type": "integer", "default": 5}}, "required": ["target_agent_id", "agents"]}},
    {"id": "instant_run_ftp_server", "name": "Run Instant FTP Server Test", "description": "Run an instant FTP server test.", "tags": ["thousandeyes", "instant", "ftp", "ftp-server"], "examples": ["Run instant FTP test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "username": {"type": "string"}, "password": {"type": "string"}, "request_type": {"type": "string", "enum": ["Download", "Upload", "List"], "default": "Download"}}, "required": ["url", "agents"]}},
    {"id": "instant_rerun_test", "name": "Rerun Existing Test", "description": "Rerun an existing test as an instant test.", "tags": ["thousandeyes", "instant", "rerun"], "examples": ["Rerun test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
]


class InstantTestsModule(ThousandEyesSkillModule):
    """Instant tests skill module for on-demand test execution."""

    MODULE_NAME = "instant_tests"
    MODULE_PREFIX = "instant_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in INSTANT_TEST_SKILLS]

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
        if skill_id == "instant_run_agent_to_server":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant Agent-to-Server"), "server": params.get("server"), "port": params.get("port", 443), "protocol": params.get("protocol", "TCP"), "agents": params.get("agents", [])}.items() if v is not None}
            r = await client.post("instant/agent-to-server", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_agent_to_agent":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant Agent-to-Agent"), "targetAgentId": params.get("target_agent_id"), "agents": params.get("agents", []), "direction": params.get("direction", "BIDIRECTIONAL")}.items() if v is not None}
            r = await client.post("instant/agent-to-agent", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_http_server":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant HTTP Server"), "url": params.get("url"), "agents": params.get("agents", []), "httpVersion": params.get("http_version", 2)}.items() if v is not None}
            r = await client.post("instant/http-server", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_page_load":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant Page Load"), "url": params.get("url"), "agents": params.get("agents", [])}.items() if v is not None}
            r = await client.post("instant/page-load", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_web_transactions":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant Web Transaction"), "url": params.get("url"), "transactionScript": params.get("transaction_script"), "agents": params.get("agents", [])}.items() if v is not None}
            r = await client.post("instant/web-transactions", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_api":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant API"), "url": params.get("url"), "agents": params.get("agents", []), "requests": params.get("requests")}.items() if v is not None}
            r = await client.post("instant/api", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_dns_server":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant DNS Server"), "domain": params.get("domain"), "dnsServers": params.get("dns_servers", []), "recordType": params.get("record_type", "A"), "agents": params.get("agents", [])}.items() if v is not None}
            r = await client.post("instant/dns-server", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_dns_trace":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant DNS Trace"), "domain": params.get("domain"), "recordType": params.get("record_type", "A"), "agents": params.get("agents", [])}.items() if v is not None}
            r = await client.post("instant/dns-trace", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_sip_server":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant SIP Server"), "targetSipCredentials": params.get("target_sip_credentials"), "agents": params.get("agents", [])}.items() if v is not None}
            r = await client.post("instant/sip-server", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_voice":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant Voice"), "targetAgentId": params.get("target_agent_id"), "agents": params.get("agents", []), "codecId": params.get("codec_id"), "duration": params.get("duration", 5)}.items() if v is not None}
            r = await client.post("instant/voice", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_run_ftp_server":
            payload = {k: v for k, v in {"testName": params.get("test_name", "Instant FTP Server"), "url": params.get("url"), "agents": params.get("agents", []), "username": params.get("username"), "password": params.get("password"), "requestType": params.get("request_type", "Download")}.items() if v is not None}
            r = await client.post("instant/ftp-server", payload)
            if r.get("success"):
                return success_result(data={"message": "Instant test started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        if skill_id == "instant_rerun_test":
            r = await client.post(f"instant/{params.get('test_id')}/rerun", {})
            if r.get("success"):
                return success_result(data={"message": "Test rerun started", "test": r.get("data", {})})
            return error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
