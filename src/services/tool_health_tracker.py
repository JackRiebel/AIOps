"""Tool Health Tracker with Circuit Breaker Pattern.

This module tracks tool success/failure rates and implements circuit breakers
to temporarily disable failing tools. This prevents cascading failures when
a platform API is down or experiencing issues.

Key features:
- Tracks success/failure counts per tool
- Opens circuit breaker after consecutive failures
- Auto-resets circuit after timeout period
- Provides health scores for tool selection prioritization
- Persists health data to Redis for cross-instance awareness

Based on the circuit breaker pattern from Michael Nygard's "Release It!"
and adapted for AI tool selection optimization.
"""

import logging
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation, tool is healthy
    OPEN = "open"          # Tool is failing, reject calls
    HALF_OPEN = "half_open"  # Testing if tool has recovered


@dataclass
class ToolHealthStats:
    """Health statistics for a single tool."""
    tool_name: str
    success_count: int = 0
    failure_count: int = 0
    consecutive_failures: int = 0
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    last_error: Optional[str] = None
    circuit_state: CircuitState = CircuitState.CLOSED
    circuit_opened_at: Optional[datetime] = None
    circuit_open_until: Optional[datetime] = None
    half_open_attempts: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "tool_name": self.tool_name,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "consecutive_failures": self.consecutive_failures,
            "last_success": self.last_success.isoformat() if self.last_success else None,
            "last_failure": self.last_failure.isoformat() if self.last_failure else None,
            "last_error": self.last_error,
            "circuit_state": self.circuit_state.value,
            "circuit_opened_at": self.circuit_opened_at.isoformat() if self.circuit_opened_at else None,
            "circuit_open_until": self.circuit_open_until.isoformat() if self.circuit_open_until else None,
        }

    @property
    def total_calls(self) -> int:
        """Total number of calls (success + failure)."""
        return self.success_count + self.failure_count

    @property
    def success_rate(self) -> float:
        """Success rate as a float between 0.0 and 1.0."""
        if self.total_calls == 0:
            return 1.0  # Assume healthy if no data
        return self.success_count / self.total_calls


