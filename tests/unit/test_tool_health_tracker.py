"""Unit tests for ToolHealthTracker."""

import pytest
from datetime import datetime, timedelta
from src.services.tool_health_tracker import (
    ToolHealthTracker,
    ToolHealthStats,
    CircuitState,
)


class TestToolHealthStats:
    """Test ToolHealthStats dataclass."""

    def test_success_rate_no_calls(self):
        """Test success rate with no calls."""
        stats = ToolHealthStats(tool_name="test_tool")
        assert stats.success_rate == 1.0

    def test_success_rate_all_success(self):
        """Test success rate with all successful calls."""
        stats = ToolHealthStats(
            tool_name="test_tool",
            success_count=10,
            failure_count=0,
        )
        assert stats.success_rate == 1.0

    def test_success_rate_mixed(self):
        """Test success rate with mixed results."""
        stats = ToolHealthStats(
            tool_name="test_tool",
            success_count=8,
            failure_count=2,
        )
        assert stats.success_rate == 0.8

    def test_success_rate_all_failure(self):
        """Test success rate with all failures."""
        stats = ToolHealthStats(
            tool_name="test_tool",
            success_count=0,
            failure_count=5,
        )
        assert stats.success_rate == 0.0

    def test_total_calls(self):
        """Test total call count."""
        stats = ToolHealthStats(
            tool_name="test_tool",
            success_count=7,
            failure_count=3,
        )
        assert stats.total_calls == 10

    def test_to_dict(self):
        """Test serialization."""
        stats = ToolHealthStats(
            tool_name="test_tool",
            success_count=5,
            failure_count=2,
            circuit_state=CircuitState.CLOSED,
        )
        d = stats.to_dict()

        assert d["tool_name"] == "test_tool"
        assert d["success_count"] == 5
        assert d["failure_count"] == 2
        assert d["circuit_state"] == "closed"


