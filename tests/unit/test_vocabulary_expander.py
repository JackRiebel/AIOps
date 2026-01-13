"""Tests for VocabularyExpander.

Tests the vocabulary learning and expansion system that dynamically
adds new terms from user interactions.
"""

import pytest
from unittest.mock import patch, MagicMock
import tempfile
import json
import os

import sys
sys.path.insert(0, str(__file__).rsplit('/tests', 1)[0])

from src.services.query_preprocessor import (
    VocabularyExpander,
    LearnedTerm,
    QueryPreprocessor,
    get_vocabulary_expander,
)


class TestVocabularyExpander:
    """Tests for VocabularyExpander class."""

    @pytest.fixture
    def expander(self):
        """Create a fresh VocabularyExpander for testing."""
        return VocabularyExpander(
            min_occurrences=3,
            max_learned_terms=100,
            persist_path=None,
        )

    def test_observe_term_new(self, expander):
        """Test observing a new term."""
        expander.observe_term("MX68", "device")

        stats = expander.get_stats()
        assert stats["total_terms"] == 1
        assert "device" in stats["by_category"]

    def test_observe_term_increment(self, expander):
        """Test observing the same term increments count."""
        expander.observe_term("MX68", "device")
        expander.observe_term("MX68", "device")
        expander.observe_term("MX68", "device")

        candidates = expander.get_promotion_candidates()
        assert len(candidates) == 1
        assert candidates[0].occurrences == 3

    def test_observe_short_term_ignored(self, expander):
        """Test that very short terms are ignored."""
        expander.observe_term("AB", "device")

        stats = expander.get_stats()
        assert stats["total_terms"] == 0

    def test_promotion_candidates_threshold(self, expander):
        """Test that only terms meeting threshold are candidates."""
        # Term with 2 occurrences - not enough
        expander.observe_term("DeviceA", "device")
        expander.observe_term("DeviceA", "device")

        # Term with 3 occurrences - enough
        expander.observe_term("DeviceB", "device")
        expander.observe_term("DeviceB", "device")
        expander.observe_term("DeviceB", "device")

        candidates = expander.get_promotion_candidates()
        assert len(candidates) == 1
        assert candidates[0].term == "deviceb"

    def test_promote_to_vocabulary(self, expander):
        """Test promoting terms to the preprocessor."""
        preprocessor = QueryPreprocessor()
        original_vocab_size = len(preprocessor.DOMAIN_VOCABULARY)

        # Add term with enough occurrences
        for _ in range(5):
            expander.observe_term("MyNewTerm", "general")

        promoted = expander.promote_learned_terms(preprocessor)

        assert promoted == 1
        assert len(preprocessor.DOMAIN_VOCABULARY) == original_vocab_size + 1
        assert "mynewterm" in preprocessor.DOMAIN_VOCABULARY

    def test_no_double_promotion(self, expander):
        """Test that terms aren't promoted twice."""
        preprocessor = QueryPreprocessor()

        for _ in range(5):
            expander.observe_term("UniqueDevice", "device")

        # First promotion
        promoted1 = expander.promote_learned_terms(preprocessor)
        assert promoted1 == 1

        # Second promotion - should be 0
        promoted2 = expander.promote_learned_terms(preprocessor)
        assert promoted2 == 0

    def test_add_domain_term_manual(self, expander):
        """Test manually adding a domain term."""
        expander.add_domain_term("SpecialTerm", "network", source="admin")

        # Should immediately be a candidate (min_occurrences set)
        candidates = expander.get_promotion_candidates()
        assert len(candidates) == 1
        assert candidates[0].term == "specialterm"
        assert candidates[0].source == "admin"

    def test_observe_from_query(self, expander):
        """Test extracting terms from a query."""
        known_vocab = ["splunk", "meraki", "network", "device"]

        expander.observe_from_query(
            "Show me the MX68 device status from NetworkAlpha",
            known_vocab
        )

        stats = expander.get_stats()
        # Should have found MX68 and NetworkAlpha
        assert stats["total_terms"] >= 1

    def test_categorize_device_model(self, expander):
        """Test categorization of device model patterns."""
        category = expander._categorize_term("MS225")
        assert category == "device"

        category = expander._categorize_term("MR46")
        assert category == "device"

    def test_categorize_network_term(self, expander):
        """Test categorization of network-related terms."""
        category = expander._categorize_term("SubnetConfig")
        assert category == "network"

    def test_categorize_action_term(self, expander):
        """Test categorization of action terms."""
        category = expander._categorize_term("troubleshooting")
        assert category == "action"

    def test_load_terms_from_logs(self, expander):
        """Test learning terms from log content."""
        log_content = '''
        2024-01-15 Device MX68 connected to network
        2024-01-15 Switch MS225-24P reported status
        2024-01-15 API call to /api/v1/organizations/12345
        2024-01-15 Network "CorpNetwork" updated
        '''

        discovered = expander.load_terms_from_logs(log_content)

        # Should discover MX68, MS225-24P, CorpNetwork
        assert discovered >= 2

    def test_eviction_when_at_capacity(self):
        """Test that least-used terms are evicted at capacity."""
        expander = VocabularyExpander(
            min_occurrences=3,
            max_learned_terms=3,
        )

        # Add 3 terms
        expander.observe_term("TermA", "general")
        expander.observe_term("TermB", "general")
        expander.observe_term("TermB", "general")  # TermB has 2
        expander.observe_term("TermC", "general")

        # Add 4th term - should evict TermA or TermC (both have 1)
        expander.observe_term("TermD", "general")

        stats = expander.get_stats()
        assert stats["total_terms"] == 3

    def test_get_stats(self, expander):
        """Test statistics generation."""
        expander.observe_term("Device1", "device")
        expander.observe_term("Network1", "network")
        expander.observe_term("Alert1", "status")

        stats = expander.get_stats()

        assert stats["total_terms"] == 3
        assert stats["promoted_terms"] == 0
        assert "by_category" in stats
        assert stats["min_occurrences"] == 3


