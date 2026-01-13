"""Meraki Dashboard API client for authentication and requests."""

import asyncio
import logging
import random
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import httpx

from src.config.settings import get_settings

# HTTP status codes that should NOT be retried (non-transient errors)
NON_RETRYABLE_STATUS_CODES = {
    400,  # Bad Request - fix the request
    401,  # Unauthorized - invalid API key
    403,  # Forbidden - permission denied
    404,  # Not Found - resource doesn't exist
    405,  # Method Not Allowed
    409,  # Conflict - fix the request
    422,  # Unprocessable Entity - fix the request
}

logger = logging.getLogger(__name__)


class MerakiAPIClient:
    """Client for interacting with Meraki Dashboard APIs."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.meraki.com/api/v1",
        verify_ssl: Optional[bool] = None,
    ):
        """Initialize Meraki Dashboard API client.

        Args:
            api_key: Meraki Dashboard API key
            base_url: Meraki Dashboard API base URL
            verify_ssl: Whether to verify SSL certificates (defaults to global setting)
        """
        # Ensure base_url has trailing slash for urljoin to work correctly
        self.base_url = base_url.rstrip("/") + "/"
        self.api_key = api_key
        self.settings = get_settings()

        # Use global setting if verify_ssl not explicitly provided
        if verify_ssl is None:
            verify_ssl = self.settings.verify_ssl
        self.verify_ssl = verify_ssl

        # HTTP client configuration
        self.client = httpx.AsyncClient(
            verify=self.verify_ssl,
            timeout=httpx.Timeout(self.settings.api_timeout),
            follow_redirects=True,
        )

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Make authenticated request to Meraki Dashboard.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            path: API endpoint path
            params: Query parameters
            json_data: JSON request body
            headers: Additional headers

        Returns:
            Parsed JSON response data (dict or list)

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        # Build full URL
        url = urljoin(self.base_url, path.lstrip("/"))

        # Prepare headers with API key authentication
        # CRITICAL FIX: Meraki requires X-Cisco-Meraki-API-Key header, NOT Bearer token
        request_headers = headers or {}
        request_headers["X-Cisco-Meraki-API-Key"] = self.api_key
        request_headers["Content-Type"] = "application/json"

        # Verbose logging for debugging (API key is redacted for security)
        logger.info(f"Meraki API Request: {method.upper()} {url}")
        logger.debug("Headers: X-Cisco-Meraki-API-Key: [REDACTED]")
        if json_data:
            logger.debug(f"Request body: {json_data}")

        # Make request with exponential backoff retry logic
        max_retries = self.settings.api_retry_attempts
        base_delay = 1.0  # Base delay in seconds
        max_delay = 30.0  # Maximum delay cap
        last_exception = None

        for attempt in range(max_retries):
            try:
                response = await self.client.request(
                    method=method.upper(),
                    url=url,
                    params=params,
                    json=json_data,
                    headers=request_headers,
                )

                # Log response status
                logger.info(f"Meraki API Response: HTTP {response.status_code}")
                if response.status_code >= 400:
                    logger.error(f"Error response body: {response.text[:500]}")

                response.raise_for_status()
                return response.json()

            except httpx.HTTPStatusError as e:
                last_exception = e
                status_code = e.response.status_code
                logger.error(f"HTTP Error {status_code}: {e.response.text[:500]}")

                # Don't retry non-transient errors (4xx client errors except rate limits)
                if status_code in NON_RETRYABLE_STATUS_CODES:
                    logger.warning(f"Non-retryable error {status_code}, raising immediately")
                    raise

                # Check for rate limit (429) - use Retry-After header if present
                if status_code == 429:
                    retry_after = e.response.headers.get("Retry-After")
                    if retry_after:
                        delay = min(float(retry_after), max_delay)
                    else:
                        delay = min(base_delay * (2 ** attempt), max_delay)
                else:
                    # Exponential backoff with jitter for other errors
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    # Add jitter (0-25% of delay) to prevent thundering herd
                    jitter = delay * random.uniform(0, 0.25)
                    delay = delay + jitter

                if attempt < max_retries - 1:
                    logger.warning(
                        f"Request failed (attempt {attempt + 1}/{max_retries}), "
                        f"retrying in {delay:.2f}s: {e}"
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise

            except (httpx.ConnectError, httpx.TimeoutException) as e:
                # Network errors are always retryable
                last_exception = e
                delay = min(base_delay * (2 ** attempt), max_delay)
                jitter = delay * random.uniform(0, 0.25)
                delay = delay + jitter

                logger.error(f"Network error: {type(e).__name__}: {str(e)}")
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Network error (attempt {attempt + 1}/{max_retries}), "
                        f"retrying in {delay:.2f}s"
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise

            except Exception as e:
                # Unknown errors - log and raise immediately
                logger.error(f"Unexpected error: {type(e).__name__}: {str(e)}")
                raise

        # If we get here, all retries failed
        if last_exception:
            raise last_exception

    async def close(self):
        """Close HTTP client connection."""
        await self.client.aclose()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    # =========================================================================
    # Bandwidth & Traffic Methods
    # =========================================================================

    async def get_organization_uplinks_statuses(self, org_id: str) -> list:
        """Get uplink statuses for all appliances in an organization.

        Args:
            org_id: Meraki organization ID

        Returns:
            List of appliance uplink statuses
        """
        try:
            return await self.request(
                "GET",
                f"/organizations/{org_id}/appliance/uplink/statuses"
            )
        except Exception as e:
            logger.error(f"Failed to get uplink statuses for org {org_id}: {e}")
            return []

    async def get_device_uplink_loss_and_latency(
        self,
        serial: str,
        ip: str = "8.8.8.8",
        timespan: int = 900,  # 15 minutes
        resolution: int = 60,
    ) -> list:
        """Get uplink loss and latency history for a device.

        Args:
            serial: Device serial number
            ip: Destination IP for latency measurements (default: 8.8.8.8)
            timespan: Timespan in seconds (default: 15 minutes)
            resolution: Resolution in seconds (default: 60s)

        Returns:
            List of loss/latency data points
        """
        try:
            return await self.request(
                "GET",
                f"/devices/{serial}/lossAndLatencyHistory",
                params={
                    "ip": ip,
                    "timespan": timespan,
                    "resolution": resolution,
                }
            )
        except Exception as e:
            logger.error(f"Failed to get loss/latency for device {serial}: {e}")
            return []

    async def get_network_appliance_uplinks_usage_history(
        self,
        network_id: str,
        timespan: int = 900,  # 15 minutes
        resolution: int = 300,  # 5 minute intervals
    ) -> list:
        """Get uplink usage history for a network's appliance.

        Args:
            network_id: Meraki network ID
            timespan: Timespan in seconds (default: 15 minutes)
            resolution: Resolution in seconds (default: 5 minutes)

        Returns:
            List of bandwidth usage data points
        """
        try:
            return await self.request(
                "GET",
                f"/networks/{network_id}/appliance/uplinks/usageHistory",
                params={
                    "timespan": timespan,
                    "resolution": resolution,
                }
            )
        except Exception as e:
            logger.error(f"Failed to get uplink usage history for network {network_id}: {e}")
            return []

    async def get_device_uplink_status(self, serial: str) -> dict:
        """Get current uplink status for a device.

        Args:
            serial: Device serial number

        Returns:
            Device uplink status dict
        """
        try:
            return await self.request(
                "GET",
                f"/devices/{serial}/appliance/uplinks/settings"
            )
        except Exception as e:
            logger.error(f"Failed to get uplink status for device {serial}: {e}")
            return {}

    # =========================================================================
    # Security Event Methods
    # =========================================================================

    async def get_organization_security_events(
        self,
        org_id: str,
        timespan: int = 86400,  # 24 hours
        per_page: int = 100,
    ) -> list:
        """Get security events for an organization.

        Fetches appliance security events including malware, intrusion detection,
        and content filtering events.

        Args:
            org_id: Meraki organization ID
            timespan: Timespan in seconds (default: 24 hours, max: 31 days)
            per_page: Number of events per page (default: 100, max: 1000)

        Returns:
            List of security event dicts with keys:
            - ts: Timestamp
            - eventType: Type of event (IDS Alert, File Scanned, etc.)
            - deviceSerial: Device that detected the event
            - srcIp, destIp: Source and destination IPs
            - protocol, destPort: Protocol and port info
            - message: Event description
        """
        try:
            return await self.request(
                "GET",
                f"/organizations/{org_id}/appliance/security/events",
                params={
                    "timespan": min(timespan, 2678400),  # Max 31 days
                    "perPage": min(per_page, 1000),
                }
            )
        except Exception as e:
            logger.error(f"Failed to get security events for org {org_id}: {e}")
            return []

    async def get_organization_security_intrusion_stats(
        self,
        org_id: str,
        timespan: int = 86400,  # 24 hours
    ) -> dict:
        """Get intrusion detection statistics for an organization.

        Args:
            org_id: Meraki organization ID
            timespan: Timespan in seconds (default: 24 hours)

        Returns:
            Dict with intrusion stats including counts by severity and rule
        """
        try:
            return await self.request(
                "GET",
                f"/organizations/{org_id}/appliance/security/intrusion/stats",
                params={"timespan": timespan}
            )
        except Exception as e:
            logger.error(f"Failed to get intrusion stats for org {org_id}: {e}")
            return {}

    async def get_network_security_events(
        self,
        network_id: str,
        timespan: int = 86400,  # 24 hours
        per_page: int = 100,
    ) -> list:
        """Get security events for a specific network.

        Args:
            network_id: Meraki network ID
            timespan: Timespan in seconds (default: 24 hours)
            per_page: Number of events per page

        Returns:
            List of security events for the network
        """
        try:
            return await self.request(
                "GET",
                f"/networks/{network_id}/appliance/security/events",
                params={
                    "timespan": min(timespan, 2678400),
                    "perPage": min(per_page, 1000),
                }
            )
        except Exception as e:
            logger.error(f"Failed to get security events for network {network_id}: {e}")
            return []

    async def get_organization_content_filtering_categories(
        self,
        org_id: str,
    ) -> dict:
        """Get content filtering categories for an organization.

        Args:
            org_id: Meraki organization ID

        Returns:
            Dict with content filtering categories
        """
        try:
            return await self.request(
                "GET",
                f"/organizations/{org_id}/appliance/contentFiltering/categories"
            )
        except Exception as e:
            logger.error(f"Failed to get content filtering categories for org {org_id}: {e}")
            return {}
