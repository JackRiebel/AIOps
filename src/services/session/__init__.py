"""
Session management package.

This module provides atomic session operations for thread-safe
session management with database-level locking.
"""

from .atomic import AtomicSessionManager, SessionEvent, get_session_manager

__all__ = [
    "AtomicSessionManager",
    "SessionEvent",
    "get_session_manager",
]
