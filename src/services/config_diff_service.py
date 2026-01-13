"""
Config Diff Service

Provides configuration change previews for safer write operations.
Per Cisco AI Assistant best practices: "Show diff previews for config changes."

Features:
- Generate diff previews before any config change
- Estimate impact and downtime
- Track change history for potential rollback
- Format changes for clear user confirmation
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class ChangeImpact(str, Enum):
    """Impact levels for configuration changes."""
    LOW = "low"       # No service impact
    MEDIUM = "medium" # Brief disruption possible
    HIGH = "high"     # Service disruption likely
    CRITICAL = "critical"  # Extended outage possible


@dataclass
class ConfigChange:
    """A single field change in a configuration."""
    field: str
    old_value: Any
    new_value: Any
    impact: ChangeImpact = ChangeImpact.LOW

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field": self.field,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "impact": self.impact.value,
        }


@dataclass
class ConfigDiffPreview:
    """Preview of configuration changes for user confirmation."""
    resource_type: str  # ssid, vlan, firewall_rule, device, etc.
    resource_name: str
    resource_id: str
    network_id: Optional[str] = None
    network_name: Optional[str] = None
    operation: str = "update"  # create, update, delete
    changes: List[ConfigChange] = field(default_factory=list)
    affected_devices: List[str] = field(default_factory=list)
    requires_restart: bool = False
    estimated_downtime: str = "None"
    warnings: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def max_impact(self) -> ChangeImpact:
        """Get the highest impact level among all changes."""
        if not self.changes:
            return ChangeImpact.LOW
        impacts = [c.impact for c in self.changes]
        if ChangeImpact.CRITICAL in impacts:
            return ChangeImpact.CRITICAL
        if ChangeImpact.HIGH in impacts:
            return ChangeImpact.HIGH
        if ChangeImpact.MEDIUM in impacts:
            return ChangeImpact.MEDIUM
        return ChangeImpact.LOW

    def to_dict(self) -> Dict[str, Any]:
        return {
            "resource_type": self.resource_type,
            "resource_name": self.resource_name,
            "resource_id": self.resource_id,
            "network_id": self.network_id,
            "network_name": self.network_name,
            "operation": self.operation,
            "changes": [c.to_dict() for c in self.changes],
            "affected_devices": self.affected_devices,
            "requires_restart": self.requires_restart,
            "estimated_downtime": self.estimated_downtime,
            "max_impact": self.max_impact.value,
            "warnings": self.warnings,
        }


class ConfigDiffService:
    """
    Service for generating configuration change previews.

    Usage:
        diff_service = ConfigDiffService()

        # Generate diff for SSID update
        preview = await diff_service.generate_diff(
            resource_type="ssid",
            resource_id="1",
            current_config=current_ssid,
            proposed_config={"enabled": False, "name": "Guest-WiFi"}
        )

        # Format for display
        markdown = diff_service.format_diff_for_display(preview)
    """

    # Field-level impact definitions
    FIELD_IMPACTS = {
        # SSID fields
        "enabled": ChangeImpact.HIGH,
        "authMode": ChangeImpact.HIGH,
        "psk": ChangeImpact.MEDIUM,
        "name": ChangeImpact.LOW,
        "visible": ChangeImpact.LOW,
        "bandSelection": ChangeImpact.MEDIUM,
        "minBitrate": ChangeImpact.LOW,
        "perClientBandwidthLimitUp": ChangeImpact.LOW,
        "perClientBandwidthLimitDown": ChangeImpact.LOW,
        "ipAssignmentMode": ChangeImpact.HIGH,
        "defaultVlanId": ChangeImpact.HIGH,
        "useVlanTagging": ChangeImpact.HIGH,

        # VLAN fields
        "subnet": ChangeImpact.CRITICAL,
        "applianceIp": ChangeImpact.HIGH,
        "dhcpHandling": ChangeImpact.MEDIUM,
        "dnsNameservers": ChangeImpact.MEDIUM,
        "dhcpLeaseTime": ChangeImpact.LOW,
        "dhcpBootOptionsEnabled": ChangeImpact.LOW,

        # Firewall fields
        "policy": ChangeImpact.HIGH,
        "srcPort": ChangeImpact.MEDIUM,
        "destPort": ChangeImpact.MEDIUM,
        "srcCidr": ChangeImpact.MEDIUM,
        "destCidr": ChangeImpact.MEDIUM,
        "protocol": ChangeImpact.MEDIUM,
        "comment": ChangeImpact.LOW,

        # Device fields
        "tags": ChangeImpact.LOW,
        "notes": ChangeImpact.LOW,
        "address": ChangeImpact.LOW,
        "floorPlanId": ChangeImpact.LOW,

        # Switch port fields
        "vlan": ChangeImpact.HIGH,
        "voiceVlan": ChangeImpact.MEDIUM,
        "type": ChangeImpact.HIGH,  # trunk/access
        "poeEnabled": ChangeImpact.MEDIUM,
        "rstpEnabled": ChangeImpact.MEDIUM,
        "stpGuard": ChangeImpact.MEDIUM,
        "accessPolicyType": ChangeImpact.MEDIUM,
    }

    # Fields that require device restart
    RESTART_FIELDS = {
        "subnet", "applianceIp", "ipAssignmentMode", "useVlanTagging",
    }

    def __init__(self):
        self._pending_changes: Dict[str, ConfigDiffPreview] = {}

    async def generate_diff(
        self,
        resource_type: str,
        resource_id: str,
        current_config: Dict[str, Any],
        proposed_config: Dict[str, Any],
        resource_name: Optional[str] = None,
        network_id: Optional[str] = None,
        network_name: Optional[str] = None,
        affected_devices: Optional[List[str]] = None,
    ) -> ConfigDiffPreview:
        """
        Generate a diff preview for a configuration change.

        Args:
            resource_type: Type of resource (ssid, vlan, firewall_rule, etc.)
            resource_id: Resource identifier
            current_config: Current configuration dictionary
            proposed_config: Proposed changes dictionary
            resource_name: Human-readable resource name
            network_id: Network ID for context
            network_name: Network name for display
            affected_devices: List of device serials affected

        Returns:
            ConfigDiffPreview with detailed change information
        """
        changes = []
        requires_restart = False
        warnings = []

        for key, new_value in proposed_config.items():
            if key in current_config:
                old_value = current_config[key]
                if old_value != new_value:
                    impact = self.FIELD_IMPACTS.get(key, ChangeImpact.LOW)
                    changes.append(ConfigChange(
                        field=key,
                        old_value=old_value,
                        new_value=new_value,
                        impact=impact,
                    ))

                    # Check if restart required
                    if key in self.RESTART_FIELDS:
                        requires_restart = True

                    # Add specific warnings
                    if key == "enabled" and new_value is False:
                        warnings.append(f"Disabling this {resource_type} will disconnect all clients")
                    if key == "psk":
                        warnings.append("Changing PSK will require all clients to re-authenticate")
                    if key == "subnet":
                        warnings.append("Changing subnet will affect all clients on this VLAN")

        # Estimate downtime
        if requires_restart:
            estimated_downtime = "1-5 minutes (restart required)"
        elif any(c.impact == ChangeImpact.HIGH for c in changes):
            estimated_downtime = "< 1 minute (brief disruption possible)"
        elif any(c.impact == ChangeImpact.MEDIUM for c in changes):
            estimated_downtime = "< 30 seconds"
        else:
            estimated_downtime = "None"

        preview = ConfigDiffPreview(
            resource_type=resource_type,
            resource_name=resource_name or resource_id,
            resource_id=resource_id,
            network_id=network_id,
            network_name=network_name,
            operation="update",
            changes=changes,
            affected_devices=affected_devices or [],
            requires_restart=requires_restart,
            estimated_downtime=estimated_downtime,
            warnings=warnings,
        )

        # Store for potential confirmation
        change_key = f"{resource_type}:{resource_id}"
        self._pending_changes[change_key] = preview

        return preview

    def format_diff_for_display(self, preview: ConfigDiffPreview) -> str:
        """
        Format a diff preview as markdown for AI response.

        Returns:
            Markdown-formatted diff preview
        """
        impact_emoji = {
            ChangeImpact.LOW: "🟢",
            ChangeImpact.MEDIUM: "🟡",
            ChangeImpact.HIGH: "🔴",
            ChangeImpact.CRITICAL: "⛔",
        }

        lines = [
            "## Configuration Change Preview",
            "",
            f"**Resource**: {preview.resource_type.upper()} - {preview.resource_name}",
        ]

        if preview.network_name:
            lines.append(f"**Network**: {preview.network_name}")
        elif preview.network_id:
            lines.append(f"**Network ID**: {preview.network_id}")

        if preview.affected_devices:
            lines.append(f"**Affected Devices**: {len(preview.affected_devices)}")

        lines.extend([
            "",
            "### Changes",
            "",
            "| Field | Current | Proposed | Impact |",
            "|-------|---------|----------|--------|",
        ])

        for change in preview.changes:
            emoji = impact_emoji.get(change.impact, "⚪")

            # Format values (truncate if too long)
            old_str = self._format_value(change.old_value)
            new_str = self._format_value(change.new_value)

            lines.append(
                f"| {change.field} | `{old_str}` | `{new_str}` | {emoji} {change.impact.value.title()} |"
            )

        lines.extend([
            "",
            f"**Requires Restart**: {'Yes' if preview.requires_restart else 'No'}",
            f"**Estimated Downtime**: {preview.estimated_downtime}",
            f"**Overall Impact**: {impact_emoji.get(preview.max_impact, '⚪')} {preview.max_impact.value.upper()}",
        ])

        if preview.warnings:
            lines.extend([
                "",
                "### Warnings",
            ])
            for warning in preview.warnings:
                lines.append(f"⚠️ {warning}")

        lines.extend([
            "",
            "---",
            "**Confirm this change?** Reply 'yes' to proceed or 'no' to cancel.",
        ])

        return "\n".join(lines)

    def _format_value(self, value: Any, max_length: int = 20) -> str:
        """Format a value for display, truncating if necessary."""
        if value is None:
            return "-"
        if isinstance(value, bool):
            return "Yes" if value else "No"
        if isinstance(value, (list, dict)):
            s = str(value)
            if len(s) > max_length:
                return s[:max_length-3] + "..."
            return s

        s = str(value)
        if len(s) > max_length:
            return s[:max_length-3] + "..."
        return s

    def get_pending_change(self, resource_type: str, resource_id: str) -> Optional[ConfigDiffPreview]:
        """Get a pending change for confirmation."""
        key = f"{resource_type}:{resource_id}"
        return self._pending_changes.get(key)

    def clear_pending_change(self, resource_type: str, resource_id: str) -> None:
        """Clear a pending change after confirmation or cancellation."""
        key = f"{resource_type}:{resource_id}"
        self._pending_changes.pop(key, None)


# Convenience function
def create_diff_preview(
    resource_type: str,
    current_config: Dict[str, Any],
    proposed_config: Dict[str, Any],
    **kwargs
) -> ConfigDiffPreview:
    """Create a diff preview synchronously."""
    service = ConfigDiffService()
    import asyncio
    return asyncio.get_event_loop().run_until_complete(
        service.generate_diff(
            resource_type=resource_type,
            resource_id=kwargs.get("resource_id", "unknown"),
            current_config=current_config,
            proposed_config=proposed_config,
            **kwargs
        )
    )
