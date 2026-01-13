"""Query classification and adaptive retrieval parameters.

This module provides:
- Query intent classification (configuration, troubleshooting, explanation, etc.)
- Query complexity assessment
- Adaptive retrieval parameters based on classification
"""

import re
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple

logger = logging.getLogger(__name__)


class QueryIntent(Enum):
    """Classification of query intent."""
    CONFIGURATION = "configuration"      # "How do I set up..."
    TROUBLESHOOTING = "troubleshooting"  # "Why is... not working"
    EXPLANATION = "explanation"          # "What is...?"
    COMPARISON = "comparison"            # "What's the difference..."
    VALIDATION = "validation"            # "Is this correct?"
    OPTIMIZATION = "optimization"        # "How can I improve..."
    GENERAL = "general"                  # Default/unclassified


class QueryComplexity(Enum):
    """Classification of query complexity."""
    SIMPLE = "simple"          # Single concept, direct answer
    MODERATE = "moderate"      # Multiple concepts, standard retrieval
    COMPLEX = "complex"        # Multi-hop reasoning needed


@dataclass
class QueryClassification:
    """Result of query classification."""
    intent: QueryIntent
    complexity: QueryComplexity
    complexity_score: float  # 0.0-1.0
    detected_products: List[str] = field(default_factory=list)
    detected_doc_types: List[str] = field(default_factory=list)
    confidence: float = 0.8

    def to_dict(self) -> dict:
        """Convert to dictionary for logging."""
        return {
            "intent": self.intent.value,
            "complexity": self.complexity.value,
            "complexity_score": self.complexity_score,
            "detected_products": self.detected_products,
            "detected_doc_types": self.detected_doc_types,
            "confidence": self.confidence,
        }


@dataclass
class AdaptiveParameters:
    """Retrieval parameters adjusted based on query classification."""
    top_k: int = 10
    use_hyde: bool = True
    use_multi_query: bool = True
    num_query_variations: int = 3
    use_mmr: bool = True
    mmr_diversity: float = 0.3
    semantic_weight: float = 0.7
    feedback_boost_weight: float = 0.2
    doc_type_filters: List[str] = field(default_factory=list)
    product_filters: List[str] = field(default_factory=list)
    include_parent_context: bool = False

    def to_dict(self) -> dict:
        """Convert to dictionary for logging."""
        return {
            "top_k": self.top_k,
            "use_hyde": self.use_hyde,
            "use_multi_query": self.use_multi_query,
            "num_query_variations": self.num_query_variations,
            "use_mmr": self.use_mmr,
            "mmr_diversity": self.mmr_diversity,
            "semantic_weight": self.semantic_weight,
            "feedback_boost_weight": self.feedback_boost_weight,
            "doc_type_filters": self.doc_type_filters,
            "product_filters": self.product_filters,
            "include_parent_context": self.include_parent_context,
        }


@dataclass
class RetrievalMetrics:
    """Detailed metrics from the retrieval pipeline for observability.

    Tracks candidate counts at each stage and result quality metrics.
    """
    # Pipeline stage counts
    semantic_candidates: int = 0       # Candidates from semantic search
    keyword_candidates: int = 0        # Candidates from keyword/BM25 search
    merged_candidates: int = 0         # After merging semantic + keyword
    after_mmr: int = 0                 # After MMR diversity reranking
    final_count: int = 0               # Final results returned

    # Quality metrics
    diversity_score: float = 0.0       # Unique docs / total results
    avg_relevance: float = 0.0         # Average relevance score
    avg_quality_score: float = 0.0     # Average chunk quality score

    # Distribution metrics
    doc_type_distribution: Dict[str, int] = field(default_factory=dict)
    product_distribution: Dict[str, int] = field(default_factory=dict)

    # Pipeline flags (what was used)
    used_hyde: bool = False
    used_multi_query: bool = False
    used_mmr: bool = False
    used_feedback_boost: bool = False
    used_parent_context: bool = False
    cache_hit: bool = False

    # Timing (optional)
    query_expansion_ms: Optional[int] = None
    semantic_search_ms: Optional[int] = None
    mmr_rerank_ms: Optional[int] = None
    total_ms: Optional[int] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "semantic_candidates": self.semantic_candidates,
            "keyword_candidates": self.keyword_candidates,
            "merged_candidates": self.merged_candidates,
            "after_mmr": self.after_mmr,
            "final_count": self.final_count,
            "diversity_score": self.diversity_score,
            "avg_relevance": self.avg_relevance,
            "avg_quality_score": self.avg_quality_score,
            "doc_type_distribution": self.doc_type_distribution,
            "product_distribution": self.product_distribution,
            "used_hyde": self.used_hyde,
            "used_multi_query": self.used_multi_query,
            "used_mmr": self.used_mmr,
            "used_feedback_boost": self.used_feedback_boost,
            "used_parent_context": self.used_parent_context,
            "cache_hit": self.cache_hit,
            "query_expansion_ms": self.query_expansion_ms,
            "semantic_search_ms": self.semantic_search_ms,
            "mmr_rerank_ms": self.mmr_rerank_ms,
            "total_ms": self.total_ms,
        }


