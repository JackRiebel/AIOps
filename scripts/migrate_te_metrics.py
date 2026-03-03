#!/usr/bin/env python3
"""Migration script for ThousandEyes test metrics table.

Creates the te_test_metrics table and indexes for 7-day local storage
of ThousandEyes test results. Safe to run multiple times (IF NOT EXISTS).

Usage:
    python scripts/migrate_te_metrics.py

Environment:
    DATABASE_URL - PostgreSQL connection string
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS te_test_metrics (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL,
    test_name VARCHAR(500),
    test_type VARCHAR(100),
    round_id BIGINT NOT NULL,
    agent_id INTEGER,
    agent_name VARCHAR(255),
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    avg_latency_ms DOUBLE PRECISION,
    loss_pct DOUBLE PRECISION,
    jitter_ms DOUBLE PRECISION,
    response_time_ms DOUBLE PRECISION,
    connect_time_ms DOUBLE PRECISION,
    dns_time_ms DOUBLE PRECISION,
    wait_time_ms DOUBLE PRECISION,
    error_type VARCHAR(100),
    path_hops JSONB,
    UNIQUE(test_id, round_id, agent_id)
);
"""

CREATE_INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_te_metrics_test_id ON te_test_metrics(test_id);",
    "CREATE INDEX IF NOT EXISTS idx_te_metrics_timestamp ON te_test_metrics(timestamp DESC);",
    "CREATE INDEX IF NOT EXISTS idx_te_metrics_test_ts ON te_test_metrics(test_id, timestamp DESC);",
]


async def migrate_postgresql():
    """Create te_test_metrics table in PostgreSQL."""
    try:
        import asyncpg
    except ImportError:
        print("asyncpg not installed. Install with: pip install asyncpg")
        return False

    db_url = os.environ.get("DATABASE_URL")
    if not db_url or not db_url.startswith("postgresql"):
        print("DATABASE_URL not set or not PostgreSQL")
        return False

    print("Migrating PostgreSQL database...")

    conn = await asyncpg.connect(db_url)

    try:
        # Check if table already exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'te_test_metrics'
            )
        """)

        if table_exists:
            print("  [SKIP] te_test_metrics table already exists")
        else:
            print("  [CREATE] te_test_metrics table...")
            await conn.execute(CREATE_TABLE_SQL)
            print("  [OK] Table created")

        # Create indexes (idempotent)
        for idx_sql in CREATE_INDEXES_SQL:
            await conn.execute(idx_sql)
        print("  [OK] Indexes verified")

        # Show current row count
        count = await conn.fetchval("SELECT COUNT(*) FROM te_test_metrics")
        print(f"\n  Current rows: {count}")

        return True
    finally:
        await conn.close()


async def main():
    """Run the migration."""
    print("=" * 60)
    print("ThousandEyes Test Metrics Migration")
    print("=" * 60)
    print()

    success = await migrate_postgresql()

    if success:
        print("\nMigration successful!")
        print("\nThe background job scheduler will automatically collect metrics every 5 minutes.")
        print("Metrics older than 7 days are cleaned up every 6 hours.")
        print("\nAPI endpoints available:")
        print("  GET /api/te-metrics/status        - Collection statistics")
        print("  GET /api/te-metrics/history/{id}   - Raw metrics for a test")
        print("  GET /api/te-metrics/aggregates/{id} - Bucketed aggregates")
        print("  GET /api/te-metrics/bottlenecks    - High latency/loss tests")
        print("  GET /api/te-metrics/trends          - 1h vs 24h comparison")
    else:
        print("\nMigration failed. Check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
