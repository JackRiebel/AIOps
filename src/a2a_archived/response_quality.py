"""A2A Response Quality Module.

Provides response validation, scoring, and quality assurance for agent outputs.
Implements quality gates to ensure users receive accurate, helpful responses.

Features:
- Response completeness scoring
- Relevance evaluation
- Hallucination detection for API data
- Actionability assessment
- Quality thresholds and gates
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class QualityDimension(str, Enum):
    """Dimensions for quality evaluation."""
    RELEVANCE = "relevance"          # How well response addresses the query
    COMPLETENESS = "completeness"    # Whether all aspects are covered
    ACCURACY = "accuracy"            # Factual correctness (when verifiable)
    ACTIONABILITY = "actionability"  # Can user act on the response
    CLARITY = "clarity"              # How clear and understandable
    CONSISTENCY = "consistency"      # Internal consistency


class QualityLevel(str, Enum):
    """Quality levels for response evaluation."""
    EXCELLENT = "excellent"    # Score >= 0.9
    GOOD = "good"             # Score >= 0.7
    ACCEPTABLE = "acceptable" # Score >= 0.5
    POOR = "poor"            # Score < 0.5


@dataclass
class QualityScore:
    """Detailed quality score for a response."""
    overall: float  # 0.0 - 1.0
    level: QualityLevel
    dimensions: Dict[QualityDimension, float] = field(default_factory=dict)
    feedback: List[str] = field(default_factory=list)
    improvements: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall": self.overall,
            "level": self.level.value,
            "dimensions": {k.value: v for k, v in self.dimensions.items()},
            "feedback": self.feedback,
            "improvements": self.improvements,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class ValidationResult:
    """Result of response validation."""
    is_valid: bool
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggested_corrections: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "issues": self.issues,
            "warnings": self.warnings,
            "suggested_corrections": self.suggested_corrections,
        }


class ResponseQualityScorer:
    """Scores and validates agent responses for quality assurance.

    Evaluates responses across multiple dimensions:
    - Relevance to the original query
    - Completeness of the answer
    - Actionability for the user
    - Clarity and readability
    - Accuracy (when verifiable against API data)
    """

    # Keywords indicating actionable content
    ACTION_KEYWORDS = {
        "configure", "enable", "disable", "create", "delete", "update",
        "navigate", "click", "select", "run", "execute", "apply",
        "set", "change", "modify", "add", "remove", "check", "verify",
    }

    # Keywords indicating explanation/knowledge
    EXPLANATION_KEYWORDS = {
        "because", "reason", "explains", "means", "indicates", "suggests",
        "typically", "generally", "best practice", "recommended", "should",
        "important", "note that", "keep in mind", "consider",
    }

    # Patterns that might indicate hallucination
    HALLUCINATION_PATTERNS = [
        r"serial number [A-Z0-9]{10,}",  # Made-up serial numbers
        r"IP address \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}",  # Random IPs
        r"MAC address [0-9a-fA-F:]{17}",  # Random MACs
    ]

    def __init__(
        self,
        min_acceptable_score: float = 0.5,
        weights: Optional[Dict[QualityDimension, float]] = None,
    ):
        self.min_acceptable_score = min_acceptable_score
        self.weights = weights or {
            QualityDimension.RELEVANCE: 0.30,
            QualityDimension.COMPLETENESS: 0.25,
            QualityDimension.ACCURACY: 0.20,
            QualityDimension.ACTIONABILITY: 0.15,
            QualityDimension.CLARITY: 0.10,
        }

    def score(
        self,
        query: str,
        response: str,
        context: Optional[Dict[str, Any]] = None,
        api_data: Optional[Dict[str, Any]] = None,
    ) -> QualityScore:
        """Score a response across multiple quality dimensions.

        Args:
            query: The original user query
            response: The agent's response text
            context: Optional conversation context
            api_data: Optional API data for accuracy verification

        Returns:
            QualityScore with detailed dimension scores
        """
        dimensions = {}
        feedback = []
        improvements = []

        # Score each dimension
        dimensions[QualityDimension.RELEVANCE] = self._score_relevance(
            query, response, feedback, improvements
        )
        dimensions[QualityDimension.COMPLETENESS] = self._score_completeness(
            query, response, context, feedback, improvements
        )
        dimensions[QualityDimension.ACCURACY] = self._score_accuracy(
            response, api_data, feedback, improvements
        )
        dimensions[QualityDimension.ACTIONABILITY] = self._score_actionability(
            query, response, feedback, improvements
        )
        dimensions[QualityDimension.CLARITY] = self._score_clarity(
            response, feedback, improvements
        )

        # Calculate weighted overall score
        overall = sum(
            dimensions[dim] * self.weights.get(dim, 0.2)
            for dim in dimensions
        )

        # Determine quality level
        if overall >= 0.9:
            level = QualityLevel.EXCELLENT
        elif overall >= 0.7:
            level = QualityLevel.GOOD
        elif overall >= 0.5:
            level = QualityLevel.ACCEPTABLE
        else:
            level = QualityLevel.POOR

        return QualityScore(
            overall=round(overall, 3),
            level=level,
            dimensions=dimensions,
            feedback=feedback,
            improvements=improvements,
        )

    def _score_relevance(
        self,
        query: str,
        response: str,
        feedback: List[str],
        improvements: List[str],
    ) -> float:
        """Score how relevant the response is to the query."""
        query_lower = query.lower()
        response_lower = response.lower()

        # Extract key terms from query
        query_words = set(re.findall(r'\b\w{4,}\b', query_lower))
        query_words -= {"what", "when", "where", "which", "that", "this", "have", "does"}

        if not query_words:
            return 0.8  # Can't evaluate, assume decent

        # Check how many query terms appear in response
        matches = sum(1 for word in query_words if word in response_lower)
        term_coverage = matches / len(query_words) if query_words else 0

        # Check for question-answer alignment
        is_question = "?" in query
        has_answer_structure = any(
            phrase in response_lower
            for phrase in ["is", "are", "can", "will", "the answer", "to do this"]
        )

        score = term_coverage * 0.6

        if is_question and has_answer_structure:
            score += 0.3
        elif not is_question:
            score += 0.2

        # Check for direct addressing
        if any(word in response_lower for word in ["you asked", "regarding", "about your"]):
            score += 0.1

        score = min(1.0, score)

        if score < 0.5:
            feedback.append("Response may not fully address the query")
            improvements.append("Ensure response directly answers what was asked")

        return round(score, 3)

    def _score_completeness(
        self,
        query: str,
        response: str,
        context: Optional[Dict[str, Any]],
        feedback: List[str],
        improvements: List[str],
    ) -> float:
        """Score how complete the response is."""
        response_lower = response.lower()

        # Base score on response length (longer isn't always better, but too short is bad)
        word_count = len(response.split())

        if word_count < 10:
            length_score = 0.2
            feedback.append("Response is very brief")
            improvements.append("Provide more detail and context")
        elif word_count < 30:
            length_score = 0.5
        elif word_count < 100:
            length_score = 0.8
        elif word_count < 300:
            length_score = 1.0
        else:
            length_score = 0.9  # Very long might be verbose

        # Check for structured content (lists, steps, etc.)
        has_structure = any([
            re.search(r'\d+\.\s', response),  # Numbered list
            re.search(r'[-•]\s', response),    # Bullet list
            ":" in response,                    # Labels
            response.count("\n") > 2,          # Multiple paragraphs
        ])

        structure_score = 0.2 if has_structure else 0

        # Check if multiple aspects are covered for complex queries
        query_aspects = len(re.findall(r'\b(and|or|also|both)\b', query.lower()))
        if query_aspects > 0:
            # Query asks about multiple things
            response_sections = response.count("\n\n") + response.count(":")
            if response_sections >= query_aspects:
                aspect_score = 0.2
            else:
                aspect_score = 0.1
                improvements.append("Address all parts of the multi-part query")
        else:
            aspect_score = 0.1

        score = min(1.0, length_score * 0.5 + structure_score + aspect_score + 0.2)

        return round(score, 3)

    def _score_accuracy(
        self,
        response: str,
        api_data: Optional[Dict[str, Any]],
        feedback: List[str],
        improvements: List[str],
    ) -> float:
        """Score accuracy of the response, especially against API data."""
        if not api_data:
            # Can't verify accuracy without reference data
            # Check for potential hallucination patterns
            hallucination_risk = 0
            for pattern in self.HALLUCINATION_PATTERNS:
                if re.search(pattern, response):
                    hallucination_risk += 0.1

            if hallucination_risk > 0:
                feedback.append("Response contains specific data that couldn't be verified")
                improvements.append("Ensure all specific values come from actual API calls")

            return max(0.6, 1.0 - hallucination_risk)

        # Verify response against API data
        accuracy_score = 1.0
        issues_found = 0

        # Check for device/network names
        if "devices" in api_data:
            device_names = {d.get("name", "").lower() for d in api_data["devices"]}
            mentioned_devices = re.findall(r'device[s]?\s+["\']?(\w+)["\']?', response.lower())
            for device in mentioned_devices:
                if device not in device_names and device not in {"the", "all", "each", "any"}:
                    issues_found += 1

        # Check for network names
        if "networks" in api_data:
            network_names = {n.get("name", "").lower() for n in api_data["networks"]}
            mentioned_networks = re.findall(r'network[s]?\s+["\']?(\w+)["\']?', response.lower())
            for network in mentioned_networks:
                if network not in network_names and network not in {"the", "all", "each", "your"}:
                    issues_found += 1

        # Check for counts
        if "device_count" in api_data:
            actual_count = api_data["device_count"]
            mentioned_counts = re.findall(r'(\d+)\s+device', response.lower())
            for count_str in mentioned_counts:
                if abs(int(count_str) - actual_count) > 1:
                    issues_found += 1
                    feedback.append(f"Device count mismatch: mentioned {count_str}, actual {actual_count}")

        accuracy_score = max(0.3, 1.0 - (issues_found * 0.15))

        if issues_found > 0:
            improvements.append("Verify data accuracy against actual API responses")

        return round(accuracy_score, 3)

    def _score_actionability(
        self,
        query: str,
        response: str,
        feedback: List[str],
        improvements: List[str],
    ) -> float:
        """Score how actionable the response is."""
        query_lower = query.lower()
        response_lower = response.lower()

        # Determine if query expects actionable response
        expects_action = any(
            word in query_lower
            for word in ["how", "configure", "setup", "enable", "fix", "create", "change"]
        )

        # Count action keywords in response
        action_count = sum(
            1 for word in self.ACTION_KEYWORDS
            if word in response_lower
        )

        # Check for step-by-step instructions
        has_steps = bool(re.search(r'step\s*\d|first.*then|1\.\s|2\.\s', response_lower))

        # Check for specific instructions
        has_specifics = any([
            re.search(r'navigate to|go to|click on|select', response_lower),
            re.search(r'api endpoint|url|path', response_lower),
            re.search(r'run the command|execute|use the', response_lower),
        ])

        if expects_action:
            # Higher bar for queries expecting action
            base_score = min(1.0, action_count * 0.15 + 0.2)
            if has_steps:
                base_score += 0.25
            if has_specifics:
                base_score += 0.2

            if base_score < 0.6:
                feedback.append("Response lacks actionable guidance")
                improvements.append("Include specific steps or commands the user can follow")
        else:
            # Lower bar for informational queries
            explanation_count = sum(
                1 for word in self.EXPLANATION_KEYWORDS
                if word in response_lower
            )
            base_score = min(1.0, 0.5 + explanation_count * 0.1 + action_count * 0.05)

        return round(min(1.0, base_score), 3)

    def _score_clarity(
        self,
        response: str,
        feedback: List[str],
        improvements: List[str],
    ) -> float:
        """Score clarity and readability of the response."""
        # Sentence length analysis
        sentences = re.split(r'[.!?]+', response)
        sentences = [s.strip() for s in sentences if s.strip()]

        if not sentences:
            return 0.3

        avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences)

        # Ideal sentence length is 15-25 words
        if 10 <= avg_sentence_length <= 25:
            length_score = 1.0
        elif avg_sentence_length < 10:
            length_score = 0.7  # Too choppy
        elif avg_sentence_length <= 35:
            length_score = 0.8
        else:
            length_score = 0.5  # Too long
            feedback.append("Some sentences are very long and complex")
            improvements.append("Break down long sentences for clarity")

        # Check for formatting
        has_formatting = any([
            "**" in response or "__" in response,  # Bold
            "```" in response,  # Code blocks
            response.count("\n") > 1,  # Line breaks
            re.search(r'^\s*[-•]\s', response, re.MULTILINE),  # Lists
        ])
        formatting_score = 0.2 if has_formatting else 0

        # Check for jargon explanation
        technical_terms = re.findall(r'\b(VLAN|SSID|ACL|QoS|MTU|BGP|OSPF)\b', response, re.IGNORECASE)
        if technical_terms:
            explanations = response.lower().count("means") + response.lower().count("which is")
            if explanations >= len(set(technical_terms)) * 0.3:
                jargon_score = 0.1
            else:
                jargon_score = 0
                if len(set(technical_terms)) > 3:
                    improvements.append("Consider explaining technical terms for clarity")
        else:
            jargon_score = 0.1

        score = length_score * 0.6 + formatting_score + jargon_score + 0.1

        return round(min(1.0, score), 3)

    def validate(
        self,
        response: str,
        api_data: Optional[Dict[str, Any]] = None,
        required_elements: Optional[List[str]] = None,
    ) -> ValidationResult:
        """Validate a response for correctness and completeness.

        Args:
            response: The agent's response text
            api_data: Optional API data for verification
            required_elements: Optional list of elements that must be present

        Returns:
            ValidationResult with issues and suggestions
        """
        issues = []
        warnings = []
        corrections = []

        # Check for empty or too-short response
        if not response or len(response.strip()) < 10:
            issues.append("Response is empty or too short")
            return ValidationResult(is_valid=False, issues=issues)

        # Check for required elements
        if required_elements:
            response_lower = response.lower()
            for element in required_elements:
                if element.lower() not in response_lower:
                    warnings.append(f"Missing expected element: {element}")

        # Check for potential errors in response
        error_patterns = [
            (r"error|failed|exception", "Response mentions errors"),
            (r"unable to|cannot|couldn't", "Response indicates inability"),
            (r"unknown|not found|doesn't exist", "Response mentions missing data"),
        ]

        for pattern, message in error_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                warnings.append(message)

        # Validate against API data if provided
        if api_data:
            validation_issues = self._validate_against_api(response, api_data)
            issues.extend(validation_issues)

        # Check for truncation
        if response.rstrip().endswith(("...", "…")) or len(response) > 4000:
            warnings.append("Response may be truncated")
            corrections.append("Request a more concise response or pagination")

        is_valid = len(issues) == 0

        return ValidationResult(
            is_valid=is_valid,
            issues=issues,
            warnings=warnings,
            suggested_corrections=corrections,
        )

    def _validate_against_api(
        self,
        response: str,
        api_data: Dict[str, Any],
    ) -> List[str]:
        """Validate response against actual API data."""
        issues = []

        # Check device counts
        if "devices" in api_data:
            actual_count = len(api_data["devices"])
            count_matches = re.findall(r'(\d+)\s+(?:device|ap|switch|router)', response.lower())
            for match in count_matches:
                if abs(int(match) - actual_count) > 2:
                    issues.append(
                        f"Incorrect device count: response says {match}, actual is {actual_count}"
                    )

        # Check status claims
        if "status" in api_data:
            actual_status = api_data["status"].lower()
            if "online" in response.lower() and actual_status == "offline":
                issues.append("Response claims online but device is offline")
            elif "offline" in response.lower() and actual_status == "online":
                issues.append("Response claims offline but device is online")

        return issues

    def meets_threshold(self, score: QualityScore) -> bool:
        """Check if a score meets the minimum acceptable threshold."""
        return score.overall >= self.min_acceptable_score

    def get_improvement_summary(self, score: QualityScore) -> str:
        """Get a summary of suggested improvements."""
        if score.level == QualityLevel.EXCELLENT:
            return "Response quality is excellent. No improvements needed."

        if not score.improvements:
            return f"Response quality is {score.level.value}."

        return f"Response quality is {score.level.value}. Suggestions:\n" + \
               "\n".join(f"- {imp}" for imp in score.improvements)


class QualityGate:
    """Quality gate that enforces minimum quality standards.

    Can be used to automatically request response improvements
    when quality falls below threshold.
    """

    def __init__(
        self,
        scorer: Optional[ResponseQualityScorer] = None,
        min_score: float = 0.5,
        required_dimensions: Optional[Dict[QualityDimension, float]] = None,
    ):
        self.scorer = scorer or ResponseQualityScorer()
        self.min_score = min_score
        self.required_dimensions = required_dimensions or {}

    def check(
        self,
        query: str,
        response: str,
        context: Optional[Dict[str, Any]] = None,
        api_data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, QualityScore, Optional[str]]:
        """Check if response passes the quality gate.

        Args:
            query: Original query
            response: Agent response
            context: Optional context
            api_data: Optional API data for verification

        Returns:
            Tuple of (passed, score, improvement_request)
            If passed is False, improvement_request contains suggestions
        """
        score = self.scorer.score(query, response, context, api_data)

        # Check overall score
        if score.overall < self.min_score:
            improvement_request = self._build_improvement_request(score)
            return False, score, improvement_request

        # Check required dimension thresholds
        for dim, threshold in self.required_dimensions.items():
            if score.dimensions.get(dim, 0) < threshold:
                improvement_request = self._build_improvement_request(
                    score, focus_dimension=dim
                )
                return False, score, improvement_request

        return True, score, None

    def _build_improvement_request(
        self,
        score: QualityScore,
        focus_dimension: Optional[QualityDimension] = None,
    ) -> str:
        """Build a request for improved response."""
        lines = ["The response quality needs improvement."]

        if focus_dimension:
            lines.append(f"Focus area: {focus_dimension.value}")
            dim_score = score.dimensions.get(focus_dimension, 0)
            lines.append(f"Current score: {dim_score:.2f}")

        if score.improvements:
            lines.append("\nSpecific improvements needed:")
            for imp in score.improvements[:3]:
                lines.append(f"- {imp}")

        lines.append("\nPlease provide an improved response addressing these points.")

        return "\n".join(lines)


# Singleton instances
_quality_scorer: Optional[ResponseQualityScorer] = None
_quality_gate: Optional[QualityGate] = None


def get_quality_scorer() -> ResponseQualityScorer:
    """Get singleton quality scorer."""
    global _quality_scorer
    if _quality_scorer is None:
        _quality_scorer = ResponseQualityScorer()
    return _quality_scorer


def get_quality_gate() -> QualityGate:
    """Get singleton quality gate."""
    global _quality_gate
    if _quality_gate is None:
        _quality_gate = QualityGate()
    return _quality_gate
