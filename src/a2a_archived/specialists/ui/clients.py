"""Clients Card Skills Module.

Provides skills for generating client distribution cards:
- ClientDistributionCard: Client breakdown by SSID/VLAN/device type
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ...types import AgentSkill
from .base import (
    UICardModule,
    CardType,
    StatusLevel,
    MetricTileData,
)
from .api_client import CardEndpointBuilder, build_card_skill_result

logger = logging.getLogger(__name__)


class ClientsModule(UICardModule):
    """Module for client distribution card skills."""

    MODULE_NAME = "clients"
    MODULE_DESCRIPTION = "Client distribution and connectivity cards"

    SKILL_IDS = [
        "generate-client-distribution-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get client-related skills."""
        return [
            AgentSkill(
                id="generate-client-distribution-card",
                name="Generate Client Distribution Card",
                description="Generate a client distribution card showing clients by SSID, VLAN, or device type",
                tags=["clients", "distribution", "ssid", "wireless", "connected"],
                examples=[
                    "Show client distribution",
                    "How many clients are connected?",
                    "Clients by SSID",
                    "Client breakdown",
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
        """Execute a client skill.

        Args:
            skill_id: The skill to execute
            params: Parameters including network_id
            context: Execution context with API access

        Returns:
            Skill result with card data and polling config
        """
        network_id = params.get("network_id", "")
        org_id = params.get("org_id", "")

        if skill_id == "generate-client-distribution-card":
            return await cls._generate_client_distribution_card(network_id, org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_client_distribution_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate client distribution card data.

        The card shows:
        - Pie chart of clients by category
        - Client counts by SSID/VLAN
        - Top clients by usage
        - Connection quality metrics
        """
        # Distribution by SSID
        by_ssid = [
            {"name": "Corporate", "count": 156, "color": "#049FD9", "percentage": 52},
            {"name": "Guest", "count": 78, "color": "#64C8EB", "percentage": 26},
            {"name": "IoT", "count": 45, "color": "#00A86B", "percentage": 15},
            {"name": "Admin", "count": 21, "color": "#6E6E6E", "percentage": 7},
        ]

        # Distribution by device type
        by_device_type = [
            {"name": "Laptops", "count": 125, "color": "#049FD9", "percentage": 42},
            {"name": "Phones", "count": 95, "color": "#64C8EB", "percentage": 32},
            {"name": "Tablets", "count": 35, "color": "#00A86B", "percentage": 12},
            {"name": "IoT Devices", "count": 45, "color": "#F5A623", "percentage": 15},
        ]

        # Distribution by VLAN
        by_vlan = [
            {"name": "VLAN 20 (Users)", "count": 156, "color": "#049FD9"},
            {"name": "VLAN 30 (Guest)", "count": 78, "color": "#64C8EB"},
            {"name": "VLAN 40 (IoT)", "count": 45, "color": "#00A86B"},
            {"name": "VLAN 10 (Mgmt)", "count": 21, "color": "#6E6E6E"},
        ]

        # Top clients by bandwidth
        top_clients = [
            {
                "name": "MacBook-Pro-John",
                "ip": "10.20.0.50",
                "mac": "AA:BB:CC:DD:EE:01",
                "ssid": "Corporate",
                "usage": "2.5 GB",
                "signal": -45,
                "status": "healthy",
            },
            {
                "name": "iPhone-Sarah",
                "ip": "10.20.0.75",
                "mac": "AA:BB:CC:DD:EE:02",
                "ssid": "Corporate",
                "usage": "1.8 GB",
                "signal": -52,
                "status": "healthy",
            },
            {
                "name": "Conference-Room-Display",
                "ip": "10.40.0.15",
                "mac": "AA:BB:CC:DD:EE:03",
                "ssid": "IoT",
                "usage": "1.2 GB",
                "signal": -60,
                "status": "healthy",
            },
            {
                "name": "Guest-Device-1",
                "ip": "10.30.0.100",
                "mac": "AA:BB:CC:DD:EE:04",
                "ssid": "Guest",
                "usage": "850 MB",
                "signal": -65,
                "status": "warning",
            },
            {
                "name": "Thermostat-Lobby",
                "ip": "10.40.0.5",
                "mac": "AA:BB:CC:DD:EE:05",
                "ssid": "IoT",
                "usage": "50 MB",
                "signal": -70,
                "status": "warning",
            },
        ]

        client_data = {
            "total_clients": 300,
            "distributions": {
                "by_ssid": by_ssid,
                "by_device_type": by_device_type,
                "by_vlan": by_vlan,
            },
            "top_clients": top_clients,
            "metrics": [
                MetricTileData(
                    label="Total Clients",
                    value=300,
                    trend_direction="up",
                    trend_percent=5.2,
                ).to_dict(),
                MetricTileData(
                    label="Wireless",
                    value=245,
                ).to_dict(),
                MetricTileData(
                    label="Wired",
                    value=55,
                ).to_dict(),
                MetricTileData(
                    label="Avg Signal",
                    value="-55",
                    unit="dBm",
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
            ],
            "connection_quality": {
                "excellent": 180,  # > -50 dBm
                "good": 85,        # -50 to -60 dBm
                "fair": 25,        # -60 to -70 dBm
                "poor": 10,        # < -70 dBm
            },
            "views": ["by_ssid", "by_device_type", "by_vlan"],
            "default_view": "by_ssid",
        }

        endpoint = CardEndpointBuilder.clients(network_id, org_id)

        return build_card_skill_result(
            card_type=CardType.CLIENT_DISTRIBUTION.value,
            data=client_data,
            endpoint=endpoint,
            polling_interval=30000,
            source="meraki",
            entity_id=network_id,
        )
