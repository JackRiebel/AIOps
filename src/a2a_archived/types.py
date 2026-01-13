"""A2A Protocol Type Definitions.

Based on the A2A Protocol Specification v0.3:
https://a2a-protocol.org/latest/specification/
"""

from enum import Enum
from typing import List, Dict, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
import uuid


class TaskState(str, Enum):
    """Task lifecycle states per A2A spec v0.3.

    Complete state machine:
    - SUBMITTED: Initial state when task is created
    - WORKING: Agent is actively processing
    - INPUT_REQUIRED: Agent needs additional input from client
    - AUTH_REQUIRED: Out-of-band authentication needed
    - COMPLETED: Task finished successfully
    - FAILED: Task failed with error
    - CANCELED: Task was canceled by client
    - REJECTED: Agent declined to handle the task
    """
    SUBMITTED = "submitted"
    WORKING = "working"
    INPUT_REQUIRED = "input_required"
    AUTH_REQUIRED = "auth_required"  # NEW: Out-of-band auth needed
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"
    REJECTED = "rejected"  # NEW: Agent declined to handle task

    @classmethod
    def terminal_states(cls) -> set:
        """Return states that represent task completion."""
        return {cls.COMPLETED, cls.FAILED, cls.CANCELED, cls.REJECTED}

    @classmethod
    def active_states(cls) -> set:
        """Return states where task is still in progress."""
        return {cls.SUBMITTED, cls.WORKING, cls.INPUT_REQUIRED, cls.AUTH_REQUIRED}

    def is_terminal(self) -> bool:
        """Check if this state is terminal (no further transitions)."""
        return self in self.terminal_states()

    def is_active(self) -> bool:
        """Check if task is still active/in-progress."""
        return self in self.active_states()


@dataclass
class AgentProvider:
    """Information about the agent's publisher/developer."""
    organization: str
    url: Optional[str] = None


@dataclass
class AgentCapabilities:
    """Declares supported A2A features."""
    streaming: bool = False
    pushNotifications: bool = False
    stateTransitionHistory: bool = True


@dataclass
class AgentSkill:
    """Describes a specific capability/skill the agent can perform.

    Skills are the key to dynamic routing - agents advertise their skills,
    and clients query for agents that can handle specific skill types.
    """
    id: str
    name: str
    description: str
    # Tags for semantic matching (e.g., "best-practices", "troubleshooting", "configuration")
    tags: List[str] = field(default_factory=list)
    # Example queries this skill can handle
    examples: List[str] = field(default_factory=list)
    # Input schema (optional, for structured inputs)
    inputSchema: Optional[Dict[str, Any]] = None
    # Output schema (optional, for structured outputs)
    outputSchema: Optional[Dict[str, Any]] = None


@dataclass
class AgentInterface:
    """Protocol binding information."""
    protocol: str = "jsonrpc/2.0"
    url: Optional[str] = None


@dataclass
class AgentCard:
    """Agent Card - the core discovery document for A2A.

    Served at /.well-known/agent.json for external discovery,
    but also used internally for agent registration.
    """
    id: str
    name: str
    description: str
    protocolVersion: str = "0.3"

    # Agent metadata
    provider: Optional[AgentProvider] = None
    capabilities: AgentCapabilities = field(default_factory=AgentCapabilities)

    # Skills this agent can perform
    skills: List[AgentSkill] = field(default_factory=list)

    # Protocol bindings
    interfaces: List[AgentInterface] = field(default_factory=list)

    # Role definition (extension for internal use)
    role: Optional[str] = None  # e.g., "knowledge", "implementation", "orchestrator"

    # Priority for skill matching (higher = preferred)
    priority: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        result = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "protocolVersion": self.protocolVersion,
            "capabilities": {
                "streaming": self.capabilities.streaming,
                "pushNotifications": self.capabilities.pushNotifications,
                "stateTransitionHistory": self.capabilities.stateTransitionHistory,
            },
            "skills": [
                {
                    "id": skill.id,
                    "name": skill.name,
                    "description": skill.description,
                    "tags": skill.tags,
                    "examples": skill.examples,
                }
                for skill in self.skills
            ],
            "interfaces": [
                {"protocol": iface.protocol, "url": iface.url}
                for iface in self.interfaces
            ],
        }
        if self.provider:
            result["provider"] = {
                "organization": self.provider.organization,
                "url": self.provider.url,
            }
        if self.role:
            result["role"] = self.role
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentCard":
        """Create AgentCard from dict."""
        provider = None
        if "provider" in data:
            provider = AgentProvider(
                organization=data["provider"].get("organization", ""),
                url=data["provider"].get("url"),
            )

        capabilities = AgentCapabilities()
        if "capabilities" in data:
            caps = data["capabilities"]
            capabilities = AgentCapabilities(
                streaming=caps.get("streaming", False),
                pushNotifications=caps.get("pushNotifications", False),
                stateTransitionHistory=caps.get("stateTransitionHistory", True),
            )

        skills = []
        for skill_data in data.get("skills", []):
            skills.append(AgentSkill(
                id=skill_data["id"],
                name=skill_data["name"],
                description=skill_data["description"],
                tags=skill_data.get("tags", []),
                examples=skill_data.get("examples", []),
                inputSchema=skill_data.get("inputSchema"),
                outputSchema=skill_data.get("outputSchema"),
            ))

        interfaces = []
        for iface_data in data.get("interfaces", []):
            interfaces.append(AgentInterface(
                protocol=iface_data.get("protocol", "jsonrpc/2.0"),
                url=iface_data.get("url"),
            ))

        return cls(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            protocolVersion=data.get("protocolVersion", "0.3"),
            provider=provider,
            capabilities=capabilities,
            skills=skills,
            interfaces=interfaces,
            role=data.get("role"),
            priority=data.get("priority", 0),
        )


