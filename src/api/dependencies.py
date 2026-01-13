"""Shared dependencies for API routes."""

import uuid
import logging
from datetime import datetime
from functools import wraps
from typing import Optional, Dict, Any, List, Callable, Set

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import meraki
import meraki.aio

from src.config.database import get_db
from src.models.security import SecurityConfig
from src.services.credential_manager import CredentialManager

logger = logging.getLogger(__name__)

# Permission cache key in request state
PERMISSION_CACHE_KEY = "_user_permissions"

# Security
security = HTTPBearer(auto_error=False)

# Singletons
credential_manager = CredentialManager()
startup_time = datetime.utcnow()


async def get_async_dashboard(organization: str) -> meraki.aio.AsyncDashboardAPI:
    """Get async Meraki Dashboard API instance for an organization.

    Args:
        organization: Organization name or ID to get credentials for

    Returns:
        Async Meraki Dashboard API instance

    Raises:
        HTTPException: If credentials not found or invalid
    """
    # First try credential_manager (clusters table)
    credentials = await credential_manager.get_credentials(organization)

    # If not found in clusters, try credential_pool (includes system_config)
    if not credentials:
        try:
            from src.services.credential_pool import get_initialized_pool
            pool = await get_initialized_pool()
            meraki_cred = pool.get_for_meraki(organization_id=organization, organization_name=organization)
            if meraki_cred:
                api_key = meraki_cred.credentials.get("api_key") or meraki_cred.credentials.get("meraki_api_key")
                if api_key:
                    credentials = {
                        "api_key": api_key,
                        "base_url": "https://api.meraki.com/api/v1"
                    }
        except Exception as e:
            logger.warning(f"Error checking credential_pool: {e}")

    if not credentials:
        raise HTTPException(
            status_code=400,
            detail=f"No credentials found for organization: {organization}"
        )

    if "meraki" not in credentials.get("base_url", "").lower():
        raise HTTPException(
            status_code=400,
            detail="Not a valid Meraki organization"
        )

    return meraki.aio.AsyncDashboardAPI(
        api_key=credentials["api_key"],
        base_url=credentials.get("base_url", "https://api.meraki.com/api/v1"),
        suppress_logging=True,
        output_log=False,
        print_console=False,
        maximum_retries=3,
        wait_on_rate_limit=True,
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
):
    """Get current user from JWT token.

    JWT authentication currently disabled - return web-ui user.
    TODO: Implement proper JWT validation when needed.
    """
    return {"user_id": "web-ui"}


async def get_db_session() -> AsyncSession:
    """Dependency to get database session."""
    db = get_db()
    async with db.session() as session:
        yield session


async def get_edit_mode_enabled(db: AsyncSession = Depends(get_db_session)) -> bool:
    """Check if edit mode is enabled."""
    result = await db.execute(select(SecurityConfig).limit(1))
    config = result.scalar_one_or_none()
    return config.edit_mode_enabled if config else False


async def require_edit_mode(db: AsyncSession = Depends(get_db_session)):
    """Require edit mode to be enabled, raise HTTPException if not."""
    if not await get_edit_mode_enabled(db):
        raise HTTPException(
            status_code=423, detail="Edit mode is disabled by administrator"
        )


def get_request_id(request: Request) -> str:
    """Get or generate request ID from headers."""
    return request.headers.get("X-Request-ID", str(uuid.uuid4()))


async def get_meraki_dashboard(organization: str, request: Request):
    """Get Meraki Dashboard API client for an organization."""
    # First try credential_manager (clusters table)
    credentials = await credential_manager.get_credentials(organization)

    # If not found in clusters, try credential_pool (includes system_config)
    if not credentials:
        try:
            from src.services.credential_pool import get_initialized_pool
            pool = await get_initialized_pool()
            meraki_cred = pool.get_for_meraki(organization_id=organization, organization_name=organization)
            if meraki_cred:
                api_key = meraki_cred.credentials.get("api_key") or meraki_cred.credentials.get("meraki_api_key")
                if api_key:
                    credentials = {
                        "api_key": api_key,
                        "base_url": "https://api.meraki.com/api/v1"
                    }
        except Exception as e:
            logger.warning(f"Error checking credential_pool: {e}")

    if not credentials or "meraki" not in credentials.get("base_url", "").lower():
        raise HTTPException(
            status_code=400, detail="Not a valid Meraki organization"
        )

    return meraki.DashboardAPI(
        api_key=credentials["api_key"],
        base_url=credentials["base_url"],
        suppress_logging=True,
        output_log=False,
        caller=f"lumen/{get_request_id(request)}",
    )


