"""Canvas Card Tools - AI-controllable visualization tools.

This module provides tools that allow the AI to intelligently add
visualization cards to the canvas. Instead of predefined rules,
the AI can decide which visualizations would be most helpful for
the user's query.
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from src.services.tool_registry import get_tool_registry, create_tool

logger = logging.getLogger(__name__)


# =============================================================================
# Card Type Definitions
# =============================================================================

# All available canvas card types with descriptions for the AI
# NOTE: These type names MUST match the frontend SmartCard types exactly
# Format: platform_card_name (e.g., meraki_network_health, splunk_event_count)
CANVAS_CARD_TYPES = {
    # =========================================================================
    # Meraki Cards - Use for Meraki Dashboard data
    # =========================================================================
    "meraki_network_health": "Network-wide device health donut chart showing online/offline/alerting status. Use for overall network health overview.",
    "meraki_device_table": "Device inventory table with serial, name, model, status, IP. Use for listing all devices.",
    "meraki_alert_summary": "Alert counts by severity (critical/high/medium/low). Use for alert overview.",
    "meraki_top_clients": "Top bandwidth consuming clients bar chart. Use for identifying heavy users.",
    "meraki_uplink_status": "WAN uplink health and connectivity status grid. Use for WAN/internet status.",
    "meraki_ssid_clients": "Client distribution by SSID donut chart. Use for wireless client breakdown.",
    "meraki_switch_ports": "Switch port utilization and status grid. Use for switch port overview.",
    "meraki_vpn_status": "Site-to-site VPN tunnel status grid. Use for VPN monitoring.",
    "meraki_security_events": "Security events timeline. Use for security monitoring.",
    "meraki_top_applications": "Top applications by bandwidth bar chart. Use for app usage.",
    "meraki_rf_health": "Wireless RF quality metrics (signal, SNR, utilization). Use for wireless health.",
    "meraki_device_uptime": "Device uptime statistics. Use for uptime monitoring.",
    "meraki_bandwidth_usage": "Network bandwidth over time area chart. Use for traffic trends.",
    "meraki_client_count": "Connected client count big number. Use for quick client overview.",
    "meraki_latency_loss": "Latency and packet loss metrics. Use for network performance.",
    "meraki_wireless_stats": "Wireless connection statistics (success rate, failures). Use for wireless performance.",
    "meraki_firewall_rules": "L3/L7 firewall rules table. Use when user asks about firewall rules, security policies, or ACLs.",
    "meraki_vlan_list": "VLAN configuration table with IDs, names, subnets. Use when user asks about VLANs or network segmentation.",

    # =========================================================================
    # ThousandEyes Cards - Use for ThousandEyes monitoring data
    # =========================================================================
    "te_agent_health": "ThousandEyes agent status grid. Use for agent monitoring.",
    "te_alert_summary": "Active ThousandEyes alerts by severity. Use for TE alert overview.",
    "te_path_visualization": "Network path diagram. Use for path analysis.",
    "te_latency_chart": "Loss, latency, and jitter over time. Use for performance trends.",
    "te_outage_map": "Internet outage heatmap. Use for outage visibility.",
    "te_bgp_changes": "BGP route changes timeline. Use for BGP monitoring.",
    "te_dns_response": "DNS query response times. Use for DNS performance.",
    "te_voip_quality": "VoIP MOS scores and metrics. Use for voice quality.",
    "te_web_transaction": "Web transaction test results. Use for web app monitoring.",
    "te_endpoint_sessions": "Endpoint agent session data. Use for endpoint visibility.",
    "te_test_results": "ThousandEyes test summary. Use for test overview.",
    "te_network_diagnostic": "Cross-platform network diagnostic card combining ThousandEyes path analysis, Splunk log excerpts, and Meraki findings into a single view. Use when investigating connectivity issues across platforms. Provide severity, findings[], and optionally metrics, pathHops, logExcerpts, rootCause.",

    # =========================================================================
    # Splunk Cards - Use for Splunk/SIEM data
    # =========================================================================
    "splunk_event_count": "Event count time series. Use for log volume.",
    "splunk_top_errors": "Top error messages bar chart. Use for error analysis.",
    "splunk_severity_donut": "Events by severity level donut. Use for severity breakdown.",
    "splunk_metric": "Key metric big number. Use for single important value.",
    "splunk_search_results": "Splunk search result table. Use for search results.",
    "splunk_notable_events": "Security notable events list. Use for security incidents.",
    "splunk_activity_heatmap": "Activity by hour/day heatmap. Use for pattern analysis.",
    "splunk_sourcetype_volume": "Data volume by sourcetype. Use for data distribution.",
    "splunk_log_trends": "Log volume over time area chart with anomaly detection. Use for traffic trends.",
    "splunk_insights_summary": "AI-generated log insights status grid. Use for log analysis summary.",

    # =========================================================================
    # Catalyst Center Cards - Use for Cisco DNA Center data
    # =========================================================================
    "catalyst_site_health": "Site health score gauge. Use for site overview.",
    "catalyst_device_inventory": "Catalyst managed device table. Use for device list.",
    "catalyst_issue_summary": "Assurance issues by priority. Use for issue overview.",
    "catalyst_client_health": "Client health timeline. Use for client trends.",
    "catalyst_app_health": "Application health scores. Use for app performance.",
    "catalyst_fabric_status": "SDA fabric site status. Use for fabric monitoring.",
    "catalyst_rogue_aps": "Detected rogue access points. Use for security.",
    "catalyst_client_onboarding": "Client onboarding success rate. Use for onboarding metrics.",
    "catalyst_compliance": "Device compliance summary. Use for compliance status.",
    "catalyst_poe_usage": "PoE consumption gauge. Use for power monitoring.",
    "catalyst_interfaces": "Network interface details table with status, speed, duplex. Use when user asks about interfaces.",

    # =========================================================================
    # General Network Cards - Platform-agnostic
    # =========================================================================
    "network_routing_table": "IP routing table entries. Use for route display.",
    "network_bgp_neighbors": "BGP peering status grid. Use for BGP neighbor overview.",
    "network_ospf_status": "OSPF area and neighbor status. Use for OSPF overview.",
    "network_vlan_map": "VLAN to port mapping table. Use for VLAN overview.",
    "network_arp_table": "ARP cache entries table. Use for ARP display.",
    "network_mac_table": "MAC address table. Use for MAC display.",
    "network_traceroute": "Network path traceroute visualization. Use for path analysis.",
    "network_packet_capture": "Packet capture summary table. Use for packet inspection.",
    "network_acl_hits": "ACL hit counters bar chart. Use for firewall rule analysis.",
    "network_qos_policy": "QoS class statistics. Use for quality of service overview.",
    "network_stp_topology": "Spanning tree topology. Use for STP visualization.",
    "network_troubleshoot_flow": "Guided troubleshooting flowchart. Use for step-by-step diagnostics.",

    # =========================================================================
    # Network Performance Change Cards - For configuration changes with metrics
    # =========================================================================
    "network_performance_overview": "Current performance metrics snapshot with gauges for latency, loss, utilization. Use for baseline performance view before making changes.",
    "network_change_comparison": "Before/after performance comparison showing metric deltas with revert button. Use after applying configuration changes to visualize impact.",
    "network_change_history": "Timeline of configuration changes with status and metrics indicators. Use for tracking recent network configuration changes.",

    # =========================================================================
    # Knowledge Base Cards - Use for documentation/datasheet questions
    # =========================================================================
    "knowledge-sources": "Source documents/citations used for a knowledge-based response. Use when answering questions from documentation or datasheets.",
    "product-detail": "Product datasheet or specification card. Use when providing details about a specific product.",
    "datasheet-comparison": "Side-by-side comparison of multiple products. Use when comparing features, specs, or capabilities of 2+ products.",

    # =========================================================================
    # AI Contextual Cards - Data provided by AI, not fetched from APIs
    # These are PREFERRED when you already have the data from tool calls
    # =========================================================================
    "ai-metric": "Single key metric display (e.g., '91% success rate'). PREFERRED: Use for highlighting one important value you already know.",
    "ai-stats-grid": "Grid of 2-6 related stats. PREFERRED: Use for showing multiple metrics at once that you already have.",
    "ai-gauge": "Circular gauge for percentages/utilization. PREFERRED: Use for CPU/memory/bandwidth percentage you already know.",
    "ai-breakdown": "Pie/donut/bar chart for distributions. PREFERRED: Use for showing category breakdowns you already have.",
    "ai-finding": "Important finding or alert card. PREFERRED: Use for highlighting issues or recommendations.",
    "ai-device-summary": "Device summary card with status and attributes. PREFERRED: Use for specific device info you already retrieved.",
}

# Legacy card type mapping for backward compatibility
# Maps old kebab-case names to new platform-prefixed names
# Also maps AI contextual cards to closest frontend-supported equivalents
LEGACY_CARD_TYPE_MAPPING = {
    # AI contextual cards now have proper frontend implementations
    # They are mapped via BACKEND_TO_FRONTEND_CARD_TYPE in the frontend
    # Legacy kebab-case names
    "network-health": "meraki_network_health",
    "device-table": "meraki_device_table",
    "device-status": "meraki_network_health",
    "device-detail": "meraki_device_table",
    "alert-summary": "meraki_alert_summary",
    "performance-chart": "meraki_bandwidth_usage",
    "client-distribution": "meraki_ssid_clients",
    "client-list": "meraki_top_clients",
    "uplink-status": "meraki_uplink_status",
    "switch-ports": "meraki_switch_ports",
    "bandwidth-utilization": "meraki_bandwidth_usage",
    "latency-monitor": "meraki_latency_loss",
    "packet-loss": "meraki_latency_loss",
    "cpu-memory-health": "meraki_device_uptime",
    "uptime-tracker": "meraki_device_uptime",
    "wan-failover": "meraki_uplink_status",
    "top-talkers": "meraki_top_clients",
    "traffic-composition": "meraki_top_applications",
    "application-usage": "meraki_top_applications",
    "security-events": "meraki_security_events",
    "firewall-hits": "meraki_security_events",
    "blocked-connections": "meraki_security_events",
    "rf-analysis": "meraki_rf_health",
    "channel-utilization-heatmap": "meraki_rf_health",
    "client-signal-strength": "meraki_wireless_stats",
    "ssid-client-breakdown": "meraki_ssid_clients",
    "roaming-events": "meraki_wireless_stats",
    "alert-timeline": "meraki_security_events",
    "incident-tracker": "meraki_alert_summary",
    "alert-correlation": "meraki_alert_summary",
    "splunk-search-results": "splunk_search_results",
    "log-volume-trend": "splunk_event_count",
    "error-distribution": "splunk_top_errors",
    "topology": "network_stp_topology",
    "vpn-status": "meraki_vpn_status",
}


# =============================================================================
# Tool Handler
# =============================================================================

async def canvas_add_card_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Add a visualization card to the canvas.

    This tool allows the AI to intelligently decide which visualization
    would best help the user understand their query results.

    Args:
        params:
            - card_type: Type of card to add (see CANVAS_CARD_TYPES)
            - title: Human-readable title for the card
            - data: Optional data to populate the card
            - network_id: Optional network context
            - org_id: Optional organization context
            - config: Optional card configuration
        context: Execution context with session info

    Returns:
        Card configuration to be sent to frontend via card_suggestion event
    """
    card_type = params.get("card_type", "")
    title = params.get("title", "")
    data = params.get("data")
    card_data = params.get("card_data")  # AI-provided data for contextual cards
    citations = params.get("citations")  # For knowledge-sources cards
    products = params.get("products")  # For datasheet-comparison cards
    network_id = params.get("network_id")
    org_id = params.get("org_id")
    config = params.get("config", {})

    # Map legacy card types to new platform-prefixed names
    original_card_type = card_type
    if card_type in LEGACY_CARD_TYPE_MAPPING:
        card_type = LEGACY_CARD_TYPE_MAPPING[card_type]
        logger.info(f"[CanvasTool] Mapped legacy card type '{original_card_type}' to '{card_type}'")

    # For AI contextual cards, card_data takes precedence
    if card_type.startswith("ai-") and card_data:
        data = card_data

    # Handle knowledge-sources cards with citations
    if card_type == "knowledge-sources" and citations:
        data = {
            "query": params.get("query", title),
            "documents": [
                {
                    "id": str(i),
                    "title": c.get("title", "Document"),
                    "excerpt": c.get("excerpt", "")[:200] if c.get("excerpt") else "",
                    "relevance": c.get("relevance", 0.8),
                    "doc_type": "document",
                    "url": c.get("url"),
                    "document_id": c.get("document_id"),
                }
                for i, c in enumerate(citations)
            ],
        }
        logger.info(f"[CanvasTool] Built knowledge-sources data with {len(citations)} citations")

    # Handle datasheet-comparison cards with products
    if card_type == "datasheet-comparison" and products:
        data = {
            "products": products,
            "features": params.get("features", []),
        }
        logger.info(f"[CanvasTool] Built datasheet-comparison data with {len(products)} products")

    # Validate card type
    if card_type not in CANVAS_CARD_TYPES:
        # Find closest match for helpful error message
        suggestions = [ct for ct in CANVAS_CARD_TYPES.keys() if card_type.lower() in ct.lower()]
        suggestion_text = f" Did you mean: {', '.join(suggestions[:3])}?" if suggestions else ""
        return {
            "success": False,
            "error": f"Unknown card type: '{card_type}'.{suggestion_text}",
            "available_types": list(CANVAS_CARD_TYPES.keys())[:10],
        }

    # Generate title if not provided
    if not title:
        # Create human-readable title from card type
        title = card_type.replace("_", " ").replace("-", " ").title()
        # Remove platform prefix for cleaner titles
        for prefix in ["Meraki ", "Te ", "Splunk ", "Catalyst ", "Network ", "Ai "]:
            if title.startswith(prefix):
                title = title[len(prefix):]
                break

    # Build card suggestion payload
    # This will be emitted as a card_suggestion SSE event
    # NOTE: scope must use camelCase keys inside metadata.scope to match frontend expectations
    card_suggestion = {
        "type": card_type,
        "title": title,
        "data": data,
        "metadata": {
            "source": "ai_tool",
            "scope": {
                "networkId": network_id,
                "organizationId": org_id,
            } if (network_id or org_id) else None,
            **config,
        }
    }

    logger.info(f"[CanvasTool] AI requested card: type={card_type}, title={title}")
    logger.info(f"[CanvasTool] Returning card_suggestion: type={card_suggestion.get('type')}, title={card_suggestion.get('title')}, has_metadata={bool(card_suggestion.get('metadata'))}")

    return {
        "success": True,
        "card_suggestion": card_suggestion,
        "message": f"Added {card_type} card: {title}",
    }


