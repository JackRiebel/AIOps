"""Ollama LLM adapter using the native Ollama API.

Uses the native /api/chat endpoint with think=false for fast inference
(Qwen3 and other thinking models skip the reasoning phase).
"""

import logging
from typing import Optional

import httpx

from src.services.agentic_rag.llm_adapter import BaseLLMAdapter, LLMResponse

logger = logging.getLogger(__name__)


class OllamaAdapter(BaseLLMAdapter):
    """Adapter for local Ollama models via native API with thinking disabled."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "qwen3:14b",
    ):
        # Strip /v1 suffix if present (we use the native API, not OpenAI-compat)
        self.base_url = base_url.rstrip("/").removesuffix("/v1")
        self.model = model
        self._available = True

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 2048,
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
        max_tokens: int = 2048,
        temperature: float = 0.0,
    ) -> LLMResponse:
        if not self._available:
            raise RuntimeError("Ollama client not available")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "think": False,  # Disable thinking mode for fast responses
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
        }

        if json_output:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        message = data.get("message", {})
        content = message.get("content", "")

        # Token counts
        input_tokens = data.get("prompt_eval_count", 0) or 0
        output_tokens = data.get("eval_count", 0) or 0

        return LLMResponse(
            content=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=data.get("model", self.model),
            finish_reason=data.get("done_reason", "stop"),
        )
