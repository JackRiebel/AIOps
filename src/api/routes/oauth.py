"""OAuth 2.0 and MFA authentication API routes."""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from src.api.dependencies import get_db_session, get_current_active_user
from src.models.user import User
from src.services.auth_service import AuthService
from src.services.oauth_service import OAuthService
from src.services.duo_mfa_service import DuoMFAService
from src.config.settings import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ===================================================================
# REQUEST/RESPONSE MODELS
# ===================================================================

class MFAVerifyRequest(BaseModel):
    """MFA verification request."""
    challenge_id: str
    method: str  # 'push', 'passcode'
    passcode: Optional[str] = None


class AuthConfigResponse(BaseModel):
    """Authentication configuration response."""
    oauth_enabled: bool
    oauth_providers: list[str]
    mfa_enabled: bool
    mfa_provider: Optional[str]


# ===================================================================
# AUTH CONFIGURATION
# ===================================================================

@router.get("/api/auth/config", response_model=AuthConfigResponse)
async def get_auth_config():
    """Get authentication configuration for the login page.

    Returns what auth methods are available.
    """
    oauth_providers = []
    if OAuthService.is_configured():
        oauth_providers.append("google")

    return AuthConfigResponse(
        oauth_enabled=OAuthService.is_configured(),
        oauth_providers=oauth_providers,
        mfa_enabled=DuoMFAService.is_enabled(),
        mfa_provider="duo" if DuoMFAService.is_configured() else None,
    )


# ===================================================================
# GOOGLE OAUTH ENDPOINTS
# ===================================================================

@router.get("/api/auth/oauth/google")
async def google_oauth_login(
    redirect_after: str = Query(default="/", description="URL to redirect after login"),
):
    """Initiate Google OAuth login flow.

    Redirects user to Google's OAuth consent page.
    """
    if not OAuthService.is_configured():
        raise HTTPException(
            status_code=501,
            detail="Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
        )

    try:
        auth_url, state = OAuthService.get_authorization_url(redirect_after)
        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as e:
        logger.error(f"OAuth login failed: {e}")
        raise HTTPException(status_code=500, detail="OAuth login failed")


@router.get("/api/auth/oauth/google/callback")
async def google_oauth_callback(
    request: Request,
    response: Response,
    code: Optional[str] = Query(default=None, description="Authorization code from Google"),
    state: Optional[str] = Query(default=None, description="State token for CSRF validation"),
    error: Optional[str] = Query(default=None, description="Error from Google OAuth"),
    db: AsyncSession = Depends(get_db_session),
):
    """Handle Google OAuth callback.

    Exchanges code for tokens and creates/updates user.
    """
    settings = get_settings()
    frontend_url = "https://localhost:3000" if not settings.is_production else ""

    # Handle OAuth errors (user denied, etc.)
    if error:
        logger.warning(f"OAuth error from Google: {error}")
        return RedirectResponse(
            url=f"{frontend_url}/login?error={error}",
            status_code=302,
        )

    # Validate required parameters
    if not code or not state:
        return RedirectResponse(
            url=f"{frontend_url}/login?error=missing_params",
            status_code=302,
        )

    # Validate state token
    state_data = OAuthService.validate_state(state)
    if not state_data:
        return RedirectResponse(
            url=f"{frontend_url}/login?error=invalid_state",
            status_code=302,
        )

    redirect_after = state_data.get("redirect_after", "/")
    code_verifier = state_data.get("code_verifier")  # PKCE code verifier

    try:
        # Exchange code for tokens (with PKCE code_verifier for security)
        tokens = await OAuthService.exchange_code_for_tokens(code, code_verifier)

        # Get user info from Google
        user_info = await OAuthService.get_user_info(tokens.get("access_token"))

        # Find existing user (will NOT auto-create new users)
        try:
            user = await OAuthService.find_or_create_user(db, user_info, tokens)
        except ValueError as e:
            # User doesn't exist - redirect with error
            logger.warning(f"OAuth rejected: {e}")
            error_msg = "no_account"
            return RedirectResponse(
                url=f"{frontend_url}/login?error={error_msg}",
                status_code=302,
            )

        # Check if MFA is required
        if DuoMFAService.is_enabled() and user.mfa_enabled:
            # Create MFA challenge
            challenge_id = DuoMFAService.create_challenge(user.id, user.username)

            # Redirect to MFA page with challenge
            return RedirectResponse(
                url=f"{frontend_url}/login?mfa_required=true&challenge_id={challenge_id}",
                status_code=302,
            )

        # Create session
        session = await AuthService.create_session(db, user, request)

        # Set session cookie
        response = RedirectResponse(
            url=f"{frontend_url}{redirect_after}" if not settings.is_production else redirect_after,
            status_code=302,
        )
        response.set_cookie(
            key=AuthService.SESSION_COOKIE_NAME,
            value=session.session_token,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="lax",
            max_age=AuthService.SESSION_DURATION_HOURS * 3600,
            path="/",  # Ensure cookie is sent with all requests
        )

        logger.info(f"OAuth login successful for user: {user.username}")
        return response

    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        return RedirectResponse(
            url=f"{frontend_url}/login?error=oauth_failed",
            status_code=302,
        )


