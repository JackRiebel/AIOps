"""Unified Chat Service for Multi-Provider AI Architecture.

This service provides a single interface for AI chat across all providers:
- Claude (Anthropic)
- GPT (OpenAI)
- Gemini (Google)
- Cisco Circuit

It handles:
- Tool format conversion per provider
- Tool execution loops
- Session context management
- Entity discovery and enrichment
- Streaming support

Usage:
    service = UnifiedChatService(
        model="claude-sonnet-4-5-20250929",
        api_key="sk-...",
    )
    result = await service.chat(
        message="List devices on Demo Home",
        conversation_history=history,
        credentials=meraki_credentials,
        session_id="conv-123",
    )
"""

import asyncio
import logging
import json
import os
import re
from typing import List, Dict, Any, Optional, AsyncGenerator, Tuple
from dataclasses import dataclass, field

import anthropic
import openai
import httpx
import tiktoken

from src.services.ai_service import get_provider_from_model, get_model_costs
from src.services.tool_selector import is_incident_query


def is_comparison_query(message: str) -> bool:
    """Check if the query is asking for product/feature comparison.

    Args:
        message: User query

    Returns:
        True if query appears to be a comparison request
    """
    q = message.lower()
    comparison_patterns = [
        r'\bdifference[s]?\b',
        r'\bcompare\b',
        r'\bcomparison\b',
        r'\bvs\b',
        r'\bversus\b',
        r'\bor\b.*\bwhich\b',
        r'\bwhich\b.*\bbetter\b',
        r'\bwhat.+different\b',
        r'\bhow.+differ\b',
    ]
    return any(re.search(pattern, q) for pattern in comparison_patterns)


def parse_comparison_json(response_text: str, query: str) -> Optional[Dict[str, Any]]:
    """Parse comparison JSON from AI response.

    The AI is instructed to include a ```json:comparison block with structured
    comparison data when answering comparison queries.

    Args:
        response_text: Full AI response text
        query: Original user query

    Returns:
        Parsed comparison data or None if not found/invalid
    """
    if not response_text:
        return None

    # Look for ```json:comparison block
    pattern = r'```json:comparison\s*\n(.*?)\n```'
    match = re.search(pattern, response_text, re.DOTALL)

    if not match:
        # Also try regular json block at the end
        pattern = r'```json\s*\n(\{[^`]*"products"[^`]*\})\s*\n```'
        match = re.search(pattern, response_text, re.DOTALL)

    if not match:
        return None

    try:
        json_str = match.group(1).strip()
        data = json.loads(json_str)

        # Validate structure
        if not isinstance(data, dict):
            return None
        if "products" not in data or not isinstance(data["products"], list):
            return None
        if len(data["products"]) < 2:
            return None

        # Add query if not present
        data["query"] = query

        # Ensure features list exists
        if "features" not in data:
            all_features = set()
            for p in data["products"]:
                if "specs" in p:
                    all_features.update(p["specs"].keys())
            data["features"] = sorted(all_features)

        logger.info(f"[StreamChat] Parsed comparison JSON with {len(data['products'])} products")
        return data

    except json.JSONDecodeError as e:
        logger.warning(f"[StreamChat] Failed to parse comparison JSON: {e}")
        return None
    except Exception as e:
        logger.warning(f"[StreamChat] Error processing comparison JSON: {e}")
        return None


def parse_product_json(response_text: str, query: str) -> Optional[Dict[str, Any]]:
    """Parse product detail JSON from AI response.

    The AI is instructed to include a ```json:product block with structured
    product data when answering single-product queries.

    Args:
        response_text: Full AI response text
        query: Original user query

    Returns:
        Parsed product data or None if not found/invalid
    """
    if not response_text:
        return None

    # Look for ```json:product block
    pattern = r'```json:product\s*\n(.*?)\n```'
    match = re.search(pattern, response_text, re.DOTALL)

    if not match:
        return None

    try:
        json_str = match.group(1).strip()
        data = json.loads(json_str)

        # Validate structure
        if not isinstance(data, dict):
            return None
        if "product" not in data or not isinstance(data["product"], dict):
            return None
        if "name" not in data["product"]:
            return None

        # Add query if not present
        data["query"] = query

        logger.info(f"[StreamChat] Parsed product JSON for: {data['product'].get('name', 'unknown')}")
        return data

    except json.JSONDecodeError as e:
        logger.warning(f"[StreamChat] Failed to parse product JSON: {e}")
        return None
    except Exception as e:
        logger.warning(f"[StreamChat] Error processing product JSON: {e}")
        return None


def extract_comparison_data(
    message: str,
    chunks: List[Any],
    response_content: str = ""
) -> Optional[Dict[str, Any]]:
    """Extract structured comparison data from knowledge chunks.

    This parses the knowledge chunks to identify product names and their
    specifications, organizing them into a comparison table format.

    Args:
        message: Original query
        chunks: Retrieved knowledge chunks
        response_content: AI response (may contain structured data)

    Returns:
        Comparison data dict or None if extraction fails
    """
    if not chunks:
        return None

    # Try to identify products being compared from the query
    q = message.lower()

    # Common product patterns (C9200, C9300, MX68, etc.)
    product_pattern = r'\b(c\d{4}[a-z]*|mx\d+[a-z]*|ms\d+[a-z]*|mr\d+[a-z]*|z\d+[a-z]*)\b'
    products_mentioned = set(re.findall(product_pattern, q, re.IGNORECASE))

    # If asking about a product series (e.g., "C9200s"), extract variants from chunks
    series_pattern = r'\b(c\d{4})[s]?\b'
    series_match = re.search(series_pattern, q, re.IGNORECASE)

    if series_match or products_mentioned:
        # Extract products from chunk content
        all_content = "\n".join(c.content if hasattr(c, 'content') else str(c) for c in chunks)

        # Look for product variants in content
        if series_match:
            base = series_match.group(1).upper()
            variant_pattern = rf'\b({base}[A-Z]*(?:-[A-Z0-9]+)?)\b'
            variants = set(re.findall(variant_pattern, all_content, re.IGNORECASE))
            if variants:
                products_mentioned = variants

        if not products_mentioned:
            # Fall back to finding any Cisco product numbers
            products_mentioned = set(re.findall(r'\b(C\d{4}[A-Z]*)\b', all_content)[:5])

    if len(products_mentioned) < 2:
        return None

    # Build product specs from chunk content
    products = []

    # Combine all chunk content for analysis
    all_content = "\n".join(c.content if hasattr(c, 'content') else str(c) for c in chunks)

    # Define the key features we want to extract (ordered by importance)
    key_features = [
        "Stacking Bandwidth",
        "Virtual Networks",
        "DRAM",
        "Flash",
        "Packet Buffer",
        "MAC Addresses",
        "IPv4 Routes",
        "Power Supply",
        "Fans",
        "Uplinks",
        "MACsec",
        "SD-Access",
        "PoE",
        "Form Factor",
    ]

    # Build a mapping of product -> feature -> value by parsing the content
    # Look for patterns like "C9200: 160 Gbps stacking" or "C9200L has 80 Gbps"
    product_specs = {p.upper(): {} for p in products_mentioned}

    # Patterns for each feature (more flexible matching)
    feature_extractors = {
        "Stacking Bandwidth": [
            (r'(\d+)\s*Gbps\s*(?:stack|bandwidth)', lambda m: f"{m.group(1)} Gbps"),
            (r'stack(?:ing|wise)?[-\s:]+(\d+)\s*(?:Gbps|G)', lambda m: f"{m.group(1)} Gbps"),
            (r'no\s*stack', lambda m: "Not Supported"),
        ],
        "Virtual Networks": [
            (r'(\d+)\s*(?:VN|virtual\s*network)s?', lambda m: f"{m.group(1)} VNs"),
            (r'VN[s]?\s*[:=]\s*(\d+)', lambda m: f"{m.group(1)} VNs"),
        ],
        "DRAM": [
            (r'(\d+)\s*GB\s*(?:DRAM|memory|RAM)', lambda m: f"{m.group(1)} GB"),
            (r'(?:DRAM|memory|RAM)\s*[:=]?\s*(\d+)\s*GB', lambda m: f"{m.group(1)} GB"),
        ],
        "Flash": [
            (r'(\d+)\s*GB\s*[Ff]lash', lambda m: f"{m.group(1)} GB"),
            (r'[Ff]lash\s*[:=]?\s*(\d+)\s*GB', lambda m: f"{m.group(1)} GB"),
        ],
        "Packet Buffer": [
            (r'(\d+)\s*MB\s*(?:packet\s*)?buffer', lambda m: f"{m.group(1)} MB"),
            (r'buffer\s*[:=]?\s*(\d+)\s*MB', lambda m: f"{m.group(1)} MB"),
        ],
        "MAC Addresses": [
            (r'(\d+[,\d]*)\s*MAC\s*address', lambda m: m.group(1).replace(',', '')),
            (r'MAC\s*[:=]?\s*(\d+[,\d]*K?)', lambda m: m.group(1)),
        ],
        "IPv4 Routes": [
            (r'(\d+[,\d]*)\s*IPv4\s*route', lambda m: m.group(1).replace(',', '')),
            (r'IPv4\s*route[s]?\s*[:=]?\s*(\d+[,\d]*)', lambda m: m.group(1)),
        ],
        "Power Supply": [
            (r'power\s*supply\s*[:=]?\s*([^.\n]{3,30})', lambda m: m.group(1).strip()),
            (r'(FRU|fixed|internal)\s*(?:power|PSU)', lambda m: m.group(1).capitalize()),
        ],
        "Fans": [
            (r'fan[s]?\s*[:=]?\s*([^.\n]{3,30})', lambda m: m.group(1).strip()),
            (r'(fanless|redundant\s*fan|fixed\s*fan)', lambda m: m.group(1).capitalize()),
        ],
        "Uplinks": [
            (r'uplink[s]?\s*[:=]?\s*([^.\n]{3,40})', lambda m: m.group(1).strip()),
            (r'(modular|fixed)\s*uplink', lambda m: m.group(1).capitalize()),
        ],
        "MACsec": [
            (r'(AES-\d+)\s*MACsec', lambda m: m.group(1)),
            (r'MACsec\s*[:=]?\s*(AES-\d+|yes|no|supported)', lambda m: m.group(1)),
        ],
        "SD-Access": [
            (r'SD-Access\s*[:=]?\s*([^.\n]{3,30})', lambda m: m.group(1).strip()),
            (r'(full|limited|not\s*supported)\s*SD-Access', lambda m: m.group(1).capitalize()),
        ],
        "PoE": [
            (r'(PoE\+?|UPOE)\s*(?:support)?', lambda m: m.group(1)),
            (r'(\d+W)\s*PoE', lambda m: m.group(1)),
        ],
        "Form Factor": [
            (r'(compact|fanless|modular|fixed)', lambda m: m.group(1).capitalize()),
        ],
    }

    # For each product, search for feature values in context around product mentions
    for product_name in sorted(products_mentioned)[:5]:
        product_upper = product_name.upper()
        specs = {}

        # Find sections of content that mention this product
        # Look at 500 chars around each mention
        for match in re.finditer(re.escape(product_upper), all_content, re.IGNORECASE):
            start = max(0, match.start() - 200)
            end = min(len(all_content), match.end() + 300)
            context = all_content[start:end]

            # Extract features from this context
            for feature, patterns in feature_extractors.items():
                if feature in specs:
                    continue  # Already found this feature
                for pattern, extractor in patterns:
                    feat_match = re.search(pattern, context, re.IGNORECASE)
                    if feat_match:
                        try:
                            specs[feature] = extractor(feat_match)
                            break
                        except Exception:
                            pass

        # Add product if we found at least 2 specs
        if len(specs) >= 2:
            products.append({
                "name": product_upper,
                "specs": specs,
            })

    if len(products) < 2:
        return None

    # Use ordered key features, but only include ones we found
    found_features = set()
    for p in products:
        found_features.update(p["specs"].keys())

    # Order features by our priority list
    ordered_features = [f for f in key_features if f in found_features]
    # Add any features we found that aren't in our priority list
    ordered_features.extend(sorted(f for f in found_features if f not in key_features))

    return {
        "query": message,
        "products": products,
        "features": ordered_features,
    }


def count_tokens(text: str) -> int:
    """Count tokens using tiktoken (cl100k_base for Claude/GPT models).

    Args:
        text: The text to count tokens for

    Returns:
        Token count, or character-based estimate if tiktoken fails
    """
    try:
        encoder = tiktoken.get_encoding("cl100k_base")
        return len(encoder.encode(text))
    except Exception:
        # Fallback: rough estimate of 4 chars per token
        return len(text) // 4


