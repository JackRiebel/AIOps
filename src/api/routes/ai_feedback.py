"""AI response feedback API routes.

Provides endpoints for:
- Submitting thumbs up/down feedback on AI chat responses
- Recording detailed feedback with categories
- Fetching feedback analytics (admin)

Part of Lumen AI Canvas Phase 1 implementation.
"""

import logging
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from src.api.dependencies import get_db_session, get_current_user_optional, get_current_user_from_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/feedback", tags=["ai-feedback"])


# =============================================================================
# Request/Response Models
# =============================================================================

class AIFeedbackCreate(BaseModel):
    """Create AI response feedback."""
    message_id: str = Field(..., description="ID of the AI message being rated")
    feedback_type: str = Field(..., pattern="^(positive|negative)$", description="positive or negative")
    feedback_text: Optional[str] = Field(None, max_length=1000, description="Optional detailed feedback")
    feedback_categories: Optional[List[str]] = Field(None, description="Feedback categories like inaccurate, slow")
    session_id: Optional[str] = Field(None, description="AI session ID")
    chat_session_id: Optional[str] = Field(None, description="Chat session ID for persistence")
    query: Optional[str] = Field(None, max_length=2000, description="The original user query")
    response_preview: Optional[str] = Field(None, max_length=500, description="First part of AI response")
    tools_used: Optional[List[str]] = Field(None, description="Tools used in generating response")
    model: Optional[str] = Field(None, description="AI model used")
    latency_ms: Optional[int] = Field(None, ge=0, description="Response time in ms")
    token_count: Optional[int] = Field(None, ge=0, description="Total tokens used")


class AIFeedbackResponse(BaseModel):
    """Response after submitting feedback."""
    id: int
    message_id: str
    feedback_type: str
    created_at: datetime


class AIFeedbackStats(BaseModel):
    """Aggregated feedback statistics."""
    total_feedback: int
    positive_count: int
    negative_count: int
    positive_rate: float
    common_issues: List[dict]
    recent_negative: List[dict]


# =============================================================================
# Feedback Submission
# =============================================================================

