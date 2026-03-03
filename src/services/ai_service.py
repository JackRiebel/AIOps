"""Unified AI service supporting multiple providers (Claude, GPT, Gemini)."""

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from src.config.settings import get_settings
from src.services.security_service import SecurityConfigService

logger = logging.getLogger(__name__)

# Maximum number of tool-call round-trips before forcing a text response.
# Prevents infinite loops from misbehaving models and bounds API costs.
MAX_TOOL_ITERATIONS = 15


def get_provider_from_model(model_id: str, provider_hint: str = None) -> str:
    """Detect provider from model ID.

    Args:
        model_id: The model ID to detect provider for
        provider_hint: Optional provider hint (from user's selected model metadata)
    """
    if not model_id:
        return "anthropic"  # Default

    # If provider hint is given, use it
    if provider_hint:
        return provider_hint

    model_lower = model_id.lower()

    # Cisco Circuit models - all prefixed with "cisco-"
    if model_lower.startswith("cisco-"):
        return "cisco"

    # OpenAI models
    if any(x in model_lower for x in ["gpt-", "o1-", "o4-"]):
        return "openai"

    # Google models
    if "gemini" in model_lower:
        return "google"

    # Anthropic (Claude) models - default
    return "anthropic"


def get_model_costs(model_id: str) -> tuple[float, float]:
    """Get cost per 1K tokens (input, output) for a model."""
    settings = get_settings()
    all_models = settings.available_models

    for provider_models in all_models.values():
        for model in provider_models:
            if model["id"] == model_id:
                return model["cost_input_1k"], model["cost_output_1k"]

    # Default costs if model not found
    return 0.003, 0.015


