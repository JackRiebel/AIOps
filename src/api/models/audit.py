"""Pydantic models for audit logging."""

from typing import Optional
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """Response model for audit log entry."""
    id: int
    cluster_id: Optional[int]
    cluster_name: Optional[str]
    cluster_url: Optional[str]
    user_id: Optional[str]
    operation_id: Optional[str]
    http_method: Optional[str]
    path: Optional[str]
    request_body: Optional[dict]
    response_status: Optional[int]
    response_body: Optional[dict]
    error_message: Optional[str]
    client_ip: Optional[str]
    timestamp: str


class AuditStatsResponse(BaseModel):
    """Response model for audit statistics."""
    total: int
    successful: int
    failed: int
    by_method: dict
    by_status: dict
