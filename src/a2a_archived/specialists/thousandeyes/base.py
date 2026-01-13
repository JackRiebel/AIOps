"""ThousandEyes skill module base classes and utilities.

This module provides the foundation for all ThousandEyes API skill modules,
following the modular architecture pattern used by Catalyst Center.

API Version: v7
Base URL: https://api.thousandeyes.com/v7
Authentication: OAuth Bearer token
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, TypedDict
import httpx

logger = logging.getLogger(__name__)


# =============================================================================
# Type Definitions
# =============================================================================

class SkillDefinition(TypedDict, total=False):
    """Skill definition structure."""
    id: str
    name: str
    description: str
    tags: List[str]
    examples: List[str]
    input_schema: Dict[str, Any]


@dataclass
class SkillResult:
    """Result of skill execution."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    message: Optional[str] = None
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
            "message": self.message,
            "entities_extracted": self.entities_extracted or {},
            "suggested_follow_up": self.suggested_follow_up,
            "duration_ms": self.duration_ms,
            "artifact_count": len(self.artifacts) if self.artifacts else 0,
            "usage": {
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
            },
        }


# =============================================================================
# Common Schemas
# =============================================================================

TEST_ID_SCHEMA = {"type": "string", "description": "ThousandEyes test ID"}
AGENT_ID_SCHEMA = {"type": "string", "description": "ThousandEyes agent ID"}
ALERT_ID_SCHEMA = {"type": "string", "description": "Alert ID"}
RULE_ID_SCHEMA = {"type": "string", "description": "Alert rule ID"}
DASHBOARD_ID_SCHEMA = {"type": "string", "description": "Dashboard ID"}
WIDGET_ID_SCHEMA = {"type": "string", "description": "Widget ID"}
SNAPSHOT_ID_SCHEMA = {"type": "string", "description": "Snapshot ID"}
ACCOUNT_GROUP_ID_SCHEMA = {"type": "string", "description": "Account group ID (aid)"}
USER_ID_SCHEMA = {"type": "string", "description": "User ID (uid)"}
ROLE_ID_SCHEMA = {"type": "string", "description": "Role ID"}
LABEL_ID_SCHEMA = {"type": "string", "description": "Label/group ID"}
CREDENTIAL_ID_SCHEMA = {"type": "string", "description": "Credential ID"}
WINDOW_ID_SCHEMA = {"type": "string", "description": "Alert suppression window ID"}

# Pagination schemas
OFFSET_SCHEMA = {"type": "integer", "description": "Pagination offset", "default": 0}
LIMIT_SCHEMA = {"type": "integer", "description": "Maximum results to return", "default": 100}

# Time range schemas
START_DATE_SCHEMA = {"type": "string", "description": "Start date (ISO 8601 format)"}
END_DATE_SCHEMA = {"type": "string", "description": "End date (ISO 8601 format)"}
WINDOW_SCHEMA = {"type": "string", "description": "Time window (e.g., 1h, 1d, 7d)"}
ROUND_ID_SCHEMA = {"type": "integer", "description": "Round ID for test results"}

# Test configuration schemas
TEST_NAME_SCHEMA = {"type": "string", "description": "Test name"}
TEST_INTERVAL_SCHEMA = {"type": "integer", "description": "Test interval in seconds", "enum": [60, 120, 300, 600, 900, 1800, 3600]}
TEST_URL_SCHEMA = {"type": "string", "description": "Target URL for test"}
TEST_SERVER_SCHEMA = {"type": "string", "description": "Target server/IP address"}
TEST_PORT_SCHEMA = {"type": "integer", "description": "Target port number"}
TEST_PROTOCOL_SCHEMA = {"type": "string", "description": "Protocol", "enum": ["TCP", "UDP", "ICMP"]}
TEST_ENABLED_SCHEMA = {"type": "boolean", "description": "Whether test is enabled", "default": True}
TEST_AGENTS_SCHEMA = {"type": "array", "items": {"type": "object", "properties": {"agentId": {"type": "string"}}}, "description": "List of agent IDs to run test from"}
TEST_ALERT_RULES_SCHEMA = {"type": "array", "items": {"type": "object", "properties": {"ruleId": {"type": "string"}}}, "description": "Alert rules to apply"}

# DNS-specific schemas
DNS_DOMAIN_SCHEMA = {"type": "string", "description": "DNS domain to query"}
DNS_SERVER_SCHEMA = {"type": "string", "description": "DNS server to query"}
DNS_RECORD_TYPE_SCHEMA = {"type": "string", "description": "DNS record type", "enum": ["A", "AAAA", "CNAME", "MX", "NS", "PTR", "SOA", "TXT", "ANY"]}

