"""Traffic Card Skills Module.

Provides skills for generating traffic and bandwidth cards:
- TrafficFlowCard: Sankey diagram of traffic flow
- BandwidthCard: Interface utilization with top talkers
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
    ProgressBarData,
)
from .api_client import CardEndpointBuilder, CardDataNormalizer, build_card_skill_result

logger = logging.getLogger(__name__)


class TrafficModule(UICardModule):
    """Module for traffic and bandwidth card skills."""

    MODULE_NAME = "traffic"
    MODULE_DESCRIPTION = "Traffic flow and bandwidth utilization cards"

    SKILL_IDS = [
        "generate-traffic-flow-card",
        "generate-bandwidth-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get traffic-related skills."""
        return [
            AgentSkill(
                id="generate-traffic-flow-card",
                name="Generate Traffic Flow Card",
                description="Generate a Sankey diagram showing traffic flow between network segments",
                tags=["traffic", "flow", "sankey", "bandwidth", "routing"],
                examples=[
                    "Show traffic flow",
                    "How is traffic routed?",
                    "Traffic flow diagram",
                    "Where is my bandwidth going?",
                ],
            ),
            AgentSkill(
                id="generate-bandwidth-card",
                name="Generate Bandwidth Card",
                description="Generate a bandwidth utilization card showing interface usage and top talkers",
                tags=["bandwidth", "utilization", "interface", "throughput", "usage"],
                examples=[
                    "Show bandwidth usage",
                    "Interface utilization",
                    "Who is using the most bandwidth?",
                    "Top bandwidth consumers",
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
        """Execute a traffic skill.

        Args:
            skill_id: The skill to execute
            params: Parameters including network_id, device_serial
            context: Execution context with API access

        Returns:
            Skill result with card data and polling config
        """
        network_id = params.get("network_id", "")
        org_id = params.get("org_id", "")
        device_serial = params.get("device_serial", "")

        if skill_id == "generate-traffic-flow-card":
            return await cls._generate_traffic_flow_card(network_id, org_id, context)
        elif skill_id == "generate-bandwidth-card":
            return await cls._generate_bandwidth_card(device_serial, org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_traffic_flow_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate traffic flow card data.

        The card shows:
        - Sankey diagram with traffic flows
        - Source and destination categories
        - Bandwidth per flow
        """
        # Sankey data structure: nodes and links
        nodes = [
            {"id": "users", "name": "User Devices", "category": "source"},
            {"id": "iot", "name": "IoT Devices", "category": "source"},
            {"id": "servers", "name": "Internal Servers", "category": "source"},
            {"id": "wan", "name": "WAN/Internet", "category": "transit"},
            {"id": "datacenter", "name": "Data Center", "category": "transit"},
            {"id": "cloud", "name": "Cloud Services", "category": "destination"},
            {"id": "saas", "name": "SaaS Apps", "category": "destination"},
            {"id": "internal", "name": "Internal Apps", "category": "destination"},
        ]

        links = [
            {"source": "users", "target": "wan", "value": 450, "label": "450 Mbps"},
            {"source": "users", "target": "datacenter", "value": 200, "label": "200 Mbps"},
            {"source": "iot", "target": "cloud", "value": 50, "label": "50 Mbps"},
            {"source": "iot", "target": "internal", "value": 30, "label": "30 Mbps"},
            {"source": "servers", "target": "datacenter", "value": 800, "label": "800 Mbps"},
            {"source": "wan", "target": "cloud", "value": 300, "label": "300 Mbps"},
            {"source": "wan", "target": "saas", "value": 150, "label": "150 Mbps"},
            {"source": "datacenter", "target": "internal", "value": 700, "label": "700 Mbps"},
            {"source": "datacenter", "target": "cloud", "value": 300, "label": "300 Mbps"},
        ]

        traffic_data = {
            "sankey": {
                "nodes": nodes,
                "links": links,
            },
            "summary": {
                "total_throughput": "1.98 Gbps",
                "peak_throughput": "2.4 Gbps",
                "avg_throughput": "1.5 Gbps",
            },
            "top_flows": [
                {"source": "Servers", "destination": "Data Center", "bandwidth": "800 Mbps"},
                {"source": "Users", "destination": "Internet", "bandwidth": "450 Mbps"},
                {"source": "Data Center", "destination": "Cloud", "bandwidth": "300 Mbps"},
            ],
            "time_range": "Last 1 hour",
        }

        endpoint = CardEndpointBuilder.traffic_flow(network_id, org_id)

        return build_card_skill_result(
            card_type=CardType.TRAFFIC_FLOW.value,
            data=traffic_data,
            endpoint=endpoint,
            polling_interval=30000,
            source="meraki",
            entity_id=network_id,
        )

    @classmethod
    async def _generate_bandwidth_card(
        cls,
        device_serial: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate bandwidth card data.

        The card shows:
        - Interface utilization bars
        - Top talkers (clients)
        - Sparkline trends
        """
        interfaces = [
            ProgressBarData(
                label="WAN1 (1 Gbps)",
                value=35.5,
                status=StatusLevel.HEALTHY,
            ).to_dict(),
            ProgressBarData(
                label="WAN2 (1 Gbps)",
                value=12.0,
                status=StatusLevel.HEALTHY,
            ).to_dict(),
            ProgressBarData(
                label="LAN (10 Gbps)",
                value=8.5,
                status=StatusLevel.HEALTHY,
            ).to_dict(),
            ProgressBarData(
                label="Port 47 Uplink",
                value=75.0,
                status=StatusLevel.WARNING,
            ).to_dict(),
            ProgressBarData(
                label="Port 48 Uplink",
                value=45.0,
                status=StatusLevel.HEALTHY,
            ).to_dict(),
        ]

        top_talkers = [
            {
                "name": "Server-01",
                "ip": "10.100.0.10",
                "type": "server",
                "download": "125.5 Mbps",
                "upload": "89.2 Mbps",
                "total": "214.7 Mbps",
            },
            {
                "name": "Workstation-15",
                "ip": "10.20.0.115",
                "type": "client",
                "download": "45.2 Mbps",
                "upload": "12.5 Mbps",
                "total": "57.7 Mbps",
            },
            {
                "name": "AP-Floor1",
                "ip": "192.168.1.10",
                "type": "ap",
                "download": "38.5 Mbps",
                "upload": "15.2 Mbps",
                "total": "53.7 Mbps",
            },
            {
                "name": "Backup-Server",
                "ip": "10.100.0.20",
                "type": "server",
                "download": "5.2 Mbps",
                "upload": "45.8 Mbps",
                "total": "51.0 Mbps",
            },
            {
                "name": "IP-Camera-Lobby",
                "ip": "10.40.0.5",
                "type": "client",
                "download": "2.1 Mbps",
                "upload": "35.5 Mbps",
                "total": "37.6 Mbps",
            },
        ]

        # Sparkline data (last 10 data points, normalized to 0-100)
        sparkline_data = [45, 52, 48, 55, 60, 58, 65, 70, 68, 72]

        bandwidth_data = {
            "interfaces": interfaces,
            "top_talkers": top_talkers,
            "sparkline": sparkline_data,
            "metrics": [
                MetricTileData(
                    label="Total Download",
                    value="355",
                    unit="Mbps",
                    trend_direction="up",
                    trend_percent=8.5,
                    sparkline=[30, 35, 32, 40, 38, 42, 45, 48, 50, 55],
                ).to_dict(),
                MetricTileData(
                    label="Total Upload",
                    value="198",
                    unit="Mbps",
                    trend_direction="stable",
                    trend_percent=1.2,
                    sparkline=[18, 20, 19, 22, 21, 20, 22, 21, 23, 22],
                ).to_dict(),
                MetricTileData(
                    label="Peak Usage",
                    value="72",
                    unit="%",
                    status=StatusLevel.WARNING,
                ).to_dict(),
            ],
            "time_range": "Last 15 minutes",
        }

        endpoint = CardEndpointBuilder.bandwidth(device_serial or "device", org_id)

        return build_card_skill_result(
            card_type=CardType.BANDWIDTH.value,
            data=bandwidth_data,
            endpoint=endpoint,
            polling_interval=15000,  # More frequent for bandwidth
            source="meraki",
            entity_id=device_serial,
        )
