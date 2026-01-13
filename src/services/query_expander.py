"""Query expansion service for enhanced RAG retrieval.

Implements multiple techniques:
1. Fast Synonym Expansion - Lightweight keyword-based expansion using Cisco terminology
2. HyDE (Hypothetical Document Embeddings) - LLM-generated hypothetical answer
3. Multi-Query Expansion - LLM-generated query variations
"""

import logging
import asyncio
import re
from typing import List, Optional, Tuple, Set, Dict
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# =============================================================================
# Cisco-specific synonyms for fast, lightweight query expansion
# =============================================================================

CISCO_SYNONYMS: Dict[str, List[str]] = {
    # Network devices
    "firewall": ["security appliance", "mx", "asa", "ftd", "firepower"],
    "switch": ["ms", "catalyst", "nexus", "switching"],
    "router": ["isr", "routing", "gateway"],
    "access point": ["ap", "mr", "wireless ap", "wifi"],
    "wireless": ["wifi", "wi-fi", "wlan", "802.11"],

    # Meraki products
    "mx": ["meraki mx", "meraki firewall", "security appliance"],
    "ms": ["meraki ms", "meraki switch"],
    "mr": ["meraki mr", "meraki ap", "meraki wireless"],

    # Catalyst products
    "catalyst": ["cat", "catalyst switch"],
    "catalyst center": ["dnac", "dna center"],

    # Security
    "ise": ["identity services engine", "cisco ise", "radius", "aaa"],
    "duo": ["duo security", "mfa", "multi-factor"],
    "firepower": ["ftd", "firepower threat defense", "ngfw"],

    # Networking concepts
    "vlan": ["virtual lan", "802.1q"],
    "vpn": ["virtual private network", "site-to-site", "anyconnect"],
    "sdwan": ["sd-wan", "software-defined wan", "viptela"],
    "nat": ["network address translation", "pat"],
    "acl": ["access control list", "firewall rules"],
    "qos": ["quality of service", "traffic shaping"],
    "bgp": ["border gateway protocol", "routing protocol"],
    "ospf": ["open shortest path first", "routing protocol"],
    "dhcp": ["dynamic host configuration", "ip assignment"],
    "dns": ["domain name system", "name resolution"],
    "snmp": ["network management", "monitoring"],

    # Actions
    "configure": ["setup", "provision", "deploy", "configuration"],
    "troubleshoot": ["debug", "diagnose", "fix", "resolve"],
    "monitor": ["observe", "track", "surveillance"],
    "upgrade": ["update", "firmware update"],

    # ThousandEyes
    "thousandeyes": ["te", "network monitoring"],
}

# Build reverse lookup for synonyms
_SYNONYM_LOOKUP: Dict[str, Set[str]] = {}
for base_term, synonyms in CISCO_SYNONYMS.items():
    all_terms = [base_term] + synonyms
    for term in all_terms:
        term_lower = term.lower()
        if term_lower not in _SYNONYM_LOOKUP:
            _SYNONYM_LOOKUP[term_lower] = set()
        _SYNONYM_LOOKUP[term_lower].update(t.lower() for t in all_terms if t.lower() != term_lower)


@dataclass
class ExpandedQuery:
    """Result of query expansion."""
    original_query: str
    hyde_document: Optional[str] = None
    query_variations: List[str] = None
    combined_queries: List[str] = None

    def __post_init__(self):
        if self.query_variations is None:
            self.query_variations = []
        if self.combined_queries is None:
            self.combined_queries = [self.original_query]
            if self.query_variations:
                self.combined_queries.extend(self.query_variations)


