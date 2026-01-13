"""Entity extraction service for knowledge graph.

Extracts named entities from text for building the knowledge graph:
- Devices (Catalyst 9300, Meraki MR46)
- Protocols (BGP, OSPF, 802.1X)
- Products (Cisco DNA Center, ISE)
- Concepts (VLAN, QoS, NAT)
- Commands (CLI commands)
- API endpoints

Uses a combination of:
1. Pattern matching for known entity types
2. LLM-based extraction for complex entities
3. Entity normalization and deduplication
"""

import re
import logging
from typing import List, Dict, Set, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ExtractedEntity:
    """An entity extracted from text."""
    name: str
    entity_type: str
    normalized_name: str
    confidence: float = 1.0
    aliases: List[str] = field(default_factory=list)
    properties: Dict = field(default_factory=dict)
    positions: List[Tuple[int, int]] = field(default_factory=list)  # (start, end) positions


@dataclass
class ExtractedRelationship:
    """A relationship extracted from text."""
    source_name: str
    source_type: str
    target_name: str
    target_type: str
    relationship_type: str
    confidence: float = 1.0


@dataclass
class ExtractionResult:
    """Result of entity extraction."""
    entities: List[ExtractedEntity]
    relationships: List[ExtractedRelationship]
    raw_mentions: Dict[str, List[Tuple[int, int]]]  # name -> positions


