"""MMR (Maximal Marginal Relevance) Re-ranking Service.

Implements MMR for balancing relevance with diversity in search results.
This prevents returning multiple chunks that say essentially the same thing,
while ensuring the most relevant information is still prioritized.

MMR Score = λ * similarity(query, doc) - (1-λ) * max(similarity(doc, selected_docs))

Where:
- λ close to 1: Prioritize relevance
- λ close to 0: Prioritize diversity
"""

import logging
import numpy as np
from typing import List, Optional, Tuple, TypeVar, Generic
from dataclasses import dataclass

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class ScoredItem(Generic[T]):
    """An item with its embedding and scores."""
    item: T
    embedding: List[float]
    relevance_score: float
    mmr_score: Optional[float] = None


class MMRReranker:
    """Maximal Marginal Relevance re-ranker.

    Reranks search results to balance relevance with diversity,
    ensuring varied information in the final results.
    """

    def __init__(self, lambda_param: float = 0.7):
        """Initialize the MMR re-ranker.

        Args:
            lambda_param: Balance between relevance (1.0) and diversity (0.0).
                         Default 0.7 gives good balance favoring relevance.
        """
        self.lambda_param = lambda_param

    def cosine_similarity(
        self,
        vec1: List[float],
        vec2: List[float],
    ) -> float:
        """Calculate cosine similarity between two vectors.

        Args:
            vec1: First vector.
            vec2: Second vector.

        Returns:
            Cosine similarity score between -1 and 1.
        """
        a = np.array(vec1)
        b = np.array(vec2)

        dot_product = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(dot_product / (norm_a * norm_b))

    def rerank(
        self,
        query_embedding: List[float],
        candidates: List[ScoredItem[T]],
        top_k: int = 5,
        lambda_param: Optional[float] = None,
    ) -> List[ScoredItem[T]]:
        """Rerank candidates using MMR.

        Args:
            query_embedding: The query's embedding vector.
            candidates: List of candidate items with embeddings.
            top_k: Number of results to return.
            lambda_param: Override default lambda parameter.

        Returns:
            Reranked list of top_k items.
        """
        if not candidates:
            return []

        if len(candidates) <= top_k:
            # Not enough candidates to rerank meaningfully
            return sorted(candidates, key=lambda x: x.relevance_score, reverse=True)

        lambda_val = lambda_param if lambda_param is not None else self.lambda_param

        selected: List[ScoredItem[T]] = []
        remaining = candidates.copy()

        while len(selected) < top_k and remaining:
            best_score = float('-inf')
            best_item: Optional[ScoredItem[T]] = None
            best_idx = -1

            for idx, candidate in enumerate(remaining):
                # Calculate relevance to query
                relevance = candidate.relevance_score

                # Calculate max similarity to already selected items
                if selected:
                    max_sim_to_selected = max(
                        self.cosine_similarity(candidate.embedding, s.embedding)
                        for s in selected
                    )
                else:
                    max_sim_to_selected = 0.0

                # MMR score
                mmr_score = (lambda_val * relevance) - ((1 - lambda_val) * max_sim_to_selected)

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_item = candidate
                    best_idx = idx

            if best_item is not None:
                best_item.mmr_score = best_score
                selected.append(best_item)
                remaining.pop(best_idx)

        return selected

    def rerank_with_embeddings(
        self,
        query_embedding: List[float],
        items: List[T],
        embeddings: List[List[float]],
        relevance_scores: List[float],
        top_k: int = 5,
        lambda_param: Optional[float] = None,
    ) -> List[Tuple[T, float, float]]:
        """Convenience method to rerank items with separate embeddings.

        Args:
            query_embedding: The query's embedding vector.
            items: List of items to rerank.
            embeddings: Corresponding embeddings for each item.
            relevance_scores: Initial relevance scores for each item.
            top_k: Number of results to return.
            lambda_param: Override default lambda parameter.

        Returns:
            List of (item, relevance_score, mmr_score) tuples.
        """
        if len(items) != len(embeddings) or len(items) != len(relevance_scores):
            raise ValueError("Items, embeddings, and relevance_scores must have same length")

        candidates = [
            ScoredItem(item=item, embedding=emb, relevance_score=score)
            for item, emb, score in zip(items, embeddings, relevance_scores)
        ]

        reranked = self.rerank(query_embedding, candidates, top_k, lambda_param)

        return [
            (item.item, item.relevance_score, item.mmr_score or 0.0)
            for item in reranked
        ]


