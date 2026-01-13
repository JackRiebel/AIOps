"""Configuration service for database-backed system settings."""

import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models.system_config import SystemConfig, CONFIG_DEFINITIONS
from src.utils.encryption import encrypt_password, decrypt_password

logger = logging.getLogger(__name__)


class ConfigService:
    """Service for managing system configuration in the database."""

    def __init__(self):
        """Initialize config service."""
        self.db = get_db()

    async def get_config(self, key: str) -> Optional[str]:
        """Get a configuration value by key.

        Args:
            key: Configuration key

        Returns:
            Decrypted value if found, None otherwise
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(SystemConfig).where(SystemConfig.key == key)
            )
            config = result.scalar_one_or_none()

            if not config or not config.value:
                return None

            # Decrypt if encrypted
            if config.is_encrypted:
                try:
                    return decrypt_password(config.value)
                except Exception as e:
                    logger.error(f"Failed to decrypt config value for '{key}': {e}")
                    return None

            return config.value

    async def set_config(
        self,
        key: str,
        value: str,
        is_sensitive: bool = None,
        description: str = None,
        category: str = None
    ) -> SystemConfig:
        """Set a configuration value.

        Args:
            key: Configuration key
            value: Value to store (will be encrypted if sensitive)
            is_sensitive: Override for encryption. If None, uses CONFIG_DEFINITIONS
            description: Optional description
            category: Optional category

        Returns:
            Updated or created SystemConfig instance
        """
        # Determine if value should be encrypted
        definition = CONFIG_DEFINITIONS.get(key, {})
        if is_sensitive is None:
            is_sensitive = definition.get("sensitive", False)

        # Use definition values if not provided
        if description is None:
            description = definition.get("description")
        if category is None:
            category = definition.get("category")

        # Encrypt if sensitive
        stored_value = encrypt_password(value) if is_sensitive and value else value

        async with self.db.session() as session:
            result = await session.execute(
                select(SystemConfig).where(SystemConfig.key == key)
            )
            config = result.scalar_one_or_none()

            if config:
                # Update existing
                config.value = stored_value
                config.is_encrypted = is_sensitive
                config.description = description or config.description
                config.category = category or config.category
                config.updated_at = datetime.utcnow()
            else:
                # Create new
                config = SystemConfig(
                    key=key,
                    value=stored_value,
                    is_encrypted=is_sensitive,
                    description=description,
                    category=category,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(config)

            await session.commit()
            await session.refresh(config)
            return config

    async def delete_config(self, key: str) -> bool:
        """Delete a configuration value.

        Args:
            key: Configuration key

        Returns:
            True if deleted, False if not found
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(SystemConfig).where(SystemConfig.key == key)
            )
            config = result.scalar_one_or_none()

            if not config:
                return False

            await session.delete(config)
            await session.commit()
            return True

    async def get_all_config(self, category: str = None, mask_secrets: bool = True) -> List[Dict[str, Any]]:
        """Get all configuration values.

        Args:
            category: Optional category filter
            mask_secrets: If True, mask sensitive values with '••••••••'

        Returns:
            List of config dictionaries with masked secrets
        """
        async with self.db.session() as session:
            query = select(SystemConfig)
            if category:
                query = query.where(SystemConfig.category == category)
            query = query.order_by(SystemConfig.category, SystemConfig.key)

            result = await session.execute(query)
            configs = result.scalars().all()

            output = []
            for config in configs:
                item = {
                    "key": config.key,
                    "category": config.category,
                    "description": config.description,
                    "is_encrypted": config.is_encrypted,
                    "is_set": bool(config.value),
                    "updated_at": config.updated_at.isoformat() if config.updated_at else None
                }

                # Include value only if not encrypted or explicitly requested
                if config.is_encrypted and mask_secrets:
                    item["value"] = "••••••••" if config.value else None
                else:
                    item["value"] = config.value

                output.append(item)

            return output

    async def get_config_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all configuration items.

        Returns:
            Dictionary mapping keys to their configuration status
        """
        async with self.db.session() as session:
            result = await session.execute(select(SystemConfig))
            configs = {c.key: c for c in result.scalars().all()}

        status = {}
        for key, definition in CONFIG_DEFINITIONS.items():
            db_config = configs.get(key)
            env_var = definition.get("env_var")
            env_value = os.environ.get(env_var) if env_var else None
            is_sensitive = definition.get("sensitive", False)

            # Determine if value is set (from any source)
            db_has_value = bool(db_config and db_config.value)
            env_has_value = bool(env_value)
            has_value = db_has_value or env_has_value

            # Determine the source
            if db_has_value:
                source = "database"
            elif env_has_value:
                source = "env"
            elif definition.get("default"):
                source = "default"
            else:
                source = "none"

            # Get current value (masked for sensitive values)
            current_value = None
            if has_value:
                if is_sensitive:
                    current_value = "••••••••"
                else:
                    # Get actual value for non-sensitive configs
                    if db_has_value and db_config:
                        current_value = db_config.value
                    elif env_has_value:
                        current_value = env_value

            status[key] = {
                "key": key,
                "category": definition.get("category"),
                "description": definition.get("description"),
                "sensitive": is_sensitive,
                "type": definition.get("type", "string"),
                "options": definition.get("options"),  # For select/enum types
                "default": definition.get("default"),
                "env_var": env_var,
                "db_configured": db_has_value,
                "env_configured": env_has_value,
                "has_value": has_value,  # Frontend expects this field
                "current_value": current_value,
                "source": source
            }

        return status


def get_config_or_env(key: str, env_var: str = None) -> Optional[str]:
    """Get config from database first, then fall back to environment variable.

    This is a synchronous function for use in settings.py where async isn't available.

    Args:
        key: Configuration key in database
        env_var: Environment variable name to fall back to

    Returns:
        Configuration value or None
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    # Get database URL from environment or use SQLite default
    database_url = os.environ.get(
        "DATABASE_URL",
        "sqlite:///./data/lumen.db"
    )

    # Convert async URL to sync if needed
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    sync_url = sync_url.replace("sqlite+aiosqlite://", "sqlite://")

    try:
        engine = create_engine(sync_url)
        with Session(engine) as session:
            result = session.execute(
                select(SystemConfig).where(SystemConfig.key == key)
            )
            config = result.scalar_one_or_none()

            if config and config.value:
                if config.is_encrypted:
                    try:
                        return decrypt_password(config.value)
                    except Exception as decrypt_err:
                        logger.warning(f"Failed to decrypt config '{key}': {decrypt_err}")
                        # Return None to fall through to env var
                else:
                    return config.value
    except Exception as e:
        # Database might not be available during startup
        logger.warning(f"Could not fetch config '{key}' from database: {e}")

    # Fall back to environment variable
    if env_var:
        return os.environ.get(env_var)

    return None


