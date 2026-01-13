"""Script to create the default admin user."""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models.user import User, UserRole

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def create_default_admin():
    """Create default admin user if it doesn't exist."""
    try:
        async with get_db() as db:
            # Check if admin user already exists
            result = await db.execute(
                select(User).where(User.username == "admin")
            )
            existing_admin = result.scalar_one_or_none()

            if existing_admin:
                logger.info("Admin user already exists. Skipping creation.")
                return

            # Create default admin user
            admin = User(
                username="admin",
                email="admin@lumen.local",
                hashed_password=User.hash_password("admin123"),  # Change in production!
                role=UserRole.ADMIN,
                full_name="System Administrator",
                is_active=True,
            )

            db.add(admin)
            await db.commit()
            await db.refresh(admin)

            logger.info(f"""
========================================
Default Admin User Created Successfully
========================================
Username: admin
Password: admin123
Email:    admin@lumen.local
Role:     ADMIN

⚠️  IMPORTANT: Please change the admin password immediately after first login!

You can now log in at: http://localhost:3000/login
========================================
            """)

    except Exception as e:
        logger.error(f"Failed to create admin user: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(create_default_admin())
