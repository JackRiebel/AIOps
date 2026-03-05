"""
AI-Based ROI Analyzer

Uses AI to analyze session events and calculate accurate ROI based on
what work was actually performed, not just keyword matching.

The AI reviews:
- API calls made (what data was retrieved)
- AI queries and responses (what questions were answered)
- Tools used (what actions were taken)
- Time spent (how long operations took)

Then estimates what this work would have taken manually.

Supports multiple AI providers: Anthropic, OpenAI, Google, and Cisco Circuit.
Uses whatever provider is configured in the system settings.
"""

import logging
import json
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.models.ai_session import AISession, AISessionEvent
from src.config.settings import get_settings
from src.config.model_pricing import calculate_cost

logger = logging.getLogger(__name__)


@dataclass
class AIROIAnalysis:
    """Results from AI-based ROI analysis."""
    # Time estimates
    estimated_manual_minutes: float
    time_saved_minutes: float

    # Cost calculations
    manual_cost_usd: float
    ai_cost_usd: float
    net_savings_usd: float
    roi_percentage: float

    # Work classification
    tasks_completed: List[Dict[str, Any]]
    primary_task_type: str
    complexity_level: str  # simple, moderate, complex

    # Confidence and reasoning
    confidence_score: float  # 0-1
    reasoning: str

    # Efficiency metrics
    efficiency_score: int  # 0-100


# Hourly rate for calculations (fully-loaded cost)
DEFAULT_HOURLY_RATE = 85.0


