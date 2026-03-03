"""
Canvas artifact data models.

This module defines the database models for Canvas artifacts,
supporting version tracking and artifact type enumeration.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship

from src.config.database import Base


class ArtifactType(enum.Enum):
    """Types of artifacts that can be displayed in Canvas."""
    CODE = "code"
    DATA_TABLE = "data_table"
    CHART = "chart"
    NETWORK_DIAGRAM = "network_diagram"
    MARKDOWN = "markdown"
    JSON = "json"
    TOPOLOGY = "topology"
    DEVICE_CARD = "device_card"
    DEVICE_CARDS = "device_cards"
    ALERT_PANEL = "alert_panel"
    STATUS_CARD = "status_card"
    STAT_CARD = "stat_card"


class CanvasArtifact(Base):
    """Individual artifact within a canvas."""
    __tablename__ = "canvas_artifacts"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("ai_sessions.id", ondelete="CASCADE"), nullable=False)
    conversation_id = Column(Integer, nullable=True)

    # Artifact metadata
    artifact_type = Column(SQLEnum(ArtifactType), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Content
    content = Column(JSON, nullable=False)  # Structured content for rendering
    raw_content = Column(Text, nullable=True)  # Original text/code if applicable

    # Source tracking
    source_tool = Column(String(100), nullable=True)  # Tool that generated this
    source_message_id = Column(String(100), nullable=True)

    # Rendering hints
    render_config = Column(JSON, nullable=True)  # Width, height, theme, layout, etc.

    # Timestamps
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = Column(
        DateTime,
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True
    )

    # Version tracking for edit history
    version = Column(Integer, default=1, nullable=False)
    parent_id = Column(Integer, ForeignKey("canvas_artifacts.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    session = relationship("AISession", back_populates="artifacts")
    children = relationship(
        "CanvasArtifact",
        backref="parent",
        remote_side=[id],
        cascade="all, delete-orphan",
        single_parent=True
    )

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "conversation_id": self.conversation_id,
            "type": self.artifact_type.value if self.artifact_type else None,
            "title": self.title,
            "description": self.description,
            "content": self.content,
            "raw_content": self.raw_content,
            "source_tool": self.source_tool,
            "render_config": self.render_config,
            "version": self.version,
            "parent_id": self.parent_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# Add relationship to AISession model
# This needs to be added to the AISession model file
# artifacts = relationship("CanvasArtifact", back_populates="session", cascade="all, delete-orphan")
