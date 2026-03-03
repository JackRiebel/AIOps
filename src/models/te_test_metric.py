"""ThousandEyes test metrics model for 7-day local storage."""

from sqlalchemy import Column, Integer, BigInteger, String, Float, DateTime, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from src.config.database import Base


class TETestMetric(Base):
    __tablename__ = "te_test_metrics"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, nullable=False, index=True)
    test_name = Column(String(500))
    test_type = Column(String(100))
    round_id = Column(BigInteger, nullable=False)
    agent_id = Column(Integer)
    agent_name = Column(String(255))
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    avg_latency_ms = Column(Float)
    loss_pct = Column(Float)
    jitter_ms = Column(Float)
    response_time_ms = Column(Float)
    connect_time_ms = Column(Float)
    dns_time_ms = Column(Float)
    wait_time_ms = Column(Float)
    error_type = Column(String(100))
    path_hops = Column(JSONB)

    __table_args__ = (
        UniqueConstraint("test_id", "round_id", "agent_id", name="uq_te_metrics_test_round_agent"),
        Index("idx_te_metrics_test_ts", "test_id", timestamp.desc()),
    )
