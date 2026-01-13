"""A2A Resilience Module.

Provides fault tolerance and resilience patterns:
- Circuit Breaker for preventing cascade failures
- Retry logic with exponential backoff
- Fallback handling
- Bulkhead isolation
- Rate limiting

Based on resilience patterns from Netflix Hystrix and resilience4j.
"""

import logging
import asyncio
import time
from typing import Dict, Any, List, Optional, Callable, TypeVar, Generic, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
import threading

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation, requests pass through
    OPEN = "open"          # Failing, requests are rejected
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for a circuit breaker."""
    failure_threshold: int = 5        # Failures before opening
    success_threshold: int = 3        # Successes to close from half-open
    timeout_seconds: float = 30.0     # Time in open state before half-open
    half_open_max_calls: int = 3      # Max calls allowed in half-open
    failure_rate_threshold: float = 0.5  # Failure rate to trigger open
    slow_call_threshold_ms: float = 5000  # Calls slower than this count as slow
    slow_call_rate_threshold: float = 0.5  # Slow call rate to trigger open
    window_size: int = 10             # Sliding window size for calculations


@dataclass
class CircuitBreakerMetrics:
    """Metrics for a circuit breaker."""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    slow_calls: int = 0
    rejected_calls: int = 0
    state_changes: int = 0
    last_failure_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    consecutive_failures: int = 0
    consecutive_successes: int = 0

    @property
    def failure_rate(self) -> float:
        if self.total_calls == 0:
            return 0.0
        return self.failed_calls / self.total_calls

    @property
    def slow_call_rate(self) -> float:
        if self.total_calls == 0:
            return 0.0
        return self.slow_calls / self.total_calls

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_calls": self.total_calls,
            "successful_calls": self.successful_calls,
            "failed_calls": self.failed_calls,
            "slow_calls": self.slow_calls,
            "rejected_calls": self.rejected_calls,
            "failure_rate": round(self.failure_rate, 3),
            "slow_call_rate": round(self.slow_call_rate, 3),
            "state_changes": self.state_changes,
            "consecutive_failures": self.consecutive_failures,
            "consecutive_successes": self.consecutive_successes,
        }


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open."""

    def __init__(self, breaker_name: str, state: CircuitState):
        self.breaker_name = breaker_name
        self.state = state
        super().__init__(f"Circuit breaker '{breaker_name}' is {state.value}")


class CircuitBreaker:
    """Circuit breaker implementation.

    Prevents cascade failures by failing fast when a service is unhealthy.

    States:
    - CLOSED: Normal operation, calls pass through
    - OPEN: Service failing, calls are rejected immediately
    - HALF_OPEN: Testing recovery, limited calls allowed

    Transitions:
    - CLOSED -> OPEN: When failure threshold exceeded
    - OPEN -> HALF_OPEN: After timeout period
    - HALF_OPEN -> CLOSED: When success threshold met
    - HALF_OPEN -> OPEN: When a call fails
    """

    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None,
    ):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._state_changed_at = datetime.utcnow()
        self._metrics = CircuitBreakerMetrics()
        self._half_open_calls = 0
        self._recent_calls: List[tuple] = []  # (success: bool, duration_ms: float)
        self._lock = threading.Lock()

    @property
    def state(self) -> CircuitState:
        """Get current state, potentially transitioning from OPEN to HALF_OPEN."""
        with self._lock:
            if self._state == CircuitState.OPEN:
                time_in_open = (datetime.utcnow() - self._state_changed_at).total_seconds()
                if time_in_open >= self.config.timeout_seconds:
                    self._transition_to(CircuitState.HALF_OPEN)
            return self._state

    def _transition_to(self, new_state: CircuitState):
        """Transition to a new state."""
        old_state = self._state
        self._state = new_state
        self._state_changed_at = datetime.utcnow()
        self._metrics.state_changes += 1

        if new_state == CircuitState.HALF_OPEN:
            self._half_open_calls = 0

        logger.info(
            f"[CircuitBreaker:{self.name}] State change: {old_state.value} -> {new_state.value}"
        )

    def _record_call(self, success: bool, duration_ms: float):
        """Record the result of a call."""
        with self._lock:
            self._metrics.total_calls += 1

            if success:
                self._metrics.successful_calls += 1
                self._metrics.last_success_time = datetime.utcnow()
                self._metrics.consecutive_successes += 1
                self._metrics.consecutive_failures = 0
            else:
                self._metrics.failed_calls += 1
                self._metrics.last_failure_time = datetime.utcnow()
                self._metrics.consecutive_failures += 1
                self._metrics.consecutive_successes = 0

            if duration_ms > self.config.slow_call_threshold_ms:
                self._metrics.slow_calls += 1

            # Update sliding window
            self._recent_calls.append((success, duration_ms))
            if len(self._recent_calls) > self.config.window_size:
                self._recent_calls = self._recent_calls[-self.config.window_size:]

            # Check for state transitions
            self._check_state_transition(success)

    def _check_state_transition(self, last_call_success: bool):
        """Check if state should transition based on metrics."""
        if self._state == CircuitState.CLOSED:
            # Check if we should open
            if len(self._recent_calls) >= self.config.window_size:
                failures = sum(1 for s, _ in self._recent_calls if not s)
                failure_rate = failures / len(self._recent_calls)
                slow_calls = sum(
                    1 for s, d in self._recent_calls
                    if d > self.config.slow_call_threshold_ms
                )
                slow_rate = slow_calls / len(self._recent_calls)

                if (failure_rate >= self.config.failure_rate_threshold or
                    slow_rate >= self.config.slow_call_rate_threshold):
                    self._transition_to(CircuitState.OPEN)

            elif self._metrics.consecutive_failures >= self.config.failure_threshold:
                self._transition_to(CircuitState.OPEN)

        elif self._state == CircuitState.HALF_OPEN:
            if not last_call_success:
                # Failed in half-open, go back to open
                self._transition_to(CircuitState.OPEN)
            elif self._metrics.consecutive_successes >= self.config.success_threshold:
                # Enough successes, close the circuit
                self._transition_to(CircuitState.CLOSED)
                self._recent_calls.clear()

    def allow_request(self) -> bool:
        """Check if a request should be allowed."""
        current_state = self.state  # This may trigger OPEN -> HALF_OPEN

        if current_state == CircuitState.CLOSED:
            return True

        if current_state == CircuitState.OPEN:
            self._metrics.rejected_calls += 1
            return False

        if current_state == CircuitState.HALF_OPEN:
            with self._lock:
                if self._half_open_calls < self.config.half_open_max_calls:
                    self._half_open_calls += 1
                    return True
                else:
                    self._metrics.rejected_calls += 1
                    return False

        return False

    def record_success(self, duration_ms: float):
        """Record a successful call."""
        self._record_call(True, duration_ms)

    def record_failure(self, duration_ms: float):
        """Record a failed call."""
        self._record_call(False, duration_ms)

    def get_metrics(self) -> CircuitBreakerMetrics:
        """Get current metrics."""
        return self._metrics

    def reset(self):
        """Reset the circuit breaker."""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._state_changed_at = datetime.utcnow()
            self._metrics = CircuitBreakerMetrics()
            self._half_open_calls = 0
            self._recent_calls.clear()
        logger.info(f"[CircuitBreaker:{self.name}] Reset to CLOSED")

    def to_dict(self) -> Dict[str, Any]:
        """Get full state as dict."""
        return {
            "name": self.name,
            "state": self.state.value,
            "state_changed_at": self._state_changed_at.isoformat(),
            "metrics": self._metrics.to_dict(),
            "config": {
                "failure_threshold": self.config.failure_threshold,
                "success_threshold": self.config.success_threshold,
                "timeout_seconds": self.config.timeout_seconds,
            },
        }


