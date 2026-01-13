"""
Base classes and utilities for Meraki skill modules.

This module provides the foundation for organizing 500+ Meraki API operations
into logical, maintainable modules. Each module (organizations, networks, etc.)
inherits from MerakiSkillModule and implements its skills.
"""

import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass

from src.a2a.types import AgentSkill
from src.a2a.specialists.base_specialist import (
    AgentExecutionContext,
    SkillResult,
)
from src.services.meraki_api import MerakiAPIClient

logger = logging.getLogger(__name__)


@dataclass
class SkillDefinition:
    """Defines a Meraki API skill with its handler."""
    skill: AgentSkill
    handler: Callable[..., Awaitable[SkillResult]]
    http_method: str = "GET"
    endpoint_template: str = ""


class MerakiSkillModule(ABC):
    """Base class for Meraki skill modules.

    Each module (organizations, networks, devices, etc.) inherits from this
    class and registers its skills. The main MerakiAgent aggregates skills
    from all modules.

    Example:
        class OrganizationsModule(MerakiSkillModule):
            MODULE_NAME = "organizations"

            @classmethod
            def get_skills(cls) -> List[AgentSkill]:
                return [
                    AgentSkill(
                        id="organizations_list",
                        name="List Organizations",
                        ...
                    ),
                ]

            @classmethod
            async def execute(cls, skill_id, client, params, context):
                if skill_id == "organizations_list":
                    return await cls._list_organizations(client, params, context)
    """

    # Subclasses must define this
    MODULE_NAME: str = "base"
    MODULE_PREFIX: str = ""  # Skill ID prefix for routing

    # Skill registry - populated by subclasses
    _skills: List[AgentSkill] = []
    _handlers: Dict[str, Callable] = {}

    @classmethod
    @abstractmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Return all skills provided by this module.

        Returns:
            List of AgentSkill definitions
        """
        pass

    @classmethod
    @abstractmethod
    async def execute(
        cls,
        skill_id: str,
        client: MerakiAPIClient,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a skill from this module.

        Args:
            skill_id: The skill ID to execute
            client: Authenticated MerakiAPIClient
            params: Parameters for the skill
            context: Execution context with credentials and cache

        Returns:
            SkillResult with data or error
        """
        pass

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        """Check if this module handles a given skill ID.

        Args:
            skill_id: Skill ID to check

        Returns:
            True if this module handles the skill
        """
        if cls.MODULE_PREFIX:
            return skill_id.startswith(cls.MODULE_PREFIX)

        # Check against registered skills
        skill_ids = [s.id for s in cls.get_skills()]
        return skill_id in skill_ids

    @classmethod
    def get_skill_ids(cls) -> List[str]:
        """Get all skill IDs from this module."""
        return [s.id for s in cls.get_skills()]


# =============================================================================
# Utility Functions
# =============================================================================

def create_skill(
    id: str,
    name: str,
    description: str,
    tags: List[str],
    examples: List[str],
    input_schema: Optional[Dict[str, Any]] = None,
) -> AgentSkill:
    """Helper to create AgentSkill with consistent defaults.

    Args:
        id: Unique skill identifier
        name: Human-readable name
        description: What the skill does
        tags: Tags for routing (always includes "meraki")
        examples: Example queries that trigger this skill
        input_schema: Optional JSON schema for inputs

    Returns:
        AgentSkill instance
    """
    # Ensure "meraki" tag is always present
    if "meraki" not in tags:
        tags = ["meraki"] + tags

    return AgentSkill(
        id=id,
        name=name,
        description=description,
        tags=tags,
        examples=examples,
        inputSchema=input_schema,
    )


