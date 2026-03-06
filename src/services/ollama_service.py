"""Ollama service for health checks and model listing."""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class OllamaService:
    """Service for interacting with the Ollama API (non-LLM operations)."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    async def health_check(self) -> dict:
        """Check if Ollama is running and responsive."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    return {
                        "status": "connected",
                        "models": models,
                        "model_count": len(models),
                    }
                return {"status": "error", "detail": f"HTTP {resp.status_code}"}
        except httpx.ConnectError:
            return {"status": "disconnected", "detail": "Cannot connect to Ollama"}
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    async def list_models(self) -> list[dict]:
        """List available models from Ollama."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    return resp.json().get("models", [])
                return []
        except Exception:
            return []

    async def get_model_info(self, model_name: str) -> Optional[dict]:
        """Get info about a specific model."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/show",
                    json={"name": model_name},
                )
                if resp.status_code == 200:
                    return resp.json()
                return None
        except Exception:
            return None


_ollama_service: Optional[OllamaService] = None


def get_ollama_service(base_url: str = "http://localhost:11434") -> OllamaService:
    """Get or create the global OllamaService instance."""
    global _ollama_service
    if _ollama_service is None:
        _ollama_service = OllamaService(base_url=base_url)
    return _ollama_service
