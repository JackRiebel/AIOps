"""
A2A Feedback Module - Compatibility Stub

This module provides backward compatibility for A2A feedback imports.
The A2A framework has been archived, so these are stub implementations
that return empty/default data.

Use the unified architecture metrics instead.
"""

import logging
from enum import Enum
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class RoutingOutcome(Enum):
    """Routing outcome types."""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILURE = "failure"
    ERROR = "error"


@dataclass
class FeedbackRecord:
    """A feedback record for routing outcome."""
    query: str = ""
    agent_id: str = ""
    success: bool = False
    quality_score: float = 0.0
    response_time_ms: int = 0
    timestamp: Optional[datetime] = None
    error_type: Optional[str] = None


class FeedbackTracker:
    """Stub feedback tracker that returns empty data.

    The A2A feedback system has been archived. This stub provides
    backward compatibility for code that imports the feedback tracker.
    """

    _instance: Optional['FeedbackTracker'] = None

    def __init__(self):
        self._warned = False

    def _warn_once(self):
        """Log a warning once about using archived functionality."""
        if not self._warned:
            logger.warning(
                "A2A FeedbackTracker has been archived. "
                "Returning empty data for backward compatibility."
            )
            self._warned = True

    def record_outcome(
        self,
        query: str,
        agent_id: str,
        outcome: RoutingOutcome,
        quality_score: float = 0.0,
        response_time_ms: int = 0,
        error_type: str = None,
    ) -> None:
        """Record a routing outcome (no-op stub)."""
        self._warn_once()

    def get_all_agent_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get stats for all agents (returns empty dict)."""
        self._warn_once()
        return {}

    def get_agent_stats(self, agent_id: str) -> Dict[str, Any]:
        """Get stats for a specific agent (returns empty dict)."""
        self._warn_once()
        return {}

    def get_recent_outcomes(self, limit: int = 20) -> List[FeedbackRecord]:
        """Get recent routing outcomes (returns empty list)."""
        self._warn_once()
        return []

    def get_trend_data(
        self,
        agent_id: str,
        period: str = "24h"
    ) -> Dict[str, Any]:
        """Get trend data for an agent (returns empty dict)."""
        self._warn_once()
        return {"data_points": [], "period": period}

    def clear_stats(self) -> None:
        """Clear all stats (no-op stub)."""
        self._warn_once()


_feedback_tracker: Optional[FeedbackTracker] = None


def get_feedback_tracker() -> FeedbackTracker:
    """Get the singleton feedback tracker instance."""
    global _feedback_tracker
    if _feedback_tracker is None:
        _feedback_tracker = FeedbackTracker()
    return _feedback_tracker


__all__ = [
    "RoutingOutcome",
    "FeedbackRecord",
    "FeedbackTracker",
    "get_feedback_tracker",
]