async def _infer_cards_from_context(session_id: str) -> Optional[tuple[List[Dict], str, str, str]]:
    """Infer appropriate cards based on recent tool calls in session.

    Returns:
        Tuple of (cards, layout_title, network_id, org_id) or None if cannot infer
    """
    try:
        from src.services.session_context_store import get_session_context_store
        context_store = get_session_context_store()
        session_ctx = await context_store.get_or_create(session_id)

        # Get recent tool data from cardable cache
        cardable_data = session_ctx.get_valid_cardable_data()
        if not cardable_data:
            return None

        # Extract tools called and their context
        tools_called = [item.get("tool", "") for item in cardable_data]

        # Get network_id and org_id from the most recent tool call
        latest = cardable_data[-1] if cardable_data else {}
        network_id = latest.get("network_id")
        org_id = latest.get("org_id")

        logger.info(f"[CanvasTool] Context inference - tools: {tools_called}, network: {network_id}, org: {org_id}")

        # Infer card type based on tools that were called
        # Map tool patterns to appropriate cards
        TOOL_TO_CARDS = {
            # Device-related tools → device + health + alerts
            "device": {
                "cards": [
                    {"type": "meraki_device_table", "title": "Device Inventory"},
                    {"type": "meraki_network_health", "title": "Network Health"},
                    {"type": "meraki_alert_summary", "title": "Alerts"},
                ],
                "title": "Device Status Dashboard"
            },
            # Alert-related tools → alerts + health + devices
            "alert": {
                "cards": [
                    {"type": "meraki_alert_summary", "title": "Alert Summary"},
                    {"type": "meraki_network_health", "title": "Network Health"},
                    {"type": "meraki_device_table", "title": "Affected Devices"},
                ],
                "title": "Alert Investigation"
            },
            # Performance tools → latency + bandwidth + uplinks
            "latency|loss|bandwidth|performance": {
                "cards": [
                    {"type": "meraki_latency_loss", "title": "Latency & Loss"},
                    {"type": "meraki_bandwidth_usage", "title": "Bandwidth Usage"},
                    {"type": "meraki_uplink_status", "title": "Uplink Status"},
                ],
                "title": "Performance Dashboard"
            },
            # Wireless tools → RF + clients + stats
            "wireless|ssid|rf|wifi": {
                "cards": [
                    {"type": "meraki_rf_health", "title": "RF Health"},
                    {"type": "meraki_ssid_clients", "title": "Client Distribution"},
                    {"type": "meraki_wireless_stats", "title": "Wireless Stats"},
                ],
                "title": "Wireless Dashboard"
            },
            # Security tools → security events + alerts
            "security|firewall|threat": {
                "cards": [
                    {"type": "meraki_security_events", "title": "Security Events"},
                    {"type": "meraki_alert_summary", "title": "Security Alerts"},
                ],
                "title": "Security Dashboard"
            },
            # VPN/WAN tools → VPN + uplinks + latency
            "vpn|wan|uplink": {
                "cards": [
                    {"type": "meraki_vpn_status", "title": "VPN Status"},
                    {"type": "meraki_uplink_status", "title": "Uplink Status"},
                    {"type": "meraki_latency_loss", "title": "Latency & Loss"},
                ],
                "title": "Connectivity Dashboard"
            },
            # Client tools → top clients + bandwidth
            "client": {
                "cards": [
                    {"type": "meraki_top_clients", "title": "Top Clients"},
                    {"type": "meraki_bandwidth_usage", "title": "Bandwidth"},
                    {"type": "meraki_ssid_clients", "title": "Client Distribution"},
                ],
                "title": "Client Dashboard"
            },
        }

        # Check which pattern matches the tools called
        tools_str = " ".join(tools_called).lower()
        for pattern, config in TOOL_TO_CARDS.items():
            import re
            if re.search(pattern, tools_str):
                logger.info(f"[CanvasTool] Inferred cards from pattern '{pattern}': {config['title']}")
                return (config["cards"], config["title"], network_id, org_id)

        # No specific match - return None (will fall back to helpful error)
        return None

    except Exception as e:
        logger.warning(f"[CanvasTool] Context inference failed: {e}")
        return None


