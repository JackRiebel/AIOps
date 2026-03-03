# src/api/routes/costs.py
"""AI Cost tracking and ROI analytics endpoints.

This module provides endpoints for tracking AI usage costs across all providers.
"""
from fastapi import APIRouter, Query, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, text
from datetime import datetime, timedelta
import logging

from src.config.database import get_db
from src.models.ai_cost_log import AICostLog
from src.api.dependencies import require_viewer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/costs", tags=["AI Costs"])


@router.get("/summary", dependencies=[Depends(require_viewer)])
async def get_cost_summary(
    days: int = Query(30, ge=1, le=365),
):
    """Get AI cost summary with metrics and model breakdown.

    Returns aggregate statistics for the specified time period including:
    - Total queries, tokens, and cost
    - Average cost per query and cost per 1K tokens
    - 7-day comparison for trend analysis
    - Breakdown by model
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    cutoff_7d = datetime.utcnow() - timedelta(days=7)

    db = get_db()

    try:
        async with db.session() as session:
            # Get overall metrics
            result = await session.execute(
                select(
                    func.count(AICostLog.id).label("queries"),
                    func.coalesce(func.sum(AICostLog.input_tokens + AICostLog.output_tokens), 0).label("total_tokens"),
                    func.coalesce(func.sum(AICostLog.input_tokens), 0).label("input_tokens"),
                    func.coalesce(func.sum(AICostLog.output_tokens), 0).label("output_tokens"),
                    func.coalesce(func.sum(AICostLog.cost_usd), 0).label("total_cost_usd"),
                ).where(AICostLog.timestamp >= cutoff)
            )

            row = result.first()
            if row is None:
                queries = 0
                total_tokens = 0
                input_tokens = 0
                output_tokens = 0
                total_cost_usd = 0.0
            else:
                queries = row.queries or 0
                total_tokens = int(row.total_tokens or 0)
                input_tokens = int(row.input_tokens or 0)
                output_tokens = int(row.output_tokens or 0)
                total_cost_usd = float(row.total_cost_usd or 0)

            # Calculate metrics
            avg_cost_per_query = (total_cost_usd / queries) if queries > 0 else 0
            avg_tokens_per_query = (total_tokens / queries) if queries > 0 else 0
            cost_per_1k_tokens = (total_cost_usd / (total_tokens / 1000)) if total_tokens > 0 else 0

            # Get 7-day comparison
            result_7d = await session.execute(
                select(
                    func.count(AICostLog.id).label("queries"),
                    func.coalesce(func.sum(AICostLog.cost_usd), 0).label("total_cost_usd"),
                ).where(AICostLog.timestamp >= cutoff_7d)
            )
            row_7d = result_7d.first()
            cost_7d = float(row_7d.total_cost_usd or 0) if row_7d else 0
            queries_7d = row_7d.queries or 0 if row_7d else 0

            # Get model breakdown
            model_result = await session.execute(
                select(
                    AICostLog.model,
                    func.count(AICostLog.id).label("queries"),
                    func.coalesce(func.sum(AICostLog.cost_usd), 0).label("cost"),
                    func.coalesce(func.sum(AICostLog.input_tokens), 0).label("input_tokens"),
                    func.coalesce(func.sum(AICostLog.output_tokens), 0).label("output_tokens"),
                    func.coalesce(func.sum(AICostLog.input_tokens + AICostLog.output_tokens), 0).label("total_tokens"),
                )
                .where(AICostLog.timestamp >= cutoff)
                .group_by(AICostLog.model)
            )

            model_breakdown = []
            for row in model_result.fetchall():
                model_queries = row.queries or 0
                model_tokens = int(row.total_tokens or 0)
                model_cost = float(row.cost or 0)
                model_breakdown.append({
                    "model": row.model,
                    "queries": model_queries,
                    "cost_usd": round(model_cost, 4),
                    "input_tokens": int(row.input_tokens or 0),
                    "output_tokens": int(row.output_tokens or 0),
                    "total_tokens": model_tokens,
                    "avg_tokens_per_query": round(model_tokens / model_queries, 0) if model_queries > 0 else 0,
                    "cost_per_1k_tokens": round(model_cost / (model_tokens / 1000), 6) if model_tokens > 0 else 0,
                })

        return {
            "period_days": days,
            "queries": queries,
            "total_tokens": total_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost_usd": round(total_cost_usd, 4),
            "avg_cost_per_query": round(avg_cost_per_query, 6),
            "avg_tokens_per_query": round(avg_tokens_per_query, 0),
            "cost_per_1k_tokens": round(cost_per_1k_tokens, 6),
            "last_7_days": {
                "queries": queries_7d,
                "cost_usd": round(cost_7d, 4),
            },
            "model_breakdown": model_breakdown,
        }

    except Exception as e:
        logger.error(f"Error fetching cost summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch cost summary: {str(e)}")


@router.get("/daily", dependencies=[Depends(require_viewer)])
async def get_daily_costs(
    days: int = Query(30, ge=1, le=365),
):
    """Get daily cost breakdown for charting.

    Returns a list of daily cost totals for the specified time period.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    db = get_db()

    try:
        async with db.session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        DATE(timestamp) as date,
                        COALESCE(SUM(cost_usd), 0) as cost_usd
                    FROM ai_cost_logs
                    WHERE timestamp >= :cutoff
                    GROUP BY DATE(timestamp)
                    ORDER BY date
                """),
                {"cutoff": cutoff}
            )

            rows = result.fetchall()

            # Format response
            daily_data = []
            for row in rows:
                date_val = row.date
                date_str = date_val.isoformat() if hasattr(date_val, 'isoformat') else str(date_val)
                daily_data.append({
                    "date": date_str,
                    "cost_usd": round(float(row.cost_usd or 0), 4)
                })

            return daily_data

    except Exception as e:
        logger.error(f"Error fetching daily costs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily costs: {str(e)}")


@router.post("/analyze", dependencies=[Depends(require_viewer)])
async def analyze_costs(
    request: Request,
):
    """AI-powered cost analysis endpoint.

    Analyzes AI usage patterns and provides optimization recommendations.
    Uses the configured AI provider to generate insights.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Extract cost data from the request
    summary = payload.get("summary", {})
    daily_trend = payload.get("daily_trend", [])
    model_breakdown = payload.get("model_breakdown", [])

    # Build analysis prompt
    prompt = f"""Analyze this AI usage data and provide cost optimization insights.

AI USAGE SUMMARY ({summary.get('period_days', 30)} days):
- Total Queries: {summary.get('queries', 0):,}
- Total Cost: ${summary.get('total_cost_usd', 0):.2f}
- Total Tokens: {summary.get('total_tokens', 0):,}
- Average Cost per Query: ${summary.get('avg_cost_per_query', 0):.4f}
- Average Tokens per Query: {summary.get('avg_tokens_per_query', 0):,.0f}
- Cost per 1K Tokens: ${summary.get('cost_per_1k_tokens', 0):.4f}

LAST 7 DAYS:
- Queries: {summary.get('last_7_days', {}).get('queries', 0):,}
- Cost: ${summary.get('last_7_days', {}).get('cost_usd', 0):.2f}

"""

    if model_breakdown:
        prompt += "MODEL USAGE BREAKDOWN:\n"
        for model in model_breakdown:
            model_name = model.get('model', 'unknown')
            # Simplify model names for readability
            if 'haiku' in model_name.lower():
                display_name = 'Claude Haiku'
            elif 'sonnet' in model_name.lower():
                display_name = 'Claude Sonnet'
            elif 'opus' in model_name.lower():
                display_name = 'Claude Opus'
            elif 'gpt-4' in model_name.lower():
                display_name = 'GPT-4'
            elif 'gpt-3.5' in model_name.lower():
                display_name = 'GPT-3.5'
            else:
                display_name = model_name
            prompt += f"- {display_name}: {model.get('queries', 0):,} queries, ${model.get('cost_usd', 0):.2f}, {model.get('total_tokens', 0):,} tokens\n"
        prompt += "\n"

    # Calculate trend
    if daily_trend and len(daily_trend) >= 7:
        recent_costs = [d.get('cost_usd', 0) for d in daily_trend[-7:]]
        older_costs = [d.get('cost_usd', 0) for d in daily_trend[-14:-7]] if len(daily_trend) >= 14 else []
        if older_costs:
            recent_avg = sum(recent_costs) / len(recent_costs)
            older_avg = sum(older_costs) / len(older_costs)
            if older_avg > 0:
                trend_pct = ((recent_avg - older_avg) / older_avg) * 100
                prompt += f"COST TREND: {'Increasing' if trend_pct > 0 else 'Decreasing'} by {abs(trend_pct):.1f}% (week over week)\n\n"

    prompt += """Provide a concise analysis with:
1. **Cost Efficiency**: One sentence assessment of current spending efficiency
2. **Optimization Opportunities**: Top 2-3 ways to reduce costs while maintaining quality
3. **Model Recommendations**: Suggest optimal model choices based on usage patterns
4. **ROI Insights**: Brief assessment of AI value vs cost

Keep the response brief and actionable. Use markdown formatting."""

    # Use multi-provider AI (async, works with database config)
    from src.services.multi_provider_ai import generate_text
    from src.services.config_service import get_configured_ai_provider

    try:
        # Check if AI is configured
        ai_config = await get_configured_ai_provider()
        if not ai_config:
            raise HTTPException(status_code=503, detail="AI service not configured. Please configure an AI provider in Admin > System Config.")

        # Generate analysis
        result = await generate_text(prompt, max_tokens=800)

        if not result:
            raise HTTPException(status_code=503, detail="AI provider returned no response")

        analysis_text = result.get("text", "")
        model_used = result.get("model", ai_config.get("model", "unknown"))

        return {
            "success": True,
            "analysis": analysis_text,
            "model": model_used
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cost analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
