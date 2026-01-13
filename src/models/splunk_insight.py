"""Splunk log insight models for summary cards.

This model stores AI-generated summary cards for Splunk logs.
Each card represents a category/pattern found in the logs.
"""

from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime, Integer, String, Text, Float, JSON
from sqlalchemy.sql import func
import enum

from src.config.database import Base


class InsightSeverity(str, enum.Enum):
    """Insight severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class SplunkLogInsight(Base):
    """Model for AI-generated Splunk log insight cards.

    These cards summarize and categorize Splunk logs into digestible insights.
    They are NOT enriched with cross-platform data - that happens on the Incidents page.
    """

    __tablename__ = "splunk_log_insights"

    id = Column(Integer, primary_key=True, index=True)

    # Organization and query context
    organization = Column(String(255), nullable=False, index=True)
    search_query = Column(Text, nullable=True)
    time_range = Column(String(50), nullable=True)  # e.g., "-24h", "-7d"

    # Card details
    title = Column(String(500), nullable=False)
    severity = Column(String(20), nullable=False, index=True)  # critical, high, medium, low, info
    description = Column(Text, nullable=True)
    log_count = Column(Integer, default=0, nullable=False)  # Number of logs in this category

    # Example logs (stored as JSON array of strings)
    examples = Column(JSON, nullable=True)

    # Source system detected from logs (meraki, thousandeyes, catalyst, splunk, unknown)
    source_system = Column(String(50), nullable=True)

    # AI cost tracking
    ai_cost = Column(Float, nullable=True)
    token_count = Column(Integer, nullable=True)

    # Timing
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<SplunkLogInsight(id={self.id}, title='{self.title}', severity='{self.severity}')>"

    def to_dict(self) -> dict:
        """Convert insight to dictionary.

        Returns:
            Dictionary representation of insight
        """
        return {
            "id": self.id,
            "organization": self.organization,
            "search_query": self.search_query,
            "time_range": self.time_range,
            "title": self.title,
            "severity": self.severity.value if isinstance(self.severity, InsightSeverity) else self.severity,
            "description": self.description,
            "log_count": self.log_count,
            "examples": self.examples or [],
            "source_system": self.source_system,
            "ai_cost": self.ai_cost,
            "token_count": self.token_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
