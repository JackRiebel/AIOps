"""ThousandEyes DNS Tests skill module.

This module provides skills for DNS tests:
- DNS Server tests
- DNS Trace tests
- DNSSEC tests
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    TEST_ID_SCHEMA, TEST_NAME_SCHEMA, TEST_INTERVAL_SCHEMA, TEST_ENABLED_SCHEMA,
    TEST_AGENTS_SCHEMA, TEST_ALERT_RULES_SCHEMA, DNS_DOMAIN_SCHEMA, DNS_SERVER_SCHEMA, DNS_RECORD_TYPE_SCHEMA,
)

DNS_TEST_SKILLS: List[SkillDefinition] = [
    # DNS Server Tests
    {"id": "tests_get_dns_server_list", "name": "List DNS Server Tests", "description": "Get all DNS server tests.", "tags": ["thousandeyes", "tests", "dns", "dns-server", "list"], "examples": ["List DNS tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_dns_server", "name": "Get DNS Server Test", "description": "Get details of a specific DNS server test.", "tags": ["thousandeyes", "tests", "dns", "dns-server", "details"], "examples": ["Get DNS test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_dns_server", "name": "Create DNS Server Test", "description": "Create a new DNS server test.", "tags": ["thousandeyes", "tests", "dns", "dns-server", "create"], "examples": ["Create DNS test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "dns_servers": {"type": "array", "items": {"type": "object", "properties": {"serverName": {"type": "string"}}}, "description": "DNS servers to query"}, "record_type": DNS_RECORD_TYPE_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "dns_query_class": {"type": "string", "enum": ["IN", "CH", "HS", "ANY"], "default": "IN"}, "recursion_desired": {"type": "boolean", "default": True}, "network_measurements": {"type": "boolean", "default": True}, "bgp_measurements": {"type": "boolean", "default": True}}, "required": ["test_name", "domain", "dns_servers", "agents"]}},
    {"id": "tests_update_dns_server", "name": "Update DNS Server Test", "description": "Update an existing DNS server test.", "tags": ["thousandeyes", "tests", "dns", "dns-server", "update"], "examples": ["Update DNS test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "dns_servers": {"type": "array", "items": {"type": "object"}}, "record_type": DNS_RECORD_TYPE_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_dns_server", "name": "Delete DNS Server Test", "description": "Delete a DNS server test.", "tags": ["thousandeyes", "tests", "dns", "dns-server", "delete"], "examples": ["Delete DNS test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # DNS Trace Tests
    {"id": "tests_get_dns_trace_list", "name": "List DNS Trace Tests", "description": "Get all DNS trace tests.", "tags": ["thousandeyes", "tests", "dns", "dns-trace", "list"], "examples": ["List DNS trace tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_dns_trace", "name": "Get DNS Trace Test", "description": "Get details of a specific DNS trace test.", "tags": ["thousandeyes", "tests", "dns", "dns-trace", "details"], "examples": ["Get DNS trace test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_dns_trace", "name": "Create DNS Trace Test", "description": "Create a new DNS trace test.", "tags": ["thousandeyes", "tests", "dns", "dns-trace", "create"], "examples": ["Create DNS trace test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "record_type": DNS_RECORD_TYPE_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "dns_query_class": {"type": "string", "enum": ["IN", "CH", "HS", "ANY"], "default": "IN"}}, "required": ["test_name", "domain", "agents"]}},
    {"id": "tests_update_dns_trace", "name": "Update DNS Trace Test", "description": "Update an existing DNS trace test.", "tags": ["thousandeyes", "tests", "dns", "dns-trace", "update"], "examples": ["Update DNS trace test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "record_type": DNS_RECORD_TYPE_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_dns_trace", "name": "Delete DNS Trace Test", "description": "Delete a DNS trace test.", "tags": ["thousandeyes", "tests", "dns", "dns-trace", "delete"], "examples": ["Delete DNS trace test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # DNSSEC Tests
    {"id": "tests_get_dnssec_list", "name": "List DNSSEC Tests", "description": "Get all DNSSEC validation tests.", "tags": ["thousandeyes", "tests", "dns", "dnssec", "list"], "examples": ["List DNSSEC tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_dnssec", "name": "Get DNSSEC Test", "description": "Get details of a specific DNSSEC test.", "tags": ["thousandeyes", "tests", "dns", "dnssec", "details"], "examples": ["Get DNSSEC test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_dnssec", "name": "Create DNSSEC Test", "description": "Create a new DNSSEC validation test.", "tags": ["thousandeyes", "tests", "dns", "dnssec", "create"], "examples": ["Create DNSSEC test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}}, "required": ["test_name", "domain", "agents"]}},
    {"id": "tests_update_dnssec", "name": "Update DNSSEC Test", "description": "Update an existing DNSSEC test.", "tags": ["thousandeyes", "tests", "dns", "dnssec", "update"], "examples": ["Update DNSSEC test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "domain": DNS_DOMAIN_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_dnssec", "name": "Delete DNSSEC Test", "description": "Delete a DNSSEC test.", "tags": ["thousandeyes", "tests", "dns", "dnssec", "delete"], "examples": ["Delete DNSSEC test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
]


class DNSTestsModule(ThousandEyesSkillModule):
    """DNS tests skill module (dns-server, dns-trace, dnssec)."""

    MODULE_NAME = "tests_dns"
    MODULE_PREFIX = "tests_"

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        return skill_id in [s["id"] for s in DNS_TEST_SKILLS]

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in DNS_TEST_SKILLS]

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
        # DNS Server Tests
        if skill_id == "tests_get_dns_server_list":
            r = await client.get("tests/dns-server", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_dns_server":
            r = await client.get(f"tests/dns-server/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_dns_server":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"), "domain": params.get("domain"),
                "dnsServers": params.get("dns_servers", []), "recordType": params.get("record_type", "A"),
                "interval": params.get("interval", 300), "agents": params.get("agents", []),
                "alertRules": params.get("alert_rules", []), "enabled": params.get("enabled", True),
                "description": params.get("description"), "dnsQueryClass": params.get("dns_query_class", "IN"),
                "recursionDesired": params.get("recursion_desired", True),
                "networkMeasurements": params.get("network_measurements", True),
                "bgpMeasurements": params.get("bgp_measurements", True),
            }.items() if v is not None}
            r = await client.post("tests/dns-server", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_dns_server":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "domain": params.get("domain"), "dnsServers": params.get("dns_servers"), "recordType": params.get("record_type"), "interval": params.get("interval"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/dns-server/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_dns_server":
            r = await client.delete(f"tests/dns-server/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # DNS Trace Tests
        if skill_id == "tests_get_dns_trace_list":
            r = await client.get("tests/dns-trace", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_dns_trace":
            r = await client.get(f"tests/dns-trace/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_dns_trace":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"), "domain": params.get("domain"),
                "recordType": params.get("record_type", "A"), "interval": params.get("interval", 300),
                "agents": params.get("agents", []), "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True), "description": params.get("description"),
                "dnsQueryClass": params.get("dns_query_class", "IN"),
            }.items() if v is not None}
            r = await client.post("tests/dns-trace", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_dns_trace":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "domain": params.get("domain"), "recordType": params.get("record_type"), "interval": params.get("interval"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/dns-trace/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_dns_trace":
            r = await client.delete(f"tests/dns-trace/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # DNSSEC Tests
        if skill_id == "tests_get_dnssec_list":
            r = await client.get("tests/dnssec", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_dnssec":
            r = await client.get(f"tests/dnssec/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_dnssec":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"), "domain": params.get("domain"),
                "interval": params.get("interval", 300), "agents": params.get("agents", []),
                "alertRules": params.get("alert_rules", []), "enabled": params.get("enabled", True),
                "description": params.get("description"),
            }.items() if v is not None}
            r = await client.post("tests/dnssec", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_dnssec":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "domain": params.get("domain"), "interval": params.get("interval"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/dnssec/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_dnssec":
            r = await client.delete(f"tests/dnssec/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
