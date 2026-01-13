"""Knowledge RAG integration service for AI-enhanced responses.

Provides:
- Intent classification (knowledge query vs action request)
- Citation generation from retrieved chunks
- Knowledge-aware response augmentation
- Context assembly for LLM prompts
- Agentic RAG pipeline for enhanced retrieval (optional)

This service bridges the knowledge base with the AI chat system,
enabling knowledge-grounded responses with proper citations.
"""

import hashlib
import logging
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.knowledge_service import KnowledgeService, get_knowledge_service
from src.services.feedback_service import FeedbackService
from src.models.knowledge import RetrievedChunk

# Agentic RAG imports (optional, graceful fallback if not available)
try:
    from src.services.agentic_rag import AgenticRAGOrchestrator
    from src.services.agentic_rag.config import get_agentic_rag_config
    from src.services.agentic_rag.orchestrator import get_agentic_rag_orchestrator
    AGENTIC_RAG_AVAILABLE = True
except ImportError:
    AGENTIC_RAG_AVAILABLE = False

logger = logging.getLogger(__name__)


# =============================================================================
# Intent Classification
# =============================================================================

class QueryIntent(str, Enum):
    """Types of user query intents."""
    KNOWLEDGE = "knowledge"       # Looking for information
    ACTION = "action"             # Wants to perform an operation
    HYBRID = "hybrid"             # Needs info + action
    CLARIFICATION = "clarification"  # Follow-up question
    GREETING = "greeting"         # Social/greeting


@dataclass
class IntentClassification:
    """Result of intent classification."""
    intent: QueryIntent
    confidence: float
    requires_knowledge: bool
    requires_tools: bool
    knowledge_topics: List[str] = field(default_factory=list)
    suggested_actions: List[str] = field(default_factory=list)


