"""Shared pytest fixtures for A2A tests."""

import pytest
import asyncio
from datetime import datetime
from typing import Dict, Any, List
from unittest.mock import AsyncMock, MagicMock


# =============================================================================
# Event Loop Fixture
# =============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# =============================================================================
# A2A Type Fixtures
# =============================================================================

@pytest.fixture
def sample_agent_card() -> Dict[str, Any]:
    """Sample agent card data."""
    return {
        "id": "test-agent",
        "name": "Test Agent",
        "description": "A test agent for unit tests",
        "protocolVersion": "0.3",
        "provider": {
            "organization": "Test Org",
            "url": "https://test.example.com",
        },
        "role": "specialist",
        "priority": 5,
        "skills": [
            {
                "id": "test-skill-1",
                "name": "Test Skill",
                "description": "A test skill",
                "tags": ["test", "demo"],
                "examples": ["Do a test", "Run test"],
            }
        ],
        "capabilities": {
            "streaming": True,
            "pushNotifications": True,
        },
    }


@pytest.fixture
def sample_message() -> Dict[str, Any]:
    """Sample A2A message data."""
    return {
        "role": "user",
        "parts": [
            {"type": "text", "text": "Test query message"},
        ],
        "context": {"session_id": "test-session-123"},
    }


@pytest.fixture
def sample_task_data() -> Dict[str, Any]:
    """Sample task data."""
    return {
        "id": "task-123",
        "contextId": "ctx-456",
        "status": {
            "state": "submitted",
            "timestamp": datetime.utcnow().isoformat(),
        },
        "history": [],
        "artifacts": [],
        "metadata": {"source": "test"},
    }


# =============================================================================
# Push Notification Fixtures
# =============================================================================

@pytest.fixture
def sample_webhook_config() -> Dict[str, Any]:
    """Sample webhook configuration."""
    return {
        "url": "https://webhook.example.com/notify",
        "events": ["task.completed", "task.failed"],
        "headers": {"Authorization": "Bearer test-token"},
        "secret": "test-secret-key",
    }


@pytest.fixture
def sample_notification_payload() -> Dict[str, Any]:
    """Sample notification payload."""
    return {
        "id": "notif-123",
        "event_type": "task.completed",
        "task_id": "task-456",
        "timestamp": datetime.utcnow().isoformat(),
        "data": {
            "result": "success",
            "duration_ms": 1500,
        },
        "source": "lumen-a2a",
    }


# =============================================================================
# Circuit Breaker Fixtures
# =============================================================================

@pytest.fixture
def circuit_breaker_config() -> Dict[str, Any]:
    """Sample circuit breaker configuration."""
    return {
        "failure_threshold": 3,
        "success_threshold": 2,
        "timeout_seconds": 5.0,
        "half_open_max_calls": 2,
        "failure_rate_threshold": 0.5,
        "window_size": 5,
    }


@pytest.fixture
def rate_limit_config() -> Dict[str, Any]:
    """Sample rate limit configuration."""
    return {
        "requests_per_second": 10.0,
        "burst_size": 20,
    }


# =============================================================================
# Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_http_client():
    """Mock HTTP client for testing external calls."""
    client = AsyncMock()
    client.post = AsyncMock(return_value=MagicMock(
        status=200,
        text=AsyncMock(return_value='{"status": "ok"}'),
    ))
    client.get = AsyncMock(return_value=MagicMock(
        status=200,
        json=AsyncMock(return_value={"id": "test", "name": "Test"}),
    ))
    return client


@pytest.fixture
def mock_agent_registry():
    """Mock agent registry."""
    registry = MagicMock()
    registry.get_all_agents.return_value = []
    registry.get_agent.return_value = None
    registry.find_agents_for_query.return_value = []
    return registry


# =============================================================================
# Test Data Generators
# =============================================================================

def generate_tasks(count: int) -> List[Dict[str, Any]]:
    """Generate multiple task records for testing."""
    return [
        {
            "id": f"task-{i}",
            "contextId": f"ctx-{i % 5}",
            "status": {
                "state": ["submitted", "working", "completed"][i % 3],
                "timestamp": datetime.utcnow().isoformat(),
            },
            "history": [],
            "artifacts": [],
        }
        for i in range(count)
    ]


def generate_deliveries(count: int) -> List[Dict[str, Any]]:
    """Generate notification delivery records for testing."""
    return [
        {
            "id": f"delivery-{i}",
            "config_id": f"config-{i % 3}",
            "event_type": ["task.completed", "task.failed", "artifact.ready"][i % 3],
            "status": ["pending", "delivered", "failed"][i % 3],
            "attempts": i % 4,
        }
        for i in range(count)
    ]
