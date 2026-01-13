"""Topology Card Skills Module.

Provides skills for generating topology and architecture cards:
- TopologyMapCard: Interactive network topology with zoom/pan
- VLANDiagramCard: VLAN structure with trunk/access ports
- PathTraceCard: Hop-by-hop path visualization
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ...types import AgentSkill
from .base import (
    UICardModule,
    CardType,
    StatusLevel,
    DeviceNodeData,
    ConnectionEdgeData,
    MetricTileData,
)
from .api_client import CardEndpointBuilder, CardDataNormalizer, build_card_skill_result

logger = logging.getLogger(__name__)


class TopologyModule(UICardModule):
    """Module for topology and architecture card skills."""

    MODULE_NAME = "topology"
    MODULE_DESCRIPTION = "Topology and architecture visualization cards"

    SKILL_IDS = [
        "generate-topology-card",
        "generate-vlan-diagram-card",
        "generate-path-trace-card",
    ]

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get topology-related skills."""
        return [
            AgentSkill(
                id="generate-topology-card",
                name="Generate Topology Card",
                description="Generate an interactive network topology map showing devices and connections",
                tags=["topology", "map", "network", "diagram", "connections"],
                examples=[
                    "Show network topology",
                    "Draw my network map",
                    "Network diagram",
                    "How are my devices connected?",
                ],
            ),
            AgentSkill(
                id="generate-vlan-diagram-card",
                name="Generate VLAN Diagram Card",
                description="Generate a VLAN structure diagram showing trunk and access ports",
                tags=["vlan", "diagram", "ports", "trunk", "access", "segmentation"],
                examples=[
                    "Show VLAN structure",
                    "How are my VLANs configured?",
                    "VLAN diagram",
                    "Show me network segmentation",
                ],
            ),
            AgentSkill(
                id="generate-path-trace-card",
                name="Generate Path Trace Card",
                description="Generate a hop-by-hop path visualization between two endpoints",
                tags=["path", "trace", "hop", "route", "traceroute"],
                examples=[
                    "Trace path between devices",
                    "Show route from A to B",
                    "How does traffic flow?",
                    "Path trace to destination",
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
        """Execute a topology skill.

        Args:
            skill_id: The skill to execute
            params: Parameters including network_id, source, destination
            context: Execution context with API access

        Returns:
            Skill result with card data and polling config
        """
        network_id = params.get("network_id", "")
        org_id = params.get("org_id", "")

        if skill_id == "generate-topology-card":
            return await cls._generate_topology_card(network_id, org_id, context)
        elif skill_id == "generate-vlan-diagram-card":
            return await cls._generate_vlan_diagram_card(network_id, org_id, context)
        elif skill_id == "generate-path-trace-card":
            source = params.get("source", "")
            destination = params.get("destination", "")
            return await cls._generate_path_trace_card(source, destination, org_id, context)
        else:
            raise ValueError(f"Unknown skill: {skill_id}")

    @classmethod
    async def _generate_topology_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate network topology card data.

        The card shows:
        - Interactive node-edge graph
        - Device icons with status
        - Connection lines with utilization
        - Zoom/pan controls
        """
        # Example topology - real data from Meraki/Catalyst API
        nodes = [
            DeviceNodeData(
                id="internet",
                name="Internet",
                type="cloud",
                status=StatusLevel.HEALTHY,
                x=400,
                y=50,
            ).to_dict(),
            DeviceNodeData(
                id="mx68-1",
                name="HQ-MX68",
                type="firewall",
                model="MX68",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.1",
                x=400,
                y=150,
            ).to_dict(),
            DeviceNodeData(
                id="ms225-1",
                name="Core-Switch",
                type="switch",
                model="MS225-48LP",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.2",
                x=400,
                y=250,
            ).to_dict(),
            DeviceNodeData(
                id="ms225-2",
                name="Floor1-Switch",
                type="switch",
                model="MS225-24P",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.3",
                x=250,
                y=350,
            ).to_dict(),
            DeviceNodeData(
                id="ms225-3",
                name="Floor2-Switch",
                type="switch",
                model="MS225-24P",
                status=StatusLevel.WARNING,
                ip="192.168.1.4",
                x=550,
                y=350,
            ).to_dict(),
            DeviceNodeData(
                id="mr46-1",
                name="AP-Floor1",
                type="ap",
                model="MR46",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.10",
                x=150,
                y=450,
            ).to_dict(),
            DeviceNodeData(
                id="mr46-2",
                name="AP-Floor1-2",
                type="ap",
                model="MR46",
                status=StatusLevel.HEALTHY,
                ip="192.168.1.11",
                x=350,
                y=450,
            ).to_dict(),
            DeviceNodeData(
                id="mr46-3",
                name="AP-Floor2",
                type="ap",
                model="MR46",
                status=StatusLevel.OFFLINE,
                ip="192.168.1.12",
                x=550,
                y=450,
            ).to_dict(),
        ]

        edges = [
            ConnectionEdgeData(
                id="e1",
                source="internet",
                target="mx68-1",
                label="WAN",
                status=StatusLevel.HEALTHY,
                bandwidth="1 Gbps",
                utilization=35.0,
            ).to_dict(),
            ConnectionEdgeData(
                id="e2",
                source="mx68-1",
                target="ms225-1",
                label="Trunk",
                status=StatusLevel.HEALTHY,
                bandwidth="10 Gbps",
                utilization=12.0,
            ).to_dict(),
            ConnectionEdgeData(
                id="e3",
                source="ms225-1",
                target="ms225-2",
                label="Uplink",
                status=StatusLevel.HEALTHY,
                bandwidth="10 Gbps",
                utilization=8.0,
            ).to_dict(),
            ConnectionEdgeData(
                id="e4",
                source="ms225-1",
                target="ms225-3",
                label="Uplink",
                status=StatusLevel.WARNING,
                bandwidth="10 Gbps",
                utilization=75.0,
            ).to_dict(),
            ConnectionEdgeData(
                id="e5",
                source="ms225-2",
                target="mr46-1",
                status=StatusLevel.HEALTHY,
                bandwidth="1 Gbps",
            ).to_dict(),
            ConnectionEdgeData(
                id="e6",
                source="ms225-2",
                target="mr46-2",
                status=StatusLevel.HEALTHY,
                bandwidth="1 Gbps",
            ).to_dict(),
            ConnectionEdgeData(
                id="e7",
                source="ms225-3",
                target="mr46-3",
                status=StatusLevel.OFFLINE,
                bandwidth="1 Gbps",
            ).to_dict(),
        ]

        topology_data = {
            "nodes": nodes,
            "edges": edges,
            "layout": "hierarchical",  # or "force", "radial"
            "options": {
                "zoomable": True,
                "pannable": True,
                "selectable": True,
                "showLabels": True,
            },
            "summary": {
                "total_devices": len(nodes) - 1,  # Exclude internet
                "healthy": sum(1 for n in nodes if n["status"] == "healthy"),
                "warning": sum(1 for n in nodes if n["status"] == "warning"),
                "offline": sum(1 for n in nodes if n["status"] == "offline"),
            },
        }

        endpoint = CardEndpointBuilder.topology(network_id, org_id)

        return build_card_skill_result(
            card_type=CardType.TOPOLOGY.value,
            data=topology_data,
            endpoint=endpoint,
            polling_interval=30000,
            source="meraki",
            entity_id=network_id,
        )

    @classmethod
    async def _generate_vlan_diagram_card(
        cls,
        network_id: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate VLAN diagram card data.

        The card shows:
        - VLAN hierarchy
        - Trunk and access port assignments
        - Device-VLAN mappings
        """
        vlans = [
            {
                "id": 1,
                "name": "Default",
                "subnet": "192.168.1.0/24",
                "gateway": "192.168.1.1",
                "ports": 5,
                "clients": 12,
                "status": "healthy",
            },
            {
                "id": 10,
                "name": "Management",
                "subnet": "10.10.10.0/24",
                "gateway": "10.10.10.1",
                "ports": 8,
                "clients": 3,
                "status": "healthy",
            },
            {
                "id": 20,
                "name": "Users",
                "subnet": "10.20.0.0/22",
                "gateway": "10.20.0.1",
                "ports": 45,
                "clients": 156,
                "status": "healthy",
            },
            {
                "id": 30,
                "name": "Guest",
                "subnet": "10.30.0.0/24",
                "gateway": "10.30.0.1",
                "ports": 12,
                "clients": 34,
                "status": "healthy",
            },
            {
                "id": 40,
                "name": "IoT",
                "subnet": "10.40.0.0/24",
                "gateway": "10.40.0.1",
                "ports": 20,
                "clients": 45,
                "status": "warning",
            },
            {
                "id": 100,
                "name": "Servers",
                "subnet": "10.100.0.0/24",
                "gateway": "10.100.0.1",
                "ports": 6,
                "clients": 8,
                "status": "healthy",
            },
        ]

        trunk_ports = [
            {
                "device": "Core-Switch",
                "port": "Po1",
                "native_vlan": 1,
                "allowed_vlans": [1, 10, 20, 30, 40, 100],
                "connected_to": "HQ-MX68",
            },
            {
                "device": "Core-Switch",
                "port": "Port 47",
                "native_vlan": 1,
                "allowed_vlans": [1, 10, 20, 30],
                "connected_to": "Floor1-Switch",
            },
            {
                "device": "Core-Switch",
                "port": "Port 48",
                "native_vlan": 1,
                "allowed_vlans": [1, 10, 20, 40, 100],
                "connected_to": "Floor2-Switch",
            },
        ]

        vlan_data = {
            "vlans": vlans,
            "trunk_ports": trunk_ports,
            "summary": {
                "total_vlans": len(vlans),
                "total_clients": sum(v["clients"] for v in vlans),
                "total_ports": sum(v["ports"] for v in vlans),
            },
            "visualization": {
                "type": "tree",  # or "sankey", "matrix"
                "root": "Core-Switch",
            },
        }

        endpoint = CardEndpointBuilder.vlan(network_id, org_id)

        return build_card_skill_result(
            card_type=CardType.VLAN_DIAGRAM.value,
            data=vlan_data,
            endpoint=endpoint,
            polling_interval=60000,  # VLANs don't change often
            source="meraki",
            entity_id=network_id,
        )

    @classmethod
    async def _generate_path_trace_card(
        cls,
        source: str,
        destination: str,
        org_id: str,
        context: Any,
    ) -> Dict[str, Any]:
        """Generate path trace card data.

        The card shows:
        - Hop-by-hop path visualization
        - Latency at each hop
        - Device details along the path
        """
        hops = [
            {
                "hop": 1,
                "device": DeviceNodeData(
                    id="src",
                    name="Source Client",
                    type="client",
                    status=StatusLevel.HEALTHY,
                    ip="10.20.0.50",
                ).to_dict(),
                "latency": 0.5,
                "status": "healthy",
            },
            {
                "hop": 2,
                "device": DeviceNodeData(
                    id="ap-1",
                    name="AP-Floor1",
                    type="ap",
                    model="MR46",
                    status=StatusLevel.HEALTHY,
                    ip="192.168.1.10",
                ).to_dict(),
                "latency": 2.1,
                "status": "healthy",
            },
            {
                "hop": 3,
                "device": DeviceNodeData(
                    id="sw-1",
                    name="Floor1-Switch",
                    type="switch",
                    model="MS225-24P",
                    status=StatusLevel.HEALTHY,
                    ip="192.168.1.3",
                ).to_dict(),
                "latency": 0.3,
                "status": "healthy",
            },
            {
                "hop": 4,
                "device": DeviceNodeData(
                    id="sw-core",
                    name="Core-Switch",
                    type="switch",
                    model="MS225-48LP",
                    status=StatusLevel.HEALTHY,
                    ip="192.168.1.2",
                ).to_dict(),
                "latency": 0.2,
                "status": "healthy",
            },
            {
                "hop": 5,
                "device": DeviceNodeData(
                    id="fw",
                    name="HQ-MX68",
                    type="firewall",
                    model="MX68",
                    status=StatusLevel.HEALTHY,
                    ip="192.168.1.1",
                ).to_dict(),
                "latency": 1.5,
                "status": "healthy",
            },
            {
                "hop": 6,
                "device": DeviceNodeData(
                    id="isp",
                    name="ISP Router",
                    type="router",
                    status=StatusLevel.HEALTHY,
                    ip="203.0.113.1",
                ).to_dict(),
                "latency": 8.5,
                "status": "healthy",
            },
            {
                "hop": 7,
                "device": DeviceNodeData(
                    id="dest",
                    name=destination or "Destination",
                    type="cloud",
                    status=StatusLevel.HEALTHY,
                    ip=destination or "8.8.8.8",
                ).to_dict(),
                "latency": 15.2,
                "status": "healthy",
            },
        ]

        total_latency = sum(h["latency"] for h in hops)

        path_data = {
            "source": source or "10.20.0.50",
            "destination": destination or "8.8.8.8",
            "hops": hops,
            "summary": {
                "total_hops": len(hops),
                "total_latency": total_latency,
                "avg_latency": total_latency / len(hops),
                "status": "healthy",
                "packet_loss": 0.0,
            },
            "metrics": [
                MetricTileData(
                    label="Total Latency",
                    value=f"{total_latency:.1f}",
                    unit="ms",
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
                MetricTileData(
                    label="Hops",
                    value=len(hops),
                ).to_dict(),
                MetricTileData(
                    label="Packet Loss",
                    value="0",
                    unit="%",
                    status=StatusLevel.HEALTHY,
                ).to_dict(),
            ],
        }

        endpoint = CardEndpointBuilder.path_trace(source or "client", destination or "8.8.8.8", org_id)

        return build_card_skill_result(
            card_type=CardType.PATH_TRACE.value,
            data=path_data,
            endpoint=endpoint,
            polling_interval=0,  # On-demand, no polling
            source="catalyst",
            entity_id=f"{source}-{destination}",
        )
