"""
ROI Calculator Service for AI Sessions

Calculates comprehensive ROI metrics for AI-assisted sessions:
- Time saved vs manual operations
- Manual cost estimates
- ROI percentage
- Session type classification
- Complexity and efficiency scoring
"""

import logging
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from src.config.roi_baselines import (
    ROI_BASELINES,
    DEFAULT_HOURLY_RATE,
    GOOD_ROI_THRESHOLD,
    WARNING_ROI_THRESHOLD,
    SESSION_TYPES,
    ActionCategory,
    get_baseline,
    calculate_manual_cost,
)
from src.models.ai_session import AISession, AISessionEvent

logger = logging.getLogger(__name__)


@dataclass
class ROIMetrics:
    """Comprehensive ROI metrics for a session."""
    time_saved_minutes: float
    manual_cost_usd: float
    ai_cost_usd: float
    roi_percentage: float
    cost_per_minute: float
    efficiency_score: int  # 0-100
    session_type: str
    complexity_score: int  # 1-5
    cost_breakdown: Dict[str, float]
    # Performance metrics
    avg_response_time_ms: Optional[int]
    slowest_query_ms: Optional[int]
    total_duration_ms: int


@dataclass
class MTTRMetrics:
    """MTTR (Mean Time to Resolution) metrics."""
    incident_id: Optional[int]
    incident_resolved: bool
    resolution_time_minutes: Optional[float]
    baseline_mttr_minutes: float  # Average without AI
    improvement_percentage: Optional[float]