class TestVocabularyPersistence:
    """Tests for vocabulary persistence."""

    def test_save_and_load(self):
        """Test saving and loading vocabulary from file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name

        try:
            # Create expander and add terms
            expander1 = VocabularyExpander(
                min_occurrences=3,
                persist_path=temp_path,
            )

            for _ in range(5):
                expander1.observe_term("PersistentTerm", "device")

            # Force save
            expander1._save_to_file()

            # Create new expander with same path
            expander2 = VocabularyExpander(
                min_occurrences=3,
                persist_path=temp_path,
            )

            stats = expander2.get_stats()
            assert stats["total_terms"] == 1

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


class TestAgentSettings:
    """Tests for AgentBehaviorSettings."""

    def test_default_settings(self):
        """Test default settings values."""
        from src.config.agent_settings import AgentBehaviorSettings

        settings = AgentBehaviorSettings()

        assert settings.time_range.max_expansion_levels == 2
        assert settings.response.enable_positive_framing is True
        assert settings.cache.ttl_seconds == 300
        assert settings.collaboration.max_iterations == 3

    def test_to_dict(self):
        """Test settings serialization."""
        from src.config.agent_settings import AgentBehaviorSettings

        settings = AgentBehaviorSettings()
        config = settings.to_dict()

        assert "time_range" in config
        assert "response" in config
        assert "cache" in config
        assert "feature_flags" in config

    def test_env_override(self):
        """Test environment variable overrides."""
        from src.config.agent_settings import AgentBehaviorSettings, _load_from_env

        settings = AgentBehaviorSettings()

        with patch.dict(os.environ, {"AGENT_CACHE_TTL": "600"}):
            settings = _load_from_env(settings)
            assert settings.cache.ttl_seconds == 600

    def test_feature_flags(self):
        """Test feature flag configuration."""
        from src.config.agent_settings import AgentBehaviorSettings

        settings = AgentBehaviorSettings()

        assert settings.enable_time_inference is True
        assert settings.enable_smart_responses is True
        assert settings.enable_caching is True
        assert settings.enable_collaboration is True
