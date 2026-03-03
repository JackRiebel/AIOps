"""
Anthropic Claude provider implementation.

This module provides the Anthropic Claude integration with support for
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
    ToolCall,
    ToolResult,
    StreamEvent,
    ChatResponse,
)

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseProvider):
    """Anthropic Claude provider implementation."""

    provider_type = ProviderType.ANTHROPIC

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-5-20250929",
        **kwargs
    ):
        super().__init__(api_key, model, **kwargs)
        import anthropic
        import httpx
        from src.config.settings import get_settings
        from src.services.config_service import get_config_or_env
        settings = get_settings()
        # Check database first (admin UI saves here), then fall back to settings/env
        db_verify = get_config_or_env("anthropic_verify_ssl", "ANTHROPIC_VERIFY_SSL")
        if db_verify is not None:
            verify_ssl = db_verify.lower() not in ("false", "0", "no", "disabled")
        else:
            verify_ssl = settings.anthropic_verify_ssl
        http_client = httpx.Client(verify=verify_ssl, timeout=120.0)
        async_http_client = httpx.AsyncClient(verify=verify_ssl, timeout=120.0)
        self.client = anthropic.Anthropic(api_key=api_key, http_client=http_client)
        self.async_client = anthropic.AsyncAnthropic(api_key=api_key, http_client=async_http_client)

    def convert_tools(self, unified_tools: List[Dict]) -> List[Dict]:
        """Anthropic uses native tool format."""
        return unified_tools  # Already in Anthropic format

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

            # Build request kwargs
            request_kwargs = {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "messages": messages,
            }
            if system_prompt:
                request_kwargs["system"] = system_prompt
            if converted_tools:
                request_kwargs["tools"] = converted_tools

            response = await self._retry_with_backoff(
                self.async_client.messages.create,
                **request_kwargs
            )

            total_input_tokens += response.usage.input_tokens
            total_output_tokens += response.usage.output_tokens

            # Handle tool calls
            while response.stop_reason == "tool_use" and tool_executor:
                tool_use_blocks = [
                    block for block in response.content
                    if block.type == "tool_use"
                ]

                for block in tool_use_blocks:
                    tools_used.append(block.name)

                    # Execute tool
                    start_time = time.time()
                    result = await tool_executor.execute(block.name, block.input)
                    execution_time = int((time.time() - start_time) * 1000)

                    tool_results.append(ToolResult(
                        call_id=block.id,
                        name=block.name,
                        result=result.get("data") if isinstance(result, dict) else result,
                        success=result.get("success", False) if isinstance(result, dict) else True,
                        error=result.get("error") if isinstance(result, dict) else None,
                        execution_time_ms=execution_time
                    ))

                # Add assistant response with tool use to messages
                messages.append({"role": "assistant", "content": response.content})

                # Add tool results to messages
                tool_result_content = []
                for block in tool_use_blocks:
                    matching_result = next(
                        (r for r in tool_results if r.call_id == block.id),
                        None
                    )
                    if matching_result:
                        tool_result_content.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps({
                                "success": matching_result.success,
                                "data": matching_result.result,
                                "error": matching_result.error,
                            })
                        })

                messages.append({"role": "user", "content": tool_result_content})

                # Continue conversation
                request_kwargs["messages"] = messages
                response = await self._retry_with_backoff(
                    self.async_client.messages.create,
                    **request_kwargs
                )

                total_input_tokens += response.usage.input_tokens
                total_output_tokens += response.usage.output_tokens

            # Extract text content
            content = ""
            for block in response.content:
                if hasattr(block, "text"):
                    content += block.text

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
                stop_reason=response.stop_reason,
                provider=self.provider_type,
                model=self.model,
                cost_usd=self._calculate_cost(usage),
            )

        except Exception as e:
            logger.exception(f"Anthropic chat error: {e}")
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
            total_input_tokens = 0
            total_output_tokens = 0

            # Build request kwargs
            request_kwargs = {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "messages": messages,
            }
            if system_prompt:
                request_kwargs["system"] = system_prompt
            if converted_tools:
                request_kwargs["tools"] = converted_tools

            async with self.async_client.messages.stream(**request_kwargs) as stream:
                current_tool_id = None
                current_tool_name = None
                current_tool_input = ""

                async for event in stream:
                    if event.type == "content_block_start":
                        if hasattr(event.content_block, "type"):
                            if event.content_block.type == "tool_use":
                                current_tool_id = event.content_block.id
                                current_tool_name = event.content_block.name
                                current_tool_input = ""
                                sequence += 1
                                yield StreamEvent(
                                    type="tool_use_start",
                                    data={
                                        "id": current_tool_id,
                                        "tool": current_tool_name,
                                    },
                                    sequence=sequence,
                                )

                    elif event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            sequence += 1
                            yield StreamEvent(
                                type="text_delta",
                                data={"text": event.delta.text},
                                sequence=sequence,
                            )
                        elif hasattr(event.delta, "partial_json"):
                            current_tool_input += event.delta.partial_json

                    elif event.type == "content_block_stop":
                        if current_tool_id and current_tool_name and tool_executor:
                            # Parse and execute tool
                            try:
                                tool_input = json.loads(current_tool_input) if current_tool_input else {}
                            except json.JSONDecodeError:
                                tool_input = {}

                            tools_used.append(current_tool_name)

                            # Execute tool
                            start_time = time.time()
                            result = await tool_executor.execute(current_tool_name, tool_input)
                            execution_time = int((time.time() - start_time) * 1000)

                            tool_result = ToolResult(
                                call_id=current_tool_id,
                                name=current_tool_name,
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
                                    "id": current_tool_id,
                                    "tool": current_tool_name,
                                    "result": tool_result.result,
                                    "success": tool_result.success,
                                    "error": tool_result.error,
                                    "execution_time_ms": execution_time,
                                },
                                sequence=sequence,
                            )

                            current_tool_id = None
                            current_tool_name = None
                            current_tool_input = ""

                    elif event.type == "message_delta":
                        if hasattr(event, "usage"):
                            total_output_tokens = event.usage.output_tokens

                    elif event.type == "message_start":
                        if hasattr(event.message, "usage"):
                            total_input_tokens = event.message.usage.input_tokens

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
            logger.exception(f"Anthropic streaming error: {e}")
            sequence += 1
            yield StreamEvent(
                type="error",
                data={"error": str(e)},
                sequence=sequence,
            )
