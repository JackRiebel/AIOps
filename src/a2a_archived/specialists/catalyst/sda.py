"""Catalyst Center SD-Access (SDA) skill module.

This module provides skills for SD-Access fabric management including:
- Fabric sites and zones
- Border and edge devices
- Control plane devices
- Virtual networks
- Authentication profiles
- Port assignments
"""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    SITE_ID_SCHEMA, DEVICE_ID_SCHEMA,
)

SDA_SKILLS: List[SkillDefinition] = [
    # Fabric Sites
    {"id": "sda_get_fabric_sites", "name": "Get Fabric Sites", "description": "Get SD-Access fabric sites.", "tags": ["catalyst", "sda", "fabric", "sites"], "examples": ["List fabric sites"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}}, "required": []}},
    {"id": "sda_add_fabric_site", "name": "Add Fabric Site", "description": "Add a site to SD-Access fabric.", "tags": ["catalyst", "sda", "fabric", "site", "add"], "examples": ["Add fabric site"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "fabric_name": {"type": "string"}, "fabric_type": {"type": "string", "enum": ["FABRIC_SITE", "FABRIC_ZONE"]}}, "required": ["site_name_hierarchy"]}},
    {"id": "sda_delete_fabric_site", "name": "Delete Fabric Site", "description": "Remove a site from SD-Access fabric.", "tags": ["catalyst", "sda", "fabric", "site", "delete"], "examples": ["Remove fabric site"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    # Fabric Zones
    {"id": "sda_get_fabric_zones", "name": "Get Fabric Zones", "description": "Get SD-Access fabric zones.", "tags": ["catalyst", "sda", "fabric", "zones"], "examples": ["List fabric zones"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}}, "required": []}},
    {"id": "sda_add_fabric_zone", "name": "Add Fabric Zone", "description": "Add a fabric zone to a site.", "tags": ["catalyst", "sda", "fabric", "zone", "add"], "examples": ["Add fabric zone"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "authentication_profile_name": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    {"id": "sda_update_fabric_zone", "name": "Update Fabric Zone", "description": "Update a fabric zone.", "tags": ["catalyst", "sda", "fabric", "zone", "update"], "examples": ["Update fabric zone"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "authentication_profile_name": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    {"id": "sda_delete_fabric_zone", "name": "Delete Fabric Zone", "description": "Delete a fabric zone.", "tags": ["catalyst", "sda", "fabric", "zone", "delete"], "examples": ["Remove fabric zone"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    # Border Devices
    {"id": "sda_get_border_device", "name": "Get Border Device", "description": "Get SD-Access border device details.", "tags": ["catalyst", "sda", "border", "device"], "examples": ["Get border device"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}, "sda_border_device": {"type": "string"}}, "required": []}},
    {"id": "sda_add_border_device", "name": "Add Border Device", "description": "Add a border device to fabric.", "tags": ["catalyst", "sda", "border", "device", "add"], "examples": ["Add border device"], "input_schema": {"type": "object", "properties": {"device_management_ip_address": {"type": "string"}, "site_name_hierarchy": {"type": "string"}, "external_domain_routing_protocol_name": {"type": "string", "enum": ["BGP", "OSPF"]}, "external_connectivity_ip_pool_name": {"type": "string"}, "internal_autonomus_system_number": {"type": "string"}, "border_session_type": {"type": "string", "enum": ["ANYWHERE", "EXTERNAL"]}, "connected_to_internet": {"type": "boolean"}, "external_connectivity_settings": {"type": "array", "items": {"type": "object"}}}, "required": ["device_management_ip_address", "site_name_hierarchy"]}},
    {"id": "sda_delete_border_device", "name": "Delete Border Device", "description": "Remove a border device from fabric.", "tags": ["catalyst", "sda", "border", "device", "delete"], "examples": ["Remove border device"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}}, "required": ["device_ip_address"]}},
    # Edge Devices
    {"id": "sda_get_edge_device", "name": "Get Edge Device", "description": "Get SD-Access edge device details.", "tags": ["catalyst", "sda", "edge", "device"], "examples": ["Get edge device"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}}, "required": ["device_ip_address"]}},
    {"id": "sda_add_edge_device", "name": "Add Edge Device", "description": "Add an edge device to fabric.", "tags": ["catalyst", "sda", "edge", "device", "add"], "examples": ["Add edge device"], "input_schema": {"type": "object", "properties": {"device_management_ip_address": {"type": "string"}, "site_name_hierarchy": {"type": "string"}}, "required": ["device_management_ip_address", "site_name_hierarchy"]}},
    {"id": "sda_delete_edge_device", "name": "Delete Edge Device", "description": "Remove an edge device from fabric.", "tags": ["catalyst", "sda", "edge", "device", "delete"], "examples": ["Remove edge device"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}}, "required": ["device_ip_address"]}},
    # Control Plane Devices
    {"id": "sda_get_control_plane", "name": "Get Control Plane Device", "description": "Get SD-Access control plane device.", "tags": ["catalyst", "sda", "control", "plane"], "examples": ["Get control plane"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}}, "required": ["device_ip_address"]}},
    {"id": "sda_add_control_plane", "name": "Add Control Plane Device", "description": "Add a control plane device to fabric.", "tags": ["catalyst", "sda", "control", "plane", "add"], "examples": ["Add control plane"], "input_schema": {"type": "object", "properties": {"device_management_ip_address": {"type": "string"}, "site_name_hierarchy": {"type": "string"}, "route_distribution_protocol": {"type": "string", "enum": ["LISP_PUB_SUB", "LISP_BGP"]}}, "required": ["device_management_ip_address", "site_name_hierarchy"]}},
    {"id": "sda_delete_control_plane", "name": "Delete Control Plane Device", "description": "Remove a control plane device.", "tags": ["catalyst", "sda", "control", "plane", "delete"], "examples": ["Remove control plane"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}}, "required": ["device_ip_address"]}},
    # Virtual Networks
    {"id": "sda_get_virtual_network", "name": "Get Virtual Network", "description": "Get SD-Access virtual network.", "tags": ["catalyst", "sda", "virtual", "network"], "examples": ["Get VN", "Show virtual network"], "input_schema": {"type": "object", "properties": {"virtual_network_name": {"type": "string"}, "site_name_hierarchy": {"type": "string"}}, "required": []}},
    {"id": "sda_add_virtual_network", "name": "Add Virtual Network", "description": "Create a virtual network in fabric.", "tags": ["catalyst", "sda", "virtual", "network", "add"], "examples": ["Create VN"], "input_schema": {"type": "object", "properties": {"virtual_network_name": {"type": "string"}, "site_name_hierarchy": {"type": "string"}}, "required": ["virtual_network_name", "site_name_hierarchy"]}},
    {"id": "sda_delete_virtual_network", "name": "Delete Virtual Network", "description": "Delete a virtual network.", "tags": ["catalyst", "sda", "virtual", "network", "delete"], "examples": ["Delete VN"], "input_schema": {"type": "object", "properties": {"virtual_network_name": {"type": "string"}, "site_name_hierarchy": {"type": "string"}}, "required": ["virtual_network_name", "site_name_hierarchy"]}},
    # IP Pools in VN
    {"id": "sda_get_ip_pool", "name": "Get VN IP Pool", "description": "Get IP pool in virtual network.", "tags": ["catalyst", "sda", "ip", "pool"], "examples": ["Get VN IP pool"], "input_schema": {"type": "object", "properties": {"virtual_network_name": {"type": "string"}, "ip_pool_name": {"type": "string"}, "site_name_hierarchy": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    {"id": "sda_add_ip_pool", "name": "Add VN IP Pool", "description": "Add IP pool to virtual network.", "tags": ["catalyst", "sda", "ip", "pool", "add"], "examples": ["Add VN IP pool"], "input_schema": {"type": "object", "properties": {"virtual_network_name": {"type": "string"}, "ip_pool_name": {"type": "string"}, "site_name_hierarchy": {"type": "string"}, "traffic_type": {"type": "string", "enum": ["Data", "Voice"]}, "authentication_policy_name": {"type": "string"}, "scalable_group_name": {"type": "string"}, "is_l2_flooding_enabled": {"type": "boolean"}, "is_this_critical_pool": {"type": "boolean"}, "pool_type": {"type": "string", "enum": ["AP", "Extended"]}}, "required": ["virtual_network_name", "ip_pool_name", "site_name_hierarchy"]}},
    {"id": "sda_delete_ip_pool", "name": "Delete VN IP Pool", "description": "Delete IP pool from virtual network.", "tags": ["catalyst", "sda", "ip", "pool", "delete"], "examples": ["Delete VN IP pool"], "input_schema": {"type": "object", "properties": {"virtual_network_name": {"type": "string"}, "ip_pool_name": {"type": "string"}, "site_name_hierarchy": {"type": "string"}}, "required": ["virtual_network_name", "ip_pool_name", "site_name_hierarchy"]}},
    # Authentication Profiles
    {"id": "sda_get_auth_profile", "name": "Get Authentication Profile", "description": "Get SD-Access authentication profile.", "tags": ["catalyst", "sda", "auth", "profile"], "examples": ["Get auth profile"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "authenticate_template_name": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    {"id": "sda_add_auth_profile", "name": "Add Authentication Profile", "description": "Add authentication profile to site.", "tags": ["catalyst", "sda", "auth", "profile", "add"], "examples": ["Add auth profile"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "authenticate_template_name": {"type": "string", "enum": ["No Authentication", "Open Authentication", "Closed Authentication", "Low Impact"]}, "authentication_order": {"type": "string", "enum": ["dot1x", "mac"]}, "dot1x_to_mab_fallback_timeout": {"type": "integer"}, "wake_on_lan": {"type": "boolean"}, "number_of_hosts": {"type": "string", "enum": ["Single", "Unlimited"]}}, "required": ["site_name_hierarchy", "authenticate_template_name"]}},
    {"id": "sda_update_auth_profile", "name": "Update Authentication Profile", "description": "Update authentication profile.", "tags": ["catalyst", "sda", "auth", "profile", "update"], "examples": ["Update auth profile"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "authenticate_template_name": {"type": "string"}, "authentication_order": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    {"id": "sda_delete_auth_profile", "name": "Delete Authentication Profile", "description": "Delete authentication profile.", "tags": ["catalyst", "sda", "auth", "profile", "delete"], "examples": ["Delete auth profile"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}}, "required": ["site_name_hierarchy"]}},
    # Port Assignments for AP
    {"id": "sda_get_port_assignment", "name": "Get AP Port Assignment", "description": "Get port assignment for access point.", "tags": ["catalyst", "sda", "port", "ap"], "examples": ["Get AP port"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}, "interface_name": {"type": "string"}}, "required": ["device_ip_address", "interface_name"]}},
    {"id": "sda_add_port_assignment", "name": "Add AP Port Assignment", "description": "Assign port for access point.", "tags": ["catalyst", "sda", "port", "ap", "add"], "examples": ["Assign AP port"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "device_management_ip_address": {"type": "string"}, "interface_name": {"type": "string"}, "data_ip_address_pool_name": {"type": "string"}, "authenticate_template_name": {"type": "string"}, "interface_description": {"type": "string"}}, "required": ["site_name_hierarchy", "device_management_ip_address", "interface_name"]}},
    {"id": "sda_delete_port_assignment", "name": "Delete AP Port Assignment", "description": "Remove port assignment for AP.", "tags": ["catalyst", "sda", "port", "ap", "delete"], "examples": ["Remove AP port"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}, "interface_name": {"type": "string"}}, "required": ["device_ip_address", "interface_name"]}},
    # Port Assignments for User Devices
    {"id": "sda_get_user_device_port", "name": "Get User Device Port", "description": "Get port assignment for user device.", "tags": ["catalyst", "sda", "port", "user"], "examples": ["Get user port"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}, "interface_name": {"type": "string"}}, "required": ["device_ip_address", "interface_name"]}},
    {"id": "sda_add_user_device_port", "name": "Add User Device Port", "description": "Assign port for user device.", "tags": ["catalyst", "sda", "port", "user", "add"], "examples": ["Assign user port"], "input_schema": {"type": "object", "properties": {"site_name_hierarchy": {"type": "string"}, "device_management_ip_address": {"type": "string"}, "interface_name": {"type": "string"}, "data_ip_address_pool_name": {"type": "string"}, "voice_ip_address_pool_name": {"type": "string"}, "authenticate_template_name": {"type": "string"}, "scalable_group_name": {"type": "string"}, "interface_description": {"type": "string"}}, "required": ["site_name_hierarchy", "device_management_ip_address", "interface_name"]}},
    {"id": "sda_delete_user_device_port", "name": "Delete User Device Port", "description": "Remove port assignment for user device.", "tags": ["catalyst", "sda", "port", "user", "delete"], "examples": ["Remove user port"], "input_schema": {"type": "object", "properties": {"device_ip_address": {"type": "string"}, "interface_name": {"type": "string"}}, "required": ["device_ip_address", "interface_name"]}},
]

