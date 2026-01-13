"""Migration script to add authentication tables (users and sessions)."""

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
    """Create users and sessions tables for authentication."""
    try:
        async with get_db() as db:
            # Check if users table already exists
            check_users = await db.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='users'"
            ))
            users_exists = check_users.fetchone() is not None

            # Create users table if it doesn't exist
            if not users_exists:
                logger.info("Creating users table...")
                await db.execute(text("""
                    CREATE TABLE users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        hashed_password VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
                        is_active BOOLEAN NOT NULL DEFAULT true,
                        full_name VARCHAR(255),
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        last_login TIMESTAMP,
                        created_by INTEGER
                    )
                """))

                # Create indexes for users table
                await db.execute(text(
                    "CREATE INDEX idx_users_username ON users(username)"
                ))
                await db.execute(text(
                    "CREATE INDEX idx_users_email ON users(email)"
                ))
                await db.execute(text(
                    "CREATE INDEX idx_users_role ON users(role)"
                ))
                await db.execute(text(
                    "CREATE INDEX idx_users_is_active ON users(is_active)"
                ))

                logger.info("Users table created successfully")
            else:
                logger.info("Users table already exists, skipping")

            # Check if sessions table already exists
            check_sessions = await db.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='sessions'"
            ))
            sessions_exists = check_sessions.fetchone() is not None

            # Create sessions table if it doesn't exist
            if not sessions_exists:
                logger.info("Creating sessions table...")
                await db.execute(text("""
                    CREATE TABLE sessions (
                        id SERIAL PRIMARY KEY,
                        session_token VARCHAR(255) UNIQUE NOT NULL,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL,
                        last_accessed TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ip_address VARCHAR(45),
                        user_agent VARCHAR(500)
                    )
                """))

                # Create indexes for sessions table
                await db.execute(text(
                    "CREATE INDEX idx_sessions_session_token ON sessions(session_token)"
                ))
                await db.execute(text(
                    "CREATE INDEX idx_sessions_user_id ON sessions(user_id)"
                ))
                await db.execute(text(
                    "CREATE INDEX idx_sessions_expires_at ON sessions(expires_at)"
                ))

                logger.info("Sessions table created successfully")
            else:
                logger.info("Sessions table already exists, skipping")

            await db.commit()
            logger.info("Authentication migration completed successfully")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(migrate())