class TestToolHealthTracker:
    """Test ToolHealthTracker functionality."""

    @pytest.fixture
    def tracker(self):
        return ToolHealthTracker()

    @pytest.mark.asyncio
    async def test_record_success(self, tracker):
        """Test recording successful tool execution."""
        await tracker.record_success("meraki_list_networks")

        stats = tracker._stats.get("meraki_list_networks")
        assert stats is not None
        assert stats.success_count == 1
        assert stats.failure_count == 0
        assert stats.consecutive_failures == 0

    @pytest.mark.asyncio
    async def test_record_failure(self, tracker):
        """Test recording failed tool execution."""
        await tracker.record_failure("meraki_list_networks", "API timeout")

        stats = tracker._stats.get("meraki_list_networks")
        assert stats is not None
        assert stats.failure_count == 1
        assert stats.consecutive_failures == 1
        assert stats.last_error == "API timeout"

    @pytest.mark.asyncio
    async def test_circuit_opens_after_threshold(self, tracker):
        """Test circuit opens after consecutive failures."""
        tool_name = "failing_tool"

        # Record failures up to threshold
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure(tool_name, f"Error {i}")

        assert not tracker.is_healthy(tool_name)
        assert tracker._stats[tool_name].circuit_state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_circuit_stays_closed_below_threshold(self, tracker):
        """Test circuit stays closed below threshold."""
        tool_name = "mostly_ok_tool"

        # Record failures below threshold
        for i in range(tracker.FAILURE_THRESHOLD - 1):
            await tracker.record_failure(tool_name, f"Error {i}")

        assert tracker.is_healthy(tool_name)
        assert tracker._stats[tool_name].circuit_state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_success_resets_consecutive_failures(self, tracker):
        """Test that success resets consecutive failure count."""
        tool_name = "intermittent_tool"

        # Record some failures
        await tracker.record_failure(tool_name, "Error 1")
        await tracker.record_failure(tool_name, "Error 2")

        # Success should reset
        await tracker.record_success(tool_name)

        stats = tracker._stats[tool_name]
        assert stats.consecutive_failures == 0
        assert stats.failure_count == 2  # Total failures still counted

    @pytest.mark.asyncio
    async def test_circuit_closes_after_success_in_half_open(self, tracker):
        """Test circuit closes after successful recovery."""
        tool_name = "recovering_tool"

        # Open the circuit
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure(tool_name, "Error")

        # Manually set to half-open (simulating timeout)
        tracker._stats[tool_name].circuit_state = CircuitState.HALF_OPEN

        # Record success
        await tracker.record_success(tool_name)

        assert tracker.is_healthy(tool_name)
        assert tracker._stats[tool_name].circuit_state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_health_score_unknown_tool(self, tracker):
        """Test health score for unknown tool."""
        score = tracker.get_health_score("unknown_tool")
        assert score == 1.0  # Unknown tools assumed healthy

    @pytest.mark.asyncio
    async def test_health_score_healthy_tool(self, tracker):
        """Test health score for healthy tool."""
        tool_name = "healthy_tool"

        # Record mostly successes
        for i in range(10):
            await tracker.record_success(tool_name)
        await tracker.record_failure(tool_name, "Rare error")

        score = tracker.get_health_score(tool_name)
        assert score >= 0.9

    @pytest.mark.asyncio
    async def test_health_score_unhealthy_tool(self, tracker):
        """Test health score for unhealthy tool."""
        tool_name = "unhealthy_tool"

        # Open circuit
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure(tool_name, "Error")

        score = tracker.get_health_score(tool_name)
        assert score == 0.0

    @pytest.mark.asyncio
    async def test_health_score_half_open(self, tracker):
        """Test health score for half-open circuit."""
        tool_name = "half_open_tool"

        # Open circuit
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure(tool_name, "Error")

        # Set to half-open
        tracker._stats[tool_name].circuit_state = CircuitState.HALF_OPEN

        score = tracker.get_health_score(tool_name)
        assert score == 0.5

    @pytest.mark.asyncio
    async def test_platform_health_tracking(self, tracker):
        """Test platform-level health tracking."""
        # Fail enough tools from one platform
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure("meraki_list_networks", "Error")

        assert not tracker.is_platform_healthy("meraki")

    @pytest.mark.asyncio
    async def test_platform_health_recovers(self, tracker):
        """Test platform health recovers after success."""
        tool_name = "meraki_list_networks"

        # Break the platform
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure(tool_name, "Error")

        # Recover
        tracker._stats[tool_name].circuit_state = CircuitState.HALF_OPEN
        await tracker.record_success(tool_name)

        assert tracker.is_platform_healthy("meraki")

    @pytest.mark.asyncio
    async def test_reset_tool(self, tracker):
        """Test manual tool reset."""
        tool_name = "reset_test"

        # Break the tool
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure(tool_name, "Error")

        assert not tracker.is_healthy(tool_name)

        # Reset it
        await tracker.reset_tool(tool_name)

        assert tracker.is_healthy(tool_name)
        assert tracker._stats[tool_name].circuit_state == CircuitState.CLOSED
        assert tracker._stats[tool_name].consecutive_failures == 0

    @pytest.mark.asyncio
    async def test_get_unhealthy_tools(self, tracker):
        """Test listing unhealthy tools."""
        # Break two tools
        for tool in ["tool_a", "tool_b"]:
            for i in range(tracker.FAILURE_THRESHOLD):
                await tracker.record_failure(tool, "Error")

        # Keep one healthy
        await tracker.record_success("tool_c")

        unhealthy = tracker.get_unhealthy_tools()

        assert "tool_a" in unhealthy
        assert "tool_b" in unhealthy
        assert "tool_c" not in unhealthy

    @pytest.mark.asyncio
    async def test_get_summary(self, tracker):
        """Test summary statistics."""
        # Add some data
        for i in range(5):
            await tracker.record_success("tool_a")
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure("tool_b", "Error")

        summary = tracker.get_summary()

        assert summary["total_tracked_tools"] == 2
        assert summary["unhealthy_tools"] == 1
        assert summary["total_calls"] == 5 + tracker.FAILURE_THRESHOLD
        assert "tool_b" in summary["unhealthy_tool_names"]

    @pytest.mark.asyncio
    async def test_circuit_timeout_transitions_to_half_open(self, tracker):
        """Test circuit transitions to half-open after timeout."""
        tool_name = "timeout_tool"

        # Open the circuit
        for i in range(tracker.FAILURE_THRESHOLD):
            await tracker.record_failure(tool_name, "Error")

        stats = tracker._stats[tool_name]

        # Manually expire the circuit timeout
        stats.circuit_open_until = datetime.utcnow() - timedelta(seconds=1)

        # Check should transition to half-open
        tracker._check_circuit_timeout(stats)

        assert stats.circuit_state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_error_truncation(self, tracker):
        """Test long error messages are truncated."""
        tool_name = "long_error_tool"
        long_error = "x" * 500

        await tracker.record_failure(tool_name, long_error)

        stats = tracker._stats[tool_name]
        assert len(stats.last_error) <= 200
