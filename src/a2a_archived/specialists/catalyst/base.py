"""Base module for Catalyst Center skill modules.

Provides shared utilities, base classes, and common schemas for all Catalyst
Center skill modules. This follows the modular architecture pattern used by
Splunk and Meraki skill modules.

Cisco Catalyst Center API Reference:
https://developer.cisco.com/docs/dna-center/
"""

import logging
from typing import Any, Dict, List, Optional, TypedDict
from abc import ABC, abstractmethod
from dataclasses import dataclass
import httpx

from src.a2a.types import AgentSkill
from src.config.settings import get_settings

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
    # Artifacts for collaboration
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

# Site ID schema
SITE_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a site in Catalyst Center"
}

# Site name schema
SITE_NAME_SCHEMA = {
    "type": "string",
    "description": "Name of the site (supports hierarchy like 'Global/Building1/Floor1')"
}

# Device ID schema
DEVICE_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier (UUID) for a network device"
}

# Device IP schema
DEVICE_IP_SCHEMA = {
    "type": "string",
    "description": "IP address of the network device"
}

# Device serial schema
DEVICE_SERIAL_SCHEMA = {
    "type": "string",
    "description": "Serial number of the network device"
}

# Interface ID schema
INTERFACE_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a device interface"
}

# Client MAC schema
CLIENT_MAC_SCHEMA = {
    "type": "string",
    "description": "MAC address of the client device"
}

# Issue ID schema
ISSUE_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a network issue"
}

# Timestamp schema
TIMESTAMP_SCHEMA = {
    "type": "integer",
    "description": "Unix timestamp in milliseconds"
}

# Time range schema (for queries)
TIME_RANGE_SCHEMA = {
    "type": "string",
    "description": "Time range for queries (e.g., '24h', '7d', '30d')",
    "default": "24h"
}

# Offset schema for pagination
OFFSET_SCHEMA = {
    "type": "integer",
    "description": "Starting index for pagination",
    "default": 0
}

# Limit schema for pagination
LIMIT_SCHEMA = {
    "type": "integer",
    "description": "Maximum number of results to return",
    "default": 100
}

# Device family schema
DEVICE_FAMILY_SCHEMA = {
    "type": "string",
    "description": "Device family filter",
    "enum": [
        "Switches and Hubs",
        "Routers",
        "Wireless Controller",
        "Unified AP",
        "Meraki"
    ]
}

# Reachability status schema
REACHABILITY_SCHEMA = {
    "type": "string",
    "description": "Device reachability status",
    "enum": ["Reachable", "Unreachable"]
}

# Issue priority schema
ISSUE_PRIORITY_SCHEMA = {
    "type": "string",
    "description": "Issue priority level",
    "enum": ["P1", "P2", "P3", "P4"]
}

# Issue status schema
ISSUE_STATUS_SCHEMA = {
    "type": "string",
    "description": "Issue status",
    "enum": ["active", "resolved", "ignored"]
}

# Topology type schema
TOPOLOGY_TYPE_SCHEMA = {
    "type": "string",
    "description": "Type of network topology view",
    "enum": ["physical", "layer2", "layer3", "vlan"]
}

# Site type schema
SITE_TYPE_SCHEMA = {
    "type": "string",
    "description": "Type of site in the hierarchy",
    "enum": ["area", "building", "floor"]
}

# Template project ID schema
PROJECT_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a template project"
}

# Template ID schema
TEMPLATE_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a configuration template"
}

# Discovery ID schema
DISCOVERY_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a discovery job"
}

# Image ID schema
IMAGE_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a software image"
}

# Fabric site schema
FABRIC_SITE_SCHEMA = {
    "type": "string",
    "description": "Name of the SDA fabric site"
}

# Virtual network schema
VIRTUAL_NETWORK_SCHEMA = {
    "type": "string",
    "description": "Name of the virtual network"
}

# IP pool schema
IP_POOL_SCHEMA = {
    "type": "string",
    "description": "Name of the IP address pool"
}

# SSID schema
SSID_SCHEMA = {
    "type": "string",
    "description": "Wireless SSID name"
}

# VLAN ID schema
VLAN_ID_SCHEMA = {
    "type": "string",
    "description": "VLAN identifier"
}

