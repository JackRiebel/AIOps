"""Query decomposition for multi-hop reasoning.

Complex queries often require information from multiple sources or
require multi-step reasoning. This module decomposes such queries
into simpler sub-queries that can be processed independently and
then synthesized into a comprehensive answer.

Examples:
    "Compare Meraki and Catalyst VLAN configuration"
    -> ["How to configure VLANs on Meraki?", "How to configure VLANs on Catalyst?"]

    "Set up a site-to-site VPN and configure failover"
    -> ["How to set up site-to-site VPN?", "How to configure VPN failover?"]
"""

import re
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SubQueryType(Enum):
    """Type of sub-query in a decomposition."""
    PRIMARY = "primary"           # Main query, not decomposed
    PARALLEL = "parallel"         # Can run concurrently
    SEQUENTIAL = "sequential"     # Depends on previous result
    COMPARATIVE = "comparative"   # Part of a comparison


@dataclass
class SubQuery:
    """A sub-query from decomposition."""
    query: str
    query_type: SubQueryType
    entity: Optional[str] = None  # Entity being queried (for comparisons)
    depends_on: Optional[int] = None  # Index of query this depends on
    weight: float = 1.0  # Importance weight for synthesis


@dataclass
class SubQueryResult:
    """Result from executing a sub-query."""
    sub_query: SubQuery
    results: List[Any]  # Retrieved chunks
    response: Optional[str] = None
    success: bool = True
    error: Optional[str] = None


@dataclass
class DecompositionResult:
    """Result of query decomposition."""
    original_query: str
    sub_queries: List[SubQuery]
    is_decomposed: bool
    decomposition_type: str  # "comparison", "multi_step", "conditional", "none"
    confidence: float = 0.8


@dataclass
class SynthesizedResult:
    """Synthesized result from multiple sub-queries."""
    combined_chunks: List[Any]
    synthesis_prompt: str
    sub_results: List[SubQueryResult]
    entities_compared: List[str] = field(default_factory=list)


