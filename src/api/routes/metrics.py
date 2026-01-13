"""API routes for A2A agent routing metrics and monitoring.

This module exposes metrics for agent performance tracking,
routing feedback, and system monitoring for the A2A multi-agent system.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel, Field

from src.api.dependencies import require_viewer, require_admin

router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================

class AgentStatsResponse(BaseModel):
    """Statistics for a single agent."""
    agent_id: str
    total_queries: int = 0
    success_rate: float = 0.0
    avg_quality_score: float = 0.0
    avg_response_time_ms: float = 0.0
    recent_errors: List[str] = Field(default_factory=list)


class RoutingMetricsResponse(BaseModel):
    """Overall routing metrics response."""
    agents: Dict[str, AgentStatsResponse]
    total_queries: int = 0
    overall_success_rate: float = 0.0
    timestamp: str


class RecentOutcome(BaseModel):
    """A recent routing outcome."""
    query: str
    agent_id: str
    success: bool
    quality_score: float
    response_time_ms: int
    timestamp: str
    error_type: Optional[str] = None


class PerformanceTrendPoint(BaseModel):
    """A single point in performance trend."""
    timestamp: str
    success_rate: float
    avg_quality: float
    query_count: int


class PerformanceTrendResponse(BaseModel):
    """Performance trend over time."""
    agent_id: str
    trend: List[PerformanceTrendPoint]
    period: str


class UserFeedbackRequest(BaseModel):
    """Request to record user feedback."""
    session_id: str
    feedback: str = Field(..., pattern="^(helpful|not_helpful)$")
    comment: Optional[str] = None


class CollaborationMetrics(BaseModel):
    """Metrics for multi-agent collaboration."""
    total_collaborative_queries: int = 0
    cross_references_found: int = 0
    avg_agents_per_query: float = 0.0
    most_common_collaborations: List[Dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# Metrics Endpoints
# ============================================================================

@router.get("/api/metrics/routing", response_model=RoutingMetricsResponse, dependencies=[Depends(require_viewer)])
async def get_routing_metrics():
    """Get routing feedback metrics for all agents.

    Returns aggregated statistics for each specialist agent including:
    - Total queries handled
    - Success rate
    - Average quality score
    - Average response time
    - Recent errors
    """
    from src.a2a.feedback import get_feedback_tracker

    tracker = get_feedback_tracker()
    all_stats = tracker.get_all_agent_stats()

    # Transform to response format
    agents = {}
    total_queries = 0
    total_successes = 0

    for agent_id, stats in all_stats.items():
        if stats:
            agents[agent_id] = AgentStatsResponse(
                agent_id=agent_id,
                total_queries=stats.get("total_queries", 0),
                success_rate=stats.get("success_rate", 0.0),
                avg_quality_score=stats.get("avg_quality", 0.0),
                avg_response_time_ms=stats.get("avg_response_time_ms", 0.0),
                recent_errors=stats.get("recent_errors", [])[:5],
            )
            total_queries += stats.get("total_queries", 0)
            total_successes += int(stats.get("total_queries", 0) * stats.get("success_rate", 0.0))

    overall_success_rate = total_successes / total_queries if total_queries > 0 else 0.0

    return RoutingMetricsResponse(
        agents=agents,
        total_queries=total_queries,
        overall_success_rate=overall_success_rate,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/api/metrics/routing/recent", dependencies=[Depends(require_viewer)])
async def get_recent_routing_outcomes(
    limit: int = Query(default=20, ge=1, le=100, description="Number of outcomes to return")
):
    """Get recent routing outcomes.

    Returns the most recent routing decisions with their outcomes,
    useful for debugging and monitoring routing behavior.
    """
    from src.a2a.feedback import get_feedback_tracker

    tracker = get_feedback_tracker()
    recent = tracker.get_recent_outcomes(limit=limit)

    outcomes = []
    for outcome in recent:
        outcomes.append(RecentOutcome(
            query=outcome.query[:100] if outcome.query else "",
            agent_id=outcome.agent_id,
            success=outcome.success,
            quality_score=outcome.quality_score,
            response_time_ms=outcome.response_time_ms,
            timestamp=outcome.timestamp.isoformat() if outcome.timestamp else "",
            error_type=outcome.error_type,
        ))

    return {
        "outcomes": outcomes,
        "count": len(outcomes),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/metrics/routing/{agent_id}/trend", response_model=PerformanceTrendResponse, dependencies=[Depends(require_viewer)])
async def get_agent_performance_trend(
    agent_id: str,
    period: str = Query(default="24h", pattern="^(1h|6h|24h|7d|30d)$", description="Time period for trend")
):
    """Get performance trend for a specific agent.

    Returns time-series data showing how an agent's performance
    has changed over the specified period.

    Periods: 1h, 6h, 24h, 7d, 30d
    """
    from src.a2a.feedback import get_feedback_tracker

    tracker = get_feedback_tracker()

    # Calculate time windows
    period_hours = {
        "1h": 1,
        "6h": 6,
        "24h": 24,
        "7d": 168,
        "30d": 720,
    }

    hours = period_hours.get(period, 24)
    trend_data = tracker.get_performance_trend(agent_id, hours=hours)

    trend_points = []
    for point in trend_data:
        trend_points.append(PerformanceTrendPoint(
            timestamp=point.get("timestamp", ""),
            success_rate=point.get("success_rate", 0.0),
            avg_quality=point.get("avg_quality", 0.0),
            query_count=point.get("query_count", 0),
        ))

    return PerformanceTrendResponse(
        agent_id=agent_id,
        trend=trend_points,
        period=period,
    )


@router.get("/api/metrics/routing/{agent_id}", response_model=AgentStatsResponse, dependencies=[Depends(require_viewer)])
async def get_agent_stats(agent_id: str):
    """Get detailed statistics for a specific agent.

    Returns comprehensive metrics for a single specialist agent.
    """
    from src.a2a.feedback import get_feedback_tracker

    tracker = get_feedback_tracker()
    stats = tracker.get_agent_stats(agent_id)

    if not stats:
        raise HTTPException(
            status_code=404,
            detail=f"No statistics found for agent '{agent_id}'. "
                   "The agent may not have handled any queries yet."
        )

    return AgentStatsResponse(
        agent_id=agent_id,
        total_queries=stats.get("total_queries", 0),
        success_rate=stats.get("success_rate", 0.0),
        avg_quality_score=stats.get("avg_quality", 0.0),
        avg_response_time_ms=stats.get("avg_response_time_ms", 0.0),
        recent_errors=stats.get("recent_errors", [])[:10],
    )


@router.post("/api/metrics/routing/feedback", dependencies=[Depends(require_viewer)])
async def record_user_feedback(feedback: UserFeedbackRequest, request: Request):
    """Record explicit user feedback for a session.

    Allows users to provide thumbs up/down feedback on agent responses,
    which is used to improve routing decisions over time.
    """
    from src.a2a.feedback import get_feedback_tracker
    from src.api.utils.audit import log_audit

    tracker = get_feedback_tracker()
    tracker.record_user_feedback(feedback.session_id, feedback.feedback)

    await log_audit(
        request=request,
        action="user_feedback_recorded",
        resource_type="agent_feedback",
        resource_id=feedback.session_id,
        details={
            "feedback": feedback.feedback,
            "comment": feedback.comment,
        }
    )

    return {
        "success": True,
        "message": f"Feedback '{feedback.feedback}' recorded for session {feedback.session_id}",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/metrics/collaboration", response_model=CollaborationMetrics, dependencies=[Depends(require_viewer)])
async def get_collaboration_metrics():
    """Get metrics for multi-agent collaboration.

    Returns statistics about collaborative workflows including:
    - Total collaborative queries
    - Cross-references found between agents
    - Average agents per collaborative query
    - Most common agent collaboration pairs
    """
    from src.a2a.feedback import get_feedback_tracker

    tracker = get_feedback_tracker()
    collab_stats = tracker.get_collaboration_stats() if hasattr(tracker, 'get_collaboration_stats') else {}

    return CollaborationMetrics(
        total_collaborative_queries=collab_stats.get("total_collaborative", 0),
        cross_references_found=collab_stats.get("cross_references", 0),
        avg_agents_per_query=collab_stats.get("avg_agents", 0.0),
        most_common_collaborations=collab_stats.get("common_pairs", []),
    )


@router.post("/api/metrics/routing/refresh", dependencies=[Depends(require_admin)])
async def refresh_performance_scores(request: Request):
    """Refresh agent performance scores from feedback data.

    Recalculates performance scores used for adaptive routing.
    Requires ADMIN role.
    """
    from src.a2a.enhanced_orchestrator import get_enhanced_orchestrator
    from src.api.utils.audit import log_audit

    orchestrator = get_enhanced_orchestrator()
    orchestrator.refresh_performance_scores()

    await log_audit(
        request=request,
        action="performance_scores_refreshed",
        resource_type="agent_metrics",
        resource_id="all",
        details={}
    )

    return {
        "success": True,
        "message": "Performance scores refreshed from feedback data",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/metrics/routing/summary", dependencies=[Depends(require_viewer)])
async def get_routing_summary():
    """Get a summary of routing performance.

    Returns a high-level overview of the A2A routing system including:
    - Agent health status
    - Overall routing effectiveness
    - Recent trends
    """
    from src.a2a.feedback import get_feedback_tracker
    from src.a2a.enhanced_orchestrator import get_enhanced_orchestrator

    tracker = get_feedback_tracker()
    orchestrator = get_enhanced_orchestrator()

    all_stats = tracker.get_all_agent_stats()

    # Calculate summary metrics
    healthy_agents = 0
    degraded_agents = 0
    unhealthy_agents = 0

    for agent_id, stats in all_stats.items():
        if stats:
            success_rate = stats.get("success_rate", 0.0)
            if success_rate >= 0.9:
                healthy_agents += 1
            elif success_rate >= 0.7:
                degraded_agents += 1
            else:
                unhealthy_agents += 1

    # Get recent activity
    recent = tracker.get_recent_outcomes(limit=100)
    recent_success_rate = sum(1 for o in recent if o.success) / len(recent) if recent else 0.0

    return {
        "summary": {
            "total_agents_tracked": len(all_stats),
            "healthy_agents": healthy_agents,
            "degraded_agents": degraded_agents,
            "unhealthy_agents": unhealthy_agents,
        },
        "recent_activity": {
            "queries_last_100": len(recent),
            "success_rate": recent_success_rate,
        },
        "multi_domain_patterns": len(orchestrator.MULTI_DOMAIN_PATTERNS),
        "recovery_agents_configured": len(orchestrator.AGENT_RECOVERY_MAP),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================================
# Cache and Vocabulary Metrics
# ============================================================================

class CacheStatsResponse(BaseModel):
    """Cache statistics response."""
    entries: int = 0
    valid: int = 0
    expired: int = 0
    ttl_seconds: int = 0


class VocabularyStatsResponse(BaseModel):
    """Vocabulary statistics response."""
    total_terms: int = 0
    promoted_terms: int = 0
    promotion_candidates: int = 0
    by_category: Dict[str, int] = Field(default_factory=dict)
    min_occurrences: int = 0
    max_terms: int = 0


class SystemSettingsResponse(BaseModel):
    """System settings overview response."""
    time_range: Dict[str, Any] = Field(default_factory=dict)
    response: Dict[str, Any] = Field(default_factory=dict)
    cache: Dict[str, Any] = Field(default_factory=dict)
    collaboration: Dict[str, Any] = Field(default_factory=dict)
    routing: Dict[str, Any] = Field(default_factory=dict)
    feedback: Dict[str, Any] = Field(default_factory=dict)
    vocabulary: Dict[str, Any] = Field(default_factory=dict)
    feature_flags: Dict[str, bool] = Field(default_factory=dict)


@router.get("/api/metrics/vocabulary", response_model=VocabularyStatsResponse, dependencies=[Depends(require_viewer)])
async def get_vocabulary_metrics():
    """Get vocabulary learning metrics.

    Returns statistics about the vocabulary expansion system including:
    - Total learned terms
    - Terms promoted to active vocabulary
    - Terms awaiting promotion
    - Term categories distribution
    """
    from src.services.query_preprocessor import get_vocabulary_expander

    expander = get_vocabulary_expander()
    stats = expander.get_stats()

    return VocabularyStatsResponse(
        total_terms=stats.get("total_terms", 0),
        promoted_terms=stats.get("promoted_terms", 0),
        promotion_candidates=stats.get("promotion_candidates", 0),
        by_category=stats.get("by_category", {}),
        min_occurrences=stats.get("min_occurrences", 3),
        max_terms=stats.get("max_terms", 500),
    )


@router.post("/api/metrics/vocabulary/promote", dependencies=[Depends(require_admin)])
async def promote_vocabulary_terms(request: Request):
    """Promote learned terms to active vocabulary.

    Moves terms that meet the occurrence threshold into the
    active vocabulary for typo correction.
    Requires ADMIN role.
    """
    from src.services.query_preprocessor import get_vocabulary_expander, get_preprocessor
    from src.api.utils.audit import log_audit

    expander = get_vocabulary_expander()
    preprocessor = get_preprocessor()

    promoted_count = expander.promote_learned_terms(preprocessor)

    await log_audit(
        request=request,
        action="vocabulary_terms_promoted",
        resource_type="vocabulary",
        resource_id="all",
        details={"promoted_count": promoted_count}
    )

    return {
        "success": True,
        "promoted_count": promoted_count,
        "message": f"Promoted {promoted_count} terms to active vocabulary",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/api/metrics/vocabulary/term", dependencies=[Depends(require_admin)])
async def add_vocabulary_term(
    request: Request,
    term: str = Query(..., min_length=3, description="Term to add"),
    category: str = Query(default="general", description="Term category")
):
    """Manually add a term to the vocabulary.

    Allows administrators to add domain-specific terms that
    should be recognized by the system.
    Requires ADMIN role.
    """
    from src.services.query_preprocessor import get_vocabulary_expander
    from src.api.utils.audit import log_audit

    expander = get_vocabulary_expander()
    expander.add_domain_term(term, category, source="admin")

    await log_audit(
        request=request,
        action="vocabulary_term_added",
        resource_type="vocabulary",
        resource_id=term,
        details={"category": category}
    )

    return {
        "success": True,
        "term": term,
        "category": category,
        "message": f"Added term '{term}' to vocabulary",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/metrics/settings", response_model=SystemSettingsResponse, dependencies=[Depends(require_viewer)])
async def get_system_settings():
    """Get current agent system settings.

    Returns the active configuration for all agent behaviors.
    Useful for debugging and monitoring system configuration.
    """
    from src.config.agent_settings import get_agent_settings

    settings = get_agent_settings()
    config = settings.to_dict()

    return SystemSettingsResponse(
        time_range=config.get("time_range", {}),
        response=config.get("response", {}),
        cache=config.get("cache", {}),
        collaboration=config.get("collaboration", {}),
        routing=config.get("routing", {}),
        feedback=config.get("feedback", {}),
        vocabulary=config.get("vocabulary", {}),
        feature_flags=config.get("feature_flags", {}),
    )


@router.post("/api/metrics/settings/reload", dependencies=[Depends(require_admin)])
async def reload_system_settings(request: Request):
    """Reload system settings from configuration.

    Forces a reload of agent settings from environment and config files.
    Requires ADMIN role.
    """
    from src.config.agent_settings import reload_settings
    from src.api.utils.audit import log_audit

    settings = reload_settings()

    await log_audit(
        request=request,
        action="settings_reloaded",
        resource_type="configuration",
        resource_id="agent_settings",
        details={}
    )

    return {
        "success": True,
        "message": "Agent settings reloaded from configuration",
        "settings": settings.to_dict(),
        "timestamp": datetime.utcnow().isoformat(),
    }
