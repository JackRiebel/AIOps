"""Answer grounding verification for RAG responses.

Verifies that generated answers are grounded in the retrieved source
documents, detecting potential hallucinations or unsupported claims.

This is critical for:
- Ensuring factual accuracy of responses
- Building user trust in the system
- Identifying when sources are insufficient

Usage:
    verifier = GroundingVerifier()
    result = await verifier.verify(answer, sources)
    if not result.is_grounded:
        # Handle ungrounded claims
"""

import logging
import re
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

# Try to import sentence-transformers
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    SENTENCE_TRANSFORMER_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMER_AVAILABLE = False
    logger.warning(
        "sentence-transformers not installed. Using keyword-based grounding. "
        "Install with: pip install sentence-transformers"
    )


class ClaimType(Enum):
    """Types of claims that can be extracted from answers."""
    FACTUAL = "factual"           # Specific facts or data
    PROCEDURAL = "procedural"     # Steps or processes
    DEFINITIONAL = "definitional" # What something is/means
    CAUSAL = "causal"            # Cause and effect
    COMPARATIVE = "comparative"   # Comparisons
    QUANTITATIVE = "quantitative" # Numbers, measurements


class GroundingLevel(Enum):
    """Level of support for a claim."""
    FULLY_GROUNDED = "fully_grounded"     # Direct evidence in sources
    PARTIALLY_GROUNDED = "partially"      # Some supporting evidence
    INFERRED = "inferred"                 # Reasonable inference
    UNGROUNDED = "ungrounded"             # No supporting evidence
    CONTRADICTED = "contradicted"         # Sources contradict


@dataclass
class Claim:
    """An extracted claim from the answer."""
    text: str
    claim_type: ClaimType
    position: int  # Position in answer (sentence index)
    key_terms: List[str] = field(default_factory=list)


@dataclass
class ClaimSupport:
    """Evidence supporting (or contradicting) a claim."""
    claim: Claim
    grounding_level: GroundingLevel
    confidence: float  # 0-1 confidence in assessment
    supporting_sources: List[int]  # Indices of supporting chunks
    evidence_snippets: List[str]  # Relevant text from sources
    explanation: str


@dataclass
class GroundingResult:
    """Result of grounding verification."""
    is_grounded: bool
    grounding_score: float  # 0-1 overall score
    claim_count: int
    grounded_count: int
    ungrounded_count: int
    claim_supports: List[ClaimSupport]

    # Summary by grounding level
    level_distribution: Dict[str, int] = field(default_factory=dict)

    # Ungrounded claims for flagging
    ungrounded_claims: List[str] = field(default_factory=list)

    # Overall assessment
    assessment: str = ""
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "is_grounded": self.is_grounded,
            "grounding_score": round(self.grounding_score, 3),
            "claim_count": self.claim_count,
            "grounded_count": self.grounded_count,
            "ungrounded_count": self.ungrounded_count,
            "level_distribution": self.level_distribution,
            "ungrounded_claims": self.ungrounded_claims,
            "assessment": self.assessment,
            "recommendations": self.recommendations,
        }


