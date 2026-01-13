"""Knowledge analytics API routes.

Provides endpoints for:
- Full analytics dashboard data
- Usage metrics and trends
- Quality metrics
- Content coverage analysis
- Cache performance
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_db_session, get_current_user_from_session
from src.services.knowledge_analytics_service import (
    get_knowledge_analytics_service,
    KnowledgeAnalytics,
    UsageMetrics,
    QualityMetrics,
    ContentMetrics,
    EntityMetrics,
    CacheMetrics,
)
from src.services.knowledge_cache import get_knowledge_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/knowledge/analytics", tags=["knowledge-analytics"])


def require_admin(current_user) -> None:
    """Require admin role for analytics access."""
    role = getattr(current_user, 'role', None) or (current_user.get("role") if isinstance(current_user, dict) else None)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


# =============================================================================
# Full Analytics
# =============================================================================

@router.get("", response_model=KnowledgeAnalytics)
async def get_full_analytics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get complete analytics dashboard data.

    Admin only - provides full visibility into knowledge base performance.

    Args:
        days: Number of days for time-based metrics (default 30).
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Complete analytics including usage, quality, content, and cache metrics.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        analytics = await service.get_full_analytics(session=db, days=days)
        return analytics

    except Exception as e:
        logger.error(f"Error getting analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")


# =============================================================================
# Usage Metrics
# =============================================================================

@router.get("/usage", response_model=UsageMetrics)
async def get_usage_metrics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get usage analytics.

    Admin only - query counts, trends, and patterns.

    Args:
        days: Number of days for historical data.
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Usage metrics including query counts, top queries, and trends.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        metrics = await service.get_usage_metrics(session=db, days=days)
        return metrics

    except Exception as e:
        logger.error(f"Error getting usage metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get usage metrics")


@router.get("/usage/trend")
async def get_usage_trend(
    days: int = Query(default=30, ge=1, le=365),
    granularity: str = Query(default="day", regex="^(hour|day|week)$"),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get usage trend over time.

    Admin only - query volume by time period.

    Args:
        days: Number of days to include.
        granularity: Time granularity ('hour', 'day', 'week').
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        List of data points with period and count.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        trend = await service.get_usage_trend(
            session=db,
            days=days,
            granularity=granularity,
        )
        return {"trend": trend}

    except Exception as e:
        logger.error(f"Error getting usage trend: {e}")
        raise HTTPException(status_code=500, detail="Failed to get usage trend")


# =============================================================================
# Quality Metrics
# =============================================================================

@router.get("/quality", response_model=QualityMetrics)
async def get_quality_metrics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get quality analytics.

    Admin only - feedback scores, latency, and issues.

    Args:
        days: Number of days for historical data.
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Quality metrics including feedback rates, latency percentiles, and issues.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        metrics = await service.get_quality_metrics(session=db, days=days)
        return metrics

    except Exception as e:
        logger.error(f"Error getting quality metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get quality metrics")


@router.get("/quality/trend")
async def get_quality_trend(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get quality metrics trend over time.

    Admin only - feedback scores and positive rates by day.

    Args:
        days: Number of days to include.
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        List of daily quality data points.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        trend = await service.get_quality_trend(session=db, days=days)
        return {"trend": trend}

    except Exception as e:
        logger.error(f"Error getting quality trend: {e}")
        raise HTTPException(status_code=500, detail="Failed to get quality trend")


# =============================================================================
# Content Metrics
# =============================================================================

@router.get("/content", response_model=ContentMetrics)
async def get_content_metrics(
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get content coverage analytics.

    Admin only - document counts, types, and gaps.

    Args:
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Content metrics including document counts, types, and coverage gaps.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        metrics = await service.get_content_metrics(session=db)
        return metrics

    except Exception as e:
        logger.error(f"Error getting content metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get content metrics")


# =============================================================================
# Entity Metrics
# =============================================================================

@router.get("/entities", response_model=EntityMetrics)
async def get_entity_metrics(
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get knowledge graph entity analytics.

    Admin only - entity and relationship counts.

    Args:
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Entity metrics including counts by type and most connected entities.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        metrics = await service.get_entity_metrics(session=db)
        return metrics

    except Exception as e:
        logger.error(f"Error getting entity metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get entity metrics")


# =============================================================================
# Cache Metrics
# =============================================================================

@router.get("/cache", response_model=CacheMetrics)
async def get_cache_metrics(
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get cache performance metrics.

    Admin only - hit rates, sizes, and Redis status.

    Args:
        current_user: Authenticated user (must be admin).

    Returns:
        Cache metrics including hit rate and size by type.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        metrics = service.get_cache_metrics()
        return metrics

    except Exception as e:
        logger.error(f"Error getting cache metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cache metrics")


@router.post("/cache/invalidate")
async def invalidate_cache(
    cache_type: Optional[str] = Query(default=None, regex="^(embedding|search|response)$"),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Invalidate cache entries.

    Admin only - clear cache to force fresh results.

    Args:
        cache_type: Type to invalidate ('embedding', 'search', 'response'),
                   or None to clear all.
        current_user: Authenticated user (must be admin).

    Returns:
        Number of entries invalidated.
    """
    require_admin(current_user)

    try:
        from src.services.knowledge_cache import CacheType
        cache = get_knowledge_cache()

        ct = None
        if cache_type:
            ct = CacheType(cache_type)

        count = await cache.invalidate(ct)

        return {
            "success": True,
            "invalidated": count,
            "cache_type": cache_type or "all",
        }

    except Exception as e:
        logger.error(f"Error invalidating cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to invalidate cache")