class QueryDecomposer:
    """Decompose complex queries into sub-queries for multi-hop retrieval.

    Handles several patterns:
    1. Comparisons: "Compare X and Y" -> Query X, Query Y, synthesize
    2. Multi-step: "Do A then B" -> Query A, Query B in sequence
    3. Conditional: "If X then Y" -> Query X context, Query Y
    4. Multi-entity: "Configure VLANs on switches and APs" -> Query each
    """

    # Comparison patterns
    COMPARISON_PATTERNS = [
        r'\b(compare|comparison|versus|vs\.?|difference between|differ from)\b',
        r'\b(better|worse|faster|slower|more|less)\s+(than|compared)\b',
        r'\b(which|what).+\b(better|best|prefer|choose|recommend)\b',
    ]

    # Multi-step patterns
    MULTI_STEP_PATTERNS = [
        r'\b(and then|after that|next|subsequently|followed by)\b',
        r'\b(first|second|third|finally|lastly)\b.+\b(then|next|after)\b',
        r'\b(step\s*\d+|phase\s*\d+)\b',
    ]

    # Conditional patterns
    CONDITIONAL_PATTERNS = [
        r'\b(if|when|in case|assuming|provided that)\b.+\b(then|how|what)\b',
        r'\b(what happens|what if|suppose)\b',
    ]

    # Entity extraction patterns
    ENTITY_PATTERNS = {
        'products': [
            r'\b(meraki|catalyst|ios[- ]?xe|ise|dnac|dna center|vmanage|sd-?wan)\b',
            r'\b(nexus|aci|firepower|fmc|ftd|umbrella|duo|webex)\b',
        ],
        'concepts': [
            r'\b(vlan|vxlan|ospf|bgp|eigrp|stp|vpc|hsrp|vrrp)\b',
            r'\b(acl|nat|dhcp|dns|ntp|snmp|syslog|netflow)\b',
            r'\b(vpn|ipsec|ssl|tls|radius|tacacs|802\.1x)\b',
        ],
    }

    # Conjunction patterns for splitting
    CONJUNCTION_PATTERNS = [
        r'\s+and\s+',
        r'\s+or\s+',
        r'\s*,\s*(?:and|or)?\s*',
        r'\s+as well as\s+',
        r'\s+along with\s+',
    ]

    def __init__(self, min_complexity_for_decomposition: float = 0.6):
        """Initialize the query decomposer.

        Args:
            min_complexity_for_decomposition: Minimum complexity score to trigger
                decomposition (0-1).
        """
        self.min_complexity = min_complexity_for_decomposition

        # Compile regex patterns
        self._comparison_re = [re.compile(p, re.I) for p in self.COMPARISON_PATTERNS]
        self._multi_step_re = [re.compile(p, re.I) for p in self.MULTI_STEP_PATTERNS]
        self._conditional_re = [re.compile(p, re.I) for p in self.CONDITIONAL_PATTERNS]
        self._entity_re = {
            cat: [re.compile(p, re.I) for p in patterns]
            for cat, patterns in self.ENTITY_PATTERNS.items()
        }

    def _detect_comparison(self, query: str) -> bool:
        """Check if query is a comparison."""
        return any(r.search(query) for r in self._comparison_re)

    def _detect_multi_step(self, query: str) -> bool:
        """Check if query has multiple steps."""
        return any(r.search(query) for r in self._multi_step_re)

    def _detect_conditional(self, query: str) -> bool:
        """Check if query is conditional."""
        return any(r.search(query) for r in self._conditional_re)

    def _extract_entities(self, query: str) -> Dict[str, List[str]]:
        """Extract entities from query."""
        entities = {}
        for category, patterns in self._entity_re.items():
            found = []
            for pattern in patterns:
                matches = pattern.findall(query)
                found.extend([m.lower() for m in matches])
            if found:
                entities[category] = list(set(found))
        return entities

    def _extract_comparison_entities(self, query: str) -> List[str]:
        """Extract entities being compared."""
        entities = []

        # Pattern: "Compare X and Y" or "X vs Y"
        vs_pattern = re.compile(r'(\w+(?:\s+\w+)?)\s+(?:vs\.?|versus)\s+(\w+(?:\s+\w+)?)', re.I)
        match = vs_pattern.search(query)
        if match:
            entities.extend([match.group(1).strip(), match.group(2).strip()])
            return entities

        # Pattern: "Compare X and Y" or "difference between X and Y"
        compare_pattern = re.compile(
            r'(?:compare|difference between|comparing)\s+(\w+(?:\s+\w+)?)\s+(?:and|with)\s+(\w+(?:\s+\w+)?)',
            re.I
        )
        match = compare_pattern.search(query)
        if match:
            entities.extend([match.group(1).strip(), match.group(2).strip()])
            return entities

        # Fall back to product entity extraction
        extracted = self._extract_entities(query)
        if 'products' in extracted and len(extracted['products']) >= 2:
            return extracted['products'][:2]

        return entities

    def _split_by_conjunction(self, query: str) -> List[str]:
        """Split query by conjunctions."""
        parts = [query]

        for pattern in self.CONJUNCTION_PATTERNS:
            new_parts = []
            for part in parts:
                split = re.split(pattern, part, flags=re.I)
                new_parts.extend([s.strip() for s in split if s.strip()])
            parts = new_parts

        return parts if len(parts) > 1 else []

    def decompose(
        self,
        query: str,
        complexity_score: float = 0.5,
        force_decompose: bool = False,
    ) -> DecompositionResult:
        """Decompose a query into sub-queries if complex.

        Args:
            query: The original query.
            complexity_score: Complexity score from query classifier (0-1).
            force_decompose: Force decomposition even for simple queries.

        Returns:
            DecompositionResult with sub-queries.
        """
        query = query.strip()

        # Check if decomposition needed
        if not force_decompose and complexity_score < self.min_complexity:
            return DecompositionResult(
                original_query=query,
                sub_queries=[SubQuery(query=query, query_type=SubQueryType.PRIMARY)],
                is_decomposed=False,
                decomposition_type="none",
            )

        # Try comparison decomposition
        if self._detect_comparison(query):
            result = self._decompose_comparison(query)
            if result.is_decomposed:
                return result

        # Try multi-step decomposition
        if self._detect_multi_step(query):
            result = self._decompose_multi_step(query)
            if result.is_decomposed:
                return result

        # Try conditional decomposition
        if self._detect_conditional(query):
            result = self._decompose_conditional(query)
            if result.is_decomposed:
                return result

        # Try entity-based decomposition
        entities = self._extract_entities(query)
        if entities.get('products') and len(entities['products']) >= 2:
            result = self._decompose_by_entities(query, entities['products'])
            if result.is_decomposed:
                return result

        # No decomposition needed
        return DecompositionResult(
            original_query=query,
            sub_queries=[SubQuery(query=query, query_type=SubQueryType.PRIMARY)],
            is_decomposed=False,
            decomposition_type="none",
        )

    def _decompose_comparison(self, query: str) -> DecompositionResult:
        """Decompose a comparison query."""
        entities = self._extract_comparison_entities(query)

        if len(entities) < 2:
            return DecompositionResult(
                original_query=query,
                sub_queries=[SubQuery(query=query, query_type=SubQueryType.PRIMARY)],
                is_decomposed=False,
                decomposition_type="none",
            )

        # Extract the topic being compared
        topic = self._extract_comparison_topic(query, entities)

        sub_queries = []
        for entity in entities:
            sub_query = f"How to {topic} on {entity}?" if topic else f"What is {entity}?"
            sub_queries.append(SubQuery(
                query=sub_query,
                query_type=SubQueryType.COMPARATIVE,
                entity=entity,
                weight=1.0 / len(entities),
            ))

        logger.debug(f"Decomposed comparison: {len(sub_queries)} sub-queries for {entities}")

        return DecompositionResult(
            original_query=query,
            sub_queries=sub_queries,
            is_decomposed=True,
            decomposition_type="comparison",
            confidence=0.85,
        )

    def _extract_comparison_topic(self, query: str, entities: List[str]) -> str:
        """Extract the topic being compared between entities."""
        # Remove comparison words and entities
        topic = query.lower()
        for word in ['compare', 'comparison', 'versus', 'vs', 'difference', 'between', 'and', 'with']:
            topic = re.sub(rf'\b{word}\b', '', topic)
        for entity in entities:
            topic = topic.replace(entity.lower(), '')

        topic = ' '.join(topic.split()).strip()

        # Common topic patterns
        if 'configure' in topic or 'configuration' in topic:
            concept = self._extract_entities(query).get('concepts', [''])[0]
            return f"configure {concept}" if concept else "configure"
        elif 'setup' in topic or 'set up' in topic:
            return "set up"
        elif 'troubleshoot' in topic:
            return "troubleshoot"

        return topic if len(topic) > 3 else "configure"

    def _decompose_multi_step(self, query: str) -> DecompositionResult:
        """Decompose a multi-step query."""
        # Split by step indicators
        step_pattern = re.compile(
            r'(?:and then|then|after that|next|subsequently|followed by|finally)',
            re.I
        )
        parts = step_pattern.split(query)
        parts = [p.strip() for p in parts if p.strip() and len(p.strip()) > 10]

        if len(parts) < 2:
            return DecompositionResult(
                original_query=query,
                sub_queries=[SubQuery(query=query, query_type=SubQueryType.PRIMARY)],
                is_decomposed=False,
                decomposition_type="none",
            )

        sub_queries = []
        for i, part in enumerate(parts):
            # Convert to question if needed
            if not part.endswith('?'):
                part = f"How to {part.lstrip('to ').lstrip('how ')}?"

            sub_queries.append(SubQuery(
                query=part,
                query_type=SubQueryType.SEQUENTIAL,
                depends_on=i - 1 if i > 0 else None,
                weight=1.0,
            ))

        logger.debug(f"Decomposed multi-step: {len(sub_queries)} sequential sub-queries")

        return DecompositionResult(
            original_query=query,
            sub_queries=sub_queries,
            is_decomposed=True,
            decomposition_type="multi_step",
            confidence=0.8,
        )

    def _decompose_conditional(self, query: str) -> DecompositionResult:
        """Decompose a conditional query."""
        # Pattern: "If X, then Y" or "When X, how to Y"
        cond_pattern = re.compile(
            r'(?:if|when|in case)\s+(.+?)(?:,|\s+then|\s+how|\s+what)\s+(.+)',
            re.I
        )
        match = cond_pattern.search(query)

        if not match:
            return DecompositionResult(
                original_query=query,
                sub_queries=[SubQuery(query=query, query_type=SubQueryType.PRIMARY)],
                is_decomposed=False,
                decomposition_type="none",
            )

        condition = match.group(1).strip()
        action = match.group(2).strip()

        sub_queries = [
            SubQuery(
                query=f"What is {condition}?" if not condition.endswith('?') else condition,
                query_type=SubQueryType.SEQUENTIAL,
                weight=0.4,
            ),
            SubQuery(
                query=action if action.endswith('?') else f"How to {action}?",
                query_type=SubQueryType.SEQUENTIAL,
                depends_on=0,
                weight=0.6,
            ),
        ]

        return DecompositionResult(
            original_query=query,
            sub_queries=sub_queries,
            is_decomposed=True,
            decomposition_type="conditional",
            confidence=0.75,
        )

    def _decompose_by_entities(
        self,
        query: str,
        entities: List[str],
    ) -> DecompositionResult:
        """Decompose by extracting separate queries for each entity."""
        # Extract the action/topic
        action = query
        for entity in entities:
            action = re.sub(rf'\b{re.escape(entity)}\b', '', action, flags=re.I)
        action = ' '.join(action.split()).strip()

        sub_queries = []
        for entity in entities[:3]:  # Limit to 3 entities
            sub_query = f"{action} {entity}"
            if not sub_query.endswith('?'):
                sub_query = f"How to {sub_query.lstrip('how to ')}?"

            sub_queries.append(SubQuery(
                query=sub_query,
                query_type=SubQueryType.PARALLEL,
                entity=entity,
                weight=1.0 / len(entities),
            ))

        if len(sub_queries) < 2:
            return DecompositionResult(
                original_query=query,
                sub_queries=[SubQuery(query=query, query_type=SubQueryType.PRIMARY)],
                is_decomposed=False,
                decomposition_type="none",
            )

        return DecompositionResult(
            original_query=query,
            sub_queries=sub_queries,
            is_decomposed=True,
            decomposition_type="multi_entity",
            confidence=0.7,
        )

    def synthesize(
        self,
        original_query: str,
        sub_results: List[SubQueryResult],
        decomposition_type: str,
    ) -> SynthesizedResult:
        """Synthesize results from sub-queries into a coherent answer.

        Args:
            original_query: The original query.
            sub_results: Results from each sub-query.
            decomposition_type: Type of decomposition used.

        Returns:
            SynthesizedResult with combined chunks and synthesis prompt.
        """
        # Combine chunks with deduplication
        seen_ids = set()
        combined_chunks = []
        entities_compared = []

        for sub_result in sub_results:
            if sub_result.sub_query.entity:
                entities_compared.append(sub_result.sub_query.entity)

            for chunk in sub_result.results:
                if chunk.id not in seen_ids:
                    seen_ids.add(chunk.id)
                    # Adjust relevance by sub-query weight
                    chunk.relevance *= sub_result.sub_query.weight
                    combined_chunks.append(chunk)

        # Sort by relevance
        combined_chunks.sort(key=lambda x: x.relevance, reverse=True)

        # Build synthesis prompt based on decomposition type
        synthesis_prompt = self._build_synthesis_prompt(
            original_query,
            decomposition_type,
            entities_compared,
        )

        return SynthesizedResult(
            combined_chunks=combined_chunks,
            synthesis_prompt=synthesis_prompt,
            sub_results=sub_results,
            entities_compared=entities_compared,
        )

    def _build_synthesis_prompt(
        self,
        query: str,
        decomposition_type: str,
        entities: List[str],
    ) -> str:
        """Build a prompt for synthesizing sub-query results."""
        if decomposition_type == "comparison":
            return (
                f"Compare and contrast the following information about {' and '.join(entities)}. "
                f"Highlight the key differences and similarities. "
                f"Original question: {query}"
            )
        elif decomposition_type == "multi_step":
            return (
                f"Combine the following information into a step-by-step guide. "
                f"Ensure the steps are in logical order. "
                f"Original question: {query}"
            )
        elif decomposition_type == "conditional":
            return (
                f"Explain the condition and then describe the appropriate action. "
                f"Original question: {query}"
            )
        elif decomposition_type == "multi_entity":
            return (
                f"Synthesize the information about {', '.join(entities)}. "
                f"Original question: {query}"
            )
        else:
            return f"Answer the following question: {query}"


# Singleton instance
_query_decomposer: Optional[QueryDecomposer] = None


def get_query_decomposer() -> QueryDecomposer:
    """Get or create the global query decomposer instance."""
    global _query_decomposer
    if _query_decomposer is None:
        _query_decomposer = QueryDecomposer()
    return _query_decomposer
