"""Alerts Card Skills Module.

Provides skills for generating alert and incident cards:
- AlertTimelineCard: Timeline of recent alerts
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from ...types import AgentSkill
from .base import (
    UICardModule,
    CardType,
    StatusLevel,
    MetricTileData,
    StatusIndicatorData,
    TimelineEventData,
)
from .api_client import CardEndpointBuilder, build_card_skill_result

logger = logging.getLogger(__name__)


class AlertsModule(UICardModule):
    """Module for alert and incident card skills."""

    MODULE_NAME = "alerts"
    MODULE_DESCRIPTION = "Alert timeline and incident cards"

    SKILL_IDS = [
        "generate-alert-timeline-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get alert-related skills."""
        return [
            AgentSkill(
                id="generate-alert-timeline-card",
                name="Generate Alert Timeline Card",
                description="Generate a timeline showing recent alerts and incidents",
                tags=["alerts", "timeline", "incidents", "events", "notifications"],
                examples=[
                    "Show recent alerts",
                    "What alerts are active?",
                    "Alert timeline",
                    "Show me incidents",
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
        """Execute an alert skill.

        Args:
            skill_id: The skill to execute
            params: Parameters including org_id, network_id
            context: Execution context with API access

        Returns:
            Skill result with card data and polling config
        """
        org_id = params.get("org_id", "")
        network_id = params.get("network_id", "")

        if skill_id == "generate-alert-timeline-card":
            return await cls._generate_alert_timeline_card(org_id, network_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_alert_timeline_card(
        cls,
        org_id: str,
        network_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate alert timeline card data.

        The card shows:
        - Timeline of recent alerts
        - Alert severity indicators
        - Alert counts by severity
        - Quick actions
        """
        now = datetime.utcnow()

        events = [
            TimelineEventData(
                id="alert-1",
                timestamp=now - timedelta(minutes=5),
                title="AP-Floor2 went offline",
                description="Access point AP-Floor2 (MR46) has stopped responding",
                severity=StatusLevel.CRITICAL,
                source="meraki",
                metadata={"device": "AP-Floor2", "serial": "Q2MD-XXXX-XXXX"},
            ).to_dict(),
            TimelineEventData(
                id="alert-2",
                timestamp=now - timedelta(minutes=15),
                title="High bandwidth utilization on Port 47",
                description="Port 47 on Core-Switch is at 85% utilization",
                severity=StatusLevel.WARNING,
                source="meraki",
                metadata={"device": "Core-Switch", "port": "47"},
            ).to_dict(),
            TimelineEventData(
                id="alert-3",
                timestamp=now - timedelta(minutes=32),
                title="New firmware available",
                description="Firmware update 15.5.1 available for MS225 switches",
                severity=StatusLevel.HEALTHY,
                source="meraki",
                metadata={"firmware": "15.5.1", "devices": 3},
            ).to_dict(),
            TimelineEventData(
                id="alert-4",
                timestamp=now - timedelta(hours=1, minutes=15),
                title="VPN tunnel flapping",
                description="Site-to-site VPN to Branch-Office reconnected after brief outage",
                severity=StatusLevel.WARNING,
                source="meraki",
                metadata={"vpn": "Branch-Office", "duration": "45 seconds"},
            ).to_dict(),
            TimelineEventData(
                id="alert-5",
                timestamp=now - timedelta(hours=2),
                title="Configuration change detected",
                description="Admin user modified VLAN settings on Core-Switch",
                severity=StatusLevel.HEALTHY,
                source="meraki",
                metadata={"user": "admin@company.com", "changes": ["VLAN 40 subnet"]},
            ).to_dict(),
            TimelineEventData(
                id="alert-6",
                timestamp=now - timedelta(hours=4),
                title="Security event: Failed login attempts",
                description="5 failed SSH login attempts from 203.0.113.50",
                severity=StatusLevel.WARNING,
                source="splunk",
                metadata={"source_ip": "203.0.113.50", "attempts": 5},
            ).to_dict(),
        ]

        # Count by severity
        severity_counts = {
            "critical": sum(1 for e in events if e["severity"] == "critical"),
            "warning": sum(1 for e in events if e["severity"] == "warning"),
            "healthy": sum(1 for e in events if e["severity"] == "healthy"),
        }

        alert_data = {
            "events": events,
            "summary": [
                StatusIndicatorData(
                    status=StatusLevel.CRITICAL,
                    label="Critical",
                    count=severity_counts["critical"],
                    pulse=severity_counts["critical"] > 0,
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.WARNING,
                    label="Warning",
                    count=severity_counts["warning"],
                    pulse=severity_counts["warning"] > 0,
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.HEALTHY,
                    label="Info",
                    count=severity_counts["healthy"],
                ).to_dict(),
            ],
            "metrics": [
                MetricTileData(
                    label="Active Alerts",
                    value=severity_counts["critical"] + severity_counts["warning"],
                    status=StatusLevel.WARNING if severity_counts["critical"] > 0 else StatusLevel.HEALTHY,
                ).to_dict(),
                MetricTileData(
                    label="Last 24h",
                    value=len(events),
                    trend_direction="down",
                    trend_percent=15.0,
                ).to_dict(),
            ],
            "filters": ["all", "critical", "warning", "info"],
            "time_range": "Last 24 hours",
        }

        endpoint = CardEndpointBuilder.alerts(org_id or "default")

        return build_card_skill_result(
            card_type=CardType.ALERT_TIMELINE.value,
            data=alert_data,
            endpoint=endpoint,
            polling_interval=10000,  # Very frequent for alerts
            source="multi",
            entity_id=org_id,
        )
