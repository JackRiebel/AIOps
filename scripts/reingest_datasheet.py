#!/usr/bin/env python3
"""Re-ingest MS Family Datasheet with improved chunking.

This script:
1. Deletes any existing MS Family datasheet from the knowledge base
2. Re-ingests it using the improved page-based chunking strategy

Usage:
    python scripts/reingest_datasheet.py
"""

import asyncio
import logging
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATASHEET_PATH = "datasheet/MS-family-datasheet-20250421-english.pdf"
DATASHEET_FILENAME = "MS-family-datasheet-20250421-english.pdf"


async def get_openai_key():
    """Get OpenAI API key from environment or admin user."""
    openai_key = os.getenv("OPENAI_API_KEY")

    if not openai_key:
        # Try to get from admin user's encrypted key
        try:
            from sqlalchemy import text
            from cryptography.fernet import Fernet
            from src.config.database import get_db
            from src.config.settings import get_settings

            db = get_db()
            settings = get_settings()

            async with db.session() as session:
                result = await session.execute(
                    text("SELECT user_openai_api_key FROM users WHERE username = 'admin' AND user_openai_api_key IS NOT NULL")
                )
                row = result.fetchone()

                if row and row[0]:
                    encryption_key = settings.get_encryption_key()
                    cipher = Fernet(encryption_key)
                    openai_key = cipher.decrypt(row[0].encode()).decode()
                    logger.info("Found OpenAI API key from admin user")
        except Exception as e:
            logger.warning(f"Could not get OpenAI key from admin user: {e}")

    return openai_key


async def delete_existing_datasheet(session):
    """Delete any existing MS Family datasheet document and its chunks."""
    from sqlalchemy import text

    # Find the document
    result = await session.execute(
        text("SELECT id, filename, total_chunks FROM knowledge_documents WHERE filename LIKE '%MS-family-datasheet%' OR filename LIKE '%ms-family-datasheet%'")
    )
    rows = result.fetchall()

    if not rows:
        logger.info("No existing MS Family datasheet found in knowledge base")
        return 0

    deleted_count = 0
    for row in rows:
        doc_id, filename, chunks = row
        logger.info(f"Deleting existing document: {filename} (id={doc_id}, chunks={chunks})")

        # Delete chunks first (foreign key constraint)
        await session.execute(
            text("DELETE FROM knowledge_chunks WHERE document_id = :doc_id"),
            {"doc_id": doc_id}
        )

        # Delete document
        await session.execute(
            text("DELETE FROM knowledge_documents WHERE id = :doc_id"),
            {"doc_id": doc_id}
        )

        deleted_count += 1

    await session.commit()
    logger.info(f"Deleted {deleted_count} existing datasheet document(s)")
    return deleted_count


async def reingest_datasheet():
    """Re-ingest the MS Family datasheet."""
    from src.config.database import get_db
    from src.services.document_ingestion_service import DocumentIngestionService
    from src.services.embedding_service import EmbeddingService

    # Check if file exists
    if not os.path.exists(DATASHEET_PATH):
        logger.error(f"Datasheet not found at: {DATASHEET_PATH}")
        return False

    # Get OpenAI key
    openai_key = await get_openai_key()
    if not openai_key:
        logger.error("OpenAI API key required. Set OPENAI_API_KEY env var or configure in UI.")
        return False

    os.environ["OPENAI_API_KEY"] = openai_key

    # Initialize services
    embedding_service = EmbeddingService(api_key=openai_key)
    ingestion_service = DocumentIngestionService(embedding_service=embedding_service)

    db = get_db()

    async with db.session() as session:
        # Delete existing datasheet
        logger.info("=" * 60)
        logger.info("STEP 1: Deleting existing datasheet")
        logger.info("=" * 60)
        await delete_existing_datasheet(session)

        # Re-ingest
        logger.info("\n" + "=" * 60)
        logger.info("STEP 2: Re-ingesting datasheet with improved chunking")
        logger.info("=" * 60)

        try:
            document = await ingestion_service.ingest_pdf_document(
                session=session,
                filepath=DATASHEET_PATH,
                filename=DATASHEET_FILENAME,
                doc_type="datasheet",  # Explicitly set as datasheet
                product="meraki",
                title="Cisco Meraki MS Family Datasheet",
                description="Official Cisco datasheet for Meraki MS switch family including MS130, MS150, MS210, MS225, MS450, and Catalyst 9200L-M/9300-M series"
            )

            logger.info(f"\nSUCCESS: Created document with {document.total_chunks} chunks")

            # Show chunk details
            from sqlalchemy import text
            result = await session.execute(
                text("""
                    SELECT chunk_index,
                           COALESCE((chunk_metadata->>'page')::int, 0) as page,
                           content_tokens,
                           LEFT(content, 80) as preview
                    FROM knowledge_chunks
                    WHERE document_id = :doc_id
                    ORDER BY chunk_index
                """),
                {"doc_id": document.id}
            )
            chunks = result.fetchall()

            logger.info(f"\nChunk summary ({len(chunks)} chunks):")
            logger.info("-" * 80)

            pages_covered = set()
            for chunk in chunks:
                idx, page, tokens, preview = chunk
                preview = (preview or '').replace('\n', ' ')[:60]
                logger.info(f"  Chunk {idx:2d} | Page {page:2d} | {tokens or 0:4d} tokens | {preview}...")
                if page > 0:
                    pages_covered.add(page)

            logger.info("-" * 80)
            logger.info(f"Pages covered: {sorted(pages_covered)}")
            logger.info(f"Total pages: {len(pages_covered)}")

            return True

        except Exception as e:
            logger.error(f"Failed to ingest datasheet: {e}")
            import traceback
            traceback.print_exc()
            return False


async def main():
    logger.info("=" * 60)
    logger.info("MS FAMILY DATASHEET RE-INGESTION")
    logger.info("=" * 60)

    success = await reingest_datasheet()

    if success:
        logger.info("\n" + "=" * 60)
        logger.info("RE-INGESTION COMPLETE")
        logger.info("=" * 60)
    else:
        logger.error("\n" + "=" * 60)
        logger.error("RE-INGESTION FAILED")
        logger.error("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
