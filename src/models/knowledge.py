"""Knowledge base models for RAG system.

These models store documents, chunks with embeddings, and query logs
for the Cisco Knowledge Agent RAG system.
"""

from datetime import datetime
from typing import Optional, List, Any
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, JSON, Float
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field

from src.config.database import Base

# Try to import pgvector, fall back gracefully if not installed
try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    # Create a placeholder for environments without pgvector
    Vector = lambda dim: Text  # noqa: E731
    PGVECTOR_AVAILABLE = False


# =============================================================================
# SQLAlchemy Models
# =============================================================================

class KnowledgeDocument(Base):
    """A source document in the knowledge base."""
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True)
    filename = Column(String(500), nullable=False)
    filepath = Column(String(1000))
    doc_type = Column(String(50), nullable=False)  # api_spec, guide, datasheet, cli_reference, cvd
    product = Column(String(100))  # meraki, catalyst, ios-xe, ise, general
    version = Column(String(50))
    title = Column(String(500))
    description = Column(Text)
    source_url = Column(String(1000))
    content_hash = Column(String(64), unique=True)
    total_chunks = Column(Integer, default=0)
    doc_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    """A chunk of text from a document with its embedding.

    Supports hierarchical parent-child relationships for contextual retrieval:
    - hierarchy_level 0: Section-level chunks (h1/h2 headers)
    - hierarchy_level 1: Subsection-level chunks (h3/h4 headers)
    - hierarchy_level 2: Paragraph-level chunks (content under headers)

    When a paragraph chunk is retrieved, its parent section can be fetched
    for additional context.
    """
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("knowledge_documents.id", ondelete="CASCADE"))
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    content_tokens = Column(Integer)
    quality_score = Column(Float, nullable=True)  # 0.0-1.0 quality score from validation
    chunk_metadata = Column(JSON, default=dict)
    embedding = Column(Vector(384) if PGVECTOR_AVAILABLE else Text)  # e5-small-v2 local model dimension
    created_at = Column(DateTime, default=datetime.utcnow)

    # Parent-child hierarchy for contextual retrieval (Sprint 3)
    parent_chunk_id = Column(Integer, ForeignKey("knowledge_chunks.id", ondelete="SET NULL"), nullable=True)
    hierarchy_level = Column(Integer, default=2)  # 0=section, 1=subsection, 2=paragraph

    # Relationships
    document = relationship("KnowledgeDocument", back_populates="chunks")
    parent = relationship("KnowledgeChunk", remote_side=[id], backref="children", foreign_keys=[parent_chunk_id])

    __table_args__ = (
        Index("idx_knowledge_chunks_document_id", "document_id"),
        Index("idx_knowledge_chunks_parent", "parent_chunk_id"),
        Index("idx_knowledge_chunks_hierarchy", "document_id", "hierarchy_level"),
    )


class AgentSession(Base):
    """Tracks multi-turn consultations between Implementation Agent and Knowledge Agent.

    This enables stateful agent-to-agent communication where the Knowledge Agent
    can maintain context across multiple queries within the same task.
    """
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)  # UUID for external reference
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    # Session metadata
    status = Column(String(20), default="active")  # active, completed, expired
    implementation_goal = Column(Text)  # What the Implementation Agent is trying to achieve
    environment_snapshot = Column(JSON)  # Initial environment state

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime)  # Auto-expire old sessions

    # Session statistics
    consultation_count = Column(Integer, default=0)  # Number of queries in this session
    total_tokens = Column(Integer, default=0)

    # Accumulated context (updated with each consultation)
    accumulated_discoveries = Column(JSON, default=list)  # List of all tool results
    conversation_summary = Column(Text)  # AI-generated summary of the session

    __table_args__ = (
        Index("idx_agent_sessions_user_id", "user_id"),
        Index("idx_agent_sessions_status", "status"),
        Index("idx_agent_sessions_created_at", "created_at"),
    )


