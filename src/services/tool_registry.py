"""Unified Tool Registry for Multi-Provider AI Architecture.

This module provides a central registry for all AI tools across platforms
(Meraki, Catalyst, ThousandEyes, Splunk). It handles:
- Tool registration and discovery
- Provider-specific format conversion (Anthropic, OpenAI, Google, Cisco)
- Tool execution routing
- Context enrichment integration

The registry replaces the A2A multi-agent system with a simpler single-model
approach where all tools are available to any AI provider.
"""

import logging
from typing import List, Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AIProvider(Enum):
    """Supported AI providers."""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"
    CISCO = "cisco"


@dataclass
class Tool:
    """Unified tool definition with examples support.

    Per Anthropic research (2024), tool use examples improve accuracy
    from 72% to 90% on complex parameter handling. Each tool can have
    1-5 examples showing typical usage patterns.
    """
    name: str
    description: str
    input_schema: Dict[str, Any]
    platform: str  # meraki, catalyst, thousandeyes, splunk, knowledge
    category: str  # organizations, networks, devices, etc.
    handler: Optional[Callable[..., Awaitable[Dict[str, Any]]]] = None
    tags: List[str] = field(default_factory=list)
    requires_write: bool = False  # True if tool modifies state
    examples: List[Dict[str, Any]] = field(default_factory=list)  # Usage examples

    def _build_description_with_examples(self) -> str:
        """Build description string with examples appended.

        Examples format: {"query": "...", "params": {...}}
        """
        if not self.examples:
            return self.description

        # Add examples section
        desc = self.description.rstrip()
        desc += "\n\nExamples:"
        for i, ex in enumerate(self.examples[:3], 1):  # Max 3 examples
            query = ex.get("query", "")
            params = ex.get("params", {})
            if query:
                desc += f"\n{i}. \"{query}\""
            if params:
                # Format params concisely
                param_str = ", ".join(f"{k}={repr(v)}" for k, v in params.items())
                desc += f" → {param_str}" if query else f"\n{i}. {param_str}"

        return desc

    def to_anthropic(self) -> Dict[str, Any]:
        """Convert to Anthropic tool format with examples in description."""
        return {
            "name": self.name,
            "description": self._build_description_with_examples(),
            "input_schema": self.input_schema,
        }

    def to_openai(self) -> Dict[str, Any]:
        """Convert to OpenAI function format with examples in description."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self._build_description_with_examples(),
                "parameters": self.input_schema,
            }
        }

    def to_google(self) -> Dict[str, Any]:
        """Convert to Google FunctionDeclaration format with examples."""
        return {
            "name": self.name,
            "description": self._build_description_with_examples(),
            "parameters": self.input_schema,
        }

    def to_cisco(self) -> str:
        """Convert to Cisco Circuit ReAct tool format (text-based)."""
        params_desc = []
        properties = self.input_schema.get("properties", {})
        required = self.input_schema.get("required", [])

        for param_name, param_info in properties.items():
            req = "(required)" if param_name in required else "(optional)"
            params_desc.append(f"  - {param_name}: {param_info.get('description', 'No description')} {req}")

        params_text = "\n".join(params_desc) if params_desc else "  (no parameters)"
        return f"""Tool: {self.name}
Description: {self.description}
Parameters:
{params_text}
"""


async def _think_tool_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Think tool handler - returns the thought unchanged. Zero-cost reasoning tool."""
    return {"success": True, "thought": params.get("thought", "")}


