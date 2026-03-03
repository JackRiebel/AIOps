"""
Google Gemini provider implementation.

This module provides the Google Gemini integration with support for
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


class GoogleProvider(BaseProvider):
    """Google Gemini provider implementation."""

    provider_type = ProviderType.GOOGLE

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-pro",
        **kwargs
    ):
        super().__init__(api_key, model, **kwargs)
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.genai = genai
        self._model = None

    def _get_model(self, tools: Optional[List] = None):
        """Get or create the generative model."""
        model_config = {
            "temperature": self.temperature,
            "max_output_tokens": self.max_tokens,
        }

        if tools:
            return self.genai.GenerativeModel(
                model_name=self.model,
                generation_config=model_config,
                tools=tools,
            )
        return self.genai.GenerativeModel(
            model_name=self.model,
            generation_config=model_config,
        )

    def convert_tools(self, unified_tools: List[Dict]) -> List[Dict]:
        """Convert Anthropic-style tools to Google format."""
        google_tools = []
        for tool in unified_tools:
            google_tool = {
                "name": tool.get("name"),
                "description": tool.get("description", ""),
                "parameters": self._convert_schema(tool.get("input_schema", {})),
            }
            google_tools.append(google_tool)
        return google_tools

    def _convert_schema(self, schema: Dict) -> Dict:
        """Convert JSON Schema to Google function declaration format."""
        if not schema:
            return {"type": "OBJECT", "properties": {}}

        result = {}

        # Map JSON Schema types to Google types
        type_mapping = {
            "string": "STRING",
            "number": "NUMBER",
            "integer": "INTEGER",
            "boolean": "BOOLEAN",
            "array": "ARRAY",
            "object": "OBJECT",
        }

        schema_type = schema.get("type", "object")
        result["type"] = type_mapping.get(schema_type, "STRING")

        if schema_type == "object" and "properties" in schema:
            result["properties"] = {}
            for prop_name, prop_schema in schema.get("properties", {}).items():
                result["properties"][prop_name] = self._convert_schema(prop_schema)

            if "required" in schema:
                result["required"] = schema["required"]

        if schema_type == "array" and "items" in schema:
            result["items"] = self._convert_schema(schema["items"])

        if "description" in schema:
            result["description"] = schema["description"]

        if "enum" in schema:
            result["enum"] = schema["enum"]

        return result

    def _convert_messages(self, messages: List[Dict], system_prompt: Optional[str] = None) -> List[Dict]:
        """Convert messages to Google format."""
        google_messages = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # Google uses "user" and "model" roles
            google_role = "model" if role == "assistant" else "user"

            # Handle content that might be a list (tool results)
            if isinstance(content, list):
                parts = []
                for item in content:
                    if isinstance(item, dict):
                        if item.get("type") == "text":
                            parts.append({"text": item.get("text", "")})
                        elif item.get("type") == "tool_result":
                            parts.append({
                                "function_response": {
                                    "name": item.get("tool_name", "unknown"),
                                    "response": {"content": item.get("content", "")},
                                }
                            })
                    else:
                        parts.append({"text": str(item)})
                google_messages.append({"role": google_role, "parts": parts})
            else:
                google_messages.append({
                    "role": google_role,
                    "parts": [{"text": content}]
                })

        return google_messages

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

            # Get model with tools
            model = self._get_model(
                tools=[{"function_declarations": converted_tools}] if converted_tools else None
            )

            # Convert messages
            google_messages = self._convert_messages(messages, system_prompt)

            # Start chat
            chat = model.start_chat(history=google_messages[:-1] if len(google_messages) > 1 else [])

            # Send last message
            last_message = google_messages[-1] if google_messages else {"parts": [{"text": ""}]}
            message_content = last_message.get("parts", [{"text": ""}])[0].get("text", "")

            response = await self._retry_with_backoff(
                chat.send_message_async,
                message_content
            )

            # Track usage
            if response.usage_metadata:
                total_input_tokens = response.usage_metadata.prompt_token_count
                total_output_tokens = response.usage_metadata.candidates_token_count

            # Handle tool calls
            while tool_executor and response.candidates:
                candidate = response.candidates[0]
                has_function_calls = False

                for part in candidate.content.parts:
                    if hasattr(part, "function_call") and part.function_call:
                        has_function_calls = True
                        func_call = part.function_call
                        tools_used.append(func_call.name)

                        # Convert args to dict
                        try:
                            tool_input = dict(func_call.args) if func_call.args else {}
                        except Exception:
                            tool_input = {}

                        # Execute tool
                        start_time = time.time()
                        result = await tool_executor.execute(func_call.name, tool_input)
                        execution_time = int((time.time() - start_time) * 1000)

                        tool_result = ToolResult(
                            call_id=func_call.name,  # Google doesn't have call IDs
                            name=func_call.name,
                            result=result.get("data") if isinstance(result, dict) else result,
                            success=result.get("success", False) if isinstance(result, dict) else True,
                            error=result.get("error") if isinstance(result, dict) else None,
                            execution_time_ms=execution_time
                        )
                        tool_results.append(tool_result)

                        # Send function response
                        from google.generativeai.types import content_types
                        response = await self._retry_with_backoff(
                            chat.send_message_async,
                            content_types.to_content({
                                "parts": [{
                                    "function_response": {
                                        "name": func_call.name,
                                        "response": {"result": json.dumps({
                                            "success": tool_result.success,
                                            "data": tool_result.result,
                                            "error": tool_result.error,
                                        })}
                                    }
                                }]
                            })
                        )

                        if response.usage_metadata:
                            total_input_tokens += response.usage_metadata.prompt_token_count
                            total_output_tokens += response.usage_metadata.candidates_token_count

                if not has_function_calls:
                    break

            # Extract text content
            content = ""
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "text"):
                        content += part.text

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
                stop_reason="stop",
                provider=self.provider_type,
                model=self.model,
                cost_usd=self._calculate_cost(usage),
            )

        except Exception as e:
            logger.exception(f"Google chat error: {e}")
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

            # Get model with tools
            model = self._get_model(
                tools=[{"function_declarations": converted_tools}] if converted_tools else None
            )

            # Convert messages
            google_messages = self._convert_messages(messages, system_prompt)

            # Start chat
            chat = model.start_chat(history=google_messages[:-1] if len(google_messages) > 1 else [])

            # Send last message with streaming
            last_message = google_messages[-1] if google_messages else {"parts": [{"text": ""}]}
            message_content = last_message.get("parts", [{"text": ""}])[0].get("text", "")

            response = await chat.send_message_async(
                message_content,
                stream=True
            )

            async for chunk in response:
                # Handle text chunks
                if chunk.text:
                    sequence += 1
                    yield StreamEvent(
                        type="text_delta",
                        data={"text": chunk.text},
                        sequence=sequence,
                    )

                # Handle function calls in final chunk
                if chunk.candidates:
                    for part in chunk.candidates[0].content.parts:
                        if hasattr(part, "function_call") and part.function_call and tool_executor:
                            func_call = part.function_call
                            tools_used.append(func_call.name)

                            sequence += 1
                            yield StreamEvent(
                                type="tool_use_start",
                                data={
                                    "id": func_call.name,
                                    "tool": func_call.name,
                                },
                                sequence=sequence,
                            )

                            try:
                                tool_input = dict(func_call.args) if func_call.args else {}
                            except Exception:
                                tool_input = {}

                            # Execute tool
                            start_time = time.time()
                            result = await tool_executor.execute(func_call.name, tool_input)
                            execution_time = int((time.time() - start_time) * 1000)

                            tool_result = ToolResult(
                                call_id=func_call.name,
                                name=func_call.name,
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
                                    "id": func_call.name,
                                    "tool": func_call.name,
                                    "result": tool_result.result,
                                    "success": tool_result.success,
                                    "error": tool_result.error,
                                    "execution_time_ms": execution_time,
                                },
                                sequence=sequence,
                            )

            # Get final usage if available
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                total_input_tokens = response.usage_metadata.prompt_token_count
                total_output_tokens = response.usage_metadata.candidates_token_count

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
            logger.exception(f"Google streaming error: {e}")
            sequence += 1
            yield StreamEvent(
                type="error",
                data={"error": str(e)},
                sequence=sequence,
            )
