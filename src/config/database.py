# src/config/database.py
"""Database configuration and session management (PostgreSQL only)."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .settings import get_settings

# THE ONE AND ONLY SQLAlchemy Base — used by all models in src/models/
Base = declarative_base()


def _mask_url(url: str) -> str:
    """Mask password in a database connection URL for safe logging."""
    import re
    return re.sub(r'://([^:]+):([^@]+)@', r'://\1:****@', url)


def _import_all_models():
    """Import all models to register them with Base.metadata."""
    # This must be called before create_tables() for all tables to be created
    # Import here to avoid circular imports
    import src.models  # noqa: F401


class Database:
    """Database connection manager (PostgreSQL only)."""

    def __init__(self, database_url: str):
        self.database_url = database_url

        # Validate PostgreSQL URL
        if not database_url:
            raise ValueError(
                "Database URL is not set. If using embedded PostgreSQL, ensure it started correctly. "
                "Otherwise, set DATABASE_URL environment variable to a PostgreSQL connection string."
            )

        if not database_url.startswith("postgresql"):
            raise ValueError(
                "Only PostgreSQL is supported. URL must start with 'postgresql://'. "
                "Use embedded PostgreSQL (default) or set DATABASE_URL to a PostgreSQL connection string."
            )

        # Convert to async driver
        async_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1) if database_url else ""

        # Async engine with connection pooling
        # Embedded PostgreSQL has max_connections=100 (6 reserved for system)
        # Auth middleware now releases sessions early, so pool pressure is lower.
        self.async_engine = create_async_engine(
            async_url,
            echo=False,
            pool_pre_ping=True,
            pool_size=15,
            max_overflow=30,
            pool_recycle=300,  # Recycle connections after 5 minutes
            pool_timeout=30,  # Wait up to 30s for a connection
        ) if async_url else None

        self.async_session_factory = async_sessionmaker(
            self.async_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        ) if self.async_engine else None

        # Sync engine (for migrations)
        self.sync_engine = create_engine(
            database_url,
            echo=False,
            pool_pre_ping=True,
        ) if database_url else None

        self.sync_session_factory = sessionmaker(
            bind=self.sync_engine,
            expire_on_commit=False,
        ) if self.sync_engine else None

    async def create_tables(self):
        # Ensure all models are imported so they're registered with Base.metadata
        _import_all_models()
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Creating tables for {len(Base.metadata.tables)} models...")
        logger.info(f"Database URL: {_mask_url(self.database_url)}")
        try:
            # Use sync engine for table creation
            Base.metadata.create_all(bind=self.sync_engine)
            logger.info("Tables created successfully")
        except Exception as e:
            logger.exception(f"Failed to create tables: {e}")

    async def drop_tables(self):
        async with self.async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        async with self.async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def close(self):
        await self.async_engine.dispose()
        self.sync_engine.dispose()


# Global singleton
_db_instance: Database | None = None
_pg_started: bool = False


def _ensure_embedded_postgres() -> str:
    """
    Start embedded PostgreSQL if enabled and return the connection string.

    This is called synchronously during module initialization to ensure
    PostgreSQL is running before any database connections are attempted.
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)
    settings = get_settings()

    # If not using embedded postgres, return the configured URL
    if not settings.use_embedded_postgres:
        return settings.database_url

    # If URL is already set, embedded postgres may already be running
    if settings.database_url and settings.database_url.startswith("postgresql"):
        return settings.database_url

    # Start embedded PostgreSQL
    logger.info("Starting embedded PostgreSQL...")

    from src.services.embedded_postgres import get_embedded_postgres
    pg = get_embedded_postgres()

    # Run async initialization synchronously
    async def start_pg():
        await pg.initialize()
        success = await pg.start()
        if not success:
            raise RuntimeError(f"Failed to start embedded PostgreSQL: {pg.error_message}")
        return pg.connection_string

    # Get or create event loop
    try:
        loop = asyncio.get_running_loop()
        # If we're in an async context, we can't use asyncio.run()
        # Create a new thread to run the async code
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, start_pg())
            connection_string = future.result(timeout=60)
    except RuntimeError:
        # No running loop, safe to use asyncio.run()
        connection_string = asyncio.run(start_pg())

    # Update settings with the connection string
    settings.database_url = connection_string
    logger.info(f"Embedded PostgreSQL started: {_mask_url(connection_string)}")

    return connection_string


def get_db() -> Database:
    global _db_instance, _pg_started
    if _db_instance is None:
        settings = get_settings()

        # Ensure embedded PostgreSQL is running if enabled
        if settings.use_embedded_postgres and not _pg_started:
            _ensure_embedded_postgres()
            _pg_started = True

        _db_instance = Database(settings.database_url)
    return _db_instance


async def init_db():
    db = get_db()
    await db.create_tables()


def get_async_session():
    """Get an async database session context manager.

    Usage:
        async with get_async_session() as session:
            # Use session
    """
    db = get_db()
    return db.session()


# ————————————————————————————————————————————————
# Register ALL SQLAlchemy models from src/models/
# This is safe — no circular imports, no path issues
# ————————————————————————————————————————————————
import importlib
import logging

sql_alchemy_models = [
    "src.models.user",
    "src.models.session",
    "src.models.role",
    "src.models.permission",
    "src.models.organization",
    "src.models.api_endpoint",
    "src.models.audit",
    "src.models.chat",
    "src.models.cluster",
    "src.models.incident",
    "src.models.network_cache",
    "src.models.security",
    "src.models.ai_cost_log",
    "src.models.ai_session",
    "src.models.agent_event",
    "src.models.knowledge",
    "src.models.knowledge_feedback",
    "src.models.knowledge_entity",
    "src.models.workflow",
    "src.models.splunk_insight",
    "src.models.system_config",
    "src.models.canvas",
    "src.models.pending_action",
    "src.models.mfa_challenge",
    "src.models.network_change",
    "src.models.te_test_metric",
    "src.models.structured_dataset",
]

for module_name in sql_alchemy_models:
    try:
        importlib.import_module(module_name)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Could not load model {module_name}: {e}")

# Optional: nice exports
__all__ = ["Base", "Database", "get_db", "init_db", "get_async_session"]