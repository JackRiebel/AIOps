"""Tests for smart response mixins.

Tests the TimeRangeAwareMixin, SmartResponseMixin, and CacheableAgentMixin
that provide intelligent response handling for specialist agents.
"""

import pytest
from unittest.mock import AsyncMock
from datetime import datetime

import sys
sys.path.insert(0, str(__file__).rsplit('/tests', 1)[0])

from src.a2a.specialists.base_specialist import (
    TimeRangeAwareMixin,
    SmartResponseMixin,
    CacheableAgentMixin,
)


class TestTimeRangeAwareMixin:
    """Tests for time range inference and expansion."""

    @pytest.fixture
    def mixin(self):
        """Create a mixin instance for testing."""
        class TestAgent(TimeRangeAwareMixin):
            pass
        return TestAgent()

    @pytest.mark.parametrize("query,expected_range", [
        ("Show me recent events", "-24h"),
        ("What happened recently?", "-24h"),
        ("Events from today", "-24h"),
        ("Show me events now", "-1h"),
        ("What's happening currently?", "-1h"),
        ("Last hour events", "-1h"),
        ("Past hour alerts", "-1h"),
        ("Events from yesterday", "-48h"),
        ("This week's alerts", "-7d"),
        ("Last week events", "-7d"),
        ("Past month logs", "-30d"),
        ("This month alerts", "-30d"),
    ])
    def test_time_range_inference(self, mixin, query, expected_range):
        """Test time range is correctly inferred from natural language."""
        result = mixin.infer_time_range(query)
        assert result == expected_range, f"Query '{query}' should map to {expected_range}"

    def test_specified_range_takes_precedence(self, mixin):
        """Test that explicit time range overrides inference."""
        result = mixin.infer_time_range(
            "Show me recent events",  # Would infer -24h
            specified_range="-7d"
        )
        assert result == "-7d"

    def test_default_range_used_when_no_match(self, mixin):
        """Test default range is used when no time pattern matches."""
        result = mixin.infer_time_range(
            "Show me all events",  # No time indicator
            default="-12h"
        )
        assert result == "-12h"

    @pytest.mark.parametrize("time_spec,expected_desc", [
        ("-1h", "last hour"),
        ("-4h", "last 4 hours"),
        ("-24h", "last 24 hours"),
        ("-7d", "last 7 days"),
        ("-30d", "last 30 days"),
    ])
    def test_time_range_description(self, mixin, time_spec, expected_desc):
        """Test human-readable time range descriptions."""
        desc = mixin.get_time_range_description(time_spec)
        assert expected_desc in desc.lower()

    @pytest.mark.asyncio
    async def test_search_with_expansion(self, mixin):
        """Test time range expansion when no results found."""
        call_count = 0
        results_by_range = {
            "-1h": [],
            "-4h": [],
            "-24h": [{"event": "test"}],  # Results at 24h
        }

        async def mock_fetch(time_range, **kwargs):
            nonlocal call_count
            call_count += 1
            return results_by_range.get(time_range, [])

        results, final_range, note = await mixin.search_with_expansion(
            fetch_func=mock_fetch,
            initial_range="-1h",
            auto_expand=True,
        )

        assert len(results) > 0
        assert final_range == "-24h"
        assert note is not None  # Should include expansion note
        assert call_count >= 2  # Should have expanded

    @pytest.mark.asyncio
    async def test_no_expansion_when_disabled(self, mixin):
        """Test that expansion doesn't happen when disabled."""
        call_count = 0

        async def mock_fetch(time_range, **kwargs):
            nonlocal call_count
            call_count += 1
            return []

        results, final_range, note = await mixin.search_with_expansion(
            fetch_func=mock_fetch,
            initial_range="-1h",
            auto_expand=False,
        )

        assert call_count == 1  # Only one call
        assert final_range == "-1h"


