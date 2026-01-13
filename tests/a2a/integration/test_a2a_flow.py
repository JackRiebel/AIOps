"""Integration tests for A2A end-to-end flows."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from src.a2a.types import (
    TaskState,
    AgentCard,
    AgentSkill,
    AgentProvider,
    A2AMessage,
    TextPart,
)
from src.a2a.task_manager import TaskManager
from src.a2a.push_notifications import (
    PushNotificationService,
    DeliveryConfig,
    NotificationEventType,
)
from src.a2a.resilience import (
    CircuitBreaker,
    CircuitBreakerConfig,
    RateLimiter,
    RateLimitConfig,
)
from src.a2a.observability import A2AObservability


class TestTaskLifecycleIntegration:
    """Integration tests for complete task lifecycle."""

    @pytest.fixture
    def task_manager(self):
        """Create task manager instance."""
        return TaskManager()

    @pytest.fixture
    def push_service(self):
        """Create push notification service."""
        config = DeliveryConfig(
            max_retries=1,
            base_delay_seconds=0.01,
            worker_count=1,
        )
        return PushNotificationService(config)

    @pytest.mark.asyncio
    async def test_complete_task_workflow(self, task_manager, push_service):
        """Test complete task from creation to completion with notifications."""
        # Setup notification subscription
        await push_service.create_config(
            url="https://test.com/webhook",
            events=["task.status_change", "task.completed"],
        )

        # Create task
        task = await task_manager.create_task(
            context_id="integration-test",
            initial_message=A2AMessage(
                role="user",
                parts=[TextPart(text="Integration test query")],
            ),
        )
        assert task.status.state == TaskState.SUBMITTED

        # Notify task created
        await push_service.notify(
            event_type=NotificationEventType.TASK_CREATED.value,
            data={"task_id": task.id},
            task_id=task.id,
        )

        # Update to working
        task = await task_manager.update_state(task.id, TaskState.WORKING)
        assert task.status.state == TaskState.WORKING

        await push_service.notify_task_status_change(
            task_id=task.id,
            old_status="submitted",
            new_status="working",
        )

        # Add response
        await task_manager.add_message(
            task.id,
            A2AMessage(
                role="agent",
                parts=[TextPart(text="This is the response")],
                sourceAgentId="test-agent",
            ),
        )

        # Add artifact
        await task_manager.add_artifact(
            task.id,
            {"type": "data", "name": "result.json", "data": {"status": "success"}},
        )

        # Complete task
        task = await task_manager.update_state(task.id, TaskState.COMPLETED)
        assert task.status.state == TaskState.COMPLETED

        await push_service.notify_task_status_change(
            task_id=task.id,
            old_status="working",
            new_status="completed",
        )

        # Verify final state
        final_task = await task_manager.get_task(task.id)
        assert final_task.status.state == TaskState.COMPLETED
        assert len(final_task.history) == 2
        assert len(final_task.artifacts) == 1

        # Verify notifications were sent
        stats = push_service.get_stats()
        assert stats["metrics"]["notifications_sent"] >= 3

    @pytest.mark.asyncio
    async def test_task_failure_workflow(self, task_manager, push_service):
        """Test task failure workflow with notifications."""
        await push_service.create_config(
            url="https://test.com/webhook",
            events=["task.failed"],
        )

        task = await task_manager.create_task()
        await task_manager.update_state(task.id, TaskState.WORKING)
        await task_manager.update_state(task.id, TaskState.FAILED)

        await push_service.notify_task_status_change(
            task_id=task.id,
            old_status="working",
            new_status="failed",
        )

        # Verify task in failed state
        final_task = await task_manager.get_task(task.id)
        assert final_task.status.state == TaskState.FAILED
        assert final_task.status.state.is_terminal()


class TestResilienceIntegration:
    """Integration tests for resilience patterns."""

    @pytest.fixture
    def circuit_breaker(self):
        """Create circuit breaker."""
        config = CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=2,
            timeout_seconds=1.0,
        )
        return CircuitBreaker("integration-breaker", config)

    @pytest.fixture
    def rate_limiter(self):
        """Create rate limiter."""
        config = RateLimitConfig(
            requests_per_second=100.0,
            burst_size=10,
        )
        return RateLimiter("integration-limiter", config)

    @pytest.mark.asyncio
    async def test_circuit_breaker_protects_service(self, circuit_breaker):
        """Test circuit breaker protects failing service."""
        calls_made = 0
        calls_blocked = 0

        async def call_service():
            nonlocal calls_made, calls_blocked

            if not circuit_breaker.allow_request():
                calls_blocked += 1
                return None

            calls_made += 1

            # Simulate failure
            import time
            start = time.time()
            try:
                raise Exception("Service unavailable")
            finally:
                duration = (time.time() - start) * 1000
                circuit_breaker.record_failure(duration)

        # Make calls until circuit opens
        for _ in range(10):
            try:
                await call_service()
            except Exception:
                pass

        # After 3 failures, circuit should be open
        assert circuit_breaker.state.value in ["open", "half_open"]
        assert calls_blocked > 0  # Some calls were blocked

    @pytest.mark.asyncio
    async def test_rate_limiter_controls_throughput(self, rate_limiter):
        """Test rate limiter controls request throughput."""
        allowed = 0
        rejected = 0

        for _ in range(20):
            if rate_limiter.allow():
                allowed += 1
            else:
                rejected += 1

        # Should allow burst_size (10) and reject the rest
        assert allowed == 10
        assert rejected == 10

    @pytest.mark.asyncio
    async def test_combined_resilience_patterns(self, circuit_breaker, rate_limiter):
        """Test circuit breaker and rate limiter working together."""
        async def protected_call():
            # Check rate limit first
            if not rate_limiter.allow():
                return "rate_limited"

            # Then circuit breaker
            if not circuit_breaker.allow_request():
                return "circuit_open"

            # Simulate successful call
            import time
            start = time.time()
            result = "success"
            duration = (time.time() - start) * 1000
            circuit_breaker.record_success(duration)
            return result

        results = []
        for _ in range(15):
            results.append(await protected_call())

        # First 10 should succeed (within burst limit)
        assert results[:10].count("success") == 10
        # Rest should be rate limited
        assert results[10:].count("rate_limited") == 5


class TestObservabilityIntegration:
    """Integration tests for observability."""

    @pytest.fixture
    def observability(self):
        """Create observability instance."""
        return A2AObservability()

    def test_tracing_captures_operation(self, observability):
        """Test tracing captures operation spans."""
        with observability.tracer.span("test-operation", {"test": True}) as span:
            span.set_attribute("custom_attr", "value")
            # Do some work
            pass

        spans = observability.tracer.get_completed_spans()
        assert len(spans) >= 1
        assert spans[-1].operation_name == "test-operation"

    def test_metrics_recording(self, observability):
        """Test metrics are recorded correctly."""
        # Record some agent calls
        observability.record_agent_call("agent-1", success=True, duration_ms=150.0, tokens_used=100)
        observability.record_agent_call("agent-1", success=True, duration_ms=200.0, tokens_used=150)
        observability.record_agent_call("agent-1", success=False, duration_ms=50.0)

        stats = observability.get_agent_stats("agent-1")
        assert stats["total_calls"] == 3.0
        assert stats["successful_calls"] == 2.0
        assert stats["errors"] == 1.0

    def test_dashboard_stats(self, observability):
        """Test dashboard statistics aggregation."""
        # Record various metrics
        observability.record_agent_call("agent-1", True, 100.0)
        observability.record_federation_call("https://external.com", True, 200.0)
        observability.record_quality_score(0.85, "good")

        stats = observability.get_dashboard_stats()

        assert "uptime_seconds" in stats
        assert "agent_calls" in stats
        assert "federation" in stats
        assert "quality" in stats

    @pytest.mark.asyncio
    async def test_trace_async_decorator(self, observability):
        """Test async tracing decorator."""
        @observability.trace_async("async-operation")
        async def async_work():
            return "done"

        result = await async_work()
        assert result == "done"

        # Check metrics were recorded
        metrics = observability.metrics.get_all_metrics()
        assert "a2a.async-operation.success" in str(metrics)


class TestMultiComponentIntegration:
    """Integration tests combining multiple A2A components."""

    @pytest.mark.asyncio
    async def test_full_request_flow_with_observability(self):
        """Test complete request flow with all components."""
        # Setup components
        task_manager = TaskManager()
        observability = A2AObservability()
        push_service = PushNotificationService(
            DeliveryConfig(worker_count=1, max_retries=1)
        )
        circuit_breaker = CircuitBreaker(
            "full-flow-breaker",
            CircuitBreakerConfig(failure_threshold=5),
        )

        # Subscribe to notifications
        await push_service.create_config(
            url="https://test.com/webhook",
            events=["*"],
        )

        # Start traced operation
        async with observability.tracer.async_span("full-request") as span:
            # Check circuit breaker
            if not circuit_breaker.allow_request():
                span.status = "error"
                return

            import time
            start_time = time.time()

            try:
                # Create task
                task = await task_manager.create_task(
                    context_id="full-flow-test",
                    initial_message=A2AMessage(
                        role="user",
                        parts=[TextPart(text="Full flow test")],
                    ),
                )
                span.set_attribute("task_id", task.id)

                # Process (simulate agent work)
                await task_manager.update_state(task.id, TaskState.WORKING)

                # Add response
                await task_manager.add_message(
                    task.id,
                    A2AMessage(
                        role="agent",
                        parts=[TextPart(text="Response from agent")],
                    ),
                )

                # Complete
                await task_manager.update_state(task.id, TaskState.COMPLETED)

                # Notify
                await push_service.notify(
                    event_type="task.completed",
                    data={"task_id": task.id},
                    task_id=task.id,
                )

                duration = (time.time() - start_time) * 1000
                circuit_breaker.record_success(duration)
                observability.record_agent_call("test-agent", True, duration)

            except Exception as e:
                duration = (time.time() - start_time) * 1000
                circuit_breaker.record_failure(duration)
                observability.record_agent_call("test-agent", False, duration)
                raise

        # Verify everything worked
        completed_task = await task_manager.get_task(task.id)
        assert completed_task.status.state == TaskState.COMPLETED

        dashboard = observability.get_dashboard_stats()
        assert dashboard["agent_calls"]["total"] >= 1

        push_stats = push_service.get_stats()
        assert push_stats["metrics"]["notifications_sent"] >= 1

        breaker_metrics = circuit_breaker.get_metrics()
        assert breaker_metrics.successful_calls >= 1