class ToolRegistry:
    """Central registry for all AI tools.

    Usage:
        registry = ToolRegistry()

        # Get all tools in Anthropic format
        tools = registry.get_tools_for_provider(AIProvider.ANTHROPIC)

        # Get tools for specific platform
        meraki_tools = registry.get_tools_by_platform("meraki")

        # Execute a tool
        result = await registry.execute(
            tool_name="meraki_list_networks",
            params={"org_id": "123"},
            context=execution_context
        )
    """

    _instance: Optional['ToolRegistry'] = None

    def __init__(self):
        self._tools: Dict[str, Tool] = {}
        self._tools_by_platform: Dict[str, List[Tool]] = {}
        self._tools_by_category: Dict[str, List[Tool]] = {}
        self._aliases: Dict[str, str] = {}  # alias_name -> target_name
        self._initialized = False

    @classmethod
    def get_instance(cls) -> 'ToolRegistry':
        """Get singleton instance of the registry."""
        if cls._instance is None:
            cls._instance = cls()
            cls._instance._load_all_tools()
        return cls._instance

    def register(self, tool: Tool) -> None:
        """Register a tool in the registry."""
        if tool.name in self._tools:
            logger.warning(f"Tool '{tool.name}' already registered, overwriting")

        self._tools[tool.name] = tool

        # Index by platform
        if tool.platform not in self._tools_by_platform:
            self._tools_by_platform[tool.platform] = []
        self._tools_by_platform[tool.platform].append(tool)

        # Index by category
        category_key = f"{tool.platform}:{tool.category}"
        if category_key not in self._tools_by_category:
            self._tools_by_category[category_key] = []
        self._tools_by_category[category_key].append(tool)

    def register_many(self, tools: List[Tool]) -> None:
        """Register multiple tools at once."""
        for tool in tools:
            self.register(tool)

    def register_alias(self, alias: str, target: str) -> None:
        """Register an alias for an existing tool.

        This allows workflow presets to use friendly names like 'meraki_reboot_device'
        while the actual tool is registered as 'meraki_devices_reboot'.

        Args:
            alias: The alias name to register
            target: The actual tool name this alias points to
        """
        self._aliases[alias] = target
        logger.debug(f"Registered tool alias: {alias} -> {target}")

    def get(self, name: str) -> Optional[Tool]:
        """Get a tool by name or alias."""
        # Check direct registration first
        if name in self._tools:
            return self._tools[name]
        # Check aliases
        if name in self._aliases:
            target = self._aliases[name]
            return self._tools.get(target)
        return None

    def get_tool(self, name: str) -> Optional[Tool]:
        """Alias for get() - Get a tool by name or alias."""
        return self.get(name)

    def get_all(self) -> List[Tool]:
        """Get all registered tools."""
        return list(self._tools.values())

    def get_tools_by_platform(self, platform: str) -> List[Tool]:
        """Get all tools for a specific platform."""
        return self._tools_by_platform.get(platform, [])

    def get_tools_by_category(self, platform: str, category: str) -> List[Tool]:
        """Get tools for a specific platform and category."""
        category_key = f"{platform}:{category}"
        return self._tools_by_category.get(category_key, [])

    def get_tools_for_provider(
        self,
        provider: AIProvider,
        platforms: Optional[List[str]] = None,
        include_write_tools: bool = True
    ) -> List[Dict[str, Any]]:
        """Get all tools formatted for a specific AI provider.

        Args:
            provider: The AI provider to format tools for
            platforms: Optional list of platforms to include (None = all)
            include_write_tools: Whether to include tools that modify state

        Returns:
            List of tools in provider-specific format
        """
        tools = self.get_all()

        # Filter by platform
        if platforms:
            tools = [t for t in tools if t.platform in platforms]

        # Filter out write tools if requested
        if not include_write_tools:
            tools = [t for t in tools if not t.requires_write]

        # Convert to provider format
        if provider == AIProvider.ANTHROPIC:
            return [t.to_anthropic() for t in tools]
        elif provider == AIProvider.OPENAI:
            return [t.to_openai() for t in tools]
        elif provider == AIProvider.GOOGLE:
            return [t.to_google() for t in tools]
        elif provider == AIProvider.CISCO:
            return [t.to_cisco() for t in tools]
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def get_tool_names(self) -> List[str]:
        """Get list of all registered tool names."""
        return list(self._tools.keys())

    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        stats = {
            "total_tools": len(self._tools),
            "by_platform": {},
            "by_category": {},
            "read_only_tools": 0,
            "write_tools": 0,
        }

        for platform, tools in self._tools_by_platform.items():
            stats["by_platform"][platform] = len(tools)

        for category, tools in self._tools_by_category.items():
            stats["by_category"][category] = len(tools)

        for tool in self._tools.values():
            if tool.requires_write:
                stats["write_tools"] += 1
            else:
                stats["read_only_tools"] += 1

        return stats

    async def execute(
        self,
        tool_name: str,
        params: Dict[str, Any],
        context: Any  # ExecutionContext - will be defined
    ) -> Dict[str, Any]:
        """Execute a tool by name.

        Args:
            tool_name: Name of the tool to execute
            params: Parameters for the tool
            context: Execution context with credentials, session info, etc.

        Returns:
            Tool execution result with helpful error suggestions if failed
        """
        tool = self.get(tool_name)
        if not tool:
            return {
                "success": False,
                "error": f"Tool '{tool_name}' not found",
                "is_error": True,
                "suggestion": "Check the tool name. Use 'list_tools' to see available tools.",
            }

        if not tool.handler:
            return {
                "success": False,
                "error": f"Tool '{tool_name}' has no handler registered",
                "is_error": True,
                "suggestion": "This tool is not yet implemented.",
            }

        try:
            result = await tool.handler(params, context)

            # If the handler returned an error without suggestions, enhance it
            if isinstance(result, dict) and not result.get("success", True):
                if not result.get("suggestion"):
                    try:
                        from src.services.error_handler import create_error_response
                        error_msg = result.get("error", "Unknown error")
                        enhanced = create_error_response(
                            Exception(error_msg),
                            tool_name,
                            params
                        )
                        # Merge enhanced info into result
                        result["suggestion"] = enhanced.get("suggestion")
                        result["suggested_tool"] = enhanced.get("suggested_tool")
                        result["is_error"] = True
                    except ImportError:
                        pass  # Error handler not available, skip enhancement

            return result
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            # Use error handler for helpful suggestions
            try:
                from src.services.error_handler import create_error_response
                return create_error_response(e, tool_name, params)
            except ImportError:
                return {
                    "success": False,
                    "error": str(e),
                    "is_error": True,
                }

    def _load_all_tools(self) -> None:
        """Load all tools from tool modules."""
        if self._initialized:
            return

        try:
            # Import tool modules (they auto-register on import)
            from src.services.tools import meraki, catalyst, thousandeyes, splunk, knowledge

            self._initialized = True

            # Now load workflow action tools (after base tools are registered)
            try:
                from src.services.tools import workflow_actions
                workflow_actions.register_workflow_tools()
            except Exception as e:
                logger.warning(f"[ToolRegistry] Could not load workflow actions: {e}")

            # Load canvas visualization tools
            try:
                from src.services.tools import canvas
                canvas.register_canvas_tools()
            except Exception as e:
                logger.warning(f"[ToolRegistry] Could not load canvas tools: {e}")

            # Load network configuration tools (for performance change cards)
            try:
                from src.services.tools import network_config
                network_config.register_network_config_tools()
            except Exception as e:
                logger.warning(f"[ToolRegistry] Could not load network config tools: {e}")

            # Register think tool - zero-cost reasoning checkpoint for multi-step analysis
            think_tool = create_tool(
                name="think",
                description=(
                    "Use this tool to reason step-by-step between tool calls during investigations. "
                    "Use it to: (1) analyze results you just received and what they mean, "
                    "(2) form or update hypotheses about root causes, "
                    "(3) plan which tools to call next and why, "
                    "(4) cross-reference data from Meraki, ThousandEyes, and Splunk to find correlations. "
                    "This tool is free (no API cost). Use it after receiving results for any troubleshooting query."
                ),
                platform="system",
                category="reasoning",
                properties={
                    "thought": {
                        "type": "string",
                        "description": "Your reasoning, analysis, hypothesis, or plan for next steps.",
                    },
                },
                required=["thought"],
                handler=_think_tool_handler,
                tags=["reasoning", "planning", "analysis"],
            )
            self.register(think_tool)

            stats = self.get_stats()
            logger.info(
                f"[ToolRegistry] Loaded {stats['total_tools']} tools: "
                f"Meraki={stats['by_platform'].get('meraki', 0)}, "
                f"Catalyst={stats['by_platform'].get('catalyst', 0)}, "
                f"ThousandEyes={stats['by_platform'].get('thousandeyes', 0)}, "
                f"Splunk={stats['by_platform'].get('splunk', 0)}, "
                f"Knowledge={stats['by_platform'].get('knowledge', 0)}, "
                f"Workflow={stats['by_platform'].get('workflow', 0)}"
            )
        except ImportError as e:
            logger.warning(f"[ToolRegistry] Could not load some tool modules: {e}")
            self._initialized = True


