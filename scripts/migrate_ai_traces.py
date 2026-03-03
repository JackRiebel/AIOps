#!/usr/bin/env python3
"""
AI Query Traces Migration Script

Creates the ai_query_traces table for end-to-end AI journey tracing.
Captures every span of an AI query lifecycle: LLM calls, tool executions,
synthesis steps, with timing, cost, and network metrics.

Usage:
    python scripts/migrate_ai_traces.py

The script is idempotent - running it multiple times is safe.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from src.config.database import get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ai_query_traces (
    id SERIAL PRIMARY KEY,
    trace_id UUID NOT NULL,
    parent_span_id INTEGER REFERENCES ai_query_traces(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES ai_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Span identification
    span_type VARCHAR(30) NOT NULL,
    span_name VARCHAR(255),
    iteration INTEGER DEFAULT 0,

    -- Timing
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,

    -- LLM call fields (nullable)
    model VARCHAR(100),
    provider VARCHAR(30),
    input_tokens BIGINT,
    output_tokens BIGINT,
    cost_usd NUMERIC(12, 8),
    thinking_tokens BIGINT,

    -- Tool execution fields (nullable)
    tool_name VARCHAR(255),
    tool_input JSONB,
    tool_output_summary TEXT,
    tool_success BOOLEAN,
    tool_platform VARCHAR(30),
    tool_error TEXT,

    -- Network timing (nullable)
    dns_ms INTEGER,
    tcp_connect_ms INTEGER,
    tls_ms INTEGER,
    ttfb_ms INTEGER,

    -- Network path info
    server_ip VARCHAR(45),
    server_port INTEGER,
    tls_version VARCHAR(20),
    http_version VARCHAR(10),
    network_path JSONB,

    -- Status
    status VARCHAR(20) DEFAULT 'running',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);
"""

CREATE_INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_aqt_trace_id ON ai_query_traces(trace_id);",
    "CREATE INDEX IF NOT EXISTS idx_aqt_session_id ON ai_query_traces(session_id);",
    "CREATE INDEX IF NOT EXISTS idx_aqt_user_id ON ai_query_traces(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_aqt_start_time ON ai_query_traces(start_time DESC);",
    "CREATE INDEX IF NOT EXISTS idx_aqt_span_type ON ai_query_traces(span_type);",
]


async def run_migration():
    """Run the AI query traces migration."""
    logger.info("=" * 60)
    logger.info("Starting AI Query Traces Migration")
    logger.info("=" * 60)

    try:
        db = get_db()
        async with db.async_engine.begin() as conn:
            # Create table
            await conn.execute(text(CREATE_TABLE_SQL))
            logger.info("Created ai_query_traces table")

            # Create indexes
            for idx_sql in CREATE_INDEXES_SQL:
                await conn.execute(text(idx_sql))
            logger.info("Created indexes on ai_query_traces")

            # Add new columns if table already existed (idempotent)
            add_columns = [
                ("server_ip", "VARCHAR(45)"),
                ("server_port", "INTEGER"),
                ("tls_version", "VARCHAR(20)"),
                ("http_version", "VARCHAR(10)"),
                ("network_path", "JSONB"),
            ]
            for col_name, col_type in add_columns:
                await conn.execute(text(f"""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                       WHERE table_name='ai_query_traces' AND column_name='{col_name}') THEN
                            ALTER TABLE ai_query_traces ADD COLUMN {col_name} {col_type};
                        END IF;
                    END $$;
                """))
            logger.info("Ensured network path columns exist")

        logger.info("=" * 60)
        logger.info("AI Query Traces Migration completed successfully!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(run_migration())
