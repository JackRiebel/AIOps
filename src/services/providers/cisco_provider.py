"""
Cisco Circuit AI provider implementation.

This module provides the Cisco Circuit integration with support for
chat completions, streaming, and tool use via Cisco's internal API.
"""

import base64
import json
import time
import logging
from typing import AsyncIterator, Optional, List, Dict, Any

import httpx

from .base import (
    BaseProvider,
    ProviderType,
    TokenUsage,
    ToolResult,
    StreamEvent,
    ChatResponse,
)

logger = logging.getLogger(__name__)


class CiscoProvider(BaseProvider):
    """Cisco Circuit provider implementation."""

    provider_type = ProviderType.CISCO

    TOKEN_URL = "https://id.cisco.com/oauth2/default/v1/token"
    CHAT_BASE_URL = "https://chat-ai.cisco.com/openai/deployments"
    API_VERSION = "2025-04-01-preview"

    # Model endpoint mapping
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

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        app_key: str,
        model: str = "cisco-gpt-4.1",
        verify_ssl: bool = True,
        **kwargs
    ):
        # Don't call super().__init__ with api_key since we use OAuth
        self.client_id = client_id
        self.client_secret = client_secret
        self.app_key = app_key
        self.model = model
        self.verify_ssl = verify_ssl
        self.temperature = kwargs.get("temperature", 0.7)
        self.max_tokens = kwargs.get("max_tokens", 4096)
        self.timeout = kwargs.get("timeout", 120.0)
        self.max_retries = kwargs.get("max_retries", 3)

        # Token caching
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0

    @property
    def api_key(self) -> str:
        """Return empty string since we use OAuth."""
        return ""

    def _get_api_model_name(self) -> str:
        """Convert internal model ID to API model name."""
        model = self.model
        if model.startswith("cisco-"):
            model = model[6:]  # Remove "cisco-" prefix
        return model

    def _get_chat_url(self) -> str:
        """Get the chat URL for the configured model."""
        api_model = self._get_api_model_name()
        endpoint = self.MODEL_ENDPOINTS.get(api_model, "gpt-4.1")
        return f"{self.CHAT_BASE_URL}/{endpoint}/chat/completions?api-version={self.API_VERSION}"

    async def _get_access_token(self) -> str:
        """Fetch OAuth token with client credentials."""
        # Return cached token if still valid
        if self._access_token and time.time() < (self._token_expiry - 300):
            return self._access_token

        credentials = f"{self.client_id}:{self.client_secret}"
        basic_auth = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient(verify=self.verify_ssl) as client:
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
                raise Exception(f"Failed to get Cisco access token: {response.status_code}")

            token_data = response.json()
            self._access_token = token_data["access_token"]
            self._token_expiry = time.time() + token_data.get("expires_in", 3600)

            return self._access_token

    def convert_tools(self, unified_tools: List[Dict]) -> List[Dict]:
        """Convert Anthropic-style tools to OpenAI format."""
        openai_tools = []
        for tool in unified_tools:
            openai_tool = {
                "type": "function",
                "function": {
                    "name": tool.get("name"),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("input_schema", {}),
                }
            }
            openai_tools.append(openai_tool)
        return openai_tools

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict]] = None,
        tool_executor: Optional[Any] = None,
        system_prompt: Optional[str] = None,
    ) -> ChatResponse:
        """Execute chat with tool loop."""
        try:
            converted_tools = self.convert_tools(tools) if tools else None
            tools_used = []
            tool_results = []
            total_input_tokens = 0
            total_output_tokens = 0

            access_token = await self._get_access_token()
            chat_url = self._get_chat_url()

            # Prepare messages with system prompt
            cisco_messages = []
            if system_prompt:
                cisco_messages.append({"role": "system", "content": system_prompt})

            for msg in messages:
                cisco_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

            async with httpx.AsyncClient(verify=self.verify_ssl) as client:
                request_body = {
                    "messages": cisco_messages,
                    "user": json.dumps({"appkey": self.app_key}),
                    "temperature": self.temperature,
                    "max_tokens": self.max_tokens,
                }
                if converted_tools:
                    request_body["tools"] = converted_tools
                    request_body["tool_choice"] = "auto"

                response = await client.post(
                    chat_url,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": access_token,
                    },
                    json=request_body,
                    timeout=self.timeout
                )

                if response.status_code != 200:
                    return self._create_error_response(
                        f"Cisco Circuit API error: {response.status_code} - {response.text}"
                    )

                data = response.json()

                if "usage" in data:
                    total_input_tokens += data["usage"].get("prompt_tokens", 0)
                    total_output_tokens += data["usage"].get("completion_tokens", 0)

                # Handle tool calls in loop
                max_iterations = 10
                iteration = 0

                while iteration < max_iterations:
                    iteration += 1
                    message_content = data["choices"][0]["message"]
                    tool_calls_in_response = message_content.get("tool_calls")

                    if not tool_calls_in_response or not tool_executor:
                        break

                    # Add assistant message with tool calls
                    cisco_messages.append(message_content)

                    # Execute each tool
                    for tool_call in tool_calls_in_response:
                        tool_name = tool_call["function"]["name"]
                        tools_used.append(tool_name)

                        try:
                            tool_input = json.loads(tool_call["function"]["arguments"])
                        except json.JSONDecodeError:
                            tool_input = {}

                        # Execute tool
                        start_time = time.time()
                        result = await tool_executor.execute(tool_name, tool_input)
                        execution_time = int((time.time() - start_time) * 1000)

                        # For canvas/followup tools, preserve the full result dict (contains card_suggestion)
                        # For other tools, extract just the data key for cleaner responses
                        if isinstance(result, dict):
                            if tool_name.startswith("canvas_") or tool_name == "suggest_followups":
                                # Canvas/followup tools need full result to emit card_suggestion/followups
                                tool_result_data = result
                                logger.info(f"[Cisco] Canvas/followup tool '{tool_name}' result keys: {list(result.keys())}")
                            else:
                                tool_result_data = result.get("data")
                        else:
                            tool_result_data = result

                        tool_result = ToolResult(
                            call_id=tool_call["id"],
                            name=tool_name,
                            result=tool_result_data,
                            success=result.get("success", False) if isinstance(result, dict) else True,
                            error=result.get("error") if isinstance(result, dict) else None,
                            execution_time_ms=execution_time
                        )
                        tool_results.append(tool_result)

                        # Add tool result
                        cisco_messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": json.dumps({
                                "success": tool_result.success,
                                "data": tool_result.result,
                                "error": tool_result.error,
                            })
                        })

                    # Get next response
                    request_body["messages"] = cisco_messages
                    response = await client.post(
                        chat_url,
                        headers={
                            "Content-Type": "application/json",
                            "api-key": access_token,
                        },
                        json=request_body,
                        timeout=self.timeout
                    )

                    if response.status_code != 200:
                        break

                    data = response.json()

                    if "usage" in data:
                        total_input_tokens += data["usage"].get("prompt_tokens", 0)
                        total_output_tokens += data["usage"].get("completion_tokens", 0)

            # Extract content
            content = data["choices"][0]["message"].get("content", "") or ""

            usage = TokenUsage(
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
                total_tokens=total_input_tokens + total_output_tokens
            )

            return ChatResponse(
                success=True,
                content=content,
                tools_used=tools_used,
                tool_results=tool_results,
                usage=usage,
                stop_reason=data["choices"][0].get("finish_reason", "stop"),
                provider=self.provider_type,
                model=self.model,
                cost_usd=self._calculate_cost(usage),
            )

        except Exception as e:
            logger.exception(f"Cisco Circuit chat error: {e}")
            return self._create_error_response(str(e))

    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict]] = None,
        tool_executor: Optional[Any] = None,
        system_prompt: Optional[str] = None,
    ) -> AsyncIterator[StreamEvent]:
        """Stream chat with tool support."""
        sequence = 0

        try:
            converted_tools = self.convert_tools(tools) if tools else None
            tools_used = []
            tool_results_list = []

            access_token = await self._get_access_token()
            chat_url = self._get_chat_url()

            # Prepare messages
            cisco_messages = []
            if system_prompt:
                cisco_messages.append({"role": "system", "content": system_prompt})

            for msg in messages:
                cisco_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

            async with httpx.AsyncClient(verify=self.verify_ssl) as client:
                request_body = {
                    "messages": cisco_messages,
                    "user": json.dumps({"appkey": self.app_key}),
                    "temperature": self.temperature,
                    "max_tokens": self.max_tokens,
                    "stream": True,
                }
                if converted_tools:
                    request_body["tools"] = converted_tools
                    request_body["tool_choice"] = "auto"

                async with client.stream(
                    "POST",
                    chat_url,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": access_token,
                    },
                    json=request_body,
                    timeout=self.timeout
                ) as response:
                    if response.status_code != 200:
                        sequence += 1
                        yield StreamEvent(
                            type="error",
                            data={"error": f"API error: {response.status_code}"},
                            sequence=sequence,
                        )
                        return

                    current_tool_calls: Dict[int, Dict] = {}
                    total_input_tokens = 0
                    total_output_tokens = 0

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue

                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        if not chunk.get("choices"):
                            continue

                        delta = chunk["choices"][0].get("delta", {})

                        # Handle text content
                        if delta.get("content"):
                            sequence += 1
                            yield StreamEvent(
                                type="text_delta",
                                data={"text": delta["content"]},
                                sequence=sequence,
                            )

                        # Handle tool calls
                        if delta.get("tool_calls"):
                            for tool_call_delta in delta["tool_calls"]:
                                idx = tool_call_delta.get("index", 0)

                                if idx not in current_tool_calls:
                                    current_tool_calls[idx] = {
                                        "id": tool_call_delta.get("id", ""),
                                        "name": "",
                                        "arguments": "",
                                    }

                                if tool_call_delta.get("id"):
                                    current_tool_calls[idx]["id"] = tool_call_delta["id"]

                                if tool_call_delta.get("function"):
                                    func = tool_call_delta["function"]
                                    if func.get("name"):
                                        current_tool_calls[idx]["name"] = func["name"]
                                        sequence += 1
                                        yield StreamEvent(
                                            type="tool_use_start",
                                            data={
                                                "id": current_tool_calls[idx]["id"],
                                                "tool": func["name"],
                                            },
                                            sequence=sequence,
                                        )
                                    if func.get("arguments"):
                                        current_tool_calls[idx]["arguments"] += func["arguments"]

                        # Handle finish
                        finish_reason = chunk["choices"][0].get("finish_reason")
                        if finish_reason == "tool_calls" and tool_executor:
                            # Execute collected tool calls
                            for idx, tc in current_tool_calls.items():
                                if tc["name"]:
                                    tools_used.append(tc["name"])

                                    try:
                                        tool_input = json.loads(tc["arguments"]) if tc["arguments"] else {}
                                    except json.JSONDecodeError:
                                        tool_input = {}

                                    start_time = time.time()
                                    result = await tool_executor.execute(tc["name"], tool_input)
                                    execution_time = int((time.time() - start_time) * 1000)

                                    # For canvas/followup tools, preserve the full result dict (contains card_suggestion/followups)
                                    # For other tools, extract just the data key for cleaner responses
                                    if isinstance(result, dict):
                                        if tc["name"].startswith("canvas_") or tc["name"] == "suggest_followups":
                                            # Canvas/followup tools need full result to emit card_suggestion/followups
                                            tool_result_data = result
                                            logger.info(f"[Cisco][Stream] Canvas/followup tool '{tc['name']}' result keys: {list(result.keys())}")
                                        else:
                                            tool_result_data = result.get("data")
                                    else:
                                        tool_result_data = result

                                    tool_result = ToolResult(
                                        call_id=tc["id"],
                                        name=tc["name"],
                                        result=tool_result_data,
                                        success=result.get("success", False) if isinstance(result, dict) else True,
                                        error=result.get("error") if isinstance(result, dict) else None,
                                        execution_time_ms=execution_time
                                    )
                                    tool_results_list.append(tool_result)

                                    sequence += 1
                                    yield StreamEvent(
                                        type="tool_result",
                                        data={
                                            "id": tc["id"],
                                            "tool": tc["name"],
                                            "result": tool_result.result,
                                            "success": tool_result.success,
                                            "error": tool_result.error,
                                            "execution_time_ms": execution_time,
                                        },
                                        sequence=sequence,
                                    )

            # Final done event
            sequence += 1
            yield StreamEvent(
                type="done",
                data={
                    "usage": {
                        "input_tokens": total_input_tokens,
                        "output_tokens": total_output_tokens,
                        "total_tokens": total_input_tokens + total_output_tokens,
                    },
                    "tools_used": tools_used,
                    "tool_data": [
                        {
                            "call_id": r.call_id,
                            "name": r.name,
                            "success": r.success,
                            "execution_time_ms": r.execution_time_ms,
                        }
                        for r in tool_results_list
                    ],
                },
                sequence=sequence,
            )

        except Exception as e:
            logger.exception(f"Cisco Circuit streaming error: {e}")
            sequence += 1
            yield StreamEvent(
                type="error",
                data={"error": str(e)},
                sequence=sequence,
            )
