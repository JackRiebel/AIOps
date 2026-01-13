"""
Efficiency Scorer Service for AI Sessions

Provides detailed multi-dimensional scoring for AI session efficiency:
- Cost efficiency (ROI achieved)
- Time efficiency (time saved vs session duration)
- Query efficiency (success rate, errors)
- Action efficiency (variety and depth of actions)
- MTTR efficiency (incident resolution improvement)
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from src.models.ai_session import AISession, AISessionEvent
from src.config.roi_baselines import (
    GOOD_ROI_THRESHOLD,
    WARNING_ROI_THRESHOLD,
    SESSION_TYPES,
)

logger = logging.getLogger(__name__)


@dataclass
class EfficiencyBreakdown:
    """Detailed breakdown of efficiency scores."""
    cost_efficiency: int  # 0-100
    time_efficiency: int  # 0-100
    query_efficiency: int  # 0-100
    action_efficiency: int  # 0-100
    mttr_efficiency: Optional[int]  # 0-100, None if no incident

    @property
    def overall(self) -> int:
        """Calculate weighted overall score."""
        weights = {
            "cost": 0.30,
            "time": 0.30,
            "query": 0.20,
            "action": 0.15,
            "mttr": 0.05,
        }

        total = (
            self.cost_efficiency * weights["cost"] +
            self.time_efficiency * weights["time"] +
            self.query_efficiency * weights["query"] +
            self.action_efficiency * weights["action"]
        )

        # Include MTTR if available, otherwise redistribute weight
        if self.mttr_efficiency is not None:
            total += self.mttr_efficiency * weights["mttr"]
        else:
            # Redistribute MTTR weight proportionally
            redistribution = weights["mttr"] / (1 - weights["mttr"])
            total = total * (1 + redistribution)

        return min(100, max(0, int(total)))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cost_efficiency": self.cost_efficiency,
            "time_efficiency": self.time_efficiency,
            "query_efficiency": self.query_efficiency,
            "action_efficiency": self.action_efficiency,
            "mttr_efficiency": self.mttr_efficiency,
            "overall": self.overall,
        }


@dataclass
class EfficiencyTrend:
    """Efficiency trend over time."""
    period: str  # "daily", "weekly", "monthly"
    data_points: List[Dict[str, Any]] = field(default_factory=list)
    trend_direction: str = "stable"  # "improving", "declining", "stable"
    trend_percentage: float = 0.0


@dataclass
class MTTRComparison:
    """MTTR comparison metrics."""
    baseline_minutes: float  # Average without AI
    ai_assisted_minutes: float  # Average with AI
    improvement_percentage: float
    incidents_resolved: int
    avg_time_saved_per_incident: float


class EfficiencyScorer:
    """Service for calculating detailed efficiency scores."""

    # MTTR baselines by incident type (minutes)
    # Based on industry research:
    # - P1 incident MTTR target: Under 4 hours (240 min) per INOC NOC benchmarks
    # - Tier 1 resolution: 60-80% resolved within 15-30 minutes
    # - Complex issues: 33%+ of IT pros take hours to days to resolve
    # - Time to action: Under 15 minutes for initial response
    MTTR_BASELINES = {
        "network_outage": 180.0,      # Full outage - P1, target under 4 hours
        "device_offline": 45.0,       # Single device - lower priority
        "connectivity_issue": 60.0,   # May require troubleshooting multiple layers
        "performance_degradation": 90.0,  # Often requires analysis and testing
        "security_alert": 75.0,       # Requires investigation and validation
        "configuration_error": 60.0,  # Identify, plan, fix, verify
        "default": 60.0,              # Conservative default based on Tier 2 complexity
    }

    def __init__(self):
        pass

    def calculate_efficiency_breakdown(
        self,
        session: AISession,
        events: List[AISessionEvent]
    ) -> EfficiencyBreakdown:
        """Calculate detailed efficiency breakdown for a session."""
        return EfficiencyBreakdown(
            cost_efficiency=self._calculate_cost_efficiency(session),
            time_efficiency=self._calculate_time_efficiency(session, events),
            query_efficiency=self._calculate_query_efficiency(session),
            action_efficiency=self._calculate_action_efficiency(session, events),
            mttr_efficiency=self._calculate_mttr_efficiency(session),
        )

    def _calculate_cost_efficiency(self, session: AISession) -> int:
        """Calculate cost efficiency score (0-100)."""
        roi = float(session.roi_percentage) if session.roi_percentage else 0

        # Scale: 1000% ROI = 100 score
        # Good threshold (500%) = 50 score
        # Warning threshold (100%) = 10 score
        if roi >= 1000:
            return 100
        elif roi >= GOOD_ROI_THRESHOLD:
            # Linear scale from 50-100 for 500-1000%
            return int(50 + (roi - GOOD_ROI_THRESHOLD) / 10)
        elif roi >= WARNING_ROI_THRESHOLD:
            # Linear scale from 10-50 for 100-500%
            return int(10 + (roi - WARNING_ROI_THRESHOLD) * 40 / (GOOD_ROI_THRESHOLD - WARNING_ROI_THRESHOLD))
        elif roi > 0:
            # Linear scale from 0-10 for 0-100%
            return int(roi / 10)
        else:
            return 0

    def _calculate_time_efficiency(
        self,
        session: AISession,
        events: List[AISessionEvent]
    ) -> int:
        """Calculate time efficiency score (0-100)."""
        time_saved = float(session.time_saved_minutes) if session.time_saved_minutes else 0
        duration_ms = session.total_duration_ms or 0
        duration_minutes = duration_ms / 60000 if duration_ms > 0 else 0

        if duration_minutes <= 0:
            return 50  # Neutral if no duration

        # Time saved ratio
        # 5x time saved = 100 score
        # 2x time saved = 50 score
        # 1x time saved = 25 score
        ratio = time_saved / duration_minutes if duration_minutes > 0 else 0

        if ratio >= 5:
            return 100
        elif ratio >= 2:
            return int(50 + (ratio - 2) * 50 / 3)
        elif ratio >= 1:
            return int(25 + (ratio - 1) * 25)
        else:
            return int(ratio * 25)

    def _calculate_query_efficiency(self, session: AISession) -> int:
        """Calculate query efficiency score (0-100)."""
        query_count = session.ai_query_count or 0
        error_count = session.error_count or 0

        if query_count == 0:
            return 100  # No queries, no errors

        # Success rate
        success_rate = 1 - (error_count / query_count) if query_count > 0 else 1

        # Base score from success rate
        base_score = success_rate * 100

        # Bonus for efficiency (fewer queries = better, if result achieved)
        # This is a soft penalty for excessive queries
        if query_count > 20:
            base_score *= 0.9
        elif query_count > 10:
            base_score *= 0.95

        return min(100, max(0, int(base_score)))

    def _calculate_action_efficiency(
        self,
        session: AISession,
        events: List[AISessionEvent]
    ) -> int:
        """Calculate action efficiency score (0-100)."""
        # Count unique action types
        action_types = set()
        pages_visited = set()

        for event in events:
            if event.action_type:
                action_types.add(event.action_type)
            if event.page_path:
                pages_visited.add(event.page_path)

        # Diversity score (more unique actions = better coverage)
        diversity = len(action_types)
        navigation = len(pages_visited)

        # Base score from diversity
        if diversity >= 10:
            base_score = 100
        elif diversity >= 5:
            base_score = 70 + (diversity - 5) * 6
        elif diversity >= 3:
            base_score = 50 + (diversity - 3) * 10
        else:
            base_score = diversity * 15

        # Bonus for focused navigation (not too many page switches)
        if navigation <= 3:
            base_score = min(100, base_score + 10)
        elif navigation > 10:
            base_score = max(0, base_score - 10)

        return min(100, max(0, int(base_score)))

    def _calculate_mttr_efficiency(self, session: AISession) -> Optional[int]:
        """Calculate MTTR efficiency score (0-100), None if no incident."""
        if not session.incident_id:
            return None

        if not session.incident_resolved:
            return 30  # Partial credit for working on incident

        resolution_time = float(session.resolution_time_minutes) if session.resolution_time_minutes else None

        if resolution_time is None:
            return 50  # Resolved but no timing data

        # Get baseline MTTR
        baseline = self.MTTR_BASELINES.get(
            session.session_type,
            self.MTTR_BASELINES["default"]
        )

        # Calculate improvement
        if resolution_time <= baseline * 0.25:
            return 100  # 75%+ improvement
        elif resolution_time <= baseline * 0.5:
            return 85  # 50-75% improvement
        elif resolution_time <= baseline * 0.75:
            return 70  # 25-50% improvement
        elif resolution_time <= baseline:
            return 55  # 0-25% improvement
        elif resolution_time <= baseline * 1.25:
            return 40  # Slightly worse
        else:
            return 20  # Significantly worse

    def get_mttr_comparison(
        self,
        sessions: List[AISession],
        baseline_minutes: float = None
    ) -> MTTRComparison:
        """Calculate MTTR comparison for a set of sessions."""
        incident_sessions = [
            s for s in sessions
            if s.incident_id and s.incident_resolved and s.resolution_time_minutes
        ]

        if not incident_sessions:
            return MTTRComparison(
                baseline_minutes=baseline_minutes or self.MTTR_BASELINES["default"],
                ai_assisted_minutes=0,
                improvement_percentage=0,
                incidents_resolved=0,
                avg_time_saved_per_incident=0,
            )

        total_resolution_time = sum(
            float(s.resolution_time_minutes)
            for s in incident_sessions
        )
        avg_resolution = total_resolution_time / len(incident_sessions)

        baseline = baseline_minutes or self.MTTR_BASELINES["default"]
        improvement = ((baseline - avg_resolution) / baseline) * 100 if baseline > 0 else 0
        time_saved = baseline - avg_resolution

        return MTTRComparison(
            baseline_minutes=baseline,
            ai_assisted_minutes=avg_resolution,
            improvement_percentage=max(0, improvement),
            incidents_resolved=len(incident_sessions),
            avg_time_saved_per_incident=max(0, time_saved),
        )

    def get_efficiency_recommendations(
        self,
        breakdown: EfficiencyBreakdown,
        session: AISession
    ) -> List[Dict[str, str]]:
        """Generate actionable recommendations based on efficiency scores."""
        recommendations = []

        # Cost efficiency recommendations
        if breakdown.cost_efficiency < 50:
            recommendations.append({
                "category": "cost",
                "priority": "high",
                "recommendation": "Consider using more targeted queries to reduce token usage",
                "detail": f"Current ROI is {session.roi_percentage}%. Try to be more specific in your queries."
            })
        elif breakdown.cost_efficiency < 75:
            recommendations.append({
                "category": "cost",
                "priority": "medium",
                "recommendation": "Good cost efficiency, but room for improvement",
                "detail": "Try combining related queries into single requests."
            })

        # Time efficiency recommendations
        if breakdown.time_efficiency < 50:
            recommendations.append({
                "category": "time",
                "priority": "high",
                "recommendation": "Session duration exceeds time saved",
                "detail": "Consider using keyboard shortcuts and saved queries for faster workflows."
            })

        # Query efficiency recommendations
        if breakdown.query_efficiency < 75:
            recommendations.append({
                "category": "query",
                "priority": "medium",
                "recommendation": "Some queries resulted in errors",
                "detail": "Review error patterns and adjust query phrasing."
            })

        # Action efficiency recommendations
        if breakdown.action_efficiency < 50:
            recommendations.append({
                "category": "action",
                "priority": "low",
                "recommendation": "Limited action variety",
                "detail": "Explore more AI capabilities for your use case."
            })

        # MTTR recommendations
        if breakdown.mttr_efficiency is not None and breakdown.mttr_efficiency < 50:
            recommendations.append({
                "category": "mttr",
                "priority": "high",
                "recommendation": "Incident resolution took longer than baseline",
                "detail": "Consider using AI for faster root cause analysis."
            })

        return recommendations

    def format_efficiency_summary(
        self,
        breakdown: EfficiencyBreakdown,
        session: AISession
    ) -> Dict[str, Any]:
        """Format efficiency data for UI display."""
        recommendations = self.get_efficiency_recommendations(breakdown, session)

        # Determine tier
        overall = breakdown.overall
        if overall >= 80:
            tier = "excellent"
            tier_label = "Excellent"
            tier_color = "green"
        elif overall >= 60:
            tier = "good"
            tier_label = "Good"
            tier_color = "blue"
        elif overall >= 40:
            tier = "average"
            tier_label = "Average"
            tier_color = "yellow"
        else:
            tier = "needs_improvement"
            tier_label = "Needs Improvement"
            tier_color = "red"

        return {
            "overall_score": overall,
            "tier": tier,
            "tier_label": tier_label,
            "tier_color": tier_color,
            "breakdown": breakdown.to_dict(),
            "recommendations": recommendations,
            "summary": f"Session efficiency: {tier_label} ({overall}/100)",
        }


# Global singleton
_scorer: Optional[EfficiencyScorer] = None


def get_efficiency_scorer() -> EfficiencyScorer:
    """Get the efficiency scorer singleton."""
    global _scorer
    if _scorer is None:
        _scorer = EfficiencyScorer()
    return _scorer