def get_tool_registry() -> ToolRegistry:
    """Get the singleton tool registry instance."""
    return ToolRegistry.get_instance()


# Convenience function for creating tools
def create_tool(
    name: str,
    description: str,
    platform: str,
    category: str,
    properties: Optional[Dict[str, Any]] = None,
    required: Optional[List[str]] = None,
    handler: Optional[Callable] = None,
    tags: Optional[List[str]] = None,
    requires_write: bool = False,
    examples: Optional[List[Dict[str, Any]]] = None,
) -> Tool:
    """Create a tool with common defaults.

    Args:
        name: Tool name (e.g., "meraki_list_networks")
        description: Tool description
        platform: Platform (meraki, catalyst, thousandeyes, splunk)
        category: Category (organizations, networks, devices, etc.)
        properties: Input schema properties (dict of param_name -> param_schema)
        required: List of required parameter names
        handler: Async function to execute the tool
        tags: Optional tags for discovery
        requires_write: Whether tool modifies state
        examples: Usage examples (list of {"query": str, "params": dict})
                  Per Anthropic research, 1-5 examples per tool improves
                  accuracy from 72% to 90% on complex parameter handling.

    Returns:
        Tool instance
    """
    input_schema = {
        "type": "object",
        "properties": properties or {},
        "required": required or [],
    }

    return Tool(
        name=name,
        description=description,
        input_schema=input_schema,
        platform=platform,
        category=category,
        handler=handler,
        tags=tags or [],
        requires_write=requires_write,
        examples=examples or [],
    )
