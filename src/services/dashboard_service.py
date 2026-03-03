"""Dashboard aggregation service for BFF pattern.

Consolidates multiple API calls into a single response to eliminate
"popcorn" loading effect on the dashboard.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models import Cluster, AuditLog, Incident

logger = logging.getLogger(__name__)

# Database instance
db = get_db()


async def _get_health_data() -> Dict[str, Any]:
    """Fetch health status."""
    import time
    services = []
    database_healthy = False
    db_start = time.time()

    try:
        async with db.session() as session:
            await session.execute(select(1))
            database_healthy = True
            db_time_ms = int((time.time() - db_start) * 1000)
            services.append({
                "name": "PostgreSQL",
                "status": "healthy",
                "message": "Database connection successful",
                "response_time_ms": db_time_ms
            })
    except Exception as e:
        db_time_ms = int((time.time() - db_start) * 1000)
        services.append({
            "name": "PostgreSQL",
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}",
            "response_time_ms": db_time_ms
        })

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
                select(func.count(Cluster.id)).where(Cluster.is_active == True)
            )
            cluster_count = result.scalar() or 0

        # Check system_config via credential_pool
        system_config_count = 0
        try:
            pool = await get_initialized_pool()
            available = pool.get_available_platforms()
            system_config_count = len(available)
        except Exception:
            pass

        total_configured = cluster_count + system_config_count
        if total_configured > 0:
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

    services.append({
        "name": "Credential Configuration",
        "status": cluster_status,
        "message": cluster_message,
        "response_time_ms": None
    })

    # Determine overall status
    statuses = [s["status"] for s in services]
    if "unhealthy" in statuses:
        overall_status = "unhealthy"
    elif "degraded" in statuses:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    from src.api.dependencies import startup_time
    uptime = int((datetime.utcnow() - startup_time).total_seconds())

    return {
        "status": overall_status,
        "database": database_healthy,
        "uptime_seconds": uptime,
        "services": services,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def _get_organizations_data() -> List[Dict[str, Any]]:
    """Fetch organizations from both clusters table AND discovered Meraki orgs.

    This unified approach combines:
    1. Legacy clusters from database
    2. Meraki organizations discovered from system_config API key

    This ensures the chat UI shows all available organizations regardless
    of whether credentials are stored in clusters table or system_config.
    """
    result_orgs = []
    seen_org_ids = set()

    # First, try to get discovered Meraki orgs from credential pool
    # This uses system_config + clusters for credentials
    try:
        from src.services.credential_pool import get_initialized_pool
        pool = await get_initialized_pool()

        meraki_creds = pool.get_all_for_platform("meraki")
        for cred in meraki_creds:
            for org_id in cred.org_ids:
                if org_id in seen_org_ids:
                    continue
                seen_org_ids.add(org_id)

                # Look up org name from the mapping
                org_name = None
                for key, val in pool._meraki_org_map.items():
                    if val == cred and not key.isdigit():
                        org_name = key
                        break

                result_orgs.append({
                    "id": org_id,
                    "name": org_name or f"Meraki Org {org_id}",
                    "url": "https://api.meraki.com",
                    "is_active": True,
                    "created_at": None,
                    "platform": "meraki",
                    "source": cred.cluster_name,  # "system_config" or cluster name
                })

        logger.info(f"[Dashboard] Found {len(result_orgs)} Meraki orgs from credential pool")

    except Exception as e:
        logger.warning(f"Failed to get discovered Meraki orgs: {e}")

    # Also include legacy clusters from database (for non-Meraki platforms)
    try:
        async with db.session() as session:
            result = await session.execute(
                select(Cluster).order_by(Cluster.name)
            )
            clusters = result.scalars().all()

            for c in clusters:
                # Skip if we already have this org from credential pool discovery
                if str(c.id) in seen_org_ids:
                    continue

                result_orgs.append({
                    "id": c.id,
                    "name": c.name,
                    "url": c.url,
                    "is_active": c.is_active,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "platform": None,  # Unknown/legacy
                    "source": "clusters",
                })

    except Exception as e:
        logger.error(f"Failed to fetch clusters: {e}")

    return result_orgs


async def _get_costs_summary(days: int = 30) -> Dict[str, Any]:
    """Fetch cost summary."""
    try:
        from src.models import AICostLog
        async with db.session() as session:
            cutoff = datetime.utcnow() - timedelta(days=days)
            cutoff_7d = datetime.utcnow() - timedelta(days=7)

            # Total stats
            result = await session.execute(
                select(
                    func.count(AICostLog.id).label("queries"),
                    func.coalesce(func.sum(AICostLog.total_tokens), 0).label("total_tokens"),
                    func.coalesce(func.sum(AICostLog.cost_usd), 0).label("total_cost")
                ).where(AICostLog.timestamp >= cutoff)
            )
            row = result.first()

            # Last 7 days
            result_7d = await session.execute(
                select(
                    func.count(AICostLog.id).label("queries"),
                    func.coalesce(func.sum(AICostLog.cost_usd), 0).label("cost")
                ).where(AICostLog.timestamp >= cutoff_7d)
            )
            row_7d = result_7d.first()

            queries = row.queries if row else 0
            total_cost = float(row.total_cost) if row and row.total_cost else 0
            avg_cost = total_cost / queries if queries > 0 else 0

            return {
                "period_days": days,
                "queries": queries,
                "total_tokens": row.total_tokens if row else 0,
                "total_cost_usd": total_cost,
                "avg_cost_per_query": avg_cost,
                "last_7_days": {
                    "queries": row_7d.queries if row_7d else 0,
                    "cost_usd": float(row_7d.cost) if row_7d and row_7d.cost else 0
                }
            }
    except Exception as e:
        logger.error(f"Failed to fetch cost summary: {e}")
        return {
            "period_days": days,
            "queries": 0,
            "total_tokens": 0,
            "total_cost_usd": 0,
            "avg_cost_per_query": 0,
            "last_7_days": {"queries": 0, "cost_usd": 0}
        }


async def _get_daily_costs(days: int = 14) -> List[Dict[str, Any]]:
    """Fetch daily cost breakdown."""
    try:
        from src.models import AICostLog
        async with db.session() as session:
            cutoff = datetime.utcnow() - timedelta(days=days)

            result = await session.execute(
                select(
                    func.date(AICostLog.timestamp).label("date"),
                    func.count(AICostLog.id).label("queries"),
                    func.coalesce(func.sum(AICostLog.cost_usd), 0).label("cost")
                )
                .where(AICostLog.timestamp >= cutoff)
                .group_by(func.date(AICostLog.timestamp))
                .order_by(func.date(AICostLog.timestamp))
            )

            return [
                {
                    "date": str(row.date),
                    "cost_usd": float(row.cost) if row.cost else 0,
                    "queries": row.queries,
                    "label": row.date.strftime("%b %d") if hasattr(row.date, 'strftime') else str(row.date)
                }
                for row in result
            ]
    except Exception as e:
        logger.error(f"Failed to fetch daily costs: {e}")
        return []


async def _get_incidents(hours: int = 24) -> List[Dict[str, Any]]:
    """Fetch recent incidents."""
    try:
        async with db.session() as session:
            cutoff = datetime.utcnow() - timedelta(hours=hours)

            result = await session.execute(
                select(Incident)
                .where(Incident.start_time >= cutoff)
                .order_by(Incident.start_time.desc())
            )
            incidents = result.scalars().all()

            return [
                {
                    "id": i.id,
                    "title": i.title,
                    "status": i.status,
                    "severity": i.severity,
                    "start_time": i.start_time.isoformat() if i.start_time else None,
                    "event_count": i.event_count or 0,
                }
                for i in incidents
            ]
    except Exception as e:
        logger.error(f"Failed to fetch incidents: {e}")
        return []


async def _get_integrations_config() -> Dict[str, Any]:
    """Fetch integration configuration status."""
    try:
        from src.models import SystemConfig
        async with db.session() as session:
            result = await session.execute(
                select(SystemConfig).where(SystemConfig.category == "integrations")
            )
            configs = result.scalars().all()

            config_dict = {}
            for cfg in configs:
                config_dict[cfg.key] = {
                    "has_value": bool(cfg.value and cfg.value.strip() and cfg.value != "None")
                }

            return {"configs": config_dict}
    except Exception as e:
        logger.error(f"Failed to fetch integration config: {e}")
        return {"configs": {}}


async def _get_audit_logs(limit: int = 10) -> List[Dict[str, Any]]:
    """Fetch recent audit logs."""
    try:
        async with db.session() as session:
            result = await session.execute(
                select(AuditLog)
                .order_by(AuditLog.timestamp.desc())
                .limit(limit)
            )
            logs = result.scalars().all()

            return [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "http_method": log.http_method,
                    "path": log.path,
                    "response_status": log.response_status,
                }
                for log in logs
            ]
    except Exception as e:
        logger.error(f"Failed to fetch audit logs: {e}")
        return []


async def _get_incident_velocity() -> Dict[str, Any]:
    """Fetch incident velocity metrics."""
    try:
        async with db.session() as session:
            now = datetime.utcnow()
            cutoff_24h = now - timedelta(hours=24)
            current_hour_start = now.replace(minute=0, second=0, microsecond=0)

            result = await session.execute(
                select(Incident.start_time)
                .where(Incident.start_time >= cutoff_24h)
                .order_by(Incident.start_time.asc())
            )
            incidents = result.scalars().all()

            hourly_counts: Dict[int, int] = {i: 0 for i in range(24)}
            current_hour_count = 0

            for start_time in incidents:
                if start_time:
                    hours_ago = int((now - start_time).total_seconds() // 3600)
                    if 0 <= hours_ago < 24:
                        hourly_counts[hours_ago] += 1
                    if start_time >= current_hour_start:
                        current_hour_count += 1

            hourly_data = []
            for i in range(23, -1, -1):
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
            }
    except Exception as e:
        logger.error(f"Failed to fetch incident velocity: {e}")
        return {
            "hourly_data": [],
            "current_hour_count": 0,
            "average_count": 0,
            "total_24h": 0,
        }


async def _get_activity_feed(limit: int = 10) -> Dict[str, Any]:
    """Fetch activity feed items."""
    try:
        from src.models import Workflow
        async with db.session() as session:
            # Get recent workflow executions
            result = await session.execute(
                select(Workflow)
                .order_by(Workflow.updated_at.desc())
                .limit(limit)
            )
            workflows = result.scalars().all()

            items = []
            for w in workflows:
                items.append({
                    "id": str(w.id),
                    "type": "workflow",
                    "title": w.name,
                    "description": w.description,
                    "status": w.status or "pending",
                    "timestamp": (w.updated_at or w.created_at).isoformat() if (w.updated_at or w.created_at) else None,
                    "workflow_id": str(w.id),
                    "workflow_name": w.name,
                })

            return {"items": items}
    except Exception as e:
        logger.error(f"Failed to fetch activity feed: {e}")
        return {"items": []}


async def get_dashboard_summary() -> Dict[str, Any]:
    """Aggregate all dashboard data in parallel.

    This is the main BFF endpoint that consolidates 10 separate
    API calls into a single response.

    Returns:
        Dict containing all dashboard data sections
    """
    # Run all queries in parallel
    results = await asyncio.gather(
        _get_health_data(),
        _get_organizations_data(),
        _get_costs_summary(days=30),
        _get_daily_costs(days=14),
        _get_incidents(hours=24),
        _get_incidents(hours=168),  # 7 days
        _get_integrations_config(),
        _get_audit_logs(limit=10),
        _get_incident_velocity(),
        _get_activity_feed(limit=10),
        return_exceptions=True
    )

    # Process results, handling any exceptions
    def safe_result(result: Any, default: Any) -> Any:
        if isinstance(result, Exception):
            logger.error(f"Dashboard aggregation error: {result}")
            return default
        return result

    return {
        "health": safe_result(results[0], {"status": "unknown", "services": []}),
        "organizations": safe_result(results[1], []),
        "costs_summary": safe_result(results[2], {}),
        "daily_costs": safe_result(results[3], []),
        "incidents_24h": safe_result(results[4], []),
        "incidents_7d": safe_result(results[5], []),
        "integrations_config": safe_result(results[6], {"configs": {}}),
        "audit_logs": safe_result(results[7], []),
        "incident_velocity": safe_result(results[8], {}),
        "activity_feed": safe_result(results[9], {"items": []}),
        "timestamp": datetime.utcnow().isoformat(),
    }