async def canvas_add_dashboard_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Add multiple cards as a cohesive dashboard layout.

    This tool allows the AI to create multi-card layouts for
    comprehensive views (e.g., incident investigation, performance debug).

    Args:
        params:
            - scenario: Predefined scenario ('incident', 'performance', 'security', 'wireless', 'overview')
            - cards: OR list of card specifications [{type, title, network_id?, org_id?}]
            - layout_title: Optional title for the card group
            - network_id: Default network ID for all cards
            - org_id: Default organization ID for all cards
            - session_id: Session ID for context inference (auto-populated)
        context: Execution context

    Returns:
        Multiple card suggestions to be added to canvas
    """
    scenario = params.get("scenario")
    cards = params.get("cards", [])
    layout_title = params.get("layout_title", "Dashboard")
    default_network_id = params.get("network_id")
    default_org_id = params.get("org_id")
    session_id = params.get("session_id", "default")

    # Enhanced logging to trace why canvas tools fail
    logger.info(f"[CanvasTool] canvas_add_dashboard called:")
    logger.info(f"  - scenario: {scenario}")
    logger.info(f"  - cards count: {len(cards) if cards else 0}")
    logger.info(f"  - network_id: {default_network_id}")
    logger.info(f"  - session_id: {session_id}")
    logger.info(f"  - all params: {list(params.keys())}")

    # Predefined scenario layouts (using platform-prefixed card types)
    SCENARIOS = {
        "incident": [
            {"type": "meraki_alert_summary", "title": "Alert Summary"},
            {"type": "meraki_network_health", "title": "Network Health"},
            {"type": "meraki_device_table", "title": "Device Inventory"},
        ],
        "performance": [
            {"type": "meraki_latency_loss", "title": "Latency & Loss"},
            {"type": "meraki_bandwidth_usage", "title": "Bandwidth"},
            {"type": "meraki_uplink_status", "title": "Uplink Status"},
        ],
        "security": [
            {"type": "meraki_security_events", "title": "Security Events"},
            {"type": "meraki_alert_summary", "title": "Alert Summary"},
        ],
        "wireless": [
            {"type": "meraki_rf_health", "title": "RF Health"},
            {"type": "meraki_ssid_clients", "title": "Client Distribution"},
            {"type": "meraki_wireless_stats", "title": "Wireless Stats"},
        ],
        "overview": [
            {"type": "meraki_network_health", "title": "Network Health"},
            {"type": "meraki_alert_summary", "title": "Alert Summary"},
            {"type": "meraki_device_table", "title": "Device Inventory"},
        ],
        "connectivity": [
            {"type": "te_path_visualization", "title": "Path Analysis"},
            {"type": "te_test_results", "title": "Test Results"},
            {"type": "meraki_uplink_status", "title": "Uplink Status"},
            {"type": "meraki_latency_loss", "title": "Latency & Loss"},
        ],
    }

    # Priority 1: Use explicit scenario if provided
    if scenario and scenario in SCENARIOS:
        cards = SCENARIOS[scenario]
        logger.info(f"[CanvasTool] Using predefined scenario: {scenario}")

    # Priority 2: Use explicit cards if provided
    elif cards:
        logger.info(f"[CanvasTool] Using custom cards array: {len(cards)} cards")

    # Priority 3: Check if this is an incident analysis session and default to incident scenario
    else:
        # Check session context for incident focus before trying general inference
        try:
            from src.services.session_context_store import get_session_context_store
            ctx_store = get_session_context_store()
            session_ctx = await ctx_store.get_or_create(session_id)

            # Check if session has incident focus (current_focus contains "incident" or "alert")
            if session_ctx.current_focus and ("incident" in session_ctx.current_focus.lower() or "alert" in session_ctx.current_focus.lower()):
                scenario = "incident"
                cards = SCENARIOS[scenario]
                logger.info(f"[CanvasTool] Detected incident context from session focus, defaulting to 'incident' scenario")
        except Exception as e:
            logger.warning(f"[CanvasTool] Could not check session context for incident detection: {e}")

        # Priority 4: Try to infer from context (recent tool calls)
        if not scenario and not cards:
            logger.info(f"[CanvasTool] No scenario or cards provided, trying context inference for session: {session_id}")
            inferred = await _infer_cards_from_context(session_id)
            logger.info(f"[CanvasTool] Context inference result: {inferred is not None}")
            if inferred:
                cards, layout_title, inferred_network_id, inferred_org_id = inferred
                # Use inferred network/org if not explicitly provided
                default_network_id = default_network_id or inferred_network_id
                default_org_id = default_org_id or inferred_org_id
                logger.info(f"[CanvasTool] Using context-inferred cards: {layout_title}")
            else:
                # Priority 5: Default to "overview" scenario instead of failing
                scenario = "overview"
                cards = SCENARIOS[scenario]
                logger.info(f"[CanvasTool] No context available, defaulting to 'overview' scenario")

    # Validate and map all card types
    validated_cards = []
    for card in cards:
        card_type = card.get("type", "")

        # Map legacy card types to new platform-prefixed names
        if card_type in LEGACY_CARD_TYPE_MAPPING:
            card_type = LEGACY_CARD_TYPE_MAPPING[card_type]

        if card_type not in CANVAS_CARD_TYPES:
            return {
                "success": False,
                "error": f"Unknown card type: '{card.get('type')}'",
            }

        validated_cards.append({**card, "type": card_type})

    # Generate card suggestions with scope (network_id, org_id)
    card_suggestions = []
    for card in validated_cards:
        # Use card-level scope if provided, otherwise fall back to default
        network_id = card.get("network_id") or default_network_id
        org_id = card.get("org_id") or default_org_id

        # Build scope object
        scope = {}
        if network_id:
            scope["networkId"] = network_id
        if org_id:
            scope["organizationId"] = org_id

        card_suggestion = {
            "type": card["type"],
            "title": card.get("title", card["type"].replace("_", " ").replace("-", " ").title()),
            "data": card.get("data"),
            "metadata": {
                "layout_group": layout_title,
                "source": "ai_dashboard_tool",
                "scope": scope if scope else None,
                **card.get("config", {}),
            }
        }
        card_suggestions.append(card_suggestion)

    logger.info(f"[CanvasTool] AI requested dashboard: {len(card_suggestions)} cards for '{layout_title}', network={default_network_id}, org={default_org_id}")
    logger.info(f"[CanvasTool] Returning {len(card_suggestions)} card_suggestions: types={[c.get('type') for c in card_suggestions]}")

    return {
        "success": True,
        "card_suggestions": card_suggestions,
        "message": f"Added {len(card_suggestions)} cards: {layout_title}",
    }


# =============================================================================
# Tool Definitions
# =============================================================================

# Build detailed card type description for the AI
def _build_card_type_description() -> str:
    """Build a detailed description of available card types."""
    # Group cards by category using new platform-prefixed names
    categories = {
        "AI Contextual (PREFERRED - you provide the data)": [
            "ai-metric", "ai-stats-grid", "ai-gauge", "ai-breakdown", "ai-finding", "ai-device-summary"
        ],
        "Meraki Monitoring": [
            "meraki_network_health", "meraki_device_table", "meraki_alert_summary",
            "meraki_uplink_status", "meraki_bandwidth_usage", "meraki_latency_loss"
        ],
        "Meraki Wireless": [
            "meraki_rf_health", "meraki_ssid_clients", "meraki_wireless_stats", "meraki_client_count"
        ],
        "Meraki Security": [
            "meraki_security_events", "meraki_vpn_status"
        ],
        "Meraki Traffic": [
            "meraki_top_clients", "meraki_top_applications", "meraki_switch_ports"
        ],
        "ThousandEyes": [
            "te_agent_health", "te_alert_summary", "te_latency_chart", "te_path_visualization",
            "te_network_diagnostic"
        ],
        "Splunk": [
            "splunk_event_count", "splunk_search_results", "splunk_notable_events", "splunk_top_errors",
            "splunk_severity_donut", "splunk_sourcetype_volume", "splunk_log_trends", "splunk_insights_summary"
        ],
        "Catalyst Center": [
            "catalyst_site_health", "catalyst_device_inventory", "catalyst_issue_summary"
        ],
        "Knowledge Base": [
            "knowledge-sources", "product-detail", "datasheet-comparison"
        ],
    }

    lines = ["Available card types by category:"]
    for category, types in categories.items():
        lines.append(f"\n{category}:")
        for t in types:
            desc = CANVAS_CARD_TYPES.get(t, "")
            lines.append(f"  - {t}: {desc}")

    return "\n".join(lines)


CANVAS_TOOLS = [
    create_tool(
        name="canvas_add_card",
        description=f"""Add a visualization card to the user's canvas. The card will appear immediately on their canvas without them needing to click anything.

