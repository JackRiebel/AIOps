"""Post-ingestion hooks for automatic knowledge base maintenance.

These hooks run after document ingestion to automatically:
- Remove duplicate chunks
- Clean up low-quality content
- Maintain knowledge base health

Hooks are designed to run non-blocking (as background tasks) to not
slow down the ingestion response.
"""

import asyncio
import logging
from typing import List, Optional
from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.knowledge import KnowledgeDocument, KnowledgeChunk

logger = logging.getLogger(__name__)


class PostIngestionHooks:
    """Hooks that run after document ingestion."""

    def __init__(self):
        """Initialize hooks."""
        # Import here to avoid circular imports
        from src.services.knowledge_hygiene_service import get_hygiene_service
        self.hygiene_service = get_hygiene_service()

    async def on_document_ingested(
        self,
        session: AsyncSession,
        document_id: int,
        run_in_background: bool = True,
    ) -> Optional[dict]:
        """Run after single document ingestion.

        Performs lightweight hygiene check focused on the new document:
        - Checks for duplicates between new doc's chunks and existing KB
        - Removes any new chunks that duplicate existing content

        Args:
            session: Database session.
            document_id: ID of the newly ingested document.
            run_in_background: If True, spawns as background task.

        Returns:
            Hygiene stats dict if run synchronously, None if background.
        """
        if run_in_background:
            # Spawn background task - don't await
            asyncio.create_task(
                self._quick_hygiene_for_document(session, document_id)
            )
            logger.info(f"Spawned background hygiene task for document {document_id}")
            return None
        else:
            return await self._quick_hygiene_for_document(session, document_id)

    async def _quick_hygiene_for_document(
        self,
        session: AsyncSession,
        document_id: int,
    ) -> dict:
        """Perform quick hygiene check for a single document.

        This is a lightweight check that only looks at the new document's
        chunks and compares them against existing content.

        Args:
            session: Database session.
            document_id: ID of the document to check.

        Returns:
            Dict with hygiene stats.
        """
        start_time = datetime.utcnow()
        stats = {
            "document_id": document_id,
            "duplicates_found": 0,
            "duplicates_removed": 0,
            "low_quality_removed": 0,
            "duration_ms": 0,
        }

        try:
            # Get the new document's chunks
            result = await session.execute(
                select(KnowledgeChunk)
                .where(KnowledgeChunk.document_id == document_id)
            )
            new_chunks = result.scalars().all()

            if not new_chunks:
                logger.debug(f"Document {document_id} has no chunks to check")
                return stats

            logger.info(f"Checking {len(new_chunks)} chunks from document {document_id} for duplicates")

            # Find duplicates with existing chunks (not from this document)
            # Use pgvector to find similar chunks
            duplicates_to_remove = []

            for chunk in new_chunks:
                if chunk.embedding is None:
                    continue

                # Find similar chunks from OTHER documents
                similar_query = text("""
                    SELECT c.id, c.document_id, c.content,
                           1 - (c.embedding <=> CAST(:embedding AS vector)) as similarity
                    FROM knowledge_chunks c
                    WHERE c.document_id != :doc_id
                      AND c.id != :chunk_id
                      AND c.embedding IS NOT NULL
                      AND 1 - (c.embedding <=> CAST(:embedding AS vector)) > 0.9
                    ORDER BY similarity DESC
                    LIMIT 1
                """)

                try:
                    similar_result = await session.execute(
                        similar_query,
                        {
                            "embedding": str(list(chunk.embedding)),
                            "doc_id": document_id,
                            "chunk_id": chunk.id,
                        }
                    )
                    similar = similar_result.fetchone()

                    if similar:
                        stats["duplicates_found"] += 1
                        # New chunk is duplicate of existing - mark for removal
                        # Keep existing chunk, remove new one
                        duplicates_to_remove.append(chunk.id)
                        logger.debug(
                            f"Chunk {chunk.id} is {similar.similarity:.0%} similar to "
                            f"existing chunk {similar.id}"
                        )
                except Exception as e:
                    # pgvector may not be available
                    logger.debug(f"Similarity check failed: {e}")
                    break

            # Remove duplicate chunks
            if duplicates_to_remove:
                for chunk_id in duplicates_to_remove:
                    chunk = await session.get(KnowledgeChunk, chunk_id)
                    if chunk:
                        await session.delete(chunk)
                        stats["duplicates_removed"] += 1

                # Update document's total_chunks count
                doc = await session.get(KnowledgeDocument, document_id)
                if doc:
                    remaining = await session.scalar(
                        select(text("COUNT(*)"))
                        .select_from(KnowledgeChunk)
                        .where(KnowledgeChunk.document_id == document_id)
                    )
                    doc.total_chunks = remaining or 0

                await session.commit()
                logger.info(
                    f"Removed {stats['duplicates_removed']} duplicate chunks "
                    f"from document {document_id}"
                )

        except Exception as e:
            logger.error(f"Quick hygiene failed for document {document_id}: {e}")
            await session.rollback()

        stats["duration_ms"] = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return stats

    async def on_bulk_import_complete(
        self,
        session: AsyncSession,
        document_ids: List[int],
        run_full_hygiene: bool = True,
    ) -> dict:
        """Run after bulk import finishes.

        Performs full hygiene analysis and cleanup:
        - Finds all duplicate chunks across entire KB
        - Removes low-quality chunks
        - Cleans up orphaned chunks

        Args:
            session: Database session.
            document_ids: IDs of all newly imported documents.
            run_full_hygiene: If True, runs full KB hygiene.

        Returns:
            Dict with hygiene stats.
        """
        start_time = datetime.utcnow()
        stats = {
            "documents_imported": len(document_ids),
            "duplicates_removed": 0,
            "low_quality_removed": 0,
            "orphans_removed": 0,
            "duration_ms": 0,
        }

        if not run_full_hygiene:
            return stats

        try:
            logger.info(f"Running full hygiene after bulk import of {len(document_ids)} documents")

            # Run full hygiene cleanup
            result = await self.hygiene_service.quick_cleanup(
                session=session,
                remove_duplicates=True,
                remove_low_quality=True,
                remove_orphans=True,
            )

            stats["duplicates_removed"] = result.chunks_deleted
            stats["documents_affected"] = result.documents_affected

            if result.errors:
                logger.warning(f"Hygiene completed with errors: {result.errors}")

            logger.info(
                f"Post-bulk-import hygiene complete: "
                f"removed {result.chunks_deleted} chunks"
            )

        except Exception as e:
            logger.error(f"Bulk import hygiene failed: {e}")

        stats["duration_ms"] = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return stats

    async def run_scheduled_hygiene(
        self,
        session: AsyncSession,
    ) -> dict:
        """Run scheduled hygiene job.

        Called by background job scheduler (every 6 hours).
        Performs comprehensive KB maintenance.

        Args:
            session: Database session.

        Returns:
            Dict with hygiene stats.
        """
        start_time = datetime.utcnow()
        stats = {
            "run_at": start_time.isoformat(),
            "duplicates_removed": 0,
            "low_quality_removed": 0,
            "orphans_removed": 0,
            "chunks_rescored": 0,
            "duration_ms": 0,
        }

        try:
            logger.info("Running scheduled hygiene maintenance")

            # First, rescore any chunks without quality scores
            rescore_count = await self.hygiene_service.rescore_chunks(
                session=session,
                limit=500,  # Process in batches
            )
            stats["chunks_rescored"] = rescore_count

            # Then run cleanup
            result = await self.hygiene_service.quick_cleanup(
                session=session,
                remove_duplicates=True,
                remove_low_quality=True,
                remove_orphans=True,
            )

            stats["duplicates_removed"] = result.chunks_deleted
            stats["documents_affected"] = result.documents_affected

            logger.info(
                f"Scheduled hygiene complete: "
                f"rescored {rescore_count} chunks, "
                f"removed {result.chunks_deleted} chunks"
            )

        except Exception as e:
            logger.error(f"Scheduled hygiene failed: {e}")
            stats["error"] = str(e)

        stats["duration_ms"] = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return stats


# =============================================================================
# Singleton
# =============================================================================

_hooks: Optional[PostIngestionHooks] = None


def get_post_ingestion_hooks() -> PostIngestionHooks:
    """Get or create singleton hooks instance."""
    global _hooks
    if _hooks is None:
        _hooks = PostIngestionHooks()
    return _hooks
