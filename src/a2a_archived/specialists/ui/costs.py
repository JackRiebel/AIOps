"""Cost Tracking Card Skills Module.

Provides skills for generating AI/API cost tracking cards:
- CostTrackingCard: Token costs, API usage, and spending trends
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
import logging

from ...types import AgentSkill
from .base import (
    UICardModule,
    CardType,
    StatusLevel,
    MetricTileData,
)
from .api_client import build_card_skill_result

logger = logging.getLogger(__name__)


class CostsModule(UICardModule):
    """Module for cost tracking card skills."""

    MODULE_NAME = "costs"
    MODULE_DESCRIPTION = "AI and API cost tracking cards"

    SKILL_IDS = [
        "generate-cost-tracking-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get cost tracking skills."""
        return [
            AgentSkill(
                id="generate-cost-tracking-card",
                name="Generate Cost Tracking Card",
                description="Generate a card showing AI/API costs, token usage, and spending trends",
                tags=["costs", "billing", "tokens", "usage", "spending", "analytics"],
                examples=[
                    "Show AI costs",
                    "What's our API spending?",
                    "Token usage report",
                    "Cost breakdown",
                ],
            ),
        ]

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        """Check if this module handles the skill."""
        return skill_id in cls.SKILL_IDS

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        params: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        """Execute a cost tracking skill."""
        org_id = params.get("org_id", "")

        if skill_id == "generate-cost-tracking-card":
            return await cls._generate_cost_tracking_card(org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_cost_tracking_card(
        cls,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate cost tracking card data."""
        now = datetime.utcnow()

        # Model breakdown
        models = [
            {"name": "Claude Opus", "cost": 45.20, "percentage": 52, "color": "#9B59B6"},
            {"name": "Claude Sonnet", "cost": 28.50, "percentage": 33, "color": "#3498DB"},
            {"name": "Claude Haiku", "cost": 8.30, "percentage": 10, "color": "#1ABC9C"},
            {"name": "Embeddings", "cost": 4.50, "percentage": 5, "color": "#F39C12"},
        ]

        total_cost = sum(m["cost"] for m in models)

        # Daily costs for sparkline
        daily_costs = [
            {"date": (now - timedelta(days=6)).strftime("%Y-%m-%d"), "cost": 12.50},
            {"date": (now - timedelta(days=5)).strftime("%Y-%m-%d"), "cost": 15.30},
            {"date": (now - timedelta(days=4)).strftime("%Y-%m-%d"), "cost": 11.20},
            {"date": (now - timedelta(days=3)).strftime("%Y-%m-%d"), "cost": 18.90},
            {"date": (now - timedelta(days=2)).strftime("%Y-%m-%d"), "cost": 14.60},
            {"date": (now - timedelta(days=1)).strftime("%Y-%m-%d"), "cost": 9.80},
            {"date": now.strftime("%Y-%m-%d"), "cost": 4.20},
        ]

        # Top operations by cost
        top_operations = [
            {"name": "Chat Completions", "cost": 52.30, "requests": 1250},
            {"name": "Code Analysis", "cost": 18.40, "requests": 420},
            {"name": "Document Processing", "cost": 12.80, "requests": 89},
            {"name": "Embeddings Generation", "cost": 4.50, "requests": 3400},
        ]

        cost_data = {
            "models": models,
            "daily_costs": daily_costs,
            "top_operations": top_operations,
            "sparkline": [d["cost"] for d in daily_costs],
            "metrics": [
                MetricTileData(
                    label="Today",
                    value=f"${daily_costs[-1]['cost']:.2f}",
                    trend_direction="down",
                    trend_percent=25.0,
                ).to_dict(),
                MetricTileData(
                    label="This Week",
                    value=f"${total_cost:.2f}",
                ).to_dict(),
                MetricTileData(
                    label="Requests",
                    value="5.2k",
                    trend_direction="up",
                    trend_percent=8.0,
                ).to_dict(),
                MetricTileData(
                    label="Avg Cost/Req",
                    value="$0.017",
                ).to_dict(),
            ],
            "budget": {
                "limit": 500.00,
                "used": total_cost,
                "remaining": 500.00 - total_cost,
                "percentage": (total_cost / 500.00) * 100,
            },
            "time_range": "Last 7 days",
        }

        return build_card_skill_result(
            card_type=CardType.COST_TRACKING.value,
            data=cost_data,
            endpoint=f"/api/cards/cost-tracking/{org_id or 'default'}/data",
            polling_interval=60000,
            source="system",
            entity_id=org_id,
        )
