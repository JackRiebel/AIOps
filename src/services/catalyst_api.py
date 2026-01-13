"""Cisco Catalyst Center API client for network management."""

import logging
from typing import Any, Dict, List, Optional
import httpx
import asyncio

from src.config.settings import get_settings

logger = logging.getLogger(__name__)


class CatalystCenterClient:
    """Client for interacting with Cisco Catalyst Center APIs using direct HTTP calls."""

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        base_url: str = "",
        verify_ssl: Optional[bool] = None,
        version: str = "v1",
        api_token: Optional[str] = None
    ):
        """Initialize Catalyst Center API client.

        Supports two authentication methods:
        1. Username/Password: Provide username and password (will auto-refresh tokens)
        2. Bearer Token: Provide api_token (X-Auth-Token)

        If both are provided, the token will be used initially but username/password
        will be used to refresh the token when it expires.

        Args:
            username: Catalyst Center username (for token refresh)
            password: Catalyst Center password (for token refresh)
            base_url: Base URL (e.g., https://sandboxdnac.cisco.com)
            verify_ssl: Whether to verify SSL certificates
            version: API version to use (default: v1)
            api_token: Bearer token for authentication (X-Auth-Token)
        """
        # Use global setting if verify_ssl not explicitly provided
        if verify_ssl is None:
            verify_ssl = get_settings().verify_ssl

        # Strip any trailing slashes and remove API path if it's already included
        self.base_url = base_url.rstrip('/')

        # Remove the API path if it's already in the base_url
        # This handles cases where the UI provides the full API path
        if '/dna/intent/api/' in self.base_url:
            # Extract just the base URL (everything before /dna/intent/api/)
            self.base_url = self.base_url.split('/dna/intent/api/')[0]

        self.username = username
        self.password = password
        self.verify_ssl = verify_ssl
        self.api_token = api_token
        self._token_refresh_in_progress = False
        self.settings = get_settings()
        self.api_base = f"{self.base_url}/dna/intent/api/{version}"

        # Headers for API requests
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        if api_token:
            # Use the provided bearer token
            self.headers["X-Auth-Token"] = api_token
            logger.info(f"Initialized Catalyst Center client with bearer token for {base_url}")
        elif username and password:
            # Will authenticate on first request
            logger.info(f"Initialized Catalyst Center client with username/password for {base_url}")
        else:
            raise ValueError("Must provide either api_token or username/password for authentication")

    async def _authenticate(self) -> bool:
        """Authenticate with Catalyst Center and get a new token.

        Returns:
            True if authentication succeeded, False otherwise
        """
        if not self.username or not self.password:
            logger.error("Cannot refresh token: username/password not configured")
            return False

        auth_url = f"{self.base_url}/dna/system/api/v1/auth/token"
        logger.info(f"Authenticating with Catalyst Center at {auth_url}")

        try:
            import base64
            auth_string = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()

            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=30.0) as client:
                response = await client.post(
                    auth_url,
                    headers={
                        "Authorization": f"Basic {auth_string}",
                        "Content-Type": "application/json"
                    }
                )
                response.raise_for_status()
                data = response.json()

                new_token = data.get("Token")
                if new_token:
                    self.api_token = new_token
                    self.headers["X-Auth-Token"] = new_token
                    logger.info("Successfully refreshed Catalyst Center token")
                    return True
                else:
                    logger.error("Authentication response did not contain a token")
                    return False

        except httpx.HTTPStatusError as e:
            logger.error(f"Authentication failed: {e.response.status_code} - {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return False

    async def _ensure_authenticated(self) -> bool:
        """Ensure we have a valid token, authenticating if necessary.

        Returns:
            True if we have a token (may still be expired), False if auth failed
        """
        if not self.api_token and self.username and self.password:
            return await self._authenticate()
        return bool(self.api_token)

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        _retry_on_auth: bool = True
    ) -> Dict[str, Any]:
        """Make an authenticated request to the Catalyst Center API.

        Automatically refreshes token on 401 errors if username/password are configured.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (e.g., 'site' or 'network-device')
            params: Optional query parameters
            data: Optional request body
            _retry_on_auth: Internal flag to prevent infinite retry loops

        Returns:
            Response data as dictionary
        """
        # Ensure we have a token before making the request
        if not await self._ensure_authenticated():
            return {"error": "Authentication failed. Could not obtain token."}

        url = f"{self.api_base}/{endpoint.lstrip('/')}"

        try:
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=30.0) as client:
                response = await client.request(
                    method,
                    url,
                    headers=self.headers,
                    params=params,
                    json=data
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                # Token expired - try to refresh if we have credentials
                if _retry_on_auth and self.username and self.password:
                    logger.info("Token expired, attempting to refresh...")
                    if await self._authenticate():
                        # Retry the request with new token
                        return await self._make_request(
                            method, endpoint, params, data, _retry_on_auth=False
                        )
                logger.error("Authentication failed. Token expired and could not be refreshed.")
                return {"error": "Authentication failed. Token expired."}
            elif e.response.status_code == 429:
                await asyncio.sleep(1)  # Rate limit delay
                logger.warning("Rate limit exceeded")
                return {"error": "Rate limit exceeded. Please try again later."}
            else:
                logger.error(f"API error: {e.response.status_code} - {e.response.text}")
                return {"error": f"API error: {e.response.status_code} - {e.response.text}"}
        except httpx.RequestError as e:
            logger.error(f"Network error: {str(e)}")
            return {"error": f"Network error: {str(e)}"}
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return {"error": f"Unexpected error: {str(e)}"}

    # ========================================
    # Site Management
    # ========================================

    async def get_sites(self) -> List[Dict[str, Any]]:
        """Get all sites in the Catalyst Center instance."""
        try:
            data = await self._make_request("GET", "site")
            if "error" in data:
                logger.error(f"Failed to fetch sites: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch sites: {e}")
            return []

    async def get_site_details(self, site_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific site."""
        try:
            data = await self._make_request("GET", f"site/{site_id}")
            if "error" in data:
                logger.error(f"Failed to fetch site details for {site_id}: {data['error']}")
                return None
            sites = data.get("response", [])
            return sites[0] if sites else None
        except Exception as e:
            logger.error(f"Failed to fetch site details for {site_id}: {e}")
            return None

    # ========================================
    # Device Management
    # ========================================

    async def get_devices(
        self,
        family: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all devices in the Catalyst Center instance.

        Args:
            family: Filter by device family (Switches and Hubs, Routers, Wireless Controller, etc.)
            status: Filter by device status (online, offline)
        """
        try:
            params = {}
            if family:
                params['family'] = family
            if status:
                # Map our status to Catalyst Center's reachabilityStatus
                if status == 'online':
                    params['reachabilityStatus'] = 'Reachable'
                elif status == 'offline':
                    params['reachabilityStatus'] = 'Unreachable'

            data = await self._make_request("GET", "network-device", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch devices: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch devices: {e}")
            return []

    async def get_device_details(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific device."""
        try:
            data = await self._make_request("GET", f"network-device/{device_id}")
            if "error" in data:
                logger.error(f"Failed to fetch device details for {device_id}: {data['error']}")
                return None
            return data.get("response")
        except Exception as e:
            logger.error(f"Failed to fetch device details for {device_id}: {e}")
            return None

    async def get_device_health(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get health information for a device."""
        try:
            # Use device enrichment to get health data
            headers = {
                **self.headers,
                'entity_type': 'network_device',
                'entity_uuid': device_id
            }

            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=30.0) as client:
                response = await client.get(
                    f"{self.api_base}/device-enrichment-details",
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response")
        except Exception as e:
            logger.error(f"Failed to fetch device health for {device_id}: {e}")
            return None

    async def get_device_interfaces(self, device_id: str) -> List[Dict[str, Any]]:
        """Get all interfaces for a specific device."""
        try:
            data = await self._make_request("GET", f"interface/network-device/{device_id}")
            if "error" in data:
                logger.error(f"Failed to fetch interfaces for device {device_id}: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch interfaces for device {device_id}: {e}")
            return []

    # ========================================
    # Client Management
    # ========================================

    async def get_clients(
        self,
        site_id: Optional[str] = None,
        timespan: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get all clients connected to the network.

        Args:
            site_id: Filter by site ID
            timespan: Time range in seconds (not directly supported)
        """
        try:
            params = {}
            if site_id:
                params['siteId'] = site_id

            data = await self._make_request("GET", "client-detail", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch clients: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch clients: {e}")
            return []

    async def get_client_details(self, client_mac: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific client."""
        try:
            params = {'macAddress': client_mac}
            data = await self._make_request("GET", "client-detail", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch client details for {client_mac}: {data['error']}")
                return None
            clients = data.get("response", [])
            return clients[0] if clients else None
        except Exception as e:
            logger.error(f"Failed to fetch client details for {client_mac}: {e}")
            return None

    # ========================================
    # Network Management
    # ========================================

    async def get_network_health(self, site_id: Optional[str] = None) -> Dict[str, Any]:
        """Get overall network health statistics.

        Args:
            site_id: Optional site ID to filter by
        """
        try:
            params = {}
            if site_id:
                params['siteId'] = site_id

            data = await self._make_request("GET", "network-health", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch network health: {data['error']}")
                return {}
            return data.get("response", {})
        except Exception as e:
            logger.error(f"Failed to fetch network health: {e}")
            return {}

    async def get_topology(self, topology_type: str = "physical") -> Dict[str, Any]:
        """Get network topology.

        Args:
            topology_type: Type of topology (physical, layer2, layer3, vlan)
        """
        try:
            params = {'topologyType': topology_type}
            data = await self._make_request("GET", "topology/physical-topology", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch topology: {data['error']}")
                return {}
            return data.get("response", {})
        except Exception as e:
            logger.error(f"Failed to fetch topology: {e}")
            return {}

    # ========================================
    # Issues and Alerts
    # ========================================

    async def get_issues(
        self,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        timespan: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get issues/alerts from Catalyst Center.

        Args:
            severity: Filter by severity (P1, P2, P3, P4)
            status: Filter by status (active, resolved)
            timespan: Time range in seconds
        """
        try:
            params = {}
            if severity:
                params['priority'] = severity
            if status:
                params['issueStatus'] = status.upper()
            if timespan:
                # Convert seconds to timestamp
                from datetime import datetime, timedelta
                start_time = int((datetime.now() - timedelta(seconds=timespan)).timestamp() * 1000)
                params['startTime'] = start_time

            data = await self._make_request("GET", "issues", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch issues: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch issues: {e}")
            return []

    # ========================================
    # Configuration Management
    # ========================================

    async def get_vlans(self, site_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all VLANs in the network."""
        try:
            data = await self._make_request("GET", "layer2-virtual-network")
            if "error" in data:
                logger.error(f"Failed to fetch VLANs: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch VLANs: {e}")
            return []

    async def get_wireless_profiles(self) -> List[Dict[str, Any]]:
        """Get all wireless profiles (SSIDs)."""
        try:
            data = await self._make_request("GET", "enterprise-ssid")
            if "error" in data:
                logger.error(f"Failed to fetch wireless profiles: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch wireless profiles: {e}")
            return []

    async def get_wireless_profile_details(self, ssid_name: str) -> Optional[Dict[str, Any]]:
        """Get details for a specific wireless profile."""
        try:
            params = {'ssidName': ssid_name}
            data = await self._make_request("GET", "enterprise-ssid", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch wireless profile {ssid_name}: {data['error']}")
                return None
            profiles = data.get("response", [])
            return profiles[0] if profiles else None
        except Exception as e:
            logger.error(f"Failed to fetch wireless profile {ssid_name}: {e}")
            return None

    # ========================================
    # Command Runner (for advanced operations)
    # ========================================

    async def run_read_only_commands(
        self,
        device_uuids: List[str],
        commands: List[str]
    ) -> Dict[str, Any]:
        """Run read-only CLI commands on devices.

        Args:
            device_uuids: List of device UUIDs to run commands on
            commands: List of CLI commands to execute
        """
        try:
            payload = {
                "commands": commands,
                "deviceUuids": device_uuids
            }
            data = await self._make_request("POST", "command-runner/run-read-only-commands", data=payload)
            if "error" in data:
                logger.error(f"Failed to run commands: {data['error']}")
                return {}
            return data.get("response", {})
        except Exception as e:
            logger.error(f"Failed to run commands: {e}")
            return {}

    # ========================================
    # Compliance and Assurance
    # ========================================

    async def get_compliance_status(self, device_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get compliance status for devices."""
        try:
            params = {}
            if device_id:
                params['deviceUuid'] = device_id

            data = await self._make_request("GET", "compliance", params=params)
            if "error" in data:
                logger.error(f"Failed to fetch compliance status: {data['error']}")
                return []
            return data.get("response", [])
        except Exception as e:
            logger.error(f"Failed to fetch compliance status: {e}")
            return []

    async def get_application_health(self) -> Dict[str, Any]:
        """Get application health and performance metrics."""
        try:
            data = await self._make_request("GET", "application-policy-application-set")
            if "error" in data:
                logger.error(f"Failed to fetch application health: {data['error']}")
                return {}
            return data.get("response", {})
        except Exception as e:
            logger.error(f"Failed to fetch application health: {e}")
            return {}

    # ========================================
    # Context Manager Support
    # ========================================

    async def close(self):
        """Close the client connection (cleanup if needed)."""
        # No persistent connection to close with httpx AsyncClient
        pass

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
