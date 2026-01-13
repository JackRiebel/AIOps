"""A2A External Agent Client.

Client for connecting to and communicating with external A2A-compliant agents.
Implements the client side of the A2A Protocol v0.3 specification.

Features:
- Agent discovery via /.well-known/agent.json
- Message sending (sync and streaming)
- Task subscription via SSE
- Signature verification for trusted agents
- Connection pooling and retry logic
"""

import logging
import asyncio
import json
from typing import Dict, Any, List, Optional, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import httpx

from .types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    AgentInterface,
    A2AMessage,
    A2ATask,
    TaskState,
    TaskStatus,
    TextPart,
)
from .security import A2ASecurityManager, get_security_manager

logger = logging.getLogger(__name__)


class ConnectionState(str, Enum):
    """State of connection to external agent."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    FAILED = "failed"


@dataclass
class ExternalAgentInfo:
    """Information about an external agent."""
    url: str
    agent_card: Optional[AgentCard] = None
    public_key: Optional[str] = None
    is_trusted: bool = False
    connection_state: ConnectionState = ConnectionState.DISCONNECTED
    last_seen: Optional[datetime] = None
    last_error: Optional[str] = None
    latency_ms: Optional[float] = None
    request_count: int = 0
    error_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "agent_id": self.agent_card.id if self.agent_card else None,
            "agent_name": self.agent_card.name if self.agent_card else None,
            "is_trusted": self.is_trusted,
            "connection_state": self.connection_state.value,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "last_error": self.last_error,
            "latency_ms": self.latency_ms,
            "request_count": self.request_count,
            "error_count": self.error_count,
        }


@dataclass
class ExternalTaskResult:
    """Result from an external agent task."""
    task_id: str
    state: TaskState
    response: Optional[str] = None
    artifacts: List[Dict[str, Any]] = field(default_factory=list)
    agent_id: str = ""
    agent_url: str = ""
    duration_ms: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "state": self.state.value,
            "response": self.response,
            "artifacts": self.artifacts,
            "agent_id": self.agent_id,
            "agent_url": self.agent_url,
            "duration_ms": self.duration_ms,
            "error": self.error,
        }


class A2AExternalClient:
    """Client for communicating with external A2A agents.

    Provides:
    - Agent discovery from /.well-known/agent.json
    - Message sending with retry logic
    - SSE streaming for task updates
    - Signature verification for trusted communication
    """

    DEFAULT_TIMEOUT = 30.0
    DEFAULT_RETRIES = 3
    DISCOVERY_PATH = "/.well-known/agent.json"

    def __init__(
        self,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_RETRIES,
        verify_signatures: bool = True,
        security_manager: Optional[A2ASecurityManager] = None,
    ):
        self.timeout = timeout
        self.max_retries = max_retries
        self.verify_signatures = verify_signatures
        self.security_manager = security_manager or get_security_manager()
        self._client: Optional[httpx.AsyncClient] = None
        self._agents: Dict[str, ExternalAgentInfo] = {}

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
                headers={
                    "User-Agent": "Lumen-A2A/1.0",
                    "Accept": "application/json",
                },
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _normalize_url(self, url: str) -> str:
        """Normalize agent URL."""
        url = url.rstrip("/")
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        return url

    async def discover(
        self,
        url: str,
        include_extended: bool = False,
    ) -> Optional[AgentCard]:
        """Discover an external agent by fetching its agent card.

        Args:
            url: Base URL of the agent
            include_extended: Whether to request extended card (requires auth)

        Returns:
            AgentCard if discovery successful, None otherwise
        """
        url = self._normalize_url(url)
        discovery_url = f"{url}{self.DISCOVERY_PATH}"

        if include_extended:
            discovery_url += "?auth=true"

        # Initialize agent info
        if url not in self._agents:
            self._agents[url] = ExternalAgentInfo(url=url)

        agent_info = self._agents[url]
        agent_info.connection_state = ConnectionState.CONNECTING

        try:
            client = await self._get_client()
            start_time = datetime.utcnow()

            response = await client.get(discovery_url)
            response.raise_for_status()

            latency = (datetime.utcnow() - start_time).total_seconds() * 1000
            agent_info.latency_ms = latency

            data = response.json()

            # Parse agent card
            agent_card = self._parse_agent_card(data)

            # Verify signature if present and verification enabled
            if self.verify_signatures and "signature" in data:
                if not self._verify_card_signature(data):
                    logger.warning(f"[ExternalClient] Invalid signature for agent at {url}")
                    agent_info.is_trusted = False
                else:
                    agent_info.is_trusted = True
                    agent_info.public_key = data.get("public_key")

            agent_info.agent_card = agent_card
            agent_info.connection_state = ConnectionState.CONNECTED
            agent_info.last_seen = datetime.utcnow()
            agent_info.last_error = None

            logger.info(
                f"[ExternalClient] Discovered agent: {agent_card.name} at {url} "
                f"(latency: {latency:.1f}ms)"
            )

            return agent_card

        except httpx.HTTPStatusError as e:
            agent_info.connection_state = ConnectionState.FAILED
            agent_info.last_error = f"HTTP {e.response.status_code}"
            agent_info.error_count += 1
            logger.error(f"[ExternalClient] Discovery failed for {url}: {e}")
            return None

        except Exception as e:
            agent_info.connection_state = ConnectionState.FAILED
            agent_info.last_error = str(e)
            agent_info.error_count += 1
            logger.error(f"[ExternalClient] Discovery error for {url}: {e}")
            return None

    def _parse_agent_card(self, data: Dict[str, Any]) -> AgentCard:
        """Parse agent card from JSON data."""
        # Parse provider
        provider = None
        if "provider" in data:
            provider = AgentProvider(
                organization=data["provider"].get("organization", ""),
                url=data["provider"].get("url"),
            )

        # Parse capabilities
        capabilities = AgentCapabilities()
        if "capabilities" in data:
            caps = data["capabilities"]
            capabilities = AgentCapabilities(
                streaming=caps.get("streaming", False),
                pushNotifications=caps.get("pushNotifications", False),
                stateTransitionHistory=caps.get("stateTransitionHistory", True),
            )

        # Parse skills
        skills = []
        for skill_data in data.get("skills", []):
            skills.append(AgentSkill(
                id=skill_data.get("id", ""),
                name=skill_data.get("name", ""),
                description=skill_data.get("description", ""),
                tags=skill_data.get("tags", []),
                examples=skill_data.get("examples", []),
            ))

        # Parse interfaces
        interfaces = []
        for iface_data in data.get("interfaces", []):
            interfaces.append(AgentInterface(
                protocol=iface_data.get("protocol", "jsonrpc/2.0"),
                url=iface_data.get("url"),
            ))

        return AgentCard(
            id=data.get("id", "unknown"),
            name=data.get("name", "Unknown Agent"),
            description=data.get("description", ""),
            protocolVersion=data.get("protocolVersion", "0.3"),
            provider=provider,
            capabilities=capabilities,
            skills=skills,
            interfaces=interfaces,
            role=data.get("role"),
            priority=data.get("priority", 0),
        )

    def _verify_card_signature(self, data: Dict[str, Any]) -> bool:
        """Verify agent card signature."""
        signature = data.get("signature")
        public_key = data.get("public_key")

        if not signature or not public_key:
            return False

        # Remove signature fields for verification
        card_data = {k: v for k, v in data.items() if k not in ["signature", "public_key"]}

        return self.security_manager.verify_signature(
            card=card_data,
            signature_b64=signature,
            public_key_b64=public_key,
        )

    async def send_message(
        self,
        agent_url: str,
        message: A2AMessage,
        task_id: Optional[str] = None,
        context_id: Optional[str] = None,
    ) -> ExternalTaskResult:
        """Send a message to an external agent.

        Args:
            agent_url: URL of the external agent
            message: Message to send
            task_id: Optional existing task ID to continue
            context_id: Optional context/session ID

        Returns:
            ExternalTaskResult with the response
        """
        agent_url = self._normalize_url(agent_url)
        agent_info = self._agents.get(agent_url)

        if not agent_info or not agent_info.agent_card:
            # Try to discover first
            card = await self.discover(agent_url)
            if not card:
                return ExternalTaskResult(
                    task_id=task_id or "",
                    state=TaskState.FAILED,
                    error="Agent discovery failed",
                    agent_url=agent_url,
                )
            agent_info = self._agents[agent_url]

        # Find message endpoint
        message_endpoint = f"{agent_url}/api/a2a/message"
        for iface in agent_info.agent_card.interfaces:
            if iface.url and "message" in iface.url:
                if iface.url.startswith("/"):
                    message_endpoint = f"{agent_url}{iface.url}"
                else:
                    message_endpoint = iface.url
                break

        # Build request
        request_body = {
            "message": message.to_dict(),
            "taskId": task_id,
            "contextId": context_id,
        }

        start_time = datetime.utcnow()

        for attempt in range(self.max_retries):
            try:
                client = await self._get_client()
                response = await client.post(
                    message_endpoint,
                    json=request_body,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()

                duration = (datetime.utcnow() - start_time).total_seconds() * 1000
                data = response.json()

                agent_info.request_count += 1
                agent_info.last_seen = datetime.utcnow()

                # Parse response
                response_text = ""
                if "history" in data:
                    for msg in data["history"]:
                        if msg.get("role") == "agent":
                            for part in msg.get("parts", []):
                                if part.get("type") == "text":
                                    response_text += part.get("text", "")

                return ExternalTaskResult(
                    task_id=data.get("id", task_id or ""),
                    state=TaskState(data.get("status", {}).get("state", "completed")),
                    response=response_text,
                    artifacts=data.get("artifacts", []),
                    agent_id=agent_info.agent_card.id,
                    agent_url=agent_url,
                    duration_ms=duration,
                )

            except httpx.HTTPStatusError as e:
                if attempt < self.max_retries - 1 and e.response.status_code >= 500:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    continue
                agent_info.error_count += 1
                return ExternalTaskResult(
                    task_id=task_id or "",
                    state=TaskState.FAILED,
                    error=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
                    agent_url=agent_url,
                    duration_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
                )

            except Exception as e:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                agent_info.error_count += 1
                return ExternalTaskResult(
                    task_id=task_id or "",
                    state=TaskState.FAILED,
                    error=str(e),
                    agent_url=agent_url,
                    duration_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
                )

        return ExternalTaskResult(
            task_id=task_id or "",
            state=TaskState.FAILED,
            error="Max retries exceeded",
            agent_url=agent_url,
        )

    async def subscribe(
        self,
        agent_url: str,
        task_id: str,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Subscribe to task updates via SSE.

        Args:
            agent_url: URL of the external agent
            task_id: Task ID to subscribe to

        Yields:
            Task update events
        """
        agent_url = self._normalize_url(agent_url)
        subscribe_url = f"{agent_url}/api/a2a/task/{task_id}/subscribe"

        try:
            client = await self._get_client()

            async with client.stream("GET", subscribe_url) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            event = json.loads(data)
                            yield event
                        except json.JSONDecodeError:
                            continue

        except Exception as e:
            logger.error(f"[ExternalClient] SSE subscription error: {e}")
            yield {"type": "error", "error": str(e)}

    async def get_task(
        self,
        agent_url: str,
        task_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get task status from external agent.

        Args:
            agent_url: URL of the external agent
            task_id: Task ID to get

        Returns:
            Task data dict or None
        """
        agent_url = self._normalize_url(agent_url)
        task_url = f"{agent_url}/api/a2a/task/{task_id}"

        try:
            client = await self._get_client()
            response = await client.get(task_url)
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.error(f"[ExternalClient] Get task error: {e}")
            return None

    async def cancel_task(
        self,
        agent_url: str,
        task_id: str,
    ) -> bool:
        """Cancel a task on external agent.

        Args:
            agent_url: URL of the external agent
            task_id: Task ID to cancel

        Returns:
            True if canceled successfully
        """
        agent_url = self._normalize_url(agent_url)
        cancel_url = f"{agent_url}/api/a2a/task/{task_id}"

        try:
            client = await self._get_client()
            response = await client.delete(cancel_url)
            response.raise_for_status()
            return True

        except Exception as e:
            logger.error(f"[ExternalClient] Cancel task error: {e}")
            return False

    async def health_check(self, agent_url: str) -> bool:
        """Check if external agent is healthy.

        Args:
            agent_url: URL to check

        Returns:
            True if agent responds to discovery
        """
        card = await self.discover(agent_url)
        return card is not None

    def get_agent_info(self, agent_url: str) -> Optional[ExternalAgentInfo]:
        """Get cached info about an external agent."""
        agent_url = self._normalize_url(agent_url)
        return self._agents.get(agent_url)

    def get_all_agents(self) -> List[ExternalAgentInfo]:
        """Get info about all known external agents."""
        return list(self._agents.values())

    def get_connected_agents(self) -> List[ExternalAgentInfo]:
        """Get all agents with connected state."""
        return [
            info for info in self._agents.values()
            if info.connection_state == ConnectionState.CONNECTED
        ]


# Singleton instance
_external_client: Optional[A2AExternalClient] = None


def get_external_client() -> A2AExternalClient:
    """Get singleton external client."""
    global _external_client
    if _external_client is None:
        _external_client = A2AExternalClient()
    return _external_client


async def discover_agent(url: str) -> Optional[AgentCard]:
    """Convenience function to discover an external agent."""
    client = get_external_client()
    return await client.discover(url)


async def send_to_external_agent(
    url: str,
    query: str,
    context_id: Optional[str] = None,
) -> ExternalTaskResult:
    """Convenience function to send a message to an external agent."""
    client = get_external_client()

    message = A2AMessage(
        role="user",
        parts=[TextPart(text=query)],
    )

    return await client.send_message(
        agent_url=url,
        message=message,
        context_id=context_id,
    )
