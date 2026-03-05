"""Session-based authentication middleware for protecting API endpoints.

Uses a pure ASGI middleware pattern (not BaseHTTPMiddleware) to avoid
buffering streaming responses. The DB session is closed immediately
after user validation to prevent connection pool exhaustion during
long-running requests (e.g., MCP subprocess calls).
"""

import logging
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from src.config.database import get_db
from src.services.auth_service import AuthService

logger = logging.getLogger(__name__)


class _AuthenticatedUser:
    """Lightweight user object that survives after DB session is closed.

    Holds only the attributes needed by downstream middleware, RBAC
    dependencies, and route handlers — avoiding SQLAlchemy
    detached-instance errors.
    """
    __slots__ = (
        "id", "username", "email", "is_active", "role",
        "is_super_admin", "primary_organization_id",
        # Profile fields needed by /api/auth/me
        "full_name", "created_at", "updated_at", "last_login",
        # AI/settings fields needed by /api/settings/* routes
        "preferred_model", "ai_temperature", "ai_max_tokens",
        "user_anthropic_api_key", "user_openai_api_key",
        "user_google_api_key", "user_cisco_client_id",
        "user_cisco_client_secret",
    )

    def __init__(self, user):
        self.id = user.id
        self.username = user.username
        self.email = getattr(user, "email", None)
        self.is_active = getattr(user, "is_active", True)
        self.role = getattr(user, "role", "viewer")
        self.is_super_admin = getattr(user, "is_super_admin", False)
        self.primary_organization_id = getattr(user, "primary_organization_id", None)
        # Profile fields
        self.full_name = getattr(user, "full_name", None)
        self.created_at = getattr(user, "created_at", None)
        self.updated_at = getattr(user, "updated_at", None)
        self.last_login = getattr(user, "last_login", None)
        # AI settings
        self.preferred_model = getattr(user, "preferred_model", None)
        self.ai_temperature = getattr(user, "ai_temperature", None)
        self.ai_max_tokens = getattr(user, "ai_max_tokens", None)
        self.user_anthropic_api_key = getattr(user, "user_anthropic_api_key", None)
        self.user_openai_api_key = getattr(user, "user_openai_api_key", None)
        self.user_google_api_key = getattr(user, "user_google_api_key", None)
        self.user_cisco_client_id = getattr(user, "user_cisco_client_id", None)
        self.user_cisco_client_secret = getattr(user, "user_cisco_client_secret", None)

    @property
    def role_enum(self):
        from src.models.user import UserRole
        return UserRole(self.role) if isinstance(self.role, str) else self.role

    def has_permission(self, required_role) -> bool:
        from src.models.user import UserRole
        if not self.is_active:
            return False
        role_hierarchy = [UserRole.VIEWER, UserRole.OPERATOR, UserRole.EDITOR, UserRole.ADMIN]
        try:
            user_level = role_hierarchy.index(self.role_enum)
            required_level = role_hierarchy.index(required_role)
            return user_level >= required_level
        except ValueError:
            return False


class SessionAuthMiddleware:
    """Pure ASGI middleware enforcing session-based authentication.

    Unlike BaseHTTPMiddleware, this does NOT buffer response bodies,
    so SSE/streaming endpoints work correctly.

    The DB session is released immediately after validating the user
    to avoid holding pool connections during long-running requests.
    """

    # Public routes that don't require authentication
    PUBLIC_ROUTES = {
        "/",
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/config",
        "/api/auth/oauth/google",
        "/api/auth/oauth/google/callback",
        "/api/auth/mfa/verify",
        "/api/auth/mfa/challenge",
        "/api/auth/reset-password",
        "/api/health",
        "/api/readiness",  # Public endpoint for startup health checks
        "/api/mcp-monitor/oauth/callback",  # OAuth redirect from external providers (Cloudflare, etc.)
        "/docs",
        "/openapi.json",
        "/redoc",
    }

    # Setup routes are public during first-run (protected by setup service logic)
    SETUP_ROUTES_PREFIX = "/api/setup/"

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only process HTTP requests — pass websocket/lifespan through
        if scope["type"] not in ("http",):
            await self.app(scope, receive, send)
            return

        request = Request(scope)

        # Allow OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # Check if route is public
        if request.url.path in self.PUBLIC_ROUTES:
            await self.app(scope, receive, send)
            return

        # Setup routes are always accessible
        if request.url.path.startswith(self.SETUP_ROUTES_PREFIX):
            await self.app(scope, receive, send)
            return

        # Check for session cookie
        session_token = request.cookies.get(AuthService.SESSION_COOKIE_NAME)

        if not session_token:
            logger.warning(f"Unauthorized access attempt to {request.url.path} - no session cookie")
            response = JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated - no session cookie"},
            )
            await response(scope, receive, send)
            return

        # Validate session and get user — DB session is closed immediately
        # after extracting user info to avoid holding pool connections during
        # long-running requests (MCP subprocess calls can take 5-15 seconds).
        db_instance = get_db()
        async with db_instance.session() as session:
            user = await AuthService.get_user_from_session(session, session_token)

            if not user:
                logger.warning(f"Unauthorized access attempt to {request.url.path} - invalid or expired session")
                response = JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired session"},
                )
                await response(scope, receive, send)
                return

            # Extract user attributes into a lightweight object before closing session
            auth_user = _AuthenticatedUser(user)

        # DB session is now closed — store lightweight user and process request
        request.state.user = auth_user
        logger.debug(f"Authenticated user {auth_user.username} accessing {request.url.path}")
        await self.app(scope, receive, send)
