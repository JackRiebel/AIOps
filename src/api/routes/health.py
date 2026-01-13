"""API routes for health."""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models import Cluster, AuditLog, SecurityConfig
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_admin, require_viewer
from src.api.models import *
from src.api.utils.audit import log_audit
from src.services.circuit_breaker import (
    get_all_circuit_breakers_status,
    reset_circuit_breaker,
    reset_all_circuit_breakers
)

router = APIRouter()

# Database instance
from src.config.database import get_db
db = get_db()

@router.get("/api/health", response_model=SystemHealthResponse, dependencies=[Depends(require_viewer)])
async def get_health():
    """Get system health status with detailed service checks."""
    import time
    services = []

    # Check PostgreSQL Database
    database_healthy = False
    db_start = time.time()
    try:
        async with db.session() as session:
            await session.execute(select(1))
            database_healthy = True
            db_time_ms = int((time.time() - db_start) * 1000)
            services.append(ServiceStatus(
                name="PostgreSQL",
                status="healthy",
                message="Database connection successful",
                response_time_ms=db_time_ms
            ))
    except Exception as e:
        db_time_ms = int((time.time() - db_start) * 1000)
        services.append(ServiceStatus(
            name="PostgreSQL",
            status="unhealthy",
            message=f"Database connection failed: {str(e)}",
            response_time_ms=db_time_ms
        ))

    # Check Cluster/Credential Configuration
    # Check both clusters table AND system_config for credentials
    cluster_status = "healthy"
    cluster_message = "No credentials configured"
    try:
        from src.services.credential_pool import get_initialized_pool

        # Check clusters table
        cluster_count = 0
        async with db.session() as session:
            result = await session.execute(
                select(Cluster).where(Cluster.is_active == True)
            )
            clusters = result.scalars().all()
            cluster_count = len(clusters)

        # Check system_config via credential_pool
        pool = await get_initialized_pool()
        available_platforms = pool.get_available_platforms()
        system_config_count = len(available_platforms)

        total_credentials = cluster_count + system_config_count

        if total_credentials > 0:
            parts = []
            if cluster_count > 0:
                parts.append(f"{cluster_count} cluster(s)")
            if system_config_count > 0:
                parts.append(f"{system_config_count} platform(s) from setup")
            cluster_message = f"{' + '.join(parts)} configured"
        else:
            cluster_status = "degraded"
    except Exception as e:
        cluster_status = "unhealthy"
        cluster_message = f"Failed to check credentials: {str(e)}"

    services.append(ServiceStatus(
        name="Credential Configuration",
        status=cluster_status,
        message=cluster_message,
        response_time_ms=None
    ))

    # Check MCP Server (via audit logs)
    mcp_status = "healthy"
    mcp_message = "MCP server operational"
    try:
        async with db.session() as session:
            # Check for recent audit logs (last 24 hours)
            from datetime import timedelta
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            result = await session.execute(
                select(func.count(AuditLog.id)).where(AuditLog.timestamp >= cutoff_time)
            )
            recent_logs = result.scalar()
            if recent_logs > 0:
                mcp_message = f"{recent_logs} operations in last 24h"
            else:
                mcp_status = "degraded"
                mcp_message = "No recent operations logged"
    except Exception as e:
        mcp_status = "unhealthy"
        mcp_message = f"Cannot check MCP activity: {str(e)}"

    services.append(ServiceStatus(
        name="MCP Server",
        status=mcp_status,
        message=mcp_message,
        response_time_ms=None
    ))

    # Determine overall status
    statuses = [s.status for s in services]
    if "unhealthy" in statuses:
        overall_status = "unhealthy"
    elif "degraded" in statuses:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    uptime = int((datetime.utcnow() - startup_time).total_seconds())

    return {
        "status": overall_status,
        "database": database_healthy,
        "uptime_seconds": uptime,
        "services": services,
        "timestamp": datetime.utcnow().isoformat(),
    }



@router.get("/api/stats", response_model=SystemStatsResponse, dependencies=[Depends(require_viewer)])
async def get_stats():
    """Get system statistics."""
    async with db.session() as session:
        # Count clusters
        cluster_count = await session.execute(
            select(func.count()).select_from(Cluster)
        )
        clusters_configured = cluster_count.scalar() or 0

        # Count audit logs
        audit_count = await session.execute(
            select(func.count()).select_from(AuditLog)
        )
        audit_logs_count = audit_count.scalar() or 0

        # Get security config
        security_result = await session.execute(
            select(SecurityConfig).limit(1)
        )
        security_config = security_result.scalar_one_or_none()
        edit_mode = security_config.edit_mode_enabled if security_config else False

    return {
        "total_operations": audit_logs_count,  # Fixed: was broken string + comment
        "clusters_configured": clusters_configured,
        "audit_logs_count": audit_logs_count,
        "edit_mode_enabled": edit_mode,
    }


