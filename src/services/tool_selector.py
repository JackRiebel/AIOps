"""
Dynamic Tool Selector for filtering 1000+ tools to 15-25 per request.

This module implements Anthropic's Tool Search pattern to achieve 85% token reduction
by dynamically selecting relevant tools based on query context.

Key features:
- Platform detection from keywords and org context (with word-boundary matching)
- Category matching based on query intent
- Always includes request_more_tools meta-tool for model to request additional tools
- Configurable max_tools limit (default 25)
- Query validation and intelligent fallbacks
- Debug logging for troubleshooting selection decisions

Best Practices Applied (2024-2025):
- Word-boundary regex matching prevents false positives (e.g., "mx" won't match "maximum")
- Credential availability filtering prevents selecting tools for unconfigured platforms
- Query validation prevents edge cases and malformed input
"""

import logging
import re
from typing import Dict, List, Optional, Set, Any
from dataclasses import dataclass

from src.services.tool_registry import Tool, get_tool_registry, create_tool
from src.services.tool_health_tracker import get_tool_health_tracker, ToolHealthTracker

logger = logging.getLogger(__name__)


def _word_boundary_match(keyword: str, text: str) -> bool:
    """
    Check if keyword exists in text with word boundaries.

    Prevents false positives like "mx" matching "maximum" or "z" matching "analyze".
    Uses regex word boundaries for accurate matching.

    For 2-char Meraki device prefixes (mv, mr, ms, mx, mt, mg), we use prefix-only
    boundary to match device models like "MV21", "MR46", "MS250".
    """
    # Handle multi-word phrases
    if " " in keyword:
        # For phrases, just check if the phrase exists
        return keyword in text

    # For single words, use word boundary regex
    # Special handling for very short keywords (1-2 chars)
    if len(keyword) <= 2:
        # For short keywords like "mv", "mr", use prefix boundary only
        # This allows "mv21" to match but prevents "remove" from matching "mv"
        pattern = rf'\b{re.escape(keyword)}'
    else:
        # For longer keywords, also allow as prefix/suffix match
        pattern = rf'\b{re.escape(keyword)}'

    return bool(re.search(pattern, text, re.IGNORECASE))


# Essential "bootstrap" tools that should always be included for each platform
# These are needed to start most workflows (get org ID, network ID, etc.)
ESSENTIAL_TOOLS = {
    "meraki": [
        "meraki_list_organizations",
        "meraki_list_organization_networks",
        "meraki_get_organization",
    ],
    "catalyst": [
        "catalyst_get_sites",
        "catalyst_get_site_count",
    ],
    "thousandeyes": [
        "thousandeyes_list_tests",
        "thousandeyes_list_agents",
    ],
    "splunk": [
        "splunk_run_search",
    ],
}

# Tools that should ALWAYS be included regardless of platform or query
# These are cross-cutting tools that enhance user experience
ALWAYS_INCLUDE_TOOLS = [
    "canvas_add_card",        # AI can add visualization cards to canvas
    "canvas_add_dashboard",   # AI can add dashboard layouts to canvas
]

# Incident-specific tool set - minimal tools for analyzing incidents (~10 tools)
# This dramatically reduces token usage from 25 tools to ~10 tools
INCIDENT_ANALYSIS_TOOLS = [
    # Incident data
    "get_incident_details",
    "get_incident_events",
    # Network health (for context)
    "meraki_get_network_health",
    "meraki_list_organization_networks",
    # Device info (for affected devices)
    "meraki_get_device",
    "meraki_list_network_devices",
    # RF analysis (for wireless incidents)
    "meraki_get_wireless_channel_utilization",
    # Canvas tools (for visualization)
    "canvas_add_card",
    "canvas_add_dashboard",
    # Request more if needed
    "request_more_tools",
]

# Keywords that indicate an incident analysis query
INCIDENT_QUERY_KEYWORDS = [
    "incident #",
    "incident#",
    "analyze incident",
    "incident analysis",
]


def is_incident_query(query: str) -> bool:
    """Check if the query is specifically about analyzing an incident."""
    query_lower = query.lower()
    return any(kw in query_lower for kw in INCIDENT_QUERY_KEYWORDS)

