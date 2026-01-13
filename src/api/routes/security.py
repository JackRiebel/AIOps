"""API routes for security."""

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_admin, require_viewer
from src.api.models import *
from src.api.utils.audit import log_audit
from src.models import SecurityConfig
from typing import List, Optional, Dict, Any

router = APIRouter()

# Database instance
from src.config.database import get_db
db = get_db()

@router.get("/api/security/config", dependencies=[Depends(require_viewer)])
async def get_security_config():
    """Get current security configuration."""
    async with db.session() as session:
        result = await session.execute(
            select(SecurityConfig).limit(1)
        )
        config = result.scalar_one_or_none()

        if not config:
            # Return default configuration
            return {
                "edit_mode_enabled": False,
                "allowed_operations": [],
                "audit_logging": True,
            }

        return config.to_dict()



@router.put("/api/security/config", dependencies=[Depends(require_admin)])
async def update_security_config(config_data: SecurityConfigUpdate):
    """Update security configuration."""
    async with db.session() as session:
        result = await session.execute(
            select(SecurityConfig).limit(1)
        )
        config = result.scalar_one_or_none()

        if not config:
            # Create new config
            config = SecurityConfig(
                edit_mode_enabled=config_data.edit_mode_enabled or False,
                allowed_operations=config_data.allowed_operations or [],
                audit_logging=config_data.audit_logging if config_data.audit_logging is not None else True,
            )
            session.add(config)
        else:
            # Update existing config
            if config_data.edit_mode_enabled is not None:
                config.edit_mode_enabled = config_data.edit_mode_enabled
            if config_data.allowed_operations is not None:
                config.allowed_operations = config_data.allowed_operations
            if config_data.audit_logging is not None:
                config.audit_logging = config_data.audit_logging

        await session.flush()  # Flush to refresh before context manager commits
        await session.refresh(config)

        return config.to_dict()



@router.get("/api/security/edit-mode", dependencies=[Depends(require_viewer)])
async def get_edit_mode():
    """Get current edit mode status."""
    async with db.session() as session:
        result = await session.execute(
            select(SecurityConfig).limit(1)
        )
        config = result.scalar_one_or_none()

        return {
            "enabled": config.edit_mode_enabled if config else False
        }



@router.put("/api/security/edit-mode", dependencies=[Depends(require_admin)])
async def set_edit_mode(mode: EditModeUpdate):
    """Enable or disable edit mode."""
    async with db.session() as session:
        result = await session.execute(
            select(SecurityConfig).limit(1)
        )
        config = result.scalar_one_or_none()

        if not config:
            config = SecurityConfig(edit_mode_enabled=mode.enabled)
            session.add(config)
        else:
            config.edit_mode_enabled = mode.enabled

        await session.flush()  # Flush to refresh before context manager commits
        await session.refresh(config)

        return {"enabled": config.edit_mode_enabled}


# Audit Log Endpoints


# ============================================================================
# Security Events Endpoints (Meraki Security Data)
# ============================================================================

@router.get("/api/security/events", dependencies=[Depends(require_viewer)])
async def get_security_events(
    org: str = Query(..., description="Organization name"),
    timespan: int = Query(86400, description="Timespan in seconds (default: 24 hours)"),
    limit: int = Query(100, description="Maximum number of events to return"),
):
    """Get security events from Meraki for an organization.

    Returns security events including malware detections, IDS alerts,
    and content filtering events.
    """
    from src.services.meraki_api import MerakiAPIClient

    # Get credentials for the org
    creds = credential_manager.get_meraki_credentials(org)
    if not creds:
        raise HTTPException(status_code=404, detail=f"No Meraki credentials found for organization: {org}")

    api_key = creds.get("api_key")
    org_id = creds.get("org_id")

    if not api_key or not org_id:
        raise HTTPException(status_code=500, detail="Invalid Meraki credentials configuration")

    async with MerakiAPIClient(api_key=api_key) as client:
        events = await client.get_organization_security_events(
            org_id=org_id,
            timespan=min(timespan, 2678400),  # Max 31 days
            per_page=min(limit, 1000),
        )

    return {
        "events": events,
        "organization": org,
        "timespan_seconds": timespan,
        "count": len(events),
    }


