"""
A2A Types - Compatibility Shim

This module provides backward compatibility for A2A type imports.
The types are imported from the archived location since they are
still needed by some endpoints for request/response models.

The A2A orchestration functionality is archived, but the types
remain accessible for API compatibility.
"""

# Import types from archived location
try:
    from src.a2a_archived.types import (
        TaskState,
        AgentProvider,
        AgentCapabilities,
        AgentSkill,
        AgentInterface,
        AgentCard,
        A2AMessage,
        TextPart,
        DataPart,
        ToolCallPart,
        ToolResultPart,
        Task,
        TaskHistory,
        TaskArtifact,
        PushNotificationConfig,
        AuthenticationInfo,
    )
except ImportError as e:
    # If archived types fail to import, provide minimal stubs
    import logging
    from enum import Enum
    from dataclasses import dataclass, field
    from typing import List, Dict, Optional, Any

    logger = logging.getLogger(__name__)
    logger.warning(f"Could not import A2A types from archive: {e}")

    class TaskState(str, Enum):
        """Minimal stub for TaskState."""
        SUBMITTED = "submitted"
        WORKING = "working"
        INPUT_REQUIRED = "input_required"
        AUTH_REQUIRED = "auth_required"
        COMPLETED = "completed"
        FAILED = "failed"
        CANCELED = "canceled"
        REJECTED = "rejected"

    @dataclass
    class AgentProvider:
        organization: str
        url: Optional[str] = None

    @dataclass
    class AgentCapabilities:
        streaming: bool = False
        pushNotifications: bool = False
        stateTransitionHistory: bool = True

    @dataclass
    class AgentSkill:
        id: str
        name: str
        description: str
        tags: List[str] = field(default_factory=list)
        examples: List[str] = field(default_factory=list)
        inputSchema: Optional[Dict[str, Any]] = None
        outputSchema: Optional[Dict[str, Any]] = None

    @dataclass
    class AgentInterface:
        protocol: str = "jsonrpc/2.0"
        url: Optional[str] = None

    @dataclass
    class AgentCard:
        id: str
        name: str
        description: str
        protocolVersion: str = "0.3"
        provider: Optional[AgentProvider] = None
        capabilities: AgentCapabilities = field(default_factory=AgentCapabilities)
        skills: List[AgentSkill] = field(default_factory=list)
        interfaces: List[AgentInterface] = field(default_factory=list)
        role: Optional[str] = None
        priority: int = 0

    @dataclass
    class A2AMessage:
        role: str
        parts: List[Any] = field(default_factory=list)

    @dataclass
    class TextPart:
        type: str = "text"
        text: str = ""

    @dataclass
    class DataPart:
        type: str = "data"
        data: Any = None

    @dataclass
    class ToolCallPart:
        type: str = "tool_call"
        tool: str = ""
        arguments: Dict[str, Any] = field(default_factory=dict)

    @dataclass
    class ToolResultPart:
        type: str = "tool_result"
        tool: str = ""
        result: Any = None

    @dataclass
    class Task:
        id: str
        state: TaskState = TaskState.SUBMITTED
        messages: List[A2AMessage] = field(default_factory=list)

    @dataclass
    class TaskHistory:
        state: TaskState
        timestamp: str = ""

    @dataclass
    class TaskArtifact:
        type: str
        data: Any = None

    @dataclass
    class PushNotificationConfig:
        url: str
        token: Optional[str] = None

    @dataclass
    class AuthenticationInfo:
        type: str
        credentials: Optional[Dict[str, Any]] = None


__all__ = [
    "TaskState",
    "AgentProvider",
    "AgentCapabilities",
    "AgentSkill",
    "AgentInterface",
    "AgentCard",
    "A2AMessage",
    "TextPart",
    "DataPart",
    "ToolCallPart",
    "ToolResultPart",
    "Task",
    "TaskHistory",
    "TaskArtifact",
    "PushNotificationConfig",
    "AuthenticationInfo",
]
