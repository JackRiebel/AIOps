"""Pydantic models for organization/cluster management."""

from typing import Optional
from pydantic import BaseModel, Field


class ClusterCreate(BaseModel):
    """Request model for creating a cluster."""
    name: str = Field(..., min_length=1, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    url: str = Field(..., min_length=1)
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None  # For Meraki organizations
    verify_ssl: bool = True


class ClusterUpdate(BaseModel):
    """Request model for updating a cluster."""
    display_name: Optional[str] = Field(None, max_length=255)
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    verify_ssl: Optional[bool] = None


class ClusterResponse(BaseModel):
    """Response model for cluster information."""
    id: int
    name: str
    display_name: Optional[str] = None
    url: str
    username: Optional[str] = None
    verify_ssl: bool
    is_active: bool
    status: str = "unknown"
    platform: Optional[str] = None  # meraki, catalyst, thousandeyes, splunk
    created_at: str
    updated_at: str


class NetworkPlatformOrg(BaseModel):
    """Response model for network platform organizations (Meraki/Catalyst only)."""
    id: int
    name: str
    display_name: Optional[str] = None
    platform: str  # meraki or catalyst
    is_active: bool
