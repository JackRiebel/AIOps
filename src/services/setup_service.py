"""Setup service for first-run wizard and initial configuration."""

import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models.user import User
from src.models.system_config import SystemConfig, CONFIG_DEFINITIONS
from src.utils.encryption import encrypt_password

logger = logging.getLogger(__name__)

# Project root for .env file
PROJECT_ROOT = Path(__file__).parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
DATA_DIR = PROJECT_ROOT / "data"


class SetupService:
    """Service for managing first-run setup and initial configuration."""

    def __init__(self):
        self.db = get_db()

    async def get_setup_status(self) -> Dict[str, Any]:
        """Get the current setup status.

        Returns a dict with:
        - setup_required: True if first-run setup is needed
        - steps: Status of each setup step
        - current_step: The next step that needs to be completed
        """
        steps = {
            "database": await self._check_database_status(),
            "encryption": self._check_encryption_status(),
            "admin": await self._check_admin_status(),
            "ai_provider": await self._check_ai_provider_status(),
        }

        # Determine if setup is required
        setup_required = not all(step["completed"] for step in steps.values())

        # Find the current step (first incomplete step)
        current_step = None
        step_order = ["database", "encryption", "admin", "ai_provider"]
        for step in step_order:
            if not steps[step]["completed"]:
                current_step = step
                break

        return {
            "setup_required": setup_required,
            "setup_complete": not setup_required,
            "steps": steps,
            "current_step": current_step,
        }

    async def _check_database_status(self) -> Dict[str, Any]:
        """Check if database is properly configured and accessible."""
        db_type = self._get_database_type()

        try:
            # For SQLite, ensure the data directory and database exist
            if db_type == "sqlite":
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                # Create tables if they don't exist
                await self.db.create_tables()

            async with self.db.session() as session:
                # Try a simple query to verify connection
                await session.execute(select(func.count()).select_from(User))
                return {
                    "completed": True,
                    "message": "Database connected successfully",
                    "type": db_type,
                }
        except Exception as e:
            # For SQLite, try creating the database if it doesn't exist
            if db_type == "sqlite":
                try:
                    DATA_DIR.mkdir(parents=True, exist_ok=True)
                    await self.db.create_tables()
                    return {
                        "completed": True,
                        "message": "SQLite database created successfully",
                        "type": db_type,
                    }
                except Exception as create_error:
                    return {
                        "completed": False,
                        "message": f"Failed to create SQLite database: {str(create_error)}",
                        "type": None,
                    }

            return {
                "completed": False,
                "message": f"Database connection failed: {str(e)}",
                "type": None,
            }

    def _get_database_type(self) -> str:
        """Get the type of database being used."""
        from src.config.settings import get_settings
        settings = get_settings()
        db_url = settings.database_url
        if "sqlite" in db_url:
            return "sqlite"
        elif "postgresql" in db_url:
            return "postgresql"
        return "unknown"

    def _check_encryption_status(self) -> Dict[str, Any]:
        """Check if encryption key is configured."""
        encryption_key = os.environ.get("ENCRYPTION_KEY")

        if encryption_key:
            # Validate the key format
            try:
                Fernet(encryption_key.encode())
                return {
                    "completed": True,
                    "message": "Encryption key configured",
                    "source": "environment",
                }
            except Exception:
                return {
                    "completed": False,
                    "message": "Invalid encryption key format",
                    "source": None,
                }

        # Check if we have an auto-generated key file
        key_file = DATA_DIR / ".encryption_key"
        if key_file.exists():
            try:
                key = key_file.read_text().strip()
                Fernet(key.encode())
                # Set in environment for this session
                os.environ["ENCRYPTION_KEY"] = key
                return {
                    "completed": True,
                    "message": "Encryption key loaded from file",
                    "source": "file",
                }
            except Exception:
                pass

        return {
            "completed": False,
            "message": "Encryption key not configured",
            "source": None,
        }

    async def _check_admin_status(self) -> Dict[str, Any]:
        """Check if at least one admin user exists."""
        try:
            async with self.db.session() as session:
                result = await session.execute(
                    select(func.count()).select_from(User).where(User.role == "admin")
                )
                admin_count = result.scalar()

                if admin_count > 0:
                    return {
                        "completed": True,
                        "message": f"{admin_count} admin user(s) configured",
                        "admin_count": admin_count,
                    }

                # Check total users
                result = await session.execute(select(func.count()).select_from(User))
                total_users = result.scalar()

                return {
                    "completed": False,
                    "message": "No admin user configured",
                    "admin_count": 0,
                    "total_users": total_users,
                }
        except Exception as e:
            return {
                "completed": False,
                "message": f"Could not check admin status: {str(e)}",
                "admin_count": 0,
            }

    async def _check_ai_provider_status(self) -> Dict[str, Any]:
        """Check if at least one AI provider is configured."""
        providers_configured = []

        # Check environment variables first
        if os.environ.get("ANTHROPIC_API_KEY"):
            providers_configured.append("anthropic")
        if os.environ.get("OPENAI_API_KEY"):
            providers_configured.append("openai")
        if os.environ.get("GOOGLE_API_KEY"):
            providers_configured.append("google")
        if os.environ.get("CISCO_CIRCUIT_CLIENT_ID") and os.environ.get("CISCO_CIRCUIT_CLIENT_SECRET"):
            providers_configured.append("cisco")

        # Check database for configured keys
        try:
            async with self.db.session() as session:
                ai_keys = ["anthropic_api_key", "openai_api_key", "google_api_key",
                          "cisco_circuit_client_id"]
                result = await session.execute(
                    select(SystemConfig).where(
                        SystemConfig.key.in_(ai_keys),
                        SystemConfig.value.isnot(None)
                    )
                )
                db_configs = result.scalars().all()

                for config in db_configs:
                    if config.key == "anthropic_api_key" and "anthropic" not in providers_configured:
                        providers_configured.append("anthropic")
                    elif config.key == "openai_api_key" and "openai" not in providers_configured:
                        providers_configured.append("openai")
                    elif config.key == "google_api_key" and "google" not in providers_configured:
                        providers_configured.append("google")
                    elif config.key == "cisco_circuit_client_id" and "cisco" not in providers_configured:
                        providers_configured.append("cisco")
        except Exception:
            pass  # Database might not have system_config table yet

        if providers_configured:
            return {
                "completed": True,
                "message": f"AI providers configured: {', '.join(providers_configured)}",
                "providers": providers_configured,
            }

        return {
            "completed": False,
            "message": "No AI provider configured",
            "providers": [],
        }

    def generate_encryption_key(self) -> str:
        """Generate a new Fernet encryption key.

        Returns the key as a string.
        """
        key = Fernet.generate_key().decode()
        return key

    def save_encryption_key(self, key: str, save_to_file: bool = True) -> Dict[str, Any]:
        """Save encryption key to environment and optionally to file.

        Args:
            key: The Fernet encryption key
            save_to_file: If True, also save to data/.encryption_key

        Returns:
            Status dict with success and location info
        """
        # Validate key format
        try:
            Fernet(key.encode())
        except Exception as e:
            return {
                "success": False,
                "error": f"Invalid encryption key format: {str(e)}",
            }

        # Set in current environment
        os.environ["ENCRYPTION_KEY"] = key

        locations = ["environment"]

        if save_to_file:
            try:
                # Ensure data directory exists
                DATA_DIR.mkdir(parents=True, exist_ok=True)

                key_file = DATA_DIR / ".encryption_key"
                key_file.write_text(key)
                key_file.chmod(0o600)  # Read/write only by owner
                locations.append("file")
            except Exception as e:
                logger.warning(f"Could not save encryption key to file: {e}")

        # Also update .env file if it exists
        try:
            self._update_env_file("ENCRYPTION_KEY", key)
            locations.append(".env")
        except Exception as e:
            logger.warning(f"Could not update .env file: {e}")

        return {
            "success": True,
            "locations": locations,
            "message": f"Encryption key saved to: {', '.join(locations)}",
        }

    def _update_env_file(self, key: str, value: str):
        """Update or add a key in the .env file."""
        if not ENV_FILE.exists():
            # Create new .env file
            ENV_FILE.write_text(f"{key}={value}\n")
            return

        # Read existing content
        content = ENV_FILE.read_text()
        lines = content.split("\n")

        # Check if key exists
        key_found = False
        new_lines = []
        for line in lines:
            if line.startswith(f"{key}="):
                new_lines.append(f"{key}={value}")
                key_found = True
            else:
                new_lines.append(line)

        # Add key if not found
        if not key_found:
            # Find a good place to add it (after similar keys or at the end)
            new_lines.append(f"{key}={value}")

        ENV_FILE.write_text("\n".join(new_lines))

    async def create_admin_user(
        self,
        username: str,
        email: str,
        password: str
    ) -> Dict[str, Any]:
        """Create the first admin user.

        Args:
            username: Admin username
            email: Admin email
            password: Admin password (will be hashed)

        Returns:
            Status dict with success and user info
        """
        from src.services.auth_service import AuthService

        # Validate password strength
        if len(password) < 8:
            return {
                "success": False,
                "error": "Password must be at least 8 characters",
            }

        auth_service = AuthService()

        try:
            async with self.db.session() as session:
                # Check if username or email already exists
                result = await session.execute(
                    select(User).where(
                        (User.username == username) | (User.email == email)
                    )
                )
                existing = result.scalar_one_or_none()

                if existing:
                    if existing.username == username:
                        return {"success": False, "error": "Username already exists"}
                    return {"success": False, "error": "Email already exists"}

                # Create admin user - use bcrypt directly due to passlib compatibility issue
                import bcrypt
                password_bytes = password.encode('utf-8')[:72]
                password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

                admin = User(
                    username=username,
                    email=email,
                    hashed_password=password_hash,
                    role="admin",
                    is_active=True,
                    is_super_admin=True,  # First admin is super admin with all permissions
                    created_at=datetime.utcnow(),
                )

                session.add(admin)
                await session.commit()
                await session.refresh(admin)

                return {
                    "success": True,
                    "user": {
                        "id": admin.id,
                        "username": admin.username,
                        "email": admin.email,
                        "role": admin.role,
                    },
                    "message": "Admin user created successfully",
                }
        except Exception as e:
            logger.error(f"Failed to create admin user: {e}")
            return {
                "success": False,
                "error": f"Failed to create admin user: {str(e)}",
            }

    async def save_ai_provider_key(
        self,
        provider: str,
        api_key: str,
        client_secret: Optional[str] = None,
        app_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save an AI provider API key to the database.

        Args:
            provider: Provider name (anthropic, openai, google, cisco)
            api_key: API key or client ID for Cisco
            client_secret: Client secret for Cisco
            app_key: App key for Cisco

        Returns:
            Status dict with success info
        """
        from src.services.config_service import ConfigService

        config_service = ConfigService()

        try:
            if provider == "anthropic":
                await config_service.set_config("anthropic_api_key", api_key)
            elif provider == "openai":
                await config_service.set_config("openai_api_key", api_key)
            elif provider == "google":
                await config_service.set_config("google_api_key", api_key)
            elif provider == "cisco":
                await config_service.set_config("cisco_circuit_client_id", api_key)
                if client_secret:
                    await config_service.set_config("cisco_circuit_client_secret", client_secret)
                if app_key:
                    await config_service.set_config("cisco_circuit_app_key", app_key)
            else:
                return {
                    "success": False,
                    "error": f"Unknown provider: {provider}",
                }

            return {
                "success": True,
                "provider": provider,
                "message": f"{provider.title()} API key saved successfully",
            }
        except Exception as e:
            logger.error(f"Failed to save {provider} API key: {e}")
            return {
                "success": False,
                "error": f"Failed to save API key: {str(e)}",
            }

    async def complete_setup(self) -> Dict[str, Any]:
        """Mark setup as complete and return final status.

        This verifies all steps are done and returns the final status.
        """
        status = await self.get_setup_status()

        if status["setup_required"]:
            incomplete_steps = [
                step for step, info in status["steps"].items()
                if not info["completed"]
            ]
            return {
                "success": False,
                "error": f"Setup incomplete. Missing steps: {', '.join(incomplete_steps)}",
                "status": status,
            }

        return {
            "success": True,
            "message": "Setup completed successfully! You can now log in.",
            "status": status,
        }


# Singleton instance
_setup_service: Optional[SetupService] = None


def get_setup_service() -> SetupService:
    """Get the singleton SetupService instance."""
    global _setup_service
    if _setup_service is None:
        _setup_service = SetupService()
    return _setup_service


def check_first_run() -> bool:
    """Synchronous check if this is a first run (no encryption key set).

    This is a lightweight check that can be used before full async setup.
    """
    # Check environment
    if os.environ.get("ENCRYPTION_KEY"):
        return False

    # Check key file
    key_file = DATA_DIR / ".encryption_key"
    if key_file.exists():
        try:
            key = key_file.read_text().strip()
            Fernet(key.encode())
            os.environ["ENCRYPTION_KEY"] = key
            return False
        except Exception:
            pass

    return True


def ensure_encryption_key() -> str:
    """Ensure an encryption key exists, generating one if needed.

    Returns the encryption key.
    """
    # Check environment first
    key = os.environ.get("ENCRYPTION_KEY")
    if key:
        try:
            Fernet(key.encode())
            return key
        except Exception:
            pass

    # Check key file
    key_file = DATA_DIR / ".encryption_key"
    if key_file.exists():
        try:
            key = key_file.read_text().strip()
            Fernet(key.encode())
            os.environ["ENCRYPTION_KEY"] = key
            # Clear settings cache so new key is picked up
            _clear_settings_cache()
            return key
        except Exception:
            pass

    # Generate new key
    key = Fernet.generate_key().decode()

    # Save to file
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    key_file.write_text(key)
    key_file.chmod(0o600)

    # Set in environment
    os.environ["ENCRYPTION_KEY"] = key

    # Clear settings cache so new key is picked up
    _clear_settings_cache()

    logger.info(f"Generated new encryption key, saved to {key_file}")
    return key


def _clear_settings_cache():
    """Clear the settings cache so new environment variables are picked up."""
    try:
        from src.config.settings import get_settings
        get_settings.cache_clear()
        logger.debug("Cleared settings cache")
    except Exception as e:
        logger.warning(f"Could not clear settings cache: {e}")
