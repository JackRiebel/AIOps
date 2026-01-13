"""
Embedded PostgreSQL server management using pgserver.

This service provides a zero-configuration PostgreSQL experience by using the
pgserver package, which downloads and runs PostgreSQL binaries automatically.
"""
import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)


class PostgresStatus(Enum):
    """Status states for the embedded PostgreSQL server."""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    ERROR = "error"
    NOT_INITIALIZED = "not_initialized"


class EmbeddedPostgres:
    """
    Manages embedded PostgreSQL server lifecycle.

    This class provides methods to initialize, start, stop, and restart
    an embedded PostgreSQL server using the pgserver package.
    """

    def __init__(self, data_dir: str = "data/postgres"):
        """
        Initialize the embedded PostgreSQL manager.

        Args:
            data_dir: Directory to store PostgreSQL data files.
        """
        self.data_dir = Path(data_dir).resolve()
        self.pg = None
        self._status = PostgresStatus.NOT_INITIALIZED
        self._connection_string: Optional[str] = None
        self._error_message: Optional[str] = None

    @property
    def status(self) -> PostgresStatus:
        """Get the current server status."""
        return self._status

    @property
    def connection_string(self) -> Optional[str]:
        """Get the database connection string (only available when running)."""
        return self._connection_string

    @property
    def error_message(self) -> Optional[str]:
        """Get the last error message if status is ERROR."""
        return self._error_message

    def _check_initialized(self) -> bool:
        """Check if the PostgreSQL data directory exists and is initialized."""
        pg_version_file = self.data_dir / "PG_VERSION"
        return pg_version_file.exists()

    async def initialize(self) -> bool:
        """
        Initialize PostgreSQL data directory if needed.

        Returns:
            True if initialization successful, False otherwise.
        """
        try:
            # Import pgserver to ensure it's available
            import pgserver

            # Create data directory
            self.data_dir.mkdir(parents=True, exist_ok=True)

            if self._check_initialized():
                logger.info(f"PostgreSQL already initialized at: {self.data_dir}")
                self._status = PostgresStatus.STOPPED
            else:
                logger.info(f"PostgreSQL data directory ready: {self.data_dir}")
                self._status = PostgresStatus.STOPPED

            return True

        except ImportError as e:
            self._error_message = "pgserver package not installed. Run: pip install pgserver"
            logger.error(self._error_message)
            self._status = PostgresStatus.ERROR
            return False
        except Exception as e:
            self._error_message = f"Failed to initialize PostgreSQL: {e}"
            logger.error(self._error_message)
            self._status = PostgresStatus.ERROR
            return False

    async def start(self) -> bool:
        """
        Start the embedded PostgreSQL server.

        Returns:
            True if server started successfully, False otherwise.
        """
        if self._status == PostgresStatus.RUNNING:
            logger.info("PostgreSQL is already running")
            return True

        try:
            import pgserver

            self._status = PostgresStatus.STARTING
            logger.info(f"Starting embedded PostgreSQL from: {self.data_dir}")

            # Create/start PostgreSQL server
            # pgserver.get_server() handles initialization if needed
            self.pg = pgserver.get_server(self.data_dir)

            # Get connection string for our database
            self._connection_string = self.pg.get_uri(database="lumen")

            logger.info(f"PostgreSQL connection: {self._connection_string}")

            # Create database and enable extensions
            await self._ensure_database_and_extensions()

            self._status = PostgresStatus.RUNNING
            self._error_message = None
            logger.info("Embedded PostgreSQL started successfully")
            return True

        except ImportError as e:
            self._error_message = "pgserver package not installed"
            logger.error(self._error_message)
            self._status = PostgresStatus.ERROR
            return False
        except Exception as e:
            self._error_message = f"Failed to start PostgreSQL: {e}"
            logger.error(self._error_message)
            self._status = PostgresStatus.ERROR
            return False

    async def stop(self) -> bool:
        """
        Stop the embedded PostgreSQL server.

        Returns:
            True if server stopped successfully, False otherwise.
        """
        if self._status in (PostgresStatus.STOPPED, PostgresStatus.NOT_INITIALIZED):
            logger.info("PostgreSQL is already stopped")
            return True

        try:
            self._status = PostgresStatus.STOPPING

            if self.pg:
                logger.info("Stopping embedded PostgreSQL...")
                self.pg.cleanup()
                self.pg = None

            self._status = PostgresStatus.STOPPED
            self._connection_string = None
            self._error_message = None
            logger.info("PostgreSQL stopped successfully")
            return True

        except Exception as e:
            self._error_message = f"Failed to stop PostgreSQL: {e}"
            logger.error(self._error_message)
            self._status = PostgresStatus.ERROR
            return False

    async def restart(self) -> bool:
        """
        Restart the PostgreSQL server.

        Returns:
            True if restart successful, False otherwise.
        """
        logger.info("Restarting embedded PostgreSQL...")
        await self.stop()
        await asyncio.sleep(1)  # Brief pause between stop and start
        return await self.start()

    async def _ensure_database_and_extensions(self):
        """Create the database if needed and enable required extensions."""
        if not self.pg:
            return

        try:
            import asyncpg

            # First, connect to the default 'postgres' database to create our database
            postgres_uri = self.pg.get_uri(database="postgres")
            logger.info("Connecting to PostgreSQL to create database...")

            conn = await asyncpg.connect(postgres_uri)
            try:
                # Check if 'lumen' database exists
                result = await conn.fetchval(
                    "SELECT 1 FROM pg_database WHERE datname = 'lumen'"
                )

                if not result:
                    # Create the database
                    await conn.execute('CREATE DATABASE lumen')
                    logger.info("Created 'lumen' database")
                else:
                    logger.info("Database 'lumen' already exists")
            finally:
                await conn.close()

            # Now connect to 'lumen' database and enable extensions
            lumen_conn = await asyncpg.connect(self._connection_string)
            try:
                # Enable pgvector for embedding support
                await lumen_conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
                logger.info("PostgreSQL extensions enabled (vector)")
            finally:
                await lumen_conn.close()

        except Exception as e:
            # Database/extensions issues - log but don't fail startup
            logger.warning(f"Could not setup database/extensions: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """
        Get PostgreSQL server statistics.

        Returns:
            Dictionary with server status and statistics.
        """
        return {
            "status": self._status.value,
            "data_dir": str(self.data_dir),
            "connection_string": self._mask_connection_string(),
            "data_size_mb": self._get_data_size(),
            "initialized": self._check_initialized(),
            "error": self._error_message,
        }

    def _mask_connection_string(self) -> Optional[str]:
        """Return connection string with password masked for display."""
        if not self._connection_string:
            return None
        # pgserver typically uses socket auth, but mask just in case
        import re
        return re.sub(r':([^:@]+)@', ':****@', self._connection_string)

    def _get_data_size(self) -> float:
        """
        Calculate PostgreSQL data directory size in MB.

        Returns:
            Size in megabytes, rounded to 2 decimal places.
        """
        if not self.data_dir.exists():
            return 0.0

        try:
            total = sum(
                f.stat().st_size
                for f in self.data_dir.rglob("*")
                if f.is_file()
            )
            return round(total / (1024 * 1024), 2)
        except Exception:
            return 0.0


# Global singleton instance
_postgres: Optional[EmbeddedPostgres] = None


def get_embedded_postgres() -> EmbeddedPostgres:
    """
    Get the embedded PostgreSQL singleton instance.

    Returns:
        The EmbeddedPostgres instance.
    """
    global _postgres
    if _postgres is None:
        _postgres = EmbeddedPostgres()
    return _postgres


def reset_embedded_postgres():
    """Reset the singleton (useful for testing)."""
    global _postgres
    _postgres = None
