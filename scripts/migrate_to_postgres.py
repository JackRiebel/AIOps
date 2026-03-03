#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script for Lumen

This script migrates all data from SQLite to PostgreSQL.

PREREQUISITES:
1. PostgreSQL 14+ installed and running
2. Database created: createdb lumen
3. User with permissions:
   CREATE USER lumen WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE lumen TO lumen;

USAGE:
    python scripts/migrate_to_postgres.py --postgres-url "postgresql://lumen:password@localhost:5432/lumen"

OPTIONS:
    --postgres-url    PostgreSQL connection URL (required)
    --sqlite-path     Path to SQLite database (default: data/lumen.db)
    --dry-run         Show what would be migrated without making changes
    --skip-confirm    Skip confirmation prompt
"""

import argparse
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

def print_banner():
    print("""
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║              Lumen - SQLite to PostgreSQL Migration Tool                  ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
    """)


def check_prerequisites():
    """Check that required packages are installed."""
    missing = []

    try:
        import sqlalchemy
    except ImportError:
        missing.append("sqlalchemy")

    try:
        import psycopg2
    except ImportError:
        try:
            import asyncpg
        except ImportError:
            missing.append("psycopg2 or asyncpg")

    if missing:
        print("ERROR: Missing required packages:")
        for pkg in missing:
            print(f"  - {pkg}")
        print("\nInstall with: pip install psycopg2-binary")
        sys.exit(1)


def test_postgres_connection(postgres_url: str) -> bool:
    """Test PostgreSQL connection."""
    from sqlalchemy import create_engine, text

    try:
        # Convert async URL to sync for testing
        sync_url = postgres_url.replace("+asyncpg", "").replace("+aiosqlite", "")
        if "postgresql" in sync_url and "+psycopg" not in sync_url:
            sync_url = sync_url.replace("postgresql://", "postgresql+psycopg2://")

        engine = create_engine(sync_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except Exception as e:
        print(f"ERROR: Cannot connect to PostgreSQL: {e}")
        return False


def test_sqlite_connection(sqlite_path: str) -> bool:
    """Test SQLite connection and check if database exists."""
    if not os.path.exists(sqlite_path):
        print(f"ERROR: SQLite database not found at: {sqlite_path}")
        return False

    from sqlalchemy import create_engine, text

    try:
        engine = create_engine(f"sqlite:///{sqlite_path}")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [row[0] for row in result]
        engine.dispose()

        if not tables:
            print("WARNING: SQLite database has no tables")
            return False

        print(f"Found {len(tables)} tables in SQLite database")
        return True
    except Exception as e:
        print(f"ERROR: Cannot read SQLite database: {e}")
        return False


def get_table_counts(engine) -> dict:
    """Get row counts for all tables."""
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    tables = inspector.get_table_names()
    counts = {}

    with engine.connect() as conn:
        for table in tables:
            try:
                result = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
                counts[table] = result.scalar()
            except Exception:
                counts[table] = "?"

    return counts


def migrate_data(sqlite_path: str, postgres_url: str, dry_run: bool = False):
    """Migrate all data from SQLite to PostgreSQL."""
    from sqlalchemy import create_engine, text, MetaData, Table, inspect
    from sqlalchemy.orm import sessionmaker

    # Create engines
    sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")

    # Convert async URL to sync
    sync_postgres_url = postgres_url.replace("+asyncpg", "")
    if "postgresql" in sync_postgres_url and "+psycopg" not in sync_postgres_url:
        sync_postgres_url = sync_postgres_url.replace("postgresql://", "postgresql+psycopg2://")

    postgres_engine = create_engine(sync_postgres_url)

    # Get table info from SQLite
    sqlite_inspector = inspect(sqlite_engine)
    tables = sqlite_inspector.get_table_names()

    print(f"\n{'=' * 60}")
    print(f"Migration {'Preview (DRY RUN)' if dry_run else 'Starting'}...")
    print(f"{'=' * 60}\n")

    # Get counts before migration
    sqlite_counts = get_table_counts(sqlite_engine)

    print("Tables to migrate:")
    print("-" * 40)
    for table, count in sorted(sqlite_counts.items()):
        print(f"  {table}: {count} rows")
    print()

    if dry_run:
        print("DRY RUN - No changes will be made")
        print("Run without --dry-run to perform the migration")
        return True

    # Import models to ensure all tables are created
    print("Creating PostgreSQL schema...")
    try:
        from src.config.database import Base
        # Import all models to register them with Base
        from src.models import user, session, cluster, organization
        from src.models import knowledge, knowledge_feedback, knowledge_entity
        from src.models import workflow, incident, splunk_insight
        from src.models import ai_session, ai_cost_log, agent_event
        from src.models import permission, role, chat, network_cache
        from src.models import system_config

        Base.metadata.create_all(bind=postgres_engine)
        print("  Schema created successfully")
    except Exception as e:
        print(f"  WARNING: Could not create schema via models: {e}")
        print("  Attempting to copy schema from SQLite...")

    # Migrate data table by table
    print("\nMigrating data...")
    print("-" * 40)

    metadata = MetaData()
    metadata.reflect(bind=sqlite_engine)

    migrated_tables = 0
    migrated_rows = 0
    errors = []

    for table_name in tables:
        if table_name.startswith('sqlite_'):
            continue

        try:
            # Get table from SQLite
            sqlite_table = Table(table_name, metadata, autoload_with=sqlite_engine)

            # Read all data from SQLite
            with sqlite_engine.connect() as sqlite_conn:
                result = sqlite_conn.execute(sqlite_table.select())
                rows = result.fetchall()
                columns = result.keys()

            if not rows:
                print(f"  {table_name}: (empty, skipping)")
                continue

            # Insert into PostgreSQL
            with postgres_engine.connect() as pg_conn:
                # Clear existing data
                pg_conn.execute(text(f'DELETE FROM "{table_name}"'))

                # Insert new data
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    # Handle None values and special types
                    insert_cols = ", ".join([f'"{k}"' for k in row_dict.keys()])
                    insert_vals = ", ".join([f":{k}" for k in row_dict.keys()])
                    stmt = text(f'INSERT INTO "{table_name}" ({insert_cols}) VALUES ({insert_vals})')
                    pg_conn.execute(stmt, row_dict)

                pg_conn.commit()

            print(f"  {table_name}: {len(rows)} rows migrated")
            migrated_tables += 1
            migrated_rows += len(rows)

        except Exception as e:
            error_msg = f"{table_name}: {str(e)}"
            errors.append(error_msg)
            print(f"  ERROR - {error_msg}")

    # Summary
    print(f"\n{'=' * 60}")
    print("Migration Complete")
    print(f"{'=' * 60}")
    print(f"  Tables migrated: {migrated_tables}/{len(tables)}")
    print(f"  Rows migrated: {migrated_rows}")

    if errors:
        print(f"\n  Errors ({len(errors)}):")
        for error in errors:
            print(f"    - {error}")

    # Cleanup
    sqlite_engine.dispose()
    postgres_engine.dispose()

    return len(errors) == 0


def update_env_file(postgres_url: str):
    """Update .env file with new PostgreSQL URL."""
    env_path = Path(__file__).parent.parent / ".env"

    if not env_path.exists():
        print("WARNING: .env file not found, cannot update DATABASE_URL")
        return

    with open(env_path, 'r') as f:
        lines = f.readlines()

    updated = False
    for i, line in enumerate(lines):
        if line.startswith('DATABASE_URL='):
            # Comment out old SQLite URL
            lines[i] = f"# {line}"
            # Add new PostgreSQL URL
            lines.insert(i + 1, f"DATABASE_URL={postgres_url}\n")
            updated = True
            break

    if updated:
        with open(env_path, 'w') as f:
            f.writelines(lines)
        print("\n.env file updated with PostgreSQL URL")
    else:
        print("\nWARNING: Could not update .env file - DATABASE_URL not found")
        print(f"Please manually add: DATABASE_URL={postgres_url}")


def main():
    parser = argparse.ArgumentParser(
        description="Migrate Lumen data from SQLite to PostgreSQL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test migration without making changes
  python scripts/migrate_to_postgres.py --postgres-url "postgresql://lumen:pass@localhost:5432/lumen" --dry-run

  # Perform migration
  python scripts/migrate_to_postgres.py --postgres-url "postgresql://lumen:pass@localhost:5432/lumen"

  # Use custom SQLite path
  python scripts/migrate_to_postgres.py --postgres-url "..." --sqlite-path /path/to/lumen.db
        """
    )
    parser.add_argument(
        "--postgres-url",
        required=True,
        help="PostgreSQL connection URL (e.g., postgresql://user:pass@localhost:5432/lumen)"
    )
    parser.add_argument(
        "--sqlite-path",
        default="data/lumen.db",
        help="Path to SQLite database (default: data/lumen.db)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes"
    )
    parser.add_argument(
        "--skip-confirm",
        action="store_true",
        help="Skip confirmation prompt"
    )

    args = parser.parse_args()

    print_banner()

    # Check prerequisites
    print("Checking prerequisites...")
    check_prerequisites()
    print("  All prerequisites met\n")

    # Test connections
    print("Testing database connections...")

    if not test_sqlite_connection(args.sqlite_path):
        sys.exit(1)
    print(f"  SQLite: OK ({args.sqlite_path})")

    if not test_postgres_connection(args.postgres_url):
        print("\nPlease ensure PostgreSQL is running and the connection URL is correct.")
        print("URL format: postgresql://username:password@host:port/database")
        sys.exit(1)
    print(f"  PostgreSQL: OK")
    print()

    # Confirmation
    if not args.dry_run and not args.skip_confirm:
        print("WARNING: This will migrate all data from SQLite to PostgreSQL.")
        print("         Existing data in PostgreSQL will be overwritten.")
        print()
        response = input("Continue? [y/N]: ")
        if response.lower() != 'y':
            print("Migration cancelled")
            sys.exit(0)

    # Perform migration
    success = migrate_data(args.sqlite_path, args.postgres_url, args.dry_run)

    if success and not args.dry_run:
        # Update .env file
        response = input("\nUpdate .env file with PostgreSQL URL? [y/N]: ")
        if response.lower() == 'y':
            update_env_file(args.postgres_url)

        print("\n" + "=" * 60)
        print("NEXT STEPS:")
        print("=" * 60)
        print("1. Restart Lumen to use PostgreSQL")
        print("2. Verify the application works correctly")
        print("3. (Optional) Backup and remove the SQLite database:")
        print(f"   mv {args.sqlite_path} {args.sqlite_path}.bak")
        print()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
