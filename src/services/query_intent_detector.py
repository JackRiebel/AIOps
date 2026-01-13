"""Query Intent Detector for Multi-Platform Query Coordination.

This module detects platform intent and parallelization opportunities
to enable efficient cross-platform query execution.

Key features:
- Detects which platforms a query targets
- Identifies cross-platform queries
- Determines if platform queries can be parallelized
- Maps dependencies between platform queries

This enables the unified chat service to:
- Execute independent platform queries in parallel
- Properly sequence dependent queries
- Synthesize cross-platform results coherently
"""

import logging
import re
from typing import Dict, List, Optional, Set, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class Platform(str, Enum):
    """Supported platforms for tool execution."""
    MERAKI = "meraki"
    CATALYST = "catalyst"
    THOUSANDEYES = "thousandeyes"
    SPLUNK = "splunk"
    KNOWLEDGE = "knowledge"


@dataclass
class QueryIntent:
    """Detected intent for a query including platform targets."""
    platforms: List[str]                           # Target platforms
    is_cross_platform: bool                        # Queries multiple platforms
    can_parallelize: bool                          # Independent platform queries
    dependencies: Dict[str, List[str]]             # platform -> depends_on
    primary_platform: Optional[str]                # Main platform for context
    query_type: str                                # "comparison", "status", "config", etc.
    confidence: float                              # Detection confidence

    def get_parallel_groups(self) -> List[List[str]]:
        """Get groups of platforms that can execute in parallel.

        Returns:
            List of platform groups, where each group can run in parallel.
        """
        if not self.can_parallelize:
            # Return sequential order
            return [[p] for p in self.platforms]

        # Find platforms with no dependencies (can run first)
        dependent_platforms = set()
        for deps in self.dependencies.values():
            dependent_platforms.update(deps)

        # First group: platforms with no dependencies
        first_group = [p for p in self.platforms if p not in dependent_platforms]

        # Second group: platforms that depend on first group
        second_group = [p for p in self.platforms if p in dependent_platforms]

        result = []
        if first_group:
            result.append(first_group)
        if second_group:
            result.append(second_group)

        return result if result else [self.platforms]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "platforms": self.platforms,
            "is_cross_platform": self.is_cross_platform,
            "can_parallelize": self.can_parallelize,
            "dependencies": self.dependencies,
            "primary_platform": self.primary_platform,
            "query_type": self.query_type,
            "confidence": self.confidence,
        }


