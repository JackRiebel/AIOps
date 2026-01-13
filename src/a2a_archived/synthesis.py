"""A2A Response Synthesis Module.

Handles merging and synthesizing responses from multiple agents into
coherent, unified outputs. Implements 2025 best practices for multi-agent
response combination.

Features:
- Multi-agent response merging
- Conflict detection and resolution
- Source attribution
- Coherent narrative construction
- Intelligent follow-up suggestions
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class ConflictType(str, Enum):
    """Types of conflicts between agent responses."""
    FACTUAL = "factual"           # Different facts stated
    RECOMMENDATION = "recommendation"  # Different recommendations
    PRIORITY = "priority"         # Different prioritization
    TERMINOLOGY = "terminology"   # Different terms for same concept
    SCOPE = "scope"              # Different scope of answer


class ResolutionStrategy(str, Enum):
    """Strategies for resolving conflicts."""
    PREFER_PRIMARY = "prefer_primary"     # Prefer primary agent
    PREFER_KNOWLEDGE = "prefer_knowledge"  # Prefer knowledge agent
    PREFER_API_DATA = "prefer_api_data"   # Prefer API-verified data
    COMBINE = "combine"                   # Combine both perspectives
    ASK_USER = "ask_user"                 # Ask user to clarify


@dataclass
class AgentResponse:
    """Response from a single agent."""
    agent_id: str
    agent_name: str
    agent_role: str  # knowledge, implementation, etc.
    content: str
    confidence: float = 0.8
    source_type: str = "agent"  # agent, api, knowledge_base
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DetectedConflict:
    """A conflict detected between agent responses."""
    conflict_type: ConflictType
    description: str
    agent1_id: str
    agent1_claim: str
    agent2_id: str
    agent2_claim: str
    resolution: Optional[str] = None
    resolution_strategy: Optional[ResolutionStrategy] = None


@dataclass
class SynthesizedResponse:
    """The final synthesized response."""
    content: str
    sources: List[str]  # List of agent IDs that contributed
    conflicts_resolved: List[DetectedConflict] = field(default_factory=list)
    follow_up_suggestions: List[str] = field(default_factory=list)
    confidence: float = 0.8
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "sources": self.sources,
            "conflicts_resolved": len(self.conflicts_resolved),
            "follow_up_suggestions": self.follow_up_suggestions,
            "confidence": self.confidence,
            "metadata": self.metadata,
        }


class ResponseSynthesizer:
    """Synthesizes responses from multiple agents into coherent output.

    Handles:
    - Merging complementary information
    - Detecting and resolving conflicts
    - Maintaining source attribution
    - Constructing coherent narratives
    - Generating follow-up suggestions
    """

    # Keywords indicating recommendations
    RECOMMENDATION_KEYWORDS = {
        "should", "recommend", "suggest", "best practice", "advised",
        "consider", "better to", "preferred", "optimal",
    }

    # Keywords indicating facts/data
    FACT_KEYWORDS = {
        "is", "are", "has", "have", "shows", "indicates", "configured",
        "currently", "status", "count", "total", "running",
    }

    def __init__(
        self,
        default_strategy: ResolutionStrategy = ResolutionStrategy.PREFER_KNOWLEDGE,
    ):
        self.default_strategy = default_strategy

    def synthesize(
        self,
        query: str,
        responses: List[AgentResponse],
        prefer_agent: Optional[str] = None,
    ) -> SynthesizedResponse:
        """Synthesize multiple agent responses into a unified response.

        Args:
            query: The original user query
            responses: List of responses from different agents
            prefer_agent: Optional agent ID to prefer in conflicts

        Returns:
            SynthesizedResponse with merged content
        """
        if not responses:
            return SynthesizedResponse(
                content="No agent responses to synthesize.",
                sources=[],
                confidence=0.0,
            )

        if len(responses) == 1:
            # Single response - no synthesis needed
            resp = responses[0]
            follow_ups = self._generate_follow_ups(query, resp.content)
            return SynthesizedResponse(
                content=resp.content,
                sources=[resp.agent_id],
                confidence=resp.confidence,
                follow_up_suggestions=follow_ups,
                metadata={"single_source": True},
            )

        # Detect conflicts
        conflicts = self._detect_conflicts(responses)

        # Resolve conflicts
        resolved_conflicts = []
        for conflict in conflicts:
            resolution = self._resolve_conflict(conflict, prefer_agent)
            conflict.resolution = resolution
            resolved_conflicts.append(conflict)

        # Merge responses
        merged_content = self._merge_responses(
            query, responses, resolved_conflicts
        )

        # Generate follow-ups
        follow_ups = self._generate_follow_ups(query, merged_content)

        # Calculate overall confidence
        confidence = self._calculate_confidence(responses, resolved_conflicts)

        return SynthesizedResponse(
            content=merged_content,
            sources=[r.agent_id for r in responses],
            conflicts_resolved=resolved_conflicts,
            follow_up_suggestions=follow_ups,
            confidence=confidence,
            metadata={
                "agent_count": len(responses),
                "conflict_count": len(conflicts),
            },
        )

    def _detect_conflicts(
        self,
        responses: List[AgentResponse],
    ) -> List[DetectedConflict]:
        """Detect conflicts between agent responses."""
        conflicts = []

        for i, resp1 in enumerate(responses):
            for resp2 in responses[i + 1:]:
                # Check for recommendation conflicts
                rec_conflict = self._check_recommendation_conflict(resp1, resp2)
                if rec_conflict:
                    conflicts.append(rec_conflict)

                # Check for factual conflicts
                fact_conflict = self._check_factual_conflict(resp1, resp2)
                if fact_conflict:
                    conflicts.append(fact_conflict)

                # Check for scope conflicts
                scope_conflict = self._check_scope_conflict(resp1, resp2)
                if scope_conflict:
                    conflicts.append(scope_conflict)

        return conflicts

    def _check_recommendation_conflict(
        self,
        resp1: AgentResponse,
        resp2: AgentResponse,
    ) -> Optional[DetectedConflict]:
        """Check if two responses have conflicting recommendations."""
        content1 = resp1.content.lower()
        content2 = resp2.content.lower()

        # Extract recommendations
        recs1 = self._extract_recommendations(resp1.content)
        recs2 = self._extract_recommendations(resp2.content)

        if not recs1 or not recs2:
            return None

        # Look for contradictions
        contradiction_pairs = [
            ("enable", "disable"),
            ("add", "remove"),
            ("increase", "decrease"),
            ("allow", "deny"),
            ("permit", "block"),
        ]

        for word1, word2 in contradiction_pairs:
            if any(word1 in r for r in recs1) and any(word2 in r for r in recs2):
                return DetectedConflict(
                    conflict_type=ConflictType.RECOMMENDATION,
                    description=f"Conflicting recommendations: {word1} vs {word2}",
                    agent1_id=resp1.agent_id,
                    agent1_claim=recs1[0] if recs1 else "",
                    agent2_id=resp2.agent_id,
                    agent2_claim=recs2[0] if recs2 else "",
                )

        return None

    def _check_factual_conflict(
        self,
        resp1: AgentResponse,
        resp2: AgentResponse,
    ) -> Optional[DetectedConflict]:
        """Check if two responses have conflicting facts."""
        # Extract numbers and compare
        numbers1 = re.findall(r'\b(\d+)\s+(?:device|network|client|port)', resp1.content.lower())
        numbers2 = re.findall(r'\b(\d+)\s+(?:device|network|client|port)', resp2.content.lower())

        if numbers1 and numbers2:
            # Check for significant differences
            for n1 in numbers1:
                for n2 in numbers2:
                    if int(n1) != int(n2) and abs(int(n1) - int(n2)) > 1:
                        return DetectedConflict(
                            conflict_type=ConflictType.FACTUAL,
                            description=f"Different counts reported: {n1} vs {n2}",
                            agent1_id=resp1.agent_id,
                            agent1_claim=f"Count: {n1}",
                            agent2_id=resp2.agent_id,
                            agent2_claim=f"Count: {n2}",
                        )

        # Check for status conflicts
        status_words = ["online", "offline", "active", "inactive", "up", "down"]
        for status in status_words:
            opposite = {
                "online": "offline", "offline": "online",
                "active": "inactive", "inactive": "active",
                "up": "down", "down": "up",
            }.get(status)

            if opposite:
                if status in resp1.content.lower() and opposite in resp2.content.lower():
                    return DetectedConflict(
                        conflict_type=ConflictType.FACTUAL,
                        description=f"Conflicting status: {status} vs {opposite}",
                        agent1_id=resp1.agent_id,
                        agent1_claim=f"Status: {status}",
                        agent2_id=resp2.agent_id,
                        agent2_claim=f"Status: {opposite}",
                    )

        return None

    def _check_scope_conflict(
        self,
        resp1: AgentResponse,
        resp2: AgentResponse,
    ) -> Optional[DetectedConflict]:
        """Check if responses have different scope."""
        # Scope indicators
        broad_scope = ["all", "every", "entire", "whole", "complete"]
        narrow_scope = ["specific", "particular", "only", "just", "single"]

        has_broad1 = any(word in resp1.content.lower() for word in broad_scope)
        has_broad2 = any(word in resp2.content.lower() for word in broad_scope)
        has_narrow1 = any(word in resp1.content.lower() for word in narrow_scope)
        has_narrow2 = any(word in resp2.content.lower() for word in narrow_scope)

        if (has_broad1 and has_narrow2) or (has_narrow1 and has_broad2):
            return DetectedConflict(
                conflict_type=ConflictType.SCOPE,
                description="Responses have different scope (broad vs narrow)",
                agent1_id=resp1.agent_id,
                agent1_claim="Broad scope" if has_broad1 else "Narrow scope",
                agent2_id=resp2.agent_id,
                agent2_claim="Broad scope" if has_broad2 else "Narrow scope",
            )

        return None

    def _extract_recommendations(self, content: str) -> List[str]:
        """Extract recommendation sentences from content."""
        sentences = re.split(r'[.!?]+', content)
        recommendations = []

        for sentence in sentences:
            sentence = sentence.strip()
            if any(word in sentence.lower() for word in self.RECOMMENDATION_KEYWORDS):
                recommendations.append(sentence)

        return recommendations

    def _resolve_conflict(
        self,
        conflict: DetectedConflict,
        prefer_agent: Optional[str] = None,
    ) -> str:
        """Resolve a detected conflict."""
        strategy = self.default_strategy

        # Override strategy based on conflict type
        if conflict.conflict_type == ConflictType.FACTUAL:
            strategy = ResolutionStrategy.PREFER_API_DATA
        elif conflict.conflict_type == ConflictType.RECOMMENDATION:
            strategy = ResolutionStrategy.PREFER_KNOWLEDGE

        # Override if specific agent preferred
        if prefer_agent:
            if prefer_agent == conflict.agent1_id:
                return conflict.agent1_claim
            elif prefer_agent == conflict.agent2_id:
                return conflict.agent2_claim

        conflict.resolution_strategy = strategy

        if strategy == ResolutionStrategy.PREFER_PRIMARY:
            return conflict.agent1_claim
        elif strategy == ResolutionStrategy.PREFER_KNOWLEDGE:
            # Assume agent1 is knowledge if role-based
            return conflict.agent1_claim
        elif strategy == ResolutionStrategy.PREFER_API_DATA:
            # Prefer the claim that looks more data-driven
            if re.search(r'\d+', conflict.agent2_claim):
                return conflict.agent2_claim
            return conflict.agent1_claim
        elif strategy == ResolutionStrategy.COMBINE:
            return f"{conflict.agent1_claim} (alternatively: {conflict.agent2_claim})"
        else:
            return conflict.agent1_claim

    def _merge_responses(
        self,
        query: str,
        responses: List[AgentResponse],
        conflicts: List[DetectedConflict],
    ) -> str:
        """Merge multiple responses into a coherent narrative."""
        # Group responses by role
        knowledge_responses = [r for r in responses if r.agent_role == "knowledge"]
        implementation_responses = [r for r in responses if r.agent_role == "implementation"]
        other_responses = [r for r in responses if r.agent_role not in ["knowledge", "implementation"]]

        sections = []

        # Start with knowledge/best practices
        if knowledge_responses:
            knowledge_content = self._extract_unique_content(knowledge_responses)
            if knowledge_content:
                sections.append(knowledge_content)

        # Add implementation/API data
        if implementation_responses:
            impl_content = self._extract_unique_content(implementation_responses)
            if impl_content:
                # Avoid duplicating content
                if sections:
                    sections.append("\n**Current Status:**\n" + impl_content)
                else:
                    sections.append(impl_content)

        # Add other responses
        for resp in other_responses:
            if resp.content not in "".join(sections):
                sections.append(resp.content)

        # Combine sections
        merged = "\n\n".join(sections)

        # Add conflict notes if any were resolved
        if conflicts:
            notes = []
            for conflict in conflicts:
                if conflict.resolution and conflict.resolution_strategy == ResolutionStrategy.COMBINE:
                    notes.append(f"Note: {conflict.description}")

            if notes:
                merged += "\n\n**Notes:**\n" + "\n".join(notes)

        return merged.strip()

    def _extract_unique_content(self, responses: List[AgentResponse]) -> str:
        """Extract unique content from similar responses."""
        if not responses:
            return ""

        if len(responses) == 1:
            return responses[0].content

        # Use the longest response as base, add unique parts from others
        responses_sorted = sorted(responses, key=lambda r: len(r.content), reverse=True)
        base_content = responses_sorted[0].content

        for resp in responses_sorted[1:]:
            unique_sentences = self._find_unique_sentences(resp.content, base_content)
            if unique_sentences:
                base_content += "\n\nAdditionally:\n" + "\n".join(unique_sentences)

        return base_content

    def _find_unique_sentences(self, content: str, base: str) -> List[str]:
        """Find sentences in content that aren't in base."""
        sentences = re.split(r'[.!?]+', content)
        base_lower = base.lower()
        unique = []

        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 20 and sentence.lower() not in base_lower:
                # Check if it's substantially different
                words = set(sentence.lower().split())
                base_words = set(base_lower.split())
                overlap = len(words & base_words) / max(len(words), 1)
                if overlap < 0.7:  # Less than 70% word overlap
                    unique.append(sentence)

        return unique[:3]  # Limit to 3 unique additions

    def _generate_follow_ups(self, query: str, content: str) -> List[str]:
        """Generate intelligent follow-up suggestions."""
        follow_ups = []

        query_lower = query.lower()
        content_lower = content.lower()

        # Based on query type
        if "how" in query_lower:
            follow_ups.append("Would you like me to apply these changes?")
        elif "what" in query_lower or "show" in query_lower:
            follow_ups.append("Would you like more details on any specific item?")
        elif "why" in query_lower:
            follow_ups.append("Would you like troubleshooting steps to address this?")

        # Based on content
        if "error" in content_lower or "issue" in content_lower:
            follow_ups.append("Would you like help troubleshooting this issue?")

        if "recommend" in content_lower or "should" in content_lower:
            follow_ups.append("Would you like step-by-step implementation instructions?")

        if "device" in content_lower and "offline" in content_lower:
            follow_ups.append("Would you like me to investigate why these devices are offline?")

        if "security" in content_lower:
            follow_ups.append("Would you like a security assessment of your configuration?")

        # Network-specific follow-ups
        if "vlan" in content_lower:
            follow_ups.append("Would you like to see the VLAN configuration details?")

        if "ssid" in content_lower or "wireless" in content_lower:
            follow_ups.append("Would you like to check client connections to this SSID?")

        # Limit to top 3 most relevant
        return follow_ups[:3]

    def _calculate_confidence(
        self,
        responses: List[AgentResponse],
        conflicts: List[DetectedConflict],
    ) -> float:
        """Calculate overall confidence in the synthesized response."""
        if not responses:
            return 0.0

        # Base confidence from agent responses
        avg_confidence = sum(r.confidence for r in responses) / len(responses)

        # Reduce for conflicts
        conflict_penalty = len(conflicts) * 0.05
        confidence = max(0.3, avg_confidence - conflict_penalty)

        # Boost for agreement
        if len(responses) > 1 and len(conflicts) == 0:
            confidence = min(1.0, confidence + 0.1)

        return round(confidence, 2)