class KnowledgeQuery(Base):
    """Log of knowledge queries for analytics."""
    __tablename__ = "knowledge_queries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    agent_session_id = Column(String(64), index=True)  # Link to agent session for multi-turn
    query_text = Column(Text, nullable=False)
    context = Column(JSON)
    retrieved_chunk_ids = Column(JSON)
    response = Column(Text)
    response_tokens = Column(Integer)
    latency_ms = Column(Integer)
    feedback_score = Column(Integer)  # 1-5 rating
    model_used = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Query classification metadata (for adaptive retrieval analytics)
    query_classification = Column(JSON, default=dict)
    # Structure:
    # {
    #   "intent": "configuration|troubleshooting|explanation|comparison|validation|optimization",
    #   "complexity": "simple|moderate|complex",
    #   "complexity_score": 0.0-1.0,
    #   "detected_products": ["meraki", "catalyst"],
    #   "detected_doc_types": ["guide", "api_spec"],
    #   "confidence": 0.0-1.0
    # }

    # Retrieval metrics for observability (Phase 4)
    retrieval_metrics = Column(JSON, default=dict)
    # Structure:
    # {
    #   "semantic_candidates": 20,
    #   "keyword_candidates": 15,
    #   "merged_candidates": 25,
    #   "final_count": 10,
    #   "diversity_score": 0.72,
    #   "avg_relevance": 0.85,
    #   "avg_quality_score": 0.78,
    #   "doc_type_distribution": {"guide": 5, "api_spec": 3},
    #   "product_distribution": {"meraki": 6, "catalyst": 4}
    # }

    __table_args__ = (
        Index("idx_knowledge_queries_user_id", "user_id"),
        Index("idx_knowledge_queries_created_at", "created_at"),
        Index("idx_knowledge_queries_agent_session", "agent_session_id"),
    )