async def analyze_session_roi(
    session: AISession,
    events: List[AISessionEvent],
    hourly_rate: float = None
) -> Optional[AIROIAnalysis]:
    """
    Use AI to analyze a session and calculate accurate ROI.

    This looks at what was actually accomplished, not just keywords.
    """
    try:
        from src.services.multi_provider_ai import generate_text

        rate = hourly_rate or DEFAULT_HOURLY_RATE
        ai_cost = float(session.total_cost_usd) if session.total_cost_usd else 0.0

        # Build detailed context of what happened
        context = _build_session_context(session, events)

        # Calculate session duration
        duration_minutes = 0
        if session.ended_at and session.started_at:
            duration_minutes = (session.ended_at - session.started_at).total_seconds() / 60
        elif session.total_duration_ms:
            duration_minutes = session.total_duration_ms / 60000

        prompt = f"""You are analyzing a network operations session to calculate accurate ROI (Return on Investment).

Your job is to determine: "How long would this work have taken a network engineer to do MANUALLY without AI assistance?"

IMPORTANT CONTEXT:
- This is a Cisco Meraki/ThousandEyes/Splunk monitoring platform called "Cisco AIOps Hub"
- Manual work means: logging into dashboards, navigating menus, clicking through pages, copying data, correlating information, researching documentation, etc.
- AI assistance compressed this work into the session duration

SESSION STATISTICS:
- Session Duration: {duration_minutes:.1f} minutes
- AI Queries Made: {session.ai_query_count}
- API Calls Made: {session.api_call_count}
- Pages Navigated: {session.navigation_count}
- Actions Taken: {session.edit_action_count}
- Total AI Cost: ${ai_cost:.4f}
- Hourly Rate for Manual Work: ${rate}/hour

{context}

MANUAL TIME ESTIMATION GUIDELINES:
Think about what a network engineer would have to do WITHOUT AI assistance.

CRITICAL: Be CONSERVATIVE and REALISTIC. Do NOT inflate estimates. Use the MINIMUM plausible time for simple tasks.

Task Type Reference (use lower end for quick/simple tasks):

1. **Quick Status Check** (1 network or device):
   - Manual: Login, navigate, view status = 3-5 minutes
   - Simple question answered in one query = 3-5 minutes

2. **Multi-Device Status Review** (several devices):
   - Manual: Navigate multiple pages = 5-10 minutes

3. **Data Lookup** (finding specific info):
   - Simple search = 5-8 minutes
   - Complex cross-reference = 10-20 minutes

4. **Log Analysis** (Splunk):
   - Simple search = 15-30 minutes
   - Complex correlation = 45-90 minutes

5. **Troubleshooting**:
   - Quick diagnosis = 15-30 minutes
   - Root cause analysis = 45-120 minutes

6. **Configuration Review**:
   - Single device = 5-10 minutes
   - Multi-device comparison = 15-30 minutes

7. **Incident Investigation**:
   - Initial triage = 10-20 minutes
   - Full investigation = 45-120 minutes

IMPORTANT SCALING RULES:
- If only 1 AI query was made → likely a simple task (3-10 min manual)
- If session lasted < 2 minutes → simple lookup (3-8 min manual)
- If no troubleshooting keywords → don't assume troubleshooting time
- Match complexity to what was ACTUALLY asked, not what COULD be asked

Based on the ACTUAL session events, estimate conservatively what this specific work would take manually.

Return a JSON object:
{{
    "tasks_completed": [
        {{
            "task": "Description of what was accomplished",
            "task_type": "status_check|data_lookup|log_analysis|troubleshooting|config_review|incident_response|report_generation|other",
            "manual_time_minutes": <estimated manual time for this specific task>,
            "ai_time_minutes": <how long the AI took>,
            "complexity": "simple|moderate|complex"
        }}
    ],
    "total_manual_time_minutes": <sum of all manual times>,
    "primary_task_type": "<most significant task type>",
    "complexity_level": "simple|moderate|complex",
    "confidence_score": <0.0 to 1.0 - how confident in this estimate>,
    "reasoning": "<1-2 sentences explaining the estimate>"
}}

Be REALISTIC and CONSERVATIVE. Consider:
- Simple queries = simple manual time (3-8 min)
- Only add time for complexity that was ACTUALLY present
- Don't pad estimates - use minimum plausible time
- If it's a quick check, estimate quick manual time

Return ONLY valid JSON, no markdown or other text."""

        # Use multi-provider AI
        result = await generate_text(
            prompt=prompt,
            max_tokens=1500,
            temperature=0.2,  # Low temperature for consistent estimates
        )

        if not result:
            logger.warning("No AI provider configured for ROI analysis, falling back to heuristic")
            return None

        # Parse response
        response_text = result["text"]
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        analysis = json.loads(response_text.strip())

        # Calculate ROI metrics
        manual_minutes = float(analysis.get("total_manual_time_minutes", 0))
        time_saved = max(0, manual_minutes - duration_minutes)
        manual_cost = (manual_minutes / 60) * rate
        net_savings = manual_cost - ai_cost

        # Calculate ROI percentage
        if ai_cost > 0:
            roi_percentage = ((manual_cost - ai_cost) / ai_cost) * 100
        else:
            roi_percentage = float('inf') if manual_cost > 0 else 0

        # Calculate efficiency score
        efficiency_score = _calculate_efficiency_score(
            roi_percentage=roi_percentage,
            time_saved=time_saved,
            duration_minutes=duration_minutes,
            confidence=analysis.get("confidence_score", 0.5)
        )

        return AIROIAnalysis(
            estimated_manual_minutes=manual_minutes,
            time_saved_minutes=time_saved,
            manual_cost_usd=manual_cost,
            ai_cost_usd=ai_cost,
            net_savings_usd=net_savings,
            roi_percentage=roi_percentage,
            tasks_completed=analysis.get("tasks_completed", []),
            primary_task_type=analysis.get("primary_task_type", "unknown"),
            complexity_level=analysis.get("complexity_level", "moderate"),
            confidence_score=analysis.get("confidence_score", 0.5),
            reasoning=analysis.get("reasoning", ""),
            efficiency_score=efficiency_score
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI ROI analysis response: {e}")
        return None
    except Exception as e:
        logger.error(f"Error in AI ROI analysis: {e}")
        return None


def _build_session_context(session: AISession, events: List[AISessionEvent]) -> str:
    """Build detailed context from session events for AI analysis."""
    sections = []

    # Track different event types
    ai_conversations = []
    api_calls = []
    navigations = []
    actions = []

    for event in events:
        if event.event_type == "ai_query":
            data = event.event_data or {}
            query = data.get("query", "")
            response = data.get("response", data.get("response_preview", ""))
            if query:
                ai_conversations.append({
                    "query": query[:500],
                    "response": response[:800] if response else "",
                    "duration_ms": event.duration_ms
                })

        elif event.event_type == "api_call":
            endpoint = event.api_endpoint or ""
            # Extract meaningful info from endpoint
            if endpoint:
                api_calls.append({
                    "endpoint": endpoint.split("?")[0],
                    "method": event.api_method,
                    "status": event.api_status,
                    "duration_ms": event.api_duration_ms
                })

        elif event.event_type == "navigation":
            data = event.event_data or {}
            page_name = data.get("page_name", "")
            path = event.page_path or data.get("path", "")
            if page_name:
                navigations.append(f"{page_name} ({path})")
            elif path:
                navigations.append(path)

        elif event.event_type in ("click", "edit_action"):
            data = event.event_data or {}
            action_desc = data.get("element_id", data.get("action", str(data)[:100]))
            if action_desc:
                actions.append(action_desc)

    # Build sections
    if ai_conversations:
        sections.append("AI CONVERSATIONS (User questions and AI responses):")
        for i, conv in enumerate(ai_conversations[:15], 1):  # Limit to 15
            sections.append(f"\n[Q{i}] User: {conv['query']}")
            if conv['response']:
                sections.append(f"[A{i}] AI: {conv['response']}")

    if api_calls:
        sections.append("\nAPI CALLS MADE (data retrieved):")
        # Deduplicate and count
        endpoint_counts = {}
        for call in api_calls:
            ep = call['endpoint']
            if ep not in endpoint_counts:
                endpoint_counts[ep] = 0
            endpoint_counts[ep] += 1

        for endpoint, count in sorted(endpoint_counts.items(), key=lambda x: -x[1])[:20]:
            sections.append(f"  - {endpoint} (called {count}x)")

    if navigations:
        sections.append("\nPAGES VISITED:")
        unique_pages = list(dict.fromkeys(navigations))[:15]
        for page in unique_pages:
            sections.append(f"  - {page}")

    if actions:
        sections.append("\nACTIONS TAKEN:")
        for action in actions[:10]:
            sections.append(f"  - {action}")

    return "\n".join(sections) if sections else "No detailed events recorded"


def _calculate_efficiency_score(
    roi_percentage: float,
    time_saved: float,
    duration_minutes: float,
    confidence: float
) -> int:
    """Calculate efficiency score (0-100) based on ROI analysis."""
    # Base score from ROI
    if roi_percentage >= 2000:
        roi_score = 100
    elif roi_percentage >= 1000:
        roi_score = 80 + (roi_percentage - 1000) / 50  # 80-100 for 1000-2000%
    elif roi_percentage >= 500:
        roi_score = 60 + (roi_percentage - 500) / 25  # 60-80 for 500-1000%
    elif roi_percentage >= 100:
        roi_score = 30 + (roi_percentage - 100) / 13.33  # 30-60 for 100-500%
    elif roi_percentage > 0:
        roi_score = roi_percentage * 0.3  # 0-30 for 0-100%
    else:
        roi_score = 0

    # Time efficiency factor
    if duration_minutes > 0:
        time_ratio = time_saved / duration_minutes
        time_factor = min(1.0, time_ratio / 5)  # Cap at 5x time saved
    else:
        time_factor = 0.5

    # Weighted score with confidence
    weighted_score = (roi_score * 0.7) + (time_factor * 100 * 0.3)

    # Apply confidence as a modifier
    final_score = weighted_score * (0.5 + confidence * 0.5)

    return min(100, max(0, int(final_score)))


async def get_roi_summary_for_display(analysis: AIROIAnalysis) -> Dict[str, Any]:
    """Format ROI analysis for UI display."""
    # Determine tier based on ROI
    if analysis.roi_percentage >= 1000:
        tier = "excellent"
        tier_label = "Excellent"
        tier_color = "green"
    elif analysis.roi_percentage >= 500:
        tier = "great"
        tier_label = "Great"
        tier_color = "emerald"
    elif analysis.roi_percentage >= 200:
        tier = "good"
        tier_label = "Good"
        tier_color = "blue"
    elif analysis.roi_percentage >= 100:
        tier = "fair"
        tier_label = "Fair"
        tier_color = "yellow"
    else:
        tier = "low"
        tier_label = "Low"
        tier_color = "red"

    # Format time saved
    if analysis.time_saved_minutes >= 60:
        time_saved_display = f"{analysis.time_saved_minutes / 60:.1f} hours"
    else:
        time_saved_display = f"{analysis.time_saved_minutes:.0f} min"

    # Format manual time
    if analysis.estimated_manual_minutes >= 60:
        manual_time_display = f"{analysis.estimated_manual_minutes / 60:.1f} hours"
    else:
        manual_time_display = f"{analysis.estimated_manual_minutes:.0f} min"

    return {
        "time_saved": {
            "minutes": analysis.time_saved_minutes,
            "display": time_saved_display,
        },
        "manual_estimate": {
            "minutes": analysis.estimated_manual_minutes,
            "display": manual_time_display,
        },
        "costs": {
            "manual": f"${analysis.manual_cost_usd:.2f}",
            "ai": f"${analysis.ai_cost_usd:.4f}",
            "savings": f"${analysis.net_savings_usd:.2f}",
        },
        "roi": {
            "percentage": analysis.roi_percentage,
            "display": f"{analysis.roi_percentage:,.0f}%" if analysis.roi_percentage < float('inf') else "∞",
            "tier": tier,
            "tier_label": tier_label,
            "tier_color": tier_color,
        },
        "tasks": analysis.tasks_completed,
        "primary_task": analysis.primary_task_type,
        "complexity": analysis.complexity_level,
        "efficiency_score": analysis.efficiency_score,
        "confidence": analysis.confidence_score,
        "reasoning": analysis.reasoning,
    }
