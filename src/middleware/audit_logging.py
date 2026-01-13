"""Audit logging middleware for automatic request/response logging."""

import json
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from src.config.database import get_db
from src.models.audit import AuditLog
from src.api.dependencies import get_request_id

logger = logging.getLogger(__name__)

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to automatically log all API requests to the audit log."""

    # Paths to exclude from audit logging (to avoid spam)
    EXCLUDED_PATHS = {
        "/",
        "/api/health",
        "/api/stats",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    # Path prefixes to exclude (high-frequency polling endpoints)
    EXCLUDED_PREFIXES = (
        "/api/cards/",           # Card data polling (every 15-30s per card)
        "/api/incidents",        # Dashboard widget polling
        "/api/audit/logs",       # Would cause infinite loop anyway
        "/api/thousandeyes/alerts",  # Dashboard widget polling
        "/api/ai-sessions/active",   # Session status polling
    )

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.db = get_db()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log to audit table."""

        # Skip audit logging for excluded paths
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)

        # Skip audit logging for excluded prefixes (high-frequency polling)
        if request.url.path.startswith(self.EXCLUDED_PREFIXES):
            return await call_next(request)

        # Skip OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Capture request details
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method

        # Get user from session if available
        user_id = "anonymous"
        if hasattr(request.state, "user") and request.state.user:
            user_id = request.state.user.username

        # Note: We skip capturing request body in middleware to avoid consuming the stream
        # Route handlers need to be able to read the body themselves
        request_body = None

        # Process the request
        response = None
        error_message = None
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            error_message = str(e)
            logger.error(f"Request failed: {method} {path} - {e}")
            raise
        finally:
            # Log to audit table
            try:
                async with self.db.session() as session:
                    audit_entry = AuditLog(
                        cluster_id=None,
                        user_id=user_id,
                        operation_id=path.split("/")[-1] or "root",
                        http_method=method,
                        path=path,
                        request_body=request_body,
                        response_status=status_code,
                        error_message=error_message,
                        client_ip=client_ip,
                    )
                    session.add(audit_entry)
                    await session.commit()
            except Exception as e:
                logger.error(f"[AUDIT] Failed to log audit entry: {e}")
                logger.error(f"[AUDIT] Full traceback:", exc_info=True)
                # Don't let audit logging failure affect the response

        return response
