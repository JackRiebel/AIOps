"""Cross-Encoder reranking for improved retrieval precision.

Cross-encoders jointly encode the query and document together, allowing
for much more accurate relevance scoring than bi-encoders (which encode
them separately). The trade-off is speed - cross-encoders are slower
but provide better precision for the final top-k results.

Usage:
    reranker = CrossEncoderReranker()
    reranked = reranker.rerank(query, chunks, top_k=10)
"""

import logging
from typing import List, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Try to import sentence-transformers
try:
    from sentence_transformers import CrossEncoder
    CROSS_ENCODER_AVAILABLE = True
except ImportError:
    CROSS_ENCODER_AVAILABLE = False
    logger.warning(
        "sentence-transformers not installed. Cross-encoder reranking disabled. "
        "Install with: pip install sentence-transformers"
    )


@dataclass
class RerankResult:
    """Result from cross-encoder reranking."""
    chunk_id: int
    original_score: float
    cross_encoder_score: float
    final_score: float


class CrossEncoderReranker:
    """Rerank retrieved chunks using a cross-encoder model.

    Cross-encoders provide more accurate relevance scores by jointly
    encoding the query and document. This class wraps a pre-trained
    cross-encoder model for reranking RAG results.

    Recommended models (from ms-marco):
    - cross-encoder/ms-marco-MiniLM-L-6-v2 (fast, good quality)
    - cross-encoder/ms-marco-MiniLM-L-12-v2 (slower, better quality)
    - cross-encoder/ms-marco-TinyBERT-L-2-v2 (fastest, lower quality)
    """

    DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        max_length: int = 512,
        blend_weight: float = 0.7,
    ):
        """Initialize the cross-encoder reranker.

        Args:
            model_name: Name of the cross-encoder model to use.
            device: Device to run on ('cuda', 'cpu', or None for auto).
            max_length: Maximum input length (query + document).
            blend_weight: Weight for cross-encoder score in final blend.
                         final = blend_weight * cross_encoder + (1-blend_weight) * original
        """
        self.model_name = model_name or self.DEFAULT_MODEL
        self.max_length = max_length
        self.blend_weight = blend_weight
        self._model: Optional["CrossEncoder"] = None
        self._device = device

        if not CROSS_ENCODER_AVAILABLE:
            logger.warning("CrossEncoderReranker initialized but model unavailable")

    @property
    def model(self) -> Optional["CrossEncoder"]:
        """Lazy-load the cross-encoder model."""
        if not CROSS_ENCODER_AVAILABLE:
            return None

        if self._model is None:
            try:
                logger.info(f"Loading cross-encoder model: {self.model_name}")
                self._model = CrossEncoder(
                    self.model_name,
                    max_length=self.max_length,
                    device=self._device,
                )
                logger.info(f"Cross-encoder model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load cross-encoder model: {e}")
                return None

        return self._model

    def is_available(self) -> bool:
        """Check if cross-encoder reranking is available."""
        return CROSS_ENCODER_AVAILABLE and self.model is not None

    def rerank(
        self,
        query: str,
        chunks: List,  # List[RetrievedChunk]
        top_k: int = 10,
        min_score: float = 0.0,
    ) -> List:
        """Rerank chunks using cross-encoder scores.

        Args:
            query: The search query.
            chunks: List of RetrievedChunk objects to rerank.
            top_k: Number of top results to return.
            min_score: Minimum cross-encoder score threshold.

        Returns:
            Reranked list of chunks with updated relevance scores.
        """
        if not chunks:
            return []

        if not self.is_available():
            logger.debug("Cross-encoder not available, returning original ranking")
            return chunks[:top_k]

        try:
            # Create query-document pairs
            pairs = [(query, chunk.content) for chunk in chunks]

            # Get cross-encoder scores
            scores = self.model.predict(pairs, show_progress_bar=False)

            # Combine with original scores
            reranked_data = []
            for chunk, ce_score in zip(chunks, scores):
                # Blend cross-encoder score with original relevance
                final_score = (
                    self.blend_weight * float(ce_score) +
                    (1 - self.blend_weight) * chunk.relevance
                )

                if final_score >= min_score:
                    reranked_data.append((chunk, float(ce_score), final_score))

            # Sort by final score descending
            reranked_data.sort(key=lambda x: x[2], reverse=True)

            # Update chunk scores and return top_k
            results = []
            for chunk, ce_score, final_score in reranked_data[:top_k]:
                # Store cross-encoder score in metadata
                chunk.chunk_metadata = chunk.chunk_metadata or {}
                chunk.chunk_metadata['cross_encoder_score'] = ce_score
                chunk.chunk_metadata['original_relevance'] = chunk.relevance

                # Update relevance to final blended score
                chunk.relevance = final_score
                chunk.final_score = final_score

                results.append(chunk)

            logger.debug(
                f"Cross-encoder reranked {len(chunks)} -> {len(results)} chunks "
                f"(top ce_score: {reranked_data[0][1]:.3f})"
            )

            return results

        except Exception as e:
            logger.error(f"Cross-encoder reranking failed: {e}")
            return chunks[:top_k]

    def score_pair(self, query: str, document: str) -> float:
        """Score a single query-document pair.

        Args:
            query: The query text.
            document: The document text.

        Returns:
            Cross-encoder relevance score.
        """
        if not self.is_available():
            return 0.0

        try:
            score = self.model.predict([(query, document)], show_progress_bar=False)
            return float(score[0])
        except Exception as e:
            logger.error(f"Cross-encoder scoring failed: {e}")
            return 0.0

    def batch_score(
        self,
        query: str,
        documents: List[str],
        batch_size: int = 32,
    ) -> List[float]:
        """Score multiple documents against a query.

        Args:
            query: The query text.
            documents: List of document texts.
            batch_size: Batch size for inference.

        Returns:
            List of relevance scores.
        """
        if not documents:
            return []

        if not self.is_available():
            return [0.0] * len(documents)

        try:
            pairs = [(query, doc) for doc in documents]
            scores = self.model.predict(
                pairs,
                batch_size=batch_size,
                show_progress_bar=False,
            )
            return [float(s) for s in scores]
        except Exception as e:
            logger.error(f"Cross-encoder batch scoring failed: {e}")
            return [0.0] * len(documents)


# Singleton instance
_cross_encoder_reranker: Optional[CrossEncoderReranker] = None


def get_cross_encoder_reranker() -> CrossEncoderReranker:
    """Get or create the global cross-encoder reranker instance."""
    global _cross_encoder_reranker
    if _cross_encoder_reranker is None:
        _cross_encoder_reranker = CrossEncoderReranker()
    return _cross_encoder_reranker