class IntentClassifier:
    """Classifies user query intent to route appropriately."""

    # Keywords that strongly indicate knowledge queries
    # NOTE: troubleshoot/debug/diagnose are ACTION patterns since they require live data
    KNOWLEDGE_PATTERNS = [
        r"\bwhat\s+is\b",
        r"\bhow\s+(?:do|does|to|can)\b",
        r"\bexplain\b",
        r"\bdescribe\b",
        r"\btell\s+me\s+about\b",
        r"\bwhat\s+are\b",
        r"\bdefine\b",
        r"\bwhy\s+(?:is|does|do)\b",
        r"\bdifferences?\s+between\b",
        r"\bcompare\b",
        r"\bbest\s+practice",
        r"\brecommend",
        r"\bwhen\s+should\b",
        r"\bwhat\s+happens\s+if\b",
        r"\bsymptoms?\s+of\b",
        r"\berror\s+mean",
    ]

    # Keywords that strongly indicate action requests
    ACTION_PATTERNS = [
        r"\blist\b",
        r"\bget\b",
        r"\bshow\b",
        r"\bfetch\b",
        r"\bretrieve\b",
        r"\bfind\b",
        r"\bcreate\b",
        r"\bupdate\b",
        r"\bdelete\b",
        r"\bconfigure\b",
        r"\bset\b",
        r"\benable\b",
        r"\bdisable\b",
        r"\brestart\b",
        r"\breboot\b",
        r"\bcheck\s+(?:the\s+)?status\b",
        r"\bcheck\b",  # Generic "check" - often followed by platform/entity
        r"\bping\b",
        r"\btest\b",
        r"\brun\b",
        r"\bexecute\b",
        r"\banalyze\b",
        r"\bsummarize\b",
        r"\binvestigate\b",
        r"\breview\b",
        r"\bexamine\b",
        r"\binspect\b",
        r"\bquery\b",
        r"\bsearch\b",
        r"\blook\s+(?:at|up|into)\b",
        r"\bdig\s+into\b",
        r"\bdrill\s+(?:down|into)\b",
        # Troubleshooting actions - require live data, not KB
        r"\btroubleshoot",
        r"\bdebug",
        r"\bdiagnose",
    ]

    # Network/device entities that suggest action context
    ENTITY_PATTERNS = [
        r"\bdevice[s]?\b",
        r"\bnetwork[s]?\b",
        r"\bvlan[s]?\b",
        r"\bssid[s]?\b",
        r"\bfirewall\b",
        r"\bclient[s]?\b",
        r"\bswitch(?:es)?\b",
        r"\brouter[s]?\b",
        r"\baccess\s+point[s]?\b",
        r"\borganization[s]?\b",
    ]

    # Platforms with live APIs - when these are mentioned with action verbs,
    # we should prefer tools over KB. These platforms have real-time data APIs.
    API_PLATFORMS = ["meraki", "splunk", "thousandeyes"]

    # Cisco-specific knowledge topics (simple strings for substring matching)
    CISCO_TOPICS = [
        # Protocols
        "bgp", "ospf", "eigrp", "stp", "vtp", "hsrp", "vrrp",
        "qos", "acl", "nat", "dhcp", "dns",
        # Platforms
        "catalyst", "meraki", "nexus", "ise", "dna center",
        "sd-wan", "aci", "nso", "thousandeyes",
        # Security
        "802.1x", "radius", "tacacs", "aaa",
        # Technologies
        "vxlan", "mpls", "segment routing",
        # Catalyst switch base models (variants like L, CX are matched via regex)
        "c9200", "c9300", "c9400", "c9500", "c9800",
        "9200", "9300", "9400", "9500", "9800",
        "catalyst 9200", "catalyst 9300", "catalyst 9400", "catalyst 9500",
        # Meraki models
        "ms120", "ms220", "ms350", "ms390", "ms410", "ms425",
        "mr36", "mr46", "mr56", "mr57", "mx64", "mx68", "mx84", "mx100",
        # General product terms
        "upoe", "poe+", "stackwise", "uplink",
    ]

    # Regex patterns for product families (matches variants like C9200L, C9200CX, etc.)
    PRODUCT_PATTERNS = [
        # Catalyst 9000 series with variants
        (r"\bc?9200[a-z]*\b", "C9200"),
        (r"\bc?9300[a-z]*\b", "C9300"),
        (r"\bc?9400[a-z]*\b", "C9400"),
        (r"\bc?9500[a-z]*\b", "C9500"),
        (r"\bc?9800[a-z]*\b", "C9800"),
        (r"\bcatalyst\s*9200[a-z]*\b", "Catalyst 9200"),
        (r"\bcatalyst\s*9300[a-z]*\b", "Catalyst 9300"),
        (r"\bcatalyst\s*9400[a-z]*\b", "Catalyst 9400"),
        (r"\bcatalyst\s*9500[a-z]*\b", "Catalyst 9500"),
        # Meraki with variants
        (r"\bms\d{2,3}[a-z]*\b", "MS Switch"),
        (r"\bmr\d{2}[a-z]*\b", "MR Access Point"),
        (r"\bmx\d{2,3}[a-z]*\b", "MX Security Appliance"),
        # Nexus
        (r"\bnexus\s*\d+[a-z]*\b", "Nexus"),
        (r"\bn9k[a-z\-]*\b", "Nexus 9000"),
    ]

    def classify(self, query: str) -> IntentClassification:
        """Classify the intent of a user query.

        Args:
            query: User's question or request.

        Returns:
            IntentClassification with intent type and metadata.
        """
        query_lower = query.lower().strip()

        # Check for greeting
        if self._is_greeting(query_lower):
            return IntentClassification(
                intent=QueryIntent.GREETING,
                confidence=0.95,
                requires_knowledge=False,
                requires_tools=False,
            )

        # Score knowledge vs action
        knowledge_score = self._score_knowledge(query_lower)
        action_score = self._score_action(query_lower)

        # Extract topics
        topics = self._extract_topics(query_lower)

        # Determine intent - prefer ACTION for platform queries
        # Platform API queries shouldn't trigger RAG
        if knowledge_score > 0.6 and action_score < 0.3:
            intent = QueryIntent.KNOWLEDGE
            confidence = knowledge_score
        elif action_score > 0 and knowledge_score == 0:
            # Pure action query with no knowledge indicators - this is API/tool work
            intent = QueryIntent.ACTION
            confidence = max(action_score, 0.6)
        elif action_score > 0.6 and knowledge_score < 0.3:
            intent = QueryIntent.ACTION
            confidence = action_score
        elif knowledge_score > 0.3 and action_score > 0.3:
            intent = QueryIntent.HYBRID
            confidence = (knowledge_score + action_score) / 2
        elif action_score > 0 and knowledge_score < 0.2:
            # Mostly action, minimal knowledge - treat as action
            intent = QueryIntent.ACTION
            confidence = max(action_score, 0.5)
        else:
            # Default to hybrid only if there's genuine ambiguity
            intent = QueryIntent.HYBRID
            confidence = 0.5

        return IntentClassification(
            intent=intent,
            confidence=confidence,
            requires_knowledge=intent in [QueryIntent.KNOWLEDGE, QueryIntent.HYBRID],
            requires_tools=intent in [QueryIntent.ACTION, QueryIntent.HYBRID],
            knowledge_topics=topics,
        )

    def _is_greeting(self, query: str) -> bool:
        """Check if query is a greeting."""
        greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"]
        return any(query.startswith(g) or query == g for g in greetings)

    def _score_knowledge(self, query: str) -> float:
        """Score how likely this is a knowledge query."""
        matches = sum(1 for p in self.KNOWLEDGE_PATTERNS if re.search(p, query))

        # Count topic matches, but EXCLUDE API platforms since those have live APIs
        # API platforms (meraki, splunk, thousandeyes) should boost action score, not knowledge
        topic_matches = sum(
            1 for t in self.CISCO_TOPICS
            if t in query and t not in self.API_PLATFORMS
        )

        # Also count product pattern matches
        product_matches = sum(1 for p, _ in self.PRODUCT_PATTERNS if re.search(p, query, re.IGNORECASE))

        # Normalize: patterns have higher weight
        score = (matches * 0.15) + (topic_matches * 0.1) + (product_matches * 0.15)
        return min(score, 1.0)

    def _score_action(self, query: str) -> float:
        """Score how likely this is an action request."""
        action_matches = sum(1 for p in self.ACTION_PATTERNS if re.search(p, query))
        entity_matches = sum(1 for p in self.ENTITY_PATTERNS if re.search(p, query))

        # Check for API platform mentions - these strongly indicate tool usage
        api_platform_matches = sum(1 for p in self.API_PLATFORMS if p in query)

        # Actions with entities are strong indicators
        # API platforms with action verbs are VERY strong indicators (0.3 each)
        score = (action_matches * 0.2) + (entity_matches * 0.1) + (api_platform_matches * 0.3)
        return min(score, 1.0)

    def _extract_topics(self, query: str) -> List[str]:
        """Extract Cisco-related topics from query.

        Note: API platforms (meraki, splunk, thousandeyes) are excluded from
        knowledge topics since they have live APIs and should trigger tools.
        """
        # Exclude API platforms - those should trigger tool usage, not KB lookup
        topics = [
            t for t in self.CISCO_TOPICS
            if t in query and t not in self.API_PLATFORMS
        ]
        # Also extract specific product mentions via regex
        for pattern, family in self.PRODUCT_PATTERNS:
            if re.search(pattern, query, re.IGNORECASE):
                if family not in topics:
                    topics.append(family)
        return topics

    def extract_product_mentions(self, query: str) -> List[Dict[str, str]]:
        """Extract specific product model mentions from query.

        Returns list of dicts with 'match' (exact text) and 'family' (normalized family name).
        """
        products = []
        query_lower = query.lower()
        for pattern, family in self.PRODUCT_PATTERNS:
            match = re.search(pattern, query_lower)
            if match:
                products.append({
                    "match": match.group(0).upper(),  # Normalize to uppercase
                    "family": family,
                })
        return products

    def is_single_product_query(self, query: str) -> Tuple[bool, Optional[str]]:
        """Check if query is asking about a single specific product.

        Returns (is_single_product, product_name).
        """
        products = self.extract_product_mentions(query)
        if len(products) == 1:
            # Check for comparison keywords that would indicate multi-product
            comparison_words = ['difference', 'compare', 'comparison', 'vs', 'versus', 'between']
            q_lower = query.lower()
            if not any(word in q_lower for word in comparison_words):
                return True, products[0]["match"]
        return False, None


