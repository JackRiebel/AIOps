"""Tests for A2A Resilience Patterns."""

import pytest
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from src.a2a.resilience import (
    CircuitState,
    CircuitBreakerConfig,
    CircuitBreakerMetrics,
    CircuitBreakerError,
    CircuitBreaker,
    CircuitBreakerRegistry,
    RateLimitConfig,
    RateLimiter,
    RateLimiterRegistry,
    RetryConfig,
    retry_async,
    get_circuit_breaker,
    get_rate_limiter,
    with_circuit_breaker,
    with_rate_limit,
)


class TestCircuitState:
    """Tests for CircuitState enum."""

    def test_all_states_exist(self):
        """Verify all circuit states are defined."""
        expected = ["closed", "open", "half_open"]
        actual = [s.value for s in CircuitState]
        for state in expected:
            assert state in actual


class TestCircuitBreakerConfig:
    """Tests for CircuitBreakerConfig."""

    def test_default_config(self):
        """Test default configuration values."""
        config = CircuitBreakerConfig()
        assert config.failure_threshold == 5
        assert config.success_threshold == 3
        assert config.timeout_seconds == 30.0
        assert config.half_open_max_calls == 3

    def test_custom_config(self, circuit_breaker_config):
        """Test custom configuration."""
        config = CircuitBreakerConfig(**circuit_breaker_config)
        assert config.failure_threshold == 3
        assert config.success_threshold == 2
        assert config.timeout_seconds == 5.0


class TestCircuitBreakerMetrics:
    """Tests for CircuitBreakerMetrics."""

    def test_default_metrics(self):
        """Test default metrics values."""
        metrics = CircuitBreakerMetrics()
        assert metrics.total_calls == 0
        assert metrics.successful_calls == 0
        assert metrics.failed_calls == 0
        assert metrics.failure_rate == 0.0

    def test_failure_rate_calculation(self):
        """Test failure rate calculation."""
        metrics = CircuitBreakerMetrics(
            total_calls=10,
            failed_calls=3,
        )
        assert metrics.failure_rate == 0.3

    def test_slow_call_rate_calculation(self):
        """Test slow call rate calculation."""
        metrics = CircuitBreakerMetrics(
            total_calls=20,
            slow_calls=5,
        )
        assert metrics.slow_call_rate == 0.25

    def test_metrics_to_dict(self):
        """Test metrics serialization."""
        metrics = CircuitBreakerMetrics(
            total_calls=100,
            successful_calls=90,
            failed_calls=10,
        )
        data = metrics.to_dict()
        assert data["total_calls"] == 100
        assert data["failure_rate"] == 0.1


class TestCircuitBreaker:
    """Tests for CircuitBreaker."""

    @pytest.fixture
    def breaker(self, circuit_breaker_config):
        """Create a circuit breaker with test config."""
        config = CircuitBreakerConfig(**circuit_breaker_config)
        return CircuitBreaker("test-breaker", config)

    def test_initial_state_closed(self, breaker):
        """Test breaker starts in closed state."""
        assert breaker.state == CircuitState.CLOSED

    def test_allow_request_when_closed(self, breaker):
        """Test requests allowed when closed."""
        assert breaker.allow_request() is True

    def test_record_success(self, breaker):
        """Test recording successful calls."""
        breaker.record_success(100.0)
        metrics = breaker.get_metrics()
        assert metrics.successful_calls == 1
        assert metrics.consecutive_successes == 1

    def test_record_failure(self, breaker):
        """Test recording failed calls."""
        breaker.record_failure(100.0)
        metrics = breaker.get_metrics()
        assert metrics.failed_calls == 1
        assert metrics.consecutive_failures == 1

    def test_opens_after_failure_threshold(self, breaker):
        """Test breaker opens after failure threshold."""
        # Record failures to exceed threshold (3)
        for _ in range(3):
            breaker.record_failure(100.0)

        assert breaker.state == CircuitState.OPEN

    def test_rejects_requests_when_open(self, breaker):
        """Test requests rejected when open."""
        # Force open
        for _ in range(3):
            breaker.record_failure(100.0)

        assert breaker.state == CircuitState.OPEN
        assert breaker.allow_request() is False
        assert breaker.get_metrics().rejected_calls >= 1

    def test_half_open_after_timeout(self, breaker):
        """Test breaker goes half-open after timeout."""
        # Force open
        for _ in range(3):
            breaker.record_failure(100.0)

        assert breaker.state == CircuitState.OPEN

        # Fast-forward time by setting state_changed_at in the past
        breaker._state_changed_at = datetime.utcnow() - timedelta(seconds=10)

        # Next check should transition to half-open
        assert breaker.state == CircuitState.HALF_OPEN

    def test_half_open_allows_limited_requests(self, breaker):
        """Test half-open state allows limited requests."""
        # Force to half-open
        for _ in range(3):
            breaker.record_failure(100.0)
        breaker._state_changed_at = datetime.utcnow() - timedelta(seconds=10)
        assert breaker.state == CircuitState.HALF_OPEN

        # Should allow up to half_open_max_calls (2)
        assert breaker.allow_request() is True
        assert breaker.allow_request() is True
        assert breaker.allow_request() is False  # Exceeded limit

    def test_closes_after_success_in_half_open(self, breaker):
        """Test breaker closes after successes in half-open."""
        # Force to half-open
        for _ in range(3):
            breaker.record_failure(100.0)
        breaker._state_changed_at = datetime.utcnow() - timedelta(seconds=10)
        _ = breaker.state  # Trigger transition

        # Record successes (need success_threshold = 2)
        breaker.record_success(100.0)
        breaker.record_success(100.0)

        assert breaker.state == CircuitState.CLOSED

    def test_reopens_on_failure_in_half_open(self, breaker):
        """Test breaker reopens on failure in half-open."""
        # Force to half-open
        for _ in range(3):
            breaker.record_failure(100.0)
        breaker._state_changed_at = datetime.utcnow() - timedelta(seconds=10)
        _ = breaker.state  # Trigger transition

        # Fail in half-open
        breaker.record_failure(100.0)

        assert breaker.state == CircuitState.OPEN

    def test_reset(self, breaker):
        """Test breaker reset."""
        # Add some state
        for _ in range(3):
            breaker.record_failure(100.0)
        assert breaker.state == CircuitState.OPEN

        breaker.reset()

        assert breaker.state == CircuitState.CLOSED
        assert breaker.get_metrics().total_calls == 0

    def test_to_dict(self, breaker):
        """Test breaker serialization."""
        breaker.record_success(100.0)
        data = breaker.to_dict()
        assert data["name"] == "test-breaker"
        assert data["state"] == "closed"
        assert "metrics" in data
        assert "config" in data


