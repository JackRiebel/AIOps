"""AI Trace Collector - captures every span of an AI query lifecycle.

Provides OpenTelemetry-inspired tracing for AI queries: root query spans,
LLM call spans, tool execution spans, and synthesis spans. Each span
records timing, cost, tokens, and tool results.

All operations are fire-and-forget safe — trace failures never block chat.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload

from src.config.database import get_db
from src.models.ai_trace import AIQueryTrace

logger = logging.getLogger(__name__)

# Platform detection from tool name prefixes
TOOL_PLATFORM_PREFIXES = [
    ("meraki_", "meraki"),
    ("catalyst_", "catalyst"),
    ("thousandeyes_", "thousandeyes"),
    ("splunk_", "splunk"),
    ("canvas_", "canvas"),
    ("knowledge_", "knowledge"),
]

# Session ID prefixes that indicate auto-generated system queries (not user-initiated).
# Traces from these sessions are still recorded but marked as system and excluded
# from user-facing "Recent AI Queries" by default.
SYSTEM_SESSION_PREFIXES = (
    "te-insight-",         # ThousandEyes Intelligence auto-analysis
    "auto-summary-",       # Dashboard auto-summaries
    "health-check-",       # Periodic health checks
    "system-",             # Generic system prefix
)


def _detect_platform(tool_name: str) -> Optional[str]:
    """Detect platform from tool name prefix."""
    if not tool_name:
        return None
    for prefix, platform in TOOL_PLATFORM_PREFIXES:
        if tool_name.startswith(prefix):
            return platform
    return None


def _truncate_tool_input(tool_input: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Truncate tool input values to 200 chars each."""
    if not tool_input:
        return None
    return {k: str(v)[:200] for k, v in tool_input.items()}


