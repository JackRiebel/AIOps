"""Audit logging utilities."""

from typing import Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.audit import AuditLog
from src.api.dependencies import get_request_id


async def log_audit(
    db: AsyncSession,
    request: Request,
    cluster_id: Optional[int] = None,
    operation_id: Optional[str] = None,
    response_status: int = 200,
    error_message: Optional[str] = None,
    request_body: Optional[dict] = None,
):
    """Log an audit entry for an API operation.

    Args:
        db: Database session
        request: FastAPI request object
        cluster_id: Optional cluster/organization ID
        operation_id: Optional operation identifier
        response_status: HTTP response status code
        error_message: Optional error message
        request_body: Optional request body to log
    """
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    method = request.method

    audit = AuditLog(
        cluster_id=cluster_id,
        user_id="web-ui",
        operation_id=operation_id or path.split("/")[-1],
        http_method=method,
        path=path,
        request_body=request_body,
        response_status=response_status,
        error_message=error_message,
        client_ip=client_ip,
        request_id=get_request_id(request),
    )
    db.add(audit)
    await db.commit()