Use this tool to add a single visualization card to the user's canvas.

== WHEN TO ADD A CARD (be selective) ==

ADD a card when:
- User explicitly asks to "show", "display", "visualize", or "monitor" something
- You retrieved data from a tool call that contains a list, table, or metrics worth displaying
- The user is investigating an incident and needs a monitoring view

DO NOT add a card when:
- The user asked a simple question that you can answer in text (e.g., "what's the SSID name?")
- You're providing a brief status update or confirmation
- The data is a single value better communicated in your text response
- A card of the same type is already on the canvas (check before adding)

== CARD TYPE SELECTION GUIDE ==

LIVE MONITORING CARDS (fetch their own data - just specify network_id or org_id):
- meraki_network_health: Network health donut → use for overall health overview
- meraki_device_table: Device inventory → use when listing devices
- meraki_alert_summary: Alert severity counts → use for alert overview
- meraki_uplink_status: WAN uplink health → use for connectivity status
- meraki_bandwidth_usage: Bandwidth chart → use for traffic trends
- meraki_firewall_rules: Firewall rules table → use when asked about firewall/ACL config
- meraki_vlan_list: VLAN table → use when asked about VLANs

AI CONTEXTUAL CARDS (you provide the data from your tool call results):
- ai-metric: Single important value (e.g., "91% uptime")
- ai-stats-grid: Grid of 2-6 related stats
- ai-breakdown: Distribution chart (e.g., device types, error categories)
- ai-finding: Important finding or recommendation with severity