class EntityExtractor:
    """Extracts entities and relationships from text.

    Optimized for Cisco networking documentation with
    comprehensive pattern libraries for common entity types.
    """

    def __init__(self):
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for entity extraction."""

        # Device patterns (hardware)
        self.device_patterns = [
            # Catalyst switches
            (r'\b(Catalyst\s+\d{4}[A-Z]*(?:-[A-Z0-9]+)?)\b', 'Catalyst'),
            (r'\b(C\d{4}[A-Z]*(?:-[A-Z0-9]+)?)\b', 'Catalyst'),  # Short form C9300
            # Meraki devices
            (r'\b(Meraki\s+(?:MR|MS|MX|MV|MT|MG|SM|Z)\d+[A-Z]*)\b', 'Meraki'),
            (r'\b(MR\d+[A-Z]*|MS\d+[A-Z]*|MX\d+[A-Z]*)\b', 'Meraki'),
            # Nexus switches
            (r'\b(Nexus\s+\d{4}[A-Z]*)\b', 'Nexus'),
            (r'\b(N\d[Kk]\s*-?\s*\d+)\b', 'Nexus'),
            # Routers
            (r'\b(ISR\s+\d{4}[A-Z]*)\b', 'ISR'),
            (r'\b(ASR\s+\d{4}[A-Z]*)\b', 'ASR'),
            (r'\b(CSR\s*\d+[Vv]?)\b', 'CSR'),
            # Wireless
            (r'\b(Aironet\s+\d{4}[A-Z]*)\b', 'Aironet'),
            (r'\b(AIR-[A-Z0-9]+-[A-Z0-9]+)\b', 'Aironet'),
            # Firewalls
            (r'\b(ASA\s+\d{4}[A-Z]*)\b', 'ASA'),
            (r'\b(Firepower\s+\d{4})\b', 'Firepower'),
            (r'\b(FTD\s*\d*)\b', 'Firepower'),
        ]

        # Protocol patterns
        self.protocol_patterns = [
            # Routing
            (r'\b(BGP|eBGP|iBGP)\b', 'routing'),
            (r'\b(OSPF(?:v[23])?)\b', 'routing'),
            (r'\b(EIGRP)\b', 'routing'),
            (r'\b(RIP(?:v[12])?|RIPng)\b', 'routing'),
            (r'\b(IS-IS)\b', 'routing'),
            (r'\b(MPLS(?:-TE)?)\b', 'routing'),
            # Switching
            (r'\b(STP|RSTP|MSTP|PVST\+?|Rapid-PVST\+?)\b', 'switching'),
            (r'\b(VTP)\b', 'switching'),
            (r'\b(DTP)\b', 'switching'),
            (r'\b(LACP|PAgP)\b', 'switching'),
            (r'\b(LLDP|CDP)\b', 'discovery'),
            # First-hop redundancy
            (r'\b(HSRP(?:v[12])?)\b', 'fhrp'),
            (r'\b(VRRP(?:v[23])?)\b', 'fhrp'),
            (r'\b(GLBP)\b', 'fhrp'),
            # Security
            (r'\b(802\.1[Xx])\b', 'security'),
            (r'\b(RADIUS)\b', 'security'),
            (r'\b(TACACS\+?)\b', 'security'),
            (r'\b(MAB)\b', 'security'),
            (r'\b(MACsec|MACSec)\b', 'security'),
            (r'\b(IPsec|IKE(?:v[12])?)\b', 'security'),
            # Management
            (r'\b(SNMP(?:v[123])?)\b', 'management'),
            (r'\b(NetFlow|IPFIX|sFlow)\b', 'management'),
            (r'\b(Syslog)\b', 'management'),
            (r'\b(NTP)\b', 'management'),
            (r'\b(SSH|Telnet)\b', 'management'),
            # Automation
            (r'\b(RESTCONF|NETCONF)\b', 'automation'),
            (r'\b(gRPC|gNMI)\b', 'automation'),
            (r'\b(YANG)\b', 'automation'),
            # Other
            (r'\b(DHCP(?:v[46])?)\b', 'services'),
            (r'\b(DNS)\b', 'services'),
            (r'\b(QoS|DSCP|CoS)\b', 'qos'),
            (r'\b(SPAN|RSPAN|ERSPAN)\b', 'monitoring'),
        ]

        # Product patterns (software/platforms)
        self.product_patterns = [
            (r'\b(Cisco\s+DNA\s+Center|DNAC)\b', 'management'),
            (r'\b(Cisco\s+ISE|Identity\s+Services\s+Engine)\b', 'security'),
            (r'\b(Cisco\s+SD-WAN|vManage|vSmart|vBond|vEdge)\b', 'sdwan'),
            (r'\b(Cisco\s+ACI|Application\s+Centric\s+Infrastructure)\b', 'datacenter'),
            (r'\b(Cisco\s+UCS)\b', 'compute'),
            (r'\b(Cisco\s+Webex)\b', 'collaboration'),
            (r'\b(Cisco\s+Duo)\b', 'security'),
            (r'\b(Cisco\s+Umbrella)\b', 'security'),
            (r'\b(Cisco\s+SecureX)\b', 'security'),
            (r'\b(Cisco\s+ThousandEyes)\b', 'monitoring'),
            (r'\b(Meraki\s+Dashboard)\b', 'management'),
            (r'\b(Prime\s+Infrastructure)\b', 'management'),
            (r'\b(Stealthwatch|Secure\s+Network\s+Analytics)\b', 'security'),
        ]

        # Concept patterns
        self.concept_patterns = [
            (r'\b(VLAN\s*\d*)\b', 'networking'),
            (r'\b(VRF)\b', 'networking'),
            (r'\b(ACL|Access[\s-]?Control[\s-]?List)\b', 'security'),
            (r'\b(NAT|PAT|SNAT|DNAT)\b', 'networking'),
            (r'\b(VPN|DMVPN|GETVPN|FlexVPN)\b', 'vpn'),
            (r'\b(SD-Access)\b', 'sdaccess'),
            (r'\b(StackWise(?:\s+Virtual)?)\b', 'stacking'),
            (r'\b(VSS)\b', 'stacking'),
            (r'\b(VPC|vPC)\b', 'datacenter'),
            (r'\b(fabric|underlay|overlay)\b', 'architecture'),
            (r'\b(zero[\s-]?trust)\b', 'security'),
            (r'\b(micro[\s-]?segmentation)\b', 'security'),
        ]

        # CLI command patterns
        self.command_patterns = [
            (r'\b(show\s+(?:ip\s+)?(?:interface|route|bgp|ospf|running-config|version|inventory)[^\n]*)\b', 'show'),
            (r'\b(configure\s+terminal)\b', 'config'),
            (r'\b(interface\s+(?:GigabitEthernet|FastEthernet|TenGigabitEthernet|Vlan|Loopback)\s*[\d/]+)\b', 'config'),
            (r'\b(router\s+(?:bgp|ospf|eigrp)\s+\d+)\b', 'config'),
            (r'\b(ip\s+(?:address|route|access-list)[^\n]*)\b', 'config'),
        ]

        # API endpoint patterns
        self.api_patterns = [
            (r'((?:GET|POST|PUT|DELETE|PATCH)\s+/api/v\d+/[a-zA-Z0-9/_-]+)', 'rest'),
            (r'(/api/v\d+/(?:networks|organizations|devices|ssids|vlans)[a-zA-Z0-9/_-]*)', 'meraki'),
            (r'(/dna/intent/api/v\d+/[a-zA-Z0-9/_-]+)', 'dnac'),
        ]

    def normalize_name(self, name: str) -> str:
        """Normalize entity name for deduplication.

        Args:
            name: Raw entity name.

        Returns:
            Normalized lowercase name without special characters.
        """
        # Lowercase
        normalized = name.lower()
        # Remove extra whitespace
        normalized = ' '.join(normalized.split())
        # Keep alphanumeric, spaces, and hyphens
        normalized = re.sub(r'[^a-z0-9\s-]', '', normalized)
        return normalized.strip()

    def extract_entities(self, text: str) -> ExtractionResult:
        """Extract all entities from text.

        Args:
            text: Text to extract entities from.

        Returns:
            ExtractionResult with entities and relationships.
        """
        entities: Dict[str, ExtractedEntity] = {}
        relationships: List[ExtractedRelationship] = []
        raw_mentions: Dict[str, List[Tuple[int, int]]] = {}

        # Extract devices
        for pattern, device_family in self.device_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                name = match.group(1)
                normalized = self.normalize_name(name)
                pos = (match.start(), match.end())

                if normalized not in entities:
                    entities[normalized] = ExtractedEntity(
                        name=name,
                        entity_type="device",
                        normalized_name=normalized,
                        properties={"family": device_family},
                        positions=[pos]
                    )
                else:
                    entities[normalized].positions.append(pos)

                raw_mentions.setdefault(name, []).append(pos)

        # Extract protocols
        for pattern, protocol_category in self.protocol_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                name = match.group(1)
                normalized = self.normalize_name(name)
                pos = (match.start(), match.end())

                if normalized not in entities:
                    entities[normalized] = ExtractedEntity(
                        name=name.upper(),  # Protocols typically uppercase
                        entity_type="protocol",
                        normalized_name=normalized,
                        properties={"category": protocol_category},
                        positions=[pos]
                    )
                else:
                    entities[normalized].positions.append(pos)

                raw_mentions.setdefault(name, []).append(pos)

        # Extract products
        for pattern, product_category in self.product_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                name = match.group(1)
                normalized = self.normalize_name(name)
                pos = (match.start(), match.end())

                if normalized not in entities:
                    entities[normalized] = ExtractedEntity(
                        name=name,
                        entity_type="product",
                        normalized_name=normalized,
                        properties={"category": product_category},
                        positions=[pos]
                    )
                else:
                    entities[normalized].positions.append(pos)

                raw_mentions.setdefault(name, []).append(pos)

        # Extract concepts
        for pattern, concept_category in self.concept_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                name = match.group(1)
                normalized = self.normalize_name(name)
                pos = (match.start(), match.end())

                if normalized not in entities:
                    entities[normalized] = ExtractedEntity(
                        name=name,
                        entity_type="concept",
                        normalized_name=normalized,
                        properties={"category": concept_category},
                        positions=[pos]
                    )
                else:
                    entities[normalized].positions.append(pos)

                raw_mentions.setdefault(name, []).append(pos)

        # Extract commands
        for pattern, command_type in self.command_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                name = match.group(1).strip()
                normalized = self.normalize_name(name)
                pos = (match.start(), match.end())

                if normalized not in entities:
                    entities[normalized] = ExtractedEntity(
                        name=name,
                        entity_type="command",
                        normalized_name=normalized,
                        properties={"type": command_type},
                        positions=[pos]
                    )
                else:
                    entities[normalized].positions.append(pos)

        # Extract API endpoints
        for pattern, api_type in self.api_patterns:
            for match in re.finditer(pattern, text):
                name = match.group(1).strip()
                normalized = self.normalize_name(name)
                pos = (match.start(), match.end())

                if normalized not in entities:
                    entities[normalized] = ExtractedEntity(
                        name=name,
                        entity_type="api_endpoint",
                        normalized_name=normalized,
                        properties={"api_type": api_type},
                        positions=[pos]
                    )
                else:
                    entities[normalized].positions.append(pos)

        # Extract relationships from co-occurrence
        relationships = self._extract_relationships(text, list(entities.values()))

        return ExtractionResult(
            entities=list(entities.values()),
            relationships=relationships,
            raw_mentions=raw_mentions
        )

    def _extract_relationships(
        self,
        text: str,
        entities: List[ExtractedEntity]
    ) -> List[ExtractedRelationship]:
        """Extract relationships between entities based on text patterns.

        Args:
            text: Source text.
            entities: Extracted entities.

        Returns:
            List of extracted relationships.
        """
        relationships = []

        # Relationship patterns
        relationship_patterns = [
            # X requires Y
            (r'(\w+)\s+(?:requires?|needs?|depends?\s+on)\s+(\w+)', 'requires'),
            # X uses Y
            (r'(\w+)\s+(?:uses?|utilizes?|leverages?)\s+(\w+)', 'uses'),
            # X configures Y
            (r'(\w+)\s+(?:configures?|enables?|sets?\s+up)\s+(\w+)', 'configures'),
            # X is part of Y
            (r'(\w+)\s+(?:is\s+part\s+of|belongs?\s+to)\s+(\w+)', 'part_of'),
            # X supports Y
            (r'(\w+)\s+(?:supports?|implements?)\s+(\w+)', 'implements'),
            # X replaces Y
            (r'(\w+)\s+(?:replaces?|supersedes?|deprecates?)\s+(\w+)', 'replaces'),
            # X with Y
            (r'(\w+)\s+with\s+(\w+)', 'related_to'),
        ]

        # Build entity lookup by normalized name
        entity_lookup = {e.normalized_name: e for e in entities}

        for pattern, rel_type in relationship_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                source_text = match.group(1).lower()
                target_text = match.group(2).lower()

                # Try to match to known entities
                source_entity = entity_lookup.get(self.normalize_name(source_text))
                target_entity = entity_lookup.get(self.normalize_name(target_text))

                if source_entity and target_entity and source_entity != target_entity:
                    relationships.append(ExtractedRelationship(
                        source_name=source_entity.name,
                        source_type=source_entity.entity_type,
                        target_name=target_entity.name,
                        target_type=target_entity.entity_type,
                        relationship_type=rel_type,
                        confidence=0.7  # Pattern-based extraction has moderate confidence
                    ))

        # Also extract co-occurrence relationships (entities in same sentence)
        sentences = re.split(r'[.!?]\s+', text)
        for sentence in sentences:
            sentence_entities = []
            for entity in entities:
                if entity.name.lower() in sentence.lower():
                    sentence_entities.append(entity)

            # Create related_to relationships for co-occurring entities
            for i, e1 in enumerate(sentence_entities):
                for e2 in sentence_entities[i+1:]:
                    if e1.entity_type != e2.entity_type:  # Different types more likely related
                        relationships.append(ExtractedRelationship(
                            source_name=e1.name,
                            source_type=e1.entity_type,
                            target_name=e2.name,
                            target_type=e2.entity_type,
                            relationship_type='related_to',
                            confidence=0.5  # Co-occurrence has lower confidence
                        ))

        # Deduplicate relationships
        seen = set()
        unique_relationships = []
        for rel in relationships:
            key = (rel.source_name, rel.target_name, rel.relationship_type)
            if key not in seen:
                seen.add(key)
                unique_relationships.append(rel)

        return unique_relationships

    def extract_from_query(self, query: str) -> List[ExtractedEntity]:
        """Extract entities from a search query.

        Optimized for shorter text with higher recall.

        Args:
            query: Search query text.

        Returns:
            List of entities found in the query.
        """
        result = self.extract_entities(query)
        return result.entities

    def get_entity_context(
        self,
        text: str,
        entity: ExtractedEntity,
        context_chars: int = 100
    ) -> str:
        """Get context snippet around an entity mention.

        Args:
            text: Source text.
            entity: Entity to get context for.
            context_chars: Characters of context on each side.

        Returns:
            Context snippet with entity highlighted.
        """
        if not entity.positions:
            return ""

        # Use first position
        start, end = entity.positions[0]
        context_start = max(0, start - context_chars)
        context_end = min(len(text), end + context_chars)

        snippet = text[context_start:context_end]

        # Add ellipsis if truncated
        if context_start > 0:
            snippet = "..." + snippet
        if context_end < len(text):
            snippet = snippet + "..."

        return snippet


# Singleton instance
_entity_extractor: Optional[EntityExtractor] = None


def get_entity_extractor() -> EntityExtractor:
    """Get or create the EntityExtractor singleton."""
    global _entity_extractor
    if _entity_extractor is None:
        _entity_extractor = EntityExtractor()
    return _entity_extractor