class TestCircuitBreakerError:
    """Tests for CircuitBreakerError."""

    def test_error_message(self):
        """Test error message contains breaker info."""
        error = CircuitBreakerError("my-breaker", CircuitState.OPEN)
        assert "my-breaker" in str(error)
        assert "open" in str(error)

    def test_error_attributes(self):
        """Test error has correct attributes."""
        error = CircuitBreakerError("test", CircuitState.HALF_OPEN)
        assert error.breaker_name == "test"
        assert error.state == CircuitState.HALF_OPEN


class TestCircuitBreakerRegistry:
    """Tests for CircuitBreakerRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a circuit breaker registry."""
        return CircuitBreakerRegistry()

    def test_get_or_create(self, registry):
        """Test getting or creating breakers."""
        breaker1 = registry.get_or_create("breaker-1")
        breaker2 = registry.get_or_create("breaker-1")
        breaker3 = registry.get_or_create("breaker-2")

        assert breaker1 is breaker2  # Same instance
        assert breaker1 is not breaker3

    def test_get_existing(self, registry):
        """Test getting existing breaker."""
        registry.get_or_create("exists")
        breaker = registry.get("exists")
        assert breaker is not None

    def test_get_nonexistent(self, registry):
        """Test getting non-existent breaker."""
        breaker = registry.get("does-not-exist")
        assert breaker is None

    def test_get_all(self, registry):
        """Test getting all breakers."""
        registry.get_or_create("b1")
        registry.get_or_create("b2")
        registry.get_or_create("b3")

        all_breakers = registry.get_all()
        assert len(all_breakers) == 3

    def test_get_all_stats(self, registry):
        """Test getting stats for all breakers."""
        registry.get_or_create("b1")
        registry.get_or_create("b2")

        stats = registry.get_all_stats()
        assert "b1" in stats
        assert "b2" in stats

    def test_reset_all(self, registry):
        """Test resetting all breakers."""
        b1 = registry.get_or_create("b1")
        b2 = registry.get_or_create("b2")

        # Add some failures
        for _ in range(10):
            b1.record_failure(100.0)
            b2.record_failure(100.0)

        registry.reset_all()

        assert b1.state == CircuitState.CLOSED
        assert b2.state == CircuitState.CLOSED