class QueryExpander:
    """Expands queries for improved retrieval.

    Uses LLM to generate:
    1. Hypothetical documents (HyDE)
    2. Query variations (multi-query)
    """

    def __init__(self, llm_client=None):
        """Initialize the query expander.

        Args:
            llm_client: LLM client for generating expansions.
                       Should have an async `generate()` method.
        """
        self._llm_client = llm_client

    @property
    def llm_client(self):
        """Lazy-load LLM client."""
        if self._llm_client is None:
            from src.services.claude_service import get_claude_service
            self._llm_client = get_claude_service()
        return self._llm_client

    async def expand_with_hyde(
        self,
        query: str,
        context: Optional[str] = None,
    ) -> str:
        """Generate a hypothetical document that would answer the query.

        HyDE (Hypothetical Document Embeddings) works by:
        1. Generating a hypothetical answer to the query
        2. Embedding the hypothetical answer instead of the query
        3. The hypothetical answer is semantically closer to actual documents

        Args:
            query: The user's query.
            context: Optional context about the environment or domain.

        Returns:
            A hypothetical document answering the query.
        """
        context_section = ""
        if context:
            context_section = f"\nContext: {context}\n"

        prompt = f"""You are a Cisco network documentation expert. Write a detailed technical answer to the following question as if you were writing documentation.

Question: {query}
{context_section}
Write a comprehensive answer (2-3 paragraphs) that would appear in official Cisco documentation. Include specific technical details, configuration examples if relevant, and best practices.

Answer:"""

        try:
            response = await self.llm_client.generate(
                prompt=prompt,
                max_tokens=500,
                temperature=0.3,  # Lower temperature for more focused response
            )
            return response.strip()
        except Exception as e:
            logger.warning(f"HyDE generation failed: {e}")
            return query  # Fall back to original query

    async def expand_multi_query(
        self,
        query: str,
        num_variations: int = 3,
    ) -> List[str]:
        """Generate multiple variations of the query.

        Multi-query expansion helps by:
        1. Capturing different ways to phrase the same question
        2. Including synonyms and related terms
        3. Exploring different aspects of the question

        Args:
            query: The original query.
            num_variations: Number of variations to generate.

        Returns:
            List of query variations.
        """
        prompt = f"""Generate {num_variations} different ways to ask the following question about Cisco networking.
Each variation should:
- Use different wording and terminology
- Approach the question from a slightly different angle
- Include relevant synonyms or related concepts

Original question: {query}

Provide exactly {num_variations} variations, one per line, without numbering or bullet points:"""

        try:
            response = await self.llm_client.generate(
                prompt=prompt,
                max_tokens=300,
                temperature=0.7,  # Higher temperature for more diversity
            )

            # Parse variations from response
            variations = []
            for line in response.strip().split('\n'):
                line = line.strip()
                # Skip empty lines and numbering
                if line and not line[0].isdigit():
                    variations.append(line)
                elif line and line[0].isdigit():
                    # Remove numbering like "1." or "1)"
                    parts = line.split('.', 1) if '.' in line[:3] else line.split(')', 1)
                    if len(parts) > 1:
                        variations.append(parts[1].strip())

            return variations[:num_variations]

        except Exception as e:
            logger.warning(f"Multi-query expansion failed: {e}")
            return []

    async def expand_query(
        self,
        query: str,
        use_hyde: bool = True,
        use_multi_query: bool = True,
        num_variations: int = 3,
        context: Optional[str] = None,
    ) -> ExpandedQuery:
        """Expand a query using all available techniques.

        Args:
            query: The original query.
            use_hyde: Whether to generate a HyDE document.
            use_multi_query: Whether to generate query variations.
            num_variations: Number of query variations to generate.
            context: Optional context for HyDE generation.

        Returns:
            ExpandedQuery with all expansions.
        """
        result = ExpandedQuery(original_query=query)

        # Run expansions in parallel
        tasks = []

        if use_hyde:
            tasks.append(('hyde', self.expand_with_hyde(query, context)))

        if use_multi_query:
            tasks.append(('multi', self.expand_multi_query(query, num_variations)))

        if tasks:
            # Execute all tasks concurrently
            results = await asyncio.gather(
                *[task[1] for task in tasks],
                return_exceptions=True
            )

            # Process results
            for (task_type, _), task_result in zip(tasks, results):
                if isinstance(task_result, Exception):
                    logger.warning(f"{task_type} expansion failed: {task_result}")
                    continue

                if task_type == 'hyde':
                    result.hyde_document = task_result
                elif task_type == 'multi':
                    result.query_variations = task_result

        # Build combined queries list
        result.combined_queries = [query]
        if result.query_variations:
            result.combined_queries.extend(result.query_variations)

        return result

    async def get_embedding_texts(
        self,
        expanded_query: ExpandedQuery,
        prefer_hyde: bool = True,
    ) -> List[str]:
        """Get the texts that should be embedded for retrieval.

        Args:
            expanded_query: The expanded query result.
            prefer_hyde: If True and HyDE is available, use it as primary.

        Returns:
            List of texts to embed for retrieval.
        """
        texts = []

        # If HyDE is available and preferred, use it as the primary search text
        if prefer_hyde and expanded_query.hyde_document:
            texts.append(expanded_query.hyde_document)

        # Add original query
        texts.append(expanded_query.original_query)

        # Add variations
        if expanded_query.query_variations:
            texts.extend(expanded_query.query_variations)

        return texts


