"""Card Generator Agent - Claude-based UI card generation.

This agent receives data and uses Claude to generate appropriate card
configurations for the frontend to render.

Following the hybrid approach:
- Predefined component library (chart, table, metrics, topology, etc.)
- Claude outputs structured JSON describing how to compose them
- Frontend dynamically renders based on validated JSON
"""

import logging
import json
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import anthropic

from .types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    A2AMessage,
    TextPart,
    DataPart,
)
from .registry import get_agent_registry

logger = logging.getLogger(__name__)

# ============================================================================
# Card Types and Schemas
# ============================================================================

CARD_TYPES = [
    "network-health",
    "client-distribution",
    "performance-chart",
    "device-table",
    "topology",
    "alert-summary",
    "custom"
]

CHART_TYPES = ["bar", "line", "area", "pie", "donut", "sparkline"]

# System prompt for Claude
CARD_GENERATION_SYSTEM_PROMPT = """You are a UI Card Generator Agent. Your job is to analyze data and generate appropriate card configurations for visualization.

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.

Available card types:
- network-health: For metrics/KPIs (use MetricsProps)
- client-distribution: For pie/bar charts of distributions (use ChartProps)
- performance-chart: For time series or performance data (use ChartProps)
- device-table: For tabular data (use TableProps)
- topology: For network topology/node visualization (use TopologyProps)
- alert-summary: For alerts/notifications list (use AlertProps)
- custom: Fallback for any other data (use CustomProps)

Output JSON schema:
{
  "cardType": "<one of the card types>",
  "title": "<concise, descriptive title>",
  "props": {
    // Props depend on cardType:

    // For charts (ChartProps):
    "chartType": "bar|line|area|pie|donut|sparkline",
    "data": [{"label": "...", "value": 123}],
    "xAxisLabel": "optional",
    "yAxisLabel": "optional",
    "showLegend": false,
    "interactive": true

    // For tables (TableProps):
    "columns": [{"key": "col1", "label": "Column 1", "sortable": true}],
    "data": [{"col1": "value1"}],
    "pageSize": 10,
    "searchable": true

    // For metrics (MetricsProps):
    "metrics": [{"label": "Metric", "value": 123, "unit": "ms", "trend": "up|down|stable"}],
    "layout": "grid|row|compact"

    // For topology (TopologyProps):
    "nodes": [{"id": "1", "label": "Node 1", "type": "device", "status": "online|offline|warning"}],
    "edges": [{"source": "1", "target": "2"}],
    "layout": "force|grid|hierarchical"

    // For alerts (AlertProps):
    "alerts": [{"message": "...", "severity": "critical|error|warning|info", "timestamp": "..."}],
    "showTimestamps": true,
    "groupBy": "severity|source|none"

    // For custom (CustomProps):
    "content": <any>,
    "format": "json|text|markdown"
  },
  "layout": {"width": 4, "height": 3}  // grid units, width 2-12, height 2-8
}

Rules:
1. Analyze the data structure to pick the BEST card type
2. Extract and transform data into the correct props format
3. Keep titles concise (max 30 chars)
4. Choose appropriate chart types for the data
5. For tables, limit to 6 columns max
6. For topology, limit to 20 nodes
7. Always return valid JSON - no explanations"""

# ============================================================================
# Card Generator Agent Class
# ============================================================================

