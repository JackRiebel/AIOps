"""
Agent Behavior Settings - Externalized Configuration for A2A System.

This module provides centralized configuration for agent behaviors,
allowing easy tuning of parameters without code changes.

Configuration can be loaded from:
1. Environment variables (AGENT_*)
2. Configuration file (agent_config.yaml if present)
3. Default values defined here

Example usage:
    from src.config.agent_settings import get_agent_settings

    settings = get_agent_settings()
    if settings.enable_time_inference:
        time_range = agent.infer_time_range(query)
"""

import os
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from functools import lru_cache

logger = logging.getLogger(__name__)


@dataclass
class TimeRangeSettings:
    """Settings for time-based query handling."""

    # Maximum number of time range expansions when no data found
    max_expansion_levels: int = 2

    # Enable automatic time range expansion
    auto_expand: bool = True

    # Default time range when not specified in query
    default_range: str = "-24h"

    # Time range expansion ladder (from narrow to broad)
    expansion_ladder: List[str] = field(default_factory=lambda: [
        "-1h", "-4h", "-24h", "-7d", "-30d"
    ])


@dataclass
class ResponseSettings:
    """Settings for response generation."""

    # Enable positive framing for "no problems" results
    enable_positive_framing: bool = True

    # Include suggestions in empty results
    include_suggestions: bool = True

    # Maximum suggestions to include
    max_suggestions: int = 3


@dataclass
class CacheSettings:
    """Settings for agent caching."""

    # Time-to-live for cached data in seconds
    ttl_seconds: int = 300  # 5 minutes

    # Maximum cache entries per agent
    max_entries: int = 1000

    # Enable caching
    enabled: bool = True

    # Cache key prefixes to exclude from caching
    excluded_prefixes: List[str] = field(default_factory=list)


@dataclass
class CollaborationSettings:
    """Settings for multi-agent collaboration."""

    # Maximum iterations in collaborative workflows
    max_iterations: int = 3

    # Maximum concurrent agents in parallel workflows
    max_parallel_agents: int = 4

    # Enable cross-agent entity sharing
    enable_entity_sharing: bool = True

    # Timeout for individual agent execution (seconds)
    agent_timeout_seconds: int = 30

    # Enable error recovery via agent handoff
    enable_error_recovery: bool = True


@dataclass
class RoutingSettings:
    """Settings for query routing."""

    # Minimum confidence for fuzzy matching
    min_confidence: float = 0.75

    # Enable typo correction
    enable_typo_correction: bool = True

    # Enable abbreviation expansion
    enable_abbreviation_expansion: bool = True

    # Enable follow-up query detection
    enable_follow_up_detection: bool = True

    # Minimum words for a standalone query (vs follow-up)
    min_standalone_words: int = 3


@dataclass
class FeedbackSettings:
    """Settings for feedback tracking."""

    # Enable adaptive routing based on feedback
    enable_adaptive_routing: bool = True

    # Window size for rolling success rate calculation
    success_rate_window: int = 100

    # Minimum queries before adjusting priority
    min_queries_for_adjustment: int = 10

    # Success rate thresholds for priority adjustment
    positive_threshold: float = 0.85
    negative_threshold: float = 0.65


@dataclass
class VocabularySettings:
    """Settings for vocabulary management."""

    # Enable learning new terms from conversations
    enable_learning: bool = True

    # Minimum occurrences before adding a term
    min_occurrences: int = 3

    # Maximum learned terms to keep
    max_learned_terms: int = 500

    # Path to save learned vocabulary
    learned_vocab_path: Optional[str] = None


