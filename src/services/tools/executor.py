"""
Unified tool executor for AI operations.

This module provides a standardized interface for executing tools
with proper credential resolution, error handling, and result formatting.
"""

import asyncio
import time
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    """Standardized tool definition."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    platform: str  # "meraki", "catalyst", "thousandeyes", "splunk"
    category: str
    requires_write: bool = False
    timeout_seconds: int = 30
    retry_count: int = 2


@dataclass
class ToolExecutionResult:
    """Standardized tool execution result."""
    success: bool
    data: Optional[Any]
    error: Optional[str]
    execution_time_ms: int
    tool_name: str
    artifact_hint: Optional[str] = None  # Suggested artifact type


class ToolExecutor:
    """Unified tool execution with credential resolution and error handling."""

    # Map tools to artifact types for Canvas integration
    ARTIFACT_HINTS = {
        "list_networks": "data_table",
        "list_devices": "device_cards",
        "get_network_topology": "topology",
        "get_device_clients": "data_table",
        "get_performance_metrics": "chart",
        "run_splunk_query": "data_table",
        "get_devices_in_network": "device_cards",
        "get_network_clients": "data_table",
        "get_device_status": "device_cards",
    }

    def __init__(self, credential_pool=None, context: Optional[Dict] = None):
        """Initialize tool executor.

        Args:
            credential_pool: Optional credential pool for resolving API credentials
            context: Optional execution context (org_id, org_name, etc.)
        """
        self.credential_pool = credential_pool
        self.context = context or {}
        self._registry = None

    @property
    def registry(self):
        """Lazy load the tool registry."""
        if self._registry is None:
            from src.services.tool_registry import ToolRegistry
            self._registry = ToolRegistry.get_instance()
        return self._registry

    def get_tools(self, format: str = "anthropic") -> List[Dict]:
        """Get all available tools in the specified format.

        Args:
            format: Output format - "anthropic", "openai", or "google"

        Returns:
            List of tool definitions in the specified format
        """
        from src.services.tool_registry import AIProvider

        provider_map = {
            "anthropic": AIProvider.ANTHROPIC,
            "openai": AIProvider.OPENAI,
            "google": AIProvider.GOOGLE,
            "cisco": AIProvider.CISCO,
        }

        provider = provider_map.get(format, AIProvider.ANTHROPIC)
        return self.registry.get_tools_for_provider(provider)

    async def execute(
        self,
        tool_name: str,
        inputs: Dict[str, Any],
        timeout: Optional[int] = None,
    ) -> ToolExecutionResult:
        """Execute a tool with full error handling.

        Args:
            tool_name: Name of the tool to execute
            inputs: Tool input parameters
            timeout: Optional timeout override in seconds

        Returns:
            ToolExecutionResult with success status and data or error
        """
        start_time = time.time()

        try:
            # Get tool definition
            tool = self.registry.get(tool_name)
            if not tool:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    error=f"Unknown tool: {tool_name}",
                    execution_time_ms=0,
                    tool_name=tool_name,
                )

            # Check if tool requires write permission
            if tool.requires_write:
                # Check edit mode
                from src.services.security_service import SecurityConfigService
                security_service = SecurityConfigService()
                if not await security_service.is_edit_mode_enabled():
                    return ToolExecutionResult(
                        success=False,
                        data=None,
                        error="Write operations are disabled. Enable Edit Mode to use this tool.",
                        execution_time_ms=0,
                        tool_name=tool_name,
                    )

            # Resolve credentials for platform
            credentials = await self._resolve_credentials(tool.platform, inputs)

            # Get organization context
            org_id = inputs.get("org_id") or inputs.get("organization_id") or self.context.get("org_id")
            org_name = self.context.get("org_name", "default")

            # Execute with timeout
            timeout_seconds = timeout or getattr(tool, 'timeout_seconds', 30)

            if tool.handler:
                # Use the tool's registered handler
                result = await asyncio.wait_for(
                    tool.handler(inputs, credentials, org_id, org_name),
                    timeout=timeout_seconds
                )
            else:
                # Try legacy execution path via registry
                result = await asyncio.wait_for(
                    self.registry.execute(
                        tool_name=tool_name,
                        params=inputs,
                        context={
                            "credentials": credentials,
                            "org_id": org_id,
                            "org_name": org_name,
                            **self.context,
                        }
                    ),
                    timeout=timeout_seconds
                )

            execution_time = int((time.time() - start_time) * 1000)

            # Normalize result format
            if isinstance(result, dict):
                success = result.get("success", True)
                data = result.get("data", result)
                error = result.get("error")
            else:
                success = True
                data = result
                error = None

            # Determine artifact hint
            artifact_hint = self._get_artifact_hint(tool_name, data)

            return ToolExecutionResult(
                success=success,
                data=data,
                error=error,
                execution_time_ms=execution_time,
                tool_name=tool_name,
                artifact_hint=artifact_hint,
            )

        except asyncio.TimeoutError:
            execution_time = int((time.time() - start_time) * 1000)
            return ToolExecutionResult(
                success=False,
                data=None,
                error=f"Tool execution timed out after {timeout_seconds}s",
                execution_time_ms=execution_time,
                tool_name=tool_name,
            )
        except Exception as e:
            logger.exception(f"Tool execution error: {tool_name}")
            execution_time = int((time.time() - start_time) * 1000)
            return ToolExecutionResult(
                success=False,
                data=None,
                error=str(e),
                execution_time_ms=execution_time,
                tool_name=tool_name,
            )

    async def _resolve_credentials(
        self,
        platform: str,
        inputs: Dict[str, Any]
    ) -> Optional[Dict[str, str]]:
        """Resolve credentials for a platform based on inputs.

        Args:
            platform: The platform name (meraki, catalyst, etc.)
            inputs: Tool input parameters that may contain org/instance hints

        Returns:
            Dictionary with credentials or None if not available
        """
        if self.credential_pool is None:
            # Try to get credentials from context
            return self.context.get("credentials")

        try:
            if platform == "meraki":
                org_id = inputs.get("org_id") or inputs.get("organization_id")
                return await self.credential_pool.get_meraki(org_id)

            elif platform == "catalyst":
                base_url = inputs.get("base_url")
                return await self.credential_pool.get_catalyst(base_url)

            elif platform == "thousandeyes":
                return await self.credential_pool.get_thousandeyes()

            elif platform == "splunk":
                base_url = inputs.get("base_url")
                return await self.credential_pool.get_splunk(base_url)

            elif platform == "knowledge":
                # Knowledge tools don't need external credentials
                return {}

        except Exception as e:
            logger.warning(f"Failed to resolve credentials for {platform}: {e}")

        return self.context.get("credentials")

    def _get_artifact_hint(self, tool_name: str, result: Any) -> Optional[str]:
        """Determine if result should become a Canvas artifact.

        Args:
            tool_name: Name of the tool that was executed
            result: The tool execution result data

        Returns:
            Artifact type string or None
        """
        # Check static mapping first
        if tool_name in self.ARTIFACT_HINTS:
            return self.ARTIFACT_HINTS[tool_name]

        # Dynamic detection based on result structure
        if isinstance(result, dict):
            # List of devices -> device cards
            if "devices" in result and isinstance(result["devices"], list):
                return "device_cards"

            # Topology data
            if "nodes" in result and "edges" in result:
                return "topology"

            # Time series data
            if "timestamps" in result or "metrics" in result:
                return "chart"

        # List of items -> data table
        if isinstance(result, list) and len(result) > 0:
            if all(isinstance(item, dict) for item in result):
                return "data_table"

        return None

    async def execute_batch(
        self,
        tool_calls: List[Dict[str, Any]],
        parallel: bool = True,
    ) -> List[ToolExecutionResult]:
        """Execute multiple tool calls.

        Args:
            tool_calls: List of dicts with 'name' and 'inputs' keys
            parallel: If True, execute tools in parallel when possible

        Returns:
            List of ToolExecutionResult in same order as input
        """
        if parallel:
            tasks = [
                self.execute(tc["name"], tc.get("inputs", {}))
                for tc in tool_calls
            ]
            return await asyncio.gather(*tasks)
        else:
            results = []
            for tc in tool_calls:
                result = await self.execute(tc["name"], tc.get("inputs", {}))
                results.append(result)
            return results


def get_tool_executor(credential_pool=None, context: Optional[Dict] = None) -> ToolExecutor:
    """Create a tool executor instance.

    Args:
        credential_pool: Optional credential pool
        context: Optional execution context

    Returns:
        Configured ToolExecutor instance
    """
    return ToolExecutor(credential_pool=credential_pool, context=context)
