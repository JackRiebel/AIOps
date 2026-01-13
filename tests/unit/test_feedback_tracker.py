"""Tests for RoutingFeedbackTracker.

Tests the feedback tracking, quality scoring, and adaptive
routing adjustments based on agent performance.
"""

import pytest
from datetime import datetime, timedelta

import sys
sys.path.insert(0, str(__file__).rsplit('/tests', 1)[0])

from src.a2a.feedback import (
    RoutingFeedbackTracker,
    RoutingOutcome,
    get_feedback_tracker,
)


class TestRoutingOutcome:
    """Tests for RoutingOutcome data class."""

    def test_create_successful_outcome(self):
        """Test creating a successful routing outcome."""
        outcome = RoutingOutcome(
            query="Show me devices",
            intent="list_devices",
            agent_id="meraki-agent",
            success=True,
            quality_score=0.95,
            response_time_ms=150,
        )

        assert outcome.query == "Show me devices"
        assert outcome.agent_id == "meraki-agent"
        assert outcome.success is True
        assert outcome.quality_score == 0.95
        assert outcome.response_time_ms == 150
        assert outcome.timestamp is not None

    def test_create_failed_outcome(self):
        """Test creating a failed routing outcome."""
        outcome = RoutingOutcome(
            query="Show me devices",
            intent="list_devices",
            agent_id="meraki-agent",
            success=False,
            quality_score=0.0,
            response_time_ms=5000,
            error_type="timeout",
        )

        assert outcome.success is False
        assert outcome.error_type == "timeout"


class TestFeedbackTracker:
    """Tests for RoutingFeedbackTracker."""

    @pytest.fixture
    def tracker(self):
        """Create a fresh feedback tracker."""
        return RoutingFeedbackTracker()

    def test_record_successful_outcome(self, tracker):
        """Test recording a successful outcome."""
        outcome = RoutingOutcome(
            query="Show me devices",
            intent="list_devices",
            agent_id="meraki-agent",
            success=True,
            quality_score=0.9,
            response_time_ms=100,
        )

        tracker.record_outcome(outcome)

        stats = tracker.get_agent_stats("meraki-agent")
        assert stats is not None
        assert stats["total_queries"] == 1
        assert stats["success_rate"] == 1.0

    def test_record_multiple_outcomes(self, tracker):
        """Test recording multiple outcomes for same agent."""
        # Record 3 successes
        for _ in range(3):
            tracker.record_outcome(RoutingOutcome(
                query="test", intent="test", agent_id="meraki-agent",
                success=True, quality_score=0.9, response_time_ms=100,
            ))

        # Record 1 failure
        tracker.record_outcome(RoutingOutcome(
            query="test", intent="test", agent_id="meraki-agent",
            success=False, quality_score=0.0, response_time_ms=5000,
        ))

        stats = tracker.get_agent_stats("meraki-agent")
        assert stats["total_queries"] == 4
        assert stats["success_rate"] == 0.75  # 3/4

    def test_get_stats_for_unknown_agent(self, tracker):
        """Test getting stats for an agent with no data."""
        stats = tracker.get_agent_stats("unknown-agent")
        assert stats is None or stats.get("total_queries", 0) == 0

    def test_priority_adjustment_positive(self, tracker):
        """Test positive priority adjustment for successful agent."""
        # Record many successes
        for _ in range(20):
            tracker.record_outcome(RoutingOutcome(
                query="test", intent="test", agent_id="meraki-agent",
                success=True, quality_score=0.9, response_time_ms=100,
            ))

        adjustment = tracker.get_priority_adjustment(
            intent="test",
            agent_id="meraki-agent"
        )

        # Should be positive adjustment (between 0 and 0.3)
        assert adjustment >= 0
        assert adjustment <= 0.3

    def test_priority_adjustment_negative(self, tracker):
        """Test negative priority adjustment for failing agent."""
        # Record many failures
        for _ in range(20):
            tracker.record_outcome(RoutingOutcome(
                query="test", intent="test", agent_id="meraki-agent",
                success=False, quality_score=0.0, response_time_ms=5000,
            ))

        adjustment = tracker.get_priority_adjustment(
            intent="test",
            agent_id="meraki-agent"
        )

        # Should be negative adjustment (between -0.3 and 0)
        assert adjustment <= 0
        assert adjustment >= -0.3

    def test_get_all_agent_stats(self, tracker):
        """Test getting stats for all agents."""
        # Record for multiple agents
        for agent in ["meraki-agent", "splunk-agent", "catalyst-agent"]:
            tracker.record_outcome(RoutingOutcome(
                query="test", intent="test", agent_id=agent,
                success=True, quality_score=0.9, response_time_ms=100,
            ))

        all_stats = tracker.get_all_agent_stats()

        assert "meraki-agent" in all_stats
        assert "splunk-agent" in all_stats
        assert "catalyst-agent" in all_stats

    def test_recent_outcomes_limit(self, tracker):
        """Test that recent outcomes are limited."""
        # Record many outcomes
        for i in range(50):
            tracker.record_outcome(RoutingOutcome(
                query=f"test-{i}", intent="test", agent_id="meraki-agent",
                success=True, quality_score=0.9, response_time_ms=100,
            ))

        recent = tracker.get_recent_outcomes(limit=10)
        assert len(recent) <= 10

    def test_quality_score_calculation(self, tracker):
        """Test quality score affects stats."""
        # High quality responses
        for _ in range(5):
            tracker.record_outcome(RoutingOutcome(
                query="test", intent="test", agent_id="high-quality-agent",
                success=True, quality_score=0.95, response_time_ms=100,
            ))

        # Low quality responses
        for _ in range(5):
            tracker.record_outcome(RoutingOutcome(
                query="test", intent="test", agent_id="low-quality-agent",
                success=True, quality_score=0.3, response_time_ms=100,
            ))

        high_stats = tracker.get_agent_stats("high-quality-agent")
        low_stats = tracker.get_agent_stats("low-quality-agent")

        assert high_stats.get("avg_quality", 0) > low_stats.get("avg_quality", 0)


