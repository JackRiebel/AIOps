"""AI Query Trace model for end-to-end AI journey tracing."""

from sqlalchemy import (
    Column, Integer, BigInteger, Numeric, String, DateTime, Text,
    Boolean, ForeignKey, JSON, func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from src.config.database import Base


class AIQueryTrace(Base):
    """Represents a single span in an AI query trace tree.

    Span types:
    - query: Root span for the entire AI query lifecycle
    - llm_call: Individual LLM API call (one per iteration)
    - tool_execution: Single tool call with input/output/timing
    - synthesis: Final synthesis/response generation step
    """
    __tablename__ = "ai_query_traces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trace_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    parent_span_id = Column(Integer, ForeignKey("ai_query_traces.id", ondelete="CASCADE"), nullable=True)
    session_id = Column(Integer, ForeignKey("ai_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Span identification
    span_type = Column(String(30), nullable=False, index=True)
    span_name = Column(String(255), nullable=True)
    iteration = Column(Integer, default=0)

    # Timing
    start_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # LLM call fields
    model = Column(String(100), nullable=True)
    provider = Column(String(30), nullable=True)
    input_tokens = Column(BigInteger, nullable=True)
    output_tokens = Column(BigInteger, nullable=True)
    cost_usd = Column(Numeric(12, 8), nullable=True)
    thinking_tokens = Column(BigInteger, nullable=True)

    # Tool execution fields
    tool_name = Column(String(255), nullable=True)
    tool_input = Column(JSON, nullable=True)
    tool_output_summary = Column(Text, nullable=True)
    tool_success = Column(Boolean, nullable=True)
    tool_platform = Column(String(30), nullable=True)
    tool_error = Column(Text, nullable=True)

    # Network timing
    dns_ms = Column(Integer, nullable=True)
    tcp_connect_ms = Column(Integer, nullable=True)
    tls_ms = Column(Integer, nullable=True)
    ttfb_ms = Column(Integer, nullable=True)

    # Network path info (captured from instrumented HTTP transport)
    server_ip = Column(String(45), nullable=True)       # Resolved IP (v4 or v6)
    server_port = Column(Integer, nullable=True)
    tls_version = Column(String(20), nullable=True)      # e.g., "TLSv1.3"
    http_version = Column(String(10), nullable=True)      # e.g., "HTTP/2"
    network_path = Column(JSON, nullable=True)            # Full path hops from traceroute/TE

    # Status
    status = Column(String(20), default="running")
    error_message = Column(Text, nullable=True)
    trace_metadata = Column("metadata", JSON, default=dict)

    # Self-referential relationship
    parent = relationship("AIQueryTrace", remote_side=[id], backref="children")
