"""Metadata extraction service for knowledge documents.

Extracts:
- Named entities (devices, protocols, products)
- Keywords using TF-IDF
- AI-generated summaries
"""

import re
import logging
from typing import List, Dict, Optional, Set
from dataclasses import dataclass, field
from collections import Counter

logger = logging.getLogger(__name__)


@dataclass
class ExtractedMetadata:
    """Metadata extracted from a text chunk."""
    entities: Dict[str, List[str]] = field(default_factory=dict)
    keywords: List[str] = field(default_factory=list)
    summary: Optional[str] = None
    topics: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "entities": self.entities,
            "keywords": self.keywords,
            "summary": self.summary,
            "topics": self.topics,
        }


class MetadataExtractor:
    """Extracts metadata from document content.

    Combines rule-based entity extraction with statistical
    keyword extraction and optional AI summarization.
    """

    def __init__(self):
        # Cisco product patterns
        self.product_patterns = [
            r'\b(Meraki\s+(?:MR|MS|MX|MV|MT|MG|SM)\d+[A-Z]*)\b',
            r'\b(Catalyst\s+\d{4}[A-Z]*)\b',
            r'\b(Nexus\s+\d{4}[A-Z]*)\b',
            r'\b(ISR\s+\d{4}[A-Z]*)\b',
            r'\b(ASR\s+\d{4}[A-Z]*)\b',
            r'\b(Cisco\s+(?:DNA|ISE|SD-WAN|ACI|UCS|Webex|Duo|Umbrella|Firepower|ASA|FTD|vManage|ThousandEyes))\b',
        ]

        # Protocol patterns
        self.protocol_patterns = [
            r'\b(BGP|OSPF|EIGRP|RIP|IS-IS)\b',
            r'\b(STP|RSTP|MSTP|PVST\+?)\b',
            r'\b(VLAN|VTP|DTP|LACP|PAgP)\b',
            r'\b(HSRP|VRRP|GLBP)\b',
            r'\b(SNMP|NetFlow|sFlow|IPFIX)\b',
            r'\b(SSH|Telnet|HTTPS?|TLS|SSL)\b',
            r'\b(RADIUS|TACACS\+?|802\.1[Xx])\b',
            r'\b(DHCP|DNS|NTP|TFTP)\b',
            r'\b(IPsec|GRE|DMVPN|GETVPN)\b',
            r'\b(QoS|DSCP|CoS|MPLS)\b',
            r'\b(REST|RESTCONF|NETCONF|gRPC|YANG)\b',
        ]

        # Concept patterns
        self.concept_patterns = [
            r'\b(VLAN\s+\d+)\b',
            r'\b(subnet|subnetting|CIDR)\b',
            r'\b(ACL|access[\s-]?list)\b',
            r'\b(NAT|PAT|SNAT|DNAT)\b',
            r'\b(firewall|IDS|IPS)\b',
            r'\b(load[\s-]?balanc(?:er|ing))\b',
            r'\b(high[\s-]?availability|HA|redundancy)\b',
            r'\b(failover|clustering)\b',
            r'\b(API|SDK|CLI)\b',
            r'\b(automation|orchestration)\b',
        ]

        # IP address pattern
        self.ip_pattern = r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:/\d{1,2})?)\b'

        # MAC address pattern
        self.mac_pattern = r'\b([0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5})\b'

        # Common stopwords for keyword extraction
        self.stopwords: Set[str] = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
            'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
            'we', 'us', 'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his',
            'hers', 'who', 'whom', 'which', 'what', 'where', 'when', 'why', 'how',
            'if', 'then', 'else', 'all', 'each', 'every', 'both', 'few', 'more',
            'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same', 'so',
            'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'any',
            'use', 'used', 'using', 'following', 'example', 'step', 'steps',
            'see', 'note', 'click', 'select', 'enter', 'type', 'page', 'section',
        }

    def extract(
        self,
        content: str,
        include_summary: bool = False,
        llm_client = None,
    ) -> ExtractedMetadata:
        """Extract metadata from text content.

        Args:
            content: Text content to analyze
            include_summary: Whether to generate AI summary
            llm_client: Optional LLM client for summarization

        Returns:
            ExtractedMetadata with entities, keywords, and optional summary
        """
        metadata = ExtractedMetadata()

        # Extract entities
        metadata.entities = self._extract_entities(content)

        # Extract keywords
        metadata.keywords = self._extract_keywords(content)

        # Determine topics based on entities and keywords
        metadata.topics = self._determine_topics(metadata.entities, metadata.keywords)

        # Generate summary if requested and LLM available
        if include_summary and llm_client:
            metadata.summary = self._generate_summary(content, llm_client)

        return metadata

    def _extract_entities(self, content: str) -> Dict[str, List[str]]:
        """Extract named entities from content."""
        entities: Dict[str, Set[str]] = {
            "products": set(),
            "protocols": set(),
            "concepts": set(),
            "ip_addresses": set(),
            "mac_addresses": set(),
        }

        # Extract products
        for pattern in self.product_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                entities["products"].add(match.strip())

        # Extract protocols
        for pattern in self.protocol_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                entities["protocols"].add(match.upper())

        # Extract concepts
        for pattern in self.concept_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                entities["concepts"].add(match.lower())

        # Extract IP addresses
        ip_matches = re.findall(self.ip_pattern, content)
        for match in ip_matches:
            # Validate IP address format
            parts = match.split('/')[0].split('.')
            if all(0 <= int(p) <= 255 for p in parts):
                entities["ip_addresses"].add(match)

        # Extract MAC addresses
        mac_matches = re.findall(self.mac_pattern, content)
        entities["mac_addresses"].update(mac_matches)

        # Convert sets to sorted lists
        return {k: sorted(v) for k, v in entities.items() if v}

    def _extract_keywords(self, content: str, top_k: int = 10) -> List[str]:
        """Extract keywords using TF-IDF-like scoring.

        Simple keyword extraction without external dependencies.
        """
        # Tokenize and clean
        words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9_-]*\b', content.lower())

        # Filter out stopwords and short words
        words = [
            w for w in words
            if w not in self.stopwords and len(w) > 2
        ]

        # Count frequencies
        word_counts = Counter(words)

        # Score by frequency (simple TF)
        total_words = len(words)
        if total_words == 0:
            return []

        scored_words = []
        for word, count in word_counts.items():
            # Boost multi-occurrence words
            tf = count / total_words

            # Boost technical terms (contain numbers or underscores)
            boost = 1.5 if re.search(r'[\d_-]', word) else 1.0

            # Boost capitalized words in original
            if re.search(rf'\b{re.escape(word)}\b', content, re.IGNORECASE):
                boost *= 1.2

            scored_words.append((word, tf * boost))

        # Sort by score and return top_k
        scored_words.sort(key=lambda x: x[1], reverse=True)
        return [word for word, _ in scored_words[:top_k]]

    def _determine_topics(
        self,
        entities: Dict[str, List[str]],
        keywords: List[str],
    ) -> List[str]:
        """Determine document topics based on entities and keywords."""
        topics = set()

        # Map entities to topics
        protocol_topics = {
            "BGP": "routing",
            "OSPF": "routing",
            "EIGRP": "routing",
            "STP": "switching",
            "VLAN": "switching",
            "802.1X": "security",
            "RADIUS": "security",
            "TACACS": "security",
            "ACL": "security",
            "NAT": "network-address-translation",
            "VPN": "vpn",
            "DMVPN": "vpn",
            "QoS": "qos",
            "SNMP": "monitoring",
            "NetFlow": "monitoring",
            "REST": "api",
            "NETCONF": "api",
            "YANG": "api",
        }

        for protocol in entities.get("protocols", []):
            for key, topic in protocol_topics.items():
                if key.upper() in protocol.upper():
                    topics.add(topic)

        # Check keywords for topic indicators
        keyword_topics = {
            "configuration": "configuration",
            "configure": "configuration",
            "troubleshoot": "troubleshooting",
            "debug": "troubleshooting",
            "error": "troubleshooting",
            "install": "installation",
            "upgrade": "upgrade",
            "migration": "migration",
            "security": "security",
            "performance": "performance",
            "monitor": "monitoring",
            "backup": "backup",
            "restore": "backup",
            "deploy": "deployment",
            "automat": "automation",
        }

        for keyword in keywords:
            for key, topic in keyword_topics.items():
                if key in keyword.lower():
                    topics.add(topic)

        return sorted(topics)

    async def _generate_summary(self, content: str, llm_client) -> Optional[str]:
        """Generate a brief summary using an LLM.

        Args:
            content: Text to summarize
            llm_client: LLM client with async generate method

        Returns:
            1-2 sentence summary
        """
        try:
            prompt = f"""Summarize the following technical documentation in 1-2 sentences.
Focus on the main topic and key actions or information.

Content:
{content[:2000]}

Summary:"""

            response = await llm_client.generate(prompt, max_tokens=100)
            return response.strip()

        except Exception as e:
            logger.warning(f"Failed to generate summary: {e}")
            return None

    def extract_batch(
        self,
        chunks: List[str],
    ) -> List[ExtractedMetadata]:
        """Extract metadata from multiple chunks.

        Args:
            chunks: List of text chunks

        Returns:
            List of ExtractedMetadata objects
        """
        return [self.extract(chunk) for chunk in chunks]


# Singleton instance
_metadata_extractor: Optional[MetadataExtractor] = None


def get_metadata_extractor() -> MetadataExtractor:
    """Get or create the MetadataExtractor singleton."""
    global _metadata_extractor
    if _metadata_extractor is None:
        _metadata_extractor = MetadataExtractor()
    return _metadata_extractor
