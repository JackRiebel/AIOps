"""Role management service for RBAC."""

from datetime import datetime
from typing import Optional, List, Dict, Any
import logging

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from src.models.permission import Permission, RolePermission
from src.models.role import Role, RoleChangeRequest
from src.models.organization import Organization, UserOrganization

logger = logging.getLogger(__name__)


class RoleService:
    """Service for managing roles and role hierarchies."""

    @staticmethod
    async def get_role(db: AsyncSession, role_id: int) -> Optional[Role]:
        """Get a role by ID with permissions loaded."""
        query = (
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .where(Role.id == role_id)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_role_by_name(
        db: AsyncSession,
        name: str,
        organization_id: Optional[int] = None
    ) -> Optional[Role]:
        """Get a role by name, optionally within an organization."""
        query = select(Role).where(Role.name == name)

        if organization_id:
            query = query.where(Role.organization_id == organization_id)
        else:
            query = query.where(Role.organization_id.is_(None))

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_roles(
        db: AsyncSession,
        organization_id: Optional[int] = None,
        include_system: bool = True,
        active_only: bool = True
    ) -> List[Role]:
        """
        List all roles, optionally filtered by organization.

        Args:
            db: Database session
            organization_id: Filter by organization (None for global roles)
            include_system: Include system roles
            active_only: Only return active roles

        Returns:
            List of Role objects
        """
        query = (
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .order_by(Role.priority.desc(), Role.name)
        )

        conditions = []

        if organization_id:
            # Include org-specific roles and global system roles
            conditions.append(
                or_(
                    Role.organization_id == organization_id,
                    and_(Role.organization_id.is_(None), Role.is_system == True)
                )
            )
        else:
            # Only global roles
            conditions.append(Role.organization_id.is_(None))

        if not include_system:
            conditions.append(Role.is_system == False)

        if active_only:
            conditions.append(Role.is_active == True)

        if conditions:
            query = query.where(and_(*conditions))

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create_role(
        db: AsyncSession,
        name: str,
        display_name: str,
        description: str,
        permission_codes: List[str],
        organization_id: Optional[int] = None,
        priority: int = 0,
        created_by: Optional[int] = None
    ) -> Optional[Role]:
        """
        Create a new custom role with specified permissions.

        Args:
            db: Database session
            name: Role name (must be unique within org)
            display_name: Human-readable name
            description: Role description
            permission_codes: List of permission codes to assign
            organization_id: Organization this role belongs to (None for global)
            priority: Role priority for hierarchy
            created_by: User ID who created this role

        Returns:
            Created Role object or None on error
        """
        # Check if role name already exists
        existing = await RoleService.get_role_by_name(db, name, organization_id)
        if existing:
            logger.error(f"Role with name '{name}' already exists")
            return None

        # Create the role
        role = Role(
            name=name,
            display_name=display_name,
            description=description,
            organization_id=organization_id,
            priority=priority,
            is_system=False,
            created_by=created_by,
        )

        try:
            db.add(role)
            await db.flush()  # Get the role ID

            # Assign permissions
            await RoleService.set_role_permissions(db, role.id, permission_codes, created_by)

            logger.info(f"Created role '{name}' with {len(permission_codes)} permissions")
            return role

        except Exception as e:
            logger.error(f"Failed to create role: {e}")
            return None

    @staticmethod
    async def update_role(
        db: AsyncSession,
        role_id: int,
        updates: Dict[str, Any],
        updated_by: int
    ) -> Optional[Role]:
        """
        Update role properties (not permissions).

        Args:
            db: Database session
            role_id: Role ID to update
            updates: Dictionary of fields to update
            updated_by: User ID making the update

        Returns:
            Updated Role object or None
        """
        role = await db.get(Role, role_id)

        if not role:
            return None

        # Don't allow modifying system roles (except is_active)
        if role.is_system:
            allowed_fields = {"is_active"}
            updates = {k: v for k, v in updates.items() if k in allowed_fields}

        # Apply updates
        for field, value in updates.items():
            if hasattr(role, field):
                setattr(role, field, value)

        role.updated_at = datetime.utcnow()

        await db.flush()
        return role

    @staticmethod
    async def delete_role(db: AsyncSession, role_id: int) -> bool:
        """
        Delete a custom role.

        System roles cannot be deleted.

        Args:
            db: Database session
            role_id: Role ID to delete

        Returns:
            True if deleted, False otherwise
        """
        role = await db.get(Role, role_id)

        if not role:
            return False

        if role.is_system:
            logger.error(f"Cannot delete system role: {role.name}")
            return False

        # Check if any users are assigned this role
        query = select(UserOrganization).where(UserOrganization.role_id == role_id)
        result = await db.execute(query)
        if result.scalars().first():
            logger.error(f"Cannot delete role '{role.name}': users are still assigned")
            return False

        await db.delete(role)
        logger.info(f"Deleted role '{role.name}'")
        return True

    @staticmethod
    async def set_role_permissions(
        db: AsyncSession,
        role_id: int,
        permission_codes: List[str],
        modified_by: Optional[int] = None
    ) -> bool:
        """
        Replace all permissions for a role.

        Args:
            db: Database session
            role_id: Role ID
            permission_codes: List of permission codes to assign
            modified_by: User ID making the change

        Returns:
            True if successful, False otherwise
        """
        role = await db.get(Role, role_id)
        if not role:
            return False

        # System roles can only be modified by super admins (check should be done at API level)

        try:
            # Delete existing role permissions
            existing_query = select(RolePermission).where(RolePermission.role_id == role_id)
            result = await db.execute(existing_query)
            for rp in result.scalars().all():
                await db.delete(rp)

            # Get permission IDs
            perm_query = select(Permission).where(Permission.code.in_(permission_codes))
            result = await db.execute(perm_query)
            permissions = result.scalars().all()

            # Create new role permissions
            for perm in permissions:
                rp = RolePermission(
                    role_id=role_id,
                    permission_id=perm.id,
                    granted_by=modified_by,
                )
                db.add(rp)

            await db.flush()
            logger.info(f"Set {len(permissions)} permissions for role {role.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to set role permissions: {e}")
            return False

    @staticmethod
    async def add_role_permission(
        db: AsyncSession,
        role_id: int,
        permission_code: str,
        added_by: Optional[int] = None
    ) -> bool:
        """Add a single permission to a role."""
        role = await db.get(Role, role_id)
        if not role:
            return False

        # Get permission
        query = select(Permission).where(Permission.code == permission_code)
        result = await db.execute(query)
        permission = result.scalar_one_or_none()

        if not permission:
            logger.error(f"Permission not found: {permission_code}")
            return False

        # Check if already assigned
        existing_query = select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission.id
        )
        result = await db.execute(existing_query)
        if result.scalar_one_or_none():
            return True  # Already has permission

        # Add permission
        rp = RolePermission(
            role_id=role_id,
            permission_id=permission.id,
            granted_by=added_by,
        )
        db.add(rp)
        await db.flush()

        return True

    @staticmethod
    async def remove_role_permission(
        db: AsyncSession,
        role_id: int,
        permission_code: str,
        removed_by: Optional[int] = None
    ) -> bool:
        """Remove a single permission from a role."""
        role = await db.get(Role, role_id)
        if not role:
            return False

        # Get permission
        query = select(Permission).where(Permission.code == permission_code)
        result = await db.execute(query)
        permission = result.scalar_one_or_none()

        if not permission:
            return False

        # Find and delete role permission
        rp_query = select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission.id
        )
        result = await db.execute(rp_query)
        rp = result.scalar_one_or_none()

        if rp:
            await db.delete(rp)
            return True

        return False

    @staticmethod
    async def clone_role(
        db: AsyncSession,
        source_role_id: int,
        new_name: str,
        new_display_name: Optional[str] = None,
        organization_id: Optional[int] = None,
        created_by: Optional[int] = None
    ) -> Optional[Role]:
        """Clone an existing role with all its permissions."""
        source_role = await RoleService.get_role(db, source_role_id)

        if not source_role:
            return None

        # Get permission codes from source role
        permission_codes = source_role.permission_codes

        # Create new role
        return await RoleService.create_role(
            db,
            name=new_name,
            display_name=new_display_name or f"Copy of {source_role.display_name}",
            description=f"Cloned from {source_role.name}: {source_role.description or ''}",
            permission_codes=permission_codes,
            organization_id=organization_id,
            priority=source_role.priority,
            created_by=created_by,
        )

    @staticmethod
    async def get_role_hierarchy(
        db: AsyncSession,
        organization_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get roles sorted by priority/hierarchy."""
        roles = await RoleService.list_roles(db, organization_id, include_system=True)

        return [
            {
                "id": role.id,
                "name": role.name,
                "display_name": role.display_name,
                "priority": role.priority,
                "is_system": role.is_system,
                "permission_count": len(role.role_permissions),
            }
            for role in sorted(roles, key=lambda r: r.priority, reverse=True)
        ]

    # Role Change Request methods

    @staticmethod
    async def create_role_request(
        db: AsyncSession,
        requester_id: int,
        target_user_id: int,
        requested_role_id: int,
        reason: str,
        organization_id: Optional[int] = None,
        current_role_id: Optional[int] = None
    ) -> Optional[RoleChangeRequest]:
        """Create a role change request."""
        request = RoleChangeRequest(
            requester_id=requester_id,
            target_user_id=target_user_id,
            requested_role_id=requested_role_id,
            reason=reason,
            organization_id=organization_id,
            current_role_id=current_role_id,
        )

        try:
            db.add(request)
            await db.flush()
            return request
        except Exception as e:
            logger.error(f"Failed to create role request: {e}")
            return None

    @staticmethod
    async def list_role_requests(
        db: AsyncSession,
        status: Optional[str] = None,
        organization_id: Optional[int] = None,
        target_user_id: Optional[int] = None
    ) -> List[RoleChangeRequest]:
        """List role change requests with filters."""
        query = (
            select(RoleChangeRequest)
            .options(
                joinedload(RoleChangeRequest.requester),
                joinedload(RoleChangeRequest.target_user),
                joinedload(RoleChangeRequest.requested_role),
                joinedload(RoleChangeRequest.current_role),
            )
            .order_by(RoleChangeRequest.created_at.desc())
        )

        if status:
            query = query.where(RoleChangeRequest.status == status)
        if organization_id:
            query = query.where(RoleChangeRequest.organization_id == organization_id)
        if target_user_id:
            query = query.where(RoleChangeRequest.target_user_id == target_user_id)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def approve_role_request(
        db: AsyncSession,
        request_id: int,
        reviewer_id: int,
        notes: Optional[str] = None
    ) -> bool:
        """Approve a role change request and apply the change."""
        request = await db.get(RoleChangeRequest, request_id)

        if not request or request.status != "pending":
            return False

        # Update request
        request.status = "approved"
        request.reviewer_id = reviewer_id
        request.reviewed_at = datetime.utcnow()
        request.review_notes = notes

        # Apply the role change
        if request.organization_id:
            # Update user organization role
            query = select(UserOrganization).where(
                UserOrganization.user_id == request.target_user_id,
                UserOrganization.organization_id == request.organization_id
            )
            result = await db.execute(query)
            user_org = result.scalar_one_or_none()

            if user_org:
                user_org.role_id = request.requested_role_id
        else:
            # Update user's legacy role field (for global role changes)
            from src.models.user import User
            user = await db.get(User, request.target_user_id)
            if user:
                role = await db.get(Role, request.requested_role_id)
                if role:
                    user.role = role.name

        await db.flush()
        logger.info(f"Approved role request {request_id} for user {request.target_user_id}")
        return True

    @staticmethod
    async def reject_role_request(
        db: AsyncSession,
        request_id: int,
        reviewer_id: int,
        notes: str
    ) -> bool:
        """Reject a role change request."""
        request = await db.get(RoleChangeRequest, request_id)

        if not request or request.status != "pending":
            return False

        request.status = "rejected"
        request.reviewer_id = reviewer_id
        request.reviewed_at = datetime.utcnow()
        request.review_notes = notes

        await db.flush()
        logger.info(f"Rejected role request {request_id}")
        return True

    @staticmethod
    async def assign_user_to_organization(
        db: AsyncSession,
        user_id: int,
        organization_id: int,
        role_id: int,
        is_primary: bool = False,
        invited_by: Optional[int] = None
    ) -> Optional[UserOrganization]:
        """Assign a user to an organization with a specific role."""
        # Check if already a member
        query = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            # Update role
            existing.role_id = role_id
            existing.is_primary = is_primary
            return existing

        # Create new membership
        membership = UserOrganization(
            user_id=user_id,
            organization_id=organization_id,
            role_id=role_id,
            is_primary=is_primary,
            invited_by=invited_by,
        )

        try:
            db.add(membership)

            # If this is primary, unset other primary memberships
            if is_primary:
                update_query = select(UserOrganization).where(
                    UserOrganization.user_id == user_id,
                    UserOrganization.organization_id != organization_id,
                    UserOrganization.is_primary == True
                )
                result = await db.execute(update_query)
                for other in result.scalars().all():
                    other.is_primary = False

            await db.flush()
            return membership

        except Exception as e:
            logger.error(f"Failed to assign user to organization: {e}")
            return None

    @staticmethod
    async def remove_user_from_organization(
        db: AsyncSession,
        user_id: int,
        organization_id: int
    ) -> bool:
        """Remove a user from an organization."""
        query = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id
        )
        result = await db.execute(query)
        membership = result.scalar_one_or_none()

        if membership:
            await db.delete(membership)
            return True

        return False
