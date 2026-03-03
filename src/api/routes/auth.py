"""Authentication and user management API routes."""

import logging
import os
import re
import time
from collections import defaultdict
from datetime import datetime
import traceback
from fastapi import APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from src.api.dependencies import (
    get_db_session,
    get_current_active_user,
    require_admin,
)
from src.models.user import User, UserRole
from src.services.auth_service import AuthService
from src.services.duo_mfa_service import DuoMFAService

logger = logging.getLogger(__name__)
router = APIRouter()


# ===================================================================
# RATE LIMITING FOR BRUTE FORCE PROTECTION
# ===================================================================

class RateLimiter:
    """Rate limiter with Redis backend support for distributed deployments.

    Falls back to in-memory storage if Redis is not configured, but logs a warning
    since in-memory rate limiting can be bypassed in multi-instance deployments.
    """

    # Maximum number of tracked keys before forced eviction (prevents unbounded memory growth)
    MAX_IN_MEMORY_KEYS = 10_000
    # Run cleanup at most once per this interval (seconds)
    CLEANUP_INTERVAL = 60

    def __init__(self, max_attempts: int = 5, window_seconds: int = 300, prefix: str = "ratelimit"):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.prefix = prefix
        self._redis_client = None
        self._redis_checked = False
        # Fallback in-memory storage (NOT recommended for production)
        self.attempts: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup: float = 0.0

    def _get_redis(self):
        """Lazy-load Redis client."""
        if self._redis_checked:
            return self._redis_client

        self._redis_checked = True
        try:
            from src.config.settings import get_settings
            settings = get_settings()
            if settings.redis_url:
                import redis
                self._redis_client = redis.from_url(settings.redis_url, decode_responses=True)
                # Test connection
                self._redis_client.ping()
                logger.info(f"[RateLimiter] Using Redis backend for {self.prefix}")
            else:
                logger.warning(
                    f"[RateLimiter] Redis not configured - using in-memory storage. "
                    "This is NOT recommended for production as rate limits can be bypassed "
                    "in multi-instance deployments. Set REDIS_URL in .env for distributed rate limiting."
                )
        except Exception as e:
            logger.warning(f"[RateLimiter] Redis connection failed, using in-memory fallback: {e}")
            self._redis_client = None

        return self._redis_client

    def _cleanup_stale_keys(self) -> None:
        """Periodically evict expired keys from in-memory storage."""
        now = time.time()
        if now - self._last_cleanup < self.CLEANUP_INTERVAL:
            return
        self._last_cleanup = now

        stale_keys = [
            k for k, timestamps in self.attempts.items()
            if not timestamps or (now - max(timestamps)) >= self.window_seconds
        ]
        for k in stale_keys:
            del self.attempts[k]

        # Hard cap: if still too large, evict oldest keys
        if len(self.attempts) > self.MAX_IN_MEMORY_KEYS:
            sorted_keys = sorted(
                self.attempts.keys(),
                key=lambda k: max(self.attempts[k]) if self.attempts[k] else 0,
            )
            for k in sorted_keys[: len(self.attempts) - self.MAX_IN_MEMORY_KEYS]:
                del self.attempts[k]

    def is_rate_limited(self, key: str) -> bool:
        """Check if a key (IP or username) is rate limited."""
        redis_client = self._get_redis()

        if redis_client:
            try:
                redis_key = f"{self.prefix}:{key}"
                count = redis_client.get(redis_key)
                return int(count or 0) >= self.max_attempts
            except Exception as e:
                logger.error(f"[RateLimiter] Redis error, falling back to in-memory: {e}")

        # Fallback to in-memory
        self._cleanup_stale_keys()
        now = time.time()
        self.attempts[key] = [
            t for t in self.attempts[key]
            if now - t < self.window_seconds
        ]
        return len(self.attempts[key]) >= self.max_attempts

    def record_attempt(self, key: str) -> None:
        """Record a login attempt."""
        redis_client = self._get_redis()

        if redis_client:
            try:
                redis_key = f"{self.prefix}:{key}"
                pipe = redis_client.pipeline()
                pipe.incr(redis_key)
                pipe.expire(redis_key, self.window_seconds)
                pipe.execute()
                return
            except Exception as e:
                logger.error(f"[RateLimiter] Redis error, falling back to in-memory: {e}")

        # Fallback to in-memory
        self.attempts[key].append(time.time())

    def get_remaining_time(self, key: str) -> int:
        """Get seconds until rate limit resets."""
        redis_client = self._get_redis()

        if redis_client:
            try:
                redis_key = f"{self.prefix}:{key}"
                ttl = redis_client.ttl(redis_key)
                return max(0, ttl) if ttl > 0 else 0
            except Exception as e:
                logger.error(f"[RateLimiter] Redis error, falling back to in-memory: {e}")

        # Fallback to in-memory
        if not self.attempts[key]:
            return 0
        oldest = min(self.attempts[key])
        return max(0, int(self.window_seconds - (time.time() - oldest)))

    def clear(self, key: str) -> None:
        """Clear rate limit for a key (e.g., after successful login)."""
        redis_client = self._get_redis()

        if redis_client:
            try:
                redis_key = f"{self.prefix}:{key}"
                redis_client.delete(redis_key)
                return
            except Exception as e:
                logger.error(f"[RateLimiter] Redis error, falling back to in-memory: {e}")

        # Fallback to in-memory
        self.attempts.pop(key, None)