# =============================================================================
# Citation Generation
# =============================================================================

@dataclass
class Citation:
    """A citation referencing a source chunk."""
    index: int                    # Citation number [1], [2], etc.
    chunk_id: int                 # Source chunk ID
    document_id: int              # Source document ID
    document_title: str           # Document title for display
    section: Optional[str]        # Section/header if available
    quote: Optional[str]          # Relevant quote from source
    relevance: float              # Relevance score


@dataclass
class CitedResponse:
    """AI response with citations."""
    content: str                  # Response text with [1], [2] markers
    citations: List[Citation]     # Citation details
    sources_markdown: str         # Formatted sources section
    context_used: str             # Context provided to LLM
    chunks_used: List[int]        # Chunk IDs used


@dataclass
class RAGResult:
    """Result from RAG retrieval with confidence scoring.

    Used for hybrid response generation that blends tool results
    with knowledge base context based on confidence levels.
    """
    chunks: List[RetrievedChunk]     # Retrieved knowledge chunks
    citations: List[Citation]        # Generated citations
    context: str                     # Assembled context string
    confidence: float                # Overall retrieval confidence (0.0-1.0)
    intent: QueryIntent              # Detected query intent
    should_blend: bool               # Whether to blend with tool results
    knowledge_topics: List[str]      # Detected Cisco topics
    retrieval_scores: List[float]    # Individual chunk scores

    @property
    def has_good_coverage(self) -> bool:
        """Check if retrieval has good topic coverage."""
        return self.confidence >= 0.7 and len(self.chunks) >= 2

    @property
    def is_authoritative(self) -> bool:
        """Check if retrieval is authoritative enough to be primary source."""
        return self.confidence >= 0.8 and len(self.chunks) >= 3

    def get_top_chunks(self, n: int = 3) -> List[RetrievedChunk]:
        """Get top N chunks by score."""
        return self.chunks[:n]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/serialization."""
        return {
            "confidence": self.confidence,
            "intent": self.intent.value,
            "should_blend": self.should_blend,
            "num_chunks": len(self.chunks),
            "knowledge_topics": self.knowledge_topics,
            "avg_score": sum(self.retrieval_scores) / len(self.retrieval_scores) if self.retrieval_scores else 0,
        }


class CitationGenerator:
    """Generates citations from retrieved chunks."""

    def __init__(self, max_citations: int = 5):
        """Initialize citation generator.

        Args:
            max_citations: Maximum citations to include.
        """
        self.max_citations = max_citations

    def generate_context(
        self,
        chunks: List[RetrievedChunk],
        max_tokens: int = 4000,
    ) -> Tuple[str, List[Citation]]:
        """Generate context string and citations from chunks.

        Args:
            chunks: Retrieved chunks to use as context.
            max_tokens: Approximate max tokens for context.

        Returns:
            Tuple of (context_string, citations_list).
        """
        if not chunks:
            return "", []

        citations = []
        context_parts = []
        current_tokens = 0
        chars_per_token = 4  # Rough estimate

        for i, chunk in enumerate(chunks[:self.max_citations]):
            # Estimate tokens
            chunk_tokens = len(chunk.content) // chars_per_token
            if current_tokens + chunk_tokens > max_tokens:
                break

            citation_num = i + 1
            citations.append(Citation(
                index=citation_num,
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_title=chunk.document_title or chunk.chunk_metadata.get("title", f"Document {chunk.document_id}"),
                section=chunk.chunk_metadata.get("section"),
                quote=self._extract_key_quote(chunk.content),
                relevance=chunk.relevance,
            ))

            # Add to context with citation marker
            context_parts.append(f"[Source {citation_num}]:\n{chunk.content}\n")
            current_tokens += chunk_tokens

        context = "\n".join(context_parts)
        return context, citations

    def format_sources_section(self, citations: List[Citation]) -> str:
        """Format citations as a sources section.

        Args:
            citations: List of citations to format.

        Returns:
            Markdown-formatted sources section.
        """
        if not citations:
            return ""

        lines = ["\n**Sources:**"]
        for cit in citations:
            section_info = f" - {cit.section}" if cit.section else ""
            lines.append(f"[{cit.index}] {cit.document_title}{section_info}")

        return "\n".join(lines)

    def _extract_key_quote(self, content: str, max_length: int = 100) -> str:
        """Extract a key quote from content.

        Args:
            content: Full chunk content.
            max_length: Maximum quote length.

        Returns:
            Key quote or truncated content.
        """
        # Try to find a complete sentence
        sentences = re.split(r'(?<=[.!?])\s+', content)
        if sentences and len(sentences[0]) <= max_length:
            return sentences[0]

        # Fallback to truncation
        if len(content) <= max_length:
            return content
        return content[:max_length].rsplit(' ', 1)[0] + "..."


# =============================================================================
# Knowledge RAG Service
# =============================================================================

class KnowledgeRAGService:
    """Service for knowledge-augmented generation.

    Integrates knowledge retrieval with AI response generation,
    providing:
    - Intent classification
    - Context retrieval and assembly
    - Citation generation
    - Response augmentation
    """

    def __init__(
        self,
        knowledge_service: Optional[KnowledgeService] = None,
        feedback_service: Optional[FeedbackService] = None,
    ):
        """Initialize RAG service.

        Args:
            knowledge_service: Knowledge service for retrieval.
            feedback_service: Feedback service for logging.
        """
        self._knowledge_service = knowledge_service
        self._feedback_service = feedback_service
        self.intent_classifier = IntentClassifier()
        self.citation_generator = CitationGenerator()

    @property
    def knowledge_service(self) -> KnowledgeService:
        """Lazy-load knowledge service."""
        if self._knowledge_service is None:
            self._knowledge_service = get_knowledge_service()
        return self._knowledge_service

    async def should_use_knowledge(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, IntentClassification]:
        """Determine if knowledge retrieval should be used.

        Args:
            query: User query.
            context: Optional context (org, tools available, etc.).

        Returns:
            Tuple of (should_retrieve, classification).
        """
        classification = self.intent_classifier.classify(query)

        # Always retrieve for knowledge and hybrid intents
        should_retrieve = classification.requires_knowledge

        # Also retrieve if query contains Cisco topics even for action intents
        if not should_retrieve and classification.knowledge_topics:
            should_retrieve = True
            classification.requires_knowledge = True

        logger.info(
            f"[RAG] Intent: {classification.intent.value} "
            f"(confidence={classification.confidence:.2f}, "
            f"knowledge={should_retrieve}, "
            f"topics={classification.knowledge_topics})"
        )

        return should_retrieve, classification

    async def retrieve_with_confidence(
        self,
        session: AsyncSession,
        query: str,
        min_confidence: float = 0.5,
        top_k: int = 5,
        max_context_tokens: int = 3000,
    ) -> RAGResult:
        """Retrieve knowledge with confidence scoring for hybrid response generation.

        This method is designed for blending knowledge with tool results:
        - High confidence (>0.8): Knowledge can be primary source
        - Medium confidence (0.5-0.8): Blend with tool results
        - Low confidence (<0.5): Tools should be primary, knowledge supplementary

        Args:
            session: Database session.
            query: User query.
            min_confidence: Minimum confidence threshold.
            top_k: Number of chunks to retrieve.
            max_context_tokens: Maximum context tokens.

        Returns:
            RAGResult with confidence scores and blending recommendations.
        """
        # Classify intent first
        classification = self.intent_classifier.classify(query)

        # Retrieve chunks
        context, citations, chunks = await self._get_knowledge_context_standard(
            session=session,
            query=query,
            top_k=top_k,
            max_context_tokens=max_context_tokens,
        )

        # Calculate confidence from chunk scores
        retrieval_scores = [chunk.score for chunk in chunks if hasattr(chunk, 'score')]
        if not retrieval_scores:
            # Fall back to relevance from citations if available
            retrieval_scores = [c.relevance for c in citations if hasattr(c, 'relevance')]

        if retrieval_scores:
            # Weighted average: higher scores contribute more
            avg_score = sum(retrieval_scores) / len(retrieval_scores)
            # Scale to 0-1 range (scores typically 0.5-1.0)
            confidence = min(max((avg_score - 0.3) / 0.7, 0.0), 1.0)

            # Boost confidence if we have multiple high-scoring chunks
            high_score_count = sum(1 for s in retrieval_scores if s > 0.7)
            if high_score_count >= 2:
                confidence = min(confidence + 0.1, 1.0)

            # Boost confidence for knowledge-focused intents
            if classification.intent == QueryIntent.KNOWLEDGE:
                confidence = min(confidence + 0.1, 1.0)
        else:
            confidence = 0.3 if chunks else 0.0

        # Determine if we should blend with tools
        should_blend = (
            classification.intent == QueryIntent.HYBRID or
            (classification.intent == QueryIntent.ACTION and confidence > min_confidence) or
            (confidence >= 0.5 and confidence < 0.9)  # Medium confidence = blend
        )

        result = RAGResult(
            chunks=chunks,
            citations=citations,
            context=context,
            confidence=confidence,
            intent=classification.intent,
            should_blend=should_blend,
            knowledge_topics=classification.knowledge_topics,
            retrieval_scores=retrieval_scores,
        )

        logger.info(
            f"[RAG] Retrieval confidence: {confidence:.2f}, "
            f"intent: {classification.intent.value}, "
            f"should_blend: {should_blend}, "
            f"chunks: {len(chunks)}"
        )

        return result

    async def get_knowledge_context(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 5,
        max_context_tokens: int = 3000,
        user_id: Optional[int] = None,
    ) -> Tuple[str, List[Citation], List[RetrievedChunk], Optional[Dict[str, Any]]]:
        """Retrieve knowledge and generate context for LLM.

        This method supports two retrieval paths:
        1. Agentic RAG: Multi-agent pipeline with query analysis, grading, reflection
        2. Standard RAG: Direct enhanced search with HyDE and multi-query

        Args:
            session: Database session.
            query: User query.
            top_k: Number of chunks to retrieve.
            max_context_tokens: Maximum context tokens.
            user_id: Optional user ID for personalization.

        Returns:
            Tuple of (context_string, citations, chunks, agentic_rag_metrics).
            agentic_rag_metrics is None if standard RAG was used.
        """
        # Check if agentic RAG should be used
        if await self._should_use_agentic_rag():
            return await self._get_knowledge_context_agentic(
                session=session,
                query=query,
                user_id=user_id,
            )

        # Standard RAG path - return None for metrics
        context, citations, chunks = await self._get_knowledge_context_standard(
            session=session,
            query=query,
            top_k=top_k,
            max_context_tokens=max_context_tokens,
        )
        return context, citations, chunks, None

    async def _should_use_agentic_rag(self) -> bool:
        """Check if agentic RAG should be used.

        Returns:
            True if agentic RAG is enabled and available.
        """
        if not AGENTIC_RAG_AVAILABLE:
            return False

        try:
            config = get_agentic_rag_config()
            return config.enabled
        except Exception:
            return False

    async def _get_knowledge_context_agentic(
        self,
        session: AsyncSession,
        query: str,
        user_id: Optional[int] = None,
    ) -> Tuple[str, List[Citation], List[RetrievedChunk], Optional[Dict[str, Any]]]:
        """Get knowledge context using agentic RAG pipeline.

        Args:
            session: Database session.
            query: User query.
            user_id: Optional user ID.

        Returns:
            Tuple of (context_string, citations, chunks, agentic_rag_metrics).
        """
        logger.info(f"Using agentic RAG for query: {query[:100]}...")

        try:
            orchestrator = get_agentic_rag_orchestrator()
            if orchestrator is None:
                logger.warning("Agentic RAG orchestrator not initialized, falling back to standard")
                context, citations, chunks = await self._get_knowledge_context_standard(
                    session=session,
                    query=query,
                    top_k=5,
                    max_context_tokens=3000,
                )
                return context, citations, chunks, None

            # Run agentic pipeline
            answer, citations_list, chunks_list, agentic_metrics = await orchestrator.process(
                session=session,
                query=query,
                user_id=user_id,
            )

            # Convert citations to expected format
            citations = [
                Citation(
                    index=c["index"],
                    chunk_id=c["chunk_id"],
                    document_id=0,  # Not available from agentic RAG
                    document_title=c["document"],
                    section=None,
                    quote=c.get("excerpt"),
                    relevance=c["relevance"],
                )
                for c in citations_list
            ]

            # Convert chunks to RetrievedChunk format
            chunks = [
                RetrievedChunk(
                    id=c["id"],
                    document_id=c.get("document_id", 0),
                    content=c["content"],
                    chunk_metadata=c.get("chunk_metadata", {}),
                    chunk_index=c.get("chunk_index"),
                    document_filename=c["document_filename"],
                    document_title=c.get("document_title"),
                    document_type=c["document_type"],
                    document_product=c.get("document_product"),
                    relevance=c["relevance"],
                )
                for c in chunks_list
            ]

            # The agentic RAG returns the full answer as context
            # We use the answer directly instead of raw context
            return answer, citations, chunks, agentic_metrics

        except Exception as e:
            logger.error(f"Agentic RAG failed: {e}, falling back to standard")
            context, citations, chunks = await self._get_knowledge_context_standard(
                session=session,
                query=query,
                top_k=5,
                max_context_tokens=3000,
            )
            return context, citations, chunks, None

    async def _get_knowledge_context_standard(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 5,
        max_context_tokens: int = 3000,
    ) -> Tuple[str, List[Citation], List[RetrievedChunk]]:
        """Get knowledge context using standard enhanced search.

        Args:
            session: Database session.
            query: User query.
            top_k: Number of chunks to retrieve.
            max_context_tokens: Maximum context tokens.

        Returns:
            Tuple of (context_string, citations, chunks).
        """
        # Retrieve relevant chunks using enhanced search
        chunks, _ = await self.knowledge_service.enhanced_search(
            session=session,
            query=query,
            top_k=top_k,
            use_hyde=True,
            use_multi_query=True,
            use_mmr=True,
            use_feedback_boost=True,
        )

        if not chunks:
            return "", [], []

        # Generate context and citations
        context, citations = self.citation_generator.generate_context(
            chunks=chunks,
            max_tokens=max_context_tokens,
        )

        return context, citations, chunks

    def build_rag_system_prompt(
        self,
        base_prompt: str,
        knowledge_context: str,
        citations: List[Citation],
        query: str = "",
    ) -> str:
        """Build system prompt with knowledge context.

        Args:
            base_prompt: Original system prompt.
            knowledge_context: Retrieved knowledge context.
            citations: Citation metadata.
            query: Original user query (for comparison detection).

        Returns:
            Augmented system prompt.
        """
        if not knowledge_context:
            return base_prompt

        rag_instructions = """
