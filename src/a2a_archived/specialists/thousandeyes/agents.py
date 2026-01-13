"""ThousandEyes Agents skill module.

This module provides skills for managing Cloud and Enterprise agents.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    AGENT_ID_SCHEMA, TEST_ID_SCHEMA, RULE_ID_SCHEMA,
)

AGENTS_SKILLS: List[SkillDefinition] = [
    # Cloud & Enterprise Agents
    {"id": "agents_get_list", "name": "List Agents", "description": "Get all Cloud and Enterprise agents.", "tags": ["thousandeyes", "agents", "list"], "examples": ["List agents", "Show all agents"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}, "agent_type": {"type": "string", "enum": ["CLOUD", "ENTERPRISE", "ENTERPRISE_CLUSTER"]}}, "required": []}},
    {"id": "agents_get_by_id", "name": "Get Agent by ID", "description": "Get details of a specific agent.", "tags": ["thousandeyes", "agents", "details"], "examples": ["Get agent details"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA}, "required": ["agent_id"]}},
    {"id": "agents_update", "name": "Update Agent", "description": "Update an Enterprise agent's configuration.", "tags": ["thousandeyes", "agents", "update"], "examples": ["Update agent"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA, "agent_name": {"type": "string"}, "enabled": {"type": "boolean"}, "keep_browser_cache": {"type": "boolean"}, "target_for_tests": {"type": "string"}, "ip_addresses": {"type": "array", "items": {"type": "string"}}}, "required": ["agent_id"]}},
    {"id": "agents_delete", "name": "Delete Agent", "description": "Delete an Enterprise agent.", "tags": ["thousandeyes", "agents", "delete"], "examples": ["Delete agent"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA}, "required": ["agent_id"]}},

    # Cluster Management
    {"id": "agents_get_cluster_members", "name": "Get Cluster Members", "description": "Get members of an Enterprise agent cluster.", "tags": ["thousandeyes", "agents", "cluster", "members"], "examples": ["Get cluster members"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA}, "required": ["agent_id"]}},
    {"id": "agents_add_to_cluster", "name": "Add Agent to Cluster", "description": "Add an Enterprise agent to a cluster.", "tags": ["thousandeyes", "agents", "cluster", "add"], "examples": ["Add to cluster"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA, "cluster_id": {"type": "string", "description": "Target cluster ID"}}, "required": ["agent_id", "cluster_id"]}},
    {"id": "agents_remove_from_cluster", "name": "Remove Agent from Cluster", "description": "Remove an Enterprise agent from a cluster.", "tags": ["thousandeyes", "agents", "cluster", "remove"], "examples": ["Remove from cluster"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA}, "required": ["agent_id"]}},

    # Test Assignments
    {"id": "agents_get_test_assignments", "name": "Get Agent Test Assignments", "description": "Get tests assigned to an agent.", "tags": ["thousandeyes", "agents", "tests", "assignments"], "examples": ["Get agent tests"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA}, "required": ["agent_id"]}},
    {"id": "agents_assign_tests", "name": "Assign Tests to Agent", "description": "Assign tests to an Enterprise agent.", "tags": ["thousandeyes", "agents", "tests", "assign"], "examples": ["Assign tests"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA, "test_ids": {"type": "array", "items": {"type": "string"}, "description": "Test IDs to assign"}}, "required": ["agent_id", "test_ids"]}},
    {"id": "agents_unassign_tests", "name": "Unassign Tests from Agent", "description": "Unassign tests from an Enterprise agent.", "tags": ["thousandeyes", "agents", "tests", "unassign"], "examples": ["Unassign tests"], "input_schema": {"type": "object", "properties": {"agent_id": AGENT_ID_SCHEMA, "test_ids": {"type": "array", "items": {"type": "string"}, "description": "Test IDs to unassign"}}, "required": ["agent_id", "test_ids"]}},

    # Agent Configuration
    {"id": "agents_get_notification_rules", "name": "Get Agent Notification Rules", "description": "Get notification rules for agents.", "tags": ["thousandeyes", "agents", "notification", "rules", "list"], "examples": ["Get notification rules"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "agents_get_notification_rule", "name": "Get Agent Notification Rule", "description": "Get a specific notification rule.", "tags": ["thousandeyes", "agents", "notification", "rule", "details"], "examples": ["Get notification rule"], "input_schema": {"type": "object", "properties": {"rule_id": RULE_ID_SCHEMA}, "required": ["rule_id"]}},
    {"id": "agents_get_proxies", "name": "Get Agent Proxies", "description": "Get proxy configurations for agents.", "tags": ["thousandeyes", "agents", "proxy", "list"], "examples": ["Get agent proxies"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
]


class AgentsModule(ThousandEyesSkillModule):
    """Agents skill module for Cloud and Enterprise agent management."""

    MODULE_NAME = "agents"
    MODULE_PREFIX = "agents_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in AGENTS_SKILLS]

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
        # Cloud & Enterprise Agents
        if skill_id == "agents_get_list":
            qp = {k: v for k, v in {"aid": params.get("aid"), "agentTypes": params.get("agent_type")}.items() if v}
            r = await client.get("agents", qp)
            if r.get("success"):
                agents = r.get("data", {}).get("agents", [])
                return success_result(data={"agents": agents, "count": len(agents)})
            return error_result(r.get("error"))

        if skill_id == "agents_get_by_id":
            r = await client.get(f"agents/{params.get('agent_id')}")
            return success_result(data={"agent": r.get("data", {}).get("agents", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "agents_update":
            agent_id = params.pop("agent_id", None)
            payload = {k: v for k, v in {
                "agentName": params.get("agent_name"),
                "enabled": params.get("enabled"),
                "keepBrowserCache": params.get("keep_browser_cache"),
                "targetForTests": params.get("target_for_tests"),
                "ipAddresses": params.get("ip_addresses"),
            }.items() if v is not None}
            r = await client.put(f"agents/{agent_id}", payload)
            return success_result(data={"message": "Agent updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "agents_delete":
            r = await client.delete(f"agents/{params.get('agent_id')}")
            return success_result(data={"message": "Agent deleted"}) if r.get("success") else error_result(r.get("error"))

        # Cluster Management
        if skill_id == "agents_get_cluster_members":
            r = await client.get(f"agents/{params.get('agent_id')}/cluster")
            if r.get("success"):
                members = r.get("data", {}).get("agents", [])
                return success_result(data={"cluster_members": members, "count": len(members)})
            return error_result(r.get("error"))

        if skill_id == "agents_add_to_cluster":
            payload = {"clusterId": params.get("cluster_id")}
            r = await client.post(f"agents/{params.get('agent_id')}/cluster/assign", payload)
            return success_result(data={"message": "Agent added to cluster"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "agents_remove_from_cluster":
            r = await client.post(f"agents/{params.get('agent_id')}/cluster/unassign", {})
            return success_result(data={"message": "Agent removed from cluster"}) if r.get("success") else error_result(r.get("error"))

        # Test Assignments
        if skill_id == "agents_get_test_assignments":
            r = await client.get(f"agents/{params.get('agent_id')}/tests")
            if r.get("success"):
                tests = r.get("data", {}).get("tests", [])
                return success_result(data={"tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "agents_assign_tests":
            payload = {"tests": [{"testId": tid} for tid in params.get("test_ids", [])]}
            r = await client.post(f"agents/{params.get('agent_id')}/tests/assign", payload)
            return success_result(data={"message": "Tests assigned to agent"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "agents_unassign_tests":
            payload = {"tests": [{"testId": tid} for tid in params.get("test_ids", [])]}
            r = await client.post(f"agents/{params.get('agent_id')}/tests/unassign", payload)
            return success_result(data={"message": "Tests unassigned from agent"}) if r.get("success") else error_result(r.get("error"))

        # Agent Configuration
        if skill_id == "agents_get_notification_rules":
            r = await client.get("agents/notification-rules", {"aid": params.get("aid")})
            if r.get("success"):
                rules = r.get("data", {}).get("notificationRules", [])
                return success_result(data={"notification_rules": rules, "count": len(rules)})
            return error_result(r.get("error"))

        if skill_id == "agents_get_notification_rule":
            r = await client.get(f"agents/notification-rules/{params.get('rule_id')}")
            return success_result(data={"notification_rule": r.get("data", {}).get("notificationRules", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "agents_get_proxies":
            r = await client.get("agents/proxies", {"aid": params.get("aid")})
            if r.get("success"):
                proxies = r.get("data", {}).get("proxies", [])
                return success_result(data={"proxies": proxies, "count": len(proxies)})
            return error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
