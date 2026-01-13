"""Database initialization script.

This script initializes the database schema and optionally sets up default credentials.
It handles embedded PostgreSQL startup if USE_EMBEDDED_POSTGRES is enabled.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import get_settings, init_db
from src.services.credential_manager import CredentialManager
# Import all models so they're registered with SQLAlchemy
from src.models.cluster import Cluster
from src.models.audit import AuditLog
from src.models.security import SecurityConfig
from src.models.chat import ChatConversation, ChatMessage
from src.models.incident import Event, Incident
from src.models.network_cache import CachedNetwork, CachedDevice

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def start_embedded_postgres():
    """Start embedded PostgreSQL if enabled and not already running."""
    settings = get_settings()

    if not settings.use_embedded_postgres:
        logger.info("Using external PostgreSQL (USE_EMBEDDED_POSTGRES=false)")
        return

    logger.info("Starting embedded PostgreSQL...")
    from src.services.embedded_postgres import get_embedded_postgres
    pg = get_embedded_postgres()

    # Initialize and start PostgreSQL
    await pg.initialize()
    success = await pg.start()

    if success:
        # Update settings with the connection string
        settings.database_url = pg.connection_string
        logger.info(f"Embedded PostgreSQL started: {pg.connection_string}")
    else:
        logger.error("Failed to start embedded PostgreSQL")
        sys.exit(1)


async def main():
    """Initialize database and optionally add default organization."""
    try:
        # Start embedded PostgreSQL if needed
        await start_embedded_postgres()

        # Initialize database schema
        logger.info("Initializing database schema...")
        await init_db()
        logger.info("Database initialized successfully")

        # Check if we should add credentials from environment
        settings = get_settings()

        if settings.meraki_api_key:
            logger.info("Found Meraki Dashboard API key in environment")
            logger.info(f"Adding default organization with base URL: {settings.meraki_base_url}")

            credential_manager = CredentialManager()
            await credential_manager.store_credentials(
                name="default",
                api_key=settings.meraki_api_key,
                base_url=settings.meraki_base_url,
                verify_ssl=settings.meraki_verify_ssl,
            )

            logger.info("Default organization credentials stored successfully")
        else:
            logger.warning("No Meraki Dashboard API key found in environment")
            logger.warning(
                "Please set MERAKI_API_KEY "
                "or add credentials manually"
            )

    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
