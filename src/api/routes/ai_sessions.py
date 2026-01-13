"""API routes for AI session tracking."""

from typing import Optional, List
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from src.api.dependencies import get_current_active_user
from src.services.ai_session_service import get_ai_session_service
from src.services.roi_calculator import get_roi_calculator, ROIMetrics
from src.services.efficiency_scorer import get_efficiency_scorer
from src.services.session_context_store import get_session_context_store
from src.models.ai_session import AISession, AISessionEvent
from src.models.incident import Incident, IncidentStatus
from src.models.user import User
from src.config.database import get_db
from src.config.roi_baselines import (
    ROI_BASELINES,
    SESSION_TYPES,
    DEFAULT_HOURLY_RATE,
    GOOD_ROI_THRESHOLD,
    WARNING_ROI_THRESHOLD,
    get_all_baselines_by_category,
)

router = APIRouter(prefix="/api/ai-sessions", tags=["ai-sessions"])


class StartSessionRequest(BaseModel):
    name: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    name: str


class LogEventRequest(BaseModel):
    event_type: str
    event_data: dict = {}
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    model: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_method: Optional[str] = None
    api_status: Optional[int] = None
    api_duration_ms: Optional[int] = None
    page_path: Optional[str] = None
    element_id: Optional[str] = None
    element_type: Optional[str] = None
    # ROI tracking fields
    duration_ms: Optional[int] = None       # How long this operation took
    action_type: Optional[str] = None       # Maps to ROI_BASELINES keys
    cost_usd: Optional[float] = None        # Calculated cost for this event


class CanvasCardStateRequest(BaseModel):
    """Request model for syncing canvas card state."""
    card_id: str
    card_type: str
    title: str
    data_summary: str = ""
    network_id: Optional[str] = None
    org_id: Optional[str] = None


class SyncCanvasStateRequest(BaseModel):
    """Request model for syncing full canvas state."""
    cards: List[CanvasCardStateRequest]


@router.post("/start")
async def start_session(
    request: StartSessionRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Start a new AI tracking session."""
    service = get_ai_session_service()
    session = await service.start_session(
        user_id=current_user.id,
        name=request.name
    )
    return {
        "id": session.id,
        "name": session.name,
        "status": session.status,
        "started_at": session.started_at.isoformat(),
    }


@router.post("/stop/{session_id}")
async def stop_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """Stop an AI tracking session and generate summary."""
    service = get_ai_session_service()
    session = await service.stop_session(session_id, current_user.id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or access denied"
        )

    return service._session_to_dict(session)


@router.get("/active")
async def get_active_session(
    current_user: User = Depends(get_current_active_user)
):
    """Get the current active session for the user (for recovery on page reload)."""
    service = get_ai_session_service()
    session = await service.get_active_session(current_user.id)

    if not session:
        return {"active": False, "session": None}

    return {
        "active": True,
        "session": service._session_to_dict(session)
    }


@router.post("/events")
async def log_event(
    request: LogEventRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Log an event to the active session."""
    service = get_ai_session_service()
    event = await service.log_event(
        user_id=current_user.id,
        event_type=request.event_type,
        event_data=request.event_data,
        input_tokens=request.input_tokens,
        output_tokens=request.output_tokens,
        model=request.model,
        api_endpoint=request.api_endpoint,
        api_method=request.api_method,
        api_status=request.api_status,
        api_duration_ms=request.api_duration_ms,
        page_path=request.page_path,
        element_id=request.element_id,
        element_type=request.element_type,
        duration_ms=request.duration_ms,
        action_type=request.action_type,
        cost_usd=request.cost_usd,
    )

    if not event:
        return {"logged": False, "reason": "No active session"}

    return {"logged": True, "event_id": event.id}


@router.get("/list")
async def list_sessions(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user)
):
    """List sessions for the current user (admins see all)."""
    service = get_ai_session_service()
    is_admin = current_user.role == "admin"

    sessions = await service.list_sessions(
        user_id=current_user.id,
        is_admin=is_admin,
        status=status,
        limit=limit,
        offset=offset,
    )

    return {"sessions": sessions, "count": len(sessions)}


