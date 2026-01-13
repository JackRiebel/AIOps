#!/usr/bin/env python3
"""Database migration: Add performance indexes for improved query performance.

This migration adds indexes to frequently queried columns across all tables
to improve database performance for common operations like:
- Listing conversations by user
- Filtering events by time range
- Looking up sessions by user
- Searching audit logs
- etc.

Run this script to apply the migration:
    python scripts/migrate_add_performance_indexes.py
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.config.database import get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Index definitions organized by table
# Format: (index_name, table_name, column_expression, is_unique)
INDEXES = [
    # =========================================================================
    # Chat tables - frequently queried by user and organization
    # =========================================================================
    ("idx_chat_conversations_user_id", "chat_conversations", "user_id", False),
    ("idx_chat_conversations_organization", "chat_conversations", "organization", False),
    ("idx_chat_conversations_last_activity", "chat_conversations", "last_activity DESC", False),
    ("idx_chat_conversations_is_active", "chat_conversations", "is_active", False),
    ("idx_chat_conversations_user_org", "chat_conversations", "user_id, organization", False),

    ("idx_chat_messages_conversation_id", "chat_messages", "conversation_id", False),
    ("idx_chat_messages_created_at", "chat_messages", "created_at DESC", False),
    ("idx_chat_messages_role", "chat_messages", "role", False),
    ("idx_chat_messages_conv_created", "chat_messages", "conversation_id, created_at DESC", False),

    # =========================================================================
    # Events table - heavy filtering by source, severity, time
    # =========================================================================
    ("idx_events_source_severity", "events", "source, severity", False),
    ("idx_events_org_timestamp", "events", "organization, timestamp DESC", False),
    ("idx_events_source_timestamp", "events", "source, timestamp DESC", False),
    ("idx_events_source_event_id", "events", "source_event_id", False),
    ("idx_events_affected_resource", "events", "affected_resource", False),
    ("idx_events_created_at", "events", "created_at DESC", False),

    # =========================================================================
    # Incidents table - status filtering, time-based queries
    # =========================================================================
    ("idx_incidents_status_severity", "incidents", "status, severity", False),
    ("idx_incidents_created_at", "incidents", "created_at DESC", False),
    ("idx_incidents_updated_at", "incidents", "updated_at DESC", False),
    ("idx_incidents_end_time", "incidents", "end_time", False),

    # =========================================================================
    # AI Cost tracking - user-based reporting, time series
    # =========================================================================
    ("idx_ai_cost_logs_user_id", "ai_cost_logs", "user_id", False),
    ("idx_ai_cost_logs_conversation_id", "ai_cost_logs", "conversation_id", False),
    ("idx_ai_cost_logs_model", "ai_cost_logs", "model", False),
    ("idx_ai_cost_logs_user_timestamp", "ai_cost_logs", "user_id, timestamp DESC", False),

    # =========================================================================
    # Session table - cleanup queries, user lookups
    # =========================================================================
    ("idx_sessions_created_at", "sessions", "created_at DESC", False),
    ("idx_sessions_last_accessed", "sessions", "last_accessed DESC", False),
    ("idx_sessions_user_expires", "sessions", "user_id, expires_at DESC", False),

    # =========================================================================
    # User table - login queries, role filtering
    # =========================================================================
    ("idx_users_created_at", "users", "created_at DESC", False),
    ("idx_users_last_login", "users", "last_login DESC", False),
    ("idx_users_oauth_provider_id", "users", "oauth_provider, oauth_id", False),

    # =========================================================================
    # Audit log - compliance queries, time-based filtering
    # =========================================================================
    ("idx_audit_log_user_timestamp", "audit_log", "user_id, timestamp DESC", False),
    ("idx_audit_log_response_status", "audit_log", "response_status", False),
    ("idx_audit_log_http_method", "audit_log", "http_method", False),

    # =========================================================================
    # Cached networks/devices - organization filtering
    # =========================================================================
    ("idx_cached_networks_org_type", "cached_networks", "organization_name, organization_type", False),
    ("idx_cached_networks_last_updated", "cached_networks", "last_updated DESC", False),
    ("idx_cached_networks_is_stale", "cached_networks", "is_stale", False),

    ("idx_cached_devices_status", "cached_devices", "status", False),
    ("idx_cached_devices_model", "cached_devices", "model", False),
    ("idx_cached_devices_last_updated", "cached_devices", "last_updated DESC", False),
    ("idx_cached_devices_org_status", "cached_devices", "organization_name, status", False),

    # =========================================================================
    # System config - key lookups
    # =========================================================================
    ("idx_system_config_category", "system_config", "category", False),
    ("idx_system_config_updated_at", "system_config", "updated_at DESC", False),

    # =========================================================================
    # Knowledge base - document and chunk queries
    # =========================================================================
    ("idx_knowledge_documents_doc_type", "knowledge_documents", "doc_type", False),
    ("idx_knowledge_documents_product", "knowledge_documents", "product", False),
    ("idx_knowledge_documents_created_at", "knowledge_documents", "created_at DESC", False),
    ("idx_knowledge_documents_type_product", "knowledge_documents", "doc_type, product", False),

    ("idx_knowledge_chunks_content_tokens", "knowledge_chunks", "content_tokens", False),

    # =========================================================================
    # Splunk insights - organization and time filtering
    # =========================================================================
    ("idx_splunk_insights_org_created", "splunk_log_insights", "organization, created_at DESC", False),
    ("idx_splunk_insights_severity_created", "splunk_log_insights", "severity, created_at DESC", False),

    # =========================================================================
    # AI Sessions - user activity tracking
    # =========================================================================
    ("idx_ai_sessions_user_status", "ai_sessions", "user_id, status", False),
    ("idx_ai_sessions_last_activity", "ai_sessions", "last_activity_at DESC", False),

    ("idx_ai_session_events_type_timestamp", "ai_session_events", "event_type, timestamp DESC", False),
]


async def table_exists(conn, table_name: str) -> bool:
    """Check if a table exists in the database."""
    result = await conn.execute(text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = :table_name
        )
    """), {"table_name": table_name})
    row = result.fetchone()
    return row[0] if row else False


