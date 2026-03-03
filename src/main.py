"""Main entry point for Cisco AIOps Hub Meraki Magic MCP Server.

Uses the Meraki Magic MCP dynamic SDK discovery approach
(https://github.com/CiscoDevNet/meraki-magic-mcp-community)
integrated with AIOps Hub's database, security middleware, and audit logging.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import get_settings, init_db
from src.services.database_init import initialize_database_defaults


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Cisco AIOps Hub Meraki Magic MCP Server — dynamic SDK discovery with 800+ endpoints"
    )
    parser.add_argument(
        "--organization",
        type=str,
        default="default",
        help="Name of the organization to connect to (must exist in database). Default: 'default'"
    )
    parser.add_argument(
        "--log-level",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Override logging level from environment"
    )
    return parser.parse_args()


def setup_logging(log_level: str = None):
    """Configure logging for the application."""
    settings = get_settings()
    level = log_level or settings.log_level

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
    logging.getLogger("meraki").setLevel(logging.WARNING)


async def main():
    """Main entry point."""
    args = parse_arguments()
    setup_logging(args.log_level)
    logger = logging.getLogger(__name__)

    try:
        logger.info("Starting Cisco AIOps Hub Meraki Magic MCP Server...")

        # Initialize database
        logger.info("Initializing database...")
        await init_db()

        logger.info("Initializing database defaults...")
        await initialize_database_defaults()

        organization_name = args.organization
        logger.info(f"Using organization: {organization_name}")

        # Meraki Magic MCP (dynamic SDK discovery — 800+ endpoints)
        from src.core.meraki_magic_server import MerakiMagicServer

        server = MerakiMagicServer(organization_name=organization_name)
        logger.info("Meraki Magic MCP ready — edit mode controlled via database (security_config table)")
        await server.run()

    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("Server stopped")


if __name__ == "__main__":
    asyncio.run(main())
