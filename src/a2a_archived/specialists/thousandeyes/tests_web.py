"""ThousandEyes Web Tests skill module.

This module provides skills for web/HTTP tests:
- HTTP Server tests
- Page Load tests
- Web Transaction tests
- API tests
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    TEST_ID_SCHEMA, TEST_NAME_SCHEMA, TEST_INTERVAL_SCHEMA, TEST_URL_SCHEMA,
    TEST_ENABLED_SCHEMA, TEST_AGENTS_SCHEMA, TEST_ALERT_RULES_SCHEMA,
)

WEB_TEST_SKILLS: List[SkillDefinition] = [
    # HTTP Server Tests
    {"id": "tests_get_http_server_list", "name": "List HTTP Server Tests", "description": "Get all HTTP server tests.", "tags": ["thousandeyes", "tests", "web", "http-server", "list"], "examples": ["List HTTP tests", "Show HTTP server tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_http_server", "name": "Get HTTP Server Test", "description": "Get details of a specific HTTP server test.", "tags": ["thousandeyes", "tests", "web", "http-server", "details"], "examples": ["Get HTTP test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_http_server", "name": "Create HTTP Server Test", "description": "Create a new HTTP server test.", "tags": ["thousandeyes", "tests", "web", "http-server", "create"], "examples": ["Create HTTP test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "http_version": {"type": "integer", "enum": [1, 2], "default": 2}, "ssl_version_id": {"type": "integer"}, "verify_certificate": {"type": "boolean", "default": True}, "auth_type": {"type": "string", "enum": ["NONE", "BASIC", "NTLM", "KERBEROS"]}, "username": {"type": "string"}, "password": {"type": "string"}, "headers": {"type": "array", "items": {"type": "object"}}, "post_body": {"type": "string"}, "http_target_time": {"type": "integer"}, "http_time_limit": {"type": "integer"}, "network_measurements": {"type": "boolean", "default": True}, "bgp_measurements": {"type": "boolean", "default": True}, "mtu_measurements": {"type": "boolean", "default": False}}, "required": ["test_name", "url", "agents"]}},
    {"id": "tests_update_http_server", "name": "Update HTTP Server Test", "description": "Update an existing HTTP server test.", "tags": ["thousandeyes", "tests", "web", "http-server", "update"], "examples": ["Update HTTP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "tests_delete_http_server", "name": "Delete HTTP Server Test", "description": "Delete an HTTP server test.", "tags": ["thousandeyes", "tests", "web", "http-server", "delete"], "examples": ["Delete HTTP test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # Page Load Tests
    {"id": "tests_get_page_load_list", "name": "List Page Load Tests", "description": "Get all page load tests.", "tags": ["thousandeyes", "tests", "web", "page-load", "list"], "examples": ["List page load tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_page_load", "name": "Get Page Load Test", "description": "Get details of a specific page load test.", "tags": ["thousandeyes", "tests", "web", "page-load", "details"], "examples": ["Get page load test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_page_load", "name": "Create Page Load Test", "description": "Create a new page load test.", "tags": ["thousandeyes", "tests", "web", "page-load", "create"], "examples": ["Create page load test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "http_version": {"type": "integer", "enum": [1, 2]}, "page_load_target_time": {"type": "integer"}, "page_load_time_limit": {"type": "integer"}, "include_headers": {"type": "boolean"}, "emulated_device_id": {"type": "integer"}, "user_agent_id": {"type": "integer"}, "network_measurements": {"type": "boolean", "default": True}, "bgp_measurements": {"type": "boolean", "default": True}}, "required": ["test_name", "url", "agents"]}},
    {"id": "tests_update_page_load", "name": "Update Page Load Test", "description": "Update an existing page load test.", "tags": ["thousandeyes", "tests", "web", "page-load", "update"], "examples": ["Update page load test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_page_load", "name": "Delete Page Load Test", "description": "Delete a page load test.", "tags": ["thousandeyes", "tests", "web", "page-load", "delete"], "examples": ["Delete page load test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # Web Transaction Tests
    {"id": "tests_get_web_transactions_list", "name": "List Web Transaction Tests", "description": "Get all web transaction tests.", "tags": ["thousandeyes", "tests", "web", "web-transactions", "list"], "examples": ["List web transaction tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_web_transactions", "name": "Get Web Transaction Test", "description": "Get details of a specific web transaction test.", "tags": ["thousandeyes", "tests", "web", "web-transactions", "details"], "examples": ["Get web transaction test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_web_transactions", "name": "Create Web Transaction Test", "description": "Create a new web transaction test.", "tags": ["thousandeyes", "tests", "web", "web-transactions", "create"], "examples": ["Create web transaction test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "transaction_script": {"type": "string", "description": "Selenium script for the transaction"}, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "target_time": {"type": "integer"}, "time_limit": {"type": "integer"}, "emulated_device_id": {"type": "integer"}, "credentials": {"type": "array", "items": {"type": "object"}}, "network_measurements": {"type": "boolean", "default": True}}, "required": ["test_name", "url", "transaction_script", "agents"]}},
    {"id": "tests_update_web_transactions", "name": "Update Web Transaction Test", "description": "Update an existing web transaction test.", "tags": ["thousandeyes", "tests", "web", "web-transactions", "update"], "examples": ["Update web transaction test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "transaction_script": {"type": "string"}, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_web_transactions", "name": "Delete Web Transaction Test", "description": "Delete a web transaction test.", "tags": ["thousandeyes", "tests", "web", "web-transactions", "delete"], "examples": ["Delete web transaction test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # API Tests
    {"id": "tests_get_api_list", "name": "List API Tests", "description": "Get all API tests.", "tags": ["thousandeyes", "tests", "web", "api", "list"], "examples": ["List API tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "tests_get_api", "name": "Get API Test", "description": "Get details of a specific API test.", "tags": ["thousandeyes", "tests", "web", "api", "details"], "examples": ["Get API test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_api", "name": "Create API Test", "description": "Create a new API test.", "tags": ["thousandeyes", "tests", "web", "api", "create"], "examples": ["Create API test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "requests": {"type": "array", "items": {"type": "object", "properties": {"url": {"type": "string"}, "method": {"type": "string"}, "headers": {"type": "object"}, "body": {"type": "string"}}}, "description": "API request definitions"}, "target_time": {"type": "integer"}, "time_limit": {"type": "integer"}, "network_measurements": {"type": "boolean", "default": True}}, "required": ["test_name", "url", "agents"]}},
    {"id": "tests_update_api", "name": "Update API Test", "description": "Update an existing API test.", "tags": ["thousandeyes", "tests", "web", "api", "update"], "examples": ["Update API test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "url": TEST_URL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "enabled": TEST_ENABLED_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_delete_api", "name": "Delete API Test", "description": "Delete an API test.", "tags": ["thousandeyes", "tests", "web", "api", "delete"], "examples": ["Delete API test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
]


class WebTestsModule(ThousandEyesSkillModule):
    """Web tests skill module (http-server, page-load, web-transactions, api)."""

    MODULE_NAME = "tests_web"
    MODULE_PREFIX = "tests_"

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        return skill_id in [s["id"] for s in WEB_TEST_SKILLS]

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in WEB_TEST_SKILLS]

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
        # HTTP Server Tests
        if skill_id == "tests_get_http_server_list":
            r = await client.get("tests/http-server", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_http_server":
            r = await client.get(f"tests/http-server/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_http_server":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"), "url": params.get("url"), "interval": params.get("interval", 300),
                "agents": params.get("agents", []), "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True), "description": params.get("description"),
                "httpVersion": params.get("http_version", 2), "sslVersionId": params.get("ssl_version_id"),
                "verifyCertificate": params.get("verify_certificate", True), "authType": params.get("auth_type"),
                "username": params.get("username"), "password": params.get("password"),
                "headers": params.get("headers"), "postBody": params.get("post_body"),
                "httpTargetTime": params.get("http_target_time"), "httpTimeLimit": params.get("http_time_limit"),
                "networkMeasurements": params.get("network_measurements", True),
                "bgpMeasurements": params.get("bgp_measurements", True),
                "mtuMeasurements": params.get("mtu_measurements", False),
            }.items() if v is not None}
            r = await client.post("tests/http-server", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_http_server":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "url": params.get("url"), "interval": params.get("interval"), "agents": params.get("agents"), "alertRules": params.get("alert_rules"), "enabled": params.get("enabled"), "description": params.get("description")}.items() if v is not None}
            r = await client.put(f"tests/http-server/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_http_server":
            r = await client.delete(f"tests/http-server/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # Page Load Tests
        if skill_id == "tests_get_page_load_list":
            r = await client.get("tests/page-load", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_page_load":
            r = await client.get(f"tests/page-load/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_page_load":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"), "url": params.get("url"), "interval": params.get("interval", 300),
                "agents": params.get("agents", []), "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True), "description": params.get("description"),
                "httpVersion": params.get("http_version"), "pageLoadTargetTime": params.get("page_load_target_time"),
                "pageLoadTimeLimit": params.get("page_load_time_limit"), "includeHeaders": params.get("include_headers"),
                "emulatedDeviceId": params.get("emulated_device_id"), "userAgentId": params.get("user_agent_id"),
                "networkMeasurements": params.get("network_measurements", True),
                "bgpMeasurements": params.get("bgp_measurements", True),
            }.items() if v is not None}
            r = await client.post("tests/page-load", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_page_load":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "url": params.get("url"), "interval": params.get("interval"), "agents": params.get("agents"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/page-load/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_page_load":
            r = await client.delete(f"tests/page-load/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # Web Transaction Tests
        if skill_id == "tests_get_web_transactions_list":
            r = await client.get("tests/web-transactions", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_web_transactions":
            r = await client.get(f"tests/web-transactions/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_web_transactions":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"), "url": params.get("url"),
                "transactionScript": params.get("transaction_script"), "interval": params.get("interval", 300),
                "agents": params.get("agents", []), "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True), "description": params.get("description"),
                "targetTime": params.get("target_time"), "timeLimit": params.get("time_limit"),
                "emulatedDeviceId": params.get("emulated_device_id"), "credentials": params.get("credentials"),
                "networkMeasurements": params.get("network_measurements", True),
            }.items() if v is not None}
            r = await client.post("tests/web-transactions", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_web_transactions":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "url": params.get("url"), "transactionScript": params.get("transaction_script"), "interval": params.get("interval"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/web-transactions/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_web_transactions":
            r = await client.delete(f"tests/web-transactions/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # API Tests
        if skill_id == "tests_get_api_list":
            r = await client.get("tests/api", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_api":
            r = await client.get(f"tests/api/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_api":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"), "url": params.get("url"), "interval": params.get("interval", 300),
                "agents": params.get("agents", []), "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True), "description": params.get("description"),
                "requests": params.get("requests"), "targetTime": params.get("target_time"),
                "timeLimit": params.get("time_limit"), "networkMeasurements": params.get("network_measurements", True),
            }.items() if v is not None}
            r = await client.post("tests/api", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_api":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {"testName": params.get("test_name"), "url": params.get("url"), "interval": params.get("interval"), "enabled": params.get("enabled")}.items() if v is not None}
            r = await client.put(f"tests/api/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_api":
            r = await client.delete(f"tests/api/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
