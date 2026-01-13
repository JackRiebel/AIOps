"""
Response Formatter Service

Provides utilities for formatting AI responses according to best practices:
- Table formatting with column limits
- Status indicators for device/network health
- Unit formatting for metrics
- Data summarization for large result sets

Based on best practices from Agent.ai, OpenAI, and Anthropic research.
"""

import logging
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class StatusLevel(Enum):
    """Status levels with visual indicators."""
    HEALTHY = ("healthy", "🟢")
    WARNING = ("warning", "🟡")
    CRITICAL = ("critical", "🔴")
    UNKNOWN = ("unknown", "⚪")

    @classmethod
    def from_status(cls, status: str) -> 'StatusLevel':
        """Convert status string to StatusLevel."""
        status_lower = status.lower() if status else ""

        if status_lower in ["online", "healthy", "active", "up", "connected", "good", "success", "running"]:
            return cls.HEALTHY
        elif status_lower in ["warning", "degraded", "alerting", "partial", "dormant"]:
            return cls.WARNING
        elif status_lower in ["offline", "critical", "down", "error", "failed", "unreachable", "bad"]:
            return cls.CRITICAL
        else:
            return cls.UNKNOWN

    @property
    def indicator(self) -> str:
        return self.value[1]


@dataclass
class TableColumn:
    """Definition of a table column."""
    key: str
    header: str
    priority: int = 0  # Higher = more important
    unit: Optional[str] = None
    max_width: int = 25