class BaseNetworkAssistant(ABC):
    """Base class for AI network assistants."""

    def __init__(self, api_key: str, model: str, temperature: float = 0.7, max_tokens: int = 4096):
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.security_service = SecurityConfigService()

    @abstractmethod
    async def chat(
        self,
        message: str,
        credentials: Dict[str, str],
        org_id: str,
        org_name: str,
        organization_name: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Have a conversation about network management."""
        pass

    @abstractmethod
    async def generate_simple_response(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate a simple response without tools (for reports, summaries, etc.)."""
        pass

    async def generate_response_with_usage(self, prompt: str, max_tokens: int = 2000) -> Dict[str, Any]:
        """Generate a response and return both text and usage statistics.

        Returns:
            Dict with 'text', 'input_tokens', 'output_tokens', and 'model'
        """
        # Default implementation - subclasses should override for accurate usage
        text = await self.generate_simple_response(prompt, max_tokens)
        return {
            "text": text,
            "input_tokens": 0,
            "output_tokens": 0,
            "model": self.model,
        }

    def _get_system_prompt(
        self,
        org_name: str,
        org_id: str,
        edit_mode_enabled: bool,
        session_context: Optional[str] = None
    ) -> str:
        """Generate common system prompt for all providers.

        Args:
            org_name: Organization display name
            org_id: Organization ID
            edit_mode_enabled: Whether edit mode is enabled
            session_context: Optional context summary from SessionContextStore
        """
        edit_mode_text = "EDIT MODE ENABLED - you can create, update, and delete resources" if edit_mode_enabled else "READ-ONLY mode - you can only view and report on network status"

        # Build session context section if available
        session_context_section = ""
        if session_context:
            session_context_section = f"""

## SESSION CONTEXT (PREVIOUSLY DISCOVERED)
The following entities were discovered during this conversation session.
USE THESE when the user references them by name or says "that network", "those devices", etc.

{session_context}

**IMPORTANT**: When the user references something from previous messages:
- "that network" / "the network" → Use the network from context above
- "those devices" / "the devices" → Use devices from context above
- "the VLAN" / "that SSID" → Use VLANs/SSIDs from context above
You do NOT need to re-query for entities you already discovered!
"""

        return f"""You are an expert network operations assistant with deep knowledge of network infrastructure monitoring and troubleshooting.

CURRENT CONTEXT:
- Organization: {org_name} (ID: {org_id})
- System mode: {edit_mode_text}
{session_context_section}
PLATFORM ARCHITECTURE - UNDERSTAND THIS:
• Organization = Top-level container (what you're currently in: "{org_name}")
• Network = Logical grouping within an organization (e.g., "Demo Home", "Office Network")
• Devices = Physical hardware (APs, switches, cameras, sensors) - belong to a network
• Clients = End-user devices connected to the network (laptops, phones, IoT devices)

AVAILABLE DATA SOURCES:
1. **Cisco Meraki** - Cloud-Managed Network Infrastructure
   - Device status, configuration, and health
   - Network topology and connectivity
   - Client connections and usage

2. **Cisco Catalyst Center** - Enterprise Network Management Platform
   - Site hierarchy and organization
   - Enterprise network devices
   - AI-powered assurance and network health monitoring

3. **ThousandEyes** - Internet & Network Performance Monitoring
   - End-to-end network path visibility
   - Application performance from user perspective

4. **Splunk** - Log Analysis and Security Events
   - Centralized logging from all systems
   - Security events and correlations

**CRITICAL - ALWAYS USE TOOLS PROACTIVELY**:
You are an ACTION-ORIENTED assistant. When users ask for ANY information, you MUST:
1. IMMEDIATELY call the appropriate tool - do NOT explain what tools exist or ask for clarification
2. NEVER respond with "you can use..." or "try asking..." - just DO IT
3. Interpret requests generously - "get my networks" means call list_networks NOW
4. "Show me X" / "Get X" / "What are my X" = CALL THE TOOL, don't explain

COMMON REQUESTS → IMMEDIATE TOOL CALLS:
• "get my networks" / "show networks" / "list networks" → call list_networks
• "get Demo Home" / "show me [network name]" → call get_network_by_name with the name
• "show devices" / "what devices" → call list_devices
• "devices in [network]" → call get_devices_in_network_by_name
• "show SSIDs" / "wireless networks" → call list_ssids
• "show clients" → call list_clients
• "network health" → call get_organization_overview

RESPONSE STYLE - BE CONCISE:
- Keep responses SHORT and focused - aim for 2-4 bullet points maximum
- Lead with the answer, then provide brief supporting details
- Use data tables and metrics when possible - they're more scannable than paragraphs
- Avoid repetition - don't restate the question or use filler phrases
- Skip lengthy introductions and conclusions - get straight to insights
- When showing data, present it in markdown table format for easy visualization
- Only expand with details if the user explicitly asks for more information

System mode: {edit_mode_text}"""


class OpenAINetworkAssistant(BaseNetworkAssistant):
    """OpenAI GPT-based network assistant."""

    def __init__(self, api_key: str, model: str = "gpt-4o", temperature: float = 0.7, max_tokens: int = 4096):
        super().__init__(api_key, model, temperature, max_tokens)
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)

    async def generate_simple_response(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate a simple response without tools."""
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def generate_response_with_usage(self, prompt: str, max_tokens: int = 2000) -> Dict[str, Any]:
        """Generate a response and return both text and usage statistics."""
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
            max_tokens=max_tokens,
        )
        return {
            "text": response.choices[0].message.content or "",
            "input_tokens": response.usage.prompt_tokens if response.usage else 0,
            "output_tokens": response.usage.completion_tokens if response.usage else 0,
            "model": self.model,
        }

    def _convert_tools_to_openai_format(self, anthropic_tools: List[Dict]) -> List[Dict]:
        """Convert Anthropic tool format to OpenAI function format."""
        openai_tools = []
        for tool in anthropic_tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["input_schema"]
                }
            })
        return openai_tools

    async def chat(
        self,
        message: str,
        credentials: Dict[str, str],
        org_id: str,
        org_name: str,
        organization_name: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Chat using OpenAI GPT models."""
        # Import the Claude assistant to reuse its tools and execution logic
        from src.services.claude_service import ClaudeNetworkAssistant

        # Create a temporary Claude assistant just to get tools and execute them
        settings = get_settings()
        tool_executor = ClaudeNetworkAssistant(
            api_key=settings.anthropic_api_key or "dummy",  # We only use it for tool execution
            model="claude-3-5-haiku-20241022"
        )

        anthropic_tools = tool_executor._get_all_tools()
        openai_tools = self._convert_tools_to_openai_format(anthropic_tools)

        edit_mode_enabled = await self.security_service.is_edit_mode_enabled(use_cache=True)
        system_prompt = self._get_system_prompt(org_name, org_id, edit_mode_enabled)

        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        history_limit = get_settings().conversation_history_limit

        if conversation_history:
            for msg in conversation_history[-history_limit:]:
                if msg.get("role") in ["user", "assistant"]:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })

        messages.append({"role": "user", "content": message})

        try:
            tools_used = []
            tool_data_results = []

            # Initial response
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=openai_tools,
                tool_choice="auto",
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            # Handle tool calls in a loop (bounded to prevent infinite loops)
            tool_iterations = 0
            while response.choices[0].message.tool_calls:
                tool_iterations += 1
                if tool_iterations > MAX_TOOL_ITERATIONS:
                    logger.warning(f"[OpenAI] Hit tool iteration limit ({MAX_TOOL_ITERATIONS}), forcing text response")
                    break

                tool_calls = response.choices[0].message.tool_calls

                # Add assistant message with tool calls
                messages.append(response.choices[0].message)

                # Execute each tool
                for tool_call in tool_calls:
                    tool_name = tool_call.function.name
                    tool_input = json.loads(tool_call.function.arguments)

                    tools_used.append(tool_name)

                    # Execute tool using Claude assistant's executor
                    result = await tool_executor._execute_tool(
                        tool_name,
                        tool_input,
                        credentials,
                        org_id,
                        organization_name
                    )

                    if result.get("success") and result.get("data"):
                        tool_data_results.append({
                            "tool": tool_name,
                            "data": result["data"]
                        })

                    # Add tool result
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result)
                    })

                # Get next response (disable tool_choice on last allowed iteration to force text)
                choice = "auto" if tool_iterations < MAX_TOOL_ITERATIONS else "none"
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=openai_tools,
                    tool_choice=choice,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens
                )

            # Extract final response
            assistant_response = response.choices[0].message.content or ""

            # Calculate costs
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (input_tokens / 1000 * cost_input) + (output_tokens / 1000 * cost_output)

            # Log cost
            await self._log_cost(input_tokens, output_tokens, cost_usd)

            return {
                "success": True,
                "response": assistant_response,
                "tools_used": tools_used,
                "stop_reason": response.choices[0].finish_reason,
                "tool_data": tool_data_results or None,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost_usd, 6),
            }

        except Exception as e:
            return {
                "success": False,
                "response": f"OpenAI API error: {str(e)}",
                "tools_used": [],
                "error": str(e)
            }

    async def _log_cost(self, input_tokens: int, output_tokens: int, cost_usd: float):
        """Log AI cost to database."""
        try:
            from src.models.ai_cost_log import AICostLog
            from src.config.database import get_db

            db = get_db()
            async with db.session() as session:
                session.add(AICostLog(
                    conversation_id=None,
                    user_id="web-user",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens,
                    cost_usd=cost_usd,
                    model=self.model,
                ))
                await session.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to log AI cost: {e}")