def build_input_schema(
    properties: Dict[str, Dict[str, Any]],
    required: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Helper to build JSON schema for skill inputs.

    Args:
        properties: Property definitions
        required: List of required property names

    Returns:
        JSON schema dict
    """
    schema = {
        "type": "object",
        "properties": properties,
    }
    if required:
        schema["required"] = required
    return schema


# Common input schemas
ORG_ID_SCHEMA = build_input_schema(
    {"organization_id": {"type": "string", "description": "Organization ID"}},
    required=["organization_id"]
)

NETWORK_ID_SCHEMA = build_input_schema(
    {"network_id": {"type": "string", "description": "Network ID"}},
    required=["network_id"]
)

DEVICE_SERIAL_SCHEMA = build_input_schema(
    {"serial": {"type": "string", "description": "Device serial number"}},
    required=["serial"]
)

ORG_AND_NETWORK_SCHEMA = build_input_schema(
    {
        "organization_id": {"type": "string", "description": "Organization ID"},
        "network_id": {"type": "string", "description": "Network ID (optional)"},
    },
    required=["organization_id"]
)


# =============================================================================
# Response Helpers
# =============================================================================

def success_result(
    data: Any,
    entities: Optional[Dict[str, Any]] = None,
    follow_up: Optional[str] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> SkillResult:
    """Create a successful SkillResult.

    Args:
        data: Result data
        entities: Extracted entities for follow-up
        follow_up: Suggested follow-up question
        input_tokens: Input token count (if AI used)
        output_tokens: Output token count (if AI used)

    Returns:
        SkillResult with success=True
    """
    return SkillResult(
        success=True,
        data=data,
        entities_extracted=entities or {},
        suggested_follow_up=follow_up,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


def error_result(
    error: str,
    suggested_follow_up: Optional[str] = None
) -> SkillResult:
    """Create an error SkillResult.

    Args:
        error: Error message
        suggested_follow_up: Suggestion for recovery

    Returns:
        SkillResult with success=False
    """
    return SkillResult(
        success=False,
        error=error,
        suggested_follow_up=suggested_follow_up,
    )


def empty_result(
    message: str,
    searched_params: Optional[Dict[str, Any]] = None,
    is_positive: bool = False
) -> SkillResult:
    """Create a result for empty data scenarios.

    Args:
        message: Explanation message
        searched_params: Parameters that were searched
        is_positive: Whether empty is good (e.g., no errors)

    Returns:
        SkillResult with empty data but helpful context
    """
    data = {
        "items": [],
        "count": 0,
        "note": message,
    }
    if searched_params:
        data["searched_params"] = searched_params
    if is_positive:
        data["status"] = "healthy"

    return SkillResult(
        success=True,
        data=data,
    )


# =============================================================================
# Entity Extraction Helpers
# =============================================================================

def extract_org_entities(data: Any) -> Dict[str, Any]:
    """Extract organization-related entities from response data."""
    entities = {
        "organization_ids": [],
        "organization_names": [],
    }

    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

    for item in items:
        if isinstance(item, dict):
            if "id" in item:
                entities["organization_ids"].append(item["id"])
            if "name" in item:
                entities["organization_names"].append(item["name"])

    return {k: v for k, v in entities.items() if v}


def extract_network_entities(data: Any) -> Dict[str, Any]:
    """Extract network-related entities from response data."""
    entities = {
        "network_ids": [],
        "network_names": [],
    }

    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

    for item in items:
        if isinstance(item, dict):
            if "id" in item:
                entities["network_ids"].append(item["id"])
            if "name" in item:
                entities["network_names"].append(item["name"])

    return {k: v for k, v in entities.items() if v}


def extract_device_entities(data: Any) -> Dict[str, Any]:
    """Extract device-related entities from response data."""
    entities = {
        "device_serials": [],
        "device_names": [],
        "device_models": [],
    }

    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

    for item in items:
        if isinstance(item, dict):
            if "serial" in item:
                entities["device_serials"].append(item["serial"])
            if "name" in item:
                entities["device_names"].append(item["name"])
            if "model" in item:
                entities["device_models"].append(item["model"])

    return {k: v for k, v in entities.items() if v}


# =============================================================================
# API Request Helpers
# =============================================================================

async def api_get(
    client: MerakiAPIClient,
    endpoint: str,
    params: Optional[Dict[str, Any]] = None
) -> Any:
    """Make a GET request and return JSON data.

    Args:
        client: MerakiAPIClient instance
        endpoint: API endpoint path
        params: Query parameters

    Returns:
        JSON response data

    Raises:
        Exception on API error
    """
    response = await client.request("GET", endpoint, params=params)
    return response.json()


async def api_post(
    client: MerakiAPIClient,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None
) -> Any:
    """Make a POST request and return JSON data.

    Args:
        client: MerakiAPIClient instance
        endpoint: API endpoint path
        data: Request body
        params: Query parameters

    Returns:
        JSON response data
    """
    response = await client.request("POST", endpoint, json_data=data, params=params)
    return response.json()


async def api_put(
    client: MerakiAPIClient,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None
) -> Any:
    """Make a PUT request and return JSON data.

    Args:
        client: MerakiAPIClient instance
        endpoint: API endpoint path
        data: Request body

    Returns:
        JSON response data
    """
    response = await client.request("PUT", endpoint, json_data=data)
    return response.json()


async def api_delete(
    client: MerakiAPIClient,
    endpoint: str
) -> bool:
    """Make a DELETE request.

    Args:
        client: MerakiAPIClient instance
        endpoint: API endpoint path

    Returns:
        True if successful
    """
    await client.request("DELETE", endpoint)
    return True


# =============================================================================
# Logging Helpers
# =============================================================================

def log_skill_start(module: str, skill_id: str, params: Dict[str, Any]) -> None:
    """Log skill execution start."""
    logger.info(f"[Meraki:{module}] Executing {skill_id} with params: {list(params.keys())}")


def log_skill_success(module: str, skill_id: str, result_count: Optional[int] = None) -> None:
    """Log skill execution success."""
    if result_count is not None:
        logger.info(f"[Meraki:{module}] {skill_id} completed: {result_count} items")
    else:
        logger.info(f"[Meraki:{module}] {skill_id} completed successfully")


def log_skill_error(module: str, skill_id: str, error: str) -> None:
    """Log skill execution error."""
    logger.error(f"[Meraki:{module}] {skill_id} failed: {error}")
