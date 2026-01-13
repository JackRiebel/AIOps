"""API Pydantic models for request/response validation."""

from src.api.models.audit import AuditLogResponse, AuditStatsResponse
from src.api.models.chat import (
    ConversationCreate,
    MessageCreate,
    ConversationResponse,
    MessageResponse,
)
from src.api.models.cluster import ClusterCreate, ClusterUpdate, ClusterResponse
from src.api.models.health import ServiceStatus, SystemHealthResponse, SystemStatsResponse
from src.api.models.incident import IncidentResponse, EventResponse
from src.api.models.license import (
    LicenseInfo,
    OrganizationLicenses,
    UnifiedLicensesResponse,
)
from src.api.models.network import NetworkListRequest, ChatRequest, ChatResponse
from src.api.models.security import SecurityConfigUpdate, EditModeUpdate
from src.api.models.splunk import SplunkSearchRequest, SplunkSearchResponse
from src.api.models.rbac import (
    # Permissions
    PermissionResponse,
    PermissionListResponse,
    # Roles
    RoleCreate,
    RoleUpdate,
    RolePermissionUpdate,
    RoleResponse,
    RoleListResponse,
    RoleHierarchyResponse,
    # Organizations
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListResponse,
    # User Organization Membership
    UserOrganizationCreate,
    UserOrganizationUpdate,
    UserOrganizationResponse,
    # User Permissions
    UserPermissionGrant,
    UserPermissionRevoke,
    UserResourcePermissionResponse,
    EffectivePermissionsResponse,
    # Delegations
    DelegationCreate,
    DelegationResponse,
    DelegationListResponse,
    # Role Change Requests
    RoleChangeRequestCreate,
    RoleChangeRequestReview,
    RoleChangeRequestResponse,
    RoleChangeRequestListResponse,
    # Access Restrictions
    AccessRestrictionCreate,
    AccessRestrictionUpdate,
    AccessRestrictionResponse,
    AccessRestrictionListResponse,
    # Audit
    PermissionAuditLogResponse,
    PermissionAuditLogListResponse,
    # Bulk Operations
    BulkRoleAssignment,
    BulkPermissionGrant,
    BulkOperationResult,
)

__all__ = [
    # Audit
    "AuditLogResponse",
    "AuditStatsResponse",
    # Chat
    "ConversationCreate",
    "MessageCreate",
    "ConversationResponse",
    "MessageResponse",
    # Cluster
    "ClusterCreate",
    "ClusterUpdate",
    "ClusterResponse",
    # Health
    "ServiceStatus",
    "SystemHealthResponse",
    "SystemStatsResponse",
    # Incident
    "IncidentResponse",
    "EventResponse",
    # License
    "LicenseInfo",
    "OrganizationLicenses",
    "UnifiedLicensesResponse",
    # Network
    "NetworkListRequest",
    "ChatRequest",
    "ChatResponse",
    # Security
    "SecurityConfigUpdate",
    "EditModeUpdate",
    # Splunk
    "SplunkSearchRequest",
    "SplunkSearchResponse",
    # RBAC - Permissions
    "PermissionResponse",
    "PermissionListResponse",
    # RBAC - Roles
    "RoleCreate",
    "RoleUpdate",
    "RolePermissionUpdate",
    "RoleResponse",
    "RoleListResponse",
    "RoleHierarchyResponse",
    # RBAC - Organizations
    "OrganizationCreate",
    "OrganizationUpdate",
    "OrganizationResponse",
    "OrganizationListResponse",
    # RBAC - User Organization
    "UserOrganizationCreate",
    "UserOrganizationUpdate",
    "UserOrganizationResponse",
    # RBAC - User Permissions
    "UserPermissionGrant",
    "UserPermissionRevoke",
    "UserResourcePermissionResponse",
    "EffectivePermissionsResponse",
    # RBAC - Delegations
    "DelegationCreate",
    "DelegationResponse",
    "DelegationListResponse",
    # RBAC - Role Change Requests
    "RoleChangeRequestCreate",
    "RoleChangeRequestReview",
    "RoleChangeRequestResponse",
    "RoleChangeRequestListResponse",
    # RBAC - Access Restrictions
    "AccessRestrictionCreate",
    "AccessRestrictionUpdate",
    "AccessRestrictionResponse",
    "AccessRestrictionListResponse",
    # RBAC - Permission Audit
    "PermissionAuditLogResponse",
    "PermissionAuditLogListResponse",
    # RBAC - Bulk Operations
    "BulkRoleAssignment",
    "BulkPermissionGrant",
    "BulkOperationResult",
]
