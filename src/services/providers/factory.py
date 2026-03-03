"""
Provider factory for creating AI provider instances.

This module provides factory functions to detect and create the appropriate
AI provider based on model ID or explicit provider selection.
"""

import logging
from typing import Optional, Dict

from .base import BaseProvider, ProviderType

logger = logging.getLogger(__name__)


def detect_provider(model_id: str) -> ProviderType:
    """Detect provider from model ID.

    Args:
        model_id: The model identifier string

    Returns:
        ProviderType enum value
    """
    model_lower = model_id.lower()

    # Cisco models (prefixed or in Cisco model list)
    if model_lower.startswith("cisco-"):
        return ProviderType.CISCO

    # OpenAI models
    if any(x in model_lower for x in ["gpt-", "o1-", "o3-", "o4-"]):
        return ProviderType.OPENAI

    # Google Gemini models
    if "gemini" in model_lower:
        return ProviderType.GOOGLE

    # Default to Anthropic for Claude models
    return ProviderType.ANTHROPIC


def create_provider(
    model: str,
    user_api_keys: Optional[Dict[str, str]] = None,
    **kwargs
) -> BaseProvider:
    """Factory function to create appropriate provider.

    Args:
        model: Model ID string (e.g., "claude-sonnet-4-5-20250929", "gpt-4o")
        user_api_keys: Optional dict of user-provided API keys
        **kwargs: Additional provider configuration

    Returns:
        Configured BaseProvider instance

    Raises:
        ValueError: If required API key is not available
    """
    from src.config.settings import get_settings
    from src.services.config_service import get_config_or_env

    settings = get_settings()
    user_api_keys = user_api_keys or {}
    provider_type = detect_provider(model)

    logger.info(f"Creating provider for model '{model}' (type: {provider_type.value})")

    if provider_type == ProviderType.ANTHROPIC:
        from .anthropic_provider import AnthropicProvider

        api_key = (
            user_api_keys.get("anthropic") or
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key
        )
        if not api_key:
            raise ValueError("Anthropic API key not configured")
        return AnthropicProvider(api_key=api_key, model=model, **kwargs)

    elif provider_type == ProviderType.OPENAI:
        from .openai_provider import OpenAIProvider

        api_key = (
            user_api_keys.get("openai") or
            get_config_or_env("openai_api_key", "OPENAI_API_KEY") or
            settings.openai_api_key
        )
        if not api_key:
            raise ValueError("OpenAI API key not configured")
        return OpenAIProvider(api_key=api_key, model=model, **kwargs)

    elif provider_type == ProviderType.GOOGLE:
        from .google_provider import GoogleProvider

        api_key = (
            user_api_keys.get("google") or
            get_config_or_env("google_api_key", "GOOGLE_API_KEY") or
            settings.google_api_key
        )
        if not api_key:
            raise ValueError("Google API key not configured")
        return GoogleProvider(api_key=api_key, model=model, **kwargs)

    elif provider_type == ProviderType.CISCO:
        from .cisco_provider import CiscoProvider

        client_id = (
            get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID") or
            settings.cisco_circuit_client_id
        )
        client_secret = (
            get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET") or
            settings.cisco_circuit_client_secret
        )
        app_key = (
            get_config_or_env("cisco_circuit_app_key", "CISCO_CIRCUIT_APP_KEY") or
            settings.cisco_circuit_app_key
        )

        if not client_id or not client_secret:
            raise ValueError("Cisco Circuit credentials not configured")

        return CiscoProvider(
            client_id=client_id,
            client_secret=client_secret,
            app_key=app_key or "",
            model=model,
            verify_ssl=settings.cisco_circuit_verify_ssl,
            **kwargs
        )

    raise ValueError(f"Unknown provider for model: {model}")


def get_available_providers() -> Dict[str, bool]:
    """Check which providers are available based on configured credentials.

    Returns:
        Dict mapping provider names to availability status
    """
    from src.config.settings import get_settings
    from src.services.config_service import get_config_or_env

    settings = get_settings()

    return {
        "anthropic": bool(
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key
        ),
        "openai": bool(
            get_config_or_env("openai_api_key", "OPENAI_API_KEY") or
            settings.openai_api_key
        ),
        "google": bool(
            get_config_or_env("google_api_key", "GOOGLE_API_KEY") or
            settings.google_api_key
        ),
        "cisco": bool(
            (get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID") or
             settings.cisco_circuit_client_id) and
            (get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET") or
             settings.cisco_circuit_client_secret)
        ),
    }


def get_default_model() -> str:
    """Get the default model based on available providers.

    Returns the first available model in preference order:
    1. Anthropic Claude
    2. OpenAI GPT-4
    3. Google Gemini
    4. Cisco Circuit

    Returns:
        Model ID string
    """
    available = get_available_providers()

    if available.get("anthropic"):
        return "claude-sonnet-4-5-20250929"
    if available.get("openai"):
        return "gpt-4o"
    if available.get("google"):
        return "gemini-1.5-pro"
    if available.get("cisco"):
        return "cisco-gpt-4.1"

    # Fallback - will fail if no providers configured
    return "claude-sonnet-4-5-20250929"
