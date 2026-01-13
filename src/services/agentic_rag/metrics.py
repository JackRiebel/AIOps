"""Metrics logging for agentic RAG pipeline.

Provides comprehensive metrics collection and logging for:
- Pipeline latency tracking
- Agent performance monitoring
- LLM usage and costs
- Quality metrics
- Error tracking
"""

import logging
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Dict, Any, List
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from .state import RAGState, RAGMetrics

logger = logging.getLogger(__name__)


class RAGMetricsLogger:
    """Logs and persists agentic RAG pipeline metrics.

    Metrics are logged to:
    1. Application logs (always)
    2. Database (if configured)
    3. External monitoring (if configured)
    """

    def __init__(
        self,
        log_to_db: bool = True,
        log_detailed: bool = False,
    ):
        """Initialize metrics logger.

        Args:
            log_to_db: Whether to persist metrics to database
            log_detailed: Whether to log detailed agent timings
        """
        self.log_to_db = log_to_db
        self.log_detailed = log_detailed

    async def log_pipeline_run(
        self,
        session: Optional[AsyncSession],
        state: RAGState,
        query_id: str,
    ) -> RAGMetrics:
        """Log metrics from a completed pipeline run.

        Args:
            session: Database session for persistence
            state: Final RAG state
            query_id: Unique query identifier

        Returns:
            RAGMetrics object with all collected metrics
        """
        metrics = RAGMetrics.from_state(state, query_id)

        # Log summary
        self._log_summary(metrics)

        # Log detailed agent timings if enabled
        if self.log_detailed:
            self._log_agent_timings(metrics)

        # Persist to database if enabled
        if self.log_to_db and session:
            await self._persist_metrics(session, metrics, state)

        return metrics

    def _log_summary(self, metrics: RAGMetrics):
        """Log summary metrics."""
        logger.info(
            f"Agentic RAG completed | "
            f"query_id={metrics.query_id} | "
            f"latency={metrics.total_latency_ms:.0f}ms | "
            f"llm_calls={metrics.llm_calls} | "
            f"tokens={metrics.tokens_used} | "
            f"iterations={metrics.iterations} | "
            f"quality={metrics.final_quality} | "
            f"confidence={metrics.confidence:.2f} | "
            f"citations={metrics.num_citations} | "
            f"strategy={metrics.strategy_used}"
        )

    def _log_agent_timings(self, metrics: RAGMetrics):
        """Log individual agent timings."""
        logger.debug("Agent timings breakdown:")
        for agent, timing_ms in sorted(
            metrics.agent_timings.items(),
            key=lambda x: x[1],
            reverse=True
        ):
            logger.debug(f"  {agent}: {timing_ms:.1f}ms")

    async def _persist_metrics(
        self,
        session: AsyncSession,
        metrics: RAGMetrics,
        state: RAGState,
    ):
        """Persist metrics to database."""
        try:
            # Insert into knowledge_query_logs table
            sql = text("""
                INSERT INTO knowledge_query_logs (
                    query,
                    retrieval_strategy,
                    retrieved_chunk_ids,
                    result_count,
                    embedding_latency_ms,
                    retrieval_latency_ms,
                    generation_latency_ms,
                    total_latency_ms,
                    user_id,
                    session_id,
                    source,
                    created_at
                ) VALUES (
                    :query,
                    :strategy,
                    :chunk_ids,
                    :result_count,
                    :embedding_latency,
                    :retrieval_latency,
                    :generation_latency,
                    :total_latency,
                    :user_id,
                    :session_id,
                    'agentic_rag',
                    :created_at
                )
            """)

            # Extract timing components
            embedding_latency = int(metrics.agent_timings.get("query_analysis", 0))
            retrieval_latency = int(
                metrics.agent_timings.get("retrieval_router", 0) +
                metrics.agent_timings.get("document_grader", 0)
            )
            generation_latency = int(
                metrics.agent_timings.get("synthesis", 0) +
                metrics.agent_timings.get("reflection", 0)
            )

            chunk_ids = [doc.chunk_id for doc in state.graded_documents if doc.is_relevant]

            from datetime import datetime
            await session.execute(sql, {
                "query": metrics.original_query[:1000],  # Truncate if too long
                "strategy": metrics.strategy_used,
                "chunk_ids": chunk_ids,
                "result_count": metrics.num_relevant,
                "embedding_latency": embedding_latency,
                "retrieval_latency": retrieval_latency,
                "generation_latency": generation_latency,
                "total_latency": int(metrics.total_latency_ms),
                "user_id": state.user_id,
                "session_id": metrics.query_id,
                "created_at": datetime.utcnow(),
            })

            query_log_id = None  # RETURNING not portable to SQLite
            logger.debug(f"Persisted metrics to knowledge_query_logs: id={query_log_id}")

            # Also log to ai_cost_logs if we have token usage
            if metrics.tokens_used > 0:
                await self._log_ai_costs(session, metrics, state)

        except Exception as e:
            logger.error(f"Failed to persist RAG metrics: {e}")

    async def _log_ai_costs(
        self,
        session: AsyncSession,
        metrics: RAGMetrics,
        state: RAGState,
    ):
        """Log AI costs to cost tracking table."""
        try:
            # Estimate costs based on token usage
            # Using approximate GPT-4o-mini pricing as default
            input_cost_per_1k = 0.00015
            output_cost_per_1k = 0.0006

            # Rough split: 70% input, 30% output
            input_tokens = int(metrics.tokens_used * 0.7)
            output_tokens = int(metrics.tokens_used * 0.3)

            cost_usd = (
                (input_tokens / 1000) * input_cost_per_1k +
                (output_tokens / 1000) * output_cost_per_1k
            )

            sql = text("""
                INSERT INTO ai_cost_logs (
                    user_id,
                    input_tokens,
                    output_tokens,
                    total_tokens,
                    cost_usd,
                    model,
                    timestamp
                ) VALUES (
                    :user_id,
                    :input_tokens,
                    :output_tokens,
                    :total_tokens,
                    :cost_usd,
                    :model,
                    :timestamp
                )
            """)

            from datetime import datetime
            await session.execute(sql, {
                "user_id": str(state.user_id) if state.user_id else "agentic-rag",
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": metrics.tokens_used,
                "cost_usd": cost_usd,
                "model": "gpt-4o-mini",  # Default model for agentic RAG
                "timestamp": datetime.utcnow(),
            })

        except Exception as e:
            logger.error(f"Failed to log AI costs: {e}")