@dataclass
class AgentBehaviorSettings:
    """Master configuration for all agent behaviors.

    This is the main settings class that aggregates all sub-configurations.
    Access via get_agent_settings() for cached singleton.
    """

    # Sub-configurations
    time_range: TimeRangeSettings = field(default_factory=TimeRangeSettings)
    response: ResponseSettings = field(default_factory=ResponseSettings)
    cache: CacheSettings = field(default_factory=CacheSettings)
    collaboration: CollaborationSettings = field(default_factory=CollaborationSettings)
    routing: RoutingSettings = field(default_factory=RoutingSettings)
    feedback: FeedbackSettings = field(default_factory=FeedbackSettings)
    vocabulary: VocabularySettings = field(default_factory=VocabularySettings)

    # Global settings
    debug_mode: bool = False
    log_level: str = "INFO"

    # Feature flags
    enable_time_inference: bool = True
    enable_smart_responses: bool = True
    enable_caching: bool = True
    enable_collaboration: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert settings to dictionary for serialization."""
        return {
            "time_range": {
                "max_expansion_levels": self.time_range.max_expansion_levels,
                "auto_expand": self.time_range.auto_expand,
                "default_range": self.time_range.default_range,
            },
            "response": {
                "enable_positive_framing": self.response.enable_positive_framing,
                "include_suggestions": self.response.include_suggestions,
                "max_suggestions": self.response.max_suggestions,
            },
            "cache": {
                "ttl_seconds": self.cache.ttl_seconds,
                "max_entries": self.cache.max_entries,
                "enabled": self.cache.enabled,
            },
            "collaboration": {
                "max_iterations": self.collaboration.max_iterations,
                "max_parallel_agents": self.collaboration.max_parallel_agents,
                "enable_entity_sharing": self.collaboration.enable_entity_sharing,
                "agent_timeout_seconds": self.collaboration.agent_timeout_seconds,
            },
            "routing": {
                "min_confidence": self.routing.min_confidence,
                "enable_typo_correction": self.routing.enable_typo_correction,
                "enable_follow_up_detection": self.routing.enable_follow_up_detection,
            },
            "feedback": {
                "enable_adaptive_routing": self.feedback.enable_adaptive_routing,
                "success_rate_window": self.feedback.success_rate_window,
            },
            "vocabulary": {
                "enable_learning": self.vocabulary.enable_learning,
                "max_learned_terms": self.vocabulary.max_learned_terms,
            },
            "feature_flags": {
                "enable_time_inference": self.enable_time_inference,
                "enable_smart_responses": self.enable_smart_responses,
                "enable_caching": self.enable_caching,
                "enable_collaboration": self.enable_collaboration,
            },
            "debug_mode": self.debug_mode,
        }


def _load_from_env(settings: AgentBehaviorSettings) -> AgentBehaviorSettings:
    """Load settings from environment variables.

    Environment variables are prefixed with AGENT_ and use underscores.
    Example: AGENT_TIME_RANGE_MAX_EXPANSION_LEVELS=3
    """
    env_mappings = {
        # Time range settings
        "AGENT_TIME_RANGE_MAX_EXPANSION_LEVELS": (
            "time_range", "max_expansion_levels", int
        ),
        "AGENT_TIME_RANGE_AUTO_EXPAND": (
            "time_range", "auto_expand", lambda x: x.lower() == "true"
        ),
        "AGENT_TIME_RANGE_DEFAULT": (
            "time_range", "default_range", str
        ),

        # Response settings
        "AGENT_RESPONSE_POSITIVE_FRAMING": (
            "response", "enable_positive_framing", lambda x: x.lower() == "true"
        ),
        "AGENT_RESPONSE_INCLUDE_SUGGESTIONS": (
            "response", "include_suggestions", lambda x: x.lower() == "true"
        ),

        # Cache settings
        "AGENT_CACHE_TTL": ("cache", "ttl_seconds", int),
        "AGENT_CACHE_MAX_ENTRIES": ("cache", "max_entries", int),
        "AGENT_CACHE_ENABLED": (
            "cache", "enabled", lambda x: x.lower() == "true"
        ),

        # Collaboration settings
        "AGENT_COLLAB_MAX_ITERATIONS": (
            "collaboration", "max_iterations", int
        ),
        "AGENT_COLLAB_TIMEOUT": (
            "collaboration", "agent_timeout_seconds", int
        ),

        # Routing settings
        "AGENT_ROUTING_MIN_CONFIDENCE": (
            "routing", "min_confidence", float
        ),
        "AGENT_ROUTING_TYPO_CORRECTION": (
            "routing", "enable_typo_correction", lambda x: x.lower() == "true"
        ),

        # Feedback settings
        "AGENT_FEEDBACK_ADAPTIVE_ROUTING": (
            "feedback", "enable_adaptive_routing", lambda x: x.lower() == "true"
        ),

        # Vocabulary settings
        "AGENT_VOCAB_ENABLE_LEARNING": (
            "vocabulary", "enable_learning", lambda x: x.lower() == "true"
        ),
        "AGENT_VOCAB_PATH": ("vocabulary", "learned_vocab_path", str),

        # Global feature flags
        "AGENT_ENABLE_TIME_INFERENCE": (
            None, "enable_time_inference", lambda x: x.lower() == "true"
        ),
        "AGENT_ENABLE_SMART_RESPONSES": (
            None, "enable_smart_responses", lambda x: x.lower() == "true"
        ),
        "AGENT_ENABLE_CACHING": (
            None, "enable_caching", lambda x: x.lower() == "true"
        ),
        "AGENT_ENABLE_COLLABORATION": (
            None, "enable_collaboration", lambda x: x.lower() == "true"
        ),
        "AGENT_DEBUG_MODE": (
            None, "debug_mode", lambda x: x.lower() == "true"
        ),
    }

    for env_var, (subsection, attr, converter) in env_mappings.items():
        value = os.environ.get(env_var)
        if value is not None:
            try:
                converted = converter(value)
                if subsection:
                    sub_obj = getattr(settings, subsection)
                    setattr(sub_obj, attr, converted)
                else:
                    setattr(settings, attr, converted)
                logger.debug(f"Loaded {env_var}={converted}")
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid value for {env_var}: {value} ({e})")

    return settings


def _load_from_file(settings: AgentBehaviorSettings, path: str) -> AgentBehaviorSettings:
    """Load settings from YAML configuration file."""
    try:
        import yaml

        with open(path, "r") as f:
            config = yaml.safe_load(f)

        if not config:
            return settings

        # Map YAML sections to settings objects
        if "time_range" in config:
            for key, value in config["time_range"].items():
                if hasattr(settings.time_range, key):
                    setattr(settings.time_range, key, value)

        if "response" in config:
            for key, value in config["response"].items():
                if hasattr(settings.response, key):
                    setattr(settings.response, key, value)

        if "cache" in config:
            for key, value in config["cache"].items():
                if hasattr(settings.cache, key):
                    setattr(settings.cache, key, value)

        if "collaboration" in config:
            for key, value in config["collaboration"].items():
                if hasattr(settings.collaboration, key):
                    setattr(settings.collaboration, key, value)

        if "routing" in config:
            for key, value in config["routing"].items():
                if hasattr(settings.routing, key):
                    setattr(settings.routing, key, value)

        if "feedback" in config:
            for key, value in config["feedback"].items():
                if hasattr(settings.feedback, key):
                    setattr(settings.feedback, key, value)

        if "vocabulary" in config:
            for key, value in config["vocabulary"].items():
                if hasattr(settings.vocabulary, key):
                    setattr(settings.vocabulary, key, value)

        # Top-level settings
        for key in ["debug_mode", "log_level", "enable_time_inference",
                    "enable_smart_responses", "enable_caching", "enable_collaboration"]:
            if key in config:
                setattr(settings, key, config[key])

        logger.info(f"Loaded agent settings from {path}")

    except FileNotFoundError:
        logger.debug(f"Config file not found: {path}")
    except ImportError:
        logger.warning("PyYAML not installed, skipping file config loading")
    except Exception as e:
        logger.warning(f"Error loading config file {path}: {e}")

    return settings


@lru_cache(maxsize=1)
def get_agent_settings() -> AgentBehaviorSettings:
    """Get the singleton AgentBehaviorSettings instance.

    Settings are loaded in order of priority:
    1. Default values
    2. Configuration file (agent_config.yaml)
    3. Environment variables (highest priority)

    Returns:
        Configured AgentBehaviorSettings instance
    """
    settings = AgentBehaviorSettings()

    # Try to load from config file
    config_paths = [
        os.path.join(os.path.dirname(__file__), "agent_config.yaml"),
        os.path.join(os.path.dirname(__file__), "..", "..", "agent_config.yaml"),
        "/etc/lumen/agent_config.yaml",
    ]

    for path in config_paths:
        if os.path.exists(path):
            settings = _load_from_file(settings, path)
            break

    # Override with environment variables
    settings = _load_from_env(settings)

    if settings.debug_mode:
        logger.setLevel(logging.DEBUG)
        logger.debug(f"Agent settings loaded: {settings.to_dict()}")

    return settings


def reload_settings() -> AgentBehaviorSettings:
    """Force reload of settings (clears cache).

    Returns:
        Fresh AgentBehaviorSettings instance
    """
    get_agent_settings.cache_clear()
    return get_agent_settings()