class DiversityReranker(MMRReranker):
    """Extended MMR reranker with additional diversity strategies."""

    def __init__(
        self,
        lambda_param: float = 0.7,
        doc_type_penalty: float = 0.1,
        same_doc_penalty: float = 0.2,
    ):
        """Initialize with additional diversity penalties.

        Args:
            lambda_param: Base MMR lambda parameter.
            doc_type_penalty: Penalty for same document type.
            same_doc_penalty: Penalty for chunks from same document.
        """
        super().__init__(lambda_param)
        self.doc_type_penalty = doc_type_penalty
        self.same_doc_penalty = same_doc_penalty

    def rerank_with_metadata(
        self,
        query_embedding: List[float],
        candidates: List[ScoredItem[T]],
        doc_ids: List[int],
        doc_types: List[str],
        top_k: int = 5,
        lambda_param: Optional[float] = None,
    ) -> List[ScoredItem[T]]:
        """Rerank with additional metadata-based diversity.

        Applies extra penalties for:
        - Multiple chunks from the same document
        - Multiple results of the same document type

        Args:
            query_embedding: The query's embedding vector.
            candidates: List of candidate items with embeddings.
            doc_ids: Document ID for each candidate.
            doc_types: Document type for each candidate.
            top_k: Number of results to return.
            lambda_param: Override default lambda parameter.

        Returns:
            Reranked list with metadata diversity.
        """
        if not candidates:
            return []

        if len(candidates) != len(doc_ids) or len(candidates) != len(doc_types):
            raise ValueError("Candidates, doc_ids, and doc_types must have same length")

        lambda_val = lambda_param if lambda_param is not None else self.lambda_param

        selected: List[ScoredItem[T]] = []
        selected_doc_ids: List[int] = []
        selected_doc_types: List[str] = []
        remaining = list(enumerate(candidates))

        while len(selected) < top_k and remaining:
            best_score = float('-inf')
            best_item: Optional[ScoredItem[T]] = None
            best_original_idx = -1
            best_remaining_idx = -1

            for remaining_idx, (original_idx, candidate) in enumerate(remaining):
                # Base relevance
                relevance = candidate.relevance_score

                # Embedding diversity (MMR)
                if selected:
                    max_sim_to_selected = max(
                        self.cosine_similarity(candidate.embedding, s.embedding)
                        for s in selected
                    )
                else:
                    max_sim_to_selected = 0.0

                # Metadata diversity penalties
                metadata_penalty = 0.0

                # Penalty for same document
                if doc_ids[original_idx] in selected_doc_ids:
                    metadata_penalty += self.same_doc_penalty

                # Penalty for same document type (scaled by count)
                type_count = selected_doc_types.count(doc_types[original_idx])
                if type_count > 0:
                    metadata_penalty += self.doc_type_penalty * type_count

                # Combined MMR score with metadata penalty
                mmr_score = (
                    (lambda_val * relevance)
                    - ((1 - lambda_val) * max_sim_to_selected)
                    - metadata_penalty
                )

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_item = candidate
                    best_original_idx = original_idx
                    best_remaining_idx = remaining_idx

            if best_item is not None:
                best_item.mmr_score = best_score
                selected.append(best_item)
                selected_doc_ids.append(doc_ids[best_original_idx])
                selected_doc_types.append(doc_types[best_original_idx])
                remaining.pop(best_remaining_idx)

        return selected


class AdaptiveMMRReranker(MMRReranker):
    """MMR reranker that adapts lambda based on result diversity."""

    def __init__(
        self,
        min_lambda: float = 0.5,
        max_lambda: float = 0.9,
        diversity_threshold: float = 0.7,
    ):
        """Initialize adaptive reranker.

        Args:
            min_lambda: Minimum lambda (more diversity).
            max_lambda: Maximum lambda (more relevance).
            diversity_threshold: Similarity threshold for diversity check.
        """
        super().__init__(lambda_param=max_lambda)
        self.min_lambda = min_lambda
        self.max_lambda = max_lambda
        self.diversity_threshold = diversity_threshold

    def compute_adaptive_lambda(
        self,
        candidates: List[ScoredItem[T]],
    ) -> float:
        """Compute lambda based on candidate diversity.

        If candidates are very similar, reduce lambda to increase diversity.
        If candidates are already diverse, increase lambda for relevance.

        Args:
            candidates: List of candidates to analyze.

        Returns:
            Adapted lambda value.
        """
        if len(candidates) < 2:
            return self.max_lambda

        # Calculate average pairwise similarity
        similarities = []
        for i in range(len(candidates)):
            for j in range(i + 1, len(candidates)):
                sim = self.cosine_similarity(
                    candidates[i].embedding,
                    candidates[j].embedding
                )
                similarities.append(sim)

        avg_similarity = sum(similarities) / len(similarities) if similarities else 0

        # If candidates are very similar, use lower lambda (more diversity)
        # If candidates are diverse, use higher lambda (more relevance)
        if avg_similarity > self.diversity_threshold:
            # High similarity - need more diversity
            return self.min_lambda
        else:
            # Calculate proportional lambda
            # Map similarity [0, threshold] to lambda [max, min]
            ratio = avg_similarity / self.diversity_threshold
            return self.max_lambda - (ratio * (self.max_lambda - self.min_lambda))

    def rerank(
        self,
        query_embedding: List[float],
        candidates: List[ScoredItem[T]],
        top_k: int = 5,
        lambda_param: Optional[float] = None,
    ) -> List[ScoredItem[T]]:
        """Rerank with adaptive lambda.

        Args:
            query_embedding: The query's embedding vector.
            candidates: List of candidate items.
            top_k: Number of results to return.
            lambda_param: If provided, overrides adaptive lambda.

        Returns:
            Reranked results.
        """
        if lambda_param is None:
            lambda_param = self.compute_adaptive_lambda(candidates)
            logger.debug(f"Adaptive lambda: {lambda_param:.3f}")

        return super().rerank(query_embedding, candidates, top_k, lambda_param)


# Singleton instances
_mmr_reranker: Optional[MMRReranker] = None
_diversity_reranker: Optional[DiversityReranker] = None
_adaptive_reranker: Optional[AdaptiveMMRReranker] = None


def get_mmr_reranker() -> MMRReranker:
    """Get or create the MMRReranker singleton."""
    global _mmr_reranker
    if _mmr_reranker is None:
        _mmr_reranker = MMRReranker()
    return _mmr_reranker


def get_diversity_reranker() -> DiversityReranker:
    """Get or create the DiversityReranker singleton."""
    global _diversity_reranker
    if _diversity_reranker is None:
        _diversity_reranker = DiversityReranker()
    return _diversity_reranker


def get_adaptive_reranker() -> AdaptiveMMRReranker:
    """Get or create the AdaptiveMMRReranker singleton."""
    global _adaptive_reranker
    if _adaptive_reranker is None:
        _adaptive_reranker = AdaptiveMMRReranker()
    return _adaptive_reranker