KNOWLEDGE CARDS (for documentation/datasheet answers):
- knowledge-sources: Citations from knowledge base documents
- product-detail: Single product specs
- datasheet-comparison: Side-by-side product comparison

{_build_card_type_description()}

Choose the most appropriate card type based on the data and user intent.""",
        platform="canvas",
        category="visualization",
        properties={
            "card_type": {
                "type": "string",
                "description": "The type of visualization card to add",
                "enum": list(CANVAS_CARD_TYPES.keys()),
            },
            "title": {
                "type": "string",
                "description": "Human-readable title for the card (e.g., 'Wireless Health Summary')",
            },
            "card_data": {
                "type": "object",
                "description": """Data for AI contextual cards. Structure depends on card type:
- ai-metric: {{label, value, unit?, trend?, context?, status?}}
- ai-stats-grid: {{title?, stats: [{{label, value, icon?, status?}}]}}
- ai-gauge: {{label, value, max, unit?, thresholds?}}
- ai-breakdown: {{title, items: [{{label, value, color?}}], displayAs: 'pie'|'bar'|'donut'}}
- ai-finding: {{severity, title, description, details?, recommendation?}}
- ai-device-summary: {{name, type, status, attributes: [{{label, value}}], metrics?}}
- knowledge-sources: {{query: string, documents: [{{title, excerpt, relevance?, url?}}]}}
- product-detail: {{product: {{name, category, specs: [{{label, value}}]}}}}
- datasheet-comparison: {{products: [{{name, specs: {{...}}}}], features: [string]}}""",
            },
            "citations": {
                "type": "array",
                "description": """For knowledge-sources card: Array of citation objects with:
