"""Workflow models for AI-enabled automation."""

from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, Float, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from src.config.database import Base


class WorkflowStatus(str, enum.Enum):
    """Workflow status."""
    ACTIVE = "active"
    PAUSED = "paused"
    DRAFT = "draft"


class TriggerType(str, enum.Enum):
    """Workflow trigger types."""
    SPLUNK_QUERY = "splunk_query"
    SCHEDULE = "schedule"
    MANUAL = "manual"


class WorkflowMode(str, enum.Enum):
    """Workflow creation mode."""
    CARDS = "cards"      # Visual drag-and-drop cards
    CLI = "cli"          # CLI-style command scripting
    PYTHON = "python"    # Full Python code


class ExecutionStatus(str, enum.Enum):
    """Workflow execution status."""
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class RiskLevel(str, enum.Enum):
    """Risk level for actions."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Workflow(Base):
    """Model for an automation workflow definition."""

    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)

    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(WorkflowStatus), default=WorkflowStatus.DRAFT, nullable=False, index=True)

    # Trigger configuration
    trigger_type = Column(SQLEnum(TriggerType), nullable=False)
    splunk_query = Column(Text, nullable=True)  # SPL query for splunk_query trigger
    schedule_cron = Column(String(100), nullable=True)  # Cron expression for schedule trigger
    poll_interval_seconds = Column(Integer, default=300, nullable=False)  # Polling interval

    # Conditions - evaluated against Splunk results
    # Format: [{"field": "severity", "operator": "equals", "value": "critical"}, ...]
    conditions = Column(JSON, nullable=True)

    # Actions to execute when triggered
    # Format: [{"tool": "meraki_reboot_device", "params": {}, "requires_approval": true}, ...]
    actions = Column(JSON, nullable=True)

    # AI configuration
    ai_enabled = Column(Boolean, default=True, nullable=False)
    ai_prompt = Column(Text, nullable=True)  # Custom instructions for AI analysis
    ai_confidence_threshold = Column(Float, default=0.7, nullable=False)  # Min confidence to recommend

    # Auto-execute configuration
    auto_execute_enabled = Column(Boolean, default=False, nullable=False)
    auto_execute_min_confidence = Column(Float, default=0.9, nullable=False)  # Higher threshold for auto-execute
    auto_execute_max_risk = Column(SQLEnum(RiskLevel), default=RiskLevel.LOW, nullable=False)

    # Workflow mode and content
    # Note: renamed from 'mode' to 'workflow_mode' to avoid conflict with PostgreSQL's mode() aggregate function
    workflow_mode = Column(SQLEnum(WorkflowMode), default=WorkflowMode.CARDS, nullable=False)

    # Flow builder data (for Cards mode - visual editor)
    # Stores React Flow nodes/edges for advanced workflows
    flow_data = Column(JSON, nullable=True)

    # CLI mode content
    cli_code = Column(Text, nullable=True)

    # Python mode content
    python_code = Column(Text, nullable=True)

    # Ownership & Organization
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    organization = Column(String(255), nullable=True, index=True)

    # Template info (if created from template)
    template_id = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    last_triggered_at = Column(DateTime, nullable=True)

    # Stats
    trigger_count = Column(Integer, default=0, nullable=False)
    success_count = Column(Integer, default=0, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)

    # Tags for categorization
    tags = Column(JSON, nullable=True)

    # Relationships
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Workflow(id={self.id}, name='{self.name}', status='{self.status}')>"

    def to_dict(self) -> dict:
        """Convert workflow to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value if isinstance(self.status, WorkflowStatus) else self.status,
            "trigger_type": self.trigger_type.value if isinstance(self.trigger_type, TriggerType) else self.trigger_type,
            "splunk_query": self.splunk_query,
            "schedule_cron": self.schedule_cron,
            "poll_interval_seconds": self.poll_interval_seconds,
            "conditions": self.conditions,
            "actions": self.actions,
            "ai_enabled": self.ai_enabled,
            "ai_prompt": self.ai_prompt,
            "ai_confidence_threshold": self.ai_confidence_threshold,
            "auto_execute_enabled": self.auto_execute_enabled,
            "auto_execute_min_confidence": self.auto_execute_min_confidence,
            "auto_execute_max_risk": self.auto_execute_max_risk.value if isinstance(self.auto_execute_max_risk, RiskLevel) else self.auto_execute_max_risk,
            "mode": self.workflow_mode.value if isinstance(self.workflow_mode, WorkflowMode) else (self.workflow_mode or "cards"),
            "flow_data": self.flow_data,
            "cli_code": self.cli_code,
            "python_code": self.python_code,
            "created_by": self.created_by,
            "organization": self.organization,
            "template_id": self.template_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_triggered_at": self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            "trigger_count": self.trigger_count,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "tags": self.tags or [],
        }


