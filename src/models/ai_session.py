"""AI Session tracking models for comprehensive activity logging."""

from sqlalchemy import Column, Integer, BigInteger, Numeric, String, DateTime, Text, Boolean, ForeignKey, JSON, func
from sqlalchemy.orm import relationship

from src.config.database import Base


class AISession(Base):
    """Represents a tracked AI session with full activity logging."""
    __tablename__ = "ai_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Session metadata
    name = Column(String(255), nullable=True)  # User-editable session name/tag
    status = Column(String(20), default="active", index=True)  # active, completed, abandoned

    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Token and cost tracking (running totals)
    total_input_tokens = Column(BigInteger, default=0, nullable=False)
    total_output_tokens = Column(BigInteger, default=0, nullable=False)
    total_tokens = Column(BigInteger, default=0, nullable=False)
    total_cost_usd = Column(Numeric(12, 8), default=0, nullable=False)

    # Summarization cost (tracked separately)
    summary_input_tokens = Column(BigInteger, default=0, nullable=False)
    summary_output_tokens = Column(BigInteger, default=0, nullable=False)
    summary_cost_usd = Column(Numeric(12, 8), default=0, nullable=False)

    # Event counts
    total_events = Column(Integer, default=0, nullable=False)
    ai_query_count = Column(Integer, default=0, nullable=False)
    api_call_count = Column(Integer, default=0, nullable=False)
    navigation_count = Column(Integer, default=0, nullable=False)
    click_count = Column(Integer, default=0, nullable=False)
    edit_action_count = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)

    # AI-generated summary (JSON structure)
    ai_summary = Column(JSON, nullable=True)

    # ==========================================================================
    # ROI TRACKING FIELDS (Phase 3: ROI Calculation Engine)
    # ==========================================================================

    # Calculated ROI metrics
    time_saved_minutes = Column(Numeric(10, 2), nullable=True)  # Sum of manual baseline - AI time
    roi_percentage = Column(Numeric(10, 2), nullable=True)  # ((manual_cost - ai_cost) / ai_cost) * 100
    manual_cost_estimate_usd = Column(Numeric(12, 4), nullable=True)  # What it would have cost manually

    # Session categorization for ROI segmentation
    session_type = Column(String(50), nullable=True)  # incident_response, investigation, configuration, optimization, monitoring
    complexity_score = Column(Integer, nullable=True)  # 1-5 based on actions taken

    # Performance metrics
    avg_response_time_ms = Column(Integer, nullable=True)  # Average AI response time
    slowest_query_ms = Column(Integer, nullable=True)  # Longest AI query time
    total_duration_ms = Column(BigInteger, nullable=True)  # Total session duration in ms

    # Cost breakdown by category (for detailed analysis)
    cost_breakdown = Column(JSON, nullable=True)  # {"ai_queries": 0.89, "enrichment": 0.18, "summary": 0.16}

    # Incident correlation (Phase 4: MTTR Integration)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    incident_resolved = Column(Boolean, default=False, nullable=False)
    resolution_time_minutes = Column(Numeric(10, 2), nullable=True)

    # Efficiency scoring
    efficiency_score = Column(Integer, nullable=True)  # 0-100 composite score

    # Relationships
    events = relationship("AISessionEvent", back_populates="session", cascade="all, delete-orphan")


class AISessionEvent(Base):
    """Individual event within an AI session - captures everything."""
    __tablename__ = "ai_session_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("ai_sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Event metadata
    event_type = Column(String(50), nullable=False, index=True)
    # Types: ai_query, ai_response, api_call, navigation, click, edit_action,
    #        correlation_alert, error, warning, loading, modal_open, tab_switch, filter_change

    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Event details (flexible JSON for different event types)
    event_data = Column(JSON, nullable=False, default={})

    # For AI operations - token tracking
    input_tokens = Column(BigInteger, nullable=True)
    output_tokens = Column(BigInteger, nullable=True)
    cost_usd = Column(Numeric(12, 8), nullable=True)
    model = Column(String(100), nullable=True)

    # For API calls
    api_endpoint = Column(String(512), nullable=True)
    api_method = Column(String(10), nullable=True)
    api_status = Column(Integer, nullable=True)
    api_duration_ms = Column(Integer, nullable=True)

    # For navigation/UI events
    page_path = Column(String(512), nullable=True)
    element_id = Column(String(255), nullable=True)
    element_type = Column(String(50), nullable=True)

    # ==========================================================================
    # ROI TRACKING FIELDS (Phase 3: ROI Calculation Engine)
    # ==========================================================================

    # Duration tracking for all event types
    duration_ms = Column(Integer, nullable=True)  # How long this operation took

    # Action classification for ROI calculation
    action_type = Column(String(50), nullable=True)  # Maps to ROI_BASELINES keys
    baseline_minutes = Column(Numeric(10, 2), nullable=True)  # Manual time estimate for this action
    time_saved_minutes = Column(Numeric(10, 2), nullable=True)  # Calculated time saved

    # Relationship
    session = relationship("AISession", back_populates="events")