def get_effective_config(key: str) -> Optional[str]:
    """Get the effective configuration value with full fallback chain.

    Priority: Database -> Environment Variable -> Default

    Args:
        key: Configuration key

    Returns:
        Effective configuration value
    """
    definition = CONFIG_DEFINITIONS.get(key, {})
    env_var = definition.get("env_var")
    default = definition.get("default")

    # Try database first
    value = get_config_or_env(key, env_var)
    if value is not None:
        return value

    # Return default
    return default


def get_effective_config_bool(key: str) -> bool:
    """Get a boolean configuration value.

    Args:
        key: Configuration key

    Returns:
        Boolean value (defaults to False)
    """
    value = get_effective_config(key)
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("true", "1", "yes", "on")


def get_effective_config_int(key: str, default: int = 0) -> int:
    """Get an integer configuration value.

    Args:
        key: Configuration key
        default: Default value if not found or invalid

    Returns:
        Integer value
    """
    value = get_effective_config(key)
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


# Singleton instance for async operations
_config_service: Optional[ConfigService] = None


def get_config_service() -> ConfigService:
    """Get the singleton ConfigService instance."""
    global _config_service
    if _config_service is None:
        _config_service = ConfigService()
    return _config_service


def _get_provider_for_model(model: str) -> Optional[str]:
    """Determine the provider for a given model name.

    Args:
        model: Model name (e.g., "gpt-4o", "claude-sonnet-4-5-20250929", "cisco-gpt-4.1")

    Returns:
        Provider name ("cisco", "anthropic", "openai", "google") or None
    """
    if not model:
        return None

    model_lower = model.lower()

    # Cisco Circuit models
    if model_lower.startswith("cisco-") or model_lower in ("gpt-4.1", "gpt4.1"):
        return "cisco"

    # Anthropic Claude models
    if "claude" in model_lower:
        return "anthropic"

    # OpenAI GPT models
    if model_lower.startswith("gpt") or model_lower.startswith("o1") or model_lower.startswith("o3"):
        return "openai"

    # Google Gemini models
    if "gemini" in model_lower:
        return "google"

    return None


