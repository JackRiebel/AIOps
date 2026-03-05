"""API routes for AI query trace observability."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.dependencies import require_viewer
from src.services.ai_trace_collector import get_trace_collector

router = APIRouter(prefix="/api/ai-traces", tags=["ai-traces"])

# Provider aliases: AI Assurance keys → trace provider values
PROVIDER_ALIASES = {
    "cisco_circuit": "cisco",
    "azure_openai": "openai",
}


def _normalize_provider(provider: Optional[str]) -> Optional[str]:
    """Normalize provider name from AI Assurance key to trace system value."""
    return PROVIDER_ALIASES.get(provider, provider) if provider else provider


@router.get("/te-status")
async def get_te_monitoring_status(
    current_user=Depends(require_viewer),
):
    """Return TE monitoring status per AI provider."""
    try:
        from src.services.te_auto_provisioner import get_te_auto_provisioner
        provisioner = get_te_auto_provisioner()
        return {"providers": provisioner.get_monitoring_status()}
    except Exception:
        return {"providers": {}}


@router.get("/stats/summary")
async def get_trace_stats(
    hours: int = Query(24, ge=1, le=720),
    current_user=Depends(require_viewer),
):
    """Aggregate trace stats for a time window."""
    try:
        collector = get_trace_collector()
        stats = await collector.get_stats(hours=hours, user_id=current_user.id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
async def get_recent_traces(
    limit: int = Query(10, ge=1, le=50),
    provider: Optional[str] = Query(None),
    current_user=Depends(require_viewer),
):
    """Recent traces for the current user."""
    collector = get_trace_collector()
    normalized = _normalize_provider(provider)
    traces = await collector.list_traces(user_id=current_user.id, limit=limit, provider=normalized)
    return traces


@router.get("")
async def list_traces(
    session_id: Optional[int] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    provider: Optional[str] = Query(None),
    current_user=Depends(require_viewer),
):
    """List traces, optionally filtered by session."""
    collector = get_trace_collector()
    normalized = _normalize_provider(provider)
    traces = await collector.list_traces(
        session_id=session_id,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        provider=normalized,
    )
    return traces


@router.get("/{trace_id}")
async def get_trace(
    trace_id: uuid.UUID,
    current_user=Depends(require_viewer),
):
    """Full trace tree for a given trace_id."""
    collector = get_trace_collector()
    trace = await collector.get_trace(trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace


@router.get("/{trace_id}/waterfall")
async def get_trace_waterfall(
    trace_id: uuid.UUID,
    current_user=Depends(require_viewer),
):
    """Pre-computed waterfall bars for a given trace_id."""
    collector = get_trace_collector()
    bars = await collector.get_waterfall(trace_id)
    if not bars:
        raise HTTPException(status_code=404, detail="Trace not found")
    return bars


@router.get("/{trace_id}/journey")
async def get_trace_journey(
    trace_id: uuid.UUID,
    current_user=Depends(require_viewer),
):
    """Trace tree enriched with baselines, anomaly flags, TE data, and cost impact."""
    collector = get_trace_collector()
    trace = await collector.get_trace(trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")

    # Track cost totals for summary
    total_cost_usd = 0.0
    total_network_tax_ms = 0.0
    total_wasted_usd = 0.0
    total_duration_ms = 0.0
    total_raw_network_ms = 0.0
    raw_network_span_count = 0

    # Enrich spans with baseline/anomaly data + TE enrichment
    try:
        from src.services.trace_baselines import get_baseline_service
        from src.services.te_path_correlator import get_te_path_correlator

        baseline_service = get_baseline_service()
        te_correlator = get_te_path_correlator()

        async def enrich_span(span: dict) -> dict:
            nonlocal total_cost_usd, total_network_tax_ms, total_wasted_usd, total_duration_ms, total_raw_network_ms, raw_network_span_count

            server_ip = span.get("server_ip")
            platform = span.get("tool_platform") or span.get("provider")

            # Baseline + anomaly enrichment
            if server_ip and platform:
                baseline = baseline_service.get_baseline(server_ip, platform)
                anomalies = baseline_service.check_anomalies(
                    server_ip, platform,
                    tcp_ms=span.get("tcp_connect_ms"),
                    tls_ms=span.get("tls_ms"),
                    ttfb_ms=span.get("ttfb_ms"),
                    duration_ms=span.get("duration_ms"),
                )
                span["baseline"] = baseline
                span["anomalies"] = anomalies

            # TE full enrichment
            destination = server_ip or (platform and None)
            if destination or platform:
                te_data = await te_correlator.get_full_enrichment(
                    destination=destination or "", platform=platform,
                )
                if te_data:
                    span["te_enrichment"] = te_data

            # Accumulate raw TCP+TLS timing
            tcp_ms = span.get("tcp_connect_ms") or 0
            tls_ms_val = span.get("tls_ms") or 0
            if tcp_ms > 0 or tls_ms_val > 0:
                total_raw_network_ms += tcp_ms + tls_ms_val
                raw_network_span_count += 1

            # Cost impact for LLM spans
            cost_usd = span.get("cost_usd") or 0
            if cost_usd > 0:
                total_cost_usd += cost_usd
                baseline_ttfb = None
                if span.get("baseline") and span["baseline"].get("isValid"):
                    baseline_ttfb = span["baseline"].get("ttfbMs")

                actual_ms = span.get("ttfb_ms") or span.get("duration_ms") or 0
                total_duration_ms += actual_ms
                excess_ms = 0
                wasted = 0.0

                if baseline_ttfb and actual_ms > baseline_ttfb:
                    excess_ms = actual_ms - baseline_ttfb
                    total_network_tax_ms += excess_ms
                    if actual_ms > 0:
                        wasted = (excess_ms / actual_ms) * cost_usd
                        total_wasted_usd += wasted

                span["cost_impact"] = {
                    "cost_usd": cost_usd,
                    "baseline_latency_ms": baseline_ttfb,
                    "actual_latency_ms": actual_ms if actual_ms > 0 else None,
                    "excess_latency_ms": excess_ms,
                    "wasted_compute_usd": round(wasted, 6),
                }

            for child in span.get("children", []):
                await enrich_span(child)
            return span

        await enrich_span(trace["root_span"])
    except Exception:
        pass  # Baselines/TE not configured or service unavailable

    # Add cost summary
    avg_raw_network_ms = round(total_raw_network_ms / raw_network_span_count, 1) if raw_network_span_count > 0 else 0
    effective_network_ms = max(total_network_tax_ms, total_raw_network_ms)
    trace["cost_summary"] = {
        "total_cost_usd": round(total_cost_usd, 6),
        "total_network_tax_ms": round(total_network_tax_ms, 1),
        "total_raw_network_ms": round(total_raw_network_ms, 1),
        "avg_raw_network_ms": avg_raw_network_ms,
        "total_wasted_usd": round(total_wasted_usd, 6),
        "network_tax_pct": round(
            (effective_network_ms / total_duration_ms * 100) if total_duration_ms > 0 else 0, 1
        ),
    }

    # Add TE monitoring status for providers involved in this trace
    try:
        from src.services.te_auto_provisioner import get_te_auto_provisioner
        provisioner = get_te_auto_provisioner()
        te_status = provisioner.get_monitoring_status()
        # Filter to only providers involved in this trace
        involved_providers: set = set()

        def _collect_providers(span: dict) -> None:
            p = span.get("provider")
            if p:
                involved_providers.add(p.lower())
            for child in span.get("children", []):
                _collect_providers(child)

        _collect_providers(trace["root_span"])
        trace["te_monitoring"] = {p: te_status.get(p, False) for p in involved_providers}
    except Exception:
        pass

    return trace