class KnowledgeFeedback(Base):
    """User feedback on knowledge search results and AI answers."""
    __tablename__ = "knowledge_feedback"
    __table_args__ = (
        Index("idx_knowledge_feedback_user_id", "user_id"),
        Index("idx_knowledge_feedback_type", "feedback_type"),
        Index("idx_knowledge_feedback_target", "feedback_target"),
        Index("idx_knowledge_feedback_chunk_id", "chunk_id"),
        Index("idx_knowledge_feedback_created_at", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    query_text = Column(Text, nullable=False)
    feedback_type = Column(String(20), nullable=False)
    feedback_target = Column(String(20), nullable=False)
    chunk_id = Column(Integer, ForeignKey("knowledge_chunks.id", ondelete="SET NULL"), nullable=True)
    rating = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    feedback_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


# =============================================================================
# Pydantic Schemas for API
# =============================================================================

class DocumentCreate(BaseModel):
    """Schema for creating a new document."""
    filename: str
    filepath: Optional[str] = None
    doc_type: str
    product: Optional[str] = None
    version: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    source_url: Optional[str] = None
    doc_metadata: dict = Field(default_factory=dict)


class DocumentResponse(BaseModel):
    """Schema for document API responses."""
    id: int
    filename: str
    doc_type: str
    product: Optional[str]
    version: Optional[str]
    title: Optional[str]
    description: Optional[str]
    total_chunks: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChunkResponse(BaseModel):
    """Schema for chunk API responses (without embedding)."""
    id: int
    document_id: int
    chunk_index: int
    content: str
    content_tokens: Optional[int]
    chunk_metadata: dict

    class Config:
        from_attributes = True


class RetrievedChunk(BaseModel):
    """A chunk retrieved from similarity search."""
    id: int
    document_id: int  # Foreign key to knowledge_documents
    content: str
    chunk_metadata: dict
    document_filename: str
    document_title: Optional[str]
    document_type: str
    document_product: Optional[str]
    relevance: float  # Similarity score
    chunk_index: Optional[int] = None  # Position within document
    quality_score: Optional[float] = None  # Content quality score (0.0-1.0)
    final_score: Optional[float] = None  # Combined score after re-ranking
    hierarchy_level: Optional[int] = None  # 0=section, 1=subsection, 2=paragraph
    parent_chunk_id: Optional[int] = None  # Parent chunk ID for context


class ParentChunk(BaseModel):
    """A parent chunk providing section context."""
    id: int
    content: str
    chunk_index: int
    hierarchy_level: int
    chunk_metadata: dict = Field(default_factory=dict)


class ChunkWithContext(BaseModel):
    """A retrieved chunk with its hierarchical context.

    This model provides the full context for a chunk by including:
    - The retrieved chunk itself
    - Its parent section chunk (if available)
    - An expanded content string combining parent context with chunk content
    """
    chunk: RetrievedChunk
    parent: Optional[ParentChunk] = None
    context_text: str  # Combined text with parent context prepended

    @property
    def has_parent_context(self) -> bool:
        """Check if parent context is available."""
        return self.parent is not None


class AgentContext(BaseModel):
    """Full context passed from Implementation Agent to Knowledge Agent.

    This enables true agent-to-agent communication where the Knowledge Agent
    understands the full conversation context, not just an isolated query.
    """
    # User's original request
    user_query: Optional[str] = None

    # Conversation history (last N messages for context)
    conversation_summary: Optional[str] = None

    # Environment state discovered by Implementation Agent
    environment: dict = Field(default_factory=dict)

    # Results from tools already executed (so Knowledge Agent knows what's been discovered)
    prior_tool_results: List[dict] = Field(default_factory=list)

    # What the Implementation Agent is trying to accomplish
    implementation_goal: Optional[str] = None

    # Specific questions the Implementation Agent needs answered
    specific_questions: List[str] = Field(default_factory=list)

    # Session ID for multi-turn agent consultations
    agent_session_id: Optional[str] = None


class KnowledgeQueryRequest(BaseModel):
    """Request schema for knowledge queries."""
    query: str
    context: Optional[dict] = None  # Legacy: simple environment context
    agent_context: Optional[AgentContext] = None  # Enhanced: full agent consultation context
    output_format: str = "text"  # "text" or "structured"
    filters: Optional[dict] = None  # Optional filters (product, doc_type, etc.)
    top_k: int = 10


class ImplementationStep(BaseModel):
    """A single step in an implementation plan."""
    order: int
    action: str
    api: str  # meraki, catalyst, cli, ise
    endpoint: Optional[str] = None
    command: Optional[str] = None  # For CLI actions
    params: dict = Field(default_factory=dict)
    description: str
    rollback: Optional[str] = None  # How to undo this step


class SourceCitation(BaseModel):
    """Citation for a source document."""
    document: str
    chunk_id: int
    relevance: float


class KnowledgeResponse(BaseModel):
    """Response from the knowledge agent."""
    recommendation: str
    confidence: float = Field(ge=0.0, le=1.0)
    steps: List[ImplementationStep] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    sources: List[SourceCitation] = Field(default_factory=list)
    requires_confirmation: bool = False  # For destructive operations


class KnowledgeTextResponse(BaseModel):
    """Simple text response from knowledge agent."""
    response: str
    sources: List[SourceCitation] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


# =============================================================================
# Feedback Schemas
# =============================================================================

class FeedbackCreate(BaseModel):
    """Schema for submitting feedback."""
    query: str
    feedback_type: str = Field(..., pattern="^(positive|negative|rating)$")
    feedback_target: str = Field(..., pattern="^(ai_answer|search_result)$")
    chunk_id: Optional[int] = None  # Required for search_result feedback
    rating: Optional[int] = Field(None, ge=1, le=5)  # For detailed ratings
    comment: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class FeedbackResponse(BaseModel):
    """Schema for feedback API response."""
    id: int
    feedback_type: str
    feedback_target: str
    created_at: datetime

    class Config:
        from_attributes = True
