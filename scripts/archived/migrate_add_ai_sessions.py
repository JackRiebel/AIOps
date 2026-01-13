"""Migration script to add AI sessions tracking tables."""

import asyncio
import asyncpg
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config.settings import get_settings

MIGRATION_SQL = """
-- AI Sessions table for tracking complete user sessions
CREATE TABLE IF NOT EXISTS ai_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session metadata
    name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Token and cost tracking (running totals)
    total_input_tokens BIGINT DEFAULT 0 NOT NULL,
    total_output_tokens BIGINT DEFAULT 0 NOT NULL,
    total_tokens BIGINT DEFAULT 0 NOT NULL,
    total_cost_usd NUMERIC(12, 8) DEFAULT 0 NOT NULL,

    -- Summarization cost (tracked separately)
    summary_input_tokens BIGINT DEFAULT 0 NOT NULL,
    summary_output_tokens BIGINT DEFAULT 0 NOT NULL,
    summary_cost_usd NUMERIC(12, 8) DEFAULT 0 NOT NULL,

    -- Event counts
    total_events INTEGER DEFAULT 0 NOT NULL,
    ai_query_count INTEGER DEFAULT 0 NOT NULL,
    api_call_count INTEGER DEFAULT 0 NOT NULL,
    navigation_count INTEGER DEFAULT 0 NOT NULL,
    click_count INTEGER DEFAULT 0 NOT NULL,
    edit_action_count INTEGER DEFAULT 0 NOT NULL,
    error_count INTEGER DEFAULT 0 NOT NULL,

    -- AI-generated summary (JSON structure)
    ai_summary JSONB
);

-- AI Session Events table for individual events
CREATE TABLE IF NOT EXISTS ai_session_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,

    -- Event metadata
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Event details (flexible JSON)
    event_data JSONB DEFAULT '{}'::jsonb NOT NULL,

    -- For AI operations
    input_tokens BIGINT,
    output_tokens BIGINT,
    cost_usd NUMERIC(12, 8),
    model VARCHAR(100),

    -- For API calls
    api_endpoint VARCHAR(512),
    api_method VARCHAR(10),
    api_status INTEGER,
    api_duration_ms INTEGER,

    -- For navigation/UI events
    page_path VARCHAR(512),
    element_id VARCHAR(255),
    element_type VARCHAR(50)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_status ON ai_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_started_at ON ai_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_session_events_session_id ON ai_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_session_events_event_type ON ai_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_session_events_timestamp ON ai_session_events(timestamp DESC);

-- Comments
COMMENT ON TABLE ai_sessions IS 'Tracks AI-assisted user sessions with full activity logging and AI-generated summaries';
COMMENT ON TABLE ai_session_events IS 'Individual events within an AI session - queries, API calls, navigation, clicks, etc.';
"""


async def run_migration():
    """Run the migration."""
    settings = get_settings()

    # Parse database URL
    db_url = settings.database_url
    if db_url.startswith("postgresql://"):
        conn_str = db_url
    else:
        print(f"Unsupported database URL: {db_url}")
        return

    print("Connecting to database...")
    conn = await asyncpg.connect(conn_str)

    try:
        print("Running AI sessions migration...")
        await conn.execute(MIGRATION_SQL)
        print("Migration completed successfully!")

        # Verify tables exist
        result = await conn.fetch("""
            SELECT table_name FROM information_schema.tables
            WHERE table_name IN ('ai_sessions', 'ai_session_events')
        """)
        print(f"Created tables: {[r['table_name'] for r in result]}")

    except Exception as e:
        print(f"Migration failed: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
