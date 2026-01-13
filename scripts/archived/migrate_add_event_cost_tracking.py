"""Migration script to add cost tracking fields to events table."""

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
    """Add ai_cost and token_count columns to events table."""
    try:
        async with get_db() as db:
            # Check if columns already exist
            check_ai_cost = await db.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='events' AND column_name='ai_cost'"
            ))
            ai_cost_exists = check_ai_cost.fetchone() is not None

            check_token_count = await db.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='events' AND column_name='token_count'"
            ))
            token_count_exists = check_token_count.fetchone() is not None

            # Add ai_cost column if it doesn't exist
            if not ai_cost_exists:
                logger.info("Adding ai_cost column to events table...")
                await db.execute(text(
                    "ALTER TABLE events ADD COLUMN ai_cost REAL"
                ))
                logger.info("ai_cost column added successfully")
            else:
                logger.info("ai_cost column already exists, skipping")

            # Add token_count column if it doesn't exist
            if not token_count_exists:
                logger.info("Adding token_count column to events table...")
                await db.execute(text(
                    "ALTER TABLE events ADD COLUMN token_count INTEGER"
                ))
                logger.info("token_count column added successfully")
            else:
                logger.info("token_count column already exists, skipping")

            await db.commit()
            logger.info("Migration completed successfully")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(migrate())
