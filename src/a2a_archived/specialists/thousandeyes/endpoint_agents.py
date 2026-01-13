"""ThousandEyes Endpoint Agents skill module.

This module provides skills for managing endpoint agents and their tests.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    ENDPOINT_AGENT_ID_SCHEMA, TEST_ID_SCHEMA, START_DATE_SCHEMA, END_DATE_SCHEMA, WINDOW_SCHEMA,
)

ENDPOINT_AGENTS_SKILLS: List[SkillDefinition] = [
    # Endpoint Agents
    {"id": "endpoint_get_agents", "name": "List Endpoint Agents", "description": "Get all endpoint agents.", "tags": ["thousandeyes", "endpoint", "agents", "list"], "examples": ["List endpoint agents"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}, "computer_name": {"type": "string"}, "platform": {"type": "string", "enum": ["MAC", "WINDOWS"]}, "agent_version": {"type": "string"}}, "required": []}},
    {"id": "endpoint_get_agent", "name": "Get Endpoint Agent", "description": "Get details of a specific endpoint agent.", "tags": ["thousandeyes", "endpoint", "agent", "details"], "examples": ["Get endpoint agent"], "input_schema": {"type": "object", "properties": {"agent_id": ENDPOINT_AGENT_ID_SCHEMA}, "required": ["agent_id"]}},
    {"id": "endpoint_update_agent", "name": "Update Endpoint Agent", "description": "Update an endpoint agent's configuration.", "tags": ["thousandeyes", "endpoint", "agent", "update"], "examples": ["Update endpoint agent"], "input_schema": {"type": "object", "properties": {"agent_id": ENDPOINT_AGENT_ID_SCHEMA, "name": {"type": "string"}, "labels": {"type": "array", "items": {"type": "string"}}}, "required": ["agent_id"]}},
    {"id": "endpoint_delete_agent", "name": "Delete Endpoint Agent", "description": "Delete an endpoint agent.", "tags": ["thousandeyes", "endpoint", "agent", "delete"], "examples": ["Delete endpoint agent"], "input_schema": {"type": "object", "properties": {"agent_id": ENDPOINT_AGENT_ID_SCHEMA}, "required": ["agent_id"]}},
    {"id": "endpoint_get_agent_labels", "name": "Get Endpoint Agent Labels", "description": "Get labels assigned to an endpoint agent.", "tags": ["thousandeyes", "endpoint", "agent", "labels"], "examples": ["Get agent labels"], "input_schema": {"type": "object", "properties": {"agent_id": ENDPOINT_AGENT_ID_SCHEMA}, "required": ["agent_id"]}},

    # Endpoint Tests
    {"id": "endpoint_get_tests", "name": "List Endpoint Tests", "description": "Get all endpoint scheduled tests.", "tags": ["thousandeyes", "endpoint", "tests", "list"], "examples": ["List endpoint tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}, "test_type": {"type": "string", "enum": ["http-server", "agent-to-server"]}}, "required": []}},
    {"id": "endpoint_get_test", "name": "Get Endpoint Test", "description": "Get details of a specific endpoint test.", "tags": ["thousandeyes", "endpoint", "test", "details"], "examples": ["Get endpoint test"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA}, "required": ["test_id"]}},
    {"id": "endpoint_get_scheduled_tests", "name": "Get Scheduled Tests", "description": "Get endpoint scheduled tests.", "tags": ["thousandeyes", "endpoint", "tests", "scheduled"], "examples": ["Get scheduled tests"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "endpoint_get_test_results", "name": "Get Endpoint Test Results", "description": "Get results for an endpoint test.", "tags": ["thousandeyes", "endpoint", "results"], "examples": ["Get endpoint results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": ENDPOINT_AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},

    # Network Topology
    {"id": "endpoint_get_network_topology", "name": "Get Endpoint Network Topology", "description": "Get network topology data for endpoints.", "tags": ["thousandeyes", "endpoint", "topology", "network"], "examples": ["Get network topology"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA}, "required": []}},
    {"id": "endpoint_get_network_topology_details", "name": "Get Endpoint Network Topology Details", "description": "Get detailed network topology for a specific endpoint.", "tags": ["thousandeyes", "endpoint", "topology", "details"], "examples": ["Get topology details"], "input_schema": {"type": "object", "properties": {"agent_id": ENDPOINT_AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["agent_id"]}},
]


class EndpointAgentsModule(ThousandEyesSkillModule):
    """Endpoint agents skill module for endpoint monitoring."""

    MODULE_NAME = "endpoint_agents"
    MODULE_PREFIX = "endpoint_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in ENDPOINT_AGENTS_SKILLS]

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
        # Endpoint Agents
        if skill_id == "endpoint_get_agents":
            qp = {k: v for k, v in {"aid": params.get("aid"), "computerName": params.get("computer_name"), "platform": params.get("platform"), "agentVersion": params.get("agent_version")}.items() if v}
            r = await client.get("endpoint/agents", qp)
            if r.get("success"):
                agents = r.get("data", {}).get("endpointAgents", [])
                return success_result(data={"endpoint_agents": agents, "count": len(agents)})
            return error_result(r.get("error"))

        if skill_id == "endpoint_get_agent":
            r = await client.get(f"endpoint/agents/{params.get('agent_id')}")
            return success_result(data={"endpoint_agent": r.get("data", {}).get("endpointAgents", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "endpoint_update_agent":
            agent_id = params.pop("agent_id", None)
            payload = {k: v for k, v in {"name": params.get("name"), "labels": params.get("labels")}.items() if v is not None}
            r = await client.put(f"endpoint/agents/{agent_id}", payload)
            return success_result(data={"message": "Endpoint agent updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "endpoint_delete_agent":
            r = await client.delete(f"endpoint/agents/{params.get('agent_id')}")
            return success_result(data={"message": "Endpoint agent deleted"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "endpoint_get_agent_labels":
            r = await client.get(f"endpoint/agents/{params.get('agent_id')}/labels")
            if r.get("success"):
                labels = r.get("data", {}).get("labels", [])
                return success_result(data={"labels": labels, "count": len(labels)})
            return error_result(r.get("error"))

        # Endpoint Tests
        if skill_id == "endpoint_get_tests":
            qp = {k: v for k, v in {"aid": params.get("aid"), "testType": params.get("test_type")}.items() if v}
            r = await client.get("endpoint/tests", qp)
            if r.get("success"):
                tests = r.get("data", {}).get("endpointTests", [])
                return success_result(data={"endpoint_tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "endpoint_get_test":
            r = await client.get(f"endpoint/tests/{params.get('test_id')}")
            return success_result(data={"endpoint_test": r.get("data", {}).get("endpointTests", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "endpoint_get_scheduled_tests":
            r = await client.get("endpoint/tests/scheduled-tests", {"aid": params.get("aid")})
            if r.get("success"):
                tests = r.get("data", {}).get("scheduledTests", [])
                return success_result(data={"scheduled_tests": tests, "count": len(tests)})
            return error_result(r.get("error"))

        if skill_id == "endpoint_get_test_results":
            qp = {k: v for k, v in {"agentId": params.get("agent_id"), "window": params.get("window"), "from": params.get("start_date"), "to": params.get("end_date"), "aid": params.get("aid")}.items() if v}
            r = await client.get(f"endpoint/test-results/{params.get('test_id')}", qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        # Network Topology
        if skill_id == "endpoint_get_network_topology":
            qp = {k: v for k, v in {"aid": params.get("aid"), "window": params.get("window"), "from": params.get("start_date"), "to": params.get("end_date")}.items() if v}
            r = await client.get("endpoint/network-topology", qp)
            if r.get("success"):
                topology = r.get("data", {}).get("networkTopology", [])
                return success_result(data={"network_topology": topology, "count": len(topology)})
            return error_result(r.get("error"))

        if skill_id == "endpoint_get_network_topology_details":
            qp = {k: v for k, v in {"window": params.get("window"), "from": params.get("start_date"), "to": params.get("end_date"), "aid": params.get("aid")}.items() if v}
            r = await client.get(f"endpoint/network-topology/{params.get('agent_id')}", qp)
            return success_result(data={"network_topology": r.get("data", {}).get("networkTopology", {})}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
