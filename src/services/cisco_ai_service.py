"""Cisco Circuit AI service for network management using GPT-4 via Cisco's internal API."""

import base64
import json
import logging
import re
import time
from typing import List, Dict, Any, Optional

import httpx

from src.config.settings import get_settings
from src.services.ai_service import BaseNetworkAssistant, get_model_costs
from src.services.security_service import SecurityConfigService
from src.services.config_service import get_config_or_env

logger = logging.getLogger(__name__)


# =============================================================================
# ReAct Pattern Support for Cisco Circuit
# =============================================================================
# Cisco Circuit's API accepts tools but the model may not return tool_calls.
# We implement the ReAct (Reasoning + Acting) pattern as a fallback where the
# model outputs structured text that we parse and execute.

REACT_TOOL_PROMPT = """
## Tool Usage Instructions

You have access to the following tools to help answer user questions:

{tool_definitions}

**CRITICAL: When the user asks for live data (networks, devices, status, etc.), you MUST use a tool.**

When you need to use a tool, respond with EXACTLY this format:
```
Thought: [Your reasoning about what information is needed]
Action: [exact_tool_name]
Action Input: {{"param1": "value1", "param2": "value2"}}
```

After I provide the Observation with the tool result, continue reasoning.
When you have gathered all the information needed, provide your final response:
```
Thought: I now have all the information needed to answer.
Final Answer: [Your complete response to the user, formatted nicely with the data]
```

**RULES:**
- ALWAYS use tools when asked about networks, devices, clients, status, or any live data
- NEVER make up data - use tools to fetch real information
- Output valid JSON for Action Input (use double quotes for strings)
- Only call ONE tool at a time, wait for the Observation before continuing
- If a tool returns an error, explain what went wrong in your Final Answer
"""


def _extract_balanced_json(text: str) -> Optional[str]:
    """Extract a balanced JSON object from the start of text.

    Handles nested objects and arrays by counting brackets.

    Args:
        text: Text starting with '{' (should be stripped of leading whitespace)

    Returns:
        The extracted JSON string, or None if no valid JSON found
    """
    if not text.startswith('{'):
        return None

    brace_count = 0
    bracket_count = 0
    in_string = False
    escape_next = False

    for i, char in enumerate(text):
        if escape_next:
            escape_next = False
            continue

        if char == '\\' and in_string:
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                return text[:i + 1]
        elif char == '[':
            bracket_count += 1
        elif char == ']':
            bracket_count -= 1

        # Stop if we hit a clear end marker (newline after balanced JSON is common)
        if brace_count == 0 and bracket_count == 0 and char == '\n' and i > 0:
            # Check if we've captured a complete JSON
            potential_json = text[:i]
            if potential_json.strip().endswith('}'):
                return potential_json.strip()

    return None


