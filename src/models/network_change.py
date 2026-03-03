"""Model for network configuration changes with performance tracking."""

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Text, DateTime, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.config.database import Base


class NetworkChange(Base):
    """Network configuration change record with performance metrics.

    Tracks network configuration changes for rollback capability and
    performance comparison (before/after metrics).
    """
    __tablename__ = "network_changes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Network context
    network_id = Column(String(255), nullable=False, index=True)
    organization_id = Column(String(255), nullable=False, index=True)

    # Change details
    change_type = Column(String(100), nullable=False, index=True)  # ssid_config, rf_profile, traffic_shaping, etc.
    setting_path = Column(String(500), nullable=False)  # Dot-notation path to the setting changed
    previous_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)
    resource_id = Column(String(255), nullable=True)  # e.g., SSID number, port ID

    # Performance metrics
    metrics_before = Column(JSON, nullable=True)  # Metrics captured before change
    metrics_after = Column(JSON, nullable=True)   # Metrics captured after change

    # Status tracking
    status = Column(String(50), default="applied", nullable=False, index=True)  # applied, reverted, failed, pending_metrics
    user_id = Column(String(255), nullable=False, index=True)

    # Timestamps
    applied_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    reverted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Indexes for common queries
    __table_args__ = (
        Index('idx_network_changes_active', 'applied_at', postgresql_where=(status != 'reverted')),
    )

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "network_id": self.network_id,
            "organization_id": self.organization_id,
            "change_type": self.change_type,
            "setting_path": self.setting_path,
            "previous_value": self.previous_value,
            "new_value": self.new_value,
            "description": self.description,
            "resource_id": self.resource_id,
            "metrics_before": self.metrics_before,
            "metrics_after": self.metrics_after,
            "status": self.status,
            "user_id": self.user_id,
            "applied_at": self.applied_at.isoformat() if self.applied_at else None,
            "reverted_at": self.reverted_at.isoformat() if self.reverted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
