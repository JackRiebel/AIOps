"""ThousandEyes Network Tests skill module.

This module provides skills for network layer tests:
- Agent-to-Server tests
- Agent-to-Agent tests
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    TEST_ID_SCHEMA, TEST_NAME_SCHEMA, TEST_INTERVAL_SCHEMA, TEST_SERVER_SCHEMA, TEST_PORT_SCHEMA,
    TEST_PROTOCOL_SCHEMA, TEST_ENABLED_SCHEMA, TEST_AGENTS_SCHEMA, TEST_ALERT_RULES_SCHEMA,
)

NETWORK_TEST_SKILLS: List[SkillDefinition] = [
    # Agent-to-Server Tests
    {"id": "tests_get_agent_to_server_list", "name": "List Agent-to-Server Tests", "description": "Get all agent-to-server network tests.", "tags": ["thousandeyes", "tests", "network", "agent-to-server", "list"], "examples": ["List network tests", "Show agent-to-server tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string", "description": "Account group ID"}}, "required": []}},
    {"id": "tests_get_agent_to_server", "name": "Get Agent-to-Server Test", "description": "Get details of a specific agent-to-server test.", "tags": ["thousandeyes", "tests", "network", "agent-to-server", "details"], "examples": ["Get network test details"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_agent_to_server", "name": "Create Agent-to-Server Test", "description": "Create a new agent-to-server network test.", "tags": ["thousandeyes", "tests", "network", "agent-to-server", "create"], "examples": ["Create network test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "server": TEST_SERVER_SCHEMA, "port": TEST_PORT_SCHEMA, "protocol": TEST_PROTOCOL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "bandwidth_measurements": {"type": "boolean", "default": False}, "mtu_measurements": {"type": "boolean", "default": False}, "network_measurements": {"type": "boolean", "default": True}, "bgp_measurements": {"type": "boolean", "default": True}, "probe_mode": {"type": "string", "enum": ["AUTO", "SACK", "SYN"]}}, "required": ["test_name", "server", "agents"]}},
    {"id": "tests_update_agent_to_server", "name": "Update Agent-to-Server Test", "description": "Update an existing agent-to-server test.", "tags": ["thousandeyes", "tests", "network", "agent-to-server", "update"], "examples": ["Update network test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "server": TEST_SERVER_SCHEMA, "port": TEST_PORT_SCHEMA, "protocol": TEST_PROTOCOL_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "tests_delete_agent_to_server", "name": "Delete Agent-to-Server Test", "description": "Delete an agent-to-server test.", "tags": ["thousandeyes", "tests", "network", "agent-to-server", "delete"], "examples": ["Delete network test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},

    # Agent-to-Agent Tests
    {"id": "tests_get_agent_to_agent_list", "name": "List Agent-to-Agent Tests", "description": "Get all agent-to-agent bidirectional network tests.", "tags": ["thousandeyes", "tests", "network", "agent-to-agent", "list"], "examples": ["List bidirectional tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string", "description": "Account group ID"}}, "required": []}},
    {"id": "tests_get_agent_to_agent", "name": "Get Agent-to-Agent Test", "description": "Get details of a specific agent-to-agent test.", "tags": ["thousandeyes", "tests", "network", "agent-to-agent", "details"], "examples": ["Get bidirectional test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "tests_create_agent_to_agent", "name": "Create Agent-to-Agent Test", "description": "Create a new agent-to-agent bidirectional test.", "tags": ["thousandeyes", "tests", "network", "agent-to-agent", "create"], "examples": ["Create bidirectional test"], "input_schema": {"type": "object", "properties": {"test_name": TEST_NAME_SCHEMA, "target_agent_id": {"type": "string", "description": "Target agent ID"}, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}, "direction": {"type": "string", "enum": ["TO_TARGET", "FROM_TARGET", "BIDIRECTIONAL"], "default": "BIDIRECTIONAL"}, "dscp_id": {"type": "integer"}, "port": TEST_PORT_SCHEMA, "protocol": TEST_PROTOCOL_SCHEMA, "throughput_measurements": {"type": "boolean", "default": False}}, "required": ["test_name", "target_agent_id", "agents"]}},
    {"id": "tests_update_agent_to_agent", "name": "Update Agent-to-Agent Test", "description": "Update an existing agent-to-agent test.", "tags": ["thousandeyes", "tests", "network", "agent-to-agent", "update"], "examples": ["Update bidirectional test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "test_name": TEST_NAME_SCHEMA, "interval": TEST_INTERVAL_SCHEMA, "agents": TEST_AGENTS_SCHEMA, "alert_rules": TEST_ALERT_RULES_SCHEMA, "enabled": TEST_ENABLED_SCHEMA, "description": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "tests_delete_agent_to_agent", "name": "Delete Agent-to-Agent Test", "description": "Delete an agent-to-agent test.", "tags": ["thousandeyes", "tests", "network", "agent-to-agent", "delete"], "examples": ["Delete bidirectional test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
]


class NetworkTestsModule(ThousandEyesSkillModule):
    """Network tests skill module (agent-to-server, agent-to-agent)."""

    MODULE_NAME = "tests_network"
    MODULE_PREFIX = "tests_"

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        """Check if this module handles the given skill ID."""
        return skill_id in [s["id"] for s in NETWORK_TEST_SKILLS]

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in NETWORK_TEST_SKILLS]

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
        # Agent-to-Server Tests
        if skill_id == "tests_get_agent_to_server_list":
            r = await client.get("tests/agent-to-server", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_agent_to_server":
            r = await client.get(f"tests/agent-to-server/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_agent_to_server":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "server": params.get("server"),
                "port": params.get("port", 443),
                "protocol": params.get("protocol", "TCP"),
                "interval": params.get("interval", 300),
                "agents": params.get("agents", []),
                "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True),
                "description": params.get("description"),
                "bandwidthMeasurements": params.get("bandwidth_measurements", False),
                "mtuMeasurements": params.get("mtu_measurements", False),
                "networkMeasurements": params.get("network_measurements", True),
                "bgpMeasurements": params.get("bgp_measurements", True),
                "probeMode": params.get("probe_mode"),
            }.items() if v is not None}
            r = await client.post("tests/agent-to-server", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_agent_to_server":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "server": params.get("server"),
                "port": params.get("port"),
                "protocol": params.get("protocol"),
                "interval": params.get("interval"),
                "agents": params.get("agents"),
                "alertRules": params.get("alert_rules"),
                "enabled": params.get("enabled"),
                "description": params.get("description"),
            }.items() if v is not None}
            r = await client.put(f"tests/agent-to-server/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_agent_to_server":
            r = await client.delete(f"tests/agent-to-server/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        # Agent-to-Agent Tests
        if skill_id == "tests_get_agent_to_agent_list":
            r = await client.get("tests/agent-to-agent", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "tests_get_agent_to_agent":
            r = await client.get(f"tests/agent-to-agent/{params.get('test_id')}")
            return success_result(data={"test": r.get("data", {}).get("tests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_create_agent_to_agent":
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "targetAgentId": params.get("target_agent_id"),
                "interval": params.get("interval", 300),
                "agents": params.get("agents", []),
                "alertRules": params.get("alert_rules", []),
                "enabled": params.get("enabled", True),
                "description": params.get("description"),
                "direction": params.get("direction", "BIDIRECTIONAL"),
                "dscpId": params.get("dscp_id"),
                "port": params.get("port"),
                "protocol": params.get("protocol"),
                "throughputMeasurements": params.get("throughput_measurements", False),
            }.items() if v is not None}
            r = await client.post("tests/agent-to-agent", payload)
            if r.get("success"):
                test = r.get("data", {}).get("tests", [{}])[0] if isinstance(r.get("data", {}).get("tests"), list) else r.get("data", {})
                return success_result(data={"message": "Test created", "test": test})
            return error_result(r.get("error"))

        if skill_id == "tests_update_agent_to_agent":
            test_id = params.pop("test_id", None)
            payload = {k: v for k, v in {
                "testName": params.get("test_name"),
                "interval": params.get("interval"),
                "agents": params.get("agents"),
                "alertRules": params.get("alert_rules"),
                "enabled": params.get("enabled"),
                "description": params.get("description"),
            }.items() if v is not None}
            r = await client.put(f"tests/agent-to-agent/{test_id}", payload)
            return success_result(data={"message": "Test updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "tests_delete_agent_to_agent":
            r = await client.delete(f"tests/agent-to-agent/{params.get('test_id')}")
            return success_result(data={"message": "Test deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
