"""OAuth 2.0 service for Google authentication with PKCE support."""

import base64
import hashlib
import logging
import secrets
from typing import Optional
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings
from src.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class OAuthService:
    """Service for handling OAuth 2.0 authentication with Google.

    Implements PKCE (Proof Key for Code Exchange) for enhanced security.
    PKCE prevents authorization code interception attacks by requiring
    a code_verifier that proves the client initiated the request.
    """

    # Store state tokens temporarily (in production, use Redis or DB)
    _state_tokens: dict[str, dict] = {}

    @staticmethod
    def get_credentials() -> tuple[str, str]:
        """Get OAuth credentials from database or environment.

        Returns:
            Tuple of (client_id, client_secret)
        """
        from src.services.config_service import get_config_or_env
        settings = get_settings()

        client_id = get_config_or_env("google_oauth_client_id", "GOOGLE_OAUTH_CLIENT_ID") or settings.google_oauth_client_id
        client_secret = get_config_or_env("google_oauth_client_secret", "GOOGLE_OAUTH_CLIENT_SECRET") or settings.google_oauth_client_secret

        return client_id or "", client_secret or ""

    @staticmethod
    def is_configured() -> bool:
        """Check if OAuth is configured (from database or environment)."""
        client_id, client_secret = OAuthService.get_credentials()
        return bool(client_id and client_secret)

    @staticmethod
    def generate_state_token() -> str:
        """Generate a secure random state token for CSRF protection."""
        return secrets.token_urlsafe(32)

    @staticmethod
    def generate_code_verifier() -> str:
        """Generate a PKCE code verifier.

        The code verifier is a cryptographically random string using
        the unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~",
        with a minimum length of 43 characters and a maximum length of 128 characters.

        Returns:
            A secure random code verifier string (43-128 chars)
        """
        # Generate 32 bytes = 43 chars when base64url encoded (without padding)
        return secrets.token_urlsafe(32)

    @staticmethod
    def generate_code_challenge(code_verifier: str) -> str:
        """Generate a PKCE code challenge from the code verifier.

        Uses the S256 method: BASE64URL(SHA256(code_verifier))

        Args:
            code_verifier: The PKCE code verifier

        Returns:
            The code challenge (base64url-encoded SHA-256 hash)
        """
        # SHA-256 hash the code verifier
        digest = hashlib.sha256(code_verifier.encode('ascii')).digest()
        # Base64url encode without padding
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')

    @staticmethod
    def store_state(state: str, data: dict) -> None:
        """Store state token with associated data (including PKCE code_verifier)."""
        OAuthService._state_tokens[state] = data

    @staticmethod
    def validate_state(state: str) -> Optional[dict]:
        """Validate and consume a state token."""
        return OAuthService._state_tokens.pop(state, None)

    @staticmethod
    def get_authorization_url(redirect_after: str = "/") -> tuple[str, str]:
        """Generate Google OAuth authorization URL with PKCE.

        Implements PKCE (RFC 7636) for enhanced security against authorization
        code interception attacks.

        Args:
            redirect_after: URL to redirect to after successful auth

        Returns:
            Tuple of (authorization_url, state_token)
        """
        settings = get_settings()

        if not OAuthService.is_configured():
            raise ValueError("Google OAuth is not configured")

        # Generate PKCE code verifier and challenge
        code_verifier = OAuthService.generate_code_verifier()
        code_challenge = OAuthService.generate_code_challenge(code_verifier)

        state = OAuthService.generate_state_token()
        # Store code_verifier with state for use in token exchange
        OAuthService.store_state(state, {
            "redirect_after": redirect_after,
            "code_verifier": code_verifier,
        })

        client_id, _ = OAuthService.get_credentials()
        params = {
            "client_id": client_id,
            "redirect_uri": settings.oauth_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",  # Get refresh token
            "prompt": "consent",  # Always show consent screen for refresh token
            # PKCE parameters
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
        logger.debug(f"Generated OAuth URL with PKCE (state={state[:8]}...)")
        return auth_url, state

    @staticmethod
    async def exchange_code_for_tokens(code: str, code_verifier: Optional[str] = None) -> dict:
        """Exchange authorization code for access and refresh tokens.

        Includes PKCE code_verifier to prove we initiated the authorization request.

        Args:
            code: Authorization code from Google
            code_verifier: PKCE code verifier (required for PKCE flows)

        Returns:
            Token response with access_token, refresh_token, etc.
        """
        settings = get_settings()
        client_id, client_secret = OAuthService.get_credentials()

        token_data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.oauth_redirect_uri,
        }

        # Include PKCE code_verifier if provided
        if code_verifier:
            token_data["code_verifier"] = code_verifier
            logger.debug("Including PKCE code_verifier in token exchange")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data=token_data,
            )

            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.text}")
                raise ValueError(f"Token exchange failed: {response.text}")

            return response.json()

    @staticmethod
    async def get_user_info(access_token: str) -> dict:
        """Get user info from Google using access token.

        Args:
            access_token: Google access token

        Returns:
            User info dict with id, email, name, picture, etc.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                logger.error(f"Failed to get user info: {response.text}")
                raise ValueError(f"Failed to get user info: {response.text}")

            return response.json()

    @staticmethod
    async def find_or_create_user(
        session: AsyncSession,
        user_info: dict,
        tokens: dict,
    ) -> User:
        """Find existing user or create new one from OAuth data.

        Args:
            session: Database session
            user_info: User info from Google
            tokens: OAuth tokens

        Returns:
            User object
        """
        google_id = user_info.get("id")
        email = user_info.get("email")
        name = user_info.get("name")
        picture = user_info.get("picture")

        # First, try to find by OAuth ID
        result = await session.execute(
            select(User).where(
                User.oauth_provider == "google",
                User.oauth_id == google_id
            )
        )
        user = result.scalar_one_or_none()

        if user:
            # Update tokens and profile
            user.oauth_access_token = tokens.get("access_token")
            if tokens.get("refresh_token"):
                user.oauth_refresh_token = tokens.get("refresh_token")
            user.profile_picture_url = picture
            logger.info(f"OAuth user found and updated: {email}")
            return user

        # Try to find by email (existing local user linking to OAuth)
        result = await session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if user:
            # Link existing user to OAuth
            user.oauth_provider = "google"
            user.oauth_id = google_id
            user.oauth_access_token = tokens.get("access_token")
            user.oauth_refresh_token = tokens.get("refresh_token")
            user.profile_picture_url = picture
            if name and not user.full_name:
                user.full_name = name
            logger.info(f"Existing user linked to OAuth: {email}")
            return user

        # User not found - do NOT auto-create
        # New users must be created by an admin via the Security page
        logger.warning(f"OAuth login rejected: no existing user with email {email}")
        raise ValueError(f"No account exists for {email}. Please contact an administrator to create your account.")

    @staticmethod
    async def refresh_access_token(refresh_token: str) -> dict:
        """Refresh an expired access token.

        Args:
            refresh_token: Google refresh token

        Returns:
            New token response
        """
        client_id, client_secret = OAuthService.get_credentials()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )

            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.text}")
                raise ValueError(f"Token refresh failed: {response.text}")

            return response.json()
