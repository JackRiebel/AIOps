"""API routes for dashboard aggregation (BFF pattern).

This module provides a single endpoint that aggregates all dashboard
data into one response, eliminating the "popcorn" loading effect.
"""

from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends

from src.api.dependencies import require_viewer
from src.services.dashboard_service import get_dashboard_summary

router = APIRouter()


@router.get("/api/dashboard/summary", dependencies=[Depends(require_viewer)])
async def dashboard_summary() -> Dict[str, Any]:
    """Get aggregated dashboard summary data.

    This endpoint consolidates multiple API calls into a single response:
    - Health status
    - Organizations/clusters list
    - Cost summary (30 days)
    - Daily cost breakdown (14 days)
    - Incidents (24h and 7d)
    - Integration configuration
    - Audit logs
    - Incident velocity metrics
    - Activity feed

    Returns:
        Dict containing all dashboard sections with data
    """
    return await get_dashboard_summary()
