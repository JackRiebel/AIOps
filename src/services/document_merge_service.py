"""Document merge service for consolidating related documents.

This service handles:
- Finding documents that are candidates for merging (same product, similar titles)
- Previewing what a merge operation would do
- Executing merges by combining chunks and deduplicating
- Tracking merge history for audit

Example use case:
- 5 separate MX68 configuration guides → 1 consolidated "MX68 Complete Guide"
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Set, Tuple

from sqlalchemy import select, text, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.knowledge import KnowledgeDocument, KnowledgeChunk

logger = logging.getLogger(__name__)


# Common Cisco device model patterns for grouping
DEVICE_MODEL_PATTERNS = [
    # Meraki MX series
    r'(MX\d+[A-Z]*)',
    # Meraki MS series
    r'(MS\d+[A-Z]*)',
    # Meraki MR series
    r'(MR\d+[A-Z]*)',
    # Meraki MV series
    r'(MV\d+[A-Z]*)',
    # Catalyst series
    r'(Catalyst\s*\d+[A-Z]*)',
    r'(C\d{4}[A-Z]*)',
    # Nexus series
    r'(Nexus\s*\d+[A-Z]*)',
    r'(N\d{4}[A-Z]*)',
    # ISE
    r'(ISE\s*\d*\.?\d*)',
    # ASA
    r'(ASA\s*\d+[A-Z]*)',
    # ISR
    r'(ISR\s*\d+[A-Z]*)',
    # Firepower
    r'(FTD|Firepower\s*\d*)',
]


@dataclass
class MergeCandidate:
    """A document that is a candidate for merging."""
    document_id: int
    title: str
    filename: str
    chunk_count: int
    product: Optional[str]
    doc_type: Optional[str]
    device_model: Optional[str]
    created_at: datetime


@dataclass
class MergeGroup:
    """A group of documents that can be merged together."""
    group_key: str  # e.g., "meraki_guide_MX68"
    product: Optional[str]
    doc_type: Optional[str]
    device_model: Optional[str]
    documents: List[MergeCandidate] = field(default_factory=list)

    @property
    def total_chunks(self) -> int:
        return sum(d.chunk_count for d in self.documents)

    @property
    def document_count(self) -> int:
        return len(self.documents)


@dataclass
class MergePreview:
    """Preview of what a merge operation would do."""
    group: MergeGroup
    merged_title: str
    merged_description: str
    total_chunks_before: int
    estimated_chunks_after: int
    duplicate_chunks: int
    source_urls: List[str]
    documents_to_delete: List[int]


@dataclass
class MergeResult:
    """Result of a merge operation."""
    new_document_id: int
    merged_title: str
    documents_merged: int
    chunks_before: int
    chunks_after: int
    duplicates_removed: int
    duration_ms: int


class DocumentMergeService:
    """Service for merging related documents."""

    def __init__(self):
        """Initialize the merge service."""
        # Compile device model patterns
        self.model_patterns = [re.compile(p, re.IGNORECASE) for p in DEVICE_MODEL_PATTERNS]

    def extract_device_model(self, title: str) -> Optional[str]:
        """Extract device model from document title.

        Args:
            title: Document title.

        Returns:
            Extracted device model or None.
        """
        for pattern in self.model_patterns:
            match = pattern.search(title)
            if match:
                model = match.group(1).upper()
                # Normalize: remove spaces, standardize format
                model = re.sub(r'\s+', '', model)
                return model
        return None

    def normalize_model_series(self, model: str) -> str:
        """Normalize device model to its series.

        E.g., MX68W, MX68CW, MX68 → MX68 Series

        Args:
            model: Device model string.

        Returns:
            Normalized series name.
        """
        # Extract base model number
        match = re.match(r'([A-Z]+\d+)', model)
        if match:
            return f"{match.group(1)} Series"
        return model

    async def find_merge_candidates(
        self,
        session: AsyncSession,
        min_documents: int = 2,
        similarity_threshold: float = 0.7,
    ) -> List[MergeGroup]:
        """Find documents that are candidates for merging.

        Documents are grouped by:
        - Same product (meraki, catalyst, etc.)
        - Same doc_type (guide, api_spec, etc.)
        - Similar device model extracted from title

        Args:
            session: Database session.
            min_documents: Minimum documents in a group to be considered for merge.
            similarity_threshold: Minimum similarity for grouping (not used yet).

        Returns:
            List of merge groups.
        """
        # Get all documents with their chunk counts
        result = await session.execute(
            select(KnowledgeDocument)
            .options(selectinload(KnowledgeDocument.chunks))
        )
        documents = result.scalars().all()

        # Group by product + doc_type + device_model
        groups: Dict[str, MergeGroup] = {}

        for doc in documents:
            # Extract device model from title
            device_model = self.extract_device_model(doc.title or doc.filename)

            if not device_model:
                continue  # Skip documents without recognizable device models

            # Normalize to series
            series = self.normalize_model_series(device_model)

            # Create group key
            product = (doc.product or 'unknown').lower()
            doc_type = (doc.doc_type or 'unknown').lower()
            group_key = f"{product}_{doc_type}_{series}"

            # Create or update group
            if group_key not in groups:
                groups[group_key] = MergeGroup(
                    group_key=group_key,
                    product=doc.product,
                    doc_type=doc.doc_type,
                    device_model=series,
                )

            groups[group_key].documents.append(MergeCandidate(
                document_id=doc.id,
                title=doc.title or doc.filename,
                filename=doc.filename,
                chunk_count=doc.total_chunks or len(doc.chunks),
                product=doc.product,
                doc_type=doc.doc_type,
                device_model=device_model,
                created_at=doc.created_at,
            ))

        # Filter to groups with minimum documents
        merge_groups = [g for g in groups.values() if len(g.documents) >= min_documents]

        # Sort by number of documents (most first)
        merge_groups.sort(key=lambda g: len(g.documents), reverse=True)

        logger.info(f"Found {len(merge_groups)} merge candidate groups")
        return merge_groups

    async def preview_merge(
        self,
        session: AsyncSession,
        document_ids: List[int],
    ) -> MergePreview:
        """Preview what a merge operation would do.

        Args:
            session: Database session.
            document_ids: IDs of documents to merge.

        Returns:
            MergePreview with details of the proposed merge.
        """
        if len(document_ids) < 2:
            raise ValueError("At least 2 documents required for merge")

        # Get all documents
        result = await session.execute(
            select(KnowledgeDocument)
            .where(KnowledgeDocument.id.in_(document_ids))
            .options(selectinload(KnowledgeDocument.chunks))
        )
        documents = list(result.scalars().all())

        if len(documents) != len(document_ids):
            raise ValueError("Some documents not found")

        # Build merge group
        device_model = None
        for doc in documents:
            model = self.extract_device_model(doc.title or doc.filename)
            if model:
                device_model = self.normalize_model_series(model)
                break

        group = MergeGroup(
            group_key="preview",
            product=documents[0].product,
            doc_type=documents[0].doc_type,
            device_model=device_model,
            documents=[
                MergeCandidate(
                    document_id=doc.id,
                    title=doc.title or doc.filename,
                    filename=doc.filename,
                    chunk_count=doc.total_chunks or len(doc.chunks),
                    product=doc.product,
                    doc_type=doc.doc_type,
                    device_model=self.extract_device_model(doc.title or ""),
                    created_at=doc.created_at,
                )
                for doc in documents
            ]
        )

        # Count total chunks
        total_chunks = sum(doc.total_chunks or len(doc.chunks) for doc in documents)

        # Estimate duplicates using embedding similarity
        duplicate_count = await self._estimate_duplicates(session, document_ids)
        estimated_after = max(1, total_chunks - duplicate_count)

        # Collect source URLs
        source_urls = [doc.source_url for doc in documents if doc.source_url]

        # Generate merged title
        merged_title = self._generate_merged_title(documents, device_model)

        # Generate merged description
        descriptions = [doc.description for doc in documents if doc.description]
        merged_description = " ".join(descriptions[:3]) if descriptions else ""
        if len(merged_description) > 500:
            merged_description = merged_description[:497] + "..."

        return MergePreview(
            group=group,
            merged_title=merged_title,
            merged_description=merged_description,
            total_chunks_before=total_chunks,
            estimated_chunks_after=estimated_after,
            duplicate_chunks=duplicate_count,
            source_urls=source_urls,
            documents_to_delete=document_ids,
        )

    async def _estimate_duplicates(
        self,
        session: AsyncSession,
        document_ids: List[int],
    ) -> int:
        """Estimate number of duplicate chunks across documents.

        Uses embedding similarity to find near-duplicates.

        Args:
            session: Database session.
            document_ids: Document IDs to check.

        Returns:
            Estimated number of duplicate chunks.
        """
        try:
            # Use pgvector to find similar chunks within these documents
            query = text("""
                WITH chunk_pairs AS (
                    SELECT
                        c1.id as id1,
                        c2.id as id2,
                        1 - (c1.embedding <=> c2.embedding) as similarity
                    FROM knowledge_chunks c1
                    JOIN knowledge_chunks c2 ON c1.id < c2.id
                    WHERE c1.document_id = ANY(:doc_ids)
                      AND c2.document_id = ANY(:doc_ids)
                      AND c1.document_id != c2.document_id
                      AND c1.embedding IS NOT NULL
                      AND c2.embedding IS NOT NULL
                      AND 1 - (c1.embedding <=> c2.embedding) > 0.85
                )
                SELECT COUNT(DISTINCT id2) as duplicate_count
                FROM chunk_pairs
            """)

            result = await session.execute(query, {"doc_ids": document_ids})
            row = result.fetchone()
            return row.duplicate_count if row else 0

        except Exception as e:
            logger.warning(f"Could not estimate duplicates: {e}")
            # Fallback: estimate 20% duplicates
            return 0

    def _generate_merged_title(
        self,
        documents: List[KnowledgeDocument],
        device_model: Optional[str],
    ) -> str:
        """Generate a title for the merged document.

        Args:
            documents: Documents being merged.
            device_model: Normalized device model/series.

        Returns:
            Generated title.
        """
        if device_model:
            # Try to detect doc type from titles
            titles_lower = " ".join((d.title or "").lower() for d in documents)

            if "configuration" in titles_lower or "setup" in titles_lower:
                return f"{device_model} Configuration Guide"
            elif "troubleshoot" in titles_lower:
                return f"{device_model} Troubleshooting Guide"
            elif "best practice" in titles_lower:
                return f"{device_model} Best Practices"
            elif "api" in titles_lower:
                return f"{device_model} API Reference"
            else:
                return f"{device_model} Complete Documentation"

        # Fallback: use first document's title
        return f"{documents[0].title or documents[0].filename} (Consolidated)"

    async def execute_merge(
        self,
        session: AsyncSession,
        document_ids: List[int],
        merged_title: Optional[str] = None,
        merged_description: Optional[str] = None,
    ) -> MergeResult:
        """Execute a merge operation.

        Creates a new consolidated document with deduplicated chunks
        and deletes the original documents.

        Args:
            session: Database session.
            document_ids: IDs of documents to merge.
            merged_title: Optional title for merged doc (auto-generated if not provided).
            merged_description: Optional description.

        Returns:
            MergeResult with merge statistics.
        """
        start_time = datetime.utcnow()

        if len(document_ids) < 2:
            raise ValueError("At least 2 documents required for merge")

        # Get all documents with chunks
        result = await session.execute(
            select(KnowledgeDocument)
            .where(KnowledgeDocument.id.in_(document_ids))
            .options(selectinload(KnowledgeDocument.chunks))
        )
        documents = list(result.scalars().all())

        if len(documents) != len(document_ids):
            raise ValueError("Some documents not found")

        # Get device model for title
        device_model = None
        for doc in documents:
            model = self.extract_device_model(doc.title or doc.filename)
            if model:
                device_model = self.normalize_model_series(model)
                break

        # Generate title if not provided
        if not merged_title:
            merged_title = self._generate_merged_title(documents, device_model)

        if not merged_description:
            descriptions = [doc.description for doc in documents if doc.description]
            merged_description = " ".join(descriptions[:3]) if descriptions else None

        # Count total chunks before
        total_chunks_before = sum(len(doc.chunks) for doc in documents)

        # Collect all chunks and deduplicate
        all_chunks = []
        for doc in documents:
            all_chunks.extend(doc.chunks)

        # Find unique chunks (using embedding similarity)
        unique_chunks = await self._deduplicate_chunks(session, all_chunks)

        # Collect metadata from all source documents
        source_urls = [doc.source_url for doc in documents if doc.source_url]
        all_metadata = {
            "merged_from": document_ids,
            "merge_date": datetime.utcnow().isoformat(),
            "source_urls": source_urls,
            "original_titles": [doc.title for doc in documents if doc.title],
        }

        # Create new merged document
        merged_doc = KnowledgeDocument(
            filename=f"merged_{device_model or 'document'}.md".lower().replace(" ", "_"),
            doc_type=documents[0].doc_type,
            product=documents[0].product,
            version=documents[0].version,
            title=merged_title,
            description=merged_description,
            source_url=source_urls[0] if source_urls else None,
            content_hash=f"merged_{datetime.utcnow().timestamp()}",  # Unique hash
            metadata=all_metadata,
            total_chunks=len(unique_chunks),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        session.add(merged_doc)
        await session.flush()  # Get the ID

        # Reassign unique chunks to new document
        for idx, chunk in enumerate(unique_chunks):
            chunk.document_id = merged_doc.id
            chunk.chunk_index = idx

        # Delete old documents (CASCADE will handle orphan chunks)
        for doc in documents:
            # First, detach chunks that we're keeping
            for chunk in doc.chunks:
                if chunk in unique_chunks:
                    # Already reassigned
                    pass
                else:
                    # This chunk is a duplicate - delete it
                    await session.delete(chunk)

            # Delete the original document
            await session.delete(doc)

        await session.commit()

        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        result = MergeResult(
            new_document_id=merged_doc.id,
            merged_title=merged_title,
            documents_merged=len(documents),
            chunks_before=total_chunks_before,
            chunks_after=len(unique_chunks),
            duplicates_removed=total_chunks_before - len(unique_chunks),
            duration_ms=duration_ms,
        )

        logger.info(
            f"Merged {len(documents)} documents into '{merged_title}': "
            f"{total_chunks_before} → {len(unique_chunks)} chunks "
            f"({total_chunks_before - len(unique_chunks)} duplicates removed)"
        )

        return result

    async def _deduplicate_chunks(
        self,
        session: AsyncSession,
        chunks: List[KnowledgeChunk],
    ) -> List[KnowledgeChunk]:
        """Deduplicate chunks using embedding similarity.

        For each group of similar chunks, keeps the one with the highest quality score.

        Args:
            session: Database session.
            chunks: All chunks to deduplicate.

        Returns:
            List of unique chunks.
        """
        if not chunks:
            return []

        # Group chunks by similarity
        # Use a simple approach: for each pair, if similarity > 0.85, mark as duplicate
        chunk_ids = [c.id for c in chunks]

        try:
            # Find duplicate pairs using pgvector
            query = text("""
                SELECT
                    c1.id as id1,
                    c2.id as id2,
                    1 - (c1.embedding <=> c2.embedding) as similarity
                FROM knowledge_chunks c1
                JOIN knowledge_chunks c2 ON c1.id < c2.id
                WHERE c1.id = ANY(:chunk_ids)
                  AND c2.id = ANY(:chunk_ids)
                  AND c1.embedding IS NOT NULL
                  AND c2.embedding IS NOT NULL
                  AND 1 - (c1.embedding <=> c2.embedding) > 0.85
                ORDER BY similarity DESC
            """)

            result = await session.execute(query, {"chunk_ids": chunk_ids})
            duplicate_pairs = result.fetchall()

            # Build duplicate groups using Union-Find
            parent: Dict[int, int] = {c.id: c.id for c in chunks}

            def find(x: int) -> int:
                if parent[x] != x:
                    parent[x] = find(parent[x])
                return parent[x]

            def union(x: int, y: int):
                px, py = find(x), find(y)
                if px != py:
                    parent[px] = py

            for row in duplicate_pairs:
                union(row.id1, row.id2)

            # Group chunks by their root
            groups: Dict[int, List[KnowledgeChunk]] = {}
            chunk_map = {c.id: c for c in chunks}

            for chunk in chunks:
                root = find(chunk.id)
                if root not in groups:
                    groups[root] = []
                groups[root].append(chunk)

            # From each group, keep the chunk with highest quality score
            unique_chunks = []
            for group_chunks in groups.values():
                # Sort by quality score (highest first), then by content length
                best = max(
                    group_chunks,
                    key=lambda c: (c.quality_score or 0, len(c.content or ""))
                )
                unique_chunks.append(best)

            return unique_chunks

        except Exception as e:
            logger.warning(f"Could not deduplicate using embeddings: {e}")
            # Fallback: return all chunks (no deduplication)
            return chunks

    async def auto_merge_all(
        self,
        session: AsyncSession,
        min_documents: int = 2,
        dry_run: bool = False,
    ) -> List[MergeResult]:
        """Automatically merge all candidate groups.

        Args:
            session: Database session.
            min_documents: Minimum documents in a group to merge.
            dry_run: If True, only return previews without executing.

        Returns:
            List of merge results (or previews if dry_run).
        """
        groups = await self.find_merge_candidates(session, min_documents)
        results = []

        for group in groups:
            doc_ids = [d.document_id for d in group.documents]

            if dry_run:
                preview = await self.preview_merge(session, doc_ids)
                logger.info(f"[DRY RUN] Would merge: {preview.merged_title}")
            else:
                try:
                    result = await self.execute_merge(session, doc_ids)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Failed to merge group {group.group_key}: {e}")

        return results


# =============================================================================
# Singleton
# =============================================================================

_merge_service: Optional[DocumentMergeService] = None


def get_merge_service() -> DocumentMergeService:
    """Get or create singleton merge service."""
    global _merge_service
    if _merge_service is None:
        _merge_service = DocumentMergeService()
    return _merge_service
