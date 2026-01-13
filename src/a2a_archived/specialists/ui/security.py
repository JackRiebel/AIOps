"""Security Events Card Skills Module.

Provides skills for generating security event cards:
- SecurityEventsCard: Timeline of security threats and blocked attacks
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
    TimelineEventData,
)
from .api_client import CardEndpointBuilder, build_card_skill_result

logger = logging.getLogger(__name__)


class SecurityModule(UICardModule):
    """Module for security event card skills."""

    MODULE_NAME = "security"
    MODULE_DESCRIPTION = "Security events and threat monitoring cards"

    SKILL_IDS = [
        "generate-security-events-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get security-related skills."""
        return [
            AgentSkill(
                id="generate-security-events-card",
                name="Generate Security Events Card",
                description="Generate a card showing security events, threats, and blocked attacks",
                tags=["security", "threats", "attacks", "firewall", "intrusion", "malware"],
                examples=[
                    "Show security events",
                    "What threats were detected?",
                    "Security overview",
                    "Show blocked attacks",
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
        """Execute a security skill."""
        org_id = params.get("org_id", "")
        network_id = params.get("network_id", "")

        if skill_id == "generate-security-events-card":
            return await cls._generate_security_events_card(org_id, network_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_security_events_card(
        cls,
        org_id: str,
        network_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate security events card data."""
        now = datetime.utcnow()

        events = [
            TimelineEventData(
                id="sec-1",
                timestamp=now - timedelta(minutes=3),
                title="Malware blocked",
                description="Blocked download of suspicious file from 185.234.xx.xx",
                severity=StatusLevel.CRITICAL,
                source="firewall",
                metadata={"type": "malware", "action": "blocked", "src_ip": "185.234.xx.xx"},
            ).to_dict(),
            TimelineEventData(
                id="sec-2",
                timestamp=now - timedelta(minutes=18),
                title="Port scan detected",
                description="Multiple port scan attempts from 203.0.113.50",
                severity=StatusLevel.WARNING,
                source="ids",
                metadata={"type": "reconnaissance", "src_ip": "203.0.113.50", "ports": 1024},
            ).to_dict(),
            TimelineEventData(
                id="sec-3",
                timestamp=now - timedelta(minutes=45),
                title="Brute force attempt blocked",
                description="5 failed SSH attempts blocked from 45.33.xx.xx",
                severity=StatusLevel.WARNING,
                source="firewall",
                metadata={"type": "brute_force", "attempts": 5, "src_ip": "45.33.xx.xx"},
            ).to_dict(),
            TimelineEventData(
                id="sec-4",
                timestamp=now - timedelta(hours=1, minutes=20),
                title="DNS tunneling blocked",
                description="Suspicious DNS query patterns blocked",
                severity=StatusLevel.CRITICAL,
                source="firewall",
                metadata={"type": "exfiltration", "domain": "suspicious.example.com"},
            ).to_dict(),
            TimelineEventData(
                id="sec-5",
                timestamp=now - timedelta(hours=2),
                title="Phishing URL blocked",
                description="User attempted to access known phishing site",
                severity=StatusLevel.WARNING,
                source="content_filter",
                metadata={"type": "phishing", "url": "https://fake-login.example.com"},
            ).to_dict(),
        ]

        # Count by severity
        threat_counts = {
            "critical": sum(1 for e in events if e["severity"] == "critical"),
            "warning": sum(1 for e in events if e["severity"] == "warning"),
            "info": sum(1 for e in events if e["severity"] == "healthy"),
        }

        # Threat types
        threat_types = [
            {"name": "Malware", "count": 3, "color": "#D0021B"},
            {"name": "Intrusion", "count": 5, "color": "#F5A623"},
            {"name": "Phishing", "count": 2, "color": "#9B59B6"},
            {"name": "Brute Force", "count": 8, "color": "#3498DB"},
        ]

        security_data = {
            "events": events,
            "summary": [
                StatusIndicatorData(
                    status=StatusLevel.CRITICAL,
                    label="Critical",
                    count=threat_counts["critical"],
                    pulse=threat_counts["critical"] > 0,
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.WARNING,
                    label="Warning",
                    count=threat_counts["warning"],
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.HEALTHY,
                    label="Blocked",
                    count=len(events),
                ).to_dict(),
            ],
            "metrics": [
                MetricTileData(
                    label="Threats Blocked",
                    value=len(events),
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
                MetricTileData(
                    label="Attack Sources",
                    value=4,
                    unit="IPs",
                ).to_dict(),
                MetricTileData(
                    label="Last 24h",
                    value=47,
                    trend_direction="down",
                    trend_percent=23.0,
                ).to_dict(),
                MetricTileData(
                    label="Risk Score",
                    value=72,
                    status=StatusLevel.WARNING,
                ).to_dict(),
            ],
            "threat_types": threat_types,
            "filters": ["all", "malware", "intrusion", "phishing", "brute_force"],
            "time_range": "Last 24 hours",
        }

        return build_card_skill_result(
            card_type=CardType.SECURITY_EVENTS.value,
            data=security_data,
            endpoint=f"/api/cards/security-events/{org_id or 'default'}/data",
            polling_interval=15000,
            source="splunk",
            entity_id=org_id,
        )
