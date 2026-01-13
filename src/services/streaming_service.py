"""Streaming AI service for real-time response generation.

This module provides Server-Sent Events (SSE) streaming support for AI responses,
allowing users to see text appear progressively as it's generated.

Enhanced with enterprise agent event protocol for real-time workflow visualization.
"""

import json
import logging
import asyncio
import time
from typing import AsyncGenerator, Dict, Any, List, Optional
import anthropic

from src.models.agent_event import AgentEventEmitter, AgentType

# A2A feedback module is archived - provide stubs for backward compatibility
try:
    from src.a2a_archived.feedback import RoutingOutcome, get_feedback_tracker
except ImportError:
    # Provide stub implementations when A2A is not available
    from enum import Enum

    class RoutingOutcome(Enum):
        """Stub for archived RoutingOutcome enum."""
        SUCCESS = "success"
        PARTIAL = "partial"
        FAILURE = "failure"
        ERROR = "error"

    def get_feedback_tracker():
        """Stub for archived feedback tracker."""
        return None

logger = logging.getLogger(__name__)


class StreamingAIService:
    """Service for streaming AI responses via SSE."""

    def __init__(self, client: anthropic.Anthropic, model: str):
        """Initialize streaming service.

        Args:
            client: Anthropic client instance
            model: Model ID to use
        """
        self.client = client
        self.model = model

    async def stream_simple_response(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream a simple response without tool use.

        Yields SSE-formatted events for:
        - text_delta: Incremental text content
        - done: Completion signal with usage info
        - error: Error information

        Args:
            prompt: The user's prompt
            system_prompt: Optional system context
            max_tokens: Maximum tokens for response
            temperature: Temperature setting

        Yields:
            SSE-formatted event strings
        """
        try:
            # Use the streaming API
            with self.client.messages.stream(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt if system_prompt else None,
                messages=[{"role": "user", "content": prompt}]
            ) as stream:
                full_text = ""

                for event in stream:
                    if hasattr(event, 'type'):
                        if event.type == 'content_block_delta':
                            if hasattr(event.delta, 'text'):
                                text = event.delta.text
                                full_text += text
                                yield f"data: {json.dumps({'type': 'text_delta', 'text': text})}\n\n"

                        elif event.type == 'message_stop':
                            # Get final message for usage info
                            final_message = stream.get_final_message()
                            usage = {
                                "input_tokens": final_message.usage.input_tokens,
                                "output_tokens": final_message.usage.output_tokens,
                            }
                            yield f"data: {json.dumps({'type': 'done', 'usage': usage})}\n\n"

        except anthropic.APIError as e:
            error_msg = f"API error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"

    async def stream_chat_response(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        tool_executor: Optional[callable] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat response with optional tool use.

        This method handles the complex case where Claude may use tools,
        streaming both the text and tool execution progress.

        Yields SSE events for:
        - text_delta: Incremental text content
        - tool_use_start: Beginning of tool execution
        - tool_use_progress: Tool execution status
        - tool_use_complete: Tool execution result
        - done: Completion signal with usage info
        - error: Error information

        Args:
            messages: Conversation messages
            system_prompt: System context
            tools: Optional list of tool definitions
            max_tokens: Maximum tokens for response
            temperature: Temperature setting
            tool_executor: Async callable to execute tools

        Yields:
            SSE-formatted event strings
        """
        try:
            total_input_tokens = 0
            total_output_tokens = 0
            full_response = ""
            tools_used = []

            while True:
                # Create streaming request
                stream_kwargs = {
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": messages,
                }
                if tools:
                    stream_kwargs["tools"] = tools

                with self.client.messages.stream(**stream_kwargs) as stream:
                    current_tool_use = None
                    current_tool_input = ""

                    for event in stream:
                        if hasattr(event, 'type'):
                            # Handle text content
                            if event.type == 'content_block_delta':
                                if hasattr(event.delta, 'text'):
                                    text = event.delta.text
                                    full_response += text
                                    yield f"data: {json.dumps({'type': 'text_delta', 'text': text})}\n\n"

                                elif hasattr(event.delta, 'partial_json'):
                                    # Accumulate tool input JSON
                                    current_tool_input += event.delta.partial_json

                            # Handle content block start (tool use)
                            elif event.type == 'content_block_start':
                                if hasattr(event.content_block, 'type') and event.content_block.type == 'tool_use':
                                    current_tool_use = {
                                        'id': event.content_block.id,
                                        'name': event.content_block.name,
                                    }
                                    current_tool_input = ""
                                    yield f"data: {json.dumps({'type': 'tool_use_start', 'tool': current_tool_use['name']})}\n\n"

                            # Handle content block stop (complete tool input)
                            elif event.type == 'content_block_stop':
                                if current_tool_use:
                                    try:
                                        current_tool_use['input'] = json.loads(current_tool_input) if current_tool_input else {}
                                    except json.JSONDecodeError:
                                        current_tool_use['input'] = {}
                                    current_tool_use = None

                    # Get final message
                    final_message = stream.get_final_message()
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                    # Check if we need to execute tools
                    if final_message.stop_reason == "tool_use" and tool_executor:
                        tool_uses = [
                            block for block in final_message.content
                            if block.type == "tool_use"
                        ]

                        tool_results = []
                        tool_data = []  # Collect tool results for frontend
                        for tool_use in tool_uses:
                            tools_used.append(tool_use.name)
                            yield f"data: {json.dumps({'type': 'tool_use_progress', 'tool': tool_use.name, 'status': 'executing'})}\n\n"

                            # Execute the tool with error handling
                            try:
                                result = await tool_executor(tool_use.name, tool_use.input)
                            except asyncio.TimeoutError:
                                logger.error(f"[Streaming] Tool execution timeout: {tool_use.name}")
                                result = {"success": False, "error": f"Tool execution timed out: {tool_use.name}"}
                            except Exception as tool_error:
                                logger.error(f"[Streaming] Tool execution error for {tool_use.name}: {str(tool_error)}")
                                result = {"success": False, "error": str(tool_error)}

                            # Always emit tool_use_complete to prevent UI getting stuck
                            yield f"data: {json.dumps({'type': 'tool_use_complete', 'tool': tool_use.name, 'success': result.get('success', False)})}\n\n"

                            # Collect tool data for canvas cards
                            if result.get("success"):
                                tool_result_data = (
                                    result.get("data") or
                                    result.get("networks") or
                                    result.get("devices") or
                                    result.get("statuses") or
                                    result.get("results")
                                )
                                if tool_result_data and isinstance(tool_result_data, list) and len(tool_result_data) > 0:
                                    tool_data.append({
                                        "tool": tool_use.name,
                                        "data": tool_result_data
                                    })

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_use.id,
                                "content": json.dumps(result)
                            })

                        # Add assistant message and tool results for next iteration
                        messages.append({"role": "assistant", "content": final_message.content})
                        messages.append({"role": "user", "content": tool_results})

                        # Continue the loop for more responses
                        continue
                    else:
                        # No more tool use, we're done
                        break

            # Send completion event
            usage = {
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
            }
            yield f"data: {json.dumps({'type': 'done', 'usage': usage, 'tools_used': tools_used, 'tool_data': tool_data if tool_data else None})}\n\n"

        except anthropic.APIError as e:
            error_msg = f"API error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"


    async def stream_with_agent_activity(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        tools: List[Dict[str, Any]],
        tool_executor: callable,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat response with full agentic loop and agent activity events.

        This method emits real-time events when the AI consults other agents
        like the Knowledge Agent, allowing the UI to show activity indicators.

        SSE Event Types:
        - text_delta: Incremental text content {"type": "text_delta", "text": "..."}
        - thinking: AI is processing {"type": "thinking", "status": "analyzing"}
        - tool_use_start: Tool execution start {"type": "tool_use_start", "tool": "name"}
        - agent_activity_start: Agent consultation starting {"type": "agent_activity_start", "agent": "knowledge", "query": "..."}
        - agent_activity_complete: Agent consultation done {"type": "agent_activity_complete", "agent": "knowledge", "success": true, "sources_count": 3}
        - tool_use_complete: Tool finished {"type": "tool_use_complete", "tool": "name", "success": true}
        - done: Completion signal {"type": "done", "usage": {...}, "tools_used": [...], "agent_activity": [...]}
        - error: Error occurred {"type": "error", "error": "message"}

        Args:
            messages: Conversation messages
            system_prompt: System context
            tools: List of tool definitions
            tool_executor: Async callable to execute tools
            max_tokens: Maximum tokens for response
            temperature: Temperature setting

        Yields:
            SSE-formatted event strings
        """
        try:
            total_input_tokens = 0
            total_output_tokens = 0
            full_response = ""
            tools_used = []
            agent_activity = []
            tool_data = []  # Collect tool results for frontend canvas cards

            # Emit thinking event
            yield f"data: {json.dumps({'type': 'thinking', 'status': 'analyzing'})}\n\n"

            while True:
                # Create streaming request
                stream_kwargs = {
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": messages,
                }
                if tools:
                    stream_kwargs["tools"] = tools

                with self.client.messages.stream(**stream_kwargs) as stream:
                    current_tool_use = None
                    current_tool_input = ""

                    for event in stream:
                        if hasattr(event, 'type'):
                            # Handle text content
                            if event.type == 'content_block_delta':
                                if hasattr(event.delta, 'text'):
                                    text = event.delta.text
                                    full_response += text
                                    yield f"data: {json.dumps({'type': 'text_delta', 'text': text})}\n\n"

                                elif hasattr(event.delta, 'partial_json'):
                                    current_tool_input += event.delta.partial_json

                            # Handle content block start (tool use)
                            elif event.type == 'content_block_start':
                                if hasattr(event.content_block, 'type') and event.content_block.type == 'tool_use':
                                    current_tool_use = {
                                        'id': event.content_block.id,
                                        'name': event.content_block.name,
                                    }
                                    current_tool_input = ""
                                    yield f"data: {json.dumps({'type': 'tool_use_start', 'tool': current_tool_use['name']})}\n\n"

                            # Handle content block stop
                            elif event.type == 'content_block_stop':
                                if current_tool_use:
                                    try:
                                        current_tool_use['input'] = json.loads(current_tool_input) if current_tool_input else {}
                                    except json.JSONDecodeError:
                                        current_tool_use['input'] = {}
                                    current_tool_use = None

                    # Get final message
                    final_message = stream.get_final_message()
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                    # Check if we need to execute tools
                    if final_message.stop_reason == "tool_use" and tool_executor:
                        tool_uses = [
                            block for block in final_message.content
                            if block.type == "tool_use"
                        ]

                        tool_results = []
                        for tool_use in tool_uses:
                            tools_used.append(tool_use.name)

                            # Emit agent activity events for Knowledge Agent tools
                            is_knowledge_tool = tool_use.name in ["consult_knowledge_agent", "request_implementation_plan"]

                            if is_knowledge_tool:
                                agent_type = "knowledge" if tool_use.name == "consult_knowledge_agent" else "implementation"
                                query = tool_use.input.get("query", tool_use.input.get("task", ""))[:100]
                                yield f"data: {json.dumps({'type': 'agent_activity_start', 'agent': agent_type, 'tool': tool_use.name, 'query': query})}\n\n"
                            else:
                                yield f"data: {json.dumps({'type': 'tool_use_progress', 'tool': tool_use.name, 'status': 'executing'})}\n\n"

                            # Execute the tool with error handling to ensure tool_use_complete is always emitted
                            try:
                                result = await tool_executor(tool_use.name, tool_use.input)
                            except asyncio.TimeoutError:
                                logger.error(f"[Streaming] Tool execution timeout: {tool_use.name}")
                                result = {"success": False, "error": f"Tool execution timed out: {tool_use.name}"}
                            except Exception as tool_error:
                                logger.error(f"[Streaming] Tool execution error for {tool_use.name}: {str(tool_error)}")
                                result = {"success": False, "error": str(tool_error)}

                            # Emit completion events - ALWAYS emit to prevent UI getting stuck
                            if is_knowledge_tool:
                                activity_entry = {
                                    "tool": tool_use.name,
                                    "status": "completed" if result.get("success") else "failed",
                                    "agent_communication": result.get("agent_communication"),
                                }
                                if tool_use.name == "consult_knowledge_agent":
                                    activity_entry["confidence"] = result.get("confidence", 0.0)
                                    activity_entry["sources_count"] = len(result.get("sources", []))
                                    yield f"data: {json.dumps({'type': 'agent_activity_complete', 'agent': 'knowledge', 'tool': tool_use.name, 'success': result.get('success', False), 'confidence': result.get('confidence', 0.0), 'sources_count': len(result.get('sources', []))})}\n\n"
                                else:
                                    activity_entry["confidence"] = result.get("confidence", 0.0)
                                    activity_entry["steps_count"] = len(result.get("steps", []))
                                    yield f"data: {json.dumps({'type': 'agent_activity_complete', 'agent': 'implementation', 'tool': tool_use.name, 'success': result.get('success', False), 'confidence': result.get('confidence', 0.0), 'steps_count': len(result.get('steps', []))})}\n\n"
                                agent_activity.append(activity_entry)
                            else:
                                yield f"data: {json.dumps({'type': 'tool_use_complete', 'tool': tool_use.name, 'success': result.get('success', False)})}\n\n"

                            # Collect tool data for canvas cards
                            # Check multiple possible keys where tools return their data
                            if result.get("success"):
                                tool_result_data = (
                                    result.get("data") or
                                    result.get("networks") or
                                    result.get("devices") or
                                    result.get("statuses") or
                                    result.get("results") or
                                    result.get("agents") or
                                    result.get("tests") or
                                    result.get("alerts") or
                                    result.get("clients") or
                                    result.get("sites") or
                                    result.get("issues")
                                )
                                if tool_result_data and isinstance(tool_result_data, list) and len(tool_result_data) > 0:
                                    tool_data.append({
                                        "tool": tool_use.name,
                                        "data": tool_result_data
                                    })

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_use.id,
                                "content": json.dumps(result)
                            })

                        # Add assistant message and tool results for next iteration
                        messages.append({"role": "assistant", "content": final_message.content})
                        messages.append({"role": "user", "content": tool_results})

                        # Continue the loop for more responses
                        continue
                    else:
                        # No more tool use, we're done
                        break

            # Send completion event with all collected data
            usage = {
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
            }
            yield f"data: {json.dumps({'type': 'done', 'usage': usage, 'tools_used': tools_used, 'agent_activity': agent_activity if agent_activity else None, 'tool_data': tool_data if tool_data else None})}\n\n"

        except anthropic.APIError as e:
            error_msg = f"API error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"


    async def stream_enterprise_workflow(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: str,
        tools: List[Dict[str, Any]],
        tool_executor: callable,
        organization: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat response with full enterprise event protocol.

        This method provides real-time visibility into the entire AI workflow,
        emitting granular events for each step that can be visualized in the
        agent flow diagram.

        Event Types:
        - workflow_start: Workflow initiated
        - agent_spawn: New agent created for subtask
        - agent_thinking: Agent reasoning/planning
        - tool_call_start: Tool execution beginning
        - tool_call_complete: Tool execution finished
        - agent_handoff: Context passed between agents
        - agent_response: Agent produced output
        - workflow_complete: Full workflow finished
        - text_delta: Streaming text content (for response)
        - error: Error occurred

        Args:
            messages: Conversation messages
            system_prompt: System context
            tools: List of tool definitions
            tool_executor: Async callable to execute tools
            organization: Organization context
            max_tokens: Maximum tokens for response
            temperature: Temperature setting

        Yields:
            SSE-formatted event strings following enterprise protocol
        """
        import time

        # Initialize the event emitter for this workflow
        emitter = AgentEventEmitter()

        # Extract query from last user message
        query = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    query = content
                elif isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "text":
                            query = item.get("text", "")
                            break
                break

        try:
            # Emit workflow start
            yield emitter.workflow_start(query=query, organization=organization)

            # Spawn the orchestrator agent
            orchestrator_id, spawn_event = emitter.agent_spawn(
                AgentType.ORCHESTRATOR,
                purpose="Route query to appropriate agents and tools"
            )
            yield spawn_event

            # Emit orchestrator thinking
            yield emitter.agent_thinking(
                orchestrator_id,
                AgentType.ORCHESTRATOR,
                "Analyzing query and determining required tools/agents...",
                confidence=0.9
            )

            total_input_tokens = 0
            total_output_tokens = 0
            tools_used = []
            active_agents = {orchestrator_id: AgentType.ORCHESTRATOR}

            while True:
                # Create streaming request
                stream_kwargs = {
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": messages,
                }
                if tools:
                    stream_kwargs["tools"] = tools

                with self.client.messages.stream(**stream_kwargs) as stream:
                    current_tool_use = None
                    current_tool_input = ""

                    for event in stream:
                        if hasattr(event, 'type'):
                            # Handle text content
                            if event.type == 'content_block_delta':
                                if hasattr(event.delta, 'text'):
                                    yield emitter.text_delta(event.delta.text)
                                elif hasattr(event.delta, 'partial_json'):
                                    current_tool_input += event.delta.partial_json

                            # Handle tool use start
                            elif event.type == 'content_block_start':
                                if hasattr(event.content_block, 'type') and event.content_block.type == 'tool_use':
                                    current_tool_use = {
                                        'id': event.content_block.id,
                                        'name': event.content_block.name,
                                    }
                                    current_tool_input = ""

                            # Handle content block stop
                            elif event.type == 'content_block_stop':
                                if current_tool_use:
                                    try:
                                        current_tool_use['input'] = json.loads(current_tool_input) if current_tool_input else {}
                                    except json.JSONDecodeError:
                                        current_tool_use['input'] = {}
                                    current_tool_use = None

                    # Get final message
                    final_message = stream.get_final_message()
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                    # Check if we need to execute tools
                    if final_message.stop_reason == "tool_use" and tool_executor:
                        tool_uses = [
                            block for block in final_message.content
                            if block.type == "tool_use"
                        ]

                        tool_results = []
                        for tool_use in tool_uses:
                            tool_name = tool_use.name
                            tools_used.append(tool_name)
                            tool_input = tool_use.input

                            # Determine if this is an agent tool
                            is_knowledge_tool = tool_name == "consult_knowledge_agent"
                            is_impl_tool = tool_name == "request_implementation_plan"

                            # Determine agent type for this tool
                            if is_knowledge_tool:
                                agent_type = AgentType.KNOWLEDGE
                                agent_id, spawn_evt = emitter.agent_spawn(agent_type, "Retrieve knowledge and best practices")
                                yield spawn_evt
                                active_agents[agent_id] = agent_type

                                # Emit handoff from orchestrator
                                yield emitter.agent_handoff(
                                    orchestrator_id, AgentType.ORCHESTRATOR,
                                    agent_id, agent_type,
                                    f"Query: {tool_input.get('query', '')[:100]}"
                                )
                            elif is_impl_tool:
                                agent_type = AgentType.IMPLEMENTATION
                                agent_id, spawn_evt = emitter.agent_spawn(agent_type, "Create implementation plan")
                                yield spawn_evt
                                active_agents[agent_id] = agent_type

                                yield emitter.agent_handoff(
                                    orchestrator_id, AgentType.ORCHESTRATOR,
                                    agent_id, agent_type,
                                    f"Task: {tool_input.get('task', '')[:100]}"
                                )
                            else:
                                # Regular tool - emit tool_start from orchestrator
                                agent_id = orchestrator_id
                                agent_type = AgentType.ORCHESTRATOR

                            # Emit tool start
                            tool_start_time = time.time()
                            yield emitter.tool_start(
                                agent_id, agent_type, tool_name, tool_input,
                                reason=f"Required for: {query[:50]}..."
                            )

                            # Execute the tool with error handling
                            try:
                                result = await tool_executor(tool_name, tool_input)
                            except asyncio.TimeoutError:
                                logger.error(f"[Enterprise Streaming] Tool execution timeout: {tool_name}")
                                result = {"success": False, "error": f"Tool execution timed out: {tool_name}"}
                            except Exception as tool_error:
                                logger.error(f"[Enterprise Streaming] Tool execution error for {tool_name}: {str(tool_error)}")
                                result = {"success": False, "error": str(tool_error)}

                            tool_duration = int((time.time() - tool_start_time) * 1000)

                            # Emit tool complete
                            result_summary = None
                            if isinstance(result, dict):
                                if result.get("success"):
                                    result_summary = f"Success: {str(result.get('data', result.get('response', '')))[:100]}"
                                else:
                                    result_summary = f"Error: {result.get('error', 'Unknown')}"

                            yield emitter.tool_complete(
                                agent_id, agent_type, tool_name,
                                success=result.get("success", False) if isinstance(result, dict) else True,
                                result_summary=result_summary,
                                duration_ms=tool_duration,
                                error=result.get("error") if isinstance(result, dict) and not result.get("success") else None
                            )

                            # If agent tool, emit agent response
                            if is_knowledge_tool or is_impl_tool:
                                tokens = None
                                if isinstance(result, dict) and result.get("usage"):
                                    tokens = result["usage"]
                                yield emitter.agent_response(
                                    agent_id, agent_type,
                                    str(result.get("response", result.get("summary", "")))[:200] if isinstance(result, dict) else str(result)[:200],
                                    tokens=tokens
                                )

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_use.id,
                                "content": json.dumps(result)
                            })

                        # Add assistant message and tool results for next iteration
                        messages.append({"role": "assistant", "content": final_message.content})
                        messages.append({"role": "user", "content": tool_results})
                        continue
                    else:
                        # No more tool use, we're done
                        break

            # Emit workflow complete
            yield emitter.done(
                usage={"input": total_input_tokens, "output": total_output_tokens},
                tools_used=tools_used
            )

        except anthropic.APIError as e:
            error_msg = f"API error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield emitter.error(error_msg, code="API_ERROR")
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}")
            yield emitter.error(error_msg, code="UNEXPECTED_ERROR")

    async def stream_multi_agent_workflow(
        self,
        query: str,
        session_id: str,
        org_context: "AgentOrgContext",
        max_turns: int = 10,
        model_info: Optional[Dict[str, Any]] = None,
        preprocessing_info: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream multi-agent conversation with specialist agents.

        This method uses the EnhancedOrchestrator to coordinate multiple
        specialist agents (Meraki, ThousandEyes, Catalyst, Splunk, UI)
        and streams events for frontend visualization.

        The orchestrator routes to specialist agents that call APIs directly,
        then uses the user's selected AI model to synthesize a natural response.
        This enables cost tracking since AI is used for synthesis.

        Event Types:
        - workflow_info: Initial workflow info including model being used
        - query_preprocessed: Query corrections made (typos fixed, etc.)
        - orchestrator_routing: Initial routing decision
        - turn_start: Agent turn beginning
        - turn_progress: Progress within a turn
        - turn_complete: Agent turn finished
        - agent_handoff: Context passed between agents
        - parallel_start: Multiple agents starting in parallel
        - parallel_complete: Parallel execution finished
        - synthesis_start: Response synthesis beginning
        - text_delta: Streaming text content
        - done: Workflow complete with usage/cost info

        Args:
            query: User's query (already preprocessed/corrected)
            session_id: Session ID for tracking
            org_context: Organization context with credentials
            max_turns: Maximum conversation turns
            model_info: Model configuration (model_id, temperature, max_tokens)
            preprocessing_info: Query preprocessing details (corrections made, if any)

        Yields:
            SSE-formatted event strings
        """
        from src.a2a.enhanced_orchestrator import get_enhanced_orchestrator
        from src.a2a.agent_dependencies import AgentOrgContext
        from src.services.multi_provider_streaming import get_streaming_provider

        # Track workflow metrics for outcome recording
        workflow_start_time = time.time()
        routing_event = None
        done_event = None
        had_errors = False

        try:
            # Emit workflow_info event first with model details
            if model_info:
                logger.info(f"[Multi-Agent Stream] Emitting workflow_info event with model: {model_info.get('model_id')}")
                yield f"data: {json.dumps({'type': 'workflow_info', 'model': model_info})}\n\n"

            # Emit query_preprocessed event if corrections were made
            if preprocessing_info:
                logger.info(
                    f"[Multi-Agent Stream] Query was corrected: "
                    f"'{preprocessing_info.get('original_query')}' -> '{preprocessing_info.get('corrected_query')}'"
                )
                yield f"data: {json.dumps({'type': 'query_preprocessed', 'preprocessing': preprocessing_info})}\n\n"

            # Create AI provider for synthesis using user's preferred model
            ai_provider = None
            if model_info:
                ai_provider = get_streaming_provider(
                    model=model_info.get("model_id", "claude-sonnet-4-5-20250929"),
                    temperature=model_info.get("temperature", 0.7),
                    max_tokens=model_info.get("max_tokens", 4096),
                )
                if ai_provider:
                    logger.info(f"[Multi-Agent Stream] Created AI provider for synthesis: {type(ai_provider).__name__}")
                else:
                    logger.warning("[Multi-Agent Stream] Could not create AI provider, will use code-based synthesis")

            orchestrator = get_enhanced_orchestrator()
            logger.info(f"[Multi-Agent Stream] Starting stream_multi_turn for query: {query[:50]}...")

            # Stream events from the orchestrator, passing AI provider for synthesis
            event_count = 0
            async for event in orchestrator.stream_multi_turn(
                query=query,
                session_id=session_id,
                org_context=org_context,
                ai_provider=ai_provider,
            ):
                event_count += 1
                event_type = event.get("type", "unknown")
                logger.info(f"[Multi-Agent Stream] Event {event_count}: {event_type}")

                # Track key events for outcome recording
                if event_type == "orchestrator_routing":
                    routing_event = event
                elif event_type == "multi_agent_done":
                    done_event = event
                elif event_type == "error":
                    had_errors = True

                yield f"data: {json.dumps(event)}\n\n"

            logger.info(f"[Multi-Agent Stream] Stream complete, total events: {event_count}")

            # Record routing outcome for adaptive feedback
            self._record_routing_outcome(
                query=query,
                routing_event=routing_event,
                done_event=done_event,
                had_errors=had_errors,
                workflow_start_time=workflow_start_time,
                session_id=session_id,
            )

        except Exception as e:
            error_msg = f"Multi-agent workflow error: {str(e)}"
            logger.error(f"[Streaming] {error_msg}", exc_info=True)
            had_errors = True
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"

            # Record failed outcome
            self._record_routing_outcome(
                query=query,
                routing_event=routing_event,
                done_event=None,
                had_errors=True,
                workflow_start_time=workflow_start_time,
                session_id=session_id,
            )

    def _record_routing_outcome(
        self,
        query: str,
        routing_event: Optional[Dict[str, Any]],
        done_event: Optional[Dict[str, Any]],
        had_errors: bool,
        workflow_start_time: float,
        session_id: str,
    ) -> None:
        """Record routing outcome for adaptive feedback.

        This method calculates quality signals from the workflow events
        and records the outcome to the feedback tracker.

        Args:
            query: The user's original query
            routing_event: The orchestrator_routing event with routing decision
            done_event: The multi_agent_done event with final results
            had_errors: Whether any errors occurred during the workflow
            workflow_start_time: Unix timestamp when workflow started
            session_id: Session ID for the workflow
        """
        try:
            if not routing_event:
                logger.warning("[Streaming] Cannot record outcome without routing event")
                return

            feedback_tracker = get_feedback_tracker()

            # Extract routing info
            primary_agent = routing_event.get("primary_agent", "unknown")
            reasoning = routing_event.get("reasoning", "")

            # Calculate response time
            response_time_ms = int((time.time() - workflow_start_time) * 1000)

            # Determine success and calculate quality score
            success = not had_errors
            had_data = False
            quality_score = 0.5  # Base score

            if done_event:
                success = done_event.get("success", not had_errors)

                # Check if response had meaningful data
                final_response = done_event.get("final_response", "")
                tool_data = done_event.get("tool_data", [])
                entities_discovered = done_event.get("entities_discovered", {})

                had_data = bool(tool_data) or bool(entities_discovered)
                quality_score = self._calculate_quality_score(
                    final_response=final_response,
                    tool_data=tool_data,
                    entities_discovered=entities_discovered,
                    had_errors=had_errors,
                )

            # Extract intent from routing reasoning
            intent = "general"
            if "splunk" in reasoning.lower():
                intent = "splunk_query"
            elif "meraki" in reasoning.lower():
                intent = "meraki_query"
            elif "thousandeyes" in reasoning.lower():
                intent = "monitoring"
            elif "catalyst" in reasoning.lower():
                intent = "catalyst_query"
            elif "follow-up" in reasoning.lower():
                intent = "follow_up"

            # Create and record outcome
            outcome = RoutingOutcome(
                query=query[:500],  # Truncate very long queries
                intent=intent,
                agent_id=primary_agent,
                success=success,
                quality_score=quality_score,
                response_time_ms=response_time_ms,
                session_id=session_id,
                had_data=had_data,
                error_occurred=had_errors,
            )

            feedback_tracker.record_outcome(outcome)

            logger.info(
                f"[Streaming] Recorded routing outcome: agent={primary_agent}, "
                f"success={success}, quality={quality_score:.2f}, time={response_time_ms}ms"
            )

        except Exception as e:
            # Don't let feedback recording errors affect the main flow
            logger.warning(f"[Streaming] Failed to record routing outcome: {e}")

    def _calculate_quality_score(
        self,
        final_response: str,
        tool_data: List[Dict[str, Any]],
        entities_discovered: Dict[str, Any],
        had_errors: bool,
    ) -> float:
        """Calculate a quality score for the routing outcome.

        Uses heuristics based on response characteristics to estimate
        how useful the response was.

        Args:
            final_response: The synthesized final response text
            tool_data: List of tool data collected during workflow
            entities_discovered: Dictionary of discovered entities
            had_errors: Whether any errors occurred

        Returns:
            Quality score between 0.0 and 1.0
        """
        score = 0.5  # Start at neutral

        # Positive signals
        if tool_data and len(tool_data) > 0:
            score += 0.15  # Had structured data from tools

        if entities_discovered and len(entities_discovered) > 0:
            score += 0.1  # Discovered entities

        if final_response:
            response_lower = final_response.lower()

            # Response length (longer responses tend to be more detailed)
            if len(final_response) > 200:
                score += 0.05
            if len(final_response) > 500:
                score += 0.05

            # Contains data indicators
            if any(kw in response_lower for kw in ["found", "detected", "showing", "here are"]):
                score += 0.05

            # Contains structured sections (markdown headers)
            if "###" in final_response or "**" in final_response:
                score += 0.05

        # Negative signals
        if had_errors:
            score -= 0.2

        if final_response:
            response_lower = final_response.lower()

            # "No data" type responses
            if any(kw in response_lower for kw in ["no data", "no results", "couldn't find", "unable to"]):
                score -= 0.15

            # Error indicators
            if any(kw in response_lower for kw in ["error", "failed", "timeout", "unavailable"]):
                score -= 0.1

            # Uncertainty indicators
            if any(kw in response_lower for kw in ["don't know", "cannot", "not sure", "unclear"]):
                score -= 0.1

        # Clamp to valid range
        return max(0.0, min(1.0, score))


def create_sse_response(generator: AsyncGenerator[str, None]):
    """Create a StreamingResponse for SSE.

    Args:
        generator: Async generator yielding SSE events

    Returns:
        FastAPI StreamingResponse configured for SSE
    """
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