class GroundingVerifier:
    """Verify that answers are grounded in source documents.

    Extracts claims from the answer and checks each against the
    source documents for supporting evidence.

    Works in two modes:
    1. Semantic mode (requires sentence-transformers):
       Uses embedding similarity for claim-source matching
    2. Keyword mode (fallback):
       Uses keyword overlap for basic verification
    """

    DEFAULT_MODEL = "all-MiniLM-L6-v2"

    # Claim extraction patterns
    CLAIM_PATTERNS = {
        ClaimType.QUANTITATIVE: [
            r'\b\d+(?:\.\d+)?\s*(?:%|percent|gb|mb|kb|ms|seconds?|minutes?|hours?|days?)\b',
            r'\b(?:up to|at least|maximum|minimum|approximately|about)\s+\d+',
        ],
        ClaimType.CAUSAL: [
            r'\b(?:because|due to|causes?|results? in|leads? to|if .* then)\b',
        ],
        ClaimType.PROCEDURAL: [
            r'\b(?:first|then|next|finally|step \d+|to .* you (?:need|must|should))\b',
        ],
        ClaimType.COMPARATIVE: [
            r'\b(?:better|worse|faster|slower|more|less|compared to|versus|vs\.?)\b',
        ],
        ClaimType.DEFINITIONAL: [
            r'\b(?:is a|are|means|refers to|defined as|known as)\b',
        ],
    }

    # Phrases that indicate uncertainty (weaker grounding needed)
    UNCERTAINTY_MARKERS = [
        r'\b(?:may|might|could|possibly|potentially|likely|probably)\b',
        r'\b(?:in some cases|sometimes|typically|usually|generally)\b',
        r'\b(?:it appears|seems like|appears to be)\b',
    ]

    def __init__(
        self,
        model_name: Optional[str] = None,
        grounding_threshold: float = 0.6,
        partial_threshold: float = 0.4,
    ):
        """Initialize the grounding verifier.

        Args:
            model_name: Sentence transformer model for similarity.
            grounding_threshold: Minimum similarity for fully grounded (0-1).
            partial_threshold: Minimum similarity for partially grounded.
        """
        self.model_name = model_name or self.DEFAULT_MODEL
        self.grounding_threshold = grounding_threshold
        self.partial_threshold = partial_threshold

        self._model: Optional["SentenceTransformer"] = None

    @property
    def model(self) -> Optional["SentenceTransformer"]:
        """Lazy-load the sentence transformer model."""
        if not SENTENCE_TRANSFORMER_AVAILABLE:
            return None

        if self._model is None:
            try:
                logger.info(f"Loading sentence transformer: {self.model_name}")
                self._model = SentenceTransformer(self.model_name)
                logger.info("Sentence transformer loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load sentence transformer: {e}")
                return None

        return self._model

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        # Simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def _extract_key_terms(self, text: str) -> List[str]:
        """Extract key terms from text."""
        # Remove common stop words
        stop_words = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
            'on', 'with', 'at', 'by', 'from', 'as', 'this', 'that', 'it', 'you',
            'and', 'or', 'but', 'if', 'so', 'not', 'no', 'yes',
        }

        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        return [w for w in words if w not in stop_words]

    def _detect_claim_type(self, text: str) -> ClaimType:
        """Detect the type of claim from text patterns."""
        text_lower = text.lower()

        for claim_type, patterns in self.CLAIM_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return claim_type

        return ClaimType.FACTUAL  # Default

    def _has_uncertainty(self, text: str) -> bool:
        """Check if claim contains uncertainty markers."""
        text_lower = text.lower()
        for pattern in self.UNCERTAINTY_MARKERS:
            if re.search(pattern, text_lower):
                return True
        return False

    def _extract_claims(self, answer: str) -> List[Claim]:
        """Extract verifiable claims from the answer.

        Not all sentences are claims - we filter for:
        - Factual statements (not questions)
        - Assertions (not hedged opinions)
        - Specific enough to verify
        """
        sentences = self._split_into_sentences(answer)
        claims = []

        for i, sentence in enumerate(sentences):
            # Skip questions
            if sentence.strip().endswith('?'):
                continue

            # Skip very short sentences (likely not claims)
            if len(sentence.split()) < 4:
                continue

            # Skip pure meta-statements
            meta_patterns = [
                r'^(?:here is|here are|below is|the following)',
                r'^(?:i hope|i think|i believe|in my opinion)',
                r'^(?:let me|allow me|i will)',
            ]
            if any(re.match(p, sentence.lower()) for p in meta_patterns):
                continue

            claim_type = self._detect_claim_type(sentence)
            key_terms = self._extract_key_terms(sentence)

            claims.append(Claim(
                text=sentence,
                claim_type=claim_type,
                position=i,
                key_terms=key_terms,
            ))

        return claims

    def _keyword_similarity(self, claim_terms: List[str], source_text: str) -> float:
        """Calculate keyword-based similarity."""
        if not claim_terms:
            return 0.0

        source_terms = set(self._extract_key_terms(source_text))
        if not source_terms:
            return 0.0

        claim_set = set(claim_terms)
        overlap = claim_set & source_terms

        # Jaccard-ish but weighted toward claim term coverage
        coverage = len(overlap) / len(claim_set)
        return coverage

    def _semantic_similarity(
        self,
        claim_embedding: "np.ndarray",
        source_embeddings: List["np.ndarray"],
    ) -> List[float]:
        """Calculate semantic similarity between claim and sources."""
        from numpy import dot
        from numpy.linalg import norm

        scores = []
        for src_emb in source_embeddings:
            sim = dot(claim_embedding, src_emb) / (
                norm(claim_embedding) * norm(src_emb) + 1e-8
            )
            scores.append(float(sim))

        return scores

    def _find_evidence(
        self,
        claim: Claim,
        source_contents: List[str],
        source_embeddings: Optional[List["np.ndarray"]] = None,
        claim_embedding: Optional["np.ndarray"] = None,
    ) -> Tuple[GroundingLevel, float, List[int], List[str]]:
        """Find supporting evidence for a claim.

        Returns:
            Tuple of (grounding_level, confidence, source_indices, snippets)
        """
        if self.model is not None and source_embeddings is not None and claim_embedding is not None:
            # Semantic mode
            similarities = self._semantic_similarity(claim_embedding, source_embeddings)
        else:
            # Keyword mode
            similarities = [
                self._keyword_similarity(claim.key_terms, src)
                for src in source_contents
            ]

        # Find best matching sources
        scored_sources = sorted(
            enumerate(similarities),
            key=lambda x: x[1],
            reverse=True
        )

        # Determine grounding level
        best_score = scored_sources[0][1] if scored_sources else 0
        supporting_indices = []
        snippets = []

        for idx, score in scored_sources[:3]:  # Top 3 sources
            if score >= self.partial_threshold:
                supporting_indices.append(idx)
                # Extract relevant snippet (first 200 chars)
                snippet = source_contents[idx][:200] + "..." if len(source_contents[idx]) > 200 else source_contents[idx]
                snippets.append(snippet)

        # Determine grounding level based on best score
        if best_score >= self.grounding_threshold:
            level = GroundingLevel.FULLY_GROUNDED
        elif best_score >= self.partial_threshold:
            level = GroundingLevel.PARTIALLY_GROUNDED
        elif best_score >= 0.25:
            level = GroundingLevel.INFERRED
        else:
            level = GroundingLevel.UNGROUNDED

        # Adjust for uncertainty markers
        if self._has_uncertainty(claim.text):
            # Uncertain claims need less strict grounding
            if level == GroundingLevel.PARTIALLY_GROUNDED:
                level = GroundingLevel.FULLY_GROUNDED
            elif level == GroundingLevel.INFERRED:
                level = GroundingLevel.PARTIALLY_GROUNDED

        return level, best_score, supporting_indices, snippets

    async def verify(
        self,
        answer: str,
        sources: List,  # List of chunk objects with .content
        source_embeddings: Optional[List[List[float]]] = None,
    ) -> GroundingResult:
        """Verify that an answer is grounded in sources.

        Args:
            answer: The generated answer text.
            sources: List of source chunks (with .content attribute).
            source_embeddings: Pre-computed source embeddings (optional).

        Returns:
            GroundingResult with detailed analysis.
        """
        if not answer or not sources:
            return GroundingResult(
                is_grounded=False,
                grounding_score=0.0,
                claim_count=0,
                grounded_count=0,
                ungrounded_count=0,
                claim_supports=[],
                assessment="No answer or sources provided.",
            )

        # Extract source contents
        source_contents = [
            src.content if hasattr(src, 'content') else str(src)
            for src in sources
        ]

        # Extract claims from answer
        claims = self._extract_claims(answer)

        if not claims:
            return GroundingResult(
                is_grounded=True,
                grounding_score=1.0,
                claim_count=0,
                grounded_count=0,
                ungrounded_count=0,
                claim_supports=[],
                assessment="No verifiable claims found in answer.",
            )

        # Prepare embeddings if semantic mode available
        src_embs = None
        if self.model is not None:
            import numpy as np
            if source_embeddings:
                src_embs = [np.array(e) for e in source_embeddings]
            else:
                # Encode source sentences
                src_embs = [
                    self.model.encode(content)
                    for content in source_contents
                ]

        # Verify each claim
        claim_supports = []
        level_counts = {level.value: 0 for level in GroundingLevel}

        for claim in claims:
            # Get claim embedding if semantic mode
            claim_emb = None
            if self.model is not None:
                claim_emb = self.model.encode(claim.text)

            level, confidence, indices, snippets = self._find_evidence(
                claim,
                source_contents,
                src_embs,
                claim_emb,
            )

            level_counts[level.value] += 1

            # Build explanation
            if level == GroundingLevel.FULLY_GROUNDED:
                explanation = f"Claim is well-supported by source(s) {indices}"
            elif level == GroundingLevel.PARTIALLY_GROUNDED:
                explanation = f"Claim has partial support from source(s) {indices}"
            elif level == GroundingLevel.INFERRED:
                explanation = "Claim can be reasonably inferred but not directly stated"
            else:
                explanation = "No supporting evidence found in sources"

            claim_supports.append(ClaimSupport(
                claim=claim,
                grounding_level=level,
                confidence=confidence,
                supporting_sources=indices,
                evidence_snippets=snippets,
                explanation=explanation,
            ))

        # Calculate overall metrics
        grounded_count = (
            level_counts[GroundingLevel.FULLY_GROUNDED.value] +
            level_counts[GroundingLevel.PARTIALLY_GROUNDED.value]
        )
        ungrounded_count = level_counts[GroundingLevel.UNGROUNDED.value]

        # Grounding score: weighted by grounding level
        weights = {
            GroundingLevel.FULLY_GROUNDED.value: 1.0,
            GroundingLevel.PARTIALLY_GROUNDED.value: 0.7,
            GroundingLevel.INFERRED.value: 0.4,
            GroundingLevel.UNGROUNDED.value: 0.0,
            GroundingLevel.CONTRADICTED.value: -0.5,
        }
        total_weight = sum(
            level_counts[level] * weights[level]
            for level in level_counts
        )
        grounding_score = total_weight / len(claims) if claims else 0

        # Overall grounded if majority claims are supported
        is_grounded = grounding_score >= 0.6 and ungrounded_count <= len(claims) * 0.3

        # Collect ungrounded claims
        ungrounded_claims = [
            cs.claim.text for cs in claim_supports
            if cs.grounding_level == GroundingLevel.UNGROUNDED
        ]

        # Generate assessment and recommendations
        if is_grounded:
            if grounding_score >= 0.9:
                assessment = "Answer is well-grounded in source documents."
            else:
                assessment = "Answer is mostly grounded with some inferences."
        else:
            assessment = f"Answer contains {ungrounded_count} ungrounded claim(s) that need verification."

        recommendations = []
        if ungrounded_count > 0:
            recommendations.append(
                f"Review {ungrounded_count} ungrounded claim(s) for accuracy"
            )
        if level_counts[GroundingLevel.INFERRED.value] > len(claims) * 0.3:
            recommendations.append(
                "Consider adding more specific sources to support inferred claims"
            )

        return GroundingResult(
            is_grounded=is_grounded,
            grounding_score=max(0, min(1, grounding_score)),
            claim_count=len(claims),
            grounded_count=grounded_count,
            ungrounded_count=ungrounded_count,
            claim_supports=claim_supports,
            level_distribution=level_counts,
            ungrounded_claims=ungrounded_claims,
            assessment=assessment,
            recommendations=recommendations,
        )

    async def quick_verify(
        self,
        answer: str,
        sources: List,
    ) -> Tuple[bool, float]:
        """Quick verification returning just grounded status and score.

        Args:
            answer: The answer text.
            sources: Source chunks.

        Returns:
            Tuple of (is_grounded, grounding_score)
        """
        result = await self.verify(answer, sources)
        return result.is_grounded, result.grounding_score


# Singleton instance
_grounding_verifier: Optional[GroundingVerifier] = None


def get_grounding_verifier() -> GroundingVerifier:
    """Get or create the global grounding verifier instance."""
    global _grounding_verifier
    if _grounding_verifier is None:
        _grounding_verifier = GroundingVerifier()
    return _grounding_verifier
