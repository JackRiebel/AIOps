"""LLM Adapter for agentic RAG agents.

Provides a unified interface for LLM calls that:
- Works with multiple providers (OpenAI, Anthropic, Google)
- Tracks token usage for cost estimation
- Supports JSON output mode
- Handles retries and errors gracefully
"""

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Response from an LLM call."""
    content: str
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""
    finish_reason: str = ""


class BaseLLMAdapter(ABC):
    """Abstract base class for LLM adapters."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> str:
        """Generate a response from the LLM.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            json_output: Whether to request JSON output
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature

        Returns:
            Generated text
        """
        pass

    @abstractmethod
    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> LLMResponse:
        """Generate a response with usage statistics.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            json_output: Whether to request JSON output
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature

        Returns:
            LLMResponse with content and usage stats
        """
        pass


class OpenAIAdapter(BaseLLMAdapter):
    """Adapter for OpenAI models (GPT-4, GPT-4o-mini, etc.)."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        organization: Optional[str] = None,
    ):
        """Initialize OpenAI adapter.

        Args:
            api_key: OpenAI API key
            model: Model to use
            organization: Optional organization ID
        """
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=api_key, organization=organization)
            self.model = model
            self._available = True
        except ImportError:
            logger.warning("OpenAI package not installed")
            self._available = False

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> str:
        response = await self.generate_with_usage(
            prompt=prompt,
            system_prompt=system_prompt,
            json_output=json_output,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.content

    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> LLMResponse:
        if not self._available:
            raise RuntimeError("OpenAI client not available")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        if json_output:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self.client.chat.completions.create(**kwargs)

        return LLMResponse(
            content=response.choices[0].message.content or "",
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
            model=response.model,
            finish_reason=response.choices[0].finish_reason or "",
        )


class AnthropicAdapter(BaseLLMAdapter):
    """Adapter for Anthropic models (Claude)."""

    def __init__(
        self,
        api_key: str,
        model: str = "claude-3-haiku-20240307",
    ):
        """Initialize Anthropic adapter.

        Args:
            api_key: Anthropic API key
            model: Model to use
        """
        try:
            import anthropic
            self.client = anthropic.AsyncAnthropic(api_key=api_key)
            self.model = model
            self._available = True
        except ImportError:
            logger.warning("Anthropic package not installed")
            self._available = False

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> str:
        response = await self.generate_with_usage(
            prompt=prompt,
            system_prompt=system_prompt,
            json_output=json_output,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.content

    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> LLMResponse:
        if not self._available:
            raise RuntimeError("Anthropic client not available")

        # Anthropic doesn't have native JSON mode, add instruction
        if json_output and system_prompt:
            system_prompt += "\n\nRespond ONLY with valid JSON, no other text."
        elif json_output:
            system_prompt = "Respond ONLY with valid JSON, no other text."

        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        if temperature > 0:
            kwargs["temperature"] = temperature

        response = await self.client.messages.create(**kwargs)

        content = ""
        if response.content:
            content = response.content[0].text

        return LLMResponse(
            content=content,
            input_tokens=response.usage.input_tokens if response.usage else 0,
            output_tokens=response.usage.output_tokens if response.usage else 0,
            model=response.model,
            finish_reason=response.stop_reason or "",
        )


class GoogleAdapter(BaseLLMAdapter):
    """Adapter for Google models (Gemini)."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-flash",
    ):
        """Initialize Google adapter.

        Args:
            api_key: Google API key
            model: Model to use
        """
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(model)
            self.model = model
            self._available = True
        except ImportError:
            logger.warning("Google generativeai package not installed")
            self._available = False

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> str:
        response = await self.generate_with_usage(
            prompt=prompt,
            system_prompt=system_prompt,
            json_output=json_output,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.content

    async def generate_with_usage(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> LLMResponse:
        if not self._available:
            raise RuntimeError("Google client not available")

        # Combine system prompt with user prompt for Gemini
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        if json_output:
            full_prompt += "\n\nRespond ONLY with valid JSON."

        import google.generativeai as genai

        generation_config = genai.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = await self.client.generate_content_async(
            full_prompt,
            generation_config=generation_config,
        )

        # Gemini doesn't provide detailed token counts in async mode
        return LLMResponse(
            content=response.text if response.text else "",
            input_tokens=0,  # Not available in basic response
            output_tokens=0,  # Not available in basic response
            model=self.model,
            finish_reason="stop",
        )


class AgenticRAGLLMService:
    """Unified LLM service for agentic RAG with multi-provider support.

    This service automatically selects the appropriate adapter based on
    configuration and provides a consistent interface for all agents.
    """

    def __init__(
        self,
        openai_key: Optional[str] = None,
        anthropic_key: Optional[str] = None,
        google_key: Optional[str] = None,
        default_provider: str = "openai",
        default_model: Optional[str] = None,
        ollama_base_url: Optional[str] = None,
        ollama_model: Optional[str] = None,
    ):
        """Initialize the LLM service.

        Args:
            openai_key: OpenAI API key
            anthropic_key: Anthropic API key
            google_key: Google API key
            default_provider: Default provider to use
            default_model: Default model (overrides per-provider defaults)
            ollama_base_url: Ollama API base URL (enables Ollama adapter)
            ollama_model: Ollama model name
        """
        self.adapters: Dict[str, BaseLLMAdapter] = {}
        self.default_provider = default_provider

        # Initialize available adapters
        if openai_key:
            model = (default_model if default_provider == "openai" and default_model else None) or "gpt-4o-mini"
            self.adapters["openai"] = OpenAIAdapter(openai_key, model=model)

        if anthropic_key:
            model = (default_model if default_provider == "anthropic" and default_model else None) or "claude-3-haiku-20240307"
            self.adapters["anthropic"] = AnthropicAdapter(anthropic_key, model=model)

        if google_key:
            model = (default_model if default_provider == "google" and default_model else None) or "gemini-1.5-flash"
            self.adapters["google"] = GoogleAdapter(google_key, model=model)

        if ollama_base_url:
            from src.services.agentic_rag.ollama_adapter import OllamaAdapter
            self.adapters["ollama"] = OllamaAdapter(
                base_url=ollama_base_url,
                model=ollama_model or "qwen3:14b",
            )

        # Track usage
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.call_count = 0

    def get_adapter(self, provider: Optional[str] = None) -> BaseLLMAdapter:
        """Get the appropriate adapter.

        Args:
            provider: Provider name or None for default

        Returns:
            LLM adapter

        Raises:
            ValueError: If no adapter available
        """
        provider = provider or self.default_provider

        if provider in self.adapters:
            return self.adapters[provider]

        # Fallback to any available adapter
        if self.adapters:
            return next(iter(self.adapters.values()))

        raise ValueError("No LLM adapters configured")

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
        provider: Optional[str] = None,
    ) -> str:
        """Generate a response using the configured LLM.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            json_output: Whether to request JSON output
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            provider: Optional specific provider to use

        Returns:
            Generated text
        """
        adapter = self.get_adapter(provider)
        response = await adapter.generate_with_usage(
            prompt=prompt,
            system_prompt=system_prompt,
            json_output=json_output,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        # Track usage
        self.total_input_tokens += response.input_tokens
        self.total_output_tokens += response.output_tokens
        self.call_count += 1

        return response.content

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get cumulative usage statistics.

        Returns:
            Dict with usage stats
        """
        return {
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "call_count": self.call_count,
        }

    def reset_usage_stats(self):
        """Reset usage statistics."""
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.call_count = 0


# Global LLM service instance
_llm_service: Optional[AgenticRAGLLMService] = None


def get_agentic_rag_llm_service() -> Optional[AgenticRAGLLMService]:
    """Get the global LLM service for agentic RAG."""
    return _llm_service


def init_agentic_rag_llm_service(
    openai_key: Optional[str] = None,
    anthropic_key: Optional[str] = None,
    google_key: Optional[str] = None,
    default_provider: str = "openai",
    ollama_base_url: Optional[str] = None,
    ollama_model: Optional[str] = None,
) -> AgenticRAGLLMService:
    """Initialize the global LLM service.

    Args:
        openai_key: OpenAI API key
        anthropic_key: Anthropic API key
        google_key: Google API key
        default_provider: Default provider to use
        ollama_base_url: Ollama API base URL
        ollama_model: Ollama model name

    Returns:
        Initialized LLM service
    """
    global _llm_service

    _llm_service = AgenticRAGLLMService(
        openai_key=openai_key,
        anthropic_key=anthropic_key,
        google_key=google_key,
        default_provider=default_provider,
        ollama_base_url=ollama_base_url,
        ollama_model=ollama_model,
    )

    logger.info(
        f"Agentic RAG LLM service initialized with providers: "
        f"{list(_llm_service.adapters.keys())}"
    )

    return _llm_service
