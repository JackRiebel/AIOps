"""
Catalyst Sda Tools

Auto-generated from archived A2A skills.
Total tools: 32
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_sda_get_fabric_sites(params: Dict, context: Any) -> Dict:
    """Handler for Get Fabric Sites."""
    try:
        # Build API path
        path = "/sda/get/fabric/sites"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_fabric_site(params: Dict, context: Any) -> Dict:
    """Handler for Add Fabric Site."""
    try:
        # Build API path
        path = "/sda/add/fabric/site"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_fabric_site(params: Dict, context: Any) -> Dict:
    """Handler for Delete Fabric Site."""
    try:
        # Build API path
        path = "/sda/delete/fabric/site"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_fabric_zones(params: Dict, context: Any) -> Dict:
    """Handler for Get Fabric Zones."""
    try:
        # Build API path
        path = "/sda/get/fabric/zones"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_fabric_zone(params: Dict, context: Any) -> Dict:
    """Handler for Add Fabric Zone."""
    try:
        # Build API path
        path = "/sda/add/fabric/zone"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_update_fabric_zone(params: Dict, context: Any) -> Dict:
    """Handler for Update Fabric Zone."""
    try:
        # Build API path
        path = "/sda/update/fabric/zone"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_fabric_zone(params: Dict, context: Any) -> Dict:
    """Handler for Delete Fabric Zone."""
    try:
        # Build API path
        path = "/sda/delete/fabric/zone"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_border_device(params: Dict, context: Any) -> Dict:
    """Handler for Get Border Device."""
    try:
        # Build API path
        path = "/sda/get/border/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_border_device(params: Dict, context: Any) -> Dict:
    """Handler for Add Border Device."""
    try:
        # Build API path
        path = "/sda/add/border/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_border_device(params: Dict, context: Any) -> Dict:
    """Handler for Delete Border Device."""
    try:
        # Build API path
        path = "/sda/delete/border/device"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_edge_device(params: Dict, context: Any) -> Dict:
    """Handler for Get Edge Device."""
    try:
        # Build API path
        path = "/sda/get/edge/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_edge_device(params: Dict, context: Any) -> Dict:
    """Handler for Add Edge Device."""
    try:
        # Build API path
        path = "/sda/add/edge/device"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_edge_device(params: Dict, context: Any) -> Dict:
    """Handler for Delete Edge Device."""
    try:
        # Build API path
        path = "/sda/delete/edge/device"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_control_plane(params: Dict, context: Any) -> Dict:
    """Handler for Get Control Plane Device."""
    try:
        # Build API path
        path = "/sda/get/control/plane"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_control_plane(params: Dict, context: Any) -> Dict:
    """Handler for Add Control Plane Device."""
    try:
        # Build API path
        path = "/sda/add/control/plane"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_control_plane(params: Dict, context: Any) -> Dict:
    """Handler for Delete Control Plane Device."""
    try:
        # Build API path
        path = "/sda/delete/control/plane"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_virtual_network(params: Dict, context: Any) -> Dict:
    """Handler for Get Virtual Network."""
    try:
        # Build API path
        path = "/sda/get/virtual/network"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_virtual_network(params: Dict, context: Any) -> Dict:
    """Handler for Add Virtual Network."""
    try:
        # Build API path
        path = "/sda/add/virtual/network"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_virtual_network(params: Dict, context: Any) -> Dict:
    """Handler for Delete Virtual Network."""
    try:
        # Build API path
        path = "/sda/delete/virtual/network"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_ip_pool(params: Dict, context: Any) -> Dict:
    """Handler for Get VN IP Pool."""
    try:
        # Build API path
        path = "/sda/get/ip/pool"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_ip_pool(params: Dict, context: Any) -> Dict:
    """Handler for Add VN IP Pool."""
    try:
        # Build API path
        path = "/sda/add/ip/pool"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_ip_pool(params: Dict, context: Any) -> Dict:
    """Handler for Delete VN IP Pool."""
    try:
        # Build API path
        path = "/sda/delete/ip/pool"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_auth_profile(params: Dict, context: Any) -> Dict:
    """Handler for Get Authentication Profile."""
    try:
        # Build API path
        path = "/sda/get/auth/profile"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_auth_profile(params: Dict, context: Any) -> Dict:
    """Handler for Add Authentication Profile."""
    try:
        # Build API path
        path = "/sda/add/auth/profile"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_update_auth_profile(params: Dict, context: Any) -> Dict:
    """Handler for Update Authentication Profile."""
    try:
        # Build API path
        path = "/sda/update/auth/profile"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_auth_profile(params: Dict, context: Any) -> Dict:
    """Handler for Delete Authentication Profile."""
    try:
        # Build API path
        path = "/sda/delete/auth/profile"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_port_assignment(params: Dict, context: Any) -> Dict:
    """Handler for Get AP Port Assignment."""
    try:
        # Build API path
        path = "/sda/get/port/assignment"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_port_assignment(params: Dict, context: Any) -> Dict:
    """Handler for Add AP Port Assignment."""
    try:
        # Build API path
        path = "/sda/add/port/assignment"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_port_assignment(params: Dict, context: Any) -> Dict:
    """Handler for Delete AP Port Assignment."""
    try:
        # Build API path
        path = "/sda/delete/port/assignment"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_get_user_device_port(params: Dict, context: Any) -> Dict:
    """Handler for Get User Device Port."""
    try:
        # Build API path
        path = "/sda/get/user/device/port"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_add_user_device_port(params: Dict, context: Any) -> Dict:
    """Handler for Add User Device Port."""
    try:
        # Build API path
        path = "/sda/add/user/device/port"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_sda_delete_user_device_port(params: Dict, context: Any) -> Dict:
    """Handler for Delete User Device Port."""
    try:
        # Build API path
        path = "/sda/delete/user/device/port"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_SDA_TOOLS = [
    create_tool(
        name="catalyst_sda_get_fabric_sites",
        description="""Get SD-Access fabric sites.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "sda", "fabric", "sites"],
        requires_write=False,
        handler=handle_sda_get_fabric_sites,
    ),
    create_tool(
        name="catalyst_sda_add_fabric_site",
        description="""Add a site to SD-Access fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "fabric_name": {
                        "type": "string"
            },
            "fabric_type": {
                        "type": "string",
                        "enum": [
                                    "FABRIC_SITE",
                                    "FABRIC_ZONE"
                        ]
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "fabric", "site", "add"],
        requires_write=False,
        handler=handle_sda_add_fabric_site,
    ),
    create_tool(
        name="catalyst_sda_delete_fabric_site",
        description="""Remove a site from SD-Access fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "fabric", "site", "delete"],
        requires_write=True,
        handler=handle_sda_delete_fabric_site,
    ),
    create_tool(
        name="catalyst_sda_get_fabric_zones",
        description="""Get SD-Access fabric zones.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "sda", "fabric", "zones"],
        requires_write=False,
        handler=handle_sda_get_fabric_zones,
    ),
    create_tool(
        name="catalyst_sda_add_fabric_zone",
        description="""Add a fabric zone to a site.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "authentication_profile_name": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "fabric", "zone", "add"],
        requires_write=False,
        handler=handle_sda_add_fabric_zone,
    ),
    create_tool(
        name="catalyst_sda_update_fabric_zone",
        description="""Update a fabric zone.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "authentication_profile_name": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "fabric", "zone", "update"],
        requires_write=True,
        handler=handle_sda_update_fabric_zone,
    ),
    create_tool(
        name="catalyst_sda_delete_fabric_zone",
        description="""Delete a fabric zone.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "fabric", "zone", "delete"],
        requires_write=True,
        handler=handle_sda_delete_fabric_zone,
    ),
    create_tool(
        name="catalyst_sda_get_border_device",
        description="""Get SD-Access border device details.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            },
            "sda_border_device": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "sda", "border", "device"],
        requires_write=False,
        handler=handle_sda_get_border_device,
    ),
    create_tool(
        name="catalyst_sda_add_border_device",
        description="""Add a border device to fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_management_ip_address": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            },
            "external_domain_routing_protocol_name": {
                        "type": "string",
                        "enum": [
                                    "BGP",
                                    "OSPF"
                        ]
            },
            "external_connectivity_ip_pool_name": {
                        "type": "string"
            },
            "internal_autonomus_system_number": {
                        "type": "string"
            },
            "border_session_type": {
                        "type": "string",
                        "enum": [
                                    "ANYWHERE",
                                    "EXTERNAL"
                        ]
            },
            "connected_to_internet": {
                        "type": "boolean"
            },
            "external_connectivity_settings": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["device_management_ip_address", "site_name_hierarchy"],
        tags=["catalyst", "sda", "border", "device", "add"],
        requires_write=False,
        handler=handle_sda_add_border_device,
    ),
    create_tool(
        name="catalyst_sda_delete_border_device",
        description="""Remove a border device from fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            }
},
        required=["device_ip_address"],
        tags=["catalyst", "sda", "border", "device", "delete"],
        requires_write=True,
        handler=handle_sda_delete_border_device,
    ),
    create_tool(
        name="catalyst_sda_get_edge_device",
        description="""Get SD-Access edge device details.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            }
},
        required=["device_ip_address"],
        tags=["catalyst", "sda", "edge", "device"],
        requires_write=False,
        handler=handle_sda_get_edge_device,
    ),
    create_tool(
        name="catalyst_sda_add_edge_device",
        description="""Add an edge device to fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_management_ip_address": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["device_management_ip_address", "site_name_hierarchy"],
        tags=["catalyst", "sda", "edge", "device", "add"],
        requires_write=False,
        handler=handle_sda_add_edge_device,
    ),
    create_tool(
        name="catalyst_sda_delete_edge_device",
        description="""Remove an edge device from fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            }
},
        required=["device_ip_address"],
        tags=["catalyst", "sda", "edge", "device", "delete"],
        requires_write=True,
        handler=handle_sda_delete_edge_device,
    ),
    create_tool(
        name="catalyst_sda_get_control_plane",
        description="""Get SD-Access control plane device.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            }
},
        required=["device_ip_address"],
        tags=["catalyst", "sda", "control", "plane"],
        requires_write=False,
        handler=handle_sda_get_control_plane,
    ),
    create_tool(
        name="catalyst_sda_add_control_plane",
        description="""Add a control plane device to fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_management_ip_address": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            },
            "route_distribution_protocol": {
                        "type": "string",
                        "enum": [
                                    "LISP_PUB_SUB",
                                    "LISP_BGP"
                        ]
            }
},
        required=["device_management_ip_address", "site_name_hierarchy"],
        tags=["catalyst", "sda", "control", "plane", "add"],
        requires_write=False,
        handler=handle_sda_add_control_plane,
    ),
    create_tool(
        name="catalyst_sda_delete_control_plane",
        description="""Remove a control plane device.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            }
},
        required=["device_ip_address"],
        tags=["catalyst", "sda", "control", "plane", "delete"],
        requires_write=True,
        handler=handle_sda_delete_control_plane,
    ),
    create_tool(
        name="catalyst_sda_get_virtual_network",
        description="""Get SD-Access virtual network.""",
        platform="catalyst",
        category="sda",
        properties={
            "virtual_network_name": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "sda", "virtual", "network"],
        requires_write=False,
        handler=handle_sda_get_virtual_network,
    ),
    create_tool(
        name="catalyst_sda_add_virtual_network",
        description="""Create a virtual network in fabric.""",
        platform="catalyst",
        category="sda",
        properties={
            "virtual_network_name": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["virtual_network_name", "site_name_hierarchy"],
        tags=["catalyst", "sda", "virtual", "network", "add"],
        requires_write=False,
        handler=handle_sda_add_virtual_network,
    ),
    create_tool(
        name="catalyst_sda_delete_virtual_network",
        description="""Delete a virtual network.""",
        platform="catalyst",
        category="sda",
        properties={
            "virtual_network_name": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["virtual_network_name", "site_name_hierarchy"],
        tags=["catalyst", "sda", "virtual", "network", "delete"],
        requires_write=True,
        handler=handle_sda_delete_virtual_network,
    ),
    create_tool(
        name="catalyst_sda_get_ip_pool",
        description="""Get IP pool in virtual network.""",
        platform="catalyst",
        category="sda",
        properties={
            "virtual_network_name": {
                        "type": "string"
            },
            "ip_pool_name": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "ip", "pool"],
        requires_write=False,
        handler=handle_sda_get_ip_pool,
    ),
    create_tool(
        name="catalyst_sda_add_ip_pool",
        description="""Add IP pool to virtual network.""",
        platform="catalyst",
        category="sda",
        properties={
            "virtual_network_name": {
                        "type": "string"
            },
            "ip_pool_name": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            },
            "traffic_type": {
                        "type": "string",
                        "enum": [
                                    "Data",
                                    "Voice"
                        ]
            },
            "authentication_policy_name": {
                        "type": "string"
            },
            "scalable_group_name": {
                        "type": "string"
            },
            "is_l2_flooding_enabled": {
                        "type": "boolean"
            },
            "is_this_critical_pool": {
                        "type": "boolean"
            },
            "pool_type": {
                        "type": "string",
                        "enum": [
                                    "AP",
                                    "Extended"
                        ]
            }
},
        required=["virtual_network_name", "ip_pool_name", "site_name_hierarchy"],
        tags=["catalyst", "sda", "ip", "pool", "add"],
        requires_write=False,
        handler=handle_sda_add_ip_pool,
    ),
    create_tool(
        name="catalyst_sda_delete_ip_pool",
        description="""Delete IP pool from virtual network.""",
        platform="catalyst",
        category="sda",
        properties={
            "virtual_network_name": {
                        "type": "string"
            },
            "ip_pool_name": {
                        "type": "string"
            },
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["virtual_network_name", "ip_pool_name", "site_name_hierarchy"],
        tags=["catalyst", "sda", "ip", "pool", "delete"],
        requires_write=True,
        handler=handle_sda_delete_ip_pool,
    ),
    create_tool(
        name="catalyst_sda_get_auth_profile",
        description="""Get SD-Access authentication profile.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "authenticate_template_name": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "auth", "profile"],
        requires_write=False,
        handler=handle_sda_get_auth_profile,
    ),
    create_tool(
        name="catalyst_sda_add_auth_profile",
        description="""Add authentication profile to site.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "authenticate_template_name": {
                        "type": "string",
                        "enum": [
                                    "No Authentication",
                                    "Open Authentication",
                                    "Closed Authentication",
                                    "Low Impact"
                        ]
            },
            "authentication_order": {
                        "type": "string",
                        "enum": [
                                    "dot1x",
                                    "mac"
                        ]
            },
            "dot1x_to_mab_fallback_timeout": {
                        "type": "integer"
            },
            "wake_on_lan": {
                        "type": "boolean"
            },
            "number_of_hosts": {
                        "type": "string",
                        "enum": [
                                    "Single",
                                    "Unlimited"
                        ]
            }
},
        required=["site_name_hierarchy", "authenticate_template_name"],
        tags=["catalyst", "sda", "auth", "profile", "add"],
        requires_write=False,
        handler=handle_sda_add_auth_profile,
    ),
    create_tool(
        name="catalyst_sda_update_auth_profile",
        description="""Update authentication profile.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "authenticate_template_name": {
                        "type": "string"
            },
            "authentication_order": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "auth", "profile", "update"],
        requires_write=True,
        handler=handle_sda_update_auth_profile,
    ),
    create_tool(
        name="catalyst_sda_delete_auth_profile",
        description="""Delete authentication profile.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy"],
        tags=["catalyst", "sda", "auth", "profile", "delete"],
        requires_write=True,
        handler=handle_sda_delete_auth_profile,
    ),
    create_tool(
        name="catalyst_sda_get_port_assignment",
        description="""Get port assignment for access point.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            },
            "interface_name": {
                        "type": "string"
            }
},
        required=["device_ip_address", "interface_name"],
        tags=["catalyst", "sda", "port", "ap"],
        requires_write=False,
        handler=handle_sda_get_port_assignment,
    ),
    create_tool(
        name="catalyst_sda_add_port_assignment",
        description="""Assign port for access point.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "device_management_ip_address": {
                        "type": "string"
            },
            "interface_name": {
                        "type": "string"
            },
            "data_ip_address_pool_name": {
                        "type": "string"
            },
            "authenticate_template_name": {
                        "type": "string"
            },
            "interface_description": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy", "device_management_ip_address", "interface_name"],
        tags=["catalyst", "sda", "port", "ap", "add"],
        requires_write=False,
        handler=handle_sda_add_port_assignment,
    ),
    create_tool(
        name="catalyst_sda_delete_port_assignment",
        description="""Remove port assignment for AP.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            },
            "interface_name": {
                        "type": "string"
            }
},
        required=["device_ip_address", "interface_name"],
        tags=["catalyst", "sda", "port", "ap", "delete"],
        requires_write=True,
        handler=handle_sda_delete_port_assignment,
    ),
    create_tool(
        name="catalyst_sda_get_user_device_port",
        description="""Get port assignment for user device.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            },
            "interface_name": {
                        "type": "string"
            }
},
        required=["device_ip_address", "interface_name"],
        tags=["catalyst", "sda", "port", "user"],
        requires_write=False,
        handler=handle_sda_get_user_device_port,
    ),
    create_tool(
        name="catalyst_sda_add_user_device_port",
        description="""Assign port for user device.""",
        platform="catalyst",
        category="sda",
        properties={
            "site_name_hierarchy": {
                        "type": "string"
            },
            "device_management_ip_address": {
                        "type": "string"
            },
            "interface_name": {
                        "type": "string"
            },
            "data_ip_address_pool_name": {
                        "type": "string"
            },
            "voice_ip_address_pool_name": {
                        "type": "string"
            },
            "authenticate_template_name": {
                        "type": "string"
            },
            "scalable_group_name": {
                        "type": "string"
            },
            "interface_description": {
                        "type": "string"
            }
},
        required=["site_name_hierarchy", "device_management_ip_address", "interface_name"],
        tags=["catalyst", "sda", "port", "user", "add"],
        requires_write=False,
        handler=handle_sda_add_user_device_port,
    ),
    create_tool(
        name="catalyst_sda_delete_user_device_port",
        description="""Remove port assignment for user device.""",
        platform="catalyst",
        category="sda",
        properties={
            "device_ip_address": {
                        "type": "string"
            },
            "interface_name": {
                        "type": "string"
            }
},
        required=["device_ip_address", "interface_name"],
        tags=["catalyst", "sda", "port", "user", "delete"],
        requires_write=True,
        handler=handle_sda_delete_user_device_port,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_sda_tools():
    """Register all sda tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_SDA_TOOLS)
    logger.info(f"Registered {len(CATALYST_SDA_TOOLS)} catalyst sda tools")


# Auto-register on import
register_sda_tools()
