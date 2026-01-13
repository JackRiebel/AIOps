"""
Centralized model pricing configuration.

This is the single source of truth for all AI model pricing.
All services should import from here rather than defining their own pricing dictionaries.
"""

from decimal import Decimal
from typing import Dict, TypedDict


class ModelPrice(TypedDict):
    """Pricing per 1M tokens."""
    input: float
    output: float


# Model pricing (per 1M tokens)
# This is the single source of truth - do not define pricing elsewhere
MODEL_PRICING: Dict[str, ModelPrice] = {
    # Anthropic Claude models
    "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
    "claude-3-5-haiku-20241022": {"input": 0.80, "output": 4.00},
    "claude-3-sonnet-20240229": {"input": 3.00, "output": 15.00},
    "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-5-20250929": {"input": 3.00, "output": 15.00},
    "claude-3-opus-20240229": {"input": 15.00, "output": 75.00},
    "claude-opus-4-20250514": {"input": 15.00, "output": 75.00},
    "claude-opus-4-5-20251101": {"input": 15.00, "output": 75.00},

    # OpenAI models
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-4-turbo-preview": {"input": 10.00, "output": 30.00},
    "gpt-4o": {"input": 5.00, "output": 15.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},

    # Google Gemini models
    "gemini-pro": {"input": 0.50, "output": 1.50},
    "gemini-1.5-pro": {"input": 3.50, "output": 10.50},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-2.0-flash": {"input": 0.10, "output": 0.40},

    # Cisco Circuit models (pricing via Cisco internal - costs may be subsidized)
    # Free tier models
    "gpt-4.1": {"input": 2.00, "output": 8.00},
    "cisco-gpt-4.1": {"input": 2.00, "output": 8.00},
    "cisco-gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "cisco-gpt-4o": {"input": 5.00, "output": 15.00},
    # Premium tier models
    "cisco-o4-mini": {"input": 3.00, "output": 12.00},
    "cisco-o3": {"input": 15.00, "output": 60.00},
    "cisco-gpt-5": {"input": 30.00, "output": 90.00},
    "cisco-gpt-5-chat": {"input": 20.00, "output": 60.00},
    "cisco-gpt-5-mini": {"input": 5.00, "output": 15.00},
    "cisco-gpt-5-nano": {"input": 1.00, "output": 4.00},
    "cisco-gpt-4.1-mini": {"input": 1.00, "output": 3.00},
    "cisco-gemini-2.5-flash": {"input": 0.075, "output": 0.30},
    "cisco-gemini-2.5-pro": {"input": 1.25, "output": 5.00},
    "cisco-claude-sonnet-4-5": {"input": 3.00, "output": 15.00},
    "cisco-claude-sonnet-4": {"input": 3.00, "output": 15.00},
    "cisco-claude-opus-4-1": {"input": 15.00, "output": 75.00},
    "cisco-claude-opus-4-5": {"input": 15.00, "output": 75.00},
    "cisco-claude-haiku-4-5": {"input": 0.80, "output": 4.00},

    # Embedding models
    "text-embedding-ada-002": {"input": 0.10, "output": 0.00},
    "text-embedding-3-small": {"input": 0.02, "output": 0.00},
    "text-embedding-3-large": {"input": 0.13, "output": 0.00},
}

# Default model for fallback pricing
DEFAULT_MODEL = "claude-3-5-haiku-20241022"


def get_model_pricing(model: str) -> ModelPrice:
    """
    Get pricing for a specific model.

    Args:
        model: The model name/ID

    Returns:
        ModelPrice dict with input and output costs per 1M tokens
    """
    return MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    """
    Calculate the cost for a given model and token counts.

    Args:
        model: The model name/ID
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Cost in USD as a Decimal
    """
    pricing = get_model_pricing(model)
    input_cost = Decimal(str(pricing["input"])) * Decimal(input_tokens) / Decimal(1_000_000)
    output_cost = Decimal(str(pricing["output"])) * Decimal(output_tokens) / Decimal(1_000_000)
    return input_cost + output_cost


def get_all_pricing() -> Dict[str, ModelPrice]:
    """
    Get all model pricing for API responses.

    Returns:
        Complete MODEL_PRICING dictionary
    """
    return MODEL_PRICING.copy()
