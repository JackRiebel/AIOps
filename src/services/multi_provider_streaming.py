"""Multi-provider streaming AI service.

Supports streaming responses from multiple AI providers:
- Anthropic (Claude) - Native streaming
- OpenAI (GPT) - Native streaming
- Google (Gemini) - Native streaming
- Cisco Circuit - Simulated streaming (chunked response)
"""

import json
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, List, Optional

from src.config.settings import get_settings
from src.services.ai_service import get_provider_from_model, get_model_costs
from src.services.config_service import get_config_or_env

logger = logging.getLogger(__name__)


class BaseStreamingProvider(ABC):
    """Base class for streaming AI providers."""

    def __init__(self, model: str, temperature: float = 0.7, max_tokens: int = 4096):
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    @abstractmethod
    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_executor: Optional[callable] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream chat response with optional tool use."""
        pass

    def _emit_event(self, event_type: str, **kwargs) -> str:
        """Format SSE event."""
        data = {"type": event_type, **kwargs}
        return f"data: {json.dumps(data)}\n\n"


class AnthropicStreamingProvider(BaseStreamingProvider):
    """Anthropic Claude streaming provider."""

    def __init__(self, api_key: str, model: str, temperature: float = 0.7, max_tokens: int = 4096):
        super().__init__(model, temperature, max_tokens)
        import anthropic
        self.client = anthropic.Anthropic(api_key=api_key)

    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_executor: Optional[callable] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response using Anthropic's native streaming."""
        try:
            # Emit model info
            yield self._emit_event("workflow_info", model={
                "model_id": self.model,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            })

            total_input_tokens = 0
            total_output_tokens = 0
            tools_used = []
            tool_data = []  # Collect tool results for canvas cards
            full_text = ""
            current_messages = list(messages)

            while True:
                stream_kwargs = {
                    "model": self.model,
                    "max_tokens": self.max_tokens,
                    "temperature": self.temperature,
                    "messages": current_messages,
                }

                if system_prompt:
                    stream_kwargs["system"] = system_prompt

                if tools:
                    stream_kwargs["tools"] = tools

                tool_use_blocks = []
                current_text = ""

                with self.client.messages.stream(**stream_kwargs) as stream:
                    for event in stream:
                        if hasattr(event, 'type'):
                            if event.type == 'content_block_start':
                                if hasattr(event.content_block, 'type'):
                                    if event.content_block.type == 'tool_use':
                                        tool_name = event.content_block.name
                                        tools_used.append(tool_name)
                                        yield self._emit_event("tool_use_start", tool=tool_name)

                            elif event.type == 'content_block_delta':
                                if hasattr(event.delta, 'text'):
                                    text = event.delta.text
                                    current_text += text
                                    full_text += text
                                    yield self._emit_event("text_delta", text=text)
                                elif hasattr(event.delta, 'partial_json'):
                                    pass  # Tool input building

                    final_message = stream.get_final_message()
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                    # Check for tool use
                    for block in final_message.content:
                        if hasattr(block, 'type') and block.type == 'tool_use':
                            tool_use_blocks.append({
                                "id": block.id,
                                "name": block.name,
                                "input": block.input,
                            })

                # If no tool calls, we're done
                if not tool_use_blocks:
                    break

                # Execute tools
                if tool_executor:
                    current_messages.append({"role": "assistant", "content": final_message.content})

                    tool_results = []
                    for tool_block in tool_use_blocks:
                        tool_name = tool_block["name"]
                        # Determine agent type based on tool
                        agent_type = "knowledge" if tool_name == "consult_knowledge_agent" else "implementation"

                        # Emit agent activity start for visualization
                        yield self._emit_event("agent_activity_start",
                            agent=agent_type,
                            query=f"Executing {tool_name}"
                        )

                        try:
                            result = await tool_executor(tool_name, tool_block["input"])
                            yield self._emit_event("tool_use_complete", tool=tool_name, success=True)

                            # Emit agent activity complete
                            result_data = result if isinstance(result, dict) else {}
                            yield self._emit_event("agent_activity_complete",
                                agent=agent_type,
                                success=result_data.get("success", True),
                                sources_count=len(result_data.get("data", [])) if isinstance(result_data.get("data"), list) else 0,
                                response_summary=f"Retrieved data from {tool_name}"
                            )

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_block["id"],
                                "content": json.dumps(result) if isinstance(result, dict) else str(result),
                            })
                            # Capture tool data for canvas cards
                            if isinstance(result, dict) and result.get("success"):
                                tool_data.append({
                                    "tool": tool_name,
                                    "data": result.get("data") or result.get("results") or result,
                                })
                        except Exception as e:
                            yield self._emit_event("tool_use_complete", tool=tool_name, success=False)
                            yield self._emit_event("agent_activity_complete",
                                agent=agent_type,
                                success=False,
                                response_summary=f"Error: {str(e)}"
                            )
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_block["id"],
                                "content": f"Error: {str(e)}",
                                "is_error": True,
                            })

                    current_messages.append({"role": "user", "content": tool_results})
                else:
                    break

            # Calculate costs
            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (total_input_tokens / 1000 * cost_input) + (total_output_tokens / 1000 * cost_output)

            yield self._emit_event("done",
                usage={"input_tokens": total_input_tokens, "output_tokens": total_output_tokens},
                tools_used=tools_used,
                tool_data=tool_data if tool_data else None,
                cost_usd=round(cost_usd, 6),
            )

        except Exception as e:
            logger.error(f"[Anthropic Streaming] Error: {e}")
            yield self._emit_event("error", error=str(e))


