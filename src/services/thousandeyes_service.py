"""ThousandEyes API service for network monitoring and intelligence."""

import os
import logging
from typing import List, Dict, Any, Optional
import httpx

from src.config.settings import get_settings

logger = logging.getLogger(__name__)


class ThousandEyesClient:
    """Client for ThousandEyes API integration."""

    def __init__(self, oauth_token: str, base_url: str = "https://api.thousandeyes.com/v7"):
        """Initialize ThousandEyes client.

        Args:
            oauth_token: ThousandEyes OAuth Bearer token
            base_url: ThousandEyes API base URL
        """
        self.oauth_token = oauth_token
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {oauth_token}",
            "Content-Type": "application/json"
        }

    async def get_tests(self, test_type: Optional[str] = None) -> Dict[str, Any]:
        """Get all tests or filter by type.

        Args:
            test_type: Filter by test type (agent-to-server, http-server, page-load, etc.)

        Returns:
            Dictionary with tests data
        """
        try:
            settings = get_settings()
            async with httpx.AsyncClient(timeout=30.0, verify=settings.verify_ssl) as client:
                response = await client.get(
                    f"{self.base_url}/tests",
                    headers=self.headers
                )

                if response.status_code == 200:
                    data = response.json()
                    tests = data.get("tests", [])

                    # Filter by type if specified
                    if test_type:
                        tests = [t for t in tests if t.get("type") == test_type]

                    return {
                        "success": True,
                        "tests": tests,
                        "count": len(tests)
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}",
                        "tests": []
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "tests": []
            }

    async def get_alerts(self, active_only: bool = True) -> Dict[str, Any]:
        """Get alerts from ThousandEyes.

        Args:
            active_only: If True, return only active alerts

        Returns:
            Dictionary with alerts data
        """
        try:
            settings = get_settings()
            async with httpx.AsyncClient(timeout=30.0, verify=settings.verify_ssl) as client:
                endpoint = f"{self.base_url}/alerts"
                if active_only:
                    endpoint += "?window=1d"

                response = await client.get(endpoint, headers=self.headers)

                if response.status_code == 200:
                    data = response.json()
                    alerts = data.get("alert", [])

                    # Filter active if requested
                    if active_only:
                        alerts = [a for a in alerts if a.get("active", 0) == 1]

                    return {
                        "success": True,
                        "alerts": alerts,
                        "count": len(alerts),
                        "active_count": sum(1 for a in alerts if a.get("active", 0) == 1)
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}",
                        "alerts": []
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "alerts": []
            }

    async def get_agents(self) -> Dict[str, Any]:
        """Get all agents and their status.

        Returns:
            Dictionary with agents data
        """
        try:
            settings = get_settings()
            async with httpx.AsyncClient(timeout=30.0, verify=settings.verify_ssl) as client:
                response = await client.get(
                    f"{self.base_url}/agents",
                    headers=self.headers
                )

                if response.status_code == 200:
                    data = response.json()
                    agents = data.get("agents", [])

                    # Categorize agents
                    online = [a for a in agents if a.get("enabled", 0) == 1]
                    offline = [a for a in agents if a.get("enabled", 0) == 0]

                    return {
                        "success": True,
                        "agents": agents,
                        "total": len(agents),
                        "online": len(online),
                        "offline": len(offline)
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}",
                        "agents": []
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "agents": []
            }

    async def get_test_results(self, test_id: int, window: str = "12h") -> Dict[str, Any]:
        """Get results for a specific test.

        Args:
            test_id: Test ID
            window: Time window (12h, 1d, 7d, etc.)

        Returns:
            Dictionary with test results
        """
        try:
            settings = get_settings()
            async with httpx.AsyncClient(timeout=30.0, verify=settings.verify_ssl) as client:
                response = await client.get(
                    f"{self.base_url}/test-results/{test_id}",
                    headers=self.headers,
                    params={"window": window}
                )

                if response.status_code == 200:
                    return {
                        "success": True,
                        "data": response.json()
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}"
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def create_test(
        self,
        test_name: str,
        url: str,
        test_type: str = "http-server",
        interval: int = 300
    ) -> Dict[str, Any]:
        """Create a new ThousandEyes test.

        Args:
            test_name: Name of the test
            url: Target URL to test
            test_type: Type of test (http-server, page-load, etc.)
            interval: Test interval in seconds

        Returns:
            Dictionary with creation result
        """
        try:
            # Build test configuration based on type
            test_config = {
                "testName": test_name,
                "interval": interval,
                "enabled": 1,
            }

            # Add type-specific configuration
            if test_type == "http-server":
                test_config["url"] = url
                test_config["protocol"] = "TCP"
                test_config["port"] = 443 if url.startswith("https") else 80
            elif test_type == "page-load":
                test_config["url"] = url
                test_config["protocol"] = "HTTP"
                test_config["pageLoadTimeLimit"] = 10
            elif test_type == "web-transactions":
                test_config["url"] = url
            else:
                # Default configuration
                test_config["url"] = url

            # Verbose logging for debugging
            endpoint = f"{self.base_url}/tests/{test_type}"
            logger.info(f"ThousandEyes Create Test: POST {endpoint}")
            logger.debug(f"Headers: Authorization: Bearer {self.oauth_token[:10]}...")
            logger.debug(f"Test config: {test_config}")

            settings = get_settings()
            async with httpx.AsyncClient(timeout=30.0, verify=settings.verify_ssl) as client:
                response = await client.post(
                    endpoint,
                    headers=self.headers,
                    json=test_config
                )

                # Log response
                logger.info(f"ThousandEyes Response: HTTP {response.status_code}")
                if response.status_code >= 400:
                    logger.error(f"Error response: {response.text[:500]}")

                if response.status_code in [200, 201]:
                    data = response.json()
                    logger.info(f"Test '{test_name}' created successfully")
                    return {
                        "success": True,
                        "test": data,
                        "message": f"Test '{test_name}' created successfully"
                    }
                else:
                    error_detail = response.json() if response.text else {}
                    error_msg = f"HTTP {response.status_code}: {error_detail.get('error', response.text)}"
                    logger.error(f"Failed to create test: {error_msg}")
                    return {
                        "success": False,
                        "error": error_msg
                    }
        except Exception as e:
            logger.error(f"Exception creating test: {type(e).__name__}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_endpoint_agents(self) -> Dict[str, Any]:
        """Get endpoint agents status.

        Returns:
            Dictionary with endpoint agents data
        """
        try:
            settings = get_settings()
            async with httpx.AsyncClient(timeout=30.0, verify=settings.verify_ssl) as client:
                response = await client.get(
                    f"{self.base_url}/endpoint/agents",
                    headers=self.headers
                )

                if response.status_code == 200:
                    data = response.json()
                    agents = data.get("endpointAgents", [])

                    return {
                        "success": True,
                        "agents": agents,
                        "count": len(agents)
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}",
                        "agents": []
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "agents": []
            }


def get_thousandeyes_client() -> Optional[ThousandEyesClient]:
    """Get ThousandEyes client instance if configured.

    Checks for token in this order:
    1. Database config (thousandeyes_oauth_token)
    2. Environment variable (THOUSANDEYES_OAUTH_TOKEN)

    Returns:
        ThousandEyes client or None if not configured
    """
    from src.services.config_service import get_config_or_env

    # Check database first, then environment
    oauth_token = get_config_or_env("thousandeyes_oauth_token", "THOUSANDEYES_OAUTH_TOKEN")
    api_url = os.getenv("THOUSANDEYES_API_URL", "https://api.thousandeyes.com/v7")

    if not oauth_token or oauth_token == "your-thousandeyes-token-here":
        return None

    return ThousandEyesClient(oauth_token, api_url)