@dataclass
class AggregatedMetrics:
    """Aggregated metrics over a time period."""
    period_start: datetime
    period_end: datetime
    total_queries: int
    avg_latency_ms: float
    p95_latency_ms: float
    total_llm_calls: int
    total_tokens: int
    avg_iterations: float
    quality_distribution: Dict[str, int]
    avg_confidence: float
    web_search_rate: float
    avg_citations: float
    strategy_distribution: Dict[str, int]


class RAGMetricsAggregator:
    """Aggregates RAG metrics for analytics and monitoring."""

    async def get_aggregated_metrics(
        self,
        session: AsyncSession,
        hours: int = 24,
    ) -> Optional[AggregatedMetrics]:
        """Get aggregated metrics for the specified time period.

        Args:
            session: Database session
            hours: Number of hours to look back

        Returns:
            AggregatedMetrics or None if no data
        """
        try:
            from datetime import datetime, timedelta
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)

            # Use portable SQL - PERCENTILE_CONT is PostgreSQL-only, so we skip p95 for SQLite
            sql = text("""
                SELECT
                    COUNT(*) as total_queries,
                    AVG(total_latency_ms) as avg_latency,
                    MAX(total_latency_ms) as max_latency,
                    AVG(result_count) as avg_results,
                    MIN(created_at) as period_start,
                    MAX(created_at) as period_end
                FROM knowledge_query_logs
                WHERE source = 'agentic_rag'
                AND created_at > :cutoff_time
            """)

            result = await session.execute(sql, {"cutoff_time": cutoff_time})
            row = result.fetchone()

            if not row or row.total_queries == 0:
                return None

            return AggregatedMetrics(
                period_start=row.period_start,
                period_end=row.period_end,
                total_queries=row.total_queries,
                avg_latency_ms=float(row.avg_latency or 0),
                p95_latency_ms=float(row.max_latency or 0),  # Using max as approx p95 for SQLite compatibility
                total_llm_calls=0,  # Would need separate tracking
                total_tokens=0,  # Would need separate tracking
                avg_iterations=1.0,  # Would need separate tracking
                quality_distribution={},  # Would need separate tracking
                avg_confidence=0.0,  # Would need separate tracking
                web_search_rate=0.0,  # Would need separate tracking
                avg_citations=float(row.avg_results or 0),
                strategy_distribution={},  # Would need separate tracking
            )

        except Exception as e:
            logger.error(f"Failed to get aggregated metrics: {e}")
            return None

    async def get_slow_queries(
        self,
        session: AsyncSession,
        threshold_ms: int = 10000,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Get queries that exceeded latency threshold.

        Args:
            session: Database session
            threshold_ms: Latency threshold in milliseconds
            limit: Maximum number of queries to return

        Returns:
            List of slow query records
        """
        try:
            sql = text("""
                SELECT
                    id,
                    query,
                    retrieval_strategy,
                    total_latency_ms,
                    result_count,
                    created_at
                FROM knowledge_query_logs
                WHERE source = 'agentic_rag'
                AND total_latency_ms > :threshold
                ORDER BY total_latency_ms DESC
                LIMIT :limit
            """)

            result = await session.execute(sql, {
                "threshold": threshold_ms,
                "limit": limit,
            })

            return [dict(row._mapping) for row in result.fetchall()]

        except Exception as e:
            logger.error(f"Failed to get slow queries: {e}")
            return []


# Global metrics logger instance
_metrics_logger: Optional[RAGMetricsLogger] = None


def get_rag_metrics_logger() -> RAGMetricsLogger:
    """Get the global RAG metrics logger."""
    global _metrics_logger
    if _metrics_logger is None:
        _metrics_logger = RAGMetricsLogger()
    return _metrics_logger
