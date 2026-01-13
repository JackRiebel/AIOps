"""Session-based authentication middleware for protecting API endpoints."""

import logging
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.services.auth_service import AuthService

logger = logging.getLogger(__name__)


class SessionAuthMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce session-based authentication on all API endpoints."""

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
        "/api/health",
        "/docs",
        "/openapi.json",
        "/redoc",
    }

    # Setup routes are public during first-run (protected by setup service logic)
    SETUP_ROUTES_PREFIX = "/api/setup/"

    async def dispatch(self, request: Request, call_next):
        """Process request and enforce authentication.

        Args:
            request: FastAPI request
            call_next: Next middleware/route handler

        Returns:
            Response from route handler or 401 if not authenticated
        """
        # Allow OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Check if route is public
        if request.url.path in self.PUBLIC_ROUTES:
            return await call_next(request)

        # Setup routes are always accessible (security is enforced in the route handlers)
        if request.url.path.startswith(self.SETUP_ROUTES_PREFIX):
            return await call_next(request)

        # Check for session cookie
        session_token = request.cookies.get(AuthService.SESSION_COOKIE_NAME)

        if not session_token:
            logger.warning(f"Unauthorized access attempt to {request.url.path} - no session cookie")
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated - no session cookie"},
            )

        # Validate session and get user
        db_instance = get_db()
        async with db_instance.session() as session:
            user = await AuthService.get_user_from_session(session, session_token)

            if not user:
                logger.warning(f"Unauthorized access attempt to {request.url.path} - invalid or expired session")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired session"},
                )

            # Store user in request state for access by route handlers
            request.state.user = user
            logger.debug(f"Authenticated user {user.username} accessing {request.url.path}")

        # Continue to route handler
        return await call_next(request)
