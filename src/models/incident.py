"""Incident and event models for unified timeline."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, Float, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from src.config.database import Base


class EventSource(str, enum.Enum):
    """Event source types."""
    MERAKI = "meraki"
    THOUSANDEYES = "thousandeyes"
    SPLUNK = "splunk"
    CATALYST = "catalyst"
    WORKFLOW = "workflow"  # Events from workflow automation


class EventSeverity(str, enum.Enum):
    """Event severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IncidentStatus(str, enum.Enum):
    """Incident status."""
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Event(Base):
    """Model for individual alert/event from any monitoring source."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)

    # Source information
    source = Column(SQLEnum(EventSource), nullable=False, index=True)
    source_event_id = Column(String(255), nullable=True)  # Original ID from source system
    organization = Column(String(255), nullable=False, index=True)

    # Event details
    event_type = Column(String(255), nullable=False)  # alert_type, test_failure, etc.
    severity = Column(SQLEnum(EventSeverity), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)

    # Timing
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Additional data
    affected_resource = Column(String(500), nullable=True)  # Device name, test name, etc.
    raw_data = Column(JSON, nullable=True)  # Store original event data

    # AI cost tracking
    ai_cost = Column(Float, nullable=True)  # Cost in USD for AI analysis related to this event
    token_count = Column(Integer, nullable=True)  # Total tokens (input + output) for AI analysis

    # Incident relationship
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    incident = relationship("Incident", back_populates="events")

    def __repr__(self) -> str:
        return f"<Event(id={self.id}, source='{self.source}', type='{self.event_type}', severity='{self.severity}')>"

    def to_dict(self) -> dict:
        """Convert event to dictionary.

        Returns:
            Dictionary representation of event
        """
        return {
            "id": self.id,
            "source": self.source.value if isinstance(self.source, EventSource) else self.source,
            "source_event_id": self.source_event_id,
            "organization": self.organization,
            "event_type": self.event_type,
            "severity": self.severity.value if isinstance(self.severity, EventSeverity) else self.severity,
            "title": self.title,
            "description": self.description,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "affected_resource": self.affected_resource,
            "raw_data": self.raw_data,
            "ai_cost": self.ai_cost,
            "token_count": self.token_count,
            "incident_id": self.incident_id,
        }


class Incident(Base):
    """Model for grouped events representing a single problem."""

    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    # Incident details
    title = Column(String(500), nullable=False)
    status = Column(SQLEnum(IncidentStatus), default=IncidentStatus.OPEN, nullable=False, index=True)
    severity = Column(SQLEnum(EventSeverity), nullable=False, index=True)

    # Timing
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # AI-generated insights
    root_cause_hypothesis = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)  # 0-100 percentage
    affected_services = Column(JSON, nullable=True)  # List of affected services/resources

    # Metadata
    organizations = Column(JSON, nullable=True)  # List of affected organizations
    event_count = Column(Integer, default=0, nullable=False)

    # Network-specific fields
    network_id = Column(String(255), nullable=True, index=True)
    network_name = Column(String(500), nullable=True)
    device_config = Column(JSON, nullable=True)  # Stores relevant device config for context

    # Enrichment context (from correlation service)
    meraki_context = Column(JSON, nullable=True)  # Matched devices, security events, uplink health
    thousandeyes_context = Column(JSON, nullable=True)  # Alerts, test results, agent health
    performance_metrics = Column(JSON, nullable=True)  # Loss/latency history, client stats
    enrichment_sources = Column(JSON, nullable=True)  # List of sources that contributed data
    splunk_events_raw = Column(JSON, nullable=True)  # Raw Splunk events that triggered this incident

    # AI analysis tracking
    ai_analysis_cost = Column(Float, nullable=True)  # Cost in USD for AI analysis that created this incident
    ai_tokens_used = Column(Integer, nullable=True)  # Token count for incident creation AI call

    # Relationships
    events = relationship("Event", back_populates="incident", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Incident(id={self.id}, title='{self.title}', status='{self.status}', severity='{self.severity}')>"

    def to_dict(self) -> dict:
        """Convert incident to dictionary.

        Returns:
            Dictionary representation of incident
        """
        return {
            "id": self.id,
            "title": self.title,
            "status": self.status.value if isinstance(self.status, IncidentStatus) else self.status,
            "severity": self.severity.value if isinstance(self.severity, EventSeverity) else self.severity,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "root_cause_hypothesis": self.root_cause_hypothesis,
            "confidence_score": self.confidence_score,
            "affected_services": self.affected_services,
            "organizations": self.organizations,
            "event_count": self.event_count,
            "network_id": self.network_id,
            "network_name": self.network_name,
            "device_config": self.device_config,
            "meraki_context": self.meraki_context,
            "thousandeyes_context": self.thousandeyes_context,
            "performance_metrics": self.performance_metrics,
            "enrichment_sources": self.enrichment_sources,
            "splunk_events_raw": self.splunk_events_raw,
            "ai_analysis_cost": self.ai_analysis_cost,
            "ai_tokens_used": self.ai_tokens_used,
        }