class OpenAIStreamingProvider(BaseStreamingProvider):
    """OpenAI GPT streaming provider."""

    def __init__(self, api_key: str, model: str, temperature: float = 0.7, max_tokens: int = 4096):
        super().__init__(model, temperature, max_tokens)
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)

    def _convert_tools_to_openai(self, anthropic_tools: List[Dict]) -> List[Dict]:
        """Convert Anthropic tool format to OpenAI format."""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["input_schema"],
                }
            }
            for tool in anthropic_tools
        ]

    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_executor: Optional[callable] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response using OpenAI's streaming API."""
        try:
            yield self._emit_event("workflow_info", model={
                "model_id": self.model,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            })

            # Build OpenAI messages format
            openai_messages = [{"role": "system", "content": system_prompt}] if system_prompt else []
            for msg in messages:
                if msg.get("role") in ["user", "assistant"]:
                    openai_messages.append({"role": msg["role"], "content": msg["content"]})

            openai_tools = self._convert_tools_to_openai(tools) if tools else None
            tools_used = []
            tool_data = []  # Collect tool results for canvas cards
            full_text = ""
            total_input_tokens = 0
            total_output_tokens = 0

            while True:
                stream_kwargs = {
                    "model": self.model,
                    "messages": openai_messages,
                    "temperature": self.temperature,
                    "max_tokens": self.max_tokens,
                    "stream": True,
                    "stream_options": {"include_usage": True},
                }

                if openai_tools:
                    stream_kwargs["tools"] = openai_tools
                    stream_kwargs["tool_choice"] = "auto"

                tool_calls = []
                current_text = ""

                # Run in executor since OpenAI client is sync
                stream = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.client.chat.completions.create(**stream_kwargs)
                )

                for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta

                        # Handle text
                        if delta.content:
                            text = delta.content
                            current_text += text
                            full_text += text
                            yield self._emit_event("text_delta", text=text)

                        # Handle tool calls
                        if delta.tool_calls:
                            for tc in delta.tool_calls:
                                if tc.index >= len(tool_calls):
                                    tool_calls.append({"id": tc.id, "name": "", "arguments": ""})
                                if tc.function.name:
                                    tool_calls[tc.index]["name"] = tc.function.name
                                    tools_used.append(tc.function.name)
                                    yield self._emit_event("tool_use_start", tool=tc.function.name)
                                if tc.function.arguments:
                                    tool_calls[tc.index]["arguments"] += tc.function.arguments

                    # Usage info
                    if chunk.usage:
                        total_input_tokens += chunk.usage.prompt_tokens or 0
                        total_output_tokens += chunk.usage.completion_tokens or 0

                # If no tool calls, we're done
                if not tool_calls:
                    break

                # Execute tools
                if tool_executor:
                    openai_messages.append({
                        "role": "assistant",
                        "content": current_text or None,
                        "tool_calls": [
                            {
                                "id": tc["id"],
                                "type": "function",
                                "function": {"name": tc["name"], "arguments": tc["arguments"]}
                            }
                            for tc in tool_calls
                        ]
                    })

                    for tc in tool_calls:
                        tool_name = tc["name"]
                        agent_type = "knowledge" if tool_name == "consult_knowledge_agent" else "implementation"

                        yield self._emit_event("agent_activity_start",
                            agent=agent_type,
                            query=f"Executing {tool_name}"
                        )

                        try:
                            tool_input = json.loads(tc["arguments"]) if tc["arguments"] else {}
                            result = await tool_executor(tool_name, tool_input)
                            yield self._emit_event("tool_use_complete", tool=tool_name, success=True)

                            result_data = result if isinstance(result, dict) else {}
                            yield self._emit_event("agent_activity_complete",
                                agent=agent_type,
                                success=result_data.get("success", True),
                                sources_count=len(result_data.get("data", [])) if isinstance(result_data.get("data"), list) else 0,
                                response_summary=f"Retrieved data from {tool_name}"
                            )

                            openai_messages.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": json.dumps(result) if isinstance(result, dict) else str(result),
                            })
                            # Capture tool data for canvas cards
                            if isinstance(result, dict) and result.get("success"):
                                tool_data.append({
                                    "tool": tool_name,
                                    "data": result.get("data") or result.get("results") or result,
                                })
                        except Exception as e:
                            yield self._emit_event("tool_use_complete", tool=tool_name, success=False)
                            yield self._emit_event("agent_activity_complete",
                                agent=agent_type,
                                success=False,
                                response_summary=f"Error: {str(e)}"
                            )
                            openai_messages.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": f"Error: {str(e)}",
                            })
                else:
                    break

            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (total_input_tokens / 1000 * cost_input) + (total_output_tokens / 1000 * cost_output)

            yield self._emit_event("done",
                usage={"input_tokens": total_input_tokens, "output_tokens": total_output_tokens},
                tools_used=tools_used,
                tool_data=tool_data if tool_data else None,
                cost_usd=round(cost_usd, 6),
            )

        except Exception as e:
            logger.error(f"[OpenAI Streaming] Error: {e}")
            yield self._emit_event("error", error=str(e))