# Voice-specific schemas
SIP_TARGET_SCHEMA = {"type": "string", "description": "SIP target URI"}
SIP_USER_SCHEMA = {"type": "string", "description": "SIP username"}
SIP_AUTH_USER_SCHEMA = {"type": "string", "description": "SIP auth username"}
CODEC_SCHEMA = {"type": "string", "description": "Voice codec", "enum": ["G.711", "G.722", "G.729"]}
DSCP_SCHEMA = {"type": "string", "description": "DSCP value for QoS"}

# BGP-specific schemas
BGP_PREFIX_SCHEMA = {"type": "string", "description": "BGP prefix (CIDR notation)"}
BGP_ASN_SCHEMA = {"type": "integer", "description": "Autonomous System Number"}

# Endpoint-specific schemas
ENDPOINT_AGENT_ID_SCHEMA = {"type": "string", "description": "Endpoint agent ID"}


# =============================================================================
# Helper Functions
# =============================================================================

def create_skill(definition: SkillDefinition) -> Any:
    """Create an AgentSkill from a skill definition.

    Imported dynamically to avoid circular imports.
    """
    from src.a2a.types import AgentSkill
    return AgentSkill(
        id=definition["id"],
        name=definition["name"],
        description=definition["description"],
        tags=definition.get("tags", []),
        examples=definition.get("examples", []),
        inputSchema=definition.get("input_schema", {}),
    )


def success_result(data: Optional[Dict[str, Any]] = None, message: Optional[str] = None) -> SkillResult:
    """Create a successful skill result."""
    return SkillResult(success=True, data=data, message=message)


def error_result(error: str) -> SkillResult:
    """Create an error skill result."""
    return SkillResult(success=False, error=error)


def empty_result(message: str = "No data found") -> SkillResult:
    """Create an empty but successful result."""
    return SkillResult(success=True, data={}, message=message)


# =============================================================================
# Logging Helpers
# =============================================================================

def log_skill_start(skill_id: str, params: Dict[str, Any]) -> None:
    """Log the start of skill execution."""
    safe_params = {k: v for k, v in params.items() if k not in ("password", "token", "secret", "api_key")}
    logger.info(f"[ThousandEyes] Executing skill: {skill_id} with params: {safe_params}")


def log_skill_success(skill_id: str, result: SkillResult) -> None:
    """Log successful skill execution."""
    data_summary = "no data"
    if result.data:
        if isinstance(result.data, dict):
            data_summary = f"{len(result.data)} keys"
        elif isinstance(result.data, list):
            data_summary = f"{len(result.data)} items"
    logger.info(f"[ThousandEyes] Skill {skill_id} completed successfully: {data_summary}")


def log_skill_error(skill_id: str, error: Exception) -> None:
    """Log skill execution error."""
    logger.error(f"[ThousandEyes] Skill {skill_id} failed: {error}", exc_info=True)


# =============================================================================
# API Client
# =============================================================================

