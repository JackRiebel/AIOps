"""Knowledge feedback and query logging service.

Handles:
- Query logging for analytics
- Feedback collection (explicit and implicit)
- Chunk feedback stat aggregation
- Feedback-based retrieval boosting
- Analytics computation
"""

import logging
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select, func, text, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from src.models.knowledge_feedback import (
    DetailedFeedback,
    KnowledgeQueryLog,
    ChunkFeedbackStats,
    FeedbackType,
    ResolutionOutcome,
    FeedbackCreate,
    QueryLogCreate,
    FeedbackStats,
    QueryAnalytics,
    ChunkOutcomeCreate,
)

logger = logging.getLogger(__name__)


class FeedbackService:
    """Service for managing knowledge feedback and query logs."""

    def __init__(self, embedding_service=None):
        """Initialize feedback service.

        Args:
            embedding_service: Optional embedding service for query hashing
        """
        self.embedding_service = embedding_service
        self._stats_update_interval = timedelta(hours=1)
        self._last_stats_update: Optional[datetime] = None

    # =========================================================================
    # Query Logging
    # =========================================================================

    async def log_query(
        self,
        session: AsyncSession,
        query: str,
        retrieved_chunk_ids: List[int],
        chunk_scores: Optional[Dict[int, float]] = None,
        expanded_queries: Optional[List[str]] = None,
        retrieval_strategy: str = "hybrid",
        response_generated: Optional[str] = None,
        response_model: Optional[str] = None,
        citations: Optional[List[dict]] = None,
        embedding_latency_ms: Optional[int] = None,
        retrieval_latency_ms: Optional[int] = None,
        reranking_latency_ms: Optional[int] = None,
        generation_latency_ms: Optional[int] = None,
        total_latency_ms: Optional[int] = None,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        source: str = "search",
        filters: Optional[dict] = None,
        intent: Optional[str] = None,
        entities_extracted: Optional[List[dict]] = None,
        graph_entities_used: Optional[List[int]] = None,
        graph_hops: Optional[int] = None,
    ) -> KnowledgeQueryLog:
        """Log a knowledge query for analytics.

        Args:
            session: Database session
            query: The user's query
            retrieved_chunk_ids: IDs of chunks returned
            chunk_scores: Scores for each chunk
            expanded_queries: Query expansions used
            retrieval_strategy: Strategy used (hybrid, vector, keyword, graph)
            response_generated: AI response if any
            response_model: Model used for generation
            citations: Citation data
            *_latency_ms: Performance metrics
            user_id: Optional user ID
            session_id: Client session ID
            source: Query source (search, chat, api)
            filters: Applied filters
            intent: Classified query intent
            entities_extracted: Entities found in query
            graph_entities_used: Entity IDs used for graph search
            graph_hops: Number of graph hops

        Returns:
            Created query log entry
        """
        # Generate embedding hash for deduplication
        query_hash = hashlib.sha256(query.lower().strip().encode()).hexdigest()[:64]

        log_entry = KnowledgeQueryLog(
            query=query,
            query_embedding_hash=query_hash,
            intent=intent,
            expanded_queries=expanded_queries or [],
            entities_extracted=entities_extracted or [],
            retrieval_strategy=retrieval_strategy,
            retrieved_chunk_ids=retrieved_chunk_ids,
            chunk_scores=chunk_scores or {},
            graph_entities_used=graph_entities_used,
            graph_hops=graph_hops,
            response_generated=response_generated,
            response_model=response_model,
            citations=citations,
            embedding_latency_ms=embedding_latency_ms,
            retrieval_latency_ms=retrieval_latency_ms,
            reranking_latency_ms=reranking_latency_ms,
            generation_latency_ms=generation_latency_ms,
            total_latency_ms=total_latency_ms,
            result_count=len(retrieved_chunk_ids),
            user_id=user_id,
            session_id=session_id,
            source=source,
            filters=filters or {},
        )

        session.add(log_entry)
        await session.flush()

        # Update chunk retrieval stats
        await self._update_retrieval_stats(session, retrieved_chunk_ids)

        logger.debug(f"Logged query: {query[:50]}... (id={log_entry.id})")
        return log_entry

    async def _update_retrieval_stats(
        self,
        session: AsyncSession,
        chunk_ids: List[int],
    ) -> None:
        """Update retrieval counts for chunks."""
        if not chunk_ids:
            return

        for i, chunk_id in enumerate(chunk_ids):
            # Use upsert to create or update stats
            stmt = insert(ChunkFeedbackStats).values(
                chunk_id=chunk_id,
                retrieval_count=1,
                top_3_count=1 if i < 3 else 0,
            ).on_conflict_do_update(
                index_elements=['chunk_id'],
                set_={
                    'retrieval_count': ChunkFeedbackStats.retrieval_count + 1,
                    'top_3_count': ChunkFeedbackStats.top_3_count + (1 if i < 3 else 0),
                    'updated_at': datetime.utcnow(),
                }
            )
            await session.execute(stmt)

    # =========================================================================
    # Feedback Collection
    # =========================================================================

    async def submit_feedback(
        self,
        session: AsyncSession,
        feedback: FeedbackCreate,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> DetailedFeedback:
        """Submit user feedback on search results.

        Args:
            session: Database session
            feedback: Feedback data
            user_id: Optional user ID
            session_id: Client session ID

        Returns:
            Created feedback entry
        """
        # Determine if feedback is positive
        is_positive = None
        if feedback.feedback_type in [FeedbackType.POSITIVE, FeedbackType.HELPFUL]:
            is_positive = True
        elif feedback.feedback_type in [FeedbackType.NEGATIVE, FeedbackType.NOT_HELPFUL, FeedbackType.REPORT]:
            is_positive = False
        elif feedback.feedback_type == FeedbackType.RATING and feedback.rating:
            is_positive = feedback.rating >= 4

        feedback_entry = DetailedFeedback(
            query_log_id=feedback.query_log_id,
            query=feedback.query,
            chunk_ids=feedback.chunk_ids,
            response_text=feedback.response_text,
            feedback_type=feedback.feedback_type.value,
            rating=feedback.rating,
            is_positive=is_positive,
            comment=feedback.comment,
            issues=feedback.issues,
            user_id=user_id,
            session_id=session_id,
            clicked_chunks=feedback.clicked_chunks,
            time_on_result_ms=feedback.time_on_result_ms,
        )

        session.add(feedback_entry)
        await session.flush()

        # Update query log if linked
        if feedback.query_log_id:
            await session.execute(
                text("""
                    UPDATE knowledge_query_logs
                    SET had_feedback = TRUE, feedback_positive = :is_positive
                    WHERE id = :log_id
                """),
                {"is_positive": is_positive, "log_id": feedback.query_log_id}
            )

        # Update chunk feedback stats
        await self._update_chunk_feedback_stats(
            session,
            feedback.chunk_ids,
            is_positive,
            feedback.feedback_type == FeedbackType.REPORT,
            feedback.clicked_chunks,
            feedback.time_on_result_ms,
        )

        logger.info(f"Received {feedback.feedback_type.value} feedback for query: {feedback.query[:50]}...")
        return feedback_entry

    async def _update_chunk_feedback_stats(
        self,
        session: AsyncSession,
        chunk_ids: List[int],
        is_positive: Optional[bool],
        is_report: bool,
        clicked_chunks: List[int],
        time_on_result_ms: Optional[int],
    ) -> None:
        """Update aggregated feedback stats for chunks."""
        if not chunk_ids:
            return

        for chunk_id in chunk_ids:
            # Calculate updates
            positive_delta = 1 if is_positive is True else 0
            negative_delta = 1 if is_positive is False else 0
            report_delta = 1 if is_report else 0

            stmt = insert(ChunkFeedbackStats).values(
                chunk_id=chunk_id,
                positive_count=positive_delta,
                negative_count=negative_delta,
                report_count=report_delta,
            ).on_conflict_do_update(
                index_elements=['chunk_id'],
                set_={
                    'positive_count': ChunkFeedbackStats.positive_count + positive_delta,
                    'negative_count': ChunkFeedbackStats.negative_count + negative_delta,
                    'report_count': ChunkFeedbackStats.report_count + report_delta,
                    'updated_at': datetime.utcnow(),
                }
            )
            await session.execute(stmt)

    async def record_click(
        self,
        session: AsyncSession,
        query_log_id: int,
        chunk_id: int,
        time_on_result_ms: Optional[int] = None,
    ) -> None:
        """Record a click on a search result (implicit feedback).

        Args:
            session: Database session
            query_log_id: Query log entry ID
            chunk_id: Clicked chunk ID
            time_on_result_ms: Time spent viewing result
        """
        # Update existing feedback or create click record
        result = await session.execute(
            select(DetailedFeedback).where(
                DetailedFeedback.query_log_id == query_log_id
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Append to clicked chunks
            clicked = existing.clicked_chunks or []
            if chunk_id not in clicked:
                clicked.append(chunk_id)
                existing.clicked_chunks = clicked
                if time_on_result_ms:
                    existing.time_on_result_ms = (existing.time_on_result_ms or 0) + time_on_result_ms
        else:
            # Get query from log
            log_result = await session.execute(
                select(KnowledgeQueryLog.query).where(KnowledgeQueryLog.id == query_log_id)
            )
            query = log_result.scalar_one_or_none() or ""

            # Create implicit feedback record
            feedback = DetailedFeedback(
                query_log_id=query_log_id,
                query=query,
                chunk_ids=[chunk_id],
                feedback_type="implicit_click",
                clicked_chunks=[chunk_id],
                time_on_result_ms=time_on_result_ms,
            )
            session.add(feedback)

        await session.flush()

    async def record_follow_up(
        self,
        session: AsyncSession,
        original_query_log_id: int,
        follow_up_query: str,
    ) -> None:
        """Record a follow-up query (indicates incomplete answer).

        Args:
            session: Database session
            original_query_log_id: Original query log ID
            follow_up_query: The follow-up question
        """
        result = await session.execute(
            select(DetailedFeedback).where(
                DetailedFeedback.query_log_id == original_query_log_id
            )
        )
        feedback = result.scalar_one_or_none()

        if feedback:
            feedback.follow_up_query = follow_up_query
        else:
            # Get query from log
            log_result = await session.execute(
                select(KnowledgeQueryLog.query).where(KnowledgeQueryLog.id == original_query_log_id)
            )
            query = log_result.scalar_one_or_none() or ""

            feedback = DetailedFeedback(
                query_log_id=original_query_log_id,
                query=query,
                chunk_ids=[],
                feedback_type="follow_up",
                follow_up_query=follow_up_query,
            )
            session.add(feedback)

        await session.flush()

    async def record_chunk_outcome(
        self,
        session: AsyncSession,
        query_log_id: int,
        chunk_outcomes: Dict[int, ResolutionOutcome],
        resolution_notes: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Dict[int, str]:
        """Record resolution outcome for specific chunks.

        This enables fine-grained feedback on whether chunks actually helped
        resolve the user's issue, improving future retrieval through
        resolution-weighted boosting.

        Args:
            session: Database session.
            query_log_id: The query log entry ID.
            chunk_outcomes: Mapping of chunk_id to ResolutionOutcome.
            resolution_notes: Optional notes about the resolution.
            user_id: Optional user ID.

        Returns:
            Dict mapping chunk_id to recorded outcome string.
        """
        recorded = {}

        for chunk_id, outcome in chunk_outcomes.items():
            # Determine column updates based on outcome
            if outcome == ResolutionOutcome.RESOLVED:
                resolution_delta = 1
                partial_delta = 0
                incorrect_delta = 0
                positive_delta = 1  # Also counts as positive
                negative_delta = 0
            elif outcome == ResolutionOutcome.PARTIALLY_HELPFUL:
                resolution_delta = 0
                partial_delta = 1
                incorrect_delta = 0
                positive_delta = 0
                negative_delta = 0
            elif outcome == ResolutionOutcome.UNHELPFUL:
                resolution_delta = 0
                partial_delta = 0
                incorrect_delta = 0
                positive_delta = 0
                negative_delta = 1
            elif outcome == ResolutionOutcome.INCORRECT:
                resolution_delta = 0
                partial_delta = 0
                incorrect_delta = 1
                positive_delta = 0
                negative_delta = 1  # Also counts as negative
            else:
                continue

            # Upsert chunk feedback stats
            stmt = insert(ChunkFeedbackStats).values(
                chunk_id=chunk_id,
                resolution_count=resolution_delta,
                partial_count=partial_delta,
                incorrect_count=incorrect_delta,
                positive_count=positive_delta,
                negative_count=negative_delta,
            ).on_conflict_do_update(
                index_elements=['chunk_id'],
                set_={
                    'resolution_count': ChunkFeedbackStats.resolution_count + resolution_delta,
                    'partial_count': ChunkFeedbackStats.partial_count + partial_delta,
                    'incorrect_count': ChunkFeedbackStats.incorrect_count + incorrect_delta,
                    'positive_count': ChunkFeedbackStats.positive_count + positive_delta,
                    'negative_count': ChunkFeedbackStats.negative_count + negative_delta,
                    'updated_at': datetime.utcnow(),
                }
            )
            await session.execute(stmt)
            recorded[chunk_id] = outcome.value

        # Update resolution rates for affected chunks
        if recorded:
            await self._update_resolution_rates(session, list(recorded.keys()))

        # Also create a detailed feedback entry linking to the query
        if recorded:
            # Get query text from log
            log_result = await session.execute(
                select(KnowledgeQueryLog.query).where(KnowledgeQueryLog.id == query_log_id)
            )
            query_text = log_result.scalar_one_or_none() or ""

            feedback = DetailedFeedback(
                query_log_id=query_log_id,
                query=query_text,
                chunk_ids=list(chunk_outcomes.keys()),
                feedback_type="resolution_outcome",
                comment=resolution_notes,
                user_id=user_id,
                issues=[outcome.value for outcome in chunk_outcomes.values()],
            )
            session.add(feedback)

        await session.commit()

        logger.info(f"Recorded resolution outcomes for {len(recorded)} chunks: {recorded}")
        return recorded

    async def _update_resolution_rates(
        self,
        session: AsyncSession,
        chunk_ids: List[int],
    ) -> None:
        """Update resolution rates for specific chunks.

        Resolution rate = resolution_count / total_outcomes
        where total_outcomes = resolution + partial + negative + incorrect
        """
        if not chunk_ids:
            return

        from datetime import datetime
        # Note: ANY() is PostgreSQL-specific - this needs adjustment for SQLite
        # For now, skip if we detect SQLite to avoid errors
        try:
            await session.execute(
                text("""
                    UPDATE chunk_feedback_stats
                    SET resolution_rate = CASE
                        WHEN (resolution_count + partial_count + negative_count + incorrect_count) = 0 THEN NULL
                        ELSE CAST(resolution_count AS FLOAT) /
                             (resolution_count + partial_count + negative_count + incorrect_count)
                    END,
                    updated_at = :now
                    WHERE chunk_id = ANY(:chunk_ids)
                """),
                {"chunk_ids": chunk_ids, "now": datetime.utcnow()}
            )
        except Exception:
            # SQLite doesn't support ANY() - skip this update
            pass

    # =========================================================================
    # Feedback Stats & Boosting
    # =========================================================================

    async def recompute_helpfulness_scores(
        self,
        session: AsyncSession,
    ) -> int:
        """Recompute helpfulness scores for all chunks.

        Uses Wilson score interval for statistical significance:
        score = (p + z²/(2n) - z*sqrt((p*(1-p) + z²/(4n))/n)) / (1 + z²/n)

        Where:
        - p = positive ratio
        - n = total feedback count
        - z = 1.96 (95% confidence)

        Returns:
            Number of chunks updated
        """
        z = 1.96  # 95% confidence
        from datetime import datetime as dt

        result = await session.execute(
            text("""
                UPDATE chunk_feedback_stats
                SET helpfulness_score = CASE
                    WHEN positive_count + negative_count = 0 THEN 0.5
                    ELSE (
                        CAST(positive_count AS FLOAT) / (positive_count + negative_count)
                        + :z_sq / (2 * (positive_count + negative_count))
                        - :z * SQRT(
                            (
                                (CAST(positive_count AS FLOAT) / (positive_count + negative_count))
                                * (1 - CAST(positive_count AS FLOAT) / (positive_count + negative_count))
                                + :z_sq / (4 * (positive_count + negative_count))
                            ) / (positive_count + negative_count)
                        )
                    ) / (1 + :z_sq / (positive_count + negative_count))
                END,
                updated_at = :now
                WHERE positive_count > 0 OR negative_count > 0
            """),
            {"z": z, "z_sq": z * z, "now": dt.utcnow()}
        )

        self._last_stats_update = datetime.utcnow()
        return result.rowcount

    async def get_chunk_boosts(
        self,
        session: AsyncSession,
        chunk_ids: List[int],
    ) -> Dict[int, float]:
        """Get feedback-based boost factors for chunks.

        Boost factor ranges from 0.3 (bad feedback + incorrect) to 1.7 (resolved + good feedback).

        The boost calculation incorporates:
        - Base helpfulness score (Wilson score interval)
        - Resolution bonus (chunks that led to resolution get extra boost)
        - Incorrect penalty (chunks that led to wrong direction get penalty)
        - Report penalty (reported content gets penalized)

        Args:
            session: Database session
            chunk_ids: Chunk IDs to get boosts for

        Returns:
            Dict mapping chunk_id to boost factor
        """
        if not chunk_ids:
            return {}

        result = await session.execute(
            select(
                ChunkFeedbackStats.chunk_id,
                ChunkFeedbackStats.helpfulness_score,
                ChunkFeedbackStats.report_count,
                ChunkFeedbackStats.resolution_count,
                ChunkFeedbackStats.partial_count,
                ChunkFeedbackStats.incorrect_count,
            ).where(ChunkFeedbackStats.chunk_id.in_(chunk_ids))
        )

        boosts = {}
        for row in result:
            chunk_id, score, report_count, resolution_count, partial_count, incorrect_count = row

            # Ensure defaults for nullable columns
            score = score or 0.5
            resolution_count = resolution_count or 0
            partial_count = partial_count or 0
            incorrect_count = incorrect_count or 0
            report_count = report_count or 0

            # Base boost from helpfulness (0.5 = neutral)
            base_boost = 0.5 + score  # Range: 0.5 to 1.5

            # Resolution bonus (up to +0.2 for high resolution rate)
            total_outcomes = resolution_count + partial_count + incorrect_count
            if total_outcomes > 0:
                resolution_rate = resolution_count / total_outcomes
                resolution_bonus = resolution_rate * 0.2  # Up to 0.2 bonus
            else:
                resolution_bonus = 0

            # Incorrect penalty (up to -0.3 for repeatedly incorrect chunks)
            if incorrect_count > 0:
                # Penalize more severely as incorrect count increases
                incorrect_penalty = min(0.3, incorrect_count * 0.1)
            else:
                incorrect_penalty = 0

            # Report penalty
            if report_count > 0:
                report_penalty = min(0.2, report_count * 0.05)
            else:
                report_penalty = 0

            # Final boost: combine all factors
            # Range: 0.3 (heavily penalized) to 1.7 (excellent resolution track record)
            boost = base_boost + resolution_bonus - incorrect_penalty - report_penalty
            boost = max(0.3, min(1.7, boost))

            boosts[chunk_id] = boost

        # Default boost for chunks without feedback
        for chunk_id in chunk_ids:
            if chunk_id not in boosts:
                boosts[chunk_id] = 1.0

        return boosts

    async def apply_feedback_boosts(
        self,
        session: AsyncSession,
        chunk_scores: Dict[int, float],
        boost_weight: float = 0.2,
    ) -> Dict[int, float]:
        """Apply feedback boosts to chunk scores.

        Args:
            session: Database session
            chunk_scores: Original chunk scores {chunk_id: score}
            boost_weight: How much to weight feedback (0-1)

        Returns:
            Adjusted scores
        """
        if not chunk_scores:
            return {}

        boosts = await self.get_chunk_boosts(session, list(chunk_scores.keys()))

        adjusted = {}
        for chunk_id, score in chunk_scores.items():
            boost = boosts.get(chunk_id, 1.0)
            # Blend original score with boost
            adjusted[chunk_id] = score * (1 - boost_weight) + score * boost * boost_weight

        return adjusted

    # =========================================================================
    # Analytics
    # =========================================================================

    async def get_feedback_stats(
        self,
        session: AsyncSession,
        days: int = 30,
        user_id: Optional[int] = None,
    ) -> FeedbackStats:
        """Get aggregated feedback statistics.

        Args:
            session: Database session
            days: Number of days to include
            user_id: Optional user filter

        Returns:
            Aggregated feedback stats
        """
        since = datetime.utcnow() - timedelta(days=days)

        # Base conditions
        conditions = [KnowledgeQueryLog.created_at >= since]
        if user_id:
            conditions.append(KnowledgeQueryLog.user_id == user_id)

        # Total queries
        total_result = await session.execute(
            select(func.count(KnowledgeQueryLog.id)).where(*conditions)
        )
        total_queries = total_result.scalar() or 0

        # Queries with feedback
        feedback_result = await session.execute(
            select(func.count(KnowledgeQueryLog.id)).where(
                *conditions,
                KnowledgeQueryLog.had_feedback == True
            )
        )
        queries_with_feedback = feedback_result.scalar() or 0

        # Positive rate
        positive_result = await session.execute(
            select(func.count(KnowledgeQueryLog.id)).where(
                *conditions,
                KnowledgeQueryLog.feedback_positive == True
            )
        )
        positive_count = positive_result.scalar() or 0
        positive_rate = positive_count / queries_with_feedback if queries_with_feedback > 0 else 0

        # Average rating
        feedback_conditions = [DetailedFeedback.created_at >= since]
        if user_id:
            feedback_conditions.append(DetailedFeedback.user_id == user_id)

        avg_result = await session.execute(
            select(func.avg(DetailedFeedback.rating)).where(
                *feedback_conditions,
                DetailedFeedback.rating.isnot(None)
            )
        )
        avg_rating = avg_result.scalar()

        # Average latency
        latency_result = await session.execute(
            select(func.avg(KnowledgeQueryLog.total_latency_ms)).where(*conditions)
        )
        avg_latency = latency_result.scalar() or 0

        # Top issues
        issues_result = await session.execute(
            text("""
                SELECT issue, COUNT(*) as count
                FROM knowledge_feedback, jsonb_array_elements_text(issues) as issue
                WHERE created_at >= :since
                GROUP BY issue
                ORDER BY count DESC
                LIMIT 5
            """),
            {"since": since}
        )
        top_issues = [{"issue": row[0], "count": row[1]} for row in issues_result]

        # Feedback by type
        type_result = await session.execute(
            select(
                DetailedFeedback.feedback_type,
                func.count(DetailedFeedback.id)
            ).where(*feedback_conditions).group_by(DetailedFeedback.feedback_type)
        )
        feedback_by_type = {row[0]: row[1] for row in type_result}

        return FeedbackStats(
            total_queries=total_queries,
            queries_with_feedback=queries_with_feedback,
            positive_feedback_rate=positive_rate,
            avg_rating=float(avg_rating) if avg_rating else None,
            avg_latency_ms=float(avg_latency),
            top_issues=top_issues,
            feedback_by_type=feedback_by_type,
        )

    async def get_query_analytics(
        self,
        session: AsyncSession,
        days: int = 30,
    ) -> QueryAnalytics:
        """Get query analytics summary.

        Args:
            session: Database session
            days: Number of days to include

        Returns:
            Query analytics data
        """
        since = datetime.utcnow() - timedelta(days=days)

        # Total and unique queries
        result = await session.execute(
            select(
                func.count(KnowledgeQueryLog.id),
                func.count(func.distinct(KnowledgeQueryLog.query_embedding_hash))
            ).where(KnowledgeQueryLog.created_at >= since)
        )
        row = result.one()
        total_queries = row[0] or 0
        unique_queries = row[1] or 0

        # Latency stats
        latency_result = await session.execute(
            select(
                func.avg(KnowledgeQueryLog.total_latency_ms),
                func.percentile_cont(0.95).within_group(KnowledgeQueryLog.total_latency_ms)
            ).where(
                KnowledgeQueryLog.created_at >= since,
                KnowledgeQueryLog.total_latency_ms.isnot(None)
            )
        )
        latency_row = latency_result.one()
        avg_latency = latency_row[0] or 0
        p95_latency = latency_row[1] or 0

        # Queries per day
        daily_result = await session.execute(
            text("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM knowledge_query_logs
                WHERE created_at >= :since
                GROUP BY DATE(created_at)
                ORDER BY date
            """),
            {"since": since}
        )
        queries_per_day = [
            {"date": str(row[0]), "count": row[1]}
            for row in daily_result
        ]

        # Top queries
        top_result = await session.execute(
            text("""
                SELECT query, COUNT(*) as count
                FROM knowledge_query_logs
                WHERE created_at >= :since
                GROUP BY query_embedding_hash, query
                ORDER BY count DESC
                LIMIT 10
            """),
            {"since": since}
        )
        top_queries = [
            {"query": row[0], "count": row[1]}
            for row in top_result
        ]

        # Intent distribution
        intent_result = await session.execute(
            select(
                KnowledgeQueryLog.intent,
                func.count(KnowledgeQueryLog.id)
            ).where(
                KnowledgeQueryLog.created_at >= since,
                KnowledgeQueryLog.intent.isnot(None)
            ).group_by(KnowledgeQueryLog.intent)
        )
        intent_distribution = {row[0]: row[1] for row in intent_result}

        # Zero result rate
        zero_result = await session.execute(
            select(func.count(KnowledgeQueryLog.id)).where(
                KnowledgeQueryLog.created_at >= since,
                KnowledgeQueryLog.result_count == 0
            )
        )
        zero_count = zero_result.scalar() or 0
        zero_rate = zero_count / total_queries if total_queries > 0 else 0

        return QueryAnalytics(
            total_queries=total_queries,
            unique_queries=unique_queries,
            avg_latency_ms=float(avg_latency),
            p95_latency_ms=float(p95_latency),
            queries_per_day=queries_per_day,
            top_queries=top_queries,
            intent_distribution=intent_distribution,
            zero_result_rate=zero_rate,
        )

    async def get_problematic_queries(
        self,
        session: AsyncSession,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Get queries with negative feedback or no results.

        Useful for identifying gaps in the knowledge base.

        Args:
            session: Database session
            limit: Max results

        Returns:
            List of problematic queries with details
        """
        from datetime import datetime, timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        result = await session.execute(
            text("""
                SELECT
                    query,
                    COUNT(*) as occurrence_count,
                    SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) as zero_result_count,
                    SUM(CASE WHEN feedback_positive = FALSE THEN 1 ELSE 0 END) as negative_feedback_count,
                    AVG(total_latency_ms) as avg_latency_ms
                FROM knowledge_query_logs
                WHERE created_at >= :cutoff_date
                GROUP BY query_embedding_hash, query
                HAVING
                    SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) > 0
                    OR SUM(CASE WHEN feedback_positive = FALSE THEN 1 ELSE 0 END) > 0
                ORDER BY
                    negative_feedback_count DESC,
                    zero_result_count DESC,
                    occurrence_count DESC
                LIMIT :limit
            """),
            {"limit": limit, "cutoff_date": cutoff_date}
        )

        return [
            {
                "query": row[0],
                "occurrence_count": row[1],
                "zero_result_count": row[2],
                "negative_feedback_count": row[3],
                "avg_latency_ms": float(row[4]) if row[4] else None,
            }
            for row in result
        ]

    async def get_top_performing_chunks(
        self,
        session: AsyncSession,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Get chunks with best feedback scores.

        Args:
            session: Database session
            limit: Max results

        Returns:
            List of top chunks with stats
        """
        result = await session.execute(
            select(
                ChunkFeedbackStats.chunk_id,
                ChunkFeedbackStats.helpfulness_score,
                ChunkFeedbackStats.positive_count,
                ChunkFeedbackStats.negative_count,
                ChunkFeedbackStats.retrieval_count,
                ChunkFeedbackStats.click_through_rate,
            ).where(
                ChunkFeedbackStats.retrieval_count >= 5  # Minimum retrievals
            ).order_by(
                ChunkFeedbackStats.helpfulness_score.desc()
            ).limit(limit)
        )

        return [
            {
                "chunk_id": row[0],
                "helpfulness_score": row[1],
                "positive_count": row[2],
                "negative_count": row[3],
                "retrieval_count": row[4],
                "click_through_rate": row[5],
            }
            for row in result
        ]
