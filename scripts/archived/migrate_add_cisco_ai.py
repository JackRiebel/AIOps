#!/usr/bin/env python3
"""Migration script to add Cisco Circuit AI credential columns to users table."""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.config.database import get_db


async def run_migration():
    """Add Cisco Circuit AI columns to users table."""
    db = get_db()

    async with db.session() as session:
        # Check if columns already exist
        check_query = text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN ('user_cisco_client_id', 'user_cisco_client_secret')
        """)
        result = await session.execute(check_query)
        existing_columns = {row[0] for row in result.fetchall()}

        columns_added = []

        # Add user_cisco_client_id if not exists
        if 'user_cisco_client_id' not in existing_columns:
            await session.execute(text("""
                ALTER TABLE users
                ADD COLUMN user_cisco_client_id TEXT
            """))
            columns_added.append('user_cisco_client_id')
            print("Added column: user_cisco_client_id")

        # Add user_cisco_client_secret if not exists
        if 'user_cisco_client_secret' not in existing_columns:
            await session.execute(text("""
                ALTER TABLE users
                ADD COLUMN user_cisco_client_secret TEXT
            """))
            columns_added.append('user_cisco_client_secret')
            print("Added column: user_cisco_client_secret")

        if columns_added:
            await session.commit()
            print(f"\nMigration complete! Added columns: {', '.join(columns_added)}")
        else:
            print("\nNo migration needed - columns already exist.")


if __name__ == "__main__":
    print("Running Cisco Circuit AI migration...")
    print("=" * 50)
    asyncio.run(run_migration())
