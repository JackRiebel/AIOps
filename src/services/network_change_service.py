"""
Network Change Service

Manages network configuration changes with metric capture and rollback capability.
Supports wireless, switch, and appliance configuration changes through Meraki APIs.

Features:
- Capture performance metrics before applying changes
- Apply configuration changes via Meraki API
- Track changes with before/after metrics
- Revert changes with automatic metric comparison
"""

import logging
import uuid
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json

logger = logging.getLogger(__name__)


class ChangeType(str, Enum):
    """Types of network configuration changes."""
    SSID_CONFIG = "ssid_config"
    RF_PROFILE = "rf_profile"
    TRAFFIC_SHAPING = "traffic_shaping"
    QOS_RULE = "qos_rule"
    PORT_CONFIG = "port_config"
    UPLINK_BANDWIDTH = "uplink_bandwidth"
    RADIO_SETTINGS = "radio_settings"


class ChangeStatus(str, Enum):
    """Status of a network change."""
    APPLIED = "applied"
    REVERTED = "reverted"
    FAILED = "failed"
    PENDING_METRICS = "pending_metrics"


@dataclass
class PerformanceMetrics:
    """Network performance metrics snapshot."""
    latency_ms: Optional[float] = None
    packet_loss_percent: Optional[float] = None
    jitter_ms: Optional[float] = None
    throughput_mbps: Optional[float] = None
    client_count: Optional[int] = None
    channel_utilization: Optional[float] = None
    signal_strength_dbm: Optional[float] = None
    connection_success_rate: Optional[float] = None
    captured_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "latency_ms": self.latency_ms,
            "packet_loss_percent": self.packet_loss_percent,
            "jitter_ms": self.jitter_ms,
            "throughput_mbps": self.throughput_mbps,
            "client_count": self.client_count,
            "channel_utilization": self.channel_utilization,
            "signal_strength_dbm": self.signal_strength_dbm,
            "connection_success_rate": self.connection_success_rate,
            "captured_at": self.captured_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PerformanceMetrics":
        return cls(
            latency_ms=data.get("latency_ms"),
            packet_loss_percent=data.get("packet_loss_percent"),
            jitter_ms=data.get("jitter_ms"),
            throughput_mbps=data.get("throughput_mbps"),
            client_count=data.get("client_count"),
            channel_utilization=data.get("channel_utilization"),
            signal_strength_dbm=data.get("signal_strength_dbm"),
            connection_success_rate=data.get("connection_success_rate"),
            captured_at=data.get("captured_at", datetime.utcnow().isoformat() + "Z"),
        )


@dataclass
class ChangeRecord:
    """Record of a network configuration change."""
    id: str
    network_id: str
    organization_id: str
    change_type: ChangeType
    setting_path: str  # e.g., 'wireless.ssids.0.bandSelection'
    previous_value: Any
    new_value: Any
    metrics_before: Optional[PerformanceMetrics] = None
    metrics_after: Optional[PerformanceMetrics] = None
    applied_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    reverted_at: Optional[str] = None
    user_id: str = ""
    status: ChangeStatus = ChangeStatus.APPLIED
    description: str = ""
    resource_id: Optional[str] = None  # e.g., SSID number, port ID

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "network_id": self.network_id,
            "organization_id": self.organization_id,
            "change_type": self.change_type.value,
            "setting_path": self.setting_path,
            "previous_value": self.previous_value,
            "new_value": self.new_value,
            "metrics_before": self.metrics_before.to_dict() if self.metrics_before else None,
            "metrics_after": self.metrics_after.to_dict() if self.metrics_after else None,
            "applied_at": self.applied_at,
            "reverted_at": self.reverted_at,
            "user_id": self.user_id,
            "status": self.status.value,
            "description": self.description,
            "resource_id": self.resource_id,
        }

    @classmethod
    def from_db_row(cls, row: Dict[str, Any]) -> "ChangeRecord":
        """Create from database row."""
        return cls(
            id=str(row["id"]),
            network_id=row["network_id"],
            organization_id=row["organization_id"],
            change_type=ChangeType(row["change_type"]),
            setting_path=row["setting_path"],
            previous_value=row["previous_value"],
            new_value=row["new_value"],
            metrics_before=PerformanceMetrics.from_dict(row["metrics_before"]) if row.get("metrics_before") else None,
            metrics_after=PerformanceMetrics.from_dict(row["metrics_after"]) if row.get("metrics_after") else None,
            applied_at=row["applied_at"].isoformat() if hasattr(row["applied_at"], "isoformat") else str(row["applied_at"]),
            reverted_at=row["reverted_at"].isoformat() if row.get("reverted_at") and hasattr(row["reverted_at"], "isoformat") else row.get("reverted_at"),
            user_id=row.get("user_id", ""),
            status=ChangeStatus(row["status"]),
            description=row.get("description", ""),
            resource_id=row.get("resource_id"),
        )