- title: Document title
- excerpt: Relevant quote or excerpt (max 200 chars)
- relevance: Relevance score 0-1
- document_id: Optional document ID for linking""",
            },
            "products": {
                "type": "array",
                "description": """For datasheet-comparison card: Array of product objects with:
- name: Product name (e.g., "Catalyst 9300-48P")
- specs: Object with specification key-value pairs
- highlights: Optional array of key differentiators""",
            },
            "data": {
                "type": "object",
                "description": "Optional data for non-AI cards. For live cards, omit this.",
            },
            "network_id": {
                "type": "string",
                "description": "Network ID for network-scoped cards",
            },
            "org_id": {
                "type": "string",
                "description": "Organization ID for org-scoped cards",
            },
        },
        required=["card_type"],
        handler=canvas_add_card_handler,
        tags=["canvas", "visualization", "ui"],
        examples=[
            {
                "query": "Show me the wireless health",
                "params": {
                    "card_type": "meraki_rf_health",
                    "title": "Wireless Health",
                }
            },
            {
                "query": "Show me network health",
                "params": {
                    "card_type": "meraki_network_health",
                    "title": "Network Health",
                }
            },
            {
                "query": "List all devices",
                "params": {
                    "card_type": "meraki_device_table",
                    "title": "Device Inventory",
                }
            },
            {
                "query": "What are the specs of the Catalyst 9300?",
                "params": {
                    "card_type": "knowledge-sources",
                    "title": "Source Documents",
                    "citations": [
                        {"title": "Catalyst 9300 Datasheet", "excerpt": "The Catalyst 9300 Series switches...", "relevance": 0.95}
                    ]
                }
            },
            {
                "query": "Are there any issues?",
                "params": {
                    "card_type": "ai-finding",
                    "title": "Issue Detected",
                    "card_data": {
                        "severity": "warning",
                        "title": "High AP Utilization",
                        "description": "3 access points are above 80% channel utilization",
                        "recommendation": "Consider adding additional APs or adjusting RF settings"
                    }
                }
            },
        ],
    ),
    create_tool(
        name="canvas_add_dashboard",
        description="""Add multiple related cards as a dashboard layout. All cards appear immediately on the canvas.

