"""Catalyst Center Topology skill module.

This module provides skills for network topology including:
- Site topology
- Physical topology
- Layer 2/3 topology
- VLAN topology

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!topology
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    CatalystSkillModule,
    CatalystAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    SITE_ID_SCHEMA,
    VLAN_ID_SCHEMA,
    TOPOLOGY_TYPE_SCHEMA,
)


# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

TOPOLOGY_SKILLS: List[SkillDefinition] = [
    {
        "id": "topology_get_site",
        "name": "Get Site Topology",
        "description": "Get the site hierarchy topology showing the relationship between sites.",
        "tags": ["catalyst", "topology", "sites", "hierarchy"],
        "examples": ["Show site topology", "Site hierarchy", "Site structure"],
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "id": "topology_get_physical",
        "name": "Get Physical Topology",
        "description": "Get the physical network topology showing device connections and links.",
        "tags": ["catalyst", "topology", "physical", "connections"],
        "examples": ["Physical topology", "Show network connections", "Device links"],
        "input_schema": {
            "type": "object",
            "properties": {
                "node_type": {"type": "string", "description": "Filter by node type"},
            },
            "required": [],
        },
    },
    {
        "id": "topology_get_l3",
        "name": "Get Layer 3 Topology",
        "description": "Get Layer 3 (routing) topology showing IP routing relationships.",
        "tags": ["catalyst", "topology", "l3", "routing"],
        "examples": ["L3 topology", "Routing topology", "Layer 3 map"],
        "input_schema": {
            "type": "object",
            "properties": {
                "topology_type": {
                    "type": "string",
                    "description": "L3 topology type",
                    "enum": ["OSPF", "EIGRP", "BGP", "ISIS"]
                },
            },
            "required": ["topology_type"],
        },
    },
    {
        "id": "topology_get_l2",
        "name": "Get Layer 2 Topology",
        "description": "Get Layer 2 (switching) topology for a specific VLAN.",
        "tags": ["catalyst", "topology", "l2", "switching", "vlan"],
        "examples": ["L2 topology", "VLAN topology", "Layer 2 map"],
        "input_schema": {
            "type": "object",
            "properties": {
                "vlan_id": {
                    **VLAN_ID_SCHEMA,
                    "description": "VLAN ID to get topology for"
                },
            },
            "required": ["vlan_id"],
        },
    },
    {
        "id": "topology_get_vlan_details",
        "name": "Get VLAN Topology Details",
        "description": "Get VLAN names and details for topology views.",
        "tags": ["catalyst", "topology", "vlans"],
        "examples": ["VLAN details", "List VLANs for topology"],
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "id": "topology_get_overall_health",
        "name": "Get Topology Network Health",
        "description": "Get network health information in context of topology.",
        "tags": ["catalyst", "topology", "health"],
        "examples": ["Topology health", "Network health map"],
        "input_schema": {
            "type": "object",
            "properties": {"timestamp": {"type": "integer", "description": "Epoch timestamp"}},
            "required": [],
        },
    },
    {
        "id": "topology_get_link_details",
        "name": "Get Link Details",
        "description": "Get detailed information about network links in topology.",
        "tags": ["catalyst", "topology", "links", "connections"],
        "examples": ["Link details", "Connection info"],
        "input_schema": {
            "type": "object",
            "properties": {
                "link_id": {"type": "string", "description": "Specific link ID"},
            },
            "required": [],
        },
    },
    {
        "id": "topology_refresh",
        "name": "Refresh Topology",
        "description": "Trigger a topology refresh to get updated network connections.",
        "tags": ["catalyst", "topology", "refresh", "update"],
        "examples": ["Refresh topology", "Update network map"],
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class TopologyModule(CatalystSkillModule):
    """Topology skills module."""

    MODULE_NAME = "topology"
    MODULE_PREFIX = "topology_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(skill_def) for skill_def in TOPOLOGY_SKILLS]

    @classmethod
    async def execute(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        log_skill_start(skill_id, params)
        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed to execute {skill_id}: {str(e)}")

    @classmethod
    async def _execute_skill(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        handlers = {
            "topology_get_site": cls._get_site,
            "topology_get_physical": cls._get_physical,
            "topology_get_l3": cls._get_l3,
            "topology_get_l2": cls._get_l2,
            "topology_get_vlan_details": cls._get_vlan_details,
            "topology_get_overall_health": cls._get_overall_health,
            "topology_get_link_details": cls._get_link_details,
            "topology_refresh": cls._refresh,
        }
        handler = handlers.get(skill_id)
        if handler:
            return await handler(client, params)
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _get_site(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        response = await client.get("topology/site-topology")
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get site topology"))
        data = response.get("data", {}).get("response", {})
        return success_result(data={"topology": data}, follow_up="Would you like to see physical topology?")

    @classmethod
    async def _get_physical(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {"nodeType": params.get("node_type")} if params.get("node_type") else {}
        response = await client.get("topology/physical-topology", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get physical topology"))
        data = response.get("data", {}).get("response", {})
        nodes = data.get("nodes", [])
        links = data.get("links", [])
        return success_result(data={"topology": data, "node_count": len(nodes), "link_count": len(links)})

    @classmethod
    async def _get_l3(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        topology_type = params.get("topology_type", "OSPF")
        response = await client.get(f"topology/l3/{topology_type}")
        if not response.get("success"):
            return error_result(response.get("error", f"Failed to get L3 {topology_type} topology"))
        data = response.get("data", {}).get("response", {})
        return success_result(data={"topology": data, "type": topology_type})

    @classmethod
    async def _get_l2(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        vlan_id = params.get("vlan_id")
        response = await client.get(f"topology/l2/{vlan_id}")
        if not response.get("success"):
            return error_result(response.get("error", f"Failed to get L2 topology for VLAN {vlan_id}"))
        data = response.get("data", {}).get("response", {})
        return success_result(data={"topology": data, "vlan_id": vlan_id})

    @classmethod
    async def _get_vlan_details(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        response = await client.get("topology/vlan/vlan-names")
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get VLAN details"))
        data = response.get("data", {}).get("response", [])
        return success_result(data={"vlans": data, "count": len(data)})

    @classmethod
    async def _get_overall_health(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {"timestamp": params.get("timestamp")} if params.get("timestamp") else {}
        response = await client.get("topology/network-health", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get topology health"))
        return success_result(data={"health": response.get("data", {}).get("response", {})})

    @classmethod
    async def _get_link_details(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        query_params = {"linkId": params.get("link_id")} if params.get("link_id") else {}
        response = await client.get("dna/topology/linkDetails", query_params)
        if not response.get("success"):
            return error_result(response.get("error", "Failed to get link details"))
        return success_result(data={"links": response.get("data", {}).get("response", [])})

    @classmethod
    async def _refresh(cls, client: CatalystAPIClient, params: Dict[str, Any]) -> SkillResult:
        response = await client.post("topology/refresh", {})
        if not response.get("success"):
            return error_result(response.get("error", "Failed to refresh topology"))
        data = response.get("data", {})
        if data.get("response", {}).get("taskId"):
            task_result = await client.get_task_result(data["response"]["taskId"])
            return success_result(data={"message": "Topology refresh completed", "result": task_result.get("data")})
        return success_result(data={"message": "Topology refresh initiated"})