class ToolHealthTracker:
    """Track tool success/failure rates and implement circuit breakers.

    This service monitors tool health and provides:
    - Health scores for tool selection prioritization
    - Circuit breaker to temporarily disable failing tools
    - Metrics for debugging and monitoring

    Configuration:
    - FAILURE_THRESHOLD: Consecutive failures to open circuit (default: 3)
    - CIRCUIT_RESET_SECONDS: Time before circuit auto-resets (default: 300s/5min)
    - HALF_OPEN_MAX_ATTEMPTS: Test calls in half-open state (default: 2)
    """

    # Configuration constants
    FAILURE_THRESHOLD = 3           # Consecutive failures to open circuit
    CIRCUIT_RESET_SECONDS = 300     # 5 minutes before auto-reset
    HALF_OPEN_MAX_ATTEMPTS = 2      # Test calls allowed in half-open state
    MIN_CALLS_FOR_SCORING = 5       # Minimum calls before health score affects selection

    def __init__(self, redis_client=None):
        """Initialize the health tracker.

        Args:
            redis_client: Optional Redis client for cross-instance persistence
        """
        self._stats: Dict[str, ToolHealthStats] = {}
        self._redis = redis_client
        self._platform_health: Dict[str, bool] = {}  # Platform-level health tracking

        logger.info("[ToolHealthTracker] Initialized")

    def _get_stats(self, tool_name: str) -> ToolHealthStats:
        """Get or create stats for a tool."""
        if tool_name not in self._stats:
            self._stats[tool_name] = ToolHealthStats(tool_name=tool_name)
        return self._stats[tool_name]

    def _get_platform(self, tool_name: str) -> Optional[str]:
        """Extract platform from tool name.

        Examples:
            meraki_get_network -> meraki
            catalyst_list_sites -> catalyst
            thousandeyes_get_tests -> thousandeyes
        """
        parts = tool_name.lower().split("_")
        if parts:
            platform = parts[0]
            if platform in ("meraki", "catalyst", "thousandeyes", "splunk", "knowledge"):
                return platform
        return None

    async def record_success(self, tool_name: str) -> None:
        """Record a successful tool execution.

        This resets consecutive failure count and may close the circuit.

        Args:
            tool_name: Name of the tool that succeeded
        """
        stats = self._get_stats(tool_name)
        stats.success_count += 1
        stats.consecutive_failures = 0
        stats.last_success = datetime.utcnow()

        # Handle circuit state transitions
        if stats.circuit_state == CircuitState.HALF_OPEN:
            # Success in half-open state closes the circuit
            stats.circuit_state = CircuitState.CLOSED
            stats.circuit_opened_at = None
            stats.circuit_open_until = None
            stats.half_open_attempts = 0
            logger.info(
                f"[ToolHealthTracker] Circuit CLOSED for {tool_name} after successful recovery"
            )
        elif stats.circuit_state == CircuitState.OPEN:
            # Should not happen, but handle gracefully
            stats.circuit_state = CircuitState.CLOSED
            stats.circuit_opened_at = None
            stats.circuit_open_until = None

        # Update platform health
        platform = self._get_platform(tool_name)
        if platform:
            self._platform_health[platform] = True

        logger.debug(
            f"[ToolHealthTracker] Success: {tool_name} "
            f"(total: {stats.success_count}/{stats.total_calls}, "
            f"rate: {stats.success_rate:.1%})"
        )

        await self._persist_stats(stats)

    async def record_failure(self, tool_name: str, error: str) -> None:
        """Record a failed tool execution.

        This increments failure count and may open the circuit.

        Args:
            tool_name: Name of the tool that failed
            error: Error message describing the failure
        """
        stats = self._get_stats(tool_name)
        stats.failure_count += 1
        stats.consecutive_failures += 1
        stats.last_failure = datetime.utcnow()
        stats.last_error = error[:200] if error else None  # Truncate long errors

        # Handle circuit state transitions
        if stats.circuit_state == CircuitState.HALF_OPEN:
            # Failure in half-open state re-opens the circuit
            stats.half_open_attempts += 1
            if stats.half_open_attempts >= self.HALF_OPEN_MAX_ATTEMPTS:
                self._open_circuit(stats)
                logger.warning(
                    f"[ToolHealthTracker] Circuit RE-OPENED for {tool_name} "
                    f"after failed recovery attempts"
                )
        elif stats.circuit_state == CircuitState.CLOSED:
            # Check if we should open the circuit
            if stats.consecutive_failures >= self.FAILURE_THRESHOLD:
                self._open_circuit(stats)
                logger.warning(
                    f"[ToolHealthTracker] Circuit OPENED for {tool_name} "
                    f"after {stats.consecutive_failures} consecutive failures"
                )

        # Update platform health
        platform = self._get_platform(tool_name)
        if platform and stats.consecutive_failures >= self.FAILURE_THRESHOLD:
            self._platform_health[platform] = False

        logger.debug(
            f"[ToolHealthTracker] Failure: {tool_name} "
            f"(consecutive: {stats.consecutive_failures}, "
            f"circuit: {stats.circuit_state.value})"
        )

        await self._persist_stats(stats)

    def _open_circuit(self, stats: ToolHealthStats) -> None:
        """Open the circuit breaker for a tool."""
        stats.circuit_state = CircuitState.OPEN
        stats.circuit_opened_at = datetime.utcnow()
        stats.circuit_open_until = datetime.utcnow() + timedelta(
            seconds=self.CIRCUIT_RESET_SECONDS
        )
        stats.half_open_attempts = 0

    def _check_circuit_timeout(self, stats: ToolHealthStats) -> None:
        """Check if circuit should transition to half-open state."""
        if stats.circuit_state != CircuitState.OPEN:
            return

        now = datetime.utcnow()
        if stats.circuit_open_until and now >= stats.circuit_open_until:
            # Transition to half-open to test recovery
            stats.circuit_state = CircuitState.HALF_OPEN
            stats.half_open_attempts = 0
            logger.info(
                f"[ToolHealthTracker] Circuit HALF-OPEN for {stats.tool_name} "
                f"(testing recovery)"
            )

    def is_healthy(self, tool_name: str) -> bool:
        """Check if a tool is healthy (circuit is not open).

        Args:
            tool_name: Name of the tool to check

        Returns:
            True if the tool is available for use, False if circuit is open
        """
        if tool_name not in self._stats:
            return True  # Unknown tools are assumed healthy

        stats = self._stats[tool_name]

        # Check for circuit timeout
        self._check_circuit_timeout(stats)

        # Open circuit means tool is unhealthy
        if stats.circuit_state == CircuitState.OPEN:
            return False

        # Half-open allows limited test calls
        if stats.circuit_state == CircuitState.HALF_OPEN:
            return stats.half_open_attempts < self.HALF_OPEN_MAX_ATTEMPTS

        return True

    def get_health_score(self, tool_name: str) -> float:
        """Get a health score for tool selection prioritization.

        Returns a score between 0.0 (unhealthy) and 1.0 (healthy).
        This score can be used to adjust tool selection priority.

        Args:
            tool_name: Name of the tool

        Returns:
            Health score between 0.0 and 1.0
        """
        if tool_name not in self._stats:
            return 1.0  # Unknown tools get perfect score

        stats = self._stats[tool_name]

        # Check for circuit timeout
        self._check_circuit_timeout(stats)

        # Open circuit = 0.0 score
        if stats.circuit_state == CircuitState.OPEN:
            return 0.0

        # Half-open = 0.5 score (testing)
        if stats.circuit_state == CircuitState.HALF_OPEN:
            return 0.5

        # Not enough data = assume healthy
        if stats.total_calls < self.MIN_CALLS_FOR_SCORING:
            return 1.0

        # Score based on success rate (0.5 - 1.0 range)
        # We don't go below 0.5 for closed circuits to avoid over-penalizing
        return 0.5 + (stats.success_rate * 0.5)

    def is_platform_healthy(self, platform: str) -> bool:
        """Check if a platform is healthy overall.

        Args:
            platform: Platform name (meraki, catalyst, etc.)

        Returns:
            True if platform is healthy, False if experiencing issues
        """
        return self._platform_health.get(platform.lower(), True)

    def get_unhealthy_tools(self) -> List[str]:
        """Get list of tools with open circuit breakers.

        Returns:
            List of tool names that are currently unhealthy
        """
        unhealthy = []
        for tool_name, stats in self._stats.items():
            self._check_circuit_timeout(stats)
            if stats.circuit_state == CircuitState.OPEN:
                unhealthy.append(tool_name)
        return unhealthy

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get health stats for all tracked tools.

        Returns:
            Dictionary of tool_name -> health stats
        """
        result = {}
        for tool_name, stats in self._stats.items():
            self._check_circuit_timeout(stats)
            result[tool_name] = stats.to_dict()
        return result

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of tool health across all tools.

        Returns:
            Summary statistics
        """
        total_tools = len(self._stats)
        unhealthy_tools = self.get_unhealthy_tools()
        half_open = [
            name for name, stats in self._stats.items()
            if stats.circuit_state == CircuitState.HALF_OPEN
        ]

        total_calls = sum(s.total_calls for s in self._stats.values())
        total_failures = sum(s.failure_count for s in self._stats.values())

        return {
            "total_tracked_tools": total_tools,
            "unhealthy_tools": len(unhealthy_tools),
            "half_open_tools": len(half_open),
            "total_calls": total_calls,
            "total_failures": total_failures,
            "overall_success_rate": 1 - (total_failures / total_calls) if total_calls > 0 else 1.0,
            "unhealthy_tool_names": unhealthy_tools,
            "platform_health": dict(self._platform_health),
        }

    async def reset_tool(self, tool_name: str) -> None:
        """Manually reset a tool's health stats and close its circuit.

        Args:
            tool_name: Name of the tool to reset
        """
        if tool_name in self._stats:
            stats = self._stats[tool_name]
            stats.consecutive_failures = 0
            stats.circuit_state = CircuitState.CLOSED
            stats.circuit_opened_at = None
            stats.circuit_open_until = None
            stats.half_open_attempts = 0
            logger.info(f"[ToolHealthTracker] Manually reset {tool_name}")
            await self._persist_stats(stats)

    async def reset_platform(self, platform: str) -> None:
        """Reset all tools for a platform.

        Args:
            platform: Platform name to reset (meraki, catalyst, etc.)
        """
        platform_lower = platform.lower()
        reset_count = 0

        for tool_name in list(self._stats.keys()):
            if self._get_platform(tool_name) == platform_lower:
                await self.reset_tool(tool_name)
                reset_count += 1

        self._platform_health[platform_lower] = True
        logger.info(f"[ToolHealthTracker] Reset {reset_count} tools for platform {platform}")

    async def _persist_stats(self, stats: ToolHealthStats) -> None:
        """Persist stats to Redis if available."""
        if self._redis:
            try:
                import json
                key = f"tool_health:{stats.tool_name}"
                await self._redis.setex(
                    key,
                    3600,  # 1 hour TTL
                    json.dumps(stats.to_dict())
                )
            except Exception as e:
                logger.warning(f"[ToolHealthTracker] Redis persist failed: {e}")

    async def load_from_redis(self) -> int:
        """Load health stats from Redis.

        Returns:
            Number of tools loaded
        """
        if not self._redis:
            return 0

        try:
            import json
            keys = await self._redis.keys("tool_health:*")
            loaded = 0
            for key in keys:
                data = await self._redis.get(key)
                if data:
                    tool_data = json.loads(data)
                    tool_name = tool_data["tool_name"]
                    stats = ToolHealthStats(tool_name=tool_name)
                    stats.success_count = tool_data.get("success_count", 0)
                    stats.failure_count = tool_data.get("failure_count", 0)
                    stats.consecutive_failures = tool_data.get("consecutive_failures", 0)

                    if tool_data.get("last_success"):
                        stats.last_success = datetime.fromisoformat(tool_data["last_success"])
                    if tool_data.get("last_failure"):
                        stats.last_failure = datetime.fromisoformat(tool_data["last_failure"])
                    if tool_data.get("circuit_opened_at"):
                        stats.circuit_opened_at = datetime.fromisoformat(tool_data["circuit_opened_at"])
                    if tool_data.get("circuit_open_until"):
                        stats.circuit_open_until = datetime.fromisoformat(tool_data["circuit_open_until"])

                    stats.circuit_state = CircuitState(tool_data.get("circuit_state", "closed"))
                    stats.last_error = tool_data.get("last_error")

                    self._stats[tool_name] = stats
                    loaded += 1

            logger.info(f"[ToolHealthTracker] Loaded {loaded} tool stats from Redis")
            return loaded
        except Exception as e:
            logger.warning(f"[ToolHealthTracker] Failed to load from Redis: {e}")
            return 0


# Singleton instance
_tool_health_tracker: Optional[ToolHealthTracker] = None


def get_tool_health_tracker() -> ToolHealthTracker:
    """Get the singleton ToolHealthTracker instance."""
    global _tool_health_tracker
    if _tool_health_tracker is None:
        _tool_health_tracker = ToolHealthTracker()
    return _tool_health_tracker


async def init_tool_health_tracker(redis_client=None) -> ToolHealthTracker:
    """Initialize the tool health tracker with optional Redis persistence.

    Args:
        redis_client: Optional Redis client for persistence

    Returns:
        The initialized ToolHealthTracker
    """
    global _tool_health_tracker
    _tool_health_tracker = ToolHealthTracker(redis_client=redis_client)

    if redis_client:
        await _tool_health_tracker.load_from_redis()

    logger.info("[ToolHealthTracker] Initialized with persistence options")
    return _tool_health_tracker
