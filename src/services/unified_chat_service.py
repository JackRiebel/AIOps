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
        message="List devices on Riebel Home",
        conversation_history=history,
        credentials=meraki_credentials,
        session_id="conv-123",
    )
"""

import asyncio
import logging
import json
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


from src.services.tool_registry import get_tool_registry, AIProvider
from src.services.tool_selector import get_tool_selector, select_tools_for_query
from src.services.tool_cache import get_tool_cache
from src.services.tool_health_tracker import get_tool_health_tracker
from src.services.query_intent_detector import get_query_intent_detector, QueryIntent
from src.services.session_context_store import (
    get_session_context_store,
    SessionContext,
    OrgType,
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
        max_tokens: int = 4096,
        enable_extended_thinking: bool = True,
        thinking_budget_tokens: int = 4000,
    ):
        """Initialize the unified chat service.

        Args:
            model: Model ID (e.g., "claude-sonnet-4-5-20250929", "gpt-4o")
            api_key: API key for the provider
            temperature: Response temperature (0.0-2.0)
            max_tokens: Maximum response tokens
            enable_extended_thinking: Auto-enable extended thinking for complex queries
            thinking_budget_tokens: Token budget for extended thinking
        """
        self.model = model
        self.api_key = api_key
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.provider = get_provider_from_model(model)
        self.tool_registry = get_tool_registry()
        self.settings = get_settings()
        self.enable_extended_thinking = enable_extended_thinking
        self.thinking_budget_tokens = thinking_budget_tokens
        self.api_keys = {}  # Initialize API keys dict for provider-specific keys
        self._total_tools_count = len(self.tool_registry.get_all())  # Cache tool count for logging

        # Initialize provider-specific clients
        self._init_client()

        logger.info(
            f"[UnifiedChat] Initialized with model={model}, provider={self.provider}, "
            f"tools={self._total_tools_count}, extended_thinking={enable_extended_thinking}"
        )

    def _should_use_extended_thinking(
        self,
        query: str,
        tool_count: int,
    ) -> bool:
        """
        Detect complex queries that benefit from extended thinking.

        Extended thinking improves accuracy for:
        - Complex analytical questions
        - Multi-step troubleshooting
        - Comparisons and correlations
        - High tool count scenarios (harder decision-making)

        Per Anthropic research, extended thinking improves:
        - Multi-step planning
        - Instruction adherence
        - Tool use reliability

        Args:
            query: The user's query
            tool_count: Number of tools being provided

        Returns:
            True if extended thinking should be enabled
        """
        if not self.enable_extended_thinking:
            return False

        # Skip extended thinking for incident queries (cost optimization)
        if is_incident_query(query):
            logger.debug("[UnifiedChat] Extended thinking: skipped for incident query")
            return False

        # Only works with Anthropic models
        if self.provider != "anthropic":
            return False

        # Only for capable models (opus, sonnet)
        model_lower = self.model.lower()
        if not any(m in model_lower for m in ["opus", "sonnet"]):
            return False

        query_lower = query.lower()

        # Check for complex query indicators
        for indicator in self.COMPLEX_QUERY_INDICATORS:
            if indicator in query_lower:
                logger.debug(f"[UnifiedChat] Extended thinking: matched '{indicator}'")
                return True

        # Many tools = harder decision making = benefit from thinking
        if tool_count > 20:
            logger.debug(f"[UnifiedChat] Extended thinking: high tool count ({tool_count})")
            return True

        # Explicit requests for careful analysis
        explicit_requests = ["think carefully", "think through", "step by step", "detailed analysis"]
        if any(req in query_lower for req in explicit_requests):
            logger.debug("[UnifiedChat] Extended thinking: explicit request")
            return True

        return False

    def _init_client(self):
        """Initialize the appropriate provider client."""
        if self.provider == "anthropic":
            self.client = anthropic.AsyncAnthropic(api_key=self.api_key)
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
            logger.info(f"[UnifiedChat] Platforms with credentials: {available_platforms}")

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

        # Detect if extended thinking should be used (for accuracy on complex queries)
        use_extended_thinking = self._should_use_extended_thinking(
            query=message,
            tool_count=len(tools),
        )
        if use_extended_thinking:
            logger.info(
                f"[UnifiedChat] Extended thinking enabled for complex query "
                f"(tools={len(tools)}, budget={self.thinking_budget_tokens})"
            )

        # Build messages
        messages = self._build_messages(conversation_history, message)

        # Track metrics
        total_input_tokens = 0
        total_output_tokens = 0
        total_thinking_tokens = 0
        tool_calls_made = []
        entities_discovered = 0

        # Tool execution loop
        for iteration in range(max_tool_iterations):
            # Call provider (with extended thinking on first iteration only)
            response = await self._call_provider(
                system_prompt=system_prompt,
                messages=messages,
                tools=tools,
                use_extended_thinking=use_extended_thinking and iteration == 0,
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
        for tc in tool_calls_made:
            result = tc.get("result", {})
            if result.get("success") and result.get("data"):
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
        edit_mode: bool = False,
        credential_pool: Optional[CredentialPool] = None,
        verbosity: str = "standard",  # "brief", "standard", "detailed"
        card_context: Optional[Dict[str, str]] = None,  # Context from "Ask about this" card feature
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
            network_id: User's currently selected network (for card context)
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
                system_prompt, messages, tools, credentials, org_id, session_id, credential_pool
            ):
                yield event

        elif self.provider == "openai":
            async for event in self._stream_openai(
                system_prompt, messages, tools, credentials, org_id, session_id, credential_pool
            ):
                yield event

        else:
            # Non-streaming fallback (Cisco Circuit, Google, etc.)
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

            for tool_call in result.tool_calls:
                tool_name = tool_call.get("name", "unknown")
                tool_id = tool_call.get("id", f"call_{tool_name}")
                tool_result = tool_call.get("result", {})

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
            yield done_event

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
2. When the user mentions a network by name (e.g., "Riebel Home"), find it in the AVAILABLE PLATFORM DATA section above
3. Only call list/discovery tools if the specific entity isn't in the pre-fetched data
4. ALWAYS use tools to get data - don't guess or make up information
5. When the user says "it", "that", "the device", etc. - refer to the SESSION CONTEXT above for entity IDs
6. If a tool fails, explain the error and suggest alternatives
7. **DEVICE LOOKUP**: When user references a device by model (MV21, MR46, MS250) or name instead of serial:
   - First use `meraki_list_network_devices` to find the device in the specified network
   - Match by model name or device name from the results
   - Then use the serial number for device-specific queries
   - NEVER ask the user for a serial number you can look up yourself
8. **TOOL SCOPE PREFERENCE**: When user specifies a network name (e.g., "devices on Riebel Home"):
   - PREFER network-scoped tools like `meraki_list_network_devices` over org-scoped alternatives
   - Network-scoped tools are more efficient and return exactly what the user asked for
   - Only use org-scoped tools (meraki_organizations_*) when querying across ALL networks or orgs
9. **RESPONSE FORMATTING FOR CARDS**: When tools return data arrays (devices, VLANs, rules, etc.):
   - SUMMARIZE key findings in natural language (counts, highlights, notable issues)
   - DO NOT dump raw JSON, full data arrays, or verbose tool output in your response
   - The raw data is automatically available via "Add to Canvas" buttons - users click these for details
   - Example GOOD: "Found 13 devices on Riebel Home: 1 MX security appliance, 4 access points, 2 switches, and 6 sensors. Note: MS-220 switch has outdated firmware."
   - Example BAD: Pasting full device list with all properties in the response
   - Keep responses concise (2-5 sentences) with actionable insights, not data dumps

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

Example: "Show logs for Garage MX" → Get serial Q2KY-EVGL-CL3C → Run `deviceSerial=Q2KY-EVGL-CL3C | stats count by type`

**THOUSANDEYES API GUIDELINES** (CRITICAL - Follow strictly):
When the user mentions ANY of these, you MUST use ThousandEyes API tools directly:
- "ThousandEyes", "TE", "synthetic tests", "path visualization", "agents", "probes"
- Latency, packet loss, network path performance from external monitoring
- Synthetic monitoring or internet connectivity tests
- "Check ThousandEyes", "TE alerts", "TE tests"

ThousandEyes tools to use:
- `thousandeyes_list_tests` - List all synthetic tests
- `thousandeyes_get_test_results` - Get results for a specific test
- `thousandeyes_list_alerts` - Get active ThousandEyes alerts
- `thousandeyes_list_agents` - List monitoring agents
- `thousandeyes_get_path_visualization` - Get network path data

**DO NOT** search Splunk for ThousandEyes data unless the user explicitly asks for:
- "ThousandEyes logs IN Splunk"
- "ThousandEyes events FROM Splunk"
- "Splunk for ThousandEyes data"

If user says "check ThousandEyes for latency" → Use `thousandeyes_list_tests` + `thousandeyes_get_test_results`
If user says "ThousandEyes alerts" → Use `thousandeyes_list_alerts`
If user says "latency issues" (general) → Use ThousandEyes tools for synthetic test data

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
Keep analysis responses SHORT and ACTIONABLE. Maximum 150 words. Structure:

**Summary**: One sentence stating the core issue + key metric.

**Cause**: One sentence on root cause (or "Investigating..." if unclear).

**Action**: 1-2 specific next steps.

EXAMPLE (good - concise):
"**Summary**: 90% WiFi success rate (below 95% target) - 738 disconnects in 24h.

**Cause**: 92% of disconnects are 'client inactive' timeouts, not auth failures (only 3 WPA failures).

**Action**:
1. Increase idle timeout on 'Corp-WiFi' SSID
2. Check client power management settings"

EXAMPLE (bad - too verbose):
"I've analyzed the data and found several interesting patterns. Let me walk through each query result..."

DO NOT:
- List every query you ran
- Repeat raw data from tool results
- Add filler phrases ("Let me check...", "I found that...")
- Exceed 150 words

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
- Execute tools SILENTLY - the user should only see results, never process
- If a tool fails, try alternatives WITHOUT announcing the failure
- If you need more tools, use `request_more_tools` INVISIBLY - never mention it
- NEVER announce retries, fallbacks, or tool switches
- Present results as if you always knew exactly how to get them
- The response should read like expert analysis, NOT a debugging log
- When something doesn't work, quietly try another approach
- Only show the successful result, not the journey to get there

**CANVAS VISUALIZATION GUIDELINES** (CRITICAL - Follow strictly):
When to use the `canvas_add_card` tool:
- User asks for a dashboard, visualization, or monitoring view
- You have metrics/findings worth visualizing (use ai-metric, ai-stats-grid, ai-gauge, ai-breakdown)
- Answering knowledge-base questions with source documents (use knowledge-sources)
- Comparing products or features (use datasheet-comparison)
- Highlighting issues or recommendations (use ai-finding)

Card usage rules:
1. ONLY ADD ONE CARD per topic - check what's already on the canvas first
2. Don't suggest the same card type for similar queries - the user already has it
3. After adding a card, briefly confirm: "I've added a [type] card to your canvas."
4. For live data monitoring (network-health, device-table, topology), let the card fetch data itself
5. For AI-generated insights, use card_data to pass the specific values you found

Response format when adding cards:
- DO NOT include internal JSON blocks (```json:comparison or ```json:product)
- Keep the text response concise - the card provides the detailed visualization
- Example: "Based on your question, here's what I found: [brief summary]. I've added a Network Health card to your canvas for real-time monitoring."

Canvas awareness:
- The session context includes what cards are currently on the user's canvas
- Reference visible cards when relevant: "Looking at your Network Health card..."
- Don't add cards that duplicate existing ones on the canvas
"""

    def _get_verbosity_instructions(self, verbosity: str) -> str:
        """Get verbosity-specific instructions for system prompt."""
        instructions = {
            "brief": """- Maximum 3-5 sentences for simple queries
- Tables limited to 5 rows (note if more exist)
- Skip detailed explanations
- Focus on actionable answer only""",
            "standard": """- Balanced detail level
- Include context where helpful
- Full tables up to 15 rows
- Explain reasoning briefly""",
            "detailed": """- Comprehensive analysis
- Include all relevant data
- Explain methodology and reasoning
- Provide additional context and background
- Suggest related investigations""",
        }
        return instructions.get(verbosity, instructions["standard"])

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
    ) -> Dict[str, Any]:
        """Call the AI provider and return response.

        Args:
            system_prompt: System prompt for the model
            messages: Conversation messages
            tools: Tools in provider-specific format
            use_extended_thinking: Enable extended thinking (Anthropic only)

        Returns:
            Response dict with content, tool_calls, and token usage
        """
        if self.provider == "anthropic":
            return await self._call_anthropic(
                system_prompt, messages, tools, use_extended_thinking
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
    ) -> Dict[str, Any]:
        """Call Anthropic Claude API with optional extended thinking.

        Extended thinking enables Claude to reason more thoroughly before
        responding, improving accuracy for complex queries at the cost
        of ~1-2 seconds additional latency.

        Args:
            system_prompt: System instructions
            messages: Conversation messages
            tools: Tools in Anthropic format
            use_extended_thinking: Enable extended thinking mode

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

            # Extended thinking requires temperature=1 per Anthropic docs
            # and adds thinking block before response
            if use_extended_thinking:
                params["temperature"] = 1  # Required for extended thinking
                params["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": self.thinking_budget_tokens,
                }
                logger.info(
                    f"[UnifiedChat] Extended thinking enabled with budget={self.thinking_budget_tokens}"
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
When you have gathered all the information needed, provide your final response:
```
Thought: I now have all the information needed to answer.
Final Answer: [Your complete response to the user, formatted nicely with the data]
```

**RULES:**
- ALWAYS use tools when asked about networks, devices, clients, status, or any live data
- NEVER make up data - use tools to fetch real information
- Output valid JSON for Action Input (use double quotes for strings)
- Only call ONE tool at a time, wait for the Observation before continuing
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
            async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
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
                    "content": json.dumps(result["result"]),
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
                    "content": json.dumps(result["result"]),
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
                result_str = json.dumps(result["result"], indent=2)
                # Truncate very large results to prevent token overflow
                if len(result_str) > 8000:
                    result_str = result_str[:8000] + "\n... [truncated]"
                observation_parts.append(f"Observation for {result['name']}:\n```json\n{result_str}\n```")

            messages.append({
                "role": "user",
                "content": "\n\n".join(observation_parts) + "\n\nNow continue with your reasoning. If you have all the information needed, provide your Final Answer.",
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
    ) -> Dict[str, Any]:
        """Execute a tool and return the result.

        This method:
        1. Gets the tool from registry
        2. Resolves credentials dynamically based on platform and context
        3. Creates execution context with credentials
        4. Enriches input with session context
        5. Executes the tool handler
        6. Returns the result

        Args:
            tool_name: Name of tool to execute
            tool_input: Input parameters
            credentials: API credentials (deprecated, use credential_pool)
            org_id: Organization ID (for backward compatibility)
            session_id: Session ID for context
            credential_pool: Dynamic credential pool for multi-platform resolution

        Returns:
            Tool execution result
        """
        tool = self.tool_registry.get(tool_name)
        if not tool:
            return {"success": False, "error": f"Tool '{tool_name}' not found"}

        if not tool.handler:
            return {"success": False, "error": f"Tool '{tool_name}' has no handler"}

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

                logger.debug(f"[Tool] Using Meraki API key: {api_key[:8]}... (length={len(api_key)}) for {tool_name}")

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
                from src.services.tools.splunk import SplunkExecutionContext
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
                context = SplunkExecutionContext(
                    username=resolved_creds.get("splunk_username") or resolved_creds.get("username"),
                    password=resolved_creds.get("splunk_password") or resolved_creds.get("password"),
                    base_url=splunk_base_url,
                    token=splunk_token,
                    verify_ssl=resolved_creds.get("verify_ssl", False),
                )
            elif tool.platform == "knowledge":
                # Knowledge tools don't need external credentials
                context = None
            else:
                context = None

            # Execute tool with timeout (30 seconds)
            health_tracker = get_tool_health_tracker()
            try:
                result = await asyncio.wait_for(
                    tool.handler(tool_input, context),
                    timeout=30.0
                )

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
                error_msg = f"Tool '{tool_name}' timed out after 30 seconds"
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
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response from Anthropic Claude with multi-turn tool loop."""
        try:
            logger.info(f"[Anthropic] Starting stream with model={self.model}")

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
            max_iterations = 5  # Reduced from 10 for faster responses
            collected_tool_data = []  # Collect tool results for canvas cards

            for iteration in range(max_iterations):
                logger.info(f"[Anthropic] Iteration {iteration + 1}, messages: {len(current_messages)}")

                # Stream the response
                async with self.client.messages.stream(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                    system=system_prompt,
                    messages=current_messages,
                    tools=tools if tools else None,
                ) as stream:
                    # Buffer text for smoother streaming - smaller buffer for more fluid output
                    text_buffer = ""
                    last_yield_time = asyncio.get_event_loop().time()

                    async for text in stream.text_stream:
                        text_buffer += text
                        current_time = asyncio.get_event_loop().time()

                        # Yield when buffer has content and either:
                        # - Has 5+ chars (smooth chunk size)
                        # - 50ms elapsed (responsive updates)
                        # - Contains a space or newline (natural break point)
                        should_yield = (
                            len(text_buffer) >= 5 or
                            (current_time - last_yield_time) > 0.05 or
                            ' ' in text_buffer or
                            '\n' in text_buffer
                        )

                        if should_yield and text_buffer:
                            yield {"type": "text_delta", "text": text_buffer}
                            text_buffer = ""
                            last_yield_time = current_time

                    # Yield any remaining buffered text
                    if text_buffer:
                        yield {"type": "text_delta", "text": text_buffer}

                    # Get final message to check for tool calls
                    final_message = await stream.get_final_message()
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                    logger.info(f"[Anthropic] Got {len(final_message.content)} content blocks, stop_reason={final_message.stop_reason}")

                # Check if we need to execute tools
                tool_use_blocks = [b for b in final_message.content if b.type == "tool_use"]

                if not tool_use_blocks:
                    # No tools - we're done
                    logger.info("[Anthropic] No tool calls, conversation complete")
                    break

                # Execute tools and build response
                tool_names = [b.name for b in tool_use_blocks]
                logger.info(f"[Anthropic] Executing {len(tool_use_blocks)} tools: {tool_names}")

                # Add assistant message with tool use to conversation
                assistant_content = []
                for block in final_message.content:
                    if block.type == "text":
                        assistant_content.append({"type": "text", "text": block.text})
                    elif block.type == "tool_use":
                        assistant_content.append({
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        })

                current_messages.append({"role": "assistant", "content": assistant_content})

                # Execute each tool and collect results
                tool_results = []
                logger.info(f"[CardData] Starting execution of {len(tool_use_blocks)} tools")
                for block in tool_use_blocks:
                    yield {
                        "type": "tool_use_start",
                        "tool": block.name,
                        "id": block.id,
                    }

                    # Enrich tool input with session context BEFORE execution
                    # This gives us resolved network_id, org_id, etc. for CardData collection
                    raw_input = block.input if hasattr(block, 'input') else {}
                    enriched_input = raw_input.copy()
                    try:
                        context_store = get_session_context_store()
                        enriched_input = await context_store.enrich_tool_input(
                            session_id, block.name, raw_input
                        )
                        logger.debug(f"[CardData] Enriched input for {block.name}: network_id={enriched_input.get('network_id')}, org_id={enriched_input.get('organization_id')}")
                    except Exception as enrich_err:
                        logger.warning(f"[CardData] Input enrichment failed: {enrich_err}")

                    result = await self._execute_tool(
                        tool_name=block.name,
                        tool_input=raw_input,  # _execute_tool does its own enrichment
                        credentials=credentials,
                        credential_pool=credential_pool,
                        org_id=org_id,
                        session_id=session_id,
                    )

                    # Ensure result is JSON-serializable (convert Response objects to strings)
                    safe_result = self._make_json_safe(result)

                    yield {
                        "type": "tool_result",
                        "tool": block.name,
                        "id": block.id,
                        "result": safe_result,
                    }

                    # Check if this is a canvas tool that wants to add a card
                    if block.name.startswith("canvas_") and safe_result.get("success"):
                        # Handle single card suggestion
                        card_suggestion = safe_result.get("card_suggestion")
                        if card_suggestion:
                            logger.info(f"[CanvasTool] Emitting card_suggestion: type={card_suggestion.get('type')}, title={card_suggestion.get('title')}")
                            yield {
                                "type": "card_suggestion",
                                "card": card_suggestion,
                            }
                        # Handle multiple card suggestions (dashboard)
                        card_suggestions = safe_result.get("card_suggestions", [])
                        for card in card_suggestions:
                            logger.info(f"[CanvasTool] Emitting card_suggestion: type={card.get('type')}, title={card.get('title')}")
                            yield {
                                "type": "card_suggestion",
                                "card": card,
                            }

                    # Collect successful tool data for canvas cards (with live topic info)
                    # Use enriched_input which has resolved network_id, org_id from session context
                    has_success = safe_result.get("success", True)
                    has_data = safe_result.get("data") is not None
                    data_type = _detect_data_type(block.name)
                    live_topic = _generate_live_topic(block.name, enriched_input)
                    # Log with correct field names (check both cases)
                    log_network_id = enriched_input.get("network_id") or enriched_input.get("networkId") or raw_input.get("networkId")
                    log_org_id = enriched_input.get("organization_id") or enriched_input.get("organizationId") or raw_input.get("organizationId")
                    logger.info(f"[CardData] Tool {block.name}: success={has_success}, has_data={has_data}, data_type={data_type}, live_topic={live_topic}, network_id={log_network_id}, org_id={log_org_id}")
                    if has_success and has_data:
                        result_data = safe_result.get("data")

                        # INTENSIVE LOGGING: Log raw_input and enriched_input
                        logger.info(f"[CardData][DEBUG] raw_input for {block.name}: {json.dumps(raw_input, default=str)[:500]}")
                        logger.info(f"[CardData][DEBUG] enriched_input for {block.name}: {json.dumps(enriched_input, default=str)[:500]}")

                        # INTENSIVE LOGGING: Log result_data structure
                        if isinstance(result_data, dict):
                            logger.info(f"[CardData][DEBUG] result_data is DICT with keys: {list(result_data.keys())}")
                            if 'id' in result_data:
                                logger.info(f"[CardData][DEBUG] result_data.id = {result_data.get('id')}")
                            if 'networkId' in result_data:
                                logger.info(f"[CardData][DEBUG] result_data.networkId = {result_data.get('networkId')}")
                            if 'network' in result_data:
                                logger.info(f"[CardData][DEBUG] result_data.network = {result_data.get('network')}")
                        elif isinstance(result_data, list):
                            logger.info(f"[CardData][DEBUG] result_data is LIST with {len(result_data)} items")
                            if len(result_data) > 0 and isinstance(result_data[0], dict):
                                logger.info(f"[CardData][DEBUG] result_data[0] keys: {list(result_data[0].keys())}")
                                if 'id' in result_data[0]:
                                    logger.info(f"[CardData][DEBUG] result_data[0].id = {result_data[0].get('id')}")
                        else:
                            logger.info(f"[CardData][DEBUG] result_data is {type(result_data).__name__}")

                        # Extract network_id (check input params, then result data)
                        network_id = (
                            enriched_input.get("network_id") or
                            enriched_input.get("networkId") or
                            raw_input.get("networkId") or
                            raw_input.get("network_id")
                        )
                        # Fallback: extract from result data
                        if not network_id and isinstance(result_data, dict):
                            # Check for Meraki-style network ID (L_ or N_ prefix) in 'id' field
                            potential_id = result_data.get("id")
                            if potential_id and isinstance(potential_id, str) and (potential_id.startswith("L_") or potential_id.startswith("N_")):
                                network_id = potential_id
                            else:
                                # Fallback to explicit networkId fields
                                network_id = result_data.get("networkId") or result_data.get("network_id")
                            # Check nested 'network' object
                            if not network_id and isinstance(result_data.get("network"), dict):
                                nested_id = result_data["network"].get("id")
                                if nested_id and isinstance(nested_id, str) and (nested_id.startswith("L_") or nested_id.startswith("N_")):
                                    network_id = nested_id
                        if not network_id and isinstance(result_data, list) and len(result_data) > 0:
                            # For list responses, check first item for Meraki network ID
                            first_item = result_data[0]
                            if isinstance(first_item, dict):
                                potential_id = first_item.get("id")
                                if potential_id and isinstance(potential_id, str) and (potential_id.startswith("L_") or potential_id.startswith("N_")):
                                    network_id = potential_id
                                else:
                                    network_id = first_item.get("networkId") or first_item.get("network_id")

                        # Extract org_id (check input params, then result data)
                        org_id = (
                            enriched_input.get("organization_id") or
                            enriched_input.get("organizationId") or
                            raw_input.get("organizationId") or
                            raw_input.get("organization_id")
                        )
                        # Fallback: extract from result data
                        if not org_id and isinstance(result_data, dict):
                            org_id = result_data.get("organizationId") or result_data.get("organization_id")
                        if not org_id and isinstance(result_data, list) and len(result_data) > 0:
                            first_item = result_data[0]
                            if isinstance(first_item, dict):
                                org_id = first_item.get("organizationId") or first_item.get("organization_id")

                        # Log warning if network_id extraction failed
                        if not network_id:
                            result_keys = list(result_data.keys()) if isinstance(result_data, dict) else (
                                list(result_data[0].keys()) if isinstance(result_data, list) and len(result_data) > 0 and isinstance(result_data[0], dict) else "N/A"
                            )
                            logger.warning(f"[CardData] Failed to extract network_id for {block.name}. "
                                           f"enriched_input keys: {list(enriched_input.keys())}, "
                                           f"result_data type: {type(result_data).__name__}, "
                                           f"result_data keys: {result_keys}")
                        logger.info(f"[CardData] Extracted context: network_id={network_id}, org_id={org_id}")

                        tool_data_item = {
                            "tool": block.name,
                            "data": result_data,
                            "data_type": data_type,
                            "live_topic": live_topic,
                            "network_id": network_id,
                            "org_id": org_id,
                        }
                        collected_tool_data.append(tool_data_item)
                        # INTENSIVE LOGGING: Log the full tool_data_item (without large data)
                        logger.info(f"[CardData][DEBUG] tool_data_item for frontend: tool={block.name}, network_id={network_id}, org_id={org_id}, data_type={data_type}")
                        logger.info(f"[CardData] Collected {block.name} data for cards (total: {len(collected_tool_data)}, live: {live_topic is not None})")

                        # Cache in session context for future "Add to Canvas" when AI answers from context
                        if session_id:
                            try:
                                session_store = get_session_context_store()
                                session_ctx = session_store.get_or_create(session_id)
                                session_ctx.add_cardable_data(tool_data_item)
                                logger.debug(f"[CardData] Cached {block.name} in session context")
                            except Exception as cache_err:
                                logger.debug(f"[CardData] Could not cache: {cache_err}")
                    else:
                        logger.warning(f"[CardData] SKIPPING {block.name} - success={has_success}, has_data={has_data}")

                    # Format result for Claude (use safe_result to avoid serialization errors)
                    tool_content = json.dumps(safe_result) if isinstance(safe_result, dict) else str(safe_result)

                    # Add formatting hint for large data arrays to encourage summary responses
                    data_array = safe_result.get("data") if isinstance(safe_result, dict) else None
                    if isinstance(data_array, list) and len(data_array) > 3:
                        tool_content += "\n\n[CARD DATA AVAILABLE: This data will be available to the user via 'Add to Canvas' button. Summarize key findings in 2-5 sentences instead of listing all items.]"

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": tool_content,
                    })

                # Add tool results as user message
                current_messages.append({"role": "user", "content": tool_results})

            # Done - yield final usage and tool data for canvas cards
            logger.info(f"[CardData] Final collected_tool_data count: {len(collected_tool_data)}, session_id={session_id}")

            # If no fresh tool data, try to get cached cardable data from session
            final_tool_data = collected_tool_data
            if not collected_tool_data and session_id:
                logger.info(f"[CardData] Attempting to retrieve cached data for session: {session_id}")
                try:
                    session_store = get_session_context_store()
                    session_ctx = session_store.get_or_create(session_id)
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

            yield {
                "type": "done",
                "usage": {
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                },
                "tool_data": final_tool_data if final_tool_data else None,
            }

        except Exception as e:
            logger.error(f"Anthropic streaming error: {e}", exc_info=True)
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
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response from OpenAI GPT."""
        try:
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

            # Execute any pending tool
            if current_tool:
                try:
                    tool_input = json.loads(tool_input_buffer)
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Failed to parse tool input: {e}")
                    tool_input = {}

                result = await self._execute_tool(
                    tool_name=current_tool["name"],
                    tool_input=tool_input,
                    credentials=credentials,
                    credential_pool=credential_pool,
                    org_id=org_id,
                    session_id=session_id,
                )

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

            yield {
                "type": "done",
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                },
            }

        except Exception as e:
            logger.error(f"OpenAI streaming error: {e}")
            yield {"type": "error", "error": str(e)}


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
