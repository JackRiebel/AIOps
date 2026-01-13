"""RBAC API Pydantic models for request/response validation."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ===================================================================
# Permission Models
# ===================================================================

class PermissionBase(BaseModel):
    """Base permission schema."""
    code: str
    name: str
    description: Optional[str] = None
    category: str
    resource_type: Optional[str] = None


class PermissionResponse(PermissionBase):
    """Permission response schema."""
    id: int
    is_system: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PermissionListResponse(BaseModel):
    """Response for listing permissions."""
    permissions: List[PermissionResponse]
    categories: List[str]
    total: int


# ===================================================================
# Role Models
# ===================================================================

class RoleBase(BaseModel):
    """Base role schema."""
    name: str = Field(..., min_length=1, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    priority: int = Field(default=0, ge=0, le=1000)


class RoleCreate(RoleBase):
    """Role creation schema."""
    permission_codes: List[str] = Field(default_factory=list)
    organization_id: Optional[int] = None


class RoleUpdate(BaseModel):
    """Role update schema."""
    display_name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class RolePermissionUpdate(BaseModel):
    """Schema for updating role permissions."""
    permission_codes: List[str]


class RoleResponse(RoleBase):
    """Role response schema."""
    id: int
    is_system: bool
    is_active: bool
    organization_id: Optional[int] = None
    permission_count: int = 0
    permissions: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RoleListResponse(BaseModel):
    """Response for listing roles."""
    roles: List[RoleResponse]
    total: int


class RoleHierarchyResponse(BaseModel):
    """Response for role hierarchy."""
    id: int
    name: str
    display_name: str
    priority: int
    is_system: bool
    permission_count: int


# ===================================================================
# Organization Models
# ===================================================================

class OrganizationBase(BaseModel):
    """Base organization schema."""
    name: str = Field(..., min_length=1, max_length=255)
    display_name: Optional[str] = None
    slug: str = Field(..., min_length=1, max_length=100, pattern=r'^[a-z0-9-]+$')


class OrganizationCreate(OrganizationBase):
    """Organization creation schema."""
    parent_organization_id: Optional[int] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


class OrganizationUpdate(BaseModel):
    """Organization update schema."""
    display_name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class OrganizationResponse(OrganizationBase):
    """Organization response schema."""
    id: int
    parent_organization_id: Optional[int] = None
    settings: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool
    member_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrganizationListResponse(BaseModel):
    """Response for listing organizations."""
    organizations: List[OrganizationResponse]
    total: int


# ===================================================================
# User Organization Membership Models
# ===================================================================

class UserOrganizationBase(BaseModel):
    """Base user organization membership schema."""
    user_id: int
    organization_id: int
    role_id: int
    is_primary: bool = False


class UserOrganizationCreate(UserOrganizationBase):
    """User organization membership creation schema."""
    pass


class UserOrganizationUpdate(BaseModel):
    """User organization membership update schema."""
    role_id: Optional[int] = None
    is_primary: Optional[bool] = None


class UserOrganizationResponse(BaseModel):
    """User organization membership response schema."""
    id: int
    user_id: int
    username: Optional[str] = None
    organization_id: int
    organization_name: Optional[str] = None
    organization_slug: Optional[str] = None
    role_id: int
    role_name: Optional[str] = None
    is_primary: bool
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===================================================================
# User Permission Models
# ===================================================================

class UserPermissionGrant(BaseModel):
    """Schema for granting a permission to a user."""
    permission_code: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    expires_at: Optional[datetime] = None
    reason: Optional[str] = None


class UserPermissionRevoke(BaseModel):
    """Schema for revoking a permission from a user."""
    permission_code: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None


class UserResourcePermissionResponse(BaseModel):
    """User resource permission response schema."""
    id: int
    user_id: int
    permission_id: int
    permission_code: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    granted_at: datetime
    expires_at: Optional[datetime] = None
    granted_by: Optional[int] = None
    reason: Optional[str] = None
    is_expired: bool = False

    class Config:
        from_attributes = True


class EffectivePermissionsResponse(BaseModel):
    """Response for user's effective permissions."""
    user_id: int
    username: str
    is_super_admin: bool
    organization_id: Optional[int] = None
    permissions: List[str]
    role_ids: List[int]
    role_names: List[str]
    direct_permissions: List[str]
    delegated_permissions: List[str]


