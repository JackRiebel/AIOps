"""Wireless Overview Card Skills Module.

Provides skills for generating wireless network overview cards:
- WirelessOverviewCard: AP status, client counts, channel utilization
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


class WirelessModule(UICardModule):
    """Module for wireless overview card skills."""

    MODULE_NAME = "wireless"
    MODULE_DESCRIPTION = "Wireless network overview and AP health cards"

    SKILL_IDS = [
        "generate-wireless-overview-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get wireless overview skills."""
        return [
            AgentSkill(
                id="generate-wireless-overview-card",
                name="Generate Wireless Overview Card",
                description="Generate a card showing wireless AP status, client counts, and channel utilization",
                tags=["wireless", "wifi", "ap", "access-point", "ssid", "clients", "channels"],
                examples=[
                    "Show wireless status",
                    "How are the APs doing?",
                    "Wireless overview",
                    "Show WiFi health",
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
        """Execute a wireless overview skill."""
        network_id = params.get("network_id", "")
        org_id = params.get("org_id", "")

        if skill_id == "generate-wireless-overview-card":
            return await cls._generate_wireless_overview_card(network_id, org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_wireless_overview_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate wireless overview card data."""
        now = datetime.utcnow()

        # Access Points
        access_points = [
            {
                "id": "ap-1",
                "name": "AP-Lobby-1",
                "model": "MR46",
                "status": StatusLevel.HEALTHY.value,
                "clients": 28,
                "channel_2g": 6,
                "channel_5g": 36,
                "utilization_2g": 45,
                "utilization_5g": 62,
                "last_seen": (now - timedelta(seconds=15)).isoformat() + "Z",
            },
            {
                "id": "ap-2",
                "name": "AP-Floor2-East",
                "model": "MR46",
                "status": StatusLevel.HEALTHY.value,
                "clients": 42,
                "channel_2g": 1,
                "channel_5g": 44,
                "utilization_2g": 38,
                "utilization_5g": 71,
                "last_seen": (now - timedelta(seconds=12)).isoformat() + "Z",
            },
            {
                "id": "ap-3",
                "name": "AP-Floor2-West",
                "model": "MR56",
                "status": StatusLevel.WARNING.value,
                "clients": 56,
                "channel_2g": 11,
                "channel_5g": 149,
                "utilization_2g": 78,
                "utilization_5g": 85,
                "last_seen": (now - timedelta(seconds=20)).isoformat() + "Z",
            },
            {
                "id": "ap-4",
                "name": "AP-Floor3-Main",
                "model": "MR46",
                "status": StatusLevel.HEALTHY.value,
                "clients": 35,
                "channel_2g": 6,
                "channel_5g": 52,
                "utilization_2g": 42,
                "utilization_5g": 58,
                "last_seen": (now - timedelta(seconds=8)).isoformat() + "Z",
            },
            {
                "id": "ap-5",
                "name": "AP-Conference-A",
                "model": "MR36",
                "status": StatusLevel.HEALTHY.value,
                "clients": 12,
                "channel_2g": 1,
                "channel_5g": 40,
                "utilization_2g": 22,
                "utilization_5g": 35,
                "last_seen": (now - timedelta(seconds=5)).isoformat() + "Z",
            },
            {
                "id": "ap-6",
                "name": "AP-Warehouse",
                "model": "MR76",
                "status": StatusLevel.CRITICAL.value,
                "clients": 0,
                "channel_2g": 0,
                "channel_5g": 0,
                "utilization_2g": 0,
                "utilization_5g": 0,
                "last_seen": (now - timedelta(minutes=15)).isoformat() + "Z",
            },
        ]

        # SSIDs
        ssids = [
            {"name": "Corp-Wifi", "clients": 98, "enabled": True, "band": "dual"},
            {"name": "Guest-Network", "clients": 45, "enabled": True, "band": "dual"},
            {"name": "IoT-Devices", "clients": 30, "enabled": True, "band": "2.4GHz"},
            {"name": "Admin-Secure", "clients": 12, "enabled": True, "band": "5GHz"},
        ]

        # Channel utilization heatmap data
        channel_data = {
            "2.4GHz": [
                {"channel": 1, "utilization": 52, "interference": 15},
                {"channel": 6, "utilization": 45, "interference": 22},
                {"channel": 11, "utilization": 78, "interference": 8},
            ],
            "5GHz": [
                {"channel": 36, "utilization": 62, "interference": 5},
                {"channel": 40, "utilization": 35, "interference": 3},
                {"channel": 44, "utilization": 71, "interference": 8},
                {"channel": 52, "utilization": 58, "interference": 4},
                {"channel": 149, "utilization": 85, "interference": 12},
            ],
        }

        # Calculate aggregates
        total_clients = sum(ap["clients"] for ap in access_points)
        avg_utilization_2g = sum(ap["utilization_2g"] for ap in access_points if ap["utilization_2g"] > 0) / max(1, len([ap for ap in access_points if ap["utilization_2g"] > 0]))
        avg_utilization_5g = sum(ap["utilization_5g"] for ap in access_points if ap["utilization_5g"] > 0) / max(1, len([ap for ap in access_points if ap["utilization_5g"] > 0]))

        status_counts = {
            "healthy": sum(1 for ap in access_points if ap["status"] == "healthy"),
            "warning": sum(1 for ap in access_points if ap["status"] == "warning"),
            "critical": sum(1 for ap in access_points if ap["status"] == "critical"),
            "offline": sum(1 for ap in access_points if ap["status"] == "offline"),
        }

        wireless_data = {
            "access_points": access_points,
            "ssids": ssids,
            "channel_data": channel_data,
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
                    label="Offline",
                    count=status_counts["critical"],
                    pulse=status_counts["critical"] > 0,
                ).to_dict(),
            ],
            "metrics": [
                MetricTileData(
                    label="Total APs",
                    value=len(access_points),
                    status=StatusLevel.HEALTHY if status_counts["critical"] == 0 else StatusLevel.CRITICAL,
                ).to_dict(),
                MetricTileData(
                    label="Clients",
                    value=total_clients,
                    trend_direction="up",
                    trend_percent=5.2,
                ).to_dict(),
                MetricTileData(
                    label="2.4GHz Util",
                    value=round(avg_utilization_2g),
                    unit="%",
                    status=StatusLevel.HEALTHY if avg_utilization_2g < 70 else StatusLevel.WARNING,
                ).to_dict(),
                MetricTileData(
                    label="5GHz Util",
                    value=round(avg_utilization_5g),
                    unit="%",
                    status=StatusLevel.HEALTHY if avg_utilization_5g < 70 else StatusLevel.WARNING,
                ).to_dict(),
            ],
            "bands": ["2.4GHz", "5GHz"],
            "time_range": "Real-time",
        }

        return build_card_skill_result(
            card_type=CardType.WIRELESS_OVERVIEW.value,
            data=wireless_data,
            endpoint=f"/api/cards/wireless-overview/{network_id or 'default'}/data",
            polling_interval=30000,
            source="meraki",
            entity_id=network_id,
        )
