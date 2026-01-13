"""API routes for licenses."""

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_admin, require_viewer
from src.api.models import *
from src.api.utils.audit import log_audit
from typing import List, Optional, Dict, Any

router = APIRouter()

@router.get("/api/licenses", response_model=UnifiedLicensesResponse, dependencies=[Depends(require_viewer)])
async def get_unified_licenses():
    """Get unified view of licenses across all organizations (Meraki, ThousandEyes, Splunk)."""
    import httpx

    organizations_licenses = []
    total_licenses = 0

    # Get all active clusters (organizations)
    clusters = await credential_manager.list_clusters(active_only=True)

    for cluster in clusters:
        try:
            # Get credentials
            credentials = await credential_manager.get_credentials(cluster.name)

            # Determine organization type
            base_url = credentials["base_url"].lower()
            if "thousandeyes.com" in base_url:
                org_type = "thousandeyes"
            elif ":8089" in base_url or "splunk" in base_url:
                org_type = "splunk"
            elif "dnac" in base_url or "catalyst" in base_url:
                org_type = "catalyst"
            else:
                org_type = "meraki"

            # Fetch licenses based on organization type
            # Use display_name if available, otherwise fall back to name
            org_display_name = cluster.display_name or cluster.name

            if org_type =="meraki":
                org_licenses = await _fetch_meraki_licenses(org_display_name, credentials)
            elif org_type == "thousandeyes":
                org_licenses = await _fetch_thousandeyes_licenses(org_display_name, credentials)
            elif org_type == "splunk":
                org_licenses = await _fetch_splunk_licenses(org_display_name, credentials)
            elif org_type == "catalyst":
                org_licenses = await _fetch_catalyst_licenses(org_display_name, credentials)
            else:
                org_licenses = OrganizationLicenses(
                    organization_name=org_display_name,
                    organization_id="unknown",
                    licenses=[],
                    error=f"Unsupported organization type: {org_type}"
                )

            organizations_licenses.append(org_licenses)
            total_licenses += len(org_licenses.licenses)

        except Exception as e:
            organizations_licenses.append(OrganizationLicenses(
                organization_name=cluster.display_name or cluster.name,
                organization_id="unknown",
                licenses=[],
                error=str(e)
            ))

    return UnifiedLicensesResponse(
        organizations=organizations_licenses,
        total_licenses=total_licenses,
        total_organizations=len(clusters)
    )


