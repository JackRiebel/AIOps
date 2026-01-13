"""Prompt Registry Service for centralized prompt management.

This service provides:
- Loading prompts from YAML configuration
- Template variable substitution
- Version tracking
- Prompt metadata access (model recommendations, max_tokens, etc.)

Usage:
    from src.services.prompt_service import get_prompt, get_prompt_template

    # Get formatted prompt with variables
    prompt = get_prompt("incident_correlation", event_count=10, events_summary="...")

    # Get raw template for manual formatting
    template = get_prompt_template("workflow_generation")

    # Get prompt metadata
    metadata = get_prompt_metadata("rag_synthesis")
    model = metadata.get("model_recommendation")
"""

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)

# Path to prompts configuration file
PROMPTS_FILE = Path(__file__).parent.parent / "config" / "prompts.yaml"


class PromptNotFoundError(Exception):
    """Raised when a requested prompt is not found in the registry."""
    pass


class PromptRegistry:
    """Registry for loading and managing prompts from YAML configuration."""

    def __init__(self, prompts_file: Path = PROMPTS_FILE):
        self._prompts_file = prompts_file
        self._prompts: Dict[str, Dict[str, Any]] = {}
        self._version: str = "unknown"
        self._loaded = False

    def _load(self) -> None:
        """Load prompts from YAML file."""
        if self._loaded:
            return

        if not self._prompts_file.exists():
            logger.warning(f"Prompts file not found: {self._prompts_file}")
            self._loaded = True
            return

        try:
            with open(self._prompts_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            self._version = data.get("version", "unknown")
            self._prompts = data.get("prompts", {})
            self._loaded = True

            logger.info(
                f"Loaded {len(self._prompts)} prompts from registry (v{self._version})"
            )
        except Exception as e:
            logger.error(f"Failed to load prompts: {e}")
            self._loaded = True

    def reload(self) -> None:
        """Force reload of prompts from file."""
        self._loaded = False
        self._prompts = {}
        self._load()

    def get_template(self, name: str) -> str:
        """Get the raw template string for a prompt.

        Args:
            name: Prompt name (e.g., "incident_correlation")

        Returns:
            Raw template string with {variable} placeholders

        Raises:
            PromptNotFoundError: If prompt not found
        """
        self._load()

        if name not in self._prompts:
            raise PromptNotFoundError(f"Prompt '{name}' not found in registry")

        prompt_data = self._prompts[name]
        return prompt_data.get("template", "")

    def get_metadata(self, name: str) -> Dict[str, Any]:
        """Get metadata for a prompt.

        Args:
            name: Prompt name

        Returns:
            Dict with metadata (version, category, model_recommendation, etc.)

        Raises:
            PromptNotFoundError: If prompt not found
        """
        self._load()

        if name not in self._prompts:
            raise PromptNotFoundError(f"Prompt '{name}' not found in registry")

        prompt_data = self._prompts[name].copy()
        # Remove template from metadata
        prompt_data.pop("template", None)
        return prompt_data

    def get_formatted(self, name: str, **kwargs: Any) -> str:
        """Get a prompt with template variables substituted.

        Args:
            name: Prompt name
            **kwargs: Template variable values

        Returns:
            Formatted prompt string

        Raises:
            PromptNotFoundError: If prompt not found
            KeyError: If required template variable not provided
        """
        template = self.get_template(name)

        try:
            return template.format(**kwargs)
        except KeyError as e:
            raise KeyError(
                f"Missing template variable {e} for prompt '{name}'. "
                f"Available variables should match {{variable}} placeholders in the template."
            )

    def list_prompts(self, category: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """List all prompts, optionally filtered by category.

        Args:
            category: Optional category filter (e.g., "rag", "workflow")

        Returns:
            Dict mapping prompt names to their metadata
        """
        self._load()

        result = {}
        for name, data in self._prompts.items():
            if category is None or data.get("category") == category:
                metadata = data.copy()
                metadata.pop("template", None)
                result[name] = metadata

        return result

    @property
    def version(self) -> str:
        """Get the prompts registry version."""
        self._load()
        return self._version


# Singleton registry instance
_registry: Optional[PromptRegistry] = None


def get_registry() -> PromptRegistry:
    """Get the singleton prompt registry instance."""
    global _registry
    if _registry is None:
        _registry = PromptRegistry()
    return _registry


def get_prompt(name: str, **kwargs: Any) -> str:
    """Get a formatted prompt with template variables substituted.

    This is the main function for getting prompts in application code.

    Args:
        name: Prompt name (e.g., "incident_correlation", "workflow_generation")
        **kwargs: Template variable values

    Returns:
        Formatted prompt string

    Raises:
        PromptNotFoundError: If prompt not found
        KeyError: If required template variable not provided

    Example:
        prompt = get_prompt(
            "incident_correlation",
            event_count=10,
            events_summary="Event 1: ..."
        )
    """
    return get_registry().get_formatted(name, **kwargs)


def get_prompt_template(name: str) -> str:
    """Get the raw template string for a prompt.

    Use this when you need to format the template yourself.

    Args:
        name: Prompt name

    Returns:
        Raw template string with {variable} placeholders

    Example:
        template = get_prompt_template("workflow_generation")
        prompt = template.format(triggers="...", actions="...")
    """
    return get_registry().get_template(name)


def get_prompt_metadata(name: str) -> Dict[str, Any]:
    """Get metadata for a prompt.

    Args:
        name: Prompt name

    Returns:
        Dict with metadata including:
        - version: Prompt version string
        - category: Category (e.g., "rag", "workflow", "incident_analysis")
        - description: Human-readable description
        - model_recommendation: Suggested model to use
        - max_tokens: Recommended max_tokens setting
        - temperature: Recommended temperature (if specified)
        - timeout_ms: Recommended timeout in milliseconds (if specified)

    Example:
        metadata = get_prompt_metadata("rag_synthesis")
        model = metadata.get("model_recommendation", "claude-sonnet-4-20250514")
        max_tokens = metadata.get("max_tokens", 2048)
    """
    return get_registry().get_metadata(name)


def list_prompts(category: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
    """List all available prompts.

    Args:
        category: Optional category filter

    Returns:
        Dict mapping prompt names to their metadata
    """
    return get_registry().list_prompts(category)


def reload_prompts() -> None:
    """Reload prompts from YAML file.

    Call this to pick up changes to prompts.yaml without restarting.
    """
    get_registry().reload()


# Export convenience functions
__all__ = [
    "get_prompt",
    "get_prompt_template",
    "get_prompt_metadata",
    "list_prompts",
    "reload_prompts",
    "PromptNotFoundError",
    "PromptRegistry",
]