class ThousandEyesAPIClient:
    """HTTP client for ThousandEyes API v7.

    Handles authentication, request formatting, and response parsing
    for all ThousandEyes API operations.
    """

    BASE_URL = "https://api.thousandeyes.com/v7"

    def __init__(
        self,
        api_token: Optional[str] = None,
        account_group_id: Optional[str] = None,
        timeout: float = 30.0,
    ):
        """Initialize the API client.

        Args:
            api_token: OAuth Bearer token for authentication
            account_group_id: Optional account group ID (aid) to scope requests
            timeout: Request timeout in seconds
        """
        self.api_token = api_token
        self.account_group_id = account_group_id
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def headers(self) -> Dict[str, str]:
        """Get default headers for API requests."""
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers=self.headers,
                timeout=self.timeout,
                verify=True,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _add_aid_param(self, params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Add account group ID to params if configured."""
        params = params or {}
        if self.account_group_id and "aid" not in params:
            params["aid"] = self.account_group_id
        return params

    async def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a GET request.

        Args:
            endpoint: API endpoint (without base URL)
            params: Query parameters

        Returns:
            Response data with success flag
        """
        client = await self._get_client()
        params = self._add_aid_param(params)

        # Remove None values from params
        if params:
            params = {k: v for k, v in params.items() if v is not None}

        try:
            response = await client.get(f"/{endpoint}", params=params)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except httpx.HTTPStatusError as e:
            error_body = ""
            try:
                error_body = e.response.text
            except Exception:
                pass
            logger.error(f"[ThousandEyes] HTTP error {e.response.status_code}: {error_body}")
            return {"success": False, "error": f"HTTP {e.response.status_code}: {error_body}"}
        except Exception as e:
            logger.error(f"[ThousandEyes] Request error: {e}")
            return {"success": False, "error": str(e)}

    async def post(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a POST request.

        Args:
            endpoint: API endpoint
            data: Request body
            params: Query parameters

        Returns:
            Response data with success flag
        """
        client = await self._get_client()
        params = self._add_aid_param(params)

        if params:
            params = {k: v for k, v in params.items() if v is not None}

        try:
            response = await client.post(f"/{endpoint}", json=data, params=params)
            response.raise_for_status()
            return {"success": True, "data": response.json() if response.content else {}}
        except httpx.HTTPStatusError as e:
            error_body = ""
            try:
                error_body = e.response.text
            except Exception:
                pass
            logger.error(f"[ThousandEyes] HTTP error {e.response.status_code}: {error_body}")
            return {"success": False, "error": f"HTTP {e.response.status_code}: {error_body}"}
        except Exception as e:
            logger.error(f"[ThousandEyes] Request error: {e}")
            return {"success": False, "error": str(e)}

    async def put(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a PUT request.

        Args:
            endpoint: API endpoint
            data: Request body
            params: Query parameters

        Returns:
            Response data with success flag
        """
        client = await self._get_client()
        params = self._add_aid_param(params)

        if params:
            params = {k: v for k, v in params.items() if v is not None}

        try:
            response = await client.put(f"/{endpoint}", json=data, params=params)
            response.raise_for_status()
            return {"success": True, "data": response.json() if response.content else {}}
        except httpx.HTTPStatusError as e:
            error_body = ""
            try:
                error_body = e.response.text
            except Exception:
                pass
            logger.error(f"[ThousandEyes] HTTP error {e.response.status_code}: {error_body}")
            return {"success": False, "error": f"HTTP {e.response.status_code}: {error_body}"}
        except Exception as e:
            logger.error(f"[ThousandEyes] Request error: {e}")
            return {"success": False, "error": str(e)}

    async def patch(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a PATCH request.

        Args:
            endpoint: API endpoint
            data: Request body
            params: Query parameters

        Returns:
            Response data with success flag
        """
        client = await self._get_client()
        params = self._add_aid_param(params)

        if params:
            params = {k: v for k, v in params.items() if v is not None}

        try:
            response = await client.patch(f"/{endpoint}", json=data, params=params)
            response.raise_for_status()
            return {"success": True, "data": response.json() if response.content else {}}
        except httpx.HTTPStatusError as e:
            error_body = ""
            try:
                error_body = e.response.text
            except Exception:
                pass
            logger.error(f"[ThousandEyes] HTTP error {e.response.status_code}: {error_body}")
            return {"success": False, "error": f"HTTP {e.response.status_code}: {error_body}"}
        except Exception as e:
            logger.error(f"[ThousandEyes] Request error: {e}")
            return {"success": False, "error": str(e)}

    async def delete(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a DELETE request.

        Args:
            endpoint: API endpoint
            params: Query parameters

        Returns:
            Response data with success flag
        """
        client = await self._get_client()
        params = self._add_aid_param(params)

        if params:
            params = {k: v for k, v in params.items() if v is not None}

        try:
            response = await client.delete(f"/{endpoint}", params=params)
            response.raise_for_status()
            return {"success": True, "data": response.json() if response.content else {}}
        except httpx.HTTPStatusError as e:
            error_body = ""
            try:
                error_body = e.response.text
            except Exception:
                pass
            logger.error(f"[ThousandEyes] HTTP error {e.response.status_code}: {error_body}")
            return {"success": False, "error": f"HTTP {e.response.status_code}: {error_body}"}
        except Exception as e:
            logger.error(f"[ThousandEyes] Request error: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# Base Skill Module
# =============================================================================

class ThousandEyesSkillModule(ABC):
    """Base class for ThousandEyes skill modules.

    Each module represents a logical grouping of related API operations
    (e.g., tests, agents, alerts, dashboards).
    """

    MODULE_NAME: str = ""  # Override in subclass
    MODULE_PREFIX: str = ""  # Skill ID prefix for routing

    @classmethod
    def handles(cls, skill_id: str) -> bool:
        """Check if this module handles the given skill ID."""
        return skill_id.startswith(cls.MODULE_PREFIX)

    @classmethod
    @abstractmethod
    def get_skills(cls) -> List[Any]:
        """Get all skills provided by this module.

        Returns:
            List of AgentSkill objects
        """
        pass

    @classmethod
    @abstractmethod
    async def execute(
        cls,
        skill_id: str,
        client: ThousandEyesAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a skill.

        Args:
            skill_id: The skill ID to execute
            client: ThousandEyes API client
            params: Skill parameters
            context: Execution context

        Returns:
            SkillResult with operation outcome
        """
        pass