# Category-specific essential tools - added when category is detected
# These ensure the right tools are available for specific configuration queries
CATEGORY_ESSENTIAL_TOOLS = {
    "appliance": [
        "meraki_list_vlans",
        "meraki_get_appliance_uplinks_status",
        "meraki_get_appliance_firewall_rules",
        "meraki_get_appliance_vpn_site_to_site",
        "meraki_appliance_list_vlans",
        "meraki_appliance_get_l3_firewall_rules",
        "meraki_appliance_get_site_to_site_vpn",
    ],
    "wireless": [
        "meraki_list_ssids",
        "meraki_get_ssid",
        "meraki_list_wireless_rf_profiles",
        "meraki_wireless_list_ssids",
        "meraki_get_wireless_channel_utilization",
        "meraki_wireless_get_channel_utilization",
    ],
    "switch": [
        "meraki_list_switch_ports",
        "meraki_get_switch_port",
        "meraki_list_switch_stacks",
        "meraki_switch_list_ports",
    ],
    "devices": [
        "meraki_list_devices",
        "meraki_list_network_devices",
        "meraki_list_organization_devices",
        "meraki_get_device",
    ],
    "camera": [
        "meraki_list_network_devices",  # Find camera by name/model
        "meraki_get_device",             # Get camera details
        "meraki_camera_get_quality_retention",
        "meraki_camera_get_video_settings",
        "meraki_camera_get_sense",
        "meraki_camera_get_wireless_profiles",
        "meraki_camera_list_analytics_zones",
    ],
    "sensor": [
        "meraki_list_network_devices",  # Find sensor by name/model
        "meraki_get_device",
        "meraki_sensor_list_readings",
        "meraki_sensor_get_alerts",
    ],
}

# Device-type categories that require device listing tools as prerequisites
# When any of these categories are detected, ensure device listing tools are included
DEVICE_PREREQUISITE_CATEGORIES = ["camera", "sensor", "switch", "appliance", "wireless"]

# Meraki device model patterns - detect specific device models like MV21, MR46, MS250
# These patterns help identify the platform AND category from device model numbers
DEVICE_MODEL_PATTERNS = {
    "meraki": [
        r'\bmv\d+',      # MV21, MV32, MV72 (cameras)
        r'\bmr\d+',      # MR46, MR56 (access points)
        r'\bms\d+',      # MS250, MS350 (switches)
        r'\bmx\d+',      # MX68, MX84, MX250 (appliances)
        r'\bmt\d+',      # MT sensors
        r'\bmg\d+',      # MG cellular gateways
        r'\bz\d+',       # Z-series teleworker
    ],
}

# Map device model prefix to category for automatic category detection
DEVICE_MODEL_TO_CATEGORY = {
    'mv': 'camera',
    'mr': 'wireless',
    'ms': 'switch',
    'mx': 'appliance',
    'mt': 'sensor',
    'mg': 'cellular',
    'z': 'appliance',
}

# Keywords that trigger increased tool limit (config queries need more tools)
CONFIG_QUERY_KEYWORDS = [
    "vlan", "firewall", "vpn", "dhcp", "routing", "ssid",
    "port", "configuration", "config", "settings", "rules",
    "nat", "acl", "qos", "traffic shaping", "content filtering",
]

# Platform detection keywords
PLATFORM_KEYWORDS = {
    "meraki": {
        "primary": ["meraki", "dashboard", "mx", "mr", "ms", "mv", "mt", "mg", "z"],
        "secondary": ["ssid", "vlan", "firewall", "vpn", "switch port", "wireless"],
    },
    "catalyst": {
        "primary": ["catalyst", "dnac", "dna center", "cisco"],
        "secondary": ["site", "fabric", "sda", "assurance", "swim"],
    },
    "thousandeyes": {
        "primary": ["thousandeyes", "te", "thousand eyes"],
        "secondary": ["synthetic", "path visualization", "endpoint agent", "cloud agent"],
    },
    "splunk": {
        "primary": ["splunk", "siem"],
        "secondary": ["log", "search", "alert", "index", "kvstore"],
    },
}

