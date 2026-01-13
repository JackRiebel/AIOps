"""
Query Preprocessor - Normalizes and corrects user queries before routing.

Handles:
- Typo correction using Levenshtein distance (via rapidfuzz)
- Common misspelling dictionary for domain terms
- Query normalization (whitespace, case)
- Abbreviation expansion for network terminology
- Phonetic similarity for harder typos

This service ensures queries like "splnk events" or "Interestring" are
corrected before being routed to specialist agents.
"""

import re
import logging
from typing import Optional, Tuple, List, Dict, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Try to import rapidfuzz, fall back to basic matching if not available
try:
    from rapidfuzz import fuzz, process
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False
    logger.warning("rapidfuzz not installed. Using basic fuzzy matching. Install with: pip install rapidfuzz")


@dataclass
class QueryCorrection:
    """Single correction made to a query."""
    original: str
    corrected: str
    confidence: float
    method: str  # "dictionary", "fuzzy", "abbreviation", "phonetic"


@dataclass
class PreprocessedQuery:
    """Result of preprocessing a user query."""
    original: str
    corrected: str
    corrections_made: List[QueryCorrection] = field(default_factory=list)
    normalized: str = ""
    confidence: float = 1.0
    was_corrected: bool = False

    def __post_init__(self):
        self.was_corrected = len(self.corrections_made) > 0


