"""
Streaming protocol for AI chat with event sequencing.

This module provides standardized stream events with proper sequencing,
heartbeat support, and error recovery.
"""

import json
import time
import logging
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List
from enum import Enum

logger = logging.getLogger(__name__)


class EventType(Enum):
    """Types of stream events."""
    # Content events
    TEXT_DELTA = "text_delta"
    TEXT_DONE = "text_done"

    # Tool events
    TOOL_START = "tool_start"
    TOOL_PROGRESS = "tool_progress"
    TOOL_RESULT = "tool_result"
    TOOL_ERROR = "tool_error"

    # Canvas events
    ARTIFACT_CREATE = "artifact_create"
    ARTIFACT_UPDATE = "artifact_update"

    # Meta events
    HEARTBEAT = "heartbeat"
    DONE = "done"
    ERROR = "error"

    # Control events
    RETRY = "retry"
    CANCEL = "cancel"


@dataclass
class StreamEvent:
    """Standardized stream event with sequencing."""
    type: EventType
    sequence: int
    timestamp: float
    data: Dict[str, Any]

    # Optional fields for specific event types
    tool_id: Optional[str] = None
    artifact_id: Optional[int] = None
    is_recoverable: bool = True
    retry_after_ms: Optional[int] = None

    def to_sse(self) -> str:
        """Convert to Server-Sent Events format."""
        event_data = {
            "type": self.type.value,
            "seq": self.sequence,
            "ts": self.timestamp,
            **self.data,
        }

        if self.tool_id:
            event_data["tool_id"] = self.tool_id
        if self.artifact_id:
            event_data["artifact_id"] = self.artifact_id
        if not self.is_recoverable:
            event_data["recoverable"] = False
        if self.retry_after_ms:
            event_data["retry_after"] = self.retry_after_ms

        return f"data: {json.dumps(event_data)}\n\n"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "type": self.type.value,
            "sequence": self.sequence,
            "timestamp": self.timestamp,
            **self.data,
        }
        if self.tool_id:
            result["tool_id"] = self.tool_id
        if self.artifact_id:
            result["artifact_id"] = self.artifact_id
        return result


class StreamManager:
    """Manages stream state and event sequencing."""

    def __init__(self, stream_id: str):
        """Initialize stream manager.

        Args:
            stream_id: Unique identifier for this stream
        """
        self.stream_id = stream_id
        self.sequence = 0
        self.start_time = time.time()
        self.last_event_time = time.time()
        self.is_cancelled = False
        self.events_sent: List[StreamEvent] = []

    def create_event(
        self,
        event_type: EventType,
        data: Dict[str, Any],
        **kwargs
    ) -> StreamEvent:
        """Create a sequenced event.

        Args:
            event_type: Type of event
            data: Event data payload
            **kwargs: Additional event fields

        Returns:
            StreamEvent with incremented sequence number
        """
        self.sequence += 1
        self.last_event_time = time.time()

        event = StreamEvent(
            type=event_type,
            sequence=self.sequence,
            timestamp=time.time(),
            data=data,
            **kwargs
        )

        self.events_sent.append(event)
        return event

    def text_delta(self, text: str) -> StreamEvent:
        """Create text delta event."""
        return self.create_event(EventType.TEXT_DELTA, {"text": text})

    def tool_start(self, tool_id: str, tool_name: str, inputs: Dict = None) -> StreamEvent:
        """Create tool start event."""
        return self.create_event(
            EventType.TOOL_START,
            {"tool": tool_name, "inputs": inputs or {}},
            tool_id=tool_id
        )

    def tool_progress(self, tool_id: str, progress: int, message: str = None) -> StreamEvent:
        """Create tool progress event."""
        data = {"progress": progress}
        if message:
            data["message"] = message
        return self.create_event(
            EventType.TOOL_PROGRESS,
            data,
            tool_id=tool_id
        )

    def tool_result(
        self,
        tool_id: str,
        tool_name: str,
        result: Any,
        success: bool,
        error: str = None,
        execution_time_ms: int = None
    ) -> StreamEvent:
        """Create tool result event."""
        data = {
            "tool": tool_name,
            "result": result,
            "success": success,
        }
        if error:
            data["error"] = error
        if execution_time_ms is not None:
            data["execution_time_ms"] = execution_time_ms

        return self.create_event(
            EventType.TOOL_RESULT,
            data,
            tool_id=tool_id
        )

    def tool_error(self, tool_id: str, tool_name: str, error: str) -> StreamEvent:
        """Create tool error event."""
        return self.create_event(
            EventType.TOOL_ERROR,
            {"tool": tool_name, "error": error},
            tool_id=tool_id
        )

    def artifact_create(
        self,
        artifact_id: int,
        artifact_type: str,
        title: str,
        content: Any
    ) -> StreamEvent:
        """Create artifact creation event."""
        return self.create_event(
            EventType.ARTIFACT_CREATE,
            {
                "artifact_type": artifact_type,
                "title": title,
                "content": content,
            },
            artifact_id=artifact_id
        )

    def artifact_update(
        self,
        artifact_id: int,
        updates: Dict[str, Any]
    ) -> StreamEvent:
        """Create artifact update event."""
        return self.create_event(
            EventType.ARTIFACT_UPDATE,
            {"updates": updates},
            artifact_id=artifact_id
        )

    def heartbeat(self) -> StreamEvent:
        """Create heartbeat event."""
        return self.create_event(EventType.HEARTBEAT, {
            "elapsed_ms": int((time.time() - self.start_time) * 1000),
            "events_sent": len(self.events_sent),
        })

    def done(
        self,
        usage: Dict = None,
        tool_data: List = None,
        model: str = None
    ) -> StreamEvent:
        """Create done event."""
        return self.create_event(EventType.DONE, {
            "usage": usage or {},
            "tool_data": tool_data or [],
            "model": model,
            "total_events": self.sequence,
            "duration_ms": int((time.time() - self.start_time) * 1000),
        })

    def error(
        self,
        message: str,
        recoverable: bool = True,
        retry_after_ms: int = None
    ) -> StreamEvent:
        """Create error event."""
        return self.create_event(
            EventType.ERROR,
            {"error": message},
            is_recoverable=recoverable,
            retry_after_ms=retry_after_ms
        )

    def cancel(self) -> StreamEvent:
        """Create cancel event and mark stream as cancelled."""
        self.is_cancelled = True
        return self.create_event(EventType.CANCEL, {
            "elapsed_ms": int((time.time() - self.start_time) * 1000),
        })

    @property
    def elapsed_ms(self) -> int:
        """Get elapsed time since stream start in milliseconds."""
        return int((time.time() - self.start_time) * 1000)

    @property
    def idle_ms(self) -> int:
        """Get time since last event in milliseconds."""
        return int((time.time() - self.last_event_time) * 1000)
