"""API routes for Role-Based Access Control (RBAC)."""

import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.dependencies import (
    get_db_session,
    get_current_active_user,
    require_permission,
    require_super_admin,
    require_organization_access,
    get_organization_context,
    get_effective_permissions_response,
)
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
    # User Organization
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
from src.models.permission import Permission, RolePermission, UserResourcePermission
from src.models.role import Role, RoleChangeRequest
from src.models.organization import (
    Organization,
    UserOrganization,
    UserDelegation,
    AccessRestriction,
    PermissionAuditLog,
)
from src.models.user import User
from src.services.permission_service import PermissionService
from src.services.role_service import RoleService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rbac", tags=["RBAC"])


# ===================================================================
# Permission Endpoints
# ===================================================================

@router.get(
    "/permissions",
    response_model=PermissionListResponse,
    dependencies=[Depends(require_permission("rbac.permissions.view"))]
)
async def list_permissions(
    category: Optional[str] = Query(None, description="Filter by category"),
    db: AsyncSession = Depends(get_db_session),
):
    """List all available permissions."""
    query = select(Permission).order_by(Permission.category, Permission.code)

    if category:
        query = query.where(Permission.category == category)

    result = await db.execute(query)
    permissions = result.scalars().all()

    # Get unique categories
    cat_query = select(Permission.category).distinct()
    cat_result = await db.execute(cat_query)
    categories = [c for c in cat_result.scalars().all()]

    return PermissionListResponse(
        permissions=[
            PermissionResponse(
                id=p.id,
                code=p.code,
                name=p.name,
                description=p.description,
                category=p.category,
                resource_type=p.resource_type,
                is_system=p.is_system,
                created_at=p.created_at,
            )
            for p in permissions
        ],
        categories=categories,
        total=len(permissions),
    )


@router.get(
    "/permissions/{permission_id}",
    response_model=PermissionResponse,
    dependencies=[Depends(require_permission("rbac.permissions.view"))]
)
async def get_permission(
    permission_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a specific permission by ID."""
    permission = await db.get(Permission, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    return PermissionResponse(
        id=permission.id,
        code=permission.code,
        name=permission.name,
        description=permission.description,
        category=permission.category,
        resource_type=permission.resource_type,
        is_system=permission.is_system,
        created_at=permission.created_at,
    )


# ===================================================================
# Role Endpoints
# ===================================================================

@router.get(
    "/roles",
    response_model=RoleListResponse,
    dependencies=[Depends(require_permission("rbac.roles.view"))]
)
async def list_roles(
    request: Request,
    organization_id: Optional[int] = Query(None, description="Filter by organization"),
    include_system: bool = Query(True, description="Include system roles"),
    active_only: bool = Query(True, description="Only active roles"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """List all roles."""
    # If no org specified, use context
    if organization_id is None:
        organization_id = await get_organization_context(request, db, current_user)

    roles = await RoleService.list_roles(
        db, organization_id, include_system, active_only
    )

    return RoleListResponse(
        roles=[
            RoleResponse(
                id=r.id,
                name=r.name,
                display_name=r.display_name,
                description=r.description,
                priority=r.priority,
                is_system=r.is_system,
                is_active=r.is_active,
                organization_id=r.organization_id,
                permission_count=len(r.role_permissions),
                permissions=r.permission_codes,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in roles
        ],
        total=len(roles),
    )


@router.get(
    "/roles/hierarchy",
    response_model=List[RoleHierarchyResponse],
    dependencies=[Depends(require_permission("rbac.roles.view"))]
)
async def get_role_hierarchy(
    request: Request,
    organization_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get role hierarchy sorted by priority."""
    if organization_id is None:
        organization_id = await get_organization_context(request, db, current_user)

    hierarchy = await RoleService.get_role_hierarchy(db, organization_id)
    return [RoleHierarchyResponse(**h) for h in hierarchy]


@router.get(
    "/roles/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("rbac.roles.view"))]
)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a specific role by ID."""
    role = await RoleService.get_role(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        organization_id=role.organization_id,
        permission_count=len(role.role_permissions),
        permissions=role.permission_codes,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.post(
    "/roles",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("rbac.roles.manage"))]
)
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new custom role."""
    role = await RoleService.create_role(
        db,
        name=role_data.name,
        display_name=role_data.display_name,
        description=role_data.description,
        permission_codes=role_data.permission_codes,
        organization_id=role_data.organization_id,
        priority=role_data.priority,
        created_by=current_user.id,
    )

    if not role:
        raise HTTPException(status_code=400, detail="Failed to create role")

    await db.commit()

    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        organization_id=role.organization_id,
        permission_count=len(role_data.permission_codes),
        permissions=role_data.permission_codes,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.put(
    "/roles/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("rbac.roles.manage"))]
)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Update a role's properties."""
    updates = role_data.model_dump(exclude_unset=True)
    role = await RoleService.update_role(db, role_id, updates, current_user.id)

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    await db.commit()

    # Refresh to get updated permissions
    role = await RoleService.get_role(db, role_id)

    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        organization_id=role.organization_id,
        permission_count=len(role.role_permissions),
        permissions=role.permission_codes,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.put(
    "/roles/{role_id}/permissions",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("rbac.roles.manage"))]
)
async def update_role_permissions(
    role_id: int,
    perm_data: RolePermissionUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Replace all permissions for a role."""
    success = await RoleService.set_role_permissions(
        db, role_id, perm_data.permission_codes, current_user.id
    )

    if not success:
        raise HTTPException(status_code=400, detail="Failed to update role permissions")

    await db.commit()

    role = await RoleService.get_role(db, role_id)
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        organization_id=role.organization_id,
        permission_count=len(role.role_permissions),
        permissions=role.permission_codes,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.delete(
    "/roles/{role_id}",
    dependencies=[Depends(require_permission("rbac.roles.manage"))]
)
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Delete a custom role."""
    success = await RoleService.delete_role(db, role_id)

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete role. It may be a system role or have users assigned."
        )

    await db.commit()
    return {"message": "Role deleted successfully"}


