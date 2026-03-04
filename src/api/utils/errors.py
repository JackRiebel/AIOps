"""Standardized error handling for the Cisco AIOps Hub API.

This module provides:
1. Custom exception classes for different error types
2. Error response models with consistent formatting
3. Global exception handlers for FastAPI
"""
import logging
import traceback
from enum import Enum
from typing import Any, Dict, Optional
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ErrorCode(str, Enum):
    """Standardized error codes for API responses."""

    # Authentication & Authorization (1xxx)
    UNAUTHORIZED = "AUTH_001"
    INVALID_CREDENTIALS = "AUTH_002"
    SESSION_EXPIRED = "AUTH_003"
    INSUFFICIENT_PERMISSIONS = "AUTH_004"
    MFA_REQUIRED = "AUTH_005"

    # Validation errors (2xxx)
    VALIDATION_ERROR = "VAL_001"
    MISSING_REQUIRED_FIELD = "VAL_002"
    INVALID_FORMAT = "VAL_003"
    RESOURCE_NOT_FOUND = "VAL_004"
    DUPLICATE_RESOURCE = "VAL_005"

    # External API errors (3xxx)
    EXTERNAL_API_ERROR = "EXT_001"
    MERAKI_API_ERROR = "EXT_002"
    THOUSANDEYES_API_ERROR = "EXT_003"
    CATALYST_API_ERROR = "EXT_004"
    SPLUNK_API_ERROR = "EXT_005"
    AI_PROVIDER_ERROR = "EXT_006"

    # Database errors (4xxx)
    DATABASE_ERROR = "DB_001"
    CONNECTION_ERROR = "DB_002"
    QUERY_ERROR = "DB_003"
    TRANSACTION_ERROR = "DB_004"

    # Configuration errors (5xxx)
    CONFIGURATION_ERROR = "CFG_001"
    CREDENTIALS_NOT_FOUND = "CFG_002"
    INTEGRATION_NOT_CONFIGURED = "CFG_003"

    # Rate limiting (6xxx)
    RATE_LIMITED = "RATE_001"
    QUOTA_EXCEEDED = "RATE_002"

    # Server errors (9xxx)
    INTERNAL_ERROR = "SRV_001"
    SERVICE_UNAVAILABLE = "SRV_002"
    TIMEOUT_ERROR = "SRV_003"


class ErrorResponse(BaseModel):
    """Standardized error response model."""
    success: bool = False
    error: str  # Human-readable error message
    code: str  # Error code from ErrorCode enum
    details: Optional[Dict[str, Any]] = None  # Additional context
    request_id: Optional[str] = None  # For tracking/debugging


class APIError(Exception):
    """Base exception for API errors."""

    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)

    def to_response(self, request_id: Optional[str] = None) -> ErrorResponse:
        return ErrorResponse(
            error=self.message,
            code=self.code.value,
            details=self.details if self.details else None,
            request_id=request_id
        )


class AuthenticationError(APIError):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Authentication required", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=ErrorCode.UNAUTHORIZED,
            status_code=401,
            details=details
        )


class AuthorizationError(APIError):
    """Raised when user lacks required permissions."""

    def __init__(self, message: str = "Insufficient permissions", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=ErrorCode.INSUFFICIENT_PERMISSIONS,
            status_code=403,
            details=details
        )


class ValidationError(APIError):
    """Raised when request validation fails."""

    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        if field:
            error_details["field"] = field
        super().__init__(
            message=message,
            code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
            details=error_details
        )