@router.get("/{session_id}")
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """Get full session details including events."""
    service = get_ai_session_service()
    is_admin = current_user.role == "admin"

    session = await service.get_session_details(
        session_id=session_id,
        user_id=current_user.id,
        is_admin=is_admin,
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or access denied"
        )

    return session


@router.patch("/{session_id}")
async def update_session(
    session_id: int,
    request: UpdateSessionRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Update session name/tag."""
    service = get_ai_session_service()
    session = await service.update_session_name(
        session_id=session_id,
        user_id=current_user.id,
        name=request.name,
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or access denied"
        )

    return {"id": session.id, "name": session.name}


@router.post("/batch-events")
async def log_batch_events(
    events: List[LogEventRequest],
    current_user: User = Depends(get_current_active_user)
):
    """Log multiple events at once (for batched sending)."""
    service = get_ai_session_service()
    logged_count = 0

    for event_req in events:
        event = await service.log_event(
            user_id=current_user.id,
            event_type=event_req.event_type,
            event_data=event_req.event_data,
            input_tokens=event_req.input_tokens,
            output_tokens=event_req.output_tokens,
            model=event_req.model,
            api_endpoint=event_req.api_endpoint,
            api_method=event_req.api_method,
            api_status=event_req.api_status,
            api_duration_ms=event_req.api_duration_ms,
            page_path=event_req.page_path,
            element_id=event_req.element_id,
            element_type=event_req.element_type,
            duration_ms=event_req.duration_ms,
            action_type=event_req.action_type,
            cost_usd=event_req.cost_usd,
        )
        if event:
            logged_count += 1

    return {"logged": logged_count, "total": len(events)}


# =============================================================================
# ROI ENDPOINTS
# =============================================================================

@router.get("/{session_id}/roi")
async def get_session_roi(
    session_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive ROI metrics for a specific session."""
    db = get_db()
    is_admin = current_user.role == "admin"

    async with db.session() as session:
        # Get session with events
        stmt = select(AISession).options(
            selectinload(AISession.events)
        ).where(AISession.id == session_id)

        if not is_admin:
            stmt = stmt.where(AISession.user_id == current_user.id)

        result = await session.execute(stmt)
        ai_session = result.scalar_one_or_none()

        if not ai_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or access denied"
            )

        # Calculate ROI
        calculator = get_roi_calculator()
        metrics = calculator.calculate_session_roi(ai_session, ai_session.events)
        summary = calculator.get_roi_summary(metrics)

        return {
            "session_id": session_id,
            "session_name": ai_session.name,
            "metrics": {
                "time_saved_minutes": metrics.time_saved_minutes,
                "manual_cost_usd": metrics.manual_cost_usd,
                "ai_cost_usd": metrics.ai_cost_usd,
                "roi_percentage": metrics.roi_percentage,
                "efficiency_score": metrics.efficiency_score,
                "session_type": metrics.session_type,
                "complexity_score": metrics.complexity_score,
                "cost_breakdown": metrics.cost_breakdown,
                "avg_response_time_ms": metrics.avg_response_time_ms,
                "slowest_query_ms": metrics.slowest_query_ms,
                "total_duration_ms": metrics.total_duration_ms,
            },
            "summary": summary,
        }


