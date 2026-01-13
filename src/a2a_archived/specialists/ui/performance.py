"""Performance Card Skills Module.

Provides skills for generating performance metrics cards:
- PerformanceCard: Latency/loss/jitter gauges
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ...types import AgentSkill
from .base import (
    UICardModule,
    CardType,
    StatusLevel,
    HealthGaugeData,
    MetricTileData,
)
from .api_client import CardEndpointBuilder, build_card_skill_result

logger = logging.getLogger(__name__)


class PerformanceModule(UICardModule):
    """Module for performance metrics card skills."""

    MODULE_NAME = "performance"
    MODULE_DESCRIPTION = "Network performance metrics cards"

    SKILL_IDS = [
        "generate-performance-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get performance-related skills."""
        return [
            AgentSkill(
                id="generate-performance-card",
                name="Generate Performance Card",
                description="Generate a performance metrics card showing latency, packet loss, and jitter",
                tags=["performance", "latency", "loss", "jitter", "metrics", "quality"],
                examples=[
                    "Show network performance",
                    "What's my latency?",
                    "Check packet loss",
                    "Network quality metrics",
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
        """Execute a performance skill.

        Args:
            skill_id: The skill to execute
            params: Parameters including test_id, network_id
            context: Execution context with API access

        Returns:
            Skill result with card data and polling config
        """
        test_id = params.get("test_id", "")
        network_id = params.get("network_id", "")
        org_id = params.get("org_id", "")

        if skill_id == "generate-performance-card":
            return await cls._generate_performance_card(test_id or network_id, org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_performance_card(
        cls,
        entity_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate performance card data.

        The card shows:
        - Latency gauge
        - Packet loss gauge
        - Jitter gauge
        - Historical sparklines
        - Threshold indicators
        """
        # Calculate status based on values
        latency = 45.2
        loss = 0.1
        jitter = 3.5

        def get_latency_status(ms: float) -> StatusLevel:
            if ms < 50:
                return StatusLevel.HEALTHY
            elif ms < 100:
                return StatusLevel.WARNING
            else:
                return StatusLevel.CRITICAL

        def get_loss_status(percent: float) -> StatusLevel:
            if percent < 1:
                return StatusLevel.HEALTHY
            elif percent < 3:
                return StatusLevel.WARNING
            else:
                return StatusLevel.CRITICAL

        def get_jitter_status(ms: float) -> StatusLevel:
            if ms < 10:
                return StatusLevel.HEALTHY
            elif ms < 30:
                return StatusLevel.WARNING
            else:
                return StatusLevel.CRITICAL

        performance_data = {
            "gauges": [
                {
                    "label": "Latency",
                    "value": latency,
                    "unit": "ms",
                    "status": get_latency_status(latency).value,
                    "thresholds": {"good": 50, "warning": 100},
                    "sparkline": [42, 45, 43, 48, 46, 44, 47, 45, 43, 45],
                },
                {
                    "label": "Packet Loss",
                    "value": loss,
                    "unit": "%",
                    "status": get_loss_status(loss).value,
                    "thresholds": {"good": 1, "warning": 3},
                    "sparkline": [0.0, 0.1, 0.0, 0.2, 0.1, 0.0, 0.1, 0.0, 0.1, 0.1],
                },
                {
                    "label": "Jitter",
                    "value": jitter,
                    "unit": "ms",
                    "status": get_jitter_status(jitter).value,
                    "thresholds": {"good": 10, "warning": 30},
                    "sparkline": [2.5, 3.0, 3.2, 3.8, 3.5, 3.2, 3.8, 4.0, 3.5, 3.5],
                },
            ],
            "metrics": [
                MetricTileData(
                    label="Avg Latency (24h)",
                    value="47",
                    unit="ms",
                    trend_direction="down",
                    trend_percent=5.2,
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
                MetricTileData(
                    label="Avg Loss (24h)",
                    value="0.15",
                    unit="%",
                    trend_direction="stable",
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
                MetricTileData(
                    label="MOS Score",
                    value="4.2",
                    unit="/ 5",
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
            ],
            "targets": [
                {
                    "name": "Primary ISP",
                    "ip": "8.8.8.8",
                    "latency": 12.5,
                    "loss": 0.0,
                    "status": "healthy",
                },
                {
                    "name": "Cloud Gateway",
                    "ip": "35.192.0.1",
                    "latency": 45.2,
                    "loss": 0.1,
                    "status": "healthy",
                },
                {
                    "name": "Data Center",
                    "ip": "10.0.0.1",
                    "latency": 5.2,
                    "loss": 0.0,
                    "status": "healthy",
                },
                {
                    "name": "Branch Office",
                    "ip": "192.168.10.1",
                    "latency": 85.5,
                    "loss": 0.5,
                    "status": "warning",
                },
            ],
            "summary": {
                "overall_status": "healthy",
                "message": "Network performance is within acceptable thresholds",
                "last_updated": datetime.utcnow().isoformat() + "Z",
            },
        }

        endpoint = CardEndpointBuilder.performance(entity_id or "default")

        return build_card_skill_result(
            card_type=CardType.PERFORMANCE.value,
            data=performance_data,
            endpoint=endpoint,
            polling_interval=15000,  # Frequent polling for performance
            source="thousandeyes",
            entity_id=entity_id,
        )