class CardGeneratorAgent:
    """Agent that generates UI card configurations using Claude."""

    AGENT_ID = "card-generator"

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Card Generator Agent.

        Args:
            api_key: Anthropic API key (optional, uses ANTHROPIC_API_KEY env var)
        """
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self._register_agent()

    def _register_agent(self) -> None:
        """Register this agent with the A2A registry."""
        card = AgentCard(
            id=self.AGENT_ID,
            name="Card Generator Agent",
            description="Generates UI card configurations from data using Claude. "
                       "Analyzes data structure and outputs structured JSON for frontend rendering.",
            provider=AgentProvider(
                organization="Lumen",
                url=None,
            ),
            capabilities=AgentCapabilities(
                streaming=False,
                pushNotifications=False,
                stateTransitionHistory=True,
            ),
            skills=[
                AgentSkill(
                    id="ui-card-generation",
                    name="UI Card Generation",
                    description="Generate appropriate UI card configurations from data",
                    tags=["visualization", "ui-generation", "card-creation"],
                    examples=[
                        "create a card for this device data",
                        "visualize these metrics",
                        "generate a chart for performance data",
                    ],
                ),
                AgentSkill(
                    id="data-analysis",
                    name="Data Analysis for Visualization",
                    description="Analyze data structure to determine best visualization",
                    tags=["analysis", "data-inspection"],
                    examples=[
                        "what's the best way to show this data",
                        "analyze this data for visualization",
                    ],
                ),
            ],
            role="ui-generator",
            priority=5,
        )

        registry = get_agent_registry()
        registry.register(card, handler=self.handle_message)
        logger.info(f"[CardGeneratorAgent] Registered with A2A registry")

    async def handle_message(self, message: A2AMessage) -> A2AMessage:
        """Handle incoming A2A messages.

        Args:
            message: The incoming message with data to visualize

        Returns:
            A2AMessage containing the generated card configuration
        """
        # Extract data from message parts
        data_to_visualize = None
        context = ""

        for part in message.parts:
            if isinstance(part, DataPart):
                data_to_visualize = part.data
            elif isinstance(part, TextPart):
                context = part.text

        if data_to_visualize is None:
            # Try to parse text as JSON
            for part in message.parts:
                if isinstance(part, TextPart):
                    try:
                        data_to_visualize = json.loads(part.text)
                        break
                    except json.JSONDecodeError:
                        continue

        if data_to_visualize is None:
            return self._error_response("No data provided for card generation")

        # Generate card configuration
        result = await self.generate_card(data_to_visualize, context)

        return A2AMessage(
            role="agent",
            parts=[DataPart(data=result)],
            sourceAgentId=self.AGENT_ID,
        )

    async def generate_card(
        self,
        data: Any,
        context: str = "",
        preferred_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a card configuration from data using Claude.

        Args:
            data: The data to visualize
            context: Optional context about what the user wants
            preferred_type: Optional preferred card type

        Returns:
            Card configuration dict
        """
        # Build the user message
        user_message = self._build_user_message(data, context, preferred_type)

        try:
            # Call Claude
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=CARD_GENERATION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )

            # Extract response text
            response_text = response.content[0].text.strip()

            # Parse JSON response
            card_config = json.loads(response_text)

            # Add generation metrics
            card_config["metrics"] = {
                "tokensIn": response.usage.input_tokens,
                "tokensOut": response.usage.output_tokens,
                "cost": self._calculate_cost(response.usage),
            }

            logger.info(f"[CardGeneratorAgent] Generated {card_config.get('cardType')} card: {card_config.get('title')}")

            return {
                "success": True,
                "card": card_config,
            }

        except json.JSONDecodeError as e:
            logger.error(f"[CardGeneratorAgent] Failed to parse Claude response: {e}")
            return self._fallback_card(data, str(e))
        except Exception as e:
            logger.error(f"[CardGeneratorAgent] Error generating card: {e}")
            return self._fallback_card(data, str(e))

    def _build_user_message(
        self,
        data: Any,
        context: str,
        preferred_type: Optional[str],
    ) -> str:
        """Build the user message for Claude."""
        parts = []

        if context:
            parts.append(f"Context: {context}")

        if preferred_type and preferred_type in CARD_TYPES:
            parts.append(f"Preferred card type: {preferred_type}")

        # Add data (truncate if too large)
        data_str = json.dumps(data, indent=2, default=str)
        if len(data_str) > 8000:
            data_str = data_str[:8000] + "\n... (truncated)"

        parts.append(f"Data to visualize:\n```json\n{data_str}\n```")
        parts.append("Generate the card configuration JSON:")

        return "\n\n".join(parts)

    def _calculate_cost(self, usage) -> float:
        """Calculate cost based on Claude Sonnet pricing."""
        # Sonnet 4: $3/M input, $15/M output
        input_cost = (usage.input_tokens / 1_000_000) * 3
        output_cost = (usage.output_tokens / 1_000_000) * 15
        return round(input_cost + output_cost, 6)

    def _fallback_card(self, data: Any, error: str) -> Dict[str, Any]:
        """Generate a fallback custom card when generation fails."""
        return {
            "success": False,
            "error": error,
            "card": {
                "cardType": "custom",
                "title": "Data Summary",
                "props": {
                    "content": data,
                    "format": "json",
                },
                "layout": {"width": 4, "height": 3},
            },
        }

    def _error_response(self, error: str) -> A2AMessage:
        """Create an error response message."""
        return A2AMessage(
            role="agent",
            parts=[DataPart(data={"success": False, "error": error})],
            sourceAgentId=self.AGENT_ID,
        )


# ============================================================================
# Singleton Instance
# ============================================================================

_agent_instance: Optional[CardGeneratorAgent] = None


def get_card_generator_agent() -> CardGeneratorAgent:
    """Get or create the Card Generator Agent singleton."""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = CardGeneratorAgent()
    return _agent_instance


def initialize_card_generator_agent(api_key: Optional[str] = None) -> CardGeneratorAgent:
    """Initialize the Card Generator Agent with optional API key."""
    global _agent_instance
    _agent_instance = CardGeneratorAgent(api_key=api_key)
    return _agent_instance