class NotFoundError(APIError):
    """Raised when a requested resource is not found."""

    def __init__(self, resource: str, identifier: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        error_details["resource"] = resource
        if identifier:
            error_details["identifier"] = identifier

        message = f"{resource} not found"
        if identifier:
            message = f"{resource} '{identifier}' not found"

        super().__init__(
            message=message,
            code=ErrorCode.RESOURCE_NOT_FOUND,
            status_code=404,
            details=error_details
        )


class ExternalAPIError(APIError):
    """Raised when an external API call fails."""

    def __init__(
        self,
        service: str,
        message: str,
        status_code: int = 502,
        original_status: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        error_details["service"] = service
        if original_status:
            error_details["upstream_status"] = original_status

        # Map service to specific error code
        service_codes = {
            "meraki": ErrorCode.MERAKI_API_ERROR,
            "thousandeyes": ErrorCode.THOUSANDEYES_API_ERROR,
            "catalyst": ErrorCode.CATALYST_API_ERROR,
            "splunk": ErrorCode.SPLUNK_API_ERROR,
            "ai": ErrorCode.AI_PROVIDER_ERROR,
        }
        code = service_codes.get(service.lower(), ErrorCode.EXTERNAL_API_ERROR)

        super().__init__(
            message=f"{service} API error: {message}",
            code=code,
            status_code=status_code,
            details=error_details
        )


class DatabaseError(APIError):
    """Raised when a database operation fails."""

    def __init__(self, message: str = "Database operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=ErrorCode.DATABASE_ERROR,
            status_code=500,
            details=details
        )


class ConfigurationError(APIError):
    """Raised when configuration is missing or invalid."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=ErrorCode.CONFIGURATION_ERROR,
            status_code=500,
            details=details
        )


class CredentialsNotFoundError(APIError):
    """Raised when credentials for a service are not configured."""

    def __init__(self, organization: str, service: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        error_details["organization"] = organization
        if service:
            error_details["service"] = service
            message = f"Credentials for {service} not configured for organization: {organization}"
        else:
            message = f"Credentials not configured for organization: {organization}"

        super().__init__(
            message=message,
            code=ErrorCode.CREDENTIALS_NOT_FOUND,
            status_code=400,
            details=error_details
        )


class RateLimitError(APIError):
    """Raised when rate limit is exceeded."""

    def __init__(self, retry_after: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        if retry_after:
            error_details["retry_after_seconds"] = retry_after

        super().__init__(
            message="Rate limit exceeded. Please try again later.",
            code=ErrorCode.RATE_LIMITED,
            status_code=429,
            details=error_details
        )


class TimeoutError(APIError):
    """Raised when an operation times out."""

    def __init__(self, operation: str, timeout_seconds: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        error_details["operation"] = operation
        if timeout_seconds:
            error_details["timeout_seconds"] = timeout_seconds

        super().__init__(
            message=f"Operation '{operation}' timed out",
            code=ErrorCode.TIMEOUT_ERROR,
            status_code=504,
            details=error_details
        )


def get_request_id(request: Request) -> Optional[str]:
    """Extract request ID from headers or state."""
    return request.headers.get("X-Request-ID") or getattr(request.state, "request_id", None)


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    """Handle custom API errors."""
    request_id = get_request_id(request)

    # Log error with context
    logger.error(
        f"API Error: {exc.code.value} - {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "error_code": exc.code.value,
            "details": exc.details
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response(request_id).model_dump(exclude_none=True)
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Convert FastAPI HTTPExceptions to standardized format."""
    request_id = get_request_id(request)

    # Map HTTP status codes to error codes
    status_to_code = {
        400: ErrorCode.VALIDATION_ERROR,
        401: ErrorCode.UNAUTHORIZED,
        403: ErrorCode.INSUFFICIENT_PERMISSIONS,
        404: ErrorCode.RESOURCE_NOT_FOUND,
        429: ErrorCode.RATE_LIMITED,
        500: ErrorCode.INTERNAL_ERROR,
        502: ErrorCode.EXTERNAL_API_ERROR,
        503: ErrorCode.SERVICE_UNAVAILABLE,
        504: ErrorCode.TIMEOUT_ERROR,
    }

    code = status_to_code.get(exc.status_code, ErrorCode.INTERNAL_ERROR)

    response = ErrorResponse(
        error=str(exc.detail),
        code=code.value,
        request_id=request_id
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=response.model_dump(exclude_none=True)
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    request_id = get_request_id(request)

    # Log full traceback for debugging
    logger.exception(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "traceback": traceback.format_exc()
        }
    )

    # Include error type and message for easier debugging
    error_msg = f"{type(exc).__name__}: {str(exc)}" if str(exc) else "An internal error occurred."
    response = ErrorResponse(
        error=error_msg,
        code=ErrorCode.INTERNAL_ERROR.value,
        request_id=request_id
    )

    return JSONResponse(
        status_code=500,
        content=response.model_dump(exclude_none=True)
    )


def register_error_handlers(app):
    """Register all error handlers with a FastAPI application."""
    from fastapi import HTTPException as FastAPIHTTPException

    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(FastAPIHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
