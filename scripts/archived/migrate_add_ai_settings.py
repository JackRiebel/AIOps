"""Migration script to add user API keys and AI settings fields to users table."""

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
    """Add user API keys and AI settings columns to users table."""
    try:
        db = get_db()
        async with db.session() as session:
            # Define columns to add
            columns_to_add = [
                ("user_anthropic_api_key", "TEXT"),  # Encrypted
                ("user_openai_api_key", "TEXT"),  # Encrypted
                ("user_google_api_key", "TEXT"),  # Encrypted
                ("ai_temperature", "FLOAT DEFAULT 0.7"),
                ("ai_max_tokens", "INTEGER DEFAULT 4096"),
            ]

            for column_name, column_type in columns_to_add:
                # Check if column already exists
                check_column = await session.execute(text(
                    f"SELECT column_name FROM information_schema.columns "
                    f"WHERE table_name='users' AND column_name='{column_name}'"
                ))
                column_exists = check_column.fetchone() is not None

                if not column_exists:
                    logger.info(f"Adding {column_name} column to users table...")
                    await session.execute(text(
                        f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"
                    ))
                    logger.info(f"{column_name} column added successfully")
                else:
                    logger.info(f"{column_name} column already exists, skipping")

            logger.info("Migration completed successfully")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(migrate())