class SDAModule(CatalystSkillModule):
    MODULE_NAME = "sda"
    MODULE_PREFIX = "sda_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in SDA_SKILLS]

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
        base = "business/sda"
        # Fabric Sites
        if skill_id == "sda_get_fabric_sites":
            qp = {"siteNameHierarchy": params.get("site_name_hierarchy")} if params.get("site_name_hierarchy") else {}
            r = await client.get(f"{base}/fabric-site", qp)
            return success_result(data={"fabric_sites": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_fabric_site":
            payload = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "fabricName": params.get("fabric_name"), "fabricType": params.get("fabric_type", "FABRIC_SITE")}.items() if v}
            r = await client.post(f"{base}/fabric-site", payload)
            return success_result(data={"message": "Fabric site added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_fabric_site":
            r = await client.delete(f"{base}/fabric-site", {"siteNameHierarchy": params.get("site_name_hierarchy")})
            return success_result(data={"message": "Fabric site deleted"}) if r.get("success") else error_result(r.get("error"))
        # Fabric Zones
        if skill_id == "sda_get_fabric_zones":
            qp = {"siteNameHierarchy": params.get("site_name_hierarchy")} if params.get("site_name_hierarchy") else {}
            r = await client.get(f"{base}/fabric-zone", qp)
            return success_result(data={"fabric_zones": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_fabric_zone":
            payload = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "authenticationProfileName": params.get("authentication_profile_name")}.items() if v}
            r = await client.post(f"{base}/fabric-zone", payload)
            return success_result(data={"message": "Fabric zone added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_update_fabric_zone":
            payload = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "authenticationProfileName": params.get("authentication_profile_name")}.items() if v}
            r = await client.put(f"{base}/fabric-zone", payload)
            return success_result(data={"message": "Fabric zone updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_fabric_zone":
            r = await client.delete(f"{base}/fabric-zone", {"siteNameHierarchy": params.get("site_name_hierarchy")})
            return success_result(data={"message": "Fabric zone deleted"}) if r.get("success") else error_result(r.get("error"))
        # Border Devices
        if skill_id == "sda_get_border_device":
            qp = {k: v for k, v in {"deviceIPAddress": params.get("device_ip_address"), "sdaBorderDevice": params.get("sda_border_device")}.items() if v}
            r = await client.get(f"{base}/border-device", qp)
            return success_result(data={"border_device": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_border_device":
            payload = [{k: v for k, v in {"deviceManagementIpAddress": params.get("device_management_ip_address"), "siteNameHierarchy": params.get("site_name_hierarchy"), "externalDomainRoutingProtocolName": params.get("external_domain_routing_protocol_name"), "externalConnectivityIpPoolName": params.get("external_connectivity_ip_pool_name"), "internalAutonomusSystemNumber": params.get("internal_autonomus_system_number"), "borderSessionType": params.get("border_session_type"), "connectedToInternet": params.get("connected_to_internet"), "externalConnectivitySettings": params.get("external_connectivity_settings", [])}.items() if v is not None}]
            r = await client.post(f"{base}/border-device", payload)
            return success_result(data={"message": "Border device added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_border_device":
            r = await client.delete(f"{base}/border-device", {"deviceIPAddress": params.get("device_ip_address")})
            return success_result(data={"message": "Border device deleted"}) if r.get("success") else error_result(r.get("error"))
        # Edge Devices
        if skill_id == "sda_get_edge_device":
            r = await client.get(f"{base}/edge-device", {"deviceIPAddress": params.get("device_ip_address")})
            return success_result(data={"edge_device": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_edge_device":
            payload = {"deviceManagementIpAddress": params.get("device_management_ip_address"), "siteNameHierarchy": params.get("site_name_hierarchy")}
            r = await client.post(f"{base}/edge-device", payload)
            return success_result(data={"message": "Edge device added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_edge_device":
            r = await client.delete(f"{base}/edge-device", {"deviceIPAddress": params.get("device_ip_address")})
            return success_result(data={"message": "Edge device deleted"}) if r.get("success") else error_result(r.get("error"))
        # Control Plane Devices
        if skill_id == "sda_get_control_plane":
            r = await client.get(f"{base}/control-plane-device", {"deviceIPAddress": params.get("device_ip_address")})
            return success_result(data={"control_plane": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_control_plane":
            payload = {k: v for k, v in {"deviceManagementIpAddress": params.get("device_management_ip_address"), "siteNameHierarchy": params.get("site_name_hierarchy"), "routeDistributionProtocol": params.get("route_distribution_protocol")}.items() if v}
            r = await client.post(f"{base}/control-plane-device", payload)
            return success_result(data={"message": "Control plane added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_control_plane":
            r = await client.delete(f"{base}/control-plane-device", {"deviceIPAddress": params.get("device_ip_address")})
            return success_result(data={"message": "Control plane deleted"}) if r.get("success") else error_result(r.get("error"))
        # Virtual Networks
        if skill_id == "sda_get_virtual_network":
            qp = {k: v for k, v in {"virtualNetworkName": params.get("virtual_network_name"), "siteNameHierarchy": params.get("site_name_hierarchy")}.items() if v}
            r = await client.get(f"{base}/virtual-network", qp)
            return success_result(data={"virtual_network": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_virtual_network":
            payload = {"virtualNetworkName": params.get("virtual_network_name"), "siteNameHierarchy": params.get("site_name_hierarchy")}
            r = await client.post(f"{base}/virtual-network", payload)
            return success_result(data={"message": "Virtual network added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_virtual_network":
            r = await client.delete(f"{base}/virtual-network", {"virtualNetworkName": params.get("virtual_network_name"), "siteNameHierarchy": params.get("site_name_hierarchy")})
            return success_result(data={"message": "Virtual network deleted"}) if r.get("success") else error_result(r.get("error"))
        # IP Pools in VN
        if skill_id == "sda_get_ip_pool":
            qp = {k: v for k, v in {"virtualNetworkName": params.get("virtual_network_name"), "ipPoolName": params.get("ip_pool_name"), "siteNameHierarchy": params.get("site_name_hierarchy")}.items() if v}
            r = await client.get(f"{base}/virtualnetwork/ippool", qp)
            return success_result(data={"ip_pool": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_ip_pool":
            payload = {k: v for k, v in {"virtualNetworkName": params.get("virtual_network_name"), "ipPoolName": params.get("ip_pool_name"), "siteNameHierarchy": params.get("site_name_hierarchy"), "trafficType": params.get("traffic_type"), "authenticationPolicyName": params.get("authentication_policy_name"), "scalableGroupName": params.get("scalable_group_name"), "isL2FloodingEnabled": params.get("is_l2_flooding_enabled"), "isThisCriticalPool": params.get("is_this_critical_pool"), "poolType": params.get("pool_type")}.items() if v is not None}
            r = await client.post(f"{base}/virtualnetwork/ippool", payload)
            return success_result(data={"message": "IP pool added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_ip_pool":
            r = await client.delete(f"{base}/virtualnetwork/ippool", {"virtualNetworkName": params.get("virtual_network_name"), "ipPoolName": params.get("ip_pool_name"), "siteNameHierarchy": params.get("site_name_hierarchy")})
            return success_result(data={"message": "IP pool deleted"}) if r.get("success") else error_result(r.get("error"))
        # Authentication Profiles
        if skill_id == "sda_get_auth_profile":
            qp = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "authenticateTemplateName": params.get("authenticate_template_name")}.items() if v}
            r = await client.get(f"{base}/authentication-profile", qp)
            return success_result(data={"auth_profile": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_auth_profile":
            payload = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "authenticateTemplateName": params.get("authenticate_template_name"), "authenticationOrder": params.get("authentication_order"), "dot1xToMabFallbackTimeout": params.get("dot1x_to_mab_fallback_timeout"), "wakeOnLan": params.get("wake_on_lan"), "numberOfHosts": params.get("number_of_hosts")}.items() if v is not None}
            r = await client.post(f"{base}/authentication-profile", payload)
            return success_result(data={"message": "Auth profile added", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_update_auth_profile":
            payload = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "authenticateTemplateName": params.get("authenticate_template_name"), "authenticationOrder": params.get("authentication_order")}.items() if v}
            r = await client.put(f"{base}/authentication-profile", payload)
            return success_result(data={"message": "Auth profile updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_auth_profile":
            r = await client.delete(f"{base}/authentication-profile", {"siteNameHierarchy": params.get("site_name_hierarchy")})
            return success_result(data={"message": "Auth profile deleted"}) if r.get("success") else error_result(r.get("error"))
        # Port Assignments for AP
        if skill_id == "sda_get_port_assignment":
            r = await client.get(f"{base}/port-assignment-for-access-point", {"deviceIPAddress": params.get("device_ip_address"), "interfaceName": params.get("interface_name")})
            return success_result(data={"port_assignment": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_port_assignment":
            payload = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "deviceManagementIpAddress": params.get("device_management_ip_address"), "interfaceName": params.get("interface_name"), "dataIpAddressPoolName": params.get("data_ip_address_pool_name"), "authenticateTemplateName": params.get("authenticate_template_name"), "interfaceDescription": params.get("interface_description")}.items() if v}
            r = await client.post(f"{base}/port-assignment-for-access-point", payload)
            return success_result(data={"message": "Port assigned for AP", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_port_assignment":
            r = await client.delete(f"{base}/port-assignment-for-access-point", {"deviceIPAddress": params.get("device_ip_address"), "interfaceName": params.get("interface_name")})
            return success_result(data={"message": "Port assignment deleted"}) if r.get("success") else error_result(r.get("error"))
        # Port Assignments for User Devices
        if skill_id == "sda_get_user_device_port":
            r = await client.get(f"{base}/port-assignment-for-user-device", {"deviceIPAddress": params.get("device_ip_address"), "interfaceName": params.get("interface_name")})
            return success_result(data={"port_assignment": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_add_user_device_port":
            payload = {k: v for k, v in {"siteNameHierarchy": params.get("site_name_hierarchy"), "deviceManagementIpAddress": params.get("device_management_ip_address"), "interfaceName": params.get("interface_name"), "dataIpAddressPoolName": params.get("data_ip_address_pool_name"), "voiceIpAddressPoolName": params.get("voice_ip_address_pool_name"), "authenticateTemplateName": params.get("authenticate_template_name"), "scalableGroupName": params.get("scalable_group_name"), "interfaceDescription": params.get("interface_description")}.items() if v}
            r = await client.post(f"{base}/port-assignment-for-user-device", payload)
            return success_result(data={"message": "Port assigned for user device", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "sda_delete_user_device_port":
            r = await client.delete(f"{base}/port-assignment-for-user-device", {"deviceIPAddress": params.get("device_ip_address"), "interfaceName": params.get("interface_name")})
            return success_result(data={"message": "Port assignment deleted"}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