class FollowUpGenerator:
    """Generates contextual follow-up suggestions based on conversation."""

    # Templates for different scenarios
    TEMPLATES = {
        "status_check": [
            "Would you like details on any specific {entity}?",
            "Should I check the {entity} health metrics?",
        ],
        "configuration": [
            "Would you like me to apply this configuration?",
            "Should I save these settings?",
        ],
        "troubleshooting": [
            "Would you like troubleshooting steps for this issue?",
            "Should I run diagnostics on the affected {entity}?",
        ],
        "best_practice": [
            "Would you like step-by-step implementation instructions?",
            "Should I audit your current configuration against these recommendations?",
        ],
    }

    def generate(
        self,
        query: str,
        response: str,
        entities: Optional[List[str]] = None,
        scenario: Optional[str] = None,
    ) -> List[str]:
        """Generate follow-up suggestions.

        Args:
            query: Original query
            response: Agent response
            entities: Detected entities (networks, devices, etc.)
            scenario: Detected scenario type

        Returns:
            List of follow-up suggestion strings
        """
        suggestions = []

        # Determine scenario if not provided
        if not scenario:
            scenario = self._detect_scenario(query, response)

        # Get templates for scenario
        templates = self.TEMPLATES.get(scenario, [])

        # Fill in templates with entities
        entity = entities[0] if entities else "devices"
        for template in templates[:2]:
            suggestion = template.format(entity=entity)
            suggestions.append(suggestion)

        # Add contextual suggestions
        if "error" in response.lower():
            suggestions.append("Would you like help resolving this error?")

        if "security" in query.lower() or "security" in response.lower():
            suggestions.append("Would you like a security assessment?")

        return suggestions[:3]

    def _detect_scenario(self, query: str, response: str) -> str:
        """Detect the conversation scenario."""
        combined = (query + " " + response).lower()

        if any(word in combined for word in ["status", "show", "list", "what"]):
            return "status_check"
        if any(word in combined for word in ["configure", "setup", "enable", "create"]):
            return "configuration"
        if any(word in combined for word in ["error", "issue", "problem", "fix", "troubleshoot"]):
            return "troubleshooting"
        if any(word in combined for word in ["best", "recommend", "should", "practice"]):
            return "best_practice"

        return "status_check"


# Singleton instances
_synthesizer: Optional[ResponseSynthesizer] = None
_follow_up_generator: Optional[FollowUpGenerator] = None


def get_synthesizer() -> ResponseSynthesizer:
    """Get singleton synthesizer."""
    global _synthesizer
    if _synthesizer is None:
        _synthesizer = ResponseSynthesizer()
    return _synthesizer


def get_follow_up_generator() -> FollowUpGenerator:
    """Get singleton follow-up generator."""
    global _follow_up_generator
    if _follow_up_generator is None:
        _follow_up_generator = FollowUpGenerator()
    return _follow_up_generator