## Knowledge Base Context

You have access to the following knowledge from the Cisco documentation and knowledge base.
You MUST use this information to provide accurate, grounded responses.

CRITICAL ACCURACY RULES:
1. ONLY use specifications and facts that are explicitly stated in the knowledge base below.
2. DO NOT make up or guess specifications - if a value is not in the sources, say "not specified in available documentation".
3. When the knowledge base contains specific numbers (bandwidth, DRAM, flash, PoE budget, etc.), use those EXACT values.
4. If the knowledge base says a feature is NOT supported, do not claim it is supported.
5. Cross-reference information across sources - use the most specific/authoritative source.

TABLE DATA INTERPRETATION:
- Datasheets often contain comparison tables with multiple models in columns
- Read CAREFULLY which row/column applies to the specific product being asked about
- "Yes/No" values in tables apply to specific features listed in the row header
- Do NOT confuse different stacking technologies (StackWise-80, StackWise-160, StackPower)
- A product may support some stacking features but not others - be specific about which

CITATION RULES:
1. Cite your sources using [1], [2], etc. at the end of each claim.
2. Be specific about which source supports each claim.
3. If sources conflict, note the discrepancy.

RETRIEVED KNOWLEDGE:
{context}

---

"""
        prompt = base_prompt + rag_instructions.format(context=knowledge_context)

        # Add comparison instructions if this is a comparison query
        if self._is_comparison_query(query):
            comparison_instructions = """
