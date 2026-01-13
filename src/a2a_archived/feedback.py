"""
Routing Feedback Tracker - Tracks routing outcomes to improve agent selection.

This module records outcomes of routing decisions and uses historical performance
data to dynamically adjust agent selection priorities.
"""

import json
import logging
import os
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


@dataclass
class RoutingOutcome:
    """Records the outcome of a routing decision."""
    query: str
    intent: str
    agent_id: str
    success: bool
    quality_score: float  # 0-1 scale
    response_time_ms: int
    timestamp: str = ""
    user_feedback: Optional[str] = None  # "helpful", "not_helpful", "wrong_agent"
    session_id: Optional[str] = None
    had_data: bool = True  # Whether the response contained data
    error_occurred: bool = False

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


class RoutingFeedbackTracker:
    """
    Tracks routing outcomes to improve agent selection over time.

    Uses a simple file-based persistence for feedback data with in-memory
    caching for fast access during routing decisions.
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the feedback tracker.

        Args:
            db_path: Path to the JSON file for persisting feedback data.
                     Defaults to data/routing_feedback.json
        """
        if db_path is None:
            # Default to data directory in project root
            project_root = Path(__file__).parent.parent.parent
            data_dir = project_root / "data"
            data_dir.mkdir(exist_ok=True)
            db_path = str(data_dir / "routing_feedback.json")

        self.db_path = db_path
        self.outcomes: List[RoutingOutcome] = []

        # Agent performance statistics
        self.agent_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "total_queries": 0,
            "successful_queries": 0,
            "total_quality": 0.0,
            "total_response_time_ms": 0,
            "data_responses": 0,  # Responses that had data
            "error_count": 0,
            "intent_performance": defaultdict(lambda: {
                "total": 0,
                "success": 0,
                "quality_sum": 0.0
            })
        })

        # Load existing data
        self._load()

        logger.info(f"RoutingFeedbackTracker initialized with {len(self.agent_stats)} agents tracked")

    def record_outcome(self, outcome: RoutingOutcome) -> None:
        """
        Record a routing outcome.

        Args:
            outcome: The routing outcome to record
        """
        self.outcomes.append(outcome)

        # Update agent statistics
        stats = self.agent_stats[outcome.agent_id]
        stats["total_queries"] += 1

        if outcome.success:
            stats["successful_queries"] += 1

        stats["total_quality"] += outcome.quality_score
        stats["total_response_time_ms"] += outcome.response_time_ms

        if outcome.had_data:
            stats["data_responses"] += 1

        if outcome.error_occurred:
            stats["error_count"] += 1

        # Intent-specific tracking
        if outcome.intent:
            intent_stats = stats["intent_performance"][outcome.intent]
            intent_stats["total"] += 1
            if outcome.success:
                intent_stats["success"] += 1
            intent_stats["quality_sum"] += outcome.quality_score

        # Persist to disk (async would be better for production)
        self._save()

        logger.debug(
            f"Recorded outcome for agent {outcome.agent_id}: "
            f"success={outcome.success}, quality={outcome.quality_score:.2f}"
        )

    def record_user_feedback(
        self,
        session_id: str,
        feedback: str,
        query: Optional[str] = None
    ) -> bool:
        """
        Record explicit user feedback for a session.

        Args:
            session_id: The session ID to associate feedback with
            feedback: One of "helpful", "not_helpful", "wrong_agent"
            query: Optional query text to match

        Returns:
            True if feedback was recorded, False if no matching outcome found
        """
        # Find recent outcome for this session
        for outcome in reversed(self.outcomes):
            if outcome.session_id == session_id:
                if query is None or outcome.query == query:
                    outcome.user_feedback = feedback

                    # Adjust success based on feedback
                    if feedback == "helpful":
                        # Boost success stats
                        stats = self.agent_stats[outcome.agent_id]
                        if not outcome.success:
                            stats["successful_queries"] += 1
                            outcome.success = True
                    elif feedback in ("not_helpful", "wrong_agent"):
                        # Reduce success stats
                        stats = self.agent_stats[outcome.agent_id]
                        if outcome.success:
                            stats["successful_queries"] -= 1
                            outcome.success = False

                    self._save()
                    logger.info(f"User feedback '{feedback}' recorded for session {session_id}")
                    return True

        logger.warning(f"No matching outcome found for session {session_id}")
        return False

    def get_priority_adjustment(
        self,
        intent: Optional[str],
        agent_id: str
    ) -> float:
        """
        Get priority adjustment based on historical performance.

        Returns a value between -0.3 and +0.3 to adjust routing scores.
        Positive values indicate the agent performs well, negative indicates
        underperformance.

        Args:
            intent: The classified intent (optional)
            agent_id: The agent ID to get adjustment for

        Returns:
            Adjustment factor between -0.3 and +0.3
        """
        stats = self.agent_stats.get(agent_id)

        if not stats or stats["total_queries"] < 5:
            return 0.0  # Not enough data to make adjustments

        # Calculate overall success rate
        overall_rate = stats["successful_queries"] / stats["total_queries"]

        # Factor in data response rate (penalize "no data" responses)
        data_rate = stats["data_responses"] / stats["total_queries"]
        overall_rate = (overall_rate * 0.7) + (data_rate * 0.3)

        # Intent-specific rate (if available and has enough data)
        if intent and intent in stats["intent_performance"]:
            intent_stats = stats["intent_performance"][intent]
            if intent_stats["total"] >= 3:
                intent_rate = intent_stats["success"] / intent_stats["total"]
                # Weight intent-specific performance more heavily
                combined_rate = (overall_rate * 0.3) + (intent_rate * 0.7)
            else:
                combined_rate = overall_rate
        else:
            combined_rate = overall_rate

        # Convert to adjustment range (-0.3 to +0.3)
        # 0.5 success rate = 0 adjustment (baseline)
        # 1.0 success rate = +0.3 adjustment (max boost)
        # 0.0 success rate = -0.3 adjustment (max penalty)
        adjustment = (combined_rate - 0.5) * 0.6

        return max(-0.3, min(0.3, adjustment))

    def get_agent_stats(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """
        Get performance statistics for an agent.

        Args:
            agent_id: The agent ID to get stats for

        Returns:
            Dictionary with agent statistics or None if not found
        """
        stats = self.agent_stats.get(agent_id)
        if not stats:
            return None

        # Calculate derived metrics
        total = stats["total_queries"]
        if total > 0:
            return {
                **stats,
                "success_rate": stats["successful_queries"] / total,
                "avg_quality": stats["total_quality"] / total,
                "avg_response_time_ms": stats["total_response_time_ms"] / total,
                "data_rate": stats["data_responses"] / total,
                "error_rate": stats["error_count"] / total,
            }
        return dict(stats)

    def get_all_agent_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all tracked agents."""
        return {
            agent_id: self.get_agent_stats(agent_id)
            for agent_id in self.agent_stats
            if self.agent_stats[agent_id]["total_queries"] > 0
        }

    def get_recent_outcomes(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get recent routing outcomes.

        Args:
            limit: Maximum number of outcomes to return

        Returns:
            List of outcome dictionaries
        """
        return [asdict(o) for o in self.outcomes[-limit:]]

    def get_performance_trend(
        self,
        agent_id: str,
        window_size: int = 10
    ) -> Dict[str, Any]:
        """
        Get recent performance trend for an agent.

        Args:
            agent_id: The agent ID
            window_size: Number of recent outcomes to consider

        Returns:
            Trend information including direction and strength
        """
        # Get recent outcomes for this agent
        agent_outcomes = [
            o for o in self.outcomes
            if o.agent_id == agent_id
        ][-window_size:]

        if len(agent_outcomes) < 3:
            return {"trend": "insufficient_data", "direction": 0}

        # Calculate success rate for first half vs second half
        mid = len(agent_outcomes) // 2
        first_half = agent_outcomes[:mid]
        second_half = agent_outcomes[mid:]

        first_rate = sum(1 for o in first_half if o.success) / len(first_half)
        second_rate = sum(1 for o in second_half if o.success) / len(second_half)

        diff = second_rate - first_rate

        if diff > 0.1:
            return {"trend": "improving", "direction": 1, "change": diff}
        elif diff < -0.1:
            return {"trend": "declining", "direction": -1, "change": diff}
        else:
            return {"trend": "stable", "direction": 0, "change": diff}

    def _load(self) -> None:
        """Load feedback data from disk."""
        try:
            if os.path.exists(self.db_path):
                with open(self.db_path, 'r') as f:
                    data = json.load(f)

                # Restore agent stats with defaultdict behavior
                if "agent_stats" in data:
                    for agent_id, stats in data["agent_stats"].items():
                        self.agent_stats[agent_id] = {
                            "total_queries": stats.get("total_queries", 0),
                            "successful_queries": stats.get("successful_queries", 0),
                            "total_quality": stats.get("total_quality", 0.0),
                            "total_response_time_ms": stats.get("total_response_time_ms", 0),
                            "data_responses": stats.get("data_responses", 0),
                            "error_count": stats.get("error_count", 0),
                            "intent_performance": defaultdict(
                                lambda: {"total": 0, "success": 0, "quality_sum": 0.0},
                                stats.get("intent_performance", {})
                            )
                        }

                # Restore recent outcomes
                if "recent_outcomes" in data:
                    for outcome_data in data["recent_outcomes"]:
                        try:
                            self.outcomes.append(RoutingOutcome(**outcome_data))
                        except Exception as e:
                            logger.warning(f"Failed to restore outcome: {e}")

                logger.info(f"Loaded feedback data: {len(self.agent_stats)} agents, {len(self.outcomes)} outcomes")
        except FileNotFoundError:
            logger.info("No existing feedback data found, starting fresh")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse feedback data: {e}")
        except Exception as e:
            logger.error(f"Error loading feedback data: {e}")

    def _save(self) -> None:
        """Persist feedback data to disk."""
        try:
            # Convert defaultdicts to regular dicts for JSON serialization
            agent_stats_serializable = {}
            for agent_id, stats in self.agent_stats.items():
                agent_stats_serializable[agent_id] = {
                    **{k: v for k, v in stats.items() if k != "intent_performance"},
                    "intent_performance": dict(stats.get("intent_performance", {}))
                }

            data = {
                "agent_stats": agent_stats_serializable,
                "recent_outcomes": [asdict(o) for o in self.outcomes[-100:]],  # Keep last 100
                "last_updated": datetime.utcnow().isoformat()
            }

            with open(self.db_path, 'w') as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            logger.error(f"Failed to save feedback data: {e}")

    def reset(self) -> None:
        """Reset all feedback data (useful for testing)."""
        self.outcomes = []
        self.agent_stats = defaultdict(lambda: {
            "total_queries": 0,
            "successful_queries": 0,
            "total_quality": 0.0,
            "total_response_time_ms": 0,
            "data_responses": 0,
            "error_count": 0,
            "intent_performance": defaultdict(lambda: {
                "total": 0,
                "success": 0,
                "quality_sum": 0.0
            })
        })
        self._save()
        logger.info("Feedback tracker reset")


# Singleton instance
_feedback_tracker: Optional[RoutingFeedbackTracker] = None


def get_feedback_tracker() -> RoutingFeedbackTracker:
    """Get the singleton feedback tracker instance."""
    global _feedback_tracker
    if _feedback_tracker is None:
        _feedback_tracker = RoutingFeedbackTracker()
    return _feedback_tracker
