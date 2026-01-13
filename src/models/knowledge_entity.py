"""Knowledge graph entity and relationship models.

Enables relationship-aware retrieval and multi-hop reasoning by storing:
- Named entities (devices, protocols, products, concepts)
- Relationships between entities
- Entity-chunk associations

Graph Structure:
    [Document] --contains--> [Chunk]
    [Chunk] --mentions--> [Entity]
    [Entity] --related_to--> [Entity]
    [Chunk] --references--> [Chunk]
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Index, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field

from src.config.database import Base

# Try to import pgvector
try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    Vector = lambda dim: Text  # noqa: E731
    PGVECTOR_AVAILABLE = False


# =============================================================================
# Entity Types
# =============================================================================

class EntityType:
    """Standard entity types for Cisco networking domain."""
    DEVICE = "device"           # Catalyst 9300, Meraki MR46
    PROTOCOL = "protocol"       # BGP, OSPF, 802.1X
    PRODUCT = "product"         # Cisco DNA Center, ISE
    CONCEPT = "concept"         # VLAN, QoS, NAT
    COMMAND = "command"         # CLI commands
    API_ENDPOINT = "api_endpoint"  # REST API endpoints
    FEATURE = "feature"         # Features like "StackWise Virtual"
    TECHNOLOGY = "technology"   # SD-WAN, ACI, etc.


class RelationshipType:
    """Standard relationship types."""
    RELATED_TO = "related_to"           # General relationship
    REQUIRES = "requires"               # X requires Y
    CONFIGURES = "configures"           # Command configures feature
    IMPLEMENTS = "implements"           # Protocol implements concept
    PART_OF = "part_of"                 # Entity is part of another
    REPLACES = "replaces"               # Deprecated by / replaced by
    COMPATIBLE_WITH = "compatible_with" # Hardware/software compatibility
    USES = "uses"                       # Feature uses protocol
    DEPENDS_ON = "depends_on"           # Dependency relationship
    SEE_ALSO = "see_also"               # Documentation cross-reference


# =============================================================================
# SQLAlchemy Models
# =============================================================================

class KnowledgeEntity(Base):
    """A named entity in the knowledge graph.

    Entities represent key concepts, products, protocols, and devices
    mentioned across the knowledge base.
    """
    __tablename__ = "knowledge_entities"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    normalized_name = Column(String(255), nullable=False, index=True)  # Lowercase, no special chars
    entity_type = Column(String(50), nullable=False, index=True)
    description = Column(Text)

    # Entity metadata
    aliases = Column(JSON, default=list)  # Alternative names ["BGP", "Border Gateway Protocol"]
    properties = Column(JSON, default=dict)  # Type-specific properties
    source_count = Column(Integer, default=1)  # Number of documents mentioning this entity

    # Optional embedding for entity similarity
    embedding = Column(Vector(384) if PGVECTOR_AVAILABLE else Text)  # e5-small-v2 local model

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    outgoing_relationships = relationship(
        "KnowledgeRelationship",
        foreign_keys="KnowledgeRelationship.source_entity_id",
        back_populates="source_entity",
        cascade="all, delete-orphan"
    )
    incoming_relationships = relationship(
        "KnowledgeRelationship",
        foreign_keys="KnowledgeRelationship.target_entity_id",
        back_populates="target_entity",
        cascade="all, delete-orphan"
    )
    chunk_mentions = relationship(
        "EntityChunkMention",
        back_populates="entity",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint('normalized_name', 'entity_type', name='uq_entity_name_type'),
        Index('idx_knowledge_entities_type', 'entity_type'),
        Index('idx_knowledge_entities_normalized_name', 'normalized_name'),
    )


class KnowledgeRelationship(Base):
    """A relationship between two entities.

    Captures semantic relationships like:
    - BGP --requires--> TCP
    - Catalyst 9300 --supports--> StackWise Virtual
    - show ip bgp --configures--> BGP
    """
    __tablename__ = "knowledge_relationships"

    id = Column(Integer, primary_key=True)
    source_entity_id = Column(Integer, ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False)
    target_entity_id = Column(Integer, ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(50), nullable=False, index=True)

    # Relationship metadata
    confidence = Column(Float, default=1.0)  # How confident we are in this relationship
    weight = Column(Float, default=1.0)  # Importance/strength of relationship
    properties = Column(JSON, default=dict)  # Additional properties
    source_chunk_id = Column(Integer, ForeignKey("knowledge_chunks.id", ondelete="SET NULL"))  # Where we found this

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    source_entity = relationship(
        "KnowledgeEntity",
        foreign_keys=[source_entity_id],
        back_populates="outgoing_relationships"
    )
    target_entity = relationship(
        "KnowledgeEntity",
        foreign_keys=[target_entity_id],
        back_populates="incoming_relationships"
    )

    __table_args__ = (
        Index('idx_knowledge_relationships_source', 'source_entity_id'),
        Index('idx_knowledge_relationships_target', 'target_entity_id'),
        Index('idx_knowledge_relationships_type', 'relationship_type'),
        UniqueConstraint('source_entity_id', 'target_entity_id', 'relationship_type',
                        name='uq_relationship'),
    )


class EntityChunkMention(Base):
    """Tracks where entities are mentioned in chunks.

    This enables:
    - Finding all chunks that mention an entity
    - Finding all entities in a chunk
    - Building context around entities
    """
    __tablename__ = "entity_chunk_mentions"

    id = Column(Integer, primary_key=True)
    entity_id = Column(Integer, ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False)
    chunk_id = Column(Integer, ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), nullable=False)

    # Mention details
    mention_count = Column(Integer, default=1)  # Times entity appears in chunk
    mention_positions = Column(JSON, default=list)  # Character positions [{start, end}]
    context_snippet = Column(Text)  # Short context around the mention
    confidence = Column(Float, default=1.0)  # Confidence this is actually the entity

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("KnowledgeEntity", back_populates="chunk_mentions")

    __table_args__ = (
        UniqueConstraint('entity_id', 'chunk_id', name='uq_entity_chunk'),
        Index('idx_entity_chunk_mentions_entity', 'entity_id'),
        Index('idx_entity_chunk_mentions_chunk', 'chunk_id'),
    )


class ChunkReference(Base):
    """Cross-references between chunks.

    Tracks when one chunk references content in another,
    enabling multi-hop retrieval.
    """
    __tablename__ = "chunk_references"

    id = Column(Integer, primary_key=True)
    source_chunk_id = Column(Integer, ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), nullable=False)
    target_chunk_id = Column(Integer, ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), nullable=False)

    # Reference details
    reference_type = Column(String(50), default="see_also")  # see_also, continues, prerequisite
    confidence = Column(Float, default=1.0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('source_chunk_id', 'target_chunk_id', name='uq_chunk_reference'),
        Index('idx_chunk_references_source', 'source_chunk_id'),
        Index('idx_chunk_references_target', 'target_chunk_id'),
    )


# =============================================================================
# Pydantic Schemas
# =============================================================================

class EntityCreate(BaseModel):
    """Schema for creating an entity."""
    name: str
    entity_type: str
    description: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)
    properties: dict = Field(default_factory=dict)


class EntityResponse(BaseModel):
    """Schema for entity API responses."""
    id: int
    name: str
    normalized_name: str
    entity_type: str
    description: Optional[str]
    aliases: List[str]
    source_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class RelationshipCreate(BaseModel):
    """Schema for creating a relationship."""
    source_entity_id: int
    target_entity_id: int
    relationship_type: str
    confidence: float = 1.0
    weight: float = 1.0
    properties: dict = Field(default_factory=dict)


class RelationshipResponse(BaseModel):
    """Schema for relationship API responses."""
    id: int
    source_entity_id: int
    target_entity_id: int
    relationship_type: str
    confidence: float
    weight: float
    created_at: datetime

    class Config:
        from_attributes = True


class EntityWithRelationships(BaseModel):
    """Entity with its relationships for graph queries."""
    entity: EntityResponse
    outgoing: List[RelationshipResponse] = Field(default_factory=list)
    incoming: List[RelationshipResponse] = Field(default_factory=list)
    related_entities: List[EntityResponse] = Field(default_factory=list)


class GraphNeighborhood(BaseModel):
    """A neighborhood in the knowledge graph around a query."""
    central_entities: List[EntityResponse]
    relationships: List[RelationshipResponse]
    related_chunks: List[int]  # Chunk IDs
    hop_depth: int = 1
