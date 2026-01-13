"""Knowledge Base analytics service.

Provides comprehensive analytics for:
- Usage Metrics: Query patterns, popular searches, conversion rates
- Quality Metrics: Feedback scores, answer accuracy, response times
- Content Metrics: Document coverage, staleness, gaps

Used by the admin dashboard to monitor knowledge base health.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, func, text, and_, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from src.services.knowledge_cache import get_knowledge_cache

logger = logging.getLogger(__name__)


# =============================================================================
# Analytics Models
# =============================================================================

class UsageMetrics(BaseModel):
    """Usage analytics for the knowledge base."""
    total_queries: int = 0
    unique_queries: int = 0
    queries_today: int = 0
    queries_this_week: int = 0
    queries_this_month: int = 0
    queries_per_day: List[Dict[str, Any]] = Field(default_factory=list)
    top_queries: List[Dict[str, Any]] = Field(default_factory=list)
    search_to_answer_rate: float = 0.0  # Queries that got AI response
    avg_results_per_query: float = 0.0
    zero_result_rate: float = 0.0


class QualityMetrics(BaseModel):
    """Quality analytics for search and responses."""
    avg_feedback_rating: Optional[float] = None
    positive_feedback_rate: float = 0.0
    negative_feedback_rate: float = 0.0
    feedback_count: int = 0
    avg_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    top_issues: List[Dict[str, Any]] = Field(default_factory=list)
    queries_needing_attention: int = 0


class ContentMetrics(BaseModel):
    """Content coverage analytics."""
    total_documents: int = 0
    total_chunks: int = 0
    documents_by_type: Dict[str, int] = Field(default_factory=dict)
    documents_by_source: Dict[str, int] = Field(default_factory=dict)
    recently_added: int = 0  # Last 7 days
    stale_documents: int = 0  # Not accessed in 30+ days
    avg_chunks_per_doc: float = 0.0
    coverage_gaps: List[Dict[str, Any]] = Field(default_factory=list)


class EntityMetrics(BaseModel):
    """Knowledge graph entity analytics."""
    total_entities: int = 0
    entities_by_type: Dict[str, int] = Field(default_factory=dict)
    total_relationships: int = 0
    relationships_by_type: Dict[str, int] = Field(default_factory=dict)
    most_connected_entities: List[Dict[str, Any]] = Field(default_factory=list)


class CacheMetrics(BaseModel):
    """Cache performance metrics."""
    memory_size: int = 0
    memory_bytes: int = 0
    redis_available: bool = False
    hit_rate: float = 0.0
    total_hits: int = 0
    total_misses: int = 0
    by_type: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class KnowledgeAnalytics(BaseModel):
    """Complete analytics summary."""
    usage: UsageMetrics
    quality: QualityMetrics
    content: ContentMetrics
    entities: EntityMetrics
    cache: CacheMetrics
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# Analytics Service
# =============================================================================

class KnowledgeAnalyticsService:
    """Service for computing knowledge base analytics."""

    def __init__(self):
        """Initialize analytics service."""
        self._cache = None

    @property
    def cache(self):
        """Get knowledge cache for cache metrics."""
        if self._cache is None:
            self._cache = get_knowledge_cache()
        return self._cache

    async def get_full_analytics(
        self,
        session: AsyncSession,
        days: int = 30,
    ) -> KnowledgeAnalytics:
        """Get complete analytics summary.

        Args:
            session: Database session.
            days: Number of days for time-based metrics.

        Returns:
            Complete analytics data.
        """
        usage = await self.get_usage_metrics(session, days)
        quality = await self.get_quality_metrics(session, days)
        content = await self.get_content_metrics(session)
        entities = await self.get_entity_metrics(session)
        cache = self.get_cache_metrics()

        return KnowledgeAnalytics(
            usage=usage,
            quality=quality,
            content=content,
            entities=entities,
            cache=cache,
        )

    # =========================================================================
    # Usage Metrics
    # =========================================================================

    async def get_usage_metrics(
        self,
        session: AsyncSession,
        days: int = 30,
    ) -> UsageMetrics:
        """Get usage analytics.

        Args:
            session: Database session.
            days: Number of days for historical data.

        Returns:
            Usage metrics.
        """
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        since = now - timedelta(days=days)

        # Total and unique queries
        result = await session.execute(
            text("""
                SELECT
                    COUNT(*) as total,
                    COUNT(DISTINCT query_embedding_hash) as unique_queries,
                    COUNT(*) FILTER (WHERE created_at >= :today) as today,
                    COUNT(*) FILTER (WHERE created_at >= :week_ago) as this_week,
                    COUNT(*) FILTER (WHERE created_at >= :month_ago) as this_month,
                    COUNT(*) FILTER (WHERE response_generated IS NOT NULL) as with_response,
                    AVG(result_count) as avg_results,
                    COUNT(*) FILTER (WHERE result_count = 0) as zero_results
                FROM knowledge_query_logs
                WHERE created_at >= :since
            """),
            {
                "today": today,
                "week_ago": week_ago,
                "month_ago": month_ago,
                "since": since,
            }
        )
        row = result.one()

        total = row[0] or 0
        search_to_answer = row[5] / total if total > 0 else 0
        zero_rate = row[7] / total if total > 0 else 0

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
            {"date": str(r[0]), "count": r[1]}
            for r in daily_result
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
            {"query": r[0], "count": r[1]}
            for r in top_result
        ]

        return UsageMetrics(
            total_queries=total,
            unique_queries=row[1] or 0,
            queries_today=row[2] or 0,
            queries_this_week=row[3] or 0,
            queries_this_month=row[4] or 0,
            queries_per_day=queries_per_day,
            top_queries=top_queries,
            search_to_answer_rate=round(search_to_answer * 100, 2),
            avg_results_per_query=round(row[6] or 0, 2),
            zero_result_rate=round(zero_rate * 100, 2),
        )

    # =========================================================================
    # Quality Metrics
    # =========================================================================

    async def get_quality_metrics(
        self,
        session: AsyncSession,
        days: int = 30,
    ) -> QualityMetrics:
        """Get quality analytics.

        Args:
            session: Database session.
            days: Number of days for historical data.

        Returns:
            Quality metrics.
        """
        since = datetime.utcnow() - timedelta(days=days)

        # Feedback metrics
        feedback_result = await session.execute(
            text("""
                SELECT
                    AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive' OR (rating IS NOT NULL AND rating >= 4)) as positive,
                    COUNT(*) FILTER (WHERE feedback_type = 'negative' OR (rating IS NOT NULL AND rating <= 2)) as negative,
                    COUNT(*) as total
                FROM knowledge_feedback
                WHERE created_at >= :since
            """),
            {"since": since}
        )
        fb_row = feedback_result.one()

        total_feedback = fb_row[3] or 0
        positive_rate = (fb_row[1] or 0) / total_feedback if total_feedback > 0 else 0
        negative_rate = (fb_row[2] or 0) / total_feedback if total_feedback > 0 else 0

        # Latency percentiles
        latency_result = await session.execute(
            text("""
                SELECT
                    AVG(total_latency_ms) as avg,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_latency_ms) as p50,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_latency_ms) as p99
                FROM knowledge_query_logs
                WHERE created_at >= :since AND total_latency_ms IS NOT NULL
            """),
            {"since": since}
        )
        lat_row = latency_result.one()

        # Top issues from feedback (using feedback_metadata->>'issues' if available)
        try:
            issues_result = await session.execute(
                text("""
                    SELECT issue, COUNT(*) as count
                    FROM knowledge_feedback,
                         jsonb_array_elements_text(feedback_metadata->'issues') as issue
                    WHERE created_at >= :since
                      AND feedback_metadata->'issues' IS NOT NULL
                    GROUP BY issue
                    ORDER BY count DESC
                    LIMIT 5
                """),
                {"since": since}
            )
            top_issues = [
                {"issue": r[0], "count": r[1]}
                for r in issues_result
            ]
        except Exception:
            top_issues = []

        # Queries needing attention
        attention_result = await session.execute(
            text("""
                SELECT COUNT(DISTINCT query_embedding_hash)
                FROM knowledge_query_logs
                WHERE created_at >= :since
                  AND (result_count = 0 OR feedback_positive = FALSE)
            """),
            {"since": since}
        )
        needs_attention = attention_result.scalar() or 0

        return QualityMetrics(
            avg_feedback_rating=round(float(fb_row[0]), 2) if fb_row[0] else None,
            positive_feedback_rate=round(positive_rate * 100, 2),
            negative_feedback_rate=round(negative_rate * 100, 2),
            feedback_count=total_feedback,
            avg_latency_ms=round(float(lat_row[0] or 0), 2),
            p50_latency_ms=round(float(lat_row[1] or 0), 2),
            p95_latency_ms=round(float(lat_row[2] or 0), 2),
            p99_latency_ms=round(float(lat_row[3] or 0), 2),
            top_issues=top_issues,
            queries_needing_attention=needs_attention,
        )

    # =========================================================================
    # Content Metrics
    # =========================================================================

    async def get_content_metrics(
        self,
        session: AsyncSession,
    ) -> ContentMetrics:
        """Get content coverage analytics.

        Args:
            session: Database session.

        Returns:
            Content metrics.
        """
        week_ago = datetime.utcnow() - timedelta(days=7)
        month_ago = datetime.utcnow() - timedelta(days=30)

        # Document counts
        doc_result = await session.execute(
            text("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE created_at >= :week_ago) as recent
                FROM knowledge_documents
            """),
            {"week_ago": week_ago}
        )
        doc_row = doc_result.one()

        # Chunk count and average
        chunk_result = await session.execute(
            text("""
                SELECT COUNT(*), AVG(chunk_count)
                FROM (
                    SELECT document_id, COUNT(*) as chunk_count
                    FROM knowledge_chunks
                    GROUP BY document_id
                ) subq
            """)
        )
        chunk_row = chunk_result.one()

        # Documents by type
        type_result = await session.execute(
            text("""
                SELECT doc_type, COUNT(*) as count
                FROM knowledge_documents
                GROUP BY doc_type
                ORDER BY count DESC
            """)
        )
        by_type = {r[0]: r[1] for r in type_result}

        # Documents by source (using doc_type as source)
        source_result = await session.execute(
            text("""
                SELECT doc_type, COUNT(*) as count
                FROM knowledge_documents
                GROUP BY doc_type
                ORDER BY count DESC
            """)
        )
        by_source = {r[0] or "unknown": r[1] for r in source_result}

        # Stale documents (chunks not retrieved in 30+ days)
        stale_result = await session.execute(
            text("""
                SELECT COUNT(DISTINCT kd.id)
                FROM knowledge_documents kd
                LEFT JOIN knowledge_chunks kc ON kd.id = kc.document_id
                LEFT JOIN chunk_feedback_stats cfs ON kc.id = cfs.chunk_id
                WHERE cfs.updated_at IS NULL
                   OR cfs.updated_at < :month_ago
            """),
            {"month_ago": month_ago}
        )
        stale_count = stale_result.scalar() or 0

        # Coverage gaps (queries with no results)
        gaps_result = await session.execute(
            text("""
                SELECT query, COUNT(*) as count
                FROM knowledge_query_logs
                WHERE result_count = 0
                  AND created_at >= :month_ago
                GROUP BY query_embedding_hash, query
                ORDER BY count DESC
                LIMIT 10
            """),
            {"month_ago": month_ago}
        )
        coverage_gaps = [
            {"query": r[0], "count": r[1]}
            for r in gaps_result
        ]

        return ContentMetrics(
            total_documents=doc_row[0] or 0,
            total_chunks=chunk_row[0] or 0,
            documents_by_type=by_type,
            documents_by_source=by_source,
            recently_added=doc_row[1] or 0,
            stale_documents=stale_count,
            avg_chunks_per_doc=round(float(chunk_row[1] or 0), 2),
            coverage_gaps=coverage_gaps,
        )

    # =========================================================================
    # Entity Metrics
    # =========================================================================

    async def get_entity_metrics(
        self,
        session: AsyncSession,
    ) -> EntityMetrics:
        """Get knowledge graph entity analytics.

        Args:
            session: Database session.

        Returns:
            Entity metrics.
        """
        # Entity counts by type
        entity_result = await session.execute(
            text("""
                SELECT entity_type, COUNT(*) as count
                FROM knowledge_entities
                GROUP BY entity_type
                ORDER BY count DESC
            """)
        )
        by_type = {r[0]: r[1] for r in entity_result}
        total_entities = sum(by_type.values())

        # Relationship counts by type
        rel_result = await session.execute(
            text("""
                SELECT relationship_type, COUNT(*) as count
                FROM knowledge_relationships
                GROUP BY relationship_type
                ORDER BY count DESC
            """)
        )
        rel_by_type = {r[0]: r[1] for r in rel_result}
        total_relationships = sum(rel_by_type.values())

        # Most connected entities
        connected_result = await session.execute(
            text("""
                SELECT ke.name, ke.entity_type,
                       COUNT(DISTINCT kr1.id) + COUNT(DISTINCT kr2.id) as connections
                FROM knowledge_entities ke
                LEFT JOIN knowledge_relationships kr1 ON ke.id = kr1.source_entity_id
                LEFT JOIN knowledge_relationships kr2 ON ke.id = kr2.target_entity_id
                GROUP BY ke.id, ke.name, ke.entity_type
                ORDER BY connections DESC
                LIMIT 10
            """)
        )
        most_connected = [
            {"name": r[0], "type": r[1], "connections": r[2]}
            for r in connected_result
        ]

        return EntityMetrics(
            total_entities=total_entities,
            entities_by_type=by_type,
            total_relationships=total_relationships,
            relationships_by_type=rel_by_type,
            most_connected_entities=most_connected,
        )

    # =========================================================================
    # Cache Metrics
    # =========================================================================

    def get_cache_metrics(self) -> CacheMetrics:
        """Get cache performance metrics.

        Returns:
            Cache metrics.
        """
        try:
            stats = self.cache.get_stats()
            return CacheMetrics(
                memory_size=stats["memory_cache"]["size"],
                memory_bytes=stats["memory_cache"]["total_bytes"],
                redis_available=stats["redis_available"],
                hit_rate=stats["total"]["hit_rate"],
                total_hits=stats["total"]["hits"],
                total_misses=stats["total"]["misses"],
                by_type=stats["by_type"],
            )
        except Exception as e:
            logger.warning(f"Failed to get cache metrics: {e}")
            return CacheMetrics()

    # =========================================================================
    # Trend Analysis
    # =========================================================================

    async def get_usage_trend(
        self,
        session: AsyncSession,
        days: int = 30,
        granularity: str = "day",
    ) -> List[Dict[str, Any]]:
        """Get usage trend over time.

        Args:
            session: Database session.
            days: Number of days to include.
            granularity: 'hour', 'day', or 'week'.

        Returns:
            List of data points with timestamp and count.
        """
        since = datetime.utcnow() - timedelta(days=days)

        if granularity == "hour":
            trunc = "hour"
        elif granularity == "week":
            trunc = "week"
        else:
            trunc = "day"

        result = await session.execute(
            text(f"""
                SELECT date_trunc(:trunc, created_at) as period, COUNT(*) as count
                FROM knowledge_query_logs
                WHERE created_at >= :since
                GROUP BY period
                ORDER BY period
            """),
            {"trunc": trunc, "since": since}
        )

        return [
            {"period": str(r[0]), "count": r[1]}
            for r in result
        ]

    async def get_quality_trend(
        self,
        session: AsyncSession,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """Get quality metrics trend over time.

        Args:
            session: Database session.
            days: Number of days to include.

        Returns:
            List of daily quality data points.
        """
        since = datetime.utcnow() - timedelta(days=days)

        result = await session.execute(
            text("""
                SELECT
                    DATE(created_at) as date,
                    AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive' OR (rating IS NOT NULL AND rating >= 4))::float /
                        NULLIF(COUNT(*), 0) * 100 as positive_rate
                FROM knowledge_feedback
                WHERE created_at >= :since
                GROUP BY DATE(created_at)
                ORDER BY date
            """),
            {"since": since}
        )

        return [
            {
                "date": str(r[0]),
                "avg_rating": round(float(r[1]), 2) if r[1] else None,
                "positive_rate": round(float(r[2]), 2) if r[2] else 0,
            }
            for r in result
        ]


# Singleton instance
_analytics_service: Optional[KnowledgeAnalyticsService] = None


def get_knowledge_analytics_service() -> KnowledgeAnalyticsService:
    """Get or create analytics service singleton."""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = KnowledgeAnalyticsService()
    return _analytics_service