# Message Parts (content types)

@dataclass
class TextPart:
    """Text content in a message."""
    text: str
    type: str = "text"


@dataclass
class FilePart:
    """File content in a message."""
    file: Dict[str, Any]  # Contains name, mimeType, bytes or uri
    type: str = "file"


@dataclass
class DataPart:
    """Structured JSON data in a message."""
    data: Dict[str, Any]
    type: str = "data"


MessagePart = Union[TextPart, FilePart, DataPart]


@dataclass
class A2AMessage:
    """A message in the A2A protocol."""
    role: str  # "user" or "agent"
    parts: List[MessagePart]
    messageId: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # Extension: source agent ID
    sourceAgentId: Optional[str] = None

    # Extension: context for multi-agent routing
    context: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        parts_data = []
        for part in self.parts:
            if isinstance(part, TextPart):
                parts_data.append({"type": "text", "text": part.text})
            elif isinstance(part, FilePart):
                parts_data.append({"type": "file", "file": part.file})
            elif isinstance(part, DataPart):
                parts_data.append({"type": "data", "data": part.data})

        return {
            "messageId": self.messageId,
            "role": self.role,
            "parts": parts_data,
            "timestamp": self.timestamp.isoformat(),
            "sourceAgentId": self.sourceAgentId,
            "context": self.context,
        }


@dataclass
class TaskStatus:
    """Status of an A2A task."""
    state: TaskState
    timestamp: datetime = field(default_factory=datetime.utcnow)
    message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state.value,
            "timestamp": self.timestamp.isoformat(),
            "message": self.message,
        }


@dataclass
class A2ATask:
    """A task in the A2A protocol - represents a unit of work."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    contextId: Optional[str] = None
    status: TaskStatus = field(default_factory=lambda: TaskStatus(state=TaskState.SUBMITTED))

    # The conversation history
    history: List[A2AMessage] = field(default_factory=list)

    # Output artifacts
    artifacts: List[Dict[str, Any]] = field(default_factory=list)

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Extension: which agent(s) handled this task
    handledBy: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "contextId": self.contextId,
            "status": self.status.to_dict(),
            "history": [msg.to_dict() for msg in self.history],
            "artifacts": self.artifacts,
            "metadata": self.metadata,
            "handledBy": self.handledBy,
        }


@dataclass
class A2ARequest:
    """A JSON-RPC style request for A2A communication."""
    method: str
    params: Dict[str, Any]
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    jsonrpc: str = "2.0"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "jsonrpc": self.jsonrpc,
            "id": self.id,
            "method": self.method,
            "params": self.params,
        }


@dataclass
class A2AResponse:
    """A JSON-RPC style response for A2A communication."""
    id: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    jsonrpc: str = "2.0"

    def to_dict(self) -> Dict[str, Any]:
        response = {
            "jsonrpc": self.jsonrpc,
            "id": self.id,
        }
        if self.error:
            response["error"] = self.error
        else:
            response["result"] = self.result
        return response
