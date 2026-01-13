"""Service for caching and managing network/device data across all organizations."""

import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from src.models.network_cache import CachedNetwork, CachedDevice
from src.services.credential_manager import CredentialManager
from src.config.database import Database, get_settings

logger = logging.getLogger(__name__)


class NetworkCacheService:
    """Service to cache and sync network/device data."""

    def __init__(self):
        self.credential_manager = CredentialManager()
        settings = get_settings()
        self.db = Database(settings.database_url)

    async def sync_organization(self, organization_name: str, force: bool = False) -> Dict[str, Any]:
        """Sync networks and devices for an organization.

        Args:
            organization_name: Name of the organization to sync
            force: Force sync even if cache is fresh

        Returns:
            Dictionary with sync results
        """
        try:
            # Get organization credentials from clusters table first
            credentials = await self.credential_manager.get_credentials(organization_name)

            # If not found in clusters, try credential_pool (includes system_config)
            if not credentials:
                try:
                    from src.services.credential_pool import get_initialized_pool
                    pool = await get_initialized_pool()

                    # Try Meraki credentials
                    meraki_cred = pool.get_for_meraki(organization_id=organization_name, organization_name=organization_name)
                    if meraki_cred:
                        api_key = meraki_cred.credentials.get("api_key") or meraki_cred.credentials.get("meraki_api_key")
                        if api_key:
                            credentials = {
                                "api_key": api_key,
                                "base_url": "https://api.meraki.com/api/v1",
                                "verify_ssl": False,
                            }
                            logger.debug(f"Found Meraki credentials in credential_pool for {organization_name}")

                    # Try Splunk credentials if not Meraki
                    if not credentials:
                        splunk_cred = pool.get_for_splunk()
                        if splunk_cred:
                            credentials = {
                                "api_key": splunk_cred.credentials.get("api_key") or splunk_cred.credentials.get("splunk_token"),
                                "base_url": splunk_cred.credentials.get("base_url") or splunk_cred.credentials.get("splunk_url"),
                                "verify_ssl": splunk_cred.credentials.get("verify_ssl", False),
                            }
                            logger.debug(f"Found Splunk credentials in credential_pool")

                    # Try ThousandEyes credentials
                    if not credentials:
                        te_cred = pool.get_for_thousandeyes()
                        if te_cred:
                            credentials = {
                                "api_key": te_cred.credentials.get("api_key") or te_cred.credentials.get("thousandeyes_token"),
                                "base_url": te_cred.credentials.get("base_url") or "https://api.thousandeyes.com/v7",
                                "verify_ssl": True,
                            }
                            logger.debug(f"Found ThousandEyes credentials in credential_pool")
                except Exception as e:
                    logger.warning(f"Error checking credential_pool: {e}")

            if not credentials:
                logger.error(f"No credentials found for organization: {organization_name}")
                return {"success": False, "error": "Organization not found"}

            # Determine organization type
            base_url = credentials["base_url"].lower()
            if "thousandeyes.com" in base_url:
                org_type = "thousandeyes"
            elif ":8089" in base_url or "splunk" in base_url:
                org_type = "splunk"
            else:
                org_type = "meraki"

            # Check if cache needs refresh
            if not force:
                async with self.db.session() as session:
                    result = await session.execute(
                        select(CachedNetwork)
                        .where(CachedNetwork.organization_name == organization_name)
                        .limit(1)
                    )
                    last_network = result.scalar_one_or_none()

                    if last_network:
                        # If cache is less than 5 minutes old, skip sync
                        cache_age = datetime.utcnow() - last_network.last_updated
                        if cache_age < timedelta(minutes=5):
                            logger.info(f"Cache is fresh for {organization_name}, skipping sync")
                            return {"success": True, "cached": True, "age_minutes": cache_age.total_seconds() / 60}

            # Fetch data based on organization type
            if org_type == "meraki":
                return await self._sync_meraki(organization_name, credentials)
            elif org_type == "thousandeyes":
                return await self._sync_thousandeyes(organization_name, credentials)
            elif org_type == "splunk":
                return await self._sync_splunk(organization_name, credentials)
            else:
                return {"success": False, "error": f"Unsupported organization type: {org_type}"}

        except Exception as e:
            logger.error(f"Error syncing organization {organization_name}: {e}")
            return {"success": False, "error": str(e)}

    async def _sync_meraki(self, organization_name: str, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Sync Meraki networks and devices.

        Args:
            organization_name: Name of the organization
            credentials: API credentials

        Returns:
            Dictionary with sync results
        """
        try:
            headers = {
                "X-Cisco-Meraki-API-Key": credentials["api_key"],
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=30.0) as client:
                # Get organization ID
                org_response = await client.get(
                    f"{credentials['base_url']}/organizations",
                    headers=headers
                )

                if org_response.status_code != 200:
                    # Mark existing cache as stale
                    await self._mark_stale(organization_name)
                    return {"success": False, "error": f"HTTP {org_response.status_code}", "stale": True}

                orgs = org_response.json()
                if not orgs:
                    return {"success": False, "error": "No organizations found"}

                org_id = orgs[0]["id"]

                # Fetch networks
                networks_response = await client.get(
                    f"{credentials['base_url']}/organizations/{org_id}/networks",
                    headers=headers
                )

                if networks_response.status_code != 200:
                    await self._mark_stale(organization_name)
                    return {"success": False, "error": f"Failed to fetch networks: HTTP {networks_response.status_code}", "stale": True}

                networks = networks_response.json()

                # Fetch devices
                devices_response = await client.get(
                    f"{credentials['base_url']}/organizations/{org_id}/devices",
                    headers=headers
                )

                if devices_response.status_code != 200:
                    await self._mark_stale(organization_name)
                    return {"success": False, "error": f"Failed to fetch devices: HTTP {devices_response.status_code}", "stale": True}

                devices = devices_response.json()

                # Fetch device statuses
                try:
                    statuses_response = await client.get(
                        f"{credentials['base_url']}/organizations/{org_id}/devices/statuses",
                        headers=headers
                    )
                    if statuses_response.status_code == 200:
                        statuses = statuses_response.json()
                        # Create status lookup by serial
                        status_map = {s.get("serial"): s.get("status") for s in statuses}
                        # Merge status into devices
                        for device in devices:
                            serial = device.get("serial")
                            if serial and serial in status_map:
                                device["status"] = status_map[serial]
                except Exception as e:
                    logger.warning(f"Failed to fetch device statuses: {e}")

                # Update cache
                await self._update_cache(organization_name, "meraki", networks, devices)

                return {
                    "success": True,
                    "networks_count": len(networks),
                    "devices_count": len(devices),
                    "timestamp": datetime.utcnow().isoformat()
                }

        except httpx.TimeoutException:
            await self._mark_stale(organization_name)
            return {"success": False, "error": "Request timeout", "stale": True}
        except Exception as e:
            await self._mark_stale(organization_name)
            logger.error(f"Error syncing Meraki for {organization_name}: {e}")
            return {"success": False, "error": str(e), "stale": True}

    async def _sync_thousandeyes(self, organization_name: str, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Sync ThousandEyes data (tests as 'networks', agents as 'devices').

        Args:
            organization_name: Name of the organization
            credentials: API credentials

        Returns:
            Dictionary with sync results
        """
        try:
            headers = {
                "Authorization": f"Bearer {credentials['api_key']}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=30.0) as client:
                # Fetch tests (treat as networks)
                tests_response = await client.get(
                    f"{credentials['base_url']}/tests",
                    headers=headers
                )

                if tests_response.status_code != 200:
                    await self._mark_stale(organization_name)
                    return {"success": False, "error": f"HTTP {tests_response.status_code}", "stale": True}

                tests_data = tests_response.json()
                tests = tests_data.get("tests", [])

                # Fetch agents (treat as devices)
                agents_response = await client.get(
                    f"{credentials['base_url']}/agents",
                    headers=headers
                )

                if agents_response.status_code != 200:
                    await self._mark_stale(organization_name)
                    return {"success": False, "error": f"Failed to fetch agents: HTTP {agents_response.status_code}", "stale": True}

                agents_data = agents_response.json()
                agents = agents_data.get("agents", [])

                # Transform tests into network format
                networks = []
                for test in tests:
                    networks.append({
                        "id": str(test.get("testId", test.get("id", ""))),
                        "name": test.get("testName", "Unknown Test"),
                        "productTypes": [test.get("type", "unknown")],
                        "timeZone": "UTC",
                        "tags": test.get("labels", []),
                        "url": test.get("url", ""),
                    })

                # Transform agents into device format
                devices = []
                for agent in agents:
                    agent_id = str(agent.get("agentId", agent.get("id", "")))
                    # Associate with first test if available, otherwise standalone
                    network_id = networks[0]["id"] if networks else "no-network"

                    devices.append({
                        "serial": agent_id,
                        "name": agent.get("agentName", "Unknown Agent"),
                        "model": agent.get("agentType", "unknown"),
                        "networkId": network_id,
                        "status": "online" if agent.get("enabled") else "offline",
                        "lanIp": agent.get("ipAddresses", [None])[0] if agent.get("ipAddresses") else None,
                        "publicIp": agent.get("publicIpAddresses", [None])[0] if agent.get("publicIpAddresses") else None,
                    })

                # Update cache
                await self._update_cache(organization_name, "thousandeyes", networks, devices)

                return {
                    "success": True,
                    "networks_count": len(networks),
                    "devices_count": len(devices),
                    "timestamp": datetime.utcnow().isoformat()
                }

        except Exception as e:
            await self._mark_stale(organization_name)
            logger.error(f"Error syncing ThousandEyes for {organization_name}: {e}")
            return {"success": False, "error": str(e), "stale": True}

    async def _sync_splunk(self, organization_name: str, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Sync Splunk data (indexes as 'networks', inputs as 'devices').

        Args:
            organization_name: Name of the organization
            credentials: API credentials

        Returns:
            Dictionary with sync results
        """
        try:
            headers = {
                "Authorization": f"Bearer {credentials['api_key']}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=30.0) as client:
                # Fetch indexes (treat as networks)
                indexes_response = await client.get(
                    f"{credentials['base_url']}/services/data/indexes",
                    headers=headers,
                    params={"output_mode": "json", "count": 100},
                )

                if indexes_response.status_code != 200:
                    await self._mark_stale(organization_name)
                    return {"success": False, "error": f"HTTP {indexes_response.status_code}", "stale": True}

                indexes_data = indexes_response.json()
                indexes = indexes_data.get("entry", [])

                # Fetch data inputs (treat as devices)
                inputs_response = await client.get(
                    f"{credentials['base_url']}/services/data/inputs/all",
                    headers=headers,
                    params={"output_mode": "json", "count": 100},
                )

                inputs = []
                if inputs_response.status_code == 200:
                    inputs_data = inputs_response.json()
                    inputs = inputs_data.get("entry", [])

                # Transform indexes into network format
                networks = []
                for index in indexes:
                    content = index.get("content", {})
                    index_name = index.get("name", "unknown")

                    networks.append({
                        "id": index_name,
                        "name": index_name,
                        "productTypes": ["splunk-index"],
                        "timeZone": "UTC",
                        "tags": [content.get("datatype", "event")],
                        "url": f"{credentials['base_url']}/app/search/search?q=index={index_name}",
                    })

                # Transform inputs into device format
                devices = []
                for input_entry in inputs:
                    content = input_entry.get("content", {})
                    input_name = input_entry.get("name", "unknown")

                    # Associate with relevant index if available
                    index_name = content.get("index", "main")
                    network_id = index_name if any(n["id"] == index_name for n in networks) else (networks[0]["id"] if networks else "main")

                    # Determine status
                    disabled = content.get("disabled", False)
                    status = "offline" if disabled else "online"

                    devices.append({
                        "serial": input_name,
                        "name": input_name,
                        "model": content.get("type", "unknown-input"),
                        "networkId": network_id,
                        "status": status,
                        "lanIp": content.get("host", None),
                    })

                # Update cache
                await self._update_cache(organization_name, "splunk", networks, devices)

                return {
                    "success": True,
                    "networks_count": len(networks),
                    "devices_count": len(devices),
                    "timestamp": datetime.utcnow().isoformat()
                }

        except Exception as e:
            await self._mark_stale(organization_name)
            logger.error(f"Error syncing Splunk for {organization_name}: {e}")
            return {"success": False, "error": str(e), "stale": True}

    async def _update_cache(
        self,
        organization_name: str,
        org_type: str,
        networks: List[Dict[str, Any]],
        devices: List[Dict[str, Any]]
    ) -> None:
        """Update cached networks and devices in database.

        Args:
            organization_name: Name of the organization
            org_type: Type of organization (meraki, thousandeyes, splunk)
            networks: List of network dictionaries
            devices: List of device dictionaries
        """
        async with self.db.session() as session:
            # Delete old cache for this organization
            await session.execute(
                delete(CachedNetwork).where(CachedNetwork.organization_name == organization_name)
            )
            await session.execute(
                delete(CachedDevice).where(CachedDevice.organization_name == organization_name)
            )

            # Insert new networks
            for network in networks:
                cached_network = CachedNetwork(
                    organization_name=organization_name,
                    organization_type=org_type,
                    network_id=network.get("id", ""),
                    network_name=network.get("name", ""),
                    product_types=network.get("productTypes", []),
                    time_zone=network.get("timeZone"),
                    tags=network.get("tags", []),
                    enrollment_string=network.get("enrollmentString"),
                    url=network.get("url"),
                    raw_data=network,
                    is_stale="false"
                )
                session.add(cached_network)

            # Insert new devices
            for device in devices:
                cached_device = CachedDevice(
                    organization_name=organization_name,
                    organization_type=org_type,
                    serial=device.get("serial", ""),
                    device_name=device.get("name", ""),
                    model=device.get("model"),
                    network_id=device.get("networkId", ""),
                    status=device.get("status"),
                    lan_ip=device.get("lanIp"),
                    public_ip=device.get("publicIp"),
                    mac=device.get("mac"),
                    firmware=device.get("firmware"),
                    tags=device.get("tags", []),
                    raw_data=device,
                    is_stale="false"
                )
                session.add(cached_device)

            await session.commit()
            logger.info(f"Updated cache for {organization_name}: {len(networks)} networks, {len(devices)} devices")

    async def _mark_stale(self, organization_name: str) -> None:
        """Mark all cached data for an organization as stale.

        Args:
            organization_name: Name of the organization
        """
        async with self.db.session() as session:
            # Mark networks as stale
            result = await session.execute(
                select(CachedNetwork).where(CachedNetwork.organization_name == organization_name)
            )
            networks = result.scalars().all()
            for network in networks:
                network.is_stale = "true"

            # Mark devices as stale
            result = await session.execute(
                select(CachedDevice).where(CachedDevice.organization_name == organization_name)
            )
            devices = result.scalars().all()
            for device in devices:
                device.is_stale = "true"

            await session.commit()
            logger.info(f"Marked cache as stale for {organization_name}")

    async def get_cached_networks(self, organization_name: str) -> List[Dict[str, Any]]:
        """Get cached networks for an organization.

        Args:
            organization_name: Name of the organization

        Returns:
            List of network dictionaries
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(CachedNetwork)
                .where(CachedNetwork.organization_name == organization_name)
                .order_by(CachedNetwork.network_name)
            )
            networks = result.scalars().all()
            return [net.to_dict() for net in networks]

    async def get_cached_devices(self, organization_name: str) -> List[Dict[str, Any]]:
        """Get cached devices for an organization.

        Args:
            organization_name: Name of the organization

        Returns:
            List of device dictionaries
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(CachedDevice)
                .where(CachedDevice.organization_name == organization_name)
                .order_by(CachedDevice.device_name)
            )
            devices = result.scalars().all()
            return [dev.to_dict() for dev in devices]

    # =========================================================================
    # Metrics Caching (for bandwidth/traffic data)
    # =========================================================================

    async def set_metrics(
        self,
        serial: str,
        metrics_type: str,
        data: Dict[str, Any],
        ttl_seconds: int = 300
    ) -> None:
        """Cache metrics data for a device.

        Args:
            serial: Device serial number
            metrics_type: Type of metrics (e.g., 'bandwidth', 'uplink', 'loss_latency')
            data: Metrics data to cache
            ttl_seconds: Time-to-live in seconds (default: 5 minutes)
        """
        async with self.db.session() as session:
            from sqlalchemy import text as sql_text

            # Upsert metrics into a simple key-value table
            # Using device serial + metrics_type as composite key
            cache_key = f"{serial}:{metrics_type}"
            expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)

            # Serialize data to JSON string for PostgreSQL
            data_json = json.dumps(data)

            now = datetime.utcnow()
            await session.execute(
                sql_text("""
                    INSERT INTO device_metrics_cache (cache_key, data, expires_at, updated_at, created_at)
                    VALUES (:cache_key, :data, :expires_at, :now, :now)
                    ON CONFLICT (cache_key)
                    DO UPDATE SET data = :data, expires_at = :expires_at, updated_at = :now
                """),
                {
                    "cache_key": cache_key,
                    "data": data_json,
                    "expires_at": expires_at,
                    "now": now,
                }
            )
            await session.commit()
            logger.debug(f"Cached metrics for {cache_key}, expires in {ttl_seconds}s")

    async def get_metrics(
        self,
        serial: str,
        metrics_type: str = "bandwidth"
    ) -> Optional[Dict[str, Any]]:
        """Get cached metrics for a device.

        Args:
            serial: Device serial number
            metrics_type: Type of metrics (default: 'bandwidth')

        Returns:
            Cached metrics data if available and not expired, None otherwise
        """
        async with self.db.session() as session:
            from sqlalchemy import text as sql_text

            cache_key = f"{serial}:{metrics_type}"

            now = datetime.utcnow()
            result = await session.execute(
                sql_text("""
                    SELECT data, expires_at
                    FROM device_metrics_cache
                    WHERE cache_key = :cache_key
                      AND expires_at > :now
                """),
                {"cache_key": cache_key, "now": now}
            )

            row = result.fetchone()
            if row:
                logger.debug(f"Cache hit for {cache_key}")
                return row.data
            else:
                logger.debug(f"Cache miss for {cache_key}")
                return None

    async def clear_expired_metrics(self) -> int:
        """Clear expired metrics from cache.

        Returns:
            Number of expired entries removed
        """
        async with self.db.session() as session:
            from sqlalchemy import text as sql_text

            now = datetime.utcnow()
            # Count before delete for SQLite compatibility (RETURNING not always supported)
            count_result = await session.execute(
                sql_text("SELECT COUNT(*) FROM device_metrics_cache WHERE expires_at <= :now"),
                {"now": now}
            )
            count = count_result.scalar() or 0

            await session.execute(
                sql_text("DELETE FROM device_metrics_cache WHERE expires_at <= :now"),
                {"now": now}
            )
            await session.commit()

            if count > 0:
                logger.info(f"Cleared {count} expired metrics cache entries")

            return count
