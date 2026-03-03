# src/services/tools/splunk/mcp_handler.py
"""MCP wrapper for Splunk tool handlers.

Wraps individual tool handlers so they attempt MCP first, then fall back to
the original direct-REST handler on failure.
"""

import logging
from typing import Any, Callable, Dict

logger = logging.getLogger(__name__)


def wrap_handler_with_mcp(
    tool_name: str, original_handler: Callable
) -> Callable:
    """Wrap a tool handler to route through MCP with direct REST fallback.

    Args:
        tool_name: Internal tool name (e.g. "splunk_run_search")
        original_handler: The original handler function (direct REST)

    Returns:
        A new async handler that tries MCP first, falls back to original.
    """

    async def mcp_wrapped_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
        # Check if context supports MCP
        if hasattr(context, "call_mcp_tool"):
            try:
                result = await context.call_mcp_tool(tool_name, params)
                if result and result.get("success"):
                    logger.info(f"[MCP] Tool {tool_name} succeeded via MCP")
                    return result
                # MCP returned a failure result - fall through to direct REST
                logger.warning(
                    f"[MCP] Tool {tool_name} MCP returned failure: "
                    f"{result.get('error', 'unknown')}, falling back to direct REST"
                )
            except Exception as e:
                logger.warning(
                    f"[MCP] Tool {tool_name} MCP call failed: {e}, "
                    f"falling back to direct REST"
                )

        # Fall back to original handler (direct REST via SplunkClient)
        return await original_handler(params, context)

    # Preserve original function metadata
    mcp_wrapped_handler.__name__ = f"mcp_wrapped_{original_handler.__name__}"
    mcp_wrapped_handler.__doc__ = original_handler.__doc__
    mcp_wrapped_handler._original_handler = original_handler

    return mcp_wrapped_handler