## COMPARISON OUTPUT FORMAT

Since this is a comparison query, you MUST include a structured JSON block at the END of your response.
This will be used to generate a comparison table card.

After your explanation, add this exact format:

```json:comparison
{
  "products": [
    {"name": "PRODUCT1", "specs": {"Feature1": "value1", "Feature2": "value2", ...}},
    {"name": "PRODUCT2", "specs": {"Feature1": "value1", "Feature2": "value2", ...}}
  ],
  "features": ["Feature1", "Feature2", ...]
}
```

IMPORTANT for the comparison JSON:
- Include ALL key differentiating features (stacking bandwidth, DRAM, flash, VNs, uplinks, fans, power supply, MACsec, SD-Access support, etc.)
- Use consistent feature names across all products
- Use "—" or "N/A" for features a product doesn't have
- Order features by importance (stacking, resources, hardware, software features)
- Be accurate - only include specs you found in the knowledge base

"""
            prompt += comparison_instructions

        # Check for single-product query (details about a specific product)
        elif self._is_product_detail_query(query):
            is_single, product_name = self.intent_classifier.is_single_product_query(query)
            if is_single and product_name:
                product_instructions = f"""
## PRODUCT DETAIL OUTPUT FORMAT

Since this is a query about a specific product ({product_name}), you MUST include a structured JSON block at the END of your response.
This will be used to generate a product detail card.

