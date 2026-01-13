"""Catalyst Center Wireless skill module.

This module provides skills for wireless network management including:
- Enterprise SSIDs
- Wireless profiles
- RF profiles
- Access point configuration
- Dynamic interfaces
- Sensor tests
"""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    SITE_ID_SCHEMA, DEVICE_ID_SCHEMA, OFFSET_SCHEMA, LIMIT_SCHEMA,
)

WIRELESS_SKILLS: List[SkillDefinition] = [
    {"id": "wireless_get_enterprise_ssids", "name": "Get Enterprise SSIDs", "description": "Get list of enterprise SSIDs.", "tags": ["catalyst", "wireless", "ssid", "list"], "examples": ["List SSIDs", "Show wireless networks"], "input_schema": {"type": "object", "properties": {"ssid_name": {"type": "string"}}, "required": []}},
    {"id": "wireless_create_enterprise_ssid", "name": "Create Enterprise SSID", "description": "Create a new enterprise SSID.", "tags": ["catalyst", "wireless", "ssid", "create"], "examples": ["Create SSID", "Add wireless network"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "security_level": {"type": "string", "enum": ["WPA2_ENTERPRISE", "WPA2_PERSONAL", "WPA3_ENTERPRISE", "WPA3_PERSONAL", "OPEN"]}, "passphrase": {"type": "string"}, "traffic_type": {"type": "string", "enum": ["voicedata", "data"]}, "radio_policy": {"type": "string", "enum": ["Dual band operation (2.4GHz and 5GHz)", "Dual band operation with band select", "5GHz only", "2.4GHz only"]}, "enable_fast_lane": {"type": "boolean"}, "enable_mac_filtering": {"type": "boolean"}, "fast_transition": {"type": "string", "enum": ["Adaptive", "Enable", "Disable"]}}, "required": ["name", "security_level"]}},
    {"id": "wireless_update_enterprise_ssid", "name": "Update Enterprise SSID", "description": "Update an existing enterprise SSID.", "tags": ["catalyst", "wireless", "ssid", "update"], "examples": ["Update SSID"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "security_level": {"type": "string"}, "passphrase": {"type": "string"}, "traffic_type": {"type": "string"}, "radio_policy": {"type": "string"}}, "required": ["name"]}},
    {"id": "wireless_delete_enterprise_ssid", "name": "Delete Enterprise SSID", "description": "Delete an enterprise SSID.", "tags": ["catalyst", "wireless", "ssid", "delete"], "examples": ["Delete SSID", "Remove wireless network"], "input_schema": {"type": "object", "properties": {"ssid_name": {"type": "string"}}, "required": ["ssid_name"]}},
    {"id": "wireless_get_wireless_profiles", "name": "Get Wireless Profiles", "description": "Get list of wireless profiles.", "tags": ["catalyst", "wireless", "profile", "list"], "examples": ["List wireless profiles"], "input_schema": {"type": "object", "properties": {"profile_name": {"type": "string"}}, "required": []}},
    {"id": "wireless_create_wireless_profile", "name": "Create Wireless Profile", "description": "Create a new wireless profile.", "tags": ["catalyst", "wireless", "profile", "create"], "examples": ["Create wireless profile"], "input_schema": {"type": "object", "properties": {"profile_name": {"type": "string"}, "ssid_details": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "enable_fabric": {"type": "boolean"}, "flex_connect": {"type": "object"}}}}}, "required": ["profile_name"]}},
    {"id": "wireless_update_wireless_profile", "name": "Update Wireless Profile", "description": "Update an existing wireless profile.", "tags": ["catalyst", "wireless", "profile", "update"], "examples": ["Update wireless profile"], "input_schema": {"type": "object", "properties": {"profile_name": {"type": "string"}, "ssid_details": {"type": "array", "items": {"type": "object"}}}, "required": ["profile_name"]}},
    {"id": "wireless_delete_wireless_profile", "name": "Delete Wireless Profile", "description": "Delete a wireless profile.", "tags": ["catalyst", "wireless", "profile", "delete"], "examples": ["Delete wireless profile"], "input_schema": {"type": "object", "properties": {"wireless_profile_name": {"type": "string"}}, "required": ["wireless_profile_name"]}},
    {"id": "wireless_get_rf_profiles", "name": "Get RF Profiles", "description": "Get list of RF (Radio Frequency) profiles.", "tags": ["catalyst", "wireless", "rf", "profile", "list"], "examples": ["List RF profiles"], "input_schema": {"type": "object", "properties": {"rf_profile_name": {"type": "string"}}, "required": []}},
    {"id": "wireless_create_rf_profile", "name": "Create RF Profile", "description": "Create a new RF profile.", "tags": ["catalyst", "wireless", "rf", "profile", "create"], "examples": ["Create RF profile"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "default_rf_profile": {"type": "boolean", "default": False}, "enable_radio_type_a": {"type": "boolean", "default": True}, "enable_radio_type_b": {"type": "boolean", "default": True}, "channel_width": {"type": "string"}, "enable_custom": {"type": "boolean"}, "enable_brown_field": {"type": "boolean"}}, "required": ["name"]}},
    {"id": "wireless_delete_rf_profile", "name": "Delete RF Profile", "description": "Delete an RF profile.", "tags": ["catalyst", "wireless", "rf", "profile", "delete"], "examples": ["Delete RF profile"], "input_schema": {"type": "object", "properties": {"rf_profile_name": {"type": "string"}}, "required": ["rf_profile_name"]}},
    {"id": "wireless_provision_device", "name": "Provision Wireless Device", "description": "Provision a wireless device to a site.", "tags": ["catalyst", "wireless", "provision"], "examples": ["Provision wireless controller"], "input_schema": {"type": "object", "properties": {"device_name": {"type": "string"}, "site": {"type": "string"}, "managed_ap_locations": {"type": "array", "items": {"type": "string"}}, "dynamic_interfaces": {"type": "array", "items": {"type": "object"}}}, "required": ["device_name", "site"]}},
    {"id": "wireless_get_access_point_config", "name": "Get Access Point Configuration", "description": "Get access point configuration details.", "tags": ["catalyst", "wireless", "ap", "config"], "examples": ["Get AP config", "Show access point settings"], "input_schema": {"type": "object", "properties": {"key": {"type": "string", "description": "AP MAC address or name"}}, "required": []}},
    {"id": "wireless_configure_access_point", "name": "Configure Access Point", "description": "Configure access point settings.", "tags": ["catalyst", "wireless", "ap", "configure"], "examples": ["Configure AP", "Update access point"], "input_schema": {"type": "object", "properties": {"ap_list": {"type": "array", "items": {"type": "object", "properties": {"ap_name": {"type": "string"}, "ap_name_new": {"type": "string"}, "ap_mode": {"type": "integer"}, "location": {"type": "string"}, "led_status": {"type": "boolean"}, "led_brightness_level": {"type": "integer"}, "is_assigned_site_as_location": {"type": "boolean"}}}}, "configure_admin_status": {"type": "boolean"}, "admin_status": {"type": "boolean"}, "configure_ap_mode": {"type": "boolean"}, "configure_failover_priority": {"type": "boolean"}, "failover_priority": {"type": "integer"}, "configure_led_status": {"type": "boolean"}, "configure_led_brightness_level": {"type": "boolean"}, "configure_location": {"type": "boolean"}}, "required": ["ap_list"]}},
    {"id": "wireless_get_dynamic_interface", "name": "Get Dynamic Interface", "description": "Get dynamic interface configuration.", "tags": ["catalyst", "wireless", "interface", "dynamic"], "examples": ["Get dynamic interfaces"], "input_schema": {"type": "object", "properties": {"interface_name": {"type": "string"}}, "required": []}},
    {"id": "wireless_create_dynamic_interface", "name": "Create Dynamic Interface", "description": "Create a new dynamic interface.", "tags": ["catalyst", "wireless", "interface", "create"], "examples": ["Create dynamic interface"], "input_schema": {"type": "object", "properties": {"interface_name": {"type": "string"}, "vlan_id": {"type": "integer"}, "interface_ip_address": {"type": "string"}, "interface_netmask_in_cidr": {"type": "integer"}, "gateway_ip_address": {"type": "string"}}, "required": ["interface_name", "vlan_id"]}},
    {"id": "wireless_delete_dynamic_interface", "name": "Delete Dynamic Interface", "description": "Delete a dynamic interface.", "tags": ["catalyst", "wireless", "interface", "delete"], "examples": ["Delete dynamic interface"], "input_schema": {"type": "object", "properties": {"interface_name": {"type": "string"}}, "required": ["interface_name"]}},
    {"id": "wireless_get_managed_ap_locations", "name": "Get Managed AP Locations", "description": "Get managed access point locations.", "tags": ["catalyst", "wireless", "ap", "locations"], "examples": ["Get AP locations"], "input_schema": {"type": "object", "properties": {"network_device_id": {"type": "string"}}, "required": ["network_device_id"]}},
    {"id": "wireless_sensor_create_test", "name": "Create Sensor Test", "description": "Create a wireless sensor test.", "tags": ["catalyst", "wireless", "sensor", "test", "create"], "examples": ["Create sensor test"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "ssid": {"type": "string"}, "band": {"type": "string", "enum": ["2.4GHz", "5GHz", "Dual"]}, "connection_mode": {"type": "string", "enum": ["Wired", "Wireless"]}, "ap_coverage": {"type": "array", "items": {"type": "object"}}}, "required": ["name", "ssid"]}},
    {"id": "wireless_sensor_delete_test", "name": "Delete Sensor Test", "description": "Delete a wireless sensor test.", "tags": ["catalyst", "wireless", "sensor", "test", "delete"], "examples": ["Delete sensor test"], "input_schema": {"type": "object", "properties": {"template_name": {"type": "string"}}, "required": ["template_name"]}},
]

