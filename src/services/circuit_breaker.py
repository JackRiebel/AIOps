"""Circuit breaker pattern implementation for external API resilience.

This module provides a circuit breaker that protects the application from
cascading failures when external services are unavailable or slow.

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Circuit is broken, requests fail fast without calling external service
- HALF_OPEN: Testing if service has recovered, allows limited requests through

Usage:
    from src.services.circuit_breaker import circuit_breaker, CircuitBreakerError

    @circuit_breaker("meraki_api")
    async def call_meraki_api():
        # Make API call
        pass

    # Or use directly
    breaker = get_circuit_breaker("meraki_api")
    async with breaker:
        # Make API call
        pass
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing fast
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open and request should fail fast."""

    def __init__(self, service: str, message: str = None, retry_after: Optional[float] = None):
        self.service = service
        self.retry_after = retry_after
        if message is None:
            message = f"Circuit breaker is open for {service}"
            if retry_after:
                message += f". Retry after {retry_after:.1f} seconds"
        super().__init__(message)


@dataclass
class CircuitBreakerConfig:
    """Configuration for a circuit breaker."""
    failure_threshold: int = 5  # Failures before opening circuit
    success_threshold: int = 2  # Successes needed to close circuit from half-open
    timeout: float = 30.0  # Seconds before trying half-open
    half_open_max_calls: int = 3  # Max concurrent calls in half-open state


@dataclass
class CircuitBreakerMetrics:
    """Metrics for monitoring circuit breaker state."""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    consecutive_failures: int = 0
    consecutive_successes: int = 0


class CircuitBreaker:
    """Circuit breaker implementation for resilient external service calls."""

    def __init__(self, service_name: str, config: Optional[CircuitBreakerConfig] = None):
        self.service_name = service_name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._metrics = CircuitBreakerMetrics()
        self._last_state_change = time.time()
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """Get current circuit state, checking for timeout-based state changes."""
        if self._state == CircuitState.OPEN:
            elapsed = time.time() - self._last_state_change
            if elapsed >= self.config.timeout:
                self._transition_to(CircuitState.HALF_OPEN)
        return self._state

    @property
    def metrics(self) -> CircuitBreakerMetrics:
        """Get current metrics."""
        return self._metrics

    def _transition_to(self, new_state: CircuitState) -> None:
        """Transition to a new state."""
        old_state = self._state
        self._state = new_state
        self._last_state_change = time.time()

        if new_state == CircuitState.HALF_OPEN:
            self._half_open_calls = 0

        logger.info(
            f"Circuit breaker '{self.service_name}': {old_state.value} -> {new_state.value}",
            extra={
                "service": self.service_name,
                "old_state": old_state.value,
                "new_state": new_state.value,
                "metrics": {
                    "total_calls": self._metrics.total_calls,
                    "failed_calls": self._metrics.failed_calls,
                    "consecutive_failures": self._metrics.consecutive_failures
                }
            }
        )

    async def _can_execute(self) -> bool:
        """Check if a call can be executed."""
        current_state = self.state  # This may trigger state transition

        if current_state == CircuitState.CLOSED:
            return True

        if current_state == CircuitState.OPEN:
            return False

        # HALF_OPEN state - allow limited calls
        async with self._lock:
            if self._half_open_calls < self.config.half_open_max_calls:
                self._half_open_calls += 1
                return True
            return False

    def _record_success(self) -> None:
        """Record a successful call."""
        self._metrics.total_calls += 1
        self._metrics.successful_calls += 1
        self._metrics.last_success_time = time.time()
        self._metrics.consecutive_successes += 1
        self._metrics.consecutive_failures = 0

        if self._state == CircuitState.HALF_OPEN:
            if self._metrics.consecutive_successes >= self.config.success_threshold:
                self._transition_to(CircuitState.CLOSED)

    def _record_failure(self, error: Optional[Exception] = None) -> None:
        """Record a failed call."""
        self._metrics.total_calls += 1
        self._metrics.failed_calls += 1
        self._metrics.last_failure_time = time.time()
        self._metrics.consecutive_failures += 1
        self._metrics.consecutive_successes = 0

        if self._state == CircuitState.HALF_OPEN:
            # Any failure in half-open returns to open
            self._transition_to(CircuitState.OPEN)
        elif self._state == CircuitState.CLOSED:
            if self._metrics.consecutive_failures >= self.config.failure_threshold:
                self._transition_to(CircuitState.OPEN)

    def _record_rejected(self) -> None:
        """Record a rejected call (circuit open)."""
        self._metrics.rejected_calls += 1

    def get_retry_after(self) -> Optional[float]:
        """Get seconds until circuit might close (for open state)."""
        if self._state != CircuitState.OPEN:
            return None
        elapsed = time.time() - self._last_state_change
        remaining = self.config.timeout - elapsed
        return max(0, remaining)

    async def __aenter__(self):
        """Async context manager entry."""
        if not await self._can_execute():
            self._record_rejected()
            raise CircuitBreakerError(
                self.service_name,
                retry_after=self.get_retry_after()
            )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if exc_type is None:
            self._record_success()
        else:
            self._record_failure(exc_val)
        return False  # Don't suppress exceptions

    def reset(self) -> None:
        """Manually reset the circuit breaker to closed state."""
        self._transition_to(CircuitState.CLOSED)
        self._metrics.consecutive_failures = 0
        self._metrics.consecutive_successes = 0
        logger.info(f"Circuit breaker '{self.service_name}' manually reset")


