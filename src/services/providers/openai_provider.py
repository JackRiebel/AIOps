"""
OpenAI GPT provider implementation.

This module provides the OpenAI integration with support for
chat completions, streaming, and tool use.
"""

import json
import time
import logging
from typing import AsyncIterator, Optional, List, Dict, Any

from .base import (
    BaseProvider,
    ProviderType,
    TokenUsage,
    ToolResult,
    StreamEvent,
    ChatResponse,
)

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseProvider):
    """OpenAI GPT provider implementation."""

    provider_type = ProviderType.OPENAI

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o",
        **kwargs
    ):
        super().__init__(api_key, model, **kwargs)
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key)

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

            # Prepare messages with system prompt
            openai_messages = []
            if system_prompt:
                openai_messages.append({"role": "system", "content": system_prompt})

            # Convert messages to OpenAI format
            for msg in messages:
                openai_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

            # Build request kwargs
            request_kwargs = {
                "model": self.model,
                "messages": openai_messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
            if converted_tools:
                request_kwargs["tools"] = converted_tools

            response = await self._retry_with_backoff(
                self.client.chat.completions.create,
                **request_kwargs
            )

            if response.usage:
                total_input_tokens += response.usage.prompt_tokens
                total_output_tokens += response.usage.completion_tokens

            # Handle tool calls
            while response.choices[0].finish_reason == "tool_calls" and tool_executor:
                tool_calls = response.choices[0].message.tool_calls or []

                # Add assistant message with tool calls
                openai_messages.append({
                    "role": "assistant",
                    "content": response.choices[0].message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            }
                        }
                        for tc in tool_calls
                    ]
                })

                # Execute each tool call
                for tool_call in tool_calls:
                    tools_used.append(tool_call.function.name)

                    try:
                        tool_input = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError:
                        tool_input = {}

                    # Execute tool
                    start_time = time.time()
                    result = await tool_executor.execute(tool_call.function.name, tool_input)
                    execution_time = int((time.time() - start_time) * 1000)

                    tool_result = ToolResult(
                        call_id=tool_call.id,
                        name=tool_call.function.name,
                        result=result.get("data") if isinstance(result, dict) else result,
                        success=result.get("success", False) if isinstance(result, dict) else True,
                        error=result.get("error") if isinstance(result, dict) else None,
                        execution_time_ms=execution_time
                    )
                    tool_results.append(tool_result)

                    # Add tool result to messages
                    openai_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps({
                            "success": tool_result.success,
                            "data": tool_result.result,
                            "error": tool_result.error,
                        })
                    })

                # Continue conversation
                request_kwargs["messages"] = openai_messages
                response = await self._retry_with_backoff(
                    self.client.chat.completions.create,
                    **request_kwargs
                )

                if response.usage:
                    total_input_tokens += response.usage.prompt_tokens
                    total_output_tokens += response.usage.completion_tokens

            # Extract content
            content = response.choices[0].message.content or ""

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
                stop_reason=response.choices[0].finish_reason or "stop",
                provider=self.provider_type,
                model=self.model,
                cost_usd=self._calculate_cost(usage),
            )

        except Exception as e:
            logger.exception(f"OpenAI chat error: {e}")
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

            # Prepare messages with system prompt
            openai_messages = []
            if system_prompt:
                openai_messages.append({"role": "system", "content": system_prompt})

            for msg in messages:
                openai_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

            # Build request kwargs
            request_kwargs = {
                "model": self.model,
                "messages": openai_messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
                "stream": True,
                "stream_options": {"include_usage": True},
            }
            if converted_tools:
                request_kwargs["tools"] = converted_tools

            stream = await self.client.chat.completions.create(**request_kwargs)

            current_tool_calls: Dict[int, Dict] = {}
            total_input_tokens = 0
            total_output_tokens = 0

            async for chunk in stream:
                # Handle usage from final chunk
                if chunk.usage:
                    total_input_tokens = chunk.usage.prompt_tokens
                    total_output_tokens = chunk.usage.completion_tokens

                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta

                # Handle text content
                if delta.content:
                    sequence += 1
                    yield StreamEvent(
                        type="text_delta",
                        data={"text": delta.content},
                        sequence=sequence,
                    )

                # Handle tool calls
                if delta.tool_calls:
                    for tool_call_delta in delta.tool_calls:
                        idx = tool_call_delta.index

                        if idx not in current_tool_calls:
                            current_tool_calls[idx] = {
                                "id": tool_call_delta.id or "",
                                "name": "",
                                "arguments": "",
                            }

                        if tool_call_delta.id:
                            current_tool_calls[idx]["id"] = tool_call_delta.id

                        if tool_call_delta.function:
                            if tool_call_delta.function.name:
                                current_tool_calls[idx]["name"] = tool_call_delta.function.name
                                sequence += 1
                                yield StreamEvent(
                                    type="tool_use_start",
                                    data={
                                        "id": current_tool_calls[idx]["id"],
                                        "tool": tool_call_delta.function.name,
                                    },
                                    sequence=sequence,
                                )

                            if tool_call_delta.function.arguments:
                                current_tool_calls[idx]["arguments"] += tool_call_delta.function.arguments

                # Handle finish
                if chunk.choices[0].finish_reason == "tool_calls" and tool_executor:
                    # Execute all collected tool calls
                    for idx, tc in current_tool_calls.items():
                        tools_used.append(tc["name"])

                        try:
                            tool_input = json.loads(tc["arguments"]) if tc["arguments"] else {}
                        except json.JSONDecodeError:
                            tool_input = {}

                        # Execute tool
                        start_time = time.time()
                        result = await tool_executor.execute(tc["name"], tool_input)
                        execution_time = int((time.time() - start_time) * 1000)

                        tool_result = ToolResult(
                            call_id=tc["id"],
                            name=tc["name"],
                            result=result.get("data") if isinstance(result, dict) else result,
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
            logger.exception(f"OpenAI streaming error: {e}")
            sequence += 1
            yield StreamEvent(
                type="error",
                data={"error": str(e)},
                sequence=sequence,
            )