@dataclass
class MetricDelta:
    """Comparison between before and after metrics."""
    metric_name: str
    before_value: Optional[float]
    after_value: Optional[float]
    delta: Optional[float]
    delta_percent: Optional[float]
    improved: bool  # True if the change direction is positive

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric_name": self.metric_name,
            "before_value": self.before_value,
            "after_value": self.after_value,
            "delta": self.delta,
            "delta_percent": self.delta_percent,
            "improved": self.improved,
        }


class NetworkChangeService:
    """
    Service for managing network configuration changes with rollback capability.

    Usage:
        service = NetworkChangeService()

        # Capture current metrics before change
        metrics_before = await service.get_current_metrics(network_id, org_id, ["latency", "throughput"])

        # Apply a configuration change
        change = await service.apply_change(
            network_id=network_id,
            org_id=org_id,
            change_type=ChangeType.SSID_CONFIG,
            setting_path="ssids.0.bandSelection",
            new_value="Dual band operation",
            user_id=user_id,
        )

        # Later, revert if needed
        await service.revert_change(change.id)
    """

    # Metrics where lower is better
    LOWER_IS_BETTER = {"latency_ms", "packet_loss_percent", "jitter_ms", "channel_utilization"}
    # Metrics where higher is better
    HIGHER_IS_BETTER = {"throughput_mbps", "signal_strength_dbm", "connection_success_rate", "client_count"}

    def __init__(self):
        self._db_pool = None

    async def _get_db_pool(self):
        """Get database connection pool."""
        if self._db_pool is None:
            from src.config.database import get_async_session
            self._db_pool = get_async_session
        return self._db_pool

    async def _get_meraki_dashboard(self, org_id: str):
        """Get Meraki Dashboard API client."""
        try:
            from src.services.credential_pool import get_initialized_pool
            import meraki.aio

            pool = await get_initialized_pool()
            meraki_cred = pool.get_for_meraki(organization_id=org_id)

            if not meraki_cred:
                logger.error(f"No Meraki credentials found for org_id: {org_id}")
                return None

            api_key = meraki_cred.get("api_key") or meraki_cred.get("password")
            if not api_key:
                logger.error(f"No API key in Meraki credentials for org_id: {org_id}")
                return None

            return meraki.aio.AsyncDashboardAPI(
                api_key=api_key,
                base_url="https://api.meraki.com/api/v1",
                maximum_retries=2,
                wait_on_rate_limit=True,
                suppress_logging=True,
            )
        except Exception as e:
            logger.error(f"Failed to get Meraki dashboard: {e}")
            return None

    async def get_current_metrics(
        self,
        network_id: str,
        org_id: str,
        metric_types: Optional[List[str]] = None,
    ) -> PerformanceMetrics:
        """
        Capture current network performance metrics.

        Args:
            network_id: Meraki network ID
            org_id: Organization/credential ID
            metric_types: Optional list of specific metrics to capture

        Returns:
            PerformanceMetrics snapshot
        """
        metrics = PerformanceMetrics()

        try:
            dashboard = await self._get_meraki_dashboard(org_id)
            if not dashboard:
                logger.warning(f"Could not get Meraki dashboard for metrics capture")
                return metrics

            try:
                # Get network clients for client count
                try:
                    clients = await dashboard.networks.getNetworkClients(
                        network_id,
                        timespan=300,  # Last 5 minutes
                    )
                    metrics.client_count = len(clients) if clients else 0
                except Exception as e:
                    logger.debug(f"Could not get client count: {e}")

                # Get wireless connection stats
                try:
                    connection_stats = await dashboard.wireless.getNetworkWirelessConnectionStats(
                        network_id,
                        timespan=300,
                    )
                    if connection_stats:
                        # Calculate success rate
                        total = connection_stats.get("assoc", 0) + connection_stats.get("auth", 0)
                        success = connection_stats.get("success", 0)
                        if total > 0:
                            metrics.connection_success_rate = (success / total) * 100
                except Exception as e:
                    logger.debug(f"Could not get connection stats: {e}")

                # Get latency stats from uplinks
                try:
                    uplink_loss = await dashboard.organizations.getOrganizationDevicesUplinksLossAndLatency(
                        org_id,
                        networkIds=[network_id],
                        timespan=300,
                    )
                    if uplink_loss:
                        latencies = []
                        losses = []
                        for device in uplink_loss:
                            for uplink in device.get("uplinks", []):
                                for series in uplink.get("timeSeries", []):
                                    if series.get("latencyMs") is not None:
                                        latencies.append(series["latencyMs"])
                                    if series.get("lossPercent") is not None:
                                        losses.append(series["lossPercent"])

                        if latencies:
                            metrics.latency_ms = sum(latencies) / len(latencies)
                        if losses:
                            metrics.packet_loss_percent = sum(losses) / len(losses)
                except Exception as e:
                    logger.debug(f"Could not get uplink loss/latency: {e}")

                # Get RF channel utilization
                try:
                    rf_summary = await dashboard.wireless.getNetworkWirelessChannelUtilizationHistory(
                        network_id,
                        timespan=300,
                    )
                    if rf_summary:
                        utilizations = []
                        for entry in rf_summary:
                            if entry.get("utilizationTotal") is not None:
                                utilizations.append(entry["utilizationTotal"])
                        if utilizations:
                            metrics.channel_utilization = sum(utilizations) / len(utilizations)
                except Exception as e:
                    logger.debug(f"Could not get channel utilization: {e}")

            finally:
                # Clean up dashboard session
                if hasattr(dashboard, '_session') and dashboard._session:
                    await dashboard._session.close()

        except Exception as e:
            logger.error(f"Error capturing metrics: {e}")

        metrics.captured_at = datetime.utcnow().isoformat() + "Z"
        return metrics

    async def apply_change(
        self,
        network_id: str,
        org_id: str,
        change_type: ChangeType,
        setting_path: str,
        new_value: Any,
        user_id: str,
        resource_id: Optional[str] = None,
        description: str = "",
        capture_metrics: bool = True,
    ) -> ChangeRecord:
        """
        Apply a network configuration change with metric tracking.

        Args:
            network_id: Meraki network ID
            org_id: Organization/credential ID
            change_type: Type of change being made
            setting_path: Path to the setting being changed
            new_value: New value to apply
            user_id: ID of user making the change
            resource_id: Optional resource identifier (e.g., SSID number)
            description: Human-readable description of change
            capture_metrics: Whether to capture performance metrics

        Returns:
            ChangeRecord with change details
        """
        change_id = str(uuid.uuid4())

        # Capture metrics before change
        metrics_before = None
        if capture_metrics:
            try:
                metrics_before = await self.get_current_metrics(network_id, org_id)
            except Exception as e:
                logger.warning(f"Failed to capture pre-change metrics: {e}")

        # Get current value and apply change
        previous_value = None
        try:
            dashboard = await self._get_meraki_dashboard(org_id)
            if not dashboard:
                raise ValueError(f"Could not connect to Meraki API for org {org_id}")

            try:
                previous_value, success = await self._apply_meraki_change(
                    dashboard,
                    network_id,
                    change_type,
                    setting_path,
                    new_value,
                    resource_id,
                )

                if not success:
                    raise ValueError("Failed to apply configuration change")

            finally:
                if hasattr(dashboard, '_session') and dashboard._session:
                    await dashboard._session.close()

        except Exception as e:
            logger.error(f"Failed to apply change: {e}")
            raise

        # Create change record
        change = ChangeRecord(
            id=change_id,
            network_id=network_id,
            organization_id=org_id,
            change_type=change_type,
            setting_path=setting_path,
            previous_value=previous_value,
            new_value=new_value,
            metrics_before=metrics_before,
            user_id=user_id,
            status=ChangeStatus.APPLIED if metrics_before else ChangeStatus.PENDING_METRICS,
            description=description,
            resource_id=resource_id,
        )

        # Save to database
        await self._save_change(change)

        logger.info(f"Applied network change {change_id}: {change_type.value} on {network_id}")
        return change

    async def _apply_meraki_change(
        self,
        dashboard,
        network_id: str,
        change_type: ChangeType,
        setting_path: str,
        new_value: Any,
        resource_id: Optional[str],
    ) -> tuple[Any, bool]:
        """
        Apply a change via Meraki API and return (previous_value, success).
        """
        previous_value = None

        try:
            if change_type == ChangeType.SSID_CONFIG:
                ssid_number = int(resource_id) if resource_id else 0

                # Get current SSID config
                current = await dashboard.wireless.getNetworkWirelessSsid(network_id, ssid_number)
                previous_value = current.get(setting_path.split(".")[-1])

                # Build update payload
                update_field = setting_path.split(".")[-1]
                update_payload = {update_field: new_value}

                # Apply change
                await dashboard.wireless.updateNetworkWirelessSsid(
                    network_id,
                    ssid_number,
                    **update_payload,
                )
                return previous_value, True

            elif change_type == ChangeType.RF_PROFILE:
                profile_id = resource_id
                if not profile_id:
                    raise ValueError("RF profile ID required")

                # Get current profile
                current = await dashboard.wireless.getNetworkWirelessRfProfile(network_id, profile_id)
                previous_value = current.get(setting_path.split(".")[-1])

                # Apply change
                update_field = setting_path.split(".")[-1]
                await dashboard.wireless.updateNetworkWirelessRfProfile(
                    network_id,
                    profile_id,
                    **{update_field: new_value},
                )
                return previous_value, True

            elif change_type == ChangeType.TRAFFIC_SHAPING:
                # Get current rules
                current = await dashboard.networks.getNetworkTrafficShapingDscpToCosMappings(network_id)
                previous_value = current

                # Apply traffic shaping change
                await dashboard.networks.updateNetworkTrafficShapingDscpToCosMappings(
                    network_id,
                    new_value,
                )
                return previous_value, True

            elif change_type == ChangeType.UPLINK_BANDWIDTH:
                # Get current bandwidth settings
                current = await dashboard.appliance.getNetworkApplianceTrafficShapingUplinkBandwidth(network_id)
                previous_value = current

                # Apply bandwidth change
                await dashboard.appliance.updateNetworkApplianceTrafficShapingUplinkBandwidth(
                    network_id,
                    **new_value if isinstance(new_value, dict) else {"bandwidthLimits": new_value},
                )
                return previous_value, True

            else:
                logger.warning(f"Unsupported change type: {change_type}")
                return None, False

        except Exception as e:
            logger.error(f"Meraki API error applying change: {e}")
            raise

    async def revert_change(self, change_id: str) -> ChangeRecord:
        """
        Revert a previously applied change.

        Args:
            change_id: ID of the change to revert

        Returns:
            Updated ChangeRecord with revert status
        """
        # Load change from database
        change = await self._load_change(change_id)
        if not change:
            raise ValueError(f"Change not found: {change_id}")

        if change.status == ChangeStatus.REVERTED:
            raise ValueError(f"Change already reverted: {change_id}")

        # Apply the revert (previous value becomes the new value)
        try:
            dashboard = await self._get_meraki_dashboard(change.organization_id)
            if not dashboard:
                raise ValueError(f"Could not connect to Meraki API")

            try:
                _, success = await self._apply_meraki_change(
                    dashboard,
                    change.network_id,
                    change.change_type,
                    change.setting_path,
                    change.previous_value,  # Revert to previous
                    change.resource_id,
                )

                if not success:
                    raise ValueError("Failed to revert configuration")

            finally:
                if hasattr(dashboard, '_session') and dashboard._session:
                    await dashboard._session.close()

        except Exception as e:
            logger.error(f"Failed to revert change {change_id}: {e}")
            raise

        # Update change record
        change.status = ChangeStatus.REVERTED
        change.reverted_at = datetime.utcnow().isoformat() + "Z"

        await self._update_change_status(change_id, ChangeStatus.REVERTED, change.reverted_at)

        logger.info(f"Reverted network change {change_id}")
        return change

    async def update_metrics_after(self, change_id: str) -> ChangeRecord:
        """
        Capture post-change metrics and update the change record.

        Args:
            change_id: ID of the change to update

        Returns:
            Updated ChangeRecord with after metrics
        """
        change = await self._load_change(change_id)
        if not change:
            raise ValueError(f"Change not found: {change_id}")

        # Capture current metrics
        metrics_after = await self.get_current_metrics(
            change.network_id,
            change.organization_id,
        )

        # Update in database
        await self._update_change_metrics(change_id, metrics_after)

        change.metrics_after = metrics_after
        if change.status == ChangeStatus.PENDING_METRICS:
            change.status = ChangeStatus.APPLIED

        return change

    def calculate_metric_deltas(self, change: ChangeRecord) -> List[MetricDelta]:
        """
        Calculate the performance delta between before and after metrics.

        Args:
            change: Change record with metrics

        Returns:
            List of metric deltas with improvement indicators
        """
        deltas = []

        if not change.metrics_before or not change.metrics_after:
            return deltas

        before = change.metrics_before
        after = change.metrics_after

        metric_pairs = [
            ("latency_ms", before.latency_ms, after.latency_ms),
            ("packet_loss_percent", before.packet_loss_percent, after.packet_loss_percent),
            ("jitter_ms", before.jitter_ms, after.jitter_ms),
            ("throughput_mbps", before.throughput_mbps, after.throughput_mbps),
            ("client_count", before.client_count, after.client_count),
            ("channel_utilization", before.channel_utilization, after.channel_utilization),
            ("signal_strength_dbm", before.signal_strength_dbm, after.signal_strength_dbm),
            ("connection_success_rate", before.connection_success_rate, after.connection_success_rate),
        ]

        for name, before_val, after_val in metric_pairs:
            if before_val is None or after_val is None:
                continue

            delta = after_val - before_val
            delta_percent = (delta / before_val * 100) if before_val != 0 else 0

            # Determine if change is an improvement
            if name in self.LOWER_IS_BETTER:
                improved = delta < 0
            else:
                improved = delta > 0

            deltas.append(MetricDelta(
                metric_name=name,
                before_value=before_val,
                after_value=after_val,
                delta=delta,
                delta_percent=delta_percent,
                improved=improved,
            ))

        return deltas

    def assess_overall_impact(self, deltas: List[MetricDelta]) -> Dict[str, Any]:
        """
        Assess the overall impact of a change based on metric deltas.

        Returns:
            Assessment with overall verdict and confidence
        """
        if not deltas:
            return {
                "verdict": "unknown",
                "confidence": 0,
                "improved_count": 0,
                "degraded_count": 0,
                "unchanged_count": 0,
                "summary": "No metrics available for comparison",
            }

        improved = sum(1 for d in deltas if d.improved and abs(d.delta_percent or 0) > 5)
        degraded = sum(1 for d in deltas if not d.improved and abs(d.delta_percent or 0) > 5)
        unchanged = len(deltas) - improved - degraded

        if improved > degraded:
            verdict = "improved"
        elif degraded > improved:
            verdict = "degraded"
        else:
            verdict = "neutral"

        confidence = min(len(deltas) / 5 * 100, 100)  # More metrics = higher confidence

        return {
            "verdict": verdict,
            "confidence": confidence,
            "improved_count": improved,
            "degraded_count": degraded,
            "unchanged_count": unchanged,
            "summary": f"Performance {'improved' if verdict == 'improved' else 'degraded' if verdict == 'degraded' else 'unchanged'}: {improved} metrics improved, {degraded} degraded",
        }

    async def get_change_history(
        self,
        network_id: str,
        limit: int = 20,
        include_reverted: bool = True,
    ) -> List[ChangeRecord]:
        """
        Get change history for a network.

        Args:
            network_id: Meraki network ID
            limit: Maximum number of records to return
            include_reverted: Whether to include reverted changes

        Returns:
            List of change records
        """
        get_session = await self._get_db_pool()

        async with get_session() as session:
            from sqlalchemy import text

            query = """
                SELECT * FROM network_changes
                WHERE network_id = :network_id
            """
            if not include_reverted:
                query += " AND status != 'reverted'"
            query += " ORDER BY applied_at DESC LIMIT :limit"

            result = await session.execute(
                text(query),
                {"network_id": network_id, "limit": limit}
            )
            rows = result.mappings().all()

            return [ChangeRecord.from_db_row(dict(row)) for row in rows]

    async def _save_change(self, change: ChangeRecord) -> None:
        """Save a change record to the database."""
        get_session = await self._get_db_pool()

        async with get_session() as session:
            from sqlalchemy import text

            await session.execute(
                text("""
                    INSERT INTO network_changes (
                        id, network_id, organization_id, change_type, setting_path,
                        previous_value, new_value, metrics_before, metrics_after,
                        applied_at, reverted_at, user_id, status, description, resource_id
                    ) VALUES (
                        :id, :network_id, :organization_id, :change_type, :setting_path,
                        :previous_value, :new_value, :metrics_before, :metrics_after,
                        :applied_at, :reverted_at, :user_id, :status, :description, :resource_id
                    )
                """),
                {
                    "id": change.id,
                    "network_id": change.network_id,
                    "organization_id": change.organization_id,
                    "change_type": change.change_type.value,
                    "setting_path": change.setting_path,
                    "previous_value": json.dumps(change.previous_value),
                    "new_value": json.dumps(change.new_value),
                    "metrics_before": json.dumps(change.metrics_before.to_dict()) if change.metrics_before else None,
                    "metrics_after": json.dumps(change.metrics_after.to_dict()) if change.metrics_after else None,
                    "applied_at": change.applied_at,
                    "reverted_at": change.reverted_at,
                    "user_id": change.user_id,
                    "status": change.status.value,
                    "description": change.description,
                    "resource_id": change.resource_id,
                }
            )
            await session.commit()

    async def _load_change(self, change_id: str) -> Optional[ChangeRecord]:
        """Load a change record from the database."""
        get_session = await self._get_db_pool()

        async with get_session() as session:
            from sqlalchemy import text

            result = await session.execute(
                text("SELECT * FROM network_changes WHERE id = :id"),
                {"id": change_id}
            )
            row = result.mappings().first()

            if not row:
                return None

            return ChangeRecord.from_db_row(dict(row))

    async def _update_change_status(
        self,
        change_id: str,
        status: ChangeStatus,
        reverted_at: Optional[str] = None,
    ) -> None:
        """Update change status in database."""
        get_session = await self._get_db_pool()

        async with get_session() as session:
            from sqlalchemy import text

            await session.execute(
                text("""
                    UPDATE network_changes
                    SET status = :status, reverted_at = :reverted_at
                    WHERE id = :id
                """),
                {"id": change_id, "status": status.value, "reverted_at": reverted_at}
            )
            await session.commit()

    async def _update_change_metrics(
        self,
        change_id: str,
        metrics_after: PerformanceMetrics,
    ) -> None:
        """Update after metrics in database."""
        get_session = await self._get_db_pool()

        async with get_session() as session:
            from sqlalchemy import text

            await session.execute(
                text("""
                    UPDATE network_changes
                    SET metrics_after = :metrics_after,
                        status = CASE WHEN status = 'pending_metrics' THEN 'applied' ELSE status END
                    WHERE id = :id
                """),
                {"id": change_id, "metrics_after": json.dumps(metrics_after.to_dict())}
            )
            await session.commit()


# Singleton instance
_network_change_service: Optional[NetworkChangeService] = None


def get_network_change_service() -> NetworkChangeService:
    """Get the singleton NetworkChangeService instance."""
    global _network_change_service
    if _network_change_service is None:
        _network_change_service = NetworkChangeService()
    return _network_change_service