class CircuitBreakerRegistry:
    """Registry for managing multiple circuit breakers."""

    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._lock = threading.Lock()

    def get_or_create(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None,
    ) -> CircuitBreaker:
        """Get existing or create new circuit breaker."""
        with self._lock:
            if name not in self._breakers:
                self._breakers[name] = CircuitBreaker(name, config)
            return self._breakers[name]

    def get(self, name: str) -> Optional[CircuitBreaker]:
        """Get a circuit breaker by name."""
        return self._breakers.get(name)

    def get_all(self) -> List[CircuitBreaker]:
        """Get all circuit breakers."""
        return list(self._breakers.values())

    def get_all_stats(self) -> Dict[str, Any]:
        """Get stats for all circuit breakers."""
        return {
            name: breaker.to_dict()
            for name, breaker in self._breakers.items()
        }

    def reset_all(self):
        """Reset all circuit breakers."""
        for breaker in self._breakers.values():
            breaker.reset()


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    requests_per_second: float = 10.0
    burst_size: int = 20
    window_seconds: float = 1.0


class RateLimiter:
    """Token bucket rate limiter.

    Limits the rate of requests using the token bucket algorithm.
    """

    def __init__(self, name: str, config: Optional[RateLimitConfig] = None):
        self.name = name
        self.config = config or RateLimitConfig()
        self._tokens = float(self.config.burst_size)
        self._last_refill = time.time()
        self._total_requests = 0
        self._rejected_requests = 0
        self._lock = threading.Lock()

    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self._last_refill
        new_tokens = elapsed * self.config.requests_per_second
        self._tokens = min(self.config.burst_size, self._tokens + new_tokens)
        self._last_refill = now

    def allow(self, tokens: float = 1.0) -> bool:
        """Check if request is allowed and consume tokens."""
        with self._lock:
            self._refill()
            self._total_requests += 1

            if self._tokens >= tokens:
                self._tokens -= tokens
                return True
            else:
                self._rejected_requests += 1
                return False

    async def wait_for_token(self, tokens: float = 1.0, timeout: float = 10.0) -> bool:
        """Wait for a token to become available."""
        start = time.time()
        while time.time() - start < timeout:
            if self.allow(tokens):
                return True
            # Calculate wait time for next token
            wait_time = tokens / self.config.requests_per_second
            await asyncio.sleep(min(wait_time, 0.1))
        return False

    @property
    def available_tokens(self) -> float:
        """Get current available tokens."""
        with self._lock:
            self._refill()
            return self._tokens

    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiter statistics."""
        return {
            "name": self.name,
            "available_tokens": round(self.available_tokens, 2),
            "total_requests": self._total_requests,
            "rejected_requests": self._rejected_requests,
            "rejection_rate": round(
                self._rejected_requests / max(self._total_requests, 1), 3
            ),
            "config": {
                "requests_per_second": self.config.requests_per_second,
                "burst_size": self.config.burst_size,
            },
        }


class RateLimiterRegistry:
    """Registry for managing multiple rate limiters."""

    def __init__(self):
        self._limiters: Dict[str, RateLimiter] = {}
        self._lock = threading.Lock()

    def get_or_create(
        self,
        name: str,
        config: Optional[RateLimitConfig] = None,
    ) -> RateLimiter:
        """Get existing or create new rate limiter."""
        with self._lock:
            if name not in self._limiters:
                self._limiters[name] = RateLimiter(name, config)
            return self._limiters[name]

    def get(self, name: str) -> Optional[RateLimiter]:
        """Get a rate limiter by name."""
        return self._limiters.get(name)

    def get_all_stats(self) -> Dict[str, Any]:
        """Get stats for all rate limiters."""
        return {
            name: limiter.get_stats()
            for name, limiter in self._limiters.items()
        }


class RetryConfig:
    """Configuration for retry logic."""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay_ms: float = 100,
        max_delay_ms: float = 10000,
        exponential_base: float = 2.0,
        jitter: bool = True,
        retryable_exceptions: Optional[tuple] = None,
    ):
        self.max_retries = max_retries
        self.base_delay_ms = base_delay_ms
        self.max_delay_ms = max_delay_ms
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.retryable_exceptions = retryable_exceptions or (Exception,)


async def retry_async(
    func: Callable[[], Awaitable[T]],
    config: Optional[RetryConfig] = None,
) -> T:
    """Retry an async function with exponential backoff."""
    import random

    config = config or RetryConfig()
    last_exception = None

    for attempt in range(config.max_retries + 1):
        try:
            return await func()
        except config.retryable_exceptions as e:
            last_exception = e

            if attempt == config.max_retries:
                raise

            # Calculate delay with exponential backoff
            delay_ms = config.base_delay_ms * (config.exponential_base ** attempt)
            delay_ms = min(delay_ms, config.max_delay_ms)

            # Add jitter
            if config.jitter:
                delay_ms = delay_ms * (0.5 + random.random())

            logger.debug(
                f"[Retry] Attempt {attempt + 1}/{config.max_retries} failed, "
                f"retrying in {delay_ms:.0f}ms: {e}"
            )

            await asyncio.sleep(delay_ms / 1000)

    raise last_exception


# Singleton instances
_circuit_breaker_registry: Optional[CircuitBreakerRegistry] = None
_rate_limiter_registry: Optional[RateLimiterRegistry] = None


def get_circuit_breaker_registry() -> CircuitBreakerRegistry:
    """Get singleton circuit breaker registry."""
    global _circuit_breaker_registry
    if _circuit_breaker_registry is None:
        _circuit_breaker_registry = CircuitBreakerRegistry()
    return _circuit_breaker_registry


def get_rate_limiter_registry() -> RateLimiterRegistry:
    """Get singleton rate limiter registry."""
    global _rate_limiter_registry
    if _rate_limiter_registry is None:
        _rate_limiter_registry = RateLimiterRegistry()
    return _rate_limiter_registry


def get_circuit_breaker(
    name: str,
    config: Optional[CircuitBreakerConfig] = None,
) -> CircuitBreaker:
    """Get or create a circuit breaker by name."""
    return get_circuit_breaker_registry().get_or_create(name, config)


def get_rate_limiter(
    name: str,
    config: Optional[RateLimitConfig] = None,
) -> RateLimiter:
    """Get or create a rate limiter by name."""
    return get_rate_limiter_registry().get_or_create(name, config)


# Decorators for easy use

def with_circuit_breaker(breaker_name: str, fallback: Optional[Callable] = None):
    """Decorator to protect a function with a circuit breaker."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            breaker = get_circuit_breaker(breaker_name)

            if not breaker.allow_request():
                if fallback:
                    return await fallback(*args, **kwargs) if asyncio.iscoroutinefunction(fallback) else fallback(*args, **kwargs)
                raise CircuitBreakerError(breaker_name, breaker.state)

            start = time.time()
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.time() - start) * 1000
                breaker.record_success(duration_ms)
                return result
            except Exception as e:
                duration_ms = (time.time() - start) * 1000
                breaker.record_failure(duration_ms)
                raise

        return wrapper
    return decorator


def with_rate_limit(limiter_name: str, tokens: float = 1.0):
    """Decorator to rate limit a function."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            limiter = get_rate_limiter(limiter_name)

            if not await limiter.wait_for_token(tokens):
                raise Exception(f"Rate limit exceeded for {limiter_name}")

            return await func(*args, **kwargs)

        return wrapper
    return decorator
