"""Knowledge feedback API routes.

Provides endpoints for:
- Submitting feedback on search results
- Recording implicit signals (clicks, time spent)
- Fetching feedback analytics
- Admin analytics dashboard data
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_db_session, get_current_user_optional, get_current_user_from_session
from src.services.feedback_service import FeedbackService
from src.models.knowledge_feedback import (
    FeedbackCreate,
    FeedbackResponse,
    FeedbackStats,
    QueryAnalytics,
    FeedbackType,
    ResolutionOutcome,
    ChunkOutcomeCreate,
    ChunkOutcomeResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge/feedback", tags=["knowledge-feedback"])

# Service instance
_feedback_service: Optional[FeedbackService] = None


def get_feedback_service() -> FeedbackService:
    """Get or create feedback service instance."""
    global _feedback_service
    if _feedback_service is None:
        _feedback_service = FeedbackService()
    return _feedback_service


# =============================================================================
# Feedback Submission
# =============================================================================

@router.post("", response_model=FeedbackResponse)
async def submit_feedback(
    feedback: FeedbackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Submit feedback on knowledge search results.

    Accepts both explicit feedback (thumbs up/down, ratings) and
    implicit signals (clicks, time spent).

    Args:
        feedback: Feedback data including query, chunk IDs, and feedback type
        request: FastAPI request object
        db: Database session
        current_user: Optional authenticated user

    Returns:
        Created feedback entry
    """
    try:
        service = get_feedback_service()

        # Get session ID from request if not authenticated
        session_id = request.cookies.get("session_id") or request.headers.get("X-Session-ID")
        user_id = current_user.get("id") if current_user else None

        result = await service.submit_feedback(
            session=db,
            feedback=feedback,
            user_id=user_id,
            session_id=session_id,
        )

        await db.commit()

        return FeedbackResponse(
            id=result.id,
            query=result.query,
            feedback_type=result.feedback_type,
            rating=result.rating,
            is_positive=result.is_positive,
            created_at=result.created_at,
        )

    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


@router.post("/click")
async def record_click(
    query_log_id: int,
    chunk_id: int,
    time_on_result_ms: Optional[int] = None,
    db: AsyncSession = Depends(get_db_session),
):
    """Record a click on a search result (implicit feedback).

    Args:
        query_log_id: ID of the query log entry
        chunk_id: ID of the clicked chunk
        time_on_result_ms: Optional time spent viewing the result
        db: Database session

    Returns:
        Success status
    """
    try:
        service = get_feedback_service()

        await service.record_click(
            session=db,
            query_log_id=query_log_id,
            chunk_id=chunk_id,
            time_on_result_ms=time_on_result_ms,
        )

        await db.commit()
        return {"success": True}

    except Exception as e:
        logger.error(f"Error recording click: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record click")


