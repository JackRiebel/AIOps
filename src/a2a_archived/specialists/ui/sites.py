"""Site Health Card Skills Module.

Provides skills for generating multi-site health aggregation cards:
- SiteHealthCard: Health overview across multiple sites/networks
"""

from typing import List, Dict, Any
from datetime import datetime
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


class SitesModule(UICardModule):
    """Module for multi-site health card skills."""

    MODULE_NAME = "sites"
    MODULE_DESCRIPTION = "Multi-site health aggregation cards"

    SKILL_IDS = [
        "generate-site-health-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get site health skills."""
        return [
            AgentSkill(
                id="generate-site-health-card",
                name="Generate Site Health Card",
                description="Generate a card showing health status across multiple sites/locations",
                tags=["sites", "locations", "multi-site", "health", "overview", "organization"],
                examples=[
                    "Show site health",
                    "How are all sites doing?",
                    "Multi-site overview",
                    "Which sites have issues?",
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
        """Execute a site health skill."""
        org_id = params.get("org_id", "")

        if skill_id == "generate-site-health-card":
            return await cls._generate_site_health_card(org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_site_health_card(
        cls,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate site health card data."""

        sites = [
            {
                "id": "site-1",
                "name": "HQ - San Francisco",
                "location": "San Francisco, CA",
                "health_score": 98,
                "status": StatusLevel.HEALTHY.value,
                "devices": 45,
                "clients": 312,
                "alerts": 0,
            },
            {
                "id": "site-2",
                "name": "Branch - New York",
                "location": "New York, NY",
                "health_score": 85,
                "status": StatusLevel.HEALTHY.value,
                "devices": 28,
                "clients": 156,
                "alerts": 2,
            },
            {
                "id": "site-3",
                "name": "Branch - Chicago",
                "location": "Chicago, IL",
                "health_score": 62,
                "status": StatusLevel.WARNING.value,
                "devices": 18,
                "clients": 89,
                "alerts": 5,
            },
            {
                "id": "site-4",
                "name": "DC - Dallas",
                "location": "Dallas, TX",
                "health_score": 95,
                "status": StatusLevel.HEALTHY.value,
                "devices": 52,
                "clients": 0,
                "alerts": 1,
            },
            {
                "id": "site-5",
                "name": "Branch - Seattle",
                "location": "Seattle, WA",
                "health_score": 35,
                "status": StatusLevel.CRITICAL.value,
                "devices": 12,
                "clients": 45,
                "alerts": 8,
            },
            {
                "id": "site-6",
                "name": "Remote - London",
                "location": "London, UK",
                "health_score": 91,
                "status": StatusLevel.HEALTHY.value,
                "devices": 15,
                "clients": 67,
                "alerts": 0,
            },
        ]

        # Calculate aggregates
        total_devices = sum(s["devices"] for s in sites)
        total_clients = sum(s["clients"] for s in sites)
        total_alerts = sum(s["alerts"] for s in sites)
        avg_health = sum(s["health_score"] for s in sites) / len(sites)

        status_counts = {
            "healthy": sum(1 for s in sites if s["status"] == "healthy"),
            "warning": sum(1 for s in sites if s["status"] == "warning"),
            "critical": sum(1 for s in sites if s["status"] == "critical"),
            "offline": sum(1 for s in sites if s["status"] == "offline"),
        }

        # Sort by health score to show worst first
        worst_sites = sorted(sites, key=lambda x: x["health_score"])[:3]

        site_data = {
            "sites": sites,
            "summary": [
                StatusIndicatorData(
                    status=StatusLevel.HEALTHY,
                    label="Healthy",
                    count=status_counts["healthy"],
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.WARNING,
                    label="Degraded",
                    count=status_counts["warning"],
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.CRITICAL,
                    label="Critical",
                    count=status_counts["critical"],
                    pulse=status_counts["critical"] > 0,
                ).to_dict(),
            ],
            "metrics": [
                MetricTileData(
                    label="Total Sites",
                    value=len(sites),
                ).to_dict(),
                MetricTileData(
                    label="Avg Health",
                    value=round(avg_health, 1),
                    unit="%",
                    status=cls.get_status_from_score(avg_health),
                ).to_dict(),
                MetricTileData(
                    label="Total Devices",
                    value=total_devices,
                ).to_dict(),
                MetricTileData(
                    label="Active Alerts",
                    value=total_alerts,
                    status=StatusLevel.WARNING if total_alerts > 0 else StatusLevel.HEALTHY,
                ).to_dict(),
            ],
            "worst_sites": worst_sites,
            "total_clients": total_clients,
        }

        return build_card_skill_result(
            card_type=CardType.SITE_HEALTH.value,
            data=site_data,
            endpoint=f"/api/cards/site-health/{org_id or 'default'}/data",
            polling_interval=30000,
            source="meraki",
            entity_id=org_id,
        )