# Category keywords for intent matching
CATEGORY_KEYWORDS = {
    # Meraki categories
    "organizations": ["organization", "org", "admin", "inventory", "license"],
    "networks": ["network", "networks", "subnet", "site"],
    "devices": ["device", "devices", "serial", "hardware", "status", "uplink"],
    "wireless": ["wireless", "ssid", "wifi", "radio", "rf", "air marshal", "channel", "utilization", "interference", "ap ", "access point"],
    "appliance": ["mx", "appliance", "vlan", "firewall", "vpn", "nat", "dhcp", "routing"],
    "switch": ["switch", "ms", "port", "poe", "stp", "acl", "routing"],
    "camera": ["camera", "mv", "video", "snapshot", "analytics"],
    "sensor": ["sensor", "mt", "temperature", "humidity", "door"],
    "sm": ["systems manager", "mdm", "mobile", "endpoint", "profile"],

    # Catalyst categories
    "sites": ["site", "building", "floor", "area"],
    "health": ["health", "score", "assurance", "issue"],
    "clients": ["client", "clients", "user", "endpoint"],
    "topology": ["topology", "map", "neighbor"],
    "sda": ["fabric", "sda", "segment", "transit", "virtual network"],
    "interfaces": ["interface", "interfaces", "port"],

    # ThousandEyes categories
    "tests": ["test", "tests", "probe", "monitoring"],
    "agents": ["agent", "agents", "cloud agent", "enterprise agent"],
    "alerts": ["alert", "alerts", "notification", "threshold"],
    "results": ["results", "data", "metrics", "round"],

    # Splunk categories
    "search": ["search", "query", "spl", "event"],
    "knowledge": ["knowledge", "dashboard", "saved search", "report"],
}

# Action keywords that indicate operation type
ACTION_KEYWORDS = {
    "list": ["list", "show", "get all", "find all", "what are", "display"],
    "get": ["get", "show", "detail", "info", "status", "check", "troubleshoot", "diagnose", "debug", "investigate", "analyze"],
    "create": ["create", "add", "new", "configure", "setup", "enable"],
    "update": ["update", "modify", "change", "edit", "set"],
    "delete": ["delete", "remove", "disable", "clear"],
}


@dataclass
class ToolSelectionResult:
    """Result of tool selection."""
    tools: List[Tool]
    platforms_detected: List[str]
    categories_matched: List[str]
    query_analysis: Dict[str, Any]