async def get_configured_ai_provider(preferred_model: str = None) -> Optional[Dict[str, Any]]:
    """Get the configured AI provider and its credentials.

    Priority order:
    1. User's preferred model (if provided and that provider is configured)
    2. Cisco Circuit (if client_id and client_secret are set)
    3. Anthropic (Claude)
    4. OpenAI (GPT)
    5. Google (Gemini)

    Args:
        preferred_model: Optional user-preferred model (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")

    Returns:
        Dictionary with:
        - provider: str ("cisco", "anthropic", "openai", "google")
        - model: str (default model for the provider)
        - api_key: str (for anthropic/openai/google)
        - client_id: str (for cisco)
        - client_secret: str (for cisco)
        - app_key: str (for cisco, optional)
        Or None if no AI provider is configured.
    """
    from src.config.settings import get_settings

    config_service = get_config_service()
    settings = get_settings()

    # Get all possible API keys from database config and environment
    cisco_client_id = (
        await config_service.get_config("cisco_circuit_client_id") or
        getattr(settings, 'cisco_circuit_client_id', None)
    )
    cisco_client_secret = (
        await config_service.get_config("cisco_circuit_client_secret") or
        getattr(settings, 'cisco_circuit_client_secret', None)
    )
    cisco_app_key = (
        await config_service.get_config("cisco_circuit_app_key") or
        getattr(settings, 'cisco_circuit_app_key', None)
    )
    anthropic_key = (
        await config_service.get_config("anthropic_api_key") or
        getattr(settings, 'anthropic_api_key', None)
    )
    openai_key = (
        await config_service.get_config("openai_api_key") or
        getattr(settings, 'openai_api_key', None)
    )
    google_key = (
        await config_service.get_config("google_api_key") or
        getattr(settings, 'google_api_key', None)
    )

    # Build provider configs for lookup
    provider_configs = {}

    if cisco_client_id and cisco_client_secret:
        provider_configs["cisco"] = {
            "provider": "cisco",
            "model": "cisco-gpt-4.1",
            "client_id": cisco_client_id,
            "client_secret": cisco_client_secret,
            "app_key": cisco_app_key,
        }
    if anthropic_key:
        provider_configs["anthropic"] = {
            "provider": "anthropic",
            "model": "claude-sonnet-4-5-20250929",
            "api_key": anthropic_key,
        }
    if openai_key:
        provider_configs["openai"] = {
            "provider": "openai",
            "model": "gpt-4o",
            "api_key": openai_key,
        }
    if google_key:
        provider_configs["google"] = {
            "provider": "google",
            "model": "gemini-1.5-pro",
            "api_key": google_key,
        }

    # Priority 1: User's preferred model
    if preferred_model:
        preferred_provider = _get_provider_for_model(preferred_model)
        if preferred_provider and preferred_provider in provider_configs:
            config = provider_configs[preferred_provider].copy()
            config["model"] = preferred_model  # Use the exact model requested
            return config

    # Priority 2-5: Fallback order (Cisco > Anthropic > OpenAI > Google)
    for provider in ["cisco", "anthropic", "openai", "google"]:
        if provider in provider_configs:
            return provider_configs[provider]

    return None


def get_configured_ai_provider_sync(preferred_model: str = None) -> Optional[Dict[str, Any]]:
    """Synchronous version of get_configured_ai_provider.

    For use in contexts where async isn't available.

    Priority order:
    1. User's preferred model (if provided and that provider is configured)
    2. Cisco Circuit (if client_id and client_secret are set)
    3. Anthropic (Claude)
    4. OpenAI (GPT)
    5. Google (Gemini)

    Args:
        preferred_model: Optional user-preferred model (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")

    Returns:
        Same as get_configured_ai_provider but using sync database access.
    """
    from src.config.settings import get_settings

    settings = get_settings()

    # Get all possible API keys from database config and environment
    cisco_client_id = (
        get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID") or
        getattr(settings, 'cisco_circuit_client_id', None)
    )
    cisco_client_secret = (
        get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET") or
        getattr(settings, 'cisco_circuit_client_secret', None)
    )
    cisco_app_key = (
        get_config_or_env("cisco_circuit_app_key", "CISCO_CIRCUIT_APP_KEY") or
        getattr(settings, 'cisco_circuit_app_key', None)
    )
    anthropic_key = (
        get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
        getattr(settings, 'anthropic_api_key', None)
    )
    openai_key = (
        get_config_or_env("openai_api_key", "OPENAI_API_KEY") or
        getattr(settings, 'openai_api_key', None)
    )
    google_key = (
        get_config_or_env("google_api_key", "GOOGLE_API_KEY") or
        getattr(settings, 'google_api_key', None)
    )

    # Build provider configs for lookup
    provider_configs = {}

    if cisco_client_id and cisco_client_secret:
        provider_configs["cisco"] = {
            "provider": "cisco",
            "model": "cisco-gpt-4.1",
            "client_id": cisco_client_id,
            "client_secret": cisco_client_secret,
            "app_key": cisco_app_key,
        }
    if anthropic_key:
        provider_configs["anthropic"] = {
            "provider": "anthropic",
            "model": "claude-sonnet-4-5-20250929",
            "api_key": anthropic_key,
        }
    if openai_key:
        provider_configs["openai"] = {
            "provider": "openai",
            "model": "gpt-4o",
            "api_key": openai_key,
        }
    if google_key:
        provider_configs["google"] = {
            "provider": "google",
            "model": "gemini-1.5-pro",
            "api_key": google_key,
        }

    # Priority 1: User's preferred model
    if preferred_model:
        preferred_provider = _get_provider_for_model(preferred_model)
        if preferred_provider and preferred_provider in provider_configs:
            config = provider_configs[preferred_provider].copy()
            config["model"] = preferred_model  # Use the exact model requested
            return config

    # Priority 2-5: Fallback order (Cisco > Anthropic > OpenAI > Google)
    for provider in ["cisco", "anthropic", "openai", "google"]:
        if provider in provider_configs:
            return provider_configs[provider]

    return None
