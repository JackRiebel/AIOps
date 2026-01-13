# src/models/agent_event.py
"""
Enterprise Agent Event Protocol

Standardized event schema for all agent activities, enabling real-time
visualization and audit logging of AI agent workflows.
"""

from enum import Enum
from typing import Optional, Dict, Any, List
from datetime import datetime
from dataclasses import dataclass, field, asdict
import json
import uuid


class AgentEventType(str, Enum):
    """Types of events that can occur during agent workflow execution."""

    # Workflow lifecycle
    WORKFLOW_START = "workflow_start"
    WORKFLOW_COMPLETE = "workflow_complete"
    WORKFLOW_ERROR = "workflow_error"

    # Agent lifecycle
    AGENT_SPAWN = "agent_spawn"
    AGENT_THINKING = "agent_thinking"
    AGENT_RESPONSE = "agent_response"
    AGENT_COMPLETE = "agent_complete"
    AGENT_ERROR = "agent_error"

    # Tool execution
    TOOL_CALL_START = "tool_call_start"
    TOOL_CALL_PROGRESS = "tool_call_progress"
    TOOL_CALL_COMPLETE = "tool_call_complete"
    TOOL_CALL_ERROR = "tool_call_error"

    # Agent collaboration
    AGENT_HANDOFF = "agent_handoff"
    AGENT_QUERY = "agent_query"
    AGENT_REPLY = "agent_reply"

    # Data flow
    CONTEXT_PASSED = "context_passed"
    DATA_RETRIEVED = "data_retrieved"


class AgentType(str, Enum):
    """Types of agents in the system."""
    ORCHESTRATOR = "orchestrator"
    KNOWLEDGE = "knowledge"
    IMPLEMENTATION = "implementation"
    SPECIALIST = "specialist"
    TOOL_EXECUTOR = "tool_executor"


