"""Base module for Splunk skill modules.

Provides shared utilities, base classes, and common schemas for all Splunk skill modules.
"""

import logging
from typing import Any, Dict, List, Optional, TypedDict
from abc import ABC, abstractmethod
from dataclasses import dataclass
import asyncio
import httpx

from src.a2a.types import AgentSkill

logger = logging.getLogger(__name__)


# ============================================================================
# TYPE DEFINITIONS
# ============================================================================

class SkillDefinition(TypedDict, total=False):
    """Type definition for skill configuration."""
    id: str
    name: str
    description: str
    tags: List[str]
    examples: List[str]
    input_schema: Dict[str, Any]


@dataclass
class SkillResult:
    """Result from skill execution."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    entities_extracted: Optional[Dict[str, Any]] = None
    suggested_follow_up: Optional[str] = None
    duration_ms: int = 0
    # Token usage tracking (populated when AI services are used)
    input_tokens: int = 0
    output_tokens: int = 0
    # Artifacts for collaboration (not used by Splunk but required for compatibility)
    artifacts: List[Any] = None  # type: ignore

    def __post_init__(self):
        if self.artifacts is None:
            self.artifacts = []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "entities_extracted": self.entities_extracted or {},
            "suggested_follow_up": self.suggested_follow_up,
            "duration_ms": self.duration_ms,
            "artifact_count": len(self.artifacts) if self.artifacts else 0,
            "usage": {
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
            },
        }


# ============================================================================
# COMMON SCHEMAS
# ============================================================================

# Time range schema
TIME_RANGE_SCHEMA = {
    "type": "string",
    "description": "Time range for the search (e.g., '-24h', '-7d', '-30d')",
    "default": "-24h"
}

# Index name schema
INDEX_NAME_SCHEMA = {
    "type": "string",
    "description": "Name of the Splunk index"
}

# Search query schema
SEARCH_QUERY_SCHEMA = {
    "type": "string",
    "description": "SPL (Search Processing Language) query to execute"
}

# Max results schema
MAX_RESULTS_SCHEMA = {
    "type": "integer",
    "description": "Maximum number of results to return",
    "default": 100
}

# Knowledge object type schema
KNOWLEDGE_OBJECT_TYPE_SCHEMA = {
    "type": "string",
    "description": "Type of knowledge object to retrieve",
    "enum": [
        "saved_searches",
        "alerts",
        "field_extractions",
        "field_aliases",
        "calculated_fields",
        "lookups",
        "automatic_lookups",
        "lookup_transforms",
        "macros",
        "tags",
        "data_models",
        "workflow_actions",
        "views",
        "panels",
        "apps",
        "mltk_models",
        "mltk_algorithms"
    ]
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_skill(skill_def: SkillDefinition) -> AgentSkill:
    """Create an AgentSkill from a skill definition dictionary."""
    return AgentSkill(
        id=skill_def["id"],
        name=skill_def["name"],
        description=skill_def["description"],
        tags=skill_def.get("tags", ["splunk"]),
        examples=skill_def.get("examples", []),
        inputSchema=skill_def.get("input_schema", {
            "type": "object",
            "properties": {},
            "required": []
        }),
    )


def success_result(
    data: Any,
    entities: Optional[Dict[str, Any]] = None,
    follow_up: Optional[str] = None
) -> SkillResult:
    """Create a successful skill result."""
    return SkillResult(
        success=True,
        data=data,
        entities_extracted=entities,
        suggested_follow_up=follow_up
    )


def error_result(message: str) -> SkillResult:
    """Create an error skill result."""
    return SkillResult(
        success=False,
        error=message
    )


def empty_result(message: str = "No data found") -> SkillResult:
    """Create an empty but successful result."""
    return SkillResult(
        success=True,
        data={"message": message, "count": 0}
    )


# ============================================================================
# LOGGING HELPERS
# ============================================================================

def log_skill_start(skill_id: str, params: Dict[str, Any]) -> None:
    """Log skill execution start."""
    safe_params = {k: v for k, v in params.items() if k not in ["api_key", "password", "token"]}
    logger.info(f"[Splunk] Starting skill: {skill_id} with params: {safe_params}")


def log_skill_success(skill_id: str, result: Any) -> None:
    """Log skill execution success."""
    if hasattr(result, 'data') and isinstance(result.data, dict):
        count = result.data.get('count', len(result.data) if isinstance(result.data, list) else 1)
        logger.info(f"[Splunk] Skill {skill_id} completed successfully. Items: {count}")
    else:
        logger.info(f"[Splunk] Skill {skill_id} completed successfully")


def log_skill_error(skill_id: str, error: Exception) -> None:
    """Log skill execution error."""
    logger.error(f"[Splunk] Skill {skill_id} failed: {str(error)}", exc_info=True)


# ============================================================================
# API HELPERS
# ============================================================================

class SplunkAPIClient:
    """Async client for Splunk REST API operations."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        verify_ssl: bool = False,
        timeout: float = 60.0
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.verify_ssl = verify_ssl
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            verify=self.verify_ssl,
            timeout=self.timeout,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/x-www-form-urlencoded",
            }
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()

    async def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make GET request to Splunk API."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        params = params or {}
        params["output_mode"] = "json"

        response = await self._client.get(url, params=params)

        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text[:500]}"
            }

    async def post(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make POST request to Splunk API."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        data = data or {}
        data["output_mode"] = "json"

        response = await self._client.post(url, data=data)

        if response.status_code in [200, 201]:
            return {"success": True, "data": response.json()}
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text[:500]}"
            }

    async def delete(
        self,
        endpoint: str
    ) -> Dict[str, Any]:
        """Make DELETE request to Splunk API."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        response = await self._client.delete(url, params={"output_mode": "json"})

        if response.status_code in [200, 204]:
            return {"success": True}
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text[:500]}"
            }

    async def run_search(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_results: int = 100
    ) -> List[Dict[str, Any]]:
        """Run a Splunk search and return results."""
        # Build full query with time range
        if "|" in query:
            parts = query.split("|", 1)
            full_query = f"{parts[0].strip()} earliest={earliest_time} latest={latest_time} | {parts[1].strip()}"
        else:
            full_query = f"{query} earliest={earliest_time} latest={latest_time}"

        # Create search job
        create_response = await self.post(
            "/services/search/jobs",
            {"search": full_query}
        )

        if not create_response.get("success"):
            logger.error(f"Failed to create search job: {create_response.get('error')}")
            return []

        job_data = create_response.get("data", {})
        job_id = job_data.get("sid")
        if not job_id:
            return []

        # Poll for completion (max 60 seconds)
        for _ in range(60):
            status_response = await self.get(f"/services/search/jobs/{job_id}")
            if status_response.get("success"):
                status_data = status_response.get("data", {})
                entry = status_data.get("entry", [{}])[0]
                if entry.get("content", {}).get("isDone"):
                    break
            await asyncio.sleep(1)

        # Fetch results
        results_response = await self.get(
            f"/services/search/jobs/{job_id}/results",
            {"count": max_results}
        )

        results = []
        if results_response.get("success"):
            results_data = results_response.get("data", {})
            results = results_data.get("results", [])

        # Clean up job
        await self.delete(f"/services/search/jobs/{job_id}")

        return results


# ============================================================================
# BASE MODULE CLASS
# ============================================================================

class SplunkSkillModule(ABC):
    """Abstract base class for Splunk skill modules."""

    MODULE_NAME: str = "base"
    MODULE_PREFIX: str = ""

    @classmethod
    @abstractmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all skills provided by this module."""
        raise NotImplementedError

    @classmethod
    @abstractmethod
    async def execute(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a skill from this module."""
        raise NotImplementedError

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        """Check if this module handles the given skill ID."""
        return skill_id.startswith(cls.MODULE_PREFIX)