class ToolSelector:
    """
    Dynamically selects relevant tools based on query context.

    Implements Anthropic's Tool Search pattern to reduce token usage by 85%
    by filtering 1000+ tools to 15-25 per request.
    """

    def __init__(
        self,
        max_tools: int = 25,
        min_tools: int = 5,
        always_include_platforms: Optional[List[str]] = None,
    ):
        """
        Initialize the tool selector.

        Args:
            max_tools: Maximum tools to return (default 25)
            min_tools: Minimum tools to return (default 5)
            always_include_platforms: Platforms to always include some tools from
        """
        self.max_tools = max_tools
        self.min_tools = min_tools
        self.always_include_platforms = always_include_platforms or []
        self._registry = None
        self._health_tracker = None
        self._request_more_tools = self._create_meta_tool()

    @property
    def registry(self):
        """Lazy load registry to avoid import issues."""
        if self._registry is None:
            self._registry = get_tool_registry()
        return self._registry

    @property
    def health_tracker(self) -> ToolHealthTracker:
        """Lazy load health tracker to avoid import issues."""
        if self._health_tracker is None:
            self._health_tracker = get_tool_health_tracker()
        return self._health_tracker

    def _create_meta_tool(self) -> Tool:
        """Create the request_more_tools meta-tool."""
        return create_tool(
            name="request_more_tools",
            description="""Request additional tools if the current set doesn't have what you need.
            Use this when you need to perform an operation but don't see a suitable tool available.
            Describe what operation you're trying to perform and which platform it's for.""",
            platform="system",
            category="meta",
            properties={
                "operation_description": {
                    "type": "string",
                    "description": "Describe the operation you want to perform (e.g., 'configure VLAN on MX appliance', 'create synthetic test')"
                },
                "platform": {
                    "type": "string",
                    "enum": ["meraki", "catalyst", "thousandeyes", "splunk", "any"],
                    "description": "Which platform is this operation for?"
                },
                "category": {
                    "type": "string",
                    "description": "Optional category hint (e.g., 'wireless', 'firewall', 'health')"
                }
            },
            required=["operation_description", "platform"],
            handler=self._handle_request_more_tools,
        )

    async def _handle_request_more_tools(self, params: Dict, context: Any) -> Dict:
        """
        Handle request for additional tools.

        This is called when the model needs tools not in the current selection.
        Returns a list of additional relevant tools.
        """
        operation = params.get("operation_description", "")
        platform = params.get("platform", "any")
        category_hint = params.get("category", "")

        # Build a synthetic query from the request
        query = f"{operation} {platform} {category_hint}".strip()

        # Get additional tools, excluding already-selected ones
        additional_tools = await self.select_tools(
            query=query,
            org_context={},
            max_tools=15,
            exclude_meta_tool=True,
        )

        # Return tool names and descriptions
        tool_info = [
            {
                "name": t.name,
                "description": t.description[:200] + "..." if len(t.description) > 200 else t.description,
                "platform": t.platform,
                "category": t.category,
            }
            for t in additional_tools.tools
        ]

        return {
            "success": True,
            "message": f"Found {len(tool_info)} additional tools for: {operation}",
            "tools": tool_info,
        }

    async def select_tools(
        self,
        query: str,
        org_context: Optional[Dict] = None,
        max_tools: Optional[int] = None,
        exclude_meta_tool: bool = False,
        credentials: Optional[Dict] = None,
    ) -> ToolSelectionResult:
        """
        Select relevant tools for a query.

        Args:
            query: The user's query text
            org_context: Context about the organization (org_id, platforms, etc.)
            max_tools: Override default max_tools
            exclude_meta_tool: Don't include request_more_tools
            credentials: Available credentials to filter platforms

        Returns:
            ToolSelectionResult with selected tools and analysis
        """
        base_max_tools = max_tools or self.max_tools
        org_context = org_context or {}
        credentials = credentials or {}

        # Query validation - prevent empty or oversized queries
        if not query or len(query.strip()) < 2:
            logger.debug("[ToolSelector] Query too short, returning default tools")
            return self._get_default_result(base_max_tools, exclude_meta_tool)

        # Sanitize and limit query length
        query = query.strip()[:1000]
        query_lower = query.lower()

        # Early return for incident queries - use minimal tool set for cost efficiency
        # This reduces tokens from ~5000 (25 tools) to ~1200 (8 tools)
        if is_incident_query(query):
            logger.info("[ToolSelector] Incident query detected - using minimal incident tool set")
            incident_tools = self._get_incident_tools(exclude_meta_tool)
            return ToolSelectionResult(
                tools=incident_tools,
                platforms_detected=["meraki"],  # Incidents are typically Meraki-related
                categories_matched=["incident", "health"],
                query_analysis={
                    "actions": ["analyze", "get"],
                    "original_query": query,
                    "candidate_count": len(incident_tools),
                    "incident_mode": True,
                }
            )

        # Detect if this is a configuration query - needs more tools
        is_config_query = any(kw in query_lower for kw in CONFIG_QUERY_KEYWORDS)
        if is_config_query:
            # Config queries need both bootstrap tools AND configuration tools
            max_tools = base_max_tools + 10
            logger.debug(f"[ToolSelector] Config query detected, increased max_tools to {max_tools}")
        else:
            max_tools = base_max_tools

        logger.debug(f"[ToolSelector] Processing query: {query_lower[:100]}...")

        # Analyze the query
        platforms = self._detect_platforms(query_lower, org_context)
        logger.debug(f"[ToolSelector] Detected platforms: {platforms}")

        # Filter by available credentials if provided
        if credentials:
            platforms = self._filter_by_credentials(platforms, credentials)
            logger.debug(f"[ToolSelector] After credential filter: {platforms}")

        categories = self._match_categories(query_lower)
        logger.debug(f"[ToolSelector] Matched categories: {categories}")

        actions = self._detect_actions(query_lower)
        logger.debug(f"[ToolSelector] Detected actions: {actions}")

        # Get candidate tools
        candidates = self._get_candidate_tools(platforms, categories, actions)
        logger.debug(f"[ToolSelector] Candidate pool: {len(candidates)} tools")

        # Score and rank tools
        scored_tools = self._score_tools(candidates, query_lower, categories, actions)

        # Select top tools
        selected = self._select_top_tools(scored_tools, max_tools)

        # Add essential bootstrap tools for detected platforms AND categories
        selected = self._add_essential_tools(selected, platforms, max_tools, categories)

        # Always add meta-tool unless excluded
        if not exclude_meta_tool and self._request_more_tools not in selected:
            selected.append(self._request_more_tools)

        # Ensure minimum diversity
        selected = self._ensure_diversity(selected, platforms, max_tools)

        logger.info(
            f"[ToolSelector] Selected {len(selected)} tools for query. "
            f"Platforms: {platforms}, Categories: {categories[:3]}, Actions: {actions}"
        )
        # Debug: log selected tool names for troubleshooting
        if 'channel' in query.lower() or 'utilization' in query.lower():
            logger.info(f"[ToolSelector] Channel query - Selected tools: {[t.name for t in selected]}")

        return ToolSelectionResult(
            tools=selected,
            platforms_detected=platforms,
            categories_matched=categories,
            query_analysis={
                "actions": actions,
                "original_query": query,
                "candidate_count": len(candidates),
                "credentials_available": list(credentials.keys()) if credentials else [],
            }
        )

    def _get_default_result(
        self,
        max_tools: int,
        exclude_meta_tool: bool,
    ) -> ToolSelectionResult:
        """Return default tools for invalid/empty queries."""
        # Default to meraki as most commonly used platform
        default_tools = self.registry.get_tools_by_platform("meraki")[:max_tools - 1]

        if not exclude_meta_tool:
            default_tools.append(self._request_more_tools)

        return ToolSelectionResult(
            tools=default_tools,
            platforms_detected=["meraki"],
            categories_matched=[],
            query_analysis={"actions": ["get", "list"], "original_query": "", "candidate_count": 0}
        )

    def _get_incident_tools(self, exclude_meta_tool: bool = False) -> List[Tool]:
        """
        Return minimal tool set for incident analysis queries.

        This significantly reduces token usage by returning only 8 tools
        instead of the usual 25 tools. The AI can use request_more_tools
        if it needs additional capabilities.
        """
        incident_tools = []

        for tool_name in INCIDENT_ANALYSIS_TOOLS:
            if exclude_meta_tool and tool_name == "request_more_tools":
                continue

            # Try to get the tool from registry
            tool = self.registry.get_tool(tool_name)
            if tool:
                incident_tools.append(tool)
            else:
                logger.debug(f"[ToolSelector] Incident tool not found: {tool_name}")

        # Ensure we have at least the request_more_tools meta-tool
        if not exclude_meta_tool and self._request_more_tools not in incident_tools:
            incident_tools.append(self._request_more_tools)

        logger.info(f"[ToolSelector] Incident tools selected: {len(incident_tools)} tools")
        return incident_tools

    def _filter_by_credentials(
        self,
        platforms: List[str],
        credentials: Dict,
    ) -> List[str]:
        """
        Filter platforms to only those with available credentials.

        This prevents selecting tools for platforms the user can't actually use.
        """
        CREDENTIAL_KEYS = {
            "meraki": ["meraki_api_key", "MERAKI_API_KEY"],
            "catalyst": ["catalyst_token", "catalyst_api_key", "CATALYST_TOKEN", "dnac_token"],
            "thousandeyes": ["thousandeyes_token", "te_token", "THOUSANDEYES_TOKEN"],
            "splunk": ["splunk_token", "splunk_api_key", "SPLUNK_TOKEN"],
        }

        available = []
        for platform in platforms:
            keys = CREDENTIAL_KEYS.get(platform, [])
            if not keys:
                # Unknown platform, include it
                available.append(platform)
            elif any(credentials.get(key) for key in keys):
                available.append(platform)

        # If no platforms have credentials, return original list (user may configure later)
        return available if available else platforms

    def _detect_platforms(self, query: str, org_context: Dict) -> List[str]:
        """
        Detect which platforms are relevant to the query.

        Uses word-boundary matching to prevent false positives like:
        - "mx" matching "maximum"
        - "z" matching "analyze"
        - "te" matching "template"

        Also detects device model patterns like MV21, MR46, MS250.
        Falls back to org context or defaults rather than all platforms.
        """
        detected = []
        scores = {}  # Track match quality
        query_lower = query.lower()

        # First, check for device model patterns (highest priority)
        # e.g., "MV21" -> meraki platform, "MR46" -> meraki platform
        for platform, patterns in DEVICE_MODEL_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    scores[platform] = scores.get(platform, 0) + 15  # High priority
                    logger.debug(f"[ToolSelector] Device model pattern '{pattern}' matched for {platform}")
                    break  # One pattern match per platform is enough

        # Check query keywords with word-boundary matching
        for platform, keywords in PLATFORM_KEYWORDS.items():
            platform_score = 0

            # Check primary keywords (strong match = 10 points)
            for kw in keywords["primary"]:
                if _word_boundary_match(kw, query):
                    platform_score += 10
                    break  # One primary match is enough

            # Check secondary keywords (weak match = 3 points)
            for kw in keywords["secondary"]:
                if _word_boundary_match(kw, query):
                    platform_score += 3
                    break  # One secondary match is enough

            if platform_score > 0:
                scores[platform] = platform_score

        # Sort by score and add to detected
        sorted_platforms = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        detected = [p for p, _ in sorted_platforms]

        # If no platforms detected from query, use org context
        if not detected and org_context:
            org_platforms = org_context.get("platforms", [])
            if org_platforms:
                # Only use first 2 platforms from org context
                detected = org_platforms[:2]
                logger.debug(f"[ToolSelector] Using org context platforms: {detected}")

        # Intelligent fallback - don't return ALL platforms (defeats filtering purpose)
        if not detected:
            # Default to meraki (most common) - prevents 85% token savings loss
            detected = ["meraki"]
            logger.debug("[ToolSelector] No platform detected, defaulting to meraki")

        return detected

    def _match_categories(self, query: str) -> List[str]:
        """
        Match query to tool categories using word-boundary matching.

        Also detects device model patterns and maps them to categories:
        - MV21 -> camera
        - MR46 -> wireless
        - MS250 -> switch
        - MX68 -> appliance

        Returns top 5 matching categories sorted by relevance score.
        """
        scores = {}
        query_lower = query.lower()

        # First, check for device model patterns and map to category
        # This gives high priority to device-specific queries
        for platform, patterns in DEVICE_MODEL_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, query_lower)
                if match:
                    # Extract the prefix (mv, mr, ms, etc.) from the match
                    matched_text = match.group()
                    prefix = re.match(r'([a-z]+)', matched_text).group(1)
                    if prefix in DEVICE_MODEL_TO_CATEGORY:
                        category = DEVICE_MODEL_TO_CATEGORY[prefix]
                        scores[category] = scores.get(category, 0) + 10  # High priority
                        logger.debug(f"[ToolSelector] Device model '{matched_text}' -> category '{category}'")

        # Then check keyword matching
        for category, keywords in CATEGORY_KEYWORDS.items():
            score = 0
            for kw in keywords:
                if _word_boundary_match(kw, query):
                    # Exact word match gets higher score
                    if len(kw) > 3:  # Longer keywords are more specific
                        score += 3
                    else:
                        score += 1

            if score > 0:
                scores[category] = scores.get(category, 0) + score

        # Sort by score and return top categories
        sorted_categories = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        matched = [cat for cat, _ in sorted_categories[:5]]

        return matched

    def _detect_actions(self, query: str) -> List[str]:
        """
        Detect intended actions from the query using word-boundary matching.

        Returns list of detected actions, defaults to ["get", "list"] if none found.
        """
        detected = []
        action_scores = {}

        for action, keywords in ACTION_KEYWORDS.items():
            for kw in keywords:
                if _word_boundary_match(kw, query):
                    # Score by keyword specificity
                    action_scores[action] = action_scores.get(action, 0) + len(kw)
                    break

        # Sort by score and get detected actions
        sorted_actions = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
        detected = [action for action, _ in sorted_actions]

        # Default to "get" and "list" if no action detected
        if not detected:
            detected = ["get", "list"]

        return detected

    def _get_candidate_tools(
        self,
        platforms: List[str],
        categories: List[str],
        actions: List[str],
    ) -> List[Tool]:
        """Get candidate tools based on detected context."""
        # Use dict keyed by name to avoid duplicates (Tool not hashable)
        candidates: Dict[str, Tool] = {}

        # Get tools by platform
        for platform in platforms:
            platform_tools = self.registry.get_tools_by_platform(platform)
            for tool in platform_tools:
                candidates[tool.name] = tool

        # Filter by category if we have specific matches
        if categories:
            filtered: Dict[str, Tool] = {}
            for tool in candidates.values():
                # Check if tool's category matches any detected category
                tool_cat = tool.category.lower() if tool.category else ""
                for cat in categories:
                    if cat in tool_cat or tool_cat in cat:
                        filtered[tool.name] = tool
                        break
                    # Also check tool name
                    if cat in tool.name.lower():
                        filtered[tool.name] = tool
                        break

            # Only use filtered if we have enough candidates
            if len(filtered) >= self.min_tools:
                candidates = filtered

        return list(candidates.values())

    def _score_tools(
        self,
        tools: List[Tool],
        query: str,
        categories: List[str],
        actions: List[str],
    ) -> List[tuple]:
        """Score tools by relevance to the query.

        Scoring weights (higher = more important):
        - Exact category field match: +20 (highest priority)
        - Category keyword in tool name: +15
        - Category keyword in description: +5
        - Action match in name: +8
        - Query word matches: +2 per word
        - Read-only bonus for get/list: +5
        - Write bonus for create/update/delete: +5
        - Health score adjustment: multiplied by 0.0-1.0
        """
        scored = []

        for tool in tools:
            # Skip tools with open circuit breakers
            if not self.health_tracker.is_healthy(tool.name):
                logger.debug(
                    f"[ToolSelector] Skipping unhealthy tool: {tool.name} "
                    f"(circuit breaker open)"
                )
                continue

            score = 0
            tool_name_lower = tool.name.lower()
            tool_desc_lower = tool.description.lower() if tool.description else ""
            tool_category_lower = tool.category.lower() if tool.category else ""

            # HIGHEST: Exact category field match (+20)
            # This ensures tools with matching category field rank highest
            for cat in categories:
                if cat == tool_category_lower or tool_category_lower == cat:
                    score += 20
                    break

            # Category keyword in tool name (+15, was +10)
            for cat in categories:
                if cat in tool_name_lower:
                    score += 15
                # Category in description (+5, was +3)
                if cat in tool_desc_lower:
                    score += 5

            # Action match in name
            for action in actions:
                if action in tool_name_lower:
                    score += 8

            # Query word matches in description
            query_words = set(query.split())
            desc_words = set(tool_desc_lower.split())
            common_words = query_words & desc_words
            score += len(common_words) * 2

            # Boost read-only tools for "get"/"list" queries
            if "get" in actions or "list" in actions:
                if not tool.requires_write:
                    score += 5

            # Boost write tools for "create"/"update"/"delete" queries
            if any(a in actions for a in ["create", "update", "delete"]):
                if tool.requires_write:
                    score += 5

            # Apply health score adjustment (0.5-1.0 multiplier for healthy tools)
            health_score = self.health_tracker.get_health_score(tool.name)
            if health_score < 1.0:
                # Reduce score proportionally to health
                # A tool with 0.5 health gets 50% of its score
                adjusted_score = int(score * health_score)
                if adjusted_score != score:
                    logger.debug(
                        f"[ToolSelector] Health adjustment for {tool.name}: "
                        f"{score} -> {adjusted_score} (health: {health_score:.2f})"
                    )
                score = adjusted_score

            scored.append((tool, score))

        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)

        return scored

    def _select_top_tools(
        self,
        scored_tools: List[tuple],
        max_tools: int,
    ) -> List[Tool]:
        """Select top scored tools."""
        # Reserve slots for: meta-tool (1) + always-include tools (canvas, etc.)
        reserved_slots = 1 + len(ALWAYS_INCLUDE_TOOLS)
        limit = max_tools - reserved_slots
        return [tool for tool, _ in scored_tools[:limit]]

    def _add_essential_tools(
        self,
        tools: List[Tool],
        platforms: List[str],
        max_tools: int,
        categories: Optional[List[str]] = None,
    ) -> List[Tool]:
        """Add essential bootstrap tools for detected platforms AND categories.

        These tools are needed to start most workflows (get org ID, find networks, etc.)
        and should always be included when a platform is detected.

        Also adds category-specific essential tools (e.g., VLAN tools for appliance queries).
        Also adds ALWAYS_INCLUDE_TOOLS (e.g., canvas tools) regardless of platform.
        """
        selected_names = {t.name for t in tools}
        categories = categories or []

        # Add always-include tools first (canvas tools, etc.)
        # These slots were pre-reserved in _select_top_tools so we always add them
        for tool_name in ALWAYS_INCLUDE_TOOLS:
            if tool_name not in selected_names:
                tool = self.registry.get(tool_name)
                if tool:
                    tools.append(tool)
                    selected_names.add(tool_name)
                    logger.debug(f"[ToolSelector] Added always-include tool: {tool_name}")

        # Add platform essential tools
        for platform in platforms:
            essential_names = ESSENTIAL_TOOLS.get(platform, [])
            for tool_name in essential_names:
                if tool_name not in selected_names and len(tools) < max_tools - 1:
                    tool = self.registry.get(tool_name)
                    if tool:
                        tools.append(tool)
                        selected_names.add(tool_name)
                        logger.debug(f"[ToolSelector] Added platform essential tool: {tool_name}")

        # Add category-specific essential tools
        for category in categories:
            category_essential = CATEGORY_ESSENTIAL_TOOLS.get(category, [])
            for tool_name in category_essential:
                if tool_name not in selected_names and len(tools) < max_tools - 1:
                    tool = self.registry.get(tool_name)
                    if tool:
                        tools.append(tool)
                        selected_names.add(tool_name)
                        logger.debug(f"[ToolSelector] Added category essential tool: {tool_name} for {category}")

        return tools

    def _ensure_diversity(
        self,
        tools: List[Tool],
        platforms: List[str],
        max_tools: int,
    ) -> List[Tool]:
        """Ensure tool diversity across platforms."""
        if len(platforms) <= 1 or len(tools) >= max_tools:
            return tools

        # Count tools per platform
        platform_counts = {}
        for tool in tools:
            platform_counts[tool.platform] = platform_counts.get(tool.platform, 0) + 1

        # If a platform has no tools, add some
        for platform in platforms:
            if platform_counts.get(platform, 0) == 0:
                platform_tools = self.registry.get_tools_by_platform(platform)[:3]
                for pt in platform_tools:
                    if len(tools) < max_tools and pt not in tools:
                        tools.append(pt)

        return tools


# Singleton instance
_tool_selector: Optional[ToolSelector] = None


def get_tool_selector() -> ToolSelector:
    """Get the singleton tool selector instance."""
    global _tool_selector
    if _tool_selector is None:
        _tool_selector = ToolSelector()
    return _tool_selector


# Convenience function
async def select_tools_for_query(
    query: str,
    org_context: Optional[Dict] = None,
    max_tools: int = 25,
    credentials: Optional[Dict] = None,
) -> List[Tool]:
    """
    Select relevant tools for a query.

    Args:
        query: The user's query text
        org_context: Context about the organization
        max_tools: Maximum tools to return
        credentials: Available credentials to filter platforms

    Returns:
        List of selected tools
    """
    selector = get_tool_selector()
    result = await selector.select_tools(
        query=query,
        org_context=org_context,
        max_tools=max_tools,
        credentials=credentials,
    )
    return result.tools
