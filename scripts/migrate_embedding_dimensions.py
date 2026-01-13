"""Migration script to change embedding dimensions from 1536 to 384.

This is needed when switching from OpenAI embeddings (1536 dim) to local
e5-small-v2 embeddings (384 dim).
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def migrate_embedding_dimensions():
    """Migrate embedding columns from 1536 to 384 dimensions."""
    from src.config import get_settings
    from src.services.embedded_postgres import get_embedded_postgres
    import asyncpg

    settings = get_settings()

    # Start embedded PostgreSQL if needed
    if settings.use_embedded_postgres:
        logger.info("Starting embedded PostgreSQL...")
        pg = get_embedded_postgres()
        await pg.initialize()
        success = await pg.start()
        if success:
            settings.database_url = pg.connection_string
        else:
            logger.error("Failed to start embedded PostgreSQL")
            sys.exit(1)

    # Connect to the database
    db_url = settings.database_url
    # Convert SQLAlchemy URL to asyncpg format
    if db_url.startswith("postgresql://"):
        asyncpg_url = db_url
    elif db_url.startswith("postgresql+asyncpg://"):
        asyncpg_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    else:
        logger.error(f"Unsupported database URL format: {db_url}")
        sys.exit(1)

    logger.info("Connecting to database...")
    conn = await asyncpg.connect(asyncpg_url)

    try:
        # Check current state
        logger.info("Checking current embedding dimensions...")

        # Check knowledge_chunks table
        chunks_result = await conn.fetchrow("""
            SELECT COUNT(*) as count FROM knowledge_chunks
        """)
        chunks_count = chunks_result['count'] if chunks_result else 0
        logger.info(f"Found {chunks_count} existing chunks")

        # Check knowledge_entities table
        entities_result = await conn.fetchrow("""
            SELECT COUNT(*) as count FROM knowledge_entities
        """)
        entities_count = entities_result['count'] if entities_result else 0
        logger.info(f"Found {entities_count} existing entities")

        if chunks_count > 0 or entities_count > 0:
            logger.warning("Existing embeddings found. They will need to be regenerated.")
            logger.warning("Clearing existing embeddings to allow dimension change...")

            # Clear existing embeddings (set to NULL)
            await conn.execute("UPDATE knowledge_chunks SET embedding = NULL")
            await conn.execute("UPDATE knowledge_entities SET embedding = NULL")
            logger.info("Cleared existing embeddings")

        # Alter the column types
        logger.info("Altering knowledge_chunks.embedding to vector(384)...")
        await conn.execute("""
            ALTER TABLE knowledge_chunks
            ALTER COLUMN embedding TYPE vector(384)
        """)
        logger.info("Successfully altered knowledge_chunks.embedding")

        logger.info("Altering knowledge_entities.embedding to vector(384)...")
        await conn.execute("""
            ALTER TABLE knowledge_entities
            ALTER COLUMN embedding TYPE vector(384)
        """)
        logger.info("Successfully altered knowledge_entities.embedding")

        logger.info("Migration completed successfully!")

        if chunks_count > 0:
            logger.warning(f"NOTE: {chunks_count} chunks need to be re-embedded.")
            logger.warning("Delete and re-import documents to regenerate embeddings.")

    except asyncpg.exceptions.UndefinedTableError as e:
        logger.error(f"Table not found: {e}")
        logger.info("Run init_database.py first to create tables")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate_embedding_dimensions())