class CiscoQueryExpander(QueryExpander):
    """Cisco-specific query expander with domain knowledge.

    Includes Cisco-specific prompts and terminology handling.
    """

    # Common Cisco abbreviation expansions
    ABBREVIATIONS = {
        'bgp': 'Border Gateway Protocol BGP',
        'ospf': 'Open Shortest Path First OSPF',
        'vlan': 'Virtual LAN VLAN',
        'acl': 'Access Control List ACL',
        'nat': 'Network Address Translation NAT',
        'qos': 'Quality of Service QoS',
        'stp': 'Spanning Tree Protocol STP',
        'hsrp': 'Hot Standby Router Protocol HSRP',
        'vrrp': 'Virtual Router Redundancy Protocol VRRP',
        'eigrp': 'Enhanced Interior Gateway Routing Protocol EIGRP',
        'mpls': 'Multiprotocol Label Switching MPLS',
        'vpn': 'Virtual Private Network VPN',
        'ise': 'Identity Services Engine ISE',
        'dnac': 'DNA Center DNAC',
        'sdwan': 'Software-Defined WAN SD-WAN',
    }

    def enrich_query(self, query: str) -> str:
        """Enrich query with expanded abbreviations.

        Args:
            query: Original query.

        Returns:
            Query with abbreviations expanded.
        """
        enriched = query.lower()
        for abbrev, expansion in self.ABBREVIATIONS.items():
            if abbrev in enriched and expansion.lower() not in enriched:
                # Add expansion in parentheses after first occurrence
                enriched = enriched.replace(abbrev, f"{abbrev} ({expansion})", 1)
        return enriched

    async def expand_with_hyde(
        self,
        query: str,
        context: Optional[str] = None,
    ) -> str:
        """Generate Cisco-specific hypothetical document."""
        # Enrich query with abbreviation expansions
        enriched_query = self.enrich_query(query)

        context_section = ""
        if context:
            context_section = f"\nEnvironment Context: {context}\n"

        prompt = f"""You are a senior Cisco network engineer writing official documentation.
Write a detailed technical answer to the following question.

Question: {enriched_query}
{context_section}
Your answer should:
1. Be written in the style of Cisco official documentation
2. Include specific CLI commands or API calls where relevant
3. Reference best practices and design considerations
4. Mention relevant Cisco products (Catalyst, Meraki, ISE, DNA Center) if applicable
5. Be 2-3 paragraphs of detailed technical content

Documentation:"""

        try:
            response = await self.llm_client.generate(
                prompt=prompt,
                max_tokens=600,
                temperature=0.3,
            )
            return response.strip()
        except Exception as e:
            logger.warning(f"Cisco HyDE generation failed: {e}")
            return query

    async def expand_multi_query(
        self,
        query: str,
        num_variations: int = 3,
    ) -> List[str]:
        """Generate Cisco-specific query variations."""
        enriched_query = self.enrich_query(query)

        prompt = f"""Generate {num_variations} alternative ways to search for information about this Cisco networking question.

Original: {enriched_query}

Each variation should:
- Use different Cisco-specific terminology
- Consider different product perspectives (Catalyst CLI, Meraki Dashboard, DNA Center)
- Include relevant protocol or feature keywords
- Be a complete, searchable question

Variations (one per line, no numbering):"""

        try:
            response = await self.llm_client.generate(
                prompt=prompt,
                max_tokens=400,
                temperature=0.7,
            )

            variations = []
            for line in response.strip().split('\n'):
                line = line.strip()
                if line and len(line) > 10:  # Filter out very short lines
                    # Remove common prefixes
                    for prefix in ['- ', '• ', '* ']:
                        if line.startswith(prefix):
                            line = line[len(prefix):]
                    # Remove numbering
                    if line[0].isdigit() and (line[1] == '.' or line[1] == ')'):
                        line = line[2:].strip()
                    if line:
                        variations.append(line)

            return variations[:num_variations]

        except Exception as e:
            logger.warning(f"Cisco multi-query expansion failed: {e}")
            return []