# Rate limiters for IP and username
ip_rate_limiter = RateLimiter(max_attempts=10, window_seconds=300, prefix="ratelimit:ip")  # 10 attempts per 5 min per IP
username_rate_limiter = RateLimiter(max_attempts=5, window_seconds=300, prefix="ratelimit:user")  # 5 attempts per 5 min per username


# ===================================================================
# PASSWORD POLICY
# ===================================================================

def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets security requirements.

    Requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", password):
        return False, "Password must contain at least one special character"
    return True, ""


# ===================================================================
# REQUEST/RESPONSE MODELS
# ===================================================================

class LoginRequest(BaseModel):
    """Login request model."""
    username: str
    password: str


class CreateUserRequest(BaseModel):
    """Create user request model."""
    username: str
    email: EmailStr
    password: str
    role: UserRole
    full_name: Optional[str] = None


class UpdateUserRequest(BaseModel):
    """Update user request model."""
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """User response model."""
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    full_name: Optional[str]
    created_at: str
    updated_at: str
    last_login: Optional[str]


# ===================================================================
# REQUEST/RESPONSE MODELS FOR REGISTRATION
# ===================================================================

class RegisterRequest(BaseModel):
    """Public registration request model."""
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None


# ===================================================================
# AUTHENTICATION ENDPOINTS
# ===================================================================

