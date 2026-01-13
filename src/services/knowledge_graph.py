"""Knowledge graph service for entity and relationship management.

Provides:
- Entity storage and retrieval
- Relationship management
- Graph traversal queries
- Entity-enhanced chunk retrieval
"""

import logging
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime

from sqlalchemy import select, text, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from src.models.knowledge_entity import (
    KnowledgeEntity,
    KnowledgeRelationship,
    EntityChunkMention,
    ChunkReference,
    EntityResponse,
    RelationshipResponse,
    EntityWithRelationships,
    GraphNeighborhood,
)
from src.services.entity_extractor import (
    EntityExtractor,
    get_entity_extractor,
    ExtractedEntity,
    ExtractedRelationship,
    ExtractionResult,
)

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    """Service for managing the knowledge graph.

    Handles entity storage, relationship management, and graph queries
    for enhanced retrieval.
    """

    def __init__(self, entity_extractor: Optional[EntityExtractor] = None):
        """Initialize the knowledge graph service.

        Args:
            entity_extractor: Entity extraction service.
        """
        self._entity_extractor = entity_extractor

    @property
    def entity_extractor(self) -> EntityExtractor:
        """Lazy-load entity extractor."""
        if self._entity_extractor is None:
            self._entity_extractor = get_entity_extractor()
        return self._entity_extractor

    # =========================================================================
    # Entity Management
    # =========================================================================

    async def get_or_create_entity(
        self,
        session: AsyncSession,
        name: str,
        entity_type: str,
        normalized_name: Optional[str] = None,
        description: Optional[str] = None,
        aliases: Optional[List[str]] = None,
        properties: Optional[Dict] = None,
    ) -> KnowledgeEntity:
        """Get existing entity or create new one.

        Uses upsert semantics to handle concurrent creation.

        Args:
            session: Database session.
            name: Entity display name.
            entity_type: Type of entity.
            normalized_name: Normalized name for matching.
            description: Entity description.
            aliases: Alternative names.
            properties: Additional properties.

        Returns:
            The entity (existing or newly created).
        """
        if normalized_name is None:
            normalized_name = self.entity_extractor.normalize_name(name)

        # Try to find existing entity
        result = await session.execute(
            select(KnowledgeEntity).where(
                and_(
                    KnowledgeEntity.normalized_name == normalized_name,
                    KnowledgeEntity.entity_type == entity_type
                )
            )
        )
        entity = result.scalar_one_or_none()

        if entity:
            # Update source count
            entity.source_count += 1
            entity.updated_at = datetime.utcnow()

            # Merge aliases
            if aliases:
                existing_aliases = set(entity.aliases or [])
                existing_aliases.update(aliases)
                entity.aliases = list(existing_aliases)

            # Merge properties
            if properties:
                existing_props = entity.properties or {}
                existing_props.update(properties)
                entity.properties = existing_props

            return entity

        # Create new entity
        entity = KnowledgeEntity(
            name=name,
            normalized_name=normalized_name,
            entity_type=entity_type,
            description=description,
            aliases=aliases or [],
            properties=properties or {},
            source_count=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(entity)
        await session.flush()

        logger.debug(f"Created entity: {name} ({entity_type})")
        return entity

    async def find_entity(
        self,
        session: AsyncSession,
        name: str,
        entity_type: Optional[str] = None,
    ) -> Optional[KnowledgeEntity]:
        """Find entity by name.

        Searches normalized name and aliases.

        Args:
            session: Database session.
            name: Entity name to search for.
            entity_type: Optional type filter.

        Returns:
            Entity if found, None otherwise.
        """
        normalized = self.entity_extractor.normalize_name(name)

        query = select(KnowledgeEntity).where(
            or_(
                KnowledgeEntity.normalized_name == normalized,
                KnowledgeEntity.aliases.contains([name])
            )
        )

        if entity_type:
            query = query.where(KnowledgeEntity.entity_type == entity_type)

        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def search_entities(
        self,
        session: AsyncSession,
        query: str,
        entity_types: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[KnowledgeEntity]:
        """Search entities by name pattern.

        Args:
            session: Database session.
            query: Search query (supports LIKE patterns).
            entity_types: Optional type filters.
            limit: Maximum results.

        Returns:
            Matching entities.
        """
        normalized = self.entity_extractor.normalize_name(query)

        sql_query = select(KnowledgeEntity).where(
            or_(
                KnowledgeEntity.normalized_name.ilike(f"%{normalized}%"),
                KnowledgeEntity.name.ilike(f"%{query}%")
            )
        )

        if entity_types:
            sql_query = sql_query.where(KnowledgeEntity.entity_type.in_(entity_types))

        sql_query = sql_query.order_by(KnowledgeEntity.source_count.desc()).limit(limit)

        result = await session.execute(sql_query)
        return list(result.scalars().all())

    # =========================================================================
    # Relationship Management
    # =========================================================================

    async def add_relationship(
        self,
        session: AsyncSession,
        source_entity_id: int,
        target_entity_id: int,
        relationship_type: str,
        confidence: float = 1.0,
        weight: float = 1.0,
        properties: Optional[Dict] = None,
        source_chunk_id: Optional[int] = None,
    ) -> KnowledgeRelationship:
        """Add a relationship between entities.

        Uses upsert to update existing relationships.

        Args:
            session: Database session.
            source_entity_id: Source entity ID.
            target_entity_id: Target entity ID.
            relationship_type: Type of relationship.
            confidence: Confidence score.
            weight: Relationship weight.
            properties: Additional properties.
            source_chunk_id: Chunk where relationship was found.

        Returns:
            The relationship.
        """
        # Check for existing relationship
        result = await session.execute(
            select(KnowledgeRelationship).where(
                and_(
                    KnowledgeRelationship.source_entity_id == source_entity_id,
                    KnowledgeRelationship.target_entity_id == target_entity_id,
                    KnowledgeRelationship.relationship_type == relationship_type
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update confidence/weight if new values are higher
            existing.confidence = max(existing.confidence, confidence)
            existing.weight = max(existing.weight, weight)
            existing.updated_at = datetime.utcnow()
            if properties:
                existing.properties = {**(existing.properties or {}), **properties}
            return existing

        # Create new relationship
        relationship = KnowledgeRelationship(
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relationship_type=relationship_type,
            confidence=confidence,
            weight=weight,
            properties=properties or {},
            source_chunk_id=source_chunk_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(relationship)
        await session.flush()

        return relationship

    async def get_entity_relationships(
        self,
        session: AsyncSession,
        entity_id: int,
        relationship_types: Optional[List[str]] = None,
        direction: str = "both",  # "outgoing", "incoming", "both"
    ) -> List[KnowledgeRelationship]:
        """Get relationships for an entity.

        Args:
            session: Database session.
            entity_id: Entity ID.
            relationship_types: Optional type filters.
            direction: Relationship direction.

        Returns:
            List of relationships.
        """
        queries = []

        if direction in ("outgoing", "both"):
            q = select(KnowledgeRelationship).where(
                KnowledgeRelationship.source_entity_id == entity_id
            )
            if relationship_types:
                q = q.where(KnowledgeRelationship.relationship_type.in_(relationship_types))
            queries.append(q)

        if direction in ("incoming", "both"):
            q = select(KnowledgeRelationship).where(
                KnowledgeRelationship.target_entity_id == entity_id
            )
            if relationship_types:
                q = q.where(KnowledgeRelationship.relationship_type.in_(relationship_types))
            queries.append(q)

        relationships = []
        for query in queries:
            result = await session.execute(query)
            relationships.extend(result.scalars().all())

        return relationships

    # =========================================================================
    # Entity-Chunk Associations
    # =========================================================================

    async def add_entity_mention(
        self,
        session: AsyncSession,
        entity_id: int,
        chunk_id: int,
        mention_count: int = 1,
        positions: Optional[List[Dict]] = None,
        context_snippet: Optional[str] = None,
        confidence: float = 1.0,
    ) -> EntityChunkMention:
        """Record an entity mention in a chunk.

        Args:
            session: Database session.
            entity_id: Entity ID.
            chunk_id: Chunk ID.
            mention_count: Number of times entity appears.
            positions: Character positions of mentions.
            context_snippet: Context around the mention.
            confidence: Confidence score.

        Returns:
            The mention record.
        """
        # Check for existing mention
        result = await session.execute(
            select(EntityChunkMention).where(
                and_(
                    EntityChunkMention.entity_id == entity_id,
                    EntityChunkMention.chunk_id == chunk_id
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update counts
            existing.mention_count = mention_count
            if positions:
                existing.mention_positions = positions
            if context_snippet:
                existing.context_snippet = context_snippet
            return existing

        # Create new mention
        mention = EntityChunkMention(
            entity_id=entity_id,
            chunk_id=chunk_id,
            mention_count=mention_count,
            mention_positions=positions or [],
            context_snippet=context_snippet,
            confidence=confidence,
            created_at=datetime.utcnow(),
        )
        session.add(mention)
        await session.flush()

        return mention

    async def get_chunks_for_entity(
        self,
        session: AsyncSession,
        entity_id: int,
        limit: int = 20,
    ) -> List[int]:
        """Get chunk IDs that mention an entity.

        Args:
            session: Database session.
            entity_id: Entity ID.
            limit: Maximum results.

        Returns:
            List of chunk IDs.
        """
        result = await session.execute(
            select(EntityChunkMention.chunk_id)
            .where(EntityChunkMention.entity_id == entity_id)
            .order_by(EntityChunkMention.mention_count.desc())
            .limit(limit)
        )
        return [row[0] for row in result.fetchall()]

    async def get_entities_in_chunk(
        self,
        session: AsyncSession,
        chunk_id: int,
    ) -> List[KnowledgeEntity]:
        """Get all entities mentioned in a chunk.

        Args:
            session: Database session.
            chunk_id: Chunk ID.

        Returns:
            List of entities.
        """
        result = await session.execute(
            select(KnowledgeEntity)
            .join(EntityChunkMention, EntityChunkMention.entity_id == KnowledgeEntity.id)
            .where(EntityChunkMention.chunk_id == chunk_id)
        )
        return list(result.scalars().all())

    # =========================================================================
    # Graph Traversal
    # =========================================================================

    async def get_neighborhood(
        self,
        session: AsyncSession,
        entity_ids: List[int],
        hops: int = 1,
        relationship_types: Optional[List[str]] = None,
    ) -> GraphNeighborhood:
        """Get the graph neighborhood around entities.

        Performs multi-hop traversal to find related entities and chunks.

        Args:
            session: Database session.
            entity_ids: Starting entity IDs.
            hops: Number of hops to traverse.
            relationship_types: Optional relationship type filter.

        Returns:
            GraphNeighborhood with entities, relationships, and chunks.
        """
        visited_entities: Set[int] = set(entity_ids)
        all_relationships: List[KnowledgeRelationship] = []
        frontier = set(entity_ids)

        for hop in range(hops):
            new_frontier: Set[int] = set()

            for entity_id in frontier:
                relationships = await self.get_entity_relationships(
                    session, entity_id, relationship_types
                )

                for rel in relationships:
                    all_relationships.append(rel)

                    # Add connected entities to frontier
                    if rel.source_entity_id not in visited_entities:
                        new_frontier.add(rel.source_entity_id)
                    if rel.target_entity_id not in visited_entities:
                        new_frontier.add(rel.target_entity_id)

            visited_entities.update(new_frontier)
            frontier = new_frontier

            if not frontier:
                break

        # Get entity details
        central_entities = []
        if visited_entities:
            result = await session.execute(
                select(KnowledgeEntity).where(KnowledgeEntity.id.in_(visited_entities))
            )
            entities = result.scalars().all()
            central_entities = [EntityResponse.model_validate(e) for e in entities]

        # Get related chunks
        chunk_ids: Set[int] = set()
        for entity_id in visited_entities:
            chunks = await self.get_chunks_for_entity(session, entity_id, limit=5)
            chunk_ids.update(chunks)

        return GraphNeighborhood(
            central_entities=central_entities,
            relationships=[RelationshipResponse.model_validate(r) for r in all_relationships],
            related_chunks=list(chunk_ids),
            hop_depth=hops,
        )

    async def find_path(
        self,
        session: AsyncSession,
        source_entity_id: int,
        target_entity_id: int,
        max_hops: int = 3,
    ) -> Optional[List[KnowledgeRelationship]]:
        """Find a path between two entities.

        Uses BFS to find shortest path.

        Args:
            session: Database session.
            source_entity_id: Starting entity.
            target_entity_id: Target entity.
            max_hops: Maximum path length.

        Returns:
            List of relationships forming the path, or None if no path.
        """
        if source_entity_id == target_entity_id:
            return []

        # BFS with path tracking
        visited = {source_entity_id}
        queue = [(source_entity_id, [])]

        for _ in range(max_hops):
            next_queue = []

            for current_id, path in queue:
                relationships = await self.get_entity_relationships(session, current_id)

                for rel in relationships:
                    # Get the other entity in the relationship
                    next_id = (rel.target_entity_id
                              if rel.source_entity_id == current_id
                              else rel.source_entity_id)

                    if next_id == target_entity_id:
                        return path + [rel]

                    if next_id not in visited:
                        visited.add(next_id)
                        next_queue.append((next_id, path + [rel]))

            queue = next_queue
            if not queue:
                break

        return None

    # =========================================================================
    # Bulk Operations
    # =========================================================================

    async def process_chunk_entities(
        self,
        session: AsyncSession,
        chunk_id: int,
        chunk_content: str,
    ) -> ExtractionResult:
        """Extract and store entities from a chunk.

        Args:
            session: Database session.
            chunk_id: Chunk ID.
            chunk_content: Chunk text content.

        Returns:
            Extraction result with created entities.
        """
        # Extract entities
        result = self.entity_extractor.extract_entities(chunk_content)

        # Store entities and create mentions
        entity_id_map: Dict[str, int] = {}

        for extracted in result.entities:
            entity = await self.get_or_create_entity(
                session=session,
                name=extracted.name,
                entity_type=extracted.entity_type,
                normalized_name=extracted.normalized_name,
                properties=extracted.properties,
                aliases=extracted.aliases,
            )
            entity_id_map[extracted.normalized_name] = entity.id

            # Create mention
            context = self.entity_extractor.get_entity_context(
                chunk_content, extracted, context_chars=50
            )
            await self.add_entity_mention(
                session=session,
                entity_id=entity.id,
                chunk_id=chunk_id,
                mention_count=len(extracted.positions),
                positions=[{"start": s, "end": e} for s, e in extracted.positions],
                context_snippet=context,
                confidence=extracted.confidence,
            )

        # Store relationships
        for rel in result.relationships:
            source_normalized = self.entity_extractor.normalize_name(rel.source_name)
            target_normalized = self.entity_extractor.normalize_name(rel.target_name)

            if source_normalized in entity_id_map and target_normalized in entity_id_map:
                await self.add_relationship(
                    session=session,
                    source_entity_id=entity_id_map[source_normalized],
                    target_entity_id=entity_id_map[target_normalized],
                    relationship_type=rel.relationship_type,
                    confidence=rel.confidence,
                    source_chunk_id=chunk_id,
                )

        await session.commit()
        return result

    async def get_graph_stats(self, session: AsyncSession) -> Dict:
        """Get knowledge graph statistics.

        Args:
            session: Database session.

        Returns:
            Statistics about the graph.
        """
        # Entity counts by type
        entity_result = await session.execute(
            text("""
                SELECT entity_type, COUNT(*) as count
                FROM knowledge_entities
                GROUP BY entity_type
            """)
        )
        entities_by_type = {row[0]: row[1] for row in entity_result.fetchall()}

        # Relationship counts by type
        rel_result = await session.execute(
            text("""
                SELECT relationship_type, COUNT(*) as count
                FROM knowledge_relationships
                GROUP BY relationship_type
            """)
        )
        relationships_by_type = {row[0]: row[1] for row in rel_result.fetchall()}

        # Total mentions
        mention_result = await session.execute(
            text("SELECT COUNT(*) FROM entity_chunk_mentions")
        )
        total_mentions = mention_result.scalar()

        return {
            "entities": {
                "total": sum(entities_by_type.values()),
                "by_type": entities_by_type,
            },
            "relationships": {
                "total": sum(relationships_by_type.values()),
                "by_type": relationships_by_type,
            },
            "mentions": total_mentions,
        }


# Singleton instance
_knowledge_graph_service: Optional[KnowledgeGraphService] = None


def get_knowledge_graph_service() -> KnowledgeGraphService:
    """Get or create the KnowledgeGraphService singleton."""
    global _knowledge_graph_service
    if _knowledge_graph_service is None:
        _knowledge_graph_service = KnowledgeGraphService()
    return _knowledge_graph_service
