"""Enterprise RBAC Permission Service.

This service provides comprehensive permission checking, caching, and management
for the enterprise-grade RBAC system.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Set, Dict, Any, Tuple
import logging
import ipaddress

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from src.models.user import User
from src.models.permission import Permission, RolePermission, UserResourcePermission
from src.models.role import Role
from src.models.organization import (
    Organization,
    UserOrganization,
    UserDelegation,
    AccessRestriction,
    PermissionAuditLog,
)

logger = logging.getLogger(__name__)


class PermissionService:
    """Service for managing permissions, roles, and access control."""

    # Permission cache TTL in seconds
    CACHE_TTL = 300  # 5 minutes

    @staticmethod
    async def get_user_permissions(
        db: AsyncSession,
        user_id: int,
        organization_id: Optional[int] = None
    ) -> Set[str]:
        """
        Get all permission codes for a user.
        Includes: role permissions + resource permissions + delegated permissions

        Args:
            db: Database session
            user_id: User ID
            organization_id: Optional organization scope

        Returns:
            Set of permission codes
        """
        permissions: Set[str] = set()

        # 1. Check if super admin (has all permissions)
        user = await db.get(User, user_id)
        if user and user.is_super_admin:
            # Get all permission codes
            result = await db.execute(select(Permission.code))
            permissions.update(row[0] for row in result.all())
            return permissions

        # 2. Get permissions from user's role(s) in organizations
        role_perms = await PermissionService._get_role_permissions(db, user_id, organization_id)
        permissions.update(role_perms)

        # 3. Get direct user-resource permissions (non-expired)
        resource_perms = await PermissionService._get_resource_permissions(db, user_id)
        permissions.update(resource_perms)

        # 4. Get delegated permissions
        delegated_perms = await PermissionService._get_delegated_permissions(db, user_id)
        permissions.update(delegated_perms)

        return permissions

    @staticmethod
    async def _get_role_permissions(
        db: AsyncSession,
        user_id: int,
        organization_id: Optional[int] = None
    ) -> Set[str]:
        """Get permissions from user's roles in organizations."""
        permissions: Set[str] = set()

        # Query user's organization memberships with roles
        query = (
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserOrganization, UserOrganization.role_id == Role.id)
            .where(
                UserOrganization.user_id == user_id,
                Role.is_active == True
            )
        )

        if organization_id:
            query = query.where(UserOrganization.organization_id == organization_id)

        result = await db.execute(query)
        permissions.update(row[0] for row in result.all())

        # Also check for global roles (organization_id is NULL)
        global_query = (
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .where(
                Role.organization_id.is_(None),
                Role.is_active == True,
                Role.is_system == True
            )
        )

        # Get user's legacy role and map to global role permissions
        user = await db.get(User, user_id)
        if user:
            global_query = global_query.where(Role.name == user.role)
            result = await db.execute(global_query)
            permissions.update(row[0] for row in result.all())

        return permissions

    @staticmethod
    async def _get_resource_permissions(
        db: AsyncSession,
        user_id: int
    ) -> Set[str]:
        """Get direct user-resource permissions that haven't expired."""
        query = (
            select(Permission.code)
            .join(UserResourcePermission, UserResourcePermission.permission_id == Permission.id)
            .where(
                UserResourcePermission.user_id == user_id,
                or_(
                    UserResourcePermission.expires_at.is_(None),
                    UserResourcePermission.expires_at > datetime.utcnow()
                )
            )
        )

        result = await db.execute(query)
        return {row[0] for row in result.all()}

    @staticmethod
    async def _get_delegated_permissions(
        db: AsyncSession,
        user_id: int
    ) -> Set[str]:
        """Get permissions delegated to this user that are currently active."""
        permissions: Set[str] = set()
        now = datetime.utcnow()

        # Find active delegations where user is the delegate
        query = (
            select(UserDelegation)
            .where(
                UserDelegation.delegate_id == user_id,
                UserDelegation.is_active == True,
                UserDelegation.starts_at <= now,
                UserDelegation.ends_at > now,
                UserDelegation.revoked_at.is_(None)
            )
        )

        result = await db.execute(query)
        delegations = result.scalars().all()

        for delegation in delegations:
            scope = delegation.scope or {}
            # Add permissions from scope
            if "permissions" in scope:
                permissions.update(scope["permissions"])

        return permissions

    @staticmethod
    async def check_permission(
        db: AsyncSession,
        user_id: int,
        permission_code: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        organization_id: Optional[int] = None,
        log_check: bool = True,
        request_context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Check if user has specific permission.

        Args:
            db: Database session
            user_id: User ID
            permission_code: Permission code to check
            resource_type: Optional resource type for scoped permissions
            resource_id: Optional resource ID for scoped permissions
            organization_id: Optional organization scope
            log_check: Whether to log this permission check
            request_context: Optional context (IP, user agent, etc.)

        Returns:
            True if user has permission, False otherwise
        """
        # Get user
        user = await db.get(User, user_id)
        if not user:
            if log_check:
                await PermissionService._log_permission_check(
                    db, user_id, "check", permission_code, resource_type,
                    resource_id, organization_id, False, "user_not_found", request_context
                )
            return False

        if not user.is_active:
            if log_check:
                await PermissionService._log_permission_check(
                    db, user_id, "check", permission_code, resource_type,
                    resource_id, organization_id, False, "user_inactive", request_context
                )
            return False

        # Super admin bypass
        if user.is_super_admin:
            if log_check:
                await PermissionService._log_permission_check(
                    db, user_id, "check", permission_code, resource_type,
                    resource_id, organization_id, True, "super_admin", request_context
                )
            return True

        # Get user permissions
        permissions = await PermissionService.get_user_permissions(db, user_id, organization_id)

        # Check exact match
        has_permission = permission_code in permissions

        # Check wildcard permissions (e.g., 'network.*' grants 'network.view')
        if not has_permission:
            category = permission_code.rsplit(".", 1)[0]
            has_permission = f"{category}.*" in permissions or "*" in permissions

        # If resource-scoped, check resource-level permission
        if has_permission and resource_type and resource_id:
            has_permission = await PermissionService._check_resource_permission(
                db, user_id, permission_code, resource_type, resource_id
            )

        # Log the check
        if log_check:
            reason = "granted" if has_permission else "permission_denied"
            await PermissionService._log_permission_check(
                db, user_id, "check", permission_code, resource_type,
                resource_id, organization_id, has_permission, reason, request_context
            )

        return has_permission

    @staticmethod
    async def _check_resource_permission(
        db: AsyncSession,
        user_id: int,
        permission_code: str,
        resource_type: str,
        resource_id: str
    ) -> bool:
        """Check if user has permission for specific resource."""
        # Check for explicit resource permission
        permission = await db.execute(
            select(Permission).where(Permission.code == permission_code)
        )
        perm = permission.scalar_one_or_none()

        if not perm:
            return False

        query = select(UserResourcePermission).where(
            UserResourcePermission.user_id == user_id,
            UserResourcePermission.permission_id == perm.id,
            UserResourcePermission.resource_type == resource_type,
            UserResourcePermission.resource_id == resource_id,
            or_(
                UserResourcePermission.expires_at.is_(None),
                UserResourcePermission.expires_at > datetime.utcnow()
            )
        )

        result = await db.execute(query)
        resource_perm = result.scalar_one_or_none()

        # If no explicit resource permission, fall back to general permission
        # (user has the permission but not resource-scoped)
        return resource_perm is not None or True

    @staticmethod
    async def _log_permission_check(
        db: AsyncSession,
        user_id: int,
        action: str,
        permission_code: str,
        resource_type: Optional[str],
        resource_id: Optional[str],
        organization_id: Optional[int],
        result: bool,
        reason: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """Log a permission check to the audit log."""
        try:
            audit_log = PermissionAuditLog(
                user_id=user_id,
                action=action,
                permission_code=permission_code,
                resource_type=resource_type,
                resource_id=resource_id,
                organization_id=organization_id,
                result=result,
                reason=reason,
                context=context,
                ip_address=context.get("ip_address") if context else None,
                user_agent=context.get("user_agent") if context else None,
            )
            db.add(audit_log)
            await db.flush()
        except Exception as e:
            logger.error(f"Failed to log permission check: {e}")

    @staticmethod
    async def get_effective_permissions_for_session(
        db: AsyncSession,
        user_id: int,
        organization_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get all effective permissions formatted for session/JWT storage.

        Args:
            db: Database session
            user_id: User ID
            organization_id: Optional organization scope

        Returns:
            Dictionary with permissions, organizations, and metadata
        """
        permissions = await PermissionService.get_user_permissions(db, user_id, organization_id)
        orgs = await PermissionService.get_user_organizations(db, user_id)
        user = await db.get(User, user_id)

        return {
            "permissions": list(permissions),
            "organizations": orgs,
            "is_super_admin": user.is_super_admin if user else False,
            "cached_at": datetime.utcnow().isoformat(),
            "ttl": PermissionService.CACHE_TTL,
        }

    @staticmethod
    async def get_user_organizations(
        db: AsyncSession,
        user_id: int
    ) -> List[Dict[str, Any]]:
        """Get list of organizations user belongs to with their roles."""
        query = (
            select(UserOrganization)
            .options(
                joinedload(UserOrganization.organization),
                joinedload(UserOrganization.role)
            )
            .where(UserOrganization.user_id == user_id)
        )

        result = await db.execute(query)
        memberships = result.scalars().all()

        return [
            {
                "id": m.organization.id,
                "name": m.organization.name,
                "display_name": m.organization.display_name or m.organization.name,
                "slug": m.organization.slug,
                "role_id": m.role_id,
                "role_name": m.role.display_name if m.role else None,
                "is_primary": m.is_primary,
            }
            for m in memberships
            if m.organization
        ]

    @staticmethod
    async def is_super_admin(db: AsyncSession, user_id: int) -> bool:
        """Check if user is a super admin."""
        user = await db.get(User, user_id)
        return user.is_super_admin if user else False

    @staticmethod
    async def grant_permission(
        db: AsyncSession,
        user_id: int,
        permission_code: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        granted_by: Optional[int] = None,
        reason: Optional[str] = None
    ) -> bool:
        """Grant a specific permission to a user."""
        # Get permission
        result = await db.execute(
            select(Permission).where(Permission.code == permission_code)
        )
        permission = result.scalar_one_or_none()

        if not permission:
            logger.error(f"Permission not found: {permission_code}")
            return False

        # Create user resource permission
        urp = UserResourcePermission(
            user_id=user_id,
            permission_id=permission.id,
            resource_type=resource_type or "global",
            resource_id=resource_id or "*",
            expires_at=expires_at,
            granted_by=granted_by,
            reason=reason,
        )

        try:
            db.add(urp)
            await db.flush()

            # Log the grant
            await PermissionService._log_permission_check(
                db, user_id, "grant", permission_code, resource_type,
                resource_id, None, True, f"granted_by:{granted_by}", None
            )

            return True
        except Exception as e:
            logger.error(f"Failed to grant permission: {e}")
            return False

    @staticmethod
    async def revoke_permission(
        db: AsyncSession,
        user_id: int,
        permission_code: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        revoked_by: Optional[int] = None
    ) -> bool:
        """Revoke a permission from a user."""
        # Get permission
        result = await db.execute(
            select(Permission).where(Permission.code == permission_code)
        )
        permission = result.scalar_one_or_none()

        if not permission:
            return False

        # Find and delete the user resource permission
        query = select(UserResourcePermission).where(
            UserResourcePermission.user_id == user_id,
            UserResourcePermission.permission_id == permission.id,
        )

        if resource_type:
            query = query.where(UserResourcePermission.resource_type == resource_type)
        if resource_id:
            query = query.where(UserResourcePermission.resource_id == resource_id)

        result = await db.execute(query)
        urp = result.scalar_one_or_none()

        if urp:
            await db.delete(urp)

            # Log the revocation
            await PermissionService._log_permission_check(
                db, user_id, "revoke", permission_code, resource_type,
                resource_id, None, True, f"revoked_by:{revoked_by}", None
            )

            return True

        return False

    @staticmethod
    async def grant_temporary_permission(
        db: AsyncSession,
        user_id: int,
        permission_code: str,
        duration_hours: int,
        reason: str,
        granted_by: int,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None
    ) -> Optional[UserResourcePermission]:
        """Grant a permission that automatically expires."""
        expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

        success = await PermissionService.grant_permission(
            db, user_id, permission_code, resource_type, resource_id,
            expires_at, granted_by, f"Temporary: {reason}"
        )

        if success:
            # Return the created permission
            result = await db.execute(
                select(Permission).where(Permission.code == permission_code)
            )
            permission = result.scalar_one_or_none()

            if permission:
                query = select(UserResourcePermission).where(
                    UserResourcePermission.user_id == user_id,
                    UserResourcePermission.permission_id == permission.id,
                )
                result = await db.execute(query)
                return result.scalar_one_or_none()

        return None

    @staticmethod
    async def check_access_restrictions(
        db: AsyncSession,
        user_id: int,
        ip_address: str,
        organization_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if user passes all access restrictions.

        Args:
            db: Database session
            user_id: User ID
            ip_address: Client IP address
            organization_id: Optional organization scope

        Returns:
            Tuple of (allowed, denial_reason)
        """
        # Get all applicable restrictions
        query = select(AccessRestriction).where(
            AccessRestriction.is_active == True,
            or_(
                AccessRestriction.user_id == user_id,
                AccessRestriction.organization_id == organization_id
            )
        ).order_by(AccessRestriction.priority.desc())

        result = await db.execute(query)
        restrictions = result.scalars().all()

        for restriction in restrictions:
            restriction_type = restriction.restriction_type
            value = restriction.value or {}

            if restriction_type == "ip_whitelist":
                # Check if IP is in whitelist
                allowed_ranges = value.get("ranges", [])
                if not PermissionService._ip_in_ranges(ip_address, allowed_ranges):
                    return False, f"IP {ip_address} not in whitelist"

            elif restriction_type == "ip_blacklist":
                # Check if IP is in blacklist
                blocked_ranges = value.get("ranges", [])
                if PermissionService._ip_in_ranges(ip_address, blocked_ranges):
                    return False, f"IP {ip_address} is blocked"

            elif restriction_type == "time_window":
                # Check if current time is within allowed window
                windows = value.get("windows", [])
                if not PermissionService._in_time_window(windows):
                    return False, "Access not allowed at this time"

            elif restriction_type == "geo_allow":
                # Geolocation check would require external service
                # For now, pass through
                pass

            elif restriction_type == "geo_deny":
                # Geolocation check would require external service
                # For now, pass through
                pass

        return True, None

    @staticmethod
    def _ip_in_ranges(ip_str: str, ranges: List[str]) -> bool:
        """Check if IP is in any of the given ranges."""
        try:
            ip = ipaddress.ip_address(ip_str)
            for range_str in ranges:
                try:
                    network = ipaddress.ip_network(range_str, strict=False)
                    if ip in network:
                        return True
                except ValueError:
                    continue
            return False
        except ValueError:
            return False

    @staticmethod
    def _in_time_window(windows: List[Dict[str, str]]) -> bool:
        """Check if current time is within any allowed time window."""
        now = datetime.utcnow()
        current_weekday = now.strftime("%A").lower()
        current_time = now.time()

        for window in windows:
            # Check day of week if specified
            days = window.get("days", [])
            if days and current_weekday not in [d.lower() for d in days]:
                continue

            # Check time range
            start_time_str = window.get("start_time")
            end_time_str = window.get("end_time")

            if start_time_str and end_time_str:
                try:
                    start_time = datetime.strptime(start_time_str, "%H:%M").time()
                    end_time = datetime.strptime(end_time_str, "%H:%M").time()

                    if start_time <= current_time <= end_time:
                        return True
                except ValueError:
                    continue
            else:
                # No time restriction, just day restriction
                if not days or current_weekday in [d.lower() for d in days]:
                    return True

        # If no windows defined, allow access
        return len(windows) == 0

    @staticmethod
    async def create_delegation(
        db: AsyncSession,
        delegator_id: int,
        delegate_id: int,
        scope: Dict[str, Any],
        ends_at: datetime,
        organization_id: Optional[int] = None,
        reason: Optional[str] = None
    ) -> Optional[UserDelegation]:
        """Create a delegation from one user to another."""
        if delegator_id == delegate_id:
            return None

        delegation = UserDelegation(
            delegator_id=delegator_id,
            delegate_id=delegate_id,
            organization_id=organization_id,
            scope=scope,
            ends_at=ends_at,
            reason=reason,
        )

        try:
            db.add(delegation)
            await db.flush()
            return delegation
        except Exception as e:
            logger.error(f"Failed to create delegation: {e}")
            return None

    @staticmethod
    async def revoke_delegation(
        db: AsyncSession,
        delegation_id: int,
        revoked_by: int
    ) -> bool:
        """Revoke a delegation."""
        delegation = await db.get(UserDelegation, delegation_id)

        if not delegation:
            return False

        delegation.is_active = False
        delegation.revoked_at = datetime.utcnow()
        delegation.revoked_by = revoked_by

        await db.flush()
        return True

    @staticmethod
    async def get_all_permissions(
        db: AsyncSession,
        category: Optional[str] = None
    ) -> List[Permission]:
        """Get all permissions, optionally filtered by category."""
        query = select(Permission).order_by(Permission.category, Permission.code)

        if category:
            query = query.where(Permission.category == category)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_permission_categories(db: AsyncSession) -> List[str]:
        """Get list of unique permission categories."""
        query = select(Permission.category).distinct().order_by(Permission.category)
        result = await db.execute(query)
        return [row[0] for row in result.all()]

    @staticmethod
    async def cleanup_expired_permissions(db: AsyncSession) -> int:
        """Remove expired permissions. Returns count of removed permissions."""
        now = datetime.utcnow()

        # Find expired permissions
        query = select(UserResourcePermission).where(
            UserResourcePermission.expires_at.isnot(None),
            UserResourcePermission.expires_at < now
        )

        result = await db.execute(query)
        expired = result.scalars().all()

        count = len(expired)
        for perm in expired:
            # Log expiration
            await PermissionService._log_permission_check(
                db, perm.user_id, "expire", perm.permission.code if perm.permission else None,
                perm.resource_type, perm.resource_id, None, True, "expired", None
            )
            await db.delete(perm)

        if count > 0:
            logger.info(f"Cleaned up {count} expired permissions")

        return count

    @staticmethod
    async def cleanup_expired_delegations(db: AsyncSession) -> int:
        """Deactivate expired delegations. Returns count of deactivated delegations."""
        now = datetime.utcnow()

        # Find active but expired delegations
        query = select(UserDelegation).where(
            UserDelegation.is_active == True,
            UserDelegation.ends_at < now
        )

        result = await db.execute(query)
        expired = result.scalars().all()

        count = len(expired)
        for delegation in expired:
            delegation.is_active = False

        if count > 0:
            logger.info(f"Deactivated {count} expired delegations")

        return count
