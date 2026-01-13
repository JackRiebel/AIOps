"""
Splunk skill modules for the A2A agent system.

This package organizes Splunk operations into logical modules matching
the official Splunk MCP server tools. Each module provides skills that
can be aggregated by the main SplunkAgent.

Modules:
    search - SPL query execution, generation, explanation, optimization
    system - Instance info, indexes, metadata
    users - User information and listing
    kvstore - KV Store collections management
    knowledge - Knowledge objects (saved searches, alerts, lookups, etc.)
    assistant - Natural language questions and help

Official Splunk MCP Tools Reference:
    https://help.splunk.com/en/splunk-cloud-platform/mcp-server-for-splunk-platform/mcp-server-tools
"""

from .base import (
    SplunkSkillModule,
    SplunkAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    empty_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    TIME_RANGE_SCHEMA,
    INDEX_NAME_SCHEMA,
    SEARCH_QUERY_SCHEMA,
    MAX_RESULTS_SCHEMA,
    KNOWLEDGE_OBJECT_TYPE_SCHEMA,
)

# Import skill modules
from .search import SearchModule
from .system import SystemModule
from .users import UsersModule
from .kvstore import KVStoreModule
from .knowledge import KnowledgeModule
from .assistant import AssistantModule

__all__ = [
    # Base classes and utilities
    "SplunkSkillModule",
    "SplunkAPIClient",
    "SkillDefinition",
    "SkillResult",
    "create_skill",
    "success_result",
    "error_result",
    "empty_result",
    "log_skill_start",
    "log_skill_success",
    "log_skill_error",
    # Common schemas
    "TIME_RANGE_SCHEMA",
    "INDEX_NAME_SCHEMA",
    "SEARCH_QUERY_SCHEMA",
    "MAX_RESULTS_SCHEMA",
    "KNOWLEDGE_OBJECT_TYPE_SCHEMA",
    # Skill modules
    "SearchModule",
    "SystemModule",
    "UsersModule",
    "KVStoreModule",
    "KnowledgeModule",
    "AssistantModule",
]
