"""Migration script to add OAuth 2.0 and MFA columns to users table."""

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


async def column_exists(session, table: str, column: str) -> bool:
    """Check if a column exists in a table."""
    result = await session.execute(text(
        f"SELECT column_name FROM information_schema.columns "
        f"WHERE table_schema='public' AND table_name='{table}' AND column_name='{column}'"
    ))
    return result.fetchone() is not None


async def migrate():
    """Add OAuth 2.0 and MFA columns to users table."""
    try:
        db = get_db()
        async with db.session() as session:
            # Check if users table exists
            check_users = await session.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='users'"
            ))
            if check_users.fetchone() is None:
                logger.error("Users table doesn't exist. Run migrate_add_authentication.py first.")
                sys.exit(1)

            # OAuth 2.0 columns
            oauth_columns = [
                ("oauth_provider", "VARCHAR(50)", None),
                ("oauth_id", "VARCHAR(255)", None),
                ("oauth_access_token", "TEXT", None),
                ("oauth_refresh_token", "TEXT", None),
                ("profile_picture_url", "VARCHAR(500)", None),
            ]

            # MFA columns
            mfa_columns = [
                ("mfa_enabled", "BOOLEAN", "false"),
                ("duo_user_id", "VARCHAR(255)", None),
            ]

            all_columns = oauth_columns + mfa_columns

            for col_name, col_type, default in all_columns:
                if not await column_exists(session, "users", col_name):
                    logger.info(f"Adding column: {col_name}")
                    default_clause = f" DEFAULT {default}" if default else ""
                    await session.execute(text(
                        f"ALTER TABLE users ADD COLUMN {col_name} {col_type}{default_clause}"
                    ))
                else:
                    logger.info(f"Column {col_name} already exists, skipping")

            # Create index on oauth_id for faster lookups
            index_check = await session.execute(text(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename='users' AND indexname='idx_users_oauth_id'"
            ))
            if index_check.fetchone() is None:
                logger.info("Creating index on oauth_id...")
                await session.execute(text(
                    "CREATE INDEX idx_users_oauth_id ON users(oauth_id)"
                ))

            # Create composite index on oauth_provider + oauth_id
            composite_index_check = await session.execute(text(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename='users' AND indexname='idx_users_oauth_provider_id'"
            ))
            if composite_index_check.fetchone() is None:
                logger.info("Creating composite index on oauth_provider + oauth_id...")
                await session.execute(text(
                    "CREATE INDEX idx_users_oauth_provider_id ON users(oauth_provider, oauth_id)"
                ))

            # Commit is handled by the context manager
            logger.info("OAuth/MFA migration completed successfully")

            # Print summary
            logger.info("")
            logger.info("=" * 60)
            logger.info("OAUTH & MFA SETUP INSTRUCTIONS")
            logger.info("=" * 60)
            logger.info("")
            logger.info("1. GOOGLE OAUTH SETUP:")
            logger.info("   - Go to https://console.cloud.google.com/")
            logger.info("   - Create a new project or select existing")
            logger.info("   - Go to APIs & Services > Credentials")
            logger.info("   - Create OAuth 2.0 Client ID (Web application)")
            logger.info("   - Add authorized redirect URI:")
            logger.info("     https://localhost:8002/api/auth/oauth/google/callback")
            logger.info("")
            logger.info("   Add to .env:")
            logger.info("   GOOGLE_OAUTH_CLIENT_ID=your-client-id")
            logger.info("   GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret")
            logger.info("")
            logger.info("2. DUO MFA SETUP:")
            logger.info("   - Go to https://admin.duosecurity.com/")
            logger.info("   - Create a new Application (Web SDK)")
            logger.info("   - Copy the Integration key, Secret key, and API hostname")
            logger.info("")
            logger.info("   Add to .env:")
            logger.info("   DUO_INTEGRATION_KEY=your-integration-key")
            logger.info("   DUO_SECRET_KEY=your-secret-key")
            logger.info("   DUO_API_HOSTNAME=api-xxxxxxxx.duosecurity.com")
            logger.info("   MFA_ENABLED=true")
            logger.info("")
            logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(migrate())