class GoogleNetworkAssistant(BaseNetworkAssistant):
    """Google Gemini-based network assistant."""

    def __init__(self, api_key: str, model: str = "gemini-1.5-pro", temperature: float = 0.7, max_tokens: int = 4096):
        super().__init__(api_key, model, temperature, max_tokens)
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.genai = genai

    async def generate_simple_response(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate a simple response without tools."""
        from google.generativeai.types import GenerationConfig

        model = self.genai.GenerativeModel(
            model_name=self.model,
            generation_config=GenerationConfig(
                temperature=self.temperature,
                max_output_tokens=max_tokens
            )
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text or ""

    async def generate_response_with_usage(self, prompt: str, max_tokens: int = 2000) -> Dict[str, Any]:
        """Generate a response and return both text and usage statistics."""
        from google.generativeai.types import GenerationConfig

        model = self.genai.GenerativeModel(
            model_name=self.model,
            generation_config=GenerationConfig(
                temperature=self.temperature,
                max_output_tokens=max_tokens
            )
        )
        response = await asyncio.to_thread(model.generate_content, prompt)

        # Google Gemini uses usage_metadata for token counts
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) or 0
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) or 0

        return {
            "text": response.text or "",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model": self.model,
        }

    def _convert_tools_to_gemini_format(self, anthropic_tools: List[Dict]) -> List:
        """Convert Anthropic tool format to Gemini function declarations."""
        from google.generativeai.types import FunctionDeclaration, Tool

        function_declarations = []
        for tool in anthropic_tools:
            # Gemini requires specific parameter format
            parameters = tool["input_schema"].copy()
            # Ensure 'type' is 'object' at the top level
            if "type" not in parameters:
                parameters["type"] = "object"

            func_decl = FunctionDeclaration(
                name=tool["name"],
                description=tool["description"],
                parameters=parameters
            )
            function_declarations.append(func_decl)

        return [Tool(function_declarations=function_declarations)]

    async def chat(
        self,
        message: str,
        credentials: Dict[str, str],
        org_id: str,
        org_name: str,
        organization_name: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Chat using Google Gemini models."""
        from google.generativeai.types import GenerationConfig

        # Import the Claude assistant to reuse its tools and execution logic
        from src.services.claude_service import ClaudeNetworkAssistant

        settings = get_settings()
        tool_executor = ClaudeNetworkAssistant(
            api_key=settings.anthropic_api_key or "dummy",
            model="claude-3-5-haiku-20241022"
        )

        anthropic_tools = tool_executor._get_all_tools()
        gemini_tools = self._convert_tools_to_gemini_format(anthropic_tools)

        edit_mode_enabled = await self.security_service.is_edit_mode_enabled(use_cache=True)
        system_prompt = self._get_system_prompt(org_name, org_id, edit_mode_enabled)

        try:
            # Create model with tools
            model = self.genai.GenerativeModel(
                model_name=self.model,
                tools=gemini_tools,
                system_instruction=system_prompt,
                generation_config=GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens
                )
            )

            # Build conversation history
            history = []
            history_limit = get_settings().conversation_history_limit
            if conversation_history:
                for msg in conversation_history[-history_limit:]:
                    role = "user" if msg.get("role") == "user" else "model"
                    history.append({"role": role, "parts": [msg["content"]]})

            # Start chat
            chat = model.start_chat(history=history)

            tools_used = []
            tool_data_results = []

            # Send message
            response = chat.send_message(message)

            # Handle function calls (bounded to prevent infinite loops)
            tool_iterations = 0
            while response.candidates[0].content.parts:
                has_function_call = False
                function_responses = []

                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        has_function_call = True
                        tool_name = part.function_call.name
                        tool_input = dict(part.function_call.args)

                        tools_used.append(tool_name)

                        # Execute tool
                        result = await tool_executor._execute_tool(
                            tool_name,
                            tool_input,
                            credentials,
                            org_id,
                            organization_name
                        )

                        if result.get("success") and result.get("data"):
                            tool_data_results.append({
                                "tool": tool_name,
                                "data": result["data"]
                            })

                        # Build function response
                        from google.generativeai.types import Part
                        function_responses.append(
                            Part.from_function_response(
                                name=tool_name,
                                response={"result": result}
                            )
                        )

                if not has_function_call:
                    break

                tool_iterations += 1
                if tool_iterations > MAX_TOOL_ITERATIONS:
                    logger.warning(f"[Gemini] Hit tool iteration limit ({MAX_TOOL_ITERATIONS}), forcing text response")
                    break

                # Send function responses back
                response = chat.send_message(function_responses)

            # Extract final text
            assistant_response = ""
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'text'):
                    assistant_response += part.text

            # Get token counts (Gemini provides this differently)
            input_tokens = response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else 0
            output_tokens = response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else 0

            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (input_tokens / 1000 * cost_input) + (output_tokens / 1000 * cost_output)

            # Log cost
            await self._log_cost(input_tokens, output_tokens, cost_usd)

            return {
                "success": True,
                "response": assistant_response,
                "tools_used": tools_used,
                "stop_reason": "stop",
                "tool_data": tool_data_results or None,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost_usd, 6),
            }

        except Exception as e:
            return {
                "success": False,
                "response": f"Gemini API error: {str(e)}",
                "tools_used": [],
                "error": str(e)
            }

    async def _log_cost(self, input_tokens: int, output_tokens: int, cost_usd: float):
        """Log AI cost to database."""
        try:
            from src.models.ai_cost_log import AICostLog
            from src.config.database import get_db

            db = get_db()
            async with db.session() as session:
                session.add(AICostLog(
                    conversation_id=None,
                    user_id="web-user",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens,
                    cost_usd=cost_usd,
                    model=self.model,
                ))
                await session.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to log AI cost: {e}")