# Path trace ID schema
FLOW_ANALYSIS_ID_SCHEMA = {
    "type": "string",
    "description": "Unique identifier for a path trace/flow analysis"
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
        tags=skill_def.get("tags", ["catalyst", "cisco"]),
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
    safe_params = {k: v for k, v in params.items() if k not in ["api_key", "password", "token", "api_token"]}
    logger.info(f"[Catalyst] Starting skill: {skill_id} with params: {safe_params}")


def log_skill_success(skill_id: str, result: Any) -> None:
    """Log skill execution success."""
    if hasattr(result, 'data') and isinstance(result.data, dict):
        count = result.data.get('count', len(result.data) if isinstance(result.data, list) else 1)
        logger.info(f"[Catalyst] Skill {skill_id} completed successfully. Items: {count}")
    else:
        logger.info(f"[Catalyst] Skill {skill_id} completed successfully")


def log_skill_error(skill_id: str, error: Exception) -> None:
    """Log skill execution error."""
    logger.error(f"[Catalyst] Skill {skill_id} failed: {str(error)}", exc_info=True)


# ============================================================================
# API CLIENT
# ============================================================================

class CatalystAPIClient:
    """Async client for Catalyst Center REST API operations.

    This client provides low-level HTTP methods for interacting with the
    Catalyst Center Intent API. It handles authentication, token refresh,
    and rate limiting automatically.

    Authentication Methods:
    1. Bearer Token (X-Auth-Token) - Provide api_token
    2. Username/Password - Provide username and password (will auto-refresh tokens)

    API Base Paths:
    - Intent API v1: /dna/intent/api/v1/
    - Intent API v2: /dna/intent/api/v2/
    - System API: /dna/system/api/v1/
    """

    def __init__(
        self,
        base_url: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        api_token: Optional[str] = None,
        verify_ssl: Optional[bool] = None,
        timeout: float = 30.0,
        version: str = "v1"
    ):
        """Initialize Catalyst Center API client.

        Args:
            base_url: Base URL (e.g., https://sandboxdnac.cisco.com)
            username: Username for token authentication
            password: Password for token authentication
            api_token: Pre-authenticated bearer token
            verify_ssl: Whether to verify SSL certificates
            timeout: Request timeout in seconds
            version: API version (v1 or v2)
        """
        settings = get_settings()
        self.verify_ssl = verify_ssl if verify_ssl is not None else settings.verify_ssl
        self.timeout = timeout

        # Normalize base URL
        self.base_url = base_url.rstrip('/')
        if '/dna/intent/api/' in self.base_url:
            self.base_url = self.base_url.split('/dna/intent/api/')[0]

        self.username = username
        self.password = password
        self.api_token = api_token
        self.version = version
        self.api_base = f"{self.base_url}/dna/intent/api/{version}"

        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        """Async context manager entry."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        if self.api_token:
            headers["X-Auth-Token"] = self.api_token

        self._client = httpx.AsyncClient(
            verify=self.verify_ssl,
            timeout=self.timeout,
            headers=headers
        )

        # Authenticate if needed
        if not self.api_token and self.username and self.password:
            await self._authenticate()

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()

    async def _authenticate(self) -> bool:
        """Authenticate and obtain a token.

        Returns:
            True if authentication succeeded
        """
        if not self.username or not self.password:
            logger.error("Cannot authenticate: username/password not provided")
            return False

        auth_url = f"{self.base_url}/dna/system/api/v1/auth/token"
        logger.info(f"[Catalyst] Authenticating at {auth_url}")

        try:
            import base64
            auth_string = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()

            response = await self._client.post(
                auth_url,
                headers={
                    "Authorization": f"Basic {auth_string}",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            data = response.json()

            token = data.get("Token")
            if token:
                self.api_token = token
                self._client.headers["X-Auth-Token"] = token
                logger.info("[Catalyst] Authentication successful")
                return True
            else:
                logger.error("[Catalyst] Authentication response missing token")
                return False

        except httpx.HTTPStatusError as e:
            logger.error(f"[Catalyst] Auth failed: {e.response.status_code} - {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"[Catalyst] Auth error: {str(e)}")
            return False

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        use_v2: bool = False,
        _retry_auth: bool = True
    ) -> Dict[str, Any]:
        """Make an authenticated API request.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (relative to /dna/intent/api/vX/)
            params: Query parameters
            json_data: JSON body data
            use_v2: Use v2 API instead of v1
            _retry_auth: Whether to retry on 401 (internal)

        Returns:
            Dict with 'success' and either 'data' or 'error'
        """
        api_base = f"{self.base_url}/dna/intent/api/{'v2' if use_v2 else self.version}"
        url = f"{api_base}/{endpoint.lstrip('/')}"

        try:
            response = await self._client.request(
                method,
                url,
                params=params,
                json=json_data
            )

            if response.status_code == 401 and _retry_auth:
                # Token expired - try to refresh
                if self.username and self.password:
                    logger.info("[Catalyst] Token expired, refreshing...")
                    if await self._authenticate():
                        return await self._request(
                            method, endpoint, params, json_data, use_v2, _retry_auth=False
                        )
                return {"success": False, "error": "Authentication failed"}

            if response.status_code == 429:
                logger.warning("[Catalyst] Rate limit exceeded")
                return {"success": False, "error": "Rate limit exceeded. Please try again later."}

            response.raise_for_status()

            # Handle empty responses
            if response.status_code == 204 or not response.content:
                return {"success": True, "data": None}

            return {"success": True, "data": response.json()}

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}: {e.response.text[:500]}"
            logger.error(f"[Catalyst] API error: {error_msg}")
            return {"success": False, "error": error_msg}
        except httpx.RequestError as e:
            logger.error(f"[Catalyst] Network error: {str(e)}")
            return {"success": False, "error": f"Network error: {str(e)}"}
        except Exception as e:
            logger.error(f"[Catalyst] Unexpected error: {str(e)}")
            return {"success": False, "error": str(e)}

    async def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        use_v2: bool = False
    ) -> Dict[str, Any]:
        """Make GET request to Catalyst Center API."""
        return await self._request("GET", endpoint, params=params, use_v2=use_v2)

    async def post(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        use_v2: bool = False
    ) -> Dict[str, Any]:
        """Make POST request to Catalyst Center API."""
        return await self._request("POST", endpoint, params=params, json_data=data, use_v2=use_v2)

    async def put(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        use_v2: bool = False
    ) -> Dict[str, Any]:
        """Make PUT request to Catalyst Center API."""
        return await self._request("PUT", endpoint, params=params, json_data=data, use_v2=use_v2)

    async def delete(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        use_v2: bool = False
    ) -> Dict[str, Any]:
        """Make DELETE request to Catalyst Center API."""
        return await self._request("DELETE", endpoint, params=params, use_v2=use_v2)

    # Convenience methods for common patterns

    async def get_with_response(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        use_v2: bool = False
    ) -> Dict[str, Any]:
        """GET request that extracts 'response' from the result.

        Most Catalyst Center API responses wrap data in a 'response' key.
        """
        result = await self.get(endpoint, params, use_v2)
        if result.get("success") and result.get("data"):
            data = result["data"]
            if isinstance(data, dict) and "response" in data:
                result["data"] = data["response"]
        return result

    async def get_task_result(
        self,
        task_id: str,
        max_wait_seconds: int = 120,
        poll_interval: float = 2.0
    ) -> Dict[str, Any]:
        """Poll for async task completion and return result.

        Many Catalyst Center operations are asynchronous and return a task ID.
        This method polls the task until completion.

        Args:
            task_id: The task ID to poll
            max_wait_seconds: Maximum time to wait for completion
            poll_interval: Seconds between poll attempts

        Returns:
            Task result data or error
        """
        import asyncio
        elapsed = 0.0

        while elapsed < max_wait_seconds:
            result = await self.get(f"task/{task_id}")

            if not result.get("success"):
                return result

            task_data = result.get("data", {}).get("response", {})

            if task_data.get("isError"):
                return {
                    "success": False,
                    "error": task_data.get("failureReason", "Task failed")
                }

            if task_data.get("endTime"):
                # Task completed
                progress = task_data.get("progress", "")
                # Try to parse progress as JSON (some tasks return JSON in progress)
                try:
                    import json
                    progress_data = json.loads(progress)
                    return {"success": True, "data": progress_data}
                except (json.JSONDecodeError, TypeError):
                    return {"success": True, "data": task_data}

            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        return {"success": False, "error": f"Task {task_id} timed out after {max_wait_seconds}s"}


# ============================================================================
# BASE MODULE CLASS
# ============================================================================

class CatalystSkillModule(ABC):
    """Abstract base class for Catalyst Center skill modules.

    Each skill module provides a set of related skills (e.g., sites, devices,
    interfaces) and handles execution routing.

    Subclasses must implement:
    - MODULE_NAME: Unique module identifier
    - MODULE_PREFIX: Prefix for skill IDs handled by this module
    - get_skills(): Return list of AgentSkill objects
    - execute(): Execute a skill and return SkillResult
    """

    MODULE_NAME: str = "base"
    MODULE_PREFIX: str = ""

    @classmethod
    @abstractmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all skills provided by this module.

        Returns:
            List of AgentSkill objects
        """
        raise NotImplementedError

    @classmethod
    @abstractmethod
    async def execute(
        cls,
        skill_id: str,
        client: CatalystAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a skill from this module.

        Args:
            skill_id: The skill to execute
            client: Catalyst API client
            params: Skill parameters
            context: Execution context

        Returns:
            SkillResult with data or error
        """
        raise NotImplementedError

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        """Check if this module handles the given skill ID.

        Args:
            skill_id: Skill ID to check

        Returns:
            True if this module handles the skill
        """
        return skill_id.startswith(cls.MODULE_PREFIX)