# Circuit Breaker Monitoring Endpoints

@router.get("/api/circuit-breakers", dependencies=[Depends(require_viewer)])
async def get_circuit_breakers():
    """Get status of all circuit breakers.

    Returns status information for each registered circuit breaker including:
    - Current state (closed/open/half_open)
    - Call metrics (total, successful, failed, rejected)
    - Configuration settings
    - Time until retry (for open circuits)
    """
    return {
        "circuit_breakers": get_all_circuit_breakers_status(),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/api/circuit-breakers/{service_name}/reset", dependencies=[Depends(require_admin)])
async def reset_service_circuit_breaker(service_name: str, request: Request):
    """Reset a specific circuit breaker to closed state.

    This allows manual recovery when a circuit breaker is stuck open
    after the external service has recovered.

    Requires ADMIN role.
    """
    success = reset_circuit_breaker(service_name)

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Circuit breaker '{service_name}' not found. "
                   "Circuit breakers are created when services are first called."
        )

    await log_audit(
        request=request,
        action="circuit_breaker_reset",
        resource_type="circuit_breaker",
        resource_id=service_name,
        details={"service": service_name}
    )

    return {
        "success": True,
        "message": f"Circuit breaker for '{service_name}' has been reset to closed state",
        "circuit_breakers": get_all_circuit_breakers_status()
    }


@router.post("/api/circuit-breakers/reset-all", dependencies=[Depends(require_admin)])
async def reset_all_service_circuit_breakers(request: Request):
    """Reset all circuit breakers to closed state.

    Use with caution - this will allow requests to all services even
    if they may still be unavailable.

    Requires ADMIN role.
    """
    count = reset_all_circuit_breakers()

    await log_audit(
        request=request,
        action="circuit_breakers_reset_all",
        resource_type="circuit_breaker",
        resource_id="all",
        details={"count": count}
    )

    return {
        "success": True,
        "message": f"Reset {count} circuit breaker(s) to closed state",
        "circuit_breakers": get_all_circuit_breakers_status()
    }


