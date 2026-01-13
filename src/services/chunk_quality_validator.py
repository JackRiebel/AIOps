"""Chunk quality validation service.

Validates content chunks before storage to ensure only high-quality,
useful content is added to the knowledge base. Rejects navigation,
boilerplate, and low-information content.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class ValidationResult:
    """Result of chunk validation."""
    is_valid: bool
    quality_score: float  # 0.0-1.0
    rejection_reasons: List[str] = field(default_factory=list)


# =============================================================================
# Rejection Patterns - Auto-reject if ANY match
# =============================================================================

REJECTION_PATTERNS = [
    # Navigation/boilerplate
    (r"^(skip to|jump to|go to)\s+(main\s+)?content", "Navigation link"),
    (r"^(table of contents|toc|menu|navigation|nav)\s*$", "Navigation element"),
    (r"^(previous|next|back|forward|home|top)(\s+page)?(\s+\|)?$", "Navigation link"),
    (r"^(copyright|©|\(c\)|all rights reserved)", "Copyright notice"),
    (r"^(privacy policy|terms of (use|service)|legal)", "Legal boilerplate"),

    # Cookie/consent banners
    (r"(accept|reject|manage)\s+(all\s+)?cookies", "Cookie consent"),
    (r"cookie\s+(settings|preferences|policy|notice)", "Cookie notice"),
    (r"we use cookies", "Cookie notice"),

    # Login/auth forms
    (r"^(sign in|log ?in|register|subscribe|sign up|create account)", "Login form"),
    (r"^(username|password|email|enter your|forgot password)", "Form field"),
    (r"^(remember me|stay signed in|keep me logged)", "Form field"),

    # Social/sharing
    (r"^(share|tweet|post|follow us|like us)", "Social widget"),
    (r"(facebook|twitter|linkedin|instagram)\s*(share|follow)", "Social widget"),

    # Pagination/UI elements
    (r"^(page \d+|showing \d+|results? \d+)", "Pagination"),
    (r"^(\d+\s*[-–]\s*\d+\s+of\s+\d+)", "Pagination"),
    (r"^(first|last|prev|next)\s*(\||$)", "Pagination"),
    (r"^\d+(\s*,\s*\d+){4,}$", "Number list"),
    (r"^(\d+\.?\s*){5,}$", "Number sequence"),

    # Empty/whitespace - use \A and \Z anchors to match entire string only
    (r"\A\s*\Z", "Empty content"),
    (r"\A[\s\n\r\t]+\Z", "Whitespace only"),

    # Very short (less than 30 meaningful chars) - entire content must be short
    (r"\A.{0,29}\Z", "Too short"),

    # Repetitive content
    (r"(.{15,})\1{2,}", "Repetitive content"),

    # Common web garbage
    (r"^(loading|please wait|click here|read more|learn more)\.*$", "UI element"),
    (r"^(back to top|scroll to top|↑|↓|→|←)\s*$", "UI element"),
    (r"^(print|download|save|email)\s*(this)?\s*(page|article|document)?$", "UI element"),
    (r"^\[?\s*(image|photo|figure|chart|graph|diagram)\s*\]?$", "Image placeholder"),
    (r"^advertisement\s*$", "Advertisement"),
    (r"^sponsored\s*(content|post)?$", "Sponsored content"),

    # Headers without content - reject content that is ONLY a header (use \A\Z for whole string)
    (r"\A\s*#{1,6}\s*.{0,10}\s*\Z", "Empty header"),
    (r"\A\s*#{1,6}\s+[A-Z][^.!?\n]{0,50}\s*\Z", "Header only - no content"),

    # Cisco-specific noise
    (r"^cisco\s+(confidential|proprietary|internal)\s*$", "Classification label"),
    (r"^(draft|preliminary|for review)\s*$", "Draft label"),

    # Link lists (more than 3 URLs in content)
    (r"(https?://[^\s\)]+[\s\n]*){4,}", "Link list"),

    # Date-heavy content (lists of dates without substance)
    (r"(\d{1,2}/\w{3}/\d{4}[\s\n]*){3,}", "Date list"),
    (r"(\d{1,2}-\w{3}-\d{4}[\s\n]*){3,}", "Date list"),

    # UI Elements - Checkbox lists
    (r"(\-\s*\[[\sx]\]\s*[^\n]+\n){3,}", "Checkbox list"),
    (r"(\*\s*\-\s*\[[\sx]\]\s*[^\n]+\n){3,}", "Checkbox list"),

    # Language selector lists (multiple language names in sequence)
    (r"((Arabic|Português|Français|中文|日本語|한국어|Deutsch|Italiano|Español|Nederlands)[^\n]*\n){3,}", "Language selector"),

    # Software version lists (IOS-XE release trains)
    (r"((IOSXE-\d+\.\d+|Gibraltar-\d+\.\d+|Fuji-\d+\.\d+|Dublin-\d+\.\d+|Cupertino-\d+\.\d+|Bengaluru-\d+\.\d+|Amsterdam-\d+\.\d+)[^\n]*\n){4,}", "Software version list"),

    # Cookie consent / privacy dialogs
    (r"(cookie|consent|privacy).*(preference|setting|policy|accept|reject)", "Cookie/privacy dialog"),
    (r"strictly necessary cookies", "Cookie consent"),
    (r"performance cookies|targeting cookies|functional cookies", "Cookie consent"),
    (r"powered by onetrust", "Cookie consent widget"),

    # Community forum content (not documentation)
    (r"Board:\s*\[[^\]]+\].*Created by:.*Posted:", "Community forum content"),
    (r"Board:\s*\[[^\]]+\]\s*Created by:", "Community forum content"),

    # Filter/search UI elements (must be standalone or in UI context)
    (r"^\s*(reset all|no results found|load more results?)\s*$", "Search/filter UI"),
    (r"switch to (filter|search) view", "Search UI"),
    (r"^\s*show\s+\d+\s+results?\s*$", "Results count UI"),

    # Image placeholders (sequential numbered images without context)
    (r"(\!\[Image \d+\]\([^\)]+\)\s*\n){3,}", "Multiple image placeholders"),

    # Tracking/analytics script markers
    (r"google[_-]?analytics|gtag|ga\.js", "Analytics tracking"),
    (r"tracking[_-]?pixel|beacon\.js", "Tracking element"),

    # Model/product selection lists (UI elements)
    (r"(Select Model|Software Type|Software Version)\s*\n\s*\*", "Product selector UI"),

    # Product model lists - REMOVED for datasheets, handled separately
    # These patterns were incorrectly rejecting valid datasheet content
    # (r"(C\d{4}[A-Z0-9\-]+\s*\n){4,}", "Product model list"),
    # (r"(\*\s*C\d{4}[A-Z0-9\-]+\s*\n){3,}", "Product model bullet list"),

    # Support page navigation elements
    (r"Downloads\s+(Home|Select)?\s*\n.*Software Type", "Support downloads page"),
    (r"All Downloads for this Product", "Support page navigation"),
    (r"My Notifications.*Sign In.*Register", "Account/auth navigation"),

    # Version/release selector content
    (r"(Suggested|Latest|All Releases)\s*\n.*Version\s*\d", "Release selector"),

    # Breadcrumb navigation
    (r"(Products|Support|Documentation)\s*>\s*(Products|Support|Documentation)", "Breadcrumb navigation"),

    # Table of contents without content (just link lists)
    (r"(\[[^\]]+\]\(#[^\)]+\)\s*\n){5,}", "Table of contents links only"),

    # Empty definition lists (term : empty or just link)
    (r"([A-Z][A-Za-z\s]+:\s*\n){4,}", "Empty definition list"),

    # UI button/link sequences
    (r"(View|Download|Share|Print|Email|Export)\s*(View|Download|Share|Print|Email|Export)", "UI button sequence"),

    # Cisco website boilerplate (appears in Jina Reader output)
    (r"^###\s*Available Languages\s*\n+###\s*Download Options", "Cisco page boilerplate"),
    (r"Skip to (content|search|footer)", "Skip links"),
    (r"Cisco\.com Worldwide", "Cisco site navigation"),
    (r"\[Products & Services\].*\[Solutions\].*\[Support\]", "Cisco navbar"),

    # Bias-free language boilerplate (appears at start of many Cisco docs)
    (r"^\s*##?\s*Bias-Free Language\s*\n.*documentation set.*strives to use bias-free", "Bias-free language boilerplate"),

    # Footer content
    (r"Our experts recommend.*Learn more", "Footer recommendations"),
    (r"Your organization, your operational needs", "Footer promo"),
]

# Compiled patterns for performance
_COMPILED_PATTERNS = [(re.compile(p, re.I | re.MULTILINE), reason) for p, reason in REJECTION_PATTERNS]


# =============================================================================
# Stop Words (for information density calculation)
# =============================================================================

STOP_WORDS: Set[str] = {
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
    'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'to',
    'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
    'again', 'further', 'once', 'here', 'there', 'where', 'why', 'how',
    'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
    'very', 'can', 'will', 'just', 'should', 'now', 'also', 'as',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'is', 'are', 'was', 'were', 'am', 'of', 'this', 'that', 'these',
    'those', 'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i', 'me',
    'him', 'her', 'them', 'us', 'my', 'your', 'his', 'our', 'their',
    'what', 'which', 'who', 'whom', 'whose', 'would', 'could', 'might',
}


# =============================================================================
# Technical Terms (boost score for presence)
# =============================================================================

CISCO_TERMS: Set[str] = {
    # Products
    'meraki', 'catalyst', 'nexus', 'isr', 'asr', 'firepower', 'asa',
    'ise', 'dnac', 'dna', 'center', 'thousandeyes', 'webex', 'umbrella',
    'duo', 'anyconnect', 'sd-wan', 'viptela', 'expressway', 'cucm',

    # Device types
    'switch', 'router', 'firewall', 'access point', 'ap', 'controller',
    'gateway', 'appliance', 'chassis', 'module', 'blade', 'stack',

    # Meraki specific
    'mx', 'ms', 'mr', 'mv', 'mg', 'mt', 'sm', 'z1', 'z3',

    # Protocols
    'vlan', 'bgp', 'ospf', 'eigrp', 'rip', 'stp', 'rstp', 'pvst',
    'lacp', 'pagp', 'hsrp', 'vrrp', 'glbp', 'dhcp', 'dns', 'ntp',
    'snmp', 'ssh', 'telnet', 'radius', 'tacacs', 'ldap', 'saml',
    'oauth', 'api', 'rest', 'http', 'https', 'ssl', 'tls', 'ipsec',
    'vpn', 'mpls', 'qos', 'cos', 'dscp', 'acl', 'nat', 'pat',

    # Technologies
    'poe', 'uplink', 'downlink', 'trunk', 'access', 'port', 'interface',
    'bandwidth', 'throughput', 'latency', 'jitter', 'packet', 'frame',
    'ethernet', 'gigabit', 'fiber', 'copper', 'sfp', 'qsfp', 'console',
    'management', 'data', 'voice', 'video', 'wireless', 'wired',

    # Config/operations
    'configure', 'configuration', 'setup', 'install', 'upgrade', 'firmware',
    'provisioning', 'deployment', 'troubleshoot', 'debug', 'monitor',
    'backup', 'restore', 'failover', 'redundancy', 'high availability',
    'clustering', 'stacking', 'load balancing', 'policy', 'rule',
}


# =============================================================================
# ChunkQualityValidator Class
# =============================================================================

class ChunkQualityValidator:
    """Validates chunk quality before storage."""

    # Document types that use specialized quality scoring
    STRUCTURED_DOC_TYPES = {'datasheet', 'spec', 'api_spec', 'cli_reference'}

    def __init__(
        self,
        min_length: int = 50,
        min_quality_score: float = 0.3,
    ):
        """Initialize validator.

        Args:
            min_length: Minimum content length in characters.
            min_quality_score: Minimum quality score to pass validation.
        """
        self.min_length = min_length
        self.min_quality_score = min_quality_score

    def validate_chunk(
        self,
        content: str,
        doc_type: Optional[str] = None,
    ) -> ValidationResult:
        """Validate a chunk for quality.

        Args:
            content: Chunk content text.
            doc_type: Optional document type for context.

        Returns:
            ValidationResult with is_valid, quality_score, and rejection_reasons.
        """
        rejection_reasons = []
        is_structured = doc_type in self.STRUCTURED_DOC_TYPES if doc_type else False

        # Patterns to skip for structured documents (datasheets, specs)
        # These patterns incorrectly reject valid technical content
        structured_skip_reasons = {
            "Number list",  # Specs often have numeric lists
            "Number sequence",
            "Header only - no content",  # Tables may have headers
            "Empty definition list",  # Specs use key-value format
            "Copyright notice",  # Datasheets have copyright on every page as boilerplate
            "Classification label",  # Cisco docs often have "Cisco Confidential" etc.
            "Repetitive content",  # Spec tables have repeated structure (headers, model names)
        }

        # Check rejection patterns first (auto-reject)
        for pattern, reason in _COMPILED_PATTERNS:
            if pattern.search(content):
                # Skip certain rejections for structured documents
                if is_structured and reason in structured_skip_reasons:
                    continue
                rejection_reasons.append(reason)
                # Return early for obvious garbage
                return ValidationResult(
                    is_valid=False,
                    quality_score=0.0,
                    rejection_reasons=rejection_reasons,
                )

        # Check minimum token count (stricter than char length)
        words = content.split()
        token_count = len(words)

        # For structured documents (datasheets), allow smaller chunks - tables are dense
        min_tokens = 15 if is_structured else 30
        if token_count < min_tokens:
            rejection_reasons.append(f"Too few tokens: {token_count} (min {min_tokens})")
            return ValidationResult(
                is_valid=False,
                quality_score=0.0,
                rejection_reasons=rejection_reasons,
            )

        # Check for meaningful prose (not just headers/formatting)
        # Strip markdown formatting and check remaining content
        prose_content = re.sub(r'^#{1,6}\s+', '', content, flags=re.MULTILINE)  # Remove headers
        prose_content = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', prose_content)  # Simplify links
        prose_content = re.sub(r'\*+', '', prose_content)  # Remove bold/italic
        prose_words = prose_content.split()

        # For structured documents (datasheets), be more lenient - tables have valuable data
        min_prose_words = 10 if is_structured else 20
        if len(prose_words) < min_prose_words:
            rejection_reasons.append(f"Insufficient prose content: {len(prose_words)} words")
            return ValidationResult(
                is_valid=False,
                quality_score=0.1,
                rejection_reasons=rejection_reasons,
            )

        # Calculate quality score
        quality_score = self.calculate_quality_score(content, doc_type)

        # Check minimum thresholds
        if quality_score < self.min_quality_score:
            rejection_reasons.append(f"Quality score too low: {quality_score:.2f}")
            return ValidationResult(
                is_valid=False,
                quality_score=quality_score,
                rejection_reasons=rejection_reasons,
            )

        return ValidationResult(
            is_valid=True,
            quality_score=quality_score,
            rejection_reasons=[],
        )

    def calculate_quality_score(
        self,
        content: str,
        doc_type: Optional[str] = None,
    ) -> float:
        """Calculate quality score for content.

        Args:
            content: Chunk content text.
            doc_type: Optional document type for context.

        Returns:
            Quality score from 0.0 to 1.0.
        """
        # Use specialized scoring for structured documents
        is_structured = doc_type in self.STRUCTURED_DOC_TYPES if doc_type else False

        # Also detect datasheet content from content patterns
        if not is_structured and self._looks_like_structured_content(content):
            is_structured = True

        scores = {}

        # 1. Content Length Score (15%)
        scores['length'] = self._score_length(content)

        # 2. Information Density Score (25%)
        scores['density'] = self._score_information_density(content)

        # 3. Entity/Technical Term Presence (20%)
        scores['entities'] = self._score_entity_presence(content)

        # 4. Structural Quality (15%) - adjusted for structured docs
        scores['structure'] = self._score_structure(content, is_structured)

        # 5. Readability (10%) - adjusted for structured docs
        scores['readability'] = self._score_readability(content, is_structured)

        # 6. Self-Duplication Check (15%)
        scores['uniqueness'] = self._score_uniqueness(content)

        # Weighted average - adjust weights for structured content
        if is_structured:
            # For datasheets/specs, weight entities and density higher
            weights = {
                'length': 0.10,
                'density': 0.20,
                'entities': 0.35,  # Technical terms are key
                'structure': 0.10,
                'readability': 0.10,
                'uniqueness': 0.15,
            }
        else:
            weights = {
                'length': 0.15,
                'density': 0.25,
                'entities': 0.20,
                'structure': 0.15,
                'readability': 0.10,
                'uniqueness': 0.15,
            }

        total_score = sum(scores[k] * weights[k] for k in scores)

        return min(1.0, max(0.0, total_score))

    def _looks_like_structured_content(self, content: str) -> bool:
        """Detect if content appears to be structured (datasheet, spec table).

        Args:
            content: Content to analyze.

        Returns:
            True if content looks like structured/tabular content.
        """
        content_lower = content.lower()

        # Datasheet patterns
        structured_indicators = [
            r'\bspecification[s]?\b',
            r'\bpart\s*number\b',
            r'\bmodel\s*number\b',
            r'\bdatasheet\b',
            r'\b(watts?|gbps|mbps|ghz|mhz)\b',  # Units
            r'\bdimensions?\b.*\b(mm|cm|inch)',
            r'\btemperature\b.*\b(°|celsius|fahrenheit)',
            r'\*\*[^*]+\*\*:\s*\S',  # Bold key-value pattern
            r'-\s+\*\*[^*]+\*\*:',  # List with bold keys
            r'^\s*-\s+[A-Z][^:]+:\s*\S',  # List items with colons
        ]

        matches = sum(1 for pattern in structured_indicators
                     if re.search(pattern, content_lower, re.MULTILINE))

        return matches >= 2

    def _score_length(self, content: str) -> float:
        """Score based on content length."""
        clean_content = content.strip()
        length = len(clean_content)

        if length < 50:
            return 0.0
        elif length < 100:
            return 0.3
        elif length < 200:
            return 0.6
        elif length < 500:
            return 0.9
        elif length < 2000:
            return 1.0
        elif length < 5000:
            return 0.8
        else:
            return 0.6  # Very long chunks may be less focused

    def _score_information_density(self, content: str) -> float:
        """Score based on ratio of meaningful words to total."""
        words = re.findall(r'\b\w+\b', content.lower())

        if not words:
            return 0.0

        # Count non-stop words
        meaningful_words = [w for w in words if w not in STOP_WORDS and len(w) > 2]
        density = len(meaningful_words) / len(words)

        # Scale: 0.3 density = 0.5 score, 0.6 density = 1.0 score
        return min(1.0, max(0.0, (density - 0.2) / 0.4))

    def _score_entity_presence(self, content: str) -> float:
        """Score based on presence of Cisco-related terms."""
        content_lower = content.lower()
        words = set(re.findall(r'\b\w+\b', content_lower))

        # Check for technical terms
        matches = words.intersection(CISCO_TERMS)

        if not matches:
            return 0.3  # Baseline - might still be useful
        elif len(matches) == 1:
            return 0.6
        elif len(matches) <= 3:
            return 0.8
        else:
            return 1.0

    def _score_structure(self, content: str, is_structured: bool = False) -> float:
        """Score based on structural quality (sentences, paragraphs).

        Args:
            content: Content to score.
            is_structured: If True, use lenient scoring for datasheets/specs.
        """
        if is_structured:
            # For structured content, check for list items, key-value pairs
            list_items = len(re.findall(r'^\s*[-*•]\s+', content, re.MULTILINE))
            key_value_pairs = len(re.findall(r'\*\*[^*]+\*\*:', content))
            colon_pairs = len(re.findall(r'^\s*[A-Z][^:]+:\s*\S', content, re.MULTILINE))

            structure_elements = list_items + key_value_pairs + colon_pairs

            if structure_elements >= 5:
                return 1.0
            elif structure_elements >= 3:
                return 0.8
            elif structure_elements >= 1:
                return 0.6
            else:
                return 0.4  # Still give some credit

        # Standard prose scoring
        # Count sentences
        sentences = re.split(r'[.!?]+', content)
        valid_sentences = [s.strip() for s in sentences if len(s.strip().split()) >= 3]

        if not valid_sentences:
            return 0.2

        # Check for multiple sentences
        if len(valid_sentences) == 1:
            return 0.5
        elif len(valid_sentences) <= 3:
            return 0.7
        else:
            return 1.0

    def _score_readability(self, content: str, is_structured: bool = False) -> float:
        """Score based on readability (not boilerplate/UI).

        Args:
            content: Content to score.
            is_structured: If True, use lenient scoring for datasheets/specs.
        """
        content_lower = content.lower()

        # Check for various boilerplate indicators
        boilerplate_indicators = [
            '>>',
            '<<',
            '>>>',
            '[x]',
            '[ ]',
            '(*)',
        ]

        # For structured content, '|' is acceptable (table formatting)
        if not is_structured:
            boilerplate_indicators.append('|')

        indicator_count = sum(1 for ind in boilerplate_indicators if ind in content_lower)

        # Check for excessive special characters
        alpha_count = sum(1 for c in content if c.isalpha())
        total_count = len(content.strip())

        if total_count == 0:
            return 0.0

        alpha_ratio = alpha_count / total_count

        if is_structured:
            # For structured content, accept lower alpha ratio
            # Specs have lots of numbers, units, etc.
            if alpha_ratio < 0.25:
                return 0.4
            elif alpha_ratio < 0.4:
                return 0.7
            else:
                return 1.0 - (indicator_count * 0.05)
        else:
            # Standard prose scoring
            # Low alpha ratio indicates tables/code fragments
            if alpha_ratio < 0.4:
                return 0.3
            elif alpha_ratio < 0.6:
                return 0.6

            # Deduct for boilerplate indicators
            score = 1.0 - (indicator_count * 0.1)
            return max(0.0, score)

    def _score_uniqueness(self, content: str) -> float:
        """Score based on internal uniqueness (not self-repeating)."""
        words = content.lower().split()

        if len(words) < 5:
            return 0.5  # Too short to evaluate

        # Check word diversity
        unique_words = set(words)
        diversity_ratio = len(unique_words) / len(words)

        if diversity_ratio < 0.3:
            return 0.0  # Very repetitive
        elif diversity_ratio < 0.5:
            return 0.4
        elif diversity_ratio < 0.7:
            return 0.7
        else:
            return 1.0


# =============================================================================
# Singleton
# =============================================================================

_validator: Optional[ChunkQualityValidator] = None


def get_chunk_quality_validator() -> ChunkQualityValidator:
    """Get or create singleton validator."""
    global _validator
    if _validator is None:
        _validator = ChunkQualityValidator()
    return _validator


# =============================================================================
# Utility Functions
# =============================================================================

def validate_chunks(
    chunks: List[dict],
    doc_type: Optional[str] = None,
) -> Tuple[List[dict], List[dict]]:
    """Validate a list of chunks and separate valid from rejected.

    Args:
        chunks: List of chunk dictionaries with 'content' key.
        doc_type: Optional document type.

    Returns:
        Tuple of (valid_chunks, rejected_chunks).
        Each chunk dict gets 'quality_score' added if valid,
        or 'rejection_reasons' added if rejected.
    """
    validator = get_chunk_quality_validator()
    valid = []
    rejected = []

    for chunk in chunks:
        content = chunk.get('content', '')
        result = validator.validate_chunk(content, doc_type)

        if result.is_valid:
            chunk['quality_score'] = result.quality_score
            valid.append(chunk)
        else:
            chunk['quality_score'] = result.quality_score
            chunk['rejection_reasons'] = result.rejection_reasons
            rejected.append(chunk)

    return valid, rejected
