"""
Thousandeyes Bgp_Monitors Tools

Auto-generated from archived A2A skills.
Total tools: 2
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.thousandeyes_service import ThousandEyesClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_bgp_get_monitors(params: Dict, context: Any) -> Dict:
    """Handler for List BGP Monitors."""
    try:
        # Build API path
        path = "/bgp/get/monitors"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_bgp_get_as_prefixes(params: Dict, context: Any) -> Dict:
    """Handler for Get AS Prefixes."""
    try:
        # Build API path
        path = "/bgp/get/as/prefixes"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

THOUSANDEYES_BGP_MONITORS_TOOLS = [
    create_tool(
        name="thousandeyes_bgp_get_monitors",
        description="""Get all available BGP monitors.""",
        platform="thousandeyes",
        category="bgp_monitors",
        properties={
            "aid": {
                        "type": "string"
            }
},
        required=[],
        tags=["thousandeyes", "bgp", "monitors", "list"],
        requires_write=False,
        handler=handle_bgp_get_monitors,
    ),
    create_tool(
        name="thousandeyes_bgp_get_as_prefixes",
        description="""Get BGP prefixes for an Autonomous System.""",
        platform="thousandeyes",
        category="bgp_monitors",
        properties={
            "asn": {
                        "type": "string",
                        "description": "Asn"
            },
            "aid": {
                        "type": "string"
            }
},
        required=["asn"],
        tags=["thousandeyes", "bgp", "as", "prefixes"],
        requires_write=False,
        handler=handle_bgp_get_as_prefixes,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_bgp_monitors_tools():
    """Register all bgp_monitors tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(THOUSANDEYES_BGP_MONITORS_TOOLS)
    logger.info(f"Registered {len(THOUSANDEYES_BGP_MONITORS_TOOLS)} thousandeyes bgp_monitors tools")


# Auto-register on import
register_bgp_monitors_tools()