# ===================================================================
# FINAL ROBUST CREDENTIAL RESOLVER — WORKS ON PYTHON 3.11
# ===================================================================
async def get_credentials(organization: str) -> Dict[str, Any]:
    """
    Universal credential resolver — works with any current or future
    organization credential format (bearer_token + api_base_url, etc.)
    Also checks system_config via credential_pool for setup wizard credentials.
    """
    raw_creds = None

    # First try credential_manager (clusters table)
    try:
        raw_creds = await credential_manager.get_credentials(organization)
    except Exception as e:
        logger.debug(f"credential_manager lookup failed for {organization}: {e}")

    # If not found, try credential_pool for Splunk credentials from system_config
    if not raw_creds:
        try:
            from src.services.credential_pool import get_initialized_pool
            pool = await get_initialized_pool()

            # Check for Splunk credentials in system_config
            splunk_cred = pool.get_for_splunk()
            if splunk_cred:
                raw_creds = splunk_cred.credentials
                logger.debug(f"Found Splunk credentials in system_config")
        except Exception as e:
            logger.debug(f"credential_pool lookup failed: {e}")

    if not raw_creds:
        logger.warning(f"No credentials found for organization: {organization}")
        raise HTTPException(status_code=400, detail="Credentials not found")

    # Extract token from any possible field
    token = (
        raw_creds.get("api_key") or
        raw_creds.get("bearer_token") or
        raw_creds.get("token") or
        raw_creds.get("splunk_token") or
        ""
    ).strip()

    if not token:
        logger.warning(f"Empty or missing token for organization: {organization}")
        raise HTTPException(status_code=400, detail="Splunk credentials not configured")

    # Extract and clean base_url
    raw_url = (
        raw_creds.get("base_url") or
        raw_creds.get("api_base_url") or
        raw_creds.get("url") or
        "https://localhost:8089"
    ).strip().rstrip("/")

    # Remove /services if accidentally included
    if raw_url.endswith("/services"):
        raw_url = raw_url[:-9]

    # Ensure protocol
    if not raw_url.startswith(("http://", "https://")):
        base_url = "https://" + raw_url.lstrip("/")
    else:
        base_url = raw_url

    # Handle verify_ssl safely
    verify_ssl_raw = raw_creds.get("verify_ssl", False)
    if isinstance(verify_ssl_raw, str):
        verify_ssl = verify_ssl_raw.lower() in ("true", "1", "yes", "on")
    else:
        verify_ssl = bool(verify_ssl_raw)

    final_creds = {
        "api_key": token,
        "base_url": base_url,
        "verify_ssl": verify_ssl,
    }

    logger.debug(f"Splunk credentials resolved → {organization} | {base_url} | verify_ssl={verify_ssl}")
    return final_creds


# ===================================================================
# SESSION-BASED AUTHENTICATION DEPENDENCIES
# ===================================================================

async def get_current_user_from_session(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> "User":
    """Get current authenticated user from session cookie.

    Args:
        request: FastAPI request
        db: Database session

    Returns:
        Current user

    Raises:
        HTTPException 401: If not authenticated
    """
    from src.services.auth_service import AuthService
    from src.models.user import User

    # Get session token from cookie
    session_token = request.cookies.get(AuthService.SESSION_COOKIE_NAME)

    if not session_token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated - no session cookie",
            headers={"WWW-Authenticate": "Cookie"},
        )

    # Get user from session
    user = await AuthService.get_user_from_session(db, session_token)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated - invalid or expired session",
            headers={"WWW-Authenticate": "Cookie"},
        )

    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Optional["User"]:
    """Get current user from session if authenticated, or None if not.

    This is a non-throwing version of get_current_user_from_session
    for endpoints that can work with or without authentication.

    Args:
        request: FastAPI request
        db: Database session

    Returns:
        Current user if authenticated, None otherwise
    """
    from src.services.auth_service import AuthService
    from src.models.user import User

    session_token = request.cookies.get(AuthService.SESSION_COOKIE_NAME)
    if not session_token:
        return None

    user = await AuthService.get_user_from_session(db, session_token)
    return user