@router.post("", response_model=AIFeedbackResponse)
async def submit_ai_feedback(
    feedback: AIFeedbackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Submit feedback on an AI chat response.

    Records whether the AI response was helpful (positive) or not (negative).
    Optionally includes detailed feedback text and categories.

    Args:
        feedback: Feedback data
        request: FastAPI request object
        db: Database session
        current_user: Optional authenticated user

    Returns:
        Created feedback entry
    """
    try:
        user_id = current_user.get("id") if current_user else None

        # Insert feedback into database
        result = await db.execute(
            text("""
                INSERT INTO ai_response_feedback (
                    session_id, message_id, chat_session_id, feedback_type,
                    feedback_text, feedback_categories, user_id, model,
                    query, response_preview, tools_used, latency_ms, token_count
                ) VALUES (
                    :session_id, :message_id, :chat_session_id, :feedback_type,
                    :feedback_text, :feedback_categories, :user_id, :model,
                    :query, :response_preview, :tools_used, :latency_ms, :token_count
                )
                RETURNING id, message_id, feedback_type, created_at
            """),
            {
                "session_id": feedback.session_id,
                "message_id": feedback.message_id,
                "chat_session_id": feedback.chat_session_id,
                "feedback_type": feedback.feedback_type,
                "feedback_text": feedback.feedback_text,
                "feedback_categories": feedback.feedback_categories,
                "user_id": user_id,
                "model": feedback.model,
                "query": feedback.query,
                "response_preview": feedback.response_preview[:500] if feedback.response_preview else None,
                "tools_used": feedback.tools_used,
                "latency_ms": feedback.latency_ms,
                "token_count": feedback.token_count,
            }
        )

        row = result.fetchone()
        await db.commit()

        logger.info(f"AI feedback recorded: {feedback.feedback_type} for message {feedback.message_id}")

        return AIFeedbackResponse(
            id=row.id,
            message_id=row.message_id,
            feedback_type=row.feedback_type,
            created_at=row.created_at,
        )

    except Exception as e:
        logger.error(f"Error submitting AI feedback: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


# =============================================================================
# Feedback Analytics (Admin)
# =============================================================================

@router.get("/stats", response_model=AIFeedbackStats)
async def get_ai_feedback_stats(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Get aggregated AI feedback statistics.

    Requires admin role. Provides insights into AI response quality.

    Args:
        days: Number of days to include (default 30)
        db: Database session
        current_user: Authenticated user

    Returns:
        Aggregated feedback statistics
    """
    # Check admin role
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        count_result = await db.execute(
            text("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive,
                    COUNT(*) FILTER (WHERE feedback_type = 'negative') as negative
                FROM ai_response_feedback
                WHERE created_at > :cutoff
            """),
            {"cutoff": cutoff}
        )
        counts = count_result.fetchone()

        total = counts.total or 0
        positive = counts.positive or 0
        negative = counts.negative or 0
        positive_rate = positive / total if total > 0 else 0.0

        # Get common issues from negative feedback
        issues_result = await db.execute(
            text("""
                SELECT unnest(feedback_categories) as category, COUNT(*) as count
                FROM ai_response_feedback
                WHERE feedback_type = 'negative'
                  AND feedback_categories IS NOT NULL
                  AND created_at > :cutoff
                GROUP BY category
                ORDER BY count DESC
                LIMIT 5
            """),
            {"cutoff": cutoff}
        )
        common_issues = [{"category": r.category, "count": r.count} for r in issues_result.fetchall()]

        # Get recent negative feedback
        cutoff_7d = datetime.utcnow() - timedelta(days=7)
        recent_result = await db.execute(
            text("""
                SELECT message_id, query, feedback_text, created_at
                FROM ai_response_feedback
                WHERE feedback_type = 'negative'
                  AND created_at > :cutoff
                ORDER BY created_at DESC
                LIMIT 10
            """),
            {"cutoff": cutoff_7d}
        )
        recent_negative = [
            {
                "message_id": r.message_id,
                "query": r.query,
                "feedback_text": r.feedback_text,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recent_result.fetchall()
        ]

        return AIFeedbackStats(
            total_feedback=total,
            positive_count=positive,
            negative_count=negative,
            positive_rate=positive_rate,
            common_issues=common_issues,
            recent_negative=recent_negative,
        )

    except Exception as e:
        logger.error(f"Error getting AI feedback stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get feedback stats")


@router.get("/types")
async def get_feedback_types():
    """Get available feedback types and categories.

    Returns:
        List of feedback types and issue categories
    """
    return {
        "types": [
            {"value": "positive", "label": "Helpful", "icon": "thumbs-up"},
            {"value": "negative", "label": "Not Helpful", "icon": "thumbs-down"},
        ],
        "categories": [
            {"value": "inaccurate", "label": "Information is inaccurate"},
            {"value": "incomplete", "label": "Answer is incomplete"},
            {"value": "slow", "label": "Response was too slow"},
            {"value": "irrelevant", "label": "Response not relevant to query"},
            {"value": "confusing", "label": "Response is confusing"},
            {"value": "wrong_tool", "label": "Used wrong tool or data source"},
        ],
    }


@router.get("/analytics/detailed")
async def get_detailed_feedback_analytics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Get detailed AI feedback analytics for the dashboard.

    Provides comprehensive insights including:
    - Satisfaction trend over time
    - Feedback by model
    - Tool success rates
    - Response time correlation
    - User engagement metrics

    Requires admin role.

    Args:
        days: Number of days to analyze (default 30)
        db: Database session
        current_user: Authenticated user

    Returns:
        Detailed feedback analytics
    """
    # Check admin role
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        cutoff = datetime.utcnow() - timedelta(days=days)

        # 1. Daily trend
        trend_result = await db.execute(
            text("""
                SELECT
                    DATE(created_at) as date,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive,
                    COUNT(*) FILTER (WHERE feedback_type = 'negative') as negative
                FROM ai_response_feedback
                WHERE created_at > :cutoff
                GROUP BY DATE(created_at)
                ORDER BY date
            """),
            {"cutoff": cutoff}
        )
        trend = [
            {
                "date": r.date.isoformat() if r.date else None,
                "total": r.total,
                "positive": r.positive,
                "negative": r.negative,
                "satisfaction_rate": round(r.positive / r.total * 100, 1) if r.total > 0 else 0
            }
            for r in trend_result.fetchall()
        ]

        # 2. Feedback by model
        model_result = await db.execute(
            text("""
                SELECT
                    COALESCE(model, 'unknown') as model,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive,
                    AVG(latency_ms) as avg_latency,
                    AVG(token_count) as avg_tokens
                FROM ai_response_feedback
                WHERE created_at > :cutoff
                GROUP BY model
                ORDER BY total DESC
            """),
            {"cutoff": cutoff}
        )
        by_model = [
            {
                "model": r.model,
                "total": r.total,
                "positive": r.positive,
                "satisfaction_rate": round(r.positive / r.total * 100, 1) if r.total > 0 else 0,
                "avg_latency_ms": round(r.avg_latency) if r.avg_latency else None,
                "avg_tokens": round(r.avg_tokens) if r.avg_tokens else None
            }
            for r in model_result.fetchall()
        ]

        # 3. Tool success rates
        tool_result = await db.execute(
            text("""
                SELECT
                    unnest(tools_used) as tool,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive
                FROM ai_response_feedback
                WHERE created_at > :cutoff
                  AND tools_used IS NOT NULL
                GROUP BY tool
                ORDER BY total DESC
                LIMIT 20
            """),
            {"cutoff": cutoff}
        )
        tool_success = [
            {
                "tool": r.tool,
                "total": r.total,
                "positive": r.positive,
                "success_rate": round(r.positive / r.total * 100, 1) if r.total > 0 else 0
            }
            for r in tool_result.fetchall()
        ]

        # 4. Response time correlation
        latency_result = await db.execute(
            text("""
                SELECT
                    CASE
                        WHEN latency_ms < 2000 THEN 'fast (<2s)'
                        WHEN latency_ms < 5000 THEN 'medium (2-5s)'
                        WHEN latency_ms < 10000 THEN 'slow (5-10s)'
                        ELSE 'very slow (>10s)'
                    END as latency_bucket,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive
                FROM ai_response_feedback
                WHERE created_at > :cutoff
                  AND latency_ms IS NOT NULL
                GROUP BY latency_bucket
                ORDER BY MIN(latency_ms)
            """),
            {"cutoff": cutoff}
        )
        by_latency = [
            {
                "bucket": r.latency_bucket,
                "total": r.total,
                "positive": r.positive,
                "satisfaction_rate": round(r.positive / r.total * 100, 1) if r.total > 0 else 0
            }
            for r in latency_result.fetchall()
        ]

        # 5. Issue category breakdown
        category_result = await db.execute(
            text("""
                SELECT
                    unnest(feedback_categories) as category,
                    COUNT(*) as count
                FROM ai_response_feedback
                WHERE created_at > :cutoff
                  AND feedback_type = 'negative'
                  AND feedback_categories IS NOT NULL
                GROUP BY category
                ORDER BY count DESC
            """),
            {"cutoff": cutoff}
        )
        issue_breakdown = [
            {"category": r.category, "count": r.count}
            for r in category_result.fetchall()
        ]

        # 6. Summary metrics
        summary_result = await db.execute(
            text("""
                SELECT
                    COUNT(*) as total_feedback,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive_count,
                    COUNT(*) FILTER (WHERE feedback_type = 'negative') as negative_count,
                    COUNT(DISTINCT chat_session_id) as sessions_with_feedback,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(latency_ms) as avg_latency,
                    AVG(token_count) as avg_tokens
                FROM ai_response_feedback
                WHERE created_at > :cutoff
            """),
            {"cutoff": cutoff}
        )
        summary = summary_result.fetchone()

        # 7. Weekly comparison
        cutoff_7d = datetime.utcnow() - timedelta(days=7)
        cutoff_14d = datetime.utcnow() - timedelta(days=14)
        weekly_result = await db.execute(
            text("""
                SELECT
                    'this_week' as period,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive
                FROM ai_response_feedback
                WHERE created_at > :cutoff_7d
                UNION ALL
                SELECT
                    'last_week' as period,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive
                FROM ai_response_feedback
                WHERE created_at > :cutoff_14d
                  AND created_at <= :cutoff_7d
            """),
            {"cutoff_7d": cutoff_7d, "cutoff_14d": cutoff_14d}
        )
        weekly_data = {r.period: {"total": r.total, "positive": r.positive} for r in weekly_result.fetchall()}

        this_week_rate = (weekly_data.get("this_week", {}).get("positive", 0) /
                         weekly_data.get("this_week", {}).get("total", 1) * 100)
        last_week_rate = (weekly_data.get("last_week", {}).get("positive", 0) /
                         weekly_data.get("last_week", {}).get("total", 1) * 100)
        week_over_week_change = this_week_rate - last_week_rate

        return {
            "period_days": days,
            "summary": {
                "total_feedback": summary.total_feedback or 0,
                "positive_count": summary.positive_count or 0,
                "negative_count": summary.negative_count or 0,
                "satisfaction_rate": round((summary.positive_count or 0) / (summary.total_feedback or 1) * 100, 1),
                "sessions_with_feedback": summary.sessions_with_feedback or 0,
                "unique_users": summary.unique_users or 0,
                "avg_latency_ms": round(summary.avg_latency) if summary.avg_latency else None,
                "avg_tokens": round(summary.avg_tokens) if summary.avg_tokens else None,
            },
            "week_over_week": {
                "this_week_rate": round(this_week_rate, 1),
                "last_week_rate": round(last_week_rate, 1),
                "change": round(week_over_week_change, 1),
                "trend": "up" if week_over_week_change > 0 else "down" if week_over_week_change < 0 else "stable"
            },
            "trend": trend,
            "by_model": by_model,
            "tool_success_rates": tool_success,
            "by_latency": by_latency,
            "issue_breakdown": issue_breakdown,
        }

    except Exception as e:
        logger.error(f"Error getting detailed feedback analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get feedback analytics")
