"""Pydantic models for incident and event management."""

from typing import Optional, List
from pydantic import BaseModel


class IncidentResponse(BaseModel):
    """Response model for incident."""
    id: int
    title: str
    status: str
    severity: str
    start_time: str
    end_time: Optional[str]
    created_at: str
    updated_at: str
    root_cause_hypothesis: Optional[str]
    confidence_score: Optional[float]
    affected_services: Optional[List[str]]
    organizations: Optional[List[str]]
    event_count: int
    network_id: Optional[str] = None
    network_name: Optional[str] = None


class EventResponse(BaseModel):
    """Response model for event."""
    id: int
    source: str
    source_event_id: Optional[str]
    organization: str
    event_type: str
    severity: str
    title: str
    description: Optional[str]
    timestamp: str
    created_at: str
    affected_resource: Optional[str]
    incident_id: Optional[int]