class WorkflowExecution(Base):
    """Model for a single workflow execution instance."""

    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey('workflows.id'), nullable=False, index=True)

    # Status
    status = Column(SQLEnum(ExecutionStatus), default=ExecutionStatus.PENDING_APPROVAL, nullable=False, index=True)

    # Trigger data - what caused this execution
    trigger_data = Column(JSON, nullable=True)  # Splunk events or other trigger context
    trigger_event_count = Column(Integer, default=0, nullable=False)

    # AI analysis results
    ai_analysis = Column(Text, nullable=True)  # AI's reasoning/explanation
    ai_confidence = Column(Float, nullable=True)  # 0.0 - 1.0
    ai_risk_level = Column(SQLEnum(RiskLevel), nullable=True)

    # Recommended actions from AI
    # Format: [{"action": "tool_name", "params": {...}, "reason": "why"}, ...]
    recommended_actions = Column(JSON, nullable=True)

    # Approval tracking
    requires_approval = Column(Boolean, default=True, nullable=False)
    approved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Execution results
    executed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    result = Column(JSON, nullable=True)  # Results from action execution
    error = Column(Text, nullable=True)  # Error message if failed

    # Actions executed (may differ from recommended if user modified)
    executed_actions = Column(JSON, nullable=True)

    # Cost tracking
    ai_cost_usd = Column(Float, default=0.0, nullable=False)
    ai_input_tokens = Column(Integer, default=0, nullable=False)
    ai_output_tokens = Column(Integer, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")

    def __repr__(self) -> str:
        return f"<WorkflowExecution(id={self.id}, workflow_id={self.workflow_id}, status='{self.status}')>"

    def to_dict(self) -> dict:
        """Convert execution to dictionary."""
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "status": self.status.value if isinstance(self.status, ExecutionStatus) else self.status,
            "trigger_data": self.trigger_data,
            "trigger_event_count": self.trigger_event_count,
            "ai_analysis": self.ai_analysis,
            "ai_confidence": self.ai_confidence,
            "ai_risk_level": self.ai_risk_level.value if isinstance(self.ai_risk_level, RiskLevel) else self.ai_risk_level,
            "recommended_actions": self.recommended_actions,
            "requires_approval": self.requires_approval,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "rejection_reason": self.rejection_reason,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "result": self.result,
            "error": self.error,
            "executed_actions": self.executed_actions,
            "ai_cost_usd": self.ai_cost_usd,
            "ai_input_tokens": self.ai_input_tokens,
            "ai_output_tokens": self.ai_output_tokens,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OutcomeType(str, enum.Enum):
    """Workflow execution outcome types."""
    RESOLVED = "resolved"       # Issue fully resolved
    PARTIAL = "partial"         # Issue partially resolved
    FAILED = "failed"           # Action failed to resolve
    UNKNOWN = "unknown"         # Outcome not yet determined


class WorkflowOutcome(Base):
    """Model for tracking workflow execution outcomes for learning."""

    __tablename__ = "workflow_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey('workflow_executions.id', ondelete='CASCADE'), nullable=False, index=True)

    # Outcome classification
    outcome = Column(String(50), default=OutcomeType.UNKNOWN.value, nullable=False, index=True)

    # Resolution details
    resolution_time_minutes = Column(Integer, nullable=True)

    # User feedback
    notes = Column(Text, nullable=True)

    # Tags for categorization
    tags = Column(JSON, nullable=True)

    # Metrics
    affected_devices_count = Column(Integer, nullable=True)
    affected_users_count = Column(Integer, nullable=True)

    # Learning data
    root_cause = Column(Text, nullable=True)
    prevention_notes = Column(Text, nullable=True)

    # Who recorded the outcome
    recorded_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    execution = relationship("WorkflowExecution", backref="outcomes")

    def __repr__(self) -> str:
        return f"<WorkflowOutcome(id={self.id}, execution_id={self.execution_id}, outcome='{self.outcome}')>"

    def to_dict(self) -> dict:
        """Convert outcome to dictionary."""
        return {
            "id": self.id,
            "execution_id": self.execution_id,
            "outcome": self.outcome,
            "resolution_time_minutes": self.resolution_time_minutes,
            "notes": self.notes,
            "tags": self.tags,
            "affected_devices_count": self.affected_devices_count,
            "affected_users_count": self.affected_users_count,
            "root_cause": self.root_cause,
            "prevention_notes": self.prevention_notes,
            "recorded_by": self.recorded_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
