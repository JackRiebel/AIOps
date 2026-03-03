"""
Unified AI Model Selection Service

Provides a single source of truth for AI model selection across all endpoints.
This eliminates inconsistencies in provider priority ordering.
"""

import logging
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Provider priority order (highest to lowest)
# Cisco Circuit is prioritized when available as it's the enterprise solution
PROVIDER_PRIORITY = ["cisco", "anthropic", "openai", "google"]


def get_available_providers(
    user: Optional[Any] = None,
    user_api_keys: Optional[Dict[str, str]] = None
) -> Dict[str, bool]:
    """
    Check which AI providers are available.

    Checks in order:
    1. Database configuration (system_config table)
    2. Environment variables
    3. User-provided API keys

    Returns:
        Dict mapping provider name to availability boolean
    """
    from src.services.config_service import get_config_or_env
    from src.config.settings import get_settings

    settings = get_settings()
    user_api_keys = user_api_keys or {}

    # Check database/env keys
    db_anthropic = get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY")
    db_cisco_id = get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID")
    db_cisco_secret = get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET")
    db_openai = get_config_or_env("openai_api_key", "OPENAI_API_KEY")
    db_google = get_config_or_env("google_api_key", "GOOGLE_API_KEY")

    # Check user-level keys
    user_has_anthropic = "anthropic" in user_api_keys
    user_has_openai = "openai" in user_api_keys
    user_has_google = "google" in user_api_keys
    user_has_cisco = False

    if user:
        # Check user's Cisco credentials from user object
        user_has_cisco = bool(
            getattr(user, 'user_cisco_client_id', None) and
            getattr(user, 'user_cisco_client_secret', None)
        )

    # Also check user_api_keys for cisco credentials
    if user_api_keys.get("cisco_client_id") and user_api_keys.get("cisco_client_secret"):
        user_has_cisco = True

    return {
        "anthropic": bool(db_anthropic or settings.anthropic_api_key or user_has_anthropic),
        "cisco": bool((db_cisco_id and db_cisco_secret) or user_has_cisco),
        "openai": bool(db_openai or settings.openai_api_key or user_has_openai),
        "google": bool(db_google or settings.google_api_key or user_has_google),
    }


def select_model(
    preferred_model: Optional[str] = None,
    user: Optional[Any] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> Tuple[Optional[str], str]:
    """
    Select the best available AI model.

    Priority:
    1. User's preferred model (if provider is available)
    2. First available provider in priority order: Cisco → Anthropic → OpenAI → Google

    Args:
        preferred_model: User's preferred model ID
        user: User object (optional, for checking user-level credentials)
        user_api_keys: Dict of user-provided API keys

    Returns:
        Tuple of (model_id, provider_name) or (None, "none") if no provider available
    """
    from src.services.ai_service import get_provider_from_model
    from src.config.settings import get_settings

    settings = get_settings()
    all_models = settings.available_models

    # Get available providers
    available = get_available_providers(user=user, user_api_keys=user_api_keys)

    logger.info(f"[MODEL SELECT] Available providers: {available}")

    # If user has a preferred model, check if its provider is available
    if preferred_model:
        provider = get_provider_from_model(preferred_model)
        if available.get(provider, False):
            logger.info(f"[MODEL SELECT] Using user's preferred model: {preferred_model} (provider={provider})")
            return preferred_model, provider
        else:
            logger.info(f"[MODEL SELECT] User's preferred model '{preferred_model}' provider '{provider}' not available")

    # Select first available provider in priority order
    for provider in PROVIDER_PRIORITY:
        if available.get(provider, False):
            if provider in all_models and all_models[provider]:
                model_id = all_models[provider][0]["id"]
                logger.info(f"[MODEL SELECT] Auto-selected model: {model_id} (provider={provider})")
                return model_id, provider

    # No provider available
    logger.warning("[MODEL SELECT] No AI provider configured!")
    return None, "none"


def build_user_api_keys(user: Optional[Any]) -> Dict[str, str]:
    """
    Build a dict of user-provided API keys from user object.

    Args:
        user: User object with API key attributes

    Returns:
        Dict mapping provider/key name to key value
    """
    if not user:
        return {}

    from src.api.routes.settings import get_user_api_key

    user_api_keys = {}

    # Standard provider keys
    for provider in ["anthropic", "openai", "google"]:
        key = get_user_api_key(user, provider)
        if key:
            user_api_keys[provider] = key

    # Cisco credentials (stored differently)
    cisco_client_id = getattr(user, 'user_cisco_client_id', None)
    cisco_client_secret = getattr(user, 'user_cisco_client_secret', None)

    if cisco_client_id:
        user_api_keys["cisco_client_id"] = cisco_client_id
    if cisco_client_secret:
        user_api_keys["cisco_client_secret"] = cisco_client_secret

    return user_api_keys