class EventStatus(str, Enum):
    """Status of an event or step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    SKIPPED = "skipped"


@dataclass
class AgentEvent:
    """
    Represents a single event in an agent workflow.

    All events follow this schema for consistency in logging,
    visualization, and analytics.
    """
    type: AgentEventType
    agent_id: str
    agent_type: AgentType
    workflow_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    parent_id: Optional[str] = None
    status: EventStatus = EventStatus.RUNNING

    # Event-specific data
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Performance tracking
    duration_ms: Optional[int] = None
    tokens_used: Optional[Dict[str, int]] = None  # {input: X, output: Y}

    # Error information
    error: Optional[str] = None
    error_code: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = {
            "type": self.type.value,
            "agent_id": self.agent_id,
            "agent_type": self.agent_type.value,
            "workflow_id": self.workflow_id,
            "timestamp": self.timestamp.isoformat(),
            "status": self.status.value,
            "metadata": self.metadata,
        }

        if self.parent_id:
            data["parent_id"] = self.parent_id
        if self.duration_ms is not None:
            data["duration_ms"] = self.duration_ms
        if self.tokens_used:
            data["tokens_used"] = self.tokens_used
        if self.error:
            data["error"] = self.error
        if self.error_code:
            data["error_code"] = self.error_code

        return data

    def to_sse(self) -> str:
        """Format as Server-Sent Event."""
        return f"data: {json.dumps(self.to_dict())}\n\n"


@dataclass
class WorkflowContext:
    """
    Tracks the state of an entire workflow execution.
    """
    workflow_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_query: str = ""
    organization: Optional[str] = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    # Tracking
    events: List[AgentEvent] = field(default_factory=list)
    agents_used: List[str] = field(default_factory=list)
    tools_called: List[str] = field(default_factory=list)

    # Metrics
    total_tokens: Dict[str, int] = field(default_factory=lambda: {"input": 0, "output": 0})
    total_cost: float = 0.0

    # Status
    status: EventStatus = EventStatus.PENDING
    error: Optional[str] = None

    def add_event(self, event: AgentEvent) -> None:
        """Add an event to the workflow."""
        self.events.append(event)

        # Track agents and tools
        if event.agent_id not in self.agents_used:
            self.agents_used.append(event.agent_id)

        if event.type in [AgentEventType.TOOL_CALL_START, AgentEventType.TOOL_CALL_COMPLETE]:
            tool_name = event.metadata.get("tool_name")
            if tool_name and tool_name not in self.tools_called:
                self.tools_called.append(tool_name)

        # Aggregate tokens
        if event.tokens_used:
            self.total_tokens["input"] += event.tokens_used.get("input", 0)
            self.total_tokens["output"] += event.tokens_used.get("output", 0)

    def complete(self, status: EventStatus = EventStatus.COMPLETED, error: Optional[str] = None) -> None:
        """Mark the workflow as complete."""
        self.completed_at = datetime.utcnow()
        self.status = status
        self.error = error

    @property
    def duration_ms(self) -> Optional[int]:
        """Calculate total workflow duration."""
        if self.completed_at:
            delta = self.completed_at - self.started_at
            return int(delta.total_seconds() * 1000)
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "workflow_id": self.workflow_id,
            "user_query": self.user_query,
            "organization": self.organization,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
            "status": self.status.value,
            "agents_used": self.agents_used,
            "tools_called": self.tools_called,
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
            "error": self.error,
            "event_count": len(self.events),
        }


class AgentEventEmitter:
    """
    Helper class to emit standardized agent events.

    Usage:
        emitter = AgentEventEmitter(workflow_id="123")

        # Emit workflow start
        yield emitter.workflow_start(query="What devices?", org="Acme")

        # Emit agent thinking
        yield emitter.agent_thinking("orchestrator", "Analyzing query...")

        # Emit tool call
        yield emitter.tool_start("list_devices", {"org": "Acme"})
        yield emitter.tool_complete("list_devices", success=True, data=devices)
    """

    def __init__(self, workflow_id: Optional[str] = None):
        self.workflow_id = workflow_id or str(uuid.uuid4())
        self.context = WorkflowContext(workflow_id=self.workflow_id)
        self._agent_counter = 0

    def _next_agent_id(self, agent_type: AgentType) -> str:
        """Generate unique agent ID."""
        self._agent_counter += 1
        return f"{agent_type.value}_{self._agent_counter}"

    def workflow_start(self, query: str, organization: Optional[str] = None) -> str:
        """Emit workflow start event."""
        self.context.user_query = query
        self.context.organization = organization
        self.context.status = EventStatus.RUNNING

        event = AgentEvent(
            type=AgentEventType.WORKFLOW_START,
            agent_id="system",
            agent_type=AgentType.ORCHESTRATOR,
            workflow_id=self.workflow_id,
            status=EventStatus.RUNNING,
            metadata={
                "query": query[:200],  # Truncate for event
                "organization": organization,
            }
        )
        self.context.add_event(event)
        return event.to_sse()

    def workflow_complete(self, success: bool = True, error: Optional[str] = None) -> str:
        """Emit workflow complete event."""
        status = EventStatus.COMPLETED if success else EventStatus.ERROR
        self.context.complete(status, error)

        event = AgentEvent(
            type=AgentEventType.WORKFLOW_COMPLETE,
            agent_id="system",
            agent_type=AgentType.ORCHESTRATOR,
            workflow_id=self.workflow_id,
            status=status,
            duration_ms=self.context.duration_ms,
            tokens_used=self.context.total_tokens,
            error=error,
            metadata={
                "agents_used": self.context.agents_used,
                "tools_called": self.context.tools_called,
                "total_cost": self.context.total_cost,
            }
        )
        self.context.add_event(event)
        return event.to_sse()

    def agent_spawn(self, agent_type: AgentType, purpose: str) -> tuple[str, str]:
        """Emit agent spawn event. Returns (agent_id, sse_event)."""
        agent_id = self._next_agent_id(agent_type)

        event = AgentEvent(
            type=AgentEventType.AGENT_SPAWN,
            agent_id=agent_id,
            agent_type=agent_type,
            workflow_id=self.workflow_id,
            status=EventStatus.RUNNING,
            metadata={"purpose": purpose}
        )
        self.context.add_event(event)
        return agent_id, event.to_sse()

    def agent_thinking(self, agent_id: str, agent_type: AgentType, thought: str, confidence: Optional[float] = None) -> str:
        """Emit agent thinking event."""
        event = AgentEvent(
            type=AgentEventType.AGENT_THINKING,
            agent_id=agent_id,
            agent_type=agent_type,
            workflow_id=self.workflow_id,
            status=EventStatus.RUNNING,
            metadata={
                "thought": thought[:500],  # Truncate
                "confidence": confidence,
            }
        )
        self.context.add_event(event)
        return event.to_sse()

    def tool_start(self, agent_id: str, agent_type: AgentType, tool_name: str, parameters: Dict[str, Any], reason: Optional[str] = None) -> str:
        """Emit tool call start event."""
        event = AgentEvent(
            type=AgentEventType.TOOL_CALL_START,
            agent_id=agent_id,
            agent_type=agent_type,
            workflow_id=self.workflow_id,
            status=EventStatus.RUNNING,
            metadata={
                "tool_name": tool_name,
                "parameters": {k: str(v)[:100] for k, v in parameters.items()},  # Truncate values
                "reason": reason,
            }
        )
        self.context.add_event(event)
        return event.to_sse()

    def tool_complete(self, agent_id: str, agent_type: AgentType, tool_name: str, success: bool,
                      result_summary: Optional[str] = None, duration_ms: Optional[int] = None,
                      error: Optional[str] = None) -> str:
        """Emit tool call complete event."""
        event = AgentEvent(
            type=AgentEventType.TOOL_CALL_COMPLETE if success else AgentEventType.TOOL_CALL_ERROR,
            agent_id=agent_id,
            agent_type=agent_type,
            workflow_id=self.workflow_id,
            status=EventStatus.COMPLETED if success else EventStatus.ERROR,
            duration_ms=duration_ms,
            error=error,
            metadata={
                "tool_name": tool_name,
                "success": success,
                "result_summary": result_summary[:200] if result_summary else None,
            }
        )
        self.context.add_event(event)
        return event.to_sse()

    def agent_handoff(self, from_agent: str, from_type: AgentType,
                      to_agent: str, to_type: AgentType, context_summary: str) -> str:
        """Emit agent handoff event."""
        event = AgentEvent(
            type=AgentEventType.AGENT_HANDOFF,
            agent_id=from_agent,
            agent_type=from_type,
            workflow_id=self.workflow_id,
            status=EventStatus.COMPLETED,
            metadata={
                "to_agent": to_agent,
                "to_type": to_type.value,
                "context_summary": context_summary[:300],
            }
        )
        self.context.add_event(event)
        return event.to_sse()

    def agent_response(self, agent_id: str, agent_type: AgentType,
                       response_preview: str, tokens: Optional[Dict[str, int]] = None) -> str:
        """Emit agent response event."""
        event = AgentEvent(
            type=AgentEventType.AGENT_RESPONSE,
            agent_id=agent_id,
            agent_type=agent_type,
            workflow_id=self.workflow_id,
            status=EventStatus.COMPLETED,
            tokens_used=tokens,
            metadata={
                "response_preview": response_preview[:300],
            }
        )
        self.context.add_event(event)
        return event.to_sse()

    def text_delta(self, text: str) -> str:
        """Emit text delta (streaming text) - maintains compatibility with existing frontend."""
        return f"data: {json.dumps({'type': 'text_delta', 'text': text})}\n\n"

    def done(self, usage: Dict[str, int], tools_used: List[str]) -> str:
        """Emit done event - maintains compatibility with existing frontend."""
        self.context.total_tokens = usage
        return f"data: {json.dumps({'type': 'done', 'usage': usage, 'tools_used': tools_used, 'workflow': self.context.to_dict()})}\n\n"

    def error(self, message: str, code: Optional[str] = None) -> str:
        """Emit error event."""
        self.context.complete(EventStatus.ERROR, message)
        return f"data: {json.dumps({'type': 'error', 'error': message, 'code': code})}\n\n"
