"""
Meraki Wireless skill module.

Provides skills for wireless operations including:
- SSIDs configuration
- RF profiles
- Bluetooth settings
- Air Marshal
- Connection and latency stats
- Radio settings
- Channel utilization
- Mesh networking
- Ethernet ports on APs
"""

import logging
from typing import List, Dict, Any

from src.a2a.types import AgentSkill
from src.a2a.specialists.base_specialist import AgentExecutionContext, SkillResult
from src.services.meraki_api import MerakiAPIClient

from .base import (
    MerakiSkillModule,
    create_skill,
    build_input_schema,
    success_result,
    error_result,
    api_get,
    api_post,
    api_put,
    api_delete,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    NETWORK_ID_SCHEMA,
    DEVICE_SERIAL_SCHEMA,
)

logger = logging.getLogger(__name__)


class WirelessModule(MerakiSkillModule):
    """Meraki Wireless skill module."""

    MODULE_NAME = "wireless"
    MODULE_PREFIX = "wireless_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Return all wireless skills."""
        return [
            # -----------------------------------------------------------------
            # SSIDs
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_list_ssids",
                name="List SSIDs",
                description="List all SSIDs configured for a wireless network",
                tags=["wireless", "ssids", "list", "read", "wifi"],
                examples=[
                    "List SSIDs",
                    "Show wireless networks",
                    "Get all SSIDs",
                    "What SSIDs are configured?",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="wireless_get_ssid",
                name="Get SSID",
                description="Get details of a specific SSID",
                tags=["wireless", "ssids", "get", "read", "wifi"],
                examples=[
                    "Get SSID details",
                    "Show SSID configuration",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number (0-14)"},
                    },
                    required=["network_id", "number"],
                ),
            ),
            create_skill(
                id="wireless_update_ssid",
                name="Update SSID",
                description="Update SSID settings like name, enabled state, authentication",
                tags=["wireless", "ssids", "update", "write", "wifi"],
                examples=[
                    "Update SSID",
                    "Change SSID settings",
                    "Enable/disable SSID",
                    "Change WiFi password",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number (0-14)"},
                        "name": {"type": "string", "description": "SSID name"},
                        "enabled": {"type": "boolean", "description": "Enable/disable SSID"},
                        "authMode": {"type": "string", "description": "Authentication mode"},
                        "encryptionMode": {"type": "string", "description": "Encryption mode"},
                        "psk": {"type": "string", "description": "Pre-shared key"},
                        "wpaEncryptionMode": {"type": "string", "description": "WPA encryption mode"},
                        "ipAssignmentMode": {"type": "string", "description": "IP assignment mode"},
                        "useVlanTagging": {"type": "boolean", "description": "Use VLAN tagging"},
                        "defaultVlanId": {"type": "integer", "description": "Default VLAN ID"},
                        "visible": {"type": "boolean", "description": "SSID visibility"},
                        "availableOnAllAps": {"type": "boolean", "description": "Available on all APs"},
                        "availabilityTags": {"type": "array", "description": "AP tags for availability", "items": {"type": "string"}},
                        "bandSelection": {"type": "string", "description": "Band selection"},
                        "minBitrate": {"type": "number", "description": "Minimum bitrate"},
                        "perClientBandwidthLimitUp": {"type": "integer", "description": "Upload limit per client"},
                        "perClientBandwidthLimitDown": {"type": "integer", "description": "Download limit per client"},
                        "perSsidBandwidthLimitUp": {"type": "integer", "description": "Upload limit per SSID"},
                        "perSsidBandwidthLimitDown": {"type": "integer", "description": "Download limit per SSID"},
                        "splashPage": {"type": "string", "description": "Splash page type"},
                        "radiusServers": {"type": "array", "description": "RADIUS servers", "items": {"type": "object"}},
                        "radiusAccountingEnabled": {"type": "boolean", "description": "Enable RADIUS accounting"},
                    },
                    required=["network_id", "number"],
                ),
            ),
            create_skill(
                id="wireless_get_ssid_splash_settings",
                name="Get SSID Splash Settings",
                description="Get splash page settings for an SSID",
                tags=["wireless", "ssids", "splash", "read"],
                examples=[
                    "Get splash settings",
                    "Show splash page config",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number"},
                    },
                    required=["network_id", "number"],
                ),
            ),
            create_skill(
                id="wireless_update_ssid_splash_settings",
                name="Update SSID Splash Settings",
                description="Update splash page settings for an SSID",
                tags=["wireless", "ssids", "splash", "update", "write"],
                examples=[
                    "Update splash settings",
                    "Configure splash page",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number"},
                        "splashUrl": {"type": "string", "description": "Splash URL"},
                        "useCustomUrl": {"type": "boolean", "description": "Use custom URL"},
                        "splashTimeout": {"type": "integer", "description": "Splash timeout"},
                        "redirectUrl": {"type": "string", "description": "Redirect URL"},
                        "useRedirectUrl": {"type": "boolean", "description": "Use redirect URL"},
                        "welcomeMessage": {"type": "string", "description": "Welcome message"},
                        "splashLogo": {"type": "object", "description": "Splash logo settings"},
                        "splashImage": {"type": "object", "description": "Splash image settings"},
                        "splashPrepaidFront": {"type": "object", "description": "Prepaid front settings"},
                        "blockAllTrafficBeforeSignOn": {"type": "boolean", "description": "Block traffic before sign-on"},
                        "controllerDisconnectionBehavior": {"type": "string", "description": "Disconnection behavior"},
                        "allowSimultaneousLogins": {"type": "boolean", "description": "Allow simultaneous logins"},
                        "guestSponsorship": {"type": "object", "description": "Guest sponsorship settings"},
                        "billing": {"type": "object", "description": "Billing settings"},
                    },
                    required=["network_id", "number"],
                ),
            ),
            create_skill(
                id="wireless_get_ssid_firewall_rules",
                name="Get SSID Firewall Rules",
                description="Get L3 firewall rules for an SSID",
                tags=["wireless", "ssids", "firewall", "rules", "read", "security"],
                examples=[
                    "Get SSID firewall rules",
                    "Show WiFi firewall config",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number"},
                    },
                    required=["network_id", "number"],
                ),
            ),
            create_skill(
                id="wireless_update_ssid_firewall_rules",
                name="Update SSID Firewall Rules",
                description="Update L3 firewall rules for an SSID",
                tags=["wireless", "ssids", "firewall", "rules", "update", "write", "security"],
                examples=[
                    "Update SSID firewall rules",
                    "Configure WiFi firewall",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number"},
                        "rules": {"type": "array", "description": "Firewall rules", "items": {"type": "object"}},
                        "allowLanAccess": {"type": "boolean", "description": "Allow LAN access"},
                    },
                    required=["network_id", "number"],
                ),
            ),
            create_skill(
                id="wireless_get_ssid_traffic_shaping",
                name="Get SSID Traffic Shaping",
                description="Get traffic shaping rules for an SSID",
                tags=["wireless", "ssids", "traffic", "shaping", "read", "qos"],
                examples=[
                    "Get SSID traffic shaping",
                    "Show WiFi QoS settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number"},
                    },
                    required=["network_id", "number"],
                ),
            ),
            create_skill(
                id="wireless_update_ssid_traffic_shaping",
                name="Update SSID Traffic Shaping",
                description="Update traffic shaping rules for an SSID",
                tags=["wireless", "ssids", "traffic", "shaping", "update", "write", "qos"],
                examples=[
                    "Update SSID traffic shaping",
                    "Configure WiFi QoS",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "number": {"type": "integer", "description": "SSID number"},
                        "trafficShapingEnabled": {"type": "boolean", "description": "Enable traffic shaping"},
                        "defaultRulesEnabled": {"type": "boolean", "description": "Enable default rules"},
                        "rules": {"type": "array", "description": "Traffic shaping rules", "items": {"type": "object"}},
                    },
                    required=["network_id", "number"],
                ),
            ),

            # -----------------------------------------------------------------
            # RF Profiles
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_list_rf_profiles",
                name="List RF Profiles",
                description="List RF profiles for a wireless network",
                tags=["wireless", "rf", "profiles", "list", "read", "radio"],
                examples=[
                    "List RF profiles",
                    "Show radio profiles",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "includeTemplateProfiles": {"type": "boolean", "description": "Include template profiles"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_create_rf_profile",
                name="Create RF Profile",
                description="Create a new RF profile",
                tags=["wireless", "rf", "profiles", "create", "write", "radio"],
                examples=[
                    "Create RF profile",
                    "Add new radio profile",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "name": {"type": "string", "description": "Profile name"},
                        "bandSelectionType": {"type": "string", "description": "Band selection type"},
                        "clientBalancingEnabled": {"type": "boolean", "description": "Enable client balancing"},
                        "minBitrateType": {"type": "string", "description": "Minimum bitrate type"},
                        "apBandSettings": {"type": "object", "description": "AP band settings"},
                        "twoFourGhzSettings": {"type": "object", "description": "2.4 GHz settings"},
                        "fiveGhzSettings": {"type": "object", "description": "5 GHz settings"},
                        "sixGhzSettings": {"type": "object", "description": "6 GHz settings"},
                        "transmission": {"type": "object", "description": "Transmission settings"},
                        "perSsidSettings": {"type": "object", "description": "Per-SSID settings"},
                    },
                    required=["network_id", "name", "bandSelectionType"],
                ),
            ),
            create_skill(
                id="wireless_get_rf_profile",
                name="Get RF Profile",
                description="Get details of an RF profile",
                tags=["wireless", "rf", "profiles", "get", "read"],
                examples=[
                    "Get RF profile",
                    "Show radio profile details",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "rf_profile_id": {"type": "string", "description": "RF profile ID"},
                    },
                    required=["network_id", "rf_profile_id"],
                ),
            ),
            create_skill(
                id="wireless_update_rf_profile",
                name="Update RF Profile",
                description="Update an RF profile",
                tags=["wireless", "rf", "profiles", "update", "write"],
                examples=[
                    "Update RF profile",
                    "Modify radio settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "rf_profile_id": {"type": "string", "description": "RF profile ID"},
                        "name": {"type": "string", "description": "Profile name"},
                        "bandSelectionType": {"type": "string", "description": "Band selection type"},
                        "clientBalancingEnabled": {"type": "boolean", "description": "Enable client balancing"},
                        "minBitrateType": {"type": "string", "description": "Minimum bitrate type"},
                        "apBandSettings": {"type": "object", "description": "AP band settings"},
                        "twoFourGhzSettings": {"type": "object", "description": "2.4 GHz settings"},
                        "fiveGhzSettings": {"type": "object", "description": "5 GHz settings"},
                        "sixGhzSettings": {"type": "object", "description": "6 GHz settings"},
                        "transmission": {"type": "object", "description": "Transmission settings"},
                        "perSsidSettings": {"type": "object", "description": "Per-SSID settings"},
                    },
                    required=["network_id", "rf_profile_id"],
                ),
            ),
            create_skill(
                id="wireless_delete_rf_profile",
                name="Delete RF Profile",
                description="Delete an RF profile",
                tags=["wireless", "rf", "profiles", "delete", "write"],
                examples=[
                    "Delete RF profile",
                    "Remove radio profile",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "rf_profile_id": {"type": "string", "description": "RF profile ID"},
                    },
                    required=["network_id", "rf_profile_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Bluetooth
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_bluetooth_settings",
                name="Get Bluetooth Settings",
                description="Get Bluetooth settings for a network",
                tags=["wireless", "bluetooth", "settings", "read", "ble"],
                examples=[
                    "Get Bluetooth settings",
                    "Show BLE configuration",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="wireless_update_bluetooth_settings",
                name="Update Bluetooth Settings",
                description="Update Bluetooth settings for a network",
                tags=["wireless", "bluetooth", "settings", "update", "write", "ble"],
                examples=[
                    "Update Bluetooth settings",
                    "Configure BLE",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "scanningEnabled": {"type": "boolean", "description": "Enable scanning"},
                        "advertisingEnabled": {"type": "boolean", "description": "Enable advertising"},
                        "uuid": {"type": "string", "description": "UUID"},
                        "majorMinorAssignmentMode": {"type": "string", "description": "Major/minor assignment mode"},
                        "major": {"type": "integer", "description": "Major value"},
                        "minor": {"type": "integer", "description": "Minor value"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_get_device_bluetooth",
                name="Get Device Bluetooth Settings",
                description="Get Bluetooth settings for a specific AP",
                tags=["wireless", "bluetooth", "device", "read"],
                examples=[
                    "Get AP Bluetooth settings",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="wireless_update_device_bluetooth",
                name="Update Device Bluetooth Settings",
                description="Update Bluetooth settings for a specific AP",
                tags=["wireless", "bluetooth", "device", "update", "write"],
                examples=[
                    "Update AP Bluetooth settings",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial"},
                        "uuid": {"type": "string", "description": "UUID"},
                        "major": {"type": "integer", "description": "Major value"},
                        "minor": {"type": "integer", "description": "Minor value"},
                    },
                    required=["serial"],
                ),
            ),

            # -----------------------------------------------------------------
            # Air Marshal
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_air_marshal",
                name="Get Air Marshal Data",
                description="Get Air Marshal data for rogue APs and SSIDs",
                tags=["wireless", "air", "marshal", "rogue", "read", "security"],
                examples=[
                    "Get Air Marshal data",
                    "Show rogue APs",
                    "Detect rogue wireless networks",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_get_air_marshal_settings",
                name="Get Air Marshal Settings",
                description="Get Air Marshal settings",
                tags=["wireless", "air", "marshal", "settings", "read"],
                examples=[
                    "Get Air Marshal settings",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="wireless_update_air_marshal_settings",
                name="Update Air Marshal Settings",
                description="Update Air Marshal settings",
                tags=["wireless", "air", "marshal", "settings", "update", "write"],
                examples=[
                    "Update Air Marshal settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "defaultPolicy": {"type": "string", "description": "Default policy (allow, block)"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_list_air_marshal_rules",
                name="List Air Marshal Rules",
                description="List Air Marshal containment rules",
                tags=["wireless", "air", "marshal", "rules", "list", "read"],
                examples=[
                    "List Air Marshal rules",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="wireless_create_air_marshal_rule",
                name="Create Air Marshal Rule",
                description="Create an Air Marshal containment rule",
                tags=["wireless", "air", "marshal", "rules", "create", "write"],
                examples=[
                    "Create Air Marshal rule",
                    "Add rogue AP rule",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "type": {"type": "string", "description": "Rule type"},
                        "match": {"type": "object", "description": "Match criteria"},
                    },
                    required=["network_id", "type", "match"],
                ),
            ),

            # -----------------------------------------------------------------
            # Connection Stats
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_connection_stats",
                name="Get Wireless Connection Stats",
                description="Get connection statistics for a wireless network",
                tags=["wireless", "connection", "stats", "read", "performance"],
                examples=[
                    "Get wireless connection stats",
                    "Show connection statistics",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "band": {"type": "string", "description": "Band filter (2.4, 5, 6)"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                        "vlan": {"type": "integer", "description": "VLAN ID"},
                        "apTag": {"type": "string", "description": "AP tag filter"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_get_clients_connection_stats",
                name="Get Clients Connection Stats",
                description="Get connection statistics for wireless clients",
                tags=["wireless", "clients", "connection", "stats", "read"],
                examples=[
                    "Get client connection stats",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                        "vlan": {"type": "integer", "description": "VLAN ID"},
                        "apTag": {"type": "string", "description": "AP tag filter"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_get_device_connection_stats",
                name="Get Device Connection Stats",
                description="Get connection statistics for a specific AP",
                tags=["wireless", "device", "connection", "stats", "read"],
                examples=[
                    "Get AP connection stats",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                        "vlan": {"type": "integer", "description": "VLAN ID"},
                        "apTag": {"type": "string", "description": "AP tag filter"},
                    },
                    required=["serial"],
                ),
            ),
            create_skill(
                id="wireless_get_failed_connections",
                name="Get Failed Connections",
                description="Get list of failed wireless connections",
                tags=["wireless", "failed", "connections", "read", "troubleshooting"],
                examples=[
                    "Get failed connections",
                    "Show connection failures",
                    "WiFi connection problems",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                        "vlan": {"type": "integer", "description": "VLAN ID"},
                        "apTag": {"type": "string", "description": "AP tag filter"},
                        "serial": {"type": "string", "description": "Device serial"},
                        "clientId": {"type": "string", "description": "Client ID"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Latency Stats
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_latency_stats",
                name="Get Wireless Latency Stats",
                description="Get latency statistics for a wireless network",
                tags=["wireless", "latency", "stats", "read", "performance"],
                examples=[
                    "Get wireless latency stats",
                    "Show latency statistics",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                        "vlan": {"type": "integer", "description": "VLAN ID"},
                        "apTag": {"type": "string", "description": "AP tag filter"},
                        "fields": {"type": "string", "description": "Fields to return"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_get_latency_history",
                name="Get Wireless Latency History",
                description="Get latency history for a wireless network",
                tags=["wireless", "latency", "history", "read"],
                examples=[
                    "Get latency history",
                    "Show latency over time",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "resolution": {"type": "integer", "description": "Data resolution"},
                        "autoResolution": {"type": "boolean", "description": "Auto resolution"},
                        "clientId": {"type": "string", "description": "Client ID"},
                        "deviceSerial": {"type": "string", "description": "Device serial"},
                        "apTag": {"type": "string", "description": "AP tag"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                        "accessCategory": {"type": "string", "description": "Access category"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_get_client_latency_stats",
                name="Get Client Latency Stats",
                description="Get latency statistics for a specific client",
                tags=["wireless", "client", "latency", "stats", "read"],
                examples=[
                    "Get client latency stats",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "client_id": {"type": "string", "description": "Client ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                        "vlan": {"type": "integer", "description": "VLAN ID"},
                        "apTag": {"type": "string", "description": "AP tag"},
                        "fields": {"type": "string", "description": "Fields to return"},
                    },
                    required=["network_id", "client_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Radio Settings
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_device_radio_settings",
                name="Get Device Radio Settings",
                description="Get radio settings for a specific AP",
                tags=["wireless", "device", "radio", "settings", "read"],
                examples=[
                    "Get AP radio settings",
                    "Show device radio config",
                ],
                input_schema=DEVICE_SERIAL_SCHEMA,
            ),
            create_skill(
                id="wireless_update_device_radio_settings",
                name="Update Device Radio Settings",
                description="Update radio settings for a specific AP",
                tags=["wireless", "device", "radio", "settings", "update", "write"],
                examples=[
                    "Update AP radio settings",
                    "Change radio channel",
                    "Set radio power",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial"},
                        "rfProfileId": {"type": "string", "description": "RF profile ID"},
                        "twoFourGhzSettings": {"type": "object", "description": "2.4 GHz settings"},
                        "fiveGhzSettings": {"type": "object", "description": "5 GHz settings"},
                    },
                    required=["serial"],
                ),
            ),

            # -----------------------------------------------------------------
            # Channel Utilization
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_channel_utilization",
                name="Get Channel Utilization",
                description="Get channel utilization history for a network",
                tags=["wireless", "channel", "utilization", "read", "performance"],
                examples=[
                    "Get channel utilization",
                    "Show channel usage",
                    "Check WiFi interference",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "resolution": {"type": "integer", "description": "Data resolution"},
                        "autoResolution": {"type": "boolean", "description": "Auto resolution"},
                        "clientId": {"type": "string", "description": "Client ID"},
                        "deviceSerial": {"type": "string", "description": "Device serial"},
                        "apTag": {"type": "string", "description": "AP tag"},
                        "band": {"type": "string", "description": "Band filter"},
                    },
                    required=["network_id"],
                ),
            ),
            create_skill(
                id="wireless_get_device_channel_utilization",
                name="Get Device Channel Utilization",
                description="Get channel utilization for a specific AP",
                tags=["wireless", "device", "channel", "utilization", "read"],
                examples=[
                    "Get AP channel utilization",
                ],
                input_schema=build_input_schema(
                    {
                        "serial": {"type": "string", "description": "Device serial"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                    },
                    required=["serial"],
                ),
            ),

            # -----------------------------------------------------------------
            # Mesh
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_mesh_statuses",
                name="Get Mesh Statuses",
                description="Get mesh networking status for all APs",
                tags=["wireless", "mesh", "status", "read"],
                examples=[
                    "Get mesh status",
                    "Show mesh networking",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "perPage": {"type": "integer", "description": "Number per page"},
                        "startingAfter": {"type": "string", "description": "Pagination cursor"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Wireless Settings
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_settings",
                name="Get Wireless Settings",
                description="Get wireless settings for a network",
                tags=["wireless", "settings", "read"],
                examples=[
                    "Get wireless settings",
                    "Show WiFi network settings",
                ],
                input_schema=NETWORK_ID_SCHEMA,
            ),
            create_skill(
                id="wireless_update_settings",
                name="Update Wireless Settings",
                description="Update wireless settings for a network",
                tags=["wireless", "settings", "update", "write"],
                examples=[
                    "Update wireless settings",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "meshingEnabled": {"type": "boolean", "description": "Enable meshing"},
                        "ipv6BridgeEnabled": {"type": "boolean", "description": "Enable IPv6 bridge"},
                        "locationAnalyticsEnabled": {"type": "boolean", "description": "Enable location analytics"},
                        "upgradeStrategy": {"type": "string", "description": "Upgrade strategy"},
                        "ledLightsOn": {"type": "boolean", "description": "LED lights on"},
                        "namedVlans": {"type": "object", "description": "Named VLANs settings"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Signal Quality History
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_signal_quality_history",
                name="Get Signal Quality History",
                description="Get signal quality history for a network",
                tags=["wireless", "signal", "quality", "history", "read"],
                examples=[
                    "Get signal quality",
                    "Show WiFi signal history",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "resolution": {"type": "integer", "description": "Data resolution"},
                        "autoResolution": {"type": "boolean", "description": "Auto resolution"},
                        "clientId": {"type": "string", "description": "Client ID"},
                        "deviceSerial": {"type": "string", "description": "Device serial"},
                        "apTag": {"type": "string", "description": "AP tag"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Usage History
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_usage_history",
                name="Get Wireless Usage History",
                description="Get data usage history for a wireless network",
                tags=["wireless", "usage", "history", "read", "bandwidth"],
                examples=[
                    "Get wireless usage",
                    "Show WiFi bandwidth history",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "resolution": {"type": "integer", "description": "Data resolution"},
                        "autoResolution": {"type": "boolean", "description": "Auto resolution"},
                        "clientId": {"type": "string", "description": "Client ID"},
                        "deviceSerial": {"type": "string", "description": "Device serial"},
                        "apTag": {"type": "string", "description": "AP tag"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Data Rate History
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_data_rate_history",
                name="Get Wireless Data Rate History",
                description="Get data rate history for a wireless network",
                tags=["wireless", "data", "rate", "history", "read"],
                examples=[
                    "Get data rate history",
                    "Show WiFi speed history",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "resolution": {"type": "integer", "description": "Data resolution"},
                        "autoResolution": {"type": "boolean", "description": "Auto resolution"},
                        "clientId": {"type": "string", "description": "Client ID"},
                        "deviceSerial": {"type": "string", "description": "Device serial"},
                        "apTag": {"type": "string", "description": "AP tag"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                    },
                    required=["network_id"],
                ),
            ),

            # -----------------------------------------------------------------
            # Client Count History
            # -----------------------------------------------------------------
            create_skill(
                id="wireless_get_client_count_history",
                name="Get Client Count History",
                description="Get client count history for a wireless network",
                tags=["wireless", "clients", "count", "history", "read"],
                examples=[
                    "Get client count history",
                    "Show number of clients over time",
                ],
                input_schema=build_input_schema(
                    {
                        "network_id": {"type": "string", "description": "Network ID"},
                        "t0": {"type": "string", "description": "Start time"},
                        "t1": {"type": "string", "description": "End time"},
                        "timespan": {"type": "number", "description": "Timespan in seconds"},
                        "resolution": {"type": "integer", "description": "Data resolution"},
                        "autoResolution": {"type": "boolean", "description": "Auto resolution"},
                        "clientId": {"type": "string", "description": "Client ID"},
                        "deviceSerial": {"type": "string", "description": "Device serial"},
                        "apTag": {"type": "string", "description": "AP tag"},
                        "band": {"type": "string", "description": "Band filter"},
                        "ssid": {"type": "integer", "description": "SSID number"},
                    },
                    required=["network_id"],
                ),
            ),
        ]

    # =========================================================================
    # Skill Execution
    # =========================================================================

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: MerakiAPIClient,
        params: Dict[str, Any],
        context: AgentExecutionContext,
    ) -> SkillResult:
        """Execute a wireless skill."""
        log_skill_start(cls.MODULE_NAME, skill_id, params)

        try:
            # SSIDs
            if skill_id == "wireless_list_ssids":
                return await cls._list_ssids(client, params, context)
            elif skill_id == "wireless_get_ssid":
                return await cls._get_ssid(client, params, context)
            elif skill_id == "wireless_update_ssid":
                return await cls._update_ssid(client, params, context)
            elif skill_id == "wireless_get_ssid_splash_settings":
                return await cls._get_ssid_splash_settings(client, params, context)
            elif skill_id == "wireless_update_ssid_splash_settings":
                return await cls._update_ssid_splash_settings(client, params, context)
            elif skill_id == "wireless_get_ssid_firewall_rules":
                return await cls._get_ssid_firewall_rules(client, params, context)
            elif skill_id == "wireless_update_ssid_firewall_rules":
                return await cls._update_ssid_firewall_rules(client, params, context)
            elif skill_id == "wireless_get_ssid_traffic_shaping":
                return await cls._get_ssid_traffic_shaping(client, params, context)
            elif skill_id == "wireless_update_ssid_traffic_shaping":
                return await cls._update_ssid_traffic_shaping(client, params, context)

            # RF Profiles
            elif skill_id == "wireless_list_rf_profiles":
                return await cls._list_rf_profiles(client, params, context)
            elif skill_id == "wireless_create_rf_profile":
                return await cls._create_rf_profile(client, params, context)
            elif skill_id == "wireless_get_rf_profile":
                return await cls._get_rf_profile(client, params, context)
            elif skill_id == "wireless_update_rf_profile":
                return await cls._update_rf_profile(client, params, context)
            elif skill_id == "wireless_delete_rf_profile":
                return await cls._delete_rf_profile(client, params, context)

            # Bluetooth
            elif skill_id == "wireless_get_bluetooth_settings":
                return await cls._get_bluetooth_settings(client, params, context)
            elif skill_id == "wireless_update_bluetooth_settings":
                return await cls._update_bluetooth_settings(client, params, context)
            elif skill_id == "wireless_get_device_bluetooth":
                return await cls._get_device_bluetooth(client, params, context)
            elif skill_id == "wireless_update_device_bluetooth":
                return await cls._update_device_bluetooth(client, params, context)

            # Air Marshal
            elif skill_id == "wireless_get_air_marshal":
                return await cls._get_air_marshal(client, params, context)
            elif skill_id == "wireless_get_air_marshal_settings":
                return await cls._get_air_marshal_settings(client, params, context)
            elif skill_id == "wireless_update_air_marshal_settings":
                return await cls._update_air_marshal_settings(client, params, context)
            elif skill_id == "wireless_list_air_marshal_rules":
                return await cls._list_air_marshal_rules(client, params, context)
            elif skill_id == "wireless_create_air_marshal_rule":
                return await cls._create_air_marshal_rule(client, params, context)

            # Connection Stats
            elif skill_id == "wireless_get_connection_stats":
                return await cls._get_connection_stats(client, params, context)
            elif skill_id == "wireless_get_clients_connection_stats":
                return await cls._get_clients_connection_stats(client, params, context)
            elif skill_id == "wireless_get_device_connection_stats":
                return await cls._get_device_connection_stats(client, params, context)
            elif skill_id == "wireless_get_failed_connections":
                return await cls._get_failed_connections(client, params, context)

            # Latency Stats
            elif skill_id == "wireless_get_latency_stats":
                return await cls._get_latency_stats(client, params, context)
            elif skill_id == "wireless_get_latency_history":
                return await cls._get_latency_history(client, params, context)
            elif skill_id == "wireless_get_client_latency_stats":
                return await cls._get_client_latency_stats(client, params, context)

            # Radio Settings
            elif skill_id == "wireless_get_device_radio_settings":
                return await cls._get_device_radio_settings(client, params, context)
            elif skill_id == "wireless_update_device_radio_settings":
                return await cls._update_device_radio_settings(client, params, context)

            # Channel Utilization
            elif skill_id == "wireless_get_channel_utilization":
                return await cls._get_channel_utilization(client, params, context)
            elif skill_id == "wireless_get_device_channel_utilization":
                return await cls._get_device_channel_utilization(client, params, context)

            # Mesh
            elif skill_id == "wireless_get_mesh_statuses":
                return await cls._get_mesh_statuses(client, params, context)

            # Settings
            elif skill_id == "wireless_get_settings":
                return await cls._get_settings(client, params, context)
            elif skill_id == "wireless_update_settings":
                return await cls._update_settings(client, params, context)

            # Signal Quality
            elif skill_id == "wireless_get_signal_quality_history":
                return await cls._get_signal_quality_history(client, params, context)

            # Usage History
            elif skill_id == "wireless_get_usage_history":
                return await cls._get_usage_history(client, params, context)

            # Data Rate History
            elif skill_id == "wireless_get_data_rate_history":
                return await cls._get_data_rate_history(client, params, context)

            # Client Count History
            elif skill_id == "wireless_get_client_count_history":
                return await cls._get_client_count_history(client, params, context)

            else:
                return error_result(f"Unknown skill: {skill_id}")

        except Exception as e:
            log_skill_error(cls.MODULE_NAME, skill_id, str(e))
            return error_result(str(e))

    # =========================================================================
    # Skill Handlers - SSIDs
    # =========================================================================

    @classmethod
    async def _list_ssids(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/wireless/ssids")
        return success_result(data=data)

    @classmethod
    async def _get_ssid(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        data = await api_get(client, f"/networks/{network_id}/wireless/ssids/{number}")
        return success_result(data=data)

    @classmethod
    async def _update_ssid(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        body = {k: params[k] for k in ["name", "enabled", "authMode", "encryptionMode", "psk", "wpaEncryptionMode", "ipAssignmentMode", "useVlanTagging", "defaultVlanId", "visible", "availableOnAllAps", "availabilityTags", "bandSelection", "minBitrate", "perClientBandwidthLimitUp", "perClientBandwidthLimitDown", "perSsidBandwidthLimitUp", "perSsidBandwidthLimitDown", "splashPage", "radiusServers", "radiusAccountingEnabled"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/wireless/ssids/{number}", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_ssid_splash_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        data = await api_get(client, f"/networks/{network_id}/wireless/ssids/{number}/splash/settings")
        return success_result(data=data)

    @classmethod
    async def _update_ssid_splash_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        body = {k: params[k] for k in ["splashUrl", "useCustomUrl", "splashTimeout", "redirectUrl", "useRedirectUrl", "welcomeMessage", "splashLogo", "splashImage", "splashPrepaidFront", "blockAllTrafficBeforeSignOn", "controllerDisconnectionBehavior", "allowSimultaneousLogins", "guestSponsorship", "billing"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/wireless/ssids/{number}/splash/settings", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_ssid_firewall_rules(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        data = await api_get(client, f"/networks/{network_id}/wireless/ssids/{number}/firewall/l3FirewallRules")
        return success_result(data=data)

    @classmethod
    async def _update_ssid_firewall_rules(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        body = {k: params[k] for k in ["rules", "allowLanAccess"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/wireless/ssids/{number}/firewall/l3FirewallRules", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_ssid_traffic_shaping(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        data = await api_get(client, f"/networks/{network_id}/wireless/ssids/{number}/trafficShaping/rules")
        return success_result(data=data)

    @classmethod
    async def _update_ssid_traffic_shaping(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id or number is None:
            return error_result("network_id and number are required")
        body = {k: params[k] for k in ["trafficShapingEnabled", "defaultRulesEnabled", "rules"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/wireless/ssids/{number}/trafficShaping/rules", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - RF Profiles
    # =========================================================================

    @classmethod
    async def _list_rf_profiles(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["includeTemplateProfiles"] if params.get(k) is not None}
        data = await api_get(client, f"/networks/{network_id}/wireless/rfProfiles", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _create_rf_profile(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        name = params.get("name")
        band_type = params.get("bandSelectionType")
        if not network_id or not name or not band_type:
            return error_result("network_id, name, and bandSelectionType are required")
        body = {"name": name, "bandSelectionType": band_type}
        for k in ["clientBalancingEnabled", "minBitrateType", "apBandSettings", "twoFourGhzSettings", "fiveGhzSettings", "sixGhzSettings", "transmission", "perSsidSettings"]:
            if params.get(k) is not None:
                body[k] = params[k]
        data = await api_post(client, f"/networks/{network_id}/wireless/rfProfiles", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_rf_profile(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        rf_id = params.get("rf_profile_id")
        if not network_id or not rf_id:
            return error_result("network_id and rf_profile_id are required")
        data = await api_get(client, f"/networks/{network_id}/wireless/rfProfiles/{rf_id}")
        return success_result(data=data)

    @classmethod
    async def _update_rf_profile(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        rf_id = params.get("rf_profile_id")
        if not network_id or not rf_id:
            return error_result("network_id and rf_profile_id are required")
        body = {k: params[k] for k in ["name", "bandSelectionType", "clientBalancingEnabled", "minBitrateType", "apBandSettings", "twoFourGhzSettings", "fiveGhzSettings", "sixGhzSettings", "transmission", "perSsidSettings"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/wireless/rfProfiles/{rf_id}", data=body)
        return success_result(data=data)

    @classmethod
    async def _delete_rf_profile(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        rf_id = params.get("rf_profile_id")
        if not network_id or not rf_id:
            return error_result("network_id and rf_profile_id are required")
        await api_delete(client, f"/networks/{network_id}/wireless/rfProfiles/{rf_id}")
        return success_result(data={"deleted": True})

    # =========================================================================
    # Skill Handlers - Bluetooth
    # =========================================================================

    @classmethod
    async def _get_bluetooth_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/wireless/bluetooth/settings")
        return success_result(data=data)

    @classmethod
    async def _update_bluetooth_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["scanningEnabled", "advertisingEnabled", "uuid", "majorMinorAssignmentMode", "major", "minor"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/wireless/bluetooth/settings", data=body)
        return success_result(data=data)

    @classmethod
    async def _get_device_bluetooth(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_get(client, f"/devices/{serial}/wireless/bluetooth/settings")
        return success_result(data=data)

    @classmethod
    async def _update_device_bluetooth(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        body = {k: params[k] for k in ["uuid", "major", "minor"] if params.get(k) is not None}
        data = await api_put(client, f"/devices/{serial}/wireless/bluetooth/settings", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Air Marshal
    # =========================================================================

    @classmethod
    async def _get_air_marshal(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "timespan"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/airMarshal", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_air_marshal_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/wireless/airMarshal/settings")
        return success_result(data=data)

    @classmethod
    async def _update_air_marshal_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["defaultPolicy"] if params.get(k)}
        data = await api_put(client, f"/networks/{network_id}/wireless/airMarshal/settings", data=body)
        return success_result(data=data)

    @classmethod
    async def _list_air_marshal_rules(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/wireless/airMarshal/rules")
        return success_result(data=data)

    @classmethod
    async def _create_air_marshal_rule(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        rule_type = params.get("type")
        match = params.get("match")
        if not network_id or not rule_type or not match:
            return error_result("network_id, type, and match are required")
        data = await api_post(client, f"/networks/{network_id}/wireless/airMarshal/rules", data={"type": rule_type, "match": match})
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Stats (simplified)
    # =========================================================================

    @classmethod
    async def _get_connection_stats(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/connectionStats", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_clients_connection_stats(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/clients/connectionStats", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_device_connection_stats(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag"] if params.get(k)}
        data = await api_get(client, f"/devices/{serial}/wireless/connectionStats", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_failed_connections(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag", "serial", "clientId"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/failedConnections", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_latency_stats(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag", "fields"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/latencyStats", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_latency_history(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band", "ssid", "accessCategory"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/latencyHistory", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_client_latency_stats(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        client_id = params.get("client_id")
        if not network_id or not client_id:
            return error_result("network_id and client_id are required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "band", "ssid", "vlan", "apTag", "fields"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/clients/{client_id}/latencyStats", params=query_params)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Radio Settings
    # =========================================================================

    @classmethod
    async def _get_device_radio_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        data = await api_get(client, f"/devices/{serial}/wireless/radio/settings")
        return success_result(data=data)

    @classmethod
    async def _update_device_radio_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        body = {k: params[k] for k in ["rfProfileId", "twoFourGhzSettings", "fiveGhzSettings"] if params.get(k)}
        data = await api_put(client, f"/devices/{serial}/wireless/radio/settings", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Channel Utilization
    # =========================================================================

    @classmethod
    async def _get_channel_utilization(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/channelUtilizationHistory", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_device_channel_utilization(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        serial = params.get("serial")
        if not serial:
            return error_result("serial is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan"] if params.get(k)}
        data = await api_get(client, f"/devices/{serial}/wireless/channelUtilization", params=query_params)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Mesh
    # =========================================================================

    @classmethod
    async def _get_mesh_statuses(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["perPage", "startingAfter"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/meshStatuses", params=query_params)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - Settings
    # =========================================================================

    @classmethod
    async def _get_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        data = await api_get(client, f"/networks/{network_id}/wireless/settings")
        return success_result(data=data)

    @classmethod
    async def _update_settings(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        body = {k: params[k] for k in ["meshingEnabled", "ipv6BridgeEnabled", "locationAnalyticsEnabled", "upgradeStrategy", "ledLightsOn", "namedVlans"] if params.get(k) is not None}
        data = await api_put(client, f"/networks/{network_id}/wireless/settings", data=body)
        return success_result(data=data)

    # =========================================================================
    # Skill Handlers - History
    # =========================================================================

    @classmethod
    async def _get_signal_quality_history(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band", "ssid"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/signalQualityHistory", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_usage_history(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band", "ssid"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/usageHistory", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_data_rate_history(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band", "ssid"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/dataRateHistory", params=query_params)
        return success_result(data=data)

    @classmethod
    async def _get_client_count_history(cls, client: MerakiAPIClient, params: Dict[str, Any], context: AgentExecutionContext) -> SkillResult:
        network_id = params.get("network_id")
        if not network_id:
            return error_result("network_id is required")
        query_params = {k: params[k] for k in ["t0", "t1", "timespan", "resolution", "autoResolution", "clientId", "deviceSerial", "apTag", "band", "ssid"] if params.get(k)}
        data = await api_get(client, f"/networks/{network_id}/wireless/clientCountHistory", params=query_params)
        return success_result(data=data)
