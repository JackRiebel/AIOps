"""Tests for the in-memory RateLimiter logic.

Focuses on the in-memory fallback path (no Redis) since that's the
default development/single-instance path.

NOTE: We extract the RateLimiter class source via AST to avoid importing
the full auth.py module, which has FastAPI route decorators that fail
on Python 3.9 with mocked pydantic.
"""
from __future__ import annotations

import ast
import sys
import time
import types
from collections import defaultdict
from pathlib import Path

import pytest

# ── Extract RateLimiter class from auth.py without executing the module ──
_AUTH_PATH = Path(__file__).resolve().parents[2] / "src" / "api" / "routes" / "auth.py"
_source = _AUTH_PATH.read_text()
_tree = ast.parse(_source)

# Find the RateLimiter class node
_class_node = None
for node in ast.walk(_tree):
    if isinstance(node, ast.ClassDef) and node.name == "RateLimiter":
        _class_node = node
        break

assert _class_node is not None, "Could not find RateLimiter class in auth.py"

# Compile and execute just the class definition
_class_source = ast.get_source_segment(_source, _class_node)
_ns = {"defaultdict": defaultdict, "time": time, "logger": types.SimpleNamespace(
    info=lambda *a, **k: None, warning=lambda *a, **k: None, error=lambda *a, **k: None
)}
exec(compile(ast.parse(_class_source), "<RateLimiter>", "exec"), _ns)
RateLimiter = _ns["RateLimiter"]


@pytest.fixture
def limiter():
    """Fresh rate limiter: 3 attempts in a 5-second window."""
    return RateLimiter(max_attempts=3, window_seconds=5, prefix="test")


class TestRateLimiterBasic:
    def test_not_limited_initially(self, limiter):
        assert limiter.is_rate_limited("user1") is False

    def test_limited_after_max_attempts(self, limiter):
        for _ in range(3):
            limiter.record_attempt("user1")
        assert limiter.is_rate_limited("user1") is True

    def test_different_keys_are_independent(self, limiter):
        for _ in range(3):
            limiter.record_attempt("user1")
        assert limiter.is_rate_limited("user1") is True
        assert limiter.is_rate_limited("user2") is False

    def test_under_limit_is_allowed(self, limiter):
        limiter.record_attempt("user1")
        limiter.record_attempt("user1")
        assert limiter.is_rate_limited("user1") is False


class TestRateLimiterExpiry:
    def test_attempts_expire_after_window(self, limiter):
        """Manually backdate timestamps so they appear expired."""
        key = "user1"
        old_time = time.time() - 10  # 10 seconds ago, well past 5-second window
        limiter.attempts[key] = [old_time, old_time, old_time]

        # Should NOT be rate limited because those attempts are stale
        assert limiter.is_rate_limited(key) is False


class TestRateLimiterRemainingTime:
    def test_remaining_time_zero_when_no_attempts(self, limiter):
        assert limiter.get_remaining_time("nobody") == 0

    def test_remaining_time_positive_after_attempts(self, limiter):
        limiter.record_attempt("user1")
        remaining = limiter.get_remaining_time("user1")
        assert 0 < remaining <= 5


class TestRateLimiterCleanup:
    def test_cleanup_removes_stale_keys(self):
        limiter = RateLimiter(max_attempts=3, window_seconds=1, prefix="cleanup")
        old_time = time.time() - 10
        limiter.attempts["stale_key"] = [old_time]
        # Force cleanup by setting last cleanup far in the past
        limiter._last_cleanup = 0
        limiter._cleanup_stale_keys()
        assert "stale_key" not in limiter.attempts

    def test_hard_cap_eviction(self):
        limiter = RateLimiter(max_attempts=3, window_seconds=300, prefix="cap")
        limiter._last_cleanup = 0
        now = time.time()
        # Add more keys than the hard cap
        for i in range(limiter.MAX_IN_MEMORY_KEYS + 100):
            limiter.attempts[f"key_{i}"] = [now]
        limiter._cleanup_stale_keys()
        assert len(limiter.attempts) <= limiter.MAX_IN_MEMORY_KEYS
