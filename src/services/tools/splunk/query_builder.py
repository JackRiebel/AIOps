"""
Splunk Query Builder Tool

Provides intent-based query suggestions for efficient Splunk searches.
This helps the AI select appropriate SPL patterns based on user intent.
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, create_tool

logger = logging.getLogger(__name__)


# =============================================================================
# QUERY TEMPLATES BY INTENT
# =============================================================================

QUERY_TEMPLATES = {
    # =========================================================================
    # WIRELESS SPECIFIC QUERIES - Most common use cases
    # =========================================================================
    "association_failures": {
        "query": "sourcetype=meraki:accesspoints type IN (association, disassociation, deauth, 802.11_auth) | stats count by type, clientMac, apMac, ssid, reason | sort -count",
        "description": "Wireless association/disassociation events with failure reasons"
    },
    "wpa_auth_failures": {
        "query": "sourcetype=meraki:accesspoints (type=wpa_auth OR type=802.11_auth OR type=*auth_fail* OR reason=*wrong_password* OR reason=*auth*) | stats count by type, clientMac, apMac, ssid, reason | sort -count",
        "description": "WPA/PSK authentication failures (wrong passwords, etc.)"
    },
    "wireless_client_issues": {
        "query": "sourcetype=meraki:accesspoints type IN (association, disassociation, deauth, roam, 802.11_auth) | stats count by type, clientMac, ssid | sort -count",
        "description": "All wireless client events (connect, disconnect, roam)"
    },
    "ap_performance": {
        "query": "sourcetype=meraki:accesspoints | stats count by type, apMac, ssid | sort -count",
        "description": "Access point event summary by AP"
    },
    "roaming_events": {
        "query": "sourcetype=meraki:accesspoints type=roam | stats count by clientMac, apMac, ssid | sort -count",
        "description": "Client roaming between access points"
    },

    # =========================================================================
    # GENERAL QUERIES
    # =========================================================================
    "summary": {
        "query": "index=* sourcetype=meraki:* NOT sourcetype=meraki:sensorreadingshistory | stats count by type, category | sort -count | head 20",
        "description": "Overview of all Meraki events by type and category (top 20)"
    },
    "errors": {
        "query": "index=* (error OR failed OR failure OR critical) NOT sourcetype=meraki:sensorreadingshistory | stats count by sourcetype, type | sort -count | head 20",
        "description": "Find error and failure events across all sources"
    },
    "security": {
        "query": "sourcetype=meraki:securityappliances category IN (ids_alerted, air_marshal, security_event, threat) | stats count by type, category | sort -count",
        "description": "Security events including IDS alerts and threat detections"
    },
    "authentication": {
        "query": "sourcetype=meraki:securityappliances (type=*vpn* OR type=*auth* OR type=*login* OR category=*vpn*) | stats count by type, description | sort -count",
        "description": "VPN and authentication events"
    },
    "connectivity": {
        "query": "sourcetype=meraki:securityappliances type IN (device_offline, device_online, failover, failover_event, packet_loss, uplink_status, uplink_change, port_up, port_down) | stats count by type, networkId | sort -count",
        "description": "Device connectivity and uplink events"
    },
    "config_changes": {
        "query": "sourcetype=meraki:organization_audit_logs | table _time, adminEmail, action, targetType, targetName, changes | sort -_time | head 50",
        "description": "Configuration changes made by administrators"
    },
    "client_issues": {
        "query": "sourcetype=meraki:accesspoints type IN (association, disassociation, deauth, 802.11_auth) | stats count by type, clientMac | sort -count",
        "description": "Client connection and authentication issues"
    },
    "dhcp": {
        "query": "sourcetype=meraki:securityappliances type=*dhcp* | stats count by type, vlanId | sort -count",
        "description": "DHCP events and lease activity"
    },
    "firewall": {
        "query": "sourcetype=meraki:securityappliances (type=*firewall* OR type=*rule* OR category=firewall) | stats count by type, action | sort -count",
        "description": "Firewall rule matches and blocks"
    },
    "wireless": {
        "query": "sourcetype=meraki:accesspoints | stats count by type, apMac | sort -count",
        "description": "Wireless AP events and client activity"
    },
    "switch": {
        "query": "sourcetype=meraki:switches type IN (port_status, stp_port_role_change, mac_flap_detected, port_up, port_down) | stats count by type, deviceSerial | sort -count",
        "description": "Switch port events, STP, and PoE"
    },
    "trends": {
        "query": "sourcetype=meraki:* NOT sourcetype=meraki:sensorreadingshistory | timechart span=1h count by type",
        "description": "Event trends over time by type"
    },
    "device_specific": {
        "query": "deviceSerial={serial} NOT sourcetype=meraki:sensorreadingshistory | stats count by type, category | sort -count",
        "description": "All events for a specific device"
    },
    "network_specific": {
        "query": "networkId={network_id} NOT sourcetype=meraki:sensorreadingshistory | stats count by type, deviceSerial | sort -count",
        "description": "All events for a specific network"
    },
}


# =============================================================================
# HANDLER
# =============================================================================

async def handle_suggest_query(params: Dict, context: Any) -> Dict:
    """Returns optimized SPL query based on intent and optional filters."""
    try:
        intent = params.get("intent", "summary")
        device_serial = params.get("device_serial")
        network_id = params.get("network_id")
        time_range = params.get("time_range", "-24h")

        # Get base template
        template = QUERY_TEMPLATES.get(intent, QUERY_TEMPLATES["summary"])
        query = template["query"]
        description = template["description"]

        # Add device/network filter if provided
        if device_serial:
            if intent in ("device_specific",):
                query = query.replace("{serial}", device_serial)
            else:
                # Prepend device filter to existing query
                query = f"deviceSerial={device_serial} " + query
            description += f" (filtered to device {device_serial})"

        if network_id:
            if intent in ("network_specific",):
                query = query.replace("{network_id}", network_id)
            else:
                # Prepend network filter to existing query
                query = f"networkId={network_id} " + query
            description += f" (filtered to network {network_id})"

        # Build response with guidance
        return {
            "success": True,
            "intent": intent,
            "suggested_query": query,
            "description": description,
            "time_range": time_range,
            "usage": f"Call splunk_search_run_splunk_query with search_query='{query}' and earliest_time='{time_range}'",
            "available_intents": list(QUERY_TEMPLATES.keys()),
        }

    except Exception as e:
        logger.error(f"Query builder error: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITION
# =============================================================================

SPLUNK_QUERY_BUILDER_TOOLS = [
    create_tool(
        name="splunk_suggest_query",
        description="""RECOMMENDED: Get optimized SPL queries for specific use cases. Use this BEFORE running splunk_search_run_splunk_query to get efficient, targeted queries that avoid scanning all data.

