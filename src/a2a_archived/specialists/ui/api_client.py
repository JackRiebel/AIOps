"""API Client utilities for UI Card modules.

Provides helper functions for generating polling endpoint URLs
and standardizing API response handling.
"""

from typing import Dict, Any, Optional
from urllib.parse import urlencode
import logging

logger = logging.getLogger(__name__)


class CardEndpointBuilder:
    """Builder for card polling endpoint URLs."""

    BASE_PATH = "/api/cards"

    @classmethod
    def network_health(cls, network_id: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for network health card."""
        url = f"{cls.BASE_PATH}/network-health/{network_id}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def device_status(cls, network_id: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for device status card."""
        url = f"{cls.BASE_PATH}/device-status/{network_id}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def topology(cls, network_id: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for topology card."""
        url = f"{cls.BASE_PATH}/topology/{network_id}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def vlan(cls, network_id: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for VLAN diagram card."""
        url = f"{cls.BASE_PATH}/vlan/{network_id}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def bandwidth(cls, device_serial: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for bandwidth card."""
        url = f"{cls.BASE_PATH}/bandwidth/{device_serial}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def traffic_flow(cls, network_id: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for traffic flow card."""
        url = f"{cls.BASE_PATH}/traffic-flow/{network_id}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def alerts(cls, org_id: str) -> str:
        """Build endpoint for alerts card."""
        return f"{cls.BASE_PATH}/alerts/{org_id}/data"

    @classmethod
    def clients(cls, network_id: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for client distribution card."""
        url = f"{cls.BASE_PATH}/clients/{network_id}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def performance(cls, test_id: str) -> str:
        """Build endpoint for performance card (ThousandEyes)."""
        return f"{cls.BASE_PATH}/performance/{test_id}/data"

    @classmethod
    def path_trace(
        cls,
        source: str,
        destination: str,
        org_id: Optional[str] = None,
    ) -> str:
        """Build endpoint for path trace card."""
        url = f"{cls.BASE_PATH}/path-trace/{source}/{destination}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url

    @classmethod
    def compliance(cls, network_id: str, org_id: Optional[str] = None) -> str:
        """Build endpoint for compliance card."""
        url = f"{cls.BASE_PATH}/compliance/{network_id}/data"
        if org_id:
            url += f"?{urlencode({'org_id': org_id})}"
        return url


class CardDataNormalizer:
    """Utilities for normalizing data for card consumption."""

    @staticmethod
    def normalize_device_type(device_type: str) -> str:
        """Normalize device type strings to standard types.

        Args:
            device_type: Raw device type from API

        Returns:
            Normalized type: router, switch, ap, firewall, server, client, cloud
        """
        device_type_lower = device_type.lower()

        # Meraki device types
        if "mx" in device_type_lower or "security" in device_type_lower:
            return "firewall"
        if "ms" in device_type_lower or "switch" in device_type_lower:
            return "switch"
        if "mr" in device_type_lower or "wireless" in device_type_lower or "ap" in device_type_lower:
            return "ap"
        if "mv" in device_type_lower or "camera" in device_type_lower:
            return "server"  # Use server icon for cameras
        if "mg" in device_type_lower or "cellular" in device_type_lower:
            return "router"

        # Catalyst device types
        if "router" in device_type_lower:
            return "router"
        if "wlc" in device_type_lower or "controller" in device_type_lower:
            return "router"

        # Generic types
        if "server" in device_type_lower:
            return "server"
        if "client" in device_type_lower or "endpoint" in device_type_lower:
            return "client"
        if "cloud" in device_type_lower or "internet" in device_type_lower:
            return "cloud"

        # Default to switch for unknown network devices
        return "switch"

    @staticmethod
    def normalize_status(status: str) -> str:
        """Normalize status strings to standard status levels.

        Args:
            status: Raw status from API

        Returns:
            Normalized status: healthy, warning, critical, offline, unknown
        """
        status_lower = status.lower()

        # Online/healthy variants
        if status_lower in ["online", "up", "active", "healthy", "reachable", "connected"]:
            return "healthy"

        # Warning variants
        if status_lower in ["warning", "degraded", "alerting", "partial"]:
            return "warning"

        # Critical variants
        if status_lower in ["critical", "error", "down", "failed", "unreachable"]:
            return "critical"

        # Offline variants
        if status_lower in ["offline", "dormant", "inactive", "disabled"]:
            return "offline"

        return "unknown"

    @staticmethod
    def format_bytes(bytes_value: int) -> str:
        """Format bytes into human-readable string.

        Args:
            bytes_value: Number of bytes

        Returns:
            Formatted string (e.g., "1.5 GB")
        """
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if abs(bytes_value) < 1024:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024
        return f"{bytes_value:.1f} PB"

    @staticmethod
    def format_bandwidth(bps: float) -> str:
        """Format bits per second into human-readable string.

        Args:
            bps: Bits per second

        Returns:
            Formatted string (e.g., "1.5 Gbps")
        """
        for unit in ["bps", "Kbps", "Mbps", "Gbps", "Tbps"]:
            if abs(bps) < 1000:
                return f"{bps:.1f} {unit}"
            bps /= 1000
        return f"{bps:.1f} Pbps"

    @staticmethod
    def format_latency(ms: float) -> str:
        """Format latency in milliseconds.

        Args:
            ms: Latency in milliseconds

        Returns:
            Formatted string (e.g., "45 ms")
        """
        if ms < 1:
            return f"{ms * 1000:.0f} us"
        elif ms < 1000:
            return f"{ms:.1f} ms"
        else:
            return f"{ms / 1000:.2f} s"

    @staticmethod
    def calculate_utilization(used: float, total: float) -> float:
        """Calculate utilization percentage.

        Args:
            used: Used amount
            total: Total capacity

        Returns:
            Percentage (0-100)
        """
        if total <= 0:
            return 0.0
        return min(100.0, (used / total) * 100)


def build_card_skill_result(
    card_type: str,
    data: Dict[str, Any],
    endpoint: str,
    polling_interval: int = 30000,
    source: str = "",
    entity_id: str = "",
) -> Dict[str, Any]:
    """Build a standardized skill result for card generation.

    This is returned from UI Agent skills to tell the frontend
    what card to render and where to poll for data.

    Args:
        card_type: Type of card to render
        data: Initial card data
        endpoint: Polling endpoint URL
        polling_interval: Polling interval in ms
        source: Data source identifier
        entity_id: Entity ID for the card

    Returns:
        Skill result dictionary
    """
    from datetime import datetime

    return {
        "card_type": card_type,
        "data": data,
        "polling": {
            "endpoint": endpoint,
            "interval": polling_interval,
            "enabled": True,
        },
        "metadata": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "source": source,
            "entity_id": entity_id,
        },
    }
