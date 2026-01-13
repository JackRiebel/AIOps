"""
Catalyst Topology Tools

Auto-generated from archived A2A skills.
Total tools: 8
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_topology_get_site(params: Dict, context: Any) -> Dict:
    """Handler for Get Site Topology."""
    try:
        # Build API path
        path = "/topology/get/site"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_topology_get_physical(params: Dict, context: Any) -> Dict:
    """Handler for Get Physical Topology."""
    try:
        # Build API path
        path = "/topology/get/physical"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_topology_get_l3(params: Dict, context: Any) -> Dict:
    """Handler for Get Layer 3 Topology."""
    try:
        # Build API path
        path = "/topology/get/l3"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_topology_get_l2(params: Dict, context: Any) -> Dict:
    """Handler for Get Layer 2 Topology."""
    try:
        # Build API path
        path = "/topology/get/l2"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_topology_get_vlan_details(params: Dict, context: Any) -> Dict:
    """Handler for Get VLAN Topology Details."""
    try:
        # Build API path
        path = "/topology/get/vlan/details"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_topology_get_overall_health(params: Dict, context: Any) -> Dict:
    """Handler for Get Topology Network Health."""
    try:
        # Build API path
        path = "/topology/get/overall/health"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_topology_get_link_details(params: Dict, context: Any) -> Dict:
    """Handler for Get Link Details."""
    try:
        # Build API path
        path = "/topology/get/link/details"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_topology_refresh(params: Dict, context: Any) -> Dict:
    """Handler for Refresh Topology."""
    try:
        # Build API path
        path = "/topology/refresh"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_TOPOLOGY_TOOLS = [
    create_tool(
        name="catalyst_topology_get_site",
        description="""Get the site hierarchy topology showing the relationship between sites.""",
        platform="catalyst",
        category="topology",
        properties={},
        required=[],
        tags=["catalyst", "topology", "sites", "hierarchy"],
        requires_write=False,
        handler=handle_topology_get_site,
    ),
    create_tool(
        name="catalyst_topology_get_physical",
        description="""Get the physical network topology showing device connections and links.""",
        platform="catalyst",
        category="topology",
        properties={
            "node_type": {
                        "type": "string",
                        "description": "Filter by node type"
            }
},
        required=[],
        tags=["catalyst", "topology", "physical", "connections"],
        requires_write=False,
        handler=handle_topology_get_physical,
    ),
    create_tool(
        name="catalyst_topology_get_l3",
        description="""Get Layer 3 (routing) topology showing IP routing relationships.""",
        platform="catalyst",
        category="topology",
        properties={
            "topology_type": {
                        "type": "string",
                        "description": "L3 topology type",
                        "enum": [
                                    "OSPF",
                                    "EIGRP",
                                    "BGP",
                                    "ISIS"
                        ]
            }
},
        required=["topology_type"],
        tags=["catalyst", "topology", "l3", "routing"],
        requires_write=False,
        handler=handle_topology_get_l3,
    ),
    create_tool(
        name="catalyst_topology_get_l2",
        description="""Get Layer 2 (switching) topology for a specific VLAN.""",
        platform="catalyst",
        category="topology",
        properties={
            "vlan_id": {
                        "description": "VLAN ID to get topology for"
            }
},
        required=["vlan_id"],
        tags=["catalyst", "topology", "l2", "switching", "vlan"],
        requires_write=False,
        handler=handle_topology_get_l2,
    ),
    create_tool(
        name="catalyst_topology_get_vlan_details",
        description="""Get VLAN names and details for topology views.""",
        platform="catalyst",
        category="topology",
        properties={},
        required=[],
        tags=["catalyst", "topology", "vlans"],
        requires_write=False,
        handler=handle_topology_get_vlan_details,
    ),
    create_tool(
        name="catalyst_topology_get_overall_health",
        description="""Get network health information in context of topology.""",
        platform="catalyst",
        category="topology",
        properties={
            "timestamp": {
                        "type": "integer",
                        "description": "Epoch timestamp"
            }
},
        required=[],
        tags=["catalyst", "topology", "health"],
        requires_write=False,
        handler=handle_topology_get_overall_health,
    ),
    create_tool(
        name="catalyst_topology_get_link_details",
        description="""Get detailed information about network links in topology.""",
        platform="catalyst",
        category="topology",
        properties={
            "link_id": {
                        "type": "string",
                        "description": "Specific link ID"
            }
},
        required=[],
        tags=["catalyst", "topology", "links", "connections"],
        requires_write=False,
        handler=handle_topology_get_link_details,
    ),
    create_tool(
        name="catalyst_topology_refresh",
        description="""Trigger a topology refresh to get updated network connections.""",
        platform="catalyst",
        category="topology",
        properties={},
        required=[],
        tags=["catalyst", "topology", "refresh", "update"],
        requires_write=True,
        handler=handle_topology_refresh,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_topology_tools():
    """Register all topology tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_TOPOLOGY_TOOLS)
    logger.info(f"Registered {len(CATALYST_TOPOLOGY_TOOLS)} catalyst topology tools")


# Auto-register on import
register_topology_tools()
