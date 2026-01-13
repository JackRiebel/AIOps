"""
Meraki Switch skill module.

This module provides skills for MS switches including:
- Ports (list, get, update, cycle, statuses)
- Stacks (CRUD, add/remove devices)
- Routing (interfaces, static routes, OSPF, multicast)
- Access Policies (CRUD)
- ACLs
- QoS Rules
- DHCP Server Policy
- Link Aggregation
- MTU
- Port Schedules
- Settings
- Warm Spare
- DSCP/CoS Mappings
- STP
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

# Common schemas for switch operations
PORT_ID_SCHEMA = {
    "type": "string",
    "description": "Port ID (e.g., '1', '2')"
}

STACK_ID_SCHEMA = {
    "type": "string",
    "description": "Stack ID"
}

INTERFACE_ID_SCHEMA = {
    "type": "string",
    "description": "Interface ID"
}

STATIC_ROUTE_ID_SCHEMA = {
    "type": "string",
    "description": "Static route ID"
}

POLICY_ID_SCHEMA = {
    "type": "string",
    "description": "Access policy ID"
}

QOS_RULE_ID_SCHEMA = {
    "type": "string",
    "description": "QoS rule ID"
}

LINK_AGG_ID_SCHEMA = {
    "type": "string",
    "description": "Link aggregation ID"
}

SCHEDULE_ID_SCHEMA = {
    "type": "string",
    "description": "Port schedule ID"
}

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

# Port Skills
PORT_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_ports",
        "name": "List Switch Ports",
        "description": "List the switch ports for a switch",
        "tags": ["meraki", "switch", "ports", "list"],
        "examples": [
            "Show switch ports",
            "List all ports on the switch",
            "What ports are configured?",
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
        "id": "switch_get_port",
        "name": "Get Switch Port",
        "description": "Get a specific switch port configuration",
        "tags": ["meraki", "switch", "ports", "get"],
        "examples": [
            "Get port 1 configuration",
            "Show port 24 settings",
            "What's the config for port 5?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "port_id": PORT_ID_SCHEMA,
            },
            "required": ["serial", "port_id"],
        },
    },
    {
        "id": "switch_update_port",
        "name": "Update Switch Port",
        "description": "Update a switch port configuration",
        "tags": ["meraki", "switch", "ports", "update", "configure"],
        "examples": [
            "Update port 1 VLAN",
            "Set port 24 to access mode",
            "Configure port 5 as trunk",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "port_id": PORT_ID_SCHEMA,
                "name": {"type": "string", "description": "Port name"},
                "tags": {"type": "array", "items": {"type": "string"}, "description": "Port tags"},
                "enabled": {"type": "boolean", "description": "Enable or disable port"},
                "poe_enabled": {"type": "boolean", "description": "Enable or disable PoE"},
                "type": {"type": "string", "description": "Port type: access or trunk"},
                "vlan": {"type": "integer", "description": "VLAN ID for access port"},
                "voice_vlan": {"type": "integer", "description": "Voice VLAN ID"},
                "allowed_vlans": {"type": "string", "description": "Allowed VLANs for trunk (e.g., '1,2,3' or 'all')"},
                "isolation_enabled": {"type": "boolean", "description": "Port isolation"},
                "rstp_enabled": {"type": "boolean", "description": "RSTP enabled"},
                "stp_guard": {"type": "string", "description": "STP guard: disabled, root guard, BPDU guard, loop guard"},
                "link_negotiation": {"type": "string", "description": "Link negotiation: Auto negotiate, 1 Gigabit full duplex, etc."},
                "port_schedule_id": {"type": "string", "description": "Port schedule ID"},
                "udld": {"type": "string", "description": "UDLD: Alert only, Enforce"},
                "access_policy_type": {"type": "string", "description": "Access policy type"},
                "access_policy_number": {"type": "integer", "description": "Access policy number"},
                "mac_allow_list": {"type": "array", "items": {"type": "string"}, "description": "MAC allow list"},
                "sticky_mac_allow_list": {"type": "array", "items": {"type": "string"}, "description": "Sticky MAC allow list"},
                "sticky_mac_allow_list_limit": {"type": "integer", "description": "Sticky MAC limit"},
                "storm_control_enabled": {"type": "boolean", "description": "Storm control enabled"},
                "flexible_stacking_enabled": {"type": "boolean", "description": "Flexible stacking"},
                "dai_trusted": {"type": "boolean", "description": "Dynamic ARP inspection trusted"},
            },
            "required": ["serial", "port_id"],
        },
    },
    {
        "id": "switch_cycle_ports",
        "name": "Cycle Switch Ports",
        "description": "Cycle (power off then on) switch ports on a switch",
        "tags": ["meraki", "switch", "ports", "cycle", "poe", "reset"],
        "examples": [
            "Cycle port 1",
            "Reset ports 1-4",
            "Power cycle port 24",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "ports": {"type": "array", "items": {"type": "string"}, "description": "Ports to cycle (e.g., ['1', '2', '3'])"},
            },
            "required": ["serial", "ports"],
        },
    },
    {
        "id": "switch_get_ports_statuses",
        "name": "Get Switch Ports Statuses",
        "description": "Get the status of all switch ports on a switch",
        "tags": ["meraki", "switch", "ports", "status"],
        "examples": [
            "Show port statuses",
            "Which ports are up?",
            "What's the link status on all ports?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "timespan": {"type": "number", "description": "Timespan in seconds (max 31 days)"},
            },
            "required": ["serial"],
        },
    },
    {
        "id": "switch_get_ports_statuses_packets",
        "name": "Get Switch Ports Packets",
        "description": "Get the packet counters for all switch ports",
        "tags": ["meraki", "switch", "ports", "packets", "counters"],
        "examples": [
            "Show port packet counters",
            "How many packets on each port?",
            "Get port traffic stats",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "timespan": {"type": "number", "description": "Timespan in seconds (max 31 days)"},
            },
            "required": ["serial"],
        },
    },
]

# Stack Skills
STACK_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_stacks",
        "name": "List Switch Stacks",
        "description": "List the switch stacks in a network",
        "tags": ["meraki", "switch", "stacks", "list"],
        "examples": [
            "Show switch stacks",
            "List all stacks",
            "What switch stacks exist?",
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
        "id": "switch_create_stack",
        "name": "Create Switch Stack",
        "description": "Create a switch stack in a network",
        "tags": ["meraki", "switch", "stacks", "create"],
        "examples": [
            "Create a new switch stack",
            "Stack these switches together",
            "Set up a switch stack",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "name": {"type": "string", "description": "Stack name"},
                "serials": {"type": "array", "items": {"type": "string"}, "description": "Serials of switches to stack"},
            },
            "required": ["network_id", "name", "serials"],
        },
    },
    {
        "id": "switch_get_stack",
        "name": "Get Switch Stack",
        "description": "Get a specific switch stack",
        "tags": ["meraki", "switch", "stacks", "get"],
        "examples": [
            "Get stack details",
            "Show stack configuration",
            "What switches are in this stack?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "stack_id": STACK_ID_SCHEMA,
            },
            "required": ["network_id", "stack_id"],
        },
    },
    {
        "id": "switch_delete_stack",
        "name": "Delete Switch Stack",
        "description": "Delete a switch stack",
        "tags": ["meraki", "switch", "stacks", "delete"],
        "examples": [
            "Delete the switch stack",
            "Remove stack",
            "Unstack switches",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "stack_id": STACK_ID_SCHEMA,
            },
            "required": ["network_id", "stack_id"],
        },
    },
    {
        "id": "switch_add_to_stack",
        "name": "Add Switch to Stack",
        "description": "Add a switch to an existing stack",
        "tags": ["meraki", "switch", "stacks", "add"],
        "examples": [
            "Add switch to stack",
            "Include this switch in the stack",
            "Join switch to stack",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "stack_id": STACK_ID_SCHEMA,
                "serial": {"type": "string", "description": "Serial of switch to add"},
            },
            "required": ["network_id", "stack_id", "serial"],
        },
    },
    {
        "id": "switch_remove_from_stack",
        "name": "Remove Switch from Stack",
        "description": "Remove a switch from a stack",
        "tags": ["meraki", "switch", "stacks", "remove"],
        "examples": [
            "Remove switch from stack",
            "Take this switch out of the stack",
            "Unstack this switch",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "stack_id": STACK_ID_SCHEMA,
                "serial": {"type": "string", "description": "Serial of switch to remove"},
            },
            "required": ["network_id", "stack_id", "serial"],
        },
    },
]

# Routing Interface Skills
ROUTING_INTERFACE_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_routing_interfaces",
        "name": "List Routing Interfaces",
        "description": "List layer 3 routing interfaces on a switch",
        "tags": ["meraki", "switch", "routing", "interfaces", "l3"],
        "examples": [
            "Show routing interfaces",
            "List L3 interfaces",
            "What SVIs are configured?",
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
        "id": "switch_create_routing_interface",
        "name": "Create Routing Interface",
        "description": "Create a layer 3 routing interface on a switch",
        "tags": ["meraki", "switch", "routing", "interfaces", "create"],
        "examples": [
            "Create SVI for VLAN 10",
            "Add layer 3 interface",
            "Create routing interface",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "name": {"type": "string", "description": "Interface name"},
                "subnet": {"type": "string", "description": "Interface subnet (e.g., 192.168.1.0/24)"},
                "interface_ip": {"type": "string", "description": "Interface IP address"},
                "vlan_id": {"type": "integer", "description": "VLAN ID"},
                "default_gateway": {"type": "string", "description": "Default gateway IP"},
                "ospf_settings": {"type": "object", "description": "OSPF settings"},
                "ospf_v3": {"type": "object", "description": "OSPFv3 settings"},
                "ipv6": {"type": "object", "description": "IPv6 settings"},
            },
            "required": ["serial", "name", "vlan_id"],
        },
    },
    {
        "id": "switch_get_routing_interface",
        "name": "Get Routing Interface",
        "description": "Get a specific layer 3 routing interface",
        "tags": ["meraki", "switch", "routing", "interfaces", "get"],
        "examples": [
            "Get routing interface details",
            "Show SVI configuration",
            "What's the IP for this interface?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "interface_id": INTERFACE_ID_SCHEMA,
            },
            "required": ["serial", "interface_id"],
        },
    },
    {
        "id": "switch_update_routing_interface",
        "name": "Update Routing Interface",
        "description": "Update a layer 3 routing interface",
        "tags": ["meraki", "switch", "routing", "interfaces", "update"],
        "examples": [
            "Update SVI IP address",
            "Change interface subnet",
            "Modify routing interface",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "interface_id": INTERFACE_ID_SCHEMA,
                "name": {"type": "string", "description": "Interface name"},
                "subnet": {"type": "string", "description": "Interface subnet"},
                "interface_ip": {"type": "string", "description": "Interface IP address"},
                "vlan_id": {"type": "integer", "description": "VLAN ID"},
                "default_gateway": {"type": "string", "description": "Default gateway IP"},
                "ospf_settings": {"type": "object", "description": "OSPF settings"},
                "ospf_v3": {"type": "object", "description": "OSPFv3 settings"},
                "ipv6": {"type": "object", "description": "IPv6 settings"},
            },
            "required": ["serial", "interface_id"],
        },
    },
    {
        "id": "switch_delete_routing_interface",
        "name": "Delete Routing Interface",
        "description": "Delete a layer 3 routing interface",
        "tags": ["meraki", "switch", "routing", "interfaces", "delete"],
        "examples": [
            "Delete SVI",
            "Remove routing interface",
            "Delete layer 3 interface",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "interface_id": INTERFACE_ID_SCHEMA,
            },
            "required": ["serial", "interface_id"],
        },
    },
]

# Static Route Skills
STATIC_ROUTE_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_static_routes",
        "name": "List Switch Static Routes",
        "description": "List layer 3 static routes on a switch",
        "tags": ["meraki", "switch", "routing", "static-routes", "list"],
        "examples": [
            "Show static routes",
            "List switch routes",
            "What routes are configured?",
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
        "id": "switch_create_static_route",
        "name": "Create Switch Static Route",
        "description": "Create a layer 3 static route on a switch",
        "tags": ["meraki", "switch", "routing", "static-routes", "create"],
        "examples": [
            "Add static route",
            "Create route to 10.0.0.0/8",
            "Add routing entry",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "name": {"type": "string", "description": "Route name"},
                "subnet": {"type": "string", "description": "Destination subnet"},
                "next_hop_ip": {"type": "string", "description": "Next hop IP address"},
                "advertise_via_ospf_enabled": {"type": "boolean", "description": "Advertise via OSPF"},
                "prefer_over_ospf_routes_enabled": {"type": "boolean", "description": "Prefer over OSPF routes"},
            },
            "required": ["serial", "subnet", "next_hop_ip"],
        },
    },
    {
        "id": "switch_get_static_route",
        "name": "Get Switch Static Route",
        "description": "Get a specific layer 3 static route",
        "tags": ["meraki", "switch", "routing", "static-routes", "get"],
        "examples": [
            "Get route details",
            "Show static route configuration",
            "What's the next hop for this route?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "static_route_id": STATIC_ROUTE_ID_SCHEMA,
            },
            "required": ["serial", "static_route_id"],
        },
    },
    {
        "id": "switch_update_static_route",
        "name": "Update Switch Static Route",
        "description": "Update a layer 3 static route",
        "tags": ["meraki", "switch", "routing", "static-routes", "update"],
        "examples": [
            "Update static route",
            "Change route next hop",
            "Modify routing entry",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "static_route_id": STATIC_ROUTE_ID_SCHEMA,
                "name": {"type": "string", "description": "Route name"},
                "subnet": {"type": "string", "description": "Destination subnet"},
                "next_hop_ip": {"type": "string", "description": "Next hop IP address"},
                "advertise_via_ospf_enabled": {"type": "boolean", "description": "Advertise via OSPF"},
                "prefer_over_ospf_routes_enabled": {"type": "boolean", "description": "Prefer over OSPF routes"},
            },
            "required": ["serial", "static_route_id"],
        },
    },
    {
        "id": "switch_delete_static_route",
        "name": "Delete Switch Static Route",
        "description": "Delete a layer 3 static route",
        "tags": ["meraki", "switch", "routing", "static-routes", "delete"],
        "examples": [
            "Delete static route",
            "Remove route",
            "Delete routing entry",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "static_route_id": STATIC_ROUTE_ID_SCHEMA,
            },
            "required": ["serial", "static_route_id"],
        },
    },
]

# OSPF Skills
OSPF_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_ospf",
        "name": "Get Switch OSPF",
        "description": "Get the OSPF routing settings for a network",
        "tags": ["meraki", "switch", "routing", "ospf"],
        "examples": [
            "Show OSPF settings",
            "Is OSPF enabled?",
            "What's the OSPF configuration?",
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
        "id": "switch_update_ospf",
        "name": "Update Switch OSPF",
        "description": "Update the OSPF routing settings for a network",
        "tags": ["meraki", "switch", "routing", "ospf", "update"],
        "examples": [
            "Enable OSPF",
            "Configure OSPF router ID",
            "Update OSPF areas",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "enabled": {"type": "boolean", "description": "Enable or disable OSPF"},
                "hello_timer_in_seconds": {"type": "integer", "description": "Hello timer in seconds"},
                "dead_timer_in_seconds": {"type": "integer", "description": "Dead timer in seconds"},
                "areas": {"type": "array", "items": {"type": "object"}, "description": "OSPF areas"},
                "v3": {"type": "object", "description": "OSPFv3 settings"},
                "md5_authentication_enabled": {"type": "boolean", "description": "Enable MD5 authentication"},
                "md5_authentication_key": {"type": "object", "description": "MD5 authentication key"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "switch_get_multicast",
        "name": "Get Switch Multicast",
        "description": "Get the multicast settings for a network",
        "tags": ["meraki", "switch", "routing", "multicast"],
        "examples": [
            "Show multicast settings",
            "Is multicast enabled?",
            "What's the multicast configuration?",
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
        "id": "switch_update_multicast",
        "name": "Update Switch Multicast",
        "description": "Update the multicast settings for a network",
        "tags": ["meraki", "switch", "routing", "multicast", "update"],
        "examples": [
            "Enable multicast",
            "Configure IGMP snooping",
            "Update multicast settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "default_settings": {"type": "object", "description": "Default multicast settings"},
                "overrides": {"type": "array", "items": {"type": "object"}, "description": "Override settings"},
            },
            "required": ["network_id"],
        },
    },
]

# Access Policy Skills
ACCESS_POLICY_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_access_policies",
        "name": "List Access Policies",
        "description": "List the access policies for a network",
        "tags": ["meraki", "switch", "access-policies", "802.1x", "list"],
        "examples": [
            "Show access policies",
            "List 802.1X policies",
            "What access policies exist?",
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
        "id": "switch_create_access_policy",
        "name": "Create Access Policy",
        "description": "Create an access policy for a network",
        "tags": ["meraki", "switch", "access-policies", "802.1x", "create"],
        "examples": [
            "Create 802.1X policy",
            "Add access policy",
            "Set up new access policy",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "name": {"type": "string", "description": "Policy name"},
                "radius_servers": {"type": "array", "items": {"type": "object"}, "description": "RADIUS servers"},
                "radius_testing_enabled": {"type": "boolean", "description": "Enable RADIUS testing"},
                "radius_coa_support_enabled": {"type": "boolean", "description": "Enable RADIUS CoA"},
                "radius_accounting_enabled": {"type": "boolean", "description": "Enable RADIUS accounting"},
                "radius_accounting_servers": {"type": "array", "items": {"type": "object"}, "description": "RADIUS accounting servers"},
                "radius_group_attribute": {"type": "string", "description": "RADIUS group attribute"},
                "host_mode": {"type": "string", "description": "Host mode: Single-Host, Multi-Domain, Multi-Host, Multi-Auth"},
                "access_policy_type": {"type": "string", "description": "Policy type"},
                "increase_access_speed": {"type": "boolean", "description": "Increase access speed"},
                "guest_vlan_id": {"type": "integer", "description": "Guest VLAN ID"},
                "dot1x": {"type": "object", "description": "802.1X settings"},
                "voice_vlan_clients": {"type": "boolean", "description": "Voice VLAN clients"},
                "url_redirect_walled_garden_enabled": {"type": "boolean", "description": "Enable URL redirect walled garden"},
                "url_redirect_walled_garden_ranges": {"type": "array", "items": {"type": "string"}, "description": "Walled garden ranges"},
            },
            "required": ["network_id", "name", "radius_servers"],
        },
    },
    {
        "id": "switch_get_access_policy",
        "name": "Get Access Policy",
        "description": "Get a specific access policy",
        "tags": ["meraki", "switch", "access-policies", "802.1x", "get"],
        "examples": [
            "Get access policy details",
            "Show 802.1X policy configuration",
            "What's in this access policy?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "access_policy_number": {"type": "string", "description": "Access policy number"},
            },
            "required": ["network_id", "access_policy_number"],
        },
    },
    {
        "id": "switch_update_access_policy",
        "name": "Update Access Policy",
        "description": "Update an access policy",
        "tags": ["meraki", "switch", "access-policies", "802.1x", "update"],
        "examples": [
            "Update 802.1X policy",
            "Change access policy settings",
            "Modify RADIUS servers",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "access_policy_number": {"type": "string", "description": "Access policy number"},
                "name": {"type": "string", "description": "Policy name"},
                "radius_servers": {"type": "array", "items": {"type": "object"}, "description": "RADIUS servers"},
                "radius_testing_enabled": {"type": "boolean", "description": "Enable RADIUS testing"},
                "radius_coa_support_enabled": {"type": "boolean", "description": "Enable RADIUS CoA"},
                "host_mode": {"type": "string", "description": "Host mode"},
                "guest_vlan_id": {"type": "integer", "description": "Guest VLAN ID"},
            },
            "required": ["network_id", "access_policy_number"],
        },
    },
    {
        "id": "switch_delete_access_policy",
        "name": "Delete Access Policy",
        "description": "Delete an access policy",
        "tags": ["meraki", "switch", "access-policies", "802.1x", "delete"],
        "examples": [
            "Delete access policy",
            "Remove 802.1X policy",
            "Delete this policy",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "access_policy_number": {"type": "string", "description": "Access policy number"},
            },
            "required": ["network_id", "access_policy_number"],
        },
    },
]

# ACL Skills
ACL_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_acls",
        "name": "Get Switch ACLs",
        "description": "Get the access control lists for a network",
        "tags": ["meraki", "switch", "acls", "security"],
        "examples": [
            "Show switch ACLs",
            "List access control lists",
            "What ACL rules exist?",
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
        "id": "switch_update_acls",
        "name": "Update Switch ACLs",
        "description": "Update the access control lists for a network",
        "tags": ["meraki", "switch", "acls", "security", "update"],
        "examples": [
            "Update ACL rules",
            "Add ACL entry",
            "Modify access control list",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rules": {
                    "type": "array",
                    "description": "ACL rules",
                    "items": {
                        "type": "object",
                        "properties": {
                            "comment": {"type": "string"},
                            "policy": {"type": "string", "enum": ["allow", "deny"]},
                            "ip_version": {"type": "string", "enum": ["any", "ipv4", "ipv6"]},
                            "protocol": {"type": "string"},
                            "src_cidr": {"type": "string"},
                            "src_port": {"type": "string"},
                            "dst_cidr": {"type": "string"},
                            "dst_port": {"type": "string"},
                            "vlan": {"type": "string"},
                        },
                    },
                },
            },
            "required": ["network_id", "rules"],
        },
    },
]

# QoS Rules Skills
QOS_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_qos_rules",
        "name": "List QoS Rules",
        "description": "List the QoS rules for a network",
        "tags": ["meraki", "switch", "qos", "quality-of-service", "list"],
        "examples": [
            "Show QoS rules",
            "List quality of service rules",
            "What QoS policies exist?",
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
        "id": "switch_create_qos_rule",
        "name": "Create QoS Rule",
        "description": "Create a QoS rule for a network",
        "tags": ["meraki", "switch", "qos", "quality-of-service", "create"],
        "examples": [
            "Create QoS rule",
            "Add quality of service policy",
            "Set up QoS for voice traffic",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "vlan": {"type": "integer", "description": "VLAN ID"},
                "protocol": {"type": "string", "description": "Protocol: ANY, TCP, UDP"},
                "src_port": {"type": "integer", "description": "Source port"},
                "src_port_range": {"type": "string", "description": "Source port range"},
                "dst_port": {"type": "integer", "description": "Destination port"},
                "dst_port_range": {"type": "string", "description": "Destination port range"},
                "dscp": {"type": "integer", "description": "DSCP value (0-63)"},
            },
            "required": ["network_id", "vlan"],
        },
    },
    {
        "id": "switch_get_qos_rule",
        "name": "Get QoS Rule",
        "description": "Get a specific QoS rule",
        "tags": ["meraki", "switch", "qos", "quality-of-service", "get"],
        "examples": [
            "Get QoS rule details",
            "Show specific QoS policy",
            "What's in this QoS rule?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "qos_rule_id": QOS_RULE_ID_SCHEMA,
            },
            "required": ["network_id", "qos_rule_id"],
        },
    },
    {
        "id": "switch_update_qos_rule",
        "name": "Update QoS Rule",
        "description": "Update a QoS rule",
        "tags": ["meraki", "switch", "qos", "quality-of-service", "update"],
        "examples": [
            "Update QoS rule",
            "Change DSCP value",
            "Modify QoS policy",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "qos_rule_id": QOS_RULE_ID_SCHEMA,
                "vlan": {"type": "integer", "description": "VLAN ID"},
                "protocol": {"type": "string", "description": "Protocol"},
                "src_port": {"type": "integer", "description": "Source port"},
                "dst_port": {"type": "integer", "description": "Destination port"},
                "dscp": {"type": "integer", "description": "DSCP value"},
            },
            "required": ["network_id", "qos_rule_id"],
        },
    },
    {
        "id": "switch_delete_qos_rule",
        "name": "Delete QoS Rule",
        "description": "Delete a QoS rule",
        "tags": ["meraki", "switch", "qos", "quality-of-service", "delete"],
        "examples": [
            "Delete QoS rule",
            "Remove QoS policy",
            "Delete this rule",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "qos_rule_id": QOS_RULE_ID_SCHEMA,
            },
            "required": ["network_id", "qos_rule_id"],
        },
    },
    {
        "id": "switch_get_qos_rules_order",
        "name": "Get QoS Rules Order",
        "description": "Get the order of QoS rules for a network",
        "tags": ["meraki", "switch", "qos", "order"],
        "examples": [
            "Show QoS rule order",
            "What's the QoS priority?",
            "Get QoS rules sequence",
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
        "id": "switch_update_qos_rules_order",
        "name": "Update QoS Rules Order",
        "description": "Update the order of QoS rules for a network",
        "tags": ["meraki", "switch", "qos", "order", "update"],
        "examples": [
            "Reorder QoS rules",
            "Change QoS priority",
            "Update QoS sequence",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rule_ids": {"type": "array", "items": {"type": "string"}, "description": "Ordered list of rule IDs"},
            },
            "required": ["network_id", "rule_ids"],
        },
    },
]

# DHCP Skills
DHCP_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_dhcp_servers_seen",
        "name": "Get DHCP Servers Seen",
        "description": "Get the DHCP servers seen by switches in a network",
        "tags": ["meraki", "switch", "dhcp", "servers"],
        "examples": [
            "Show DHCP servers seen",
            "What DHCP servers are on the network?",
            "List detected DHCP servers",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "t0": {"type": "string", "description": "Start time"},
                "timespan": {"type": "number", "description": "Timespan in seconds (max 31 days)"},
                "per_page": {"type": "integer", "description": "Number of entries per page"},
            },
            "required": ["network_id"],
        },
    },
    {
        "id": "switch_get_dhcp_server_policy",
        "name": "Get DHCP Server Policy",
        "description": "Get the DHCP server policy for a network",
        "tags": ["meraki", "switch", "dhcp", "policy"],
        "examples": [
            "Show DHCP server policy",
            "What's the DHCP snooping policy?",
            "Get DHCP policy settings",
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
        "id": "switch_update_dhcp_server_policy",
        "name": "Update DHCP Server Policy",
        "description": "Update the DHCP server policy for a network",
        "tags": ["meraki", "switch", "dhcp", "policy", "update"],
        "examples": [
            "Update DHCP policy",
            "Enable DHCP snooping",
            "Configure DHCP server policy",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "default_policy": {"type": "string", "description": "Default policy: allow or block"},
                "allowed_servers": {"type": "array", "items": {"type": "string"}, "description": "Allowed DHCP server IPs"},
                "blocked_servers": {"type": "array", "items": {"type": "string"}, "description": "Blocked DHCP server IPs"},
                "arp_inspection": {"type": "object", "description": "ARP inspection settings"},
                "alerts": {"type": "object", "description": "Alert settings"},
            },
            "required": ["network_id"],
        },
    },
]

# Link Aggregation Skills
LINK_AGG_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_link_aggregations",
        "name": "List Link Aggregations",
        "description": "List the link aggregations for a network",
        "tags": ["meraki", "switch", "link-aggregation", "lag", "list"],
        "examples": [
            "Show link aggregations",
            "List LAGs",
            "What port channels exist?",
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
        "id": "switch_create_link_aggregation",
        "name": "Create Link Aggregation",
        "description": "Create a link aggregation group in a network",
        "tags": ["meraki", "switch", "link-aggregation", "lag", "create"],
        "examples": [
            "Create LAG",
            "Set up port channel",
            "Create link aggregation",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "switch_ports": {
                    "type": "array",
                    "description": "Ports to include in aggregation",
                    "items": {
                        "type": "object",
                        "properties": {
                            "serial": {"type": "string"},
                            "port_id": {"type": "string"},
                        },
                    },
                },
                "switch_profile_ports": {"type": "array", "description": "Switch profile ports"},
            },
            "required": ["network_id", "switch_ports"],
        },
    },
    {
        "id": "switch_get_link_aggregation",
        "name": "Get Link Aggregation",
        "description": "Get a specific link aggregation group",
        "tags": ["meraki", "switch", "link-aggregation", "lag", "get"],
        "examples": [
            "Get LAG details",
            "Show port channel configuration",
            "What ports are in this LAG?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "link_aggregation_id": LINK_AGG_ID_SCHEMA,
            },
            "required": ["network_id", "link_aggregation_id"],
        },
    },
    {
        "id": "switch_update_link_aggregation",
        "name": "Update Link Aggregation",
        "description": "Update a link aggregation group",
        "tags": ["meraki", "switch", "link-aggregation", "lag", "update"],
        "examples": [
            "Update LAG",
            "Change port channel members",
            "Modify link aggregation",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "link_aggregation_id": LINK_AGG_ID_SCHEMA,
                "switch_ports": {"type": "array", "description": "Ports to include in aggregation"},
                "switch_profile_ports": {"type": "array", "description": "Switch profile ports"},
            },
            "required": ["network_id", "link_aggregation_id"],
        },
    },
    {
        "id": "switch_delete_link_aggregation",
        "name": "Delete Link Aggregation",
        "description": "Delete a link aggregation group",
        "tags": ["meraki", "switch", "link-aggregation", "lag", "delete"],
        "examples": [
            "Delete LAG",
            "Remove port channel",
            "Delete link aggregation",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "link_aggregation_id": LINK_AGG_ID_SCHEMA,
            },
            "required": ["network_id", "link_aggregation_id"],
        },
    },
]

# MTU Skills
MTU_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_mtu",
        "name": "Get Switch MTU",
        "description": "Get the MTU configuration for a network",
        "tags": ["meraki", "switch", "mtu"],
        "examples": [
            "Show MTU settings",
            "What's the jumbo frame configuration?",
            "Get MTU values",
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
        "id": "switch_update_mtu",
        "name": "Update Switch MTU",
        "description": "Update the MTU configuration for a network",
        "tags": ["meraki", "switch", "mtu", "update"],
        "examples": [
            "Set MTU to 9000",
            "Enable jumbo frames",
            "Update MTU settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "default_mtu_size": {"type": "integer", "description": "Default MTU size"},
                "overrides": {"type": "array", "items": {"type": "object"}, "description": "MTU overrides per switch"},
            },
            "required": ["network_id"],
        },
    },
]

# Port Schedule Skills
PORT_SCHEDULE_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_list_port_schedules",
        "name": "List Port Schedules",
        "description": "List the port schedules for a network",
        "tags": ["meraki", "switch", "port-schedules", "list"],
        "examples": [
            "Show port schedules",
            "List port scheduling policies",
            "What schedules exist?",
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
        "id": "switch_create_port_schedule",
        "name": "Create Port Schedule",
        "description": "Create a port schedule for a network",
        "tags": ["meraki", "switch", "port-schedules", "create"],
        "examples": [
            "Create port schedule",
            "Set up port scheduling",
            "Add new schedule",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "name": {"type": "string", "description": "Schedule name"},
                "port_schedule": {
                    "type": "object",
                    "description": "Schedule configuration per day",
                    "properties": {
                        "monday": {"type": "object"},
                        "tuesday": {"type": "object"},
                        "wednesday": {"type": "object"},
                        "thursday": {"type": "object"},
                        "friday": {"type": "object"},
                        "saturday": {"type": "object"},
                        "sunday": {"type": "object"},
                    },
                },
            },
            "required": ["network_id", "name"],
        },
    },
    {
        "id": "switch_update_port_schedule",
        "name": "Update Port Schedule",
        "description": "Update a port schedule",
        "tags": ["meraki", "switch", "port-schedules", "update"],
        "examples": [
            "Update schedule",
            "Change port schedule times",
            "Modify scheduling",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "port_schedule_id": SCHEDULE_ID_SCHEMA,
                "name": {"type": "string", "description": "Schedule name"},
                "port_schedule": {"type": "object", "description": "Schedule configuration"},
            },
            "required": ["network_id", "port_schedule_id"],
        },
    },
    {
        "id": "switch_delete_port_schedule",
        "name": "Delete Port Schedule",
        "description": "Delete a port schedule",
        "tags": ["meraki", "switch", "port-schedules", "delete"],
        "examples": [
            "Delete schedule",
            "Remove port schedule",
            "Delete this schedule",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "port_schedule_id": SCHEDULE_ID_SCHEMA,
            },
            "required": ["network_id", "port_schedule_id"],
        },
    },
]

# Settings Skills
SETTINGS_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_settings",
        "name": "Get Switch Settings",
        "description": "Get the switch settings for a network",
        "tags": ["meraki", "switch", "settings"],
        "examples": [
            "Show switch settings",
            "Get switch configuration",
            "What are the switch defaults?",
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
        "id": "switch_update_settings",
        "name": "Update Switch Settings",
        "description": "Update the switch settings for a network",
        "tags": ["meraki", "switch", "settings", "update"],
        "examples": [
            "Update switch settings",
            "Configure switch defaults",
            "Change switch settings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "vlan": {"type": "integer", "description": "Management VLAN"},
                "use_combined_power": {"type": "boolean", "description": "Use combined PoE power"},
                "power_exceptions": {"type": "array", "items": {"type": "object"}, "description": "Power exceptions"},
                "mac_blocklist": {"type": "object", "description": "MAC blocklist settings"},
                "uplink_client_sampling": {"type": "object", "description": "Uplink client sampling"},
            },
            "required": ["network_id"],
        },
    },
]

# Warm Spare Skills
WARM_SPARE_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_warm_spare",
        "name": "Get Switch Warm Spare",
        "description": "Get the warm spare configuration for a switch",
        "tags": ["meraki", "switch", "warm-spare", "ha"],
        "examples": [
            "Show warm spare settings",
            "Is HA configured?",
            "Get failover configuration",
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
        "id": "switch_update_warm_spare",
        "name": "Update Switch Warm Spare",
        "description": "Update the warm spare configuration for a switch",
        "tags": ["meraki", "switch", "warm-spare", "ha", "update"],
        "examples": [
            "Configure warm spare",
            "Enable HA failover",
            "Set up backup switch",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "serial": DEVICE_SERIAL_SCHEMA,
                "enabled": {"type": "boolean", "description": "Enable warm spare"},
                "spare_serial": {"type": "string", "description": "Spare switch serial"},
            },
            "required": ["serial", "enabled"],
        },
    },
]

# DSCP to CoS Mapping Skills
DSCP_COS_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_dscp_cos_mappings",
        "name": "Get DSCP to CoS Mappings",
        "description": "Get the DSCP to CoS mappings for a network",
        "tags": ["meraki", "switch", "dscp", "cos", "qos"],
        "examples": [
            "Show DSCP to CoS mappings",
            "Get QoS mappings",
            "What's the DSCP mapping?",
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
        "id": "switch_update_dscp_cos_mappings",
        "name": "Update DSCP to CoS Mappings",
        "description": "Update the DSCP to CoS mappings for a network",
        "tags": ["meraki", "switch", "dscp", "cos", "qos", "update"],
        "examples": [
            "Update DSCP mappings",
            "Change CoS values",
            "Configure QoS mappings",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "mappings": {
                    "type": "array",
                    "description": "DSCP to CoS mappings",
                    "items": {
                        "type": "object",
                        "properties": {
                            "dscp": {"type": "integer"},
                            "cos": {"type": "integer"},
                            "title": {"type": "string"},
                        },
                    },
                },
            },
            "required": ["network_id", "mappings"],
        },
    },
]

# STP Skills
STP_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_stp",
        "name": "Get Switch STP",
        "description": "Get the STP settings for a network",
        "tags": ["meraki", "switch", "stp", "spanning-tree"],
        "examples": [
            "Show STP settings",
            "What's the spanning tree configuration?",
            "Get RSTP settings",
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
        "id": "switch_update_stp",
        "name": "Update Switch STP",
        "description": "Update the STP settings for a network",
        "tags": ["meraki", "switch", "stp", "spanning-tree", "update"],
        "examples": [
            "Configure STP",
            "Enable RSTP",
            "Set STP priority",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "rstp_enabled": {"type": "boolean", "description": "Enable RSTP"},
                "stp_bridge_priority": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "STP bridge priorities",
                },
            },
            "required": ["network_id"],
        },
    },
]

# Storm Control Skills
STORM_CONTROL_SKILLS: List[SkillDefinition] = [
    {
        "id": "switch_get_storm_control",
        "name": "Get Storm Control",
        "description": "Get the storm control configuration for a network",
        "tags": ["meraki", "switch", "storm-control", "security"],
        "examples": [
            "Show storm control settings",
            "What's the broadcast storm limit?",
            "Get storm control thresholds",
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
        "id": "switch_update_storm_control",
        "name": "Update Storm Control",
        "description": "Update the storm control configuration for a network",
        "tags": ["meraki", "switch", "storm-control", "security", "update"],
        "examples": [
            "Configure storm control",
            "Set broadcast storm limit",
            "Update storm thresholds",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "network_id": NETWORK_ID_SCHEMA,
                "broadcast_threshold": {"type": "integer", "description": "Broadcast threshold (pps)"},
                "multicast_threshold": {"type": "integer", "description": "Multicast threshold (pps)"},
                "unknown_unicast_threshold": {"type": "integer", "description": "Unknown unicast threshold (pps)"},
            },
            "required": ["network_id"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class SwitchModule(MerakiSkillModule):
    """Switch skills module."""

    MODULE_NAME = "switch"
    MODULE_PREFIX = "switch_"

    # Combine all skill definitions
    ALL_SKILLS: List[SkillDefinition] = (
        PORT_SKILLS
        + STACK_SKILLS
        + ROUTING_INTERFACE_SKILLS
        + STATIC_ROUTE_SKILLS
        + OSPF_SKILLS
        + ACCESS_POLICY_SKILLS
        + ACL_SKILLS
        + QOS_SKILLS
        + DHCP_SKILLS
        + LINK_AGG_SKILLS
        + MTU_SKILLS
        + PORT_SCHEDULE_SKILLS
        + SETTINGS_SKILLS
        + WARM_SPARE_SKILLS
        + DSCP_COS_SKILLS
        + STP_SKILLS
        + STORM_CONTROL_SKILLS
    )

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all switch skills."""
        return [create_skill(skill_def) for skill_def in cls.ALL_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: Any,
        params: Dict[str, Any],
        context: Any,
    ) -> Any:
        """Execute a switch skill."""
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
        serial = params.get("serial") or extract_device_entities(params, context)

        # Port operations
        if skill_id == "switch_list_ports":
            return await api_get(client, f"/devices/{serial}/switch/ports")

        if skill_id == "switch_get_port":
            port_id = params.get("port_id")
            return await api_get(client, f"/devices/{serial}/switch/ports/{port_id}")

        if skill_id == "switch_update_port":
            port_id = params.get("port_id")
            body = cls._build_port_body(params)
            return await api_put(client, f"/devices/{serial}/switch/ports/{port_id}", body)

        if skill_id == "switch_cycle_ports":
            body = {"ports": params.get("ports", [])}
            return await api_post(client, f"/devices/{serial}/switch/ports/cycle", body)

        if skill_id == "switch_get_ports_statuses":
            query_params = cls._build_query_params(params, ["t0", "timespan"])
            return await api_get(client, f"/devices/{serial}/switch/ports/statuses", query_params)

        if skill_id == "switch_get_ports_statuses_packets":
            query_params = cls._build_query_params(params, ["t0", "timespan"])
            return await api_get(client, f"/devices/{serial}/switch/ports/statuses/packets", query_params)

        # Stack operations
        if skill_id == "switch_list_stacks":
            return await api_get(client, f"/networks/{network_id}/switch/stacks")

        if skill_id == "switch_create_stack":
            body = {
                "name": params.get("name"),
                "serials": params.get("serials", []),
            }
            return await api_post(client, f"/networks/{network_id}/switch/stacks", body)

        if skill_id == "switch_get_stack":
            stack_id = params.get("stack_id")
            return await api_get(client, f"/networks/{network_id}/switch/stacks/{stack_id}")

        if skill_id == "switch_delete_stack":
            stack_id = params.get("stack_id")
            return await api_delete(client, f"/networks/{network_id}/switch/stacks/{stack_id}")

        if skill_id == "switch_add_to_stack":
            stack_id = params.get("stack_id")
            body = {"serial": params.get("serial")}
            return await api_post(client, f"/networks/{network_id}/switch/stacks/{stack_id}/add", body)

        if skill_id == "switch_remove_from_stack":
            stack_id = params.get("stack_id")
            body = {"serial": params.get("serial")}
            return await api_post(client, f"/networks/{network_id}/switch/stacks/{stack_id}/remove", body)

        # Routing interface operations
        if skill_id == "switch_list_routing_interfaces":
            return await api_get(client, f"/devices/{serial}/switch/routing/interfaces")

        if skill_id == "switch_create_routing_interface":
            body = cls._build_interface_body(params)
            return await api_post(client, f"/devices/{serial}/switch/routing/interfaces", body)

        if skill_id == "switch_get_routing_interface":
            interface_id = params.get("interface_id")
            return await api_get(client, f"/devices/{serial}/switch/routing/interfaces/{interface_id}")

        if skill_id == "switch_update_routing_interface":
            interface_id = params.get("interface_id")
            body = cls._build_interface_body(params)
            return await api_put(client, f"/devices/{serial}/switch/routing/interfaces/{interface_id}", body)

        if skill_id == "switch_delete_routing_interface":
            interface_id = params.get("interface_id")
            return await api_delete(client, f"/devices/{serial}/switch/routing/interfaces/{interface_id}")

        # Static route operations
        if skill_id == "switch_list_static_routes":
            return await api_get(client, f"/devices/{serial}/switch/routing/staticRoutes")

        if skill_id == "switch_create_static_route":
            body = {
                "subnet": params.get("subnet"),
                "nextHopIp": params.get("next_hop_ip"),
            }
            if params.get("name"):
                body["name"] = params["name"]
            if params.get("advertise_via_ospf_enabled") is not None:
                body["advertiseViaOspfEnabled"] = params["advertise_via_ospf_enabled"]
            if params.get("prefer_over_ospf_routes_enabled") is not None:
                body["preferOverOspfRoutesEnabled"] = params["prefer_over_ospf_routes_enabled"]
            return await api_post(client, f"/devices/{serial}/switch/routing/staticRoutes", body)

        if skill_id == "switch_get_static_route":
            route_id = params.get("static_route_id")
            return await api_get(client, f"/devices/{serial}/switch/routing/staticRoutes/{route_id}")

        if skill_id == "switch_update_static_route":
            route_id = params.get("static_route_id")
            body = {}
            for key, api_key in [("name", "name"), ("subnet", "subnet"), ("next_hop_ip", "nextHopIp"),
                                  ("advertise_via_ospf_enabled", "advertiseViaOspfEnabled"),
                                  ("prefer_over_ospf_routes_enabled", "preferOverOspfRoutesEnabled")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/devices/{serial}/switch/routing/staticRoutes/{route_id}", body)

        if skill_id == "switch_delete_static_route":
            route_id = params.get("static_route_id")
            return await api_delete(client, f"/devices/{serial}/switch/routing/staticRoutes/{route_id}")

        # OSPF operations
        if skill_id == "switch_get_ospf":
            return await api_get(client, f"/networks/{network_id}/switch/routing/ospf")

        if skill_id == "switch_update_ospf":
            body = {}
            for key, api_key in [("enabled", "enabled"), ("hello_timer_in_seconds", "helloTimerInSeconds"),
                                  ("dead_timer_in_seconds", "deadTimerInSeconds"), ("areas", "areas"),
                                  ("v3", "v3"), ("md5_authentication_enabled", "md5AuthenticationEnabled"),
                                  ("md5_authentication_key", "md5AuthenticationKey")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/switch/routing/ospf", body)

        if skill_id == "switch_get_multicast":
            return await api_get(client, f"/networks/{network_id}/switch/routing/multicast")

        if skill_id == "switch_update_multicast":
            body = {}
            if params.get("default_settings"):
                body["defaultSettings"] = params["default_settings"]
            if params.get("overrides"):
                body["overrides"] = params["overrides"]
            return await api_put(client, f"/networks/{network_id}/switch/routing/multicast", body)

        # Access policy operations
        if skill_id == "switch_list_access_policies":
            return await api_get(client, f"/networks/{network_id}/switch/accessPolicies")

        if skill_id == "switch_create_access_policy":
            body = cls._build_access_policy_body(params)
            return await api_post(client, f"/networks/{network_id}/switch/accessPolicies", body)

        if skill_id == "switch_get_access_policy":
            policy_num = params.get("access_policy_number")
            return await api_get(client, f"/networks/{network_id}/switch/accessPolicies/{policy_num}")

        if skill_id == "switch_update_access_policy":
            policy_num = params.get("access_policy_number")
            body = cls._build_access_policy_body(params)
            return await api_put(client, f"/networks/{network_id}/switch/accessPolicies/{policy_num}", body)

        if skill_id == "switch_delete_access_policy":
            policy_num = params.get("access_policy_number")
            return await api_delete(client, f"/networks/{network_id}/switch/accessPolicies/{policy_num}")

        # ACL operations
        if skill_id == "switch_get_acls":
            return await api_get(client, f"/networks/{network_id}/switch/accessControlLists")

        if skill_id == "switch_update_acls":
            body = {"rules": params.get("rules", [])}
            return await api_put(client, f"/networks/{network_id}/switch/accessControlLists", body)

        # QoS operations
        if skill_id == "switch_list_qos_rules":
            return await api_get(client, f"/networks/{network_id}/switch/qosRules")

        if skill_id == "switch_create_qos_rule":
            body = {"vlan": params.get("vlan")}
            for key, api_key in [("protocol", "protocol"), ("src_port", "srcPort"), ("src_port_range", "srcPortRange"),
                                  ("dst_port", "dstPort"), ("dst_port_range", "dstPortRange"), ("dscp", "dscp")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_post(client, f"/networks/{network_id}/switch/qosRules", body)

        if skill_id == "switch_get_qos_rule":
            rule_id = params.get("qos_rule_id")
            return await api_get(client, f"/networks/{network_id}/switch/qosRules/{rule_id}")

        if skill_id == "switch_update_qos_rule":
            rule_id = params.get("qos_rule_id")
            body = {}
            for key, api_key in [("vlan", "vlan"), ("protocol", "protocol"), ("src_port", "srcPort"),
                                  ("dst_port", "dstPort"), ("dscp", "dscp")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/switch/qosRules/{rule_id}", body)

        if skill_id == "switch_delete_qos_rule":
            rule_id = params.get("qos_rule_id")
            return await api_delete(client, f"/networks/{network_id}/switch/qosRules/{rule_id}")

        if skill_id == "switch_get_qos_rules_order":
            return await api_get(client, f"/networks/{network_id}/switch/qosRules/order")

        if skill_id == "switch_update_qos_rules_order":
            body = {"ruleIds": params.get("rule_ids", [])}
            return await api_put(client, f"/networks/{network_id}/switch/qosRules/order", body)

        # DHCP operations
        if skill_id == "switch_get_dhcp_servers_seen":
            query_params = cls._build_query_params(params, ["t0", "timespan", "per_page"])
            return await api_get(client, f"/networks/{network_id}/switch/dhcp/v4/servers/seen", query_params)

        if skill_id == "switch_get_dhcp_server_policy":
            return await api_get(client, f"/networks/{network_id}/switch/dhcpServerPolicy")

        if skill_id == "switch_update_dhcp_server_policy":
            body = {}
            for key, api_key in [("default_policy", "defaultPolicy"), ("allowed_servers", "allowedServers"),
                                  ("blocked_servers", "blockedServers"), ("arp_inspection", "arpInspection"),
                                  ("alerts", "alerts")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/switch/dhcpServerPolicy", body)

        # Link aggregation operations
        if skill_id == "switch_list_link_aggregations":
            return await api_get(client, f"/networks/{network_id}/switch/linkAggregations")

        if skill_id == "switch_create_link_aggregation":
            body = {"switchPorts": params.get("switch_ports", [])}
            if params.get("switch_profile_ports"):
                body["switchProfilePorts"] = params["switch_profile_ports"]
            return await api_post(client, f"/networks/{network_id}/switch/linkAggregations", body)

        if skill_id == "switch_get_link_aggregation":
            agg_id = params.get("link_aggregation_id")
            return await api_get(client, f"/networks/{network_id}/switch/linkAggregations/{agg_id}")

        if skill_id == "switch_update_link_aggregation":
            agg_id = params.get("link_aggregation_id")
            body = {}
            if params.get("switch_ports"):
                body["switchPorts"] = params["switch_ports"]
            if params.get("switch_profile_ports"):
                body["switchProfilePorts"] = params["switch_profile_ports"]
            return await api_put(client, f"/networks/{network_id}/switch/linkAggregations/{agg_id}", body)

        if skill_id == "switch_delete_link_aggregation":
            agg_id = params.get("link_aggregation_id")
            return await api_delete(client, f"/networks/{network_id}/switch/linkAggregations/{agg_id}")

        # MTU operations
        if skill_id == "switch_get_mtu":
            return await api_get(client, f"/networks/{network_id}/switch/mtu")

        if skill_id == "switch_update_mtu":
            body = {}
            if params.get("default_mtu_size"):
                body["defaultMtuSize"] = params["default_mtu_size"]
            if params.get("overrides"):
                body["overrides"] = params["overrides"]
            return await api_put(client, f"/networks/{network_id}/switch/mtu", body)

        # Port schedule operations
        if skill_id == "switch_list_port_schedules":
            return await api_get(client, f"/networks/{network_id}/switch/portSchedules")

        if skill_id == "switch_create_port_schedule":
            body = {"name": params.get("name")}
            if params.get("port_schedule"):
                body["portSchedule"] = params["port_schedule"]
            return await api_post(client, f"/networks/{network_id}/switch/portSchedules", body)

        if skill_id == "switch_update_port_schedule":
            schedule_id = params.get("port_schedule_id")
            body = {}
            if params.get("name"):
                body["name"] = params["name"]
            if params.get("port_schedule"):
                body["portSchedule"] = params["port_schedule"]
            return await api_put(client, f"/networks/{network_id}/switch/portSchedules/{schedule_id}", body)

        if skill_id == "switch_delete_port_schedule":
            schedule_id = params.get("port_schedule_id")
            return await api_delete(client, f"/networks/{network_id}/switch/portSchedules/{schedule_id}")

        # Settings operations
        if skill_id == "switch_get_settings":
            return await api_get(client, f"/networks/{network_id}/switch/settings")

        if skill_id == "switch_update_settings":
            body = {}
            for key, api_key in [("vlan", "vlan"), ("use_combined_power", "useCombinedPower"),
                                  ("power_exceptions", "powerExceptions"), ("mac_blocklist", "macBlocklist"),
                                  ("uplink_client_sampling", "uplinkClientSampling")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/switch/settings", body)

        # Warm spare operations
        if skill_id == "switch_get_warm_spare":
            return await api_get(client, f"/devices/{serial}/switch/warmSpare")

        if skill_id == "switch_update_warm_spare":
            body = {"enabled": params.get("enabled")}
            if params.get("spare_serial"):
                body["spareSerial"] = params["spare_serial"]
            return await api_put(client, f"/devices/{serial}/switch/warmSpare", body)

        # DSCP to CoS operations
        if skill_id == "switch_get_dscp_cos_mappings":
            return await api_get(client, f"/networks/{network_id}/switch/dscpToCosMappings")

        if skill_id == "switch_update_dscp_cos_mappings":
            body = {"mappings": params.get("mappings", [])}
            return await api_put(client, f"/networks/{network_id}/switch/dscpToCosMappings", body)

        # STP operations
        if skill_id == "switch_get_stp":
            return await api_get(client, f"/networks/{network_id}/switch/stp")

        if skill_id == "switch_update_stp":
            body = {}
            if params.get("rstp_enabled") is not None:
                body["rstpEnabled"] = params["rstp_enabled"]
            if params.get("stp_bridge_priority"):
                body["stpBridgePriority"] = params["stp_bridge_priority"]
            return await api_put(client, f"/networks/{network_id}/switch/stp", body)

        # Storm control operations
        if skill_id == "switch_get_storm_control":
            return await api_get(client, f"/networks/{network_id}/switch/stormControl")

        if skill_id == "switch_update_storm_control":
            body = {}
            for key, api_key in [("broadcast_threshold", "broadcastThreshold"),
                                  ("multicast_threshold", "multicastThreshold"),
                                  ("unknown_unicast_threshold", "unknownUnicastThreshold")]:
                if params.get(key) is not None:
                    body[api_key] = params[key]
            return await api_put(client, f"/networks/{network_id}/switch/stormControl", body)

        # Unknown skill
        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    def _build_port_body(cls, params: Dict[str, Any]) -> Dict[str, Any]:
        """Build port update body from params."""
        body = {}
        field_mappings = [
            ("name", "name"), ("tags", "tags"), ("enabled", "enabled"), ("poe_enabled", "poeEnabled"),
            ("type", "type"), ("vlan", "vlan"), ("voice_vlan", "voiceVlan"),
            ("allowed_vlans", "allowedVlans"), ("isolation_enabled", "isolationEnabled"),
            ("rstp_enabled", "rstpEnabled"), ("stp_guard", "stpGuard"),
            ("link_negotiation", "linkNegotiation"), ("port_schedule_id", "portScheduleId"),
            ("udld", "udld"), ("access_policy_type", "accessPolicyType"),
            ("access_policy_number", "accessPolicyNumber"), ("mac_allow_list", "macAllowList"),
            ("sticky_mac_allow_list", "stickyMacAllowList"),
            ("sticky_mac_allow_list_limit", "stickyMacAllowListLimit"),
            ("storm_control_enabled", "stormControlEnabled"),
            ("flexible_stacking_enabled", "flexibleStackingEnabled"),
            ("dai_trusted", "daiTrusted"),
        ]
        for key, api_key in field_mappings:
            if params.get(key) is not None:
                body[api_key] = params[key]
        return body

    @classmethod
    def _build_interface_body(cls, params: Dict[str, Any]) -> Dict[str, Any]:
        """Build routing interface body from params."""
        body = {}
        field_mappings = [
            ("name", "name"), ("subnet", "subnet"), ("interface_ip", "interfaceIp"),
            ("vlan_id", "vlanId"), ("default_gateway", "defaultGateway"),
            ("ospf_settings", "ospfSettings"), ("ospf_v3", "ospfV3"), ("ipv6", "ipv6"),
        ]
        for key, api_key in field_mappings:
            if params.get(key) is not None:
                body[api_key] = params[key]
        return body

    @classmethod
    def _build_access_policy_body(cls, params: Dict[str, Any]) -> Dict[str, Any]:
        """Build access policy body from params."""
        body = {}
        field_mappings = [
            ("name", "name"), ("radius_servers", "radiusServers"),
            ("radius_testing_enabled", "radiusTestingEnabled"),
            ("radius_coa_support_enabled", "radiusCoaSupportEnabled"),
            ("radius_accounting_enabled", "radiusAccountingEnabled"),
            ("radius_accounting_servers", "radiusAccountingServers"),
            ("radius_group_attribute", "radiusGroupAttribute"),
            ("host_mode", "hostMode"), ("access_policy_type", "accessPolicyType"),
            ("increase_access_speed", "increaseAccessSpeed"),
            ("guest_vlan_id", "guestVlanId"), ("dot1x", "dot1x"),
            ("voice_vlan_clients", "voiceVlanClients"),
            ("url_redirect_walled_garden_enabled", "urlRedirectWalledGardenEnabled"),
            ("url_redirect_walled_garden_ranges", "urlRedirectWalledGardenRanges"),
        ]
        for key, api_key in field_mappings:
            if params.get(key) is not None:
                body[api_key] = params[key]
        return body

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