@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(
    register_request: RegisterRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Public user registration endpoint.

    Creates a new user with the 'viewer' role (limited access).
    Returns a one-time recovery key that must be saved securely.
    For admin or operator access, contact an administrator.

    Args:
        register_request: Registration details

    Returns:
        Created user information and one-time recovery key

    Raises:
        HTTPException 400: If username or email already exists, or password too weak
    """
    # Validate password strength
    is_valid, error_msg = validate_password_strength(register_request.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    try:
        user, recovery_key = await AuthService.create_user(
            db,
            username=register_request.username,
            email=register_request.email,
            password=register_request.password,
            role=UserRole.VIEWER,  # New users always get viewer role
            full_name=register_request.full_name,
            created_by=None,  # Self-registration
        )

        logger.info(f"New user registered: {user.username}")

        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "full_name": user.full_name,
                "created_at": user.created_at.isoformat() if user.created_at else "",
                "updated_at": user.updated_at.isoformat() if user.updated_at else "",
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
            "recovery_key": recovery_key,
            "warning": "IMPORTANT: Save this recovery key in a safe place. It will NOT be shown again. You will need it to recover your account if you forget your password.",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/auth/login")
async def login(
    login_request: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    """Login endpoint with rate limiting protection.

    Args:
        login_request: Login credentials
        request: FastAPI request
        response: FastAPI response
        db: Database session

    Returns:
        User information and sets session cookie

    Raises:
        HTTPException 401: If credentials are invalid
        HTTPException 429: If rate limited
    """
    # Get client IP for rate limiting
    client_ip = request.client.host if request.client else "unknown"
    username = login_request.username

    # Check rate limits
    if ip_rate_limiter.is_rate_limited(client_ip):
        remaining = ip_rate_limiter.get_remaining_time(client_ip)
        logger.warning(f"Rate limit exceeded for IP {client_ip}")
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts. Please try again in {remaining} seconds.",
        )

    if username_rate_limiter.is_rate_limited(username):
        remaining = username_rate_limiter.get_remaining_time(username)
        logger.warning(f"Rate limit exceeded for username {username}")
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts for this account. Please try again in {remaining} seconds.",
        )

    try:
        logger.debug(f"Login attempt for username: {username}")

        # Record attempt before authentication
        ip_rate_limiter.record_attempt(client_ip)
        username_rate_limiter.record_attempt(username)

        # Authenticate user
        user = await AuthService.authenticate_user(
            db,
            username,
            login_request.password,
        )

        if not user:
            logger.warning(f"Failed login attempt for username: {username} from IP: {client_ip}")
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password",
            )

        # Check if MFA is required
        if DuoMFAService.is_enabled() and user.mfa_enabled:
            logger.info(f"MFA required for user: {username}")

            # Check user status in Duo
            preauth = await DuoMFAService.check_user(username)

            if preauth.get("result") == "deny":
                raise HTTPException(status_code=403, detail="User is not allowed to authenticate")

            if preauth.get("result") == "enroll":
                return {
                    "mfa_required": True,
                    "enrollment_required": True,
                    "message": "User must enroll in Duo before logging in",
                }

            # Create MFA challenge
            challenge_id = await DuoMFAService.create_challenge(db, user.id, username)

            return {
                "mfa_required": True,
                "challenge_id": challenge_id,
                "methods": ["push", "passcode"],
                "user_id": user.id,
                "username": username,
            }

        # No MFA required - Create session
        try:
            session = await AuthService.create_session(db, user, request)
        except Exception as e:
            logger.error(f"Failed to create session for user '{username}': {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Failed to create session"
            )

        # Set secure HTTP-only cookie
        # FORCE_SECURE_COOKIES=true is needed behind reverse proxies (e.g. Cloudflare Tunnel)
        # where the backend receives HTTP but the browser is on HTTPS
        force_secure = os.environ.get("FORCE_SECURE_COOKIES", "").lower() in ("true", "1", "yes")
        secure = force_secure or request.url.scheme == "https"
        response.set_cookie(
            key=AuthService.SESSION_COOKIE_NAME,
            value=session.session_token,
            httponly=True,
            secure=secure,
            samesite="lax",
            max_age=AuthService.SESSION_DURATION_HOURS * 3600,
            path="/",
        )

        # Clear rate limits on successful login
        ip_rate_limiter.clear(client_ip)
        username_rate_limiter.clear(username)

        logger.info(f"Successful login for user: {username} from IP: {client_ip}")

        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "full_name": user.full_name,
            },
            "message": "Login successful",
        }
    except HTTPException:
        # Re-raise HTTP exceptions (401, 429)
        raise
    except Exception as e:
        logger.error(f"Login failed with exception for user '{username}': {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Login failed due to an internal error"
        )


@router.post("/api/auth/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    """Logout endpoint.

    Args:
        request: FastAPI request
        response: FastAPI response
        db: Database session

    Returns:
        Success message and clears session cookie
    """
    # Get session token from cookie
    session_token = request.cookies.get(AuthService.SESSION_COOKIE_NAME)

    if session_token:
        # Delete session from database
        await AuthService.delete_session(db, session_token)

    # Clear cookie — match secure flag to login so the browser removes the same cookie.
    force_secure = os.environ.get("FORCE_SECURE_COOKIES", "").lower() in ("true", "1", "yes")
    secure = force_secure or request.url.scheme == "https"
    response.delete_cookie(
        key=AuthService.SESSION_COOKIE_NAME,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )

    return {"message": "Logout successful"}


# ===================================================================
# ACCOUNT RECOVERY ENDPOINTS
# ===================================================================

# Rate limiter for password reset attempts (5 per hour per email)
reset_attempt_limiter = RateLimiter(max_attempts=5, window_seconds=3600, prefix="reset_attempt")


class ResetPasswordRequest(BaseModel):
    """Request model for password reset using recovery key."""
    email: EmailStr
    recovery_key: str
    new_password: str

    @field_validator("recovery_key")
    @classmethod
    def validate_recovery_key(cls, v: str) -> str:
        """Validate recovery key format (32 hex characters)."""
        if not v or len(v) != 32:
            raise ValueError("Invalid recovery key format")
        try:
            int(v, 16)  # Validate it's hex
        except ValueError:
            raise ValueError("Invalid recovery key format")
        return v.lower()


@router.post("/api/auth/reset-password")
async def reset_password(
    request_data: ResetPasswordRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """Reset password using recovery key.

    Uses the one-time recovery key provided at registration.
    Invalidates all existing sessions for security.

    Args:
        request_data: Contains email, recovery_key, and new password
        http_request: HTTP request for rate limiting
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException 400: If recovery key is invalid or password is too weak
        HTTPException 429: If too many failed attempts
    """
    email = request_data.email.lower()
    client_ip = http_request.client.host if http_request.client else "unknown"
    rate_key = f"{client_ip}:{email}"

    # Check rate limit
    if reset_attempt_limiter.is_rate_limited(rate_key):
        remaining = reset_attempt_limiter.get_remaining_time(rate_key)
        logger.warning(f"Password reset rate limit exceeded for: {email}")
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Please try again in {remaining} seconds.",
        )

    # Record attempt before validation
    reset_attempt_limiter.record_attempt(rate_key)

    # Validate password strength
    is_valid, error_msg = validate_password_strength(request_data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Attempt to reset password
    success, message = await AuthService.reset_password_with_recovery_key(
        db,
        email,
        request_data.recovery_key,
        request_data.new_password,
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Clear rate limit on success
    reset_attempt_limiter.clear(rate_key)

    return {"message": "Password reset successful. Please log in with your new password."}


@router.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
):
    """Get current user information.

    Args:
        current_user: Current authenticated user

    Returns:
        Current user information
    """
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        full_name=current_user.full_name,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
        updated_at=current_user.updated_at.isoformat() if current_user.updated_at else "",
        last_login=current_user.last_login.isoformat() if current_user.last_login else None,
    )


# ===================================================================
# USER MANAGEMENT ENDPOINTS (ADMIN ONLY)
# ===================================================================

@router.get("/api/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """List all users (admin only).

    Args:
        current_user: Current admin user
        db: Database session

    Returns:
        List of all users
    """
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    return [
        UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            full_name=user.full_name,
            created_at=user.created_at.isoformat() if user.created_at else "",
            updated_at=user.updated_at.isoformat() if user.updated_at else "",
            last_login=user.last_login.isoformat() if user.last_login else None,
        )
        for user in users
    ]


@router.post("/api/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    user_request: CreateUserRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Create a new user (admin only).

    Returns the user info and a one-time recovery key that must be
    shared securely with the user.

    Args:
        user_request: User creation request
        current_user: Current admin user
        db: Database session

    Returns:
        Created user information and recovery key

    Raises:
        HTTPException 400: If username or email already exists, or password too weak
    """
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_request.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    try:
        user, recovery_key = await AuthService.create_user(
            db,
            username=user_request.username,
            email=user_request.email,
            password=user_request.password,
            role=user_request.role,
            full_name=user_request.full_name,
            created_by=current_user.id,
        )

        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "full_name": user.full_name,
                "created_at": user.created_at.isoformat() if user.created_at else "",
                "updated_at": user.updated_at.isoformat() if user.updated_at else "",
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
            "recovery_key": recovery_key,
            "warning": "IMPORTANT: Share this recovery key securely with the user. It will NOT be shown again.",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Get user by ID (admin only).

    Args:
        user_id: User ID
        current_user: Current admin user
        db: Database session

    Returns:
        User information

    Raises:
        HTTPException 404: If user not found
    """
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        full_name=user.full_name,
        created_at=user.created_at.isoformat() if user.created_at else "",
        updated_at=user.updated_at.isoformat() if user.updated_at else "",
        last_login=user.last_login.isoformat() if user.last_login else None,
    )


@router.patch("/api/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_request: UpdateUserRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Update user (admin only).

    Args:
        user_id: User ID
        update_request: User update request
        current_user: Current admin user
        db: Database session

    Returns:
        Updated user information

    Raises:
        HTTPException 404: If user not found
    """
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate password if being updated
    if update_request.password is not None:
        is_valid, error_msg = validate_password_strength(update_request.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

    # Update fields
    if update_request.email is not None:
        user.email = update_request.email
    if update_request.password is not None:
        user.hashed_password = User.hash_password(update_request.password)
    if update_request.role is not None:
        user.role = update_request.role
    if update_request.full_name is not None:
        user.full_name = update_request.full_name
    if update_request.is_active is not None:
        user.is_active = update_request.is_active

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        full_name=user.full_name,
        created_at=user.created_at.isoformat() if user.created_at else "",
        updated_at=user.updated_at.isoformat() if user.updated_at else "",
        last_login=user.last_login.isoformat() if user.last_login else None,
    )


@router.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Delete user (admin only).

    Args:
        user_id: User ID
        current_user: Current admin user
        db: Database session

    Raises:
        HTTPException 400: If trying to delete yourself
        HTTPException 404: If user not found
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete all user sessions first
    await AuthService.delete_all_user_sessions(db, user_id)

    # Delete user
    await db.delete(user)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
