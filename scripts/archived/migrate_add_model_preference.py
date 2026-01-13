"""Migration script to add preferred_model field to users table."""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config.database import get_db
from sqlalchemy import text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def migrate():
    """Add preferred_model column to users table."""
    try:
        db = get_db()
        async with db.session() as session:
            # Check if column already exists
            check_column = await session.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='preferred_model'"
            ))
            column_exists = check_column.fetchone() is not None

            # Add preferred_model column if it doesn't exist
            if not column_exists:
                logger.info("Adding preferred_model column to users table...")
                await session.execute(text(
                    "ALTER TABLE users ADD COLUMN preferred_model VARCHAR(100) "
                    "DEFAULT 'claude-sonnet-4-5-20250929'"
                ))
                logger.info("preferred_model column added successfully")
            else:
                logger.info("preferred_model column already exists, skipping")

            logger.info("Migration completed successfully")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(migrate())
