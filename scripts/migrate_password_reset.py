"""Migration script to add recovery key column to users table.

This replaces the email-based password reset with a one-time recovery key
that is shown at registration.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.config.database import get_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def migrate():
    """Add recovery_key_hash column and remove old password reset columns."""
    db = get_db()

    async with db.session() as session:
        try:
            # Check if recovery_key_hash already exists
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'recovery_key_hash'
            """))
            exists = result.scalar_one_or_none()

            if exists:
                logger.info("recovery_key_hash column already exists. Skipping migration.")
                return

            # Add new recovery key column
            logger.info("Adding recovery_key_hash column to users table...")
            await session.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS recovery_key_hash VARCHAR(255) DEFAULT NULL
            """))

            # Remove old password reset columns if they exist
            logger.info("Removing old password reset columns (if they exist)...")

            # Check and drop password_reset_code
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'password_reset_code'
            """))
            if result.scalar_one_or_none():
                await session.execute(text("ALTER TABLE users DROP COLUMN password_reset_code"))
                logger.info("  Dropped password_reset_code column")

            # Check and drop password_reset_expires
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'password_reset_expires'
            """))
            if result.scalar_one_or_none():
                await session.execute(text("ALTER TABLE users DROP COLUMN password_reset_expires"))
                logger.info("  Dropped password_reset_expires column")

            # Check and drop password_reset_attempts
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'password_reset_attempts'
            """))
            if result.scalar_one_or_none():
                await session.execute(text("ALTER TABLE users DROP COLUMN password_reset_attempts"))
                logger.info("  Dropped password_reset_attempts column")

            await session.commit()
            logger.info("Migration completed successfully!")
            logger.info("")
            logger.info("NOTE: Existing users will NOT have a recovery key.")
            logger.info("They can regenerate one from Account Settings after logging in.")

        except Exception as e:
            logger.error(f"Migration failed: {e}", exc_info=True)
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(migrate())
