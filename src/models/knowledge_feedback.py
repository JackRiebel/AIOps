"""Knowledge feedback and query logging models.

Enables continuous improvement through:
- Explicit feedback (thumbs up/down, ratings, comments)
- Implicit feedback (click-through, time spent)
- Query logging for analytics and quality tracking
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, Index, JSON
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field

from src.config.database import Base


# =============================================================================
# Enums
# =============================================================================

class FeedbackType(str, Enum):
    """Types of feedback."""
    POSITIVE = "positive"       # Thumbs up
    NEGATIVE = "negative"       # Thumbs down
    RATING = "rating"           # 1-5 star rating
    REPORT = "report"           # Reported as incorrect
    HELPFUL = "helpful"         # "Was this helpful?" yes
    NOT_HELPFUL = "not_helpful" # "Was this helpful?" no


class ResolutionOutcome(str, Enum):
    """Outcome of using a chunk for problem resolution.

    These outcomes enable fine-grained feedback on whether chunks
    actually helped resolve the user's issue, improving future retrieval.
    """
    RESOLVED = "resolved"              # User confirmed full resolution
    PARTIALLY_HELPFUL = "partial"      # Helped but didn't fully resolve
    UNHELPFUL = "unhelpful"            # Didn't help at all
    INCORRECT = "incorrect"            # Led to wrong direction/advice


class QueryIntent(str, Enum):
    """Classified query intent."""
    FACTUAL = "factual"             # Looking for specific facts
    PROCEDURAL = "procedural"       # How to do something
    TROUBLESHOOTING = "troubleshooting"  # Fix a problem
    COMPARISON = "comparison"       # Compare options
    EXPLORATORY = "exploratory"     # General learning
    CLARIFICATION = "clarification" # Follow-up question


# =============================================================================
# SQLAlchemy Models
# =============================================================================

class DetailedFeedback(Base):
    """Detailed user feedback on knowledge search results and AI answers.

    Tracks both explicit feedback (ratings, thumbs) and implicit
    signals (click-through, time spent) to improve retrieval quality.

    Note: This is a more comprehensive feedback model for analytics.
    The simpler KnowledgeFeedback model in knowledge.py is used for basic API feedback.
    """
    __tablename__ = "detailed_feedback"
    __table_args__ = (
        Index('idx_detailed_feedback_type', 'feedback_type'),
        Index('idx_detailed_feedback_user', 'user_id'),
        Index('idx_detailed_feedback_positive', 'is_positive'),
        Index('idx_detailed_feedback_created', 'created_at'),
        Index('idx_detailed_feedback_query_log', 'query_log_id'),
    )

    id = Column(Integer, primary_key=True)

    # What was the feedback about
    query_log_id = Column(Integer, ForeignKey("knowledge_query_logs.id", ondelete="CASCADE"))
    query = Column(Text, nullable=False)  # The user's query
    chunk_ids = Column(JSON)    # Chunks that were retrieved
    response_text = Column(Text)          # AI response if applicable

    # Feedback details
    feedback_type = Column(String(20), nullable=False, index=True)
    rating = Column(Integer)              # 1-5 for star ratings
    is_positive = Column(Boolean)         # Simplified positive/negative flag
    comment = Column(Text)                # User's written feedback

    # Specific issues (for negative/report feedback)
    issues = Column(JSON, default=list)  # ["inaccurate", "incomplete", "outdated", "irrelevant"]

    # Context
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    session_id = Column(String(100))      # For anonymous feedback correlation

    # Implicit signals
    clicked_chunks = Column(JSON, default=list)  # Chunks user clicked on
    time_on_result_ms = Column(Integer)   # Time spent viewing results
    follow_up_query = Column(Text)        # If user asked follow-up (indicates incomplete answer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    query_log = relationship("KnowledgeQueryLog", back_populates="feedback")


class KnowledgeQueryLog(Base):
    """Log of all knowledge queries for analytics and improvement.

    Stores query details, retrieval results, and performance metrics
    to enable:
    - Query analytics (popular queries, gaps)
    - Performance monitoring (latency, quality)
    - Feedback correlation
    - A/B testing of retrieval strategies
    """
    __tablename__ = "knowledge_query_logs"

    id = Column(Integer, primary_key=True)

    # Original query
    query = Column(Text, nullable=False)
    query_embedding_hash = Column(String(64))  # Hash of embedding for deduplication

    # Query processing
    intent = Column(String(50))           # Classified intent
    expanded_queries = Column(JSON)  # HyDE/multi-query expansions used
    entities_extracted = Column(JSON, default=list)  # Entities found in query

    # Retrieval details
    retrieval_strategy = Column(String(50), default="hybrid")  # hybrid, vector, keyword, graph
    retrieved_chunk_ids = Column(JSON)
    chunk_scores = Column(JSON)          # {chunk_id: score}

    # Graph traversal (if used)
    graph_entities_used = Column(JSON)  # Entity IDs used for graph search
    graph_hops = Column(Integer)          # Number of hops in graph traversal

    # Response
    response_generated = Column(Text)     # AI response if any
    response_model = Column(String(100))  # Model used for generation
    citations = Column(JSON)             # [{chunk_id, quote, position}]

    # Performance metrics
    embedding_latency_ms = Column(Integer)
    retrieval_latency_ms = Column(Integer)
    reranking_latency_ms = Column(Integer)
    generation_latency_ms = Column(Integer)
    total_latency_ms = Column(Integer)

    # Quality indicators (computed post-hoc)
    had_feedback = Column(Boolean, default=False)
    feedback_positive = Column(Boolean)   # True if positive, False if negative, None if no feedback
    result_count = Column(Integer)        # Number of results returned

    # Context
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    session_id = Column(String(100))      # Client session ID
    source = Column(String(50), default="search")  # search, chat, api

    # Filters applied
    filters = Column(JSON)               # {doc_type: [], source: [], date_range: {}}

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    feedback = relationship("DetailedFeedback", back_populates="query_log", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_query_logs_user', 'user_id'),
        Index('idx_query_logs_source', 'source'),
        Index('idx_query_logs_strategy', 'retrieval_strategy'),
        Index('idx_query_logs_intent', 'intent'),
        Index('idx_query_logs_had_feedback', 'had_feedback'),
        Index('idx_query_logs_created', 'created_at'),
        # For finding slow queries
        Index('idx_query_logs_latency', 'total_latency_ms'),
    )


class ChunkFeedbackStats(Base):
    """Aggregated feedback statistics per chunk.

    Updated periodically from KnowledgeFeedback to provide
    quick access to chunk quality metrics for retrieval boosting.

    Resolution outcome tracking enables finer-grained boosting based
    on whether chunks actually helped resolve user issues.
    """
    __tablename__ = "chunk_feedback_stats"

    id = Column(Integer, primary_key=True)
    chunk_id = Column(Integer, ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), unique=True)

    # Feedback counts
    positive_count = Column(Integer, default=0)
    negative_count = Column(Integer, default=0)
    report_count = Column(Integer, default=0)

    # Resolution outcome counts (Sprint 2: Chunk-Level Feedback Loop)
    resolution_count = Column(Integer, default=0)   # Times chunk led to full resolution
    partial_count = Column(Integer, default=0)      # Times partially helpful
    incorrect_count = Column(Integer, default=0)    # Times led to wrong direction

    # Computed scores
    helpfulness_score = Column(Float, default=0.5)  # 0-1, based on feedback ratio
    resolution_rate = Column(Float)                 # resolution_count / total_outcomes
    click_through_rate = Column(Float)              # Clicks / impressions
    avg_time_on_result_ms = Column(Integer)         # Average time spent

    # Retrieval stats
    retrieval_count = Column(Integer, default=0)    # Times retrieved
    top_3_count = Column(Integer, default=0)        # Times in top 3 results

    # Last update
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_chunk_stats_helpfulness', 'helpfulness_score'),
        Index('idx_chunk_stats_retrieval', 'retrieval_count'),
        Index('idx_chunk_stats_resolution_rate', 'resolution_rate'),
    )


# =============================================================================
# Pydantic Schemas
# =============================================================================

class FeedbackCreate(BaseModel):
    """Schema for submitting feedback."""
    query: str
    feedback_type: FeedbackType
    chunk_ids: List[int] = Field(default_factory=list)
    response_text: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    issues: List[str] = Field(default_factory=list)
    clicked_chunks: List[int] = Field(default_factory=list)
    time_on_result_ms: Optional[int] = None
    query_log_id: Optional[int] = None


class FeedbackResponse(BaseModel):
    """Schema for feedback API responses."""
    id: int
    query: str
    feedback_type: str
    rating: Optional[int]
    is_positive: Optional[bool]
    created_at: datetime

    class Config:
        from_attributes = True


class QueryLogCreate(BaseModel):
    """Schema for logging a query."""
    query: str
    intent: Optional[str] = None
    expanded_queries: List[str] = Field(default_factory=list)
    retrieval_strategy: str = "hybrid"
    retrieved_chunk_ids: List[int] = Field(default_factory=list)
    chunk_scores: dict = Field(default_factory=dict)
    response_generated: Optional[str] = None
    response_model: Optional[str] = None
    embedding_latency_ms: Optional[int] = None
    retrieval_latency_ms: Optional[int] = None
    total_latency_ms: Optional[int] = None
    filters: dict = Field(default_factory=dict)
    source: str = "search"


class QueryLogResponse(BaseModel):
    """Schema for query log API responses."""
    id: int
    query: str
    intent: Optional[str]
    retrieval_strategy: str
    result_count: Optional[int]
    total_latency_ms: Optional[int]
    had_feedback: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackStats(BaseModel):
    """Aggregated feedback statistics."""
    total_queries: int
    queries_with_feedback: int
    positive_feedback_rate: float
    avg_rating: Optional[float]
    avg_latency_ms: float
    top_issues: List[dict]  # [{issue: str, count: int}]
    feedback_by_type: dict  # {type: count}


class QueryAnalytics(BaseModel):
    """Query analytics summary."""
    total_queries: int
    unique_queries: int
    avg_latency_ms: float
    p95_latency_ms: float
    queries_per_day: List[dict]  # [{date: str, count: int}]
    top_queries: List[dict]     # [{query: str, count: int}]
    intent_distribution: dict    # {intent: count}
    zero_result_rate: float


class ChunkOutcomeCreate(BaseModel):
    """Schema for recording resolution outcomes for chunks.

    Used by the /feedback/outcome endpoint to track which chunks
    actually helped resolve user issues.
    """
    query_log_id: int = Field(..., description="ID of the query log entry")
    chunk_outcomes: dict = Field(
        ...,
        description="Mapping of chunk_id to outcome: resolved, partial, unhelpful, incorrect"
    )
    notes: Optional[str] = Field(None, description="Optional notes about the resolution")


class ChunkOutcomeResponse(BaseModel):
    """Response from recording chunk outcomes."""
    status: str
    chunks_updated: int
    outcomes_recorded: dict  # {chunk_id: outcome}