class AITraceCollector:
    """Collects and persists AI query trace spans."""

    def __init__(self):
        self._active_spans: Dict[int, float] = {}  # span_id -> monotonic start time
        self._db = get_db()

    async def start_trace(
        self,
        session_id: Optional[int],
        user_id: Optional[int],
        query: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        is_system: bool = False,
    ) -> Tuple[uuid.UUID, int]:
        """Create root 'query' span. Returns (trace_id, root_span_id)."""
        trace_id = uuid.uuid4()
        mono_start = time.monotonic()

        metadata: Dict[str, Any] = {"query": query[:1000] if query else ""}
        if provider:
            metadata["provider"] = provider
        if model:
            metadata["model"] = model
        if is_system:
            metadata["is_system"] = True

        async with self._db.session() as session:
            span = AIQueryTrace(
                trace_id=trace_id,
                session_id=session_id,
                user_id=user_id,
                span_type="query",
                span_name=query[:255] if query else None,
                status="running",
                trace_metadata=metadata,
                provider=provider,
                model=model,
            )
            session.add(span)
            await session.commit()
            await session.refresh(span)

            self._active_spans[span.id] = mono_start
            logger.debug(f"[Trace] Started trace {trace_id} span_id={span.id}")
            return trace_id, span.id

    async def add_span(
        self,
        trace_id: uuid.UUID,
        span_type: str,
        parent_span_id: Optional[int] = None,
        span_name: Optional[str] = None,
        iteration: int = 0,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_input: Optional[Dict[str, Any]] = None,
        tool_platform: Optional[str] = None,
        session_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> int:
        """Create a child span. Returns span_id."""
        mono_start = time.monotonic()

        # Auto-detect platform from tool name if not provided
        if not tool_platform and tool_name:
            tool_platform = _detect_platform(tool_name)

        async with self._db.session() as session:
            span = AIQueryTrace(
                trace_id=trace_id,
                parent_span_id=parent_span_id,
                session_id=session_id,
                user_id=user_id,
                span_type=span_type,
                span_name=span_name[:255] if span_name else None,
                iteration=iteration,
                model=model,
                provider=provider,
                tool_name=tool_name,
                tool_input=_truncate_tool_input(tool_input),
                tool_platform=tool_platform,
                status="running",
            )
            session.add(span)
            await session.commit()
            await session.refresh(span)

            self._active_spans[span.id] = mono_start
            logger.debug(f"[Trace] Added {span_type} span_id={span.id} to trace {trace_id}")
            return span.id

    async def end_span(
        self,
        span_id: int,
        status: str = "success",
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        cost_usd: Optional[float] = None,
        thinking_tokens: Optional[int] = None,
        tool_success: Optional[bool] = None,
        tool_output_summary: Optional[str] = None,
        tool_error: Optional[str] = None,
        dns_ms: Optional[int] = None,
        tcp_connect_ms: Optional[int] = None,
        tls_ms: Optional[int] = None,
        ttfb_ms: Optional[int] = None,
        server_ip: Optional[str] = None,
        server_port: Optional[int] = None,
        tls_version: Optional[str] = None,
        http_version: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """End a span with results. Computes duration from monotonic clock."""
        mono_start = self._active_spans.pop(span_id, None)
        duration_ms = int((time.monotonic() - mono_start) * 1000) if mono_start else None

        async with self._db.session() as session:
            result = await session.execute(
                select(AIQueryTrace).where(AIQueryTrace.id == span_id)
            )
            span = result.scalar_one_or_none()
            if not span:
                logger.warning(f"[Trace] Span {span_id} not found for end_span")
                return

            span.end_time = datetime.now(timezone.utc)
            span.duration_ms = duration_ms
            span.status = status
            if input_tokens is not None:
                span.input_tokens = input_tokens
            if output_tokens is not None:
                span.output_tokens = output_tokens
            if cost_usd is not None:
                span.cost_usd = Decimal(str(cost_usd))
            if thinking_tokens is not None:
                span.thinking_tokens = thinking_tokens
            if tool_success is not None:
                span.tool_success = tool_success
            if tool_output_summary is not None:
                span.tool_output_summary = tool_output_summary[:500]
            if tool_error is not None:
                span.tool_error = tool_error
            if dns_ms is not None:
                span.dns_ms = dns_ms
            if tcp_connect_ms is not None:
                span.tcp_connect_ms = tcp_connect_ms
            if tls_ms is not None:
                span.tls_ms = tls_ms
            if ttfb_ms is not None:
                span.ttfb_ms = ttfb_ms
            if server_ip is not None:
                span.server_ip = server_ip
            if server_port is not None:
                span.server_port = server_port
            if tls_version is not None:
                span.tls_version = tls_version
            if http_version is not None:
                span.http_version = http_version
            if error_message is not None:
                span.error_message = error_message

            await session.commit()
            logger.debug(f"[Trace] Ended span {span_id}: {status}, {duration_ms}ms")

            # Update baselines with network timing (fire-and-forget)
            if server_ip and tcp_connect_ms:
                try:
                    from src.services.trace_baselines import get_baseline_service
                    platform = span.tool_platform or span.provider or "unknown"
                    bl_service = get_baseline_service()
                    bl_service.update(
                        server_ip=server_ip,
                        platform=platform,
                        tcp_ms=tcp_connect_ms,
                        tls_ms=tls_ms,
                        ttfb_ms=ttfb_ms,
                        duration_ms=duration_ms,
                    )
                except Exception:
                    pass

    async def end_trace(
        self,
        trace_id: uuid.UUID,
        root_span_id: int,
        status: str = "success",
        error_message: Optional[str] = None,
        **totals,
    ) -> None:
        """Convenience: end the root span of a trace."""
        await self.end_span(
            root_span_id,
            status=status,
            error_message=error_message,
            input_tokens=totals.get("total_input_tokens"),
            output_tokens=totals.get("total_output_tokens"),
            cost_usd=totals.get("total_cost"),
        )

    async def update_span_path(self, span_id: int, network_path: List[Dict]) -> None:
        """Update a span's network_path after initial end_span."""
        try:
            async with self._db.session() as session:
                result = await session.execute(
                    select(AIQueryTrace).where(AIQueryTrace.id == span_id)
                )
                span = result.scalar_one_or_none()
                if span:
                    span.network_path = network_path
                    await session.commit()
                    logger.debug(f"[Trace] Updated network_path for span {span_id}: {len(network_path)} hops")
        except Exception as e:
            logger.debug(f"[Trace] Failed to update span path: {e}")

    async def get_trace(self, trace_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Fetch all spans for a trace, build tree structure."""
        async with self._db.session() as session:
            result = await session.execute(
                select(AIQueryTrace)
                .where(AIQueryTrace.trace_id == trace_id)
                .order_by(AIQueryTrace.start_time)
            )
            spans = result.scalars().all()

            if not spans:
                return None

            span_map = {}
            root_span = None

            for span in spans:
                span_dict = self._span_to_dict(span)
                span_dict["children"] = []
                span_map[span.id] = span_dict
                if span.parent_span_id is None:
                    root_span = span_dict

            # Build tree
            for span in spans:
                if span.parent_span_id and span.parent_span_id in span_map:
                    span_map[span.parent_span_id]["children"].append(span_map[span.id])

            # Compute totals
            total_tokens = sum(
                (s.input_tokens or 0) + (s.output_tokens or 0)
                for s in spans if s.span_type in ("llm_call", "query")
            )
            total_cost = sum(
                float(s.cost_usd or 0) for s in spans if s.cost_usd
            )
            tool_count = sum(1 for s in spans if s.span_type == "tool_execution")

            return {
                "trace_id": str(trace_id),
                "root_span": root_span,
                "total_tokens": total_tokens,
                "total_cost": round(total_cost, 8),
                "tool_count": tool_count,
                "span_count": len(spans),
            }

    async def list_traces(
        self,
        session_id: Optional[int] = None,
        user_id: Optional[int] = None,
        limit: int = 20,
        offset: int = 0,
        provider: Optional[str] = None,
        include_system: bool = False,
    ) -> List[Dict[str, Any]]:
        """List root spans with aggregated stats.

        By default, auto-generated system queries (ThousandEyes Intelligence
        auto-analysis, health checks, etc.) are excluded. Pass
        ``include_system=True`` to include them.
        """
        async with self._db.session() as session:
            query = select(AIQueryTrace).where(
                AIQueryTrace.span_type == "query"
            )
            if session_id is not None:
                query = query.where(AIQueryTrace.session_id == session_id)
            if user_id is not None:
                from sqlalchemy import or_
                query = query.where(
                    or_(AIQueryTrace.user_id == user_id, AIQueryTrace.user_id.is_(None))
                )
            if provider is not None:
                query = query.where(AIQueryTrace.provider == provider)

            # Exclude system-generated traces unless explicitly requested
            if not include_system:
                from sqlalchemy import text
                # JSONB: metadata->>'is_system' is null or != 'true'
                query = query.where(
                    text("(metadata->>'is_system') IS DISTINCT FROM 'true'")
                )

            query = query.order_by(desc(AIQueryTrace.start_time)).offset(offset).limit(limit)
            result = await session.execute(query)
            root_spans = result.scalars().all()

            traces = []
            for root in root_spans:
                # Get child stats
                child_result = await session.execute(
                    select(
                        func.count(AIQueryTrace.id).filter(
                            AIQueryTrace.span_type == "tool_execution"
                        ).label("tool_count"),
                        func.coalesce(func.sum(AIQueryTrace.cost_usd), 0).label("total_cost"),
                        func.avg(
                            AIQueryTrace.tcp_connect_ms + func.coalesce(AIQueryTrace.tls_ms, 0)
                        ).filter(AIQueryTrace.tcp_connect_ms.isnot(None)).label("avg_network_latency_ms"),
                    ).where(AIQueryTrace.trace_id == root.trace_id)
                )
                stats = child_result.one()

                metadata = root.trace_metadata or {}
                traces.append({
                    "trace_id": str(root.trace_id),
                    "query": metadata.get("query", root.span_name or ""),
                    "start_time": root.start_time.isoformat() if root.start_time else None,
                    "duration_ms": root.duration_ms,
                    "status": root.status,
                    "tool_count": stats.tool_count or 0,
                    "cost_usd": float(stats.total_cost or 0),
                    "network_latency_ms": float(stats.avg_network_latency_ms) if stats.avg_network_latency_ms else None,
                    "provider": root.provider or metadata.get("provider"),
                    "model": root.model or metadata.get("model"),
                })

            return traces

    async def get_waterfall(self, trace_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Flat list of spans sorted by start_time with offset/depth for waterfall rendering."""
        async with self._db.session() as session:
            result = await session.execute(
                select(AIQueryTrace)
                .where(AIQueryTrace.trace_id == trace_id)
                .order_by(AIQueryTrace.start_time)
            )
            spans = result.scalars().all()

            if not spans:
                return []

            # Find root start time for offset calculation
            root_start = min(s.start_time for s in spans if s.start_time)

            # Build depth map from parent relationships
            depth_map: Dict[int, int] = {}
            span_by_id = {s.id: s for s in spans}
            for s in spans:
                if s.parent_span_id is None:
                    depth_map[s.id] = 0
                elif s.parent_span_id in depth_map:
                    depth_map[s.id] = depth_map[s.parent_span_id] + 1
                else:
                    # Walk up to find depth
                    depth = 0
                    current = s
                    while current.parent_span_id and current.parent_span_id in span_by_id:
                        depth += 1
                        current = span_by_id[current.parent_span_id]
                    depth_map[s.id] = depth

            bars = []
            for s in spans:
                offset_ms = int((s.start_time - root_start).total_seconds() * 1000) if s.start_time else 0
                bar: Dict[str, Any] = {
                    "span_id": s.id,
                    "span_type": s.span_type,
                    "span_name": s.span_name or s.tool_name or s.model or s.span_type,
                    "offset_ms": offset_ms,
                    "duration_ms": s.duration_ms or 0,
                    "depth": depth_map.get(s.id, 0),
                    "status": s.status,
                }
                if s.tool_name:
                    bar["tool_name"] = s.tool_name
                if s.tool_platform:
                    bar["tool_platform"] = s.tool_platform
                if s.model:
                    bar["model"] = s.model
                if s.input_tokens or s.output_tokens:
                    bar["tokens"] = {
                        "input": s.input_tokens or 0,
                        "output": s.output_tokens or 0,
                    }
                if s.cost_usd:
                    bar["cost_usd"] = float(s.cost_usd)
                if any([s.dns_ms, s.tcp_connect_ms, s.tls_ms, s.ttfb_ms]):
                    bar["network_timing"] = {
                        k: v for k, v in {
                            "dns_ms": s.dns_ms,
                            "tcp_ms": s.tcp_connect_ms,
                            "tls_ms": s.tls_ms,
                            "ttfb_ms": s.ttfb_ms,
                        }.items() if v is not None
                    }
                if s.server_ip:
                    bar["server_ip"] = s.server_ip
                    if s.server_port:
                        bar["server_port"] = s.server_port
                if s.tls_version:
                    bar["tls_version"] = s.tls_version
                if s.http_version:
                    bar["http_version"] = s.http_version
                if s.network_path:
                    bar["network_path"] = s.network_path
                bars.append(bar)

            return bars

    async def get_stats(
        self,
        hours: int = 24,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Aggregate trace stats for a time window."""
        async with self._db.session() as session:
            cutoff = func.now() - func.cast(f"{hours} hours", type_=None)

            # Root span stats
            result = await session.execute(
                select(
                    func.count(AIQueryTrace.id).label("total_traces"),
                    func.avg(AIQueryTrace.duration_ms).label("avg_duration_ms"),
                    func.coalesce(func.sum(AIQueryTrace.cost_usd), 0).label("total_cost"),
                ).where(
                    and_(
                        AIQueryTrace.span_type == "query",
                        AIQueryTrace.start_time >= func.now() - func.make_interval(0, 0, 0, 0, hours),
                        *([AIQueryTrace.user_id == user_id] if user_id else []),
                    )
                )
            )
            row = result.one()

            # Tool failure rate
            tool_result = await session.execute(
                select(
                    func.count(AIQueryTrace.id).label("total_tools"),
                    func.count(AIQueryTrace.id).filter(
                        AIQueryTrace.tool_success == False
                    ).label("failed_tools"),
                ).where(
                    and_(
                        AIQueryTrace.span_type == "tool_execution",
                        AIQueryTrace.start_time >= func.now() - func.make_interval(0, 0, 0, 0, hours),
                        *([AIQueryTrace.user_id == user_id] if user_id else []),
                    )
                )
            )
            tool_row = tool_result.one()
            total_tools = tool_row.total_tools or 0
            failed_tools = tool_row.failed_tools or 0

            # Provider breakdown
            provider_result = await session.execute(
                select(
                    AIQueryTrace.provider,
                    func.count(AIQueryTrace.id).label("count"),
                    func.avg(AIQueryTrace.duration_ms).label("avg_ms"),
                ).where(
                    and_(
                        AIQueryTrace.span_type == "llm_call",
                        AIQueryTrace.provider.isnot(None),
                        AIQueryTrace.start_time >= func.now() - func.make_interval(0, 0, 0, 0, hours),
                        *([AIQueryTrace.user_id == user_id] if user_id else []),
                    )
                ).group_by(AIQueryTrace.provider)
            )
            providers = {
                r.provider: {"count": r.count, "avg_ms": round(float(r.avg_ms or 0))}
                for r in provider_result.all()
            }

            return {
                "total_traces": row.total_traces or 0,
                "avg_duration_ms": round(float(row.avg_duration_ms or 0)),
                "total_cost": round(float(row.total_cost or 0), 6),
                "tool_failure_rate": round(failed_tools / total_tools, 3) if total_tools > 0 else 0,
                "total_tool_calls": total_tools,
                "failed_tool_calls": failed_tools,
                "provider_breakdown": providers,
            }

    def _span_to_dict(self, span: AIQueryTrace) -> Dict[str, Any]:
        """Convert a span model to a serializable dict."""
        return {
            "id": span.id,
            "trace_id": str(span.trace_id),
            "parent_span_id": span.parent_span_id,
            "span_type": span.span_type,
            "span_name": span.span_name,
            "iteration": span.iteration,
            "start_time": span.start_time.isoformat() if span.start_time else None,
            "end_time": span.end_time.isoformat() if span.end_time else None,
            "duration_ms": span.duration_ms,
            "model": span.model,
            "provider": span.provider,
            "input_tokens": span.input_tokens,
            "output_tokens": span.output_tokens,
            "cost_usd": float(span.cost_usd) if span.cost_usd else None,
            "thinking_tokens": span.thinking_tokens,
            "tool_name": span.tool_name,
            "tool_input": span.tool_input,
            "tool_output_summary": span.tool_output_summary,
            "tool_success": span.tool_success,
            "tool_platform": span.tool_platform,
            "tool_error": span.tool_error,
            "dns_ms": span.dns_ms,
            "tcp_connect_ms": span.tcp_connect_ms,
            "tls_ms": span.tls_ms,
            "ttfb_ms": span.ttfb_ms,
            "server_ip": span.server_ip,
            "server_port": span.server_port,
            "tls_version": span.tls_version,
            "http_version": span.http_version,
            "network_path": span.network_path,
            "status": span.status,
            "error_message": span.error_message,
            "metadata": span.trace_metadata,
        }


# Global singleton
_trace_collector: Optional[AITraceCollector] = None


def get_trace_collector() -> AITraceCollector:
    """Get the AI trace collector singleton."""
    global _trace_collector
    if _trace_collector is None:
        _trace_collector = AITraceCollector()
    return _trace_collector