class TestSmartResponseMixin:
    """Tests for smart response generation."""

    @pytest.fixture
    def mixin(self):
        """Create a mixin instance for testing."""
        class TestAgent(SmartResponseMixin):
            pass
        return TestAgent()

    @pytest.mark.parametrize("domain,result_type", [
        ("security", "alerts"),
        ("monitoring", "alerts"),
        ("network", "issues"),
        ("devices", "problems"),
    ])
    def test_positive_absence_framing(self, mixin, domain, result_type):
        """Test positive framing for different domains."""
        message = mixin.frame_positive_absence(domain, result_type)

        assert message != ""
        # Should be positive/healthy language
        assert any(word in message.lower() for word in [
            "healthy", "no", "positive", "normal", "stable", "good"
        ])

    def test_custom_positive_message(self, mixin):
        """Test custom message in positive framing."""
        custom = "All systems operational."
        message = mixin.frame_positive_absence(
            "network", "issues",
            custom_message=custom
        )

        assert custom in message

    def test_no_data_response_with_suggestions(self, mixin):
        """Test no-data response includes suggestions."""
        response = mixin.generate_no_data_response(
            query="Show me device alerts",
            domain="devices",
        )

        assert response != ""
        # Should include helpful suggestions
        assert any(word in response.lower() for word in [
            "try", "suggest", "consider", "check", "alternative"
        ])

    def test_no_data_response_includes_search_params(self, mixin):
        """Test no-data response mentions what was searched."""
        response = mixin.generate_no_data_response(
            query="Show alerts",
            domain="security",
            searched_params={"time_range": "-24h", "severity": "high"},
        )

        # Should mention the search parameters
        assert "24h" in response or "high" in response.lower() or "searched" in response.lower()

    def test_smart_empty_result_for_problem_search(self, mixin):
        """Test smart result for searches that find no problems (good news)."""
        result = mixin.create_smart_empty_result(
            domain="security",
            result_type="alerts",
            query="Are there any security alerts?",
            is_problem_search=True,
        )

        assert result["status"] == "healthy"
        assert "note" in result
        # Should be framed positively
        assert any(word in result["note"].lower() for word in ["no", "healthy", "positive"])

    def test_smart_empty_result_for_data_search(self, mixin):
        """Test smart result for searches that find no data (needs suggestions)."""
        result = mixin.create_smart_empty_result(
            domain="devices",
            result_type="list",
            query="Show me all routers",
            is_problem_search=False,
        )

        assert "suggestions" in result or "note" in result


class TestCacheableAgentMixin:
    """Tests for caching mixin."""

    @pytest.fixture
    def mixin(self):
        """Create a mixin instance with cache initialized."""
        class TestAgent(CacheableAgentMixin):
            pass
        agent = TestAgent()
        agent.init_cache(ttl_seconds=300)
        return agent

    def test_cache_set_and_get(self, mixin):
        """Test basic cache operations."""
        mixin.set_cached("test_key", {"data": "value"})

        result = mixin.get_cached("test_key")
        assert result == {"data": "value"}

    def test_cache_miss_returns_none(self, mixin):
        """Test that cache miss returns None."""
        result = mixin.get_cached("nonexistent_key")
        assert result is None

    def test_cache_clear_all(self, mixin):
        """Test clearing entire cache."""
        mixin.set_cached("key1", "value1")
        mixin.set_cached("key2", "value2")

        count = mixin.clear_cache()

        assert count == 2
        assert mixin.get_cached("key1") is None
        assert mixin.get_cached("key2") is None

    def test_cache_clear_by_prefix(self, mixin):
        """Test clearing cache by prefix."""
        mixin.set_cached("device:1", "value1")
        mixin.set_cached("device:2", "value2")
        mixin.set_cached("network:1", "value3")

        count = mixin.clear_cache(prefix="device:")

        assert count == 2
        assert mixin.get_cached("device:1") is None
        assert mixin.get_cached("network:1") is not None

    def test_cache_stats(self, mixin):
        """Test cache statistics."""
        mixin.set_cached("key1", "value1")
        mixin.get_cached("key1")  # Hit
        mixin.get_cached("key2")  # Miss

        stats = mixin.get_cache_stats()

        assert stats["size"] >= 1
        assert "ttl_seconds" in stats


class TestMixinIntegration:
    """Tests for mixin integration in actual agents."""

    def test_thousandeyes_agent_has_smart_mixin(self):
        """Test ThousandEyes agent has SmartResponseMixin."""
        from src.a2a.specialists.thousandeyes_agent import ThousandEyesAgent
        assert issubclass(ThousandEyesAgent, SmartResponseMixin)

    def test_catalyst_agent_has_smart_mixin(self):
        """Test Catalyst agent has SmartResponseMixin."""
        from src.a2a.specialists.catalyst_agent import CatalystAgent
        assert issubclass(CatalystAgent, SmartResponseMixin)

    def test_meraki_agent_has_smart_mixin(self):
        """Test Meraki agent has SmartResponseMixin."""
        from src.a2a.specialists.meraki_agent import MerakiAgent
        assert issubclass(MerakiAgent, SmartResponseMixin)

    def test_splunk_agent_has_time_mixin(self):
        """Test Splunk agent has TimeRangeAwareMixin."""
        from src.a2a.specialists.splunk_agent import SplunkAgent
        assert issubclass(SplunkAgent, TimeRangeAwareMixin)