class QueryClassifier:
    """Fast query classification without LLM calls.

    Uses pattern matching to detect query intent and complexity,
    then returns adaptive retrieval parameters.
    """

    # Intent detection patterns (compiled regex)
    INTENT_PATTERNS: Dict[QueryIntent, List[re.Pattern]] = {
        QueryIntent.CONFIGURATION: [
            re.compile(r'\bhow (do|can|to) (i |we )?(set up|configure|enable|create|add|deploy|install)\b', re.I),
            re.compile(r'\bsteps to\b', re.I),
            re.compile(r'\b(setup|configuration|configure)\b', re.I),
            re.compile(r'\bimplement(ing|ation)?\b', re.I),
            re.compile(r'\bcreate a\b', re.I),
        ],
        QueryIntent.TROUBLESHOOTING: [
            re.compile(r'\b(not working|fails?|error|issue|problem|broken|down)\b', re.I),
            re.compile(r'\bwhy (is|does|do|are|can\'t|won\'t)\b', re.I),
            re.compile(r'\b(troubleshoot|debug|diagnose|fix)\b', re.I),
            re.compile(r'\b(can\'t|cannot|unable to)\b', re.I),
            re.compile(r'\b(connectivity|connection) (issue|problem|lost)\b', re.I),
        ],
        QueryIntent.EXPLANATION: [
            re.compile(r'\bwhat (is|are|does)\b', re.I),
            re.compile(r'\bhow does\b', re.I),
            re.compile(r'\bexplain\b', re.I),
            re.compile(r'\bdefine\b', re.I),
            re.compile(r'\bmeaning of\b', re.I),
            re.compile(r'\bwhat\'s the purpose\b', re.I),
            re.compile(r'\bunderstand\b', re.I),
        ],
        QueryIntent.COMPARISON: [
            re.compile(r'\b(difference|compare|vs\.?|versus|better)\b', re.I),
            re.compile(r'\bwhich (is|should|one)\b', re.I),
            re.compile(r'\bpros and cons\b', re.I),
            re.compile(r'\badvantages\b', re.I),
            re.compile(r'\b(or|compared to)\b', re.I),
        ],
        QueryIntent.VALIDATION: [
            re.compile(r'\bis (this|it|that) (correct|right|valid|proper)\b', re.I),
            re.compile(r'\bshould i\b', re.I),
            re.compile(r'\bverify\b', re.I),
            re.compile(r'\bcheck (if|whether)\b', re.I),
            re.compile(r'\bvalid(ate)?\b', re.I),
            re.compile(r'\bcorrect (way|approach)\b', re.I),
        ],
        QueryIntent.OPTIMIZATION: [
            re.compile(r'\b(improve|optimize|best practice|faster|better way)\b', re.I),
            re.compile(r'\bhow (can|do) i (improve|optimize)\b', re.I),
            re.compile(r'\bperformance\b', re.I),
            re.compile(r'\befficiency\b', re.I),
            re.compile(r'\brecommend(ed|ations)?\b', re.I),
        ],
    }

    # Cisco product detection patterns
    PRODUCT_PATTERNS: Dict[str, List[re.Pattern]] = {
        "meraki": [
            re.compile(r'\bmeraki\b', re.I),
            re.compile(r'\b(mx|mr|ms|mg|mt|mv|sm)\d+\b', re.I),
            re.compile(r'\bdashboard\s+api\b', re.I),
        ],
        "catalyst": [
            re.compile(r'\bcatalyst\b', re.I),
            re.compile(r'\b(cat|c)\s*9[0-9]{3}\b', re.I),
            re.compile(r'\bcatalyst center\b', re.I),
            re.compile(r'\bdna center\b', re.I),
        ],
        "ios-xe": [
            re.compile(r'\bios[- ]?xe\b', re.I),
            re.compile(r'\bcli command\b', re.I),
            re.compile(r'\bshow (run|interface|version)\b', re.I),
        ],
        "ise": [
            re.compile(r'\b(ise|identity services engine)\b', re.I),
            re.compile(r'\b(radius|tacacs)\b', re.I),
            re.compile(r'\bposture\b', re.I),
        ],
        "thousandeyes": [
            re.compile(r'\bthousandeyes\b', re.I),
            re.compile(r'\b(te|1000eyes)\b', re.I),
        ],
        "splunk": [
            re.compile(r'\bsplunk\b', re.I),
            re.compile(r'\bsiem\b', re.I),
        ],
    }

    # Complexity indicators
    COMPLEXITY_INDICATORS = {
        "high": [
            re.compile(r'\b(and|then|after|before|while)\b', re.I),
            re.compile(r'\bmultiple\b', re.I),
            re.compile(r'\b(integration|integrate)\b', re.I),
            re.compile(r'\b(migration|migrate)\b', re.I),
            re.compile(r'\b(across|between)\b', re.I),
            re.compile(r'\barchitecture\b', re.I),
        ],
        "low": [
            re.compile(r'^what is\b', re.I),
            re.compile(r'^how to\b', re.I),
            re.compile(r'\bsimple\b', re.I),
            re.compile(r'\bbasic\b', re.I),
        ],
    }

    def __init__(self):
        """Initialize the classifier."""
        pass

    def classify(self, query: str) -> QueryClassification:
        """Classify a query by intent and complexity.

        Args:
            query: The user's query text.

        Returns:
            QueryClassification with intent, complexity, and detected metadata.
        """
        query_lower = query.lower().strip()

        # Detect intent
        intent, intent_confidence = self._detect_intent(query_lower)

        # Detect complexity
        complexity, complexity_score = self._detect_complexity(query_lower)

        # Detect products
        products = self._detect_products(query_lower)

        # Infer doc types based on intent
        doc_types = self._infer_doc_types(intent, query_lower)

        classification = QueryClassification(
            intent=intent,
            complexity=complexity,
            complexity_score=complexity_score,
            detected_products=products,
            detected_doc_types=doc_types,
            confidence=intent_confidence,
        )

        logger.debug(f"Query classified: {classification.to_dict()}")
        return classification

    def _detect_intent(self, query: str) -> Tuple[QueryIntent, float]:
        """Detect the primary intent of the query.

        Returns:
            Tuple of (intent, confidence).
        """
        intent_scores: Dict[QueryIntent, int] = {}

        for intent, patterns in self.INTENT_PATTERNS.items():
            score = 0
            for pattern in patterns:
                if pattern.search(query):
                    score += 1
            if score > 0:
                intent_scores[intent] = score

        if not intent_scores:
            return QueryIntent.GENERAL, 0.5

        # Get intent with highest score
        best_intent = max(intent_scores, key=intent_scores.get)
        max_score = intent_scores[best_intent]

        # Confidence based on number of pattern matches
        confidence = min(0.95, 0.6 + (max_score * 0.1))

        return best_intent, confidence

    def _detect_complexity(self, query: str) -> Tuple[QueryComplexity, float]:
        """Assess query complexity.

        Returns:
            Tuple of (complexity, score from 0.0-1.0).
        """
        # Base score on query length (word count)
        words = query.split()
        word_count = len(words)

        # Start with base score from length
        if word_count <= 5:
            base_score = 0.2
        elif word_count <= 15:
            base_score = 0.4
        elif word_count <= 30:
            base_score = 0.6
        else:
            base_score = 0.8

        # Adjust based on complexity indicators
        for pattern in self.COMPLEXITY_INDICATORS["high"]:
            if pattern.search(query):
                base_score += 0.1

        for pattern in self.COMPLEXITY_INDICATORS["low"]:
            if pattern.search(query):
                base_score -= 0.15

        # Clamp score
        score = max(0.0, min(1.0, base_score))

        # Map to complexity level
        if score < 0.35:
            complexity = QueryComplexity.SIMPLE
        elif score < 0.65:
            complexity = QueryComplexity.MODERATE
        else:
            complexity = QueryComplexity.COMPLEX

        return complexity, score

    def _detect_products(self, query: str) -> List[str]:
        """Detect mentioned Cisco products.

        Returns:
            List of detected product names.
        """
        products = []
        for product, patterns in self.PRODUCT_PATTERNS.items():
            for pattern in patterns:
                if pattern.search(query):
                    products.append(product)
                    break  # Only add each product once
        return products

    def _infer_doc_types(self, intent: QueryIntent, query: str) -> List[str]:
        """Infer relevant document types based on intent.

        Returns:
            List of recommended doc_type filters.
        """
        doc_types = []

        if intent == QueryIntent.CONFIGURATION:
            doc_types = ["guide", "cli_reference", "api_spec", "cvd"]
        elif intent == QueryIntent.TROUBLESHOOTING:
            doc_types = ["troubleshooting", "kb_article", "guide"]
        elif intent == QueryIntent.EXPLANATION:
            doc_types = ["guide", "datasheet", "whitepaper"]
        elif intent == QueryIntent.COMPARISON:
            doc_types = ["datasheet", "guide", "whitepaper"]
        elif intent == QueryIntent.VALIDATION:
            doc_types = ["guide", "best_practices", "cvd"]
        elif intent == QueryIntent.OPTIMIZATION:
            doc_types = ["best_practices", "cvd", "guide"]

        # Check for API-related queries
        if re.search(r'\bapi\b', query, re.I):
            if "api_spec" not in doc_types:
                doc_types.insert(0, "api_spec")

        # Check for CLI-related queries
        if re.search(r'\b(cli|command|show|config)\b', query, re.I):
            if "cli_reference" not in doc_types:
                doc_types.insert(0, "cli_reference")

        return doc_types

    def get_adaptive_parameters(
        self,
        classification: QueryClassification
    ) -> AdaptiveParameters:
        """Get retrieval parameters based on query classification.

        Args:
            classification: The query classification result.

        Returns:
            AdaptiveParameters tuned for the query type.
        """
        # Start with defaults
        params = AdaptiveParameters()

        # Apply product filters if detected
        if classification.detected_products:
            params.product_filters = classification.detected_products

        # Apply doc type filters if detected
        if classification.detected_doc_types:
            params.doc_type_filters = classification.detected_doc_types

        # Adjust by complexity
        if classification.complexity == QueryComplexity.SIMPLE:
            params.top_k = 5
            params.use_hyde = False
            params.use_multi_query = False
            params.use_mmr = False
            params.num_query_variations = 0
        elif classification.complexity == QueryComplexity.MODERATE:
            params.top_k = 10
            params.use_hyde = True
            params.use_multi_query = True
            params.num_query_variations = 3
            params.use_mmr = True
            params.mmr_diversity = 0.3
        elif classification.complexity == QueryComplexity.COMPLEX:
            params.top_k = 15
            params.use_hyde = True
            params.use_multi_query = True
            params.num_query_variations = 4
            params.use_mmr = True
            params.mmr_diversity = 0.4
            params.include_parent_context = True

        # Adjust by intent
        if classification.intent == QueryIntent.TROUBLESHOOTING:
            # Trust historical solutions more for troubleshooting
            params.feedback_boost_weight = 0.35
            params.include_parent_context = True
            # Ensure troubleshooting docs are prioritized
            if "troubleshooting" not in params.doc_type_filters:
                params.doc_type_filters.insert(0, "troubleshooting")

        elif classification.intent == QueryIntent.CONFIGURATION:
            # HyDE is good for procedural queries
            params.use_hyde = True
            params.semantic_weight = 0.75

        elif classification.intent == QueryIntent.EXPLANATION:
            # Concepts need strong semantic matching
            params.use_hyde = True
            params.semantic_weight = 0.8
            params.use_mmr = True  # Get diverse explanations

        elif classification.intent == QueryIntent.COMPARISON:
            # Want diverse results for comparison
            params.use_multi_query = True
            params.num_query_variations = 4
            params.mmr_diversity = 0.5
            params.use_mmr = True

        elif classification.intent == QueryIntent.VALIDATION:
            # Need authoritative sources
            params.feedback_boost_weight = 0.25
            if "best_practices" not in params.doc_type_filters:
                params.doc_type_filters.insert(0, "best_practices")

        elif classification.intent == QueryIntent.OPTIMIZATION:
            # Trust best practices and historical successes
            params.feedback_boost_weight = 0.3
            if "best_practices" not in params.doc_type_filters:
                params.doc_type_filters.insert(0, "best_practices")

        logger.debug(f"Adaptive parameters: {params.to_dict()}")
        return params


# Singleton instance
_query_classifier: Optional[QueryClassifier] = None


def get_query_classifier() -> QueryClassifier:
    """Get or create the singleton query classifier."""
    global _query_classifier
    if _query_classifier is None:
        _query_classifier = QueryClassifier()
    return _query_classifier
