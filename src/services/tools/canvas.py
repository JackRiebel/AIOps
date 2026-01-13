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
CANVAS_CARD_TYPES = {
    # Core monitoring cards
    "network-health": "Overall network health dashboard with status indicators and health scores",
    "device-table": "Table listing devices with status, model, IP, and metrics",
    "topology": "Interactive network topology visualization showing device connections",
    "alert-summary": "Summary of active alerts with severity breakdown",
    "performance-chart": "Time-series performance chart for metrics like latency, throughput",
    "client-distribution": "Distribution of clients across the network",

    # Device-centric cards
    "device-detail": "Detailed view of a specific device with all its properties",
    "device-status": "Quick status overview of a device",
    "client-list": "List of clients connected to a device or network",
    "uplink-status": "WAN/uplink connection status and metrics",
    "switch-ports": "Switch port status and configuration overview",

    # Infrastructure monitoring
    "bandwidth-utilization": "Bandwidth usage gauge or chart",
    "latency-monitor": "Latency metrics visualization",
    "packet-loss": "Packet loss percentage indicator",
    "cpu-memory-health": "CPU and memory utilization for devices",
    "uptime-tracker": "Device uptime tracking",
    "wan-failover": "WAN failover status and history",

    # Traffic analytics
    "top-talkers": "Top bandwidth consumers (clients or applications)",
    "traffic-composition": "Traffic breakdown by protocol or application",
    "application-usage": "Application usage statistics",
    "traffic-heatmap": "Traffic patterns over time as a heatmap",

    # Security cards
    "security-events": "Security events and alerts timeline",
    "threat-map": "Geographic map showing threat origins",
    "firewall-hits": "Firewall rule hit counts",
    "blocked-connections": "Blocked connection attempts",

    # Wireless cards
    "rf-analysis": "RF environment analysis for access points",
    "channel-utilization-heatmap": "Wireless channel utilization",
    "client-signal-strength": "Client signal strength distribution",
    "ssid-client-breakdown": "Client count per SSID",
    "roaming-events": "Client roaming events timeline",

    # Alerts & incidents
    "alert-timeline": "Timeline view of alerts",
    "incident-tracker": "Active incidents with status and assignments",
    "alert-correlation": "Correlated alerts grouped by root cause",

    # Splunk integration
    "splunk-search-results": "Results from a Splunk search",
    "log-volume-trend": "Log volume over time",
    "error-distribution": "Error distribution by type or source",

    # Knowledge base
    "knowledge-sources": "Source documents/citations used for a knowledge-based response. Use when answering questions from documentation or datasheets.",
    "product-detail": "Product datasheet or specification card. Use when providing details about a specific product.",
    "datasheet-comparison": "Side-by-side comparison of multiple products. Use when comparing features, specs, or capabilities of 2+ products.",

    # AI Contextual cards (data provided by AI, not fetched)
    "ai-metric": "Single key metric display (e.g., '91% success rate'). Use for highlighting one important value.",
    "ai-stats-grid": "Grid of 2-6 related stats. Use for showing multiple metrics at once.",
    "ai-gauge": "Circular gauge for percentages/utilization. Use for CPU/memory/bandwidth percentage.",
    "ai-breakdown": "Pie/donut/bar chart for distributions. Use for showing category breakdowns.",
    "ai-finding": "Important finding or alert card. Use for highlighting issues or recommendations.",
    "ai-device-summary": "Device summary card with status and attributes. Use for specific device info.",
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
        title = card_type.replace("-", " ").title()

    # Build card suggestion payload
    # This will be emitted as a card_suggestion SSE event
    card_suggestion = {
        "type": card_type,
        "title": title,
        "data": data,
        "metadata": {
            "network_id": network_id,
            "org_id": org_id,
            "source": "ai_tool",
            **config,
        }
    }

    logger.info(f"[CanvasTool] AI requested card: type={card_type}, title={title}")

    return {
        "success": True,
        "card_suggestion": card_suggestion,
        "message": f"Added {card_type} card: {title}",
    }


async def canvas_add_dashboard_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Add multiple cards as a cohesive dashboard layout.

    This tool allows the AI to create multi-card layouts for
    comprehensive views (e.g., incident investigation, performance debug).

    Args:
        params:
            - scenario: Predefined scenario ('incident', 'performance', 'security', 'wireless', 'overview')
            - cards: OR list of card specifications [{type, title, data?}]
            - layout_title: Optional title for the card group
        context: Execution context

    Returns:
        Multiple card suggestions to be added to canvas
    """
    scenario = params.get("scenario")
    cards = params.get("cards", [])
    layout_title = params.get("layout_title", "Dashboard")

    # Predefined scenario layouts
    SCENARIOS = {
        "incident": [
            {"type": "incident-tracker", "title": "Active Incidents"},
            {"type": "network-health", "title": "Network Health"},
            {"type": "alert-timeline", "title": "Alert Timeline"},
        ],
        "performance": [
            {"type": "latency-monitor", "title": "Latency"},
            {"type": "bandwidth-utilization", "title": "Bandwidth"},
            {"type": "packet-loss", "title": "Packet Loss"},
        ],
        "security": [
            {"type": "threat-map", "title": "Threat Map"},
            {"type": "security-events", "title": "Security Events"},
            {"type": "blocked-connections", "title": "Blocked Connections"},
        ],
        "wireless": [
            {"type": "rf-analysis", "title": "RF Analysis"},
            {"type": "client-distribution", "title": "Client Distribution"},
            {"type": "channel-utilization-heatmap", "title": "Channel Utilization"},
        ],
        "overview": [
            {"type": "network-health", "title": "Network Health"},
            {"type": "alert-summary", "title": "Alerts"},
            {"type": "device-table", "title": "Devices"},
        ],
    }

    # Use scenario or custom cards
    if scenario and scenario in SCENARIOS:
        cards = SCENARIOS[scenario]
    elif not cards:
        return {
            "success": False,
            "error": "Must provide either 'scenario' or 'cards' parameter",
            "available_scenarios": list(SCENARIOS.keys()),
        }

    # Validate all card types
    for card in cards:
        if card.get("type") not in CANVAS_CARD_TYPES:
            return {
                "success": False,
                "error": f"Unknown card type: '{card.get('type')}'",
            }

    # Generate card suggestions
    card_suggestions = [
        {
            "type": card["type"],
            "title": card.get("title", card["type"].replace("-", " ").title()),
            "data": card.get("data"),
            "metadata": {
                "layout_group": layout_title,
                "source": "ai_tool",
                **card.get("config", {}),
            }
        }
        for card in cards
    ]

    logger.info(f"[CanvasTool] AI requested dashboard: {len(card_suggestions)} cards for '{layout_title}'")

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
    # Group cards by category
    categories = {
        "AI Contextual (PREFERRED - you provide the data)": [
            "ai-metric", "ai-stats-grid", "ai-gauge", "ai-breakdown", "ai-finding", "ai-device-summary"
        ],
        "Monitoring": ["network-health", "device-table", "topology", "alert-summary", "performance-chart"],
        "Device Status": ["device-detail", "device-status", "client-list", "uplink-status", "switch-ports"],
        "Infrastructure": ["bandwidth-utilization", "latency-monitor", "packet-loss", "cpu-memory-health"],
        "Traffic": ["top-talkers", "traffic-composition", "application-usage", "traffic-heatmap"],
        "Security": ["security-events", "threat-map", "firewall-hits", "blocked-connections"],
        "Wireless": ["rf-analysis", "channel-utilization-heatmap", "client-signal-strength", "ssid-client-breakdown"],
        "Incidents": ["alert-timeline", "incident-tracker", "alert-correlation"],
        "Splunk": ["splunk-search-results", "log-volume-trend", "error-distribution"],
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

ALWAYS USE THIS TOOL when you have data worth visualizing. Cards make responses more actionable.

== KNOWLEDGE & PRODUCT CARDS (for documentation/datasheet questions) ==

- knowledge-sources: Use when answering questions from documentation, datasheets, or your knowledge base.
  Set citations parameter with document references.
  Example: User asks "What are the specs of Catalyst 9300?" → Add knowledge-sources card with citations.

- datasheet-comparison: Use when comparing 2+ products side by side.
  Set products parameter with product comparison data.
  Example: User asks "Compare MR46 vs MR56" → Add datasheet-comparison card.

- product-detail: Use when providing details about a single specific product.
  Include product specs in card_data.

== AI CONTEXTUAL CARDS (for live data you already retrieved) ==

- ai-metric: Single key metric (91% success rate)
- ai-stats-grid: Grid of 2-6 related stats
- ai-gauge: Circular gauge for percentages
- ai-breakdown: Pie/donut/bar chart for distributions
- ai-finding: Important finding or alert
- ai-device-summary: Device summary with status

Use these when you already retrieved data and have specific values to show.

== LIVE DATA CARDS (fetch their own data) ==

- network-health, device-table, topology, etc.
- Use when user wants real-time monitoring
- Card will poll for updates automatically

IMPORTANT: After calling this tool, briefly confirm to the user that you've added the card.
IMPORTANT: Only add ONE card per topic. Check if a similar card already exists on the canvas.

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
                    "card_type": "ai-stats-grid",
                    "title": "Wireless Health Summary",
                    "card_data": {
                        "stats": [
                            {"label": "Success Rate", "value": "91%", "status": "good"},
                            {"label": "Connected Clients", "value": "47", "status": "good"},
                            {"label": "High Utilization APs", "value": "3", "status": "warning"},
                        ]
                    }
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
                "query": "Compare MR46 vs MR56",
                "params": {
                    "card_type": "datasheet-comparison",
                    "title": "Product Comparison",
                    "products": [
                        {"name": "MR46", "specs": {"WiFi": "WiFi 6", "Antennas": "4x4:4"}},
                        {"name": "MR56", "specs": {"WiFi": "WiFi 6", "Antennas": "8x8:8"}}
                    ]
                }
            },
            {
                "query": "Show me network topology",
                "params": {"card_type": "topology", "title": "Network Topology"}
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

USE THIS TOOL WHEN:
- User asks for a "dashboard" or wants to see "everything about" a topic
- User is investigating an incident and needs multiple views
- User wants a comprehensive monitoring setup
- User asks to "set up" or "create" a view for ongoing monitoring

PREDEFINED SCENARIOS (use scenario parameter):
- incident: Incident tracker + Network health + Alert timeline (for troubleshooting)
- performance: Latency + Bandwidth + Packet loss (for performance issues)
- security: Threat map + Security events + Blocked connections (for security review)
- wireless: RF analysis + Client distribution + Channel utilization (for wireless issues)
- overview: Network health + Alerts + Device table (for general monitoring)

After calling this tool, confirm to the user: "I've added a [scenario] dashboard with X cards to your canvas."

Use 'scenario' for common layouts, or 'cards' for custom combinations.""",
        platform="canvas",
        category="visualization",
        properties={
            "scenario": {
                "type": "string",
                "description": "Predefined scenario layout",
                "enum": ["incident", "performance", "security", "wireless", "overview"],
            },
            "cards": {
                "type": "array",
                "description": "Custom list of cards [{type, title, data?}]",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "title": {"type": "string"},
                    }
                }
            },
            "layout_title": {
                "type": "string",
                "description": "Title for the dashboard group",
            },
        },
        required=[],
        handler=canvas_add_dashboard_handler,
        tags=["canvas", "visualization", "dashboard", "ui"],
        examples=[
            {
                "query": "I need to investigate a network incident",
                "params": {"scenario": "incident", "layout_title": "Incident Investigation"}
            },
            {
                "query": "Show me a wireless health dashboard",
                "params": {"scenario": "wireless", "layout_title": "Wireless Health"}
            },
        ],
    ),
]


def register_canvas_tools():
    """Register all canvas visualization tools."""
    registry = get_tool_registry()
    registry.register_many(CANVAS_TOOLS)
    logger.info(f"[CanvasTools] Registered {len(CANVAS_TOOLS)} canvas tools")


# Auto-register when imported
# Note: Registration happens via tool_registry._load_all_tools()