# Global registry of circuit breakers
_circuit_breakers: Dict[str, CircuitBreaker] = {}
_default_configs: Dict[str, CircuitBreakerConfig] = {
    # More lenient for critical services
    "meraki_api": CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=2,
        timeout=30.0,
        half_open_max_calls=3
    ),
    "thousandeyes_api": CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=2,
        timeout=30.0,
        half_open_max_calls=3
    ),
    "catalyst_api": CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=2,
        timeout=30.0,
        half_open_max_calls=3
    ),
    "splunk_api": CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=2,
        timeout=30.0,
        half_open_max_calls=3
    ),
    # AI providers - slightly more aggressive timeout since they can be slow
    "anthropic_api": CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=2,
        timeout=60.0,
        half_open_max_calls=2
    ),
    "openai_api": CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=2,
        timeout=60.0,
        half_open_max_calls=2
    ),
    "google_ai_api": CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=2,
        timeout=60.0,
        half_open_max_calls=2
    ),
}


def get_circuit_breaker(
    service_name: str,
    config: Optional[CircuitBreakerConfig] = None
) -> CircuitBreaker:
    """Get or create a circuit breaker for a service.

    Args:
        service_name: Name of the external service
        config: Optional configuration (uses defaults if not provided)

    Returns:
        CircuitBreaker instance for the service
    """
    if service_name not in _circuit_breakers:
        # Use provided config, or service-specific default, or global default
        effective_config = config or _default_configs.get(service_name) or CircuitBreakerConfig()
        _circuit_breakers[service_name] = CircuitBreaker(service_name, effective_config)
    return _circuit_breakers[service_name]


def circuit_breaker(service_name: str):
    """Decorator to wrap async functions with circuit breaker protection.

    Args:
        service_name: Name of the external service being called

    Example:
        @circuit_breaker("meraki_api")
        async def get_organizations():
            # API call
            pass
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            breaker = get_circuit_breaker(service_name)
            async with breaker:
                return await func(*args, **kwargs)
        return wrapper
    return decorator


def get_all_circuit_breakers_status() -> Dict[str, Dict[str, Any]]:
    """Get status of all circuit breakers for monitoring.

    Returns:
        Dictionary with status of each registered circuit breaker
    """
    return {
        name: {
            "state": breaker.state.value,
            "metrics": {
                "total_calls": breaker.metrics.total_calls,
                "successful_calls": breaker.metrics.successful_calls,
                "failed_calls": breaker.metrics.failed_calls,
                "rejected_calls": breaker.metrics.rejected_calls,
                "consecutive_failures": breaker.metrics.consecutive_failures,
                "consecutive_successes": breaker.metrics.consecutive_successes,
            },
            "config": {
                "failure_threshold": breaker.config.failure_threshold,
                "success_threshold": breaker.config.success_threshold,
                "timeout": breaker.config.timeout,
            },
            "retry_after": breaker.get_retry_after(),
        }
        for name, breaker in _circuit_breakers.items()
    }


def reset_circuit_breaker(service_name: str) -> bool:
    """Manually reset a circuit breaker.

    Args:
        service_name: Name of the service

    Returns:
        True if circuit breaker was found and reset, False otherwise
    """
    if service_name in _circuit_breakers:
        _circuit_breakers[service_name].reset()
        return True
    return False


def reset_all_circuit_breakers() -> int:
    """Reset all circuit breakers.

    Returns:
        Number of circuit breakers reset
    """
    count = 0
    for breaker in _circuit_breakers.values():
        breaker.reset()
        count += 1
    return count