@router.post(
    "/roles/{role_id}/clone",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("rbac.roles.manage"))]
)
async def clone_role(
    role_id: int,
    new_name: str = Query(..., min_length=1),
    new_display_name: Optional[str] = Query(None),
    organization_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Clone an existing role with all its permissions."""
    role = await RoleService.clone_role(
        db, role_id, new_name, new_display_name, organization_id, current_user.id
    )

    if not role:
        raise HTTPException(status_code=400, detail="Failed to clone role")

    await db.commit()

    role = await RoleService.get_role(db, role.id)
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        priority=role.priority,
        is_system=role.is_system,
        is_active=role.is_active,
        organization_id=role.organization_id,
        permission_count=len(role.role_permissions),
        permissions=role.permission_codes,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


# ===================================================================
# Organization Endpoints
# ===================================================================

@router.get(
    "/organizations",
    response_model=OrganizationListResponse,
    dependencies=[Depends(require_permission("rbac.organizations.view"))]
)
async def list_organizations(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """List all organizations the user has access to."""
    if current_user.is_super_admin:
        # Super admins see all organizations
        query = select(Organization).options(
            selectinload(Organization.user_memberships)
        )
        if active_only:
            query = query.where(Organization.is_active == True)
    else:
        # Regular users see their organizations
        query = (
            select(Organization)
            .join(UserOrganization)
            .where(UserOrganization.user_id == current_user.id)
            .options(selectinload(Organization.user_memberships))
        )
        if active_only:
            query = query.where(Organization.is_active == True)

    result = await db.execute(query)
    organizations = result.scalars().all()

    return OrganizationListResponse(
        organizations=[
            OrganizationResponse(
                id=o.id,
                name=o.name,
                display_name=o.display_name,
                slug=o.slug,
                parent_organization_id=o.parent_organization_id,
                settings=o.settings or {},
                is_active=o.is_active,
                member_count=o.member_count,
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in organizations
        ],
        total=len(organizations),
    )


@router.get(
    "/organizations/{organization_id}",
    response_model=OrganizationResponse,
    dependencies=[Depends(require_organization_access())]
)
async def get_organization(
    organization_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a specific organization."""
    query = (
        select(Organization)
        .where(Organization.id == organization_id)
        .options(selectinload(Organization.user_memberships))
    )
    result = await db.execute(query)
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        display_name=org.display_name,
        slug=org.slug,
        parent_organization_id=org.parent_organization_id,
        settings=org.settings or {},
        is_active=org.is_active,
        member_count=org.member_count,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


@router.post(
    "/organizations",
    response_model=OrganizationResponse,
    dependencies=[Depends(require_super_admin)]
)
async def create_organization(
    org_data: OrganizationCreate,
    db: AsyncSession = Depends(get_db_session),
):
    """Create a new organization (super admin only)."""
    # Check if slug already exists
    existing = await db.execute(
        select(Organization).where(Organization.slug == org_data.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Organization slug already exists")

    org = Organization(
        name=org_data.name,
        display_name=org_data.display_name,
        slug=org_data.slug,
        parent_organization_id=org_data.parent_organization_id,
        settings=org_data.settings,
    )

    db.add(org)
    await db.commit()
    await db.refresh(org)

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        display_name=org.display_name,
        slug=org.slug,
        parent_organization_id=org.parent_organization_id,
        settings=org.settings or {},
        is_active=org.is_active,
        member_count=0,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


@router.put(
    "/organizations/{organization_id}",
    response_model=OrganizationResponse,
    dependencies=[Depends(require_permission("rbac.organizations.manage"))]
)
async def update_organization(
    organization_id: int,
    org_data: OrganizationUpdate,
    db: AsyncSession = Depends(get_db_session),
):
    """Update an organization."""
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    updates = org_data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(org, field, value)

    org.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(org)

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        display_name=org.display_name,
        slug=org.slug,
        parent_organization_id=org.parent_organization_id,
        settings=org.settings or {},
        is_active=org.is_active,
        member_count=org.member_count,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


# ===================================================================
# User Organization Membership Endpoints
# ===================================================================

@router.get(
    "/organizations/{organization_id}/members",
    response_model=List[UserOrganizationResponse],
    dependencies=[Depends(require_organization_access())]
)
async def list_organization_members(
    organization_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """List all members of an organization."""
    query = (
        select(UserOrganization)
        .where(UserOrganization.organization_id == organization_id)
        .options(
            selectinload(UserOrganization.user),
            selectinload(UserOrganization.role),
            selectinload(UserOrganization.organization),
        )
    )
    result = await db.execute(query)
    memberships = result.scalars().all()

    return [
        UserOrganizationResponse(
            id=m.id,
            user_id=m.user_id,
            username=m.user.username if m.user else None,
            organization_id=m.organization_id,
            organization_name=m.organization.name if m.organization else None,
            organization_slug=m.organization.slug if m.organization else None,
            role_id=m.role_id,
            role_name=m.role.display_name if m.role else None,
            is_primary=m.is_primary,
            joined_at=m.joined_at,
        )
        for m in memberships
    ]


@router.post(
    "/organizations/{organization_id}/members",
    response_model=UserOrganizationResponse,
    dependencies=[Depends(require_permission("rbac.organizations.manage"))]
)
async def add_organization_member(
    organization_id: int,
    member_data: UserOrganizationCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Add a user to an organization."""
    membership = await RoleService.assign_user_to_organization(
        db,
        user_id=member_data.user_id,
        organization_id=organization_id,
        role_id=member_data.role_id,
        is_primary=member_data.is_primary,
        invited_by=current_user.id,
    )

    if not membership:
        raise HTTPException(status_code=400, detail="Failed to add member")

    await db.commit()

    # Reload with relationships
    query = (
        select(UserOrganization)
        .where(UserOrganization.id == membership.id)
        .options(
            selectinload(UserOrganization.user),
            selectinload(UserOrganization.role),
            selectinload(UserOrganization.organization),
        )
    )
    result = await db.execute(query)
    m = result.scalar_one()

    return UserOrganizationResponse(
        id=m.id,
        user_id=m.user_id,
        username=m.user.username if m.user else None,
        organization_id=m.organization_id,
        organization_name=m.organization.name if m.organization else None,
        organization_slug=m.organization.slug if m.organization else None,
        role_id=m.role_id,
        role_name=m.role.display_name if m.role else None,
        is_primary=m.is_primary,
        joined_at=m.joined_at,
    )


@router.put(
    "/organizations/{organization_id}/members/{user_id}",
    response_model=UserOrganizationResponse,
    dependencies=[Depends(require_permission("rbac.organizations.manage"))]
)
async def update_organization_member(
    organization_id: int,
    user_id: int,
    member_data: UserOrganizationUpdate,
    db: AsyncSession = Depends(get_db_session),
):
    """Update a user's role or status in an organization."""
    query = select(UserOrganization).where(
        UserOrganization.user_id == user_id,
        UserOrganization.organization_id == organization_id
    )
    result = await db.execute(query)
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    updates = member_data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(membership, field, value)

    await db.commit()

    # Reload with relationships
    query = (
        select(UserOrganization)
        .where(UserOrganization.id == membership.id)
        .options(
            selectinload(UserOrganization.user),
            selectinload(UserOrganization.role),
            selectinload(UserOrganization.organization),
        )
    )
    result = await db.execute(query)
    m = result.scalar_one()

    return UserOrganizationResponse(
        id=m.id,
        user_id=m.user_id,
        username=m.user.username if m.user else None,
        organization_id=m.organization_id,
        organization_name=m.organization.name if m.organization else None,
        organization_slug=m.organization.slug if m.organization else None,
        role_id=m.role_id,
        role_name=m.role.display_name if m.role else None,
        is_primary=m.is_primary,
        joined_at=m.joined_at,
    )


@router.delete(
    "/organizations/{organization_id}/members/{user_id}",
    dependencies=[Depends(require_permission("rbac.organizations.manage"))]
)
async def remove_organization_member(
    organization_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Remove a user from an organization."""
    success = await RoleService.remove_user_from_organization(
        db, user_id, organization_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Membership not found")

    await db.commit()
    return {"message": "Member removed successfully"}


# ===================================================================
# User Permission Endpoints
# ===================================================================

@router.get(
    "/users/{user_id}/permissions",
    response_model=EffectivePermissionsResponse,
    dependencies=[Depends(require_permission("users.view"))]
)
async def get_user_permissions(
    user_id: int,
    organization_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db_session),
):
    """Get effective permissions for a user."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    permissions_data = await PermissionService.get_effective_permissions_for_session(
        db, user_id, organization_id
    )

    return EffectivePermissionsResponse(
        user_id=user_id,
        username=user.username,
        is_super_admin=user.is_super_admin,
        organization_id=organization_id,
        permissions=list(permissions_data.get("permissions", [])),
        role_ids=permissions_data.get("role_ids", []),
        role_names=permissions_data.get("role_names", []),
        direct_permissions=permissions_data.get("direct_permissions", []),
        delegated_permissions=permissions_data.get("delegated_permissions", []),
    )


@router.get(
    "/me/permissions",
    response_model=EffectivePermissionsResponse,
)
async def get_my_permissions(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get effective permissions for the current user."""
    organization_id = await get_organization_context(request, db, current_user)

    permissions_data = await PermissionService.get_effective_permissions_for_session(
        db, current_user.id, organization_id
    )

    return EffectivePermissionsResponse(
        user_id=current_user.id,
        username=current_user.username,
        is_super_admin=current_user.is_super_admin,
        organization_id=organization_id,
        permissions=list(permissions_data.get("permissions", [])),
        role_ids=permissions_data.get("role_ids", []),
        role_names=permissions_data.get("role_names", []),
        direct_permissions=permissions_data.get("direct_permissions", []),
        delegated_permissions=permissions_data.get("delegated_permissions", []),
    )


@router.post(
    "/users/{user_id}/permissions",
    response_model=UserResourcePermissionResponse,
    dependencies=[Depends(require_permission("users.manage_roles"))]
)
async def grant_user_permission(
    user_id: int,
    grant_data: UserPermissionGrant,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Grant a permission directly to a user."""
    if grant_data.expires_at:
        # Use temporary permission
        permission = await PermissionService.grant_temporary_permission(
            db,
            user_id=user_id,
            permission_code=grant_data.permission_code,
            duration_hours=None,  # Use expires_at directly
            resource_type=grant_data.resource_type,
            resource_id=grant_data.resource_id,
            granted_by=current_user.id,
            reason=grant_data.reason,
        )
        # Manually set expires_at since we're not using duration
        if permission:
            permission.expires_at = grant_data.expires_at
    else:
        success = await PermissionService.grant_permission(
            db,
            user_id=user_id,
            permission_code=grant_data.permission_code,
            resource_type=grant_data.resource_type,
            resource_id=grant_data.resource_id,
            granted_by=current_user.id,
            reason=grant_data.reason,
        )
        if not success:
            raise HTTPException(status_code=400, detail="Failed to grant permission")

        # Get the created permission
        query = select(UserResourcePermission).where(
            UserResourcePermission.user_id == user_id,
        ).order_by(UserResourcePermission.granted_at.desc()).limit(1)
        result = await db.execute(query)
        permission = result.scalar_one_or_none()

    if not permission:
        raise HTTPException(status_code=400, detail="Failed to grant permission")

    await db.commit()

    # Get permission code
    perm = await db.get(Permission, permission.permission_id)

    return UserResourcePermissionResponse(
        id=permission.id,
        user_id=permission.user_id,
        permission_id=permission.permission_id,
        permission_code=perm.code if perm else None,
        resource_type=permission.resource_type,
        resource_id=permission.resource_id,
        granted_at=permission.granted_at,
        expires_at=permission.expires_at,
        granted_by=permission.granted_by,
        reason=permission.reason,
        is_expired=permission.is_expired,
    )


@router.delete(
    "/users/{user_id}/permissions",
    dependencies=[Depends(require_permission("users.manage_roles"))]
)
async def revoke_user_permission(
    user_id: int,
    revoke_data: UserPermissionRevoke,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Revoke a permission from a user."""
    success = await PermissionService.revoke_permission(
        db,
        user_id=user_id,
        permission_code=revoke_data.permission_code,
        resource_type=revoke_data.resource_type,
        resource_id=revoke_data.resource_id,
        revoked_by=current_user.id,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Permission not found")

    await db.commit()
    return {"message": "Permission revoked successfully"}


# ===================================================================
# Delegation Endpoints
# ===================================================================

@router.get(
    "/delegations",
    response_model=DelegationListResponse,
    dependencies=[Depends(require_permission("rbac.delegations.view"))]
)
async def list_delegations(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """List all delegations (given and received)."""
    query = (
        select(UserDelegation)
        .where(
            (UserDelegation.delegator_id == current_user.id) |
            (UserDelegation.delegate_id == current_user.id)
        )
        .options(
            selectinload(UserDelegation.delegator),
            selectinload(UserDelegation.delegate),
            selectinload(UserDelegation.organization),
        )
        .order_by(UserDelegation.created_at.desc())
    )

    if active_only:
        query = query.where(UserDelegation.is_active == True)

    result = await db.execute(query)
    delegations = result.scalars().all()

    return DelegationListResponse(
        delegations=[
            DelegationResponse(
                id=d.id,
                delegator_id=d.delegator_id,
                delegator_name=d.delegator.username if d.delegator else None,
                delegate_id=d.delegate_id,
                delegate_name=d.delegate.username if d.delegate else None,
                organization_id=d.organization_id,
                organization_name=d.organization.name if d.organization else None,
                scope=d.scope,
                starts_at=d.starts_at,
                ends_at=d.ends_at,
                reason=d.reason,
                is_active=d.is_active,
                is_effective=d.is_effective,
                is_expired=d.is_expired,
                created_at=d.created_at,
                revoked_at=d.revoked_at,
            )
            for d in delegations
        ],
        total=len(delegations),
    )


@router.post(
    "/delegations",
    response_model=DelegationResponse,
    dependencies=[Depends(require_permission("rbac.delegations.manage"))]
)
async def create_delegation(
    delegation_data: DelegationCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new permission delegation."""
    delegation = await PermissionService.create_delegation(
        db,
        delegator_id=current_user.id,
        delegate_id=delegation_data.delegate_id,
        scope=delegation_data.scope,
        ends_at=delegation_data.ends_at,
        organization_id=delegation_data.organization_id,
        reason=delegation_data.reason,
    )

    if not delegation:
        raise HTTPException(status_code=400, detail="Failed to create delegation")

    await db.commit()

    # Reload with relationships
    query = (
        select(UserDelegation)
        .where(UserDelegation.id == delegation.id)
        .options(
            selectinload(UserDelegation.delegator),
            selectinload(UserDelegation.delegate),
            selectinload(UserDelegation.organization),
        )
    )
    result = await db.execute(query)
    d = result.scalar_one()

    return DelegationResponse(
        id=d.id,
        delegator_id=d.delegator_id,
        delegator_name=d.delegator.username if d.delegator else None,
        delegate_id=d.delegate_id,
        delegate_name=d.delegate.username if d.delegate else None,
        organization_id=d.organization_id,
        organization_name=d.organization.name if d.organization else None,
        scope=d.scope,
        starts_at=d.starts_at,
        ends_at=d.ends_at,
        reason=d.reason,
        is_active=d.is_active,
        is_effective=d.is_effective,
        is_expired=d.is_expired,
        created_at=d.created_at,
        revoked_at=d.revoked_at,
    )


@router.delete(
    "/delegations/{delegation_id}",
    dependencies=[Depends(require_permission("rbac.delegations.manage"))]
)
async def revoke_delegation(
    delegation_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Revoke a delegation."""
    delegation = await db.get(UserDelegation, delegation_id)

    if not delegation:
        raise HTTPException(status_code=404, detail="Delegation not found")

    # Only delegator or super admin can revoke
    if delegation.delegator_id != current_user.id and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Cannot revoke this delegation")

    delegation.is_active = False
    delegation.revoked_at = datetime.utcnow()
    delegation.revoked_by = current_user.id

    await db.commit()
    return {"message": "Delegation revoked successfully"}


# ===================================================================
# Role Change Request Endpoints
# ===================================================================

@router.get(
    "/role-requests",
    response_model=RoleChangeRequestListResponse,
    dependencies=[Depends(require_permission("rbac.requests.view"))]
)
async def list_role_requests(
    status: Optional[str] = Query(None, pattern="^(pending|approved|rejected)$"),
    organization_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db_session),
):
    """List role change requests."""
    requests = await RoleService.list_role_requests(db, status, organization_id)

    pending_count = sum(1 for r in requests if r.status == "pending")

    return RoleChangeRequestListResponse(
        requests=[
            RoleChangeRequestResponse(
                id=r.id,
                requester_id=r.requester_id,
                requester_name=r.requester.username if r.requester else None,
                target_user_id=r.target_user_id,
                target_user_name=r.target_user.username if r.target_user else None,
                current_role_id=r.current_role_id,
                current_role_name=r.current_role.display_name if r.current_role else None,
                requested_role_id=r.requested_role_id,
                requested_role_name=r.requested_role.display_name if r.requested_role else None,
                organization_id=r.organization_id,
                reason=r.reason,
                status=r.status,
                reviewer_id=r.reviewer_id,
                reviewer_name=None,  # Would need to load reviewer relationship
                review_notes=r.review_notes,
                created_at=r.created_at,
                reviewed_at=r.reviewed_at,
            )
            for r in requests
        ],
        total=len(requests),
        pending_count=pending_count,
    )


@router.post(
    "/role-requests",
    response_model=RoleChangeRequestResponse,
)
async def create_role_request(
    request_data: RoleChangeRequestCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Create a role change request."""
    # Get current role for the target user
    current_role_id = None
    if request_data.organization_id:
        query = select(UserOrganization).where(
            UserOrganization.user_id == request_data.target_user_id,
            UserOrganization.organization_id == request_data.organization_id
        )
        result = await db.execute(query)
        membership = result.scalar_one_or_none()
        if membership:
            current_role_id = membership.role_id

    request_obj = await RoleService.create_role_request(
        db,
        requester_id=current_user.id,
        target_user_id=request_data.target_user_id,
        requested_role_id=request_data.requested_role_id,
        reason=request_data.reason,
        organization_id=request_data.organization_id,
        current_role_id=current_role_id,
    )

    if not request_obj:
        raise HTTPException(status_code=400, detail="Failed to create role request")

    await db.commit()

    # Reload with relationships
    requests = await RoleService.list_role_requests(db, target_user_id=request_data.target_user_id)
    r = next((req for req in requests if req.id == request_obj.id), None)

    if not r:
        raise HTTPException(status_code=500, detail="Failed to load created request")

    return RoleChangeRequestResponse(
        id=r.id,
        requester_id=r.requester_id,
        requester_name=r.requester.username if r.requester else None,
        target_user_id=r.target_user_id,
        target_user_name=r.target_user.username if r.target_user else None,
        current_role_id=r.current_role_id,
        current_role_name=r.current_role.display_name if r.current_role else None,
        requested_role_id=r.requested_role_id,
        requested_role_name=r.requested_role.display_name if r.requested_role else None,
        organization_id=r.organization_id,
        reason=r.reason,
        status=r.status,
        reviewer_id=r.reviewer_id,
        reviewer_name=None,
        review_notes=r.review_notes,
        created_at=r.created_at,
        reviewed_at=r.reviewed_at,
    )


@router.post(
    "/role-requests/{request_id}/review",
    response_model=RoleChangeRequestResponse,
    dependencies=[Depends(require_permission("rbac.requests.manage"))]
)
async def review_role_request(
    request_id: int,
    review_data: RoleChangeRequestReview,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Approve or reject a role change request."""
    if review_data.approved:
        success = await RoleService.approve_role_request(
            db, request_id, current_user.id, review_data.notes
        )
    else:
        if not review_data.notes:
            raise HTTPException(
                status_code=400,
                detail="Notes required when rejecting a request"
            )
        success = await RoleService.reject_role_request(
            db, request_id, current_user.id, review_data.notes
        )

    if not success:
        raise HTTPException(status_code=400, detail="Failed to review request")

    await db.commit()

    # Reload the request
    request_obj = await db.get(RoleChangeRequest, request_id)

    return RoleChangeRequestResponse(
        id=request_obj.id,
        requester_id=request_obj.requester_id,
        requester_name=None,
        target_user_id=request_obj.target_user_id,
        target_user_name=None,
        current_role_id=request_obj.current_role_id,
        current_role_name=None,
        requested_role_id=request_obj.requested_role_id,
        requested_role_name=None,
        organization_id=request_obj.organization_id,
        reason=request_obj.reason,
        status=request_obj.status,
        reviewer_id=request_obj.reviewer_id,
        reviewer_name=None,
        review_notes=request_obj.review_notes,
        created_at=request_obj.created_at,
        reviewed_at=request_obj.reviewed_at,
    )


# ===================================================================
# Access Restriction Endpoints
# ===================================================================

@router.get(
    "/restrictions",
    response_model=AccessRestrictionListResponse,
    dependencies=[Depends(require_permission("admin.security.view"))]
)
async def list_access_restrictions(
    user_id: Optional[int] = Query(None),
    organization_id: Optional[int] = Query(None),
    restriction_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db_session),
):
    """List access restrictions."""
    query = select(AccessRestriction).order_by(
        AccessRestriction.priority.desc(),
        AccessRestriction.created_at.desc()
    )

    if user_id:
        query = query.where(AccessRestriction.user_id == user_id)
    if organization_id:
        query = query.where(AccessRestriction.organization_id == organization_id)
    if restriction_type:
        query = query.where(AccessRestriction.restriction_type == restriction_type)
    if active_only:
        query = query.where(AccessRestriction.is_active == True)

    result = await db.execute(query)
    restrictions = result.scalars().all()

    return AccessRestrictionListResponse(
        restrictions=[
            AccessRestrictionResponse(
                id=r.id,
                user_id=r.user_id,
                organization_id=r.organization_id,
                restriction_type=r.restriction_type,
                name=r.name,
                value=r.value,
                is_active=r.is_active,
                priority=r.priority,
                created_at=r.created_at,
                created_by=r.created_by,
            )
            for r in restrictions
        ],
        total=len(restrictions),
    )


@router.post(
    "/restrictions",
    response_model=AccessRestrictionResponse,
    dependencies=[Depends(require_permission("admin.security.manage"))]
)
async def create_access_restriction(
    restriction_data: AccessRestrictionCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Create an access restriction."""
    restriction = AccessRestriction(
        user_id=restriction_data.user_id,
        organization_id=restriction_data.organization_id,
        restriction_type=restriction_data.restriction_type,
        name=restriction_data.name,
        value=restriction_data.value,
        priority=restriction_data.priority,
        created_by=current_user.id,
    )

    db.add(restriction)
    await db.commit()
    await db.refresh(restriction)

    return AccessRestrictionResponse(
        id=restriction.id,
        user_id=restriction.user_id,
        organization_id=restriction.organization_id,
        restriction_type=restriction.restriction_type,
        name=restriction.name,
        value=restriction.value,
        is_active=restriction.is_active,
        priority=restriction.priority,
        created_at=restriction.created_at,
        created_by=restriction.created_by,
    )


@router.put(
    "/restrictions/{restriction_id}",
    response_model=AccessRestrictionResponse,
    dependencies=[Depends(require_permission("admin.security.manage"))]
)
async def update_access_restriction(
    restriction_id: int,
    restriction_data: AccessRestrictionUpdate,
    db: AsyncSession = Depends(get_db_session),
):
    """Update an access restriction."""
    restriction = await db.get(AccessRestriction, restriction_id)
    if not restriction:
        raise HTTPException(status_code=404, detail="Restriction not found")

    updates = restriction_data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(restriction, field, value)

    await db.commit()
    await db.refresh(restriction)

    return AccessRestrictionResponse(
        id=restriction.id,
        user_id=restriction.user_id,
        organization_id=restriction.organization_id,
        restriction_type=restriction.restriction_type,
        name=restriction.name,
        value=restriction.value,
        is_active=restriction.is_active,
        priority=restriction.priority,
        created_at=restriction.created_at,
        created_by=restriction.created_by,
    )


@router.delete(
    "/restrictions/{restriction_id}",
    dependencies=[Depends(require_permission("admin.security.manage"))]
)
async def delete_access_restriction(
    restriction_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """Delete an access restriction."""
    restriction = await db.get(AccessRestriction, restriction_id)
    if not restriction:
        raise HTTPException(status_code=404, detail="Restriction not found")

    await db.delete(restriction)
    await db.commit()

    return {"message": "Restriction deleted successfully"}


# ===================================================================
# Permission Audit Log Endpoints
# ===================================================================

@router.get(
    "/audit",
    response_model=PermissionAuditLogListResponse,
    dependencies=[Depends(require_permission("audit.view"))]
)
async def list_permission_audit_logs(
    user_id: Optional[int] = Query(None),
    permission_code: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    result: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    """List permission audit logs."""
    query = (
        select(PermissionAuditLog)
        .options(selectinload(PermissionAuditLog.user))
        .order_by(PermissionAuditLog.timestamp.desc())
    )

    if user_id:
        query = query.where(PermissionAuditLog.user_id == user_id)
    if permission_code:
        query = query.where(PermissionAuditLog.permission_code == permission_code)
    if action:
        query = query.where(PermissionAuditLog.action == action)
    if result is not None:
        query = query.where(PermissionAuditLog.result == result)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    logs = result.scalars().all()

    return PermissionAuditLogListResponse(
        logs=[
            PermissionAuditLogResponse(
                id=log.id,
                user_id=log.user_id,
                username=log.user.username if log.user else None,
                action=log.action,
                permission_code=log.permission_code,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                organization_id=log.organization_id,
                result=log.result,
                reason=log.reason,
                ip_address=log.ip_address,
                timestamp=log.timestamp,
            )
            for log in logs
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ===================================================================
# Bulk Operation Endpoints
# ===================================================================

@router.post(
    "/bulk/assign-role",
    response_model=BulkOperationResult,
    dependencies=[Depends(require_permission("users.manage_roles"))]
)
async def bulk_assign_role(
    assignment: BulkRoleAssignment,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Assign a role to multiple users."""
    success_count = 0
    failures = []

    for user_id in assignment.user_ids:
        try:
            if assignment.organization_id:
                result = await RoleService.assign_user_to_organization(
                    db,
                    user_id=user_id,
                    organization_id=assignment.organization_id,
                    role_id=assignment.role_id,
                    invited_by=current_user.id,
                )
            else:
                # Update user's global role
                user = await db.get(User, user_id)
                if user:
                    role = await db.get(Role, assignment.role_id)
                    if role:
                        user.role = role.name
                        result = user
                    else:
                        result = None
                else:
                    result = None

            if result:
                success_count += 1
            else:
                failures.append({"user_id": user_id, "error": "Failed to assign role"})
        except Exception as e:
            failures.append({"user_id": user_id, "error": str(e)})

    await db.commit()

    return BulkOperationResult(
        success_count=success_count,
        failure_count=len(failures),
        failures=failures,
    )


@router.post(
    "/bulk/grant-permissions",
    response_model=BulkOperationResult,
    dependencies=[Depends(require_permission("users.manage_roles"))]
)
async def bulk_grant_permissions(
    grant: BulkPermissionGrant,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Grant permissions to multiple users."""
    success_count = 0
    failures = []

    for user_id in grant.user_ids:
        for perm_code in grant.permission_codes:
            try:
                success = await PermissionService.grant_permission(
                    db,
                    user_id=user_id,
                    permission_code=perm_code,
                    resource_type=grant.resource_type,
                    resource_id=grant.resource_id,
                    granted_by=current_user.id,
                )
                if success:
                    success_count += 1
                else:
                    failures.append({
                        "user_id": user_id,
                        "permission": perm_code,
                        "error": "Failed to grant"
                    })
            except Exception as e:
                failures.append({
                    "user_id": user_id,
                    "permission": perm_code,
                    "error": str(e)
                })

    await db.commit()

    return BulkOperationResult(
        success_count=success_count,
        failure_count=len(failures),
        failures=failures,
    )


# ===================================================================
# Maintenance Endpoints
# ===================================================================

@router.post(
    "/maintenance/cleanup-expired",
    dependencies=[Depends(require_super_admin)]
)
async def cleanup_expired_permissions(
    db: AsyncSession = Depends(get_db_session),
):
    """Clean up expired permissions and delegations."""
    expired_permissions = await PermissionService.cleanup_expired_permissions(db)
    expired_delegations = await PermissionService.cleanup_expired_delegations(db)

    await db.commit()

    return {
        "expired_permissions_cleaned": expired_permissions,
        "expired_delegations_cleaned": expired_delegations,
    }
