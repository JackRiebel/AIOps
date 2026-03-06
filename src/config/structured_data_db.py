"""Second async SQLAlchemy engine for the external Postgres instance holding performance data.

The app's embedded Postgres stores metadata (dataset records, embeddings, query logs).
This module provides the engine for creating data tables, inserting data, and running queries
against the user's separate Postgres instance.
"""

import logging
from typing import Optional, AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker, AsyncEngine

logger = logging.getLogger(__name__)

_structured_engine: Optional[AsyncEngine] = None
_structured_session_factory: Optional[async_sessionmaker] = None


def init_structured_data_engine(database_url: str) -> AsyncEngine:
    """Initialize the async engine for the external structured data Postgres.

    Args:
        database_url: PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/perfdata)
    """
    global _structured_engine, _structured_session_factory

    if not database_url:
        raise ValueError("STRUCTURED_DATA_DATABASE_URL is not set")
    if not database_url.startswith("postgresql"):
        raise ValueError("Structured data database URL must be a PostgreSQL connection string")

    async_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    _structured_engine = create_async_engine(
        async_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=300,
        pool_timeout=30,
    )

    _structured_session_factory = async_sessionmaker(
        _structured_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    logger.info("Structured data engine initialized")
    return _structured_engine


def get_structured_engine() -> AsyncEngine:
    """Get the structured data async engine."""
    if _structured_engine is None:
        raise RuntimeError(
            "Structured data engine not initialized. "
            "Set STRUCTURED_DATA_DATABASE_URL and ensure init_structured_data_engine() is called."
        )
    return _structured_engine


@asynccontextmanager
async def get_structured_session() -> AsyncGenerator[AsyncSession, None]:
    """Get a session for the external structured data Postgres."""
    if _structured_session_factory is None:
        raise RuntimeError("Structured data engine not initialized")
    async with _structured_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def close_structured_engine():
    """Dispose the structured data engine on shutdown."""
    global _structured_engine, _structured_session_factory
    if _structured_engine:
        await _structured_engine.dispose()
        _structured_engine = None
        _structured_session_factory = None
        logger.info("Structured data engine closed")
