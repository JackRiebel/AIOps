"""Claude AI service for intelligent Meraki network management."""

import os
import json
import logging
from typing import List, Dict, Any, Optional
import anthropic
import httpx
from src.services.security_service import SecurityConfigService
from src.config.settings import get_settings

# A2A Protocol has been archived - provide stubs for backward compatibility
# The unified chat service (unified_chat_service.py) replaces A2A functionality
try:
    from src.a2a.orchestrator import AgentOrchestrator, initialize_default_agents
    from src.a2a.registry import get_agent_registry
except ImportError:
    # A2A is archived, provide stubs
    AgentOrchestrator = None
    initialize_default_agents = lambda: None
    get_agent_registry = lambda: None

# Session Context Store for persistent context across tool calls
from src.services.session_context_store import (
    get_session_context_store,
    SessionContext,
    OrgType,
    EntityType,
)

logger = logging.getLogger(__name__)


def _get_backend_url() -> str:
    """Get the backend API URL from environment or settings."""
    # Check environment variable first
    backend_url = os.environ.get("BACKEND_URL") or os.environ.get("API_BASE_URL")
    if backend_url:
        return backend_url.rstrip("/")

    # Try to get from settings
    try:
        settings = get_settings()
        port = getattr(settings, 'port', 8002)
        host = getattr(settings, 'host', 'localhost')
        return f"http://{host}:{port}"
    except Exception:
        pass

    # Fallback to default
    return "http://localhost:8002"


