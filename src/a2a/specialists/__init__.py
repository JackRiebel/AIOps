"""
A2A Specialists - Compatibility Shim

This module provides backward compatibility for A2A specialist imports.
The actual specialist code is archived in src/a2a_archived/specialists/.

UI modules (for cards) are still accessible for functionality.
Agent orchestration specialists are deprecated.
"""


def register_all_specialists():
    """
    Stub for archived function.

    Returns empty list since A2A specialists are no longer registered.
    The unified architecture uses ToolRegistry instead.
    """
    return []


__all__ = ["register_all_specialists"]
