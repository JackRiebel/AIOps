"""API utility modules."""
from src.api.utils.errors import (
    ErrorCode,
    ErrorResponse,
    APIError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    NotFoundError,
    ExternalAPIError,
    DatabaseError,
    ConfigurationError,
    CredentialsNotFoundError,
    RateLimitError,
    TimeoutError,
    register_error_handlers,
)

__all__ = [
    "ErrorCode",
    "ErrorResponse",
    "APIError",
    "AuthenticationError",
    "AuthorizationError",
    "ValidationError",
    "NotFoundError",
    "ExternalAPIError",
    "DatabaseError",
    "ConfigurationError",
    "CredentialsNotFoundError",
    "RateLimitError",
    "TimeoutError",
    "register_error_handlers",
]