class TestRateLimiter:
    """Tests for RateLimiter."""

    @pytest.fixture
    def limiter(self, rate_limit_config):
        """Create a rate limiter."""
        config = RateLimitConfig(**rate_limit_config)
        return RateLimiter("test-limiter", config)

    def test_allows_within_limit(self, limiter):
        """Test requests allowed within limit."""
        # Should allow burst_size (20) requests
        for _ in range(20):
            assert limiter.allow() is True

    def test_rejects_over_limit(self, limiter):
        """Test requests rejected over limit."""
        # Exhaust burst
        for _ in range(20):
            limiter.allow()

        # Next should be rejected
        assert limiter.allow() is False

    def test_refills_over_time(self, limiter):
        """Test tokens refill over time."""
        # Exhaust burst
        for _ in range(20):
            limiter.allow()

        # Wait for refill (10 tokens/sec)
        time.sleep(0.2)  # Should refill ~2 tokens

        # Should allow at least one request
        assert limiter.allow() is True

    def test_available_tokens(self, limiter):
        """Test checking available tokens."""
        initial = limiter.available_tokens
        assert initial == 20.0  # burst_size

        limiter.allow()
        assert limiter.available_tokens < initial

    @pytest.mark.asyncio
    async def test_wait_for_token(self, limiter):
        """Test waiting for token availability."""
        # Exhaust burst
        for _ in range(20):
            limiter.allow()

        # Wait for token (should succeed within timeout)
        result = await limiter.wait_for_token(timeout=0.5)
        assert result is True

    @pytest.mark.asyncio
    async def test_wait_for_token_timeout(self):
        """Test waiting for token times out."""
        config = RateLimitConfig(requests_per_second=0.1, burst_size=1)
        limiter = RateLimiter("slow", config)

        limiter.allow()  # Exhaust single token

        # Very short timeout should fail
        result = await limiter.wait_for_token(timeout=0.01)
        assert result is False

    def test_get_stats(self, limiter):
        """Test getting limiter statistics."""
        limiter.allow()
        limiter.allow()

        stats = limiter.get_stats()
        assert stats["name"] == "test-limiter"
        assert stats["total_requests"] == 2
        assert "config" in stats


class TestRateLimiterRegistry:
    """Tests for RateLimiterRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a rate limiter registry."""
        return RateLimiterRegistry()

    def test_get_or_create(self, registry):
        """Test getting or creating limiters."""
        lim1 = registry.get_or_create("lim-1")
        lim2 = registry.get_or_create("lim-1")

        assert lim1 is lim2

    def test_get_all_stats(self, registry):
        """Test getting stats for all limiters."""
        registry.get_or_create("l1")
        registry.get_or_create("l2")

        stats = registry.get_all_stats()
        assert "l1" in stats
        assert "l2" in stats


class TestRetryAsync:
    """Tests for retry_async function."""

    @pytest.mark.asyncio
    async def test_succeeds_first_try(self):
        """Test successful function returns immediately."""
        calls = []

        async def success():
            calls.append(1)
            return "ok"

        result = await retry_async(success)
        assert result == "ok"
        assert len(calls) == 1

    @pytest.mark.asyncio
    async def test_retries_on_failure(self):
        """Test function is retried on failure."""
        calls = []

        async def fail_then_succeed():
            calls.append(1)
            if len(calls) < 3:
                raise ValueError("Not yet")
            return "ok"

        config = RetryConfig(
            max_retries=5,
            base_delay_ms=10,
        )
        result = await retry_async(fail_then_succeed, config)
        assert result == "ok"
        assert len(calls) == 3

    @pytest.mark.asyncio
    async def test_raises_after_max_retries(self):
        """Test raises after max retries exceeded."""
        async def always_fail():
            raise ValueError("Always fails")

        config = RetryConfig(max_retries=2, base_delay_ms=10)

        with pytest.raises(ValueError):
            await retry_async(always_fail, config)

    @pytest.mark.asyncio
    async def test_respects_retryable_exceptions(self):
        """Test only retries specified exceptions."""
        calls = []

        async def raise_type_error():
            calls.append(1)
            raise TypeError("Not retryable")

        config = RetryConfig(
            max_retries=5,
            retryable_exceptions=(ValueError,),  # Only retry ValueError
        )

        with pytest.raises(TypeError):
            await retry_async(raise_type_error, config)

        # Should not retry TypeError
        assert len(calls) == 1


class TestDecorators:
    """Tests for decorator functions."""

    @pytest.mark.asyncio
    async def test_with_circuit_breaker_decorator(self):
        """Test circuit breaker decorator."""
        call_count = 0

        @with_circuit_breaker("test-decorator-breaker")
        async def protected_function():
            nonlocal call_count
            call_count += 1
            return "success"

        result = await protected_function()
        assert result == "success"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_with_circuit_breaker_fallback(self):
        """Test circuit breaker with fallback."""
        async def fallback():
            return "fallback"

        @with_circuit_breaker("failing-breaker", fallback=fallback)
        async def always_fails():
            raise Exception("Boom")

        # Get breaker and force it open
        breaker = get_circuit_breaker("failing-breaker")
        for _ in range(10):
            breaker.record_failure(100.0)

        result = await always_fails()
        assert result == "fallback"

    @pytest.mark.asyncio
    async def test_with_rate_limit_decorator(self):
        """Test rate limit decorator."""
        @with_rate_limit("test-decorator-limiter")
        async def rate_limited_function():
            return "ok"

        result = await rate_limited_function()
        assert result == "ok"
