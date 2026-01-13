"""
A2A Framework - ARCHIVED

This module has been archived and replaced with the Unified Multi-Provider Architecture.
The original code is preserved in src/a2a_archived/ for reference.

If you need A2A functionality, use the unified chat service instead:
    from src.services.unified_chat_service import UnifiedChatService

To restore the A2A framework, see: src/a2a_archived/README.md
"""

import warnings
import sys
from types import ModuleType

# Emit deprecation warning when this module is imported
warnings.warn(
    "The A2A framework has been archived. Use src.services.unified_chat_service instead. "
    "See src/a2a_archived/README.md for details.",
    DeprecationWarning,
    stacklevel=2
)


class ArchivedError(Exception):
    """Raised when attempting to use archived A2A functionality."""
    pass


class _ArchivedModule(ModuleType):
    """Stub module that raises ImportError when attributes are accessed."""

    def __init__(self, name, message=None):
        super().__init__(name)
        self._message = message or f"Module '{name}' has been archived. Use unified_chat_service instead."

    def __getattr__(self, name):
        if name.startswith('_'):
            return super().__getattr__(name)
        raise ImportError(self._message)


# Create stub submodules for all commonly imported A2A modules
# Note: Some modules have actual stub files that provide backward-compatible
# functionality, so they're not in this list:
# - 'feedback' - has its own stub file with usable stubs
# - 'types' - has its own stub file importing from archived
# - 'specialists' - has its own stub package
# - 'specialists.ui' - has its own stub file
_ARCHIVED_SUBMODULES = [
    'orchestrator',
    'enhanced_orchestrator',
    'registry',
    # 'types' - has its own stub file
    'task_manager',
    'memory',
    # 'feedback' - has its own stub file
    'federation',
    'external_client',
    'push_notifications',
    'collaboration',
    'resilience',
    'observability',
    'security',
    'synthesis',
    'response_quality',
    'quality_enhancement',
    'context_embeddings',
    'multi_turn_protocol',
    'card_generator_agent',
    'agent_dependencies',
    # 'specialists' - has its own stub package
    # 'specialists.ui' - has its own stub file
    'specialists.meraki',
    'specialists.catalyst',
    'specialists.thousandeyes',
    'specialists.splunk',
    'specialists.gateway_agent',
    'specialists.knowledge_agent',
    'specialists.clarification_agent',
    'specialists.base_specialist',
]

# Register stub modules in sys.modules
for submodule in _ARCHIVED_SUBMODULES:
    full_name = f"src.a2a.{submodule}"
    if full_name not in sys.modules:
        sys.modules[full_name] = _ArchivedModule(
            full_name,
            f"The A2A module '{submodule}' has been archived. "
            f"Use src.services.unified_chat_service or src.services.tool_registry instead."
        )


# Provide stub classes for direct imports
class EnhancedOrchestrator:
    """Stub for archived EnhancedOrchestrator."""
    def __init__(self, *args, **kwargs):
        raise ArchivedError(
            "EnhancedOrchestrator has been archived. "
            "Use UnifiedChatService from src.services.unified_chat_service instead."
        )


class AgentOrchestrator:
    """Stub for archived AgentOrchestrator."""
    def __init__(self, *args, **kwargs):
        raise ArchivedError(
            "AgentOrchestrator has been archived. "
            "Use UnifiedChatService from src.services.unified_chat_service instead."
        )


class AgentRegistry:
    """Stub for archived AgentRegistry."""
    def __init__(self, *args, **kwargs):
        raise ArchivedError(
            "AgentRegistry has been archived. "
            "Use ToolRegistry from src.services.tool_registry instead."
        )


def initialize_default_agents():
    """Stub for archived function."""
    raise ArchivedError("A2A agents have been archived. Use ToolRegistry instead.")


def get_agent_registry():
    """Stub for archived function."""
    raise ArchivedError("A2A registry has been archived. Use ToolRegistry instead.")


def get_enhanced_orchestrator():
    """Stub for archived function."""
    raise ArchivedError("A2A orchestrator has been archived. Use UnifiedChatService instead.")


def get_orchestrator():
    """Stub for archived function."""
    raise ArchivedError("A2A orchestrator has been archived. Use UnifiedChatService instead.")


# Export stubs
__all__ = [
    "EnhancedOrchestrator",
    "AgentOrchestrator",
    "AgentRegistry",
    "ArchivedError",
    "initialize_default_agents",
    "get_agent_registry",
    "get_enhanced_orchestrator",
    "get_orchestrator",
]