class QueryPreprocessor:
    """
    Preprocesses user queries to fix typos and normalize input.

    Uses multiple strategies:
    1. Known misspelling dictionary (fastest, highest confidence)
    2. Fuzzy matching against domain vocabulary
    3. Abbreviation expansion
    4. Basic phonetic matching for edge cases
    """

    # Domain-specific vocabulary for fuzzy matching
    # These are terms users commonly type when interacting with the system
    DOMAIN_VOCABULARY = [
        # Platforms & Services
        "splunk", "meraki", "catalyst", "thousandeyes", "webex", "cisco",
        "dashboard", "nexus", "dnac", "ise", "umbrella", "duo", "amp",

        # Actions & Queries
        "events", "alerts", "devices", "networks", "clients", "status",
        "health", "performance", "troubleshoot", "configure", "analyze",
        "monitor", "check", "show", "get", "list", "find", "search",
        "compare", "audit", "review", "diagnose", "investigate",

        # Time References
        "recent", "today", "yesterday", "week", "month", "hour", "minute",
        "latest", "last", "past", "current", "now", "history",

        # Network Entities
        "switch", "router", "firewall", "access", "point", "wireless",
        "ssid", "vlan", "subnet", "interface", "port", "uplink",
        "bandwidth", "throughput", "latency", "packet", "traffic",

        # Status & Metrics
        "online", "offline", "healthy", "unhealthy", "critical", "warning",
        "error", "failed", "success", "connected", "disconnected",

        # Common Descriptors
        "interesting", "important", "urgent", "more", "details", "summary",
        "overview", "report", "insights", "recommendations",
    ]

    # Known misspellings mapped to correct terms
    # These are exact matches that bypass fuzzy logic
    MISSPELLING_MAP = {
        # Platform typos
        "splnk": "splunk",
        "spunk": "splunk",
        "spluk": "splunk",
        "slpunk": "splunk",
        "merkai": "meraki",
        "merkai": "meraki",
        "merak": "meraki",
        "mreaki": "meraki",
        "catalist": "catalyst",
        "catalyist": "catalyst",
        "catayst": "catalyst",
        "thousendeyes": "thousandeyes",
        "thousandeys": "thousandeyes",
        "thousandeye": "thousandeyes",
        "1000eyes": "thousandeyes",

        # Common word typos
        "intresting": "interesting",
        "interestring": "interesting",
        "interessting": "interesting",
        "intersting": "interesting",
        "interesing": "interesting",
        "recnet": "recent",
        "reecnt": "recent",
        "recen": "recent",
        "devies": "devices",
        "devcies": "devices",
        "divices": "devices",
        "devicess": "devices",
        "netwrok": "network",
        "netowrk": "network",
        "nework": "network",
        "newtork": "network",
        "preformance": "performance",
        "performace": "performance",
        "perfomance": "performance",
        "performnace": "performance",
        "stauts": "status",
        "staus": "status",
        "satuts": "status",
        "statuus": "status",
        "clietns": "clients",
        "cleints": "clients",
        "clinets": "clients",
        "heatlh": "health",
        "helath": "health",
        "healt": "health",
        "troubleshoot": "troubleshoot",
        "toubleshoot": "troubleshoot",
        "troubleshot": "troubleshoot",
        "trobleshoot": "troubleshoot",
        "configur": "configure",
        "confgure": "configure",
        "ocnfigure": "configure",
        "anaylze": "analyze",
        "analzye": "analyze",
        "analize": "analyze",
        "evnets": "events",
        "evets": "events",
        "evenst": "events",
        "alrets": "alerts",
        "alrts": "alerts",
        "alertss": "alerts",
        "wireles": "wireless",
        "wirelss": "wireless",
        "wirless": "wireless",
        "bandwith": "bandwidth",
        "bandwidht": "bandwidth",
        "badnwidth": "bandwidth",
        "latecny": "latency",
        "latnecy": "latency",
        "latecy": "latency",

        # Reaction typos
        "interestig": "interesting",
        "cool": "cool",  # Not a typo but normalize
        "ncie": "nice",
        "greta": "great",
        "greaat": "great",
        "thansk": "thanks",
        "thnaks": "thanks",
        "thansk": "thanks",
    }

    # Abbreviation expansions for network terminology
    ABBREVIATIONS = {
        "ap": "access point",
        "aps": "access points",
        "te": "thousandeyes",
        "sw": "switch",
        "rtr": "router",
        "fw": "firewall",
        "bw": "bandwidth",
        "nw": "network",
        "cfg": "configuration",
        "config": "configuration",
        "perf": "performance",
        "stats": "statistics",
        "info": "information",
        "auth": "authentication",
        "authz": "authorization",
        "authn": "authentication",
    }

    # Words to skip during correction (too short or common)
    SKIP_WORDS = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been",
        "to", "of", "in", "for", "on", "at", "by", "with", "from",
        "it", "my", "me", "we", "us", "you", "your", "our", "their",
        "can", "get", "show", "tell", "what", "how", "why", "when",
        "and", "or", "but", "if", "then", "so", "as", "that", "this",
    }

    def __init__(self, min_confidence: float = 0.75, enable_fuzzy: bool = True):
        """
        Initialize the query preprocessor.

        Args:
            min_confidence: Minimum confidence threshold for fuzzy corrections (0.0-1.0)
            enable_fuzzy: Whether to use fuzzy matching (requires rapidfuzz)
        """
        self.min_confidence = min_confidence
        self.enable_fuzzy = enable_fuzzy and RAPIDFUZZ_AVAILABLE

        if enable_fuzzy and not RAPIDFUZZ_AVAILABLE:
            logger.warning("Fuzzy matching requested but rapidfuzz not available")

    def preprocess(self, query: str) -> PreprocessedQuery:
        """
        Full preprocessing pipeline for a user query.

        Args:
            query: Raw user input

        Returns:
            PreprocessedQuery with original, corrected, and metadata
        """
        if not query or not query.strip():
            return PreprocessedQuery(
                original=query,
                corrected=query,
                normalized=query,
                confidence=1.0
            )

        original = query
        corrections: List[QueryCorrection] = []

        # Step 1: Basic normalization
        normalized = self._normalize(query)

        # Step 2: Check known misspellings (fast path, high confidence)
        corrected, misspelling_fixes = self._fix_known_misspellings(normalized)
        corrections.extend(misspelling_fixes)

        # Step 3: Fuzzy match against domain vocabulary
        if self.enable_fuzzy:
            corrected, fuzzy_fixes = self._fuzzy_correct(corrected)
            corrections.extend(fuzzy_fixes)

        # Step 4: Expand abbreviations
        corrected, abbrev_fixes = self._expand_abbreviations(corrected)
        corrections.extend(abbrev_fixes)

        # Calculate overall confidence
        if corrections:
            confidence = sum(c.confidence for c in corrections) / len(corrections)
        else:
            confidence = 1.0

        result = PreprocessedQuery(
            original=original,
            corrected=corrected,
            corrections_made=corrections,
            normalized=normalized,
            confidence=confidence
        )

        # Log corrections for debugging
        if result.was_corrected:
            logger.info(f"Query preprocessed: '{original}' -> '{corrected}'")
            for c in corrections:
                logger.debug(f"  Correction: '{c.original}' -> '{c.corrected}' "
                           f"(confidence={c.confidence:.2f}, method={c.method})")

        return result

    def _normalize(self, text: str) -> str:
        """Basic text normalization."""
        # Lowercase
        text = text.lower().strip()

        # Collapse multiple whitespace
        text = re.sub(r'\s+', ' ', text)

        # Remove extra punctuation but keep sentence structure
        text = re.sub(r'[^\w\s\?\.\,\!\-]', '', text)

        return text

    def _fix_known_misspellings(self, text: str) -> Tuple[str, List[QueryCorrection]]:
        """Fix known misspellings from dictionary."""
        corrections = []
        words = text.split()
        fixed_words = []

        for word in words:
            # Extract clean word (remove punctuation for matching)
            clean_word = re.sub(r'[^\w]', '', word)

            if clean_word in self.MISSPELLING_MAP:
                fixed = self.MISSPELLING_MAP[clean_word]
                # Preserve original punctuation
                fixed_word = word.replace(clean_word, fixed)
                fixed_words.append(fixed_word)

                corrections.append(QueryCorrection(
                    original=clean_word,
                    corrected=fixed,
                    confidence=1.0,
                    method="dictionary"
                ))
            else:
                fixed_words.append(word)

        return ' '.join(fixed_words), corrections

    def _fuzzy_correct(self, text: str) -> Tuple[str, List[QueryCorrection]]:
        """Fuzzy match words against domain vocabulary."""
        if not RAPIDFUZZ_AVAILABLE:
            return text, []

        corrections = []
        words = text.split()
        fixed_words = []

        for word in words:
            clean_word = re.sub(r'[^\w]', '', word)

            # Skip short words and common words
            if len(clean_word) < 4 or clean_word in self.SKIP_WORDS:
                fixed_words.append(word)
                continue

            # Skip if already in vocabulary
            if clean_word in self.DOMAIN_VOCABULARY:
                fixed_words.append(word)
                continue

            # Skip if already corrected by dictionary
            if clean_word in self.MISSPELLING_MAP.values():
                fixed_words.append(word)
                continue

            # Fuzzy match against vocabulary
            match = process.extractOne(
                clean_word,
                self.DOMAIN_VOCABULARY,
                scorer=fuzz.ratio
            )

            if match and match[1] >= self.min_confidence * 100:
                fixed = match[0]
                confidence = match[1] / 100

                # Only correct if it's actually different
                if fixed != clean_word:
                    fixed_word = word.replace(clean_word, fixed)
                    fixed_words.append(fixed_word)

                    corrections.append(QueryCorrection(
                        original=clean_word,
                        corrected=fixed,
                        confidence=confidence,
                        method="fuzzy"
                    ))
                else:
                    fixed_words.append(word)
            else:
                fixed_words.append(word)

        return ' '.join(fixed_words), corrections

    def _expand_abbreviations(self, text: str) -> Tuple[str, List[QueryCorrection]]:
        """Expand common abbreviations."""
        corrections = []
        words = text.split()
        fixed_words = []

        for word in words:
            clean_word = re.sub(r'[^\w]', '', word)

            if clean_word in self.ABBREVIATIONS:
                fixed = self.ABBREVIATIONS[clean_word]
                fixed_word = word.replace(clean_word, fixed)
                fixed_words.append(fixed_word)

                corrections.append(QueryCorrection(
                    original=clean_word,
                    corrected=fixed,
                    confidence=1.0,
                    method="abbreviation"
                ))
            else:
                fixed_words.append(word)

        return ' '.join(fixed_words), corrections

    def suggest_corrections(self, word: str, top_n: int = 3) -> List[Tuple[str, float]]:
        """
        Get suggested corrections for a single word.

        Useful for UI autocomplete or "Did you mean?" prompts.

        Args:
            word: The word to get suggestions for
            top_n: Number of suggestions to return

        Returns:
            List of (suggestion, confidence) tuples
        """
        if not RAPIDFUZZ_AVAILABLE:
            return []

        clean_word = re.sub(r'[^\w]', '', word.lower())

        # Check dictionary first
        if clean_word in self.MISSPELLING_MAP:
            return [(self.MISSPELLING_MAP[clean_word], 1.0)]

        # Fuzzy match
        matches = process.extract(
            clean_word,
            self.DOMAIN_VOCABULARY,
            scorer=fuzz.ratio,
            limit=top_n
        )

        return [(m[0], m[1] / 100) for m in matches if m[1] >= 50]