# Singleton instances
_query_expander: Optional[QueryExpander] = None
_cisco_query_expander: Optional[CiscoQueryExpander] = None


def get_query_expander() -> QueryExpander:
    """Get or create the QueryExpander singleton."""
    global _query_expander
    if _query_expander is None:
        _query_expander = QueryExpander()
    return _query_expander


def get_cisco_query_expander() -> CiscoQueryExpander:
    """Get or create the CiscoQueryExpander singleton."""
    global _cisco_query_expander
    if _cisco_query_expander is None:
        _cisco_query_expander = CiscoQueryExpander()
    return _cisco_query_expander


# =============================================================================
# Fast Synonym Expansion (No LLM Required)
# =============================================================================

def fast_expand_query(query: str, max_expansions: int = 3) -> str:
    """Quickly expand a query with synonyms (no LLM call).

    This is a fast, lightweight expansion using the CISCO_SYNONYMS dictionary.
    Use this for real-time query expansion without latency.

    Args:
        query: The original user query.
        max_expansions: Maximum synonym expansions per matched term.

    Returns:
        Expanded query string with synonyms appended.
    """
    query_lower = query.lower()
    expansions: Set[str] = set()

    # Find all matching terms in the query
    for term, synonyms in _SYNONYM_LOOKUP.items():
        # Check for whole word match
        pattern = r'\b' + re.escape(term) + r'\b'
        if re.search(pattern, query_lower):
            # Add up to max_expansions synonyms
            for i, syn in enumerate(sorted(synonyms)):
                if i >= max_expansions:
                    break
                # Don't add if synonym is already in query
                syn_pattern = r'\b' + re.escape(syn) + r'\b'
                if not re.search(syn_pattern, query_lower):
                    expansions.add(syn)

    if not expansions:
        return query

    # Build expanded query with OR operator for search
    expansion_text = " OR ".join(sorted(expansions)[:6])
    return f"{query} ({expansion_text})"


def fast_expand_for_embedding(query: str) -> str:
    """Expand query for embedding generation (cleaner format).

    Unlike fast_expand_query, this produces a cleaner expansion
    suitable for embedding without OR operators.

    Args:
        query: The original query.

    Returns:
        Expanded query text.
    """
    query_lower = query.lower()
    additional_terms: List[str] = []

    # Add the most relevant synonym for each matched term
    for term, synonyms in _SYNONYM_LOOKUP.items():
        pattern = r'\b' + re.escape(term) + r'\b'
        if re.search(pattern, query_lower):
            # Add the first synonym not already in query
            for syn in sorted(synonyms, key=len, reverse=True):  # Prefer longer synonyms
                if syn not in query_lower and len(syn) > 2:
                    additional_terms.append(syn)
                    break

    if additional_terms:
        return f"{query} {' '.join(additional_terms[:3])}"
    return query


def get_synonyms(term: str) -> List[str]:
    """Get synonyms for a specific term.

    Args:
        term: The term to find synonyms for.

    Returns:
        List of synonyms.
    """
    term_lower = term.lower()
    if term_lower in _SYNONYM_LOOKUP:
        return sorted(_SYNONYM_LOOKUP[term_lower])
    return []


def extract_product_filters(query: str) -> Tuple[str, List[str]]:
    """Extract product filters from query.

    Identifies Cisco product mentions and returns them as potential filters.

    Args:
        query: The original query.

    Returns:
        Tuple of (query, product_filters).
    """
    products = []
    query_lower = query.lower()

    # Product patterns
    product_patterns = {
        "meraki": r'\b(meraki|mx\d+|ms\d+|mr\d+|mv\d+)\b',
        "catalyst": r'\b(catalyst|cat\s*\d+|c9\d+)\b',
        "ise": r'\b(ise|identity\s+services?\s+engine)\b',
        "thousandeyes": r'\b(thousandeyes|thousand\s*eyes)\b',
        "ios-xe": r'\b(ios[\-\s]?xe|cisco\s+ios)\b',
    }

    for product, pattern in product_patterns.items():
        if re.search(pattern, query_lower, re.IGNORECASE):
            products.append(product)

    return query, products