async def _fetch_meraki_licenses(org_name: str, credentials: dict) -> OrganizationLicenses:
    """Fetch licenses from Meraki Dashboard API."""
    import httpx

    headers = {
        "X-Cisco-Meraki-API-Key": credentials["api_key"],
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(verify=credentials["verify_ssl"], timeout=30.0) as client:
            # Get organization ID
            org_response = await client.get(
                f"{credentials['base_url']}/organizations",
                headers=headers
            )

            if org_response.status_code != 200:
                return OrganizationLicenses(
                    organization_name=org_name,
                    organization_id="unknown",
                    licenses=[],
                    error=f"Failed to fetch organizations: HTTP {org_response.status_code}"
                )

            orgs = org_response.json()
            if not orgs:
                return OrganizationLicenses(
                    organization_name=org_name,
                    organization_id="unknown",
                    licenses=[],
                    error="No organizations found"
                )

            org_id = orgs[0]["id"]

            # Get licenses
            licenses_response = await client.get(
                f"{credentials['base_url']}/organizations/{org_id}/licenses",
                headers=headers
            )

            # Get license overview
            overview_response = await client.get(
                f"{credentials['base_url']}/organizations/{org_id}/licenses/overview",
                headers=headers
            )

            licenses_data = []
            overview_data = None

            if licenses_response.status_code == 200:
                raw_licenses = licenses_response.json()
                for lic in raw_licenses:
                    licenses_data.append(LicenseInfo(
                        license_id=lic.get("id", "unknown"),
                        license_type=lic.get("licenseType", "unknown"),
                        state=lic.get("state", "unknown"),
                        duration_in_days=lic.get("durationInDays"),
                        claim_date=lic.get("claimDate"),
                        expiration_date=lic.get("expirationDate"),
                        device_serial=lic.get("deviceSerial"),
                        network_id=lic.get("networkId"),
                        order_number=lic.get("orderNumber"),
                        seat_count=lic.get("seatCount")
                    ))

            if overview_response.status_code == 200:
                overview_data = overview_response.json()

            return OrganizationLicenses(
                organization_name=org_name,
                organization_id=org_id,
                licenses=licenses_data,
                overview=overview_data,
                error=None if licenses_response.status_code == 200 else f"HTTP {licenses_response.status_code}"
            )

    except httpx.TimeoutException:
        return OrganizationLicenses(
            organization_name=org_name,
            organization_id="unknown",
            licenses=[],
            error="Request timeout"
        )
    except Exception as e:
        return OrganizationLicenses(
            organization_name=org_name,
            organization_id="unknown",
            licenses=[],
            error=str(e)
        )


async def _fetch_thousandeyes_licenses(org_name: str, credentials: dict) -> OrganizationLicenses:
    """Check ThousandEyes API connectivity and return simple status."""
    import httpx

    headers = {
        "Authorization": f"Bearer {credentials['api_key']}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(verify=credentials["verify_ssl"], timeout=30.0) as client:
            # Just test API connectivity
            test_response = await client.get(
                f"{credentials['base_url']}/tests",
                headers=headers
            )

            if test_response.status_code == 200:
                # API is working - return simple "Active" status
                return OrganizationLicenses(
                    organization_name=org_name,
                    organization_id="te-account",
                    licenses=[
                        LicenseInfo(
                            license_id="thousandeyes-status",
                            license_type="ThousandEyes Service",
                            state="active",
                            duration_in_days=None,
                            claim_date=None,
                            expiration_date=None,
                            device_serial=None,
                            network_id=None,
                            order_number=None,
                            seat_count=None
                        )
                    ],
                    overview={"status": "Active", "api_connected": True},
                    error=None
                )
            else:
                return OrganizationLicenses(
                    organization_name=org_name,
                    organization_id="te-account",
                    licenses=[],
                    error=f"API connection failed: HTTP {test_response.status_code}"
                )

    except Exception as e:
        return OrganizationLicenses(
            organization_name=org_name,
            organization_id="unknown",
            licenses=[],
            error=str(e)
        )


async def _fetch_splunk_licenses(org_name: str, credentials: dict) -> OrganizationLicenses:
    """Check Splunk API connectivity and return simple status."""
    import httpx

    headers = {
        "Authorization": f"Bearer {credentials['api_key']}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(verify=credentials["verify_ssl"], timeout=30.0) as client:
            # Just test API connectivity
            test_response = await client.get(
                f"{credentials['base_url']}/services/server/info",
                headers=headers,
                params={"output_mode": "json"}
            )

            if test_response.status_code == 200:
                # API is working - return simple "Active" status
                return OrganizationLicenses(
                    organization_name=org_name,
                    organization_id="splunk-instance",
                    licenses=[
                        LicenseInfo(
                            license_id="splunk-status",
                            license_type="Splunk Enterprise",
                            state="active",
                            duration_in_days=None,
                            claim_date=None,
                            expiration_date=None,
                            device_serial=None,
                            network_id=None,
                            order_number=None,
                            seat_count=None
                        )
                    ],
                    overview={"status": "Active", "api_connected": True},
                    error=None
                )
            else:
                return OrganizationLicenses(
                    organization_name=org_name,
                    organization_id="splunk-instance",
                    licenses=[],
                    error=f"API connection failed: HTTP {test_response.status_code}"
                )

    except Exception as e:
        return OrganizationLicenses(
            organization_name=org_name,
            organization_id="unknown",
            licenses=[],
            error=str(e)
        )


async def _fetch_catalyst_licenses(org_name: str, credentials: dict) -> OrganizationLicenses:
    """Check Catalyst Center API connectivity and return simple status."""
    from src.services.catalyst_api import CatalystCenterClient

    try:
        # Support both bearer token and username/password authentication
        api_token = credentials.get("api_token") or credentials.get("api_key")

        # Create Catalyst Center client
        catalyst_client = CatalystCenterClient(
            username=credentials.get("username"),
            password=credentials.get("password"),
            base_url=credentials.get("base_url", ""),
            verify_ssl=credentials.get("verify_ssl", True),
            api_token=api_token
        )

        # Test connectivity by fetching sites
        sites = await catalyst_client.get_sites()
        await catalyst_client.close()

        # If we successfully fetched sites, API is working
        return OrganizationLicenses(
            organization_name=org_name,
            organization_id="catalyst-instance",
            licenses=[
                LicenseInfo(
                    license_id="catalyst-status",
                    license_type="Cisco Catalyst Center",
                    state="active",
                    duration_in_days=None,
                    claim_date=None,
                    expiration_date=None,
                    device_serial=None,
                    network_id=None,
                    order_number=None,
                    seat_count=None
                )
            ],
            overview={"status": "Active", "api_connected": True, "sites_count": len(sites)},
            error=None
        )

    except Exception as e:
        return OrganizationLicenses(
            organization_name=org_name,
            organization_id="unknown",
            licenses=[],
            error=str(e)
        )