@router.get("/roi/dashboard")
async def get_roi_dashboard(
    days: int = Query(default=30, ge=1, le=90),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get aggregate ROI dashboard metrics.

    Returns time saved, costs, ROI trends, and session breakdown.
    Structured to match frontend ROIDashboard interface.
    """
    db = get_db()
    is_admin = current_user.role == "admin"
    calculator = get_roi_calculator()
    scorer = get_efficiency_scorer()

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    prev_period_start = cutoff_date - timedelta(days=days)

    async with db.session() as session:
        # Base filter for current period
        base_filter = and_(
            AISession.started_at >= cutoff_date
        )
        if not is_admin:
            base_filter = and_(base_filter, AISession.user_id == current_user.id)

        # Get all sessions (both active and completed)
        stmt = select(AISession).options(
            selectinload(AISession.events)
        ).where(base_filter).order_by(AISession.started_at.desc())

        result = await session.execute(stmt)
        all_sessions = result.scalars().all()

        # Get previous period sessions for week-over-week comparison
        prev_filter = and_(
            AISession.started_at >= prev_period_start,
            AISession.started_at < cutoff_date
        )
        if not is_admin:
            prev_filter = and_(prev_filter, AISession.user_id == current_user.id)

        prev_stmt = select(AISession).options(
            selectinload(AISession.events)
        ).where(prev_filter)

        prev_result = await session.execute(prev_stmt)
        prev_sessions = prev_result.scalars().all()

        # Separate completed sessions
        completed_sessions = [s for s in all_sessions if s.status == "completed"]
        prev_completed = [s for s in prev_sessions if s.status == "completed"]

        # Aggregate metrics for current period
        total_time_saved = 0.0
        total_manual_cost = 0.0
        total_ai_cost = 0.0
        efficiency_scores = []
        sessions_with_roi = 0

        for ai_session in completed_sessions:
            metrics = calculator.calculate_session_roi(ai_session, ai_session.events)

            total_time_saved += metrics.time_saved_minutes
            total_manual_cost += metrics.manual_cost_usd
            total_ai_cost += metrics.ai_cost_usd
            efficiency_scores.append(metrics.efficiency_score)

            if metrics.roi_percentage and metrics.roi_percentage > 0:
                sessions_with_roi += 1

        # Aggregate metrics for previous period (for comparison)
        prev_time_saved = 0.0
        prev_ai_cost = 0.0
        prev_roi_scores = []

        for ai_session in prev_completed:
            metrics = calculator.calculate_session_roi(ai_session, ai_session.events)
            prev_time_saved += metrics.time_saved_minutes
            prev_ai_cost += metrics.ai_cost_usd
            if metrics.roi_percentage:
                prev_roi_scores.append(metrics.roi_percentage)

        # Calculate overall ROI
        overall_roi = ((total_manual_cost - total_ai_cost) / total_ai_cost * 100) if total_ai_cost > 0 else 0
        prev_overall_roi = sum(prev_roi_scores) / len(prev_roi_scores) if prev_roi_scores else 0

        # Calculate averages
        avg_efficiency = sum(efficiency_scores) / len(efficiency_scores) if efficiency_scores else 0

        # Calculate MTTR improvement from incident-linked sessions
        incident_sessions = [s for s in completed_sessions if s.incident_id and s.incident_resolved]
        mttr_improvement_pct = None
        if incident_sessions:
            mttr_comparison = scorer.get_mttr_comparison(incident_sessions)
            mttr_improvement_pct = mttr_comparison.improvement_percentage

        # Calculate week-over-week changes
        week_over_week = None
        if prev_completed:
            sessions_change = ((len(completed_sessions) - len(prev_completed)) / len(prev_completed) * 100) if prev_completed else 0
            cost_change = ((total_ai_cost - prev_ai_cost) / prev_ai_cost * 100) if prev_ai_cost > 0 else 0
            time_saved_change = ((total_time_saved - prev_time_saved) / prev_time_saved * 100) if prev_time_saved > 0 else 0
            roi_change = overall_roi - prev_overall_roi

            week_over_week = {
                "sessions_change": round(sessions_change, 1),
                "cost_change": round(cost_change, 1),
                "roi_change": round(roi_change, 1),
                "time_saved_change": round(time_saved_change, 1),
            }

        # Return flat structure matching frontend ROIDashboard interface
        return {
            "total_sessions": len(all_sessions),
            "completed_sessions": len(completed_sessions),
            "total_cost_usd": round(total_ai_cost, 4),
            "total_time_saved_minutes": round(total_time_saved, 2),
            "total_manual_cost_estimate_usd": round(total_manual_cost, 2),
            "avg_roi_percentage": round(overall_roi, 1),
            "avg_efficiency_score": round(avg_efficiency),
            "sessions_with_roi": sessions_with_roi,
            "mttr_improvement_pct": round(mttr_improvement_pct, 1) if mttr_improvement_pct else None,
            "week_over_week": week_over_week,
            # Keep legacy fields for backward compatibility
            "period_days": days,
            "thresholds": {
                "good_roi": GOOD_ROI_THRESHOLD,
                "warning_roi": WARNING_ROI_THRESHOLD,
                "hourly_rate": DEFAULT_HOURLY_RATE,
            }
        }


@router.get("/roi/baselines")
async def get_roi_baselines(
    current_user: User = Depends(get_current_active_user)
):
    """Get the ROI baseline definitions for UI display and configuration."""
    baselines_by_category = get_all_baselines_by_category()

    return {
        "baselines": {
            category.value: [
                {
                    "action_type": item["action_type"],
                    "manual_minutes": item["manual_minutes"],
                    "confidence": item["confidence"],
                    "description": item["description"],
                }
                for item in items
            ]
            for category, items in baselines_by_category.items()
        },
        "session_types": {
            key: {
                "display_name": val["display_name"],
                "description": val["description"],
            }
            for key, val in SESSION_TYPES.items()
        },
        "config": {
            "default_hourly_rate": DEFAULT_HOURLY_RATE,
            "good_roi_threshold": GOOD_ROI_THRESHOLD,
            "warning_roi_threshold": WARNING_ROI_THRESHOLD,
        }
    }


@router.get("/roi/comparison")
async def get_roi_comparison(
    current_period_days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get before/after comparison metrics for ROI visualization.

    Compares current period with previous period of same length.
    """
    db = get_db()
    is_admin = current_user.role == "admin"
    calculator = get_roi_calculator()

    now = datetime.now(timezone.utc)
    current_start = now - timedelta(days=current_period_days)
    previous_start = current_start - timedelta(days=current_period_days)

    async with db.session() as session:
        # Get current period sessions
        current_filter = and_(
            AISession.status == "completed",
            AISession.started_at >= current_start,
            AISession.started_at < now
        )
        if not is_admin:
            current_filter = and_(current_filter, AISession.user_id == current_user.id)

        stmt = select(AISession).options(
            selectinload(AISession.events)
        ).where(current_filter)
        result = await session.execute(stmt)
        current_sessions = result.scalars().all()

        # Get previous period sessions
        previous_filter = and_(
            AISession.status == "completed",
            AISession.started_at >= previous_start,
            AISession.started_at < current_start
        )
        if not is_admin:
            previous_filter = and_(previous_filter, AISession.user_id == current_user.id)

        stmt = select(AISession).options(
            selectinload(AISession.events)
        ).where(previous_filter)
        result = await session.execute(stmt)
        previous_sessions = result.scalars().all()

        def calculate_period_metrics(sessions_list):
            time_saved = 0.0
            ai_cost = 0.0
            manual_cost = 0.0
            for s in sessions_list:
                m = calculator.calculate_session_roi(s, s.events)
                time_saved += m.time_saved_minutes
                ai_cost += m.ai_cost_usd
                manual_cost += m.manual_cost_usd
            return {
                "session_count": len(sessions_list),
                "time_saved_minutes": round(time_saved, 2),
                "ai_cost_usd": round(ai_cost, 4),
                "manual_cost_usd": round(manual_cost, 2),
                "roi_percentage": round(((manual_cost - ai_cost) / ai_cost * 100) if ai_cost > 0 else 0, 1),
            }

        current_metrics = calculate_period_metrics(current_sessions)
        previous_metrics = calculate_period_metrics(previous_sessions)

        # Calculate changes
        def calc_change(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100, 1)

        return {
            "period_days": current_period_days,
            "current_period": {
                "start": current_start.isoformat(),
                "end": now.isoformat(),
                **current_metrics,
            },
            "previous_period": {
                "start": previous_start.isoformat(),
                "end": current_start.isoformat(),
                **previous_metrics,
            },
            "changes": {
                "session_count": calc_change(current_metrics["session_count"], previous_metrics["session_count"]),
                "time_saved": calc_change(current_metrics["time_saved_minutes"], previous_metrics["time_saved_minutes"]),
                "ai_cost": calc_change(current_metrics["ai_cost_usd"], previous_metrics["ai_cost_usd"]),
                "roi": calc_change(current_metrics["roi_percentage"], previous_metrics["roi_percentage"]),
            }
        }


# =============================================================================
# MTTR & EFFICIENCY ENDPOINTS
# =============================================================================

class LinkIncidentRequest(BaseModel):
    incident_id: int
    resolved: bool = False


@router.get("/{session_id}/efficiency")
async def get_session_efficiency(
    session_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed efficiency breakdown for a session."""
    db = get_db()
    is_admin = current_user.role == "admin"

    async with db.session() as session:
        # Get session with events
        stmt = select(AISession).options(
            selectinload(AISession.events)
        ).where(AISession.id == session_id)

        if not is_admin:
            stmt = stmt.where(AISession.user_id == current_user.id)

        result = await session.execute(stmt)
        ai_session = result.scalar_one_or_none()

        if not ai_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or access denied"
            )

        # Calculate efficiency breakdown
        scorer = get_efficiency_scorer()
        breakdown = scorer.calculate_efficiency_breakdown(ai_session, ai_session.events)
        summary = scorer.format_efficiency_summary(breakdown, ai_session)

        return {
            "session_id": session_id,
            "session_name": ai_session.name,
            **summary,
        }


@router.post("/{session_id}/link-incident")
async def link_session_to_incident(
    session_id: int,
    request: LinkIncidentRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Manually link a session to an incident."""
    service = get_ai_session_service()

    result = await service.link_session_to_incident_manual(
        session_id=session_id,
        incident_id=request.incident_id,
        user_id=current_user.id,
        resolved=request.resolved,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session or incident not found, or access denied"
        )

    return {
        "session_id": session_id,
        "incident_id": request.incident_id,
        "linked": True,
        "incident_resolved": result.incident_resolved,
        "resolution_time_minutes": float(result.resolution_time_minutes) if result.resolution_time_minutes else None,
    }


@router.get("/mttr/dashboard")
async def get_mttr_dashboard(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get MTTR (Mean Time to Resolution) dashboard.

    Shows AI-assisted incident resolution improvement vs baseline.
    """
    db = get_db()
    is_admin = current_user.role == "admin"
    scorer = get_efficiency_scorer()

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    async with db.session() as session:
        # Get incident-linked sessions
        base_filter = and_(
            AISession.status == "completed",
            AISession.started_at >= cutoff_date,
            AISession.incident_id.isnot(None)
        )
        if not is_admin:
            base_filter = and_(base_filter, AISession.user_id == current_user.id)

        stmt = select(AISession).where(base_filter).order_by(AISession.started_at.desc())
        result = await session.execute(stmt)
        incident_sessions = result.scalars().all()

        # Calculate MTTR comparison
        mttr_comparison = scorer.get_mttr_comparison(incident_sessions)

        # Get recent resolved incidents with details
        resolved_sessions = [
            s for s in incident_sessions
            if s.incident_resolved and s.resolution_time_minutes
        ]

        recent_resolved = []
        for s in resolved_sessions[:10]:  # Top 10 recent
            # Get incident details
            stmt = select(Incident).where(Incident.id == s.incident_id)
            inc_result = await session.execute(stmt)
            incident = inc_result.scalar_one_or_none()

            recent_resolved.append({
                "session_id": s.id,
                "session_name": s.name,
                "incident_id": s.incident_id,
                "incident_title": incident.title if incident else f"Incident #{s.incident_id}",
                "resolution_time_minutes": float(s.resolution_time_minutes),
                "baseline_minutes": scorer.MTTR_BASELINES.get("default", 30),
                "improvement_percentage": max(0, (
                    (scorer.MTTR_BASELINES.get("default", 30) - float(s.resolution_time_minutes))
                    / scorer.MTTR_BASELINES.get("default", 30) * 100
                )),
                "resolved_at": s.ended_at.isoformat() if s.ended_at else None,
            })

        # Calculate weekly trend
        weekly_mttr = {}
        for s in resolved_sessions:
            week_key = s.started_at.strftime("%Y-W%W")
            if week_key not in weekly_mttr:
                weekly_mttr[week_key] = {"total": 0, "count": 0}
            weekly_mttr[week_key]["total"] += float(s.resolution_time_minutes)
            weekly_mttr[week_key]["count"] += 1

        mttr_trend = [
            {
                "week": week,
                "avg_resolution_minutes": round(data["total"] / data["count"], 2),
                "incidents_resolved": data["count"],
            }
            for week, data in sorted(weekly_mttr.items())
        ]

        return {
            "period_days": days,
            "summary": {
                "baseline_mttr_minutes": mttr_comparison.baseline_minutes,
                "ai_assisted_mttr_minutes": round(mttr_comparison.ai_assisted_minutes, 2),
                "improvement_percentage": round(mttr_comparison.improvement_percentage, 1),
                "incidents_resolved": mttr_comparison.incidents_resolved,
                "total_time_saved_minutes": round(
                    mttr_comparison.avg_time_saved_per_incident * mttr_comparison.incidents_resolved, 2
                ),
            },
            "recent_resolved": recent_resolved,
            "weekly_trend": mttr_trend,
            "baselines": scorer.MTTR_BASELINES,
        }


@router.get("/mttr/incidents")
async def get_incident_sessions(
    incident_id: Optional[int] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user)
):
    """Get sessions linked to incidents, optionally filtered by incident ID."""
    db = get_db()
    is_admin = current_user.role == "admin"

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    async with db.session() as session:
        base_filter = and_(
            AISession.started_at >= cutoff_date,
            AISession.incident_id.isnot(None)
        )

        if incident_id:
            base_filter = and_(base_filter, AISession.incident_id == incident_id)

        if not is_admin:
            base_filter = and_(base_filter, AISession.user_id == current_user.id)

        stmt = select(AISession).where(base_filter).order_by(AISession.started_at.desc())
        result = await session.execute(stmt)
        sessions_list = result.scalars().all()

        # Get service for dict conversion
        service = get_ai_session_service()

        return {
            "sessions": [service._session_to_dict(s) for s in sessions_list],
            "count": len(sessions_list),
            "resolved_count": sum(1 for s in sessions_list if s.incident_resolved),
        }


# =============================================================================
# Canvas State Sync
# =============================================================================

@router.post("/{session_id}/canvas-state")
async def sync_canvas_state(
    session_id: str,
    request: SyncCanvasStateRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Sync canvas card state to the backend for AI context awareness.

    This endpoint allows the frontend to inform the backend about what
    visualization cards the user currently has on their canvas. This enables
    the AI to reference visible data and avoid suggesting duplicate cards.

    Args:
        session_id: The session ID (can be string UUID for AI context sessions)
        request: Canvas cards to sync

    Returns:
        Success confirmation with count of cards synced
    """
    context_store = get_session_context_store()

    # Convert request models to dicts for the context store
    cards = [
        {
            "card_id": card.card_id,
            "card_type": card.card_type,
            "title": card.title,
            "data_summary": card.data_summary,
            "network_id": card.network_id,
            "org_id": card.org_id,
        }
        for card in request.cards
    ]

    await context_store.update_canvas_state(session_id, cards)

    return {
        "success": True,
        "cards_synced": len(cards),
        "session_id": session_id,
    }


@router.get("/{session_id}/canvas-state")
async def get_canvas_state(
    session_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get current canvas state for a session.

    Returns:
        Current canvas cards and active card types
    """
    context_store = get_session_context_store()
    ctx = await context_store.get_or_create(session_id)

    return {
        "session_id": session_id,
        "cards": [c.to_dict() for c in ctx.canvas_cards],
        "active_card_types": ctx.active_card_types,
    }