def parse_react_response(text: str) -> Dict[str, Any]:
    """Parse ReAct-style response for tool calls.

    The model outputs structured text like:
        Thought: I need to get the networks
        Action: list_networks
        Action Input: {"organization": "default"}

    Or when done:
        Thought: I have all the data
        Final Answer: Here are your networks...

    Returns:
        Dict with keys:
            has_action: bool - True if Action was found
            thought: str | None - The model's reasoning
            action: str | None - Tool name to call
            action_input: dict | None - Tool parameters
            final_answer: str | None - Final response (if complete)
    """
    result = {
        "has_action": False,
        "thought": None,
        "action": None,
        "action_input": None,
        "final_answer": None
    }

    # Check for Final Answer first (indicates completion)
    final_match = re.search(r'Final Answer:\s*(.+)', text, re.DOTALL | re.IGNORECASE)
    if final_match:
        result["final_answer"] = final_match.group(1).strip()
        return result

    # Parse Thought (reasoning)
    thought_match = re.search(r'Thought:\s*(.+?)(?=Action:|Final Answer:|$)', text, re.DOTALL | re.IGNORECASE)
    if thought_match:
        result["thought"] = thought_match.group(1).strip()

    # Parse Action (tool name)
    action_match = re.search(r'Action:\s*(\w+)', text, re.IGNORECASE)
    if action_match:
        result["action"] = action_match.group(1).strip()
        result["has_action"] = True

    # Parse Action Input (JSON parameters)
    # Look for JSON object after "Action Input:" - handle nested objects
    # First find where Action Input starts
    input_start = re.search(r'Action Input:\s*', text, re.IGNORECASE)
    if input_start and result["has_action"]:
        # Find the JSON starting from after "Action Input:"
        json_start_pos = input_start.end()
        remaining_text = text[json_start_pos:]

        # Try to extract balanced JSON
        if remaining_text.strip().startswith('{'):
            json_str = _extract_balanced_json(remaining_text.strip())
            if json_str:
                try:
                    result["action_input"] = json.loads(json_str)
                except json.JSONDecodeError:
                    # Try to fix common JSON issues (single quotes, unquoted keys)
                    fixed_json = re.sub(r"'", '"', json_str)  # Replace single quotes
                    try:
                        result["action_input"] = json.loads(fixed_json)
                    except json.JSONDecodeError:
                        logger.warning(f"[ReAct] Failed to parse Action Input: {json_str[:200]}")
                        result["action_input"] = {}
            else:
                # Fallback to simple regex for flat JSON
                input_match = re.search(r'\{[^}]+\}', remaining_text)
                if input_match:
                    try:
                        result["action_input"] = json.loads(input_match.group(0))
                    except json.JSONDecodeError:
                        logger.warning(f"[ReAct] Failed to parse fallback Action Input")
                        result["action_input"] = {}
                else:
                    result["action_input"] = {}
        else:
            result["action_input"] = {}
    elif result["has_action"]:
        # Action without input - use empty dict
        result["action_input"] = {}

    return result


def format_tools_for_react(tools: List[Dict]) -> str:
    """Format tool definitions for ReAct system prompt.

    Args:
        tools: List of tool definitions (Anthropic or OpenAI format)

    Returns:
        Formatted string describing available tools
    """
    lines = []
    for tool in tools:
        # Handle both Anthropic and OpenAI formats
        if "function" in tool:
            # OpenAI format
            name = tool["function"]["name"]
            desc = tool["function"].get("description", "")
            schema = tool["function"].get("parameters", {})
        else:
            # Anthropic format
            name = tool.get("name", "unknown")
            desc = tool.get("description", "")
            schema = tool.get("input_schema", {})

        lines.append(f"- **{name}**: {desc}")

        # Show parameters if available
        if schema.get("properties"):
            params = []
            required = schema.get("required", [])
            for param_name, param_def in schema["properties"].items():
                param_type = param_def.get("type", "string")
                req_marker = " (required)" if param_name in required else ""
                params.append(f"    - {param_name}: {param_type}{req_marker}")
            if params:
                lines.extend(params)

    return "\n".join(lines)