class WirelessModule(CatalystSkillModule):
    MODULE_NAME = "wireless"
    MODULE_PREFIX = "wireless_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in WIRELESS_SKILLS]

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
        if skill_id == "wireless_get_enterprise_ssids":
            qp = {"ssidName": params.get("ssid_name")} if params.get("ssid_name") else {}
            r = await client.get("enterprise-ssid", qp)
            return success_result(data={"ssids": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_create_enterprise_ssid":
            payload = {k: v for k, v in {"name": params.get("name"), "securityLevel": params.get("security_level"), "passphrase": params.get("passphrase"), "trafficType": params.get("traffic_type", "voicedata"), "radioPolicy": params.get("radio_policy"), "enableFastLane": params.get("enable_fast_lane"), "enableMACFiltering": params.get("enable_mac_filtering"), "fastTransition": params.get("fast_transition")}.items() if v is not None}
            r = await client.post("enterprise-ssid", payload)
            return success_result(data={"message": "SSID created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_update_enterprise_ssid":
            payload = {k: v for k, v in {"name": params.get("name"), "securityLevel": params.get("security_level"), "passphrase": params.get("passphrase"), "trafficType": params.get("traffic_type"), "radioPolicy": params.get("radio_policy")}.items() if v is not None}
            r = await client.put("enterprise-ssid", payload)
            return success_result(data={"message": "SSID updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_delete_enterprise_ssid":
            r = await client.delete(f"enterprise-ssid/{params.get('ssid_name')}")
            return success_result(data={"message": "SSID deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_get_wireless_profiles":
            qp = {"profileName": params.get("profile_name")} if params.get("profile_name") else {}
            r = await client.get("wireless/profile", qp)
            return success_result(data={"profiles": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_create_wireless_profile":
            payload = {"profileDetails": {"name": params.get("profile_name"), "sites": [], "ssidDetails": params.get("ssid_details", [])}}
            r = await client.post("wireless/profile", payload)
            return success_result(data={"message": "Profile created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_update_wireless_profile":
            payload = {"profileDetails": {"name": params.get("profile_name"), "ssidDetails": params.get("ssid_details", [])}}
            r = await client.put("wireless/profile", payload)
            return success_result(data={"message": "Profile updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_delete_wireless_profile":
            r = await client.delete(f"wireless/profile/{params.get('wireless_profile_name')}")
            return success_result(data={"message": "Profile deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_get_rf_profiles":
            qp = {"rf-profile-name": params.get("rf_profile_name")} if params.get("rf_profile_name") else {}
            r = await client.get("wireless/rf-profile", qp)
            return success_result(data={"rf_profiles": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_create_rf_profile":
            payload = {k: v for k, v in {"name": params.get("name"), "defaultRfProfile": params.get("default_rf_profile", False), "enableRadioTypeA": params.get("enable_radio_type_a", True), "enableRadioTypeB": params.get("enable_radio_type_b", True), "channelWidth": params.get("channel_width"), "enableCustom": params.get("enable_custom"), "enableBrownField": params.get("enable_brown_field")}.items() if v is not None}
            r = await client.post("wireless/rf-profile", payload)
            return success_result(data={"message": "RF profile created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_delete_rf_profile":
            r = await client.delete(f"wireless/rf-profile/{params.get('rf_profile_name')}")
            return success_result(data={"message": "RF profile deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_provision_device":
            payload = [{"deviceName": params.get("device_name"), "site": params.get("site"), "managedAPLocations": params.get("managed_ap_locations", []), "dynamicInterfaces": params.get("dynamic_interfaces", [])}]
            r = await client.post("wireless/provision", payload)
            return success_result(data={"message": "Provisioning started", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_get_access_point_config":
            qp = {"key": params.get("key")} if params.get("key") else {}
            r = await client.get("wireless/accesspoint-configuration/details", qp)
            return success_result(data={"ap_config": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_configure_access_point":
            payload = {k: v for k, v in {"apList": params.get("ap_list", []), "configureAdminStatus": params.get("configure_admin_status"), "adminStatus": params.get("admin_status"), "configureApMode": params.get("configure_ap_mode"), "configureFailoverPriority": params.get("configure_failover_priority"), "failoverPriority": params.get("failover_priority"), "configureLedStatus": params.get("configure_led_status"), "configureLedBrightnessLevel": params.get("configure_led_brightness_level"), "configureLocation": params.get("configure_location")}.items() if v is not None}
            r = await client.post("wireless/accesspoint-configuration", payload)
            return success_result(data={"message": "AP configuration started", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_get_dynamic_interface":
            qp = {"interface-name": params.get("interface_name")} if params.get("interface_name") else {}
            r = await client.get("wireless/dynamic-interface", qp)
            return success_result(data={"interfaces": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_create_dynamic_interface":
            payload = [{k: v for k, v in {"interfaceName": params.get("interface_name"), "vlanId": params.get("vlan_id"), "interfaceIPAddress": params.get("interface_ip_address"), "interfaceNetmaskInCIDR": params.get("interface_netmask_in_cidr"), "gatewayIPAddress": params.get("gateway_ip_address")}.items() if v is not None}]
            r = await client.post("wireless/dynamic-interface", payload)
            return success_result(data={"message": "Interface created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_delete_dynamic_interface":
            r = await client.delete(f"wireless/dynamic-interface/{params.get('interface_name')}")
            return success_result(data={"message": "Interface deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_get_managed_ap_locations":
            r = await client.get(f"wireless/ap/managed-aplocations/{params.get('network_device_id')}")
            return success_result(data={"locations": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_sensor_create_test":
            payload = {k: v for k, v in {"name": params.get("name"), "ssid": params.get("ssid"), "band": params.get("band"), "connectionMode": params.get("connection_mode"), "apCoverage": params.get("ap_coverage", [])}.items() if v is not None}
            r = await client.post("sensor", payload)
            return success_result(data={"message": "Sensor test created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "wireless_sensor_delete_test":
            r = await client.delete("sensor", {"templateName": params.get("template_name")})
            return success_result(data={"message": "Sensor test deleted"}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
