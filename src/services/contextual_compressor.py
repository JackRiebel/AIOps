"""Contextual compression for RAG chunk content.

Extracts only the query-relevant portions from retrieved chunks,
reducing token count while preserving essential information.

This improves:
- Token efficiency (lower costs, more chunks fit in context)
- Answer quality (LLM focuses on relevant content)
- Response latency (less content to process)

Usage:
    compressor = ContextualCompressor()
    compressed = await compressor.compress(query, chunks)
"""

import logging
import re
from typing import List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Try to import sentence-transformers for similarity scoring
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    SENTENCE_TRANSFORMER_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMER_AVAILABLE = False
    logger.warning(
        "sentence-transformers not installed. Using keyword-based compression. "
        "Install with: pip install sentence-transformers"
    )


@dataclass
class CompressedChunk:
    """A chunk with compressed content."""
    original_content: str
    compressed_content: str
    original_length: int
    compressed_length: int
    compression_ratio: float
    kept_sentences: int
    total_sentences: int
    relevance_scores: List[float] = field(default_factory=list)

    # Pass-through original chunk metadata
    chunk_id: Optional[int] = None
    document_id: Optional[int] = None
    relevance: float = 0.0
    chunk_metadata: Optional[dict] = None


@dataclass
class CompressionStats:
    """Statistics for a compression operation."""
    total_chunks: int
    total_original_length: int
    total_compressed_length: int
    avg_compression_ratio: float
    total_sentences_kept: int
    total_sentences_processed: int

    @property
    def overall_compression(self) -> float:
        """Overall compression percentage."""
        if self.total_original_length == 0:
            return 0.0
        return 1.0 - (self.total_compressed_length / self.total_original_length)


