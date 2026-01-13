"""Knowledge base hygiene service.

Maintains knowledge base quality by detecting and removing:
- Duplicate chunks (semantically similar content)
- Low-quality chunks (below quality threshold)
- Orphaned chunks (no parent document)

Uses pgvector for semantic duplicate detection.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum

from sqlalchemy import select, delete, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.knowledge import KnowledgeDocument, KnowledgeChunk
from src.services.chunk_quality_validator import get_chunk_quality_validator

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================

class IssueType(str, Enum):
    """Types of hygiene issues."""
    DUPLICATE = "duplicate"
    LOW_QUALITY = "low_quality"
    ORPHANED = "orphaned"


@dataclass
class ChunkInfo:
    """Summary info for a chunk."""
    id: int
    document_id: int
    document_filename: str
    content_preview: str
    content_length: int
    quality_score: Optional[float]
    chunk_index: int


@dataclass
class DuplicateGroup:
    """A group of duplicate chunks."""
    similarity: float
    keep_chunk: ChunkInfo  # The chunk to keep (longest/best quality)
    remove_chunks: List[ChunkInfo]  # Chunks to remove


@dataclass
class LowQualityChunk:
    """A chunk flagged as low quality."""
    chunk: ChunkInfo
    quality_score: float
    reason: str


@dataclass
class HygieneReport:
    """Full hygiene analysis report."""
    analyzed_at: datetime
    total_chunks: int
    total_documents: int
    duplicate_groups: List[DuplicateGroup]
    low_quality_chunks: List[LowQualityChunk]
    orphaned_chunk_ids: List[int]

    # Summary stats
    duplicate_count: int = 0
    low_quality_count: int = 0
    orphaned_count: int = 0

    def __post_init__(self):
        self.duplicate_count = sum(len(g.remove_chunks) for g in self.duplicate_groups)
        self.low_quality_count = len(self.low_quality_chunks)
        self.orphaned_count = len(self.orphaned_chunk_ids)


@dataclass
class CleanupAction:
    """A cleanup action to perform."""
    action: str  # "delete_chunk", "delete_document"
    target_id: int
    reason: str
    issue_type: IssueType


@dataclass
class CleanupResult:
    """Result of cleanup operation."""
    success: bool
    chunks_deleted: int
    documents_affected: int
    errors: List[str] = field(default_factory=list)


# =============================================================================
# Knowledge Hygiene Service
# =============================================================================

class KnowledgeHygieneService:
    """Service for maintaining knowledge base quality."""

    def __init__(
        self,
        duplicate_threshold: float = 0.9,
        min_quality_score: float = 0.3,
    ):
        """Initialize hygiene service.

        Args:
            duplicate_threshold: Cosine similarity threshold for duplicates (0-1).
                                Values >0.9 = very similar content.
            min_quality_score: Minimum acceptable quality score (0-1).
        """
        self.duplicate_threshold = duplicate_threshold
        self.min_quality_score = min_quality_score
        self.validator = get_chunk_quality_validator()

    async def analyze_knowledge_base(
        self,
        session: AsyncSession,
        check_duplicates: bool = True,
        check_quality: bool = True,
        check_orphans: bool = True,
    ) -> HygieneReport:
        """Analyze knowledge base for issues without making changes.

        Args:
            session: Database session.
            check_duplicates: Check for duplicate chunks.
            check_quality: Check for low-quality chunks.
            check_orphans: Check for orphaned chunks.

        Returns:
            HygieneReport with all issues found.
        """
        logger.info("Starting knowledge base hygiene analysis...")

        # Get counts
        total_chunks = await session.scalar(
            select(func.count()).select_from(KnowledgeChunk)
        )
        total_documents = await session.scalar(
            select(func.count()).select_from(KnowledgeDocument)
        )

        duplicate_groups = []
        low_quality_chunks = []
        orphaned_chunk_ids = []

        if check_duplicates:
            logger.info("Checking for duplicate chunks...")
            duplicate_groups = await self.find_duplicates(session)
            logger.info(f"Found {len(duplicate_groups)} duplicate groups")

        if check_quality:
            logger.info("Checking for low-quality chunks...")
            low_quality_chunks = await self.find_low_quality(session)
            logger.info(f"Found {len(low_quality_chunks)} low-quality chunks")

        if check_orphans:
            logger.info("Checking for orphaned chunks...")
            orphaned_chunk_ids = await self.find_orphaned(session)
            logger.info(f"Found {len(orphaned_chunk_ids)} orphaned chunks")

        return HygieneReport(
            analyzed_at=datetime.utcnow(),
            total_chunks=total_chunks or 0,
            total_documents=total_documents or 0,
            duplicate_groups=duplicate_groups,
            low_quality_chunks=low_quality_chunks,
            orphaned_chunk_ids=orphaned_chunk_ids,
        )

    async def find_duplicates(
        self,
        session: AsyncSession,
        threshold: Optional[float] = None,
        limit: int = 100,
    ) -> List[DuplicateGroup]:
        """Find semantically similar chunks using pgvector.

        Uses cosine distance to find chunks with similar embeddings.
        Groups duplicates and selects the best chunk to keep (longest content).

        Args:
            session: Database session.
            threshold: Similarity threshold (default uses instance setting).
            limit: Maximum number of groups to return.

        Returns:
            List of DuplicateGroup objects.
        """
        threshold = threshold or self.duplicate_threshold
        distance_threshold = 1 - threshold  # cosine_distance = 1 - similarity

        # Query to find similar chunk pairs using pgvector
        # We use a self-join with cosine distance
        query = text("""
            WITH chunk_pairs AS (
                SELECT
                    c1.id as chunk1_id,
                    c2.id as chunk2_id,
                    1 - (c1.embedding <=> c2.embedding) as similarity,
                    c1.document_id as doc1_id,
                    c2.document_id as doc2_id
                FROM knowledge_chunks c1
                JOIN knowledge_chunks c2 ON c1.id < c2.id
                WHERE c1.embedding <=> c2.embedding < :distance_threshold
                ORDER BY similarity DESC
                LIMIT :limit
            )
            SELECT
                cp.chunk1_id,
                cp.chunk2_id,
                cp.similarity,
                d1.filename as doc1_filename,
                d2.filename as doc2_filename,
                c1.content as content1,
                c2.content as content2,
                c1.quality_score as quality1,
                c2.quality_score as quality2,
                c1.chunk_index as index1,
                c2.chunk_index as index2
            FROM chunk_pairs cp
            JOIN knowledge_chunks c1 ON cp.chunk1_id = c1.id
            JOIN knowledge_chunks c2 ON cp.chunk2_id = c2.id
            JOIN knowledge_documents d1 ON cp.doc1_id = d1.id
            JOIN knowledge_documents d2 ON cp.doc2_id = d2.id
        """)

        try:
            result = await session.execute(
                query,
                {"distance_threshold": distance_threshold, "limit": limit * 2}
            )
            rows = result.fetchall()
        except Exception as e:
            logger.error(f"Error finding duplicates: {e}")
            # pgvector might not be available
            return []

        # Group duplicates and select best to keep
        # Use a union-find approach to group related chunks
        chunk_groups: Dict[int, set] = {}  # chunk_id -> set of related chunk_ids
        chunk_info: Dict[int, dict] = {}  # chunk_id -> info
        similarity_map: Dict[Tuple[int, int], float] = {}

        for row in rows:
            id1, id2 = row.chunk1_id, row.chunk2_id
            similarity = row.similarity

            # Store chunk info
            if id1 not in chunk_info:
                chunk_info[id1] = {
                    'id': id1,
                    'document_id': row.doc1_id if hasattr(row, 'doc1_id') else 0,
                    'document_filename': row.doc1_filename,
                    'content': row.content1,
                    'quality_score': row.quality1,
                    'chunk_index': row.index1,
                }
            if id2 not in chunk_info:
                chunk_info[id2] = {
                    'id': id2,
                    'document_id': row.doc2_id if hasattr(row, 'doc2_id') else 0,
                    'document_filename': row.doc2_filename,
                    'content': row.content2,
                    'quality_score': row.quality2,
                    'chunk_index': row.index2,
                }

            similarity_map[(min(id1, id2), max(id1, id2))] = similarity

            # Merge groups
            group1 = chunk_groups.get(id1, {id1})
            group2 = chunk_groups.get(id2, {id2})
            merged = group1 | group2

            for chunk_id in merged:
                chunk_groups[chunk_id] = merged

        # Get unique groups
        seen_groups: set = set()
        duplicate_groups: List[DuplicateGroup] = []

        for chunk_id, group in chunk_groups.items():
            group_key = frozenset(group)
            if group_key in seen_groups:
                continue
            seen_groups.add(group_key)

            if len(group) < 2:
                continue

            # Select best chunk to keep (longest content, highest quality)
            group_chunks = [chunk_info[cid] for cid in group if cid in chunk_info]

            # Sort by: quality_score desc, content length desc
            group_chunks.sort(
                key=lambda c: (c['quality_score'] or 0, len(c['content'])),
                reverse=True
            )

            best = group_chunks[0]
            others = group_chunks[1:]

            # Calculate average similarity
            similarities = []
            for other in others:
                key = (min(best['id'], other['id']), max(best['id'], other['id']))
                if key in similarity_map:
                    similarities.append(similarity_map[key])

            avg_similarity = sum(similarities) / len(similarities) if similarities else threshold

            duplicate_groups.append(DuplicateGroup(
                similarity=avg_similarity,
                keep_chunk=ChunkInfo(
                    id=best['id'],
                    document_id=best['document_id'],
                    document_filename=best['document_filename'],
                    content_preview=best['content'][:100] + "..." if len(best['content']) > 100 else best['content'],
                    content_length=len(best['content']),
                    quality_score=best['quality_score'],
                    chunk_index=best['chunk_index'],
                ),
                remove_chunks=[
                    ChunkInfo(
                        id=c['id'],
                        document_id=c['document_id'],
                        document_filename=c['document_filename'],
                        content_preview=c['content'][:100] + "..." if len(c['content']) > 100 else c['content'],
                        content_length=len(c['content']),
                        quality_score=c['quality_score'],
                        chunk_index=c['chunk_index'],
                    )
                    for c in others
                ]
            ))

        # Sort by number of duplicates (most first)
        duplicate_groups.sort(key=lambda g: len(g.remove_chunks), reverse=True)

        return duplicate_groups[:limit]

    async def find_low_quality(
        self,
        session: AsyncSession,
        min_score: Optional[float] = None,
        limit: int = 100,
    ) -> List[LowQualityChunk]:
        """Find chunks below quality threshold.

        Args:
            session: Database session.
            min_score: Minimum quality score (default uses instance setting).
            limit: Maximum number of chunks to return.

        Returns:
            List of LowQualityChunk objects.
        """
        min_score = min_score or self.min_quality_score

        # Query chunks with low quality scores
        query = (
            select(KnowledgeChunk, KnowledgeDocument.filename)
            .join(KnowledgeDocument)
            .where(KnowledgeChunk.quality_score < min_score)
            .where(KnowledgeChunk.quality_score.isnot(None))
            .order_by(KnowledgeChunk.quality_score.asc())
            .limit(limit)
        )

        result = await session.execute(query)
        rows = result.fetchall()

        low_quality = []
        for chunk, filename in rows:
            # Determine reason based on score
            if chunk.quality_score < 0.1:
                reason = "Very low quality (likely garbage/navigation)"
            elif chunk.quality_score < 0.2:
                reason = "Low quality (minimal useful content)"
            else:
                reason = f"Below threshold ({min_score})"

            low_quality.append(LowQualityChunk(
                chunk=ChunkInfo(
                    id=chunk.id,
                    document_id=chunk.document_id,
                    document_filename=filename,
                    content_preview=chunk.content[:100] + "..." if len(chunk.content) > 100 else chunk.content,
                    content_length=len(chunk.content),
                    quality_score=chunk.quality_score,
                    chunk_index=chunk.chunk_index,
                ),
                quality_score=chunk.quality_score,
                reason=reason,
            ))

        return low_quality

    async def find_orphaned(
        self,
        session: AsyncSession,
    ) -> List[int]:
        """Find chunks without a parent document.

        Args:
            session: Database session.

        Returns:
            List of orphaned chunk IDs.
        """
        # Find chunks where document_id doesn't exist in documents table
        query = text("""
            SELECT c.id
            FROM knowledge_chunks c
            LEFT JOIN knowledge_documents d ON c.document_id = d.id
            WHERE d.id IS NULL
        """)

        result = await session.execute(query)
        rows = result.fetchall()

        return [row[0] for row in rows]

    async def rescore_chunks(
        self,
        session: AsyncSession,
        limit: Optional[int] = None,
    ) -> int:
        """Re-score chunks that don't have quality scores.

        Args:
            session: Database session.
            limit: Maximum chunks to rescore (None = all).

        Returns:
            Number of chunks rescored.
        """
        query = select(KnowledgeChunk).where(KnowledgeChunk.quality_score.is_(None))

        if limit:
            query = query.limit(limit)

        result = await session.execute(query)
        chunks = result.scalars().all()

        count = 0
        for chunk in chunks:
            validation = self.validator.validate_chunk(chunk.content)
            chunk.quality_score = validation.quality_score
            count += 1

        await session.commit()
        logger.info(f"Rescored {count} chunks")

        return count

    async def apply_cleanup(
        self,
        session: AsyncSession,
        actions: List[CleanupAction],
    ) -> CleanupResult:
        """Apply cleanup actions.

        Args:
            session: Database session.
            actions: List of cleanup actions to perform.

        Returns:
            CleanupResult with stats.
        """
        chunks_deleted = 0
        documents_affected = set()
        errors = []

        for action in actions:
            try:
                if action.action == "delete_chunk":
                    # Get document_id before deleting
                    chunk = await session.get(KnowledgeChunk, action.target_id)
                    if chunk:
                        documents_affected.add(chunk.document_id)
                        await session.delete(chunk)
                        chunks_deleted += 1
                        logger.debug(f"Deleted chunk {action.target_id}: {action.reason}")

            except Exception as e:
                error_msg = f"Failed to {action.action} {action.target_id}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)

        # Update total_chunks count for affected documents
        for doc_id in documents_affected:
            doc = await session.get(KnowledgeDocument, doc_id)
            if doc:
                count = await session.scalar(
                    select(func.count()).select_from(KnowledgeChunk)
                    .where(KnowledgeChunk.document_id == doc_id)
                )
                doc.total_chunks = count or 0

        await session.commit()

        return CleanupResult(
            success=len(errors) == 0,
            chunks_deleted=chunks_deleted,
            documents_affected=len(documents_affected),
            errors=errors,
        )

    async def quick_cleanup(
        self,
        session: AsyncSession,
        remove_duplicates: bool = True,
        remove_low_quality: bool = True,
        remove_orphans: bool = True,
    ) -> CleanupResult:
        """Perform quick cleanup with default settings.

        Args:
            session: Database session.
            remove_duplicates: Remove duplicate chunks.
            remove_low_quality: Remove low-quality chunks.
            remove_orphans: Remove orphaned chunks.

        Returns:
            CleanupResult with stats.
        """
        report = await self.analyze_knowledge_base(
            session,
            check_duplicates=remove_duplicates,
            check_quality=remove_low_quality,
            check_orphans=remove_orphans,
        )

        actions = []

        # Build cleanup actions
        if remove_duplicates:
            for group in report.duplicate_groups:
                for chunk in group.remove_chunks:
                    actions.append(CleanupAction(
                        action="delete_chunk",
                        target_id=chunk.id,
                        reason=f"Duplicate of chunk {group.keep_chunk.id} ({group.similarity:.0%} similar)",
                        issue_type=IssueType.DUPLICATE,
                    ))

        if remove_low_quality:
            for lq in report.low_quality_chunks:
                actions.append(CleanupAction(
                    action="delete_chunk",
                    target_id=lq.chunk.id,
                    reason=lq.reason,
                    issue_type=IssueType.LOW_QUALITY,
                ))

        if remove_orphans:
            for chunk_id in report.orphaned_chunk_ids:
                actions.append(CleanupAction(
                    action="delete_chunk",
                    target_id=chunk_id,
                    reason="Orphaned chunk (no parent document)",
                    issue_type=IssueType.ORPHANED,
                ))

        if not actions:
            return CleanupResult(
                success=True,
                chunks_deleted=0,
                documents_affected=0,
            )

        return await self.apply_cleanup(session, actions)


# =============================================================================
# Singleton
# =============================================================================

_hygiene_service: Optional[KnowledgeHygieneService] = None


def get_hygiene_service() -> KnowledgeHygieneService:
    """Get or create singleton hygiene service."""
    global _hygiene_service
    if _hygiene_service is None:
        _hygiene_service = KnowledgeHygieneService()
    return _hygiene_service