class CiscoCircuitStreamingProvider(BaseStreamingProvider):
    """Cisco Circuit streaming provider with simulated streaming."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        app_key: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ):
        super().__init__(model, temperature, max_tokens)
        self.client_id = client_id
        self.client_secret = client_secret
        self.app_key = app_key
        self._access_token = None
        self._token_expiry = 0

    async def _get_access_token(self) -> str:
        """Get OAuth token with caching."""
        import time
        import base64
        import httpx

        if self._access_token and time.time() < (self._token_expiry - 300):
            return self._access_token

        credentials = f"{self.client_id}:{self.client_secret}"
        basic_auth = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                "https://id.cisco.com/oauth2/default/v1/token",
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

    def _get_api_model_name(self) -> str:
        """Strip cisco- prefix from model name."""
        if self.model.startswith("cisco-"):
            return self.model[6:]
        return self.model

    def _convert_tools_to_openai(self, anthropic_tools: List[Dict]) -> List[Dict]:
        """Convert Anthropic tool format to OpenAI format."""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["input_schema"],
                }
            }
            for tool in anthropic_tools
        ]

    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_executor: Optional[callable] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response using Cisco Circuit (simulated streaming)."""
        import httpx

        logger.info(f"[Cisco Circuit] Starting stream_chat with model {self.model}")

        try:
            yield self._emit_event("workflow_info", model={
                "model_id": self.model,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            })
            logger.info("[Cisco Circuit] Emitted workflow_info event")

            access_token = await self._get_access_token()
            logger.info("[Cisco Circuit] Got access token")
            api_model = self._get_api_model_name()
            chat_url = f"https://chat-ai.cisco.com/openai/deployments/{api_model}/chat/completions?api-version=2025-04-01-preview"

            # Import ReAct helpers from cisco_ai_service
            from src.services.cisco_ai_service import (
                REACT_TOOL_PROMPT,
                parse_react_response,
                format_tools_for_react
            )

            # Enhance system prompt with ReAct instructions for tool usage
            if tools and system_prompt:
                tool_definitions = format_tools_for_react(tools)
                react_instructions = REACT_TOOL_PROMPT.format(tool_definitions=tool_definitions)
                enhanced_system_prompt = react_instructions + "\n\n" + system_prompt
            else:
                enhanced_system_prompt = system_prompt or ""

            # Build messages
            cisco_messages = [{"role": "system", "content": enhanced_system_prompt}] if enhanced_system_prompt else []
            for msg in messages:
                if msg.get("role") in ["user", "assistant"]:
                    cisco_messages.append({"role": msg["role"], "content": msg["content"]})

            openai_tools = self._convert_tools_to_openai(tools) if tools else None
            tools_used = []
            tool_data = []  # Collect tool results for canvas cards
            total_input_tokens = 0
            total_output_tokens = 0

            async with httpx.AsyncClient(verify=False) as client:
                while True:
                    request_body = {
                        "messages": cisco_messages,
                        "user": json.dumps({"appkey": self.app_key}),
                        "temperature": self.temperature,
                        "max_tokens": self.max_tokens,
                        # Note: Removed "stop": ["<|im_end|>"] as it may interfere with tool calling
                    }

                    if openai_tools:
                        request_body["tools"] = openai_tools
                        request_body["tool_choice"] = "auto"

                    response = await client.post(
                        chat_url,
                        headers={
                            "Content-Type": "application/json",
                            "api-key": access_token,
                        },
                        json=request_body,
                        timeout=120.0
                    )

                    logger.info(f"[Cisco Circuit] API response status: {response.status_code}")
                    if response.status_code != 200:
                        logger.error(f"[Cisco Circuit] API error: {response.text}")
                        raise Exception(f"Cisco Circuit API error: {response.status_code} - {response.text}")

                    data = response.json()
                    logger.info(f"[Cisco Circuit] Got response with {len(data.get('choices', []))} choices")

                    if "usage" in data:
                        total_input_tokens += data["usage"].get("prompt_tokens", 0)
                        total_output_tokens += data["usage"].get("completion_tokens", 0)

                    message = data["choices"][0]["message"]
                    tool_calls = message.get("tool_calls", [])
                    logger.info(f"[Cisco Circuit] Message keys: {message.keys()}, tool_calls count: {len(tool_calls)}")
                    if tool_calls:
                        logger.info(f"[Cisco Circuit] Tool calls: {tool_calls}")

                    # Simulate streaming for text response
                    content = message.get("content", "") or ""
                    logger.info(f"[Cisco Circuit] Response content length: {len(content)}")
                    if content:
                        logger.info(f"[Cisco Circuit] First 100 chars: {content[:100]}")
                        # Chunk the response for simulated streaming
                        chunk_size = 10
                        for i in range(0, len(content), chunk_size):
                            chunk = content[i:i + chunk_size]
                            yield self._emit_event("text_delta", text=chunk)
                            await asyncio.sleep(0.02)  # Small delay for visual effect
                        logger.info("[Cisco Circuit] Finished emitting text_delta events")

                    # Handle tool calls - check native tool_calls first, then ReAct fallback
                    if not tool_calls:
                        # REACT FALLBACK: Parse text content for Action/Action Input pattern
                        if tools and tool_executor and content:
                            logger.info("[Cisco Circuit] No native tool_calls, checking for ReAct pattern...")
                            parsed = parse_react_response(content)

                            # Check for Final Answer (done)
                            if parsed["final_answer"]:
                                logger.info("[Cisco Circuit ReAct] Found Final Answer")
                                # Emit the final answer as text
                                final_text = parsed["final_answer"]
                                chunk_size = 10
                                for i in range(0, len(final_text), chunk_size):
                                    yield self._emit_event("text_delta", text=final_text[i:i + chunk_size])
                                    await asyncio.sleep(0.02)
                                break

                            # Check for Action (tool call via ReAct)
                            if parsed["has_action"]:
                                tool_name = parsed["action"]
                                tool_input = parsed["action_input"] or {}
                                logger.info(f"[Cisco Circuit ReAct] Executing tool: {tool_name}")

                                tools_used.append(tool_name)
                                agent_type = "knowledge" if tool_name == "consult_knowledge_agent" else "implementation"

                                yield self._emit_event("tool_use_start", tool=tool_name)
                                yield self._emit_event("agent_activity_start",
                                    agent=agent_type,
                                    query=f"Executing {tool_name}"
                                )

                                try:
                                    result = await tool_executor(tool_name, tool_input)
                                    yield self._emit_event("tool_use_complete", tool=tool_name, success=True)

                                    result_data = result if isinstance(result, dict) else {}
                                    yield self._emit_event("agent_activity_complete",
                                        agent=agent_type,
                                        success=result_data.get("success", True),
                                        sources_count=len(result_data.get("data", [])) if isinstance(result_data.get("data"), list) else 0,
                                        response_summary=f"Retrieved data from {tool_name}"
                                    )

                                    # Capture tool data for canvas cards
                                    if isinstance(result, dict) and result.get("success"):
                                        tool_data.append({
                                            "tool": tool_name,
                                            "data": result.get("data") or result.get("results") or result,
                                        })

                                    # Add assistant message and observation for ReAct loop
                                    cisco_messages.append({"role": "assistant", "content": content})
                                    observation = f"Observation: {json.dumps(result, indent=2)}"
                                    cisco_messages.append({"role": "user", "content": observation})
                                    logger.info("[Cisco Circuit ReAct] Added observation, continuing loop")
                                    continue  # Continue the while loop for next response

                                except Exception as e:
                                    yield self._emit_event("tool_use_complete", tool=tool_name, success=False)
                                    yield self._emit_event("agent_activity_complete",
                                        agent=agent_type,
                                        success=False,
                                        response_summary=f"Error: {str(e)}"
                                    )
                                    # Add error observation and continue
                                    cisco_messages.append({"role": "assistant", "content": content})
                                    cisco_messages.append({"role": "user", "content": f"Observation: Error executing {tool_name}: {str(e)}"})
                                    continue

                        # No ReAct pattern found - this is the final response
                        break

                    if tool_executor:
                        cisco_messages.append(message)

                        for tc in tool_calls:
                            tool_name = tc["function"]["name"]
                            tools_used.append(tool_name)
                            agent_type = "knowledge" if tool_name == "consult_knowledge_agent" else "implementation"

                            yield self._emit_event("tool_use_start", tool=tool_name)
                            yield self._emit_event("agent_activity_start",
                                agent=agent_type,
                                query=f"Executing {tool_name}"
                            )

                            try:
                                tool_input = json.loads(tc["function"]["arguments"]) if tc["function"]["arguments"] else {}
                                result = await tool_executor(tool_name, tool_input)
                                yield self._emit_event("tool_use_complete", tool=tool_name, success=True)

                                result_data = result if isinstance(result, dict) else {}
                                yield self._emit_event("agent_activity_complete",
                                    agent=agent_type,
                                    success=result_data.get("success", True),
                                    sources_count=len(result_data.get("data", [])) if isinstance(result_data.get("data"), list) else 0,
                                    response_summary=f"Retrieved data from {tool_name}"
                                )

                                cisco_messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc["id"],
                                    "content": json.dumps(result) if isinstance(result, dict) else str(result),
                                })
                                # Capture tool data for canvas cards
                                if isinstance(result, dict) and result.get("success"):
                                    tool_data.append({
                                        "tool": tool_name,
                                        "data": result.get("data") or result.get("results") or result,
                                    })
                            except Exception as e:
                                yield self._emit_event("tool_use_complete", tool=tool_name, success=False)
                                yield self._emit_event("agent_activity_complete",
                                    agent=agent_type,
                                    success=False,
                                    response_summary=f"Error: {str(e)}"
                                )
                                cisco_messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc["id"],
                                    "content": f"Error: {str(e)}",
                                })
                    else:
                        break

            cost_input, cost_output = get_model_costs(self.model)
            cost_usd = (total_input_tokens / 1000 * cost_input) + (total_output_tokens / 1000 * cost_output)

            logger.info(f"[Cisco Circuit] Emitting done event with {total_input_tokens} input, {total_output_tokens} output tokens")
            yield self._emit_event("done",
                usage={"input_tokens": total_input_tokens, "output_tokens": total_output_tokens},
                tools_used=tools_used,
                tool_data=tool_data if tool_data else None,
                cost_usd=round(cost_usd, 6),
            )
            logger.info("[Cisco Circuit] Stream complete")

        except Exception as e:
            logger.error(f"[Cisco Circuit Streaming] Error: {e}", exc_info=True)
            yield self._emit_event("error", error=str(e))


