"""API routes for organizations."""

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_admin, require_viewer
from src.api.models import *
from src.api.models.cluster import NetworkPlatformOrg
from src.api.utils.audit import log_audit
from typing import List, Optional, Dict, Any
import meraki
import re

router = APIRouter()


def _is_valid_meraki_key(api_key: str) -> bool:
    """Check if API key looks like a Meraki key (40 chars, alphanumeric)."""
    if not api_key or len(api_key) != 40:
        return False
    return bool(re.match(r'^[a-zA-Z0-9]+$', api_key))


async def _detect_platform(cluster_name: str) -> Optional[str]:
    """Detect platform type from cluster credentials.

    Returns 'meraki', 'catalyst', 'thousandeyes', 'splunk', or None.
    Also checks credential_pool for system_config credentials.
    """
    creds = await credential_manager.get_credentials(cluster_name)

    # If not in clusters table, check if it's a system_config platform
    if not creds:
        # Check if this is a system_config platform name
        try:
            from src.services.credential_pool import get_initialized_pool
            pool = await get_initialized_pool()
            available = pool.get_available_platforms()
            if cluster_name.lower() in [p.lower() for p in available]:
                return cluster_name.lower()
        except Exception:
            pass
        return None

    base_url = creds.get("base_url", "").lower()

    # Meraki detection - valid 40-char alphanumeric key
    api_key = creds.get("meraki_api_key") or creds.get("api_key", "")
    if api_key and _is_valid_meraki_key(api_key):
        return "meraki"

    # Catalyst detection - by explicit keys OR by URL pattern with username/password
    if creds.get("catalyst_token") or creds.get("catalyst_username"):
        return "catalyst"
    # Also detect Catalyst by URL pattern (DNA Center / Catalyst Center)
    if creds.get("username") and creds.get("password"):
        if "dnac" in base_url or "catalyst" in base_url or "dna" in base_url:
            return "catalyst"

    # ThousandEyes detection - by token or URL
    if creds.get("thousandeyes_token"):
        return "thousandeyes"
    if "thousandeyes" in base_url:
        return "thousandeyes"

    # Splunk detection
    if creds.get("splunk_token") or creds.get("splunk_url"):
        return "splunk"
    if "splunk" in base_url:
        return "splunk"

    return None

@router.get("/api/organizations", response_model=List[ClusterResponse], dependencies=[Depends(require_viewer)])
async def list_organizations(active_only: bool = Query(True)):
    """List all organizations."""
    clusters = await credential_manager.list_clusters(active_only=active_only)

    return [
        ClusterResponse(
            id=cluster.id,
            name=cluster.name,
            display_name=cluster.display_name,
            url=cluster.url,
            username=cluster.username if cluster.username else None,
            verify_ssl=cluster.verify_ssl,
            is_active=cluster.is_active,
            status="active" if cluster.is_active else "inactive",
            created_at=cluster.created_at.isoformat(),
            updated_at=cluster.updated_at.isoformat(),
        )
        for cluster in clusters
    ]


# Meraki Organizations discovered from API key (NEW - uses system_config + credential pool)
# IMPORTANT: This must be defined BEFORE /api/organizations/{name} to avoid path conflict
@router.get("/api/organizations/meraki-discovered", dependencies=[Depends(require_viewer)])
async def list_meraki_discovered_orgs():
    """List Meraki organizations discovered from configured API key(s).

    This endpoint discovers actual Meraki organizations by calling the Meraki API
    with configured credentials (from system_config or clusters table).

    Returns:
        List of Meraki organizations with id, name, and credential source
    """
    from src.services.credential_pool import get_initialized_pool

    try:
        # Initialize pool (loads from system_config + clusters, discovers orgs)
        pool = await get_initialized_pool()

        # Get all Meraki credentials and their discovered orgs
        meraki_creds = pool.get_all_for_platform("meraki")
        result = []

        for cred in meraki_creds:
            for org_id in cred.org_ids:
                # Look up org name from the mapping
                org_name = None
                for key, val in pool._meraki_org_map.items():
                    if val == cred and not key.isdigit():
                        # Found org name (non-numeric key)
                        if org_id in cred.org_ids:
                            # This is one of our orgs, check if this name maps to it
                            org_name = key.title() if key == key.lower() else key
                            break

                result.append({
                    "id": org_id,
                    "name": org_name or f"Organization {org_id}",
                    "credential_source": cred.cluster_name,
                    "platform": "meraki",
                    "is_active": True,
                })

        return {"organizations": result, "count": len(result)}

    except Exception as e:
        return {"organizations": [], "count": 0, "error": str(e)}