After your explanation, add this exact format:

```json:product
{{
  "product": {{
    "name": "{product_name}",
    "family": "Product family from knowledge base",
    "description": "Brief description from knowledge base"
  }},
  "specs": {{
    "Stacking Bandwidth": "EXACT value from datasheet or 'N/A'",
    "Switching Bandwidth": "EXACT value from datasheet",
    "DRAM": "EXACT value from datasheet",
    "Flash": "EXACT value from datasheet",
    "Virtual Networks": "EXACT value from datasheet",
    "PoE Budget": "EXACT value from datasheet",
    "MACsec": true/false based on datasheet,
    "SD-Access Support": "EXACT description from datasheet"
  }},
  "models": [
    {{"name": "Model number from datasheet", "description": "ports, uplinks, PoE from datasheet"}}
  ],
  "features": ["Features listed in the datasheet"],
  "useCases": ["Use cases from datasheet or inferred from specs"]
}}
```

CRITICAL ACCURACY REQUIREMENTS for the product JSON:
- Use ONLY values that appear in the retrieved knowledge base documents
- Copy specifications EXACTLY as stated (e.g., "4 GB" not "4GB", "160 Gbps" not "160G")
- If a spec is not in the knowledge base, use "Not specified" - DO NOT guess
- For boolean features (MACsec, etc.), only set true if explicitly stated as supported
- List ALL model numbers mentioned in the datasheet
- Do not invent features or capabilities not documented