class ContextualCompressor:
    """Compress chunks to extract only query-relevant content.

    Uses semantic similarity to identify which sentences/paragraphs
    in a chunk are most relevant to the query, then returns only
    those portions.

    Two modes:
    1. Semantic mode (requires sentence-transformers):
       Uses embedding similarity for accurate relevance scoring
    2. Keyword mode (fallback):
       Uses keyword overlap for basic relevance filtering
    """

    # Default embedding model for sentence similarity
    DEFAULT_MODEL = "all-MiniLM-L6-v2"

    def __init__(
        self,
        model_name: Optional[str] = None,
        relevance_threshold: float = 0.35,
        min_sentences: int = 2,
        max_sentences: Optional[int] = None,
        preserve_structure: bool = True,
    ):
        """Initialize the contextual compressor.

        Args:
            model_name: Sentence transformer model for similarity scoring.
            relevance_threshold: Minimum similarity score to keep a sentence (0-1).
            min_sentences: Minimum number of sentences to keep per chunk.
            max_sentences: Maximum sentences to keep (None = no limit).
            preserve_structure: Whether to preserve paragraph/list structure.
        """
        self.model_name = model_name or self.DEFAULT_MODEL
        self.relevance_threshold = relevance_threshold
        self.min_sentences = min_sentences
        self.max_sentences = max_sentences
        self.preserve_structure = preserve_structure

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
        """Split text into sentences while preserving structure.

        Handles:
        - Standard sentence endings (. ! ?)
        - Bullet points and numbered lists
        - Code blocks (preserved as single units)
        - Headers
        """
        sentences = []

        # Preserve code blocks as single units
        code_block_pattern = r'```[\s\S]*?```'
        code_blocks = re.findall(code_block_pattern, text)
        text_with_placeholders = re.sub(code_block_pattern, '<<<CODE_BLOCK>>>', text)

        # Split by common sentence boundaries
        # Handle multiple punctuation, abbreviations, etc.
        raw_sentences = re.split(
            r'(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*[-*•]\s+|(?<=\n)\s*\d+\.\s+|(?<=\n\n)',
            text_with_placeholders
        )

        code_block_idx = 0
        for sent in raw_sentences:
            sent = sent.strip()
            if not sent:
                continue

            # Restore code blocks
            while '<<<CODE_BLOCK>>>' in sent and code_block_idx < len(code_blocks):
                sent = sent.replace('<<<CODE_BLOCK>>>', code_blocks[code_block_idx], 1)
                code_block_idx += 1

            sentences.append(sent)

        return sentences

    def _extract_keywords(self, text: str) -> set:
        """Extract keywords from text for keyword-based matching."""
        # Remove common stop words and extract meaningful terms
        stop_words = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
            'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'under', 'again',
            'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
            'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
            'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
            'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this',
            'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'it', 'its',
            'you', 'your', 'we', 'our', 'they', 'their', 'i', 'me', 'my', 'he', 'she',
        }

        # Extract words, lowercase, filter
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        return {w for w in words if w not in stop_words}

    def _keyword_relevance(self, query_keywords: set, sentence: str) -> float:
        """Calculate keyword-based relevance score."""
        sentence_keywords = self._extract_keywords(sentence)
        if not query_keywords or not sentence_keywords:
            return 0.0

        # Jaccard-like similarity with query term weighting
        overlap = query_keywords & sentence_keywords
        if not overlap:
            return 0.0

        # Weight by coverage of query terms
        query_coverage = len(overlap) / len(query_keywords)
        # Also consider density in sentence
        density = len(overlap) / len(sentence_keywords) if sentence_keywords else 0

        return (query_coverage * 0.7 + density * 0.3)

    def _semantic_relevance(
        self,
        query_embedding: "np.ndarray",
        sentence_embeddings: "np.ndarray",
    ) -> List[float]:
        """Calculate semantic similarity scores."""
        from numpy import dot
        from numpy.linalg import norm

        scores = []
        for sent_emb in sentence_embeddings:
            # Cosine similarity
            similarity = dot(query_embedding, sent_emb) / (
                norm(query_embedding) * norm(sent_emb) + 1e-8
            )
            scores.append(float(similarity))

        return scores

    async def compress_chunk(
        self,
        query: str,
        content: str,
        query_embedding: Optional[List[float]] = None,
    ) -> Tuple[str, List[float]]:
        """Compress a single chunk's content.

        Args:
            query: The search query.
            content: The chunk content to compress.
            query_embedding: Pre-computed query embedding (optional).

        Returns:
            Tuple of (compressed_content, sentence_scores)
        """
        sentences = self._split_into_sentences(content)

        if len(sentences) <= self.min_sentences:
            # Already minimal, return as-is
            return content, [1.0] * len(sentences)

        # Calculate relevance scores
        if self.model is not None:
            # Semantic mode
            import numpy as np

            if query_embedding is not None:
                q_emb = np.array(query_embedding)
            else:
                q_emb = self.model.encode(query)

            sent_embeddings = self.model.encode(sentences)
            scores = self._semantic_relevance(q_emb, sent_embeddings)
        else:
            # Keyword fallback mode
            query_keywords = self._extract_keywords(query)
            scores = [
                self._keyword_relevance(query_keywords, sent)
                for sent in sentences
            ]

        # Select sentences above threshold
        scored_sentences = list(zip(sentences, scores, range(len(sentences))))

        # Sort by score descending
        sorted_by_score = sorted(scored_sentences, key=lambda x: x[1], reverse=True)

        # Select top sentences (at least min_sentences, at most max_sentences)
        selected = []
        for sent, score, idx in sorted_by_score:
            if len(selected) >= (self.max_sentences or len(sentences)):
                break
            if score >= self.relevance_threshold or len(selected) < self.min_sentences:
                selected.append((sent, score, idx))

        # Re-sort by original position to preserve structure
        if self.preserve_structure:
            selected.sort(key=lambda x: x[2])

        # Build compressed content
        compressed_parts = [sent for sent, _, _ in selected]

        # Join with appropriate separator
        if self.preserve_structure:
            compressed = "\n\n".join(compressed_parts)
        else:
            compressed = " ".join(compressed_parts)

        return compressed, scores

    async def compress(
        self,
        query: str,
        chunks: List,  # List of chunk objects with .content attribute
        query_embedding: Optional[List[float]] = None,
    ) -> Tuple[List[CompressedChunk], CompressionStats]:
        """Compress a list of retrieved chunks.

        Args:
            query: The search query.
            chunks: List of RetrievedChunk or similar objects.
            query_embedding: Pre-computed query embedding (optional).

        Returns:
            Tuple of (compressed_chunks, stats)
        """
        if not chunks:
            return [], CompressionStats(0, 0, 0, 0.0, 0, 0)

        compressed_chunks = []
        total_original = 0
        total_compressed = 0
        total_kept = 0
        total_processed = 0

        for chunk in chunks:
            content = chunk.content if hasattr(chunk, 'content') else str(chunk)
            original_len = len(content)

            sentences = self._split_into_sentences(content)
            total_processed += len(sentences)

            compressed_content, scores = await self.compress_chunk(
                query, content, query_embedding
            )

            compressed_len = len(compressed_content)

            # Count kept sentences
            kept_count = sum(
                1 for s in scores
                if s >= self.relevance_threshold
            )
            kept_count = max(kept_count, self.min_sentences)
            kept_count = min(kept_count, len(sentences))
            total_kept += kept_count

            total_original += original_len
            total_compressed += compressed_len

            # Create compressed chunk
            cc = CompressedChunk(
                original_content=content,
                compressed_content=compressed_content,
                original_length=original_len,
                compressed_length=compressed_len,
                compression_ratio=compressed_len / original_len if original_len > 0 else 1.0,
                kept_sentences=kept_count,
                total_sentences=len(sentences),
                relevance_scores=scores,
                chunk_id=getattr(chunk, 'id', None),
                document_id=getattr(chunk, 'document_id', None),
                relevance=getattr(chunk, 'relevance', 0.0),
                chunk_metadata=getattr(chunk, 'chunk_metadata', None),
            )
            compressed_chunks.append(cc)

        # Compute stats
        avg_ratio = (
            sum(c.compression_ratio for c in compressed_chunks) / len(compressed_chunks)
            if compressed_chunks else 0.0
        )

        stats = CompressionStats(
            total_chunks=len(chunks),
            total_original_length=total_original,
            total_compressed_length=total_compressed,
            avg_compression_ratio=avg_ratio,
            total_sentences_kept=total_kept,
            total_sentences_processed=total_processed,
        )

        logger.debug(
            f"Compressed {len(chunks)} chunks: {total_original} -> {total_compressed} chars "
            f"({stats.overall_compression:.1%} reduction)"
        )

        return compressed_chunks, stats

    def compress_for_context(
        self,
        compressed_chunks: List[CompressedChunk],
        max_tokens: Optional[int] = None,
        token_estimate_ratio: float = 0.25,  # ~4 chars per token
    ) -> str:
        """Build a context string from compressed chunks.

        Args:
            compressed_chunks: List of CompressedChunk objects.
            max_tokens: Maximum tokens for the context (optional).
            token_estimate_ratio: Ratio to estimate tokens from chars.

        Returns:
            Combined context string ready for LLM.
        """
        if not compressed_chunks:
            return ""

        # Sort by relevance descending
        sorted_chunks = sorted(
            compressed_chunks,
            key=lambda c: c.relevance,
            reverse=True
        )

        context_parts = []
        total_chars = 0
        max_chars = int(max_tokens / token_estimate_ratio) if max_tokens else None

        for i, chunk in enumerate(sorted_chunks):
            part = f"[Source {i+1}]\n{chunk.compressed_content}"

            if max_chars and total_chars + len(part) > max_chars:
                # Would exceed limit, stop
                break

            context_parts.append(part)
            total_chars += len(part)

        return "\n\n---\n\n".join(context_parts)


# Singleton instance
_contextual_compressor: Optional[ContextualCompressor] = None


def get_contextual_compressor() -> ContextualCompressor:
    """Get or create the global contextual compressor instance."""
    global _contextual_compressor
    if _contextual_compressor is None:
        _contextual_compressor = ContextualCompressor()
    return _contextual_compressor
