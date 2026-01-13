"""RAG State management for agentic RAG pipeline.

This module defines the shared state that flows between agents in the pipeline.
Each agent can read from and modify this state, enabling stateful multi-agent
communication.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any


class RetrievalStrategy(str, Enum):
    """Retrieval strategy selected by the RetrievalRouterAgent."""
    SEMANTIC = "semantic"           # Pure vector similarity
    HYBRID = "hybrid"               # Vector + keyword (BM25-style)
    HYDE = "hyde"                   # Hypothetical Document Embeddings
    MULTI_QUERY = "multi_query"     # Multiple query variants
    GRAPH = "graph"                 # Graph-based traversal (future)
    FULL_PIPELINE = "full"          # Full agentic pipeline


class AnswerQuality(str, Enum):
    """Quality assessment from ReflectionAgent."""
    EXCELLENT = "excellent"         # No iteration needed, high confidence
    GOOD = "good"                   # Acceptable, minor gaps possible
    NEEDS_ITERATION = "needs_iteration"  # Should re-retrieve or re-synthesize
    INSUFFICIENT_KB = "insufficient_kb"  # Knowledge base lacks coverage


class QueryType(str, Enum):
    """Type of query classified by QueryAnalysisAgent."""
    SIMPLE = "simple"               # Single factual question
    COMPLEX = "complex"             # Multi-faceted question
    MULTI_HOP = "multi_hop"         # Requires reasoning across documents
    PROCEDURAL = "procedural"       # How-to or step-by-step
    COMPARATIVE = "comparative"     # Compare/contrast
    TROUBLESHOOTING = "troubleshooting"  # Debug/diagnose issue


@dataclass
class SubQuestion:
    """A decomposed sub-question from a complex query."""
    id: int
    question: str
    topic: Optional[str] = None     # e.g., "meraki", "catalyst", "ios-xe"
    priority: int = 1               # 1=highest priority
    answered: bool = False
    answer: Optional[str] = None


@dataclass
class GradedDocument:
    """A document chunk with LLM-evaluated relevance."""
    chunk_id: int
    content: str
    document_filename: str
    document_title: Optional[str]
    document_type: str
    document_product: Optional[str]
    original_relevance: float       # Vector similarity score
    is_relevant: bool               # LLM binary judgment
    graded_relevance: float         # LLM relevance score (0-1)
    reasoning: Optional[str] = None # LLM's reasoning
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WebSearchResult:
    """Result from web search fallback (CRAG)."""
    title: str
    url: str
    snippet: str
    content: Optional[str] = None
    relevance: float = 0.0


@dataclass
class Citation:
    """Citation for a source used in the answer."""
    index: int                      # [1], [2], etc.
    document: str
    chunk_id: int
    relevance: float
    excerpt: Optional[str] = None


@dataclass
class RAGState:
    """Shared state that flows through the agentic RAG pipeline.

    Each agent reads from and writes to this state, enabling
    stateful communication between agents.
    """

    # =========================================================================
    # Input
    # =========================================================================
    original_query: str
    context: Dict[str, Any] = field(default_factory=dict)
    user_id: Optional[int] = None
    session_id: Optional[str] = None

    # =========================================================================
    # Query Analysis (populated by QueryAnalysisAgent)
    # =========================================================================
    query_type: QueryType = QueryType.SIMPLE
    sub_questions: List[SubQuestion] = field(default_factory=list)
    cisco_topics: List[str] = field(default_factory=list)
    intent: Optional[str] = None
    complexity_score: float = 0.0   # 0-1 complexity rating

    # =========================================================================
    # Retrieval (populated by RetrievalRouterAgent + retrieval step)
    # =========================================================================
    strategy: RetrievalStrategy = RetrievalStrategy.HYBRID
    retrieved_chunks: List[Dict[str, Any]] = field(default_factory=list)
    total_chunks_retrieved: int = 0
    retrieval_filters: Dict[str, Any] = field(default_factory=dict)

    # =========================================================================
    # Document Grading (populated by DocumentGraderAgent)
    # =========================================================================
    graded_documents: List[GradedDocument] = field(default_factory=list)
    num_relevant_docs: int = 0
    avg_graded_relevance: float = 0.0

    # =========================================================================
    # Corrective RAG (populated by CorrectiveRAGAgent)
    # =========================================================================
    web_search_triggered: bool = False
    web_search_reason: Optional[str] = None
    web_results: List[WebSearchResult] = field(default_factory=list)
    kb_coverage_sufficient: bool = True

    # =========================================================================
    # Synthesis (populated by SynthesisAgent)
    # =========================================================================
    answer: str = ""
    citations: List[Citation] = field(default_factory=list)
    confidence: float = 0.0
    sources_used: int = 0

    # =========================================================================
    # Reflection (populated by ReflectionAgent)
    # =========================================================================
    quality: AnswerQuality = AnswerQuality.GOOD
    quality_score: float = 0.0
    reflection_notes: List[str] = field(default_factory=list)
    missing_aspects: List[str] = field(default_factory=list)
    should_iterate: bool = False
    iteration_focus: Optional[str] = None  # What to focus on in next iteration

    # =========================================================================
    # Pipeline Control
    # =========================================================================
    iteration_count: int = 0
    max_iterations: int = 2
    is_complete: bool = False
    error: Optional[str] = None

    # =========================================================================
    # Metrics & Timing
    # =========================================================================
    start_time: datetime = field(default_factory=datetime.utcnow)
    agent_timings: Dict[str, float] = field(default_factory=dict)
    total_llm_calls: int = 0
    total_tokens: int = 0

    def mark_complete(self) -> None:
        """Mark the pipeline as complete."""
        self.is_complete = True

    def check_should_iterate(self) -> bool:
        """Check if another iteration is needed and allowed."""
        if self.iteration_count >= self.max_iterations:
            return False
        return self.should_iterate and self.quality == AnswerQuality.NEEDS_ITERATION

    def increment_iteration(self) -> None:
        """Increment iteration counter and reset iteration flags."""
        self.iteration_count += 1
        self.should_iterate = False

    def add_timing(self, agent_name: str, duration_ms: float) -> None:
        """Record timing for an agent."""
        self.agent_timings[agent_name] = duration_ms

    def get_relevant_documents(self) -> List[GradedDocument]:
        """Get only the relevant documents after grading."""
        return [doc for doc in self.graded_documents if doc.is_relevant]

    def get_total_latency_ms(self) -> float:
        """Calculate total pipeline latency in milliseconds."""
        elapsed = datetime.utcnow() - self.start_time
        return elapsed.total_seconds() * 1000

    def to_context_string(self) -> str:
        """Generate context string for LLM from relevant documents."""
        relevant = self.get_relevant_documents()
        if not relevant:
            return ""

        context_parts = []
        for i, doc in enumerate(relevant, 1):
            context_parts.append(
                f"[{i}] Source: {doc.document_filename}\n"
                f"    Type: {doc.document_type}\n"
                f"    Product: {doc.document_product or 'General'}\n"
                f"    Content: {doc.content[:500]}..."
                if len(doc.content) > 500 else
                f"[{i}] Source: {doc.document_filename}\n"
                f"    Type: {doc.document_type}\n"
                f"    Product: {doc.document_product or 'General'}\n"
                f"    Content: {doc.content}"
            )

        return "\n\n".join(context_parts)


@dataclass
class RAGMetrics:
    """Metrics for a completed RAG pipeline run."""
    query_id: str
    original_query: str
    total_latency_ms: float
    agent_timings: Dict[str, float]
    llm_calls: int
    tokens_used: int
    iterations: int
    final_quality: str
    confidence: float
    web_search_used: bool
    num_retrieved: int
    num_relevant: int
    num_citations: int
    strategy_used: str
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @classmethod
    def from_state(cls, state: RAGState, query_id: str) -> "RAGMetrics":
        """Create metrics from completed RAG state."""
        return cls(
            query_id=query_id,
            original_query=state.original_query,
            total_latency_ms=state.get_total_latency_ms(),
            agent_timings=state.agent_timings.copy(),
            llm_calls=state.total_llm_calls,
            tokens_used=state.total_tokens,
            iterations=state.iteration_count,
            final_quality=state.quality.value,
            confidence=state.confidence,
            web_search_used=state.web_search_triggered,
            num_retrieved=state.total_chunks_retrieved,
            num_relevant=state.num_relevant_docs,
            num_citations=len(state.citations),
            strategy_used=state.strategy.value,
        )
