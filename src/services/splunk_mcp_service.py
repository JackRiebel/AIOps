# src/services/splunk_mcp_service.py
"""Shared Splunk MCP client service for routing AI tool calls through the MCP server."""

import asyncio
import logging
from functools import lru_cache
from typing import Any, Dict, Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)

# Reuse the semaphore from routes/splunk to share the concurrency limit
from src.api.routes.splunk import (
    _mcp_semaphore,
    get_mcp_client_params,
    _extract_mcp_result,
    _map_tool_arguments,
    MCP_TIMEOUT_SECONDS,
)
from src.services.config_service import ConfigService

# =============================================================================
# TOOL NAME MAPPING: internal AI tool name → MCP server tool name
# =============================================================================

TOOL_NAME_MAP: Dict[str, str] = {
    # Search tools
    "splunk_run_search": "splunk_run_query",
    "splunk_search_run_splunk_query": "splunk_run_query",
    # System tools
    "splunk_system_get_splunk_info": "splunk_get_info",
    "splunk_get_server_info": "splunk_get_info",
    "splunk_system_get_indexes": "splunk_get_indexes",
    "splunk_list_indexes": "splunk_get_indexes",
    "splunk_system_get_index_info": "splunk_get_index_info",
    "splunk_get_index": "splunk_get_index_info",
    "splunk_system_get_metadata": "splunk_get_metadata",
    # User tools
    "splunk_users_get_user_info": "splunk_get_user_info",
    "splunk_get_current_user": "splunk_get_user_info",
    # Knowledge tools
    "splunk_knowledge_get_objects": "splunk_get_knowledge_objects",
    # AI Assistant (SAIA) tools
    "splunk_search_generate_spl": "saia_generate_spl",
    "splunk_search_optimize_spl": "saia_optimize_spl",
    "splunk_search_explain_spl": "saia_explain_spl",
    "splunk_assistant_ask_splunk_question": "saia_ask_splunk_question",
}

# =============================================================================
# PARAMETER MAPPING: internal param name → MCP param name
# =============================================================================

PARAM_NAME_MAP: Dict[str, str] = {
    "search_query": "query",
    "spl_query": "spl",
    "natural_language_query": "prompt",
    "index_name": "index",
}


def has_mcp_equivalent(tool_name: str) -> bool:
    """Check if an internal tool name has an MCP server equivalent."""
    return tool_name in TOOL_NAME_MAP


def _map_params(tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Map internal parameter names to MCP parameter names."""
    mapped = {}
    for key, value in params.items():
        mapped_key = PARAM_NAME_MAP.get(key, key)
        mapped[mapped_key] = value
    return mapped


# =============================================================================
# SPLUNK MCP SERVICE
# =============================================================================

class SplunkMCPService:
    """Shared MCP client service for Splunk tool calls.

    Checks whether MCP credentials are available and routes tool calls
    through the MCP server with structured result extraction.
    """

    def __init__(self):
        self._config_service = ConfigService()
        self._available: Optional[bool] = None
        self._creds_cache: Optional[Dict[str, Any]] = None

    async def is_available(self) -> bool:
        """Check if MCP credentials are configured and MCP is usable."""
        if self._available is not None:
            return self._available

        try:
            creds = await self.get_mcp_creds()
            self._available = creds is not None and bool(creds.get("mcp_token"))
        except Exception:
            self._available = False

        if self._available:
            logger.info("[SplunkMCP] MCP service is available")
        else:
            logger.debug("[SplunkMCP] MCP service not available (no mcp_token configured)")

        return self._available

    async def get_mcp_creds(self) -> Optional[Dict[str, Any]]:
        """Get MCP credentials from system config. Returns None if not configured."""
        if self._creds_cache is not None:
            return self._creds_cache

        try:
            config_service = ConfigService()

            api_url = await config_service.get_config("splunk_api_url")
            bearer_token = await config_service.get_config("splunk_bearer_token")
            mcp_endpoint = await config_service.get_config("splunk_mcp_endpoint")
            mcp_token = await config_service.get_config("splunk_mcp_token")
            verify_ssl_config = await config_service.get_config("splunk_verify_ssl")

            if not bearer_token:
                return None

            base_url = api_url or "https://localhost:8089"
            is_localhost = "localhost" in base_url or "127.0.0.1" in base_url

            if verify_ssl_config is not None:
                verify_ssl = str(verify_ssl_config).lower() in ("true", "1", "yes")
            else:
                verify_ssl = not is_localhost

            if not mcp_token:
                return None

            self._creds_cache = {
                "base_url": base_url,
                "token": bearer_token,
                "mcp_token": mcp_token,
                "verify_ssl": verify_ssl,
                "mcp_endpoint": mcp_endpoint,
            }
            return self._creds_cache

        except Exception as e:
            logger.warning(f"[SplunkMCP] Failed to get MCP creds: {e}")
            return None

    async def call_tool(
        self, tool_name: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call a Splunk tool via the MCP server.

        Args:
            tool_name: Internal AI tool name (e.g. "splunk_run_search")
            params: Tool parameters using internal naming

        Returns:
            Dict with {success: True, data: ...} or {success: False, error: ...}

        Raises:
            Exception on MCP connection/timeout failures (caller should catch for fallback)
        """
        mcp_tool_name = TOOL_NAME_MAP.get(tool_name)
        if not mcp_tool_name:
            raise ValueError(f"No MCP equivalent for tool: {tool_name}")

        creds = await self.get_mcp_creds()
        if not creds:
            raise RuntimeError("MCP credentials not available")

        # Map parameter names
        mapped_params = _map_params(tool_name, params)

        logger.info(
            f"[SplunkMCP] Calling MCP tool: {tool_name} -> {mcp_tool_name}, "
            f"params: {list(params.keys())} -> {list(mapped_params.keys())}"
        )

        try:
            server_params = get_mcp_client_params(
                creds["base_url"],
                creds["token"],
                creds["verify_ssl"],
                mcp_endpoint=creds.get("mcp_endpoint"),
                mcp_token=creds.get("mcp_token"),
            )
        except (FileNotFoundError, OSError) as e:
            raise RuntimeError(f"MCP runtime not available: {e}")

        async with _mcp_semaphore:
            async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()

                        # Verify tool exists
                        tools_response = await session.list_tools()
                        tool = next(
                            (t for t in tools_response.tools if t.name == mcp_tool_name),
                            None,
                        )
                        if not tool:
                            available_names = [t.name for t in tools_response.tools]
                            raise ValueError(
                                f"MCP tool '{mcp_tool_name}' not found. "
                                f"Available: {available_names}"
                            )

                        # Use the existing argument mapper for schema-aware mapping
                        final_args = _map_tool_arguments(tool, mapped_params)
                        logger.info(
                            f"[SplunkMCP] Final MCP args for {mcp_tool_name}: "
                            f"{list(final_args.keys())}"
                        )

                        result = await session.call_tool(mcp_tool_name, arguments=final_args)
                        data = _extract_mcp_result(result)

                        logger.info(f"[SplunkMCP] MCP call successful: {mcp_tool_name}")
                        return {"success": True, "data": data}


# =============================================================================
# SINGLETON
# =============================================================================

_instance: Optional[SplunkMCPService] = None


def get_splunk_mcp_service() -> SplunkMCPService:
    """Get or create the singleton SplunkMCPService instance."""
    global _instance
    if _instance is None:
        _instance = SplunkMCPService()
    return _instance
