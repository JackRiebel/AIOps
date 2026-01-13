"""Meraki Events Card Skills Module.

Provides skills for generating Meraki-specific event cards:
- MerakiEventCard: Timeline of device events and configuration changes
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
    TimelineEventData,
)
from .api_client import build_card_skill_result

logger = logging.getLogger(__name__)


class EventsModule(UICardModule):
    """Module for Meraki event card skills."""

    MODULE_NAME = "events"
    MODULE_DESCRIPTION = "Meraki device events and configuration change cards"

    SKILL_IDS = [
        "generate-meraki-events-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get Meraki event skills."""
        return [
            AgentSkill(
                id="generate-meraki-events-card",
                name="Generate Meraki Events Card",
                description="Generate a card showing Meraki device events and configuration changes",
                tags=["meraki", "events", "devices", "config", "changes", "status"],
                examples=[
                    "Show Meraki events",
                    "What device changes happened?",
                    "Recent network events",
                    "Show device status changes",
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
        """Execute a Meraki event skill."""
        network_id = params.get("network_id", "")
        org_id = params.get("org_id", "")

        if skill_id == "generate-meraki-events-card":
            return await cls._generate_meraki_events_card(network_id, org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_meraki_events_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate Meraki events card data."""
        now = datetime.utcnow()

        events = [
            TimelineEventData(
                id="evt-1",
                timestamp=now - timedelta(minutes=2),
                title="Device came online",
                description="AP-Floor3 (MR46) connected to network",
                severity=StatusLevel.HEALTHY,
                source="meraki",
                metadata={"type": "status_change", "device": "AP-Floor3", "status": "online"},
            ).to_dict(),
            TimelineEventData(
                id="evt-2",
                timestamp=now - timedelta(minutes=8),
                title="Configuration changed",
                description="VLAN 100 subnet modified by admin@company.com",
                severity=StatusLevel.HEALTHY,
                source="meraki",
                metadata={"type": "config_change", "user": "admin@company.com", "setting": "VLAN 100"},
            ).to_dict(),
            TimelineEventData(
                id="evt-3",
                timestamp=now - timedelta(minutes=15),
                title="Device went offline",
                description="Switch-2F (MS225) lost connectivity",
                severity=StatusLevel.CRITICAL,
                source="meraki",
                metadata={"type": "status_change", "device": "Switch-2F", "status": "offline"},
            ).to_dict(),
            TimelineEventData(
                id="evt-4",
                timestamp=now - timedelta(minutes=28),
                title="Firmware update started",
                description="MX68 appliance upgrading to 18.107",
                severity=StatusLevel.HEALTHY,
                source="meraki",
                metadata={"type": "firmware", "device": "MX68", "version": "18.107"},
            ).to_dict(),
            TimelineEventData(
                id="evt-5",
                timestamp=now - timedelta(minutes=45),
                title="Port status changed",
                description="Port 24 on Core-Switch changed to UP",
                severity=StatusLevel.HEALTHY,
                source="meraki",
                metadata={"type": "port_change", "device": "Core-Switch", "port": "24"},
            ).to_dict(),
            TimelineEventData(
                id="evt-6",
                timestamp=now - timedelta(hours=1, minutes=10),
                title="Client connected",
                description="New client joined SSID Corp-Wifi (192.168.1.105)",
                severity=StatusLevel.HEALTHY,
                source="meraki",
                metadata={"type": "client", "ssid": "Corp-Wifi", "ip": "192.168.1.105"},
            ).to_dict(),
            TimelineEventData(
                id="evt-7",
                timestamp=now - timedelta(hours=2),
                title="DHCP pool exhausted",
                description="VLAN 50 DHCP pool at 95% capacity",
                severity=StatusLevel.WARNING,
                source="meraki",
                metadata={"type": "dhcp", "vlan": 50, "utilization": 95},
            ).to_dict(),
        ]

        # Event type counts
        event_types = [
            {"name": "Status Changes", "count": 12, "color": "#049FD9"},
            {"name": "Config Changes", "count": 8, "color": "#00A86B"},
            {"name": "Port Events", "count": 24, "color": "#F5A623"},
            {"name": "Client Events", "count": 156, "color": "#9B59B6"},
        ]

        events_data = {
            "events": events,
            "metrics": [
                MetricTileData(
                    label="Events Today",
                    value=len(events) * 10,
                    trend_direction="up",
                    trend_percent=12.0,
                ).to_dict(),
                MetricTileData(
                    label="Config Changes",
                    value=8,
                ).to_dict(),
                MetricTileData(
                    label="Status Changes",
                    value=12,
                ).to_dict(),
                MetricTileData(
                    label="Devices Affected",
                    value=6,
                ).to_dict(),
            ],
            "event_types": event_types,
            "filters": ["all", "status_change", "config_change", "port_change", "client", "firmware"],
            "time_range": "Last 24 hours",
        }

        return build_card_skill_result(
            card_type=CardType.MERAKI_EVENTS.value,
            data=events_data,
            endpoint=f"/api/cards/meraki-events/{network_id or 'default'}/data",
            polling_interval=10000,
            source="meraki",
            entity_id=network_id,
        )