# Network Platform Organizations (Meraki/Catalyst only - for visualizations)
# IMPORTANT: This must be defined BEFORE /api/organizations/{name} to avoid path conflict
@router.get("/api/organizations/network-platforms", response_model=List[NetworkPlatformOrg], dependencies=[Depends(require_viewer)])
async def list_network_platform_orgs(active_only: bool = Query(True)):
    """List only Meraki and Catalyst organizations (for network visualizations).

    These are the platforms that support topology and performance visualization.
    Also includes credentials from system_config (setup wizard).
    """
    from src.services.credential_pool import get_initialized_pool

    clusters = await credential_manager.list_clusters(active_only=active_only)
    result = []
    seen_platforms = set()

    # First, add clusters from the clusters table
    for cluster in clusters:
        platform = await _detect_platform(cluster.name)
        # Only include Meraki and Catalyst platforms
        if platform in ("meraki", "catalyst"):
            result.append(NetworkPlatformOrg(
                id=cluster.id,
                name=cluster.name,
                display_name=cluster.display_name,
                platform=platform,
                is_active=cluster.is_active,
            ))
            seen_platforms.add(cluster.name.lower())

    # Also check credential_pool for system_config credentials
    try:
        pool = await get_initialized_pool()
        available = pool.get_available_platforms()

        # Add Meraki from system_config if not already in clusters
        if "meraki" in available:
            meraki_cred = pool.get_for_meraki()
            if meraki_cred and meraki_cred.cluster_name == "system_config":
                # Add discovered Meraki orgs
                for org_id in meraki_cred.org_ids:
                    org_key = f"meraki_org_{org_id}"
                    if org_key.lower() not in seen_platforms:
                        result.append(NetworkPlatformOrg(
                            id=0,  # Synthetic ID for system_config orgs
                            name=org_id,
                            display_name=f"Meraki Org {org_id}",
                            platform="meraki",
                            is_active=True,
                        ))
                        seen_platforms.add(org_key.lower())

        # Add Catalyst from system_config if configured
        if "catalyst" in available and "catalyst" not in seen_platforms:
            result.append(NetworkPlatformOrg(
                id=0,  # Synthetic ID
                name="catalyst_system_config",
                display_name="Catalyst Center",
                platform="catalyst",
                is_active=True,
            ))
    except Exception as e:
        # Log but don't fail if credential_pool has issues
        import logging
        logging.getLogger(__name__).warning(f"Error checking credential_pool: {e}")

    return result


@router.get("/api/organizations/{name}", response_model=ClusterResponse, dependencies=[Depends(require_viewer)])
async def get_organization(name: str):
    """Get a specific organization by name."""
    cluster = await credential_manager.get_cluster(name)

    if not cluster:
        raise HTTPException(status_code=404, detail=f"Organization '{name}' not found")

    return ClusterResponse(
        id=cluster.id,
        name=cluster.name,
        display_name=cluster.display_name,
        url=cluster.url,
        username=cluster.username,
        verify_ssl=cluster.verify_ssl,
        is_active=cluster.is_active,
        status="active" if cluster.is_active else "inactive",
        created_at=cluster.created_at.isoformat(),
        updated_at=cluster.updated_at.isoformat(),
    )