class CiscoCircuitAIService(BaseNetworkAssistant):
    """Cisco Circuit AI provider using Cisco's internal API.

    Supports multiple models via Cisco Circuit:

    Free Tier (120K tokens):
    - gpt-4.1: GPT-4.1 (120K free tier, 1M pay-as-you-use)
    - gpt-4o: GPT-4o (120K tokens)
    - gpt-4o-mini: GPT-4o Mini (120K tokens)

    Premium Tier:
    - o4-mini: o4-mini reasoning model (200K tokens)
    - o3: o3 advanced reasoning model (200K tokens)
    - gpt-5: GPT-5 flagship model (270K tokens)
    - gpt-5-chat: GPT-5 optimized for chat (120K tokens)
    - gpt-5-mini: GPT-5 Mini (1M tokens)
    - gpt-5-nano: GPT-5 Nano fast model (1M tokens)
    - gpt-4.1-mini: GPT-4.1 Mini (1M tokens)
    - gemini-2.5-flash: Google Gemini 2.5 Flash (1M tokens)
    - gemini-2.5-pro: Google Gemini 2.5 Pro (1M tokens)
    - claude-sonnet-4-5: Anthropic Claude Sonnet 4.5 (1M tokens)
    - claude-sonnet-4: Anthropic Claude Sonnet 4 (1M tokens)
    - claude-opus-4-1: Anthropic Claude Opus 4.1 (200K tokens)
    - claude-opus-4-5: Anthropic Claude Opus 4.5 (200K tokens)
    - claude-haiku-4-5: Anthropic Claude Haiku 4.5 (200K tokens)
    """

    TOKEN_URL = "https://id.cisco.com/oauth2/default/v1/token"
    CHAT_BASE_URL = "https://chat-ai.cisco.com/openai/deployments"
    API_VERSION = "2025-04-01-preview"

    # Model endpoint mapping (internal model ID -> API endpoint)
    # Maps the model name (after stripping cisco- prefix) to the Circuit API endpoint
    MODEL_ENDPOINTS = {
        # Free tier models
        "gpt-4.1": "gpt-4.1",
        "gpt-4o": "gpt-4o",
        "gpt-4o-mini": "gpt-4o-mini",
        # Premium tier models
        "o4-mini": "o4-mini",
        "o3": "o3",
        "gpt-5": "gpt-5",
        "gpt-5-chat": "gpt-5-chat",
        "gpt-5-mini": "gpt-5-mini",
        "gpt-5-nano": "gpt-5-nano",
        "gpt-4.1-mini": "gpt-4.1-mini",
        "gemini-2.5-flash": "gemini-2.5-flash",
        "gemini-2.5-pro": "gemini-2.5-pro",
        "claude-sonnet-4-5": "claude-sonnet-4-5",
        "claude-sonnet-4": "claude-sonnet-4",
        "claude-opus-4-1": "claude-opus-4-1",
        "claude-opus-4-5": "claude-opus-4-5",
        "claude-haiku-4-5": "claude-haiku-4-5",
    }

    def _get_api_model_name(self) -> str:
        """Convert internal model ID to API model name (strip cisco- prefix)."""
        if self.model.startswith("cisco-"):
            return self.model[6:]  # Remove "cisco-" prefix
        return self.model

    def _get_chat_url(self) -> str:
        """Get the chat URL for the configured model."""
        api_model = self._get_api_model_name()
        endpoint = self.MODEL_ENDPOINTS.get(api_model, "gpt-4.1")
        return f"{self.CHAT_BASE_URL}/{endpoint}/chat/completions?api-version={self.API_VERSION}"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        app_key: str,
        model: str = "gpt-4.1",
        temperature: float = 0.7,
        max_tokens: int = 4096
    ):
        """Initialize Cisco Circuit AI service.

        Args:
            client_id: Cisco OAuth Client ID
            client_secret: Cisco OAuth Client Secret
            app_key: Cisco Circuit App Key
            model: Model ID (defaults to gpt-4.1)
            temperature: Temperature for response generation
            max_tokens: Maximum tokens for response
        """
        # Don't call super().__init__ with api_key since we use OAuth
        self.client_id = client_id
        self.client_secret = client_secret
        self.app_key = app_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.security_service = SecurityConfigService()

        # Token caching
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0

    async def _get_access_token(self) -> str:
        """Fetch OAuth token with client credentials, with caching.

        Returns:
            Access token string

        Raises:
            Exception: If token request fails
        """
        # Return cached token if still valid (with 5 min buffer)
        if self._access_token and time.time() < (self._token_expiry - 300):
            return self._access_token

        # Build Basic auth header
        credentials = f"{self.client_id}:{self.client_secret}"
        basic_auth = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                self.TOKEN_URL,
                headers={
                    "Authorization": f"Basic {basic_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data="grant_type=client_credentials",
                timeout=30.0
            )

            if response.status_code != 200:
                logger.error(f"Cisco token request failed: {response.status_code} - {response.text}")
                raise Exception(f"Failed to get Cisco access token: {response.status_code}")

            token_data = response.json()
            self._access_token = token_data["access_token"]
            # expires_in is in seconds
            self._token_expiry = time.time() + token_data.get("expires_in", 3600)

            logger.info("Successfully obtained Cisco Circuit access token")
            return self._access_token

    def generate_simple_response(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate a simple response without tools (sync version for reports, summaries, etc.).

        Note: This is a sync wrapper for compatibility with the base class.
        """
        import asyncio
        return asyncio.get_event_loop().run_until_complete(
            self._async_simple_response(prompt, max_tokens)
        )

    async def _async_simple_response(self, prompt: str, max_tokens: int = 2000) -> str:
        """Async implementation of simple response."""
        access_token = await self._get_access_token()
        chat_url = self._get_chat_url()

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                chat_url,
                headers={
                    "Content-Type": "application/json",
                    "api-key": access_token,
                },
                json={
                    "messages": [{"role": "user", "content": prompt}],
                    "user": json.dumps({"appkey": self.app_key}),
                    "temperature": self.temperature,
                    "max_tokens": max_tokens,
                    # Note: Removed stop token as it may interfere with tool calling
                },
                timeout=120.0
            )

            if response.status_code != 200:
                logger.error(f"Cisco Circuit API error: {response.status_code} - {response.text}")
                return f"Error: Cisco Circuit API returned {response.status_code}"

            data = response.json()

            # Log cost to database for telemetry
            try:
                usage = data.get("usage", {})
                input_tokens = usage.get("prompt_tokens", 0)
                output_tokens = usage.get("completion_tokens", 0)
                if input_tokens > 0 or output_tokens > 0:
                    from src.services.cost_logger import get_cost_logger
                    cost_logger = get_cost_logger()
                    await cost_logger.log_ai_operation(
                        operation_type="cisco_circuit_simple",
                        model=self.model,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                    )
            except Exception as cost_error:
                logger.warning(f"Failed to log Cisco Circuit cost: {cost_error}")

            return data["choices"][0]["message"]["content"] or ""

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
        """Chat using Cisco Circuit GPT-4 API.

        Args:
            message: User message
            credentials: API credentials dict
            org_id: Organization ID
            org_name: Organization name
            organization_name: Full organization name
            conversation_history: Previous conversation messages

        Returns:
            Dict with response, tools_used, token counts, etc.
        """
        # Import the Claude assistant to reuse its tools and execution logic
        from src.services.claude_service import ClaudeNetworkAssistant

        # Create a temporary Claude assistant just to get tools and execute them
        settings = get_settings()
        anthropic_key = (
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key or
            "dummy"
        )
        tool_executor = ClaudeNetworkAssistant(
            api_key=anthropic_key,
            model="claude-3-5-haiku-20241022"
        )

        anthropic_tools = tool_executor._get_all_tools()
        openai_tools = self._convert_tools_to_openai_format(anthropic_tools)

        edit_mode_enabled = await self.security_service.is_edit_mode_enabled(use_cache=True)
        base_system_prompt = self._get_system_prompt(org_name, org_id, edit_mode_enabled)

        # Enhance system prompt with ReAct instructions for tool usage
        # This allows the model to use structured text output for tool calls
        # even if the API doesn't return native tool_calls
        tool_definitions = format_tools_for_react(anthropic_tools)
        react_instructions = REACT_TOOL_PROMPT.format(tool_definitions=tool_definitions)
        system_prompt = react_instructions + "\n\n" + base_system_prompt

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
            # Get access token and chat URL
            access_token = await self._get_access_token()
            chat_url = self._get_chat_url()
            logger.info(f"Using Cisco Circuit model {self.model} at {chat_url}")

            tools_used = []
            tool_data_results = []
            total_input_tokens = 0
            total_output_tokens = 0

            async with httpx.AsyncClient(verify=False) as client:
                # Initial response
                response = await client.post(
                    chat_url,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": access_token,
                    },
                    json={
                        "messages": messages,
                        "user": json.dumps({"appkey": self.app_key}),
                        "tools": openai_tools,
                        "tool_choice": "auto",
                        "temperature": self.temperature,
                        "max_tokens": self.max_tokens,
                        # Note: Removed stop token as it may interfere with tool calling
                    },
                    timeout=120.0
                )

                if response.status_code != 200:
                    logger.error(f"Cisco Circuit API error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "response": f"Cisco Circuit API error: {response.status_code}",
                        "tools_used": [],
                        "error": response.text
                    }

                data = response.json()

                # Track tokens
                if "usage" in data:
                    total_input_tokens += data["usage"].get("prompt_tokens", 0)
                    total_output_tokens += data["usage"].get("completion_tokens", 0)

                # Main tool execution loop - handles both native tool_calls and ReAct patterns
                max_iterations = 10
                iteration = 0

                while iteration < max_iterations:
                    iteration += 1
                    message_content = data["choices"][0]["message"]
                    tool_calls_in_response = message_content.get("tool_calls")
                    text_content = message_content.get("content", "") or ""

                    # Diagnostic logging
                    logger.info(f"[Cisco Circuit] Iteration {iteration}, finish_reason: {data['choices'][0].get('finish_reason')}")
                    logger.info(f"[Cisco Circuit] Has native tool_calls: {bool(tool_calls_in_response)}")

                    # OPTION 1: Native tool_calls from API
                    if tool_calls_in_response:
                        logger.info(f"[Cisco Circuit] Native tool calls: {[tc['function']['name'] for tc in tool_calls_in_response]}")

                        # Add assistant message with tool calls
                        messages.append(message_content)

                        # Execute each tool
                        for tool_call in tool_calls_in_response:
                            tool_name = tool_call["function"]["name"]
                            tool_input = json.loads(tool_call["function"]["arguments"])

                            tools_used.append(tool_name)
                            logger.info(f"[Cisco Circuit] Executing native tool: {tool_name}")

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

                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "content": json.dumps(result)
                            })

                    # OPTION 2: ReAct pattern fallback (model outputs text with Action/Action Input)
                    else:
                        logger.info(f"[Cisco Circuit] No native tool_calls, checking for ReAct pattern...")
                        logger.info(f"[Cisco Circuit] Response preview: {text_content[:300]}")

                        parsed = parse_react_response(text_content)

                        # Check for Final Answer (done)
                        if parsed["final_answer"]:
                            logger.info(f"[Cisco Circuit ReAct] Found Final Answer, completing")
                            # Use the final answer as the response
                            data["choices"][0]["message"]["content"] = parsed["final_answer"]
                            break

                        # Check for Action (tool call via ReAct)
                        if parsed["has_action"]:
                            tool_name = parsed["action"]
                            tool_input = parsed["action_input"] or {}

                            logger.info(f"[Cisco Circuit ReAct] Executing tool: {tool_name} with input: {tool_input}")
                            tools_used.append(tool_name)

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

                            # Add assistant message and observation
                            messages.append({"role": "assistant", "content": text_content})
                            observation = f"Observation: {json.dumps(result, indent=2)}"
                            messages.append({"role": "user", "content": observation})
                            logger.info(f"[Cisco Circuit ReAct] Added observation, continuing loop")
                        else:
                            # No tool call pattern found - this is the final response
                            logger.info(f"[Cisco Circuit] No ReAct pattern found, using text as final response")
                            break

                    # Get next response for continuing the loop
                    response = await client.post(
                        chat_url,
                        headers={
                            "Content-Type": "application/json",
                            "api-key": access_token,
                        },
                        json={
                            "messages": messages,
                            "user": json.dumps({"appkey": self.app_key}),
                            "tools": openai_tools,
                            "tool_choice": "auto",
                            "temperature": self.temperature,
                            "max_tokens": self.max_tokens,
                        },
                        timeout=120.0
                    )

                    if response.status_code != 200:
                        logger.error(f"Cisco Circuit API error on continuation: {response.status_code}")
                        break

                    data = response.json()

                    if "usage" in data:
                        total_input_tokens += data["usage"].get("prompt_tokens", 0)
                        total_output_tokens += data["usage"].get("completion_tokens", 0)

            # Extract final response
            assistant_response = data["choices"][0]["message"].get("content", "") or ""

            # Clean up ReAct artifacts from final response if present
            if "Final Answer:" in assistant_response:
                # Extract just the final answer part
                final_match = re.search(r'Final Answer:\s*(.+)', assistant_response, re.DOTALL | re.IGNORECASE)
                if final_match:
                    assistant_response = final_match.group(1).strip()

            # Calculate costs (Cisco internal = $0)
            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (total_input_tokens / 1000 * cost_input) + (total_output_tokens / 1000 * cost_output)

            # Log cost
            await self._log_cost(total_input_tokens, total_output_tokens, cost_usd)

            return {
                "success": True,
                "response": assistant_response,
                "tools_used": tools_used,
                "stop_reason": data["choices"][0].get("finish_reason", "stop"),
                "tool_data": tool_data_results or None,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "cost_usd": round(cost_usd, 6),
            }

        except Exception as e:
            logger.exception(f"Cisco Circuit AI error: {e}")
            return {
                "success": False,
                "response": f"Cisco Circuit API error: {str(e)}",
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
            logger.warning(f"Failed to log AI cost: {e}")

    async def chat_multi_org(
        self,
        message: str,
        organizations: List[Dict[str, Any]],
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Chat using Cisco Circuit GPT-4 API with access to multiple organizations.

        Args:
            message: User message
            organizations: List of organization configs with type, name, credentials, etc.
            conversation_history: Previous conversation messages

        Returns:
            Dict with response, tools_used, token counts, etc.
        """
        # Import the Claude assistant to reuse its tools and execution logic
        from src.services.claude_service import ClaudeNetworkAssistant

        settings = get_settings()
        anthropic_key = (
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key or
            "dummy"
        )
        tool_executor = ClaudeNetworkAssistant(
            api_key=anthropic_key,
            model="claude-3-5-haiku-20241022"
        )

        anthropic_tools = tool_executor._get_all_tools()
        openai_tools = self._convert_tools_to_openai_format(anthropic_tools)

        # Store orgs for tool execution
        self._current_organizations = {org["name"]: org for org in organizations}

        # Build organization context
        org_context = "Available Organizations:\n"
        meraki_orgs = []
        thousandeyes_orgs = []

        for org in organizations:
            if org["type"] == "meraki":
                meraki_orgs.append(org)
                org_context += f"- {org['display_name']} (Meraki) - Internal name: {org['name']}\n"
            elif org["type"] == "thousandeyes":
                thousandeyes_orgs.append(org)
                org_context += f"- {org['display_name']} (ThousandEyes) - Internal name: {org['name']}\n"

        logger.info(f"[CISCO_CHAT_MULTI_ORG] Starting chat with {len(meraki_orgs)} Meraki orgs, {len(thousandeyes_orgs)} ThousandEyes orgs")

        edit_mode_enabled = await self.security_service.is_edit_mode_enabled(use_cache=True)
        edit_mode_text = "EDIT MODE ENABLED - you can create, update, and delete resources" if edit_mode_enabled else "READ-ONLY mode - you can only view and report on network status"

        system_prompt = f"""You are an expert network administrator assistant with access to Cisco Meraki, ThousandEyes, Splunk, and Catalyst Center.

{org_context}

System mode: {edit_mode_text}

Capabilities:
- Query multiple organizations simultaneously across Meraki, ThousandEyes, Splunk, and Catalyst Center
- Correlate data between platforms (e.g., Meraki network issues with ThousandEyes tests, Splunk logs with device events)
- Compare metrics across different organizations
- Provide unified insights across your entire network infrastructure

Important:
- Always mention which organization the data comes from
- When users ask about devices in a network by name, use get_devices_in_network_by_name - it finds the network AND lists devices in one call

RESPONSE STYLE - BE CONCISE:
- Keep responses SHORT and focused - aim for 2-4 bullet points maximum
- Lead with the answer, then provide brief supporting details
- Use markdown tables when presenting data - the UI can convert them to visual cards
- Avoid repetition and filler phrases - get straight to insights
- Only expand with details if the user explicitly asks for more information"""

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
            access_token = await self._get_access_token()
            chat_url = self._get_chat_url()
            logger.info(f"[CISCO_CHAT_MULTI_ORG] Using model {self.model} at {chat_url}")

            tools_used = []
            tool_data_results = []
            total_input_tokens = 0
            total_output_tokens = 0

            async with httpx.AsyncClient(verify=False) as client:
                response = await client.post(
                    chat_url,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": access_token,
                    },
                    json={
                        "messages": messages,
                        "user": json.dumps({"appkey": self.app_key}),
                        "tools": openai_tools,
                        "tool_choice": "auto",
                        "temperature": self.temperature,
                        "max_tokens": self.max_tokens,
                        # Note: Removed stop token as it may interfere with tool calling
                    },
                    timeout=120.0
                )

                if response.status_code != 200:
                    logger.error(f"Cisco Circuit API error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "response": f"Cisco Circuit API error: {response.status_code}",
                        "tools_used": [],
                        "error": response.text
                    }

                data = response.json()

                if "usage" in data:
                    total_input_tokens += data["usage"].get("prompt_tokens", 0)
                    total_output_tokens += data["usage"].get("completion_tokens", 0)

                # Handle tool calls in a loop
                while data["choices"][0]["message"].get("tool_calls"):
                    tool_calls = data["choices"][0]["message"]["tool_calls"]
                    messages.append(data["choices"][0]["message"])

                    for tool_call in tool_calls:
                        tool_name = tool_call["function"]["name"]
                        tool_input = json.loads(tool_call["function"]["arguments"])
                        tools_used.append(tool_name)

                        logger.info(f"[CISCO_CHAT_MULTI_ORG] Processing tool: {tool_name}")

                        # Execute tool across relevant organizations
                        if tool_name.startswith("get_thousandeyes_"):
                            combined_results = []
                            for org in thousandeyes_orgs:
                                result = await tool_executor._execute_tool(
                                    tool_name, tool_input, org["credentials"],
                                    org.get("org_id", org["name"]), org["name"]
                                )
                                if result.get("success"):
                                    result["organization"] = org["display_name"]
                                    combined_results.append(result)
                            if combined_results:
                                tool_data_results.append({"tool": tool_name, "data": {"results": combined_results}})
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "content": json.dumps({"results": combined_results})
                            })
                        else:
                            combined_results = []
                            for org in meraki_orgs:
                                result = await tool_executor._execute_tool(
                                    tool_name, tool_input, org["credentials"],
                                    org.get("org_id", org["name"]), org["name"]
                                )
                                if result.get("success"):
                                    result["organization"] = org["display_name"]
                                    combined_results.append(result)
                            if combined_results:
                                tool_data_results.append({"tool": tool_name, "data": {"results": combined_results}})
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "content": json.dumps({"results": combined_results})
                            })

                    # Get next response
                    response = await client.post(
                        chat_url,
                        headers={
                            "Content-Type": "application/json",
                            "api-key": access_token,
                        },
                        json={
                            "messages": messages,
                            "user": json.dumps({"appkey": self.app_key}),
                            "tools": openai_tools,
                            "tool_choice": "auto",
                            "temperature": self.temperature,
                            "max_tokens": self.max_tokens,
                            # Note: Removed stop token as it may interfere with tool calling
                        },
                        timeout=120.0
                    )

                    if response.status_code != 200:
                        logger.error(f"Cisco Circuit API error on tool response: {response.status_code}")
                        break

                    data = response.json()

                    if "usage" in data:
                        total_input_tokens += data["usage"].get("prompt_tokens", 0)
                        total_output_tokens += data["usage"].get("completion_tokens", 0)

            assistant_response = data["choices"][0]["message"].get("content", "") or ""

            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (total_input_tokens / 1000 * cost_input) + (total_output_tokens / 1000 * cost_output)

            await self._log_cost(total_input_tokens, total_output_tokens, cost_usd)

            return {
                "success": True,
                "response": assistant_response,
                "tools_used": tools_used,
                "stop_reason": data["choices"][0].get("finish_reason", "stop"),
                "tool_data": tool_data_results or None,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "cost_usd": round(cost_usd, 6),
                "disclaimer": "AI-generated suggestion — human review required before action"
            }

        except Exception as e:
            logger.exception(f"Cisco Circuit AI multi-org error: {e}")
            return {
                "success": False,
                "response": f"Cisco Circuit API error: {str(e)}",
                "tools_used": [],
                "error": str(e)
            }