def get_streaming_provider(
    model: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> Optional[BaseStreamingProvider]:
    """Get appropriate streaming provider based on model.

    Args:
        model: Model ID (e.g., "gpt-4o", "claude-sonnet-4-5-20250929", "cisco-gpt-4.1")
        temperature: Temperature setting
        max_tokens: Max tokens for response
        user_api_keys: Optional dict with user-provided API keys

    Returns:
        Streaming provider instance or None if no API key available
    """
    settings = get_settings()
    user_api_keys = user_api_keys or {}
    provider = get_provider_from_model(model)

    logger.info(f"[Streaming] Model: {model}, Provider: {provider}")

    if provider == "openai":
        api_key = user_api_keys.get("openai") or settings.openai_api_key
        if not api_key:
            logger.warning("[Streaming] No OpenAI API key available")
            return None
        return OpenAIStreamingProvider(api_key, model, temperature, max_tokens)

    elif provider == "cisco":
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
            logger.warning("[Streaming] Cisco Circuit credentials not configured")
            return None
        return CiscoCircuitStreamingProvider(
            client_id, client_secret, app_key, model, temperature, max_tokens
        )

    elif provider == "google":
        # Google streaming is more complex - fall back to Anthropic for now
        logger.info("[Streaming] Google Gemini not yet supported for streaming, falling back to Anthropic")
        api_key = (
            user_api_keys.get("anthropic") or
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key
        )
        if not api_key:
            return None
        return AnthropicStreamingProvider(api_key, "claude-sonnet-4-5-20250929", temperature, max_tokens)

    else:  # anthropic (default)
        api_key = (
            user_api_keys.get("anthropic") or
            get_config_or_env("anthropic_api_key", "ANTHROPIC_API_KEY") or
            settings.anthropic_api_key
        )
        if not api_key:
            logger.warning("[Streaming] No Anthropic API key available")
            return None
        return AnthropicStreamingProvider(api_key, model, temperature, max_tokens)
