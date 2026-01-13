"""Pytest configuration and fixtures for agent tests."""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from typing import Dict, Any, List


# ============================================================================
# Async Event Loop Configuration
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Mock Credentials
# ============================================================================

@pytest.fixture
def mock_meraki_credentials() -> Dict[str, str]:
    """Mock Meraki API credentials."""
    return {
        "meraki_api_key": "test_api_key_12345678901234567890",
        "org_id": "123456",
    }


@pytest.fixture
def mock_catalyst_credentials() -> Dict[str, str]:
    """Mock Catalyst/DNA Center credentials."""
    return {
        "catalyst_username": "admin",
        "catalyst_password": "test_password_secure",
        "catalyst_base_url": "https://catalyst.test.local",
        "catalyst_token": "test_catalyst_token",
    }


@pytest.fixture
def mock_thousandeyes_credentials() -> Dict[str, str]:
    """Mock ThousandEyes credentials."""
    return {
        "thousandeyes_token": "test_oauth_token_12345",
    }


@pytest.fixture
def mock_splunk_credentials() -> Dict[str, str]:
    """Mock Splunk credentials."""
    return {
        "splunk_token": "test_splunk_token_12345",
        "splunk_base_url": "https://splunk.test.local:8089",
    }


# ============================================================================
# Sample Data Fixtures
# ============================================================================

@pytest.fixture
def sample_meraki_networks() -> List[Dict[str, Any]]:
    """Sample Meraki network data."""
    return [
        {
            "id": "N_123456789012345678",
            "name": "Riebel Home",
            "organizationId": "123456",
            "productTypes": ["wireless", "switch", "appliance"],
            "tags": ["production"],
        },
        {
            "id": "N_234567890123456789",
            "name": "Office Network",
            "organizationId": "123456",
            "productTypes": ["appliance", "switch"],
            "tags": ["office"],
        },
    ]


@pytest.fixture
def sample_meraki_devices() -> List[Dict[str, Any]]:
    """Sample Meraki device data."""
    return [
        {
            "serial": "Q2XX-XXXX-0001",
            "name": "Office MX",
            "model": "MX64",
            "networkId": "N_123456789012345678",
            "mac": "00:11:22:33:44:55",
            "lanIp": "10.0.0.1",
            "status": "online",
        },
        {
            "serial": "Q2XX-XXXX-0002",
            "name": "Office Switch",
            "model": "MS120-8LP",
            "networkId": "N_123456789012345678",
            "status": "online",
        },
    ]


# ============================================================================
# Test Utilities
# ============================================================================

def create_mock_tool(
    name: str,
    platform: str = "meraki",
    requires_write: bool = False,
    return_value: Dict[str, Any] = None,
):
    """Create a mock tool for testing."""
    tool = MagicMock()
    tool.name = name
    tool.platform = platform
    tool.requires_write = requires_write
    tool.description = f"Mock tool: {name}"
    tool.category = "test"
    tool.handler = AsyncMock(
        return_value=return_value or {"success": True, "data": []}
    )
    return tool