# ===================================================================
# MFA ENDPOINTS
# ===================================================================

@router.get("/api/auth/mfa/status")
async def get_mfa_status(
    current_user: User = Depends(get_current_active_user),
):
    """Get MFA status for current user."""
    return {
        "mfa_enabled": current_user.mfa_enabled,
        "mfa_configured": DuoMFAService.is_configured(),
        "mfa_globally_enabled": DuoMFAService.is_enabled(),
    }


@router.post("/api/auth/mfa/enable")
async def enable_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Enable MFA for current user."""
    if not DuoMFAService.is_configured():
        raise HTTPException(
            status_code=501,
            detail="Duo MFA is not configured. Set DUO_INTEGRATION_KEY, DUO_SECRET_KEY, and DUO_API_HOSTNAME.",
        )

    # Check if user is enrolled in Duo
    preauth = await DuoMFAService.check_user(current_user.username)

    if preauth.get("result") == "enroll":
        return {
            "success": False,
            "enrollment_required": True,
            "message": "Please enroll in Duo first using the Duo Mobile app or provided enrollment link.",
        }

    # Enable MFA for user
    current_user.mfa_enabled = True
    await db.commit()

    return {
        "success": True,
        "message": "MFA has been enabled for your account",
    }


@router.post("/api/auth/mfa/disable")
async def disable_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Disable MFA for current user."""
    current_user.mfa_enabled = False
    await db.commit()

    return {
        "success": True,
        "message": "MFA has been disabled for your account",
    }


@router.post("/api/auth/mfa/verify")
async def verify_mfa(
    request: Request,
    response: Response,
    verify_request: MFAVerifyRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Verify MFA and complete login.

    Supports:
    - push: Send Duo Push to user's device
    - passcode: Verify a passcode from Duo app or hardware token
    """
    # Get challenge
    challenge = DuoMFAService.get_challenge(verify_request.challenge_id)
    if not challenge:
        raise HTTPException(status_code=400, detail="Invalid or expired MFA challenge")

    username = challenge["username"]
    user_id = challenge["user_id"]

    # Verify MFA
    if verify_request.method == "push":
        result = await DuoMFAService.send_push(username)
    elif verify_request.method == "passcode":
        if not verify_request.passcode:
            raise HTTPException(status_code=400, detail="Passcode is required")
        result = await DuoMFAService.verify_passcode(username, verify_request.passcode)
    else:
        raise HTTPException(status_code=400, detail="Invalid MFA method")

    if result.get("result") != "allow":
        return {
            "success": False,
            "message": result.get("status_msg", "MFA verification failed"),
        }

    # MFA verified - mark challenge and get user
    DuoMFAService.mark_challenge_verified(verify_request.challenge_id)

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create session
    session = await AuthService.create_session(db, user, request)

    # Return session info (frontend will set cookie)
    return {
        "success": True,
        "message": "MFA verification successful",
        "session_token": session.session_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name,
        },
    }


@router.post("/api/auth/mfa/challenge")
async def create_mfa_challenge(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """Create an MFA challenge for password-based login.

    Called after successful password verification when MFA is required.
    """
    # This is called internally after password auth
    # The user_id should be passed in request body
    body = await request.json()
    user_id = body.get("user_id")
    username = body.get("username")

    if not user_id or not username:
        raise HTTPException(status_code=400, detail="Missing user information")

    if not DuoMFAService.is_enabled():
        raise HTTPException(status_code=400, detail="MFA is not enabled")

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

    # Create challenge
    challenge_id = DuoMFAService.create_challenge(user_id, username)

    return {
        "mfa_required": True,
        "challenge_id": challenge_id,
        "methods": ["push", "passcode"],
    }
