"""UI Card Skills Module.

This module provides the modular UI card system for generating
enterprise-grade network visualization cards with polling support.

Modules:
- base: Base classes and data types for cards
- api_client: API endpoint builders and data normalizers
- health: Network health and compliance cards
- topology: Topology and VLAN diagram cards
- traffic: Traffic flow and bandwidth cards
- performance: Performance metrics cards
- alerts: Alert timeline cards
- clients: Client distribution cards
- security: Security events and threat cards
- sites: Multi-site health aggregation cards
- events: Meraki event timeline cards
- integrations: API integration health cards
- costs: AI/API cost tracking cards
- wireless: Wireless overview cards
"""

from .base import (
    UICardModule,
    CardType,
    CardResponse,
    CardMetadata,
    StatusLevel,
    StatusIndicatorData,
    HealthGaugeData,
    MetricTileData,
    DeviceNodeData,
    ConnectionEdgeData,
    ProgressBarData,
    TimelineEventData,
)

from .api_client import (
    CardEndpointBuilder,
    CardDataNormalizer,
    build_card_skill_result,
)

from .health import HealthModule
from .topology import TopologyModule
from .traffic import TrafficModule
from .performance import PerformanceModule
from .alerts import AlertsModule
from .clients import ClientsModule
from .security import SecurityModule
from .sites import SitesModule
from .events import EventsModule
from .integrations import IntegrationsModule
from .costs import CostsModule
from .wireless import WirelessModule

# List of all skill modules for aggregation
SKILL_MODULES = [
    HealthModule,
    TopologyModule,
    TrafficModule,
    PerformanceModule,
    AlertsModule,
    ClientsModule,
    SecurityModule,
    SitesModule,
    EventsModule,
    IntegrationsModule,
    CostsModule,
    WirelessModule,
]

__all__ = [
    # Base classes
    "UICardModule",
    "CardType",
    "CardResponse",
    "CardMetadata",
    "StatusLevel",
    # Data types
    "StatusIndicatorData",
    "HealthGaugeData",
    "MetricTileData",
    "DeviceNodeData",
    "ConnectionEdgeData",
    "ProgressBarData",
    "TimelineEventData",
    # API utilities
    "CardEndpointBuilder",
    "CardDataNormalizer",
    "build_card_skill_result",
    # Modules
    "HealthModule",
    "TopologyModule",
    "TrafficModule",
    "PerformanceModule",
    "AlertsModule",
    "ClientsModule",
    "SecurityModule",
    "SitesModule",
    "EventsModule",
    "IntegrationsModule",
    "CostsModule",
    "WirelessModule",
    "SKILL_MODULES",
]