async def index_exists(conn, index_name: str) -> bool:
    """Check if an index exists in the database."""
    result = await conn.execute(text("""
        SELECT EXISTS (
            SELECT FROM pg_indexes
            WHERE indexname = :index_name
        )
    """), {"index_name": index_name})
    row = result.fetchone()
    return row[0] if row else False


async def create_index(conn, index_name: str, table_name: str, columns: str, unique: bool = False) -> bool:
    """Create an index if it doesn't exist."""
    try:
        # Check if table exists first
        if not await table_exists(conn, table_name):
            logger.info(f"  Skipping {index_name}: table '{table_name}' does not exist")
            return False

        # Check if index already exists
        if await index_exists(conn, index_name):
            logger.info(f"  Skipping {index_name}: already exists")
            return False

        # Create the index
        unique_clause = "UNIQUE " if unique else ""
        sql = f"CREATE {unique_clause}INDEX {index_name} ON {table_name} ({columns})"
        await conn.execute(text(sql))
        logger.info(f"  Created: {index_name} ON {table_name}({columns})")
        return True
    except Exception as e:
        logger.error(f"  Failed to create {index_name}: {e}")
        return False


async def run_migration():
    """Run the migration to add all performance indexes."""
    logger.info("=" * 60)
    logger.info("Database Migration: Performance Indexes")
    logger.info("=" * 60)

    created_count = 0
    skipped_count = 0
    failed_count = 0

    db = get_db()
    async with db.async_engine.begin() as conn:
        logger.info("\nCreating indexes...")

        for index_name, table_name, columns, unique in INDEXES:
            result = await create_index(conn, index_name, table_name, columns, unique)
            if result:
                created_count += 1
            elif result is False:
                skipped_count += 1
            else:
                failed_count += 1

        # Commit the transaction
        await conn.commit()

    logger.info("\n" + "=" * 60)
    logger.info("Migration Summary")
    logger.info("=" * 60)
    logger.info(f"  Indexes created: {created_count}")
    logger.info(f"  Indexes skipped (already exist or table missing): {skipped_count}")
    logger.info(f"  Indexes failed: {failed_count}")
    logger.info("=" * 60)

    return created_count, skipped_count, failed_count


async def verify_indexes():
    """Verify all indexes are in place and report statistics."""
    logger.info("\n" + "=" * 60)
    logger.info("Verifying Indexes")
    logger.info("=" * 60)

    db = get_db()
    async with db.async_engine.connect() as conn:
        # Get all indexes in the database
        result = await conn.execute(text("""
            SELECT
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        """))

        indexes = result.fetchall()

        # Group by table
        by_table = {}
        for row in indexes:
            table = row[0]
            if table not in by_table:
                by_table[table] = []
            by_table[table].append((row[1], row[2]))

        logger.info(f"\nTotal indexes in database: {len(indexes)}")
        logger.info(f"Tables with indexes: {len(by_table)}")

        for table, idxs in sorted(by_table.items()):
            logger.info(f"\n  {table}: {len(idxs)} indexes")
            for idx_name, idx_def in idxs:
                # Truncate long definitions
                if len(idx_def) > 80:
                    idx_def = idx_def[:77] + "..."
                logger.info(f"    - {idx_name}")


async def analyze_tables():
    """Run ANALYZE on all tables to update statistics for query planner."""
    logger.info("\n" + "=" * 60)
    logger.info("Running ANALYZE on tables")
    logger.info("=" * 60)

    tables = [
        "users", "sessions", "chat_conversations", "chat_messages",
        "events", "incidents", "audit_log", "ai_cost_logs",
        "cached_networks", "cached_devices", "knowledge_documents",
        "knowledge_chunks", "knowledge_queries", "agent_sessions",
        "splunk_log_insights", "ai_sessions", "ai_session_events",
        "system_config", "clusters", "api_endpoints", "security_config"
    ]

    db = get_db()
    async with db.async_engine.begin() as conn:
        for table in tables:
            if await table_exists(conn, table):
                try:
                    await conn.execute(text(f"ANALYZE {table}"))
                    logger.info(f"  Analyzed: {table}")
                except Exception as e:
                    logger.warning(f"  Failed to analyze {table}: {e}")


async def main():
    """Main entry point for the migration."""
    try:
        # Run the migration
        created, skipped, failed = await run_migration()

        # Verify indexes
        await verify_indexes()

        # Update statistics
        await analyze_tables()

        logger.info("\n" + "=" * 60)
        logger.info("Migration completed successfully!")
        logger.info("=" * 60)

        return 0 if failed == 0 else 1

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
