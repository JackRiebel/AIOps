"""Catalyst Center Network Settings skill module.

This module provides skills for network settings management including:
- Global network settings
- Device credentials
- IP address pools
- Service settings (DHCP, DNS, NTP, etc.)

Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/api/1-3-3-x/#!network-settings
"""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    SITE_ID_SCHEMA, IP_POOL_SCHEMA, OFFSET_SCHEMA, LIMIT_SCHEMA,
)

NETWORK_SETTINGS_SKILLS: List[SkillDefinition] = [
    {"id": "settings_get_global", "name": "Get Global Network Settings", "description": "Get global network settings including DHCP, DNS, NTP, and other service configurations.", "tags": ["catalyst", "settings", "global"], "examples": ["Show network settings", "Get global settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": []}},
    {"id": "settings_update_global", "name": "Update Global Network Settings", "description": "Update global network settings for a site.", "tags": ["catalyst", "settings", "update"], "examples": ["Update network settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA, "settings": {"type": "object"}}, "required": ["site_id", "settings"]}},
    {"id": "settings_get_dhcp", "name": "Get DHCP Settings", "description": "Get DHCP server configuration for a site.", "tags": ["catalyst", "settings", "dhcp"], "examples": ["Get DHCP servers", "Show DHCP settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_dns", "name": "Get DNS Settings", "description": "Get DNS server configuration for a site.", "tags": ["catalyst", "settings", "dns"], "examples": ["Get DNS servers", "Show DNS settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_ntp", "name": "Get NTP Settings", "description": "Get NTP server configuration for a site.", "tags": ["catalyst", "settings", "ntp"], "examples": ["Get NTP servers", "Show NTP settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_syslog", "name": "Get Syslog Settings", "description": "Get syslog server configuration for a site.", "tags": ["catalyst", "settings", "syslog"], "examples": ["Get syslog servers"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_snmp", "name": "Get SNMP Settings", "description": "Get SNMP trap server configuration for a site.", "tags": ["catalyst", "settings", "snmp"], "examples": ["Get SNMP settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_netflow", "name": "Get NetFlow Settings", "description": "Get NetFlow collector configuration for a site.", "tags": ["catalyst", "settings", "netflow"], "examples": ["Get NetFlow settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_timezone", "name": "Get Timezone Settings", "description": "Get timezone configuration for a site.", "tags": ["catalyst", "settings", "timezone"], "examples": ["Get timezone"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_banner", "name": "Get Banner Settings", "description": "Get banner message configuration for a site.", "tags": ["catalyst", "settings", "banner"], "examples": ["Get banner settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_aaa", "name": "Get AAA Settings", "description": "Get AAA (Authentication, Authorization, Accounting) server configuration.", "tags": ["catalyst", "settings", "aaa"], "examples": ["Get AAA settings"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": ["site_id"]}},
    {"id": "settings_get_credentials", "name": "Get Device Credentials", "description": "Get device credentials configured in Catalyst Center.", "tags": ["catalyst", "settings", "credentials"], "examples": ["Get device credentials", "List credentials"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA}, "required": []}},
    {"id": "settings_create_credential", "name": "Create Device Credential", "description": "Create a new device credential.", "tags": ["catalyst", "settings", "credentials", "create"], "examples": ["Add credential", "Create CLI credential"], "input_schema": {"type": "object", "properties": {"credential_type": {"type": "string", "enum": ["CLI", "SNMPV2_READ", "SNMPV2_WRITE", "SNMPV3", "HTTP_READ", "HTTP_WRITE"]}, "description": {"type": "string"}, "username": {"type": "string"}, "password": {"type": "string"}, "enable_password": {"type": "string"}}, "required": ["credential_type"]}},
    {"id": "settings_update_credential", "name": "Update Device Credential", "description": "Update an existing device credential.", "tags": ["catalyst", "settings", "credentials", "update"], "examples": ["Update credential"], "input_schema": {"type": "object", "properties": {"credential_id": {"type": "string"}, "description": {"type": "string"}, "username": {"type": "string"}, "password": {"type": "string"}}, "required": ["credential_id"]}},
    {"id": "settings_delete_credential", "name": "Delete Device Credential", "description": "Delete a device credential.", "tags": ["catalyst", "settings", "credentials", "delete"], "examples": ["Delete credential", "Remove credential"], "input_schema": {"type": "object", "properties": {"credential_id": {"type": "string"}}, "required": ["credential_id"]}},
    {"id": "settings_get_ip_pool", "name": "Get IP Address Pools", "description": "Get IP address pools configured in Catalyst Center.", "tags": ["catalyst", "settings", "ip", "pool"], "examples": ["Get IP pools", "List address pools"], "input_schema": {"type": "object", "properties": {"offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA}, "required": []}},
    {"id": "settings_create_ip_pool", "name": "Create IP Address Pool", "description": "Create a new IP address pool.", "tags": ["catalyst", "settings", "ip", "pool", "create"], "examples": ["Create IP pool", "Add address pool"], "input_schema": {"type": "object", "properties": {"ip_pool_name": {"type": "string"}, "ip_pool_cidr": {"type": "string"}, "gateway": {"type": "string"}, "dhcp_server_ips": {"type": "array", "items": {"type": "string"}}, "dns_server_ips": {"type": "array", "items": {"type": "string"}}}, "required": ["ip_pool_name", "ip_pool_cidr"]}},
    {"id": "settings_update_ip_pool", "name": "Update IP Address Pool", "description": "Update an existing IP address pool.", "tags": ["catalyst", "settings", "ip", "pool", "update"], "examples": ["Update IP pool"], "input_schema": {"type": "object", "properties": {"ip_pool_id": {"type": "string"}, "ip_pool_name": {"type": "string"}, "gateway": {"type": "string"}}, "required": ["ip_pool_id"]}},
    {"id": "settings_delete_ip_pool", "name": "Delete IP Address Pool", "description": "Delete an IP address pool.", "tags": ["catalyst", "settings", "ip", "pool", "delete"], "examples": ["Delete IP pool"], "input_schema": {"type": "object", "properties": {"ip_pool_id": {"type": "string"}}, "required": ["ip_pool_id"]}},
    {"id": "settings_reserve_ip_subpool", "name": "Reserve IP Subpool", "description": "Reserve an IP subpool from a global pool for a site.", "tags": ["catalyst", "settings", "ip", "subpool", "reserve"], "examples": ["Reserve IP subpool", "Create site IP pool"], "input_schema": {"type": "object", "properties": {"site_id": SITE_ID_SCHEMA, "global_pool_id": {"type": "string"}, "subpool_name": {"type": "string"}, "subpool_type": {"type": "string", "enum": ["Generic", "LAN", "WAN", "management", "service"]}}, "required": ["site_id", "global_pool_id", "subpool_name"]}},
]

class NetworkSettingsModule(CatalystSkillModule):
    MODULE_NAME = "network_settings"
    MODULE_PREFIX = "settings_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in NETWORK_SETTINGS_SKILLS]

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
        if skill_id == "settings_get_global":
            qp = {"siteId": params.get("site_id")} if params.get("site_id") else {}
            r = await client.get("network", qp)
            return success_result(data={"settings": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_update_global":
            r = await client.put("network", params.get("settings"), {"siteId": params.get("site_id")})
            return success_result(data={"message": "Settings updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_dhcp":
            r = await client.get(f"network/{params.get('site_id')}/dhcp")
            return success_result(data={"dhcp": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_dns":
            r = await client.get(f"network/{params.get('site_id')}/dns")
            return success_result(data={"dns": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_ntp":
            r = await client.get(f"network/{params.get('site_id')}/ntp")
            return success_result(data={"ntp": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_syslog":
            r = await client.get(f"network/{params.get('site_id')}/syslog")
            return success_result(data={"syslog": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_snmp":
            r = await client.get(f"network/{params.get('site_id')}/snmp")
            return success_result(data={"snmp": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_netflow":
            r = await client.get(f"network/{params.get('site_id')}/netflow")
            return success_result(data={"netflow": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_timezone":
            r = await client.get(f"network/{params.get('site_id')}/timezone")
            return success_result(data={"timezone": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_banner":
            r = await client.get(f"network/{params.get('site_id')}/banner")
            return success_result(data={"banner": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_aaa":
            r = await client.get(f"network/{params.get('site_id')}/aaa")
            return success_result(data={"aaa": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_credentials":
            qp = {"siteId": params.get("site_id")} if params.get("site_id") else {}
            r = await client.get("device-credential", qp)
            return success_result(data={"credentials": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_create_credential":
            payload = {k: v for k, v in {"credentialType": params.get("credential_type"), "description": params.get("description"), "username": params.get("username"), "password": params.get("password"), "enablePassword": params.get("enable_password")}.items() if v}
            r = await client.post("device-credential", payload)
            return success_result(data={"message": "Credential created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_update_credential":
            payload = {k: v for k, v in {"id": params.get("credential_id"), "description": params.get("description"), "username": params.get("username"), "password": params.get("password")}.items() if v}
            r = await client.put("device-credential", payload)
            return success_result(data={"message": "Credential updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_delete_credential":
            r = await client.delete(f"device-credential/{params.get('credential_id')}")
            return success_result(data={"message": "Credential deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_get_ip_pool":
            qp = {k: v for k, v in {"offset": params.get("offset"), "limit": params.get("limit")}.items() if v}
            r = await client.get("network/ip-pool", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"ip_pools": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_create_ip_pool":
            payload = {k: v for k, v in {"ipPoolName": params.get("ip_pool_name"), "ipPoolCidr": params.get("ip_pool_cidr"), "gateway": params.get("gateway"), "dhcpServerIps": params.get("dhcp_server_ips"), "dnsServerIps": params.get("dns_server_ips")}.items() if v}
            r = await client.post("network/ip-pool", payload)
            return success_result(data={"message": "IP pool created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_update_ip_pool":
            payload = {k: v for k, v in {"id": params.get("ip_pool_id"), "ipPoolName": params.get("ip_pool_name"), "gateway": params.get("gateway")}.items() if v}
            r = await client.put("network/ip-pool", payload)
            return success_result(data={"message": "IP pool updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_delete_ip_pool":
            r = await client.delete(f"network/ip-pool/{params.get('ip_pool_id')}")
            return success_result(data={"message": "IP pool deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "settings_reserve_ip_subpool":
            payload = {"siteId": params.get("site_id"), "globalPoolId": params.get("global_pool_id"), "name": params.get("subpool_name"), "type": params.get("subpool_type", "Generic")}
            r = await client.post("reserve-ip-subpool", payload)
            return success_result(data={"message": "Subpool reserved", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