# =============================================================================
# Summary Endpoint (for dashboard cards)
# =============================================================================

@router.get("/summary")
async def get_analytics_summary(
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get analytics summary for dashboard cards.

    Admin only - key metrics for quick overview.

    Args:
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Summary metrics for dashboard display.
    """
    require_admin(current_user)

    try:
        service = get_knowledge_analytics_service()
        analytics = await service.get_full_analytics(session=db, days=30)

        return {
            "queries": {
                "total_30d": analytics.usage.queries_this_month,
                "today": analytics.usage.queries_today,
                "zero_result_rate": analytics.usage.zero_result_rate,
            },
            "quality": {
                "avg_rating": analytics.quality.avg_feedback_rating,
                "positive_rate": analytics.quality.positive_feedback_rate,
                "avg_latency_ms": analytics.quality.avg_latency_ms,
                "needs_attention": analytics.quality.queries_needing_attention,
            },
            "content": {
                "documents": analytics.content.total_documents,
                "chunks": analytics.content.total_chunks,
                "recently_added": analytics.content.recently_added,
                "stale": analytics.content.stale_documents,
            },
            "cache": {
                "hit_rate": analytics.cache.hit_rate,
                "size": analytics.cache.memory_size,
                "redis_available": analytics.cache.redis_available,
            },
        }

    except Exception as e:
        logger.error(f"Error getting analytics summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get summary")


# =============================================================================
# Retrieval Observability (Sprint 4)
# =============================================================================

@router.get("/retrieval")
async def get_retrieval_analytics(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get detailed retrieval pipeline analytics.

    Admin only - provides visibility into the retrieval pipeline performance
    including funnel metrics, diversity scores, and quality distribution.

    Args:
        days: Number of days for historical data (default 7).
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Retrieval analytics including:
        - funnel: Average candidates at each pipeline stage
        - diversity: Diversity score trends
        - quality: Quality score distribution
        - intent_distribution: Query intent breakdown
        - slow_queries: Queries exceeding latency threshold
        - low_diversity_queries: Queries with poor result diversity
    """
    require_admin(current_user)

    try:
        from sqlalchemy import text
        from datetime import datetime, timedelta

        cutoff = datetime.utcnow() - timedelta(days=days)

        # Get all queries with retrieval metrics in the period
        query_sql = """
            SELECT
                id,
                query_text,
                query_classification,
                retrieval_metrics,
                latency_ms,
                created_at
            FROM knowledge_queries
            WHERE created_at >= :cutoff
              AND retrieval_metrics IS NOT NULL
              AND retrieval_metrics != '{}'::jsonb
            ORDER BY created_at DESC
            LIMIT 5000
        """

        result = await db.execute(text(query_sql), {"cutoff": cutoff})
        rows = result.fetchall()

        if not rows:
            return {
                "funnel": {
                    "avg_semantic_candidates": 0,
                    "avg_keyword_candidates": 0,
                    "avg_merged_candidates": 0,
                    "avg_after_mmr": 0,
                    "avg_final": 0,
                },
                "diversity": {
                    "avg_score": 0,
                    "trend": [],
                },
                "quality": {
                    "avg_score": 0,
                    "distribution": {},
                },
                "intent_distribution": {},
                "complexity_distribution": {},
                "slow_queries": [],
                "low_diversity_queries": [],
                "total_queries": 0,
            }

        # Aggregate metrics
        total = len(rows)
        funnel_sum = {
            "semantic_candidates": 0,
            "keyword_candidates": 0,
            "merged_candidates": 0,
            "after_mmr": 0,
            "final_count": 0,
        }
        diversity_sum = 0.0
        quality_sum = 0.0
        intent_counts = {}
        complexity_counts = {}
        slow_queries = []
        low_diversity_queries = []

        # Daily diversity trend
        daily_diversity = {}

        for row in rows:
            metrics = row[3] or {}
            classification = row[2] or {}
            latency = row[4]
            created_at = row[5]

            # Funnel aggregation
            for key in funnel_sum.keys():
                funnel_sum[key] += metrics.get(key, 0)

            # Diversity and quality
            diversity = metrics.get("diversity_score", 0)
            quality = metrics.get("avg_quality_score", 0)
            diversity_sum += diversity
            quality_sum += quality

            # Intent distribution
            intent = classification.get("intent", "unknown")
            intent_counts[intent] = intent_counts.get(intent, 0) + 1

            # Complexity distribution
            complexity = classification.get("complexity", "unknown")
            complexity_counts[complexity] = complexity_counts.get(complexity, 0) + 1

            # Daily diversity trend
            if created_at:
                day_key = created_at.strftime("%Y-%m-%d")
                if day_key not in daily_diversity:
                    daily_diversity[day_key] = {"sum": 0, "count": 0}
                daily_diversity[day_key]["sum"] += diversity
                daily_diversity[day_key]["count"] += 1

            # Slow queries (> 2 seconds)
            if latency and latency > 2000:
                slow_queries.append({
                    "id": row[0],
                    "query": row[1][:100] if row[1] else "",
                    "latency_ms": latency,
                    "created_at": created_at.isoformat() if created_at else None,
                })

            # Low diversity queries (< 0.3)
            if diversity < 0.3 and metrics.get("final_count", 0) > 1:
                low_diversity_queries.append({
                    "id": row[0],
                    "query": row[1][:100] if row[1] else "",
                    "diversity_score": diversity,
                    "result_count": metrics.get("final_count", 0),
                    "created_at": created_at.isoformat() if created_at else None,
                })

        # Build quality distribution buckets
        quality_buckets = {"0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0}
        for row in rows:
            metrics = row[3] or {}
            quality = metrics.get("avg_quality_score", 0)
            if quality < 0.2:
                quality_buckets["0.0-0.2"] += 1
            elif quality < 0.4:
                quality_buckets["0.2-0.4"] += 1
            elif quality < 0.6:
                quality_buckets["0.4-0.6"] += 1
            elif quality < 0.8:
                quality_buckets["0.6-0.8"] += 1
            else:
                quality_buckets["0.8-1.0"] += 1

        # Build diversity trend
        diversity_trend = [
            {
                "date": day,
                "avg_diversity": data["sum"] / data["count"] if data["count"] > 0 else 0,
            }
            for day, data in sorted(daily_diversity.items())
        ]

        return {
            "funnel": {
                "avg_semantic_candidates": funnel_sum["semantic_candidates"] / total if total > 0 else 0,
                "avg_keyword_candidates": funnel_sum["keyword_candidates"] / total if total > 0 else 0,
                "avg_merged_candidates": funnel_sum["merged_candidates"] / total if total > 0 else 0,
                "avg_after_mmr": funnel_sum["after_mmr"] / total if total > 0 else 0,
                "avg_final": funnel_sum["final_count"] / total if total > 0 else 0,
            },
            "diversity": {
                "avg_score": diversity_sum / total if total > 0 else 0,
                "trend": diversity_trend[-30:],  # Last 30 days
            },
            "quality": {
                "avg_score": quality_sum / total if total > 0 else 0,
                "distribution": quality_buckets,
            },
            "intent_distribution": intent_counts,
            "complexity_distribution": complexity_counts,
            "slow_queries": slow_queries[:20],  # Top 20 slowest
            "low_diversity_queries": low_diversity_queries[:20],  # Top 20 low diversity
            "total_queries": total,
        }

    except Exception as e:
        logger.error(f"Error getting retrieval analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get retrieval analytics")


@router.get("/retrieval/trends")
async def get_retrieval_trends(
    days: int = Query(default=14, ge=1, le=90),
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user_from_session),
):
    """Get retrieval metrics trends over time.

    Admin only - daily aggregated retrieval metrics for trend analysis.

    Args:
        days: Number of days for historical data (default 14).
        db: Database session.
        current_user: Authenticated user (must be admin).

    Returns:
        Daily trends for key retrieval metrics.
    """
    require_admin(current_user)

    try:
        from sqlalchemy import text
        from datetime import datetime, timedelta

        cutoff = datetime.utcnow() - timedelta(days=days)

        # Aggregate by day
        trend_sql = """
            SELECT
                DATE(created_at) as day,
                COUNT(*) as query_count,
                AVG((retrieval_metrics->>'final_count')::float) as avg_results,
                AVG((retrieval_metrics->>'diversity_score')::float) as avg_diversity,
                AVG((retrieval_metrics->>'avg_quality_score')::float) as avg_quality,
                AVG((retrieval_metrics->>'avg_relevance')::float) as avg_relevance,
                AVG(latency_ms) as avg_latency
            FROM knowledge_queries
            WHERE created_at >= :cutoff
              AND retrieval_metrics IS NOT NULL
              AND retrieval_metrics != '{}'::jsonb
            GROUP BY DATE(created_at)
            ORDER BY day
        """

        result = await db.execute(text(trend_sql), {"cutoff": cutoff})
        rows = result.fetchall()

        trends = [
            {
                "date": row[0].isoformat() if row[0] else None,
                "query_count": row[1],
                "avg_results": float(row[2]) if row[2] else 0,
                "avg_diversity": float(row[3]) if row[3] else 0,
                "avg_quality": float(row[4]) if row[4] else 0,
                "avg_relevance": float(row[5]) if row[5] else 0,
                "avg_latency_ms": float(row[6]) if row[6] else 0,
            }
            for row in rows
        ]

        return {"trends": trends}

    except Exception as e:
        logger.error(f"Error getting retrieval trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to get retrieval trends")
