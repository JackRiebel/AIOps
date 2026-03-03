#!/usr/bin/env python3
"""Migration script for Agentic RAG configuration.

This script adds the necessary configuration keys for the Agentic RAG
pipeline to existing databases. It can be run safely multiple times
as it uses INSERT OR IGNORE to avoid duplicates.

Usage:
    python scripts/migrate_agentic_rag.py

Environment:
    DATABASE_URL - Database connection string (default: sqlite:///data/lumen.db)
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


# Agentic RAG configuration keys to add
AGENTIC_RAG_CONFIGS = [
    {
        "key": "agentic_rag_enabled",
        "value": "false",
        "description": "Enable agentic RAG pipeline for enhanced knowledge retrieval",
        "category": "ai",
    },
    {
        "key": "agentic_rag_max_iterations",
        "value": "2",
        "description": "Maximum reflection iterations for quality improvement",
        "category": "ai",
    },
    {
        "key": "agentic_rag_timeout",
        "value": "15",
        "description": "Total timeout in seconds for agentic RAG pipeline",
        "category": "ai",
    },
    {
        "key": "agentic_rag_query_analysis",
        "value": "true",
        "description": "Enable query analysis and decomposition",
        "category": "ai",
    },
    {
        "key": "agentic_rag_document_grading",
        "value": "true",
        "description": "Enable LLM-based document relevance grading",
        "category": "ai",
    },
    {
        "key": "agentic_rag_reflection",
        "value": "true",
        "description": "Enable self-reflection and quality assessment",
        "category": "ai",
    },
    {
        "key": "agentic_rag_web_search",
        "value": "false",
        "description": "Enable web search fallback when KB is insufficient",
        "category": "ai",
    },
    {
        "key": "agentic_rag_debug_mode",
        "value": "false",
        "description": "Enable verbose logging for agentic RAG pipeline",
        "category": "ai",
    },
    # Web search API keys
    {
        "key": "tavily_api_key",
        "value": "",
        "description": "Tavily API key for web search (recommended for RAG)",
        "category": "integrations",
    },
    {
        "key": "serpapi_api_key",
        "value": "",
        "description": "SerpAPI key for Google search results",
        "category": "integrations",
    },
]


async def migrate_sqlite():
    """Migrate SQLite database."""
    import aiosqlite

    db_path = os.environ.get("DATABASE_PATH", "data/lumen.db")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("Run scripts/init_database.py first to create the database.")
        return False

    print(f"Migrating SQLite database at {db_path}...")

    async with aiosqlite.connect(db_path) as db:
        # Check if system_configs table exists
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='system_configs'"
        )
        table_exists = await cursor.fetchone()

        if not table_exists:
            print("Creating system_configs table...")
            await db.execute("""
                CREATE TABLE IF NOT EXISTS system_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    description TEXT,
                    category TEXT DEFAULT 'general',
                    sensitive BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            await db.commit()

        # Insert configuration keys
        added = 0
        skipped = 0

        for config in AGENTIC_RAG_CONFIGS:
            try:
                # Check if key already exists
                cursor = await db.execute(
                    "SELECT key FROM system_configs WHERE key = ?",
                    (config["key"],)
                )
                existing = await cursor.fetchone()

                if existing:
                    print(f"  [SKIP] {config['key']} (already exists)")
                    skipped += 1
                else:
                    await db.execute(
                        """
                        INSERT INTO system_configs (key, value, description, category, sensitive)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            config["key"],
                            config["value"],
                            config["description"],
                            config["category"],
                            config["key"].endswith("_key"),  # Mark API keys as sensitive
                        )
                    )
                    print(f"  [ADD] {config['key']}")
                    added += 1

            except Exception as e:
                print(f"  [ERROR] {config['key']}: {e}")

        await db.commit()

        print(f"\nMigration complete: {added} added, {skipped} skipped")
        return True


async def migrate_postgresql():
    """Migrate PostgreSQL database."""
    try:
        import asyncpg
    except ImportError:
        print("asyncpg not installed. Install with: pip install asyncpg")
        return False

    db_url = os.environ.get("DATABASE_URL")
    if not db_url or not db_url.startswith("postgresql"):
        print("DATABASE_URL not set or not PostgreSQL")
        return False

    print(f"Migrating PostgreSQL database...")

    conn = await asyncpg.connect(db_url)

    try:
        # Check if system_configs table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'system_configs'
            )
        """)

        if not table_exists:
            print("Creating system_configs table...")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS system_configs (
                    id SERIAL PRIMARY KEY,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    description TEXT,
                    category TEXT DEFAULT 'general',
                    sensitive BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        # Insert configuration keys
        added = 0
        skipped = 0

        for config in AGENTIC_RAG_CONFIGS:
            try:
                existing = await conn.fetchval(
                    "SELECT key FROM system_configs WHERE key = $1",
                    config["key"]
                )

                if existing:
                    print(f"  [SKIP] {config['key']} (already exists)")
                    skipped += 1
                else:
                    await conn.execute(
                        """
                        INSERT INTO system_configs (key, value, description, category, sensitive)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        config["key"],
                        config["value"],
                        config["description"],
                        config["category"],
                        config["key"].endswith("_key"),
                    )
                    print(f"  [ADD] {config['key']}")
                    added += 1

            except Exception as e:
                print(f"  [ERROR] {config['key']}: {e}")

        print(f"\nMigration complete: {added} added, {skipped} skipped")
        return True

    finally:
        await conn.close()


async def main():
    """Run the migration."""
    print("=" * 60)
    print("Agentic RAG Configuration Migration")
    print("=" * 60)
    print()

    db_url = os.environ.get("DATABASE_URL", "")

    if db_url.startswith("postgresql"):
        success = await migrate_postgresql()
    else:
        success = await migrate_sqlite()

    if success:
        print("\nMigration successful!")
        print("\nTo enable Agentic RAG, set the following in your database:")
        print("  UPDATE system_configs SET value = 'true' WHERE key = 'agentic_rag_enabled';")
        print("\nOr configure it through the AI Settings page in the web UI.")
    else:
        print("\nMigration failed. Check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
