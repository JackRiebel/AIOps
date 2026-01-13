#!/usr/bin/env python3
"""
Database migration to add system_config table for UI-based configuration.

This migration creates the system_config table which stores configuration
values that can be managed through the web UI instead of .env files.

Run this script to add the system_config table:
    python scripts/migrate_add_system_config.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def get_connection():
    """Get database connection from DATABASE_URL."""
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://mcp_user:changeme@localhost:5432/meraki_mcp"
    )

    # Parse the URL
    # Format: postgresql://user:password@host:port/database
    url = database_url.replace("postgresql://", "").replace("postgresql+asyncpg://", "")
    user_pass, host_db = url.split("@")
    user, password = user_pass.split(":")
    host_port, database = host_db.split("/")

    if ":" in host_port:
        host, port = host_port.split(":")
    else:
        host = host_port
        port = "5432"

    return psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password
    )


def migrate():
    """Run the migration to create system_config table."""
    print("Starting system_config table migration...")

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Check if table already exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'system_config'
            );
        """)
        table_exists = cursor.fetchone()[0]

        if table_exists:
            print("Table 'system_config' already exists. Skipping creation.")
        else:
            # Create the system_config table
            print("Creating system_config table...")
            cursor.execute("""
                CREATE TABLE system_config (
                    id SERIAL PRIMARY KEY,
                    key VARCHAR(100) UNIQUE NOT NULL,
                    value TEXT,
                    is_encrypted BOOLEAN DEFAULT FALSE NOT NULL,
                    description TEXT,
                    category VARCHAR(50),
                    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
                );
            """)

            # Create indexes
            print("Creating indexes...")
            cursor.execute("""
                CREATE INDEX idx_system_config_key ON system_config(key);
            """)
            cursor.execute("""
                CREATE INDEX idx_system_config_category ON system_config(category);
            """)

            conn.commit()
            print("Table 'system_config' created successfully!")

        # Show current state
        cursor.execute("SELECT COUNT(*) FROM system_config;")
        count = cursor.fetchone()[0]
        print(f"Current config entries: {count}")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    print("Migration completed successfully!")


def seed_from_env(dry_run: bool = True):
    """
    Optionally seed database with current .env values.

    This is useful for migrating existing deployments to database-backed config.

    Args:
        dry_run: If True, only show what would be done without making changes
    """
    from src.models.system_config import CONFIG_DEFINITIONS
    from src.utils.encryption import encrypt_password

    print("\nChecking for .env values to seed...")

    conn = get_connection()
    cursor = conn.cursor()

    seeded = []
    skipped = []

    try:
        for key, definition in CONFIG_DEFINITIONS.items():
            env_var = definition.get("env_var")
            if not env_var:
                continue

            env_value = os.environ.get(env_var)
            if not env_value:
                continue

            # Check if already in database
            cursor.execute(
                "SELECT id FROM system_config WHERE key = %s",
                (key,)
            )
            exists = cursor.fetchone()

            if exists:
                skipped.append(f"{key} (already in database)")
                continue

            if dry_run:
                seeded.append(f"{key} from {env_var}")
            else:
                # Encrypt if sensitive
                is_sensitive = definition.get("sensitive", False)
                stored_value = encrypt_password(env_value) if is_sensitive else env_value

                cursor.execute("""
                    INSERT INTO system_config (key, value, is_encrypted, description, category, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                """, (
                    key,
                    stored_value,
                    is_sensitive,
                    definition.get("description"),
                    definition.get("category")
                ))
                seeded.append(f"{key} from {env_var}")

        if not dry_run:
            conn.commit()

    except Exception as e:
        conn.rollback()
        print(f"Seeding failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    if seeded:
        action = "Would seed" if dry_run else "Seeded"
        print(f"\n{action} the following values:")
        for item in seeded:
            print(f"  - {item}")
    else:
        print("\nNo new values to seed from .env")

    if skipped:
        print(f"\nSkipped (already configured):")
        for item in skipped:
            print(f"  - {item}")

    if dry_run and seeded:
        print("\nTo actually seed these values, run:")
        print("  python scripts/migrate_add_system_config.py --seed")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="System config database migration")
    parser.add_argument("--seed", action="store_true", help="Seed database with .env values")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be seeded without making changes")
    args = parser.parse_args()

    # Always run the migration first
    migrate()

    # Optionally seed from .env
    if args.seed:
        seed_from_env(dry_run=False)
    elif args.dry_run:
        seed_from_env(dry_run=True)
    else:
        print("\nTip: Run with --dry-run to see what .env values could be migrated")
        print("     Run with --seed to actually migrate .env values to database")
