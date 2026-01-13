"""Network Service - Business logic for multi-platform network operations.

This service extracts business logic from the network routes, providing:
- Multi-platform API client factory (Meraki, Catalyst, ThousandEyes, Splunk)
- Network/device listing across platforms
- Cache aggregation logic
- Platform detection

Routes should only handle HTTP I/O and call this service for business logic.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from src.services.meraki_api import MerakiAPIClient
from src.services.catalyst_api import CatalystCenterClient
from src.services.thousandeyes_service import ThousandEyesClient
from src.services.network_cache_service import NetworkCacheService
from src.api.dependencies import credential_manager
from src.services.credential_pool import get_initialized_pool

logger = logging.getLogger(__name__)


class PlatformType(str, Enum):
    """Supported network platform types."""
    MERAKI = "meraki"
    CATALYST = "catalyst"
    THOUSANDEYES = "thousandeyes"
    SPLUNK = "splunk"


@dataclass
class PlatformCredentials:
    """Credentials for a network platform."""
    platform: PlatformType
    base_url: str
    api_key: Optional[str] = None
    oauth_token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    verify_ssl: bool = True


class NetworkServiceError(Exception):
    """Base exception for network service errors."""
    pass


class CredentialsNotFoundError(NetworkServiceError):
    """Raised when credentials are not configured for an organization."""
    pass


class PlatformNotSupportedError(NetworkServiceError):
    """Raised when a platform doesn't support the requested operation."""
    pass


async def get_all_organizations_with_credentials() -> List[Dict[str, Any]]:
    """Get all organizations from both clusters table and system_config.

    This ensures credentials set during setup (stored in system_config) are included
    alongside any organizations added later to the clusters table.

    Returns:
        List of organization dicts with name, url, display_name
    """
    # Get organizations from clusters table
    orgs = await credential_manager.list_organizations()

    # Track all org_ids we've seen to prevent duplicates
    seen_org_ids = set()
    for org in orgs:
        # Add org name and any org_ids to the seen set
        if org.get("name"):
            seen_org_ids.add(org.get("name"))
        if org.get("_org_id"):
            seen_org_ids.add(org.get("_org_id"))
        # Also check for org_ids in meraki orgs (they may have org_id field)
        if org.get("org_id"):
            seen_org_ids.add(org.get("org_id"))

    # Get credentials from system_config via credential_pool
    pool = await get_initialized_pool()

    # Check for Meraki in system_config (not already in clusters)
    meraki_cred = pool.get_for_meraki()
    if meraki_cred and meraki_cred.cluster_name == "system_config":
        # This credential came from system_config, add a synthetic org for it
        # We need to discover the actual Meraki orgs
        if meraki_cred.org_ids:
            # Use first discovered org as the org name for caching
            for org_id in meraki_cred.org_ids:
                # Check if this org_id is already represented (by org_id, not just name)
                if org_id not in seen_org_ids:
                    seen_org_ids.add(org_id)
                    orgs.append({
                        "name": f"meraki_org_{org_id}",
                        "display_name": f"Meraki Organization ({org_id})",
                        "url": "https://api.meraki.com/api/v1",
                        "_from_system_config": True,
                        "_org_id": org_id,
                    })
        else:
            # No orgs discovered yet, add a placeholder
            if "meraki_system_config" not in seen_org_ids:
                orgs.append({
                    "name": "meraki_system_config",
                    "display_name": "Meraki (System Config)",
                    "url": "https://api.meraki.com/api/v1",
                    "_from_system_config": True,
                })

    # Check for Catalyst in system_config
    catalyst_cred = pool.get_for_catalyst()
    if catalyst_cred and catalyst_cred.cluster_name == "system_config":
        base_url = catalyst_cred.credentials.get("catalyst_base_url", "")
        existing = any(o.get("url") == base_url for o in orgs)
        if not existing and base_url:
            orgs.append({
                "name": "catalyst_system_config",
                "display_name": "Catalyst Center (System Config)",
                "url": base_url,
                "_from_system_config": True,
            })

    return orgs