def truncate_tool_result(result: Any, max_chars: int = 8000) -> str:
    """Truncate large tool results to prevent token overflow.

    For large results (device lists, log entries, etc.), we keep the first
    portion and add a truncation notice. This prevents a single API call
    from consuming 20-50K tokens.

    Args:
        result: The tool result (dict, list, or other)
        max_chars: Maximum characters to keep (default 8000 = ~2000 tokens)

    Returns:
        JSON string of the result, truncated if necessary
    """
    result_str = json.dumps(result, default=str)

    if len(result_str) <= max_chars:
        return result_str

    # For lists, try to keep a meaningful subset with count info
    if isinstance(result, list) and len(result) > 0:
        total_items = len(result)
        # Calculate how many items we can keep
        sample_item = json.dumps(result[0], default=str)
        items_to_keep = max(1, (max_chars - 100) // max(len(sample_item), 100))
        items_to_keep = min(items_to_keep, total_items)

        truncated_result = result[:items_to_keep]
        truncated_str = json.dumps(truncated_result, default=str)

        # Add truncation notice
        return f'{truncated_str[:-1]}, {{"_truncated": true, "_total_items": {total_items}, "_shown_items": {items_to_keep}}}]'

    # For other types, just truncate the string
    return result_str[:max_chars] + '\n... [result truncated, showing first 8000 chars]'


from src.services.tool_registry import get_tool_registry, AIProvider
from src.services.tool_selector import get_tool_selector, select_tools_for_query
from src.services.tool_cache import get_tool_cache
from src.services.tool_health_tracker import get_tool_health_tracker
from src.services.query_intent_detector import get_query_intent_detector, QueryIntent
from src.services.session_context_store import (
    get_session_context_store,
    SessionContext,
    OrgType,
    EntityType,
)
from src.services.knowledge_rag_service import (
    get_knowledge_rag_service,
    KnowledgeRAGService,
    Citation,
    CitedResponse,
    RAGResult,
    QueryIntent as RAGQueryIntent,
)
from src.config.settings import get_settings
from src.config.database import get_async_session
from src.services.credential_pool import CredentialPool, PlatformCredential

logger = logging.getLogger(__name__)


# ============================================================================
# Data Type Detection for Live Canvas Cards
# ============================================================================

# Map tool names to semantic data types for card labels and live updates
DATA_TYPE_MAP = {
    # Meraki VLANs
    "meraki_list_vlans": "vlans",
    "meraki_appliance_list_vlans": "vlans",
    "meraki_get_vlan": "vlans",
    # Meraki Firewall
    "meraki_get_l3_firewall_rules": "firewall_rules",
    "meraki_appliance_get_l3_firewall_rules": "firewall_rules",
    "meraki_get_l7_firewall_rules": "firewall_rules",
    # Meraki SSIDs
    "meraki_list_ssids": "ssids",
    "meraki_get_ssid": "ssids",
    "meraki_wireless_list_ssids": "ssids",
    "meraki_wireless_get_ssid": "ssids",
    # Meraki Devices - All variations
    "meraki_list_devices": "devices",
    "meraki_list_network_devices": "devices",
    "meraki_list_organization_devices": "devices",
    "meraki_get_device": "devices",
    "meraki_networks_list_devices": "devices",
    "meraki_organizations_list_devices": "devices",
    "meraki_organizations_get_devices_statuses": "devices",
    "meraki_organizations_get_devices_availabilities": "devices",
    "meraki_organizations_get_devices_uplinks_addresses": "devices",
    "meraki_organizations_get_inventory_devices": "devices",
    "meraki_devices_get": "devices",
    "meraki_devices_get_lldp_cdp": "devices",
    # Meraki Clients - All variations
    "meraki_get_network_clients": "clients",
    "meraki_list_network_clients": "clients",
    "meraki_networks_get_clients": "clients",
    "meraki_devices_get_clients": "clients",
    # Meraki Switch Ports
    "meraki_list_switch_ports": "switch_ports",
    "meraki_get_switch_port": "switch_ports",
    "meraki_switch_list_ports": "switch_ports",
    "meraki_switch_get_port": "switch_ports",
    # Meraki Alerts
    "meraki_get_network_alerts": "alerts",
    "meraki_networks_get_alerts": "alerts",
    "meraki_get_organization_alerts": "alerts",
    # Meraki Networks
    "meraki_networks_get_traffic": "traffic",
    "meraki_networks_get_events": "events",
    "meraki_list_networks": "networks",
    "meraki_list_organization_networks": "networks",
    "meraki_organizations_list_networks": "networks",
    # Meraki Routes and VPN
    "meraki_get_static_routes": "routes",
    "meraki_appliance_get_static_routes": "routes",
    "meraki_get_site_to_site_vpn": "vpn",
    "meraki_appliance_get_vpn_settings": "vpn",
    # Meraki Diagnostics and Live Tools
    "meraki_ping_device": "ping_results",
    "meraki_live_tools_ping": "ping_results",
    "meraki_live_tools_traceroute": "traceroute_results",
    "meraki_live_tools_arp": "arp_table",
    "meraki_live_tools_cable_test": "cable_test_results",
    "meraki_blink_device_leds": "action_results",
    "meraki_reboot_device": "action_results",
    # Meraki Uplinks
    "meraki_get_uplinks": "uplinks",
    "meraki_appliance_get_uplinks": "uplinks",
    "meraki_get_device_uplinks": "uplinks",
    # Catalyst Devices
    "catalyst_get_devices": "devices",
    "catalyst_list_devices": "devices",
    "catalyst_get_device_health": "health",
    "catalyst_get_network_health": "health",
    # ThousandEyes
    "thousandeyes_list_tests": "tests",
    "thousandeyes_get_test": "tests",
    "thousandeyes_list_alerts": "alerts",
    "thousandeyes_list_agents": "agents",
    "thousandeyes_get_test_results": "test_results",
    # Splunk
    "splunk_run_search": "search_results",
    "splunk_list_saved_searches": "saved_searches",
    "splunk_get_events": "events",
}

# ============================================================================
# Tool → SmartCard Type Mapping for Auto-Generated Canvas Cards
# ============================================================================
# Maps tool names to SmartCard types (from web-ui/src/app/chat-v2/cards/types.ts)
# When a tool returns successful data, we emit a card_suggestion event with this type

TOOL_CARD_MAPPING = {
    # Device Inventory & Status → Table card
    # NOTE: Only network-scoped tools generate auto-cards. Org-level tools (like
    # meraki_organizations_list_devices) return ALL devices across ALL networks,
    # which creates confusing cards during incident analysis.
    "meraki_get_device": "meraki_device_table",
    "meraki_list_devices": "meraki_device_table",
    "meraki_list_network_devices": "meraki_device_table",
    "meraki_networks_list_devices": "meraki_device_table",
    "meraki_devices_get": "meraki_device_table",
    # Org-level device tools excluded: meraki_list_organization_devices,
    # meraki_organizations_list_devices, meraki_organizations_get_devices_statuses,
    # meraki_organizations_get_inventory_devices

    # Network Health → Donut chart (org-level but shows summary, not confusing)
    "meraki_organizations_get_devices_availabilities": "meraki_network_health",

    # Clients → Top clients bar chart
    "meraki_get_network_clients": "meraki_top_clients",
    "meraki_list_network_clients": "meraki_top_clients",
    "meraki_networks_get_clients": "meraki_top_clients",
    "meraki_devices_get_clients": "meraki_top_clients",

    # Traffic & Bandwidth → Area chart
    "meraki_get_network_traffic": "meraki_bandwidth_usage",
    "meraki_networks_get_traffic": "meraki_bandwidth_usage",

    # WAN Uplinks → Status grid
    "meraki_get_uplinks": "meraki_uplink_status",
    "meraki_appliance_get_uplinks": "meraki_uplink_status",
    "meraki_get_device_uplinks": "meraki_uplink_status",
    # Org-level excluded: meraki_organizations_get_devices_uplinks_addresses

    # Latency & Loss → Multi-gauge
    "meraki_get_device_loss_latency": "meraki_latency_loss",

    # SSIDs → Client distribution donut
    "meraki_list_ssids": "meraki_ssid_clients",
    "meraki_get_ssid": "meraki_ssid_clients",
    "meraki_wireless_list_ssids": "meraki_ssid_clients",
    "meraki_wireless_get_ssid": "meraki_ssid_clients",

    # Switch Ports → Status grid
    "meraki_list_switch_ports": "meraki_switch_ports",
    "meraki_get_switch_port": "meraki_switch_ports",
    "meraki_switch_list_ports": "meraki_switch_ports",
    "meraki_switch_get_port": "meraki_switch_ports",

    # VPN → Status grid
    "meraki_get_site_to_site_vpn": "meraki_vpn_status",
    "meraki_appliance_get_vpn_settings": "meraki_vpn_status",

    # Alerts → Badge list
    "meraki_get_network_alerts": "meraki_alert_summary",
    "meraki_networks_get_alerts": "meraki_alert_summary",
    "meraki_get_organization_alerts": "meraki_alert_summary",

    # Events → Timeline/Security events
    "meraki_networks_get_events": "meraki_security_events",

    # Wireless Stats → Latency/connection metrics
    "meraki_wireless_get_connection_stats": "meraki_wireless_stats",
    "meraki_wireless_get_clients_connection_stats": "meraki_wireless_stats",
    "meraki_wireless_get_device_connection_stats": "meraki_wireless_stats",
    "meraki_wireless_get_failed_connections": "meraki_wireless_stats",
    "meraki_wireless_get_latency_stats": "meraki_latency_loss",
    "meraki_wireless_get_latency_history": "meraki_latency_loss",
    "meraki_wireless_get_client_latency_stats": "meraki_latency_loss",
    "meraki_wireless_get_channel_utilization": "meraki_rf_health",
    "meraki_wireless_get_device_channel_utilization": "meraki_rf_health",
    "meraki_wireless_get_signal_quality_history": "meraki_rf_health",
    "meraki_wireless_get_usage_history": "meraki_bandwidth_usage",
    "meraki_wireless_get_data_rate_history": "meraki_bandwidth_usage",
    "meraki_wireless_get_client_count_history": "meraki_client_count",
    "meraki_wireless_list_ssids": "meraki_ssid_clients",
    "meraki_wireless_get_ssid": "meraki_ssid_clients",
    "meraki_wireless_get_mesh_statuses": "meraki_device_table",
    "meraki_analyze_network_wireless": "meraki_rf_health",

    # ThousandEyes
    "thousandeyes_list_tests": "te_test_results",
    "thousandeyes_get_test": "te_test_results",
    "thousandeyes_get_test_results": "te_test_results",
    "thousandeyes_get_path_visualization": "te_path_visualization",
    "thousandeyes_list_alerts": "te_alert_summary",
    "thousandeyes_list_agents": "te_agent_health",

    # Meraki Appliance - Firewall & Security
    "meraki_appliance_get_l3_firewall_rules": "meraki_firewall_rules",
    "meraki_appliance_get_l7_firewall_rules": "meraki_firewall_rules",
    "meraki_appliance_get_inbound_firewall_rules": "meraki_firewall_rules",
    "meraki_appliance_get_cellular_firewall_rules": "meraki_firewall_rules",
    "meraki_appliance_get_security_events": "meraki_security_events",
    "meraki_appliance_get_org_security_events": "meraki_security_events",
    "meraki_appliance_get_security_intrusion": "meraki_security_events",
    "meraki_appliance_get_security_malware": "meraki_security_events",
    "meraki_appliance_get_content_filtering": "meraki_firewall_rules",

    # Meraki Appliance - VLANs
    "meraki_appliance_list_vlans": "meraki_vlan_list",
    "meraki_appliance_get_vlan": "meraki_vlan_list",
    "meraki_list_vlans": "meraki_vlan_list",

    # Meraki Appliance - VPN (reuse existing vpn_status)
    "meraki_appliance_get_vpn_statuses": "meraki_vpn_status",
    "meraki_appliance_get_vpn_stats": "meraki_vpn_status",
    "meraki_appliance_get_vpn_bgp": "meraki_vpn_status",
    "meraki_appliance_get_site_to_site_vpn": "meraki_vpn_status",

    # Meraki Appliance - Uplinks (reuse existing uplink_status)
    "meraki_appliance_get_uplink_statuses": "meraki_uplink_status",
    "meraki_appliance_get_uplinks_usage": "meraki_uplink_status",
    "meraki_appliance_list_ports": "meraki_switch_ports",
    "meraki_appliance_get_port": "meraki_switch_ports",

    # Meraki Appliance - Traffic & Performance
    "meraki_appliance_get_traffic_shaping": "meraki_bandwidth_usage",
    "meraki_appliance_get_traffic_shaping_rules": "meraki_bandwidth_usage",
    "meraki_appliance_get_performance": "meraki_latency_loss",

    # Splunk
    "splunk_run_search": "splunk_search_results",
    "splunk_get_events": "splunk_event_count",
    "splunk_search_run_splunk_query": "splunk_search_results",
    "splunk_get_search_results": "splunk_search_results",
    "splunk_run_saved_search": "splunk_search_results",
    "splunk_knowledge_get_saved_searches": "splunk_search_results",
    "splunk_knowledge_get_alerts": "splunk_event_count",

    # Catalyst
    "catalyst_get_devices": "catalyst_device_inventory",
    "catalyst_list_devices": "catalyst_device_inventory",
    "catalyst_get_device_health": "catalyst_site_health",
    "catalyst_get_network_health": "catalyst_site_health",
    "catalyst_get_client_health": "catalyst_client_health",
    "catalyst_get_client_detail": "catalyst_client_health",
    "catalyst_get_client_enrichment": "catalyst_client_health",
    "catalyst_get_issues": "catalyst_issue_summary",
    "catalyst_get_issue_enrichment": "catalyst_issue_summary",
    "catalyst_get_compliance_status": "catalyst_compliance",
    "catalyst_get_compliance_detail": "catalyst_compliance",
    "catalyst_get_interface_by_id": "catalyst_interfaces",
    "catalyst_get_interface_by_ip": "catalyst_interfaces",

    # ThousandEyes (additional)
    "thousandeyes_get_bgp_results": "te_test_results",
    "thousandeyes_get_http_results": "te_test_results",
}

# Card title templates based on card type
# These should match what the AI says it's adding and the frontend registry titles
CARD_TITLE_TEMPLATES = {
    "meraki_device_table": "Device Inventory",
    "meraki_network_health": "Network Health",
    "meraki_top_clients": "Top Clients",
    "meraki_bandwidth_usage": "Bandwidth Usage",
    "meraki_uplink_status": "Uplink Status",
    "meraki_latency_loss": "Latency & Packet Loss",
    "meraki_ssid_clients": "SSID Clients",
    "meraki_switch_ports": "Switch Ports",
    "meraki_vpn_status": "VPN Status",
    "meraki_alert_summary": "Alert Summary",
    "meraki_security_events": "Security Events",
    "meraki_wireless_stats": "Wireless Stats",
    "meraki_rf_health": "RF Health",
    "meraki_client_count": "Client Count",
    "te_test_results": "Test Results",
    "te_path_visualization": "Path Visualization",
    "te_alert_summary": "ThousandEyes Alerts",
    "te_agent_health": "Agent Health",
    "splunk_search_results": "Search Results",
    "splunk_event_count": "Event Count",
    "catalyst_device_inventory": "Catalyst Devices",
    "catalyst_site_health": "Site Health",
    "meraki_firewall_rules": "Firewall Rules",
    "meraki_vlan_list": "VLANs",
    "catalyst_client_health": "Client Health",
    "catalyst_issue_summary": "Network Issues",
    "catalyst_interfaces": "Interfaces",
}


def _transform_card_data(card_type: str, raw_data: Any, tool_name: str) -> Any:
    """Transform raw API data to the format expected by the card visualization.

    Each card type expects data in a specific shape. This function normalizes
    raw API responses to match those expected formats.

    Args:
        card_type: The target card type
        raw_data: Raw data from the tool result
        tool_name: Name of the tool (for context)

    Returns:
        Transformed data suitable for the card visualization
    """
    if raw_data is None:
        return None

    try:
        # Wireless connection stats → WirelessOverviewData format for wireless_overview viz
        if card_type == "meraki_wireless_stats":
            if isinstance(raw_data, dict):
                success = raw_data.get("success", 0)
                assoc = raw_data.get("assoc", 0)
                auth = raw_data.get("auth", 0)
                dhcp = raw_data.get("dhcp", 0)
                dns = raw_data.get("dns", 0)
                total = success + assoc + auth + dhcp + dns
                success_rate = round((success / total * 100) if total > 0 else 0, 1)
                failures = assoc + auth + dhcp + dns
                return {
                    "summary": [
                        {"status": "healthy", "label": "Success", "count": success},
                        {"status": "critical" if failures > 0 else "healthy", "label": "Failed", "count": failures},
                    ],
                    "metrics": [
                        {"label": "Success Rate", "value": f"{success_rate}%"},
                        {"label": "Auth Fail", "value": auth},
                        {"label": "DHCP Fail", "value": dhcp},
                        {"label": "DNS Fail", "value": dns},
                    ],
                }
            return raw_data

        # Latency stats → multi_gauge format
        if card_type == "meraki_latency_loss":
            if isinstance(raw_data, dict):
                # Extract latency values for different traffic types
                gauges = []
                for traffic_type in ["backgroundTraffic", "bestEffortTraffic", "videoTraffic", "voiceTraffic"]:
                    traffic_data = raw_data.get(traffic_type, {})
                    if isinstance(traffic_data, dict):
                        # Calculate average latency from distribution
                        avg_latency = traffic_data.get("avg", 0)
                        if not avg_latency:
                            # Try to calculate from distribution buckets
                            total_samples = 0
                            weighted_sum = 0
                            for bucket, count in traffic_data.items():
                                if bucket.isdigit() and isinstance(count, (int, float)):
                                    ms = int(bucket)
                                    total_samples += count
                                    weighted_sum += ms * count
                            avg_latency = round(weighted_sum / total_samples, 2) if total_samples > 0 else 0
                        label = traffic_type.replace("Traffic", "").title()
                        gauges.append({
                            "label": label,
                            "value": avg_latency,
                            "unit": "ms",
                        })
                return gauges if gauges else raw_data
            return raw_data

        # Client count → big_number format
        if card_type == "meraki_client_count":
            if isinstance(raw_data, list):
                # Client count history - get most recent count
                if len(raw_data) > 0:
                    latest = raw_data[-1] if isinstance(raw_data[-1], dict) else raw_data[0]
                    count = latest.get("clientCount", latest.get("count", len(raw_data)))
                    return {"value": count, "label": "Clients"}
                return {"value": len(raw_data), "label": "Clients"}
            elif isinstance(raw_data, dict):
                count = raw_data.get("clientCount", raw_data.get("count", raw_data.get("total", 0)))
                return {"value": count, "label": "Clients"}
            elif isinstance(raw_data, (int, float)):
                return {"value": int(raw_data), "label": "Clients"}
            return raw_data

        # Device table → ensure list format with required fields
        if card_type == "meraki_device_table":
            if isinstance(raw_data, list):
                return raw_data
            elif isinstance(raw_data, dict):
                return [raw_data]
            return raw_data

        # Top clients → TrafficAnalyticsViz format (TopClient[])
        if card_type == "meraki_top_clients":
            if isinstance(raw_data, list):
                # Transform to TopClient format expected by traffic_analytics viz
                clients = []
                for client in raw_data[:10]:  # Top 10
                    usage = client.get("usage", {})
                    if isinstance(usage, dict):
                        sent = usage.get("sent", 0) or 0
                        recv = usage.get("recv", usage.get("received", 0)) or 0
                        total = usage.get("total", sent + recv) or (sent + recv)
                    else:
                        sent = client.get("sent", 0) or 0
                        recv = client.get("recv", 0) or 0
                        total = sent + recv
                    clients.append({
                        "id": client.get("id") or client.get("mac") or str(len(clients)),
                        "name": client.get("description") or client.get("mac") or client.get("ip", "Unknown"),
                        "ip": client.get("ip"),
                        "mac": client.get("mac"),
                        "manufacturer": client.get("manufacturer") or client.get("os"),
                        "usage": {
                            "sent": sent,
                            "received": recv,
                            "total": total,
                        },
                    })
                return clients
            return raw_data

        # ThousandEyes path visualization → hops format for TEPathVisualizationViz
        if card_type == "te_path_visualization":
            if isinstance(raw_data, dict):
                # Extract hops from TE path-vis response formats:
                # v7 detailed: { results: [{ pathTraces: [{ hops: [...] }], agent }] }
                # v7 routes:   { results: [{ routes: [{ hops: [...] }] }] }
                # legacy:      { pathVis: [{ routes: [{ hops: [...] }] }] }
                hops = []
                results_list = raw_data.get("results") or raw_data.get("_embedded", {}).get("results") or []
                if isinstance(results_list, list):
                    # Find the longest trace across all agents
                    best_trace_hops = []
                    source_agent = None
                    for result in results_list:
                        agent_info = result.get("agent", {})
                        # Try pathTraces first (v7 detailed format)
                        for trace in (result.get("pathTraces") or []):
                            trace_hops = trace.get("hops") or []
                            if len(trace_hops) > len(best_trace_hops):
                                best_trace_hops = trace_hops
                                source_agent = agent_info.get("agentName")
                        # Fallback: routes format
                        if not best_trace_hops:
                            for route in (result.get("routes") or []):
                                route_hops = route.get("hops") or []
                                if len(route_hops) > len(best_trace_hops):
                                    best_trace_hops = route_hops
                                    source_agent = agent_info.get("agentName")

                    for idx, hop in enumerate(best_trace_hops):
                        hops.append({
                            "hopNumber": hop.get("hop", idx + 1),
                            "ipAddress": hop.get("ipAddress") or hop.get("ip") or hop.get("prefix") or "N/A",
                            "hostname": hop.get("rdns") or hop.get("hostname") or hop.get("prefix"),
                            "latency": float(hop.get("responseTime") or hop.get("delay") or hop.get("latency") or 0),
                            "loss": float(hop.get("loss") or 0),
                            "prefix": hop.get("prefix"),
                            "network": hop.get("network"),
                        })

                if hops:
                    result_data = {"hops": hops}
                    if source_agent:
                        result_data["source"] = source_agent
                    return result_data

                # If raw_data already has hops key, pass through
                if "hops" in raw_data:
                    return raw_data

            return raw_data

        # Alert summary → badge_list format {severity: count}
        if card_type == "meraki_alert_summary":
            if isinstance(raw_data, list):
                # Count alerts by severity
                severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
                for alert in raw_data:
                    if isinstance(alert, dict):
                        severity = str(alert.get("severity", alert.get("type", "info"))).lower()
                        # Normalize severity names
                        if severity in severity_counts:
                            severity_counts[severity] += 1
                        elif severity in ("warning", "warn"):
                            severity_counts["medium"] += 1
                        elif severity in ("error", "err"):
                            severity_counts["high"] += 1
                        else:
                            severity_counts["info"] += 1
                return severity_counts
            elif isinstance(raw_data, dict):
                # Already in {severity: count} format or close enough
                return raw_data
            return raw_data

        # Network health → aggregate device availabilities into {online, offline, alerting, dormant, total}
        if card_type == "meraki_network_health":
            if isinstance(raw_data, list):
                counts = {"online": 0, "offline": 0, "alerting": 0, "dormant": 0}
                for device in raw_data:
                    if isinstance(device, dict):
                        status = str(device.get("status", device.get("availability", ""))).lower()
                        if status in counts:
                            counts[status] += 1
                        elif status in ("active", "up", "reachable"):
                            counts["online"] += 1
                        elif status in ("down", "unreachable"):
                            counts["offline"] += 1
                        else:
                            counts["dormant"] += 1
                counts["total"] = sum(counts.values())
                return counts
            return raw_data

        # SSID clients → donut format [{ssid, clientCount}]
        if card_type == "meraki_ssid_clients":
            if isinstance(raw_data, list):
                segments = []
                for ssid in raw_data:
                    if isinstance(ssid, dict):
                        name = ssid.get("name") or ssid.get("ssid") or f"SSID {ssid.get('number', '?')}"
                        # clientCount may not exist in config responses — use 0 as fallback
                        count = ssid.get("clientCount", ssid.get("numClients", 0)) or 0
                        if ssid.get("enabled", True):  # Only show enabled SSIDs
                            segments.append({"ssid": name, "clientCount": count})
                return segments if segments else raw_data
            return raw_data

        # VPN status → status_grid format [{networkName, status, mode}]
        if card_type == "meraki_vpn_status":
            if isinstance(raw_data, dict):
                # Config response: {mode, hubs, subnets}
                mode = raw_data.get("mode", "unknown")
                hubs = raw_data.get("hubs", [])
                subnets = raw_data.get("subnets", [])
                items = []
                if hubs:
                    for hub in hubs:
                        items.append({
                            "networkName": hub.get("hubId", "Hub"),
                            "status": "active" if hub.get("useDefaultRoute", False) else "active",
                            "mode": mode,
                        })
                if not items:
                    items.append({"networkName": "VPN", "status": mode, "mode": mode})
                return items
            elif isinstance(raw_data, list):
                # Already a list of VPN peer statuses
                items = []
                for peer in raw_data:
                    if isinstance(peer, dict):
                        items.append({
                            "networkName": peer.get("networkName") or peer.get("peerName") or peer.get("networkId", "Peer"),
                            "status": peer.get("reachability") or peer.get("status", "unknown"),
                            "latencyMs": peer.get("latencyMs") or peer.get("meanLatencyMs"),
                            "mode": peer.get("vpnMode") or peer.get("mode", ""),
                        })
                return items if items else raw_data
            return raw_data

        # Uplink status → normalize to [{interface, status, ip, publicIp}]
        if card_type == "meraki_uplink_status":
            if isinstance(raw_data, list):
                items = []
                for item in raw_data:
                    if isinstance(item, dict):
                        # Org-level uplink response has nested uplinks array
                        uplinks = item.get("uplinks", [item])
                        for uplink in (uplinks if isinstance(uplinks, list) else [uplinks]):
                            if isinstance(uplink, dict):
                                items.append({
                                    "interface": uplink.get("interface") or uplink.get("wan") or uplink.get("connectionType", "unknown"),
                                    "status": uplink.get("status", "unknown"),
                                    "ip": uplink.get("ip") or uplink.get("publicIp"),
                                    "publicIp": uplink.get("publicIp"),
                                    "latencyMs": uplink.get("latencyMs"),
                                    "lossPercent": uplink.get("lossPercent"),
                                })
                return items if items else raw_data
            return raw_data

        # Bandwidth/traffic → normalize for area_chart (pass through lists, aggregate app data)
        if card_type == "meraki_bandwidth_usage":
            if isinstance(raw_data, list):
                # Meraki traffic API returns [{application, sent, recv, ...}]
                # Area chart needs timeseries but app data is aggregated — just pass through
                # The frontend area_chart component can handle both formats
                return raw_data
            return raw_data

        # RF health → multi_gauge format [{label, value, max, unit}]
        if card_type == "meraki_rf_health":
            if isinstance(raw_data, list):
                # Channel utilization data — aggregate into gauges
                total_util = 0
                total_wifi = 0
                total_non_wifi = 0
                count = 0
                for entry in raw_data:
                    if isinstance(entry, dict):
                        util = entry.get("utilization", entry.get("utilizationTotal"))
                        wifi = entry.get("wifi", entry.get("utilizationWifi", entry.get("utilization80211")))
                        non_wifi = entry.get("nonWifi", entry.get("utilizationNon80211"))
                        if util is not None:
                            total_util += float(util)
                            count += 1
                        if wifi is not None:
                            total_wifi += float(wifi)
                        if non_wifi is not None:
                            total_non_wifi += float(non_wifi)
                if count > 0:
                    return [
                        {"label": "Channel Utilization", "value": round(total_util / count, 1), "max": 100, "unit": "%"},
                        {"label": "WiFi Utilization", "value": round(total_wifi / count, 1), "max": 100, "unit": "%"},
                        {"label": "Non-WiFi", "value": round(total_non_wifi / count, 1), "max": 100, "unit": "%"},
                    ]
            elif isinstance(raw_data, dict):
                # Composite wireless analysis format from meraki_analyze_network_wireless
                if "wireless_devices" in raw_data or "channel_utilization" in raw_data:
                    gauges = []
                    devices = raw_data.get("wireless_devices", [])
                    chan_util = raw_data.get("channel_utilization")

                    # Channel utilization gauges
                    if chan_util and isinstance(chan_util, dict):
                        util_24 = chan_util.get("band_2_4_ghz_avg", 0)
                        util_5 = chan_util.get("band_5_ghz_avg", 0)
                        gauges.append({"label": "2.4 GHz Util", "value": util_24, "max": 100, "unit": "%"})
                        gauges.append({"label": "5 GHz Util", "value": util_5, "max": 100, "unit": "%"})
                    else:
                        gauges.append({"label": "2.4 GHz Util", "value": 0, "max": 100, "unit": "%"})
                        gauges.append({"label": "5 GHz Util", "value": 0, "max": 100, "unit": "%"})

                    # AP status gauge
                    if devices:
                        total_aps = len(devices)
                        online_aps = len([d for d in devices if d.get("status") == "online"])
                        gauges.append({"label": "APs Online", "value": online_aps, "max": total_aps, "unit": f"/{total_aps}"})
                    else:
                        gauges.append({"label": "APs", "value": 0, "max": 0, "unit": ""})

                    # SSIDs gauge
                    ssids = raw_data.get("ssids", [])
                    gauges.append({"label": "SSIDs Active", "value": len(ssids), "max": 15, "unit": ""})

                    return gauges

                # Signal quality / single-device stats
                gauges = []
                if "signalStrength" in raw_data or "snr" in raw_data:
                    if "signalStrength" in raw_data:
                        gauges.append({"label": "Signal Strength", "value": raw_data["signalStrength"], "max": 100, "unit": "dBm"})
                    if "snr" in raw_data:
                        gauges.append({"label": "SNR", "value": raw_data["snr"], "max": 50, "unit": "dB"})
                    if "channelUtilization" in raw_data:
                        gauges.append({"label": "Ch. Utilization", "value": raw_data["channelUtilization"], "max": 100, "unit": "%"})
                    return gauges if gauges else raw_data
            return raw_data

        # Firewall rules → unwrap {rules: [...]} to flat list for table
        if card_type == "meraki_firewall_rules":
            if isinstance(raw_data, dict):
                rules = raw_data.get("rules", raw_data.get("l3FirewallRules", raw_data.get("l7FirewallRules")))
                if isinstance(rules, list):
                    return rules
            elif isinstance(raw_data, list):
                return raw_data
            return raw_data

        # ThousandEyes alert summary → badge_list format {critical, major, minor, info}
        if card_type == "te_alert_summary":
            if isinstance(raw_data, list):
                counts = {"critical": 0, "major": 0, "minor": 0, "info": 0, "total": 0}
                for alert in raw_data:
                    if isinstance(alert, dict):
                        severity = str(alert.get("severity", alert.get("type", "info"))).lower()
                        if severity in counts:
                            counts[severity] += 1
                        elif severity in ("high", "error"):
                            counts["critical"] += 1
                        elif severity in ("medium", "warning"):
                            counts["major"] += 1
                        elif severity in ("low",):
                            counts["minor"] += 1
                        else:
                            counts["info"] += 1
                counts["total"] = sum(v for k, v in counts.items() if k != "total")
                return counts
            return raw_data

        # Catalyst issue summary → badge_list format {p1, p2, p3, p4, total}
        if card_type == "catalyst_issue_summary":
            if isinstance(raw_data, list):
                counts = {"p1": 0, "p2": 0, "p3": 0, "p4": 0, "total": 0}
                for issue in raw_data:
                    if isinstance(issue, dict):
                        priority = str(issue.get("priority", issue.get("severity", ""))).lower()
                        if priority in ("p1", "1", "critical"):
                            counts["p1"] += 1
                        elif priority in ("p2", "2", "high", "major"):
                            counts["p2"] += 1
                        elif priority in ("p3", "3", "medium", "warning"):
                            counts["p3"] += 1
                        else:
                            counts["p4"] += 1
                counts["total"] = counts["p1"] + counts["p2"] + counts["p3"] + counts["p4"]
                return counts
            return raw_data

        # Splunk event count → big_number format {value, label}
        if card_type == "splunk_event_count":
            if isinstance(raw_data, list):
                return {"value": len(raw_data), "label": "Events"}
            elif isinstance(raw_data, dict):
                count = raw_data.get("count", raw_data.get("total", raw_data.get("eventCount", 0)))
                return {"value": count, "label": "Events"}
            elif isinstance(raw_data, (int, float)):
                return {"value": int(raw_data), "label": "Events"}
            return raw_data

        # Security events → ensure list format with required fields
        if card_type == "meraki_security_events":
            if isinstance(raw_data, list):
                return raw_data  # Already list of events
            elif isinstance(raw_data, dict):
                # Could be a single event or wrapped
                events = raw_data.get("events", raw_data.get("results", [raw_data]))
                return events if isinstance(events, list) else [events]
            return raw_data

        # VLAN list → ensure list format
        if card_type == "meraki_vlan_list":
            if isinstance(raw_data, dict):
                # Unwrap if data is in a wrapper like {"vlans": [...]}
                vlans = raw_data.get("vlans", raw_data.get("results", raw_data.get("data", None)))
                if isinstance(vlans, list):
                    return vlans
                return [raw_data]
            return raw_data

        # TE test results → normalize to list of tests
        if card_type == "te_test_results":
            if isinstance(raw_data, dict):
                tests = raw_data.get("test", raw_data.get("tests", raw_data.get("results", None)))
                if isinstance(tests, list):
                    return tests
                if tests is not None:
                    return [tests]
                return [raw_data]
            return raw_data

        # Catalyst site health → extract healthScore to gauge format
        if card_type == "catalyst_site_health":
            if isinstance(raw_data, dict):
                health = raw_data.get("healthScore", raw_data.get("overallHealth", None))
                if health is not None:
                    score = health if isinstance(health, (int, float)) else 0
                    return {"value": score, "max": 100, "label": "Site Health", "unit": "%"}
                # Check for response wrapper
                response = raw_data.get("response", None)
                if isinstance(response, list) and len(response) > 0:
                    first = response[0]
                    if isinstance(first, dict):
                        score = first.get("healthScore", first.get("overallHealth", 0))
                        return {"value": score, "max": 100, "label": "Site Health", "unit": "%"}
            return raw_data

        # Catalyst device inventory → ensure list format
        if card_type == "catalyst_device_inventory":
            if isinstance(raw_data, dict):
                devices = raw_data.get("response", raw_data.get("devices", raw_data.get("results", None)))
                if isinstance(devices, list):
                    return devices
                return [raw_data]
            return raw_data

        # Default: return raw data unchanged
        return raw_data

    except Exception as e:
        logger.warning(f"[CardGen] Data transformation failed for {card_type}: {e}")
        return raw_data


def _generate_card_suggestion(
    tool_name: str,
    tool_result: Dict[str, Any],
    tool_call_id: str,
    network_id: Optional[str] = None,
    org_id: Optional[str] = None,
    network_name: Optional[str] = None,
    org_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Generate a SmartCard suggestion from a tool result.

    This enables automatic card generation when tools return cardable data,
    following the Static Generative UI pattern where tool results map to
    predefined card components.

    Args:
        tool_name: Name of the tool that produced the result
        tool_result: The tool's result dictionary (should have 'data' key)
        tool_call_id: Unique ID of the tool call
        network_id: Optional network ID for scope
        org_id: Optional organization ID for scope
        network_name: Optional network name for display
        org_name: Optional organization name for display

    Returns:
        Card suggestion dict or None if tool doesn't map to a card type
    """
    # Check if this tool maps to a card type
    card_type = TOOL_CARD_MAPPING.get(tool_name)
    if not card_type:
        return None

    # Get the data from the result
    raw_data = tool_result.get("data")
    if raw_data is None:
        return None

    # Transform raw API data to card-compatible format
    transformed_data = _transform_card_data(card_type, raw_data, tool_name)

    # Generate card title
    base_title = CARD_TITLE_TEMPLATES.get(card_type, tool_name.replace("_", " ").title())

    # Add network/org context to title if available
    title = base_title
    subtitle = None
    if network_name:
        subtitle = network_name
    elif org_name:
        subtitle = org_name

    # Build scope context
    scope = {}
    if org_id:
        scope["organizationId"] = org_id
    if org_name:
        scope["organizationName"] = org_name
    if network_id:
        scope["networkId"] = network_id
    if network_name:
        scope["networkName"] = network_name

    # Create the card suggestion
    # NOTE: subtitle must go in metadata (not top-level) for frontend to find it
    card_suggestion = {
        "type": card_type,
        "title": title,
        "data": transformed_data,
        "metadata": {
            "subtitle": subtitle,
            "toolCallId": tool_call_id,
            "toolName": tool_name,
            "scope": scope if scope else None,
        },
    }

    logger.info(f"[CardGen] Generated card suggestion: type={card_type}, title={title}")
    return card_suggestion


def _deduplicate_auto_cards(
    pending_cards: List[Dict[str, Any]],
    incident_network_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Deduplicate auto-cards, keeping only ONE card per type:network combination.

    When analyzing an incident, strongly prefer cards matching the incident network.
    This fixes the issue where cards for different networks are incorrectly deduplicated together.

    Args:
        pending_cards: List of pending card suggestions
        incident_network_id: If provided, prefer cards matching this network

    Returns:
        Deduplicated list with only one card per type:network combination
    """
    if not pending_cards:
        return []

    # Group cards by type AND network_id to prevent cross-network deduplication
    cards_by_key: Dict[str, List[Dict[str, Any]]] = {}
    for card in pending_cards:
        card_type = card.get("type", "unknown")
        # Extract network_id from metadata.scope
        network_id = None
        if card.get("metadata", {}).get("scope"):
            # Check both camelCase and snake_case variants
            network_id = (
                card["metadata"]["scope"].get("networkId") or
                card["metadata"]["scope"].get("network_id")
            )

        # Create unique key: card_type:network_id
        key = f"{card_type}:{network_id or 'global'}"
        if key not in cards_by_key:
            cards_by_key[key] = []
        cards_by_key[key].append(card)

    # Now deduplicate by card_type only, but prefer incident network
    cards_by_type: Dict[str, List[Dict[str, Any]]] = {}
    for key, cards in cards_by_key.items():
        card_type = key.split(":")[0]
        if card_type not in cards_by_type:
            cards_by_type[card_type] = []
        cards_by_type[card_type].extend(cards)

    deduped = []
    for card_type, cards in cards_by_type.items():
        if len(cards) == 1:
            deduped.append(cards[0])
        else:
            # Multiple cards of same type - prefer incident network if specified
            if incident_network_id:
                incident_card = None
                for card in cards:
                    scope = card.get("metadata", {}).get("scope", {})
                    network_id = scope.get("networkId") or scope.get("network_id")
                    if network_id == incident_network_id:
                        incident_card = card
                        break
                if incident_card:
                    deduped.append(incident_card)
                    logger.info(f"[CardGen] Dedup {card_type}: selected incident network card (network_id={incident_network_id}) over {len(cards)-1} others")
                    continue

            # Fallback: smallest data set (existing behavior)
            def get_data_size(card: Dict[str, Any]) -> int:
                data = card.get("data")
                if isinstance(data, list):
                    return len(data)
                elif isinstance(data, dict):
                    # For dicts, check common array fields
                    for key in ["items", "devices", "clients", "alerts", "rows"]:
                        if key in data and isinstance(data[key], list):
                            return len(data[key])
                    return 1
                return 0

            sorted_cards = sorted(cards, key=get_data_size)
            selected = sorted_cards[0]
            deduped.append(selected)
            logger.info(f"[CardGen] Dedup {card_type}: picked smallest ({get_data_size(selected)} items) over {[get_data_size(c) for c in cards]}")

    if len(deduped) < len(pending_cards):
        logger.info(f"[CardGen] Deduplicated auto-cards: {len(pending_cards)} -> {len(deduped)} (removed duplicates)")

    return deduped


def _detect_data_type(tool_name: str) -> str:
    """Map tool name to semantic data type for card labeling.

    Args:
        tool_name: The name of the tool (e.g., 'meraki_list_vlans')

    Returns:
        Data type string (e.g., 'vlans', 'firewall_rules', 'devices')
    """
    # Check exact match first
    if tool_name in DATA_TYPE_MAP:
        return DATA_TYPE_MAP[tool_name]

    # Pattern-based fallback for tools not in the map
    name_lower = tool_name.lower()
    if 'device' in name_lower:
        return 'devices'
    if 'client' in name_lower:
        return 'clients'
    if 'vlan' in name_lower:
        return 'vlans'
    if 'ssid' in name_lower:
        return 'ssids'
    if 'firewall' in name_lower or 'rule' in name_lower:
        return 'firewall_rules'
    if 'switch' in name_lower and 'port' in name_lower:
        return 'switch_ports'
    if 'alert' in name_lower:
        return 'alerts'
    if 'network' in name_lower:
        return 'networks'

    return 'data'


def _generate_live_topic(tool_name: str, tool_input: dict) -> Optional[str]:
    """Generate WebSocket topic for live card updates.

    Topics follow the format: {platform}:{data_type}:{identifier}
    Example: meraki:vlans:N_123456789012345678

    Args:
        tool_name: The name of the tool
        tool_input: The input parameters used for the tool call

    Returns:
        Topic string for WebSocket subscription, or None if not applicable
    """
    data_type = _detect_data_type(tool_name)

    # Skip generic "data" type - not useful for live updates
    if data_type == "data":
        return None

    if tool_name.startswith("meraki_"):
        # Network-scoped data (VLANs, SSIDs, firewall rules, switch ports)
        if network_id := tool_input.get("network_id"):
            return f"meraki:{data_type}:{network_id}"
        # Org-scoped data (devices, alerts)
        if org_id := tool_input.get("organization_id"):
            return f"meraki:{data_type}:{org_id}"
    elif tool_name.startswith("catalyst_"):
        if site_id := tool_input.get("site_id"):
            return f"catalyst:{data_type}:{site_id}"
    elif tool_name.startswith("thousandeyes_"):
        # ThousandEyes data is typically account-scoped
        return f"thousandeyes:{data_type}"
    elif tool_name.startswith("splunk_"):
        # Splunk searches are unique
        if search_id := tool_input.get("search_id"):
            return f"splunk:{data_type}:{search_id}"

    return None


@dataclass
class ChatResult:
    """Result from a chat interaction."""
    response: str
    tool_calls: List[Dict[str, Any]]
    token_usage: Dict[str, int]
    cost: float
    entities_discovered: int
    citations: List[Dict[str, Any]] = field(default_factory=list)
    knowledge_used: bool = False
    sources_markdown: str = ""
    tool_data: List[Dict[str, Any]] = field(default_factory=list)  # For canvas cards


class UnifiedChatService:
    """Provider-agnostic chat service with full tool support.

    This service replaces the fragmented A2A multi-agent system with a
    simpler single-model approach where one AI model maintains full
    conversation context and has access to all tools.

    Features (2024-2025 Best Practices):
    - Extended thinking mode for complex queries (improves accuracy)
    - Dynamic tool selection (85% token reduction)
    - Session context management
    - Multi-provider support
    """

    # Keywords indicating complex queries that benefit from extended thinking
    COMPLEX_QUERY_INDICATORS = [
        "compare", "analyze", "troubleshoot", "diagnose", "investigate",
        "why", "what's wrong", "what is wrong", "debug", "explain",
        "root cause", "correlate", "audit", "review", "assess",
        "difference between", "pros and cons", "trade-off", "trade off",
    ]

    def __init__(
        self,
        model: str,
        api_key: str,
        temperature: float = 0.7,
        max_tokens: int = 16384,
        enable_extended_thinking: bool = False,
        thinking_budget_tokens: int = 4000,
    ):
        """Initialize the unified chat service.

        Args:
            model: Model ID (e.g., "claude-sonnet-4-5-20250929", "gpt-4o")
            api_key: API key for the provider
            temperature: Response temperature (0.0-2.0)
            max_tokens: Maximum response tokens (16384 to accommodate adaptive thinking)
            enable_extended_thinking: Auto-enable extended thinking for complex queries
            thinking_budget_tokens: Token budget for legacy thinking (fallback only)
        """
        self.model = model
        self.api_key = api_key
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.provider = get_provider_from_model(model)
        self.tool_registry = get_tool_registry()
        self.settings = get_settings()
        self.enable_extended_thinking = enable_extended_thinking
        self.thinking_budget_tokens = thinking_budget_tokens  # Legacy fallback only
        self.api_keys = {}  # Initialize API keys dict for provider-specific keys
        self._total_tools_count = len(self.tool_registry.get_all())  # Cache tool count for logging

        # Adaptive thinking: uses type="adaptive" + effort parameter (Feb 2026 Anthropic API)
        # Enables interleaved thinking — Claude reasons between tool calls automatically.
        # Set ENABLE_ADAPTIVE_THINKING=false to fall back to legacy type="enabled" + budget_tokens.
        self.use_adaptive_thinking = os.getenv("ENABLE_ADAPTIVE_THINKING", "true").lower() == "true"

        # Initialize provider-specific clients
        self._init_client()

        logger.info(
            f"[UnifiedChat] Initialized with model={model}, provider={self.provider}, "
            f"tools={self._total_tools_count}, extended_thinking={enable_extended_thinking}, "
            f"adaptive_thinking={self.use_adaptive_thinking}"
        )

    def _get_thinking_effort(self, query: str, tool_count: int) -> Optional[str]:
        """Determine adaptive thinking effort level.

        Returns 'high', 'medium', or None (no thinking).
        With adaptive thinking (type="adaptive"), Claude automatically uses
        interleaved thinking — reasoning between every tool call.

        Args:
            query: The user's query
            tool_count: Number of tools being provided

        Returns:
            'high' for complex investigations, 'medium' for normal tool queries,
            None for simple queries or non-Anthropic providers.
        """
        if not self.enable_extended_thinking:
            return None

        # Skip extended thinking for incident queries (cost optimization)
        if is_incident_query(query):
            logger.debug("[UnifiedChat] Thinking: skipped for incident query")
            return None

        # Only works with Anthropic models
        if self.provider != "anthropic":
            return None

        # Only for capable models (opus, sonnet)
        model_lower = self.model.lower()
        if not any(m in model_lower for m in ["opus", "sonnet"]):
            return None

        query_lower = query.lower()

        # High effort: complex investigations, troubleshooting, multi-platform
        for indicator in self.COMPLEX_QUERY_INDICATORS:
            if indicator in query_lower:
                logger.debug(f"[UnifiedChat] Thinking effort=high: matched '{indicator}'")
                return "high"
        if tool_count > 20:
            logger.debug(f"[UnifiedChat] Thinking effort=high: high tool count ({tool_count})")
            return "high"

        # Explicit requests for careful analysis
        explicit_requests = ["think carefully", "think through", "step by step", "detailed analysis"]
        if any(req in query_lower for req in explicit_requests):
            logger.debug("[UnifiedChat] Thinking effort=high: explicit request")
            return "high"

        # Medium effort: normal queries with tools
        if tool_count > 5:
            logger.debug(f"[UnifiedChat] Thinking effort=medium: moderate tool count ({tool_count})")
            return "medium"

        return None  # Simple queries: no thinking needed

    def _init_client(self):
        """Initialize the appropriate provider client."""
        if self.provider == "anthropic":
            import httpx
            from src.config.settings import get_settings
            from src.services.config_service import get_config_or_env
            settings = get_settings()
            # Check database first (admin UI saves here), then fall back to settings/env
            db_verify = get_config_or_env("anthropic_verify_ssl", "ANTHROPIC_VERIFY_SSL")
            if db_verify is not None:
                verify_ssl = db_verify.lower() not in ("false", "0", "no", "disabled")
            else:
                verify_ssl = settings.anthropic_verify_ssl
            logger.info(f"[Anthropic] SSL verification: {verify_ssl}")
            # Use granular timeouts: connect=10s, read=300s (streaming can be slow),
            # write=30s, pool=10s. This prevents "Connection error." from httpx
            # when the default timeout is too aggressive for the connect phase.
            timeout = httpx.Timeout(
                connect=10.0,
                read=300.0,
                write=30.0,
                pool=10.0,
            )
            # Use instrumented transport for network timing capture
            try:
                from src.services.instrumented_httpx import InstrumentedAsyncTransport
                self._http_transport = InstrumentedAsyncTransport(verify=verify_ssl)
                async_http_client = httpx.AsyncClient(transport=self._http_transport, timeout=timeout)
            except Exception:
                self._http_transport = None
                async_http_client = httpx.AsyncClient(verify=verify_ssl, timeout=timeout)
            self.client = anthropic.AsyncAnthropic(api_key=self.api_key, http_client=async_http_client)
        elif self.provider == "openai":
            self.client = openai.AsyncOpenAI(api_key=self.api_key)
        elif self.provider == "google":
            # Google uses REST API directly
            self.client = None
        elif self.provider == "cisco":
            # Cisco Circuit uses REST API
            self.client = None

    async def _safe_extract_entities(
        self,
        context_store,
        session_id: str,
        tool_name: str,
        result: Dict[str, Any],
    ) -> None:
        """Safely extract entities from tool result with error handling.

        This wrapper ensures fire-and-forget entity extraction doesn't cause
        unhandled exceptions or resource leaks.
        """
        try:
            added = await context_store.extract_entities_from_result(
                session_id=session_id,
                tool_name=tool_name,
                result=result,
            )
            if added > 0:
                logger.debug(f"[UnifiedChat] Extracted {added} entities from {tool_name}")
        except Exception as e:
            # Log but don't propagate - entity extraction is non-critical
            logger.warning(f"[UnifiedChat] Entity extraction failed for {tool_name}: {e}")

    async def chat(
        self,
        message: str,
        conversation_history: List[Dict[str, Any]],
        credentials: Optional[Dict[str, str]] = None,
        session_id: str = "default",
        org_id: str = None,
        org_name: str = None,
        edit_mode: bool = False,
        max_tool_iterations: int = 10,
        credential_pool: Optional[CredentialPool] = None,
    ) -> ChatResult:
        """Process a chat message with any AI provider.

        This method:
        1. Builds system prompt with session context
        2. Gets tools in provider-specific format
        3. Calls provider API
        4. Handles tool calls in a loop
        5. Extracts entities from results
        6. Returns response with metadata

        Args:
            message: User message
            conversation_history: Previous messages in conversation
            credentials: API credentials for tools (deprecated, use credential_pool)
            session_id: Session ID for context persistence
            org_id: Organization ID (for Meraki, etc.)
            org_name: Organization display name
            edit_mode: Whether write operations are allowed
            max_tool_iterations: Maximum tool call iterations
            credential_pool: Dynamic credential pool for multi-platform resolution

        Returns:
            ChatResult with response and metadata
        """
        # Get session context
        context_store = get_session_context_store()
        session_ctx = await context_store.get_or_create(session_id)
        context_summary = await context_store.get_context_for_prompt(session_id)

        # Check if knowledge retrieval should be used
        # Skip RAG for incident queries (cost optimization - incident data is self-contained)
        rag_service = get_knowledge_rag_service()
        should_use_knowledge = False
        intent_classification = None

        if not is_incident_query(message):
            should_use_knowledge, intent_classification = await rag_service.should_use_knowledge(
                query=message,
                context={"org_id": org_id, "org_name": org_name},
            )
        else:
            logger.debug("[UnifiedChat] RAG skipped for incident query")

        # Retrieve knowledge context if applicable
        knowledge_context = ""
        citations: List[Citation] = []
        knowledge_used = False

        if should_use_knowledge:
            try:
                async with get_async_session() as db_session:
                    knowledge_context, citations, chunks, _rag_metrics = await rag_service.get_knowledge_context(
                        session=db_session,
                        query=message,
                        top_k=5,
                        max_context_tokens=3000,
                    )
                    if knowledge_context:
                        knowledge_used = True
                        logger.info(
                            f"[UnifiedChat] Retrieved {len(citations)} knowledge chunks "
                            f"for query (intent={intent_classification.intent.value})"
                        )
            except Exception as e:
                logger.warning(f"[UnifiedChat] Knowledge retrieval failed: {e}")

        # Build system prompt
        system_prompt = self._build_system_prompt(
            org_name=org_name or "Unknown",
            org_id=org_id or "",
            edit_mode=edit_mode,
            session_context=context_summary,
        )

        # Augment with knowledge context if available
        if knowledge_context:
            system_prompt = rag_service.build_rag_system_prompt(
                base_prompt=system_prompt,
                knowledge_context=knowledge_context,
                citations=citations,
            )

        # Select relevant tools dynamically (15-25 tools instead of 1000+)
        # Build credentials dict from pool for platform filtering
        # This ensures tool_selector knows which platforms have valid credentials
        tool_credentials = {}
        available_platforms = []
        if credential_pool:
            available_platforms = credential_pool.get_available_platforms()
            # Map platform availability to credential keys expected by tool_selector
            platform_to_key = {
                "meraki": "meraki_api_key",
                "catalyst": "catalyst_token",
                "thousandeyes": "thousandeyes_token",
                "splunk": "splunk_token",
            }
            for platform in available_platforms:
                if platform in platform_to_key:
                    tool_credentials[platform_to_key[platform]] = "configured"
            logger.info(f"[UnifiedChat] Platforms with credentials: {available_platforms}")

        org_context = {
            "org_id": org_id,
            "org_name": org_name,
            "edit_mode": edit_mode,
            "platforms": available_platforms,
            "has_catalyst": "catalyst" in available_platforms,
        }

        selected_tools = await select_tools_for_query(
            query=message,
            org_context=org_context,
            max_tools=25,
            credentials=tool_credentials,
        )

        # Convert to provider format
        provider_enum = AIProvider(self.provider)
        filtered_tools = [
            tool for tool in selected_tools
            if edit_mode or not tool.requires_write
        ]

        # Convert tools to provider-specific format
        if provider_enum == AIProvider.ANTHROPIC:
            tools = [tool.to_anthropic() for tool in filtered_tools]
        elif provider_enum == AIProvider.OPENAI:
            tools = [tool.to_openai() for tool in filtered_tools]
        elif provider_enum == AIProvider.GOOGLE:
            tools = [tool.to_google() for tool in filtered_tools]
        elif provider_enum == AIProvider.CISCO:
            tools = [tool.to_cisco() for tool in filtered_tools]
        else:
            tools = [tool.to_anthropic() for tool in filtered_tools]  # Default

        logger.info(
            f"[UnifiedChatService] Selected {len(tools)} tools for query "
            f"(from {self._total_tools_count} total)"
        )

        # Detect thinking effort level (adaptive thinking with interleaved reasoning)
        thinking_effort = self._get_thinking_effort(
            query=message,
            tool_count=len(tools),
        )
        use_extended_thinking = thinking_effort is not None
        if use_extended_thinking:
            logger.info(
                f"[UnifiedChat] Thinking enabled: effort={thinking_effort}, "
                f"adaptive={self.use_adaptive_thinking}, tools={len(tools)}"
            )

        # Build messages
        messages = self._build_messages(conversation_history, message)

        # Truncate messages to fit within token limit (prevents "prompt is too long" errors)
        messages = self._truncate_messages_by_tokens(
            messages,
            system_prompt,
            max_tokens=180000  # Leave 20K buffer for response + tools
        )

        # Track metrics
        total_input_tokens = 0
        total_output_tokens = 0
        total_thinking_tokens = 0
        tool_calls_made = []
        entities_discovered = 0

        # Tool execution loop
        for iteration in range(max_tool_iterations):
            # Call provider — adaptive thinking persists across all iterations
            # (interleaved thinking lets Claude reason between tool calls)
            response = await self._call_provider(
                system_prompt=system_prompt,
                messages=messages,
                tools=tools,
                use_extended_thinking=use_extended_thinking,
                thinking_effort=thinking_effort,
            )

            # Update token counts
            total_input_tokens += response.get("input_tokens", 0)
            total_output_tokens += response.get("output_tokens", 0)
            total_thinking_tokens += response.get("thinking_tokens", 0)

            # Check for tool calls
            tool_uses = response.get("tool_calls", [])

            if not tool_uses:
                # No more tool calls, we have the final response
                final_response = response.get("content", "")
                break

            # Execute tools in parallel with max 3 concurrent to prevent rate limiting
            MAX_CONCURRENT_TOOLS = 3
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_TOOLS)

            async def execute_with_limit(tool_call):
                """Execute a single tool with concurrency limit."""
                async with semaphore:
                    tool_name = tool_call.get("name")
                    tool_input = tool_call.get("input", {})
                    tool_id = tool_call.get("id")

                    logger.info(f"[UnifiedChat] Executing tool: {tool_name}")

                    result = await self._execute_tool(
                        tool_name=tool_name,
                        tool_input=tool_input,
                        credentials=credentials,
                        credential_pool=credential_pool,
                        org_id=org_id,
                        session_id=session_id,
                    )

                    return {
                        "id": tool_id,
                        "name": tool_name,
                        "input": tool_input,
                        "result": result,
                    }

            # Execute all tools in parallel (limited by semaphore)
            if len(tool_uses) > 1:
                logger.info(f"[UnifiedChat] Executing {len(tool_uses)} tools in parallel (max {MAX_CONCURRENT_TOOLS} concurrent)")

            results = await asyncio.gather(
                *[execute_with_limit(tc) for tc in tool_uses],
                return_exceptions=True,
            )

            tool_results = []
            for res in results:
                if isinstance(res, Exception):
                    # Handle execution errors gracefully
                    logger.error(f"[UnifiedChat] Tool execution error: {res}")
                    tool_results.append({
                        "id": "error",
                        "name": "unknown",
                        "result": {"success": False, "error": str(res)},
                    })
                else:
                    tool_calls_made.append({
                        "tool": res["name"],
                        "input": res["input"],
                        "result": res["result"],
                    })

                    tool_results.append({
                        "id": res["id"],
                        "name": res["name"],
                        "result": res["result"],
                    })

                    # Extract entities from result
                    if res["result"].get("success"):
                        try:
                            added = await context_store.extract_entities_from_result(
                                session_id=session_id,
                                tool_name=res["name"],
                                result=res["result"],
                            )
                            entities_discovered += added
                        except Exception as e:
                            logger.warning(f"Entity extraction failed: {e}")

            # Add tool results to messages and prune if too large
            messages = self._add_tool_results(messages, response, tool_results)
            messages = self._prune_messages(messages)

        else:
            # Hit max iterations
            final_response = "I've reached the maximum number of tool calls. Please try a more specific question."

        # Calculate cost
        input_cost, output_cost = get_model_costs(self.model)
        total_cost = (
            (total_input_tokens / 1000) * input_cost +
            (total_output_tokens / 1000) * output_cost
        )

        # Format citations for response
        citations_data = [
            {
                "index": c.index,
                "chunk_id": c.chunk_id,
                "document_id": c.document_id,
                "title": c.document_title,
                "section": c.section,
                "quote": c.quote,
                "relevance": c.relevance,
            }
            for c in citations
        ] if citations else []

        sources_markdown = ""
        if citations:
            sources_markdown = rag_service.citation_generator.format_sources_section(citations)

        # Collect tool data for canvas cards (similar to streaming flow)
        collected_tool_data = []
        logger.info(f"[Chat][DEBUG] tool_calls_made count: {len(tool_calls_made)}")
        for i, tc in enumerate(tool_calls_made):
            result = tc.get("result", {})
            tool_name = tc.get("tool", "unknown")
            has_success = result.get("success")
            has_data = result.get("data") is not None
            logger.info(f"[Chat][DEBUG] tool_calls_made[{i}]: tool={tool_name}, success={has_success}, has_data={has_data}")
            if has_success and has_data:
                result_data = result["data"]
                tool_name = tc.get("tool", "")
                tool_input = tc.get("input", {})

                # Extract network_id and org_id from input or result
                network_id = (
                    tool_input.get("network_id") or
                    tool_input.get("networkId") or
                    (result_data[0].get("networkId") if isinstance(result_data, list) and result_data else None)
                )
                org_id_from_tool = (
                    tool_input.get("organization_id") or
                    tool_input.get("organizationId") or
                    (result_data[0].get("organizationId") if isinstance(result_data, list) and result_data else None)
                )

                # Determine data type and live topic from tool name
                data_type = "generic"
                live_topic = None
                if "ssid" in tool_name.lower():
                    data_type = "ssids"
                elif "client" in tool_name.lower():
                    data_type = "clients"
                    live_topic = f"network:{network_id}:clients" if network_id else None
                elif "device" in tool_name.lower():
                    data_type = "devices"
                    live_topic = f"network:{network_id}:devices" if network_id else None
                elif "rf" in tool_name.lower() or "wireless" in tool_name.lower():
                    data_type = "rf_analysis"

                tool_data_item = {
                    "tool": tool_name,
                    "data": result_data,
                    "data_type": data_type,
                    "live_topic": live_topic,
                    "network_id": network_id,
                    "org_id": org_id_from_tool or org_id,
                }
                collected_tool_data.append(tool_data_item)
                logger.info(f"[Chat] Collected {tool_name} data for cards (network_id={network_id})")

        logger.info(f"[Chat][DEBUG] Final collected_tool_data count: {len(collected_tool_data)}")
        if collected_tool_data:
            logger.info(f"[Chat][DEBUG] collected_tool_data tools: {[td['tool'] for td in collected_tool_data]}")

        return ChatResult(
            response=final_response,
            tool_calls=tool_calls_made,
            token_usage={
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "thinking_tokens": total_thinking_tokens,
            },
            cost=total_cost,
            entities_discovered=entities_discovered,
            citations=citations_data,
            knowledge_used=knowledge_used,
            sources_markdown=sources_markdown,
            tool_data=collected_tool_data,
        )

    async def stream_chat(
        self,
        message: str,
        conversation_history: List[Dict[str, Any]],
        credentials: Optional[Dict[str, str]] = None,
        session_id: str = "default",
        org_id: str = None,
        org_name: str = None,
        network_id: str = None,
        network_name: str = None,
        edit_mode: bool = False,
        credential_pool: Optional[CredentialPool] = None,
        verbosity: str = "standard",  # "brief", "standard", "detailed"
        card_context: Optional[Dict[str, str]] = None,  # Context from "Ask about this" card feature
        user_id: Optional[int] = None,  # User ID for trace tracking
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream a chat response with tool support.

        Yields events in a consistent format:
        - {"type": "text_delta", "text": "..."}
        - {"type": "tool_use_start", "tool": "...", "id": "..."}
        - {"type": "tool_result", "tool": "...", "result": {...}}
        - {"type": "done", "usage": {...}}

        Args:
            message: User message
            conversation_history: Previous messages
            credentials: API credentials (deprecated, use credential_pool)
            session_id: Session ID
            org_id: Organization ID
            org_name: Organization name
            network_id: User's currently selected network ID (for card context)
            network_name: User's selected network name (for entity resolution)
            edit_mode: Whether write operations allowed
            credential_pool: Dynamic credential pool for multi-platform resolution
            card_context: Context from "Ask about this" card feature (networkId, deviceSerial, orgId)

        Yields:
            Event dictionaries
        """
        # Get session context
        context_store = get_session_context_store()

        # Run pre-flight bootstrap to auto-fetch platform data (orgs, networks, sites, etc.)
        # This runs BEFORE the AI responds so it has all the IDs it needs
        if credential_pool:
            try:
                from src.services.bootstrap_service import get_bootstrap_service
                bootstrap_service = get_bootstrap_service()
                bootstrap_data = await bootstrap_service.run_bootstrap(
                    credential_pool=credential_pool,
                    session_id=session_id,
                    force_refresh=False,  # Use cache if available
                )
                if bootstrap_data:
                    await context_store.update_bootstrap_context(session_id, bootstrap_data)
                    logger.info(f"[UnifiedChatService] Bootstrap complete: {list(bootstrap_data.keys())}")
            except Exception as e:
                logger.warning(f"[UnifiedChatService] Bootstrap failed (continuing): {e}")

        # Set current focus if user has selected a network
        # This enables enrich_tool_input to auto-fill network_id for tool calls
        # and adds the network to discovered_entities for name resolution
        if network_id:
            await context_store.set_current_focus(
                session_id=session_id,
                entity_type=EntityType.NETWORK,
                entity_id=network_id,
                display_name=network_name or network_id,  # Use name for entity resolution
            )
            logger.info(f"[UnifiedChatService] Set network focus: {network_name or network_id} ({network_id})")

            # Clear cardable cache if network focus changed (prevents cross-incident pollution)
            # This is important when analyzing different incidents in succession
            try:
                session_ctx = await context_store.get_or_create(session_id)
                last_network = session_ctx._last_incident_network_id
                if last_network and last_network != network_id:
                    session_ctx.clear_cardable_cache()
                    logger.info(f"[StreamChat] Network focus changed from {last_network} to {network_id}, cleared cardable cache")
                session_ctx._last_incident_network_id = network_id
            except Exception as cache_err:
                logger.warning(f"[StreamChat] Could not clear cache on network change: {cache_err}")

        # Get context summary (now includes bootstrap data)
        context_summary = await context_store.get_context_for_prompt(session_id)

        # Check if knowledge retrieval should be used
        # Skip RAG for incident queries (cost optimization - incident data is self-contained)
        rag_service = get_knowledge_rag_service()
        should_use_knowledge = False
        intent_classification = None

        if not is_incident_query(message):
            should_use_knowledge, intent_classification = await rag_service.should_use_knowledge(
                query=message,
                context={"org_id": org_id, "org_name": org_name},
            )
            logger.info(
                f"[StreamChat] Knowledge check: should_use={should_use_knowledge}, "
                f"intent={intent_classification.intent.value if intent_classification else 'None'}"
            )
        else:
            logger.debug("[StreamChat] RAG skipped for incident query")

        # Retrieve knowledge context if applicable
        knowledge_context = ""
        citations: List[Citation] = []
        knowledge_chunks = []
        rag_metrics = None

        if should_use_knowledge:
            # Emit agent activity start for RAG pipeline visualization
            yield {
                "type": "agent_activity_start",
                "agent": "knowledge",
                "agentId": "rag-pipeline",
                "agentName": "Knowledge RAG",
                "query": message[:100],
            }

            rag_start_time = asyncio.get_event_loop().time()
            try:
                async with get_async_session() as db_session:
                    knowledge_context, citations, knowledge_chunks, rag_metrics = await rag_service.get_knowledge_context(
                        session=db_session,
                        query=message,
                        top_k=5,
                        max_context_tokens=3000,
                    )
                    if knowledge_context:
                        logger.info(
                            f"[StreamChat] Retrieved {len(citations)} knowledge chunks "
                            f"(intent={intent_classification.intent.value})"
                        )

                # Emit agent activity complete
                rag_duration_ms = (asyncio.get_event_loop().time() - rag_start_time) * 1000
                yield {
                    "type": "agent_activity_complete",
                    "agent": "knowledge",
                    "agentId": "rag-pipeline",
                    "success": True,
                    "confidence": rag_metrics.get("confidence", 0.8) if rag_metrics else 0.8,
                    "sources_count": len(citations),
                    "response_summary": f"Found {len(citations)} relevant sources",
                    "duration_ms": round(rag_duration_ms),
                }
            except Exception as e:
                logger.warning(f"[StreamChat] Knowledge retrieval failed: {e}")
                # Emit failure event
                yield {
                    "type": "agent_activity_complete",
                    "agent": "knowledge",
                    "agentId": "rag-pipeline",
                    "success": False,
                    "error": str(e),
                }

        # Build system prompt
        system_prompt = self._build_system_prompt(
            org_name=org_name or "Unknown",
            org_id=org_id or "",
            network_id=network_id,
            edit_mode=edit_mode,
            session_context=context_summary,
            verbosity=verbosity,
            card_context=card_context,
        )

        # Augment with knowledge context if available
        knowledge_card_data = None
        is_comparison = is_comparison_query(message)
        if knowledge_context:
            system_prompt = rag_service.build_rag_system_prompt(
                base_prompt=system_prompt,
                knowledge_context=knowledge_context,
                citations=citations,
                query=message,  # Pass query for comparison detection
            )
            # DISABLED: Automatic knowledge card emission
            # The AI should use the canvas_add_card tool to add cards explicitly.
            # This prevents duplicate card suggestions and gives the AI control.
            # See: Issue 6 - Unified Card Suggestion Method
            #
            # if citations and len(citations) > 0:
            #     is_knowledge_focused = (...)
            #     avg_relevance = sum(c.relevance for c in citations) / len(citations)
            #     if is_knowledge_focused or avg_relevance > 0.75:
            #         knowledge_card_data = {...}
            pass  # Knowledge card suggestions now handled by canvas_add_card tool

        # Select relevant tools dynamically (15-25 tools instead of 1000+)
        org_context = {
            "org_id": org_id,
            "org_name": org_name,
            "edit_mode": edit_mode,
        }

        # Build credentials dict from pool for platform filtering
        # This ensures tool_selector knows which platforms have valid credentials
        tool_credentials = {}
        if credential_pool:
            available_platforms = credential_pool.get_available_platforms()
            # Map platform availability to credential keys expected by tool_selector
            platform_to_key = {
                "meraki": "meraki_api_key",
                "catalyst": "catalyst_token",
                "thousandeyes": "thousandeyes_token",
                "splunk": "splunk_token",
            }
            for platform in available_platforms:
                if platform in platform_to_key:
                    tool_credentials[platform_to_key[platform]] = "configured"
            logger.info(f"[StreamChat] Platforms with credentials: {available_platforms}")

        selected_tools = await select_tools_for_query(
            query=message,
            org_context=org_context,
            max_tools=25,
            credentials=tool_credentials,
        )

        # Convert to provider format
        provider_enum = AIProvider(self.provider)
        filtered_tools = [
            tool for tool in selected_tools
            if edit_mode or not tool.requires_write
        ]

        # Convert tools to provider-specific format
        if provider_enum == AIProvider.ANTHROPIC:
            tools = [tool.to_anthropic() for tool in filtered_tools]
        elif provider_enum == AIProvider.OPENAI:
            tools = [tool.to_openai() for tool in filtered_tools]
        elif provider_enum == AIProvider.GOOGLE:
            tools = [tool.to_google() for tool in filtered_tools]
        elif provider_enum == AIProvider.CISCO:
            tools = [tool.to_cisco() for tool in filtered_tools]
        else:
            tools = [tool.to_anthropic() for tool in filtered_tools]

        logger.info(
            f"[UnifiedChatService] Streaming: selected {len(tools)} tools "
            f"(from {self._total_tools_count} total)"
        )

        # Build messages
        messages = self._build_messages(conversation_history, message)

        # DISABLED: Automatic knowledge card emission - now handled by canvas_add_card tool
        # if knowledge_card_data:
        #     yield knowledge_card_data

        # Stream based on provider
        # DISABLED: Automatic comparison/product card parsing
        # The AI should use the canvas_add_card tool to add cards explicitly.
        # See: Issue 6 - Unified Card Suggestion Method
        if self.provider == "anthropic":
            async for event in self._stream_anthropic(
                system_prompt, messages, tools, credentials, org_id, session_id, credential_pool,
                user_id=user_id, query=message,
            ):
                yield event

        elif self.provider == "openai":
            async for event in self._stream_openai(
                system_prompt, messages, tools, credentials, org_id, session_id, credential_pool,
                user_id=user_id, query=message,
            ):
                yield event

        else:
            # Non-streaming fallback (Cisco Circuit, Google, etc.)
            # Start trace for this query
            trace_id = None
            root_span_id = None
            try:
                from src.services.ai_trace_collector import get_trace_collector, SYSTEM_SESSION_PREFIXES
                collector = get_trace_collector()
                trace_session_id = None
                _is_system_query = isinstance(session_id, str) and session_id.startswith(SYSTEM_SESSION_PREFIXES)
                try:
                    trace_session_id = int(session_id) if session_id and session_id != "default" else None
                except (ValueError, TypeError):
                    pass
                trace_id, root_span_id = await collector.start_trace(
                    session_id=trace_session_id, user_id=user_id, query=message or "",
                    provider=self.provider, model=self.model,
                    is_system=_is_system_query,
                )
                # Add LLM call span
                await collector.add_span(
                    trace_id=trace_id, span_type="llm_call",
                    parent_span_id=root_span_id, span_name=self.model,
                    model=self.model, provider=self.provider,
                )
            except Exception as trace_err:
                logger.warning(f"[Trace] Failed to start {self.provider} trace: {trace_err}")
                trace_id = None
                root_span_id = None

            result = await self.chat(
                message=message,
                conversation_history=conversation_history,
                credentials=credentials,
                session_id=session_id,
                org_id=org_id,
                org_name=org_name,
                edit_mode=edit_mode,
                credential_pool=credential_pool,
            )

            # Emit tool events for Agent Flow visualization
            # The chat() method already executed the tools, but we need to emit events
            # so the frontend can show tool activity in the Agent Flow
            tools_used = []
            platforms_used = set()

            # Check if any canvas tools were called - if so, skip auto-card generation
            canvas_tools_in_response = any(
                (tc.get("tool") or tc.get("name", "")).startswith("canvas_")
                for tc in result.tool_calls
            )
            if canvas_tools_in_response:
                logger.info(f"[CardGen] NonStreaming: Canvas tool detected - disabling auto-card generation")

            for tool_call in result.tool_calls:
                # Note: tool_calls_made uses "tool" key, not "name"
                tool_name = tool_call.get("tool") or tool_call.get("name", "unknown")
                tool_id = tool_call.get("id", f"call_{tool_name}")
                tool_result = tool_call.get("result", {})

                # Debug logging for canvas tool flow (critical for troubleshooting Cisco Circuit)
                if tool_name.startswith("canvas_"):
                    result_keys = list(tool_result.keys()) if isinstance(tool_result, dict) else "N/A"
                    has_card_suggestion = "card_suggestion" in tool_result if isinstance(tool_result, dict) else False
                    has_card_suggestions = "card_suggestions" in tool_result if isinstance(tool_result, dict) else False
                    logger.info(f"[Canvas][NonStreaming] Tool: {tool_name}, result_keys: {result_keys}, has_card_suggestion: {has_card_suggestion}, has_card_suggestions: {has_card_suggestions}")

                # Emit tool_use_start event
                yield {
                    "type": "tool_use_start",
                    "tool": tool_name,
                    "id": tool_id,
                }

                # Determine platform from tool name
                if tool_name.startswith("meraki_"):
                    platforms_used.add("meraki")
                elif tool_name.startswith("catalyst_"):
                    platforms_used.add("catalyst")
                elif tool_name.startswith("thousandeyes_"):
                    platforms_used.add("thousandeyes")
                elif tool_name.startswith("splunk_"):
                    platforms_used.add("splunk")

                tools_used.append(tool_name)

                # Emit tool_result event
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "id": tool_id,
                    "result": tool_result,
                }

                # Auto-generate card suggestion for non-canvas tools
                # SKIP if canvas tools are in this response (they handle their own cards)
                if not tool_name.startswith("canvas_") and not canvas_tools_in_response and isinstance(tool_result, dict):
                    has_success = tool_result.get("success", True)
                    has_data = tool_result.get("data") is not None
                    if has_success and has_data:
                        # Extract network_id and org_id from tool input or result
                        tool_input = tool_call.get("input", {})
                        network_id = tool_input.get("network_id") or tool_input.get("networkId")
                        org_id_val = tool_input.get("organization_id") or tool_input.get("organizationId")
                        if not network_id and isinstance(tool_result.get("data"), dict):
                            potential_id = tool_result["data"].get("networkId") or tool_result["data"].get("id")
                            if potential_id and isinstance(potential_id, str) and (potential_id.startswith("L_") or potential_id.startswith("N_")):
                                network_id = potential_id
                        card_suggestion = _generate_card_suggestion(
                            tool_name=tool_name,
                            tool_result=tool_result,
                            tool_call_id=tool_id,
                            network_id=network_id,
                            org_id=org_id_val,
                        )
                        if card_suggestion:
                            logger.info(f"[CardGen] NonStreaming: Emitting auto-generated card: type={card_suggestion.get('type')}")
                            yield {
                                "type": "card_suggestion",
                                "card": card_suggestion,
                            }
                # Handle canvas_ tools' card suggestions
                elif tool_name.startswith("canvas_") and isinstance(tool_result, dict) and tool_result.get("success"):
                    card_suggestion = tool_result.get("card_suggestion")
                    if card_suggestion:
                        yield {"type": "card_suggestion", "card": card_suggestion}
                    for card in tool_result.get("card_suggestions", []):
                        yield {"type": "card_suggestion", "card": card}

            if tools_used:
                logger.info(f"[NonStreaming] Emitted events for {len(tools_used)} tools, platforms: {platforms_used}")

            # Emit text response
            yield {"type": "text_delta", "text": result.response}

            # Include tool_data for canvas cards in done event
            done_event = {
                "type": "done",
                "usage": result.token_usage,
                "tools_used": tools_used,
                "platforms": list(platforms_used),
            }
            if result.tool_data:
                done_event["tool_data"] = result.tool_data
                logger.info(f"[NonStreaming] Including {len(result.tool_data)} tool_data items in done event")
            if trace_id:
                done_event["trace_id"] = str(trace_id)
            yield done_event

            # End trace
            if trace_id and root_span_id:
                try:
                    collector = get_trace_collector()
                    await collector.end_trace(
                        trace_id, root_span_id, status="success",
                        total_input_tokens=result.token_usage.get("input_tokens", 0),
                        total_output_tokens=result.token_usage.get("output_tokens", 0),
                        total_cost=result.cost,
                    )
                except Exception as trace_err:
                    logger.warning(f"[Trace] Failed to end {self.provider} trace: {trace_err}")

    def _build_system_prompt(
        self,
        org_name: str,
        org_id: str,
        edit_mode: bool,
        session_context: str = None,
        network_id: str = None,
        verbosity: str = "standard",
        card_context: Optional[Dict[str, str]] = None,
    ) -> str:
        """Build the system prompt with context."""
        mode_text = (
            "EDIT MODE ENABLED - you can create, update, and delete resources"
            if edit_mode else
            "READ-ONLY mode - you can only view and report on network status"
        )

        context_section = ""
        if session_context:
            context_section = f"""

## SESSION CONTEXT (PREVIOUSLY DISCOVERED)
The following entities were discovered during this conversation session.
USE THESE when the user references them by name or says "that network", "those devices", etc.

{session_context}

**IMPORTANT**: When the user references something from previous messages:
- "that network" / "the network" → Use the network from context above
- "those devices" / "the devices" → Use devices from context above
- "it" / "that" → Use the most recently mentioned entity from context above
You do NOT need to re-query for entities you already discovered!
"""

        # User's selected network context - critical for card creation
        network_context = ""
        if network_id:
            network_context = f"\n- User's selected network: {network_id} (use this for any card or query context)"

        # Card context from "Ask about this" feature - provides specific entity context
        card_context_section = ""
        if card_context:
            card_context_parts = []
            if card_context.get("networkId"):
                card_context_parts.append(f"Network ID: {card_context['networkId']}")
            if card_context.get("deviceSerial"):
                card_context_parts.append(f"Device Serial: {card_context['deviceSerial']}")
            if card_context.get("organizationId"):
                card_context_parts.append(f"Organization ID: {card_context['organizationId']}")
            if card_context_parts:
                card_context_section = f"""

## CARD CONTEXT (User is asking about a specific card)
The user clicked "Ask about this" on a canvas card. Use these identifiers for your queries:
{chr(10).join(f"- {part}" for part in card_context_parts)}

**IMPORTANT**: Use these specific IDs when fetching data. The user is asking about THIS specific network/device, not a general query.
"""

        return f"""You are an expert network operations assistant with access to {self._total_tools_count} tools for managing Cisco network infrastructure.

**CRITICAL - INCIDENT ANALYSIS SCOPE RULE**:
When the user message contains "incident", "Incident #", or references a specific network problem:
- ONLY query the network mentioned in the incident - NO OTHER networks
- Do NOT query "all devices", "all networks", or org-level data
- If the incident says "GRIEVES network", query ONLY the GRIEVES network
- IGNORE other networks in the Available Platform Data - they are NOT relevant to this incident
- This is MANDATORY - querying unrelated networks wastes resources and confuses the user

CURRENT CONTEXT:
- Organization: {org_name} (ID: {org_id}){network_context}
- System mode: {mode_text}
{context_section}{card_context_section}
AVAILABLE PLATFORMS:
1. **Cisco Meraki** - Cloud-managed networks (APs, switches, cameras, sensors, MX appliances)
2. **Cisco Catalyst Center** - Enterprise network management (sites, devices, health, assurance)
3. **ThousandEyes** - Network performance monitoring (tests, agents, alerts)
4. **Splunk** - Log analysis and security events
5. **Knowledge Base** - Documentation and semantic search

**TOOL USAGE GUIDELINES**:
1. **CHECK "AVAILABLE PLATFORM DATA" FIRST** - The session context above contains pre-fetched org IDs, network IDs, site IDs, etc.
   - DO NOT call `meraki_list_organizations` or `meraki_list_organization_networks` - this data is already provided
   - DO NOT call `catalyst_get_sites` - sites are already listed above
   - Use the IDs from the platform data directly in your tool calls
2. When the user mentions a network by name (e.g., "Demo Home"), find it in the AVAILABLE PLATFORM DATA section above
3. Only call list/discovery tools if the specific entity isn't in the pre-fetched data
4. ALWAYS use tools to get data - don't guess or make up information
5. When the user says "it", "that", "the device", etc. - refer to the SESSION CONTEXT above for entity IDs
6. If a tool fails, explain the error and suggest alternatives
7. **DEVICE LOOKUP**: When user references a device by model (MV21, MR46, MS250) or name instead of serial:
   - First use `meraki_list_network_devices` to find the device in the specified network
   - Match by model name or device name from the results
   - Then use the serial number for device-specific queries
   - NEVER ask the user for a serial number you can look up yourself
8. **TOOL SCOPE PREFERENCE**: When user specifies a network name (e.g., "devices on Demo Home"):
   - PREFER network-scoped tools like `meraki_list_network_devices` over org-scoped alternatives
   - Network-scoped tools are more efficient and return exactly what the user asked for
   - Only use org-scoped tools (meraki_organizations_*) when querying across ALL networks or orgs
9. **RESPONSE FORMATTING FOR CARDS**: When tools return data arrays (devices, VLANs, rules, etc.):
   - SUMMARIZE key findings in natural language (counts, highlights, notable issues)
   - DO NOT dump raw JSON, full data arrays, or verbose tool output in your response
   - The raw data is automatically available via canvas cards - users can explore details there
   - For STATUS queries: 2-4 sentences summarizing counts and notable issues
   - For INVESTIGATION queries: Full analysis with root cause, findings, and remediation (see ANALYSIS RESPONSE FORMAT)
   - Example GOOD: "Found 13 devices on Demo Home: 1 MX, 4 APs, 2 switches, 6 sensors. The MS-220 switch is running firmware 14.28 (latest is 15.21) — recommend scheduling an upgrade during maintenance window to patch CVE-2024-1234."
   - Example BAD: Pasting full device list with all properties, or just "I've added a device card."
10. **THINK TOOL**: For investigation queries, use `think` between tool calls to analyze results and plan next steps. It is free (no API cost). Use it after receiving data-gathering tool results.

**DATA INTEGRITY** (Critical):
- NEVER guess network IDs, device serials, or API values - use tool results only
- NEVER make up statistics, counts, or status information
- If you're unsure about a value, use a lookup tool to verify
- Tool results are ground truth - do not contradict them with assumptions

**SECURITY & PRIVACY** (Critical):
- NEVER display passwords, PSK keys, or pre-shared keys in plain text - redact as "****" or "[REDACTED]"
- NEVER show API keys, secrets, or tokens in responses
- For SSID/WiFi passwords: say "password protected" or "PSK configured" but NEVER reveal the actual password
- Treat any field named "psk", "passphrase", "password", "secret", "key", "token" as sensitive
- If user explicitly asks for a password, explain that it's redacted for security reasons

**DATA FRESHNESS FOR CANVAS** (MANDATORY - Follow strictly):
When the user asks to LIST, SHOW, GET, VIEW, CHECK, or asks about HEALTH, STATUS, or OVERVIEW of any of these:
- Devices, networks, VLANs, SSIDs, firewall rules, clients, ports, uplinks
- Network health, device health, RF analysis, channel utilization
- Any network configuration, status, or health data
YOU MUST CALL THE APPROPRIATE TOOL to fetch fresh data, EVEN IF you have this information
in conversation history. This is REQUIRED because:
1. Tool results enable the "Add to Canvas" feature that users expect
2. Users want current data, not stale responses from conversation memory
3. Network state changes - cached answers may be outdated

CRITICAL: For queries about "network health", "health overview", "device status", or similar:
- ALWAYS call meraki_networks_get or meraki_organizations_networks_list to get network info
- ALWAYS call meraki_networks_network_health_scores to get health data
- Do NOT rely on previous responses - fetch fresh data every time

CRITICAL: For Splunk log queries ("analyze logs", "show logs", "splunk", "log summary", "authentication issues"):
- ALWAYS call splunk_search_run_splunk_query or splunk_run_search to fetch REAL log data
- NEVER generate fake log data or sourcetypes - you MUST call the tool first
- Do NOT rely on previous responses - previous log summaries may be stale or incorrect
- If the tool returns an error, report the error - do NOT make up fake results

**SPLUNK SEARCH STRATEGIES** - Use these patterns for effective searches:

| User Intent | Recommended SPL Query Pattern |
|-------------|-------------------------------|
| General summary | `index=* sourcetype=meraki:* NOT sourcetype=meraki:sensorreadingshistory | stats count by type, category | sort -count` |
| Authentication/VPN | `sourcetype=meraki:securityappliances (type=*vpn* OR type=*auth*) | stats count by type, description` |
| Device-specific | `deviceSerial=<SERIAL> | stats count by type, category | sort -count` |
| Security events | `sourcetype=meraki:securityappliances category IN (ids_alerted, air_marshal, security_event) | stats count by type` |
| Config changes | `sourcetype=meraki:organization_audit_logs | table _time, adminEmail, action, targetType, targetName` |
| Connectivity | `sourcetype=meraki:securityappliances type IN (device_offline, failover, packet_loss, uplink_*) | stats count by type` |
| Errors only | `index=* (error OR failed OR failure OR critical) | stats count by sourcetype, type | sort -count` |
| Client issues | `sourcetype=meraki:* clientMac=* | stats count by type, clientMac` |
| Trends over time | `sourcetype=meraki:* | timechart span=1h count by type` |

**AVAILABLE SOURCETYPES (Meraki Environment)**:
- `meraki:securityappliances` - VPN events, DHCP, firewall, IDS alerts, connectivity
- `meraki:sensorreadingshistory` - Environmental sensor data (EXCLUDE unless specifically requested - high volume)
- `meraki:organization_audit_logs` - Admin configuration changes
- `meraki:wireless` - AP events, client roaming, wireless issues
- `meraki:switch` - Port events, STP, PoE, switch-specific logs

**SPLUNK EFFICIENCY RULES**:
1. NEVER use `index=* | head 100` alone - always add sourcetype or field filters
2. ALWAYS exclude sensor data unless user specifically asks: `NOT sourcetype=meraki:sensorreadingshistory`
3. Use `| stats count by` for summaries, `| table` for detailed output, `| timechart` for trends
4. When user mentions a device NAME, resolve to serial with meraki_devices_list FIRST, then query Splunk

**MERAKI-SPLUNK CORRELATION**:
When user asks about logs for a specific device/network by NAME:
1. First call meraki_devices_list or meraki_networks_list to get serial/networkId
2. Then use in Splunk: `deviceSerial=<SERIAL>` or `networkId=<NETWORK_ID>`

Example: "Show logs for Garage MX" → Get serial XXXX-XXXX-XXXX → Run `deviceSerial=XXXX-XXXX-XXXX | stats count by type`

<investigation_protocol>
INVESTIGATION PROTOCOL — For ANY troubleshooting, performance, or connectivity query:

Phase 1 — THINK: Use the `think` tool to scope the problem, form 2-3 hypotheses, and plan which platforms to query.

Phase 2 — INTERNAL HEALTH: Check Meraki/Catalyst for device status, uplink health, wireless stats, alerts, recent config changes.

Phase 3 — EXTERNAL MONITORING: Check ThousandEyes (do NOT skip even if user only mentioned Meraki):
- `thousandeyes_list_alerts` — Active outages or performance alerts
- `thousandeyes_list_tests` — Find tests monitoring the affected service/device/path
- `thousandeyes_get_test_results` — Latency, loss, jitter, HTTP response times
- `thousandeyes_get_path_visualization` — Trace network path to find where failures occur
- If no matching test exists, report this as a monitoring gap

Phase 4 — LOG CORRELATION: Check Splunk for related events around the incident timeframe. Correlate timestamps with findings from Phases 2-3.

Phase 5 — THINK: Use `think` to cross-reference timestamps across platforms, evaluate hypotheses against evidence from 2+ sources, and identify root cause.

Phase 6 — VISUALIZE: Add a dashboard using canvas_add_dashboard matching the query type:
- Connectivity/path questions → scenario='connectivity' (TE path + Meraki uplinks + latency)
- Device issues → scenario='incident'
- Performance issues → scenario='performance'
- If Splunk revealed something significant, add an ai-finding card with the correlation

Phase 7 — RESPOND: Deliver findings citing evidence from multiple platforms, specific metrics/timestamps, and concrete actions.
</investigation_protocol>

<thoroughness_requirements>
- Do NOT conclude after querying only one platform. Check at least 2 data sources before stating a root cause.
- If your first tool call reveals an anomaly, investigate further — do not immediately answer.
- After each round of tool results, use `think` to evaluate whether you have enough evidence.
- Report monitoring gaps: if no TE test covers the affected service, say so.
- Look for temporal correlations: a Meraki device-offline at 14:32 + a TE path alert at 14:31 + a Splunk VPN-down at 14:30 tells a story no single source reveals.
</thoroughness_requirements>

**DO NOT** search Splunk for ThousandEyes data unless the user explicitly asks for "ThousandEyes logs IN Splunk".

NEVER answer data queries from conversation history alone - ALWAYS call tools.

**HANDLING AMBIGUITY**:
- If multiple networks/devices match the user's description, ask for clarification with options
- If a tool returns no results, try expanding the timespan or scope before reporting "not found"
- When the user's request is unclear, ask clarifying questions rather than guessing
- If you need edit mode for a requested action, explain what's needed and ask permission

**RESPONSE GUIDELINES**:

Core Principles:
- Professional, direct, and actionable
- Data-driven with evidence from tool results
- Clear structure for scanability

Format by Query Type:
- STATUS/INFO queries (list devices, show VLANs): Lead with summary count/status, use tables, include IDs/serials
- ANALYSIS queries (troubleshoot, investigate): Use the ANALYSIS RESPONSE FORMAT below
- CONFIGURATION queries (create VLAN, update firewall): Confirm action, show proposed changes, list prerequisites, note risks

**ANALYSIS RESPONSE FORMAT** (MANDATORY for troubleshooting/investigation queries):
Provide thorough, evidence-based analysis. Cards visualize data; your text explains what it MEANS.
- Single-platform queries: 150-250 words
- Multi-platform investigations (2+ data sources): 300-500 words for cross-platform correlation

Required structure:

**Summary**: 1-2 sentences with key metrics and the core finding.

**Key Findings**: 2-4 bullet points with specific numbers, affected devices/services, and comparisons to expected baselines.

**Root Cause**: 2-3 sentences explaining WHY the issue is happening, citing evidence from the data. If uncertain, state what evidence points toward and what additional investigation is needed.

**Recommended Actions**: 3-5 numbered, specific remediation steps. For each step, briefly explain why it addresses the root cause.

EXAMPLE (good - thorough analysis):
"**Summary**: 90% WiFi success rate (below 95% target) with 738 disconnects in 24h, concentrated on a single AP.

**Key Findings**:
- 92% of failures are 'client inactive' timeouts on 'Corp-WiFi' SSID
- AP Q2KD-J5A6 accounts for 680 of 738 disconnects (92%)
- Only 3 WPA auth failures — authentication infrastructure is healthy
- Peak disconnect time: 2-4 PM daily (high-density usage period)

**Root Cause**: The idle timeout on 'Corp-WiFi' SSID is too aggressive (5 min), causing devices in power-save mode to be disconnected during peak hours. AP Q2KD-J5A6's disproportionate failure count suggests it also has a coverage gap forcing more client roaming.

**Recommended Actions**:
1. Increase idle timeout to 30 min on 'Corp-WiFi' SSID — prevents premature disconnections for idle clients
2. Check RF signal strength on AP Q2KD-J5A6 — may need repositioning or power adjustment
3. Review client power management policies — corporate devices may be entering sleep too aggressively
4. Monitor for 48h after changes to confirm improvement"

EXAMPLE (bad - no analysis):
"I've added WiFi monitoring cards to your canvas. These provide an overview of wireless performance."

DO NOT:
- List every query you ran or announce tool calls
- Repeat raw data from tool results (cards show the raw data)
- Add filler phrases ("Let me check...", "I found that...", "Let me walk through...")
- Give cards without analysis — always explain what the data means

Verbosity Level: {verbosity.upper()}
{self._get_verbosity_instructions(verbosity)}

Structure:
- Use headers (##) for major sections
- Tables for multi-item data (max 6 columns for readability)
- Numbered lists for sequential steps
- Bullet points for related items
- Code blocks for configs/commands

**TABLE FORMATTING BEST PRACTICES**:
- Maximum 6 columns - prioritize: Name, Status, Model, IP, Key Metric
- Include units in headers: "Traffic (Mbps)", "Uptime (hrs)", "Latency (ms)"
- Truncate long values (keep under 25 chars per cell)
- Sort by status (issues first) or relevance

**STATUS INDICATORS** (use for quick visual scanning):
- 🟢 **Healthy/Online/Active** - Operating normally
- 🟡 **Warning/Degraded** - Needs attention
- 🔴 **Critical/Offline/Error** - Action required
- ⚪ **Unknown/Pending** - Status unavailable

Example table:
| Device | Model | Status | Clients | Uptime (hrs) |
|--------|-------|--------|---------|--------------|
| AP-Lobby | MR46 | 🟢 Online | 23 | 720 |
| SW-Core | MS225 | 🟡 Alerting | - | 168 |

Avoid:
- Unnecessary preamble ("Sure!", "Great question!", "I'd be happy to...")
- Repeating the question back
- Excessive caveats or hedging
- Asking for information you can look up (serial numbers, network IDs, device names)
- Explaining your process or methodology unless explicitly asked

**FORBIDDEN PHRASES** (NEVER use these):
- "I need to request more tools"
- "Let me try a different approach/method"
- "That didn't work, let me try..."
- "I'm going to use the tool selector"
- "Let me call the API..."
- "I don't have access to..."
- "The previous attempt failed..."
- "I'll need to use another tool..."

**SEAMLESS EXPERIENCE** (CRITICAL - Follow strictly):
- Execute tools SILENTLY - don't narrate the tool-calling process to the user
- If a tool fails, try alternatives WITHOUT announcing the failure
- If you need more tools, use `request_more_tools` INVISIBLY - never mention it
- NEVER announce retries, fallbacks, or tool switches
- Present results as if you always knew exactly how to get them
- The response should read like expert analysis, NOT a debugging log
- "Seamless" means no process narration — it does NOT mean minimal analysis
- Your analysis text should be thorough: explain findings, root causes, and next steps

**CANVAS VISUALIZATION GUIDELINES** (Follow strictly):

TOOL SELECTION:
- `canvas_add_dashboard`: Use for INCIDENT ANALYSIS and MULTI-CARD scenarios (2-4 cards at once)
- `canvas_add_card`: Use for adding a SINGLE card

CARDS AND TEXT WORK TOGETHER:
- Cards visualize the DATA (metrics, device lists, timelines, charts)
- Text provides the ANALYSIS (root cause, impact, remediation, next steps)
- For any investigation or complex query: ALWAYS provide both cards AND detailed text analysis
- Cards should NEVER replace your analysis — they enhance it by giving users interactive data to explore
- TEXT ONLY when: simple factual answers, confirmations, or single-value lookups
- NEVER add a card if the same card type is already on the canvas

DASHBOARD SCENARIOS - Use canvas_add_dashboard based on query type:
- Device issues (offline/dormant) → scenario='incident'
- Performance issues (latency/loss) → scenario='performance'
- Wireless issues (RF/clients) → scenario='wireless'
- Security events → scenario='security'
- General/unknown → scenario='overview'
- CONNECTIVITY QUERIES (branch-to-hub, site-to-site, path analysis) → scenario='connectivity'
  This adds TE path visualization + TE test results + Meraki uplinks + latency/loss

CROSS-PLATFORM INVESTIGATION (CRITICAL for connectivity/performance queries):
When user asks about connectivity between sites, branch-to-hub paths, or end-to-end performance:
1. Use canvas_add_dashboard(scenario='connectivity') to show TE path + Meraki uplinks
2. Query ThousandEyes for path visualization and test results between the sites
3. Query Meraki for uplink status and latency/loss at both endpoints
4. If TE or Meraki reveal issues (high latency, packet loss, alerts), PROACTIVELY check Splunk for correlated log events around that timeframe
5. Add an ai-finding card summarizing cross-platform correlation if you discover something significant

CRITICAL - Network Focus for Incidents:
- ONLY query the specific network mentioned in the incident, not the entire org
- Pass network_id to canvas_add_dashboard so cards are scoped correctly

AUTO-GENERATED CARDS:
- When you call data-fetching tools (like meraki_list_devices, meraki_get_network_clients), the system automatically generates matching cards from the tool results
- You do NOT need to manually add cards for data you already fetched with tools
- Only use canvas_add_card when you want to add a MONITORING card (live data refresh) or an AI contextual card with custom data

AI CONTEXTUAL CARDS (IMPORTANT):
When you have data from tool calls, use AI contextual cards to visualize key findings:

- ai-metric: Single key value. card_data: {"label": "Uptime", "value": "99.7%", "unit": "%", "status": "good"}
- ai-stats-grid: 2-6 related metrics. card_data: {"stats": [{"label": "Online", "value": 12}, {"label": "Offline", "value": 2}, ...]} (colors auto-inferred from label text)
- ai-gauge: Percentage/progress. card_data: {"label": "CPU", "value": 78, "max": 100, "unit": "%"}
- ai-breakdown: Distribution/composition. card_data: {"title": "Device Types", "items": [{"label": "APs", "value": 8}, ...]}
- ai-finding: Issues/recommendations. card_data: {"severity": "warning", "title": "High Utilization", "description": "...", "recommendation": "..."}
- ai-device-summary: Device info. card_data: {"name": "AP-Lobby", "model": "MR46", "status": "online", "ip": "10.0.0.1", "serial": "Q2XX-XXXX-XXXX"}

ALWAYS include card_data when using AI contextual cards. Without card_data, the card will show empty.

CARD DATA FLOW:
- Live monitoring cards (meraki_*, te_*, splunk_*, catalyst_*): Frontend auto-fetches data. Just specify card_type and network_id/org_id.
- AI contextual cards (ai-*): YOU must provide data via card_data. No API endpoint exists.
- Knowledge cards: Provide data via card_data, citations, or products parameters.
- Auto-generated cards: Created automatically from tool results. Don't duplicate with canvas_add_card.

Card rules:
1. Maximum 1 card per follow-up query via canvas_add_card
2. Always include network_id when available
3. For live monitoring cards, don't pre-populate data - let the card fetch its own

Response format:
- Provide full analysis FIRST (findings, root cause, remediation), then mention cards at the end
- DO NOT include raw JSON blocks in your text response
- Cards are supplementary visualization — your text analysis is the primary value
- Example: "WiFi success rate is 84% with 48 failures concentrated on AP Q2KD. Root cause appears to be RF interference — the AP shows elevated noise floor on channel 6. I recommend switching to channel 11 and checking for co-channel interference from neighboring APs. I've added a WiFi performance card for ongoing monitoring."
"""

    def _get_verbosity_instructions(self, verbosity: str) -> str:
        """Get verbosity-specific instructions for system prompt."""
        instructions = {
            "brief": """- Maximum 5-8 sentences for simple queries
- Tables limited to 5 rows (note if more exist)
- Still include root cause and recommended actions, just concisely
- Focus on actionable findings with evidence""",
            "standard": """- Balanced detail level with thorough analysis
- Include root cause analysis, evidence, and recommended actions
- Full tables up to 15 rows
- Explain reasoning and cite specific data points from tool results""",
            "detailed": """- Comprehensive analysis
- Include all relevant data
- Explain methodology and reasoning
- Provide additional context and background
- Suggest related investigations""",
        }
        return instructions.get(verbosity, instructions["standard"])

    def _build_synthesis_instruction(self, tools_executed: list, iteration: int, is_final: bool) -> Optional[str]:
        """Build a synthesis instruction based on tool execution state.

        Returns a prompt injection to guide the model toward synthesizing
        cross-platform findings instead of continuing to call tools.
        """
        total = len(tools_executed)
        if total < 3:
            return None

        # Identify platforms from tool names
        platforms = set()
        for name in tools_executed:
            for prefix, plat in [
                ("meraki_", "Meraki"),
                ("catalyst_", "Catalyst"),
                ("thousandeyes_", "ThousandEyes"),
                ("splunk_", "Splunk"),
            ]:
                if name.startswith(prefix):
                    platforms.add(plat)
                    break

        platform_str = ", ".join(sorted(platforms)) if platforms else "multiple sources"

        if is_final:
            return (
                f"[SYNTHESIS REQUIRED] You executed {total} tools across {platform_str}. "
                "Respond NOW with: (1) Summary with key metric, (2) Root cause citing "
                "cross-platform evidence, (3) 2-3 actions. Do NOT call more tools."
            )

        if len(platforms) >= 2:
            return (
                f"[CROSS-PLATFORM SYNTHESIS] Data gathered from {platform_str} ({total} tools). "
                "Correlate findings: identify which data corroborates across platforms, "
                "distinguish root cause from symptoms, note temporal correlations. "
                "If enough evidence exists, respond with structured analysis."
            )

        if total >= 5:
            return (
                f"[SYNTHESIS GUIDANCE] {total} tools executed. Synthesize into: "
                "Summary (issue + key metric), Cause (with evidence), Action (1-3 steps)."
            )

        return None

    def _make_json_safe(self, obj: Any) -> Any:
        """Recursively convert non-JSON-serializable objects to strings.

        This handles Response objects and other types that can't be serialized.
        """
        if obj is None:
            return None
        if isinstance(obj, (str, int, float, bool)):
            return obj
        if isinstance(obj, dict):
            return {k: self._make_json_safe(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [self._make_json_safe(item) for item in obj]
        # Handle httpx.Response or similar objects
        if hasattr(obj, 'json'):
            try:
                return obj.json()
            except Exception:
                pass
        if hasattr(obj, 'text'):
            try:
                return obj.text
            except Exception:
                pass
        # Fallback: convert to string
        return str(obj)

    def _build_messages(
        self,
        history: List[Dict[str, Any]],
        new_message: str,
    ) -> List[Dict[str, Any]]:
        """Build messages list from history and new message."""
        messages = []

        # Add history (filter out system messages - Anthropic doesn't accept them in messages)
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            # Skip system messages - they should be passed via system parameter, not in messages
            if role == "system":
                continue
            messages.append({"role": role, "content": content})

        # Add new message
        messages.append({"role": "user", "content": new_message})

        return messages

    async def _call_provider(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        use_extended_thinking: bool = False,
        thinking_effort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Call the AI provider and return response.

        Args:
            system_prompt: System prompt for the model
            messages: Conversation messages
            tools: Tools in provider-specific format
            use_extended_thinking: Enable extended thinking (Anthropic only)
            thinking_effort: Effort level for adaptive thinking ('high', 'medium', or None)

        Returns:
            Response dict with content, tool_calls, and token usage
        """
        if self.provider == "anthropic":
            return await self._call_anthropic(
                system_prompt, messages, tools, use_extended_thinking, thinking_effort
            )
        elif self.provider == "openai":
            return await self._call_openai(system_prompt, messages, tools)
        elif self.provider == "google":
            return await self._call_google(system_prompt, messages, tools)
        elif self.provider == "cisco":
            return await self._call_cisco(system_prompt, messages, tools)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

    async def _call_anthropic(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        use_extended_thinking: bool = False,
        thinking_effort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Call Anthropic Claude API with optional adaptive/extended thinking.

        Supports two thinking modes:
        - Adaptive (default): type="adaptive" + effort parameter. Enables interleaved
          thinking — Claude reasons between tool calls automatically.
        - Legacy (fallback): type="enabled" + budget_tokens. Set ENABLE_ADAPTIVE_THINKING=false.

        Args:
            system_prompt: System instructions
            messages: Conversation messages
            tools: Tools in Anthropic format
            use_extended_thinking: Enable thinking mode
            thinking_effort: Effort level for adaptive thinking ('high', 'medium', or None)

        Returns:
            Response dict with content, tool_calls, and token usage
        """
        try:
            # Build request parameters with prompt caching enabled
            # Per Anthropic docs, cache_control enables 10-25% token savings
            # Cache persists for 5 minutes with ephemeral type
            params = {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "system": [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                "messages": messages,
                "tools": tools if tools else None,
            }

            # Thinking configuration: adaptive (interleaved) or legacy (budget-based)
            if use_extended_thinking:
                params["temperature"] = 1  # Required for all thinking modes
                if self.use_adaptive_thinking:
                    # Adaptive thinking (Feb 2026): automatic interleaved reasoning
                    # between tool calls. Effort controls depth: high for investigations,
                    # medium for normal queries.
                    params["thinking"] = {"type": "adaptive"}
                    if thinking_effort:
                        params["output_config"] = {"effort": thinking_effort}
                    logger.info(
                        f"[UnifiedChat] Adaptive thinking: effort={thinking_effort}"
                    )
                else:
                    # Legacy fallback (ENABLE_ADAPTIVE_THINKING=false)
                    params["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": self.thinking_budget_tokens,
                    }
                    logger.info(
                        f"[UnifiedChat] Legacy thinking: budget={self.thinking_budget_tokens}"
                    )
            else:
                params["temperature"] = self.temperature

            response = await self.client.messages.create(**params)

            # Parse response
            content = ""
            tool_calls = []
            thinking_content = ""

            for block in response.content:
                if block.type == "text":
                    content += block.text
                elif block.type == "tool_use":
                    tool_calls.append({
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })
                elif block.type == "thinking":
                    # Capture thinking for debugging (not returned to user)
                    thinking_content = getattr(block, "thinking", "")
                    logger.debug(f"[UnifiedChat] Thinking: {thinking_content[:200]}...")

            result = {
                "content": content,
                "tool_calls": tool_calls,
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
                "stop_reason": response.stop_reason,
            }

            # Include thinking token count if available
            if hasattr(response.usage, "thinking_tokens"):
                result["thinking_tokens"] = response.usage.thinking_tokens

            return result

        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return {"content": f"Error calling Claude: {e}", "tool_calls": []}

    async def _call_openai(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Call OpenAI GPT API."""
        try:
            # Prepend system message
            full_messages = [{"role": "system", "content": system_prompt}] + messages

            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                messages=full_messages,
                tools=tools if tools else None,
            )

            choice = response.choices[0]
            content = choice.message.content or ""
            tool_calls = []

            if choice.message.tool_calls:
                for tc in choice.message.tool_calls:
                    tool_calls.append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "input": json.loads(tc.function.arguments),
                    })

            return {
                "content": content,
                "tool_calls": tool_calls,
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            }

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return {"content": f"Error calling GPT: {e}", "tool_calls": []}

    async def _call_google(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Call Google Gemini API with tool support."""
        try:
            import google.generativeai as genai
            from google.generativeai.types import (
                FunctionDeclaration,
                Tool as GeminiTool,
                GenerationConfig,
            )
            from src.services.config_service import get_config_or_env

            # Configure API - database first, then user keys, then settings
            settings = get_settings()
            google_api_key = (
                self.api_keys.get("google") or
                get_config_or_env("google_api_key", "GOOGLE_API_KEY") or
                settings.google_api_key
            )
            if not google_api_key:
                return {
                    "content": "Google API key not configured. Please set GOOGLE_API_KEY.",
                    "tool_calls": [],
                    "input_tokens": 0,
                    "output_tokens": 0,
                }

            genai.configure(api_key=google_api_key)

            # Convert tools to Gemini format
            function_declarations = []
            for tool in tools:
                parameters = tool.get("parameters", tool.get("input_schema", {})).copy()
                if "type" not in parameters:
                    parameters["type"] = "object"

                func_decl = FunctionDeclaration(
                    name=tool["name"],
                    description=tool.get("description", ""),
                    parameters=parameters,
                )
                function_declarations.append(func_decl)

            gemini_tools = [GeminiTool(function_declarations=function_declarations)] if function_declarations else None

            # Create model
            model = genai.GenerativeModel(
                model_name=self.model,
                tools=gemini_tools,
                system_instruction=system_prompt,
                generation_config=GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens,
                ),
            )

            # Build conversation history
            history = []
            for msg in messages[:-1]:  # All but last message
                role = "user" if msg.get("role") == "user" else "model"
                content = msg.get("content", "")
                if isinstance(content, str):
                    history.append({"role": role, "parts": [content]})

            # Start chat and send message
            chat = model.start_chat(history=history)
            last_message = messages[-1].get("content", "") if messages else ""
            response = chat.send_message(last_message)

            # Parse response
            content = ""
            tool_calls = []

            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    content += part.text
                elif hasattr(part, "function_call") and part.function_call:
                    tool_calls.append({
                        "id": f"call_{part.function_call.name}_{len(tool_calls)}",
                        "name": part.function_call.name,
                        "input": dict(part.function_call.args),
                    })

            # Get token counts
            input_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) if hasattr(response, "usage_metadata") else 0
            output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) if hasattr(response, "usage_metadata") else 0

            return {
                "content": content,
                "tool_calls": tool_calls,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            }

        except ImportError:
            return {
                "content": "Google Generative AI library not installed. Run: pip install google-generativeai",
                "tool_calls": [],
                "input_tokens": 0,
                "output_tokens": 0,
            }
        except Exception as e:
            logger.error(f"Google Gemini API error: {e}")
            return {
                "content": f"Google Gemini error: {str(e)}",
                "tool_calls": [],
                "input_tokens": 0,
                "output_tokens": 0,
            }

    async def _call_cisco(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Call Cisco Circuit API with ReAct-style tool support.

        Cisco Circuit uses GPT-4 via Cisco's internal API. Tools are presented
        in ReAct format (Thought/Action/Action Input) since the API may not
        return structured tool_calls.
        """
        try:
            from src.services.cisco_ai_service import (
                parse_react_response,
                format_tools_for_react,
                CiscoCircuitAIService,
            )

            # Check for credentials - database first, then user keys, then settings
            from src.services.config_service import get_config_or_env
            settings = get_settings()
            client_id = (
                self.api_keys.get("cisco_client_id") or
                get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID") or
                settings.cisco_circuit_client_id
            )
            client_secret = (
                self.api_keys.get("cisco_client_secret") or
                get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET") or
                settings.cisco_circuit_client_secret
            )
            app_key = (
                get_config_or_env("cisco_circuit_app_key", "CISCO_CIRCUIT_APP_KEY") or
                settings.cisco_circuit_app_key
            )

            if not client_id or not client_secret or not app_key:
                return {
                    "content": "Cisco Circuit credentials not configured. Please set CISCO_CIRCUIT_CLIENT_ID, CISCO_CIRCUIT_CLIENT_SECRET, and CISCO_CIRCUIT_APP_KEY.",
                    "tool_calls": [],
                    "input_tokens": 0,
                    "output_tokens": 0,
                }

            # Format tools for ReAct prompt
            # Tools passed to this function are already in string format for Cisco
            if tools and isinstance(tools[0], str):
                tool_definitions = "\n".join(tools)
            else:
                tool_definitions = format_tools_for_react(tools)

            # Build ReAct system prompt
            react_prompt = f"""{system_prompt}

## Tool Usage Instructions

You have access to the following tools to help answer user questions:

{tool_definitions}

**CRITICAL: When the user asks for live data (networks, devices, status, etc.), you MUST use a tool.**

When you need to use a tool, respond with EXACTLY this format:
```
Thought: [Your reasoning about what information is needed]
Action: [exact_tool_name]
Action Input: {{"param1": "value1", "param2": "value2"}}
```

After I provide the Observation with the tool result, continue reasoning.

## Visualization Cards (Auto-Generated)

Visualization cards are AUTOMATICALLY created when tool calls return data. You do NOT need to manually call canvas_add_dashboard or canvas_add_card in most cases — the system handles this for you.

Only use `canvas_add_dashboard` if the user explicitly asks for a dashboard layout, or if you want a specific multi-card arrangement for a cross-platform investigation.

When you have gathered all the information, provide your final response:
```
Thought: I now have all the information needed.
Final Answer: [Your detailed analysis response - see format below]
```

## Final Answer Format Requirements

Your Final Answer MUST include detailed analysis, NOT just descriptions of what cards were added:

1. **Summary**: Start with a brief summary including key metrics (e.g., "84% connection success rate with 48 failures")

2. **Key Findings**: List specific insights from the data with actual numbers:
   - Connection/performance statistics
   - Problem areas or devices identified
   - Comparison to normal/expected values

3. **Root Cause Analysis**: If there are issues, explain likely causes based on the data patterns

4. **Recommended Actions**: Provide actionable next steps the user can take

5. **Cards Added**: Briefly mention what monitoring cards were added (1-2 sentences max)

**BAD Example (DO NOT DO THIS):**
"I've added WiFi monitoring cards to your canvas. These provide an overview of wireless performance."

**GOOD Example:**
"## WiFi Analysis - Network Name

**Summary**: 84% connection success rate (243/291 attempts) with 48 failures in 24 hours.

**Key Findings**:
- Association failures dominate (96% of failures)
- Problem client: a4:77:33:7e:b5:ac with 22 failures
- Most affected AP: Q2KD-J5A6-65XE (38 of 48 failures)

**Root Cause**: RF interference or weak signal on specific AP.

**Recommended Actions**:
1. Check signal strength on AP Q2KD-J5A6-65XE
2. Review band steering settings

I've added 3 monitoring cards for real-time visibility."

**RULES:**
- ALWAYS use tools when asked about networks, devices, clients, status, or any live data
- NEVER make up data - use tools to fetch real information
- Output valid JSON for Action Input (use double quotes for strings)
- Only call ONE tool at a time, wait for the Observation before continuing
- ALWAYS analyze the data thoroughly in your Final Answer - don't just describe cards
- The workflow is: 1) Fetch data with tools → 2) Analyze results → 3) Final Answer with analysis
- Visualization cards are auto-generated from tool results — no need to manually add them
"""

            # Create Cisco service instance
            cisco_service = CiscoCircuitAIService(
                client_id=client_id,
                client_secret=client_secret,
                app_key=app_key,
                model=self.model.replace("cisco-", "") if self.model.startswith("cisco-") else "gpt-4.1",
            )

            # Get access token
            access_token = await cisco_service._get_access_token()
            chat_url = cisco_service._get_chat_url()

            # Build OpenAI-compatible messages
            api_messages = [{"role": "system", "content": react_prompt}]
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if isinstance(content, str):
                    api_messages.append({"role": role, "content": content})
                elif isinstance(content, list):
                    # Handle structured content
                    text_parts = [p.get("text", "") for p in content if p.get("type") == "text"]
                    api_messages.append({"role": role, "content": "".join(text_parts)})

            # Call Cisco API (OpenAI-compatible format)
            async with httpx.AsyncClient(timeout=60.0, verify=get_settings().cisco_circuit_verify_ssl) as client:
                payload = {
                    "messages": api_messages,
                    "user": json.dumps({"appkey": app_key}),  # Required for Cisco Circuit
                    "temperature": self.temperature,
                    "max_tokens": self.max_tokens,
                }

                response = await client.post(
                    chat_url,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": access_token,
                    },
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

            # Parse response
            assistant_content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            # Parse for ReAct-style tool calls
            react_result = parse_react_response(assistant_content)

            tool_calls = []
            content = assistant_content

            if react_result.get("has_action") and react_result.get("action"):
                # Check for parse errors and log them
                if react_result.get("parse_error"):
                    logger.warning(f"[Cisco ReAct] JSON parse error for {react_result['action']}: {react_result['parse_error']}")
                    # If we recovered some parameters via fallback, continue
                    # Otherwise log what we're working with
                    action_input = react_result.get("action_input", {})
                    if not action_input:
                        logger.warning(f"[Cisco ReAct] No parameters recovered for {react_result['action']} - tool may fail")
                    else:
                        logger.info(f"[Cisco ReAct] Recovered parameters via fallback: {list(action_input.keys())}")

                # Model wants to use a tool
                tool_calls.append({
                    "id": f"react_{react_result['action']}",
                    "name": react_result["action"],
                    "input": react_result.get("action_input", {}),
                })
                content = react_result.get("thought", "")
            elif react_result.get("final_answer"):
                content = react_result["final_answer"]

            # Get token counts
            usage = data.get("usage", {})
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)

            return {
                "content": content,
                "tool_calls": tool_calls,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            }

        except ImportError as e:
            logger.error(f"Cisco AI service import error: {e}")
            return {
                "content": "Cisco Circuit service not available.",
                "tool_calls": [],
                "input_tokens": 0,
                "output_tokens": 0,
            }
        except Exception as e:
            logger.error(f"Cisco Circuit API error: {e}")
            return {
                "content": f"Cisco Circuit error: {str(e)}",
                "tool_calls": [],
                "input_tokens": 0,
                "output_tokens": 0,
            }

    def _add_tool_results(
        self,
        messages: List[Dict[str, Any]],
        assistant_response: Dict[str, Any],
        tool_results: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Add tool results to messages for next turn."""
        if self.provider == "anthropic":
            # Add assistant message with tool use
            assistant_content = []
            if assistant_response.get("content"):
                assistant_content.append({
                    "type": "text",
                    "text": assistant_response["content"],
                })
            for tc in assistant_response.get("tool_calls", []):
                assistant_content.append({
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": tc["input"],
                })

            messages.append({
                "role": "assistant",
                "content": assistant_content,
            })

            # Add tool results
            user_content = []
            for result in tool_results:
                user_content.append({
                    "type": "tool_result",
                    "tool_use_id": result["id"],
                    "content": truncate_tool_result(result["result"]),
                })

            messages.append({
                "role": "user",
                "content": user_content,
            })

        elif self.provider == "openai":
            # Add assistant message
            messages.append({
                "role": "assistant",
                "content": assistant_response.get("content"),
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["input"]),
                        }
                    }
                    for tc in assistant_response.get("tool_calls", [])
                ],
            })

            # Add tool results
            for result in tool_results:
                messages.append({
                    "role": "tool",
                    "tool_call_id": result["id"],
                    "content": truncate_tool_result(result["result"]),
                })

        elif self.provider == "cisco":
            # Cisco Circuit uses ReAct-style prompting with Observation format
            # Add assistant message with the thought/action
            # Note: Use `or ""` because .get() returns None if key exists but value is None
            assistant_content = assistant_response.get("content") or ""
            for tc in assistant_response.get("tool_calls", []):
                # Reconstruct the ReAct format the model produced
                assistant_content += f"\nAction: {tc['name']}\nAction Input: {json.dumps(tc['input'])}"

            messages.append({
                "role": "assistant",
                "content": assistant_content,
            })

            # Add tool results as Observation in user message
            observation_parts = []
            for result in tool_results:
                result_str = truncate_tool_result(result["result"])
                observation_parts.append(f"Observation for {result['name']}:\n```json\n{result_str}\n```")

            messages.append({
                "role": "user",
                "content": "\n\n".join(observation_parts) + "\n\nNow continue with your reasoning. If you have all the information needed, provide your Final Answer with DETAILED ANALYSIS of the data - include specific numbers, identify issues/patterns, and give actionable recommendations. Do NOT just describe what cards were added.",
            })

        return messages

    def _prune_messages(
        self,
        messages: List[Dict[str, Any]],
        max_messages: int = 50,
    ) -> List[Dict[str, Any]]:
        """Prune message history to prevent unbounded growth.

        This prevents hitting token limits during multi-tool conversations.
        Keeps the most recent messages while preserving conversation flow.

        Args:
            messages: Current message list
            max_messages: Maximum messages to retain (default 50)

        Returns:
            Pruned message list
        """
        if len(messages) <= max_messages:
            return messages

        # Calculate how many to remove (keep some buffer)
        excess = len(messages) - max_messages

        # Keep first message (usually the system context) and recent messages
        # Remove oldest messages in the middle
        pruned = messages[:1] + messages[1 + excess:]

        logger.debug(
            f"[UnifiedChat] Pruned {excess} old messages "
            f"({len(messages)} -> {len(pruned)})"
        )

        return pruned

    def _truncate_messages_by_tokens(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        max_tokens: int = 180000,
    ) -> List[Dict[str, Any]]:
        """Truncate conversation messages to fit within token limit.

        This prevents the "prompt is too long" error by intelligently
        removing older messages while preserving context.

        Strategy:
        1. Count system prompt tokens (always included)
        2. Always keep first message (often important context)
        3. Always keep last 5 messages (recent conversation)
        4. Remove middle messages as needed to fit within limit

        Args:
            messages: Conversation messages to truncate
            system_prompt: System prompt (counted but not modified)
            max_tokens: Maximum token budget (default 180K, leaves 20K buffer)

        Returns:
            Truncated message list that fits within token budget
        """
        if len(messages) <= 6:
            return messages

        # Count system prompt tokens
        system_tokens = count_tokens(system_prompt)
        available = max_tokens - system_tokens - 5000  # Buffer for tools

        # Count tokens for all messages
        message_tokens = []
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, list):
                # Handle multi-part content (tool results, images, etc.)
                content = " ".join([
                    c.get("text", str(c)) if isinstance(c, dict) else str(c)
                    for c in content
                ])
            message_tokens.append((msg, count_tokens(str(content))))

        total_tokens = sum(t for _, t in message_tokens)

        # If within budget, return as-is
        if total_tokens <= available:
            return messages

        # Need to truncate: keep first and last 5 messages
        result = [message_tokens[0][0]]  # First message
        last_5 = [m for m, _ in message_tokens[-5:]]

        # Calculate remaining budget for middle messages
        first_tokens = message_tokens[0][1]
        last_5_tokens = sum(t for _, t in message_tokens[-5:])
        remaining = available - first_tokens - last_5_tokens

        # Add middle messages until budget exhausted
        added_truncation_notice = False
        for msg, tokens in message_tokens[1:-5]:
            if tokens <= remaining:
                result.append(msg)
                remaining -= tokens
            elif not added_truncation_notice:
                # Add notice that history was truncated
                result.append({
                    "role": "user",
                    "content": "[Earlier conversation history truncated to fit context limit]"
                })
                added_truncation_notice = True

        # Add the last 5 messages
        result.extend(last_5)

        original_count = len(messages)
        new_count = len(result)
        logger.info(
            f"[Context] Truncated {original_count} messages to {new_count} "
            f"(~{total_tokens} -> ~{total_tokens - (original_count - new_count) * 500} tokens)"
        )

        return result

    async def _execute_tool(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        org_id: str = None,
        session_id: str = "default",
        credential_pool: Optional[CredentialPool] = None,
        require_approval: bool = True,
        user_id: str = "unknown",
    ) -> Dict[str, Any]:
        """Execute a tool and return the result.

        This method:
        1. Gets the tool from registry
        2. For write operations with require_approval=True, creates a pending action
        3. Resolves credentials dynamically based on platform and context
        4. Creates execution context with credentials
        5. Enriches input with session context
        6. Executes the tool handler
        7. Returns the result

        Args:
            tool_name: Name of tool to execute
            tool_input: Input parameters
            credentials: API credentials (deprecated, use credential_pool)
            org_id: Organization ID (for backward compatibility)
            session_id: Session ID for context
            credential_pool: Dynamic credential pool for multi-platform resolution
            require_approval: If True, write operations create pending actions
            user_id: User ID for audit tracking

        Returns:
            Tool execution result, or pending action info for write operations
        """
        tool = self.tool_registry.get(tool_name)
        if not tool:
            return {"success": False, "error": f"Tool '{tool_name}' not found"}

        if not tool.handler:
            return {"success": False, "error": f"Tool '{tool_name}' has no handler"}

        # Think tool: zero-cost reasoning checkpoint, no credentials needed
        if tool_name == "think":
            return {"success": True, "thought": tool_input.get("thought", "")}

        # For write operations, check if edit mode is enabled
        if tool.requires_write:
            try:
                from src.services.security_service import SecurityConfigService
                security_service = SecurityConfigService()
                edit_mode_enabled = await security_service.is_edit_mode_enabled()

                if not edit_mode_enabled:
                    logger.warning(
                        f"[Tool] Blocked write operation '{tool_name}' - edit mode is disabled"
                    )
                    return {
                        "success": False,
                        "blocked": True,
                        "error": "Edit mode is disabled. The AI is currently in read-only mode and cannot make changes to your network configuration. "
                                 "Enable edit mode in Settings to allow the AI to make changes (with your approval).",
                        "tool_name": tool_name,
                    }
            except Exception as e:
                logger.error(f"Failed to check edit mode: {e}")
                # Default to blocking write operations if we can't check edit mode
                return {
                    "success": False,
                    "blocked": True,
                    "error": "Unable to verify edit mode status. Write operations are blocked for safety.",
                    "tool_name": tool_name,
                }

        # For write operations with edit mode enabled, create a pending action instead of executing directly
        if tool.requires_write and require_approval:
            try:
                from src.api.routes.pending_actions import create_pending_action

                # Generate a description of what this action will do
                description = self._generate_action_description(tool_name, tool_input)

                # Determine risk level based on tool type
                risk_level = self._assess_risk_level(tool_name, tool_input)

                # Create pending action
                action = await create_pending_action(
                    session_id=session_id,
                    user_id=user_id,
                    tool_name=tool_name,
                    tool_input=tool_input,
                    description=description,
                    organization_id=org_id,
                    network_id=tool_input.get("network_id") or tool_input.get("networkId"),
                    device_serial=tool_input.get("serial"),
                    risk_level=risk_level,
                    impact_summary=f"This action will modify network configuration via {tool_name}",
                    reversible=True,
                    expires_in_minutes=30,
                )

                logger.info(
                    f"[Tool] Created pending action {action.id} for write tool '{tool_name}' "
                    f"(session={session_id}, user={user_id})"
                )

                return {
                    "success": True,
                    "pending_approval": True,
                    "action_id": str(action.id),
                    "message": f"This action requires your approval before it can be executed. "
                               f"Please review and approve the '{tool_name}' action in the pending actions panel.",
                    "description": description,
                    "risk_level": risk_level,
                    "tool_name": tool_name,
                    "tool_input": tool_input,
                }
            except Exception as e:
                logger.error(f"Failed to create pending action: {e}")
                # Fall through to execute directly if pending action creation fails
                pass

        # Enrich input with context
        context_store = get_session_context_store()
        try:
            tool_input = await context_store.enrich_tool_input(
                session_id, tool_name, tool_input
            )
        except Exception as e:
            logger.warning(f"Context enrichment failed: {e}")

        # Check cache for non-write operations
        cache = get_tool_cache()
        if not tool.requires_write:
            cached_result = await cache.get(tool_name, tool_input)
            if cached_result:
                logger.info(f"[Tool] Cache HIT for {tool_name}")
                return cached_result

        # Resolve credentials dynamically using credential pool (preferred)
        # or fall back to legacy credentials dict
        resolved_creds = credentials or {}
        resolved_org_id = org_id or ""

        if credential_pool:
            # Extract context from tool input for resolution
            input_org_id = tool_input.get("organization_id") or tool_input.get("organizationId")
            input_org_name = tool_input.get("organization_name") or tool_input.get("organizationName")
            input_network_id = tool_input.get("network_id") or tool_input.get("networkId")
            input_serial = tool_input.get("serial")
            input_base_url = tool_input.get("base_url")
            input_site_id = tool_input.get("site_id") or tool_input.get("siteId")

            # Resolve credentials for this tool's platform
            platform_cred = credential_pool.get_for_platform(
                platform=tool.platform,
                organization_id=input_org_id,
                organization_name=input_org_name,
                network_id=input_network_id,
                serial=input_serial,
                base_url=input_base_url,
                site_id=input_site_id,
            )

            if platform_cred:
                resolved_creds = platform_cred.credentials
                # For Meraki, use resolved org_id if available
                if platform_cred.org_ids:
                    resolved_org_id = platform_cred.org_ids[0]
                logger.debug(
                    f"[Tool] Resolved {tool.platform} credentials from cluster '{platform_cred.cluster_name}'"
                )
            elif tool.platform in ("canvas", "knowledge"):
                # Canvas and knowledge tools don't need external credentials
                logger.debug(f"[Tool] {tool.platform} tool doesn't require credentials, skipping credential check")
                pass
            elif not credentials:
                # No credential pool match and no legacy credentials
                return {
                    "success": False,
                    "error": f"No credentials available for {tool.platform} platform"
                }

        # Create execution context based on platform
        try:
            if tool.platform == "meraki":
                api_key = resolved_creds.get("meraki_api_key") or resolved_creds.get("api_key", "")

                # Validate API key before making requests
                if not api_key:
                    logger.error(f"[Tool] No Meraki API key found in resolved_creds. Keys present: {list(resolved_creds.keys())}")
                    return {"success": False, "error": "No Meraki API key configured for this cluster"}

                logger.debug(f"[Tool] Using Meraki API key: [REDACTED] for {tool_name}")

                from src.services.tools.meraki import MerakiExecutionContext
                context = MerakiExecutionContext(
                    api_key=api_key,
                    org_id=resolved_org_id,
                )
            elif tool.platform == "catalyst":
                from src.services.tools.catalyst import CatalystExecutionContext
                context = CatalystExecutionContext(
                    username=resolved_creds.get("catalyst_username"),
                    password=resolved_creds.get("catalyst_password"),
                    base_url=resolved_creds.get("catalyst_base_url"),
                    api_token=resolved_creds.get("catalyst_token"),
                )
            elif tool.platform == "thousandeyes":
                from src.services.tools.thousandeyes import ThousandEyesExecutionContext
                context = ThousandEyesExecutionContext(
                    oauth_token=resolved_creds.get("thousandeyes_token", ""),
                )
            elif tool.platform == "splunk":
                from src.services.tools.splunk import SplunkExecutionContext, SplunkMCPExecutionContext
                # Splunk credentials: "token" is bearer token for search API,
                # "splunk_token" is HEC token for event ingestion (different purpose)
                splunk_token = (
                    resolved_creds.get("token") or  # Bearer token for search API (preferred)
                    resolved_creds.get("api_key") or
                    resolved_creds.get("splunk_token")  # HEC token (fallback only)
                )
                splunk_base_url = (
                    resolved_creds.get("splunk_base_url") or
                    resolved_creds.get("base_url")
                )
                logger.debug(f"[Tool] Splunk context: base_url={splunk_base_url}, token={'set' if splunk_token else 'MISSING'}")
                # Always create direct REST context as fallback
                rest_context = SplunkExecutionContext(
                    username=resolved_creds.get("splunk_username") or resolved_creds.get("username"),
                    password=resolved_creds.get("splunk_password") or resolved_creds.get("password"),
                    base_url=splunk_base_url,
                    token=splunk_token,
                    verify_ssl=resolved_creds.get("verify_ssl", False),
                )
                # Wrap with MCP context if MCP is available
                try:
                    from src.services.splunk_mcp_service import get_splunk_mcp_service
                    mcp_service = get_splunk_mcp_service()
                    if await mcp_service.is_available():
                        mcp_creds = await mcp_service.get_mcp_creds()
                        context = SplunkMCPExecutionContext(
                            fallback_context=rest_context,
                            mcp_service=mcp_service,
                            mcp_creds=mcp_creds,
                        )
                        logger.info(f"[Tool] Splunk MCP context created for {tool_name}")
                    else:
                        context = rest_context
                except Exception as e:
                    logger.debug(f"[Tool] MCP not available, using direct REST: {e}")
                    context = rest_context
            elif tool.platform == "knowledge":
                # Knowledge tools don't need external credentials
                context = None
            elif tool.platform == "canvas":
                # Canvas tools are local visualization tools, no external context needed
                context = None
            else:
                context = None

            # Execute tool with timeout (60s for Splunk MCP, 30s for others)
            tool_timeout = 60.0 if tool.platform == "splunk" else 30.0
            health_tracker = get_tool_health_tracker()
            try:
                result = await asyncio.wait_for(
                    tool.handler(tool_input, context),
                    timeout=tool_timeout
                )

                # Attach network timing from instrumented transport
                if context and hasattr(context, 'pop_timing') and isinstance(result, dict):
                    try:
                        timing = context.pop_timing()
                        if timing:
                            result["_network_timing"] = {
                                "tcp_connect_ms": timing.tcp_connect_ms,
                                "tls_ms": timing.tls_ms,
                                "ttfb_ms": timing.ttfb_ms,
                                "server_ip": timing.server_ip,
                                "server_port": timing.server_port,
                                "tls_version": timing.tls_version,
                                "http_version": timing.http_version,
                            }
                    except Exception:
                        pass

                # Record success/failure for circuit breaker tracking
                if result.get("success", True):
                    await health_tracker.record_success(tool_name)
                else:
                    error_msg = result.get("error", "Unknown error")
                    await health_tracker.record_failure(tool_name, error_msg)

                # Cache successful results for non-write operations
                if result.get("success", True) and not tool.requires_write:
                    await cache.set(tool_name, tool_input, result)
                    logger.debug(f"[Tool] Cached result for {tool_name}")

                # Cascade invalidate related caches after successful write operations
                if result.get("success", True) and tool.requires_write:
                    invalidated = await cache.invalidate_related(tool_name)
                    if invalidated > 0:
                        logger.debug(f"[Tool] Cascade invalidated {invalidated} cache entries")

                return result
            except asyncio.TimeoutError:
                error_msg = f"Tool '{tool_name}' timed out after {tool_timeout:.0f} seconds"
                logger.error(error_msg)
                await health_tracker.record_failure(tool_name, error_msg)
                return {
                    "success": False,
                    "error": error_msg
                }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Tool execution error ({tool_name}): {error_msg}")
            # Record failure for circuit breaker
            try:
                health_tracker = get_tool_health_tracker()
                await health_tracker.record_failure(tool_name, error_msg)
            except Exception:
                pass  # Don't fail the main error path
            return {"success": False, "error": error_msg}

    async def _execute_tools_parallel(
        self,
        tool_calls: List[Dict[str, Any]],
        credentials: Optional[Dict[str, str]] = None,
        credential_pool: Optional[CredentialPool] = None,
        org_id: str = "",
        session_id: str = "default",
    ) -> List[Dict[str, Any]]:
        """Execute multiple tools in parallel, grouped by platform.

        This method optimizes cross-platform queries by:
        1. Detecting platform intent for the overall query
        2. Grouping tools by their target platform
        3. Executing independent platform groups in parallel
        4. Respecting dependencies between platforms

        Args:
            tool_calls: List of tool calls to execute.
            credentials: Legacy credentials dict.
            credential_pool: Dynamic credential pool.
            org_id: Organization ID.
            session_id: Session ID for context.

        Returns:
            List of tool results in the same order as input.
        """
        if not tool_calls:
            return []

        # Group tools by platform
        platform_groups: Dict[str, List[int]] = {}
        for i, tc in enumerate(tool_calls):
            tool_name = tc.get("name", "")
            # Extract platform from tool name (e.g., "meraki_list_networks" -> "meraki")
            platform = tool_name.split("_")[0] if "_" in tool_name else "unknown"
            if platform not in platform_groups:
                platform_groups[platform] = []
            platform_groups[platform].append(i)

        # Check platform health before execution
        health_tracker = get_tool_health_tracker()
        healthy_platforms = {
            p for p in platform_groups.keys()
            if health_tracker.is_platform_healthy(p)
        }

        # Execute all tools in parallel (existing behavior)
        # But log platform grouping for future optimization
        if len(platform_groups) > 1:
            logger.info(
                f"[ParallelExec] Cross-platform execution: "
                f"platforms={list(platform_groups.keys())}, "
                f"healthy={list(healthy_platforms)}"
            )

        # Execute tools
        async def execute_one(tc: Dict[str, Any]) -> Dict[str, Any]:
            tool_name = tc.get("name", "")
            tool_input = tc.get("input", {})
            tool_id = tc.get("id", "")

            result = await self._execute_tool(
                tool_name=tool_name,
                tool_input=tool_input,
                credentials=credentials,
                credential_pool=credential_pool,
                org_id=org_id,
                session_id=session_id,
            )

            return {
                "id": tool_id,
                "name": tool_name,
                "input": tool_input,
                "result": result,
            }

        # Execute all in parallel
        results = await asyncio.gather(
            *[execute_one(tc) for tc in tool_calls],
            return_exceptions=True,
        )

        # Process results
        processed = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(f"[ParallelExec] Tool execution error: {res}")
                processed.append({
                    "id": tool_calls[i].get("id", ""),
                    "name": tool_calls[i].get("name", ""),
                    "input": tool_calls[i].get("input", {}),
                    "result": {"success": False, "error": str(res)},
                })
            else:
                processed.append(res)

        return processed

    def _detect_query_intent(self, query: str, context: Optional[Dict[str, Any]] = None) -> QueryIntent:
        """Detect platform intent for a query.

        Args:
            query: User query text.
            context: Optional context.

        Returns:
            QueryIntent with platform detection and parallelization info.
        """
        detector = get_query_intent_detector()
        return detector.detect(query, context)

    async def _stream_anthropic(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        credentials: Optional[Dict[str, str]],
        org_id: str,
        session_id: str,
        credential_pool: Optional[CredentialPool] = None,
        user_id: Optional[int] = None,
        query: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response from Anthropic Claude with multi-turn tool loop."""
        trace_id = None
        root_span_id = None

        try:
            logger.info(f"[Anthropic] Starting stream with model={self.model}")

            # Start trace for this query
            try:
                from src.services.ai_trace_collector import get_trace_collector, SYSTEM_SESSION_PREFIXES
                collector = get_trace_collector()
                # Use the direct query parameter (actual user message)
                trace_query = query or ""
                # Parse session_id to int if possible
                trace_session_id = None
                _is_system_query = isinstance(session_id, str) and session_id.startswith(SYSTEM_SESSION_PREFIXES)
                try:
                    trace_session_id = int(session_id) if session_id and session_id != "default" else None
                except (ValueError, TypeError):
                    pass
                trace_id, root_span_id = await collector.start_trace(
                    session_id=trace_session_id, user_id=user_id, query=trace_query,
                    provider="anthropic", model=self.model,
                    is_system=_is_system_query,
                )
            except Exception as trace_err:
                logger.warning(f"[Trace] Failed to start trace: {trace_err}")
                trace_id = None
                root_span_id = None

            # Truncate messages if needed to avoid token limit errors
            # This prevents "prompt is too long: 214992 tokens > 200000 maximum"
            truncated_messages = self._truncate_messages_by_tokens(
                list(messages),
                system_prompt,
                max_tokens=180000  # Leave 20K buffer for response + tools
            )
            current_messages = truncated_messages
            total_input_tokens = 0
            total_output_tokens = 0
            max_iterations = 8  # Cross-platform investigations need 6-8 tool rounds
            collected_tool_data = []  # Collect tool results for canvas cards
            all_tools_executed = []  # Track all tool names for synthesis instruction

            # Track if canvas tools succeeded across ALL iterations (for auto-card suppression)
            # This MUST be outside the loop so it persists when AI does multi-turn tool calls
            canvas_tools_succeeded_in_session = False
            canvas_emitted_card_types: set = set()  # Track card types emitted by canvas tools

            # Determine thinking effort for streaming (adaptive thinking with interleaved reasoning)
            # We compute this once from the original query (first user message)
            stream_query = ""
            for msg in reversed(current_messages):
                if msg.get("role") == "user":
                    content = msg.get("content", "")
                    stream_query = content if isinstance(content, str) else str(content)
                    break
            thinking_effort = self._get_thinking_effort(stream_query, len(tools) if tools else 0)
            use_thinking = thinking_effort is not None

            # Build thinking params for streaming
            thinking_params = {}
            if use_thinking:
                thinking_params["temperature"] = 1
                if self.use_adaptive_thinking:
                    thinking_params["thinking"] = {"type": "adaptive"}
                    if thinking_effort:
                        thinking_params["output_config"] = {"effort": thinking_effort}
                    logger.info(f"[Anthropic] Streaming with adaptive thinking: effort={thinking_effort}")
                else:
                    thinking_params["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": self.thinking_budget_tokens,
                    }
                    logger.info(f"[Anthropic] Streaming with legacy thinking: budget={self.thinking_budget_tokens}")

            for iteration in range(max_iterations):
                logger.info(f"[Anthropic] Iteration {iteration + 1}, messages: {len(current_messages)}")

                # Start LLM call span for this iteration
                llm_span_id = None
                if trace_id and root_span_id:
                    try:
                        collector = get_trace_collector()
                        llm_span_id = await collector.add_span(
                            trace_id=trace_id,
                            span_type="llm_call",
                            parent_span_id=root_span_id,
                            span_name=self.model,
                            iteration=iteration,
                            model=self.model,
                            provider="anthropic",
                        )
                    except Exception as trace_err:
                        logger.warning(f"[Trace] Failed to add LLM span: {trace_err}")

                # Stream the response with immediate tool execution
                # Using raw events allows us to execute tools as soon as they're complete
                # instead of waiting for the entire response to finish
                stream_kwargs = {
                    "model": self.model,
                    "max_tokens": self.max_tokens,
                    "temperature": thinking_params.get("temperature", self.temperature),
                    "system": system_prompt,
                    "messages": current_messages,
                    "tools": tools if tools else None,
                }
                if "thinking" in thinking_params:
                    stream_kwargs["thinking"] = thinking_params["thinking"]
                if "output_config" in thinking_params:
                    stream_kwargs["output_config"] = thinking_params["output_config"]

                async with self.client.messages.stream(**stream_kwargs) as stream:
                    # Buffer text for smoother streaming
                    text_buffer = ""
                    last_yield_time = asyncio.get_event_loop().time()

                    # Track tool_use blocks as they stream
                    current_tool_blocks: Dict[int, Dict[str, Any]] = {}  # index -> {id, name, input_json}
                    completed_tools: List[Any] = []  # Store completed tool blocks for conversation history
                    tool_results = []
                    assistant_content = []

                    # Track if any canvas tools are in this response (for auto-card suppression)
                    canvas_tools_in_response = False
                    canvas_tool_pending = False  # True when canvas tool started but not completed
                    pending_auto_cards = []  # Auto-cards to emit if canvas fails

                    # Process raw events for both text streaming AND tool execution
                    # Track when thinking block is active to send periodic keepalive
                    thinking_active = False
                    last_thinking_keepalive = asyncio.get_event_loop().time()

                    async for event in stream:
                        # Handle text content
                        if event.type == "content_block_start":
                            if hasattr(event.content_block, 'type'):
                                if event.content_block.type == "thinking":
                                    # Thinking block started — signal frontend and track
                                    thinking_active = True
                                    last_thinking_keepalive = asyncio.get_event_loop().time()
                                    yield {"type": "thinking"}
                                elif event.content_block.type == "tool_use":
                                    # Start tracking a new tool_use block
                                    current_tool_blocks[event.index] = {
                                        "id": event.content_block.id,
                                        "name": event.content_block.name,
                                        "input_json": "",
                                    }
                                    # If canvas tool is starting, defer auto-card generation AND clear any pending
                                    # This is critical: if data tools ran BEFORE canvas in this iteration,
                                    # they may have added auto-cards that we now need to discard
                                    if event.content_block.name.startswith("canvas_"):
                                        canvas_tool_pending = True
                                        logger.info(f"[CanvasTool] Canvas tool starting: {event.content_block.name}, {len(pending_auto_cards)} pending auto-cards deferred")

                        elif event.type == "content_block_delta":
                            if hasattr(event.delta, 'type'):
                                if event.delta.type == "thinking_delta":
                                    # Send periodic keepalive during thinking (every 5s)
                                    # to prevent SSE connection from dropping
                                    current_time = asyncio.get_event_loop().time()
                                    if current_time - last_thinking_keepalive > 5.0:
                                        yield {"type": "thinking"}
                                        last_thinking_keepalive = current_time

                                elif event.delta.type == "text_delta":
                                    # Thinking phase is over once text starts
                                    thinking_active = False
                                    # Accumulate and stream text
                                    text_buffer += event.delta.text
                                    current_time = asyncio.get_event_loop().time()

                                    should_yield = (
                                        len(text_buffer) >= 1 or
                                        (current_time - last_yield_time) > 0.03
                                    )

                                    if should_yield and text_buffer:
                                        yield {"type": "text_delta", "text": text_buffer}
                                        text_buffer = ""
                                        last_yield_time = current_time

                                elif event.delta.type == "input_json_delta":
                                    # Accumulate tool input JSON
                                    if event.index in current_tool_blocks:
                                        current_tool_blocks[event.index]["input_json"] += event.delta.partial_json

                        elif event.type == "content_block_stop":
                            # Thinking block finished
                            if thinking_active:
                                thinking_active = False
                            # Check if this is a completed tool_use block
                            if event.index in current_tool_blocks:
                                tool_info = current_tool_blocks[event.index]

                                # Parse the accumulated JSON input
                                try:
                                    tool_input = json.loads(tool_info["input_json"]) if tool_info["input_json"] else {}
                                except json.JSONDecodeError:
                                    logger.warning(f"[Anthropic] Failed to parse tool input JSON for {tool_info['name']}")
                                    tool_input = {}

                                # Create a tool block object for later use
                                class ToolBlock:
                                    def __init__(self, id, name, input):
                                        self.id = id
                                        self.name = name
                                        self.input = input
                                        self.type = "tool_use"

                                block = ToolBlock(tool_info["id"], tool_info["name"], tool_input)
                                completed_tools.append(block)
                                all_tools_executed.append(block.name)

                                # Add to assistant content for conversation history
                                assistant_content.append({
                                    "type": "tool_use",
                                    "id": block.id,
                                    "name": block.name,
                                    "input": block.input,
                                })

                                # === IMMEDIATE TOOL EXECUTION ===
                                # Execute the tool right now instead of waiting for stream to complete
                                logger.info(f"[Anthropic] Executing tool immediately: {block.name}")
                                yield {
                                    "type": "tool_use_start",
                                    "tool": block.name,
                                    "id": block.id,
                                }

                                # Enrich tool input with session context
                                raw_input = block.input if hasattr(block, 'input') else {}
                                enriched_input = raw_input.copy()
                                try:
                                    context_store = get_session_context_store()
                                    enriched_input = await context_store.enrich_tool_input(
                                        session_id, block.name, raw_input
                                    )
                                except Exception as enrich_err:
                                    logger.warning(f"[CardData] Input enrichment failed: {enrich_err}")

                                # Start tool execution span
                                tool_span_id = None
                                if trace_id and llm_span_id:
                                    try:
                                        collector = get_trace_collector()
                                        tool_span_id = await collector.add_span(
                                            trace_id=trace_id,
                                            span_type="tool_execution",
                                            parent_span_id=llm_span_id,
                                            span_name=block.name,
                                            iteration=iteration,
                                            tool_name=block.name,
                                            tool_input=raw_input,
                                        )
                                    except Exception as trace_err:
                                        logger.warning(f"[Trace] Failed to add tool span: {trace_err}")

                                result = await self._execute_tool(
                                    tool_name=block.name,
                                    tool_input=raw_input,
                                    credentials=credentials,
                                    credential_pool=credential_pool,
                                    org_id=org_id,
                                    session_id=session_id,
                                )

                                # End tool execution span
                                if tool_span_id:
                                    try:
                                        tool_ok = result.get("success", False) if isinstance(result, dict) else True
                                        tool_err = result.get("error") if isinstance(result, dict) and not tool_ok else None
                                        net = result.pop("_network_timing", {}) if isinstance(result, dict) else {}
                                        collector = get_trace_collector()
                                        await collector.end_span(
                                            tool_span_id,
                                            status="success" if tool_ok else "error",
                                            tool_success=tool_ok,
                                            tool_output_summary=str(result)[:500] if result else None,
                                            tool_error=tool_err,
                                            tcp_connect_ms=net.get("tcp_connect_ms"),
                                            tls_ms=net.get("tls_ms"),
                                            ttfb_ms=net.get("ttfb_ms"),
                                            server_ip=net.get("server_ip"),
                                            server_port=net.get("server_port"),
                                            tls_version=net.get("tls_version"),
                                            http_version=net.get("http_version"),
                                        )
                                        # Async TE path correlation (fire-and-forget)
                                        if net.get("server_ip"):
                                            try:
                                                from src.services.te_path_correlator import get_te_path_correlator, PLATFORM_DESTINATIONS
                                                from src.services.tool_registry import get_tool_registry as _get_registry
                                                _tool_obj = _get_registry().tools.get(block.name)
                                                _platform = _tool_obj.platform if _tool_obj else None
                                                _dest = PLATFORM_DESTINATIONS.get(_platform or "") or net.get("server_ip")
                                                correlator = get_te_path_correlator()
                                                path = await correlator.get_path_for_destination(_dest, platform=_platform)
                                                if path:
                                                    await collector.update_span_path(tool_span_id, path)
                                            except Exception:
                                                pass  # Never block chat
                                    except Exception as trace_err:
                                        logger.warning(f"[Trace] Failed to end tool span: {trace_err}")

                                # Make result JSON-safe
                                safe_result = self._make_json_safe(result)

                                yield {
                                    "type": "tool_result",
                                    "tool": block.name,
                                    "id": block.id,
                                    "result": safe_result,
                                }

                                # Handle canvas tool card suggestions IMMEDIATELY
                                if block.name.startswith("canvas_"):
                                    canvas_tool_pending = False  # Canvas tool completed
                                    logger.info(f"[CanvasTool] Canvas tool executed: {block.name}, success={safe_result.get('success')}, error={safe_result.get('error')}")
                                    if safe_result.get("success"):
                                        # Canvas succeeded - suppress auto-cards regardless of whether it returned cards
                                        canvas_tools_in_response = True
                                        canvas_tools_succeeded_in_session = True  # Persist across iterations
                                        card_suggestion = safe_result.get("card_suggestion")
                                        card_suggestions = safe_result.get("card_suggestions", [])
                                        logger.info(f"[CanvasTool] Canvas result: card_suggestion={card_suggestion is not None}, card_suggestions count={len(card_suggestions)}")
                                        if card_suggestion:
                                            logger.info(f"[CanvasTool] Emitting card immediately: type={card_suggestion.get('type')}")
                                            yield {
                                                "type": "card_suggestion",
                                                "card": card_suggestion,
                                            }
                                        for card in card_suggestions:
                                            logger.info(f"[CanvasTool] Emitting card immediately: type={card.get('type')}")
                                            yield {
                                                "type": "card_suggestion",
                                                "card": card,
                                            }
                                        # Track which card types canvas emitted (for later auto-card filtering)
                                        if card_suggestion:
                                            canvas_emitted_card_types.add(card_suggestion.get("type"))
                                        for c in card_suggestions:
                                            canvas_emitted_card_types.add(c.get("type"))

                                        # Canvas succeeded — keep auto-cards whose types weren't covered by canvas
                                        if pending_auto_cards:

                                            # Emit auto-cards for types not covered by canvas
                                            remaining = []
                                            for ac in pending_auto_cards:
                                                if ac.get("type") not in canvas_emitted_card_types:
                                                    remaining.append(ac)
                                                else:
                                                    logger.debug(f"[CanvasTool] Suppressing auto-card {ac.get('type')} (covered by canvas)")
                                            if remaining:
                                                deduped = _deduplicate_auto_cards(remaining, incident_network_id=network_id)
                                                logger.info(f"[CanvasTool] Canvas succeeded, emitting {len(deduped)} non-overlapping auto-cards")
                                                for ac in deduped:
                                                    yield {"type": "card_suggestion", "card": ac}
                                            pending_auto_cards.clear()
                                    else:
                                        # Canvas failed - emit pending auto-cards as fallback
                                        logger.warning(f"[CanvasTool] Canvas tool FAILED: {safe_result.get('error')}")
                                        if pending_auto_cards:
                                            # Deduplicate: keep only ONE card per type (the last/most relevant)
                                            # Pass incident network_id to prefer cards for the focused network
                                            deduped_cards = _deduplicate_auto_cards(pending_auto_cards, incident_network_id=network_id)
                                            logger.info(f"[CanvasTool] Canvas failed, emitting {len(deduped_cards)} auto-cards (was {len(pending_auto_cards)})")
                                            for pending_card in deduped_cards:
                                                yield {
                                                    "type": "card_suggestion",
                                                    "card": pending_card,
                                                }
                                            pending_auto_cards.clear()

                                # Store result for conversation history
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": block.id,
                                    "content": json.dumps(safe_result) if isinstance(safe_result, dict) else str(safe_result),
                                })

                                # Collect tool data for non-canvas tools (for auto-card generation AND context inference)
                                if not block.name.startswith("canvas_"):
                                    if safe_result.get("success") and safe_result.get("data") is not None:
                                        network_id = enriched_input.get("network_id") or enriched_input.get("networkId")
                                        org_id_val = enriched_input.get("organization_id") or enriched_input.get("organizationId")

                                        # Cache tool data for context inference (used by canvas_add_dashboard)
                                        tool_data_item = {
                                            "tool": block.name,
                                            "data": safe_result.get("data"),
                                            "network_id": network_id,
                                            "org_id": org_id_val,
                                        }
                                        collected_tool_data.append(tool_data_item)

                                        # Also cache in session context for future "Add to Canvas" scenarios
                                        if session_id:
                                            try:
                                                ctx_store = get_session_context_store()
                                                session_ctx = await ctx_store.get_or_create(session_id)
                                                session_ctx.add_cardable_data(tool_data_item)
                                                logger.debug(f"[CardData] Cached {block.name} in session context")
                                            except Exception as cache_err:
                                                logger.debug(f"[CardData] Could not cache: {cache_err}")

                                        # Generate auto-card - but ALWAYS defer until we know if canvas will succeed
                                        # This avoids race condition where auto-cards emit before canvas is called
                                        # Only skip auto-card if canvas already emitted the SAME card type
                                        card_suggestion = _generate_card_suggestion(
                                            tool_name=block.name,
                                            tool_result=safe_result,
                                            tool_call_id=block.id,
                                            network_id=network_id,
                                            org_id=org_id_val,
                                        )
                                        if card_suggestion:
                                            if card_suggestion.get("type") in canvas_emitted_card_types:
                                                logger.debug(f"[CardGen] Skipping auto-card {card_suggestion.get('type')} - same type already emitted by canvas")
                                            else:
                                                logger.info(f"[CardGen] Deferring auto-card: type={card_suggestion.get('type')}")
                                                pending_auto_cards.append(card_suggestion)

                                del current_tool_blocks[event.index]

                        elif event.type == "message_delta":
                            if hasattr(event, 'usage') and event.usage:
                                total_output_tokens += getattr(event.usage, 'output_tokens', 0)

                        elif event.type == "message_start":
                            if hasattr(event.message, 'usage') and event.message.usage:
                                total_input_tokens += getattr(event.message.usage, 'input_tokens', 0)

                    # Yield any remaining buffered text
                    if text_buffer:
                        yield {"type": "text_delta", "text": text_buffer}

                    # Get final message for stop_reason
                    final_message = await stream.get_final_message()

                    logger.info(f"[Anthropic] Stream complete, {len(completed_tools)} tools executed, stop_reason={final_message.stop_reason}")

                    # End LLM call span with token usage + network timing
                    if llm_span_id:
                        try:
                            iter_input = getattr(final_message.usage, 'input_tokens', 0) if hasattr(final_message, 'usage') else 0
                            iter_output = getattr(final_message.usage, 'output_tokens', 0) if hasattr(final_message, 'usage') else 0
                            # Calculate cost from tokens
                            iter_cost = None
                            try:
                                from src.config.model_pricing import calculate_cost
                                iter_cost = float(calculate_cost(self.model, iter_input, iter_output))
                            except Exception:
                                pass
                            # Capture network timing from instrumented transport
                            net_kwargs = {}
                            if hasattr(self, '_http_transport') and self._http_transport:
                                timing = self._http_transport.pop_timing()
                                if timing:
                                    net_kwargs = {
                                        "tcp_connect_ms": timing.tcp_connect_ms,
                                        "tls_ms": timing.tls_ms,
                                        "ttfb_ms": timing.ttfb_ms,
                                        "server_ip": timing.server_ip,
                                        "server_port": timing.server_port,
                                        "tls_version": timing.tls_version,
                                        "http_version": timing.http_version,
                                    }
                            collector = get_trace_collector()
                            await collector.end_span(
                                llm_span_id,
                                status="success",
                                input_tokens=iter_input,
                                output_tokens=iter_output,
                                cost_usd=iter_cost,
                                **net_kwargs,
                            )
                            # Async TE path correlation for LLM call
                            if net_kwargs.get("server_ip"):
                                try:
                                    from src.services.te_path_correlator import get_te_path_correlator, PLATFORM_DESTINATIONS
                                    _provider = self.provider_name or "anthropic"
                                    _dest = PLATFORM_DESTINATIONS.get(_provider) or net_kwargs["server_ip"]
                                    correlator = get_te_path_correlator()
                                    path = await correlator.get_path_for_destination(_dest, platform=_provider)
                                    if path:
                                        await collector.update_span_path(llm_span_id, path)
                                except Exception:
                                    pass
                        except Exception as trace_err:
                            logger.warning(f"[Trace] Failed to end LLM span: {trace_err}")

                    # Emit pending auto-cards — filter out types already covered by canvas
                    if pending_auto_cards:
                        # Filter out types already emitted by canvas
                        remaining = [ac for ac in pending_auto_cards if ac.get("type") not in canvas_emitted_card_types]
                        if remaining:
                            deduped_cards = _deduplicate_auto_cards(remaining, incident_network_id=network_id)
                            logger.info(f"[CardGen] Stream complete, emitting {len(deduped_cards)} deferred auto-cards (was {len(pending_auto_cards)}, canvas_types={canvas_emitted_card_types})")
                            for pending_card in deduped_cards:
                                yield {
                                    "type": "card_suggestion",
                                    "card": pending_card,
                                }
                        elif canvas_emitted_card_types:
                            logger.info(f"[CardGen] All {len(pending_auto_cards)} auto-cards covered by canvas types: {canvas_emitted_card_types}")
                        pending_auto_cards.clear()

                # Build tool_use_blocks from completed tools for the loop logic
                tool_use_blocks = completed_tools

                if not tool_use_blocks:
                    # No tools - we're done
                    logger.info("[Anthropic] No tool calls, conversation complete")
                    break

                # Add text content to assistant message
                for block in final_message.content:
                    if block.type == "text":
                        assistant_content.insert(0, {"type": "text", "text": block.text})

                current_messages.append({"role": "assistant", "content": assistant_content})

                # Tools already executed during streaming - just need to add results to conversation
                logger.info(f"[Anthropic] {len(tool_use_blocks)} tools already executed during streaming")

                # Add tool results as user message with optional synthesis instruction
                is_approaching_limit = (iteration >= max_iterations - 2)
                synthesis = self._build_synthesis_instruction(
                    all_tools_executed, iteration, is_approaching_limit
                )
                if synthesis:
                    logger.info(f"[Synthesis] Injecting instruction after {len(all_tools_executed)} tools, iteration={iteration}")
                    current_messages.append({
                        "role": "user",
                        "content": list(tool_results) + [{"type": "text", "text": synthesis}],
                    })
                else:
                    current_messages.append({"role": "user", "content": tool_results})

            # Done - yield final usage and tool data for canvas cards
            logger.info(f"[CardData] Final collected_tool_data count: {len(collected_tool_data)}, session_id={session_id}")

            # If no fresh tool data, try to get cached cardable data from session
            final_tool_data = collected_tool_data
            if not collected_tool_data and session_id:
                logger.info(f"[CardData] Attempting to retrieve cached data for session: {session_id}")
                try:
                    session_store = get_session_context_store()
                    session_ctx = await session_store.get_or_create(session_id)
                    logger.info(f"[CardData] Session cache size: {len(session_ctx.cardable_data_cache)}")
                    cached_data = session_ctx.get_valid_cardable_data()
                    logger.info(f"[CardData] Valid cached items: {len(cached_data) if cached_data else 0}")
                    if cached_data:
                        # Return cached data (without cached_at field for frontend)
                        final_tool_data = [
                            {k: v for k, v in item.items() if k != "cached_at"}
                            for item in cached_data
                        ]
                        logger.info(f"[CardData] Using {len(final_tool_data)} cached cardable items from session")
                except Exception as cache_err:
                    logger.debug(f"[CardData] Could not get cached data: {cache_err}")

            if final_tool_data:
                logger.info(f"[CardData] Tools with data: {[td['tool'] for td in final_tool_data]}")

            # End trace successfully
            if trace_id and root_span_id:
                try:
                    collector = get_trace_collector()
                    await collector.end_trace(
                        trace_id, root_span_id, status="success",
                        total_input_tokens=total_input_tokens,
                        total_output_tokens=total_output_tokens,
                    )
                except Exception as trace_err:
                    logger.warning(f"[Trace] Failed to end trace: {trace_err}")

            yield {
                "type": "done",
                "usage": {
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                },
                "tool_data": final_tool_data if final_tool_data else None,
                "trace_id": str(trace_id) if trace_id else None,
            }

        except Exception as e:
            logger.error(f"Anthropic streaming error: {e}", exc_info=True)
            # End trace with error
            if trace_id and root_span_id:
                try:
                    collector = get_trace_collector()
                    await collector.end_trace(
                        trace_id, root_span_id, status="error", error_message=str(e)
                    )
                except Exception:
                    pass
            yield {"type": "error", "error": str(e)}

    async def _stream_openai(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        credentials: Optional[Dict[str, str]],
        org_id: str,
        session_id: str,
        credential_pool: Optional[CredentialPool] = None,
        user_id: Optional[int] = None,
        query: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response from OpenAI GPT."""
        trace_id = None
        root_span_id = None

        try:
            # Start trace
            try:
                from src.services.ai_trace_collector import get_trace_collector, SYSTEM_SESSION_PREFIXES
                collector = get_trace_collector()
                # Use the direct query parameter (actual user message)
                trace_query = query or ""
                trace_session_id = None
                _is_system_query = isinstance(session_id, str) and session_id.startswith(SYSTEM_SESSION_PREFIXES)
                try:
                    trace_session_id = int(session_id) if session_id and session_id != "default" else None
                except (ValueError, TypeError):
                    pass
                trace_id, root_span_id = await collector.start_trace(
                    session_id=trace_session_id, user_id=user_id, query=trace_query,
                    provider="openai", model=self.model,
                    is_system=_is_system_query,
                )
                llm_span_id = await collector.add_span(
                    trace_id=trace_id, span_type="llm_call",
                    parent_span_id=root_span_id, span_name=self.model,
                    model=self.model, provider="openai",
                )
            except Exception as trace_err:
                logger.warning(f"[Trace] Failed to start OpenAI trace: {trace_err}")
                trace_id = None
                root_span_id = None
                llm_span_id = None

            full_messages = [{"role": "system", "content": system_prompt}] + messages

            stream = await self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                messages=full_messages,
                tools=tools if tools else None,
                stream=True,
                stream_options={"include_usage": True},  # Request token usage in final chunk
            )

            current_tool = None
            tool_input_buffer = ""
            total_tokens = 0
            input_tokens = 0
            output_tokens = 0
            canvas_tools_succeeded = False  # Track if canvas tool added cards

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta:
                    delta = chunk.choices[0].delta

                    if delta.content:
                        yield {"type": "text_delta", "text": delta.content}

                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            if tc.function.name:
                                current_tool = {
                                    "id": tc.id,
                                    "name": tc.function.name,
                                }
                                yield {
                                    "type": "tool_use_start",
                                    "tool": tc.function.name,
                                    "id": tc.id,
                                }
                            if tc.function.arguments:
                                tool_input_buffer += tc.function.arguments

                if chunk.usage:
                    total_tokens = chunk.usage.total_tokens or 0
                    input_tokens = getattr(chunk.usage, 'prompt_tokens', 0) or 0
                    output_tokens = getattr(chunk.usage, 'completion_tokens', 0) or 0

            # End LLM span
            if llm_span_id:
                try:
                    iter_cost = None
                    try:
                        from src.config.model_pricing import calculate_cost
                        iter_cost = float(calculate_cost(self.model, input_tokens, output_tokens))
                    except Exception:
                        pass
                    collector = get_trace_collector()
                    await collector.end_span(
                        llm_span_id, status="success",
                        input_tokens=input_tokens, output_tokens=output_tokens,
                        cost_usd=iter_cost,
                    )
                except Exception:
                    pass

            # Execute any pending tool
            if current_tool:
                try:
                    tool_input = json.loads(tool_input_buffer)
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Failed to parse tool input: {e}")
                    tool_input = {}

                # Start tool span
                tool_span_id = None
                if trace_id and llm_span_id:
                    try:
                        collector = get_trace_collector()
                        tool_span_id = await collector.add_span(
                            trace_id=trace_id, span_type="tool_execution",
                            parent_span_id=llm_span_id,
                            span_name=current_tool["name"],
                            tool_name=current_tool["name"],
                            tool_input=tool_input,
                        )
                    except Exception:
                        pass

                result = await self._execute_tool(
                    tool_name=current_tool["name"],
                    tool_input=tool_input,
                    credentials=credentials,
                    credential_pool=credential_pool,
                    org_id=org_id,
                    session_id=session_id,
                )

                # End tool span
                if tool_span_id:
                    try:
                        tool_ok = result.get("success", False) if isinstance(result, dict) else True
                        collector = get_trace_collector()
                        await collector.end_span(
                            tool_span_id,
                            status="success" if tool_ok else "error",
                            tool_success=tool_ok,
                            tool_output_summary=str(result)[:500],
                            tool_error=result.get("error") if isinstance(result, dict) and not tool_ok else None,
                        )
                    except Exception:
                        pass

                # Extract entities asynchronously with error handling
                if result.get("success"):
                    context_store = get_session_context_store()
                    asyncio.create_task(
                        self._safe_extract_entities(
                            context_store=context_store,
                            session_id=session_id,
                            tool_name=current_tool["name"],
                            result=result,
                        )
                    )

                yield {
                    "type": "tool_result",
                    "tool": current_tool["name"],
                    "id": current_tool["id"],
                    "result": result,
                }

                # Check if this is a canvas tool that wants to add a card
                if current_tool["name"].startswith("canvas_") and isinstance(result, dict) and result.get("success"):
                    canvas_tools_succeeded = True
                    # Handle single card suggestion
                    card_suggestion = result.get("card_suggestion")
                    if card_suggestion:
                        yield {
                            "type": "card_suggestion",
                            "card": card_suggestion,
                        }
                    # Handle multiple card suggestions (dashboard)
                    for card in result.get("card_suggestions", []):
                        yield {
                            "type": "card_suggestion",
                            "card": card,
                        }
                # Auto-generate card for non-canvas tools (suppress if canvas already added cards)
                elif not canvas_tools_succeeded and isinstance(result, dict) and result.get("success") and result.get("data") is not None:
                    # Extract network_id and org_id from tool input or result
                    network_id = tool_input.get("network_id") or tool_input.get("networkId")
                    org_id_val = tool_input.get("organization_id") or tool_input.get("organizationId")
                    if not network_id and isinstance(result.get("data"), dict):
                        network_id = result["data"].get("networkId") or result["data"].get("id")
                        if network_id and not (network_id.startswith("L_") or network_id.startswith("N_")):
                            network_id = None  # Only use Meraki-style IDs
                    card_suggestion = _generate_card_suggestion(
                        tool_name=current_tool["name"],
                        tool_result=result,
                        tool_call_id=current_tool["id"],
                        network_id=network_id,
                        org_id=org_id_val,
                    )
                    if card_suggestion:
                        logger.info(f"[CardGen] OpenAI: Emitting auto-generated card: type={card_suggestion.get('type')}")
                        yield {
                            "type": "card_suggestion",
                            "card": card_suggestion,
                        }

            # End trace successfully
            if trace_id and root_span_id:
                try:
                    collector = get_trace_collector()
                    await collector.end_trace(
                        trace_id, root_span_id, status="success",
                        total_input_tokens=input_tokens,
                        total_output_tokens=output_tokens,
                    )
                except Exception:
                    pass

            yield {
                "type": "done",
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                },
                "trace_id": str(trace_id) if trace_id else None,
            }

        except Exception as e:
            logger.error(f"OpenAI streaming error: {e}")
            if trace_id and root_span_id:
                try:
                    collector = get_trace_collector()
                    await collector.end_trace(
                        trace_id, root_span_id, status="error", error_message=str(e)
                    )
                except Exception:
                    pass
            yield {"type": "error", "error": str(e)}

    def _generate_action_description(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Generate a human-readable description of what an action will do."""
        descriptions = {
            # Meraki actions
            "meraki_reboot_device": lambda i: f"Reboot device {i.get('serial', 'unknown')}",
            "meraki_update_device": lambda i: f"Update device {i.get('serial', 'unknown')} configuration",
            "meraki_blink_leds": lambda i: f"Blink LEDs on device {i.get('serial', 'unknown')}",
            "meraki_disable_switch_port": lambda i: f"Disable switch port {i.get('portId', 'unknown')} on {i.get('serial', 'unknown')}",
            "meraki_enable_switch_port": lambda i: f"Enable switch port {i.get('portId', 'unknown')} on {i.get('serial', 'unknown')}",
            "meraki_update_ssid": lambda i: f"Update SSID {i.get('number', 'unknown')} settings in network {i.get('networkId', 'unknown')}",
            "meraki_update_vlan": lambda i: f"Update VLAN {i.get('vlanId', 'unknown')} in network {i.get('networkId', 'unknown')}",
            "meraki_update_firewall_rules": lambda i: f"Update firewall rules in network {i.get('networkId', 'unknown')}",
            "meraki_update_traffic_shaping": lambda i: f"Update traffic shaping rules",
            "meraki_claim_device": lambda i: f"Claim device {i.get('serial', 'unknown')} to network",
            "meraki_remove_device": lambda i: f"Remove device {i.get('serial', 'unknown')} from network",
            # Catalyst actions
            "catalyst_reboot_device": lambda i: f"Reboot Catalyst device {i.get('deviceId', 'unknown')}",
            "catalyst_deploy_template": lambda i: f"Deploy template to device",
            "catalyst_provision_device": lambda i: f"Provision new device",
        }

        if tool_name in descriptions:
            try:
                return descriptions[tool_name](tool_input)
            except Exception:
                pass

        # Default description
        return f"Execute {tool_name.replace('_', ' ')}"

    def _assess_risk_level(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Assess the risk level of an action based on tool type and parameters."""
        # High risk actions
        high_risk = [
            "meraki_reboot_device", "catalyst_reboot_device",
            "meraki_update_firewall_rules", "meraki_remove_device",
            "catalyst_deploy_template", "catalyst_provision_device",
            "meraki_update_traffic_shaping",
        ]

        # Medium risk actions
        medium_risk = [
            "meraki_update_device", "meraki_update_ssid", "meraki_update_vlan",
            "meraki_disable_switch_port", "meraki_claim_device",
        ]

        # Low risk actions
        low_risk = [
            "meraki_blink_leds", "meraki_enable_switch_port",
        ]

        if tool_name in high_risk:
            return "high"
        elif tool_name in medium_risk:
            return "medium"
        elif tool_name in low_risk:
            return "low"
        else:
            # Default to medium for unknown write operations
            return "medium"


def create_chat_service(
    model: str,
    user_api_keys: Dict[str, str] = None,
) -> UnifiedChatService:
    """Factory function to create a chat service with appropriate credentials.

    Args:
        model: Model ID
        user_api_keys: User's API keys for providers

    Returns:
        UnifiedChatService instance
    """
    from src.services.config_service import get_config_or_env

    provider = get_provider_from_model(model)
    settings = get_settings()
    user_api_keys = user_api_keys or {}

    # Get API key based on provider
    # Priority: user_api_keys > database > environment variables
    # Note: user_api_keys can use either "provider" or "provider_api_key" format
    if provider == "anthropic":
        api_key = (
            user_api_keys.get("anthropic") or
            user_api_keys.get("anthropic_api_key") or
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key
        )
    elif provider == "openai":
        api_key = (
            user_api_keys.get("openai") or
            user_api_keys.get("openai_api_key") or
            get_config_or_env("openai_api_key", "OPENAI_API_KEY") or
            settings.openai_api_key
        )
    elif provider == "google":
        api_key = (
            user_api_keys.get("google") or
            user_api_keys.get("google_api_key") or
            get_config_or_env("google_api_key", "GOOGLE_API_KEY") or
            settings.google_api_key
        )
    elif provider == "cisco":
        # Cisco Circuit uses OAuth with client_id, client_secret, app_key
        # Check database first, then settings
        db_client_id = get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID")
        db_client_secret = get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET")
        db_app_key = get_config_or_env("cisco_circuit_app_key", "CISCO_CIRCUIT_APP_KEY")

        has_cisco_creds = (
            (db_client_id or settings.cisco_circuit_client_id) and
            (db_client_secret or settings.cisco_circuit_client_secret) and
            (db_app_key or settings.cisco_circuit_app_key)
        )
        if has_cisco_creds:
            # Use app_key as the "api_key" marker - actual auth happens via OAuth
            api_key = db_app_key or settings.cisco_circuit_app_key
        else:
            api_key = ""
    else:
        api_key = ""

    if not api_key:
        raise ValueError(f"No API key available for provider: {provider}")

    return UnifiedChatService(
        model=model,
        api_key=api_key,
    )
