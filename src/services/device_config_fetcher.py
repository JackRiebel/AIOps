"""Service to fetch relevant device configuration for incident context."""

import logging
from typing import Any, Dict, List, Optional

from src.services.credential_manager import CredentialManager
from src.services.meraki_api import MerakiAPIClient

logger = logging.getLogger(__name__)


class DeviceConfigFetcher:
    """Fetches relevant device configuration based on incident type."""

    def __init__(self):
        """Initialize the device config fetcher."""
        self.credential_manager = CredentialManager()

    async def fetch_device_config(
        self,
        device_serial: str,
        network_id: str,
        organization_name: str,
        incident_type: str,
    ) -> Dict[str, Any]:
        """Fetch relevant device config based on incident type.

        Args:
            device_serial: Device serial number
            network_id: Network ID the device belongs to
            organization_name: Name of the Meraki organization
            incident_type: Type of incident (e.g., 'packet_loss', 'vlan_violation')

        Returns:
            Dictionary with relevant device configuration
        """
        config: Dict[str, Any] = {}

        credentials = await self.credential_manager.get_credentials(organization_name)
        if not credentials:
            logger.warning(f"No credentials found for organization: {organization_name}")
            return config

        try:
            async with MerakiAPIClient(
                api_key=credentials["api_key"],
                base_url=credentials["base_url"],
                verify_ssl=credentials.get("verify_ssl", False),
            ) as client:
                # Always get basic device info
                device_info = await self._get_device_info(client, device_serial)
                if device_info:
                    config["device_info"] = device_info

                # Get incident-specific config based on device type
                device_model = device_info.get("model", "") if device_info else ""
                incident_type_lower = incident_type.lower() if incident_type else ""

                if self._is_wireless_device(device_model):
                    wireless_config = await self._get_wireless_config(
                        client, device_serial, network_id, incident_type_lower
                    )
                    config.update(wireless_config)
                elif self._is_switch_device(device_model):
                    switch_config = await self._get_switch_config(
                        client, device_serial, network_id, incident_type_lower
                    )
                    config.update(switch_config)
                elif self._is_appliance_device(device_model):
                    appliance_config = await self._get_appliance_config(
                        client, device_serial, network_id, incident_type_lower
                    )
                    config.update(appliance_config)

        except Exception as e:
            logger.error(f"Error fetching device config for {device_serial}: {e}")

        return config

    def _is_wireless_device(self, model: str) -> bool:
        """Check if device is a wireless AP (MR, CW, or GR series)."""
        return model.startswith(("MR", "CW", "GR"))

    def _is_switch_device(self, model: str) -> bool:
        """Check if device is a switch."""
        return model.startswith("MS")

    def _is_appliance_device(self, model: str) -> bool:
        """Check if device is a security appliance."""
        return model.startswith(("MX", "Z"))

    async def _get_device_info(
        self, client: MerakiAPIClient, serial: str
    ) -> Optional[Dict[str, Any]]:
        """Get basic device information."""
        try:
            response = await client.request("GET", f"/devices/{serial}")
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching device info for {serial}: {e}")
            return None

    async def _get_wireless_config(
        self,
        client: MerakiAPIClient,
        serial: str,
        network_id: str,
        incident_type: str,
    ) -> Dict[str, Any]:
        """Get wireless-specific configuration for an AP."""
        config: Dict[str, Any] = {}

        # Determine what config to fetch based on incident type
        fetch_rf_settings = incident_type in [
            "packet_loss",
            "high_packet_loss",
            "interference",
            "poor_signal",
            "client_connectivity",
            "roaming",
        ]

        try:
            # RF settings (important for packet loss, interference issues)
            if fetch_rf_settings:
                # Get device radio settings
                try:
                    response = await client.request(
                        "GET", f"/devices/{serial}/wireless/radio/settings"
                    )
                    config["radio_settings"] = response.json()
                except Exception as e:
                    logger.debug(f"Could not fetch radio settings: {e}")

                # Get channel utilization history (last hour)
                try:
                    response = await client.request(
                        "GET",
                        f"/devices/{serial}/wireless/channelUtilizationHistory",
                        params={"timespan": 3600},
                    )
                    data = response.json()
                    # Limit to last 10 data points
                    config["channel_utilization"] = data[:10] if data else []
                except Exception as e:
                    logger.debug(f"Could not fetch channel utilization: {e}")

                # Get RF profiles for the network
                try:
                    response = await client.request(
                        "GET", f"/networks/{network_id}/wireless/rfProfiles"
                    )
                    config["rf_profiles"] = response.json()
                except Exception as e:
                    logger.debug(f"Could not fetch RF profiles: {e}")

            # Get enabled SSIDs for context
            try:
                response = await client.request(
                    "GET", f"/networks/{network_id}/wireless/ssids"
                )
                ssids = response.json()
                config["enabled_ssids"] = [s for s in ssids if s.get("enabled")]
            except Exception as e:
                logger.debug(f"Could not fetch SSIDs: {e}")

            # Get connected clients (helpful for client issues)
            if "client" in incident_type:
                try:
                    response = await client.request(
                        "GET",
                        f"/devices/{serial}/clients",
                        params={"timespan": 3600},
                    )
                    clients = response.json()
                    config["connected_clients"] = clients[:20]  # Limit to 20
                    config["client_count"] = len(clients)
                except Exception as e:
                    logger.debug(f"Could not fetch clients: {e}")

        except Exception as e:
            logger.error(f"Error fetching wireless config: {e}")

        return config

    async def _get_switch_config(
        self,
        client: MerakiAPIClient,
        serial: str,
        network_id: str,
        incident_type: str,
    ) -> Dict[str, Any]:
        """Get switch-specific configuration."""
        config: Dict[str, Any] = {}

        try:
            # Port statuses (important for connectivity issues)
            try:
                response = await client.request(
                    "GET", f"/devices/{serial}/switch/ports/statuses"
                )
                port_statuses = response.json()
                config["port_statuses"] = port_statuses

                # Summarize port status
                online_count = sum(1 for p in port_statuses if p.get("status") == "Connected")
                config["port_summary"] = {
                    "total": len(port_statuses),
                    "connected": online_count,
                    "disconnected": len(port_statuses) - online_count,
                }
            except Exception as e:
                logger.debug(f"Could not fetch port statuses: {e}")

            # VLAN config (for VLAN mismatch issues)
            if "vlan" in incident_type:
                try:
                    response = await client.request(
                        "GET", f"/devices/{serial}/switch/ports"
                    )
                    config["port_configs"] = response.json()
                except Exception as e:
                    logger.debug(f"Could not fetch port configs: {e}")

            # STP info (for loop issues)
            if "loop" in incident_type or "stp" in incident_type:
                try:
                    response = await client.request(
                        "GET", f"/networks/{network_id}/switch/stp"
                    )
                    config["stp_config"] = response.json()
                except Exception as e:
                    logger.debug(f"Could not fetch STP config: {e}")

            # LLDP/CDP neighbors
            try:
                response = await client.request("GET", f"/devices/{serial}/lldpCdp")
                config["neighbors"] = response.json()
            except Exception as e:
                logger.debug(f"Could not fetch LLDP/CDP neighbors: {e}")

        except Exception as e:
            logger.error(f"Error fetching switch config: {e}")

        return config

    async def _get_appliance_config(
        self,
        client: MerakiAPIClient,
        serial: str,
        network_id: str,
        incident_type: str,
    ) -> Dict[str, Any]:
        """Get security appliance configuration."""
        config: Dict[str, Any] = {}

        try:
            # Uplink settings (for WAN issues)
            try:
                response = await client.request(
                    "GET", f"/devices/{serial}/appliance/uplinks/settings"
                )
                config["uplink_settings"] = response.json()
            except Exception as e:
                logger.debug(f"Could not fetch uplink settings: {e}")

            # Uplink status
            try:
                response = await client.request(
                    "GET", f"/organizations/*/appliance/uplink/statuses",
                )
                # This might not work without org ID, try network-level
            except Exception:
                try:
                    response = await client.request(
                        "GET", f"/networks/{network_id}/appliance/uplinks"
                    )
                    config["uplink_status"] = response.json()
                except Exception as e:
                    logger.debug(f"Could not fetch uplink status: {e}")

            # Loss and latency history (for connectivity issues)
            if "loss" in incident_type or "latency" in incident_type or "connectivity" in incident_type:
                try:
                    response = await client.request(
                        "GET",
                        f"/devices/{serial}/lossAndLatencyHistory",
                        params={"ip": "8.8.8.8", "timespan": 3600},
                    )
                    data = response.json()
                    config["loss_latency_history"] = data[:10] if data else []
                except Exception as e:
                    logger.debug(f"Could not fetch loss/latency history: {e}")

            # VPN status (for VPN issues)
            if "vpn" in incident_type:
                try:
                    response = await client.request(
                        "GET", f"/networks/{network_id}/appliance/vpn/siteToSiteVpn"
                    )
                    config["vpn_config"] = response.json()
                except Exception as e:
                    logger.debug(f"Could not fetch VPN config: {e}")

            # Firewall rules (for connectivity issues)
            if "firewall" in incident_type or "blocked" in incident_type:
                try:
                    response = await client.request(
                        "GET", f"/networks/{network_id}/appliance/firewall/l3FirewallRules"
                    )
                    rules = response.json()
                    config["firewall_rules"] = rules.get("rules", [])[:10]  # Limit
                except Exception as e:
                    logger.debug(f"Could not fetch firewall rules: {e}")

        except Exception as e:
            logger.error(f"Error fetching appliance config: {e}")

        return config

    async def fetch_network_devices(
        self,
        network_id: str,
        organization_name: str,
    ) -> List[Dict[str, Any]]:
        """Fetch all devices in a network.

        Args:
            network_id: Network ID
            organization_name: Organization name

        Returns:
            List of device dictionaries
        """
        credentials = await self.credential_manager.get_credentials(organization_name)
        if not credentials:
            return []

        try:
            async with MerakiAPIClient(
                api_key=credentials["api_key"],
                base_url=credentials["base_url"],
                verify_ssl=credentials.get("verify_ssl", False),
            ) as client:
                response = await client.request(
                    "GET", f"/networks/{network_id}/devices"
                )
                return response.json()
        except Exception as e:
            logger.error(f"Error fetching network devices for {network_id}: {e}")
            return []