def detect_platform_type(base_url: str) -> PlatformType:
    """Detect platform type from base URL.

    Args:
        base_url: The API base URL

    Returns:
        PlatformType enum value
    """
    base_url_lower = base_url.lower()

    if "thousandeyes.com" in base_url_lower:
        return PlatformType.THOUSANDEYES
    elif ":8089" in base_url_lower or "splunk" in base_url_lower:
        return PlatformType.SPLUNK
    elif "dnac" in base_url_lower or "catalyst" in base_url_lower:
        return PlatformType.CATALYST
    else:
        return PlatformType.MERAKI


async def get_platform_credentials(organization: str) -> PlatformCredentials:
    """Get credentials for an organization and detect platform type.

    Checks multiple sources in order:
    1. Clusters table (by organization name)
    2. Credential pool (includes system_config from setup)

    Args:
        organization: Organization name or ID

    Returns:
        PlatformCredentials with platform type and credentials

    Raises:
        CredentialsNotFoundError: If credentials not configured
    """
    # First try credential_manager (clusters table) by organization name
    creds = await credential_manager.get_credentials(organization)
    if creds:
        base_url = creds.get("base_url", "")
        platform = detect_platform_type(base_url)

        return PlatformCredentials(
            platform=platform,
            base_url=base_url,
            api_key=creds.get("api_key"),
            oauth_token=creds.get("oauth_token") or creds.get("api_token"),
            username=creds.get("username"),
            password=creds.get("password"),
            verify_ssl=creds.get("verify_ssl", True),
        )

    # Fall back to credential_pool which includes system_config credentials
    pool = await get_initialized_pool()

    # Try Meraki credentials from system_config
    meraki_cred = pool.get_for_meraki(organization_id=organization, organization_name=organization)
    if meraki_cred:
        api_key = meraki_cred.credentials.get("api_key") or meraki_cred.credentials.get("meraki_api_key")
        if api_key:
            logger.info(f"[network_service] Using Meraki credentials from credential_pool ({meraki_cred.cluster_name})")
            return PlatformCredentials(
                platform=PlatformType.MERAKI,
                base_url="https://api.meraki.com/api/v1",
                api_key=api_key,
                verify_ssl=True,
            )

    # Try Catalyst credentials
    catalyst_cred = pool.get_for_catalyst()
    if catalyst_cred:
        logger.info(f"[network_service] Using Catalyst credentials from credential_pool ({catalyst_cred.cluster_name})")
        return PlatformCredentials(
            platform=PlatformType.CATALYST,
            base_url=catalyst_cred.credentials.get("catalyst_base_url", ""),
            username=catalyst_cred.credentials.get("catalyst_username"),
            password=catalyst_cred.credentials.get("catalyst_password"),
            verify_ssl=True,
        )

    # Try ThousandEyes credentials
    te_cred = pool.get_for_thousandeyes()
    if te_cred:
        logger.info(f"[network_service] Using ThousandEyes credentials from credential_pool ({te_cred.cluster_name})")
        return PlatformCredentials(
            platform=PlatformType.THOUSANDEYES,
            base_url="https://api.thousandeyes.com",
            oauth_token=te_cred.credentials.get("thousandeyes_token"),
            verify_ssl=True,
        )

    # Try Splunk credentials
    splunk_cred = pool.get_for_splunk()
    if splunk_cred:
        logger.info(f"[network_service] Using Splunk credentials from credential_pool ({splunk_cred.cluster_name})")
        return PlatformCredentials(
            platform=PlatformType.SPLUNK,
            base_url=splunk_cred.credentials.get("splunk_base_url") or splunk_cred.credentials.get("base_url", ""),
            api_key=splunk_cred.credentials.get("token") or splunk_cred.credentials.get("splunk_token"),
            username=splunk_cred.credentials.get("splunk_username") or splunk_cred.credentials.get("username"),
            password=splunk_cred.credentials.get("splunk_password") or splunk_cred.credentials.get("password"),
            verify_ssl=True,
        )

    raise CredentialsNotFoundError(
        f"Credentials not configured for organization: {organization}"
    )