@router.get("/api/health/incident-velocity", dependencies=[Depends(require_viewer)])
async def get_incident_velocity():
    """Get incident velocity metrics for the last 24 hours.

    Returns:
        - hourly_counts: Array of incident counts per hour (last 24h)
        - current_hour_count: Incidents in the current hour
        - average_count: Average incidents per hour over 24h
    """
    from src.models import Incident

    try:
        async with db.session() as session:
            now = datetime.utcnow()
            cutoff_24h = now - timedelta(hours=24)
            current_hour_start = now.replace(minute=0, second=0, microsecond=0)

            # Get all incidents from the last 24 hours
            result = await session.execute(
                select(Incident.start_time)
                .where(Incident.start_time >= cutoff_24h)
                .order_by(Incident.start_time.asc())
            )
            incidents = result.scalars().all()

            # Group by hour
            hourly_counts: Dict[int, int] = {i: 0 for i in range(24)}
            current_hour_count = 0

            for start_time in incidents:
                if start_time:
                    hours_ago = int((now - start_time).total_seconds() // 3600)
                    if 0 <= hours_ago < 24:
                        hourly_counts[hours_ago] += 1

                    # Check if in current hour
                    if start_time >= current_hour_start:
                        current_hour_count += 1

            # Convert to array format (oldest to newest)
            hourly_data = []
            for i in range(23, -1, -1):  # 23 hours ago to now
                hour_time = now - timedelta(hours=i)
                hourly_data.append({
                    "hour": i,
                    "count": hourly_counts.get(i, 0),
                    "label": hour_time.strftime("%I %p").lstrip("0"),
                })

            total_incidents = sum(hourly_counts.values())
            average_count = total_incidents / 24 if total_incidents > 0 else 0

            return {
                "hourly_data": hourly_data,
                "current_hour_count": current_hour_count,
                "average_count": round(average_count, 2),
                "total_24h": total_incidents,
                "timestamp": now.isoformat(),
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get incident velocity: {str(e)}")


# PostgreSQL Server Management Endpoints

@router.get("/api/health/postgres/status", dependencies=[Depends(require_viewer)])
async def get_postgres_status():
    """Get embedded PostgreSQL server status.

    Returns status information including:
    - Current state (running/stopped/not_initialized)
    - Data directory path
    - Data size in MB
    - Whether the server is initialized
    """
    from src.config.settings import get_settings
    settings = get_settings()

    if not settings.use_embedded_postgres:
        return {
            "embedded": False,
            "status": "external",
            "message": "Using external PostgreSQL server",
            "data_dir": None,
            "data_size_mb": None,
            "connection_string": settings.database_url[:50] + "..." if settings.database_url else None,
        }

    try:
        from src.services.embedded_postgres import get_embedded_postgres
        pg = get_embedded_postgres()
        stats = pg.get_stats()
        return {
            "embedded": True,
            **stats,
        }
    except ImportError:
        return {
            "embedded": True,
            "status": "error",
            "error": "pgserver package not installed",
            "data_dir": None,
            "data_size_mb": None,
        }
    except Exception as e:
        return {
            "embedded": True,
            "status": "error",
            "error": str(e),
            "data_dir": None,
            "data_size_mb": None,
        }


@router.post("/api/health/postgres/start", dependencies=[Depends(require_admin)])
async def start_postgres(request: Request):
    """Start the embedded PostgreSQL server.

    Requires ADMIN role.
    """
    from src.config.settings import get_settings
    settings = get_settings()

    if not settings.use_embedded_postgres:
        raise HTTPException(
            status_code=400,
            detail="Cannot start PostgreSQL: using external database"
        )

    try:
        from src.services.embedded_postgres import get_embedded_postgres
        pg = get_embedded_postgres()
        success = await pg.start()

        if success:
            await log_audit(
                request=request,
                action="postgres_start",
                resource_type="database",
                resource_id="embedded_postgres",
                details={"status": "started"}
            )

        return {
            "success": success,
            "status": pg.status.value,
            "error": pg.error_message if not success else None,
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="pgserver package not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/health/postgres/stop", dependencies=[Depends(require_admin)])
async def stop_postgres(request: Request):
    """Stop the embedded PostgreSQL server.

    WARNING: This will disconnect all database clients.

    Requires ADMIN role.
    """
    from src.config.settings import get_settings
    settings = get_settings()

    if not settings.use_embedded_postgres:
        raise HTTPException(
            status_code=400,
            detail="Cannot stop PostgreSQL: using external database"
        )

    try:
        from src.services.embedded_postgres import get_embedded_postgres
        pg = get_embedded_postgres()
        success = await pg.stop()

        if success:
            await log_audit(
                request=request,
                action="postgres_stop",
                resource_type="database",
                resource_id="embedded_postgres",
                details={"status": "stopped"}
            )

        return {
            "success": success,
            "status": pg.status.value,
            "error": pg.error_message if not success else None,
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="pgserver package not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/health/postgres/restart", dependencies=[Depends(require_admin)])
async def restart_postgres(request: Request):
    """Restart the embedded PostgreSQL server.

    WARNING: This will briefly disconnect all database clients.

    Requires ADMIN role.
    """
    from src.config.settings import get_settings
    settings = get_settings()

    if not settings.use_embedded_postgres:
        raise HTTPException(
            status_code=400,
            detail="Cannot restart PostgreSQL: using external database"
        )

    try:
        from src.services.embedded_postgres import get_embedded_postgres
        pg = get_embedded_postgres()
        success = await pg.restart()

        if success:
            await log_audit(
                request=request,
                action="postgres_restart",
                resource_type="database",
                resource_id="embedded_postgres",
                details={"status": "restarted"}
            )

        return {
            "success": success,
            "status": pg.status.value,
            "error": pg.error_message if not success else None,
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="pgserver package not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/health/postgres/initialize", dependencies=[Depends(require_admin)])
async def initialize_postgres(request: Request):
    """Initialize the PostgreSQL data directory and start the server.

    This creates the database and runs table migrations.

    Requires ADMIN role.
    """
    from src.config.settings import get_settings
    settings = get_settings()

    if not settings.use_embedded_postgres:
        raise HTTPException(
            status_code=400,
            detail="Cannot initialize PostgreSQL: using external database"
        )

    try:
        from src.services.embedded_postgres import get_embedded_postgres
        from src.config.database import init_db

        pg = get_embedded_postgres()

        # Initialize and start
        await pg.initialize()
        success = await pg.start()

        if success:
            # Update settings with connection string
            settings.database_url = pg.connection_string

            # Run database migrations
            await init_db()

            await log_audit(
                request=request,
                action="postgres_initialize",
                resource_type="database",
                resource_id="embedded_postgres",
                details={"status": "initialized"}
            )

        return {
            "success": success,
            "status": pg.status.value,
            "error": pg.error_message if not success else None,
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="pgserver package not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Organization Management Endpoints (aliases for Cluster endpoints)

