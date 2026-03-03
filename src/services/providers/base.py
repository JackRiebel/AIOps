"""
Base classes and interfaces for unified AI providers.

This module defines the standardized interfaces that all AI providers
must implement, ensuring consistent behavior across Anthropic, OpenAI,
Google, and Cisco providers.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional, List, Dict, Any
from enum import Enum
import time
import random
import asyncio
import logging

logger = logging.getLogger(__name__)


class ProviderType(Enum):
    """Supported AI provider types."""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"
    CISCO = "cisco"


@dataclass
class TokenUsage:
    """Standardized token usage across all providers."""
    input_tokens: int
    output_tokens: int
    total_tokens: int

    @classmethod
    def from_provider(cls, provider: ProviderType, raw_usage: Dict) -> "TokenUsage":
        """Factory method to normalize provider-specific usage formats."""
        if provider == ProviderType.OPENAI:
            return cls(
                input_tokens=raw_usage.get("prompt_tokens", 0),
                output_tokens=raw_usage.get("completion_tokens", 0),
                total_tokens=raw_usage.get("total_tokens", 0)
            )
        elif provider == ProviderType.GOOGLE:
            return cls(
                input_tokens=raw_usage.get("prompt_token_count", 0),
                output_tokens=raw_usage.get("candidates_token_count", 0),
                total_tokens=raw_usage.get("total_token_count", 0)
            )
        elif provider == ProviderType.ANTHROPIC:
            input_tokens = raw_usage.get("input_tokens", 0)
            output_tokens = raw_usage.get("output_tokens", 0)
            return cls(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens
            )
        elif provider == ProviderType.CISCO:
            return cls(
                input_tokens=raw_usage.get("prompt_tokens", 0),
                output_tokens=raw_usage.get("completion_tokens", 0),
                total_tokens=raw_usage.get("total_tokens", 0)
            )
        return cls(0, 0, 0)

    @classmethod
    def empty(cls) -> "TokenUsage":
        """Create an empty token usage instance."""
        return cls(0, 0, 0)


@dataclass
class ToolCall:
    """Standardized tool call format."""
    id: str
    name: str
    arguments: Dict[str, Any]


@dataclass
class ToolResult:
    """Standardized tool result format."""
    call_id: str
    name: str
    result: Any
    success: bool
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None


@dataclass
class StreamEvent:
    """Standardized streaming event."""
    type: str  # "text_delta", "tool_use_start", "tool_result", "done", "error"
    data: Dict[str, Any]
    sequence: int  # For ordering
    timestamp: float = field(default_factory=time.time)


@dataclass
class ChatResponse:
    """Standardized chat response across all providers."""
    success: bool
    content: str
    tools_used: List[str]
    tool_results: List[ToolResult]
    usage: TokenUsage
    stop_reason: str
    provider: ProviderType
    model: str
    cost_usd: float
    error: Optional[str] = None
    raw_response: Optional[Dict] = None  # For debugging


class BaseProvider(ABC):
    """Abstract base class for all AI providers."""

    provider_type: ProviderType

    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        timeout: float = 120.0,
        max_retries: int = 3
    ):
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.max_retries = max_retries

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict]] = None,
        tool_executor: Optional[Any] = None,
        system_prompt: Optional[str] = None,
    ) -> ChatResponse:
        """Execute a chat completion."""
        pass

    @abstractmethod
    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict]] = None,
        tool_executor: Optional[Any] = None,
        system_prompt: Optional[str] = None,
    ) -> AsyncIterator[StreamEvent]:
        """Stream a chat completion."""
        pass

    @abstractmethod
    def convert_tools(self, unified_tools: List[Dict]) -> List[Dict]:
        """Convert unified tool format to provider-specific format."""
        pass

    def _calculate_cost(self, usage: TokenUsage) -> float:
        """Calculate cost using centralized pricing."""
        from src.config.model_pricing import calculate_cost
        return float(calculate_cost(self.model, usage.input_tokens, usage.output_tokens))

    async def _retry_with_backoff(self, func, *args, **kwargs):
        """Retry logic with exponential backoff."""
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) + (random.random() * 0.5)
                    logger.warning(
                        f"Provider request failed (attempt {attempt + 1}/{self.max_retries}): {e}. "
                        f"Retrying in {wait_time:.2f}s"
                    )
                    await asyncio.sleep(wait_time)
        raise last_exception

    def _create_error_response(self, error: str) -> ChatResponse:
        """Create a standardized error response."""
        return ChatResponse(
            success=False,
            content="",
            tools_used=[],
            tool_results=[],
            usage=TokenUsage.empty(),
            stop_reason="error",
            provider=self.provider_type,
            model=self.model,
            cost_usd=0.0,
            error=error,
        )