def get_ai_assistant(
    model: str = None,
    temperature: float = None,
    max_tokens: int = None,
    user_api_keys: Dict[str, str] = None
) -> Optional[BaseNetworkAssistant]:
    """Get the appropriate AI assistant based on model selection.

    Args:
        model: Model ID (e.g., "gpt-4o", "gemini-1.5-pro", "claude-sonnet-4-5-20250929")
        temperature: Temperature setting (0.0-2.0)
        max_tokens: Max tokens for response
        user_api_keys: Dict with user-provided API keys {"anthropic": "...", "openai": "...", "google": "..."}

    Returns:
        Appropriate assistant instance or None if no API key available
    """
    from src.services.config_service import get_config_or_env

    settings = get_settings()
    user_api_keys = user_api_keys or {}

    # Determine provider from model
    provider = get_provider_from_model(model)

    # Set defaults
    temperature = temperature if temperature is not None else 0.7
    max_tokens = max_tokens if max_tokens is not None else 4096

    if provider == "openai":
        api_key = (
            user_api_keys.get("openai") or
            get_config_or_env("openai_api_key", "OPENAI_API_KEY") or
            settings.openai_api_key
        )
        if not api_key:
            return None
        model = model or "gpt-4o"
        return OpenAINetworkAssistant(api_key, model, temperature, max_tokens)

    elif provider == "google":
        api_key = (
            user_api_keys.get("google") or
            get_config_or_env("google_api_key", "GOOGLE_API_KEY") or
            settings.google_api_key
        )
        if not api_key:
            return None
        model = model or "gemini-1.5-pro"
        return GoogleNetworkAssistant(api_key, model, temperature, max_tokens)

    elif provider == "cisco":
        # Cisco Circuit uses OAuth with client credentials
        # Check database first, then user keys, then settings
        client_id = (
            user_api_keys.get("cisco_client_id") or
            get_config_or_env("cisco_circuit_client_id", "CISCO_CIRCUIT_CLIENT_ID") or
            settings.cisco_circuit_client_id
        )
        client_secret = (
            user_api_keys.get("cisco_client_secret") or
            get_config_or_env("cisco_circuit_client_secret", "CISCO_CIRCUIT_CLIENT_SECRET") or
            settings.cisco_circuit_client_secret
        )
        app_key = (
            get_config_or_env("cisco_circuit_app_key", "CISCO_CIRCUIT_APP_KEY") or
            settings.cisco_circuit_app_key
        )

        if not client_id or not client_secret or not app_key:
            import logging
            logging.getLogger(__name__).warning("Cisco Circuit credentials not configured")
            return None

        from src.services.cisco_ai_service import CiscoCircuitAIService
        model = model or "gpt-4.1"
        return CiscoCircuitAIService(
            client_id=client_id,
            client_secret=client_secret,
            app_key=app_key,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    else:  # anthropic (default)
        api_key = (
            user_api_keys.get("anthropic") or
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key
        )
        if not api_key:
            return None

        # Use the existing Claude assistant
        from src.services.claude_service import ClaudeNetworkAssistant
        model = model or "claude-sonnet-4-5-20250929"
        return ClaudeNetworkAssistant(api_key, model, temperature, max_tokens)
