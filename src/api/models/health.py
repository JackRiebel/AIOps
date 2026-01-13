"""Pydantic models for system health and statistics."""

from typing import Optional, List
from pydantic import BaseModel


class ServiceStatus(BaseModel):
    """Status of an individual service."""
    name: str
    status: str  # healthy, degraded, unhealthy
    message: Optional[str]
    response_time_ms: Optional[int]


class SystemHealthResponse(BaseModel):
    """Response model for system health."""
    status: str  # healthy, degraded, unhealthy
    database: bool
    uptime_seconds: int
    services: List[ServiceStatus]
    timestamp: str


class SystemStatsResponse(BaseModel):
    """Response model for system statistics."""
    total_operations: int
    clusters_configured: int
    audit_logs_count: int
    edit_mode_enabled: bool
