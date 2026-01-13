"""A2A Observability Module.

Provides observability features for the A2A system:
- Distributed tracing for agent operations
- Metrics collection for performance monitoring
- Structured logging with context
- Dashboard-ready statistics

Designed to work with or without OpenTelemetry installed.
Falls back to lightweight internal instrumentation when OTel is unavailable.
"""

import logging
import time
import asyncio
from typing import Dict, Any, List, Optional, Callable, TypeVar, ParamSpec
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from collections import defaultdict
from contextlib import contextmanager, asynccontextmanager
import threading

logger = logging.getLogger(__name__)

P = ParamSpec("P")
T = TypeVar("T")


class MetricType(str, Enum):
    """Types of metrics."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


@dataclass
class SpanContext:
    """Context for a trace span."""
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    operation_name: str = ""
    service_name: str = "lumen-a2a"
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    events: List[Dict[str, Any]] = field(default_factory=list)
    status: str = "ok"
    error: Optional[str] = None

    @property
    def duration_ms(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds() * 1000
        return 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "operation_name": self.operation_name,
            "service_name": self.service_name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_ms": self.duration_ms,
            "attributes": self.attributes,
            "events": self.events,
            "status": self.status,
            "error": self.error,
        }


@dataclass
class MetricValue:
    """A recorded metric value."""
    name: str
    type: MetricType
    value: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    labels: Dict[str, str] = field(default_factory=dict)
    unit: str = ""


class MetricsCollector:
    """Collects and aggregates metrics.

    Thread-safe metrics collection with support for:
    - Counters (monotonically increasing)
    - Gauges (point-in-time values)
    - Histograms (distribution of values)
    - Timers (duration measurements)
    """

    def __init__(self, max_history: int = 1000):
        self._counters: Dict[str, float] = defaultdict(float)
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        self._timers: Dict[str, List[float]] = defaultdict(list)
        self._max_history = max_history
        self._lock = threading.Lock()

    def increment(self, name: str, value: float = 1.0, labels: Optional[Dict[str, str]] = None):
        """Increment a counter."""
        key = self._make_key(name, labels)
        with self._lock:
            self._counters[key] += value

    def gauge(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Set a gauge value."""
        key = self._make_key(name, labels)
        with self._lock:
            self._gauges[key] = value

    def histogram(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Record a histogram value."""
        key = self._make_key(name, labels)
        with self._lock:
            hist = self._histograms[key]
            hist.append(value)
            if len(hist) > self._max_history:
                self._histograms[key] = hist[-self._max_history:]

    def timer(self, name: str, duration_ms: float, labels: Optional[Dict[str, str]] = None):
        """Record a timer value."""
        key = self._make_key(name, labels)
        with self._lock:
            timers = self._timers[key]
            timers.append(duration_ms)
            if len(timers) > self._max_history:
                self._timers[key] = timers[-self._max_history:]

    def _make_key(self, name: str, labels: Optional[Dict[str, str]]) -> str:
        """Create a unique key for a metric with labels."""
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"

    def get_counter(self, name: str, labels: Optional[Dict[str, str]] = None) -> float:
        """Get counter value."""
        key = self._make_key(name, labels)
        return self._counters.get(key, 0.0)

    def get_gauge(self, name: str, labels: Optional[Dict[str, str]] = None) -> Optional[float]:
        """Get gauge value."""
        key = self._make_key(name, labels)
        return self._gauges.get(key)

    def get_histogram_stats(self, name: str, labels: Optional[Dict[str, str]] = None) -> Dict[str, float]:
        """Get histogram statistics."""
        key = self._make_key(name, labels)
        values = self._histograms.get(key, [])
        if not values:
            return {"count": 0, "min": 0, "max": 0, "avg": 0, "p50": 0, "p95": 0, "p99": 0}

        sorted_values = sorted(values)
        count = len(sorted_values)

        return {
            "count": count,
            "min": sorted_values[0],
            "max": sorted_values[-1],
            "avg": sum(sorted_values) / count,
            "p50": sorted_values[int(count * 0.5)],
            "p95": sorted_values[int(count * 0.95)] if count > 20 else sorted_values[-1],
            "p99": sorted_values[int(count * 0.99)] if count > 100 else sorted_values[-1],
        }

    def get_timer_stats(self, name: str, labels: Optional[Dict[str, str]] = None) -> Dict[str, float]:
        """Get timer statistics (same as histogram)."""
        key = self._make_key(name, labels)
        values = self._timers.get(key, [])
        if not values:
            return {"count": 0, "min": 0, "max": 0, "avg": 0, "p50": 0, "p95": 0, "p99": 0}

        sorted_values = sorted(values)
        count = len(sorted_values)

        return {
            "count": count,
            "min_ms": sorted_values[0],
            "max_ms": sorted_values[-1],
            "avg_ms": sum(sorted_values) / count,
            "p50_ms": sorted_values[int(count * 0.5)],
            "p95_ms": sorted_values[int(count * 0.95)] if count > 20 else sorted_values[-1],
            "p99_ms": sorted_values[int(count * 0.99)] if count > 100 else sorted_values[-1],
        }

    def get_all_metrics(self) -> Dict[str, Any]:
        """Get all metrics for export."""
        with self._lock:
            return {
                "counters": dict(self._counters),
                "gauges": dict(self._gauges),
                "histograms": {k: self.get_histogram_stats(k) for k in self._histograms},
                "timers": {k: self.get_timer_stats(k) for k in self._timers},
            }

    def reset(self):
        """Reset all metrics."""
        with self._lock:
            self._counters.clear()
            self._gauges.clear()
            self._histograms.clear()
            self._timers.clear()


class Tracer:
    """Distributed tracer for A2A operations.

    Provides span-based tracing that can be exported to
    OpenTelemetry-compatible backends or used internally.
    """

    def __init__(self, service_name: str = "lumen-a2a", max_spans: int = 10000):
        self.service_name = service_name
        self._spans: Dict[str, SpanContext] = {}
        self._completed_spans: List[SpanContext] = []
        self._max_spans = max_spans
        self._current_span: Optional[SpanContext] = None
        self._span_stack: List[SpanContext] = []
        self._lock = threading.Lock()

    def _generate_id(self) -> str:
        """Generate a unique ID."""
        import uuid
        return uuid.uuid4().hex[:16]

    @contextmanager
    def span(
        self,
        operation_name: str,
        attributes: Optional[Dict[str, Any]] = None,
    ):
        """Create a synchronous span context manager."""
        span = self.start_span(operation_name, attributes)
        try:
            yield span
        except Exception as e:
            span.status = "error"
            span.error = str(e)
            raise
        finally:
            self.end_span(span)

    @asynccontextmanager
    async def async_span(
        self,
        operation_name: str,
        attributes: Optional[Dict[str, Any]] = None,
    ):
        """Create an async span context manager."""
        span = self.start_span(operation_name, attributes)
        try:
            yield span
        except Exception as e:
            span.status = "error"
            span.error = str(e)
            raise
        finally:
            self.end_span(span)

    def start_span(
        self,
        operation_name: str,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> SpanContext:
        """Start a new span."""
        parent_span = self._current_span
        trace_id = parent_span.trace_id if parent_span else self._generate_id()

        span = SpanContext(
            trace_id=trace_id,
            span_id=self._generate_id(),
            parent_span_id=parent_span.span_id if parent_span else None,
            operation_name=operation_name,
            service_name=self.service_name,
            attributes=attributes or {},
        )

        with self._lock:
            self._spans[span.span_id] = span
            if self._current_span:
                self._span_stack.append(self._current_span)
            self._current_span = span

        return span

    def end_span(self, span: SpanContext):
        """End a span."""
        span.end_time = datetime.utcnow()

        with self._lock:
            if span.span_id in self._spans:
                del self._spans[span.span_id]

            self._completed_spans.append(span)
            if len(self._completed_spans) > self._max_spans:
                self._completed_spans = self._completed_spans[-self._max_spans:]

            if self._span_stack:
                self._current_span = self._span_stack.pop()
            else:
                self._current_span = None

    def add_event(self, name: str, attributes: Optional[Dict[str, Any]] = None):
        """Add an event to the current span."""
        if self._current_span:
            self._current_span.events.append({
                "name": name,
                "timestamp": datetime.utcnow().isoformat(),
                "attributes": attributes or {},
            })

    def set_attribute(self, key: str, value: Any):
        """Set an attribute on the current span."""
        if self._current_span:
            self._current_span.attributes[key] = value

    def get_current_span(self) -> Optional[SpanContext]:
        """Get the current active span."""
        return self._current_span

    def get_completed_spans(self, limit: int = 100) -> List[SpanContext]:
        """Get recently completed spans."""
        with self._lock:
            return self._completed_spans[-limit:]

    def get_trace(self, trace_id: str) -> List[SpanContext]:
        """Get all spans for a trace."""
        with self._lock:
            return [s for s in self._completed_spans if s.trace_id == trace_id]


class A2AObservability:
    """Main observability class integrating tracing and metrics.

    Provides a unified interface for:
    - Distributed tracing
    - Metrics collection
    - Performance monitoring
    - Dashboard statistics
    """

    def __init__(self):
        self.tracer = Tracer()
        self.metrics = MetricsCollector()
        self._start_time = datetime.utcnow()

    # =========================================================================
    # Tracing Decorators
    # =========================================================================

    def trace(self, operation_name: Optional[str] = None):
        """Decorator to trace a synchronous function."""
        def decorator(func: Callable[P, T]) -> Callable[P, T]:
            op_name = operation_name or f"{func.__module__}.{func.__name__}"

            @wraps(func)
            def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
                with self.tracer.span(op_name) as span:
                    start = time.time()
                    try:
                        result = func(*args, **kwargs)
                        self.metrics.increment(f"a2a.{op_name}.success")
                        return result
                    except Exception as e:
                        self.metrics.increment(f"a2a.{op_name}.error")
                        raise
                    finally:
                        duration_ms = (time.time() - start) * 1000
                        self.metrics.timer(f"a2a.{op_name}.duration", duration_ms)

            return wrapper
        return decorator

    def trace_async(self, operation_name: Optional[str] = None):
        """Decorator to trace an async function."""
        def decorator(func: Callable[P, T]) -> Callable[P, T]:
            op_name = operation_name or f"{func.__module__}.{func.__name__}"

            @wraps(func)
            async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
                async with self.tracer.async_span(op_name) as span:
                    start = time.time()
                    try:
                        result = await func(*args, **kwargs)
                        self.metrics.increment(f"a2a.{op_name}.success")
                        return result
                    except Exception as e:
                        self.metrics.increment(f"a2a.{op_name}.error")
                        raise
                    finally:
                        duration_ms = (time.time() - start) * 1000
                        self.metrics.timer(f"a2a.{op_name}.duration", duration_ms)

            return wrapper
        return decorator

    # =========================================================================
    # Pre-defined Metrics
    # =========================================================================

    def record_agent_call(
        self,
        agent_id: str,
        success: bool,
        duration_ms: float,
        tokens_used: int = 0,
    ):
        """Record an agent call."""
        labels = {"agent_id": agent_id}
        self.metrics.increment("a2a.agent.calls", labels=labels)
        if success:
            self.metrics.increment("a2a.agent.success", labels=labels)
        else:
            self.metrics.increment("a2a.agent.errors", labels=labels)
        self.metrics.timer("a2a.agent.duration", duration_ms, labels=labels)
        if tokens_used > 0:
            self.metrics.histogram("a2a.agent.tokens", tokens_used, labels=labels)

    def record_task_state_change(self, task_id: str, old_state: str, new_state: str):
        """Record a task state transition."""
        self.metrics.increment(f"a2a.task.transitions.{old_state}_to_{new_state}")
        self.metrics.increment("a2a.task.transitions.total")

    def record_federation_call(
        self,
        agent_url: str,
        success: bool,
        duration_ms: float,
    ):
        """Record a federation call to external agent."""
        # Sanitize URL for label
        label_url = agent_url.replace("https://", "").replace("http://", "").split("/")[0]
        labels = {"agent_url": label_url}
        self.metrics.increment("a2a.federation.calls", labels=labels)
        if success:
            self.metrics.increment("a2a.federation.success", labels=labels)
        else:
            self.metrics.increment("a2a.federation.errors", labels=labels)
        self.metrics.timer("a2a.federation.duration", duration_ms, labels=labels)

    def record_quality_score(self, score: float, level: str):
        """Record a response quality score."""
        self.metrics.histogram("a2a.quality.score", score)
        self.metrics.increment(f"a2a.quality.level.{level}")

    # =========================================================================
    # Dashboard Statistics
    # =========================================================================

    def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get statistics for dashboard display."""
        metrics = self.metrics.get_all_metrics()
        uptime = (datetime.utcnow() - self._start_time).total_seconds()

        # Calculate rates
        total_calls = metrics["counters"].get("a2a.agent.calls", 0)
        total_errors = metrics["counters"].get("a2a.agent.errors", 0)
        error_rate = (total_errors / total_calls * 100) if total_calls > 0 else 0

        return {
            "uptime_seconds": uptime,
            "agent_calls": {
                "total": total_calls,
                "successful": metrics["counters"].get("a2a.agent.success", 0),
                "errors": total_errors,
                "error_rate_percent": round(error_rate, 2),
            },
            "latency": metrics["timers"].get("a2a.agent.duration", {}),
            "federation": {
                "total_calls": metrics["counters"].get("a2a.federation.calls", 0),
                "errors": metrics["counters"].get("a2a.federation.errors", 0),
            },
            "quality": {
                "scores": metrics["histograms"].get("a2a.quality.score", {}),
            },
            "task_transitions": {
                k.replace("a2a.task.transitions.", ""): v
                for k, v in metrics["counters"].items()
                if k.startswith("a2a.task.transitions.")
            },
            "recent_traces": [
                span.to_dict()
                for span in self.tracer.get_completed_spans(limit=10)
            ],
        }

    def get_agent_stats(self, agent_id: str) -> Dict[str, Any]:
        """Get statistics for a specific agent."""
        labels = {"agent_id": agent_id}
        return {
            "agent_id": agent_id,
            "total_calls": self.metrics.get_counter("a2a.agent.calls", labels),
            "successful_calls": self.metrics.get_counter("a2a.agent.success", labels),
            "errors": self.metrics.get_counter("a2a.agent.errors", labels),
            "latency": self.metrics.get_timer_stats("a2a.agent.duration", labels),
            "tokens": self.metrics.get_histogram_stats("a2a.agent.tokens", labels),
        }


# Singleton instance
_observability: Optional[A2AObservability] = None


def get_observability() -> A2AObservability:
    """Get singleton observability instance."""
    global _observability
    if _observability is None:
        _observability = A2AObservability()
    return _observability


# Convenience decorators
def trace(operation_name: Optional[str] = None):
    """Decorator to trace a function."""
    obs = get_observability()
    return obs.trace(operation_name)


def trace_async(operation_name: Optional[str] = None):
    """Decorator to trace an async function."""
    obs = get_observability()
    return obs.trace_async(operation_name)