PREFER THIS TOOL for initial queries and incident analysis - it's more reliable than calling canvas_add_card multiple times.

== WHEN TO USE ==
- Incident analysis (any type) - analyze the incident and pick relevant cards
- User asks for "dashboard" or wants to see "everything about" a topic
- Comprehensive monitoring setup
- Any query where 2-4 cards would provide better context

== INCIDENT CARD SELECTION GUIDE ==
Analyze the incident type and select cards that help investigate/monitor it:

DEVICE STATUS ISSUES (offline, dormant, alerting devices):
→ meraki_device_table + meraki_network_health + meraki_alert_summary

CONNECTIVITY/PERFORMANCE ISSUES (latency, packet loss, slow speeds, site-to-site):
→ te_path_visualization + te_test_results + meraki_uplink_status + meraki_latency_loss
→ Or use scenario='connectivity' for the standard cross-platform layout

WIRELESS ISSUES (RF problems, client disconnects, roaming failures):
→ meraki_rf_health + meraki_ssid_clients + meraki_wireless_stats

SECURITY EVENTS (threats, blocked connections, intrusion attempts):
→ meraki_security_events + meraki_alert_summary

VPN/WAN ISSUES (site-to-site connectivity, failover):
→ meraki_vpn_status + meraki_uplink_status + meraki_latency_loss

CROSS-PLATFORM CONNECTIVITY (branch-to-hub, site-to-site, path analysis):
→ te_path_visualization + te_test_results + meraki_uplink_status + meraki_latency_loss
→ Use scenario='connectivity' - then check Splunk if TE/Meraki show issues

GENERAL/UNKNOWN (when incident type is unclear):
→ meraki_network_health + meraki_device_table + meraki_alert_summary

== PREDEFINED SCENARIOS (shortcut) ==
Use 'scenario' parameter for quick common layouts: incident, performance, security, wireless, connectivity, overview

== CUSTOM CARDS (preferred for incidents) ==
Use 'cards' array to specify exactly which cards fit the situation.

