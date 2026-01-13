"""Base classes for UI Card Skill Modules.

This module provides the foundation for building modular UI card skills
that generate enterprise-grade network visualization cards with polling support.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional, TypeVar, Generic
import logging

from ...types import AgentSkill

logger = logging.getLogger(__name__)


class CardType(str, Enum):
    """Types of enterprise cards."""
    # Health & Status
    NETWORK_HEALTH = "network-health"
    DEVICE_STATUS = "device-status"
    COMPLIANCE = "compliance"
    SITE_HEALTH = "site-health"
    INTEGRATION_HEALTH = "integration-health"
    # Topology & Architecture
    TOPOLOGY = "topology"
    VLAN_DIAGRAM = "vlan-diagram"
    PATH_TRACE = "path-trace"
    # Traffic & Performance
    TRAFFIC_FLOW = "traffic-flow"
    BANDWIDTH = "bandwidth"
    PERFORMANCE = "performance"
    WIRELESS_OVERVIEW = "wireless-overview"
    # Events & Alerts
    ALERT_TIMELINE = "alert-timeline"
    MERAKI_EVENTS = "meraki-events"
    SECURITY_EVENTS = "security-events"
    # Clients & Analytics
    CLIENT_DISTRIBUTION = "client-distribution"
    COST_TRACKING = "cost-tracking"


class StatusLevel(str, Enum):
    """Status severity levels."""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


@dataclass
class CardMetadata:
    """Metadata for card responses."""
    generated_at: datetime = field(default_factory=datetime.utcnow)
    cache_ttl: int = 30  # seconds
    polling_interval: int = 30000  # milliseconds
    source: str = ""
    entity_id: str = ""
    entity_type: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "generated_at": self.generated_at.isoformat() + "Z",
            "cache_ttl": self.cache_ttl,
            "polling_interval": self.polling_interval,
            "source": self.source,
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
        }


@dataclass
class CardResponse:
    """Standard response structure for card data endpoints."""
    card_type: CardType
    data: Dict[str, Any]
    metadata: CardMetadata

    def to_dict(self) -> Dict[str, Any]:
        return {
            "card_type": self.card_type.value,
            "data": self.data,
            "metadata": self.metadata.to_dict(),
        }


@dataclass
class StatusIndicatorData:
    """Data for a status indicator widget."""
    status: StatusLevel
    label: str
    count: Optional[int] = None
    pulse: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "label": self.label,
            "count": self.count,
            "pulse": self.pulse,
        }


@dataclass
class HealthGaugeData:
    """Data for a health gauge widget."""
    value: float  # 0-100
    label: str
    trend: Optional[str] = None  # 'up', 'down', 'stable'
    threshold_warning: int = 80
    threshold_critical: int = 50

    def to_dict(self) -> Dict[str, Any]:
        return {
            "value": self.value,
            "label": self.label,
            "trend": self.trend,
            "thresholds": {
                "warning": self.threshold_warning,
                "critical": self.threshold_critical,
            },
        }


@dataclass
class MetricTileData:
    """Data for a metric tile widget."""
    label: str
    value: Any
    unit: Optional[str] = None
    trend_direction: Optional[str] = None  # 'up', 'down', 'stable'
    trend_percent: Optional[float] = None
    status: Optional[StatusLevel] = None
    sparkline: Optional[List[float]] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "label": self.label,
            "value": self.value,
            "unit": self.unit,
        }
        if self.trend_direction:
            result["trend"] = {
                "direction": self.trend_direction,
                "percent": self.trend_percent,
            }
        if self.status:
            result["status"] = self.status.value
        if self.sparkline:
            result["sparkline"] = self.sparkline
        return result


@dataclass
class DeviceNodeData:
    """Data for a device node in topology."""
    id: str
    name: str
    type: str  # 'router', 'switch', 'ap', 'firewall', 'server', 'client', 'cloud'
    model: Optional[str] = None
    status: StatusLevel = StatusLevel.HEALTHY
    ip: Optional[str] = None
    mac: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "model": self.model,
            "status": self.status.value,
            "ip": self.ip,
            "mac": self.mac,
            "position": {"x": self.x, "y": self.y} if self.x is not None else None,
            "metadata": self.metadata,
        }


@dataclass
class ConnectionEdgeData:
    """Data for a connection edge in topology."""
    id: str
    source: str
    target: str
    label: Optional[str] = None
    status: StatusLevel = StatusLevel.HEALTHY
    bandwidth: Optional[str] = None
    utilization: Optional[float] = None
    latency: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source,
            "target": self.target,
            "label": self.label,
            "status": self.status.value,
            "bandwidth": self.bandwidth,
            "utilization": self.utilization,
            "latency": self.latency,
        }


@dataclass
class ProgressBarData:
    """Data for a progress/utilization bar widget."""
    label: str
    value: float  # 0-100
    max_value: float = 100
    unit: str = "%"
    status: Optional[StatusLevel] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "label": self.label,
            "value": self.value,
            "maxValue": self.max_value,
            "unit": self.unit,
            "status": self.status.value if self.status else None,
        }


@dataclass
class TimelineEventData:
    """Data for an event in a timeline."""
    id: str
    timestamp: datetime
    title: str
    description: Optional[str] = None
    severity: StatusLevel = StatusLevel.HEALTHY
    source: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() + "Z",
            "title": self.title,
            "description": self.description,
            "severity": self.severity.value,
            "source": self.source,
            "metadata": self.metadata,
        }


class UICardModule(ABC):
    """Base class for UI card skill modules.

    Each module provides skills for generating specific card types
    and their associated data for polling endpoints.
    """

    MODULE_NAME: str = "base"
    MODULE_DESCRIPTION: str = "Base UI card module"

    @classmethod
    @abstractmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get the skills provided by this module."""
        pass

    @classmethod
    @abstractmethod
    def handles(cls, skill_id: str) -> bool:
        """Check if this module handles the given skill."""
        pass

    @classmethod
    @abstractmethod
    async def execute(
        cls,
        skill_id: str,
        params: Dict[str, Any],
        context: Any,
    ) -> CardResponse:
        """Execute a skill and return card data.

        Args:
            skill_id: The skill to execute
            params: Skill parameters including entity IDs
            context: Execution context with API credentials

        Returns:
            CardResponse with data for the card
        """
        pass

    @classmethod
    def get_status_from_score(cls, score: float) -> StatusLevel:
        """Convert a 0-100 score to a status level.

        Args:
            score: Health/performance score (0-100)

        Returns:
            StatusLevel based on score thresholds
        """
        if score >= 80:
            return StatusLevel.HEALTHY
        elif score >= 50:
            return StatusLevel.WARNING
        elif score > 0:
            return StatusLevel.CRITICAL
        else:
            return StatusLevel.OFFLINE

    @classmethod
    def create_metadata(
        cls,
        source: str,
        entity_id: str = "",
        entity_type: str = "",
        cache_ttl: int = 30,
        polling_interval: int = 30000,
    ) -> CardMetadata:
        """Create card metadata with defaults.

        Args:
            source: Data source (e.g., "meraki", "catalyst")
            entity_id: ID of the entity (network, device, etc.)
            entity_type: Type of entity
            cache_ttl: Cache TTL in seconds
            polling_interval: Polling interval in milliseconds

        Returns:
            CardMetadata instance
        """
        return CardMetadata(
            source=source,
            entity_id=entity_id,
            entity_type=entity_type,
            cache_ttl=cache_ttl,
            polling_interval=polling_interval,
        )


# Type aliases for commonly used structures
SkillParams = Dict[str, Any]
CardData = Dict[str, Any]
