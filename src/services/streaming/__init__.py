"""
Streaming protocol package for AI chat.

This package provides reliable streaming with event sequencing,
heartbeats, and error recovery.
"""

from .protocol import EventType, StreamEvent, StreamManager

__all__ = ["EventType", "StreamEvent", "StreamManager"]
