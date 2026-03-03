"""Audit logging middleware for automatic request/response logging.

Uses a pure ASGI middleware pattern (not BaseHTTPMiddleware) to avoid
buffering streaming responses.
"""

import logging
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from src.config.database import get_db
from src.models.audit import AuditLog

logger = logging.getLogger(__name__)


class AuditLoggingMiddleware:
    """Pure ASGI middleware that logs API requests to the audit table.

    Unlike BaseHTTPMiddleware, this does NOT buffer response bodies,
    so SSE/streaming endpoints work correctly.
    """

    # Paths to exclude from audit logging (to avoid spam)
    EXCLUDED_PATHS = {
        "/",
        "/api/health",
        "/api/stats",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    # Path prefixes to exclude (high-frequency polling + long-running MCP endpoints)
    EXCLUDED_PREFIXES = (
        "/api/cards/",                  # Card data polling (every 15-30s per card)
        "/api/incidents",               # Dashboard widget polling
        "/api/audit/logs",              # Would cause infinite loop anyway
        "/api/thousandeyes/alerts",     # Dashboard widget polling
        "/api/ai-sessions/active",     # Session status polling
        "/api/splunk/",                 # MCP calls hold subprocesses; avoid extra DB session
        "/api/thousandeyes/",           # MCP calls hold subprocesses; avoid extra DB session
        "/api/network/cache",           # Frequently polled on page loads
    )

    def __init__(self, app: ASGIApp):
        self.app = app
        self.db = get_db()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only process HTTP requests
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)

        # Skip excluded paths
        if request.url.path in self.EXCLUDED_PATHS:
            await self.app(scope, receive, send)
            return

        # Skip excluded prefixes
        if request.url.path.startswith(self.EXCLUDED_PREFIXES):
            await self.app(scope, receive, send)
            return

        # Skip OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # Capture request details
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method

        # Get user from session if available (set by SessionAuthMiddleware)
        user_id = "anonymous"
        if hasattr(request.state, "user") and request.state.user:
            user_id = request.state.user.username

        # Intercept the first response message to capture the status code
        status_code = 500
        error_message = None

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
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
                        request_body=None,
                        response_status=status_code,
                        error_message=error_message,
                        client_ip=client_ip,
                    )
                    session.add(audit_entry)
                    await session.commit()
            except Exception as e:
                logger.error(f"[AUDIT] Failed to log audit entry: {e}")
                # Don't let audit logging failure affect the response