async def get_current_active_user(
    current_user: "User" = Depends(get_current_user_from_session),
) -> "User":
    """Get current active user (must be active).

    Args:
        current_user: Current user from session

    Returns:
        Current active user

    Raises:
        HTTPException 403: If user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    return current_user


async def require_role(
    required_role: "UserRole",
    current_user: "User" = Depends(get_current_active_user),
) -> "User":
    """Require user to have a specific role or higher.

    Args:
        required_role: Minimum required role
        current_user: Current active user

    Returns:
        Current user if authorized

    Raises:
        HTTPException 403: If user doesn't have required role
    """
    from src.models.user import UserRole

    if not current_user.has_permission(required_role):
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions - requires {required_role.value} role or higher",
        )

    return current_user


# Convenience dependencies for different role levels
async def require_admin(
    current_user: "User" = Depends(get_current_active_user),
) -> "User":
    """Require admin role."""
    from src.models.user import UserRole
    return await require_role(UserRole.ADMIN, current_user)


async def require_editor(
    current_user: "User" = Depends(get_current_active_user),
) -> "User":
    """Require editor role or higher."""
    from src.models.user import UserRole
    return await require_role(UserRole.EDITOR, current_user)


async def require_operator(
    current_user: "User" = Depends(get_current_active_user),
) -> "User":
    """Require operator role or higher."""
    from src.models.user import UserRole
    return await require_role(UserRole.OPERATOR, current_user)


async def require_viewer(
    current_user: "User" = Depends(get_current_active_user),
) -> "User":
    """Require viewer role or higher (any authenticated user)."""
    from src.models.user import UserRole
    return await require_role(UserRole.VIEWER, current_user)


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Optional["User"]:
    """Get current user if authenticated, None otherwise.

    Unlike require_* dependencies, this does not raise an exception
    if the user is not authenticated. Useful for endpoints that
    behave differently for authenticated vs anonymous users.

    Args:
        request: FastAPI request
        db: Database session

    Returns:
        Current user if authenticated, None otherwise
    """
    from src.services.auth_service import AuthService
    from src.models.user import User

    # Get session token from cookie
    session_token = request.cookies.get(AuthService.SESSION_COOKIE_NAME)

    if not session_token:
        return None

    # Get user from session
    user = await AuthService.get_user_from_session(db, session_token)

    if not user or not user.is_active:
        return None

    return user


# ===================================================================
# PERMISSION-BASED AUTHORIZATION DEPENDENCIES (Enterprise RBAC)
# ===================================================================

async def get_user_permissions(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: "User" = Depends(get_current_active_user),
) -> Set[str]:
    """Get all effective permissions for the current user.

    Caches permissions in request state to avoid repeated DB queries.

    Args:
        request: FastAPI request
        db: Database session
        current_user: Current authenticated user

    Returns:
        Set of permission codes the user has
    """
    from src.services.permission_service import PermissionService

    # Check cache first
    if hasattr(request.state, PERMISSION_CACHE_KEY):
        return request.state._user_permissions

    # Get organization from request (if applicable)
    organization_id = getattr(request.state, "organization_id", None)

    # Fetch permissions
    permissions = await PermissionService.get_user_permissions(
        db, current_user.id, organization_id
    )

    # Cache in request state
    request.state._user_permissions = permissions

    return permissions


async def check_user_permission(
    request: Request,
    db: AsyncSession,
    current_user: "User",
    permission_code: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
) -> bool:
    """Check if a user has a specific permission.

    Args:
        request: FastAPI request
        db: Database session
        current_user: Current user
        permission_code: Permission code to check
        resource_type: Optional resource type for scoped permissions
        resource_id: Optional resource ID for scoped permissions

    Returns:
        True if user has permission, False otherwise
    """
    from src.services.permission_service import PermissionService

    # Super admins bypass all permission checks
    if current_user.is_super_admin:
        return True

    # Get organization context
    organization_id = getattr(request.state, "organization_id", None)

    # Get client IP for access restriction checks
    client_ip = request.client.host if request.client else None

    # Check access restrictions first
    allowed, reason = await PermissionService.check_access_restrictions(
        db, current_user.id, client_ip, organization_id
    )
    if not allowed:
        logger.warning(f"Access denied for user {current_user.id}: {reason}")
        return False

    # Check permission
    return await PermissionService.check_permission(
        db,
        user_id=current_user.id,
        permission_code=permission_code,
        resource_type=resource_type,
        resource_id=resource_id,
        organization_id=organization_id,
        log_check=True,
        request_context={
            "ip_address": client_ip,
            "user_agent": request.headers.get("user-agent"),
            "path": str(request.url.path),
        }
    )


def require_permission(
    permission_code: str,
    resource_type: Optional[str] = None,
    resource_id_param: Optional[str] = None,
):
    """Dependency factory for requiring a specific permission.

    Usage:
        @router.get("/endpoint", dependencies=[Depends(require_permission("network.view"))])

        # With resource scoping (resource_id from path parameter):
        @router.get("/device/{serial}", dependencies=[
            Depends(require_permission("network.devices.view", resource_type="device", resource_id_param="serial"))
        ])

    Args:
        permission_code: Permission code to require
        resource_type: Optional resource type for scoped permissions
        resource_id_param: Optional path parameter name containing resource ID

    Returns:
        FastAPI dependency function
    """
    async def permission_dependency(
        request: Request,
        db: AsyncSession = Depends(get_db_session),
        current_user: "User" = Depends(get_current_active_user),
    ) -> "User":
        # Get resource_id from path params if specified
        resource_id = None
        if resource_id_param:
            resource_id = request.path_params.get(resource_id_param)

        has_permission = await check_user_permission(
            request, db, current_user, permission_code, resource_type, resource_id
        )

        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: requires '{permission_code}'"
            )

        return current_user

    return permission_dependency


def require_any_permission(*permission_codes: str):
    """Dependency factory requiring at least one of the specified permissions.

    Usage:
        @router.get("/endpoint", dependencies=[
            Depends(require_any_permission("incidents.view", "network.view"))
        ])

    Args:
        *permission_codes: Permission codes (any one must match)

    Returns:
        FastAPI dependency function
    """
    async def permission_dependency(
        request: Request,
        db: AsyncSession = Depends(get_db_session),
        current_user: "User" = Depends(get_current_active_user),
    ) -> "User":
        # Super admin bypass
        if current_user.is_super_admin:
            return current_user

        for code in permission_codes:
            has_permission = await check_user_permission(
                request, db, current_user, code
            )
            if has_permission:
                return current_user

        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: requires one of {permission_codes}"
        )

    return permission_dependency


def require_all_permissions(*permission_codes: str):
    """Dependency factory requiring all specified permissions.

    Usage:
        @router.get("/endpoint", dependencies=[
            Depends(require_all_permissions("users.view", "users.manage"))
        ])

    Args:
        *permission_codes: Permission codes (all must match)

    Returns:
        FastAPI dependency function
    """
    async def permission_dependency(
        request: Request,
        db: AsyncSession = Depends(get_db_session),
        current_user: "User" = Depends(get_current_active_user),
    ) -> "User":
        # Super admin bypass
        if current_user.is_super_admin:
            return current_user

        missing_permissions = []
        for code in permission_codes:
            has_permission = await check_user_permission(
                request, db, current_user, code
            )
            if not has_permission:
                missing_permissions.append(code)

        if missing_permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: missing {missing_permissions}"
            )

        return current_user

    return permission_dependency


async def require_super_admin(
    current_user: "User" = Depends(get_current_active_user),
) -> "User":
    """Require super admin privileges.

    Super admins have cross-organization access and bypass all permission checks.

    Args:
        current_user: Current authenticated user

    Returns:
        Current user if super admin

    Raises:
        HTTPException 403: If user is not a super admin
    """
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Super admin privileges required"
        )
    return current_user


async def get_organization_context(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: "User" = Depends(get_current_active_user),
) -> Optional[int]:
    """Get organization context for the current request.

    Determines organization from:
    1. X-Organization-ID header
    2. Path parameter 'organization_id'
    3. User's primary organization

    Args:
        request: FastAPI request
        db: Database session
        current_user: Current user

    Returns:
        Organization ID or None
    """
    from src.models.organization import Organization

    # Check header first
    org_header = request.headers.get("X-Organization-ID")
    if org_header:
        try:
            org_id = int(org_header)
            # Verify user has access to this org
            if await _user_has_org_access(db, current_user, org_id):
                request.state.organization_id = org_id
                return org_id
        except ValueError:
            pass

    # Check path parameter
    org_param = request.path_params.get("organization_id")
    if org_param:
        try:
            org_id = int(org_param)
            if await _user_has_org_access(db, current_user, org_id):
                request.state.organization_id = org_id
                return org_id
        except ValueError:
            pass

    # Fall back to user's primary organization
    if current_user.primary_organization_id:
        request.state.organization_id = current_user.primary_organization_id
        return current_user.primary_organization_id

    return None


async def _user_has_org_access(
    db: AsyncSession,
    user: "User",
    organization_id: int
) -> bool:
    """Check if user has access to an organization.

    Args:
        db: Database session
        user: User to check
        organization_id: Organization ID

    Returns:
        True if user has access
    """
    from src.models.organization import UserOrganization

    # Super admins have access to all organizations
    if user.is_super_admin:
        return True

    # Check if user is a member
    query = select(UserOrganization).where(
        UserOrganization.user_id == user.id,
        UserOrganization.organization_id == organization_id
    )
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


def require_organization_access(allow_super_admin: bool = True):
    """Dependency factory requiring access to the current organization context.

    Usage:
        @router.get("/org/{organization_id}/data", dependencies=[
            Depends(require_organization_access())
        ])

    Args:
        allow_super_admin: Allow super admins to access any organization

    Returns:
        FastAPI dependency function
    """
    async def org_access_dependency(
        request: Request,
        db: AsyncSession = Depends(get_db_session),
        current_user: "User" = Depends(get_current_active_user),
    ) -> int:
        org_id = await get_organization_context(request, db, current_user)

        if org_id is None:
            raise HTTPException(
                status_code=400,
                detail="Organization context required"
            )

        if allow_super_admin and current_user.is_super_admin:
            return org_id

        if not await _user_has_org_access(db, current_user, org_id):
            raise HTTPException(
                status_code=403,
                detail="Access denied to this organization"
            )

        return org_id

    return org_access_dependency


# Convenience permission dependencies for common operations
require_users_view = require_permission("users.view")
require_users_manage = require_permission("users.manage_roles")
require_incidents_view = require_permission("incidents.view")
require_incidents_manage = require_permission("incidents.update")
require_network_view = require_permission("network.view")
require_network_manage = require_permission("network.manage")
require_audit_view = require_permission("audit.view")
require_audit_export = require_permission("audit.export")
require_admin_system = require_permission("admin.system.manage")
require_admin_security = require_permission("admin.security.manage")
require_ai_chat = require_permission("ai.chat")
require_ai_settings = require_permission("ai.settings")


async def get_effective_permissions_response(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: "User" = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Get detailed effective permissions for the current user.

    Useful for frontend permission checking.

    Returns:
        Dictionary with user info and permissions
    """
    from src.services.permission_service import PermissionService

    organization_id = await get_organization_context(request, db, current_user)

    permissions_data = await PermissionService.get_effective_permissions_for_session(
        db, current_user.id, organization_id
    )

    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "is_super_admin": current_user.is_super_admin,
        "organization_id": organization_id,
        **permissions_data
    }