"""Model for pending AI actions requiring user approval."""

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from src.config.database import Base


class ActionStatus(str, enum.Enum):
    """Status of a pending action."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"
    EXPIRED = "expired"


class PendingAction(Base):
    """Pending AI action requiring user approval before execution.

    When the AI wants to make a change (write operation), instead of
    executing directly, it creates a PendingAction. The user must
    approve the action before it executes.
    """
    __tablename__ = "pending_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Session context
    session_id = Column(String(255), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)

    # Action details
    tool_name = Column(String(255), nullable=False)
    tool_input = Column(JSON, nullable=False)  # The parameters for the tool
    description = Column(Text, nullable=True)  # AI-generated description of what this will do

    # Target context
    organization_id = Column(String(255), nullable=True)
    network_id = Column(String(255), nullable=True)
    device_serial = Column(String(255), nullable=True)

    # Risk assessment
    risk_level = Column(String(50), default="medium")  # low, medium, high, critical
    impact_summary = Column(Text, nullable=True)  # AI-generated impact summary
    reversible = Column(Boolean, default=True)  # Whether this action can be undone

    # Status tracking
    status = Column(SQLEnum(ActionStatus), default=ActionStatus.PENDING, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # Auto-expire after this time

    # Approval tracking
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Execution tracking
    executed_at = Column(DateTime, nullable=True)
    execution_result = Column(JSON, nullable=True)  # Result from tool execution
    error_message = Column(Text, nullable=True)

    # For change tracking (before/after metrics)
    metrics_before = Column(JSON, nullable=True)
    metrics_after = Column(JSON, nullable=True)

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "session_id": self.session_id,
            "user_id": self.user_id,
            "tool_name": self.tool_name,
            "tool_input": self.tool_input,
            "description": self.description,
            "organization_id": self.organization_id,
            "network_id": self.network_id,
            "device_serial": self.device_serial,
            "risk_level": self.risk_level,
            "impact_summary": self.impact_summary,
            "reversible": self.reversible,
            "status": self.status.value if self.status else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "rejection_reason": self.rejection_reason,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "execution_result": self.execution_result,
            "error_message": self.error_message,
            "metrics_before": self.metrics_before,
            "metrics_after": self.metrics_after,
        }