class ResponseFormatter:
    """
    Formats tool results for consistent, readable AI responses.

    Usage:
        formatter = ResponseFormatter()

        # Format device list as table
        table = formatter.format_table(
            devices,
            columns=["name", "model", "status", "clients"],
            max_columns=6
        )

        # Add status indicator
        status = formatter.format_status("online")  # Returns "🟢 Online"

        # Format metrics with units
        bandwidth = formatter.format_metric(1500000000, "bytes")  # Returns "1.5 GB"
    """

    # Priority columns - these should be shown first
    PRIORITY_COLUMNS = {
        "name": 100,
        "status": 90,
        "model": 80,
        "serial": 70,
        "ip": 60,
        "ipAddress": 60,
        "mac": 55,
        "type": 50,
        "clients": 45,
        "usage": 40,
        "uptime": 35,
    }

    # Common headers with units
    COLUMN_HEADERS = {
        "name": "Name",
        "status": "Status",
        "model": "Model",
        "serial": "Serial",
        "ip": "IP Address",
        "ipAddress": "IP Address",
        "mac": "MAC",
        "clients": "Clients",
        "usage": "Usage (MB)",
        "sent": "Sent (MB)",
        "recv": "Recv (MB)",
        "uptime": "Uptime (hrs)",
        "latency": "Latency (ms)",
        "loss": "Loss (%)",
        "bandwidth": "Bandwidth (Mbps)",
        "channel": "Channel",
        "rssi": "RSSI (dBm)",
        "snr": "SNR (dB)",
        "vlan": "VLAN",
        "port": "Port",
        "speed": "Speed (Mbps)",
        "firmware": "Firmware",
        "lastSeen": "Last Seen",
        "networkId": "Network ID",
        "type": "Type",
    }

    @classmethod
    def format_table(
        cls,
        data: List[Dict[str, Any]],
        columns: Optional[List[str]] = None,
        max_columns: int = 6,
        max_rows: int = 20,
        include_status_indicators: bool = True,
    ) -> str:
        """
        Format a list of dictionaries as a markdown table.

        Args:
            data: List of dictionaries to format
            columns: Specific columns to include (auto-detects if None)
            max_columns: Maximum number of columns (default 6)
            max_rows: Maximum number of rows (default 20)
            include_status_indicators: Add emoji indicators for status columns

        Returns:
            Markdown table string
        """
        if not data:
            return "_No data available_"

        # Auto-detect columns if not specified
        if columns is None:
            all_keys = set()
            for item in data[:10]:  # Sample first 10 items
                all_keys.update(item.keys())

            # Sort by priority
            columns = sorted(
                all_keys,
                key=lambda k: cls.PRIORITY_COLUMNS.get(k, 0),
                reverse=True
            )

        # Limit columns
        columns = columns[:max_columns]

        # Build header row
        headers = [cls.COLUMN_HEADERS.get(col, col.replace("_", " ").title()) for col in columns]
        header_row = "| " + " | ".join(headers) + " |"
        separator = "|" + "|".join(["---" for _ in columns]) + "|"

        # Build data rows
        rows = []
        for item in data[:max_rows]:
            row_data = []
            for col in columns:
                value = item.get(col, "-")

                # Format special columns
                if col.lower() == "status" and include_status_indicators:
                    value = cls.format_status(value)
                elif col.lower() in ["usage", "sent", "recv"] and isinstance(value, (int, float)):
                    value = cls.format_bytes(value)
                elif col.lower() == "uptime" and isinstance(value, (int, float)):
                    value = cls.format_uptime(value)

                # Truncate long values
                value_str = str(value) if value is not None else "-"
                if len(value_str) > 25:
                    value_str = value_str[:22] + "..."

                row_data.append(value_str)

            rows.append("| " + " | ".join(row_data) + " |")

        # Add truncation notice if needed
        footer = ""
        if len(data) > max_rows:
            footer = f"\n_Showing {max_rows} of {len(data)} items_"

        return "\n".join([header_row, separator] + rows) + footer

    @classmethod
    def format_status(cls, status: str) -> str:
        """Format status with visual indicator."""
        if not status:
            return "⚪ Unknown"

        level = StatusLevel.from_status(status)
        # Capitalize first letter
        display = status.capitalize() if status else "Unknown"
        return f"{level.indicator} {display}"

    @classmethod
    def format_bytes(cls, bytes_value: Union[int, float], precision: int = 1) -> str:
        """Format bytes into human-readable string."""
        if bytes_value is None:
            return "-"

        units = ["B", "KB", "MB", "GB", "TB"]
        value = float(bytes_value)

        for unit in units:
            if abs(value) < 1024.0:
                return f"{value:.{precision}f} {unit}"
            value /= 1024.0

        return f"{value:.{precision}f} PB"

    @classmethod
    def format_uptime(cls, seconds: Union[int, float]) -> str:
        """Format uptime in seconds to human-readable string."""
        if seconds is None:
            return "-"

        seconds = int(seconds)
        if seconds < 3600:  # Less than 1 hour
            return f"{seconds // 60} min"
        elif seconds < 86400:  # Less than 1 day
            hours = seconds // 3600
            return f"{hours} hr{'s' if hours > 1 else ''}"
        else:
            days = seconds // 86400
            hours = (seconds % 86400) // 3600
            return f"{days}d {hours}h"

    @classmethod
    def format_metric(
        cls,
        value: Union[int, float],
        unit: str,
        precision: int = 1
    ) -> str:
        """Format a metric value with appropriate unit scaling."""
        if value is None:
            return "-"

        if unit in ["bytes", "B"]:
            return cls.format_bytes(value, precision)
        elif unit in ["seconds", "s", "sec"]:
            return cls.format_uptime(value)
        elif unit in ["percentage", "%", "percent"]:
            return f"{value:.{precision}f}%"
        elif unit in ["ms", "milliseconds"]:
            return f"{value:.{precision}f} ms"
        elif unit in ["Mbps", "mbps"]:
            return f"{value:.{precision}f} Mbps"
        elif unit in ["dBm", "dbm"]:
            return f"{int(value)} dBm"
        else:
            return f"{value:.{precision}f} {unit}"

    @classmethod
    def summarize_results(
        cls,
        data: List[Dict[str, Any]],
        entity_type: str = "items",
        status_field: str = "status",
    ) -> str:
        """
        Generate a summary of results for natural language response.

        Args:
            data: List of dictionaries
            entity_type: Type of entities (e.g., "devices", "networks", "clients")
            status_field: Field name containing status

        Returns:
            Summary string like "Found 15 devices: 12 online, 2 alerting, 1 offline"
        """
        if not data:
            return f"No {entity_type} found"

        total = len(data)

        # Count by status
        status_counts = {}
        for item in data:
            status = str(item.get(status_field, "unknown")).lower()
            level = StatusLevel.from_status(status)
            status_counts[level] = status_counts.get(level, 0) + 1

        # Build summary
        summary_parts = [f"Found **{total}** {entity_type}"]

        status_strs = []
        for level in [StatusLevel.HEALTHY, StatusLevel.WARNING, StatusLevel.CRITICAL, StatusLevel.UNKNOWN]:
            count = status_counts.get(level, 0)
            if count > 0:
                status_strs.append(f"{level.indicator} {count} {level.value[0]}")

        if status_strs:
            summary_parts.append(": " + ", ".join(status_strs))

        return "".join(summary_parts)

    @classmethod
    def format_device_list(cls, devices: List[Dict], max_devices: int = 10) -> str:
        """Format a device list with summary and table."""
        if not devices:
            return "No devices found"

        summary = cls.summarize_results(devices, "devices", "status")
        table = cls.format_table(
            devices,
            columns=["name", "model", "status", "serial", "clients"],
            max_columns=5,
            max_rows=max_devices,
        )

        return f"{summary}\n\n{table}"

    @classmethod
    def format_network_list(cls, networks: List[Dict], max_networks: int = 10) -> str:
        """Format a network list with summary and table."""
        if not networks:
            return "No networks found"

        summary = f"Found **{len(networks)}** networks"
        table = cls.format_table(
            networks,
            columns=["name", "type", "timeZone", "id"],
            max_columns=4,
            max_rows=max_networks,
        )

        return f"{summary}\n\n{table}"

    @classmethod
    def format_health_summary(
        cls,
        health_data: Dict[str, Any],
        thresholds: Optional[Dict[str, float]] = None
    ) -> str:
        """
        Format health data with visual indicators.

        Args:
            health_data: Dictionary with health metrics
            thresholds: Optional custom thresholds (default: 95=healthy, 80=warning)

        Returns:
            Formatted health summary with indicators
        """
        if not health_data:
            return "⚪ Health data unavailable"

        thresholds = thresholds or {"healthy": 95, "warning": 80}

        lines = []
        for metric, value in health_data.items():
            if isinstance(value, (int, float)):
                if value >= thresholds["healthy"]:
                    indicator = "🟢"
                elif value >= thresholds["warning"]:
                    indicator = "🟡"
                else:
                    indicator = "🔴"

                lines.append(f"{indicator} **{metric.replace('_', ' ').title()}**: {value:.1f}%")
            else:
                lines.append(f"**{metric.replace('_', ' ').title()}**: {value}")

        return "\n".join(lines)


# Convenience functions
def format_table(data: List[Dict], **kwargs) -> str:
    """Format data as a markdown table."""
    return ResponseFormatter.format_table(data, **kwargs)


def format_status(status: str) -> str:
    """Format status with visual indicator."""
    return ResponseFormatter.format_status(status)


def format_bytes(bytes_value: Union[int, float]) -> str:
    """Format bytes to human-readable."""
    return ResponseFormatter.format_bytes(bytes_value)


def summarize_results(data: List[Dict], entity_type: str = "items") -> str:
    """Generate a summary of results."""
    return ResponseFormatter.summarize_results(data, entity_type)