"""
                prompt += product_instructions

        return prompt

    def _is_product_detail_query(self, query: str) -> bool:
        """Check if the query is asking for details about a specific product."""
        if not query:
            return False
        q = query.lower()
        # Keywords that indicate a product detail query
        detail_keywords = ['detail', 'spec', 'feature', 'about', 'tell me', 'info', 'information', 'overview']
        return any(keyword in q for keyword in detail_keywords)

    def _is_comparison_query(self, query: str) -> bool:
        """Check if the query is asking for a comparison."""
        if not query:
            return False
        q = query.lower()
        comparison_words = ['difference', 'compare', 'comparison', 'vs', 'versus', 'between']
        return any(word in q for word in comparison_words)

    def format_response_with_citations(
        self,
        response: str,
        citations: List[Citation],
    ) -> CitedResponse:
        """Format AI response with proper citations.

        Args:
            response: Raw AI response.
            citations: Citations to append.

        Returns:
            CitedResponse with formatted content and sources.
        """
        sources_section = self.citation_generator.format_sources_section(citations)

        # Check if response already has citations
        has_citations = bool(re.search(r'\[\d+\]', response))

        if has_citations and citations:
            # Append sources section
            content = response + "\n" + sources_section
        else:
            content = response

        return CitedResponse(
            content=content,
            citations=citations,
            sources_markdown=sources_section,
            context_used="",  # Filled in by caller
            chunks_used=[c.chunk_id for c in citations],
        )

    async def generate_knowledge_response(
        self,
        session: AsyncSession,
        query: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Tuple[CitedResponse, Optional[Dict[str, Any]]]]:
        """Generate a knowledge-only response (no tools).

        For pure knowledge queries, this generates a response using
        only the knowledge base, without tool calls.

        Args:
            session: Database session.
            query: User query.
            conversation_history: Previous conversation.

        Returns:
            Tuple of (CitedResponse, agentic_rag_metrics) if successful,
            None if no relevant knowledge.
        """
        # Get knowledge context
        context, citations, chunks, agentic_metrics = await self.get_knowledge_context(
            session=session,
            query=query,
            top_k=5,
        )

        if not context:
            return None

        # For now, return context + citations without LLM call
        # The unified chat service will use this context
        cited_response = CitedResponse(
            content="",  # To be filled by LLM
            citations=citations,
            sources_markdown=self.citation_generator.format_sources_section(citations),
            context_used=context,
            chunks_used=[c.id for c in chunks],
        )
        return cited_response, agentic_metrics

    def get_context_hash(self, chunks: List[RetrievedChunk]) -> str:
        """Generate a hash of chunk IDs for caching.

        Args:
            chunks: Retrieved chunks.

        Returns:
            Hash string for cache key.
        """
        chunk_ids = sorted([str(c.id) for c in chunks])
        return hashlib.md5(":".join(chunk_ids).encode()).hexdigest()[:16]


# Singleton instances
_intent_classifier: Optional[IntentClassifier] = None
_rag_service: Optional[KnowledgeRAGService] = None


def get_intent_classifier() -> IntentClassifier:
    """Get or create intent classifier singleton."""
    global _intent_classifier
    if _intent_classifier is None:
        _intent_classifier = IntentClassifier()
    return _intent_classifier


def get_knowledge_rag_service() -> KnowledgeRAGService:
    """Get or create RAG service singleton."""
    global _rag_service
    if _rag_service is None:
        _rag_service = KnowledgeRAGService()
    return _rag_service
