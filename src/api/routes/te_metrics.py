"""ThousandEyes historical metrics API — exposes 7-day stored test data."""

from fastapi import APIRouter, Depends, Query
from typing import Any

from src.api.dependencies import require_viewer
from src.services.te_metrics_service import get_te_metrics_service

router = APIRouter(prefix="/api/te-metrics", tags=["ThousandEyes Metrics"])


@router.get("/status")
async def te_metrics_status(_: Any = Depends(require_viewer)):
    """Collection stats: total rows, last collection time, oldest record."""
    svc = get_te_metrics_service()
    return await svc.get_status()


@router.get("/history/{test_id}")
async def te_metrics_history(
    test_id: int,
    hours: int = Query(24, ge=1, le=168),
    _: Any = Depends(require_viewer),
):
    """Raw metrics for a specific test within time window."""
    svc = get_te_metrics_service()
    return await svc.get_test_history(test_id, hours=hours)


@router.get("/aggregates/{test_id}")
async def te_metrics_aggregates(
    test_id: int,
    hours: int = Query(24, ge=1, le=168),
    bucket: str = Query("1h", regex="^(15m|1h|6h)$"),
    _: Any = Depends(require_viewer),
):
    """Bucketed averages / p95 for a test."""
    svc = get_te_metrics_service()
    return await svc.get_aggregates(test_id, hours=hours, bucket=bucket)


@router.get("/bottlenecks")
async def te_metrics_bottlenecks(
    hours: int = Query(24, ge=1, le=168),
    _: Any = Depends(require_viewer),
):
    """Tests with consistently high latency or packet loss."""
    svc = get_te_metrics_service()
    return await svc.get_bottleneck_analysis(hours=hours)


@router.get("/trends")
async def te_metrics_trends(_: Any = Depends(require_viewer)):
    """Per-test 1h vs 24h latency comparison with degradation flags."""
    svc = get_te_metrics_service()
    return await svc.get_trend_summary()
