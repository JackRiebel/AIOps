"""
Meraki Appliance (MX) skill module.

This module provides skills for MX security appliances including:
- VLANs
- Firewall Rules (L3, L7, Inbound, Cellular)
- NAT & Port Forwarding
- Security (Intrusion, Malware)
- Content Filtering
- VPN (Site-to-Site, Third Party, BGP)
- Traffic Shaping
- Static Routes
- Ports
- Uplinks
- Single LAN
- DHCP
- Performance
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    MerakiSkillModule,
    SkillDefinition,
    create_skill,
    build_input_schema,
    success_result,
    error_result,
    empty_result,
    api_get,
    api_post,
    api_put,
    api_delete,
    extract_network_entities,
    extract_org_entities,
    extract_device_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    NETWORK_ID_SCHEMA,
    ORG_ID_SCHEMA,
    DEVICE_SERIAL_SCHEMA,
)

# Common schemas for appliance operations
VLAN_ID_SCHEMA = {
    "type": "string",
    "description": "VLAN ID (1-4094)"
}

ROUTE_ID_SCHEMA = {
    "type": "string",
    "description": "Static route ID"
}

PORT_ID_SCHEMA = {
    "type": "string",
    "description": "Port ID"
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

# VLANs Skills
VLAN_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_list_vlans",
        "name": "List VLANs",
        "description": "List the VLANs for an MX network",
        "tags": ["meraki", "appliance", "vlans", "network", "list"],
        "examples": [
            "List VLANs in this network",
            "Show me all VLANs",
            "What VLANs are configured?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_vlan",
        "name": "Get VLAN",
        "description": "Get a specific VLAN for an MX network",
        "tags": ["meraki", "appliance", "vlans", "network", "get"],
        "examples": [
            "Get VLAN 10 details",
            "Show me VLAN configuration",
            "What's the subnet for VLAN 100?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "vlan_id": VLAN_ID_SCHEMA,
            },
            "required": ["network_id", "vlan_id"],
        },
    },
    {
        "id": "appliance_create_vlan",
        "name": "Create VLAN",
        "description": "Create a VLAN for an MX network",
        "tags": ["meraki", "appliance", "vlans", "network", "create"],
        "examples": [
            "Create a new VLAN",
            "Add VLAN 20 for guests",
            "Set up a new VLAN with subnet 10.0.20.0/24",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "id": {"type": "string", "description": "VLAN ID (1-4094)"},
                "name": {"type": "string", "description": "Name of the VLAN"},
                "subnet": {"type": "string", "description": "Subnet of the VLAN (e.g., 10.0.20.0/24)"},
                "appliance_ip": {"type": "string", "description": "Gateway IP of the VLAN (MX appliance IP)"},
            },
            "required": ["network_id", "id", "name", "subnet", "appliance_ip"],
        },
    },
    {
        "id": "appliance_update_vlan",
        "name": "Update VLAN",
        "description": "Update a VLAN for an MX network",
        "tags": ["meraki", "appliance", "vlans", "network", "update"],
        "examples": [
            "Update VLAN 10 name",
            "Change VLAN subnet",
            "Modify VLAN DHCP settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "vlan_id": VLAN_ID_SCHEMA,
                "name": {"type": "string", "description": "Name of the VLAN"},
                "subnet": {"type": "string", "description": "Subnet of the VLAN"},
                "appliance_ip": {"type": "string", "description": "Gateway IP of the VLAN"},
                "dhcp_handling": {"type": "string", "description": "DHCP handling: Run a DHCP server, Relay DHCP to another server, or Do not respond to DHCP requests"},
                "dns_nameservers": {"type": "string", "description": "DNS nameservers"},
            },
            "required": ["network_id", "vlan_id"],
        },
    },
    {
        "id": "appliance_delete_vlan",
        "name": "Delete VLAN",
        "description": "Delete a VLAN from an MX network",
        "tags": ["meraki", "appliance", "vlans", "network", "delete"],
        "examples": [
            "Delete VLAN 20",
            "Remove the guest VLAN",
            "Delete unused VLAN",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "vlan_id": VLAN_ID_SCHEMA,
            },
            "required": ["network_id", "vlan_id"],
        },
    },
    {
        "id": "appliance_get_vlans_settings",
        "name": "Get VLANs Settings",
        "description": "Get VLAN settings for an MX network (whether VLANs are enabled)",
        "tags": ["meraki", "appliance", "vlans", "settings"],
        "examples": [
            "Are VLANs enabled?",
            "Check VLAN settings",
            "Is this network using VLANs?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_vlans_settings",
        "name": "Update VLANs Settings",
        "description": "Enable or disable VLANs for an MX network",
        "tags": ["meraki", "appliance", "vlans", "settings", "update"],
        "examples": [
            "Enable VLANs on this network",
            "Disable VLAN mode",
            "Turn on VLAN routing",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "vlans_enabled": {"type": "boolean", "description": "Enable or disable VLANs"},
            },
            "required": ["network_id", "vlans_enabled"],
        },
    },
]

# L3 Firewall Rules Skills
L3_FIREWALL_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_l3_firewall_rules",
        "name": "Get L3 Firewall Rules",
        "description": "Get the L3 firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "l3", "security", "rules"],
        "examples": [
            "Show firewall rules",
            "What are the L3 firewall rules?",
            "List firewall policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_l3_firewall_rules",
        "name": "Update L3 Firewall Rules",
        "description": "Update the L3 firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "l3", "security", "rules", "update"],
        "examples": [
            "Add a firewall rule",
            "Block traffic to 10.0.0.0/8",
            "Update firewall policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "Array of firewall rules",
                    "items": {
                        "type": "object",
                        "properties": {
                            "comment": {"type": "string"},
                            "policy": {"type": "string", "enum": ["allow", "deny"]},
                            "protocol": {"type": "string"},
                            "src_port": {"type": "string"},
                            "src_cidr": {"type": "string"},
                            "dest_port": {"type": "string"},
                            "dest_cidr": {"type": "string"},
                            "syslog_enabled": {"type": "boolean"},
                        },
                    },
                },
            },
            "required": ["network_id", "rules"],
        },
    },
]

# L7 Firewall Rules Skills
L7_FIREWALL_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_l7_firewall_rules",
        "name": "Get L7 Firewall Rules",
        "description": "Get the L7 firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "l7", "security", "application"],
        "examples": [
            "Show L7 firewall rules",
            "What applications are blocked?",
            "List application firewall policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_l7_firewall_rules",
        "name": "Update L7 Firewall Rules",
        "description": "Update the L7 firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "l7", "security", "application", "update"],
        "examples": [
            "Block Facebook",
            "Add L7 rule to block streaming",
            "Update application policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "Array of L7 firewall rules",
                    "items": {
                        "type": "object",
                        "properties": {
                            "policy": {"type": "string", "enum": ["deny"]},
                            "type": {"type": "string", "description": "Type: application, applicationCategory, host, port, ipRange"},
                            "value": {"type": "string", "description": "Value based on type"},
                        },
                    },
                },
            },
            "required": ["network_id", "rules"],
        },
    },
    {
        "id": "appliance_get_l7_firewall_categories",
        "name": "Get L7 Application Categories",
        "description": "Get the L7 firewall application categories for an MX network",
        "tags": ["meraki", "appliance", "firewall", "l7", "categories", "applications"],
        "examples": [
            "What application categories are available?",
            "List L7 categories",
            "Show application categories for firewall",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
]

# Inbound Firewall Rules Skills
INBOUND_FIREWALL_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_inbound_firewall_rules",
        "name": "Get Inbound Firewall Rules",
        "description": "Get the inbound firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "inbound", "security"],
        "examples": [
            "Show inbound firewall rules",
            "What's the inbound firewall policy?",
            "List inbound rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_inbound_firewall_rules",
        "name": "Update Inbound Firewall Rules",
        "description": "Update the inbound firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "inbound", "security", "update"],
        "examples": [
            "Add inbound firewall rule",
            "Block inbound traffic from IP",
            "Update inbound policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "Array of inbound firewall rules",
                },
                "syslog_default_rule": {"type": "boolean", "description": "Log default rule hits"},
            },
            "required": ["network_id"],
        },
    },
]

# Cellular Firewall Rules Skills
CELLULAR_FIREWALL_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_cellular_firewall_rules",
        "name": "Get Cellular Firewall Rules",
        "description": "Get the cellular firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "cellular", "security"],
        "examples": [
            "Show cellular firewall rules",
            "What's the cellular firewall policy?",
            "List cellular uplink rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_cellular_firewall_rules",
        "name": "Update Cellular Firewall Rules",
        "description": "Update the cellular firewall rules for an MX network",
        "tags": ["meraki", "appliance", "firewall", "cellular", "security", "update"],
        "examples": [
            "Add cellular firewall rule",
            "Block traffic on cellular uplink",
            "Update cellular policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "Array of cellular firewall rules",
                },
            },
            "required": ["network_id"],
        },
    },
]

# NAT & Port Forwarding Skills
NAT_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_port_forwarding_rules",
        "name": "Get Port Forwarding Rules",
        "description": "Get the port forwarding rules for an MX network",
        "tags": ["meraki", "appliance", "nat", "port-forwarding", "rules"],
        "examples": [
            "Show port forwarding rules",
            "What ports are forwarded?",
            "List NAT rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_port_forwarding_rules",
        "name": "Update Port Forwarding Rules",
        "description": "Update the port forwarding rules for an MX network",
        "tags": ["meraki", "appliance", "nat", "port-forwarding", "rules", "update"],
        "examples": [
            "Add port forwarding rule",
            "Forward port 443 to internal server",
            "Update NAT rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "Array of port forwarding rules",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "lan_ip": {"type": "string"},
                            "public_port": {"type": "string"},
                            "local_port": {"type": "string"},
                            "allowed_ips": {"type": "array", "items": {"type": "string"}},
                            "protocol": {"type": "string", "enum": ["tcp", "udp"]},
                            "uplink": {"type": "string", "enum": ["internet1", "internet2", "both"]},
                        },
                    },
                },
            },
            "required": ["network_id", "rules"],
        },
    },
    {
        "id": "appliance_get_one_to_one_nat_rules",
        "name": "Get 1:1 NAT Rules",
        "description": "Get the 1:1 NAT mappings for an MX network",
        "tags": ["meraki", "appliance", "nat", "one-to-one", "rules"],
        "examples": [
            "Show 1:1 NAT mappings",
            "What are the one-to-one NAT rules?",
            "List static NAT rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_one_to_one_nat_rules",
        "name": "Update 1:1 NAT Rules",
        "description": "Update the 1:1 NAT mappings for an MX network",
        "tags": ["meraki", "appliance", "nat", "one-to-one", "rules", "update"],
        "examples": [
            "Add 1:1 NAT mapping",
            "Configure static NAT",
            "Update one-to-one NAT",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "Array of 1:1 NAT rules",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "lan_ip": {"type": "string"},
                            "public_ip": {"type": "string"},
                            "uplink": {"type": "string"},
                            "allowed_inbound": {"type": "array"},
                        },
                    },
                },
            },
            "required": ["network_id", "rules"],
        },
    },
    {
        "id": "appliance_get_one_to_many_nat_rules",
        "name": "Get 1:Many NAT Rules",
        "description": "Get the 1:Many NAT mappings for an MX network",
        "tags": ["meraki", "appliance", "nat", "one-to-many", "rules"],
        "examples": [
            "Show 1:Many NAT mappings",
            "What are the PAT rules?",
            "List port address translation rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_one_to_many_nat_rules",
        "name": "Update 1:Many NAT Rules",
        "description": "Update the 1:Many NAT mappings for an MX network",
        "tags": ["meraki", "appliance", "nat", "one-to-many", "rules", "update"],
        "examples": [
            "Add 1:Many NAT mapping",
            "Configure PAT rules",
            "Update port address translation",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "Array of 1:Many NAT rules",
                },
            },
            "required": ["network_id", "rules"],
        },
    },
]

# Security Skills
SECURITY_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_security_intrusion",
        "name": "Get Intrusion Detection Settings",
        "description": "Get the intrusion detection settings for an MX network",
        "tags": ["meraki", "appliance", "security", "intrusion", "ids", "ips"],
        "examples": [
            "Show intrusion detection settings",
            "Is IDS enabled?",
            "What's the IPS configuration?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_security_intrusion",
        "name": "Update Intrusion Detection Settings",
        "description": "Update the intrusion detection settings for an MX network",
        "tags": ["meraki", "appliance", "security", "intrusion", "ids", "ips", "update"],
        "examples": [
            "Enable intrusion detection",
            "Configure IDS mode",
            "Set IPS to prevention mode",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "mode": {"type": "string", "description": "Mode: disabled, detection, prevention"},
                "ids_rulesets": {"type": "string", "description": "Ruleset: connectivity, balanced, security"},
                "protected_networks": {"type": "object", "description": "Protected networks configuration"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_security_malware",
        "name": "Get Malware Settings",
        "description": "Get the malware protection settings for an MX network",
        "tags": ["meraki", "appliance", "security", "malware", "amp"],
        "examples": [
            "Show malware protection settings",
            "Is AMP enabled?",
            "What's the malware configuration?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_security_malware",
        "name": "Update Malware Settings",
        "description": "Update the malware protection settings for an MX network",
        "tags": ["meraki", "appliance", "security", "malware", "amp", "update"],
        "examples": [
            "Enable malware protection",
            "Configure AMP settings",
            "Turn on anti-malware",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "mode": {"type": "string", "description": "Mode: disabled, enabled"},
                "allowed_urls": {"type": "array", "items": {"type": "object"}, "description": "Allowed URLs"},
                "allowed_files": {"type": "array", "items": {"type": "object"}, "description": "Allowed file hashes"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_security_events",
        "name": "Get Security Events",
        "description": "Get security events for an MX network",
        "tags": ["meraki", "appliance", "security", "events", "logs"],
        "examples": [
            "Show security events",
            "What security threats were detected?",
            "List malware events",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time (ISO8601 or epoch)"},
                "t1": {"type": "string", "description": "End time (ISO8601 or epoch)"},
                "timespan": {"type": "number", "description": "Timespan in seconds (max 365 days)"},
                "per_page": {"type": "integer", "description": "Number of entries per page (max 1000)"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_org_security_events",
        "name": "Get Organization Security Events",
        "description": "Get security events for an organization",
        "tags": ["meraki", "appliance", "security", "events", "organization"],
        "examples": [
            "Show all security events across the org",
            "What threats were detected organization-wide?",
            "List org security incidents",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds"},
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["organization_id"],
        },
    },
]

# Content Filtering Skills
CONTENT_FILTERING_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_content_filtering",
        "name": "Get Content Filtering",
        "description": "Get the content filtering settings for an MX network",
        "tags": ["meraki", "appliance", "content-filtering", "security", "web"],
        "examples": [
            "Show content filtering settings",
            "What websites are blocked?",
            "List content filter rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_content_filtering",
        "name": "Update Content Filtering",
        "description": "Update the content filtering settings for an MX network",
        "tags": ["meraki", "appliance", "content-filtering", "security", "web", "update"],
        "examples": [
            "Block adult content",
            "Add URL to blocklist",
            "Update content filter categories",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "allowed_url_patterns": {"type": "array", "items": {"type": "string"}, "description": "Allowed URL patterns"},
                "blocked_url_patterns": {"type": "array", "items": {"type": "string"}, "description": "Blocked URL patterns"},
                "blocked_url_categories": {"type": "array", "items": {"type": "object"}, "description": "Blocked URL categories"},
                "url_category_list_size": {"type": "string", "description": "Size of category list: topSites or fullList"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_content_filtering_categories",
        "name": "Get Content Filtering Categories",
        "description": "Get the content filtering categories available for an MX network",
        "tags": ["meraki", "appliance", "content-filtering", "categories"],
        "examples": [
            "What content categories are available?",
            "List URL categories",
            "Show content filtering category options",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
]

# VPN Skills
VPN_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_site_to_site_vpn",
        "name": "Get Site-to-Site VPN",
        "description": "Get the site-to-site VPN settings for an MX network",
        "tags": ["meraki", "appliance", "vpn", "site-to-site", "wan"],
        "examples": [
            "Show site-to-site VPN settings",
            "What's the VPN configuration?",
            "Is this network a VPN hub?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_site_to_site_vpn",
        "name": "Update Site-to-Site VPN",
        "description": "Update the site-to-site VPN settings for an MX network",
        "tags": ["meraki", "appliance", "vpn", "site-to-site", "wan", "update"],
        "examples": [
            "Configure site-to-site VPN",
            "Set network as VPN spoke",
            "Enable Auto VPN",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "mode": {"type": "string", "description": "Mode: none, hub, spoke"},
                "hubs": {"type": "array", "items": {"type": "object"}, "description": "Hub networks for spoke"},
                "subnets": {"type": "array", "items": {"type": "object"}, "description": "VPN subnets"},
            },
            "required": ["network_id", "mode"],
        },
    },
    {
        "id": "appliance_get_vpn_bgp",
        "name": "Get VPN BGP",
        "description": "Get the BGP settings for an MX network VPN",
        "tags": ["meraki", "appliance", "vpn", "bgp", "routing"],
        "examples": [
            "Show BGP settings",
            "What's the BGP configuration?",
            "Is BGP enabled on this VPN?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_vpn_bgp",
        "name": "Update VPN BGP",
        "description": "Update the BGP settings for an MX network VPN",
        "tags": ["meraki", "appliance", "vpn", "bgp", "routing", "update"],
        "examples": [
            "Enable BGP",
            "Configure BGP neighbors",
            "Update BGP AS number",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "enabled": {"type": "boolean", "description": "Enable or disable BGP"},
                "as_number": {"type": "integer", "description": "BGP AS number"},
                "ibgp_hold_timer": {"type": "integer", "description": "IBGP hold timer"},
                "neighbors": {"type": "array", "items": {"type": "object"}, "description": "BGP neighbors"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_third_party_vpn_peers",
        "name": "Get Third Party VPN Peers",
        "description": "Get the third party VPN peers for an organization",
        "tags": ["meraki", "appliance", "vpn", "third-party", "ipsec"],
        "examples": [
            "Show third party VPN peers",
            "What IPSec VPN tunnels are configured?",
            "List non-Meraki VPN connections",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "appliance_update_third_party_vpn_peers",
        "name": "Update Third Party VPN Peers",
        "description": "Update the third party VPN peers for an organization",
        "tags": ["meraki", "appliance", "vpn", "third-party", "ipsec", "update"],
        "examples": [
            "Add third party VPN peer",
            "Configure IPSec tunnel",
            "Update non-Meraki VPN settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "peers": {
                    "type": "array",
                    "description": "Array of third party VPN peers",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "public_ip": {"type": "string"},
                            "private_subnets": {"type": "array", "items": {"type": "string"}},
                            "ipsec_policies": {"type": "object"},
                            "ipsec_policies_preset": {"type": "string"},
                            "secret": {"type": "string"},
                            "network_tags": {"type": "array", "items": {"type": "string"}},
                        },
                    },
                },
            },
            "required": ["organization_id", "peers"],
        },
    },
    {
        "id": "appliance_get_vpn_statuses",
        "name": "Get VPN Statuses",
        "description": "Get the VPN statuses for all networks in an organization",
        "tags": ["meraki", "appliance", "vpn", "status", "organization"],
        "examples": [
            "Show VPN statuses across the org",
            "Which VPN tunnels are up?",
            "Check VPN connectivity",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "network_ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by network IDs"},
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "appliance_get_vpn_stats",
        "name": "Get VPN Stats",
        "description": "Get VPN tunnel statistics for an organization",
        "tags": ["meraki", "appliance", "vpn", "stats", "metrics"],
        "examples": [
            "Show VPN tunnel statistics",
            "What's the VPN throughput?",
            "Check VPN performance",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds"},
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "network_ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by network IDs"},
            },
            "required": ["organization_id"],
        },
    },
]

# Traffic Shaping Skills
TRAFFIC_SHAPING_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_traffic_shaping",
        "name": "Get Traffic Shaping",
        "description": "Get the traffic shaping settings for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "qos"],
        "examples": [
            "Show traffic shaping settings",
            "What's the QoS configuration?",
            "Check traffic shaping policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_traffic_shaping",
        "name": "Update Traffic Shaping",
        "description": "Update the traffic shaping settings for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "qos", "update"],
        "examples": [
            "Enable traffic shaping",
            "Configure QoS settings",
            "Update shaping rules",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "global_bandwidth_limits": {
                    "type": "object",
                    "description": "Global bandwidth limits",
                    "properties": {
                        "limit_up": {"type": "integer"},
                        "limit_down": {"type": "integer"},
                    },
                },
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_traffic_shaping_rules",
        "name": "Get Traffic Shaping Rules",
        "description": "Get the traffic shaping rules for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "rules"],
        "examples": [
            "Show traffic shaping rules",
            "What applications have shaping rules?",
            "List traffic priorities",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_traffic_shaping_rules",
        "name": "Update Traffic Shaping Rules",
        "description": "Update the traffic shaping rules for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "rules", "update"],
        "examples": [
            "Add traffic shaping rule",
            "Prioritize video conferencing",
            "Limit streaming bandwidth",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "default_rules_enabled": {"type": "boolean", "description": "Enable default rules"},
                "rules": {
                    "type": "array",
                    "description": "Traffic shaping rules",
                    "items": {
                        "type": "object",
                        "properties": {
                            "definitions": {"type": "array"},
                            "per_client_bandwidth_limits": {"type": "object"},
                            "dscp_tag_value": {"type": "integer"},
                            "priority": {"type": "string"},
                        },
                    },
                },
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_uplink_bandwidth",
        "name": "Get Uplink Bandwidth",
        "description": "Get the uplink bandwidth settings for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "uplink", "bandwidth"],
        "examples": [
            "Show uplink bandwidth settings",
            "What's the configured WAN bandwidth?",
            "Check uplink speed limits",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_uplink_bandwidth",
        "name": "Update Uplink Bandwidth",
        "description": "Update the uplink bandwidth settings for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "uplink", "bandwidth", "update"],
        "examples": [
            "Set uplink bandwidth",
            "Configure WAN1 speed",
            "Update uplink limits",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "bandwidth_limits": {
                    "type": "object",
                    "description": "Bandwidth limits per uplink",
                    "properties": {
                        "wan1": {
                            "type": "object",
                            "properties": {
                                "limit_up": {"type": "integer"},
                                "limit_down": {"type": "integer"},
                            },
                        },
                        "wan2": {
                            "type": "object",
                            "properties": {
                                "limit_up": {"type": "integer"},
                                "limit_down": {"type": "integer"},
                            },
                        },
                        "cellular": {
                            "type": "object",
                            "properties": {
                                "limit_up": {"type": "integer"},
                                "limit_down": {"type": "integer"},
                            },
                        },
                    },
                },
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_uplink_selection",
        "name": "Get Uplink Selection",
        "description": "Get the SD-WAN uplink selection settings for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "uplink", "sd-wan"],
        "examples": [
            "Show uplink selection settings",
            "What's the SD-WAN configuration?",
            "Check uplink failover policy",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_uplink_selection",
        "name": "Update Uplink Selection",
        "description": "Update the SD-WAN uplink selection settings for an MX network",
        "tags": ["meraki", "appliance", "traffic-shaping", "uplink", "sd-wan", "update"],
        "examples": [
            "Configure SD-WAN policies",
            "Set uplink failover preferences",
            "Update traffic flow preferences",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "active_active_auto_vpn_enabled": {"type": "boolean", "description": "Enable active-active VPN"},
                "default_uplink": {"type": "string", "description": "Default uplink"},
                "load_balancing_enabled": {"type": "boolean", "description": "Enable load balancing"},
                "failover_and_failback": {"type": "object", "description": "Failover/failback settings"},
                "wan_traffic_uplink_preferences": {"type": "array", "description": "WAN traffic preferences"},
                "vpn_traffic_uplink_preferences": {"type": "array", "description": "VPN traffic preferences"},
            },
            "required": ["network_id"],
        },
    },
]

# Static Routes Skills
STATIC_ROUTES_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_list_static_routes",
        "name": "List Static Routes",
        "description": "List the static routes for an MX network",
        "tags": ["meraki", "appliance", "static-routes", "routing"],
        "examples": [
            "Show static routes",
            "What routes are configured?",
            "List routing table",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_static_route",
        "name": "Get Static Route",
        "description": "Get a specific static route for an MX network",
        "tags": ["meraki", "appliance", "static-routes", "routing", "get"],
        "examples": [
            "Get route details",
            "Show specific static route",
            "Check route configuration",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "static_route_id": ROUTE_ID_SCHEMA,
            },
            "required": ["network_id", "static_route_id"],
        },
    },
    {
        "id": "appliance_create_static_route",
        "name": "Create Static Route",
        "description": "Create a static route for an MX network",
        "tags": ["meraki", "appliance", "static-routes", "routing", "create"],
        "examples": [
            "Add static route",
            "Create route to 10.0.0.0/8",
            "Add new routing entry",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "name": {"type": "string", "description": "Route name"},
                "subnet": {"type": "string", "description": "Destination subnet"},
                "gateway_ip": {"type": "string", "description": "Next hop IP (or VLAN ID)"},
                "gateway_vlan_id": {"type": "string", "description": "Gateway VLAN ID"},
            },
            "required": ["network_id", "name", "subnet"],
        },
    },
    {
        "id": "appliance_update_static_route",
        "name": "Update Static Route",
        "description": "Update a static route for an MX network",
        "tags": ["meraki", "appliance", "static-routes", "routing", "update"],
        "examples": [
            "Update static route",
            "Change route gateway",
            "Modify routing entry",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "static_route_id": ROUTE_ID_SCHEMA,
                "name": {"type": "string", "description": "Route name"},
                "subnet": {"type": "string", "description": "Destination subnet"},
                "gateway_ip": {"type": "string", "description": "Next hop IP"},
                "gateway_vlan_id": {"type": "string", "description": "Gateway VLAN ID"},
                "enabled": {"type": "boolean", "description": "Enable or disable route"},
            },
            "required": ["network_id", "static_route_id"],
        },
    },
    {
        "id": "appliance_delete_static_route",
        "name": "Delete Static Route",
        "description": "Delete a static route from an MX network",
        "tags": ["meraki", "appliance", "static-routes", "routing", "delete"],
        "examples": [
            "Delete static route",
            "Remove route",
            "Delete routing entry",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "static_route_id": ROUTE_ID_SCHEMA,
            },
            "required": ["network_id", "static_route_id"],
        },
    },
]

# Ports Skills
PORTS_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_list_ports",
        "name": "List Appliance Ports",
        "description": "List the per-port VLAN settings for an MX appliance",
        "tags": ["meraki", "appliance", "ports", "vlans"],
        "examples": [
            "Show appliance ports",
            "What ports are configured?",
            "List MX port settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_get_port",
        "name": "Get Appliance Port",
        "description": "Get the per-port VLAN settings for a specific port on an MX appliance",
        "tags": ["meraki", "appliance", "ports", "get"],
        "examples": [
            "Get port 3 settings",
            "Show specific port configuration",
            "Check port VLAN assignment",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "port_id": PORT_ID_SCHEMA,
            },
            "required": ["network_id", "port_id"],
        },
    },
    {
        "id": "appliance_update_port",
        "name": "Update Appliance Port",
        "description": "Update the per-port VLAN settings for a specific port on an MX appliance",
        "tags": ["meraki", "appliance", "ports", "update"],
        "examples": [
            "Update port 3 settings",
            "Change port VLAN",
            "Configure port as trunk",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "port_id": PORT_ID_SCHEMA,
                "enabled": {"type": "boolean", "description": "Enable or disable port"},
                "drop_untagged_traffic": {"type": "boolean", "description": "Drop untagged traffic"},
                "type": {"type": "string", "description": "Port type: trunk or access"},
                "vlan": {"type": "integer", "description": "Native VLAN (trunk) or access VLAN"},
                "allowed_vlans": {"type": "string", "description": "Comma-separated list of allowed VLANs for trunk"},
                "access_policy": {"type": "string", "description": "Access policy: open or 802.1X"},
            },
            "required": ["network_id", "port_id"],
        },
    },
]

# Uplinks Skills
UPLINKS_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_uplinks_settings",
        "name": "Get Uplinks Settings",
        "description": "Get the uplink settings for an MX appliance",
        "tags": ["meraki", "appliance", "uplinks", "wan", "settings"],
        "examples": [
            "Show uplink settings",
            "What's the WAN configuration?",
            "Check uplink IP addresses",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
            },
            "required": ["serial"],
        },
    },
    {
        "id": "appliance_update_uplinks_settings",
        "name": "Update Uplinks Settings",
        "description": "Update the uplink settings for an MX appliance",
        "tags": ["meraki", "appliance", "uplinks", "wan", "settings", "update"],
        "examples": [
            "Configure WAN1 IP",
            "Set static IP on uplink",
            "Update uplink configuration",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "interfaces": {
                    "type": "object",
                    "description": "Uplink interface settings",
                    "properties": {
                        "wan1": {
                            "type": "object",
                            "properties": {
                                "enabled": {"type": "boolean"},
                                "vlan_tagging": {"type": "object"},
                                "svis": {"type": "object"},
                                "pppoe": {"type": "object"},
                            },
                        },
                        "wan2": {
                            "type": "object",
                            "properties": {
                                "enabled": {"type": "boolean"},
                                "vlan_tagging": {"type": "object"},
                                "svis": {"type": "object"},
                                "pppoe": {"type": "object"},
                            },
                        },
                    },
                },
            },
            "required": ["serial"],
        },
    },
    {
        "id": "appliance_get_uplink_statuses",
        "name": "Get Uplink Statuses",
        "description": "Get the uplink statuses for all MX appliances in an organization",
        "tags": ["meraki", "appliance", "uplinks", "status", "organization"],
        "examples": [
            "Show all uplink statuses",
            "Which WAN uplinks are online?",
            "Check uplink connectivity",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "per_page": {"type": "integer", "description": "Number of entries per page"},
                "network_ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by network IDs"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Filter by device serials"},
                "iccids": {"type": "array", "items": {"type": "string"}, "description": "Filter by cellular ICCIDs"},
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "appliance_get_uplinks_usage",
        "name": "Get Uplinks Usage",
        "description": "Get the usage history for uplinks in a network",
        "tags": ["meraki", "appliance", "uplinks", "usage", "bandwidth"],
        "examples": [
            "Show uplink usage",
            "How much bandwidth is each WAN using?",
            "Check uplink utilization history",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "t1": {"type": "string", "description": "End time"},
                "timespan": {"type": "number", "description": "Timespan in seconds"},
                "resolution": {"type": "integer", "description": "Sample resolution in seconds"},
            },
            "required": ["network_id"],
        },
    },
]

# Single LAN Skills
SINGLE_LAN_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_single_lan",
        "name": "Get Single LAN",
        "description": "Get the single LAN configuration for an MX network",
        "tags": ["meraki", "appliance", "single-lan", "lan"],
        "examples": [
            "Show single LAN settings",
            "What's the LAN configuration?",
            "Check single LAN IP",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_single_lan",
        "name": "Update Single LAN",
        "description": "Update the single LAN configuration for an MX network",
        "tags": ["meraki", "appliance", "single-lan", "lan", "update"],
        "examples": [
            "Configure single LAN",
            "Set LAN subnet",
            "Update LAN IP settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "subnet": {"type": "string", "description": "LAN subnet"},
                "appliance_ip": {"type": "string", "description": "Appliance IP on LAN"},
            },
            "required": ["network_id"],
        },
    },
]

# DHCP & Performance Skills
DHCP_PERFORMANCE_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_dhcp_subnets",
        "name": "Get DHCP Subnets",
        "description": "Get the DHCP subnets served by an MX appliance",
        "tags": ["meraki", "appliance", "dhcp", "subnets"],
        "examples": [
            "Show DHCP subnets",
            "What DHCP pools are configured?",
            "List DHCP scopes",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
            },
            "required": ["serial"],
        },
    },
    {
        "id": "appliance_get_performance",
        "name": "Get Appliance Performance",
        "description": "Get the performance score for an MX appliance",
        "tags": ["meraki", "appliance", "performance", "score"],
        "examples": [
            "Show appliance performance",
            "What's the MX performance score?",
            "Check appliance health",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
            },
            "required": ["serial"],
        },
    },
]

# Warm Spare Skills
WARM_SPARE_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_warm_spare",
        "name": "Get Warm Spare",
        "description": "Get the warm spare settings for an MX network",
        "tags": ["meraki", "appliance", "warm-spare", "ha", "failover"],
        "examples": [
            "Show warm spare settings",
            "Is high availability configured?",
            "Check failover configuration",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_update_warm_spare",
        "name": "Update Warm Spare",
        "description": "Update the warm spare settings for an MX network",
        "tags": ["meraki", "appliance", "warm-spare", "ha", "failover", "update"],
        "examples": [
            "Configure warm spare",
            "Enable high availability",
            "Set up failover",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "enabled": {"type": "boolean", "description": "Enable or disable warm spare"},
                "spare_serial": {"type": "string", "description": "Serial number of spare MX"},
                "uplink_mode": {"type": "string", "description": "Uplink mode: virtual or active-passive"},
                "virtual_ip1": {"type": "string", "description": "Virtual IP for WAN1"},
                "virtual_ip2": {"type": "string", "description": "Virtual IP for WAN2"},
            },
            "required": ["network_id", "enabled"],
        },
    },
    {
        "id": "appliance_swap_warm_spare",
        "name": "Swap Warm Spare",
        "description": "Swap the primary and spare MX appliances",
        "tags": ["meraki", "appliance", "warm-spare", "swap", "failover"],
        "examples": [
            "Swap to spare MX",
            "Failover to secondary",
            "Switch to backup appliance",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
]

# Prefixes & Delegated Skills (IPv6)
PREFIXES_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_prefixes_delegated_statics",
        "name": "Get Delegated Static Prefixes",
        "description": "Get the static delegated prefixes for an MX network",
        "tags": ["meraki", "appliance", "prefixes", "ipv6", "delegated"],
        "examples": [
            "Show static delegated prefixes",
            "What IPv6 prefixes are configured?",
            "List delegated statics",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "appliance_create_prefixes_delegated_static",
        "name": "Create Delegated Static Prefix",
        "description": "Create a static delegated prefix for an MX network",
        "tags": ["meraki", "appliance", "prefixes", "ipv6", "delegated", "create"],
        "examples": [
            "Add IPv6 delegated prefix",
            "Create static prefix",
            "Configure IPv6 delegation",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "prefix": {"type": "string", "description": "IPv6 prefix"},
                "origin": {"type": "object", "description": "Origin information"},
                "description": {"type": "string", "description": "Description"},
            },
            "required": ["network_id", "prefix", "origin"],
        },
    },
    {
        "id": "appliance_update_prefixes_delegated_static",
        "name": "Update Delegated Static Prefix",
        "description": "Update a static delegated prefix for an MX network",
        "tags": ["meraki", "appliance", "prefixes", "ipv6", "delegated", "update"],
        "examples": [
            "Update IPv6 delegated prefix",
            "Modify static prefix",
            "Change prefix configuration",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "static_delegated_prefix_id": {"type": "string", "description": "Static delegated prefix ID"},
                "prefix": {"type": "string", "description": "IPv6 prefix"},
                "origin": {"type": "object", "description": "Origin information"},
                "description": {"type": "string", "description": "Description"},
            },
            "required": ["network_id", "static_delegated_prefix_id"],
        },
    },
    {
        "id": "appliance_delete_prefixes_delegated_static",
        "name": "Delete Delegated Static Prefix",
        "description": "Delete a static delegated prefix from an MX network",
        "tags": ["meraki", "appliance", "prefixes", "ipv6", "delegated", "delete"],
        "examples": [
            "Delete IPv6 delegated prefix",
            "Remove static prefix",
            "Delete prefix configuration",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "static_delegated_prefix_id": {"type": "string", "description": "Static delegated prefix ID"},
            },
            "required": ["network_id", "static_delegated_prefix_id"],
        },
    },
]

# SDWAN Settings Skills
SDWAN_SKILLS: List[SkillDefinition] = [
    {
        "id": "appliance_get_sdwan_internet_policies",
        "name": "Get SD-WAN Internet Policies",
        "description": "Get the SD-WAN internet policies for an organization",
        "tags": ["meraki", "appliance", "sdwan", "policies", "internet"],
        "examples": [
            "Show SD-WAN policies",
            "What internet policies are configured?",
            "List SD-WAN traffic policies",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
            },
            "required": ["organization_id"],
        },
    },
    {
        "id": "appliance_update_sdwan_internet_policies",
        "name": "Update SD-WAN Internet Policies",
        "description": "Update the SD-WAN internet policies for an organization",
        "tags": ["meraki", "appliance", "sdwan", "policies", "internet", "update"],
        "examples": [
            "Configure SD-WAN policies",
            "Update internet traffic policies",
            "Set SD-WAN routing preferences",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": ORG_ID_SCHEMA,
                "wan_traffic_uplink_preferences": {
                    "type": "array",
                    "description": "WAN traffic uplink preferences",
                },
            },
            "required": ["organization_id"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class ApplianceModule(MerakiSkillModule):
    """Appliance (MX) skills module."""

    MODULE_NAME = "appliance"
    MODULE_PREFIX = "appliance_"

    # Combine all skill definitions
    ALL_SKILLS: List[SkillDefinition] = (
        VLAN_SKILLS
        + L3_FIREWALL_SKILLS
        + L7_FIREWALL_SKILLS
        + INBOUND_FIREWALL_SKILLS
        + CELLULAR_FIREWALL_SKILLS
        + NAT_SKILLS
        + SECURITY_SKILLS
        + CONTENT_FILTERING_SKILLS
        + VPN_SKILLS
        + TRAFFIC_SHAPING_SKILLS
        + STATIC_ROUTES_SKILLS
        + PORTS_SKILLS
        + UPLINKS_SKILLS
        + SINGLE_LAN_SKILLS
        + DHCP_PERFORMANCE_SKILLS
        + WARM_SPARE_SKILLS
        + PREFIXES_SKILLS
        + SDWAN_SKILLS
    )

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all appliance skills."""
        return [create_skill(skill_def) for skill_def in cls.ALL_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Execute an appliance skill."""
        log_skill_start(skill_id, params)

        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed to execute {skill_id}: {str(e)}")

    @classmethod
    async def _execute_skill(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Internal skill execution dispatcher."""
        # Extract common parameters
        network_id = params.get("network_id") or extract_network_entities(params, context)
        org_id = params.get("organization_id") or extract_org_entities(params, context)
        serial = params.get("serial") or extract_device_entities(params, context)

        # VLANs
        if skill_id == "appliance_list_vlans":
            return await api_get(client, f"/networks/{network_id}/appliance/vlans")

        if skill_id == "appliance_get_vlan":
            vlan_id = params.get("vlan_id")
            return await api_get(client, f"/networks/{network_id}/appliance/vlans/{vlan_id}")

        if skill_id == "appliance_create_vlan":
            body = {
                "id": params.get("id"),
                "name": params.get("name"),
                "subnet": params.get("subnet"),
                "applianceIp": params.get("appliance_ip"),
            }
            return await api_post(client, f"/networks/{network_id}/appliance/vlans", body)

        if skill_id == "appliance_update_vlan":
            vlan_id = params.get("vlan_id")
            body = {}
            if params.get("name"):
                body["name"] = params["name"]
            if params.get("subnet"):
                body["subnet"] = params["subnet"]
            if params.get("appliance_ip"):
                body["applianceIp"] = params["appliance_ip"]
            if params.get("dhcp_handling"):
                body["dhcpHandling"] = params["dhcp_handling"]
            if params.get("dns_nameservers"):
                body["dnsNameservers"] = params["dns_nameservers"]
            return await api_put(client, f"/networks/{network_id}/appliance/vlans/{vlan_id}", body)

        if skill_id == "appliance_delete_vlan":
            vlan_id = params.get("vlan_id")
            return await api_delete(client, f"/networks/{network_id}/appliance/vlans/{vlan_id}")

        if skill_id == "appliance_get_vlans_settings":
            return await api_get(client, f"/networks/{network_id}/appliance/vlans/settings")

        if skill_id == "appliance_update_vlans_settings":
            body = {"vlansEnabled": params.get("vlans_enabled")}
            return await api_put(client, f"/networks/{network_id}/appliance/vlans/settings", body)

        # L3 Firewall
        if skill_id == "appliance_get_l3_firewall_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/l3FirewallRules")

        if skill_id == "appliance_update_l3_firewall_rules":
            body = {"rules": params.get("rules", [])}
            return await api_put(client, f"/networks/{network_id}/appliance/firewall/l3FirewallRules", body)

        # L7 Firewall
        if skill_id == "appliance_get_l7_firewall_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/l7FirewallRules")

        if skill_id == "appliance_update_l7_firewall_rules":
            body = {"rules": params.get("rules", [])}
            return await api_put(client, f"/networks/{network_id}/appliance/firewall/l7FirewallRules", body)

        if skill_id == "appliance_get_l7_firewall_categories":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/l7FirewallRules/applicationCategories")

        # Inbound Firewall
        if skill_id == "appliance_get_inbound_firewall_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/inboundFirewallRules")

        if skill_id == "appliance_update_inbound_firewall_rules":
            body = {}
            if params.get("rules"):
                body["rules"] = params["rules"]
            if params.get("syslog_default_rule") is not None:
                body["syslogDefaultRule"] = params["syslog_default_rule"]
            return await api_put(client, f"/networks/{network_id}/appliance/firewall/inboundFirewallRules", body)

        # Cellular Firewall
        if skill_id == "appliance_get_cellular_firewall_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/cellularFirewallRules")

        if skill_id == "appliance_update_cellular_firewall_rules":
            body = {"rules": params.get("rules", [])}
            return await api_put(client, f"/networks/{network_id}/appliance/firewall/cellularFirewallRules", body)

        # NAT & Port Forwarding
        if skill_id == "appliance_get_port_forwarding_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/portForwardingRules")

        if skill_id == "appliance_update_port_forwarding_rules":
            body = {"rules": params.get("rules", [])}
            return await api_put(client, f"/networks/{network_id}/appliance/firewall/portForwardingRules", body)

        if skill_id == "appliance_get_one_to_one_nat_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/oneToOneNatRules")

        if skill_id == "appliance_update_one_to_one_nat_rules":
            body = {"rules": params.get("rules", [])}
            return await api_put(client, f"/networks/{network_id}/appliance/firewall/oneToOneNatRules", body)

        if skill_id == "appliance_get_one_to_many_nat_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/firewall/oneToManyNatRules")

        if skill_id == "appliance_update_one_to_many_nat_rules":
            body = {"rules": params.get("rules", [])}
            return await api_put(client, f"/networks/{network_id}/appliance/firewall/oneToManyNatRules", body)

        # Security
        if skill_id == "appliance_get_security_intrusion":
            return await api_get(client, f"/networks/{network_id}/appliance/security/intrusion")

        if skill_id == "appliance_update_security_intrusion":
            body = {}
            if params.get("mode"):
                body["mode"] = params["mode"]
            if params.get("ids_rulesets"):
                body["idsRulesets"] = params["ids_rulesets"]
            if params.get("protected_networks"):
                body["protectedNetworks"] = params["protected_networks"]
            return await api_put(client, f"/networks/{network_id}/appliance/security/intrusion", body)

        if skill_id == "appliance_get_security_malware":
            return await api_get(client, f"/networks/{network_id}/appliance/security/malware")

        if skill_id == "appliance_update_security_malware":
            body = {}
            if params.get("mode"):
                body["mode"] = params["mode"]
            if params.get("allowed_urls"):
                body["allowedUrls"] = params["allowed_urls"]
            if params.get("allowed_files"):
                body["allowedFiles"] = params["allowed_files"]
            return await api_put(client, f"/networks/{network_id}/appliance/security/malware", body)

        if skill_id == "appliance_get_security_events":
            query_params = cls._build_query_params(params, ["t0", "t1", "timespan", "per_page"])
            return await api_get(client, f"/networks/{network_id}/appliance/security/events", query_params)

        if skill_id == "appliance_get_org_security_events":
            query_params = cls._build_query_params(params, ["t0", "t1", "timespan", "per_page"])
            return await api_get(client, f"/organizations/{org_id}/appliance/security/events", query_params)

        # Content Filtering
        if skill_id == "appliance_get_content_filtering":
            return await api_get(client, f"/networks/{network_id}/appliance/contentFiltering")

        if skill_id == "appliance_update_content_filtering":
            body = {}
            if params.get("allowed_url_patterns"):
                body["allowedUrlPatterns"] = params["allowed_url_patterns"]
            if params.get("blocked_url_patterns"):
                body["blockedUrlPatterns"] = params["blocked_url_patterns"]
            if params.get("blocked_url_categories"):
                body["blockedUrlCategories"] = params["blocked_url_categories"]
            if params.get("url_category_list_size"):
                body["urlCategoryListSize"] = params["url_category_list_size"]
            return await api_put(client, f"/networks/{network_id}/appliance/contentFiltering", body)

        if skill_id == "appliance_get_content_filtering_categories":
            return await api_get(client, f"/networks/{network_id}/appliance/contentFiltering/categories")

        # VPN
        if skill_id == "appliance_get_site_to_site_vpn":
            return await api_get(client, f"/networks/{network_id}/appliance/vpn/siteToSiteVpn")

        if skill_id == "appliance_update_site_to_site_vpn":
            body = {"mode": params.get("mode")}
            if params.get("hubs"):
                body["hubs"] = params["hubs"]
            if params.get("subnets"):
                body["subnets"] = params["subnets"]
            return await api_put(client, f"/networks/{network_id}/appliance/vpn/siteToSiteVpn", body)

        if skill_id == "appliance_get_vpn_bgp":
            return await api_get(client, f"/networks/{network_id}/appliance/vpn/bgp")

        if skill_id == "appliance_update_vpn_bgp":
            body = {}
            if params.get("enabled") is not None:
                body["enabled"] = params["enabled"]
            if params.get("as_number"):
                body["asNumber"] = params["as_number"]
            if params.get("ibgp_hold_timer"):
                body["ibgpHoldTimer"] = params["ibgp_hold_timer"]
            if params.get("neighbors"):
                body["neighbors"] = params["neighbors"]
            return await api_put(client, f"/networks/{network_id}/appliance/vpn/bgp", body)

        if skill_id == "appliance_get_third_party_vpn_peers":
            return await api_get(client, f"/organizations/{org_id}/appliance/vpn/thirdPartyVPNPeers")

        if skill_id == "appliance_update_third_party_vpn_peers":
            body = {"peers": params.get("peers", [])}
            return await api_put(client, f"/organizations/{org_id}/appliance/vpn/thirdPartyVPNPeers", body)

        if skill_id == "appliance_get_vpn_statuses":
            query_params = cls._build_query_params(params, ["per_page", "network_ids"])
            return await api_get(client, f"/organizations/{org_id}/appliance/vpn/statuses", query_params)

        if skill_id == "appliance_get_vpn_stats":
            query_params = cls._build_query_params(params, ["t0", "t1", "timespan", "per_page", "network_ids"])
            return await api_get(client, f"/organizations/{org_id}/appliance/vpn/stats", query_params)

        # Traffic Shaping
        if skill_id == "appliance_get_traffic_shaping":
            return await api_get(client, f"/networks/{network_id}/appliance/trafficShaping")

        if skill_id == "appliance_update_traffic_shaping":
            body = {}
            if params.get("global_bandwidth_limits"):
                body["globalBandwidthLimits"] = params["global_bandwidth_limits"]
            return await api_put(client, f"/networks/{network_id}/appliance/trafficShaping", body)

        if skill_id == "appliance_get_traffic_shaping_rules":
            return await api_get(client, f"/networks/{network_id}/appliance/trafficShaping/rules")

        if skill_id == "appliance_update_traffic_shaping_rules":
            body = {}
            if params.get("default_rules_enabled") is not None:
                body["defaultRulesEnabled"] = params["default_rules_enabled"]
            if params.get("rules"):
                body["rules"] = params["rules"]
            return await api_put(client, f"/networks/{network_id}/appliance/trafficShaping/rules", body)

        if skill_id == "appliance_get_uplink_bandwidth":
            return await api_get(client, f"/networks/{network_id}/appliance/trafficShaping/uplinkBandwidth")

        if skill_id == "appliance_update_uplink_bandwidth":
            body = {}
            if params.get("bandwidth_limits"):
                body["bandwidthLimits"] = params["bandwidth_limits"]
            return await api_put(client, f"/networks/{network_id}/appliance/trafficShaping/uplinkBandwidth", body)

        if skill_id == "appliance_get_uplink_selection":
            return await api_get(client, f"/networks/{network_id}/appliance/trafficShaping/uplinkSelection")

        if skill_id == "appliance_update_uplink_selection":
            body = {}
            for key in ["active_active_auto_vpn_enabled", "default_uplink", "load_balancing_enabled",
                       "failover_and_failback", "wan_traffic_uplink_preferences", "vpn_traffic_uplink_preferences"]:
                if params.get(key) is not None:
                    camel_key = cls._to_camel_case(key)
                    body[camel_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/appliance/trafficShaping/uplinkSelection", body)

        # Static Routes
        if skill_id == "appliance_list_static_routes":
            return await api_get(client, f"/networks/{network_id}/appliance/staticRoutes")

        if skill_id == "appliance_get_static_route":
            route_id = params.get("static_route_id")
            return await api_get(client, f"/networks/{network_id}/appliance/staticRoutes/{route_id}")

        if skill_id == "appliance_create_static_route":
            body = {
                "name": params.get("name"),
                "subnet": params.get("subnet"),
            }
            if params.get("gateway_ip"):
                body["gatewayIp"] = params["gateway_ip"]
            if params.get("gateway_vlan_id"):
                body["gatewayVlanId"] = params["gateway_vlan_id"]
            return await api_post(client, f"/networks/{network_id}/appliance/staticRoutes", body)

        if skill_id == "appliance_update_static_route":
            route_id = params.get("static_route_id")
            body = {}
            for key in ["name", "subnet", "gateway_ip", "gateway_vlan_id", "enabled"]:
                if params.get(key) is not None:
                    camel_key = cls._to_camel_case(key)
                    body[camel_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/appliance/staticRoutes/{route_id}", body)

        if skill_id == "appliance_delete_static_route":
            route_id = params.get("static_route_id")
            return await api_delete(client, f"/networks/{network_id}/appliance/staticRoutes/{route_id}")

        # Ports
        if skill_id == "appliance_list_ports":
            return await api_get(client, f"/networks/{network_id}/appliance/ports")

        if skill_id == "appliance_get_port":
            port_id = params.get("port_id")
            return await api_get(client, f"/networks/{network_id}/appliance/ports/{port_id}")

        if skill_id == "appliance_update_port":
            port_id = params.get("port_id")
            body = {}
            for key in ["enabled", "drop_untagged_traffic", "type", "vlan", "allowed_vlans", "access_policy"]:
                if params.get(key) is not None:
                    camel_key = cls._to_camel_case(key)
                    body[camel_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/appliance/ports/{port_id}", body)

        # Uplinks
        if skill_id == "appliance_get_uplinks_settings":
            return await api_get(client, f"/devices/{serial}/appliance/uplinks/settings")

        if skill_id == "appliance_update_uplinks_settings":
            body = {}
            if params.get("interfaces"):
                body["interfaces"] = params["interfaces"]
            return await api_put(client, f"/devices/{serial}/appliance/uplinks/settings", body)

        if skill_id == "appliance_get_uplink_statuses":
            query_params = cls._build_query_params(params, ["per_page", "network_ids", "serials", "iccids"])
            return await api_get(client, f"/organizations/{org_id}/appliance/uplink/statuses", query_params)

        if skill_id == "appliance_get_uplinks_usage":
            query_params = cls._build_query_params(params, ["t0", "t1", "timespan", "resolution"])
            return await api_get(client, f"/networks/{network_id}/appliance/uplinks/usageHistory", query_params)

        # Single LAN
        if skill_id == "appliance_get_single_lan":
            return await api_get(client, f"/networks/{network_id}/appliance/singleLan")

        if skill_id == "appliance_update_single_lan":
            body = {}
            if params.get("subnet"):
                body["subnet"] = params["subnet"]
            if params.get("appliance_ip"):
                body["applianceIp"] = params["appliance_ip"]
            return await api_put(client, f"/networks/{network_id}/appliance/singleLan", body)

        # DHCP & Performance
        if skill_id == "appliance_get_dhcp_subnets":
            return await api_get(client, f"/devices/{serial}/appliance/dhcp/subnets")

        if skill_id == "appliance_get_performance":
            return await api_get(client, f"/devices/{serial}/appliance/performance")

        # Warm Spare
        if skill_id == "appliance_get_warm_spare":
            return await api_get(client, f"/networks/{network_id}/appliance/warmSpare")

        if skill_id == "appliance_update_warm_spare":
            body = {"enabled": params.get("enabled")}
            for key in ["spare_serial", "uplink_mode", "virtual_ip1", "virtual_ip2"]:
                if params.get(key) is not None:
                    camel_key = cls._to_camel_case(key)
                    body[camel_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/appliance/warmSpare", body)

        if skill_id == "appliance_swap_warm_spare":
            return await api_post(client, f"/networks/{network_id}/appliance/warmSpare/swap", {})

        # Prefixes
        if skill_id == "appliance_get_prefixes_delegated_statics":
            return await api_get(client, f"/networks/{network_id}/appliance/prefixes/delegated/statics")

        if skill_id == "appliance_create_prefixes_delegated_static":
            body = {
                "prefix": params.get("prefix"),
                "origin": params.get("origin"),
            }
            if params.get("description"):
                body["description"] = params["description"]
            return await api_post(client, f"/networks/{network_id}/appliance/prefixes/delegated/statics", body)

        if skill_id == "appliance_update_prefixes_delegated_static":
            prefix_id = params.get("static_delegated_prefix_id")
            body = {}
            for key in ["prefix", "origin", "description"]:
                if params.get(key) is not None:
                    body[key] = params[key]
            return await api_put(client, f"/networks/{network_id}/appliance/prefixes/delegated/statics/{prefix_id}", body)

        if skill_id == "appliance_delete_prefixes_delegated_static":
            prefix_id = params.get("static_delegated_prefix_id")
            return await api_delete(client, f"/networks/{network_id}/appliance/prefixes/delegated/statics/{prefix_id}")

        # SD-WAN
        if skill_id == "appliance_get_sdwan_internet_policies":
            return await api_get(client, f"/organizations/{org_id}/appliance/sdwan/internetPolicies")

        if skill_id == "appliance_update_sdwan_internet_policies":
            body = {}
            if params.get("wan_traffic_uplink_preferences"):
                body["wanTrafficUplinkPreferences"] = params["wan_traffic_uplink_preferences"]
            return await api_put(client, f"/organizations/{org_id}/appliance/sdwan/internetPolicies", body)

        # Unknown skill
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    def _build_query_params(cls, params: Dict[str, Any], keys: List[str]) -> Dict[str, Any]:
        """Build query parameters from params dict."""
        query_params = {}
        for key in keys:
            if params.get(key) is not None:
                # Convert snake_case to camelCase for API
                camel_key = cls._to_camel_case(key)
                query_params[camel_key] = params[key]
        return query_params

    @classmethod
    def _to_camel_case(cls, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])