# ===================================================================
# Delegation Models
# ===================================================================

class DelegationCreate(BaseModel):
    """Schema for creating a permission delegation."""
    delegate_id: int = Field(..., description="User ID to delegate permissions to")
    organization_id: Optional[int] = None
    scope: Dict[str, Any] = Field(..., description="Permissions and resources to delegate")
    ends_at: datetime = Field(..., description="When the delegation expires")
    reason: Optional[str] = None


class DelegationResponse(BaseModel):
    """Delegation response schema."""
    id: int
    delegator_id: int
    delegator_name: Optional[str] = None
    delegate_id: int
    delegate_name: Optional[str] = None
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    scope: Dict[str, Any]
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = None
    is_active: bool
    is_effective: bool
    is_expired: bool
    created_at: datetime
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DelegationListResponse(BaseModel):
    """Response for listing delegations."""
    delegations: List[DelegationResponse]
    total: int


# ===================================================================
# Role Change Request Models
# ===================================================================

class RoleChangeRequestCreate(BaseModel):
    """Schema for creating a role change request."""
    target_user_id: int
    requested_role_id: int
    reason: str = Field(..., min_length=10, max_length=1000)
    organization_id: Optional[int] = None


class RoleChangeRequestReview(BaseModel):
    """Schema for reviewing a role change request."""
    approved: bool
    notes: Optional[str] = None


class RoleChangeRequestResponse(BaseModel):
    """Role change request response schema."""
    id: int
    requester_id: int
    requester_name: Optional[str] = None
    target_user_id: int
    target_user_name: Optional[str] = None
    current_role_id: Optional[int] = None
    current_role_name: Optional[str] = None
    requested_role_id: int
    requested_role_name: Optional[str] = None
    organization_id: Optional[int] = None
    reason: str
    status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_notes: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RoleChangeRequestListResponse(BaseModel):
    """Response for listing role change requests."""
    requests: List[RoleChangeRequestResponse]
    total: int
    pending_count: int


# ===================================================================
# Access Restriction Models
# ===================================================================

class AccessRestrictionBase(BaseModel):
    """Base access restriction schema."""
    restriction_type: str = Field(..., pattern=r'^(ip_whitelist|ip_blacklist|geo_allow|geo_deny|time_window)$')
    name: Optional[str] = None
    value: Dict[str, Any]
    priority: int = Field(default=0, ge=0)


class AccessRestrictionCreate(AccessRestrictionBase):
    """Access restriction creation schema."""
    user_id: Optional[int] = None
    organization_id: Optional[int] = None


class AccessRestrictionUpdate(BaseModel):
    """Access restriction update schema."""
    name: Optional[str] = None
    value: Optional[Dict[str, Any]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class AccessRestrictionResponse(AccessRestrictionBase):
    """Access restriction response schema."""
    id: int
    user_id: Optional[int] = None
    organization_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


class AccessRestrictionListResponse(BaseModel):
    """Response for listing access restrictions."""
    restrictions: List[AccessRestrictionResponse]
    total: int


# ===================================================================
# Permission Audit Log Models
# ===================================================================

class PermissionAuditLogResponse(BaseModel):
    """Permission audit log response schema."""
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    permission_code: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    organization_id: Optional[int] = None
    result: Optional[bool] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class PermissionAuditLogListResponse(BaseModel):
    """Response for listing permission audit logs."""
    logs: List[PermissionAuditLogResponse]
    total: int
    page: int
    page_size: int


# ===================================================================
# Bulk Operation Models
# ===================================================================

class BulkRoleAssignment(BaseModel):
    """Schema for bulk role assignment."""
    user_ids: List[int]
    role_id: int
    organization_id: Optional[int] = None


class BulkPermissionGrant(BaseModel):
    """Schema for bulk permission grant."""
    user_ids: List[int]
    permission_codes: List[str]
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    expires_at: Optional[datetime] = None


class BulkOperationResult(BaseModel):
    """Result of a bulk operation."""
    success_count: int
    failure_count: int
    failures: List[Dict[str, Any]] = Field(default_factory=list)