@router.post("/api/organizations", response_model=ClusterResponse, status_code=201, dependencies=[Depends(require_admin)])
async def create_organization(cluster_data: ClusterCreate):
    """Create a new organization."""
    try:
        # Use api_key if provided (for Meraki), otherwise use password
        api_credential = cluster_data.api_key or cluster_data.password
        if not api_credential:
            raise HTTPException(status_code=400, detail="Either api_key or password is required")

        cluster = await credential_manager.store_credentials(
            name=cluster_data.name,
            api_key=api_credential,
            base_url=cluster_data.url,
            verify_ssl=cluster_data.verify_ssl,
            display_name=cluster_data.display_name,
            username=cluster_data.username,
        )

        return ClusterResponse(
            id=cluster.id,
            name=cluster.name,
            display_name=cluster.display_name,
            url=cluster.url,
            username=cluster.username,
            verify_ssl=cluster.verify_ssl,
            is_active=cluster.is_active,
            status="active" if cluster.is_active else "inactive",
            created_at=cluster.created_at.isoformat(),
            updated_at=cluster.updated_at.isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.delete("/api/organizations/{name}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_organization(name: str):
    """Delete an organization."""
    deleted = await credential_manager.delete_credentials(name)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Organization '{name}' not found")

    return None


# Cluster Management Endpoints

@router.get("/api/clusters", response_model=List[ClusterResponse], dependencies=[Depends(require_viewer)])
async def list_clusters(active_only: bool = Query(True)):
    """List all clusters."""
    clusters = await credential_manager.list_clusters(active_only=active_only)

    return [
        ClusterResponse(
            id=cluster.id,
            name=cluster.name,
            display_name=cluster.display_name,
            url=cluster.url,
            username=cluster.username if cluster.username else None,
            verify_ssl=cluster.verify_ssl,
            is_active=cluster.is_active,
            status="active" if cluster.is_active else "inactive",
            created_at=cluster.created_at.isoformat(),
            updated_at=cluster.updated_at.isoformat(),
        )
        for cluster in clusters
    ]



@router.get("/api/clusters/{name}", response_model=ClusterResponse, dependencies=[Depends(require_viewer)])
async def get_cluster(name: str):
    """Get a specific cluster by name."""
    cluster = await credential_manager.get_cluster(name)

    if not cluster:
        raise HTTPException(status_code=404, detail=f"Cluster '{name}' not found")

    return ClusterResponse(
        id=cluster.id,
        name=cluster.name,
        display_name=cluster.display_name,
        url=cluster.url,
        username=cluster.username,
        verify_ssl=cluster.verify_ssl,
        is_active=cluster.is_active,
        status="active" if cluster.is_active else "inactive",
        created_at=cluster.created_at.isoformat(),
        updated_at=cluster.updated_at.isoformat(),
    )



@router.post("/api/clusters", response_model=ClusterResponse, status_code=201, dependencies=[Depends(require_admin)])
async def create_cluster(cluster_data: ClusterCreate):
    """Create a new cluster."""
    try:
        cluster = await credential_manager.store_credentials(
            name=cluster_data.name,
            url=cluster_data.url,
            username=cluster_data.username,
            password=cluster_data.password,
            verify_ssl=cluster_data.verify_ssl,
        )

        return ClusterResponse(
            id=cluster.id,
            name=cluster.name,
            url=cluster.url,
            username=cluster.username,
            verify_ssl=cluster.verify_ssl,
            is_active=cluster.is_active,
            status="active" if cluster.is_active else "inactive",
            created_at=cluster.created_at.isoformat(),
            updated_at=cluster.updated_at.isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.put("/api/clusters/{name}", response_model=ClusterResponse, dependencies=[Depends(require_admin)])
async def update_cluster(name: str, cluster_data: ClusterUpdate):
    """Update an existing cluster."""
    # Get existing cluster
    existing_cluster = await credential_manager.get_cluster(name)
    if not existing_cluster:
        raise HTTPException(status_code=404, detail=f"Cluster '{name}' not found")

    # Get decrypted credentials
    credentials = await credential_manager.get_credentials(name)

    # Update with new values or keep existing
    updated_cluster = await credential_manager.store_credentials(
        name=name,
        url=cluster_data.url or existing_cluster.url,
        username=cluster_data.username or existing_cluster.username,
        password=cluster_data.password or credentials["password"],
        verify_ssl=cluster_data.verify_ssl if cluster_data.verify_ssl is not None else existing_cluster.verify_ssl,
    )

    return ClusterResponse(
        id=updated_cluster.id,
        name=updated_cluster.name,
        url=updated_cluster.url,
        username=updated_cluster.username,
        verify_ssl=updated_cluster.verify_ssl,
        is_active=updated_cluster.is_active,
        status="active" if updated_cluster.is_active else "inactive",
        created_at=updated_cluster.created_at.isoformat(),
        updated_at=updated_cluster.updated_at.isoformat(),
    )



@router.delete("/api/clusters/{name}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_cluster(name: str):
    """Delete a cluster."""
    deleted = await credential_manager.delete_credentials(name)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Cluster '{name}' not found")

    return None



@router.post("/api/clusters/test", status_code=200, dependencies=[Depends(require_admin)])
async def test_cluster_connection(cluster_data: ClusterCreate):
    """Test cluster connection without saving."""
    try:
        if "meraki" in cluster_data.url.lower():
            api_credential = cluster_data.api_key or cluster_data.password
            dashboard = meraki.DashboardAPI(api_key=api_credential, base_url=cluster_data.url, suppress_logging=True, output_log=False)
            organizations = dashboard.organizations.getOrganizations()
            return {"status": "success", "message": "Connection successful", "organizations": len(organizations)}
        else:
            # For other types, implement accordingly
            return {"status": "success", "message": "Connection test not implemented for this type"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Security Configuration Endpoints

