"""Multi-provider AI client for simple text generation.

This module provides a unified interface for AI text generation across
multiple providers: Anthropic, OpenAI, Google, and Cisco Circuit.

Usage:
    from src.services.multi_provider_ai import get_ai_client, generate_text

    # Get a client based on configured provider
    client = await get_ai_client()
    if client:
        response = await client.generate(prompt, max_tokens=2000)

    # Or use the convenience function
    response = await generate_text(prompt, max_tokens=2000)
"""

import logging
import json
import base64
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple

import httpx

from src.config.settings import get_settings
from src.services.config_service import get_configured_ai_provider
from src.services.ai_service import get_model_costs

logger = logging.getLogger(__name__)


class BaseAIClient(ABC):
    """Base class for AI provider clients."""

    def __init__(self, model: str):
        self.model = model

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: str = None,
    ) -> Dict[str, Any]:
        """Generate text from a prompt.

        Args:
            prompt: The user prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            system_prompt: Optional system prompt

        Returns:
            Dict with:
            - text: str - The generated text
            - input_tokens: int - Input token count
            - output_tokens: int - Output token count
            - model: str - Model used
            - cost_usd: float - Estimated cost
        """
        pass


class AnthropicClient(BaseAIClient):
    """Anthropic Claude client."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-5-20250929"):
        super().__init__(model)
        from anthropic import AsyncAnthropic
        self.client = AsyncAnthropic(api_key=api_key)

    async def generate(
        self,
        prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: str = None,
    ) -> Dict[str, Any]:
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        response = await self.client.messages.create(**kwargs)

        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost_input, cost_output = get_model_costs(self.model)
        cost_usd = (input_tokens / 1000 * cost_input) + (output_tokens / 1000 * cost_output)

        return {
            "text": response.content[0].text,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model": self.model,
            "cost_usd": round(cost_usd, 6),
        }


class OpenAIClient(BaseAIClient):
    """OpenAI GPT client."""

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        super().__init__(model)
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key)

    async def generate(
        self,
        prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: str = None,
    ) -> Dict[str, Any]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
        )

        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        cost_input, cost_output = get_model_costs(self.model)
        cost_usd = (input_tokens / 1000 * cost_input) + (output_tokens / 1000 * cost_output)

        return {
            "text": response.choices[0].message.content,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model": self.model,
            "cost_usd": round(cost_usd, 6),
        }


class GoogleClient(BaseAIClient):
    """Google Gemini client."""

    def __init__(self, api_key: str, model: str = "gemini-1.5-pro"):
        super().__init__(model)
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.genai = genai

    async def generate(
        self,
        prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: str = None,
    ) -> Dict[str, Any]:
        model = self.genai.GenerativeModel(
            self.model,
            system_instruction=system_prompt if system_prompt else None,
        )

        config = self.genai.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = await model.generate_content_async(prompt, generation_config=config)

        # Google doesn't provide detailed token counts the same way
        input_tokens = len(prompt) // 4  # Rough estimate
        output_tokens = len(response.text) // 4
        cost_input, cost_output = get_model_costs(self.model)
        cost_usd = (input_tokens / 1000 * cost_input) + (output_tokens / 1000 * cost_output)

        return {
            "text": response.text,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model": self.model,
            "cost_usd": round(cost_usd, 6),
        }


class CiscoCircuitClient(BaseAIClient):
    """Cisco Circuit client using OAuth authentication."""

    TOKEN_URL = "https://id.cisco.com/oauth2/default/v1/token"
    CHAT_BASE_URL = "https://chat-ai.cisco.com/openai/deployments"
    API_VERSION = "2025-04-01-preview"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        app_key: str = None,
        model: str = "cisco-gpt-4.1",
    ):
        super().__init__(model)
        self.client_id = client_id
        self.client_secret = client_secret
        self.app_key = app_key

    def _get_api_model(self) -> str:
        """Get the API model name (strip cisco- prefix)."""
        if self.model.startswith("cisco-"):
            return self.model[6:]
        return self.model

    async def generate(
        self,
        prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: str = None,
    ) -> Dict[str, Any]:
        api_model = self._get_api_model()
        chat_url = f"{self.CHAT_BASE_URL}/{api_model}/chat/completions?api-version={self.API_VERSION}"

        # Get OAuth token
        credentials = f"{self.client_id}:{self.client_secret}"
        basic_auth = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient(verify=get_settings().cisco_circuit_verify_ssl, timeout=120.0) as client:
            # Get access token
            token_response = await client.post(
                self.TOKEN_URL,
                headers={
                    "Authorization": f"Basic {basic_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data="grant_type=client_credentials",
            )

            if token_response.status_code != 200:
                raise Exception(f"Cisco token request failed: {token_response.status_code}")

            access_token = token_response.json()["access_token"]

            # Build messages
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # Call chat API
            response = await client.post(
                chat_url,
                headers={
                    "Content-Type": "application/json",
                    "api-key": access_token,
                },
                json={
                    "messages": messages,
                    "user": json.dumps({"appkey": self.app_key}) if self.app_key else None,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )

            if response.status_code != 200:
                raise Exception(f"Cisco Circuit API error: {response.status_code} - {response.text}")

            result = response.json()
            response_text = result["choices"][0]["message"]["content"]
            input_tokens = result.get("usage", {}).get("prompt_tokens", 0)
            output_tokens = result.get("usage", {}).get("completion_tokens", 0)

            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (input_tokens / 1000 * cost_input) + (output_tokens / 1000 * cost_output)

            return {
                "text": response_text,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "model": self.model,
                "cost_usd": round(cost_usd, 6),
            }


async def get_ai_client(preferred_model: str = None) -> Optional[BaseAIClient]:
    """Get an AI client based on configured provider.

    Priority order:
    1. User's preferred model (if provided and that provider is configured)
    2. Cisco Circuit (if client_id and client_secret are set)
    3. Anthropic (Claude)
    4. OpenAI (GPT)
    5. Google (Gemini)

    Args:
        preferred_model: Optional user-preferred model. If provided, uses that
            model's provider if configured, otherwise falls back to priority order.

    Returns:
        AI client instance or None if no provider configured
    """
    config = await get_configured_ai_provider(preferred_model=preferred_model)
    if not config:
        logger.warning("No AI provider configured")
        return None

    provider = config["provider"]
    model = config["model"]  # Already set correctly by get_configured_ai_provider

    if provider == "cisco":
        return CiscoCircuitClient(
            client_id=config["client_id"],
            client_secret=config["client_secret"],
            app_key=config.get("app_key"),
            model=model,
        )
    elif provider == "anthropic":
        return AnthropicClient(api_key=config["api_key"], model=model)
    elif provider == "openai":
        return OpenAIClient(api_key=config["api_key"], model=model)
    elif provider == "google":
        return GoogleClient(api_key=config["api_key"], model=model)

    return None


async def generate_text(
    prompt: str,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    system_prompt: str = None,
    preferred_model: str = None,
) -> Optional[Dict[str, Any]]:
    """Convenience function to generate text using configured AI provider.

    Priority order:
    1. User's preferred model (if provided and that provider is configured)
    2. Cisco Circuit (if client_id and client_secret are set)
    3. Anthropic (Claude)
    4. OpenAI (GPT)
    5. Google (Gemini)

    Args:
        prompt: The user prompt
        max_tokens: Maximum tokens in response
        temperature: Sampling temperature
        system_prompt: Optional system prompt
        preferred_model: Optional user-preferred model (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")

    Returns:
        Response dict or None if no provider configured
    """
    client = await get_ai_client(preferred_model)
    if not client:
        return None

    return await client.generate(
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        system_prompt=system_prompt,
    )