class ROICalculator:
    """Service for calculating comprehensive ROI metrics for AI sessions."""

    def __init__(self, hourly_rate: float = None):
        """
        Initialize ROI calculator.

        Args:
            hourly_rate: Hourly rate for manual labor cost (defaults to $75/hr)
        """
        self.hourly_rate = hourly_rate or DEFAULT_HOURLY_RATE

    def calculate_session_roi(
        self,
        session: AISession,
        events: List[AISessionEvent]
    ) -> ROIMetrics:
        """
        Calculate comprehensive ROI metrics for a session.

        Args:
            session: The AI session to analyze
            events: List of events in the session

        Returns:
            ROIMetrics with all calculated values
        """
        # Calculate time saved based on action baselines
        time_saved, action_breakdown = self._calculate_time_saved(events)

        # Calculate manual cost
        manual_cost = calculate_manual_cost(time_saved, self.hourly_rate)

        # Get AI cost
        ai_cost = float(session.total_cost_usd) if session.total_cost_usd else 0.0

        # Calculate ROI percentage
        roi_percentage = self._calculate_roi_percentage(manual_cost, ai_cost)

        # Calculate duration
        total_duration_ms = self._calculate_duration_ms(session)
        duration_minutes = total_duration_ms / 60000 if total_duration_ms > 0 else 0

        # Cost per minute
        cost_per_minute = ai_cost / duration_minutes if duration_minutes > 0 else 0

        # Classify session type
        session_type = self._classify_session_type(events, action_breakdown)

        # Calculate complexity score
        complexity_score = self._calculate_complexity_score(session, events)

        # Calculate cost breakdown
        cost_breakdown = self._calculate_cost_breakdown(session, events)

        # Performance metrics
        avg_response_ms, slowest_ms = self._calculate_performance_metrics(events)

        # Calculate efficiency score
        efficiency_score = self._calculate_efficiency_score(
            roi_percentage=roi_percentage,
            time_saved=time_saved,
            duration_minutes=duration_minutes,
            error_count=session.error_count or 0,
            query_count=session.ai_query_count or 0
        )

        return ROIMetrics(
            time_saved_minutes=round(time_saved, 2),
            manual_cost_usd=round(manual_cost, 4),
            ai_cost_usd=round(ai_cost, 8),
            roi_percentage=round(roi_percentage, 2),
            cost_per_minute=round(cost_per_minute, 4),
            efficiency_score=efficiency_score,
            session_type=session_type,
            complexity_score=complexity_score,
            cost_breakdown=cost_breakdown,
            avg_response_time_ms=avg_response_ms,
            slowest_query_ms=slowest_ms,
            total_duration_ms=total_duration_ms
        )

    def _calculate_time_saved(
        self, events: List[AISessionEvent]
    ) -> Tuple[float, Dict[str, float]]:
        """
        Calculate total time saved based on unique action types performed.

        IMPORTANT: We deduplicate by action type to avoid inflation.
        A session that asks 5 questions about device status is ONE device
        lookup task, not five. Each unique action type is counted once,
        using the baseline for that action minus the total AI time spent
        on that action type.

        Only AI query events contribute to time saved — navigation and
        API calls are side effects of the same investigation, not
        independent manual tasks.

        Returns:
            Tuple of (total_time_saved_minutes, action_breakdown)
        """
        # Group AI query events by action type
        action_ai_times: Dict[str, float] = {}  # action_type -> total AI minutes

        for event in events:
            # Only count AI queries — navigation and API calls are side effects
            if event.event_type != "ai_query" and not event.action_type:
                continue

            action_type = self._classify_action(event)
            if not action_type:
                continue

            ai_time_minutes = (event.duration_ms or 0) / 60000
            if action_type not in action_ai_times:
                action_ai_times[action_type] = 0.0
            action_ai_times[action_type] += ai_time_minutes

        # For each unique action type, count one baseline worth of time saved
        total_saved = 0.0
        action_breakdown: Dict[str, float] = {}

        for action_type, ai_minutes in action_ai_times.items():
            baseline = get_baseline(action_type)
            # Time saved = one baseline occurrence minus total AI time on this type
            time_saved = max(0, baseline.manual_minutes - ai_minutes)
            total_saved += time_saved
            action_breakdown[action_type] = time_saved

        return total_saved, action_breakdown

    def _classify_action(self, event: AISessionEvent) -> Optional[str]:
        """
        Classify an event into an action type that maps to ROI baselines.

        Only AI query events (and events with explicit action_type) are
        classified. Navigation and API call events are side effects of
        the user's investigation, not independent manual tasks.

        Returns:
            Action type string or None if not classifiable
        """
        # Use explicit action_type if set (from logAIQuery metadata)
        if event.action_type:
            return event.action_type

        event_type = event.event_type
        event_data = event.event_data or {}

        # Only classify AI queries — navigation and API calls are side effects
        if event_type != "ai_query":
            return None

        query = str(event_data.get("query", "")).lower()

        # Log analysis
        if any(kw in query for kw in ["splunk", "log", "logs", "events", "syslog"]):
            if any(kw in query for kw in ["correlat", "root cause", "why"]):
                return "event_correlation"
            if any(kw in query for kw in ["security", "threat", "attack", "ids", "firewall"]):
                return "security_event_analysis"
            return "log_analysis"

        # Device operations
        if any(kw in query for kw in ["device", "serial", "online", "offline"]):
            return "device_lookup"
        if any(kw in query for kw in ["client", "mac", "ip address"]):
            return "client_lookup"
        if any(kw in query for kw in ["port", "switch port", "interface"]):
            return "port_status_check"
        if any(kw in query for kw in ["uplink", "wan"]):
            return "uplink_status_check"

        # Troubleshooting (only when explicitly troubleshooting)
        if any(kw in query for kw in ["troubleshoot", "debug", "diagnose", "fix"]):
            if "wireless" in query or "wifi" in query or "ssid" in query:
                return "wireless_troubleshooting"
            if "connect" in query:
                return "connectivity_troubleshooting"
            if any(kw in query for kw in ["slow", "latency", "performance"]):
                return "performance_diagnosis"
            return "troubleshooting_research"

        # Incident
        if any(kw in query for kw in ["incident", "alert", "alarm", "critical", "outage"]):
            if any(kw in query for kw in ["triage", "priorit"]):
                return "incident_triage"
            return "incident_investigation"

        # Configuration
        if any(kw in query for kw in ["config", "configuration", "setting"]):
            if "compare" in query or "diff" in query:
                return "config_comparison"
            return "config_review"

        # Monitoring
        if any(kw in query for kw in ["health", "overview", "monitor"]):
            return "health_check"
        if any(kw in query for kw in ["bandwidth", "traffic", "throughput"]):
            return "bandwidth_analysis"

        # Unclassified queries — return None instead of a default.
        # We don't want to inflate ROI with unrelated queries.
        return None

    def _calculate_roi_percentage(self, manual_cost: float, ai_cost: float) -> float:
        """Calculate ROI as percentage."""
        if ai_cost <= 0:
            return 0.0 if manual_cost <= 0 else float('inf')

        # ROI = ((manual_cost - ai_cost) / ai_cost) * 100
        return ((manual_cost - ai_cost) / ai_cost) * 100

    def _calculate_duration_ms(self, session: AISession) -> int:
        """Calculate total session duration in milliseconds."""
        if session.total_duration_ms:
            return int(session.total_duration_ms)

        if session.ended_at and session.started_at:
            delta = session.ended_at - session.started_at
            return int(delta.total_seconds() * 1000)

        if session.last_activity_at and session.started_at:
            delta = session.last_activity_at - session.started_at
            return int(delta.total_seconds() * 1000)

        return 0

    def _classify_session_type(
        self,
        events: List[AISessionEvent],
        action_breakdown: Dict[str, float]
    ) -> str:
        """Classify the session type based on actions taken."""
        # Count actions by category
        category_counts: Dict[str, int] = {}

        for event in events:
            action_type = self._classify_action(event)
            if action_type and action_type in ROI_BASELINES:
                category = ROI_BASELINES[action_type].category.value
                category_counts[category] = category_counts.get(category, 0) + 1

        # Check for incident response patterns
        for event in events:
            query = str((event.event_data or {}).get("query", "")).lower()
            if any(kw in query for kw in ["incident", "alert", "down", "outage", "critical"]):
                return "incident_response"

        # Determine by dominant category
        if not category_counts:
            return "investigation"

        dominant = max(category_counts, key=category_counts.get)

        if dominant == ActionCategory.INCIDENT_RESPONSE.value:
            return "incident_response"
        elif dominant == ActionCategory.LOG_ANALYSIS.value:
            return "investigation"
        elif dominant == ActionCategory.CONFIGURATION.value:
            return "configuration"
        elif dominant == ActionCategory.MONITORING.value:
            if "performance_diagnosis" in action_breakdown or "bandwidth_analysis" in action_breakdown:
                return "optimization"
            return "monitoring"
        elif dominant == ActionCategory.TROUBLESHOOTING.value:
            return "investigation"

        return "investigation"

    def _calculate_complexity_score(
        self,
        session: AISession,
        events: List[AISessionEvent]
    ) -> int:
        """
        Calculate complexity score (1-5) based on session characteristics.

        Factors:
        - Number of unique action types
        - Number of AI queries
        - Number of different pages visited
        - Error count
        - Duration
        """
        score = 1

        # Unique action types
        unique_actions = set()
        pages_visited = set()

        for event in events:
            action = self._classify_action(event)
            if action:
                unique_actions.add(action)
            if event.page_path:
                pages_visited.add(event.page_path)

        if len(unique_actions) >= 5:
            score += 1
        if len(unique_actions) >= 10:
            score += 1

        # AI query count
        query_count = session.ai_query_count or 0
        if query_count >= 5:
            score += 0.5
        if query_count >= 10:
            score += 0.5

        # Pages visited
        if len(pages_visited) >= 3:
            score += 0.5

        # Duration factor
        duration_ms = self._calculate_duration_ms(session)
        duration_minutes = duration_ms / 60000
        if duration_minutes >= 10:
            score += 0.5
        if duration_minutes >= 30:
            score += 0.5

        return min(5, max(1, int(score)))

    def _calculate_cost_breakdown(
        self,
        session: AISession,
        events: List[AISessionEvent]
    ) -> Dict[str, float]:
        """Calculate cost breakdown by category."""
        breakdown = {
            "ai_queries": 0.0,
            "enrichment": 0.0,
            "summary": float(session.summary_cost_usd or 0)
        }

        for event in events:
            if not event.cost_usd:
                continue

            cost = float(event.cost_usd)

            if event.event_type in ("ai_query", "ai_response"):
                # Check if it's an enrichment call (API data fetch)
                query = str((event.event_data or {}).get("query", "")).lower()
                if any(kw in query for kw in ["enrich", "fetch", "get details"]):
                    breakdown["enrichment"] += cost
                else:
                    breakdown["ai_queries"] += cost
            else:
                breakdown["ai_queries"] += cost

        # Round all values
        return {k: round(v, 8) for k, v in breakdown.items()}

    def _calculate_performance_metrics(
        self, events: List[AISessionEvent]
    ) -> Tuple[Optional[int], Optional[int]]:
        """Calculate average and max response times for AI queries."""
        response_times = []

        for event in events:
            if event.event_type in ("ai_query", "ai_response") and event.duration_ms:
                response_times.append(event.duration_ms)
            elif event.api_duration_ms:
                response_times.append(event.api_duration_ms)

        if not response_times:
            return None, None

        avg_ms = int(sum(response_times) / len(response_times))
        max_ms = max(response_times)

        return avg_ms, max_ms

    def _calculate_efficiency_score(
        self,
        roi_percentage: float,
        time_saved: float,
        duration_minutes: float,
        error_count: int,
        query_count: int
    ) -> int:
        """
        Calculate composite efficiency score (0-100).

        Weights:
        - Cost efficiency (ROI): 40%
        - Time efficiency (time saved / duration): 40%
        - Query efficiency (success rate): 20%
        """
        # Cost efficiency: 1000% ROI = 100 score, capped at 100
        cost_score = min(100, roi_percentage / 10) if roi_percentage > 0 else 0

        # Time efficiency: time_saved / duration ratio
        if duration_minutes > 0:
            time_ratio = time_saved / duration_minutes
            time_score = min(100, time_ratio * 20)  # 5x time saved = 100
        else:
            time_score = 50  # Neutral if no duration

        # Query efficiency: penalize for errors
        if query_count > 0:
            error_rate = error_count / query_count
            query_score = max(0, 100 - (error_rate * 100))
        else:
            query_score = 100  # No queries, no errors

        # Weighted average
        overall = (cost_score * 0.4) + (time_score * 0.4) + (query_score * 0.2)

        return min(100, max(0, int(overall)))

    def detect_incident_context(
        self, events: List[AISessionEvent]
    ) -> Optional[Dict[str, Any]]:
        """
        Detect if session is related to incident resolution.

        Returns:
            Dict with incident_id if detected, None otherwise
        """
        incident_patterns = [
            r"incident[:\s#]+(\d+)",
            r"alert[:\s#]+([A-Z0-9-]+)",
            r"ticket[:\s#]+([A-Z0-9-]+)",
            r"#(\d{4,})",  # Ticket numbers like #12345
        ]

        for event in events:
            if event.event_type != "ai_query":
                continue

            query = str((event.event_data or {}).get("query", ""))

            for pattern in incident_patterns:
                match = re.search(pattern, query, re.IGNORECASE)
                if match:
                    return {
                        "detected_id": match.group(1),
                        "pattern_matched": pattern,
                        "source_query": query[:200]
                    }

        return None

    def get_roi_summary(self, metrics: ROIMetrics) -> Dict[str, Any]:
        """
        Get a human-readable summary of ROI metrics.

        Returns:
            Dict with formatted summary for UI display
        """
        # Determine ROI tier
        if metrics.roi_percentage >= GOOD_ROI_THRESHOLD:
            roi_tier = "excellent"
            roi_color = "green"
        elif metrics.roi_percentage >= WARNING_ROI_THRESHOLD:
            roi_tier = "good"
            roi_color = "yellow"
        else:
            roi_tier = "low"
            roi_color = "red"

        # Format time saved
        if metrics.time_saved_minutes >= 60:
            time_saved_display = f"{metrics.time_saved_minutes / 60:.1f} hours"
        else:
            time_saved_display = f"{metrics.time_saved_minutes:.0f} minutes"

        # Calculate net savings
        net_savings = metrics.manual_cost_usd - metrics.ai_cost_usd

        return {
            "time_saved_display": time_saved_display,
            "time_saved_minutes": metrics.time_saved_minutes,
            "manual_cost_display": f"${metrics.manual_cost_usd:.2f}",
            "ai_cost_display": f"${metrics.ai_cost_usd:.4f}",
            "net_savings_display": f"${net_savings:.2f}",
            "roi_percentage": metrics.roi_percentage,
            "roi_display": f"{metrics.roi_percentage:.0f}%",
            "roi_tier": roi_tier,
            "roi_color": roi_color,
            "efficiency_score": metrics.efficiency_score,
            "session_type": SESSION_TYPES.get(metrics.session_type, {}).get("display_name", metrics.session_type),
            "complexity_score": metrics.complexity_score,
            "cost_breakdown": metrics.cost_breakdown,
            "avg_response_time_ms": metrics.avg_response_time_ms,
        }


# Global singleton
_calculator: Optional[ROICalculator] = None


def get_roi_calculator(hourly_rate: float = None) -> ROICalculator:
    """Get the ROI calculator singleton."""
    global _calculator
    if _calculator is None or hourly_rate is not None:
        _calculator = ROICalculator(hourly_rate=hourly_rate)
    return _calculator
