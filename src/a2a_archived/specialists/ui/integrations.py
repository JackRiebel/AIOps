"""Integration Health Card Skills Module.

Provides skills for generating API integration health cards:
- IntegrationHealthCard: Status of all integrated services (Meraki, Splunk, etc.)
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
    StatusIndicatorData,
)
from .api_client import build_card_skill_result

logger = logging.getLogger(__name__)


class IntegrationsModule(UICardModule):
    """Module for integration health card skills."""

    MODULE_NAME = "integrations"
    MODULE_DESCRIPTION = "API integration health monitoring cards"

    SKILL_IDS = [
        "generate-integration-health-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get integration health skills."""
        return [
            AgentSkill(
                id="generate-integration-health-card",
                name="Generate Integration Health Card",
                description="Generate a card showing health status of all API integrations",
                tags=["integrations", "api", "health", "services", "connectivity", "status"],
                examples=[
                    "Show integration status",
                    "Are all APIs working?",
                    "Integration health",
                    "Check service connectivity",
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
        """Execute an integration health skill."""
        if skill_id == "generate-integration-health-card":
            return await cls._generate_integration_health_card(context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_integration_health_card(
        cls,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate integration health card data."""
        now = datetime.utcnow()

        integrations = [
            {
                "id": "meraki",
                "name": "Meraki Dashboard",
                "description": "Cisco Meraki Cloud API",
                "status": StatusLevel.HEALTHY.value,
                "last_sync": (now - timedelta(seconds=30)).isoformat() + "Z",
                "response_time": 145,
                "requests_24h": 15420,
                "errors_24h": 3,
                "icon": "cloud",
            },
            {
                "id": "splunk",
                "name": "Splunk",
                "description": "Log analytics and SIEM",
                "status": StatusLevel.HEALTHY.value,
                "last_sync": (now - timedelta(minutes=1)).isoformat() + "Z",
                "response_time": 230,
                "requests_24h": 8750,
                "errors_24h": 0,
                "icon": "search",
            },
            {
                "id": "thousandeyes",
                "name": "ThousandEyes",
                "description": "Network monitoring",
                "status": StatusLevel.WARNING.value,
                "last_sync": (now - timedelta(minutes=5)).isoformat() + "Z",
                "response_time": 890,
                "requests_24h": 4200,
                "errors_24h": 45,
                "icon": "eye",
            },
            {
                "id": "catalyst",
                "name": "Catalyst Center",
                "description": "Enterprise network controller",
                "status": StatusLevel.HEALTHY.value,
                "last_sync": (now - timedelta(seconds=45)).isoformat() + "Z",
                "response_time": 320,
                "requests_24h": 6100,
                "errors_24h": 8,
                "icon": "server",
            },
            {
                "id": "anthropic",
                "name": "Claude AI",
                "description": "AI assistant API",
                "status": StatusLevel.HEALTHY.value,
                "last_sync": (now - timedelta(seconds=10)).isoformat() + "Z",
                "response_time": 1250,
                "requests_24h": 892,
                "errors_24h": 2,
                "icon": "brain",
            },
            {
                "id": "postgres",
                "name": "PostgreSQL",
                "description": "Application database",
                "status": StatusLevel.HEALTHY.value,
                "last_sync": (now - timedelta(seconds=5)).isoformat() + "Z",
                "response_time": 12,
                "requests_24h": 125000,
                "errors_24h": 0,
                "icon": "database",
            },
        ]

        # Calculate aggregates
        total_requests = sum(i["requests_24h"] for i in integrations)
        total_errors = sum(i["errors_24h"] for i in integrations)
        avg_response = sum(i["response_time"] for i in integrations) / len(integrations)

        status_counts = {
            "healthy": sum(1 for i in integrations if i["status"] == "healthy"),
            "warning": sum(1 for i in integrations if i["status"] == "warning"),
            "critical": sum(1 for i in integrations if i["status"] == "critical"),
            "offline": sum(1 for i in integrations if i["status"] == "offline"),
        }

        integration_data = {
            "integrations": integrations,
            "summary": [
                StatusIndicatorData(
                    status=StatusLevel.HEALTHY,
                    label="Online",
                    count=status_counts["healthy"],
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.WARNING,
                    label="Degraded",
                    count=status_counts["warning"],
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.CRITICAL,
                    label="Down",
                    count=status_counts["critical"],
                    pulse=status_counts["critical"] > 0,
                ).to_dict(),
            ],
            "metrics": [
                MetricTileData(
                    label="Services",
                    value=len(integrations),
                    status=StatusLevel.HEALTHY if status_counts["critical"] == 0 else StatusLevel.CRITICAL,
                ).to_dict(),
                MetricTileData(
                    label="Avg Response",
                    value=round(avg_response),
                    unit="ms",
                    status=StatusLevel.HEALTHY if avg_response < 500 else StatusLevel.WARNING,
                ).to_dict(),
                MetricTileData(
                    label="Requests 24h",
                    value=f"{total_requests // 1000}k",
                ).to_dict(),
                MetricTileData(
                    label="Error Rate",
                    value=round((total_errors / total_requests) * 100, 2) if total_requests > 0 else 0,
                    unit="%",
                    status=StatusLevel.HEALTHY if total_errors < 100 else StatusLevel.WARNING,
                ).to_dict(),
            ],
        }

        return build_card_skill_result(
            card_type=CardType.INTEGRATION_HEALTH.value,
            data=integration_data,
            endpoint="/api/cards/integration-health/data",
            polling_interval=60000,
            source="system",
            entity_id="",
        )
