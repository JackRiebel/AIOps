"""Health Card Skills Module.

Provides skills for generating health-related dashboard cards:
- NetworkHealthCard: Overall health score with category breakdown
- DeviceStatusCard: Device grid with status indicators
- ComplianceCard: Compliance status by category
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ...types import AgentSkill
from .base import (
    UICardModule,
    CardType,
    CardResponse,
    CardMetadata,
    StatusLevel,
    HealthGaugeData,
    MetricTileData,
    StatusIndicatorData,
    DeviceNodeData,
)
from .api_client import CardEndpointBuilder, CardDataNormalizer, build_card_skill_result

logger = logging.getLogger(__name__)


class HealthModule(UICardModule):
    """Module for health-related card skills."""

    MODULE_NAME = "health"
    MODULE_DESCRIPTION = "Health dashboard cards for network monitoring"

    SKILL_IDS = [
        "generate-network-health-card",
        "generate-device-status-card",
        "generate-compliance-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get health-related skills."""
        return [
            AgentSkill(
                id="generate-network-health-card",
                name="Generate Network Health Card",
                description="Generate an overall network health dashboard card with gauges and metrics",
                tags=["health", "dashboard", "network", "monitoring", "gauge"],
                examples=[
                    "Show me network health",
                    "How healthy is my network?",
                    "Network health dashboard",
                    "Overall network status",
                ],
            ),
            AgentSkill(
                id="generate-device-status-card",
                name="Generate Device Status Card",
                description="Generate a device status grid showing online/offline/alerting devices",
                tags=["devices", "status", "grid", "online", "offline"],
                examples=[
                    "Show device status",
                    "Which devices are online?",
                    "Device status grid",
                    "Show me all devices",
                ],
            ),
            AgentSkill(
                id="generate-compliance-card",
                name="Generate Compliance Card",
                description="Generate a compliance status card showing policy adherence by category",
                tags=["compliance", "policy", "security", "configuration"],
                examples=[
                    "Show compliance status",
                    "Are my devices compliant?",
                    "Compliance dashboard",
                    "Policy compliance check",
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
        """Execute a health skill.

        Args:
            skill_id: The skill to execute
            params: Parameters including network_id, org_id
            context: Execution context with API access

        Returns:
            Skill result with card data and polling config
        """
        network_id = params.get("network_id", "")
        org_id = params.get("org_id", "")

        if skill_id == "generate-network-health-card":
            return await cls._generate_network_health_card(network_id, org_id, context)
        elif skill_id == "generate-device-status-card":
            return await cls._generate_device_status_card(network_id, org_id, context)
        elif skill_id == "generate-compliance-card":
            return await cls._generate_compliance_card(network_id, org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_network_health_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate network health card data.

        The card shows:
        - Overall health gauge (0-100)
        - Category breakdowns (connectivity, performance, security)
        - Trend indicators
        """
        # Build initial data structure
        # Real data would come from Meraki/Catalyst APIs via context
        health_data = {
            "overall": HealthGaugeData(
                value=87,
                label="Overall Health",
                trend="stable",
            ).to_dict(),
            "categories": [
                HealthGaugeData(
                    value=92,
                    label="Connectivity",
                    trend="up",
                ).to_dict(),
                HealthGaugeData(
                    value=85,
                    label="Performance",
                    trend="stable",
                ).to_dict(),
                HealthGaugeData(
                    value=78,
                    label="Security",
                    trend="down",
                ).to_dict(),
            ],
            "metrics": [
                MetricTileData(
                    label="Devices Online",
                    value=47,
                    unit="/ 50",
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
                MetricTileData(
                    label="Active Clients",
                    value=234,
                    trend_direction="up",
                    trend_percent=5.2,
                ).to_dict(),
                MetricTileData(
                    label="Avg Latency",
                    value=12,
                    unit="ms",
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
                MetricTileData(
                    label="Active Alerts",
                    value=3,
                    status=StatusLevel.WARNING,
                ).to_dict(),
            ],
            "summary": {
                "status": "healthy",
                "message": "Network is operating normally with minor issues",
                "last_incident": None,
            },
        }

        endpoint = CardEndpointBuilder.network_health(network_id, org_id)

        return build_card_skill_result(
            card_type=CardType.NETWORK_HEALTH.value,
            data=health_data,
            endpoint=endpoint,
            polling_interval=30000,
            source="meraki",
            entity_id=network_id,
        )

    @classmethod
    async def _generate_device_status_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate device status card data.

        The card shows:
        - Device grid with icons and status
        - Status summary counts
        - Quick filters
        """
        # Example device data - real data from Meraki/Catalyst API
        devices = [
            DeviceNodeData(
                id="Q2KN-XXXX-XXXX",
                name="HQ-MX68",
                type="firewall",
                model="MX68",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.1",
            ).to_dict(),
            DeviceNodeData(
                id="Q2HP-YYYY-YYYY",
                name="HQ-MS225-1",
                type="switch",
                model="MS225-48LP",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.2",
            ).to_dict(),
            DeviceNodeData(
                id="Q2HP-ZZZZ-ZZZZ",
                name="HQ-MS225-2",
                type="switch",
                model="MS225-24P",
                status=StatusLevel.WARNING,
                ip="192.168.1.3",
            ).to_dict(),
            DeviceNodeData(
                id="Q2MD-AAAA-AAAA",
                name="HQ-MR46-1",
                type="ap",
                model="MR46",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.10",
            ).to_dict(),
            DeviceNodeData(
                id="Q2MD-BBBB-BBBB",
                name="HQ-MR46-2",
                type="ap",
                model="MR46",
                status=StatusLevel.OFFLINE,
                ip="192.168.1.11",
            ).to_dict(),
        ]

        # Status summary
        status_counts = {
            "healthy": sum(1 for d in devices if d["status"] == "healthy"),
            "warning": sum(1 for d in devices if d["status"] == "warning"),
            "critical": sum(1 for d in devices if d["status"] == "critical"),
            "offline": sum(1 for d in devices if d["status"] == "offline"),
        }

        device_data = {
            "devices": devices,
            "summary": [
                StatusIndicatorData(
                    status=StatusLevel.HEALTHY,
                    label="Online",
                    count=status_counts["healthy"],
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.WARNING,
                    label="Warning",
                    count=status_counts["warning"],
                    pulse=status_counts["warning"] > 0,
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.CRITICAL,
                    label="Critical",
                    count=status_counts["critical"],
                    pulse=status_counts["critical"] > 0,
                ).to_dict(),
                StatusIndicatorData(
                    status=StatusLevel.OFFLINE,
                    label="Offline",
                    count=status_counts["offline"],
                ).to_dict(),
            ],
            "total": len(devices),
            "filters": ["all", "firewall", "switch", "ap"],
        }

        endpoint = CardEndpointBuilder.device_status(network_id, org_id)

        return build_card_skill_result(
            card_type=CardType.DEVICE_STATUS.value,
            data=device_data,
            endpoint=endpoint,
            polling_interval=15000,  # More frequent for device status
            source="meraki",
            entity_id=network_id,
        )

    @classmethod
    async def _generate_compliance_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate compliance card data.

        The card shows:
        - Overall compliance score
        - Category compliance percentages
        - Non-compliant items list
        """
        compliance_data = {
            "overall": HealthGaugeData(
                value=89,
                label="Overall Compliance",
                threshold_warning=90,
                threshold_critical=70,
            ).to_dict(),
            "categories": [
                {
                    "name": "Security Policies",
                    "score": 95,
                    "status": "healthy",
                    "items_checked": 24,
                    "items_passed": 23,
                },
                {
                    "name": "Configuration Standards",
                    "score": 88,
                    "status": "healthy",
                    "items_checked": 50,
                    "items_passed": 44,
                },
                {
                    "name": "Firmware Versions",
                    "score": 76,
                    "status": "warning",
                    "items_checked": 25,
                    "items_passed": 19,
                },
                {
                    "name": "Access Control",
                    "score": 100,
                    "status": "healthy",
                    "items_checked": 12,
                    "items_passed": 12,
                },
            ],
            "non_compliant_items": [
                {
                    "device": "HQ-MS225-2",
                    "issue": "Firmware outdated (15.2 vs 15.5)",
                    "severity": "warning",
                    "category": "Firmware Versions",
                },
                {
                    "device": "Branch-MX68",
                    "issue": "VPN configuration missing encryption",
                    "severity": "critical",
                    "category": "Security Policies",
                },
            ],
            "last_scan": datetime.utcnow().isoformat() + "Z",
        }

        endpoint = CardEndpointBuilder.compliance(network_id, org_id)

        return build_card_skill_result(
            card_type=CardType.COMPLIANCE.value,
            data=compliance_data,
            endpoint=endpoint,
            polling_interval=60000,  # Less frequent for compliance
            source="catalyst",
            entity_id=network_id,
        )
