"""
Catalyst Network_Settings Tools

Auto-generated from archived A2A skills.
Total tools: 20
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_settings_get_global(params: Dict, context: Any) -> Dict:
    """Handler for Get Global Network Settings."""
    try:
        # Build API path
        path = "/settings/get/global"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_update_global(params: Dict, context: Any) -> Dict:
    """Handler for Update Global Network Settings."""
    try:
        # Build API path
        path = "/settings/update/global"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_dhcp(params: Dict, context: Any) -> Dict:
    """Handler for Get DHCP Settings."""
    try:
        # Build API path
        path = "/settings/get/dhcp"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_dns(params: Dict, context: Any) -> Dict:
    """Handler for Get DNS Settings."""
    try:
        # Build API path
        path = "/settings/get/dns"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_ntp(params: Dict, context: Any) -> Dict:
    """Handler for Get NTP Settings."""
    try:
        # Build API path
        path = "/settings/get/ntp"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_syslog(params: Dict, context: Any) -> Dict:
    """Handler for Get Syslog Settings."""
    try:
        # Build API path
        path = "/settings/get/syslog"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_snmp(params: Dict, context: Any) -> Dict:
    """Handler for Get SNMP Settings."""
    try:
        # Build API path
        path = "/settings/get/snmp"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_netflow(params: Dict, context: Any) -> Dict:
    """Handler for Get NetFlow Settings."""
    try:
        # Build API path
        path = "/settings/get/netflow"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_timezone(params: Dict, context: Any) -> Dict:
    """Handler for Get Timezone Settings."""
    try:
        # Build API path
        path = "/settings/get/timezone"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_banner(params: Dict, context: Any) -> Dict:
    """Handler for Get Banner Settings."""
    try:
        # Build API path
        path = "/settings/get/banner"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_aaa(params: Dict, context: Any) -> Dict:
    """Handler for Get AAA Settings."""
    try:
        # Build API path
        path = "/settings/get/aaa"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_credentials(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Credentials."""
    try:
        # Build API path
        path = "/settings/get/credentials"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_create_credential(params: Dict, context: Any) -> Dict:
    """Handler for Create Device Credential."""
    try:
        # Build API path
        path = "/settings/create/credential"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_update_credential(params: Dict, context: Any) -> Dict:
    """Handler for Update Device Credential."""
    try:
        # Build API path
        path = "/settings/update/credential"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_delete_credential(params: Dict, context: Any) -> Dict:
    """Handler for Delete Device Credential."""
    try:
        # Build API path
        path = "/settings/delete/credential"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_get_ip_pool(params: Dict, context: Any) -> Dict:
    """Handler for Get IP Address Pools."""
    try:
        # Build API path
        path = "/settings/get/ip/pool"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_create_ip_pool(params: Dict, context: Any) -> Dict:
    """Handler for Create IP Address Pool."""
    try:
        # Build API path
        path = "/settings/create/ip/pool"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_update_ip_pool(params: Dict, context: Any) -> Dict:
    """Handler for Update IP Address Pool."""
    try:
        # Build API path
        path = "/settings/update/ip/pool"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_delete_ip_pool(params: Dict, context: Any) -> Dict:
    """Handler for Delete IP Address Pool."""
    try:
        # Build API path
        path = "/settings/delete/ip/pool"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_settings_reserve_ip_subpool(params: Dict, context: Any) -> Dict:
    """Handler for Reserve IP Subpool."""
    try:
        # Build API path
        path = "/settings/reserve/ip/subpool"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_NETWORK_SETTINGS_TOOLS = [
    create_tool(
        name="catalyst_settings_get_global",
        description="""Get global network settings including DHCP, DNS, NTP, and other service configurations.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=[],
        tags=["catalyst", "settings", "global"],
        requires_write=False,
        handler=handle_settings_get_global,
    ),
    create_tool(
        name="catalyst_settings_update_global",
        description="""Update global network settings for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "settings": {
                        "type": "object"
            }
},
        required=["site_id", "settings"],
        tags=["catalyst", "settings", "update"],
        requires_write=True,
        handler=handle_settings_update_global,
    ),
    create_tool(
        name="catalyst_settings_get_dhcp",
        description="""Get DHCP server configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "dhcp"],
        requires_write=False,
        handler=handle_settings_get_dhcp,
    ),
    create_tool(
        name="catalyst_settings_get_dns",
        description="""Get DNS server configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "dns"],
        requires_write=False,
        handler=handle_settings_get_dns,
    ),
    create_tool(
        name="catalyst_settings_get_ntp",
        description="""Get NTP server configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "ntp"],
        requires_write=False,
        handler=handle_settings_get_ntp,
    ),
    create_tool(
        name="catalyst_settings_get_syslog",
        description="""Get syslog server configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "syslog"],
        requires_write=False,
        handler=handle_settings_get_syslog,
    ),
    create_tool(
        name="catalyst_settings_get_snmp",
        description="""Get SNMP trap server configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "snmp"],
        requires_write=False,
        handler=handle_settings_get_snmp,
    ),
    create_tool(
        name="catalyst_settings_get_netflow",
        description="""Get NetFlow collector configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "netflow"],
        requires_write=False,
        handler=handle_settings_get_netflow,
    ),
    create_tool(
        name="catalyst_settings_get_timezone",
        description="""Get timezone configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "timezone"],
        requires_write=False,
        handler=handle_settings_get_timezone,
    ),
    create_tool(
        name="catalyst_settings_get_banner",
        description="""Get banner message configuration for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "banner"],
        requires_write=False,
        handler=handle_settings_get_banner,
    ),
    create_tool(
        name="catalyst_settings_get_aaa",
        description="""Get AAA (Authentication, Authorization, Accounting) server configuration.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=["site_id"],
        tags=["catalyst", "settings", "aaa"],
        requires_write=False,
        handler=handle_settings_get_aaa,
    ),
    create_tool(
        name="catalyst_settings_get_credentials",
        description="""Get device credentials configured in Catalyst Center.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            }
},
        required=[],
        tags=["catalyst", "settings", "credentials"],
        requires_write=False,
        handler=handle_settings_get_credentials,
    ),
    create_tool(
        name="catalyst_settings_create_credential",
        description="""Create a new device credential.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "credential_type": {
                        "type": "string",
                        "enum": [
                                    "CLI",
                                    "SNMPV2_READ",
                                    "SNMPV2_WRITE",
                                    "SNMPV3",
                                    "HTTP_READ",
                                    "HTTP_WRITE"
                        ]
            },
            "description": {
                        "type": "string"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            },
            "enable_password": {
                        "type": "string"
            }
},
        required=["credential_type"],
        tags=["catalyst", "settings", "credentials", "create"],
        requires_write=True,
        handler=handle_settings_create_credential,
    ),
    create_tool(
        name="catalyst_settings_update_credential",
        description="""Update an existing device credential.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "credential_id": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            },
            "username": {
                        "type": "string"
            },
            "password": {
                        "type": "string"
            }
},
        required=["credential_id"],
        tags=["catalyst", "settings", "credentials", "update"],
        requires_write=True,
        handler=handle_settings_update_credential,
    ),
    create_tool(
        name="catalyst_settings_delete_credential",
        description="""Delete a device credential.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "credential_id": {
                        "type": "string"
            }
},
        required=["credential_id"],
        tags=["catalyst", "settings", "credentials", "delete"],
        requires_write=True,
        handler=handle_settings_delete_credential,
    ),
    create_tool(
        name="catalyst_settings_get_ip_pool",
        description="""Get IP address pools configured in Catalyst Center.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            }
},
        required=[],
        tags=["catalyst", "settings", "ip", "pool"],
        requires_write=False,
        handler=handle_settings_get_ip_pool,
    ),
    create_tool(
        name="catalyst_settings_create_ip_pool",
        description="""Create a new IP address pool.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "ip_pool_name": {
                        "type": "string"
            },
            "ip_pool_cidr": {
                        "type": "string"
            },
            "gateway": {
                        "type": "string"
            },
            "dhcp_server_ips": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "dns_server_ips": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["ip_pool_name", "ip_pool_cidr"],
        tags=["catalyst", "settings", "ip", "pool", "create"],
        requires_write=True,
        handler=handle_settings_create_ip_pool,
    ),
    create_tool(
        name="catalyst_settings_update_ip_pool",
        description="""Update an existing IP address pool.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "ip_pool_id": {
                        "type": "string"
            },
            "ip_pool_name": {
                        "type": "string"
            },
            "gateway": {
                        "type": "string"
            }
},
        required=["ip_pool_id"],
        tags=["catalyst", "settings", "ip", "pool", "update"],
        requires_write=True,
        handler=handle_settings_update_ip_pool,
    ),
    create_tool(
        name="catalyst_settings_delete_ip_pool",
        description="""Delete an IP address pool.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "ip_pool_id": {
                        "type": "string"
            }
},
        required=["ip_pool_id"],
        tags=["catalyst", "settings", "ip", "pool", "delete"],
        requires_write=True,
        handler=handle_settings_delete_ip_pool,
    ),
    create_tool(
        name="catalyst_settings_reserve_ip_subpool",
        description="""Reserve an IP subpool from a global pool for a site.""",
        platform="catalyst",
        category="network_settings",
        properties={
            "site_id": {
                        "type": "string",
                        "description": "Site Id"
            },
            "global_pool_id": {
                        "type": "string"
            },
            "subpool_name": {
                        "type": "string"
            },
            "subpool_type": {
                        "type": "string",
                        "enum": [
                                    "Generic",
                                    "LAN",
                                    "WAN",
                                    "management",
                                    "service"
                        ]
            }
},
        required=["site_id", "global_pool_id", "subpool_name"],
        tags=["catalyst", "settings", "ip", "subpool", "reserve"],
        requires_write=False,
        handler=handle_settings_reserve_ip_subpool,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_network_settings_tools():
    """Register all network_settings tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_NETWORK_SETTINGS_TOOLS)
    logger.info(f"Registered {len(CATALYST_NETWORK_SETTINGS_TOOLS)} catalyst network_settings tools")


# Auto-register on import
register_network_settings_tools()