class ClaudeNetworkAssistant:
    """AI assistant for Meraki network management using Claude."""

    def __init__(self, api_key: str, model: str = None, temperature: float = None, max_tokens: int = None):
        """Initialize Claude assistant.

        Args:
            api_key: Anthropic API key
            model: Model ID to use (defaults to claude-sonnet-4-5-20250929)
            temperature: Temperature for response generation (0.0-2.0, default 0.7)
            max_tokens: Maximum tokens for response (default 4096)
        """
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model or "claude-sonnet-4-5-20250929"
        self.temperature = temperature if temperature is not None else 0.7
        self.max_tokens = max_tokens if max_tokens is not None else 4096
        self.security_service = SecurityConfigService()

        # Initialize A2A Protocol for intelligent agent routing
        # This replaces hardcoded routing with dynamic capability-based routing
        self.agent_registry = initialize_default_agents()
        self.orchestrator = AgentOrchestrator(self.agent_registry)
        logger.info("[A2A] Agent orchestrator initialized with Knowledge and Implementation agents")

    def generate_simple_response(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate a simple response without tools (for reports, summaries, etc.)."""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=self.temperature,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text if response.content else ""

    async def _extract_entities_from_result(
        self,
        session_id: str,
        tool_name: str,
        result: Dict[str, Any]
    ) -> None:
        """Extract and store discovered entities from a tool result.

        This is called after each successful tool execution to track
        discovered networks, devices, VLANs, SSIDs, etc. in the session context.

        Args:
            session_id: Session ID for context storage
            tool_name: Name of the tool that produced the result
            result: The tool result dictionary
        """
        if not session_id or not result.get("success"):
            return

        try:
            context_store = get_session_context_store()
            entities_added = await context_store.extract_entities_from_result(
                session_id=session_id,
                tool_name=tool_name,
                result=result
            )

            # Also store compressed result for future context
            await context_store.add_compressed_result(
                session_id=session_id,
                tool_name=tool_name,
                success=result.get("success", False),
                result=result
            )

            if entities_added > 0:
                logger.debug(
                    f"[SessionContext] Extracted {entities_added} entities from {tool_name}"
                )

        except Exception as e:
            logger.warning(f"[SessionContext] Error extracting entities: {e}")
            # Don't fail the tool call if entity extraction fails

    def _detect_org_type_from_tool(self, tool_name: str) -> Optional[OrgType]:
        """Detect organization type from tool name.

        This helps the SessionContextStore know which org context to use
        for a given tool call.

        Args:
            tool_name: Name of the tool being executed

        Returns:
            OrgType enum value or None if unknown
        """
        tool_lower = tool_name.lower()

        # Meraki tools
        meraki_keywords = [
            "network", "device", "ssid", "vlan", "client", "switch", "appliance",
            "wireless", "camera", "sensor", "license", "organization", "admin",
            "meraki", "mx", "mr", "ms", "mv", "mt"
        ]
        if any(kw in tool_lower for kw in meraki_keywords):
            return OrgType.MERAKI

        # Splunk tools
        if any(kw in tool_lower for kw in ["splunk", "spl", "search", "index", "log"]):
            return OrgType.SPLUNK

        # ThousandEyes tools
        if any(kw in tool_lower for kw in ["thousandeyes", "test", "agent", "path", "bgp"]):
            return OrgType.THOUSANDEYES

        # Catalyst tools
        if any(kw in tool_lower for kw in ["catalyst", "dnac", "site", "assurance", "dna"]):
            return OrgType.CATALYST

        return None

    def _get_meraki_tools(self) -> List[Dict[str, Any]]:
        """Define available Meraki API tools for Claude to use."""
        return [
            {
                "name": "list_networks",
                "description": "List all networks in the Meraki organization. Returns network names, IDs, and tags.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_network_by_name",
                "description": "Find a network by its name and get its ID and details. Use this when the user mentions a network by name to get the network_id needed for other tools. Supports partial, case-insensitive matching.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The name (or partial name) of the network to find"
                        }
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "get_devices_in_network_by_name",
                "description": "Find a network by name and list all devices in it. This is the PRIMARY tool to use when users ask about devices in a specific network by name. Combines network lookup and device listing in one call.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_name": {
                            "type": "string",
                            "description": "The name (or partial name) of the network to find devices in"
                        }
                    },
                    "required": ["network_name"]
                }
            },
            {
                "name": "get_network_details",
                "description": "Get detailed information about a specific network including timezone, tags, and configuration.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "The ID of the network to get details for"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "list_ssids",
                "description": "List all 15 wireless SSID slots (0-14) for a network. Shows which slots are in use (enabled) and which are available. Use this to find an available slot before configuring a new SSID.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID to list SSIDs for. Required to see all SSID slots. Use list_networks first to get the network ID."
                        },
                        "show_all": {
                            "type": "boolean",
                            "description": "If true, show all 15 SSID slots including disabled/unconfigured ones. Default false (only enabled)."
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "list_devices",
                "description": "List all devices in the organization with their status (online/offline), model, and network assignment.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "status_filter": {
                            "type": "string",
                            "enum": ["all", "online", "offline"],
                            "description": "Filter devices by status"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "list_devices_by_network",
                "description": "List all devices in a specific network. Use this when filtering devices by a particular network name or ID.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "The network ID (e.g., L_123456789). First use list_networks to get network IDs."
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_device_details",
                "description": "Get detailed information about a specific device including firmware, IP address, and connection status.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "The serial number of the device"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "list_alerts",
                "description": "Get recent alerts and issues in the organization.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "timespan": {
                            "type": "integer",
                            "description": "Number of seconds to look back for alerts (default 86400 = 1 day)"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_network_clients",
                "description": "List clients connected to a specific network.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "The network ID to get clients for"
                        },
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (max 2592000 = 30 days)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "create_network",
                "description": "Create a new Meraki network in the organization. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Name of the network to create"
                        },
                        "product_types": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Product types for the network (e.g., ['appliance', 'switch', 'wireless'])"
                        },
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional tags for the network"
                        },
                        "timezone": {
                            "type": "string",
                            "description": "Timezone for the network (e.g., 'America/Chicago', 'America/Los_Angeles')"
                        },
                        "notes": {
                            "type": "string",
                            "description": "Optional notes about the network"
                        }
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "update_network",
                "description": "Update an existing network's settings. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "ID of the network to update"
                        },
                        "name": {
                            "type": "string",
                            "description": "New name for the network"
                        },
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Updated tags for the network"
                        },
                        "timezone": {
                            "type": "string",
                            "description": "Updated timezone"
                        },
                        "notes": {
                            "type": "string",
                            "description": "Updated notes"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "delete_network",
                "description": "Delete a network from the organization. WARNING: This is irreversible. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "ID of the network to delete"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "claim_device",
                "description": "Claim a device into a network using its serial number. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID to claim the device into"
                        },
                        "serial": {
                            "type": "string",
                            "description": "Serial number of the device to claim"
                        }
                    },
                    "required": ["network_id", "serial"]
                }
            },
            {
                "name": "remove_device",
                "description": "Remove a device from a network. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID to remove the device from"
                        },
                        "serial": {
                            "type": "string",
                            "description": "Serial number of the device to remove"
                        }
                    },
                    "required": ["network_id", "serial"]
                }
            },
            {
                "name": "update_device",
                "description": "Update device settings like name, tags, or address. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Serial number of the device"
                        },
                        "name": {
                            "type": "string",
                            "description": "New name for the device"
                        },
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Tags for the device"
                        },
                        "address": {
                            "type": "string",
                            "description": "Physical address of the device"
                        },
                        "notes": {
                            "type": "string",
                            "description": "Notes about the device"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "reboot_device",
                "description": "Reboot a Meraki device. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Serial number of the device to reboot"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "blink_device_leds",
                "description": "Blink the LEDs on a device to help locate it physically. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Serial number of the device"
                        },
                        "duration": {
                            "type": "integer",
                            "description": "Duration in seconds to blink LEDs (default 20, max 120)"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "update_ssid",
                "description": "Configure/update wireless SSID settings. Meraki networks have 15 pre-existing SSID slots (0-14). To 'create' a new SSID, configure an unused slot by setting name, enabled=true, auth_mode, and psk. Requires edit mode to be enabled. IMPORTANT: First use list_ssids to find an available/unused SSID slot, then update that slot.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID containing the SSID. Use list_networks first to get the network ID."
                        },
                        "ssid_number": {
                            "type": "integer",
                            "description": "SSID slot number (0-14). Use list_ssids to find an available slot."
                        },
                        "name": {
                            "type": "string",
                            "description": "SSID name (the wireless network name users will see)"
                        },
                        "enabled": {
                            "type": "boolean",
                            "description": "Whether the SSID is enabled/broadcasting. Set to true to activate."
                        },
                        "auth_mode": {
                            "type": "string",
                            "description": "Authentication mode: 'open' (no password), 'psk' (WPA2 with password), '8021x-meraki', '8021x-radius'"
                        },
                        "psk": {
                            "type": "string",
                            "description": "Pre-shared key/password (required when auth_mode is 'psk'). Must be 8-63 characters."
                        },
                        "encryption_mode": {
                            "type": "string",
                            "description": "Encryption mode: 'wpa' (WPA2), 'wpa-eap' (for 802.1x). Use 'wpa' for psk auth."
                        }
                    },
                    "required": ["network_id", "ssid_number"]
                }
            },
            {
                "name": "create_vlan",
                "description": "Create a new VLAN in a network. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID to create VLAN in"
                        },
                        "vlan_id": {
                            "type": "integer",
                            "description": "VLAN ID (1-4094)"
                        },
                        "name": {
                            "type": "string",
                            "description": "Name of the VLAN"
                        },
                        "subnet": {
                            "type": "string",
                            "description": "Subnet in CIDR notation (e.g., 192.168.1.0/24)"
                        },
                        "appliance_ip": {
                            "type": "string",
                            "description": "IP address of the appliance in this VLAN"
                        }
                    },
                    "required": ["network_id", "vlan_id", "name", "subnet", "appliance_ip"]
                }
            },
            {
                "name": "update_vlan",
                "description": "Update an existing VLAN's settings. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID containing the VLAN"
                        },
                        "vlan_id": {
                            "type": "integer",
                            "description": "VLAN ID to update"
                        },
                        "name": {
                            "type": "string",
                            "description": "Updated VLAN name"
                        },
                        "subnet": {
                            "type": "string",
                            "description": "Updated subnet"
                        },
                        "appliance_ip": {
                            "type": "string",
                            "description": "Updated appliance IP"
                        }
                    },
                    "required": ["network_id", "vlan_id"]
                }
            },
            {
                "name": "delete_vlan",
                "description": "Delete a VLAN from a network. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID containing the VLAN"
                        },
                        "vlan_id": {
                            "type": "integer",
                            "description": "VLAN ID to delete"
                        }
                    },
                    "required": ["network_id", "vlan_id"]
                }
            },
            {
                "name": "list_vlans",
                "description": "List all VLANs configured on an MX appliance network. Returns VLAN IDs, names, subnets, and appliance IPs. Use this to see current VLAN configuration.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID (starts with L_ or N_)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_appliance_ports",
                "description": "Get all physical port configurations on an MX appliance (MX68, MX67, etc.). Shows port number, enabled status, type (trunk/access), VLAN assignments, and link state.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID (starts with L_ or N_)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_switch_ports",
                "description": "Get all switch port configurations for a device.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Serial number of the switch"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "update_switch_port",
                "description": "Update switch port configuration. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Serial number of the switch"
                        },
                        "port_id": {
                            "type": "string",
                            "description": "Port ID (e.g., '1', '2', etc.)"
                        },
                        "name": {
                            "type": "string",
                            "description": "Port name/description"
                        },
                        "enabled": {
                            "type": "boolean",
                            "description": "Whether port is enabled"
                        },
                        "vlan": {
                            "type": "integer",
                            "description": "VLAN ID for the port"
                        },
                        "type": {
                            "type": "string",
                            "description": "Port type (access or trunk)"
                        }
                    },
                    "required": ["serial", "port_id"]
                }
            },
            {
                "name": "get_firewall_rules",
                "description": "Get L3 firewall rules for an appliance network.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID to get firewall rules from"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "update_firewall_rules",
                "description": "Update L3 firewall rules. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID to update rules in"
                        },
                        "rules": {
                            "type": "array",
                            "description": "Array of firewall rule objects with comment, policy, protocol, srcCidr, destCidr, etc.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "comment": {"type": "string", "description": "Rule description"},
                                    "policy": {"type": "string", "description": "allow or deny"},
                                    "protocol": {"type": "string", "description": "tcp, udp, icmp, any"},
                                    "srcCidr": {"type": "string", "description": "Source CIDR"},
                                    "destCidr": {"type": "string", "description": "Destination CIDR"},
                                    "destPort": {"type": "string", "description": "Destination port or range"}
                                }
                            }
                        }
                    },
                    "required": ["network_id", "rules"]
                }
            },
            {
                "name": "get_organization_inventory",
                "description": "Get all devices in organization inventory (claimed and unclaimed).",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_organization_licenses",
                "description": "Get license overview for the organization.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_organization_config_changes",
                "description": "Get recent configuration changes in the organization.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (default 86400)"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_client_details",
                "description": "Get detailed information about a specific client.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "client_id": {
                            "type": "string",
                            "description": "Client MAC address or ID"
                        }
                    },
                    "required": ["network_id", "client_id"]
                }
            },
            {
                "name": "update_client_policy",
                "description": "Update client policy (bandwidth, group policy, etc.). Requires edit mode.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "client_id": {
                            "type": "string",
                            "description": "Client MAC address"
                        },
                        "device_policy": {
                            "type": "string",
                            "description": "Device policy: Normal, Group policy, Blocked, etc."
                        },
                        "group_policy_id": {
                            "type": "string",
                            "description": "Group policy ID if using group policy"
                        }
                    },
                    "required": ["network_id", "client_id", "device_policy"]
                }
            },
            {
                "name": "get_organization_admins",
                "description": "Get list of administrators in the organization.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "create_organization_admin",
                "description": "Create a new administrator. Requires edit mode to be enabled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "email": {
                            "type": "string",
                            "description": "Admin email address"
                        },
                        "name": {
                            "type": "string",
                            "description": "Admin name"
                        },
                        "org_access": {
                            "type": "string",
                            "description": "Access level: full, read-only, none"
                        },
                        "networks": {
                            "type": "array",
                            "description": "Network-specific access if not full org access",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string", "description": "Network ID"},
                                    "access": {"type": "string", "description": "Access level for this network"}
                                }
                            }
                        }
                    },
                    "required": ["email", "name", "org_access"]
                }
            },
            {
                "name": "get_vpn_status",
                "description": "Get VPN site-to-site configuration and status.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_network_traffic",
                "description": "Get network traffic data and application usage.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_network_events",
                "description": "Get event log for a network showing configuration changes and user actions.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (default 86400)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_network_alerts_settings",
                "description": "Get alert configuration for a network.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "update_network_alerts_settings",
                "description": "Update alert configuration for a network. Requires edit mode.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "default_destinations": {
                            "type": "object",
                            "description": "Default alert destinations (emails, webhooks, etc.)"
                        },
                        "alerts": {
                            "type": "array",
                            "description": "Alert rules configuration",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "type": {"type": "string", "description": "Alert type"},
                                    "enabled": {"type": "boolean", "description": "Whether alert is enabled"}
                                }
                            }
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "ping_device",
                "description": "Initiate a ping test from a device. Requires edit mode.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Device serial number"
                        },
                        "target_ip": {
                            "type": "string",
                            "description": "Target IP address to ping"
                        },
                        "count": {
                            "type": "integer",
                            "description": "Number of pings (default 5)"
                        }
                    },
                    "required": ["serial", "target_ip"]
                }
            },
            {
                "name": "cable_test_device",
                "description": "Run cable diagnostics on switch ports. Requires edit mode.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Device serial number"
                        },
                        "ports": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Port IDs to test"
                        }
                    },
                    "required": ["serial", "ports"]
                }
            },
            {
                "name": "cycle_switch_ports",
                "description": "Power cycle switch ports (disable then re-enable). Requires edit mode.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Switch serial number"
                        },
                        "ports": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Port IDs to cycle"
                        }
                    },
                    "required": ["serial", "ports"]
                }
            },
            {
                "name": "get_switch_port_statuses",
                "description": "Get real-time status of all switch ports (link state, speed, errors, etc.).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Switch serial number"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "get_wireless_channel_utilization",
                "description": "Get wireless channel utilization history for performance analysis.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (default 86400)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_wireless_signal_quality",
                "description": "Get wireless signal quality metrics (RSSI, SNR) over time.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (default 86400)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_wireless_connection_stats",
                "description": "Get wireless connection statistics (success rates, failures).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (default 86400)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_appliance_content_filtering",
                "description": "Get content filtering configuration for web security.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "update_appliance_content_filtering",
                "description": "Update content filtering rules (URL blocking, categories). Requires edit mode.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "allowed_urls": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "URLs to allow"
                        },
                        "blocked_urls": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "URLs to block"
                        },
                        "blocked_url_patterns": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "URL patterns to block"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_appliance_security_events",
                "description": "Get security events from firewall (IDS/IPS detections, threats).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (default 86400)"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_appliance_traffic_shaping",
                "description": "Get traffic shaping configuration (bandwidth limits, QoS).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "update_appliance_traffic_shaping",
                "description": "Update traffic shaping rules. Requires edit mode.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "network_id": {
                            "type": "string",
                            "description": "Network ID"
                        },
                        "global_bandwidth_limits": {
                            "type": "object",
                            "description": "Global bandwidth limits configuration"
                        }
                    },
                    "required": ["network_id"]
                }
            },
            {
                "name": "get_camera_video_settings",
                "description": "Get camera video quality and recording settings.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Camera serial number"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "get_device_uplink",
                "description": "Get device uplink status and connection information.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "serial": {
                            "type": "string",
                            "description": "Device serial number"
                        }
                    },
                    "required": ["serial"]
                }
            },
            {
                "name": "get_organization_api_requests",
                "description": "Get API request logs for monitoring usage and troubleshooting.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "timespan": {
                            "type": "integer",
                            "description": "Timespan in seconds (default 86400)"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "discover_meraki_functions",
                "description": "Browse and search through all 729+ available Meraki SDK functions. Use this when you need a specialized function not covered by the standard tools. Returns list of functions by module (organizations, networks, devices, appliance, switch, wireless, camera, etc.).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "module_name": {
                            "type": "string",
                            "description": "Optional: Filter by specific module (e.g., 'organizations', 'networks', 'devices', 'appliance', 'switch', 'wireless', 'camera', 'sensor', 'sm', 'licensing', 'insight', 'cellularGateway', 'administered')"
                        },
                        "search_term": {
                            "type": "string",
                            "description": "Optional: Search for functions containing this term (e.g., 'uplink', 'vlan', 'client')"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "call_meraki_sdk_function",
                "description": "Call ANY Meraki Dashboard SDK function directly. Use this for specialized operations not covered by standard tools. IMPORTANT: First use discover_meraki_functions to find the correct module_name and function_name. Requires edit mode for write operations.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "module_name": {
                            "type": "string",
                            "description": "SDK module name (e.g., 'organizations', 'networks', 'devices', 'appliance', 'switch', 'wireless')"
                        },
                        "function_name": {
                            "type": "string",
                            "description": "Function name from the SDK (e.g., 'getOrganizationUplinksStatuses', 'getNetworkApplianceVlans')"
                        },
                        "parameters": {
                            "type": "object",
                            "description": "Function parameters as key-value pairs (e.g., {\"organizationId\": \"123\", \"networkId\": \"N_456\"})",
                            "additionalProperties": True
                        }
                    },
                    "required": ["module_name", "function_name"]
                }
            }
        ]

    def _get_thousandeyes_tools(self) -> List[Dict[str, Any]]:
        """Define available ThousandEyes API tools for Claude to use."""
        return [
            {
                "name": "get_thousandeyes_tests",
                "description": "Get all ThousandEyes tests (network, web, DNS monitoring tests) or filter by type.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "test_type": {
                            "type": "string",
                            "description": "Optional filter by test type (agent-to-server, http-server, page-load, etc.)"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_thousandeyes_alerts",
                "description": "Get ThousandEyes alerts - current network issues and problems detected.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "active_only": {
                            "type": "boolean",
                            "description": "If true, return only currently active alerts"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_thousandeyes_agents",
                "description": "Get status of all ThousandEyes agents (monitoring endpoints).",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        ]

    def _get_catalyst_tools(self) -> List[Dict[str, Any]]:
        """Define available Cisco Catalyst Center API tools for Claude to use."""
        return [
            {
                "name": "get_catalyst_sites",
                "description": "List all sites in the Catalyst Center hierarchy (buildings, floors, areas) for network organization.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_catalyst_devices",
                "description": "List all network devices managed by Catalyst Center (routers, switches, wireless controllers, access points).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "family": {
                            "type": "string",
                            "description": "Device family filter (e.g., 'Switches and Hubs', 'Routers', 'Wireless Controller')"
                        },
                        "status": {
                            "type": "string",
                            "enum": ["online", "offline"],
                            "description": "Filter devices by reachability status"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_catalyst_device_details",
                "description": "Get detailed information about a specific network device including configuration, status, and health.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "device_id": {
                            "type": "string",
                            "description": "Device UUID to retrieve details for"
                        }
                    },
                    "required": ["device_id"]
                }
            },
            {
                "name": "get_catalyst_network_health",
                "description": "Get overall network health statistics and metrics from Catalyst Center assurance.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "site_id": {
                            "type": "string",
                            "description": "Optional site ID to filter health metrics by location"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_catalyst_issues",
                "description": "Get active network issues and alerts detected by Catalyst Center assurance and AI insights.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "severity": {
                            "type": "string",
                            "description": "Issue severity (P1, P2, P3, P4)"
                        },
                        "status": {
                            "type": "string",
                            "description": "Issue status (active or resolved)"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_catalyst_clients",
                "description": "List clients connected to the network managed by Catalyst Center.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "site_id": {
                            "type": "string",
                            "description": "Optional site ID to filter clients by location"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_catalyst_wireless_profiles",
                "description": "List wireless SSIDs and profiles configured in Catalyst Center.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_catalyst_topology",
                "description": "Get network topology visualization (physical, layer2, layer3, or vlan).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "topology_type": {
                            "type": "string",
                            "enum": ["physical", "layer2", "layer3", "vlan"],
                            "description": "Type of topology to retrieve"
                        }
                    },
                    "required": []
                }
            }
        ]

    def _get_knowledge_tools(self) -> List[Dict[str, Any]]:
        """Define knowledge base tools for consulting the Cisco Knowledge Agent.

        These tools enable true agent-to-agent communication where the Implementation
        Agent (Claude/Gemini/etc.) consults the Knowledge Agent (Cisco Circuit) for
        authoritative Cisco networking information.
        """
        return [
            {
                "name": "consult_knowledge_agent",
                "description": """Consult the Cisco Knowledge Agent for authoritative networking information.

USE THIS TOOL when you need:
- Best practices for network configuration
- API documentation or endpoint details
- CLI command syntax and examples
- Design recommendations from Cisco Validated Designs (CVDs)
- Troubleshooting guidance

PROVIDE FULL CONTEXT: The Knowledge Agent works best when you share:
1. What the user originally asked for
2. What you've already discovered about their environment
3. Results from tools you've already run
4. Specific questions you need answered

The Knowledge Agent uses Cisco Circuit AI and has access to a vector-indexed knowledge base of Cisco documentation.""",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Your specific question for the Knowledge Agent"
                        },
                        "user_original_request": {
                            "type": "string",
                            "description": "The original request from the user (for context)"
                        },
                        "conversation_summary": {
                            "type": "string",
                            "description": "Brief summary of the conversation so far"
                        },
                        "discovered_environment": {
                            "type": "object",
                            "description": "Environment details you've discovered (networks, devices, configs, etc.)"
                        },
                        "prior_tool_results": {
                            "type": "array",
                            "items": {"type": "object"},
                            "description": "Summary of relevant results from tools you've already called"
                        },
                        "specific_questions": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of specific questions you need answered"
                        },
                        "product_filter": {
                            "type": "string",
                            "enum": ["meraki", "catalyst", "ios-xe", "ise", "general"],
                            "description": "Optional: focus search on specific product docs"
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "request_implementation_plan",
                "description": """Request a structured implementation plan from the Cisco Knowledge Agent.

USE THIS TOOL when you need to:
- Plan a configuration change with specific API calls or CLI commands
- Deploy a new feature following best practices
- Implement a network design with proper sequencing
- Get rollback procedures for risky changes

CRITICAL: Provide detailed environment context for accurate, actionable steps.

The Knowledge Agent will return:
- Ordered implementation steps
- Specific API endpoints and parameters
- CLI commands with exact syntax
- Rollback procedures for each step
- Warnings about potential issues""",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "implementation_request": {
                            "type": "string",
                            "description": "What you want to implement (be specific)"
                        },
                        "implementation_goal": {
                            "type": "string",
                            "description": "The end goal - what should be true when implementation is complete"
                        },
                        "current_environment": {
                            "type": "object",
                            "description": "Current state: networks, devices, existing configurations, constraints"
                        },
                        "user_original_request": {
                            "type": "string",
                            "description": "What the user originally asked for"
                        },
                        "prior_discoveries": {
                            "type": "array",
                            "items": {"type": "object"},
                            "description": "What you've discovered from previous tool calls"
                        },
                        "constraints": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Any constraints or requirements (maintenance windows, specific devices, etc.)"
                        },
                        "product_focus": {
                            "type": "string",
                            "enum": ["meraki", "catalyst", "ios-xe", "ise"],
                            "description": "Primary product platform for implementation"
                        }
                    },
                    "required": ["implementation_request"]
                }
            }
        ]

    def _get_all_tools(self) -> List[Dict[str, Any]]:
        """Combine all available tools (Meraki + ThousandEyes + Catalyst Center + Knowledge)."""
        return (
            self._get_meraki_tools() +
            self._get_thousandeyes_tools() +
            self._get_catalyst_tools() +
            self._get_knowledge_tools()
        )

    async def _execute_tool(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        credentials: Dict[str, str],
        org_id: str,
        organization_name: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a Meraki, ThousandEyes, or Catalyst Center API tool call.

        Args:
            tool_name: Name of the tool to execute
            tool_input: Input parameters for the tool
            credentials: API credentials for the organization
            org_id: Organization ID
            organization_name: Internal organization name (for fetching credentials)
            session_id: Optional session ID for context persistence

        Returns:
            Dictionary with result data
        """
        # === SESSION CONTEXT INTEGRATION ===
        # Get or create session context to persist org/entity info across calls
        context_store = get_session_context_store()
        session_ctx = None

        if session_id:
            try:
                session_ctx = await context_store.get_or_create(session_id)

                # Detect org type from tool name
                org_type = self._detect_org_type_from_tool(tool_name)

                # Update org context if not already set (fixes "org not found" issues)
                if org_id and org_type and not session_ctx.get_org_context(org_type):
                    await context_store.update_org_context(
                        session_id=session_id,
                        org_id=org_id,
                        org_name=organization_name,
                        org_type=org_type,
                        credentials=credentials
                    )
                    logger.debug(f"[SessionContext] Updated org context: {organization_name} ({org_type.value})")

                # Enrich tool input with session context (auto-fill org_id, resolve names)
                tool_input = await context_store.enrich_tool_input(session_id, tool_name, tool_input)

            except Exception as e:
                logger.warning(f"[SessionContext] Error setting up context: {e}")
                # Continue without context - don't block tool execution
        # Handle Knowledge Agent tools (true agent-to-agent communication)
        if tool_name in ["consult_knowledge_agent", "request_implementation_plan"]:
            from src.services.knowledge_service import get_knowledge_service
            from src.models.knowledge import KnowledgeQueryRequest, AgentContext
            from src.config.database import get_async_session

            try:
                knowledge_service = get_knowledge_service()

                # Create async database session
                async with get_async_session() as session:
                    if tool_name == "consult_knowledge_agent":
                        # Build full AgentContext for true agent-to-agent communication
                        agent_context = AgentContext(
                            user_query=tool_input.get("user_original_request"),
                            conversation_summary=tool_input.get("conversation_summary"),
                            environment={
                                **(tool_input.get("discovered_environment") or {}),
                                "organization_id": org_id,
                                "organization_name": organization_name
                            },
                            prior_tool_results=tool_input.get("prior_tool_results") or [],
                            implementation_goal=None,  # Not applicable for queries
                            specific_questions=tool_input.get("specific_questions") or [],
                            agent_session_id=tool_input.get("agent_session_id")
                        )

                        # Build filters from tool input
                        filters = {}
                        if tool_input.get("product_filter"):
                            filters["product"] = tool_input["product_filter"]
                        if tool_input.get("doc_type_filter"):
                            filters["doc_type"] = tool_input["doc_type_filter"]

                        request = KnowledgeQueryRequest(
                            query=tool_input["query"],
                            agent_context=agent_context,
                            filters=filters if filters else None,
                            top_k=10
                        )

                        response = await knowledge_service.query_knowledge(
                            session=session,
                            request=request
                        )

                        return {
                            "success": True,
                            "response": response.response,
                            "confidence": response.confidence,
                            "sources": [
                                {"document": s.document, "relevance": s.relevance}
                                for s in response.sources
                            ],
                            "agent_communication": {
                                "from": "implementation_agent",
                                "to": "knowledge_agent",
                                "context_provided": bool(agent_context.user_query or agent_context.conversation_summary),
                                "environment_details": bool(agent_context.environment),
                                "prior_results_count": len(agent_context.prior_tool_results)
                            }
                        }

                    elif tool_name == "request_implementation_plan":
                        # Build full AgentContext for implementation planning
                        agent_context = AgentContext(
                            user_query=tool_input.get("user_original_request"),
                            conversation_summary=None,
                            environment={
                                **(tool_input.get("current_environment") or {}),
                                "organization_id": org_id,
                                "organization_name": organization_name
                            },
                            prior_tool_results=tool_input.get("prior_discoveries") or [],
                            implementation_goal=tool_input.get("implementation_goal"),
                            specific_questions=tool_input.get("constraints") or [],
                            agent_session_id=tool_input.get("agent_session_id")
                        )

                        # Build filters from tool input
                        filters = {}
                        if tool_input.get("product_focus"):
                            filters["product"] = tool_input["product_focus"]

                        request = KnowledgeQueryRequest(
                            query=tool_input["implementation_request"],
                            agent_context=agent_context,
                            filters=filters if filters else None,
                            top_k=15
                        )

                        response = await knowledge_service.get_implementation_plan(
                            session=session,
                            request=request,
                            environment_context=agent_context.environment
                        )

                        return {
                            "success": True,
                            "recommendation": response.recommendation,
                            "confidence": response.confidence,
                            "steps": [
                                {
                                    "order": s.order,
                                    "action": s.action,
                                    "api": s.api,
                                    "endpoint": s.endpoint,
                                    "command": s.command,
                                    "params": s.params,
                                    "description": s.description,
                                    "rollback": s.rollback
                                }
                                for s in response.steps
                            ],
                            "warnings": response.warnings,
                            "requires_confirmation": response.requires_confirmation,
                            "sources": [
                                {"document": s.document, "relevance": s.relevance}
                                for s in response.sources
                            ],
                            "agent_communication": {
                                "from": "implementation_agent",
                                "to": "knowledge_agent",
                                "implementation_goal": agent_context.implementation_goal,
                                "environment_details": bool(agent_context.environment),
                                "prior_discoveries_count": len(agent_context.prior_tool_results),
                                "constraints_count": len(agent_context.specific_questions)
                            }
                        }

            except Exception as e:
                logger.error(f"Knowledge Agent communication error: {e}")
                return {
                    "success": False,
                    "error": f"Knowledge Agent error: {str(e)}",
                    "note": "The knowledge base may not be configured. Run the migration script to set up pgvector tables."
                }

        # Handle ThousandEyes tools
        if tool_name.startswith("get_thousandeyes_"):
            from src.services.thousandeyes_service import ThousandEyesClient
            from src.services.credential_manager import CredentialManager

            try:
                # Get ThousandEyes credentials from database
                cred_manager = CredentialManager()
                te_credentials = await cred_manager.get_credentials(organization_name)

                if not te_credentials or not te_credentials.get("api_key"):
                    return {
                        "success": False,
                        "error": "ThousandEyes is not configured for this organization. Please add a ThousandEyes organization."
                    }

                # Create ThousandEyes client with organization credentials
                te_client = ThousandEyesClient(
                    oauth_token=te_credentials["api_key"],
                    base_url=te_credentials.get("base_url", "https://api.thousandeyes.com/v7")
                )

                if tool_name == "get_thousandeyes_tests":
                    result = await te_client.get_tests(tool_input.get("test_type"))
                    return result
                elif tool_name == "get_thousandeyes_alerts":
                    result = await te_client.get_alerts(tool_input.get("active_only", True))
                    return result
                elif tool_name == "get_thousandeyes_agents":
                    result = await te_client.get_agents()
                    return result
                else:
                    return {"success": False, "error": f"Unknown ThousandEyes tool: {tool_name}"}
            except Exception as e:
                return {"success": False, "error": f"ThousandEyes API error: {str(e)}"}

        # Handle Catalyst Center tools
        if tool_name.startswith("get_catalyst_"):
            from src.services.catalyst_api import CatalystCenterClient
            from src.services.credential_manager import CredentialManager

            try:
                # Get Catalyst Center credentials from database
                cred_manager = CredentialManager()
                catalyst_credentials = await cred_manager.get_credentials(organization_name)

                if not catalyst_credentials:
                    return {
                        "success": False,
                        "error": "Catalyst Center is not configured for this organization."
                    }

                # Support both bearer token and username/password authentication
                api_token = catalyst_credentials.get("api_token") or catalyst_credentials.get("api_key")
                username = catalyst_credentials.get("username")
                password = catalyst_credentials.get("password")

                if not api_token and not (username and password):
                    return {
                        "success": False,
                        "error": "Catalyst Center requires either api_token or (username + password) credentials."
                    }

                # Create Catalyst Center client
                catalyst_client = CatalystCenterClient(
                    username=username,
                    password=password,
                    base_url=catalyst_credentials.get("base_url", ""),
                    verify_ssl=catalyst_credentials.get("verify_ssl", True),
                    api_token=api_token
                )

                # Execute the appropriate tool
                if tool_name == "get_catalyst_sites":
                    sites = await catalyst_client.get_sites()
                    await catalyst_client.close()
                    return {
                        "success": True,
                        "data": sites,
                        "summary": f"Found {len(sites)} sites"
                    }
                elif tool_name == "get_catalyst_devices":
                    devices = await catalyst_client.get_devices(
                        family=tool_input.get("family"),
                        status=tool_input.get("status")
                    )
                    await catalyst_client.close()
                    return {
                        "success": True,
                        "data": devices,
                        "summary": f"Found {len(devices)} devices"
                    }
                elif tool_name == "get_catalyst_device_details":
                    device_id = tool_input.get("device_id")
                    if not device_id:
                        return {"success": False, "error": "device_id is required"}
                    device = await catalyst_client.get_device_details(device_id)
                    await catalyst_client.close()
                    if device:
                        return {"success": True, "data": device}
                    else:
                        return {"success": False, "error": f"Device {device_id} not found"}
                elif tool_name == "get_catalyst_network_health":
                    health = await catalyst_client.get_network_health(
                        site_id=tool_input.get("site_id")
                    )
                    await catalyst_client.close()
                    return {"success": True, "data": health}
                elif tool_name == "get_catalyst_issues":
                    issues = await catalyst_client.get_issues(
                        severity=tool_input.get("severity"),
                        status=tool_input.get("status")
                    )
                    await catalyst_client.close()
                    return {
                        "success": True,
                        "data": issues,
                        "summary": f"Found {len(issues)} issues"
                    }
                elif tool_name == "get_catalyst_clients":
                    clients = await catalyst_client.get_clients(
                        site_id=tool_input.get("site_id")
                    )
                    await catalyst_client.close()
                    return {
                        "success": True,
                        "data": clients,
                        "summary": f"Found {len(clients)} clients"
                    }
                elif tool_name == "get_catalyst_wireless_profiles":
                    profiles = await catalyst_client.get_wireless_profiles()
                    await catalyst_client.close()
                    return {
                        "success": True,
                        "data": profiles,
                        "summary": f"Found {len(profiles)} wireless profiles"
                    }
                elif tool_name == "get_catalyst_topology":
                    topology_type = tool_input.get("topology_type", "physical")
                    topology = await catalyst_client.get_topology(topology_type=topology_type)
                    await catalyst_client.close()
                    return {"success": True, "data": topology}
                else:
                    await catalyst_client.close()
                    return {"success": False, "error": f"Unknown Catalyst Center tool: {tool_name}"}

            except Exception as e:
                return {"success": False, "error": f"Catalyst Center API error: {str(e)}"}

        # Handle Meraki tools
        headers = {
            "X-Cisco-Meraki-API-Key": credentials["api_key"],
            "Content-Type": "application/json"
        }
        base_url = credentials["base_url"]

        async with httpx.AsyncClient(verify=credentials["verify_ssl"], timeout=30.0) as client:
            try:
                if tool_name == "list_networks":
                    response = await client.get(
                        f"{base_url}/organizations/{org_id}/networks",
                        headers=headers
                    )
                    if response.status_code == 200:
                        networks = response.json()
                        return {
                            "success": True,
                            "data": networks,
                            "summary": f"Found {len(networks)} networks"
                        }
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "get_network_by_name":
                    search_name = tool_input.get("name", "").lower()
                    # Get all networks
                    response = await client.get(
                        f"{base_url}/organizations/{org_id}/networks",
                        headers=headers
                    )
                    if response.status_code == 200:
                        networks = response.json()
                        # Find matching networks (case-insensitive, partial match)
                        matches = [n for n in networks if search_name in n.get("name", "").lower()]
                        if matches:
                            # Return exact match if found, otherwise return all partial matches
                            exact_match = next((n for n in matches if n.get("name", "").lower() == search_name), None)
                            if exact_match:
                                return {
                                    "success": True,
                                    "data": exact_match,
                                    "network_id": exact_match["id"],
                                    "summary": f"Found network '{exact_match['name']}' with ID {exact_match['id']}"
                                }
                            elif len(matches) == 1:
                                return {
                                    "success": True,
                                    "data": matches[0],
                                    "network_id": matches[0]["id"],
                                    "summary": f"Found network '{matches[0]['name']}' with ID {matches[0]['id']}"
                                }
                            else:
                                return {
                                    "success": True,
                                    "data": matches,
                                    "summary": f"Found {len(matches)} networks matching '{search_name}': {', '.join(n['name'] for n in matches)}"
                                }
                        else:
                            # List available networks for reference
                            network_names = [n.get("name", "Unnamed") for n in networks[:10]]
                            return {
                                "success": False,
                                "error": f"No network found matching '{search_name}'",
                                "available_networks": network_names,
                                "hint": f"Available networks include: {', '.join(network_names)}"
                            }
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "get_devices_in_network_by_name":
                    search_name = tool_input.get("network_name", "").lower()
                    logger.info(f"[TOOL] get_devices_in_network_by_name: searching for '{search_name}'")

                    # Step 1: Get all networks and find matching one
                    networks_response = await client.get(
                        f"{base_url}/organizations/{org_id}/networks",
                        headers=headers
                    )
                    logger.info(f"[TOOL] Networks response: HTTP {networks_response.status_code}")

                    if networks_response.status_code != 200:
                        return {"success": False, "error": f"Failed to fetch networks: HTTP {networks_response.status_code}"}

                    networks = networks_response.json()
                    logger.info(f"[TOOL] Found {len(networks)} networks in org {org_id}")

                    # Find matching network (case-insensitive, partial match)
                    matches = [n for n in networks if search_name in n.get("name", "").lower()]
                    logger.info(f"[TOOL] Found {len(matches)} matching networks for '{search_name}'")

                    if not matches:
                        network_names = [n.get("name", "Unnamed") for n in networks[:10]]
                        return {
                            "success": False,
                            "error": f"No network found matching '{search_name}'",
                            "available_networks": network_names,
                            "hint": f"Available networks include: {', '.join(network_names)}"
                        }

                    # Use exact match if found, otherwise first partial match
                    target_network = next((n for n in matches if n.get("name", "").lower() == search_name), matches[0])
                    network_id = target_network["id"]
                    network_name = target_network.get("name", "Unnamed")
                    logger.info(f"[TOOL] Target network: {network_name} (ID: {network_id})")

                    # Step 2: Get devices in this network using the network-specific endpoint
                    devices_url = f"{base_url}/networks/{network_id}/devices"
                    logger.info(f"[TOOL] Fetching devices from: {devices_url}")
                    devices_response = await client.get(devices_url, headers=headers)
                    logger.info(f"[TOOL] Devices response: HTTP {devices_response.status_code}")

                    if devices_response.status_code == 200:
                        devices = devices_response.json()
                        logger.info(f"[TOOL] Found {len(devices)} devices in network {network_name}")

                        # Step 3: Get device statuses for online/offline info
                        logger.info(f"[TOOL] Fetching device statuses from /organizations/{org_id}/devices/statuses")
                        statuses_response = await client.get(
                            f"{base_url}/organizations/{org_id}/devices/statuses",
                            headers=headers
                        )
                        logger.info(f"[TOOL] Status response: HTTP {statuses_response.status_code}")
                        status_map = {}
                        if statuses_response.status_code == 200:
                            statuses_data = statuses_response.json()
                            logger.info(f"[TOOL] Got {len(statuses_data)} device statuses")
                            for s in statuses_data:
                                status_map[s.get("serial")] = {
                                    "status": s.get("status", "unknown"),
                                    "lanIp": s.get("lanIp"),
                                    "wan1Ip": s.get("wan1Ip"),
                                    "wan2Ip": s.get("wan2Ip"),
                                    "gateway": s.get("gateway"),
                                    "publicIp": s.get("publicIp")
                                }

                        logger.info(f"[TOOL] Building device_info list for {len(devices)} devices")
                        device_info = []
                        for d in devices:
                            serial = d.get("serial", "")
                            status_info = status_map.get(serial, {})
                            device_info.append({
                                "name": d.get("name", "Unnamed"),
                                "serial": serial,
                                "model": d.get("model", "Unknown"),
                                "status": status_info.get("status", "unknown"),
                                "network_id": network_id,
                                "networkId": network_id,
                                "networkName": network_name,
                                "organizationId": organization_name,
                                "mac": d.get("mac"),
                                "lanIp": status_info.get("lanIp") or d.get("lanIp"),
                                "wan1Ip": status_info.get("wan1Ip") or d.get("wan1Ip"),
                                "wan2Ip": status_info.get("wan2Ip") or d.get("wan2Ip"),
                                "gateway": status_info.get("gateway"),
                                "publicIp": status_info.get("publicIp"),
                                "productType": d.get("productType"),
                                "firmware": d.get("firmware"),
                                "tags": d.get("tags", [])
                            })

                        logger.info(f"[TOOL] SUCCESS: Returning {len(device_info)} devices for network '{network_name}'")
                        return {
                            "success": True,
                            "network": target_network,
                            "network_id": network_id,
                            "network_name": network_name,
                            "data": device_info,
                            "summary": f"Found {len(device_info)} device(s) in network '{network_name}'"
                        }
                    else:
                        return {"success": False, "error": f"Failed to fetch devices: HTTP {devices_response.status_code}"}

                elif tool_name == "get_network_details":
                    network_id = tool_input.get("network_id")
                    response = await client.get(
                        f"{base_url}/networks/{network_id}",
                        headers=headers
                    )
                    if response.status_code == 200:
                        return {"success": True, "data": response.json()}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "list_ssids":
                    # Get all networks first
                    networks_response = await client.get(
                        f"{base_url}/organizations/{org_id}/networks",
                        headers=headers
                    )
                    if networks_response.status_code != 200:
                        return {"success": False, "error": "Failed to fetch networks"}

                    networks = networks_response.json()
                    all_ssids = []
                    show_all = tool_input.get("show_all", False)

                    # Get specific network or all networks
                    target_network_id = tool_input.get("network_id")
                    networks_to_check = [n for n in networks if n["id"] == target_network_id] if target_network_id else networks[:10]

                    for network in networks_to_check:
                        try:
                            ssids_response = await client.get(
                                f"{base_url}/networks/{network['id']}/wireless/ssids",
                                headers=headers
                            )
                            if ssids_response.status_code == 200:
                                ssids = ssids_response.json()
                                for ssid in ssids:
                                    # Include all SSIDs if show_all, otherwise only enabled ones
                                    if show_all or ssid.get('enabled'):
                                        all_ssids.append({
                                            "name": ssid.get("name", f"Unconfigured {ssid.get('number')}"),
                                            "number": ssid.get("number"),
                                            "network": network["name"],
                                            "networkId": network["id"],
                                            "enabled": ssid.get("enabled", False),
                                            "authMode": ssid.get("authMode", "open"),
                                            "encryptionMode": ssid.get("encryptionMode"),
                                            "visible": ssid.get("visible", True),
                                            "available": not ssid.get("enabled", False)  # Available if not enabled
                                        })
                        except (KeyError, TypeError, httpx.HTTPError) as e:
                            # Skip networks where we can't fetch SSIDs
                            logger.debug(f"Failed to fetch SSIDs for network: {e}")
                            continue

                    enabled_count = len([s for s in all_ssids if s.get("enabled")])
                    available_count = len([s for s in all_ssids if not s.get("enabled")])
                    return {
                        "success": True,
                        "data": all_ssids,
                        "summary": f"Found {enabled_count} active SSIDs, {available_count} available slots"
                    }

                elif tool_name == "list_devices":
                    status_filter = tool_input.get("status_filter", "all")
                    # Use device statuses endpoint which includes online/offline status
                    response = await client.get(
                        f"{base_url}/organizations/{org_id}/devices/statuses",
                        headers=headers
                    )
                    if response.status_code == 200:
                        devices = response.json()
                        if status_filter != "all":
                            devices = [d for d in devices if d.get("status") == status_filter]

                        device_info = [{
                            "name": d.get("name", "Unnamed"),
                            "serial": d["serial"],
                            "model": d.get("model", "Unknown"),
                            "status": d.get("status", "unknown"),
                            "network_id": d.get("networkId"),
                            "networkId": d.get("networkId"),
                            "organizationId": org_name,  # Our internal org name for API calls
                            "mac": d.get("mac"),
                            "lanIp": d.get("lanIp"),
                            "wan1Ip": d.get("wan1Ip"),
                            "publicIp": d.get("publicIp"),
                            "productType": d.get("productType")
                        } for d in devices]

                        return {
                            "success": True,
                            "data": device_info,
                            "summary": f"Found {len(device_info)} devices"
                        }
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "list_devices_by_network":
                    network_id = tool_input.get("network_id")
                    # Use network-specific devices endpoint for accurate results
                    response = await client.get(
                        f"{base_url}/networks/{network_id}/devices",
                        headers=headers
                    )
                    if response.status_code == 200:
                        devices = response.json()

                        # Get device statuses for online/offline info
                        statuses_response = await client.get(
                            f"{base_url}/organizations/{org_id}/devices/statuses",
                            headers=headers
                        )
                        status_map = {}
                        if statuses_response.status_code == 200:
                            for s in statuses_response.json():
                                status_map[s.get("serial")] = {
                                    "status": s.get("status", "unknown"),
                                    "lanIp": s.get("lanIp"),
                                    "wan1Ip": s.get("wan1Ip"),
                                    "wan2Ip": s.get("wan2Ip"),
                                    "gateway": s.get("gateway"),
                                    "publicIp": s.get("publicIp")
                                }

                        device_info = []
                        for d in devices:
                            serial = d.get("serial", "")
                            status_info = status_map.get(serial, {})
                            device_info.append({
                                "name": d.get("name", "Unnamed"),
                                "serial": serial,
                                "model": d.get("model", "Unknown"),
                                "status": status_info.get("status", "unknown"),
                                "network_id": network_id,
                                "networkId": network_id,
                                "organizationId": organization_name,
                                "mac": d.get("mac"),
                                "lanIp": status_info.get("lanIp") or d.get("lanIp"),
                                "wan1Ip": status_info.get("wan1Ip") or d.get("wan1Ip"),
                                "wan2Ip": status_info.get("wan2Ip") or d.get("wan2Ip"),
                                "gateway": status_info.get("gateway"),
                                "publicIp": status_info.get("publicIp"),
                                "productType": d.get("productType"),
                                "firmware": d.get("firmware"),
                                "tags": d.get("tags", [])
                            })

                        return {
                            "success": True,
                            "data": device_info,
                            "summary": f"Found {len(device_info)} devices in network {network_id}"
                        }
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "get_device_details":
                    serial = tool_input.get("serial")
                    response = await client.get(
                        f"{base_url}/devices/{serial}",
                        headers=headers
                    )
                    if response.status_code == 200:
                        device_data = response.json()
                        device_data["organizationId"] = org_name  # Add our internal org name
                        return {"success": True, "data": device_data}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "list_alerts":
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(
                        f"{base_url}/organizations/{org_id}/assurance/alerts",
                        headers=headers,
                        params={"timespan": timespan}
                    )
                    if response.status_code == 200:
                        alerts = response.json()
                        return {
                            "success": True,
                            "data": alerts,
                            "summary": f"Found {len(alerts)} alerts in the last {timespan} seconds"
                        }
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "get_network_clients":
                    network_id = tool_input.get("network_id")
                    timespan = tool_input.get("timespan", 2592000)  # Default to 30 days instead of 24 hours
                    response = await client.get(
                        f"{base_url}/networks/{network_id}/clients",
                        headers=headers,
                        params={"timespan": timespan}
                    )
                    if response.status_code == 200:
                        clients = response.json()
                        return {
                            "success": True,
                            "data": clients,
                            "summary": f"Found {len(clients)} clients"
                        }
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}

                elif tool_name == "create_network":
                    # Check if edit mode is enabled
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled. Cannot create networks in read-only mode."}

                    body = {"name": tool_input.get("name"), "productTypes": tool_input.get("product_types", ["wireless"])}
                    if tool_input.get("tags"): body["tags"] = tool_input.get("tags")
                    if tool_input.get("timezone"): body["timeZone"] = tool_input.get("timezone")
                    if tool_input.get("notes"): body["notes"] = tool_input.get("notes")

                    response = await client.post(f"{base_url}/organizations/{org_id}/networks", headers=headers, json=body)
                    if response.status_code in [200, 201]:
                        network_data = response.json()
                        return {"success": True, "data": network_data, "summary": f"Successfully created network '{network_data.get('name')}' with ID {network_data.get('id')}"}
                    else:
                        return {"success": False, "error": f"Failed to create network: HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_network":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    body = {}
                    if tool_input.get("name"): body["name"] = tool_input.get("name")
                    if tool_input.get("tags"): body["tags"] = tool_input.get("tags")
                    if tool_input.get("timezone"): body["timeZone"] = tool_input.get("timezone")
                    if tool_input.get("notes"): body["notes"] = tool_input.get("notes")

                    response = await client.put(f"{base_url}/networks/{network_id}", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": f"Successfully updated network {network_id}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "delete_network":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    response = await client.delete(f"{base_url}/networks/{network_id}", headers=headers)
                    if response.status_code == 204:
                        return {"success": True, "summary": f"Successfully deleted network {network_id}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "claim_device":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    body = {"serials": [tool_input.get("serial")]}
                    response = await client.post(f"{base_url}/networks/{network_id}/devices/claim", headers=headers, json=body)
                    if response.status_code in [200, 201]:
                        return {"success": True, "data": response.json(), "summary": f"Successfully claimed device {tool_input.get('serial')} into network"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "remove_device":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    serial = tool_input.get("serial")
                    response = await client.post(f"{base_url}/networks/{network_id}/devices/{serial}/remove", headers=headers)
                    if response.status_code == 204:
                        return {"success": True, "summary": f"Successfully removed device {serial} from network"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_device":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    serial = tool_input.get("serial")
                    body = {}
                    if tool_input.get("name"): body["name"] = tool_input.get("name")
                    if tool_input.get("tags"): body["tags"] = tool_input.get("tags")
                    if tool_input.get("address"): body["address"] = tool_input.get("address")
                    if tool_input.get("notes"): body["notes"] = tool_input.get("notes")

                    response = await client.put(f"{base_url}/devices/{serial}", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": f"Successfully updated device {serial}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "reboot_device":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    serial = tool_input.get("serial")
                    response = await client.post(f"{base_url}/devices/{serial}/reboot", headers=headers)
                    if response.status_code in [200, 202]:
                        return {"success": True, "summary": f"Device {serial} reboot initiated"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "blink_device_leds":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    serial = tool_input.get("serial")
                    duration = tool_input.get("duration", 20)
                    body = {"duration": min(duration, 120)}
                    response = await client.post(f"{base_url}/devices/{serial}/blinkLeds", headers=headers, json=body)
                    if response.status_code in [200, 202]:
                        return {"success": True, "summary": f"Device {serial} LEDs blinking for {duration} seconds"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_ssid":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled. Enable edit mode first using the security settings."}

                    network_id = tool_input.get("network_id")
                    ssid_number = tool_input.get("ssid_number")
                    body = {}
                    if tool_input.get("name"): body["name"] = tool_input.get("name")
                    if "enabled" in tool_input: body["enabled"] = tool_input.get("enabled")
                    if tool_input.get("auth_mode"): body["authMode"] = tool_input.get("auth_mode")
                    if tool_input.get("psk"): body["psk"] = tool_input.get("psk")
                    if tool_input.get("encryption_mode"): body["encryptionMode"] = tool_input.get("encryption_mode")

                    response = await client.put(f"{base_url}/networks/{network_id}/wireless/ssids/{ssid_number}", headers=headers, json=body)
                    if response.status_code == 200:
                        result_data = response.json()
                        ssid_name = result_data.get("name", f"SSID {ssid_number}")
                        is_enabled = result_data.get("enabled", False)
                        action = "configured and enabled" if is_enabled else "configured (disabled)"
                        return {
                            "success": True,
                            "data": [result_data],  # Wrap in array for frontend display
                            "summary": f"Successfully {action} SSID '{ssid_name}' (slot #{ssid_number})"
                        }
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "create_vlan":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    body = {
                        "id": tool_input.get("vlan_id"),
                        "name": tool_input.get("name"),
                        "subnet": tool_input.get("subnet"),
                        "applianceIp": tool_input.get("appliance_ip")
                    }
                    response = await client.post(f"{base_url}/networks/{network_id}/appliance/vlans", headers=headers, json=body)
                    if response.status_code in [200, 201]:
                        return {"success": True, "data": response.json(), "summary": f"Successfully created VLAN {tool_input.get('vlan_id')}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_vlan":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    vlan_id = tool_input.get("vlan_id")
                    body = {}
                    if tool_input.get("name"): body["name"] = tool_input.get("name")
                    if tool_input.get("subnet"): body["subnet"] = tool_input.get("subnet")
                    if tool_input.get("appliance_ip"): body["applianceIp"] = tool_input.get("appliance_ip")

                    response = await client.put(f"{base_url}/networks/{network_id}/appliance/vlans/{vlan_id}", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": f"Successfully updated VLAN {vlan_id}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "delete_vlan":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    vlan_id = tool_input.get("vlan_id")
                    response = await client.delete(f"{base_url}/networks/{network_id}/appliance/vlans/{vlan_id}", headers=headers)
                    if response.status_code == 204:
                        return {"success": True, "summary": f"Successfully deleted VLAN {vlan_id}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "list_vlans":
                    network_id = tool_input.get("network_id")
                    logger.info(f"[TOOL] list_vlans: network_id={network_id}")

                    response = await client.get(f"{base_url}/networks/{network_id}/appliance/vlans", headers=headers)
                    if response.status_code == 200:
                        vlans = response.json()
                        return {
                            "success": True,
                            "message": f"Found {len(vlans)} VLANs",
                            "data": {"vlans": vlans},
                            "summary": f"Found {len(vlans)} VLANs configured on the network"
                        }
                    elif response.status_code == 400 and "VLANs are not enabled" in response.text:
                        return {
                            "success": True,
                            "message": "VLANs are not enabled on this network. The network is using single-LAN mode.",
                            "data": {"vlans": [], "vlan_mode": "disabled"},
                            "summary": "VLANs not enabled - network uses single-LAN mode"
                        }
                    else:
                        return {"success": False, "error": f"Failed to get VLANs: HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_appliance_ports":
                    network_id = tool_input.get("network_id")
                    logger.info(f"[TOOL] get_appliance_ports: network_id={network_id}")

                    response = await client.get(f"{base_url}/networks/{network_id}/appliance/ports", headers=headers)
                    if response.status_code == 200:
                        ports = response.json()
                        return {
                            "success": True,
                            "message": f"Found {len(ports)} appliance ports",
                            "data": {"ports": ports},
                            "summary": f"Found {len(ports)} physical ports on the MX appliance"
                        }
                    else:
                        return {"success": False, "error": f"Failed to get appliance ports: HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_switch_ports":
                    serial = tool_input.get("serial")
                    response = await client.get(f"{base_url}/devices/{serial}/switch/ports", headers=headers)
                    if response.status_code == 200:
                        ports = response.json()
                        return {"success": True, "data": ports, "summary": f"Retrieved {len(ports)} switch ports for device {serial}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_switch_port":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    serial = tool_input.get("serial")
                    port_id = tool_input.get("port_id")
                    body = {}
                    if tool_input.get("name"): body["name"] = tool_input.get("name")
                    if "enabled" in tool_input: body["enabled"] = tool_input.get("enabled")
                    if tool_input.get("vlan"): body["vlan"] = tool_input.get("vlan")
                    if tool_input.get("type"): body["type"] = tool_input.get("type")

                    response = await client.put(f"{base_url}/devices/{serial}/switch/ports/{port_id}", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": f"Successfully updated port {port_id} on device {serial}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_firewall_rules":
                    network_id = tool_input.get("network_id")
                    response = await client.get(f"{base_url}/networks/{network_id}/appliance/firewall/l3FirewallRules", headers=headers)
                    if response.status_code == 200:
                        rules_data = response.json()
                        rules = rules_data.get("rules", [])
                        return {"success": True, "data": rules_data, "summary": f"Retrieved {len(rules)} firewall rules"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_firewall_rules":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    rules = tool_input.get("rules")
                    body = {"rules": rules}
                    response = await client.put(f"{base_url}/networks/{network_id}/appliance/firewall/l3FirewallRules", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": f"Successfully updated firewall rules"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_organization_inventory":
                    response = await client.get(f"{base_url}/organizations/{org_id}/inventoryDevices", headers=headers)
                    if response.status_code == 200:
                        inventory = response.json()
                        return {"success": True, "data": inventory, "summary": f"Retrieved {len(inventory)} devices from inventory"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_organization_licenses":
                    response = await client.get(f"{base_url}/organizations/{org_id}/licenses/overview", headers=headers)
                    if response.status_code == 200:
                        licenses = response.json()
                        return {"success": True, "data": licenses, "summary": "Retrieved license overview"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_organization_config_changes":
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/organizations/{org_id}/configurationChanges", headers=headers, params={"timespan": timespan})
                    if response.status_code == 200:
                        changes = response.json()
                        return {"success": True, "data": changes, "summary": f"Retrieved {len(changes)} configuration changes"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_client_details":
                    network_id = tool_input.get("network_id")
                    client_id = tool_input.get("client_id")
                    response = await client.get(f"{base_url}/networks/{network_id}/clients/{client_id}", headers=headers)
                    if response.status_code == 200:
                        client_data = response.json()
                        return {"success": True, "data": client_data, "summary": f"Retrieved details for client {client_id}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_client_policy":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    client_id = tool_input.get("client_id")
                    body = {"devicePolicy": tool_input.get("device_policy")}
                    if tool_input.get("group_policy_id"):
                        body["groupPolicyId"] = tool_input.get("group_policy_id")

                    response = await client.put(f"{base_url}/networks/{network_id}/clients/{client_id}/policy", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": f"Successfully updated policy for client {client_id}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_organization_admins":
                    response = await client.get(f"{base_url}/organizations/{org_id}/admins", headers=headers)
                    if response.status_code == 200:
                        admins = response.json()
                        return {"success": True, "data": admins, "summary": f"Retrieved {len(admins)} administrators"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "create_organization_admin":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    body = {
                        "email": tool_input.get("email"),
                        "name": tool_input.get("name"),
                        "orgAccess": tool_input.get("org_access")
                    }
                    if tool_input.get("networks"):
                        body["networks"] = tool_input.get("networks")

                    response = await client.post(f"{base_url}/organizations/{org_id}/admins", headers=headers, json=body)
                    if response.status_code in [200, 201]:
                        admin_data = response.json()
                        return {"success": True, "data": admin_data, "summary": f"Successfully created admin {admin_data.get('name')}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_vpn_status":
                    network_id = tool_input.get("network_id")
                    response = await client.get(f"{base_url}/networks/{network_id}/appliance/vpn/siteToSiteVpn", headers=headers)
                    if response.status_code == 200:
                        vpn_data = response.json()
                        return {"success": True, "data": vpn_data, "summary": f"Retrieved VPN configuration (Mode: {vpn_data.get('mode', 'unknown')})"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_network_traffic":
                    network_id = tool_input.get("network_id")
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/networks/{network_id}/traffic", headers=headers, params={"timespan": timespan})
                    if response.status_code == 200:
                        traffic = response.json()
                        return {"success": True, "data": traffic, "summary": f"Retrieved network traffic data"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_network_events":
                    network_id = tool_input.get("network_id")
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/networks/{network_id}/events", headers=headers, params={"timespan": timespan, "perPage": 100})
                    if response.status_code == 200:
                        events = response.json()
                        events_list = events.get("events", []) if isinstance(events, dict) else events
                        return {"success": True, "data": events_list, "summary": f"Retrieved {len(events_list)} network events"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_network_alerts_settings":
                    network_id = tool_input.get("network_id")
                    response = await client.get(f"{base_url}/networks/{network_id}/alerts/settings", headers=headers)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved alert settings"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_network_alerts_settings":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    body = {}
                    if tool_input.get("default_destinations"):
                        body["defaultDestinations"] = tool_input.get("default_destinations")
                    if tool_input.get("alerts"):
                        body["alerts"] = tool_input.get("alerts")

                    response = await client.put(f"{base_url}/networks/{network_id}/alerts/settings", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Successfully updated alert settings"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "ping_device":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    serial = tool_input.get("serial")
                    body = {"target": tool_input.get("target_ip"), "count": tool_input.get("count", 5)}
                    response = await client.post(f"{base_url}/devices/{serial}/liveTools/ping", headers=headers, json=body)
                    if response.status_code in [200, 201, 202]:
                        result = response.json()
                        return {"success": True, "data": result, "summary": f"Ping test initiated to {tool_input.get('target_ip')}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "cable_test_device":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    serial = tool_input.get("serial")
                    body = {"ports": tool_input.get("ports")}
                    response = await client.post(f"{base_url}/devices/{serial}/liveTools/cableTest", headers=headers, json=body)
                    if response.status_code in [200, 201, 202]:
                        result = response.json()
                        return {"success": True, "data": result, "summary": f"Cable test initiated on ports {', '.join(tool_input.get('ports'))}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "cycle_switch_ports":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    serial = tool_input.get("serial")
                    body = {"ports": tool_input.get("ports")}
                    response = await client.post(f"{base_url}/devices/{serial}/switch/ports/cycle", headers=headers, json=body)
                    if response.status_code in [200, 202]:
                        return {"success": True, "summary": f"Power cycling ports {', '.join(tool_input.get('ports'))}"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_switch_port_statuses":
                    serial = tool_input.get("serial")
                    response = await client.get(f"{base_url}/devices/{serial}/switch/ports/statuses", headers=headers)
                    if response.status_code == 200:
                        statuses = response.json()
                        return {"success": True, "data": statuses, "summary": f"Retrieved port statuses for {len(statuses)} ports"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_wireless_channel_utilization":
                    network_id = tool_input.get("network_id")
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/networks/{network_id}/wireless/channelUtilizationHistory", headers=headers, params={"timespan": timespan})
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved wireless channel utilization data"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_wireless_signal_quality":
                    network_id = tool_input.get("network_id")
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/networks/{network_id}/wireless/signalQualityHistory", headers=headers, params={"timespan": timespan})
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved wireless signal quality data"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_wireless_connection_stats":
                    network_id = tool_input.get("network_id")
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/networks/{network_id}/wireless/connectionStats", headers=headers, params={"timespan": timespan})
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved wireless connection statistics"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_appliance_content_filtering":
                    network_id = tool_input.get("network_id")
                    response = await client.get(f"{base_url}/networks/{network_id}/appliance/contentFiltering", headers=headers)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved content filtering configuration"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_appliance_content_filtering":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    body = {}
                    if tool_input.get("allowed_urls"):
                        body["allowedUrlPatterns"] = tool_input.get("allowed_urls")
                    if tool_input.get("blocked_urls"):
                        body["blockedUrlPatterns"] = tool_input.get("blocked_urls")
                    if tool_input.get("blocked_url_patterns"):
                        body["blockedUrlCategories"] = tool_input.get("blocked_url_patterns")

                    response = await client.put(f"{base_url}/networks/{network_id}/appliance/contentFiltering", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Successfully updated content filtering"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_appliance_security_events":
                    network_id = tool_input.get("network_id")
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/networks/{network_id}/appliance/security/events", headers=headers, params={"timespan": timespan, "perPage": 100})
                    if response.status_code == 200:
                        events = response.json()
                        return {"success": True, "data": events, "summary": f"Retrieved security events"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_appliance_traffic_shaping":
                    network_id = tool_input.get("network_id")
                    response = await client.get(f"{base_url}/networks/{network_id}/appliance/trafficShaping", headers=headers)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved traffic shaping configuration"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "update_appliance_traffic_shaping":
                    edit_mode = await self.security_service.is_edit_mode_enabled(use_cache=True)
                    if not edit_mode:
                        return {"success": False, "error": "Edit mode is not enabled."}

                    network_id = tool_input.get("network_id")
                    body = {}
                    if tool_input.get("global_bandwidth_limits"):
                        body["globalBandwidthLimits"] = tool_input.get("global_bandwidth_limits")

                    response = await client.put(f"{base_url}/networks/{network_id}/appliance/trafficShaping", headers=headers, json=body)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Successfully updated traffic shaping"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_camera_video_settings":
                    serial = tool_input.get("serial")
                    response = await client.get(f"{base_url}/devices/{serial}/camera/video/settings", headers=headers)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved camera video settings"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_device_uplink":
                    serial = tool_input.get("serial")
                    response = await client.get(f"{base_url}/devices/{serial}/uplink", headers=headers)
                    if response.status_code == 200:
                        return {"success": True, "data": response.json(), "summary": "Retrieved device uplink information"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "get_organization_api_requests":
                    timespan = tool_input.get("timespan", 86400)
                    response = await client.get(f"{base_url}/organizations/{org_id}/apiRequests", headers=headers, params={"timespan": timespan, "perPage": 100})
                    if response.status_code == 200:
                        requests = response.json()
                        return {"success": True, "data": requests, "summary": f"Retrieved API request logs"}
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code} - {response.text}"}

                elif tool_name == "discover_meraki_functions":
                    # Call the dynamic proxy to discover available SDK functions
                    module_filter = tool_input.get("module_name")
                    search_term = tool_input.get("search_term")

                    params = {}
                    if module_filter:
                        params["module"] = module_filter

                    proxy_response = await client.get(
                        f"{_get_backend_url()}/api/meraki/proxy/functions",
                        params=params
                    )

                    if proxy_response.status_code == 200:
                        functions_data = proxy_response.json()

                        # Apply search filter if provided
                        if search_term:
                            filtered_modules = {}
                            for mod_name, mod_data in functions_data.get("modules", {}).items():
                                matching_funcs = [f for f in mod_data["functions"] if search_term.lower() in f.lower()]
                                if matching_funcs:
                                    filtered_modules[mod_name] = {
                                        "count": len(matching_funcs),
                                        "functions": matching_funcs
                                    }

                            if filtered_modules:
                                return {
                                    "success": True,
                                    "data": filtered_modules,
                                    "summary": f"Found {sum(m['count'] for m in filtered_modules.values())} functions matching '{search_term}'"
                                }
                            else:
                                return {
                                    "success": True,
                                    "data": {},
                                    "summary": f"No functions found matching '{search_term}'"
                                }
                        else:
                            return {
                                "success": True,
                                "data": functions_data.get("modules", {}),
                                "summary": f"Found {functions_data.get('total_functions', 0)} functions across {functions_data.get('total_modules', 0)} modules"
                            }
                    else:
                        return {"success": False, "error": f"Failed to fetch functions: HTTP {proxy_response.status_code}"}

                elif tool_name == "call_meraki_sdk_function":
                    # Call ANY Meraki SDK function via the dynamic proxy
                    module_name = tool_input.get("module_name")
                    function_name = tool_input.get("function_name")
                    parameters = tool_input.get("parameters", {})

                    # Add organizationId from org_id if not provided
                    if "organizationId" not in parameters and org_id:
                        parameters["organizationId"] = org_id

                    proxy_payload = {
                        "module_name": module_name,
                        "function_name": function_name,
                        **parameters
                    }

                    proxy_response = await client.post(
                        f"{_get_backend_url()}/api/meraki/proxy/call?organization={organization_name}",
                        json=proxy_payload
                    )

                    if proxy_response.status_code == 200:
                        result = proxy_response.json()
                        if result.get("success"):
                            return {
                                "success": True,
                                "data": result.get("data"),
                                "summary": f"Successfully called {module_name}.{function_name}"
                            }
                        else:
                            return {
                                "success": False,
                                "error": result.get("error", "SDK function call failed")
                            }
                    else:
                        return {"success": False, "error": f"HTTP {proxy_response.status_code} - {proxy_response.text}"}

                else:
                    return {"success": False, "error": f"Unknown tool: {tool_name}"}

            except Exception as e:
                import traceback
                logger.error(f"[TOOL ERROR] Exception in _execute_tool: {type(e).__name__}: {str(e)}")
                logger.error(f"[TOOL ERROR] Full traceback:\n{traceback.format_exc()}")
                return {"success": False, "error": str(e)}

    async def chat(
        self,
        message: str,
        credentials: Dict[str, str],
        org_id: str,
        org_name: str,
        organization_name: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Have a conversation with Claude about Meraki network management.

        Args:
            message: User's message
            credentials: API credentials
            org_id: Organization ID
            org_name: Display name of the organization
            organization_name: Internal organization name for credential lookup
            conversation_history: Previous conversation messages
            session_id: Optional session ID for context persistence across turns
        """
        messages = []
        context_summary = []  # Collect context from previous messages
        history_limit = get_settings().conversation_history_limit

        if conversation_history:
            for msg in conversation_history[-history_limit:]:
                if msg.get("role") in ["user", "assistant"]:
                    content = msg["content"]

                    # If this message has context (network IDs, device info), append it
                    if msg.get("context"):
                        ctx = msg["context"]
                        context_parts = []
                        if ctx.get("networks"):
                            networks_str = ", ".join([f"{n.get('name')} (ID: {n.get('id')})" for n in ctx["networks"][:5]])
                            context_parts.append(f"[Networks mentioned: {networks_str}]")
                            context_summary.append(f"Networks: {networks_str}")
                        if ctx.get("devices"):
                            devices_str = ", ".join([f"{d.get('name', 'Unnamed')} ({d.get('serial')})" for d in ctx["devices"][:5]])
                            context_parts.append(f"[Devices mentioned: {devices_str}]")
                        if ctx.get("ssids"):
                            ssids_str = ", ".join([f"#{s.get('number')}: {s.get('name')} ({'enabled' if s.get('enabled') else 'disabled'})" for s in ctx["ssids"][:5]])
                            context_parts.append(f"[SSIDs: {ssids_str}]")

                        if context_parts:
                            content = content + "\n" + "\n".join(context_parts)

                    messages.append({
                        "role": msg["role"],
                        "content": content
                    })

        messages.append({"role": "user", "content": message})

        edit_mode_enabled = await self.security_service.is_edit_mode_enabled(use_cache=True)
        edit_mode_text = "EDIT MODE ENABLED - you can create, update, and delete resources" if edit_mode_enabled else "READ-ONLY mode - you can only view and report on network status"

        # A2A Protocol: Analyze user query and generate dynamic routing guidance
        # This replaces hardcoded instructions with capability-based routing
        from src.a2a.memory import QueryIntent
        routing_decision = self.orchestrator.analyze_and_route(message)

        # For STATUS_CHECK (simple data queries), skip routing context entirely
        # This prevents the model from explaining options instead of executing immediately
        if routing_decision.classified_intent == QueryIntent.STATUS_CHECK:
            a2a_routing_context = ""  # No routing guidance - just execute tools
            logger.info(f"[A2A] STATUS_CHECK detected - skipping routing context for immediate action")
        else:
            a2a_routing_context = self.orchestrator.get_routing_context_for_llm()
            # Add query-specific routing guidance
            query_routing_guidance = self.orchestrator.build_agent_aware_prompt(message, routing_decision)
            if query_routing_guidance:
                a2a_routing_context += f"\n\n**QUERY-SPECIFIC ROUTING GUIDANCE**:\n{query_routing_guidance}"

        logger.info(f"[A2A] Routing decision for query: {routing_decision.reasoning}")

        # Build conversation context section for system prompt
        conversation_context_section = ""
        if context_summary:
            # Deduplicate and format
            unique_contexts = list(dict.fromkeys(context_summary))
            conversation_context_section = f"""

**CONVERSATION CONTEXT - USE THESE IDs DIRECTLY:**
{chr(10).join('• ' + ctx for ctx in unique_contexts)}

IMPORTANT: When the user refers to "that network", "the network", or a network by name, use the network ID from the context above.
Do NOT call list_networks again if you already have the network ID from this context."""

        # Inject session context from SessionContextStore for org type preference
        session_context_section = ""
        if session_id:
            try:
                context_store = get_session_context_store()
                session_ctx = await context_store.get_or_create(session_id)
                session_summary = session_ctx.to_context_summary()
                if session_summary:
                    primary_org = session_ctx.primary_org_type.value if session_ctx.primary_org_type else "meraki"
                    session_context_section = f"""

## SESSION CONTEXT (PREVIOUSLY DISCOVERED)
{session_summary}

**IMPORTANT - ROUTING PREFERENCE**: This session established **{primary_org.upper()}** as the primary platform.
- When the user references "that org", "the network", or discovered entities, use **{primary_org}** tools
- Use {primary_org} tools for follow-up queries unless the user explicitly mentions a different platform
"""
                    logger.debug(f"[SessionContext] Injected context for session {session_id}, primary_org={primary_org}")
            except Exception as e:
                logger.warning(f"[SessionContext] Failed to get session context: {e}")

        system_prompt = f"""You are an expert network operations assistant with deep knowledge of network infrastructure monitoring and troubleshooting.

CURRENT CONTEXT:
- Organization: {org_name} (ID: {org_id})
- System mode: {edit_mode_text}{conversation_context_section}{session_context_section}

PLATFORM ARCHITECTURE - UNDERSTAND THIS:
• Organization = Top-level container (what you're currently in: "{org_name}")
• Network = Logical grouping within an organization (e.g., "Riebel Home", "Office Network")
• Devices = Physical hardware (APs, switches, cameras, sensors) - belong to a network
• Clients = End-user devices connected to the network (laptops, phones, IoT devices)

AVAILABLE DATA SOURCES:
1. **Cisco Meraki** - Cloud-Managed Network Infrastructure
   - Device status, configuration, and health
   - Network topology and connectivity
   - Client connections and usage
   - Wireless SSIDs and access points
   - Switch ports and VLANs
   - Security appliances and firewall rules

2. **Cisco Catalyst Center** - Enterprise Network Management Platform
   - Site hierarchy and organization
   - Enterprise network devices (routers, switches, wireless controllers)
   - AI-powered assurance and network health monitoring
   - Issues and alerts detection
   - Network topology visualization (physical, L2, L3, VLAN)
   - Wireless profiles and enterprise SSIDs
   - Client connectivity and performance

3. **ThousandEyes** - Internet & Network Performance Monitoring
   - End-to-end network path visibility
   - Application performance from user perspective
   - BGP routing and DNS monitoring
   - Real-time and historical performance data

4. **Splunk** - Log Analysis and Security Events
   - Centralized logging from all systems
   - Security events and correlations
   - Custom queries for deep investigation
   - Historical data for forensic analysis

INTELLIGENT QUERY STRATEGIES:
1. **Timespan Intelligence**: If a query returns no results, automatically try longer timespans
   - Start with 1 hour, then try 24 hours, then 7 days, then 30 days
   - Example: "No clients in last hour? Check last 24 hours automatically"

2. **Context Awareness**: Understand what users mean
   - "that network" = refer to the network mentioned in previous messages
   - "devices" without context = all devices in the organization
   - "clients" = connected end-user devices, NOT Meraki devices

3. **Multi-Source Correlation**: When investigating issues, correlate across platforms
   - Meraki shows device is offline → Check Splunk for error logs
   - Client connectivity issues → Compare Meraki data with ThousandEyes tests
   - Network slowness → Use ThousandEyes for WAN performance + Meraki for LAN health

4. **Use Splunk for Deep Investigation**: Query Splunk logs when you need to:
   - Investigate the root cause of an issue
   - Find error messages or warnings related to devices
   - Correlate events across multiple systems
   - Search for security events or anomalies

**CRITICAL - ALWAYS USE TOOLS PROACTIVELY**:
You are an ACTION-ORIENTED assistant. When users ask for ANY information, you MUST:
1. IMMEDIATELY call the appropriate tool - do NOT explain what tools exist or ask for clarification
2. NEVER respond with "you can use..." or "try asking..." - just DO IT
3. Interpret requests generously - "get my networks" means call list_networks NOW
4. "Show me X" / "Get X" / "What are my X" = CALL THE TOOL, don't explain

COMMON REQUESTS → IMMEDIATE TOOL CALLS:
• "get my networks" / "show networks" / "list networks" → call list_networks
• "get Riebel Home" / "show me [network name]" → call get_network_by_name with the name
• "show devices" / "what devices" → call list_devices
• "devices in [network]" → call get_devices_in_network_by_name
• "show SSIDs" / "wireless networks" → call list_ssids
• "show clients" → call list_clients
• "network health" → call get_organization_overview

TOOL USAGE GUIDELINES:
• **Devices in a Network by Name**: Use **get_devices_in_network_by_name** - finds the network AND lists all devices in one call
• **Network Lookups Only**: Use get_network_by_name when you only need network info (not devices)
• For specialized Meraki functions not in standard tools, use discover_meraki_functions to search, then call_meraki_sdk_function
• Always fetch actual data before saying "no X found" - try multiple timespans
• When data seems incomplete or suspicious, investigate with Splunk logs
• Present data clearly: use bullet points, highlight issues, explain technical terms simply

RESPONSE STYLE - BE CONCISE:
- Keep responses SHORT and focused - aim for 2-4 bullet points maximum
- Lead with the answer, then provide brief supporting details
- Use data tables and markdown tables when possible - they're more scannable than paragraphs
- Avoid repetition - don't restate the question or use filler phrases
- Skip lengthy introductions and conclusions - get straight to insights
- When presenting data, use markdown tables so the UI can convert them to visual cards
- Only expand with details if the user explicitly asks for more information

{a2a_routing_context}

System mode: {edit_mode_text}"""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                system=system_prompt,
                messages=messages,
                tools=self._get_all_tools()
            )

            assistant_response = ""
            tools_used = []
            tool_data_results = []

            # Track agent activity and confirmation requirements
            agent_activity = []
            requires_confirmation = False
            pending_implementation = None

            while response.stop_reason == "tool_use":
                tool_uses = [block for block in response.content if block.type == "tool_use"]
                tool_results = []

                for tool_use in tool_uses:
                    tools_used.append(tool_use.name)
                    result = await self._execute_tool(
                        tool_use.name,
                        tool_use.input,
                        credentials,
                        org_id,
                        organization_name,
                        session_id=session_id
                    )

                    # Extract and store discovered entities in session context
                    if session_id:
                        await self._extract_entities_from_result(session_id, tool_use.name, result)

                        # Update org context in session for routing preference
                        if result.get("success"):
                            detected_org_type = self._detect_org_type_from_tool(tool_use.name)
                            if detected_org_type:
                                context_store = get_session_context_store()
                                await context_store.update_org_context(
                                    session_id=session_id,
                                    org_id=org_id,
                                    org_name=org_name,
                                    org_type=detected_org_type,
                                    credentials=credentials
                                )
                                logger.debug(f"[SessionContext] Updated org context: {detected_org_type.value} for session {session_id}")

                    # Track Knowledge Agent consultations for UI visibility
                    if tool_use.name in ["consult_knowledge_agent", "request_implementation_plan"]:
                        activity_entry = {
                            "tool": tool_use.name,
                            "status": "completed" if result.get("success") else "failed",
                            "agent_communication": result.get("agent_communication"),
                        }
                        if tool_use.name == "consult_knowledge_agent":
                            activity_entry["confidence"] = result.get("confidence", 0.0)
                            activity_entry["sources_count"] = len(result.get("sources", []))
                        elif tool_use.name == "request_implementation_plan":
                            activity_entry["confidence"] = result.get("confidence", 0.0)
                            activity_entry["steps_count"] = len(result.get("steps", []))
                            activity_entry["warnings"] = result.get("warnings", [])
                            # Track if this implementation requires user confirmation
                            if result.get("requires_confirmation"):
                                requires_confirmation = True
                                pending_implementation = {
                                    "recommendation": result.get("recommendation"),
                                    "steps": result.get("steps", []),
                                    "warnings": result.get("warnings", []),
                                    "confidence": result.get("confidence", 0.0),
                                }
                        agent_activity.append(activity_entry)

                    if result.get("success") and result.get("data"):
                        tool_data_results.append({
                            "tool": tool_use.name,
                            "data": result["data"]
                        })

                    # Log the result being sent back to Claude
                    result_str = json.dumps(result)
                    logger.info(f"[TOOL RESULT] {tool_use.name}: success={result.get('success')}, data_count={len(result.get('data', []))}, result_length={len(result_str)}")
                    if len(result_str) < 1000:
                        logger.info(f"[TOOL RESULT] Full content: {result_str[:500]}")

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": result_str
                    })

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})

                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=system_prompt,
                    messages=messages,
                    tools=self._get_all_tools()
                )

            # Extract final text
            for block in response.content:
                if hasattr(block, "text"):
                    assistant_response += block.text

            # === COST CALCULATION & LOGGING ===
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            total_tokens = input_tokens + output_tokens
            cost_usd = (input_tokens * 3e-6) + (output_tokens * 15e-6)  # Haiku pricing

            # Log to database
            try:
                from src.models.ai_cost_log import AICostLog
                from src.config.database import get_db

                db = get_db()
                async with db.session() as session:
                    session.add(AICostLog(
                        conversation_id=None,
                        user_id="web-user",
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        total_tokens=total_tokens,
                        cost_usd=cost_usd,
                        model=self.model,
                    ))
                    await session.commit()
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to log AI cost: {e}")

            return {
                "success": True,
                "response": assistant_response,
                "tools_used": tools_used,
                "stop_reason": response.stop_reason,
                "tool_data": tool_data_results or None,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost_usd, 6),
                # Agent activity tracking for UI
                "agent_activity": agent_activity if agent_activity else None,
                "requires_confirmation": requires_confirmation,
                "pending_implementation": pending_implementation,
            }

        except anthropic.APIError as e:
            return {"success": False, "error": f"Claude API error: {str(e)}", "response": "I'm having trouble connecting to the AI service. Please try again."}
        except Exception as e:
            return {"success": False, "error": str(e), "response": f"An error occurred: {str(e)}"}


    async def chat_multi_org(
        self,
        message: str,
        organizations: List[Dict[str, Any]],
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Have a conversation with Claude with access to multiple organizations.

        Args:
            message: User's message
            organizations: List of organization configs with credentials
            conversation_history: Previous conversation messages
            session_id: Optional session ID for context persistence across turns
        """
        messages = []
        context_summary = []  # Collect context from previous messages for system prompt
        history_limit = get_settings().conversation_history_limit

        if conversation_history:
            for msg in conversation_history[-history_limit:]:
                if msg.get("role") in ["user", "assistant"]:
                    content = msg["content"]

                    # If this message has context (network IDs, device info), append it
                    if msg.get("context"):
                        ctx = msg["context"]
                        context_parts = []
                        if ctx.get("networks"):
                            networks_str = ", ".join([f"{n.get('name')} (ID: {n.get('id')})" for n in ctx["networks"][:5]])
                            context_parts.append(f"[Networks mentioned: {networks_str}]")
                            context_summary.append(f"Networks: {networks_str}")
                        if ctx.get("devices"):
                            devices_str = ", ".join([f"{d.get('name', 'Unnamed')} ({d.get('serial')})" for d in ctx["devices"][:5]])
                            context_parts.append(f"[Devices mentioned: {devices_str}]")
                            context_summary.append(f"Devices: {devices_str}")
                        if ctx.get("ssids"):
                            ssids_str = ", ".join([f"#{s.get('number')}: {s.get('name')} ({'enabled' if s.get('enabled') else 'disabled'})" for s in ctx["ssids"][:5]])
                            context_parts.append(f"[SSIDs: {ssids_str}]")
                            context_summary.append(f"SSIDs: {ssids_str}")

                        if context_parts:
                            content = content + "\n" + "\n".join(context_parts)

                    messages.append({"role": msg["role"], "content": content})

        messages.append({"role": "user", "content": message})

        edit_mode_enabled = await self.security_service.is_edit_mode_enabled(use_cache=True)
        edit_mode_text = "EDIT MODE ENABLED - you can create, update, and delete resources" if edit_mode_enabled else "READ-ONLY mode - you can only view and report on network status"

        # A2A Protocol: Analyze user query and generate dynamic routing guidance
        # This replaces hardcoded instructions with capability-based routing
        from src.a2a.memory import QueryIntent
        routing_decision = self.orchestrator.analyze_and_route(message)

        # For STATUS_CHECK (simple data queries), skip routing context entirely
        # This prevents the model from explaining options instead of executing immediately
        if routing_decision.classified_intent == QueryIntent.STATUS_CHECK:
            a2a_routing_context = ""  # No routing guidance - just execute tools
            logger.info(f"[A2A] Multi-org STATUS_CHECK detected - skipping routing context for immediate action")
        else:
            a2a_routing_context = self.orchestrator.get_routing_context_for_llm()
            # Add query-specific routing guidance
            query_routing_guidance = self.orchestrator.build_agent_aware_prompt(message, routing_decision)
            if query_routing_guidance:
                a2a_routing_context += f"\n\n**QUERY-SPECIFIC ROUTING GUIDANCE**:\n{query_routing_guidance}"

        logger.info(f"[A2A] Multi-org routing decision: {routing_decision.reasoning}")

        org_context = "Available Organizations:\n"
        meraki_orgs = []
        thousandeyes_orgs = []

        for org in organizations:
            if org["type"] == "meraki":
                meraki_orgs.append(org)
                org_context += f"- {org['display_name']} (Meraki) - Internal name: {org['name']}\n"
            elif org["type"] == "thousandeyes":
                thousandeyes_orgs.append(org)
                org_context += f"- {org['display_name']} (ThousandEyes) - Internal name: {org['name']}\n"
            # Skip Splunk and Catalyst orgs for now - they use different tools

        logger.info(f"[CHAT_MULTI_ORG] Starting chat with {len(meraki_orgs)} Meraki orgs, {len(thousandeyes_orgs)} ThousandEyes orgs")
        logger.info(f"[CHAT_MULTI_ORG] Meraki orgs: {[o['name'] for o in meraki_orgs]}")

        # Build conversation context section for system prompt
        conversation_context_section = ""
        if context_summary:
            # Deduplicate and format
            unique_contexts = list(dict.fromkeys(context_summary))
            conversation_context_section = f"""

**CONVERSATION CONTEXT - USE THESE IDs DIRECTLY:**
{chr(10).join('• ' + ctx for ctx in unique_contexts)}

IMPORTANT: When the user refers to "that network", "the network", or a network by name that appears above, use the network ID from the context above.
Do NOT call list_networks again if you already have the network ID from this context."""

        system_prompt = f"""You are an expert network administrator assistant with access to Cisco Meraki, ThousandEyes, Splunk, and Catalyst Center.

{org_context}

System mode: {edit_mode_text}{conversation_context_section}

Capabilities:
- Query multiple organizations simultaneously across Meraki, ThousandEyes, Splunk, and Catalyst Center
- Correlate data between platforms (e.g., Meraki network issues with ThousandEyes tests, Splunk logs with device events)
- Compare metrics across different organizations
- Provide unified insights across your entire network infrastructure

**CRITICAL - ALWAYS USE TOOLS PROACTIVELY**:
You are an ACTION-ORIENTED assistant. When users ask for ANY information, you MUST:
1. IMMEDIATELY call the appropriate tool - do NOT explain what tools exist or ask for clarification
2. NEVER respond with "you can use..." or "try asking..." - just DO IT
3. Interpret requests generously - "get my networks" means call list_networks NOW
4. "Show me X" / "Get X" / "What are my X" = CALL THE TOOL, don't explain

COMMON REQUESTS → IMMEDIATE TOOL CALLS:
• "get my networks" / "show networks" / "list networks" → call list_networks
• "get Riebel Home" / "show me [network name]" → call get_network_by_name with the name
• "show devices" / "what devices" → call list_devices
• "devices in [network]" → call get_devices_in_network_by_name
• "show SSIDs" / "wireless networks" → call list_ssids
• "show clients" → call list_clients
• "network health" → call get_organization_overview

Important:
- Always mention which organization the data comes from
- When users ask about devices in a network by name, use **get_devices_in_network_by_name** - it finds the network AND lists devices in one call
- When the user mentions a network name from conversation history, use the ID from CONVERSATION CONTEXT above instead of calling list_networks

RESPONSE STYLE - BE CONCISE:
- Keep responses SHORT and focused - aim for 2-4 bullet points maximum
- Lead with the answer, then provide brief supporting details
- Use markdown tables when presenting data - the UI can convert them to visual cards
- Avoid repetition and filler phrases - get straight to insights
- Only expand with details if the user explicitly asks for more information

{a2a_routing_context}"""

        self._current_organizations = {org["name"]: org for org in organizations}

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                system=system_prompt,
                messages=messages,
                tools=self._get_all_tools()
            )

            assistant_response = ""
            tools_used = []
            tool_data_results = []

            while response.stop_reason == "tool_use":
                tool_uses = [block for block in response.content if block.type == "tool_use"]
                tool_results = []
                logger.info(f"[CHAT_MULTI_ORG] Claude wants to use {len(tool_uses)} tool(s): {[t.name for t in tool_uses]}")

                for tool_use in tool_uses:
                    tools_used.append(tool_use.name)
                    logger.info(f"[CHAT_MULTI_ORG] Processing tool: {tool_use.name} with input: {tool_use.input}")

                    if tool_use.name.startswith("get_thousandeyes_"):
                        combined_results = []
                        for org in thousandeyes_orgs:
                            result = await self._execute_tool(
                                tool_use.name, tool_use.input, org["credentials"],
                                org.get("org_id", org["name"]), org["name"],
                                session_id=session_id
                            )
                            # Extract entities from result
                            if session_id:
                                await self._extract_entities_from_result(session_id, tool_use.name, result)
                            if result.get("success"):
                                result["organization"] = org["display_name"]
                                combined_results.append(result)
                        if combined_results:
                            tool_data_results.append({"tool": tool_use.name, "data": {"results": combined_results}})
                        tool_results.append({"type": "tool_result", "tool_use_id": tool_use.id, "content": json.dumps({"results": combined_results})})
                    else:
                        combined_results = []
                        for org in meraki_orgs:
                            result = await self._execute_tool(
                                tool_use.name, tool_use.input, org["credentials"],
                                org.get("org_id", org["name"]), org["name"],
                                session_id=session_id
                            )
                            # Extract entities from result
                            if session_id:
                                await self._extract_entities_from_result(session_id, tool_use.name, result)
                            logger.info(f"[MULTI-ORG TOOL] {tool_use.name} for {org['name']}: success={result.get('success')}, data_count={len(result.get('data', []))}")
                            if result.get("success"):
                                result["organization"] = org["display_name"]
                                combined_results.append(result)
                        if combined_results:
                            tool_data_results.append({"tool": tool_use.name, "data": {"results": combined_results}})
                        result_content = json.dumps({"results": combined_results})
                        logger.info(f"[MULTI-ORG TOOL RESULT] Sending {len(combined_results)} results to Claude, total_length={len(result_content)}")
                        # Log a preview of the actual content
                        if combined_results:
                            for i, r in enumerate(combined_results):
                                data_count = len(r.get("data", [])) if isinstance(r.get("data"), list) else 1
                                logger.info(f"[MULTI-ORG TOOL RESULT] Result {i+1}: org={r.get('organization')}, success={r.get('success')}, data_count={data_count}, summary={r.get('summary', 'N/A')}")
                        else:
                            logger.warning(f"[MULTI-ORG TOOL RESULT] WARNING: No successful results from any org!")
                        tool_results.append({"type": "tool_result", "tool_use_id": tool_use.id, "content": result_content})

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})

                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=system_prompt,
                    messages=messages,
                    tools=self._get_all_tools()
                )

            for block in response.content:
                if hasattr(block, "text"):
                    assistant_response += block.text

            # Log Claude's final response (first 500 chars)
            logger.info(f"[CHAT_MULTI_ORG] Claude final response (first 500 chars): {assistant_response[:500]}")
            logger.info(f"[CHAT_MULTI_ORG] Tools used: {tools_used}")

            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            cost_usd = (input_tokens * 3e-6) + (output_tokens * 15e-6)

            # === LOG COST TO DATABASE ===
            try:
                from src.models.ai_cost_log import AICostLog
                from src.config.database import get_db
                db = get_db()
                async with db.session() as session:
                    session.add(AICostLog(
                        conversation_id=None,
                        user_id="web-user",
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        total_tokens=input_tokens + output_tokens,
                        cost_usd=cost_usd,
                        model=self.model,
                    ))
                    await session.commit()
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to log AI cost (multi-org): {e}")

            return {
                "success": True,
                "response": assistant_response,
                "tools_used": tools_used,
                "stop_reason": response.stop_reason,
                "tool_data": tool_data_results or None,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost_usd, 4),
                "disclaimer": "AI-generated suggestion — human review required before action"
            }

        except Exception as e:
            return {"success": False, "error": str(e), "response": f"An error occurred: {str(e)}"}


def get_claude_assistant(
    model: str = None,
    temperature: float = None,
    max_tokens: int = None,
    user_api_key: str = None
) -> Optional[ClaudeNetworkAssistant]:
    """Get Claude assistant instance if API key is configured.

    Args:
        model: Model ID to use (optional, defaults to claude-sonnet-4-5-20250929)
        temperature: Temperature setting (0.0-2.0, optional)
        max_tokens: Max tokens for response (optional)
        user_api_key: User-provided API key (optional, overrides admin key)

    Returns:
        ClaudeNetworkAssistant instance or None if no API key available
    """
    settings = get_settings()

    # Use user key if provided, otherwise fall back to admin key
    api_key = user_api_key if user_api_key else settings.anthropic_api_key

    if not api_key:
        return None

    return ClaudeNetworkAssistant(
        api_key,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens
    )