async def list_networks_for_platform(
    creds: PlatformCredentials,
    resource: str = "networks"
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """List networks or devices for a platform.

    Args:
        creds: Platform credentials
        resource: "networks" or "devices"

    Returns:
        Tuple of (data list, optional message)

    Raises:
        CredentialsNotFoundError: If required credentials missing
        PlatformNotSupportedError: If platform doesn't support operation
    """
    if creds.platform == PlatformType.CATALYST:
        return await _list_catalyst_resources(creds, resource)
    elif creds.platform == PlatformType.THOUSANDEYES:
        return await _list_thousandeyes_resources(creds, resource)
    elif creds.platform == PlatformType.SPLUNK:
        return [], "Splunk is a log aggregation platform and does not have network/device inventory."
    else:
        return await _list_meraki_resources(creds, resource)


async def _list_catalyst_resources(
    creds: PlatformCredentials,
    resource: str
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """List resources from Catalyst Center."""
    api_token = creds.oauth_token or creds.api_key
    if not api_token and not (creds.username and creds.password):
        raise CredentialsNotFoundError(
            "Catalyst Center requires api_token or (username + password)"
        )

    client = CatalystCenterClient(
        username=creds.username,
        password=creds.password,
        base_url=creds.base_url,
        verify_ssl=creds.verify_ssl,
        api_token=api_token
    )

    try:
        if resource == "devices":
            data = await client.get_devices()
        else:
            data = await client.get_sites()
        return data, None
    finally:
        await client.close()


async def _list_thousandeyes_resources(
    creds: PlatformCredentials,
    resource: str
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """List resources from ThousandEyes."""
    oauth_token = creds.api_key or creds.oauth_token
    if not oauth_token:
        raise CredentialsNotFoundError("ThousandEyes requires oauth_token")

    client = ThousandEyesClient(
        oauth_token=oauth_token,
        base_url=creds.base_url or "https://api.thousandeyes.com/v7"
    )

    if resource == "devices":
        result = await client.get_agents()
        if result.get("success"):
            return result.get("agents", []), None
        else:
            raise NetworkServiceError(result.get("error", "Failed to fetch ThousandEyes agents"))
    else:
        result = await client.get_tests()
        if result.get("success"):
            return result.get("tests", []), None
        else:
            raise NetworkServiceError(result.get("error", "Failed to fetch ThousandEyes tests"))


async def _list_meraki_resources(
    creds: PlatformCredentials,
    resource: str
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """List resources from Meraki."""
    if not creds.api_key:
        raise CredentialsNotFoundError("Meraki requires api_key")

    client = MerakiAPIClient(
        api_key=creds.api_key,
        base_url=creds.base_url or "https://api.meraki.com/api/v1"
    )

    try:
        # Get organization ID
        orgs_response = await client.request("GET", "/organizations")
        orgs = orgs_response.json()

        if not isinstance(orgs, list) or len(orgs) == 0:
            return [], "No organizations found"

        org_id = orgs[0]["id"]

        if resource == "devices":
            return await _list_meraki_devices(client, org_id)
        else:
            networks_response = await client.request(
                "GET",
                f"/organizations/{org_id}/networks"
            )
            return networks_response.json(), None
    finally:
        await client.client.aclose()


async def _list_meraki_devices(
    client: MerakiAPIClient,
    org_id: str
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """List Meraki devices with status merging."""
    devices_response = await client.request(
        "GET",
        f"/organizations/{org_id}/devices"
    )
    devices = devices_response.json()

    # Fetch and merge device statuses
    try:
        statuses_response = await client.request(
            "GET",
            f"/organizations/{org_id}/devices/statuses"
        )
        statuses = statuses_response.json()

        status_lookup = {}
        if statuses and isinstance(statuses, list):
            for status_item in statuses:
                serial = status_item.get('serial')
                if serial:
                    status_lookup[serial] = status_item.get('status', 'unknown')

        if devices and isinstance(devices, list):
            for device in devices:
                serial = device.get('serial')
                device['status'] = status_lookup.get(serial, 'unknown')
    except Exception as e:
        logger.warning(f"Failed to fetch device statuses: {e}")
        if devices and isinstance(devices, list):
            for device in devices:
                device['status'] = 'unknown'

    return devices, None


async def get_aggregated_cache_data() -> Dict[str, Any]:
    """Get aggregated cache data across all organizations.

    Returns:
        Dict with networks, devices, organizations, and metadata
    """
    cache_service = NetworkCacheService()
    orgs = await get_all_organizations_with_credentials()

    all_networks = []
    all_devices = []
    seen_device_serials = set()  # Track unique devices by serial
    seen_network_ids = set()  # Track unique networks by id
    orgs_data = []

    for org in orgs:
        org_type = detect_platform_type(org.get("url", ""))
        if org_type not in (PlatformType.MERAKI, PlatformType.CATALYST):
            continue

        org_name = org.get("name")
        display_name = org.get("display_name", org_name)

        networks = await cache_service.get_cached_networks(org_name)
        devices = await cache_service.get_cached_devices(org_name)

        # Enrich networks with organization metadata and devices (de-duplicate by network id)
        for net in networks:
            net_id = net.get("id")
            if net_id and net_id in seen_network_ids:
                continue  # Skip duplicate network
            if net_id:
                seen_network_ids.add(net_id)
            net["organizationName"] = org_name
            net["organizationDisplayName"] = display_name
            net["organizationType"] = org_type.value
            net["devices"] = [d for d in devices if d.get("networkId") == net.get("id")]
            all_networks.append(net)

        # Enrich devices with organization and network metadata (de-duplicate by serial)
        for dev in devices:
            serial = dev.get("serial")
            if serial and serial in seen_device_serials:
                continue  # Skip duplicate device
            if serial:
                seen_device_serials.add(serial)
            dev["organizationName"] = org_name
            dev["organizationDisplayName"] = display_name
            matching_net = next((n for n in networks if n.get("id") == dev.get("networkId")), None)
            dev["networkName"] = matching_net.get("name") if matching_net else None
            all_devices.append(dev)

        # Build org summary
        online_count = sum(1 for d in devices if (d.get("status") or "").lower() == "online")
        orgs_data.append({
            "name": org_name,
            "displayName": display_name,
            "type": org_type.value,
            "networkCount": len(networks),
            "deviceCount": len(devices),
            "onlineCount": online_count,
            "offlineCount": len(devices) - online_count,
            "isStale": any(n.get("_is_stale") for n in networks) if networks else False
        })

    # Calculate cache age
    cache_age = None
    if all_networks:
        cached_at = all_networks[0].get("_cached_at")
        if cached_at:
            from datetime import datetime
            try:
                cache_time = datetime.fromisoformat(cached_at.replace('Z', '+00:00'))
                cache_age = (datetime.utcnow() - cache_time.replace(tzinfo=None)).total_seconds()
            except (ValueError, TypeError):
                pass

    return {
        "networks": all_networks,
        "devices": all_devices,
        "organizations": orgs_data,
        "cache_age_seconds": cache_age,
        "total_networks": len(all_networks),
        "total_devices": len(all_devices),
    }


async def sync_all_organizations(force: bool = True) -> Dict[str, Any]:
    """Sync cache for all supported organizations.

    Args:
        force: Force sync even if cache is fresh

    Returns:
        Dict with sync results
    """
    import asyncio

    cache_service = NetworkCacheService()
    orgs = await get_all_organizations_with_credentials()

    # Filter to supported platforms
    supported_orgs = []
    for org in orgs:
        org_type = detect_platform_type(org.get("url", ""))
        if org_type in (PlatformType.MERAKI, PlatformType.CATALYST):
            supported_orgs.append(org)

    if not supported_orgs:
        return {"message": "No supported organizations found", "synced": 0, "total": 0, "results": []}

    # Sync all orgs in parallel
    sync_tasks = [
        cache_service.sync_organization(org.get("name"), force=force)
        for org in supported_orgs
    ]

    sync_results = await asyncio.gather(*sync_tasks, return_exceptions=True)

    results = []
    success_count = 0
    for org, result in zip(supported_orgs, sync_results):
        if isinstance(result, Exception):
            results.append({"organization": org.get("name"), "success": False, "error": str(result)})
        else:
            results.append({"organization": org.get("name"), **result})
            if result.get("success"):
                success_count += 1

    return {
        "message": f"Synced {success_count}/{len(supported_orgs)} organizations",
        "synced": success_count,
        "total": len(supported_orgs),
        "results": results
    }