class QueryIntentDetector:
    """Detects platform intent and parallelization opportunities in queries.

    Uses pattern matching and keyword analysis to determine:
    - Which platforms a query targets
    - Whether queries can execute in parallel
    - What dependencies exist between platforms
    """

    # Platform-specific keywords (word boundary matching)
    PLATFORM_KEYWORDS = {
        "meraki": [
            "meraki", "mx", "mr", "ms", "mv", "mt", "mg",
            "wireless", "switch", "firewall", "camera", "sensor",
            "ssid", "vlan", "ap", "access point", "network"
        ],
        "catalyst": [
            "catalyst", "dna", "dnac", "dna center", "sdwan", "sd-wan",
            "isr", "asr", "c9", "c9300", "c9200", "site", "assurance"
        ],
        "thousandeyes": [
            "thousandeyes", "te", "synthetic", "monitoring", "path",
            "trace", "agent", "test", "endpoint", "instant test"
        ],
        "splunk": [
            "splunk", "spl", "search", "log", "siem", "event",
            "index", "alert", "saved search", "correlation"
        ],
    }

    # Query types that suggest cross-platform correlation
    CROSS_PLATFORM_PATTERNS = [
        r"\b(?:and|with|including|across|all)\b.*\b(?:platforms?|systems?)\b",
        r"\b(?:compare|correlation|correlated|together)\b",
        r"\boverall\s+(?:status|health|overview)\b",
        r"\bentire\s+(?:network|infrastructure)\b",
        r"\beverything\b",
    ]

    # Patterns indicating sequential/dependent queries
    DEPENDENCY_PATTERNS = {
        # If we find device info, we might need to query logs
        ("meraki", "splunk"): [
            r"logs?\s+(?:for|from|of)\s+.*(?:device|network|mx|mr|ms)",
            r"alerts?\s+(?:for|from|of)\s+.*meraki",
        ],
        # Network issues might need path analysis
        ("meraki", "thousandeyes"): [
            r"connectivity\s+(?:issue|problem|test)",
            r"path\s+(?:to|from)\s+.*network",
        ],
        # Site issues might need Splunk correlation
        ("catalyst", "splunk"): [
            r"site\s+.*(?:issue|problem|alert)",
            r"logs?\s+(?:for|from|of)\s+.*(?:site|catalyst)",
        ],
    }

    # Query type patterns
    QUERY_TYPE_PATTERNS = {
        "status": [r"\bstatus\b", r"\bhealth\b", r"\bstate\b", r"\bonline\b", r"\boffline\b"],
        "comparison": [r"\bcompare\b", r"\bdifference\b", r"\bvs\b", r"\bversus\b"],
        "config": [r"\bconfig(?:ure|uration)?\b", r"\bsettings?\b", r"\bupdate\b", r"\bchange\b"],
        "troubleshoot": [r"\bissue\b", r"\bproblem\b", r"\berror\b", r"\bfail", r"\bdown\b"],
        "list": [r"\blist\b", r"\bshow\b", r"\bget\b", r"\bfind\b"],
        "analysis": [r"\banalyze\b", r"\banalysis\b", r"\binvestigate\b", r"\breport\b"],
    }

    def __init__(self):
        """Initialize the detector."""
        # Pre-compile regex patterns for performance
        self._compiled_patterns = {}
        for query_type, patterns in self.QUERY_TYPE_PATTERNS.items():
            self._compiled_patterns[query_type] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

    def detect(self, query: str, context: Optional[Dict[str, Any]] = None) -> QueryIntent:
        """Detect platform intent from a query.

        Args:
            query: User query text.
            context: Optional context (org, available credentials, etc.).

        Returns:
            QueryIntent with platform detection and parallelization info.
        """
        query_lower = query.lower()

        # Detect platforms mentioned
        platforms = self._detect_platforms(query_lower, context)

        # Detect query type
        query_type = self._detect_query_type(query_lower)

        # Check for cross-platform indicators
        is_cross_platform = len(platforms) > 1 or self._has_cross_platform_intent(query_lower)

        # Detect dependencies between platforms
        dependencies = self._detect_dependencies(query_lower, platforms)

        # Determine if we can parallelize
        can_parallelize = (
            len(platforms) > 1 and
            len(dependencies) == 0 and
            query_type in ("status", "list", "analysis")
        )

        # Determine primary platform
        primary_platform = self._get_primary_platform(platforms, query_lower, context)

        # Calculate confidence
        confidence = self._calculate_confidence(platforms, query_lower)

        result = QueryIntent(
            platforms=platforms,
            is_cross_platform=is_cross_platform,
            can_parallelize=can_parallelize,
            dependencies=dependencies,
            primary_platform=primary_platform,
            query_type=query_type,
            confidence=confidence,
        )

        logger.debug(
            f"[QueryIntentDetector] Query: '{query[:50]}...' -> "
            f"platforms={platforms}, cross={is_cross_platform}, "
            f"parallel={can_parallelize}, type={query_type}"
        )

        return result

    def _detect_platforms(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """Detect which platforms are mentioned in the query."""
        platforms = []

        for platform, keywords in self.PLATFORM_KEYWORDS.items():
            for keyword in keywords:
                # Use word boundary matching for short keywords
                if len(keyword) <= 3:
                    pattern = rf'\b{re.escape(keyword)}\b'
                else:
                    pattern = re.escape(keyword)

                if re.search(pattern, query, re.IGNORECASE):
                    if platform not in platforms:
                        platforms.append(platform)
                    break

        # If no platforms detected and we have context, use context hints
        if not platforms and context:
            available_platforms = context.get("available_platforms", [])
            if available_platforms:
                # Default to first available platform
                platforms = [available_platforms[0]]

        return platforms

    def _detect_query_type(self, query: str) -> str:
        """Detect the type of query."""
        for query_type, patterns in self._compiled_patterns.items():
            for pattern in patterns:
                if pattern.search(query):
                    return query_type
        return "general"

    def _has_cross_platform_intent(self, query: str) -> bool:
        """Check if query has cross-platform indicators."""
        for pattern in self.CROSS_PLATFORM_PATTERNS:
            if re.search(pattern, query, re.IGNORECASE):
                return True
        return False

    def _detect_dependencies(
        self,
        query: str,
        platforms: List[str]
    ) -> Dict[str, List[str]]:
        """Detect dependencies between platform queries."""
        dependencies = {}

        for (platform1, platform2), patterns in self.DEPENDENCY_PATTERNS.items():
            if platform1 in platforms and platform2 in platforms:
                for pattern in patterns:
                    if re.search(pattern, query, re.IGNORECASE):
                        # platform2 depends on platform1
                        if platform2 not in dependencies:
                            dependencies[platform2] = []
                        if platform1 not in dependencies[platform2]:
                            dependencies[platform2].append(platform1)
                        break

        return dependencies

    def _get_primary_platform(
        self,
        platforms: List[str],
        query: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Determine the primary platform for a query."""
        if not platforms:
            return None

        if len(platforms) == 1:
            return platforms[0]

        # Count keyword matches per platform to find primary
        scores = {}
        for platform in platforms:
            keywords = self.PLATFORM_KEYWORDS.get(platform, [])
            score = sum(1 for kw in keywords if kw in query)
            scores[platform] = score

        # Return platform with highest score
        if scores:
            return max(scores, key=scores.get)

        return platforms[0]

    def _calculate_confidence(self, platforms: List[str], query: str) -> float:
        """Calculate detection confidence."""
        if not platforms:
            return 0.3  # Low confidence if no platforms detected

        # Count explicit platform mentions
        explicit_mentions = 0
        for platform in platforms:
            if platform in query:
                explicit_mentions += 1

        # Higher confidence for explicit mentions
        if explicit_mentions == len(platforms):
            return 0.9
        elif explicit_mentions > 0:
            return 0.7
        else:
            return 0.5


# Singleton instance
_query_intent_detector: Optional[QueryIntentDetector] = None


def get_query_intent_detector() -> QueryIntentDetector:
    """Get the singleton QueryIntentDetector instance."""
    global _query_intent_detector
    if _query_intent_detector is None:
        _query_intent_detector = QueryIntentDetector()
    return _query_intent_detector
