"""Pydantic models for license management."""

from typing import Optional, List
from pydantic import BaseModel


class LicenseInfo(BaseModel):
    """Individual license information."""
    license_id: str
    license_type: str
    state: str
    duration_in_days: Optional[int] = None
    claim_date: Optional[str] = None
    expiration_date: Optional[str] = None
    device_serial: Optional[str] = None
    network_id: Optional[str] = None
    order_number: Optional[str] = None
    seat_count: Optional[int] = None


class OrganizationLicenses(BaseModel):
    """Licenses for a single organization."""
    organization_name: str
    organization_id: str
    licenses: List[LicenseInfo]
    overview: Optional[dict] = None
    error: Optional[str] = None


class UnifiedLicensesResponse(BaseModel):
    """Unified view of licenses across all organizations."""
    organizations: List[OrganizationLicenses]
    total_licenses: int
    total_organizations: int