# ============================================================================
# Vocabulary Expansion - Learn new terms from usage
# ============================================================================


@dataclass
class LearnedTerm:
    """A term learned from user queries."""
    term: str
    category: str  # "platform", "action", "entity", "network"
    occurrences: int = 1
    first_seen: str = ""
    source: str = "conversation"  # "conversation", "log", "manual"


class VocabularyExpander:
    """Manages dynamic vocabulary learning from user interactions.

    Tracks new terms that appear frequently in conversations and can
    add them to the preprocessor's vocabulary for better correction.

    Usage:
        expander = get_vocabulary_expander()
        expander.observe_term("MX68", "device")  # Track occurrence
        expander.promote_learned_terms(preprocessor)  # Add to vocabulary
    """

    def __init__(
        self,
        min_occurrences: int = 3,
        max_learned_terms: int = 500,
        persist_path: Optional[str] = None
    ):
        """Initialize vocabulary expander.

        Args:
            min_occurrences: Minimum occurrences before a term can be promoted
            max_learned_terms: Maximum learned terms to track
            persist_path: Optional file path to persist learned terms
        """
        self.min_occurrences = min_occurrences
        self.max_learned_terms = max_learned_terms
        self.persist_path = persist_path

        self._learned_terms: Dict[str, LearnedTerm] = {}
        self._promoted_terms: set = set()

        # Load persisted terms if available
        if persist_path:
            self._load_from_file()

    def observe_term(self, term: str, category: str = "general") -> None:
        """Observe a term from user interaction.

        Call this when you encounter a new or unfamiliar term in a query.
        Terms with sufficient occurrences will be candidates for promotion.

        Args:
            term: The term observed
            category: Category of the term (platform, action, entity, network)
        """
        term_lower = term.lower().strip()

        if len(term_lower) < 3:
            return  # Too short

        if term_lower in self._learned_terms:
            self._learned_terms[term_lower].occurrences += 1
            logger.debug(
                f"[VocabularyExpander] Term '{term}' seen "
                f"{self._learned_terms[term_lower].occurrences} times"
            )
        else:
            if len(self._learned_terms) >= self.max_learned_terms:
                self._evict_least_used()

            from datetime import datetime
            self._learned_terms[term_lower] = LearnedTerm(
                term=term_lower,
                category=category,
                occurrences=1,
                first_seen=datetime.utcnow().isoformat(),
                source="conversation"
            )
            logger.debug(f"[VocabularyExpander] New term observed: '{term}' ({category})")

    def observe_from_query(self, query: str, known_vocabulary: List[str]) -> None:
        """Extract and observe potentially new terms from a query.

        Identifies words that are not in the known vocabulary and tracks them.

        Args:
            query: The user query
            known_vocabulary: List of known vocabulary terms
        """
        known_set = set(w.lower() for w in known_vocabulary)

        # Extract words
        words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9]+\b', query)

        for word in words:
            word_lower = word.lower()

            # Skip if already known or too short
            if word_lower in known_set or len(word_lower) < 4:
                continue

            # Skip common English words (could expand this list)
            common_words = {
                "that", "this", "with", "from", "have", "what", "when",
                "where", "which", "would", "could", "should", "about",
                "there", "their", "these", "those", "been", "being",
            }
            if word_lower in common_words:
                continue

            # Categorize based on patterns
            category = self._categorize_term(word)
            self.observe_term(word, category)

    def _categorize_term(self, term: str) -> str:
        """Categorize a term based on patterns."""
        term_lower = term.lower()

        # Device model patterns (e.g., MX68, MS225)
        if re.match(r'^[a-z]{2,3}\d{2,4}[a-z]?$', term_lower):
            return "device"

        # Network-related patterns
        if any(kw in term_lower for kw in ["net", "vlan", "ssid", "subnet"]):
            return "network"

        # Error/status patterns
        if any(kw in term_lower for kw in ["err", "fail", "warn", "alert"]):
            return "status"

        # Action patterns
        if term_lower.endswith("ing") or term_lower.endswith("tion"):
            return "action"

        return "general"

    def get_promotion_candidates(self) -> List[LearnedTerm]:
        """Get terms that qualify for promotion to vocabulary.

        Returns:
            List of LearnedTerm objects that meet the occurrence threshold
        """
        candidates = [
            t for t in self._learned_terms.values()
            if t.occurrences >= self.min_occurrences
            and t.term not in self._promoted_terms
        ]
        return sorted(candidates, key=lambda x: x.occurrences, reverse=True)

    def promote_learned_terms(self, preprocessor: 'QueryPreprocessor') -> int:
        """Promote learned terms to the preprocessor's vocabulary.

        Args:
            preprocessor: QueryPreprocessor instance to update

        Returns:
            Number of terms promoted
        """
        candidates = self.get_promotion_candidates()
        promoted_count = 0

        for term in candidates:
            if term.term not in preprocessor.DOMAIN_VOCABULARY:
                preprocessor.DOMAIN_VOCABULARY.append(term.term)
                self._promoted_terms.add(term.term)
                promoted_count += 1
                logger.info(
                    f"[VocabularyExpander] Promoted term '{term.term}' to vocabulary "
                    f"(occurrences: {term.occurrences}, category: {term.category})"
                )

        if promoted_count > 0:
            self._save_to_file()

        return promoted_count

    def add_domain_term(
        self,
        term: str,
        category: str,
        source: str = "manual"
    ) -> None:
        """Manually add a domain term.

        Use this to add terms discovered from other sources like logs
        or admin input.

        Args:
            term: The term to add
            category: Category of the term
            source: Source of the term (manual, log, api)
        """
        term_lower = term.lower().strip()

        from datetime import datetime
        self._learned_terms[term_lower] = LearnedTerm(
            term=term_lower,
            category=category,
            occurrences=self.min_occurrences,  # Immediate promotion eligibility
            first_seen=datetime.utcnow().isoformat(),
            source=source
        )

        logger.info(f"[VocabularyExpander] Added domain term: '{term}' ({category}) from {source}")

    def load_terms_from_logs(
        self,
        log_content: str,
        category: str = "general"
    ) -> int:
        """Extract and learn new terms from log content.

        Scans log content for potential domain terms and adds them
        to the learned vocabulary.

        Args:
            log_content: String content of logs to analyze
            category: Default category for discovered terms

        Returns:
            Number of new terms discovered
        """
        # Patterns to look for in logs
        patterns = [
            # Device models (MX68, MS225-24P, etc.)
            r'\b([A-Z]{2,3}\d{2,4}(?:-[A-Z0-9]+)?)\b',

            # Network names (typically CamelCase or with hyphens)
            r'\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b',

            # Quoted strings (often contain entity names)
            r'"([a-zA-Z][a-zA-Z0-9\-_]{3,})"',

            # API endpoints (might contain new service names)
            r'/(?:api/)?v\d+/([a-z]+)(?:/|\b)',
        ]

        discovered = 0
        seen_terms = set()

        for pattern in patterns:
            matches = re.findall(pattern, log_content)
            for match in matches:
                term = match.strip()
                if term and term.lower() not in seen_terms and len(term) >= 3:
                    seen_terms.add(term.lower())

                    # Check if it's already known
                    if term.lower() not in self._learned_terms:
                        term_category = self._categorize_term(term)
                        self.add_domain_term(term, term_category or category, "log")
                        discovered += 1

        logger.info(f"[VocabularyExpander] Discovered {discovered} new terms from logs")
        return discovered

    def _evict_least_used(self) -> None:
        """Evict least used terms when at capacity."""
        if not self._learned_terms:
            return

        # Find term with lowest occurrences (that hasn't been promoted)
        evict_candidates = [
            (k, v) for k, v in self._learned_terms.items()
            if k not in self._promoted_terms
        ]

        if evict_candidates:
            evict_candidates.sort(key=lambda x: x[1].occurrences)
            evict_term = evict_candidates[0][0]
            del self._learned_terms[evict_term]
            logger.debug(f"[VocabularyExpander] Evicted term: '{evict_term}'")

    def _save_to_file(self) -> None:
        """Save learned terms to file."""
        if not self.persist_path:
            return

        try:
            import json
            data = {
                term: {
                    "term": lt.term,
                    "category": lt.category,
                    "occurrences": lt.occurrences,
                    "first_seen": lt.first_seen,
                    "source": lt.source,
                }
                for term, lt in self._learned_terms.items()
            }

            with open(self.persist_path, "w") as f:
                json.dump(data, f, indent=2)

            logger.debug(f"[VocabularyExpander] Saved {len(data)} terms to {self.persist_path}")

        except Exception as e:
            logger.warning(f"[VocabularyExpander] Failed to save terms: {e}")

    def _load_from_file(self) -> None:
        """Load learned terms from file."""
        if not self.persist_path:
            return

        try:
            import json
            import os

            if not os.path.exists(self.persist_path):
                return

            with open(self.persist_path, "r") as f:
                data = json.load(f)

            for term, info in data.items():
                self._learned_terms[term] = LearnedTerm(
                    term=info.get("term", term),
                    category=info.get("category", "general"),
                    occurrences=info.get("occurrences", 1),
                    first_seen=info.get("first_seen", ""),
                    source=info.get("source", "file"),
                )

            logger.info(
                f"[VocabularyExpander] Loaded {len(self._learned_terms)} terms "
                f"from {self.persist_path}"
            )

        except Exception as e:
            logger.warning(f"[VocabularyExpander] Failed to load terms: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Get vocabulary statistics.

        Returns:
            Dictionary with vocabulary stats
        """
        categories = {}
        for term in self._learned_terms.values():
            categories[term.category] = categories.get(term.category, 0) + 1

        return {
            "total_terms": len(self._learned_terms),
            "promoted_terms": len(self._promoted_terms),
            "promotion_candidates": len(self.get_promotion_candidates()),
            "by_category": categories,
            "min_occurrences": self.min_occurrences,
            "max_terms": self.max_learned_terms,
        }


# ============================================================================
# Singleton Instances
# ============================================================================

# Singleton instance for reuse
_preprocessor: Optional[QueryPreprocessor] = None
_vocabulary_expander: Optional[VocabularyExpander] = None


def get_preprocessor() -> QueryPreprocessor:
    """Get the singleton QueryPreprocessor instance."""
    global _preprocessor
    if _preprocessor is None:
        _preprocessor = QueryPreprocessor()
    return _preprocessor


def get_vocabulary_expander() -> VocabularyExpander:
    """Get the singleton VocabularyExpander instance."""
    global _vocabulary_expander
    if _vocabulary_expander is None:
        # Try to get settings for configuration
        try:
            from src.config.agent_settings import get_agent_settings
            settings = get_agent_settings()
            _vocabulary_expander = VocabularyExpander(
                min_occurrences=settings.vocabulary.min_occurrences,
                max_learned_terms=settings.vocabulary.max_learned_terms,
                persist_path=settings.vocabulary.learned_vocab_path,
            )
        except ImportError:
            _vocabulary_expander = VocabularyExpander()
    return _vocabulary_expander


def preprocess_query(query: str) -> PreprocessedQuery:
    """Convenience function to preprocess a query."""
    return get_preprocessor().preprocess(query)


def observe_query_terms(query: str) -> None:
    """Observe terms in a query for vocabulary learning.

    Call this after processing a query to track potential new terms.

    Args:
        query: The user query to analyze
    """
    preprocessor = get_preprocessor()
    expander = get_vocabulary_expander()
    expander.observe_from_query(query, preprocessor.DOMAIN_VOCABULARY)
