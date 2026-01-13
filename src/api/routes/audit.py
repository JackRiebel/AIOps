"""API routes for audit."""

import io
import csv
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_admin, require_viewer
from src.api.models import *
from src.api.utils.audit import log_audit
from src.models import AuditLog, Cluster
from typing import List, Optional, Dict, Any

router = APIRouter()

# Database instance
from src.config.database import get_db
db = get_db()

@router.get("/api/audit", response_model=List[AuditLogResponse], dependencies=[Depends(require_viewer)])
async def list_audit_logs(
    cluster_id: Optional[int] = Query(None),
    operation_id: Optional[str] = Query(None),
    http_method: Optional[str] = Query(None),
    status_min: Optional[int] = Query(None),
    status_max: Optional[int] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
):
    """List audit logs with optional filtering."""
    async with db.session() as session:
        # Join with clusters table to get cluster name and URL
        query = select(
            AuditLog,
            Cluster.name.label('cluster_name'),
            Cluster.url.label('cluster_url')
        ).outerjoin(
            Cluster, AuditLog.cluster_id == Cluster.id
        ).order_by(AuditLog.timestamp.desc())

        # Apply filters
        if cluster_id is not None:
            query = query.where(AuditLog.cluster_id == cluster_id)
        if operation_id:
            query = query.where(AuditLog.operation_id == operation_id)
        if http_method:
            query = query.where(AuditLog.http_method == http_method.upper())
        if status_min is not None:
            query = query.where(AuditLog.response_status >= status_min)
        if status_max is not None:
            query = query.where(AuditLog.response_status <= status_max)

        # Apply pagination
        query = query.limit(limit).offset(offset)

        result = await session.execute(query)
        rows = result.all()

        return [
            AuditLogResponse(
                id=row[0].id,
                cluster_id=row[0].cluster_id,
                cluster_name=row[1],
                cluster_url=row[2],
                user_id=row[0].user_id,
                operation_id=row[0].operation_id,
                http_method=row[0].http_method,
                path=row[0].path,
                request_body=row[0].request_body,
                response_status=row[0].response_status,
                response_body=row[0].response_body,
                error_message=row[0].error_message,
                client_ip=row[0].client_ip,
                timestamp=row[0].timestamp.isoformat(),
            )
            for row in rows
        ]


# Alias endpoint for backwards compatibility

@router.get("/api/audit/logs", response_model=List[AuditLogResponse], dependencies=[Depends(require_viewer)])
async def list_audit_logs_alias(
    cluster_id: Optional[int] = Query(None),
    operation_id: Optional[str] = Query(None),
    http_method: Optional[str] = Query(None),
    status_min: Optional[int] = Query(None),
    status_max: Optional[int] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
):
    """Alias for /api/audit endpoint for backwards compatibility."""
    return await list_audit_logs(
        cluster_id=cluster_id,
        operation_id=operation_id,
        http_method=http_method,
        status_min=status_min,
        status_max=status_max,
        limit=limit,
        offset=offset
    )



@router.get("/api/audit/export", dependencies=[Depends(require_admin)])
async def export_audit_logs(
    cluster_id: Optional[int] = Query(None),
    operation_id: Optional[str] = Query(None),
    http_method: Optional[str] = Query(None),
):
    """Export audit logs as CSV."""
    async with db.session() as session:
        # Join with clusters table to get cluster name and URL
        query = select(
            AuditLog,
            Cluster.name.label('cluster_name'),
            Cluster.url.label('cluster_url')
        ).outerjoin(
            Cluster, AuditLog.cluster_id == Cluster.id
        ).order_by(AuditLog.timestamp.desc())

        # Apply filters
        if cluster_id is not None:
            query = query.where(AuditLog.cluster_id == cluster_id)
        if operation_id:
            query = query.where(AuditLog.operation_id == operation_id)
        if http_method:
            query = query.where(AuditLog.http_method == http_method.upper())

        result = await session.execute(query)
        rows = result.all()

        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow([
            "ID", "Cluster Name", "Cluster URL", "User ID", "Operation ID", "HTTP Method",
            "Path", "Response Status", "Error Message", "Client IP", "Timestamp"
        ])

        # Write data
        for row in rows:
            writer.writerow([
                row[0].id,
                row[1],
                row[2],
                row[0].user_id,
                row[0].operation_id,
                row[0].http_method,
                row[0].path,
                row[0].response_status,
                row[0].error_message,
                row[0].client_ip,
                row[0].timestamp.isoformat(),
            ])

        # Return CSV as streaming response
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            },
        )



@router.get("/api/audit/stats", response_model=AuditStatsResponse, dependencies=[Depends(require_viewer)])
async def get_audit_stats():
    """Get audit log statistics."""
    async with db.session() as session:
        # Total count
        total_result = await session.execute(
            select(func.count()).select_from(AuditLog)
        )
        total = total_result.scalar() or 0

        # Successful count (2xx status)
        success_result = await session.execute(
            select(func.count()).select_from(AuditLog).where(
                AuditLog.response_status >= 200,
                AuditLog.response_status < 300
            )
        )
        successful = success_result.scalar() or 0

        # Failed count (4xx or 5xx status or has error_message)
        failed_result = await session.execute(
            select(func.count()).select_from(AuditLog).where(
                (AuditLog.response_status >= 400) | (AuditLog.error_message.isnot(None))
            )
        )
        failed = failed_result.scalar() or 0

        # By method
        method_result = await session.execute(
            select(AuditLog.http_method, func.count()).
            group_by(AuditLog.http_method)
        )
        by_method = {method: count for method, count in method_result.all()}

        # By status
        status_result = await session.execute(
            select(AuditLog.response_status, func.count()).
            group_by(AuditLog.response_status)
        )
        by_status = {str(status): count for status, count in status_result.all() if status is not None}

        return {
            "total": total,
            "successful": successful,
            "failed": failed,
            "by_method": by_method,
            "by_status": by_status,
        }