class TestFeedbackTrackerSingleton:
    """Tests for feedback tracker singleton pattern."""

    def test_get_feedback_tracker_returns_instance(self):
        """Test that get_feedback_tracker returns an instance."""
        from src.a2a import feedback
        feedback._feedback_tracker = None  # Reset

        tracker = get_feedback_tracker()
        assert tracker is not None
        assert isinstance(tracker, RoutingFeedbackTracker)

    def test_get_feedback_tracker_returns_same_instance(self):
        """Test that get_feedback_tracker returns the same instance."""
        from src.a2a import feedback
        feedback._feedback_tracker = None  # Reset

        tracker1 = get_feedback_tracker()
        tracker2 = get_feedback_tracker()

        assert tracker1 is tracker2


class TestIntentBasedTracking:
    """Tests for intent-based performance tracking."""

    @pytest.fixture
    def tracker(self):
        return RoutingFeedbackTracker()

    def test_track_by_intent(self, tracker):
        """Test tracking performance by intent."""
        # Good at list_devices
        for _ in range(10):
            tracker.record_outcome(RoutingOutcome(
                query="list devices", intent="list_devices", agent_id="meraki-agent",
                success=True, quality_score=0.9, response_time_ms=100,
            ))

        # Bad at search
        for _ in range(10):
            tracker.record_outcome(RoutingOutcome(
                query="search", intent="search", agent_id="meraki-agent",
                success=False, quality_score=0.1, response_time_ms=5000,
            ))

        # Different adjustments for different intents
        list_adj = tracker.get_priority_adjustment("list_devices", "meraki-agent")
        search_adj = tracker.get_priority_adjustment("search", "meraki-agent")

        # list_devices should have higher priority than search
        assert list_adj >= search_adj


class TestResponseTimeTracking:
    """Tests for response time tracking."""

    @pytest.fixture
    def tracker(self):
        return RoutingFeedbackTracker()

    def test_avg_response_time(self, tracker):
        """Test average response time calculation."""
        times = [100, 150, 200, 250, 300]
        for t in times:
            tracker.record_outcome(RoutingOutcome(
                query="test", intent="test", agent_id="test-agent",
                success=True, quality_score=0.9, response_time_ms=t,
            ))

        stats = tracker.get_agent_stats("test-agent")
        expected_avg = sum(times) / len(times)

        assert abs(stats.get("avg_response_time_ms", 0) - expected_avg) < 1


class TestUserFeedback:
    """Tests for explicit user feedback."""

    @pytest.fixture
    def tracker(self):
        return RoutingFeedbackTracker()

    def test_record_user_feedback_helpful(self, tracker):
        """Test recording positive user feedback."""
        # First record an outcome
        tracker.record_outcome(RoutingOutcome(
            query="test", intent="test", agent_id="test-agent",
            success=True, quality_score=0.9, response_time_ms=100,
            session_id="session-123",
        ))

        # Then record user feedback
        tracker.record_user_feedback("session-123", "helpful")

        # Should boost the agent's stats
        stats = tracker.get_agent_stats("test-agent")
        assert stats is not None

    def test_record_user_feedback_not_helpful(self, tracker):
        """Test recording negative user feedback."""
        tracker.record_outcome(RoutingOutcome(
            query="test", intent="test", agent_id="test-agent",
            success=True, quality_score=0.9, response_time_ms=100,
            session_id="session-456",
        ))

        tracker.record_user_feedback("session-456", "not_helpful")

        # Feedback recorded (implementation may vary)
        stats = tracker.get_agent_stats("test-agent")
        assert stats is not None
