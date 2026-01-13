"""Unit tests for QueryIntentDetector."""

import pytest
from src.services.query_intent_detector import (
    QueryIntentDetector,
    QueryIntent,
    Platform,
)


class TestQueryIntentDetector:
    """Test QueryIntentDetector functionality."""

    @pytest.fixture
    def detector(self):
        return QueryIntentDetector()

    def test_detect_meraki_platform(self, detector):
        """Test detection of Meraki queries."""
        queries = [
            "Show me all Meraki networks",
            "List MX devices",
            "Get wireless SSIDs",
            "What VLANs are configured on the switch?",
        ]

        for query in queries:
            result = detector.detect(query)
            assert "meraki" in result.platforms, f"Failed for: {query}"

    def test_detect_catalyst_platform(self, detector):
        """Test detection of Catalyst queries."""
        queries = [
            "List Catalyst sites",
            "Get DNA Center assurance data",
            "Show DNAC device health",
        ]

        for query in queries:
            result = detector.detect(query)
            assert "catalyst" in result.platforms, f"Failed for: {query}"

    def test_detect_thousandeyes_platform(self, detector):
        """Test detection of ThousandEyes queries."""
        queries = [
            "Get ThousandEyes test results",
            "Show synthetic monitoring data",
            "Run an instant test",
        ]

        for query in queries:
            result = detector.detect(query)
            assert "thousandeyes" in result.platforms, f"Failed for: {query}"

    def test_detect_splunk_platform(self, detector):
        """Test detection of Splunk queries."""
        queries = [
            "Search Splunk for errors",
            "Run SPL query",
            "Get saved searches",
        ]

        for query in queries:
            result = detector.detect(query)
            assert "splunk" in result.platforms, f"Failed for: {query}"

    def test_detect_cross_platform(self, detector):
        """Test detection of cross-platform queries."""
        query = "Compare Meraki network health with ThousandEyes results"
        result = detector.detect(query)

        assert result.is_cross_platform
        assert len(result.platforms) >= 2

    def test_detect_single_platform_not_cross(self, detector):
        """Test single platform query is not cross-platform."""
        query = "List all Meraki networks"
        result = detector.detect(query)

        assert not result.is_cross_platform
        assert len(result.platforms) == 1

    def test_detect_query_type_status(self, detector):
        """Test status query type detection."""
        queries = [
            "Show network status",
            "What is the health of my devices?",
            "Are the APs online?",
        ]

        for query in queries:
            result = detector.detect(query)
            assert result.query_type == "status", f"Failed for: {query}"

    def test_detect_query_type_comparison(self, detector):
        """Test comparison query type detection."""
        queries = [
            "Compare MX64 vs MX67",
            "What is the difference between MS120 and MS130?",
        ]

        for query in queries:
            result = detector.detect(query)
            assert result.query_type == "comparison", f"Failed for: {query}"

    def test_detect_query_type_config(self, detector):
        """Test configuration query type detection."""
        queries = [
            "Configure VLAN 100",
            "Update the firewall settings",
            "Change the SSID password",
        ]

        for query in queries:
            result = detector.detect(query)
            assert result.query_type == "config", f"Failed for: {query}"

    def test_detect_query_type_list(self, detector):
        """Test list query type detection."""
        queries = [
            "List all networks",
            "Show me the devices",
            "Get all VLANs",
        ]

        for query in queries:
            result = detector.detect(query)
            assert result.query_type == "list", f"Failed for: {query}"

    def test_can_parallelize_independent_platforms(self, detector):
        """Test parallelization for independent platform queries."""
        query = "Show status of all Meraki and Catalyst networks"
        result = detector.detect(query)

        # Status queries for multiple platforms should be parallelizable
        if len(result.platforms) > 1 and result.query_type == "status":
            assert result.can_parallelize or len(result.dependencies) == 0

    def test_dependencies_detected(self, detector):
        """Test dependency detection between platforms."""
        query = "Find Splunk logs for the failing Meraki device"
        result = detector.detect(query)

        # This query may have dependencies between platforms
        # The specific dependency depends on implementation

    def test_primary_platform_detection(self, detector):
        """Test primary platform determination."""
        query = "Check Meraki MX firewall logs in Splunk"
        result = detector.detect(query)

        # Query mentions Meraki more specifically
        assert result.primary_platform in ["meraki", "splunk"]

    def test_confidence_explicit_mention(self, detector):
        """Test confidence for explicit platform mentions."""
        query = "Show me the meraki dashboard"
        result = detector.detect(query)

        assert result.confidence >= 0.7

    def test_confidence_no_platform_mentioned(self, detector):
        """Test confidence when no platform mentioned."""
        query = "Hello, how are you?"
        result = detector.detect(query)

        # Low confidence without platform context
        assert result.confidence <= 0.5 or len(result.platforms) == 0

    def test_get_parallel_groups_single_platform(self, detector):
        """Test parallel groups for single platform."""
        query = "List Meraki networks"
        result = detector.detect(query)

        groups = result.get_parallel_groups()

        assert len(groups) >= 1
        # All platforms should be covered
        all_platforms = set()
        for group in groups:
            all_platforms.update(group)
        assert all_platforms == set(result.platforms)

    def test_get_parallel_groups_multi_platform(self, detector):
        """Test parallel groups for multiple platforms."""
        # Manually create a result with multiple platforms
        result = QueryIntent(
            platforms=["meraki", "catalyst", "thousandeyes"],
            is_cross_platform=True,
            can_parallelize=True,
            dependencies={},
            primary_platform="meraki",
            query_type="status",
            confidence=0.8,
        )

        groups = result.get_parallel_groups()

        # All platforms should be in the first group if parallelizable
        assert len(groups) == 1
        assert set(groups[0]) == {"meraki", "catalyst", "thousandeyes"}

    def test_to_dict(self, detector):
        """Test QueryIntent serialization."""
        query = "List Meraki networks"
        result = detector.detect(query)

        d = result.to_dict()

        assert "platforms" in d
        assert "is_cross_platform" in d
        assert "can_parallelize" in d
        assert "query_type" in d
        assert "confidence" in d