WIRELESS INTENTS (use for AP/client issues):
- association_failures: Failed associations, disassociations, deauth events
- wpa_auth_failures: WPA/PSK authentication failures (wrong passwords)
- wireless_client_issues: All client connect/disconnect/roam events
- ap_performance: AP event summary by access point
- roaming_events: Client roaming between APs

GENERAL INTENTS:
- summary, errors, security, authentication, connectivity
- config_changes, client_issues, dhcp, firewall
- wireless, switch, trends, device_specific, network_specific

Filter by device_serial or network_id to narrow results.""",
        platform="splunk",
        category="search",
        properties={
            "intent": {
                "type": "string",
                "enum": [
                    "association_failures", "wpa_auth_failures", "wireless_client_issues",
                    "ap_performance", "roaming_events",
                    "summary", "errors", "security", "authentication", "connectivity",
                    "config_changes", "client_issues", "dhcp", "firewall",
                    "wireless", "switch", "trends", "device_specific", "network_specific"
                ],
                "description": "The type of information to search for"
            },
            "device_serial": {
                "type": "string",
                "description": "Optional: Filter to a specific device serial (e.g., Q2KY-EVGL-CL3C)"
            },
            "network_id": {
                "type": "string",
                "description": "Optional: Filter to a specific network ID"
            },
            "time_range": {
                "type": "string",
                "description": "Time range for the search (e.g., -24h, -7d, -1h)",
                "default": "-24h"
            },
        },
        required=["intent"],
        tags=["splunk", "search", "query", "builder", "suggest", "spl", "wireless", "association"],
        requires_write=False,
        handler=handle_suggest_query,
        examples=[
            {"query": "Association failures", "params": {"intent": "association_failures", "time_range": "-24h"}},
            {"query": "WPA authentication issues", "params": {"intent": "wpa_auth_failures"}},
            {"query": "Wireless client problems", "params": {"intent": "wireless_client_issues"}},
            {"query": "Find errors", "params": {"intent": "errors", "time_range": "-24h"}},
            {"query": "Events for device Q2KY-EVGL-CL3C", "params": {"intent": "device_specific", "device_serial": "Q2KY-EVGL-CL3C"}},
        ],
    ),
]


# =============================================================================
# REGISTRATION
# =============================================================================

def register_query_builder_tools():
    """Register query builder tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_QUERY_BUILDER_TOOLS)
    logger.info(f"Registered {len(SPLUNK_QUERY_BUILDER_TOOLS)} splunk query builder tools")


# Auto-register on import
register_query_builder_tools()
