"""Specialist Agents for Multi-Agent Network Management.

This package contains specialist agents that wrap specific API services
and provide domain-specific skills to the orchestrator.

Specialist Agents:
- KnowledgeAgent: Cisco knowledge base using RAG + Cisco Circuit
- MerakiAgent: Meraki Dashboard API operations
- ThousandEyesAgent: ThousandEyes monitoring API operations
- CatalystAgent: Catalyst Center (DNAC) API operations
- SplunkAgent: Splunk log analysis API operations
- UIAgent: Canvas UI card generation
- ClarificationAgent: Handles greetings, help, and ambiguous queries

Usage:
    from src.a2a.specialists import register_all_specialists

    # In app startup
    register_all_specialists()
"""

import logging
from typing import List, Dict, Any

from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    AgentDependency,
    SkillResult,
)

logger = logging.getLogger(__name__)

# Will be populated as agents are created
_registered_specialists: Dict[str, BaseSpecialistAgent] = {}


def register_all_specialists() -> List[str]:
    """Register all specialist agents with the A2A registry.

    This should be called during application startup.

    Returns:
        List of registered agent IDs
    """
    registered = []

    # Import and register each specialist
    # Knowledge Agent first (for best practices, troubleshooting guidance)
    try:
        from .knowledge_agent import KnowledgeAgent
        agent = KnowledgeAgent()
        agent.register()
        _registered_specialists[agent.AGENT_ID] = agent
        registered.append(agent.AGENT_ID)
    except ImportError as e:
        logger.warning(f"Could not load KnowledgeAgent: {e}")
    except Exception as e:
        logger.error(f"Failed to register KnowledgeAgent: {e}")

    try:
        from .meraki_agent import MerakiAgent
        agent = MerakiAgent()
        agent.register()
        _registered_specialists[agent.AGENT_ID] = agent
        registered.append(agent.AGENT_ID)
    except ImportError as e:
        logger.warning(f"Could not load MerakiAgent: {e}")
    except Exception as e:
        logger.error(f"Failed to register MerakiAgent: {e}")

    try:
        from .thousandeyes_agent import ThousandEyesAgent
        agent = ThousandEyesAgent()
        agent.register()
        _registered_specialists[agent.AGENT_ID] = agent
        registered.append(agent.AGENT_ID)
    except ImportError as e:
        logger.warning(f"Could not load ThousandEyesAgent: {e}")
    except Exception as e:
        logger.error(f"Failed to register ThousandEyesAgent: {e}")

    try:
        from .catalyst_agent import CatalystAgent
        agent = CatalystAgent()
        agent.register()
        _registered_specialists[agent.AGENT_ID] = agent
        registered.append(agent.AGENT_ID)
    except ImportError as e:
        logger.warning(f"Could not load CatalystAgent: {e}")
    except Exception as e:
        logger.error(f"Failed to register CatalystAgent: {e}")

    try:
        from .splunk_agent import SplunkAgent
        agent = SplunkAgent()
        agent.register()
        _registered_specialists[agent.AGENT_ID] = agent
        registered.append(agent.AGENT_ID)
    except ImportError as e:
        logger.warning(f"Could not load SplunkAgent: {e}")
    except Exception as e:
        logger.error(f"Failed to register SplunkAgent: {e}")

    try:
        from .ui_agent import UIAgent
        agent = UIAgent()
        agent.register()
        _registered_specialists[agent.AGENT_ID] = agent
        registered.append(agent.AGENT_ID)
    except ImportError as e:
        logger.warning(f"Could not load UIAgent: {e}")
    except Exception as e:
        logger.error(f"Failed to register UIAgent: {e}")

    try:
        from .clarification_agent import ClarificationAgent
        agent = ClarificationAgent()
        agent.register()
        _registered_specialists[agent.AGENT_ID] = agent
        registered.append(agent.AGENT_ID)
    except ImportError as e:
        logger.warning(f"Could not load ClarificationAgent: {e}")
    except Exception as e:
        logger.error(f"Failed to register ClarificationAgent: {e}")

    logger.info(f"[Specialists] Registered {len(registered)} specialist agents: {registered}")
    return registered


def get_specialist(agent_id: str) -> BaseSpecialistAgent:
    """Get a registered specialist by ID.

    Args:
        agent_id: The agent ID

    Returns:
        The specialist agent instance

    Raises:
        KeyError: If agent not found
    """
    if agent_id not in _registered_specialists:
        raise KeyError(f"Specialist not registered: {agent_id}")
    return _registered_specialists[agent_id]


def get_all_specialists() -> Dict[str, BaseSpecialistAgent]:
    """Get all registered specialists.

    Returns:
        Dict mapping agent IDs to specialist instances
    """
    return _registered_specialists.copy()


def unregister_all_specialists() -> None:
    """Unregister all specialist agents.

    This should be called during application shutdown.
    """
    for agent_id, agent in list(_registered_specialists.items()):
        try:
            agent.unregister()
        except Exception as e:
            logger.error(f"Failed to unregister {agent_id}: {e}")

    _registered_specialists.clear()
    logger.info("[Specialists] Unregistered all specialist agents")


__all__ = [
    # Base classes
    "BaseSpecialistAgent",
    "AgentExecutionContext",
    "AgentDependency",
    "SkillResult",
    # Registration functions
    "register_all_specialists",
    "unregister_all_specialists",
    "get_specialist",
    "get_all_specialists",
]