@router.post("/follow-up")
async def record_follow_up(
    original_query_log_id: int,
    follow_up_query: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Record a follow-up query (indicates incomplete answer).

    Args:
        original_query_log_id: ID of the original query log
        follow_up_query: The follow-up question
        db: Database session

    Returns:
        Success status
    """
    try:
        service = get_feedback_service()

        await service.record_follow_up(
            session=db,
            original_query_log_id=original_query_log_id,
            follow_up_query=follow_up_query,
        )

        await db.commit()
        return {"success": True}

    except Exception as e:
        logger.error(f"Error recording follow-up: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record follow-up")


@router.post("/outcome", response_model=ChunkOutcomeResponse)
async def record_chunk_outcome(
    request: ChunkOutcomeCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Record resolution outcome for specific chunks.

    This endpoint enables fine-grained feedback on whether retrieved chunks
    actually helped resolve the user's issue. This data is used to improve
    future retrieval through resolution-weighted boosting.

    Outcome types:
    - **resolved**: Chunk fully resolved the issue
    - **partial**: Chunk was partially helpful
    - **unhelpful**: Chunk didn't help at all
    - **incorrect**: Chunk led to wrong direction/advice

    Example request:
    ```json
    {
        "query_log_id": 123,
        "chunk_outcomes": {
            "456": "resolved",
            "789": "partial",
            "101": "unhelpful"
        },
        "notes": "The first chunk had the exact solution"
    }
    ```

    Args:
        request: Chunk outcome data including query_log_id, chunk_outcomes mapping, and optional notes
        db: Database session
        current_user: Authenticated user

    Returns:
        Summary of recorded outcomes
    """
    try:
        service = get_feedback_service()

        # Convert string outcomes to ResolutionOutcome enum
        chunk_outcomes = {}
        for chunk_id_str, outcome_str in request.chunk_outcomes.items():
            try:
                chunk_id = int(chunk_id_str)
                outcome = ResolutionOutcome(outcome_str)
                chunk_outcomes[chunk_id] = outcome
            except (ValueError, KeyError) as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid chunk_id or outcome: {chunk_id_str}={outcome_str}. "
                           f"Valid outcomes: resolved, partial, unhelpful, incorrect"
                )

        if not chunk_outcomes:
            raise HTTPException(status_code=400, detail="No valid chunk outcomes provided")

        recorded = await service.record_chunk_outcome(
            session=db,
            query_log_id=request.query_log_id,
            chunk_outcomes=chunk_outcomes,
            resolution_notes=request.notes,
            user_id=current_user.id if hasattr(current_user, 'id') else current_user.get("id"),
        )

        return ChunkOutcomeResponse(
            status="recorded",
            chunks_updated=len(recorded),
            outcomes_recorded=recorded,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording chunk outcome: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record chunk outcome")


# =============================================================================
# Feedback Types
# =============================================================================

@router.get("/types")
async def get_feedback_types():
    """Get available feedback types.

    Returns:
        List of feedback types with descriptions
    """
    return {
        "types": [
            {"value": "positive", "label": "Helpful", "icon": "thumbs-up"},
            {"value": "negative", "label": "Not Helpful", "icon": "thumbs-down"},
            {"value": "rating", "label": "Rate (1-5)", "icon": "star"},
            {"value": "report", "label": "Report Issue", "icon": "flag"},
        ],
        "issues": [
            {"value": "inaccurate", "label": "Information is inaccurate"},
            {"value": "incomplete", "label": "Answer is incomplete"},
            {"value": "outdated", "label": "Information is outdated"},
            {"value": "irrelevant", "label": "Results not relevant"},
            {"value": "confusing", "label": "Response is confusing"},
        ],
        "resolution_outcomes": [
            {"value": "resolved", "label": "Resolved my issue", "icon": "check-circle", "color": "green"},
            {"value": "partial", "label": "Partially helpful", "icon": "circle-half", "color": "yellow"},
            {"value": "unhelpful", "label": "Not helpful", "icon": "x-circle", "color": "gray"},
            {"value": "incorrect", "label": "Incorrect/misleading", "icon": "exclamation-circle", "color": "red"},
        ],
    }


# =============================================================================
# Analytics (Admin)
# =============================================================================

@router.get("/stats", response_model=FeedbackStats)
async def get_feedback_stats(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Get aggregated feedback statistics.

    Requires authentication. Shows user's own stats unless admin.

    Args:
        days: Number of days to include (default 30)
        db: Database session
        current_user: Authenticated user

    Returns:
        Aggregated feedback statistics
    """
    try:
        service = get_feedback_service()

        # Admins see all, others see their own
        user_id = None if current_user.get("role") == "admin" else current_user.get("id")

        stats = await service.get_feedback_stats(
            session=db,
            days=days,
            user_id=user_id,
        )

        return stats

    except Exception as e:
        logger.error(f"Error getting feedback stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get feedback stats")


@router.get("/analytics", response_model=QueryAnalytics)
async def get_query_analytics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Get query analytics summary.

    Admin only - provides insights into knowledge base usage.

    Args:
        days: Number of days to include (default 30)
        db: Database session
        current_user: Authenticated user (must be admin)

    Returns:
        Query analytics data
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        service = get_feedback_service()

        analytics = await service.get_query_analytics(
            session=db,
            days=days,
        )

        return analytics

    except Exception as e:
        logger.error(f"Error getting query analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")


@router.get("/problematic-queries")
async def get_problematic_queries(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Get queries with negative feedback or no results.

    Admin only - useful for identifying gaps in the knowledge base.

    Args:
        limit: Maximum results to return
        db: Database session
        current_user: Authenticated user (must be admin)

    Returns:
        List of problematic queries with details
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        service = get_feedback_service()

        queries = await service.get_problematic_queries(
            session=db,
            limit=limit,
        )

        return {"queries": queries}

    except Exception as e:
        logger.error(f"Error getting problematic queries: {e}")
        raise HTTPException(status_code=500, detail="Failed to get queries")


@router.get("/top-chunks")
async def get_top_performing_chunks(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Get chunks with best feedback scores.

    Admin only - identifies most helpful content.

    Args:
        limit: Maximum results to return
        db: Database session
        current_user: Authenticated user (must be admin)

    Returns:
        List of top chunks with stats
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        service = get_feedback_service()

        chunks = await service.get_top_performing_chunks(
            session=db,
            limit=limit,
        )

        return {"chunks": chunks}

    except Exception as e:
        logger.error(f"Error getting top chunks: {e}")
        raise HTTPException(status_code=500, detail="Failed to get chunks")


# =============================================================================
# Admin Actions
# =============================================================================

@router.post("/recompute-scores")
async def recompute_helpfulness_scores(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Recompute helpfulness scores for all chunks.

    Admin only - triggers recalculation of feedback-based scores
    using Wilson score interval.

    Args:
        db: Database session
        current_user: Authenticated user (must be admin)

    Returns:
        Number of chunks updated
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        service = get_feedback_service()

        updated_count = await service.recompute_helpfulness_scores(session=db)
        await db.commit()

        return {
            "success": True,
            "chunks_updated": updated_count,
        }

    except Exception as e:
        logger.error(f"Error recomputing scores: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to recompute scores")