After calling this tool, confirm: "I've added X cards to your canvas for [purpose]." """,
        platform="canvas",
        category="visualization",
        properties={
            "scenario": {
                "type": "string",
                "description": "Predefined scenario layout (or use 'cards' for custom selection)",
                "enum": ["incident", "performance", "security", "wireless", "connectivity", "overview"],
            },
            "cards": {
                "type": "array",
                "description": "Custom list of cards - PREFERRED for incident analysis. Include network_id for each card.",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "description": "Card type (e.g., meraki_device_table)"},
                        "title": {"type": "string", "description": "Card title"},
                        "network_id": {"type": "string", "description": "Network ID for this card"},
                        "org_id": {"type": "string", "description": "Organization ID for this card"},
                    }
                }
            },
            "layout_title": {
                "type": "string",
                "description": "Title for the dashboard group",
            },
            "network_id": {
                "type": "string",
                "description": "Default network ID for all cards (can be overridden per card)",
            },
            "org_id": {
                "type": "string",
                "description": "Default organization ID for all cards (can be overridden per card)",
            },
        },
        required=[],
        handler=canvas_add_dashboard_handler,
        tags=["canvas", "visualization", "dashboard", "ui"],
        examples=[
            {
                "query": "Analyze incident: Device GRIEVES is DORMANT",
                "params": {
                    "cards": [
                        {"type": "meraki_device_table", "title": "Device Inventory", "network_id": "L_123"},
                        {"type": "meraki_network_health", "title": "Network Health", "network_id": "L_123"}
                    ],
                    "layout_title": "Device Status Investigation"
                }
            },
            {
                "query": "High latency on WAN uplink",
                "params": {
                    "cards": [
                        {"type": "meraki_uplink_status", "title": "Uplink Status"},
                        {"type": "meraki_latency_loss", "title": "Latency & Loss"},
                        {"type": "meraki_bandwidth_usage", "title": "Bandwidth"}
                    ],
                    "network_id": "L_456",
                    "layout_title": "Performance Investigation"
                }
            },
        ],
    ),
]


# =============================================================================
# Follow-Up Suggestions Tool
# =============================================================================

async def suggest_followups_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Suggest follow-up actions the user can take with one click.

    Returns follow-up suggestions that will be rendered as clickable buttons
    below the AI's response in the chat UI.
    """
    suggestions = params.get("suggestions", [])

    if not suggestions or not isinstance(suggestions, list):
        return {"success": False, "error": "Must provide a list of suggestions"}

    # Validate and normalize suggestions (max 3)
    normalized = []
    for s in suggestions[:3]:
        if isinstance(s, str):
            normalized.append({"label": s, "query": s})
        elif isinstance(s, dict) and s.get("label"):
            normalized.append({
                "label": s["label"],
                "query": s.get("query", s["label"]),
            })

    if not normalized:
        return {"success": False, "error": "No valid suggestions provided"}

    logger.info(f"[FollowUpTool] Suggesting {len(normalized)} follow-ups: {[s['label'] for s in normalized]}")

    return {
        "success": True,
        "followup_suggestions": normalized,
        "message": f"Suggested {len(normalized)} follow-up actions",
    }


FOLLOWUP_TOOLS = [
    create_tool(
        name="suggest_followups",
        description="""Suggest 2-3 follow-up actions the user might want to take next. These appear as clickable buttons below your response.

WHEN TO USE THIS TOOL:
- After completing any analysis or investigation — suggest deeper dives
- After answering a question — suggest related questions the user might have
- After showing device/network status — suggest troubleshooting or monitoring actions
- After providing recommendations — offer to implement them or investigate further

WHEN NOT TO USE:
- Simple yes/no answers
- When you're asking the user a clarifying question (use text instead)

Each suggestion should be a complete, actionable query that you can answer if the user clicks it.""",
        platform="canvas",
        category="interaction",
        properties={
            "suggestions": {
                "type": "array",
                "description": "2-3 follow-up suggestions. Each has a short label (shown on button) and the full query to send.",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {
                            "type": "string",
                            "description": "Short button label (max 60 chars), e.g., 'Investigate root cause'",
                        },
                        "query": {
                            "type": "string",
                            "description": "Full query to send when clicked, e.g., 'Investigate the root cause of the VLAN mismatch on subnet 10.0.0.0/24'",
                        },
                    },
                    "required": ["label", "query"],
                },
            },
        },
        required=["suggestions"],
        handler=suggest_followups_handler,
        tags=["canvas", "interaction", "ui"],
        examples=[
            {
                "query": "Show me device health",
                "params": {
                    "suggestions": [
                        {"label": "Check offline devices", "query": "Investigate the 3 offline devices and check if they have recent alerts"},
                        {"label": "View bandwidth trends", "query": "Show me bandwidth usage trends for the past 24 hours"},
                        {"label": "Run health audit", "query": "Run a comprehensive health audit across all networks"},
                    ]
                }
            },
        ],
    ),
]


def register_canvas_tools():
    """Register all canvas visualization tools."""
    registry = get_tool_registry()
    registry.register_many(CANVAS_TOOLS)
    registry.register_many(FOLLOWUP_TOOLS)
    logger.info(f"[CanvasTools] Registered {len(CANVAS_TOOLS)} canvas tools + {len(FOLLOWUP_TOOLS)} followup tools")


# Auto-register when imported
# Note: Registration happens via tool_registry._load_all_tools()