@router.get("/api/security/threat-map", dependencies=[Depends(require_viewer)])
async def get_threat_map_data(
    org: str = Query(..., description="Organization name"),
    timespan: int = Query(86400, description="Timespan in seconds (default: 24 hours)"),
):
    """Get threat map data aggregated by source IP for visualization.

    Returns security events grouped by source IP with geolocation data
    for threat map visualization.
    """
    from src.services.meraki_api import MerakiAPIClient
    from src.services.ip_geolocation import get_ip_geolocation

    # Get credentials for the org
    creds = credential_manager.get_meraki_credentials(org)
    if not creds:
        raise HTTPException(status_code=404, detail=f"No Meraki credentials found for organization: {org}")

    api_key = creds.get("api_key")
    org_id = creds.get("org_id")

    if not api_key or not org_id:
        raise HTTPException(status_code=500, detail="Invalid Meraki credentials configuration")

    async with MerakiAPIClient(api_key=api_key) as client:
        events = await client.get_organization_security_events(
            org_id=org_id,
            timespan=min(timespan, 2678400),
            per_page=500,  # Get more events for aggregation
        )

    # Aggregate by source IP
    ip_threats: Dict[str, Dict[str, Any]] = {}
    for event in events:
        src_ip = event.get("srcIp")
        if not src_ip or src_ip.startswith("10.") or src_ip.startswith("192.168.") or src_ip.startswith("172."):
            continue  # Skip private IPs

        if src_ip not in ip_threats:
            ip_threats[src_ip] = {
                "ip": src_ip,
                "count": 0,
                "event_types": set(),
                "latest_event": None,
            }

        ip_threats[src_ip]["count"] += 1
        ip_threats[src_ip]["event_types"].add(event.get("eventType", "Unknown"))

        # Track latest event
        event_ts = event.get("ts")
        if event_ts:
            if not ip_threats[src_ip]["latest_event"] or event_ts > ip_threats[src_ip]["latest_event"]:
                ip_threats[src_ip]["latest_event"] = event_ts

    # Get geolocation for top threat IPs (limit to avoid rate limits)
    threat_locations = []
    sorted_threats = sorted(ip_threats.values(), key=lambda x: x["count"], reverse=True)[:20]

    for threat in sorted_threats:
        geo = await get_ip_geolocation(threat["ip"])
        if geo and geo.get("lat") and geo.get("lon"):
            threat_locations.append({
                "ip": threat["ip"],
                "count": threat["count"],
                "event_types": list(threat["event_types"]),
                "latest_event": threat["latest_event"],
                "location": {
                    "lat": geo["lat"],
                    "lon": geo["lon"],
                    "city": geo.get("city"),
                    "country": geo.get("country"),
                    "country_code": geo.get("country_code"),
                },
            })

    return {
        "threats": threat_locations,
        "organization": org,
        "timespan_seconds": timespan,
        "total_events": len(events),
        "unique_sources": len(ip_threats),
    }


@router.get("/api/security/intrusion-stats", dependencies=[Depends(require_viewer)])
async def get_intrusion_stats(
    org: str = Query(..., description="Organization name"),
    timespan: int = Query(86400, description="Timespan in seconds (default: 24 hours)"),
):
    """Get intrusion detection statistics for an organization."""
    from src.services.meraki_api import MerakiAPIClient

    # Get credentials for the org
    creds = credential_manager.get_meraki_credentials(org)
    if not creds:
        raise HTTPException(status_code=404, detail=f"No Meraki credentials found for organization: {org}")

    api_key = creds.get("api_key")
    org_id = creds.get("org_id")

    if not api_key or not org_id:
        raise HTTPException(status_code=500, detail="Invalid Meraki credentials configuration")

    async with MerakiAPIClient(api_key=api_key) as client:
        stats = await client.get_organization_security_intrusion_stats(
            org_id=org_id,
            timespan=timespan,
        )

    return {
        "stats": stats,
        "organization": org,
        "timespan_seconds": timespan,
    }
