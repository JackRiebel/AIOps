"""Authentication middleware for Meraki Dashboard API requests."""

import logging
from typing import Any, Callable, Dict, Optional

from src.services.credential_manager import CredentialManager
from src.services.meraki_api import MerakiAPIClient

logger = logging.getLogger(__name__)


class AuthMiddleware:
    """Middleware for handling authentication to Meraki Dashboard."""

    def __init__(self, organization_name: str = "default"):
        """Initialize authentication middleware.

        Args:
            organization_name: Name of the organization to authenticate with
        """
        self.organization_name = organization_name
        self.credential_manager = CredentialManager()
        self.api_client: Optional[MerakiAPIClient] = None

    async def get_api_client(self) -> MerakiAPIClient:
        """Get or create authenticated API client.

        Returns:
            Authenticated MerakiAPIClient instance

        Raises:
            RuntimeError: If credentials not found
        """
        if self.api_client is not None:
            return self.api_client

        # Retrieve credentials from database
        credentials = await self.credential_manager.get_credentials(self.organization_name)

        if not credentials:
            raise RuntimeError(
                f"No credentials found for organization '{self.organization_name}'. "
                f"Please configure credentials first."
            )

        # Create API client (no separate authentication needed with API key)
        self.api_client = MerakiAPIClient(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            verify_ssl=credentials["verify_ssl"],
        )

        logger.info(f"Successfully initialized API client for organization '{self.organization_name}'")
        return self.api_client

    async def execute_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute authenticated API request.

        Args:
            method: HTTP method
            path: API endpoint path
            params: Query parameters
            json_data: JSON request body

        Returns:
            Response data as dictionary

        Raises:
            RuntimeError: If request fails
        """
        client = await self.get_api_client()

        try:
            response = await client.request(
                method=method,
                path=path,
                params=params,
                json_data=json_data,
            )

            # Return JSON response
            if response.headers.get("content-type", "").startswith("application/json"):
                return response.json()

            # Return text for non-JSON responses
            return {"data": response.text, "status_code": response.status_code}

        except Exception as e:
            logger.error(f"API request failed: {method} {path} - {e}")
            raise RuntimeError(f"API request failed: {e}")

    async def close(self):
        """Close API client connection."""
        if self.api_client:
            await self.api_client.close()
            self.api_client = None

    def __call__(self, func: Callable) -> Callable:
        """Decorator for adding authentication to functions.

        Args:
            func: Function to wrap with authentication

        Returns:
            Wrapped function with authentication
        """
        async def wrapper(*args, **kwargs):
            try:
                # Ensure we're authenticated before calling function
                await self.get_api_client()
                return await func(*args, **kwargs)
            finally:
                # Clean up if needed
                pass

        return wrapper
